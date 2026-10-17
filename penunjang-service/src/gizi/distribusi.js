import express from "express";
import { satu, sisipkan, ubah, transaksi } from "../db.js";
import { tangani, kirim, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { izinGizi } from "../umum/izin.js";
import { WAKTU_MAKAN, tanggalValid } from "./bersama.js";
import { daftarAktif, ambilAlergi } from "./rawat_inap.js";
import { orderAktif } from "./order.js";

const rute = express.Router();

const BELUM_KONFIRMASI = "Belum tercatat/perlu konfirmasi";

const wajibQuery = (q) => {
  if (!q.tanggal) throw permintaanSalah("tanggal wajib diisi");
  if (!q.ruangan_uuid) throw permintaanSalah("ruangan_uuid wajib diisi");
  if (!WAKTU_MAKAN.includes(q.waktu_makan)) throw permintaanSalah(`waktu_makan harus salah satu dari: ${WAKTU_MAKAN.join(", ")}`);
  return tanggalValid(q.tanggal);
};

// Daftar pasien rawat inap aktif pada ruangan (lokasi) tsb beserta order diet berlaku & alergi tercatat — selalu
// dibentuk dari data Rawat Inap & order diet TERKINI (bukan dari snapshot distribusi sebelumnya).
const bangunDaftar = async (faskesUuid, ruanganUuid, token) => {
  const pasien = await daftarAktif(faskesUuid, { ruanganUuid });
  return Promise.all(
    pasien.map(async (p) => {
      const [order, alergi] = await Promise.all([orderAktif(faskesUuid, p.uuid), ambilAlergi(p.rekam_medis_uuid, token)]);
      return {
        admission_ri_uuid: p.uuid,
        no_rm: p.no_rm,
        nama_pasien: p.nama_pasien,
        nama_bangsal: p.nama_bangsal,
        nama_kamar: p.nama_kamar,
        no_bed: p.no_bed,
        order_diet_uuid: order?.uuid ?? null,
        nama_diet: order?.nama_diet ?? null,
        nama_bentuk_makanan: order?.nama_bentuk_makanan ?? null,
        pantangan: order?.pantangan ?? null,
        alergi_tercatat: alergi.tercatat,
        alergi: alergi.tercatat ? alergi.teks : BELUM_KONFIRMASI,
      };
    }),
  );
};

// Rekap jumlah porsi per jenis diet dari daftar distribusi (populasi aktif); pasien tanpa order diet berlaku
// dihitung terpisah di tanpaOrder, tidak masuk rekap per diet.
export const hitungRekapPorsi = (data) => {
  const rekap = new Map();
  let tanpaOrder = 0;
  for (const item of data) {
    if (!item.order_diet_uuid) {
      tanpaOrder += 1;
      continue;
    }
    rekap.set(item.nama_diet, (rekap.get(item.nama_diet) ?? 0) + 1);
  }
  return { data: [...rekap.entries()].map(([nama_diet, jumlah_porsi]) => ({ nama_diet, jumlah_porsi })), tanpaOrder };
};

const headerTerakhir = (faskesUuid, ruanganUuid, tanggal, waktuMakan) =>
  satu(
    `SELECT * FROM gizi_distribusi WHERE faskes_uuid = $1 AND ruangan_uuid = $2 AND tanggal = $3 AND waktu_makan = $4 AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
    [faskesUuid, ruanganUuid, tanggal, waktuMakan],
  );

rute.get(
  "/",
  izinGizi("Distribusi", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const tanggal = wajibQuery(req.query);
    const [distribusi, data] = await Promise.all([
      headerTerakhir(f, req.query.ruangan_uuid, tanggal, req.query.waktu_makan),
      bangunDaftar(f, req.query.ruangan_uuid, req.author.token),
    ]);
    kirim(res, { distribusi, data });
  }),
);

// Membentuk & menyimpan snapshot daftar distribusi (untuk dicetak/diarsipkan). Setiap pemanggilan membuat versi
// baru (header + item); versi lama tetap tersimpan sebagai riwayat agar perubahan order/lokasi/pulang setelah
// dicetak tetap terlihat jelas, bukan menimpa daftar yang sudah diproses.
rute.post(
  "/",
  izinGizi("Distribusi", "CREATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const tanggal = wajibQuery(req.body);
    const data = await bangunDaftar(f, req.body.ruangan_uuid, req.author.token);
    const distribusi = await transaksi(async (k) => {
      const header = await sisipkan(
        "gizi_distribusi",
        { faskes_uuid: f, ruangan_uuid: req.body.ruangan_uuid, tanggal, waktu_makan: req.body.waktu_makan, status: "draf", dibuat_oleh: req.author.username },
        k,
      );
      for (const item of data) {
        await sisipkan(
          "gizi_distribusi_item",
          {
            faskes_uuid: f,
            distribusi_uuid: header.uuid,
            admission_ri_uuid: item.admission_ri_uuid,
            order_diet_uuid: item.order_diet_uuid,
            nama_pasien: item.nama_pasien,
            no_rm: item.no_rm,
            nama_diet_snapshot: item.nama_diet,
            bentuk_makanan_snapshot: item.nama_bentuk_makanan,
            pantangan_snapshot: item.pantangan,
            lokasi_snapshot: { nama_bangsal: item.nama_bangsal, nama_kamar: item.nama_kamar, no_bed: item.no_bed },
            alergi_snapshot: item.alergi,
          },
          k,
        );
      }
      return header;
    });
    kirim(res, { distribusi, data }, "Daftar distribusi berhasil dibentuk");
  }),
);

rute.post(
  "/:uuid/cetak",
  izinGizi("Distribusi", "CETAK"),
  tangani(async (req, res) => {
    const r = await ubah("gizi_distribusi", req.params.uuid, req.author.faskesUuid, { status: "dicetak" });
    if (!r) throw tidakDitemukan("Distribusi");
    kirim(res, { distribusi_uuid: r.uuid, status: r.status }, "Distribusi ditandai sudah dicetak");
  }),
);

// Rekap jumlah porsi per jenis diet, dari populasi aktif yang sama dengan daftar distribusi (GET /).
rute.get(
  "/rekap-porsi",
  izinGizi("Distribusi", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    wajibQuery(req.query);
    const data = await bangunDaftar(f, req.query.ruangan_uuid, req.author.token);
    const { data: rekapData, tanpaOrder } = hitungRekapPorsi(data);
    kirim(res, { data: rekapData, tanpa_order: tanpaOrder });
  }),
);

export default rute;
