import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { izinGizi } from "../umum/izin.js";
import { RUTE_DIET, teks } from "./bersama.js";
import { episodeAktif, ambilAlergi, daftarAktif } from "./rawat_inap.js";

const rute = express.Router();

// Pasien rawat inap aktif (cari nama/no. RM, opsional per ruangan) — untuk memilih pasien pada form Order Diet.
// termasuk_pulang=1: ikut episode yang sudah pulang, untuk membuka riwayat gizi (baca saja).
rute.get(
  "/rawat-inap/aktif",
  izinGizi("Order Diet", "READ"),
  tangani(async (req, res) => {
    const termasukPulang = ["1", "true"].includes(String(req.query.termasuk_pulang ?? ""));
    kirim(res, await daftarAktif(req.author.faskesUuid, { ruanganUuid: req.query.ruangan_uuid, cari: req.query.cari, termasukPulang }));
  }),
);

const PILIH_ORDER = `o.uuid, o.faskes_uuid, o.admission_ri_uuid, o.diet_uuid, o.bentuk_makanan_uuid, o.kalori, o.rute,
  o.pantangan, o.waktu_mulai, o.status, o.alasan_batal, o.dibuat_oleh, o.diubah_oleh, o.created_at, o.updated_at,
  d.nama_diet, b.nama AS nama_bentuk_makanan`;
const DARI_ORDER = `gizi_order_diet o JOIN gizi_master_diet d ON d.uuid = o.diet_uuid JOIN gizi_master_bentuk_makanan b ON b.uuid = o.bentuk_makanan_uuid`;

const orderAktif = (faskesUuid, admissionRiUuid) =>
  satu(`SELECT ${PILIH_ORDER} FROM ${DARI_ORDER} WHERE o.faskes_uuid = $1 AND o.admission_ri_uuid = $2 AND o.status = 'aktif' AND o.deleted_at IS NULL`, [
    faskesUuid,
    admissionRiUuid,
  ]);

// Order diet yang berlaku + alergi tercatat (RME) + riwayat order episode. Dipakai form Order Diet & Distribusi.
// Episode yang sudah pulang tetap dapat dibaca (riwayat); menulis order baru hanya untuk episode aktif (POST).
rute.get(
  "/rawat-inap/:admission_ri_uuid/order-diet",
  izinGizi("Order Diet", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const episode = await episodeAktif(f, req.params.admission_ri_uuid, { termasukPulang: true });
    const [order_aktif, riwayat, alergi] = await Promise.all([
      orderAktif(f, episode.uuid),
      query(`SELECT ${PILIH_ORDER} FROM ${DARI_ORDER} WHERE o.faskes_uuid = $1 AND o.admission_ri_uuid = $2 AND o.deleted_at IS NULL
              ORDER BY o.created_at DESC`, [f, episode.uuid]),
      ambilAlergi(episode.rekam_medis_uuid, req.author.token),
    ]);
    kirim(res, { order_aktif, riwayat, alergi });
  }),
);

rute.post(
  "/rawat-inap/:admission_ri_uuid/order-diet",
  izinGizi("Order Diet", "CREATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const episode = await episodeAktif(f, req.params.admission_ri_uuid);
    wajib(req.body, ["diet_uuid", "bentuk_makanan_uuid"]);
    const diet = await satu(`SELECT uuid FROM gizi_master_diet WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status`, [
      req.body.diet_uuid,
      f,
    ]);
    if (!diet) throw permintaanSalah("Master diet tidak ditemukan/tidak aktif");
    const bentuk = await satu(
      `SELECT uuid FROM gizi_master_bentuk_makanan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status`,
      [req.body.bentuk_makanan_uuid, f],
    );
    if (!bentuk) throw permintaanSalah("Bentuk makanan tidak ditemukan/tidak aktif");
    if (!RUTE_DIET.includes(req.body.rute ?? "oral")) throw permintaanSalah(`rute harus salah satu dari: ${RUTE_DIET.join(", ")}`);
    await transaksi(async (k) => {
      await k.query(
        `UPDATE gizi_order_diet SET status = 'dibatalkan', alasan_batal = 'Digantikan order diet baru', updated_at = $1
          WHERE admission_ri_uuid = $2 AND faskes_uuid = $3 AND status = 'aktif' AND deleted_at IS NULL`,
        [sekarang(), episode.uuid, f],
      );
      return sisipkan(
        "gizi_order_diet",
        {
          faskes_uuid: f,
          admission_ri_uuid: episode.uuid,
          diet_uuid: req.body.diet_uuid,
          bentuk_makanan_uuid: req.body.bentuk_makanan_uuid,
          kalori: req.body.kalori === undefined || req.body.kalori === "" ? null : Number(req.body.kalori),
          rute: req.body.rute ?? "oral",
          pantangan: teks(req.body.pantangan),
          waktu_mulai: req.body.waktu_mulai ? Number(req.body.waktu_mulai) : sekarang(),
          status: "aktif",
          dibuat_oleh: req.author.username,
        },
        k,
      );
    });
    kirim(res, await orderAktif(f, episode.uuid), "Order diet berhasil disimpan");
  }),
);

// Ubah order aktif (field diet/bentuk/kalori/rute/pantangan), atau batalkan (status: 'dibatalkan' + alasan_batal).
rute.put(
  "/order-diet/:uuid",
  izinGizi("Order Diet", "UPDATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const lama = await satu(`SELECT * FROM gizi_order_diet WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [
      req.params.uuid,
      f,
    ]);
    if (!lama) throw tidakDitemukan("Order diet");
    if (lama.status !== "aktif") throw permintaanSalah("Order diet ini sudah tidak aktif");
    await episodeAktif(f, lama.admission_ri_uuid); // episode sudah pulang: hanya baca
    const perubahan = {
      diet_uuid: req.body.diet_uuid,
      bentuk_makanan_uuid: req.body.bentuk_makanan_uuid,
      kalori: req.body.kalori === undefined ? undefined : req.body.kalori === "" || req.body.kalori === null ? null : Number(req.body.kalori),
      rute: req.body.rute,
      pantangan: teks(req.body.pantangan),
      diubah_oleh: req.author.username,
    };
    if (req.body.status === "dibatalkan") {
      perubahan.status = "dibatalkan";
      perubahan.alasan_batal = teks(req.body.alasan_batal) ?? "Dibatalkan DPJP";
    } else if (perubahan.rute !== undefined && !RUTE_DIET.includes(perubahan.rute)) {
      throw permintaanSalah(`rute harus salah satu dari: ${RUTE_DIET.join(", ")}`);
    }
    await ubah("gizi_order_diet", req.params.uuid, f, perubahan);
    kirim(res, await orderAktif(f, lama.admission_ri_uuid), "Order diet berhasil diperbarui");
  }),
);

export default rute;
export { orderAktif };
