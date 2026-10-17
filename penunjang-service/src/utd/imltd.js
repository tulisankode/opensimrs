import express from "express";
import { query, satu, sisipkan, ubah, sekarang, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { HASIL_IMLTD, PARAMETER_IMLTD, cekPilihan, teks, waktuOpsional } from "./bersama.js";
import { izinUtd } from "../umum/izin.js";

// Uji Saring IMLTD (HIV, HBsAg, HCV, sifilis) per kantong; satu hasil reaktif mengarantina kantong & seluruh
// komponen turunannya (KF-17), kecuali konfirmasi menyatakan sebaliknya (aturan bisnis #6). Pelepasan ke stok
// adalah tindakan terpisah oleh petugas berwenang, hanya setelah status akhir non-reaktif (KF-16, KF-23).
const rute = express.Router();

const PARAM = Object.keys(PARAMETER_IMLTD);

// Hasil efektif per parameter: konfirmasi terakhir bila ada, selain itu hasil awal. null bila belum diperiksa.
const hasilEfektif = (row, param) => {
  const konfirmasi = (row.hasil_konfirmasi ?? []).filter((x) => x.parameter === param);
  if (konfirmasi.length) return konfirmasi[konfirmasi.length - 1].hasil;
  return row[`${param}_hasil`] ?? null;
};

const hitungStatusAkhir = (row) => {
  const efektif = PARAM.map((p) => hasilEfektif(row, p));
  if (efektif.some((h) => h === "reaktif")) return "reaktif";
  const lengkap = PARAM.every((p) => row[`${p}_hasil`] != null);
  if (lengkap && efektif.every((h) => h === "non_reaktif")) return "non_reaktif";
  return "pending";
};

const kunciAftap = async (uuid, faskes, k) => {
  const a = await satu(`SELECT * FROM utd_aftap WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [uuid, faskes], k);
  if (!a) throw tidakDitemukan("Aftap");
  return a;
};

// Cascade saat status akhir berubah: reaktif → karantina kantong & tahan donor untuk notifikasi/konseling (KF-17);
// kembali non-reaktif via konfirmasi → kantong kembali karantina biasa (menunggu pelepasan eksplisit).
const terapkanCascade = async (aftap, statusLama, statusBaru, faskes, k) => {
  if (statusBaru === statusLama) return;
  if (statusBaru === "reaktif") {
    await ubah("utd_aftap", aftap.uuid, faskes, { status_kantong: "karantina_reaktif" }, k);
    await ubah("utd_donor", aftap.donor_uuid, faskes, {
      status_aktif: "ditahan", alasan_ditahan: `Hasil IMLTD reaktif pada kantong ${aftap.no_kantong}`,
      perlu_notifikasi: true, notifikasi_selesai: false,
    }, k);
  } else if (statusLama === "reaktif" && aftap.status_kantong === "karantina_reaktif") {
    await ubah("utd_aftap", aftap.uuid, faskes, { status_kantong: "karantina" }, k);
  }
};

const kolomHasil = (b, prefix) => {
  const hasil = b[`${prefix}_hasil`];
  const out = {};
  if (hasil !== undefined) out[`${prefix}_hasil`] = hasil === null || hasil === "" ? null : cekPilihan(hasil, HASIL_IMLTD, `${prefix}_hasil`);
  if (b[`${prefix}_metode`] !== undefined) out[`${prefix}_metode`] = teks(b[`${prefix}_metode`]);
  if (b[`${prefix}_waktu`] !== undefined) out[`${prefix}_waktu`] = waktuOpsional(b[`${prefix}_waktu`], `${prefix}_waktu`);
  return out;
};

// Antrean kantong yang menunggu/berjalan uji saring (belum berstatus akhir non-reaktif/reaktif final yang dilepas).
rute.get(
  "/imltd/worklist",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    const dari = `FROM utd_aftap a LEFT JOIN utd_imltd i ON i.aftap_uuid = a.uuid AND i.deleted_at IS NULL
                  JOIN utd_donor d ON d.uuid = a.donor_uuid`;
    const w = `a.faskes_uuid = $1 AND a.deleted_at IS NULL AND a.status_kantong IN ('karantina', 'karantina_reaktif')`;
    const total = (await satu(`SELECT COUNT(*) n ${dari} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT a.uuid AS aftap_uuid, a.no_kantong, a.status_kantong, a.created_at, d.no_donor, d.nama AS nama_donor,
              i.uuid AS imltd_uuid, i.status_akhir
         ${dari} WHERE ${w} ORDER BY a.created_at LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Simpan/ubah hasil awal 4 parameter. Body: { hiv_hasil?, hiv_metode?, hiv_waktu?, hbsag_*, hcv_*, sifilis_*, analis_uuid? }.
rute.put(
  "/aftap/:uuid/imltd",
  izinUtd("IMLTD", "INPUT HASIL"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    const t = await transaksi(async (k) => {
      const aftap = await kunciAftap(req.params.uuid, faskes, k);
      if (["tersedia", "dimusnahkan"].includes(aftap.status_kantong)) throw new Galat(409, `Kantong berstatus ${aftap.status_kantong}, hasil tidak dapat diubah`);
      let i = await satu(`SELECT * FROM utd_imltd WHERE aftap_uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [aftap.uuid], k);
      const data = { ...kolomHasil(b, "hiv"), ...kolomHasil(b, "hbsag"), ...kolomHasil(b, "hcv"), ...kolomHasil(b, "sifilis") };
      if (b.analis_uuid !== undefined) data.analis_uuid = teks(b.analis_uuid);
      if (!i) i = await sisipkan("utd_imltd", { faskes_uuid: faskes, aftap_uuid: aftap.uuid, ...data }, k);
      else i = await ubah("utd_imltd", i.uuid, faskes, data, k);
      const statusLama = i.status_akhir;
      const statusBaru = hitungStatusAkhir(i);
      if (statusBaru !== statusLama) i = await ubah("utd_imltd", i.uuid, faskes, { status_akhir: statusBaru }, k);
      await terapkanCascade(aftap, statusLama, statusBaru, faskes, k);
      return i;
    });
    kirim(res, t, `Hasil IMLTD tersimpan (${t.status_akhir === "reaktif" ? "REAKTIF — kantong dikarantina" : t.status_akhir})`);
  }),
);

// Catat pemeriksaan konfirmasi untuk satu parameter yang sudah punya hasil awal. Body: { parameter, hasil, metode?, waktu? }.
rute.post(
  "/aftap/:uuid/imltd/konfirmasi",
  izinUtd("IMLTD", "INPUT HASIL"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    const parameter = cekPilihan(b.parameter, PARAMETER_IMLTD, "parameter");
    if (!parameter) throw permintaanSalah("parameter wajib diisi");
    const hasil = cekPilihan(b.hasil, HASIL_IMLTD, "hasil");
    if (!hasil) throw permintaanSalah("hasil wajib diisi");
    const t = await transaksi(async (k) => {
      const aftap = await kunciAftap(req.params.uuid, faskes, k);
      if (aftap.status_kantong === "dimusnahkan") throw new Galat(409, "Kantong sudah dimusnahkan");
      const i = await satu(`SELECT * FROM utd_imltd WHERE aftap_uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [aftap.uuid], k);
      if (!i) throw new Galat(409, "Hasil awal IMLTD belum dicatat");
      if (i[`${parameter}_hasil`] == null) throw permintaanSalah(`Hasil awal ${PARAMETER_IMLTD[parameter]} belum dicatat`);
      const konfirmasi = [
        ...(i.hasil_konfirmasi ?? []),
        { parameter, hasil, metode: teks(b.metode), waktu: waktuOpsional(b.waktu, "waktu") ?? sekarang(), analis_uuid: teks(b.analis_uuid), dicatat_pada: sekarang() },
      ];
      const digabung = { ...i, hasil_konfirmasi: konfirmasi };
      const statusBaru = hitungStatusAkhir(digabung);
      const t2 = await ubah("utd_imltd", i.uuid, faskes, { hasil_konfirmasi: konfirmasi, status_akhir: statusBaru }, k);
      await terapkanCascade(aftap, i.status_akhir, statusBaru, faskes, k);
      return t2;
    });
    kirim(res, t, "Hasil konfirmasi IMLTD tersimpan");
  }),
);

// Pelepasan: hasil akhir non-reaktif → kantong & komponen karantina menjadi tersedia (KF-16, KF-23).
rute.post(
  "/aftap/:uuid/pelepasan",
  izinUtd("IMLTD", "PELEPASAN"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    await transaksi(async (k) => {
      const aftap = await kunciAftap(req.params.uuid, faskes, k);
      if (aftap.status_kantong !== "karantina") throw new Galat(409, `Kantong berstatus ${aftap.status_kantong}, tidak dapat dilepas`);
      const i = await satu(`SELECT * FROM utd_imltd WHERE aftap_uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [aftap.uuid], k);
      if (!i || i.status_akhir !== "non_reaktif") throw new Galat(409, "Hasil IMLTD belum lengkap/non-reaktif; kantong tidak dapat dilepas");
      if (i.dilepas_pada) throw new Galat(409, "Kantong sudah pernah dilepas");
      await ubah("utd_imltd", i.uuid, faskes, { dilepas_oleh: req.author.username ?? null, dilepas_pada: sekarang() }, k);
      await ubah("utd_aftap", aftap.uuid, faskes, { status_kantong: "tersedia" }, k);
      await query(
        `UPDATE utd_komponen SET status = 'tersedia', dilepas_oleh = $3, dilepas_pada = $4, updated_at = $4
           WHERE aftap_uuid = $1 AND faskes_uuid = $2 AND status = 'karantina' AND deleted_at IS NULL`,
        [aftap.uuid, faskes, req.author.username ?? null, sekarang()], k,
      );
    });
    const a = await satu(`SELECT * FROM utd_aftap WHERE uuid = $1 AND faskes_uuid = $2`, [req.params.uuid, faskes]);
    const komponen = await query(`SELECT uuid, jenis_komponen, label_unik, status FROM utd_komponen WHERE aftap_uuid = $1 AND deleted_at IS NULL`, [a.uuid]);
    kirim(res, { ...a, komponen }, `Kantong ${a.no_kantong} dilepas ke stok`);
  }),
);

export default rute;
