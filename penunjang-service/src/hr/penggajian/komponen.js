import express from "express";
import { query, satu, sisipkan, ubah, transaksi } from "../../db.js";
import { kirim, permintaanSalah } from "../../umum/respons.js";
import { SUB, konflik, wajibTeks, masaBerlaku, epoch } from "./bersama.js";
import { sen, uang } from "./perhitungan.js";
import { izin, tangani, baca, daftar, ambil, pegawai, catat } from "./dasar.js";

const rute = express.Router();
export const kunci = (k, f, nama) => k.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`gaji:${f}:${nama}`]);
export const tanpaTumpangTindih = async (k, f, tabel, kondisi, params, masa) => {
  const ada = await satu(`SELECT uuid FROM ${tabel} WHERE faskes_uuid = $1 AND deleted_at IS NULL AND ${kondisi}
    AND berlaku_mulai < COALESCE($${params.length + 3}::bigint, 9223372036854775807)
    AND (berlaku_sampai IS NULL OR berlaku_sampai > $${params.length + 2}) LIMIT 1`, [f, ...params, masa.berlaku_mulai, masa.berlaku_sampai], k);
  if (ada) throw konflik("Masa berlaku bertumpang tindih");
};
export const lindungiMasa = async (k, f, mulai, sampai) => {
  const ada = await satu(`SELECT uuid FROM hr_gaji_periode WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status <> 'draf'
    AND (EXTRACT(EPOCH FROM make_timestamptz(tahun, bulan, 1, 0, 0, 0, 'Asia/Jakarta'))) < COALESCE($3::bigint, 9223372036854775807)
    AND (EXTRACT(EPOCH FROM (make_timestamptz(tahun, bulan, 1, 0, 0, 0, 'Asia/Jakarta') + interval '1 month'))) > $2 LIMIT 1`, [f, mulai, sampai], k);
  if (ada) throw konflik("Masa berlaku menyentuh periode yang sedang diverifikasi atau terkunci; gunakan periode berikutnya");
};
rute.get("/komponen", izin([SUB.komponen, "READ"]), baca((k, req) => daftar(k, req, "hr_gaji_komponen")));
const master = (b) => {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(b.kode)) throw permintaanSalah("Kode komponen tidak sah");
  if (!["penghasilan", "potongan", "iuran_pemberi_kerja"].includes(b.jenis)) throw permintaanSalah("Jenis komponen tidak sah");
  if (!["gaji_pokok", "tunjangan", "potongan_lain", "iuran"].includes(b.kategori)) throw permintaanSalah("Kategori komponen tidak sah");
  if (!["kena_pajak", "bukan_objek"].includes(b.perlakuan_pajak)) throw permintaanSalah("Perlakuan pajak wajib ditetapkan");
  return { kode: b.kode, nama: wajibTeks(b.nama, "nama", 150), jenis: b.jenis, kategori: b.kategori, perlakuan_pajak: b.perlakuan_pajak };
};
for (const metode of ["post", "put"]) rute[metode](metode === "post" ? "/komponen" : "/komponen/:uuid", izin([SUB.komponen, metode === "post" ? "CREATE" : "UPDATE"]), tangani(async (req, res) => {
  const data = master(req.body ?? {}), f = req.author.faskesUuid;
  const hasil = await transaksi(async (k) => {
    await kunci(k, f, "sumber");
    if (metode === "put") {
      await ambil(k, f, "hr_gaji_komponen", req.params.uuid, true);
      const dipakai = await satu(`SELECT uuid FROM hr_gaji_komponen_pegawai WHERE faskes_uuid = $1 AND komponen_uuid = $2 AND deleted_at IS NULL UNION ALL SELECT uuid FROM hr_gaji_rincian WHERE faskes_uuid = $1 AND komponen_uuid = $2 AND deleted_at IS NULL LIMIT 1`, [f, req.params.uuid], k);
      if (dipakai) throw konflik("Komponen telah digunakan; buat komponen baru untuk perubahan makna");
    }
    const row = metode === "post" ? await sisipkan("hr_gaji_komponen", { ...data, faskes_uuid: f }, k) : await ubah("hr_gaji_komponen", req.params.uuid, f, data, k);
    await catat(k, req, "simpan_komponen", row.uuid);
    return row;
  });
  kirim(res, hasil, "Komponen disimpan");
}));
rute.get("/skala", izin([SUB.komponen, "READ"]), baca((k, req) => daftar(k, req, "hr_gaji_skala", req.query.golongan ? "AND golongan = $2" : "", req.query.golongan ? [req.query.golongan] : [])));
rute.post("/skala", izin([SUB.komponen, "CREATE"]), tangani(async (req, res) => {
  const b = req.body ?? {}, f = req.author.faskesUuid, masa = masaBerlaku(b);
  const min = b.masa_kerja_min_bulan, maks = b.masa_kerja_maks_bulan ?? null;
  if (!Number.isSafeInteger(min) || min < 0 || maks !== null && (!Number.isSafeInteger(maks) || maks <= min)) throw permintaanSalah("Rentang masa kerja tidak sah");
  const nilai = uang(sen(b.nilai));
  if (sen(nilai) < 0n) throw permintaanSalah("Nilai skala tidak boleh negatif");
  const hasil = await transaksi(async (k) => {
    await kunci(k, f, "sumber");
    await lindungiMasa(k, f, masa.berlaku_mulai, masa.berlaku_sampai);
    await tanpaTumpangTindih(k, f, "hr_gaji_skala", "golongan = $2 AND masa_kerja_min_bulan < COALESCE($4::integer, 2147483647) AND (masa_kerja_maks_bulan IS NULL OR masa_kerja_maks_bulan > $3)", [wajibTeks(b.golongan, "golongan", 50), min, maks], masa);
    const row = await sisipkan("hr_gaji_skala", { faskes_uuid: f, golongan: b.golongan.trim(), masa_kerja_min_bulan: min, masa_kerja_maks_bulan: maks, nilai, ...masa }, k);
    await catat(k, req, "buat_skala", row.uuid);
    return row;
  });
  kirim(res, hasil, "Skala gaji dicatat");
}));
rute.get("/pegawai/:uuid/komponen", izin([SUB.komponen, "READ"]), baca(async (k, req) => {
  await pegawai(k, req.author.faskesUuid, req.params.uuid);
  return daftar(k, req, "hr_gaji_komponen_pegawai", "AND kepegawaian_uuid = $2", [req.params.uuid]);
}));
rute.post("/pegawai/:uuid/komponen", izin([SUB.komponen, "CREATE"]), tangani(async (req, res) => {
  const b = req.body ?? {}, f = req.author.faskesUuid, masa = masaBerlaku(b);
  if ((b.nilai != null) === (b.skala_uuid != null)) throw permintaanSalah("Pilih nilai tetap atau skala gaji");
  const hasil = await transaksi(async (k) => {
    await kunci(k, f, "sumber");
    await pegawai(k, f, req.params.uuid);
    const master = await ambil(k, f, "hr_gaji_komponen", b.komponen_uuid, true);
    if (!master.aktif) throw konflik("Komponen tidak aktif");
    if (b.skala_uuid) {
      if (master.kategori !== "gaji_pokok") throw permintaanSalah("Skala hanya untuk gaji pokok");
      await ambil(k, f, "hr_gaji_skala", b.skala_uuid);
    } else if (sen(b.nilai) < 0n) throw permintaanSalah("Nilai penetapan tidak boleh negatif");
    await lindungiMasa(k, f, masa.berlaku_mulai, masa.berlaku_sampai);
    await tanpaTumpangTindih(k, f, "hr_gaji_komponen_pegawai", "kepegawaian_uuid = $2 AND komponen_uuid = $3", [req.params.uuid, b.komponen_uuid], masa);
    const row = await sisipkan("hr_gaji_komponen_pegawai", { faskes_uuid: f, kepegawaian_uuid: req.params.uuid, komponen_uuid: b.komponen_uuid, nilai: b.nilai == null ? null : uang(sen(b.nilai)), skala_uuid: b.skala_uuid ?? null, alasan: wajibTeks(b.alasan, "alasan"), ...masa }, k);
    await catat(k, req, "tetapkan_komponen", row.uuid, { alasan: row.alasan });
    return row;
  });
  kirim(res, hasil, "Komponen pegawai dicatat");
}));
rute.post("/komponen-pegawai/:uuid/akhiri", izin([SUB.komponen, "UPDATE"]), tangani(async (req, res) => {
  const f = req.author.faskesUuid, akhir = epoch(req.body?.berlaku_sampai, "berlaku_sampai"), alasan = wajibTeks(req.body?.alasan, "alasan");
  const row = await transaksi(async (k) => {
    await kunci(k, f, "sumber");
    const r = await ambil(k, f, "hr_gaji_komponen_pegawai", req.params.uuid, true);
    if (akhir <= Number(r.berlaku_mulai) || r.berlaku_sampai != null && akhir > Number(r.berlaku_sampai)) throw permintaanSalah("Tanggal pengakhiran tidak sah");
    await lindungiMasa(k, f, akhir, r.berlaku_sampai);
    const hasil = await ubah("hr_gaji_komponen_pegawai", r.uuid, f, { berlaku_sampai: akhir }, k);
    await catat(k, req, "akhiri_komponen", r.uuid, { alasan });
    return hasil;
  });
  kirim(res, row, "Masa berlaku ditutup");
}));
export default rute;
