import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../../db.js";
import { kirim, permintaanSalah } from "../../umum/respons.js";
import { SUB, konflik, wajibTeks, teksOpsional, masaBerlaku, hash } from "./bersama.js";
import { validasiKonfigurasi, hitungAturan, desimal } from "./perhitungan.js";
import { izin, tangani, baca, daftar, ambil, pegawai, catat, pengguna } from "./dasar.js";
import { kunci, tanpaTumpangTindih, lindungiMasa } from "./komponen.js";

const rute = express.Router();
export const isiKonfigurasi = (b) => {
  validasiKonfigurasi(b);
  const data = { ...masaBerlaku(b), aturan: b.aturan, kebijakan: b.kebijakan, kasus_uji: b.kasus_uji, dasar_aturan: wajibTeks(b.dasar_aturan, "dasar_aturan", 4000) };
  return { ...data, hash_konfigurasi: hash(data) };
};
export const samarkanRekening = (r) => ({ ...r, nomor_rekening: `••••${r.nomor_rekening.slice(-4)}` });
export const validasiFormat = (s) => {
  if (!s || s.jenis !== "csv" || ![",", ";", "\t"].includes(s.pemisah) || typeof s.header !== "boolean" || !["titik", "koma"].includes(s.desimal)) throw permintaanSalah("Format CSV, pemisah, header, dan desimal wajib ditetapkan");
  const boleh = ["kode_bank", "nomor_rekening", "nama_pemilik", "bersih", "referensi"];
  if (!Array.isArray(s.kolom) || !s.kolom.length || s.kolom.length > 10 || new Set(s.kolom).size !== s.kolom.length || s.kolom.some((x) => !boleh.includes(x)) || !["nomor_rekening", "bersih"].every((x) => s.kolom.includes(x))) throw permintaanSalah("Kolom format bank tidak didukung");
  return s;
};
rute.get("/konfigurasi", izin([SUB.konfigurasi, "READ"]), baca((k, req) => daftar(k, req, "hr_gaji_konfigurasi")));
for (const metode of ["post", "put"]) rute[metode](metode === "post" ? "/konfigurasi" : "/konfigurasi/:uuid", izin([SUB.konfigurasi, metode === "post" ? "CREATE" : "UPDATE"]), tangani(async (req, res) => {
  const data = isiKonfigurasi(req.body ?? {}), f = req.author.faskesUuid;
  const hasil = await transaksi(async (k) => {
    await kunci(k, f, "sumber");
    let row;
    if (metode === "post") {
      const v = await satu(`SELECT COALESCE(max(versi),0) + 1 AS versi FROM hr_gaji_konfigurasi WHERE faskes_uuid = $1`, [f], k);
      row = await sisipkan("hr_gaji_konfigurasi", { faskes_uuid: f, ...data, versi: v.versi, dibuat_oleh: pengguna(req) }, k);
    } else {
      const lama = await ambil(k, f, "hr_gaji_konfigurasi", req.params.uuid, true);
      if (lama.status !== "draf") throw konflik("Konfigurasi disahkan tidak dapat ditimpa");
      row = await ubah("hr_gaji_konfigurasi", lama.uuid, f, { ...data, dibuat_oleh: pengguna(req) }, k);
    }
    await catat(k, req, "simpan_konfigurasi", row.uuid, { sesudah: row.hash_konfigurasi });
    return row;
  });
  kirim(res, hasil, "Versi konfigurasi disimpan");
}));
rute.post("/konfigurasi/:uuid/uji", izin([SUB.konfigurasi, "READ"]), tangani(async (req, res) => {
  const hasil = await transaksi(async (k) => {
    const c = await ambil(k, req.author.faskesUuid, "hr_gaji_konfigurasi", req.params.uuid);
    const data = hitungAturan(c.aturan, req.body?.parameter ?? {});
    await catat(k, req, "uji_konfigurasi", c.uuid);
    return { hasil: data, hash_konfigurasi: c.hash_konfigurasi };
  });
  kirim(res, hasil, "Pengujian konfigurasi selesai");
}));
rute.post("/konfigurasi/:uuid/sahkan", izin([SUB.konfigurasi, "SAHKAN"]), tangani(async (req, res) => {
  const f = req.author.faskesUuid, bukti = wajibTeks(req.body?.bukti_pengesahan, "bukti_pengesahan", 4000);
  const hasil = await transaksi(async (k) => {
    await kunci(k, f, "sumber");
    const c = await ambil(k, f, "hr_gaji_konfigurasi", req.params.uuid, true);
    if (c.status !== "draf" || c.dibuat_oleh === pengguna(req)) throw konflik("Pengesah harus berbeda dari pembuat versi draf");
    const data = isiKonfigurasi({ ...c, berlaku_mulai: Number(c.berlaku_mulai), berlaku_sampai: c.berlaku_sampai == null ? null : Number(c.berlaku_sampai) });
    if (req.body.hash_konfigurasi !== c.hash_konfigurasi || data.hash_konfigurasi !== c.hash_konfigurasi) throw konflik("Hash konfigurasi berubah");
    await tanpaTumpangTindih(k, f, "hr_gaji_konfigurasi", "status = 'disahkan'", [], c);
    await lindungiMasa(k, f, c.berlaku_mulai, c.berlaku_sampai);
    const row = await ubah("hr_gaji_konfigurasi", c.uuid, f, { status: "disahkan", disahkan_oleh: pengguna(req), disahkan_pada: sekarang(), bukti_pengesahan: bukti }, k);
    await catat(k, req, "sahkan_konfigurasi", c.uuid, { sesudah: c.hash_konfigurasi });
    return row;
  });
  kirim(res, hasil, "Pengesahan konfigurasi dicatat");
}));

for (const jenis of ["profil", "rekening"]) {
  const tabel = jenis === "profil" ? "hr_gaji_profil_pegawai" : "hr_gaji_rekening";
  const sub = jenis === "profil" ? SUB.konfigurasi : SUB.rekening;
  rute.get(`/pegawai/:uuid/${jenis}`, izin([sub, "READ"]), baca(async (k, req) => {
    await pegawai(k, req.author.faskesUuid, req.params.uuid);
    const hasil = await daftar(k, req, tabel, "AND kepegawaian_uuid = $2", [req.params.uuid]);
    if (jenis === "rekening") hasil.data = hasil.data.map(samarkanRekening);
    return hasil;
  }));
  rute.post(`/pegawai/:uuid/${jenis}`, izin([sub, "CREATE"]), tangani(async (req, res) => {
    const f = req.author.faskesUuid, b = req.body ?? {}, masa = masaBerlaku(b);
    let data;
    if (jenis === "profil") {
      if (!b.parameter || Array.isArray(b.parameter) || typeof b.parameter !== "object" || Object.keys(b.parameter).length > 100) throw permintaanSalah("Parameter profil tidak sah");
      for (const [nama, nilai] of Object.entries(b.parameter)) {
        if (!/^[a-z][a-z0-9_]{0,79}$/.test(nama) || ["bruto", "kena_pajak", "gaji_pokok", "jaspel"].includes(nama)) throw permintaanSalah("Parameter profil memakai nama terlarang");
        desimal(nilai);
      }
      if (!b.saldo_awal_tahun || typeof b.saldo_awal_tahun !== "object" || Array.isArray(b.saldo_awal_tahun) || Object.keys(b.saldo_awal_tahun).length) throw permintaanSalah("Saldo awal tahun harus objek kosong; rekonsiliasi tahunan belum didukung");
      data = { parameter: b.parameter, saldo_awal_tahun: {}, bukti: wajibTeks(b.bukti, "bukti", 4000) };
    } else {
      if (!/^\d{4,50}$/.test(b.nomor_rekening ?? "")) throw permintaanSalah("Nomor rekening harus 4–50 digit");
      data = { kode_bank: wajibTeks(b.kode_bank, "kode_bank", 40), nomor_rekening: b.nomor_rekening, nama_pemilik: wajibTeks(b.nama_pemilik, "nama_pemilik", 150) };
    }
    const hasil = await transaksi(async (k) => {
      await kunci(k, f, "sumber");
      await pegawai(k, f, req.params.uuid);
      if (jenis === "profil") await lindungiMasa(k, f, masa.berlaku_mulai, masa.berlaku_sampai);
      const row = await sisipkan(tabel, { ...data, ...masa, faskes_uuid: f, kepegawaian_uuid: req.params.uuid, dibuat_oleh: pengguna(req) }, k);
      await catat(k, req, `buat_${jenis}`, row.uuid);
      return jenis === "rekening" ? samarkanRekening(row) : row;
    });
    kirim(res, hasil, "Versi baru dicatat");
  }));
  const aksi = jenis === "profil" ? "sahkan" : "verifikasi";
  rute.post(`/${jenis}/:uuid/${aksi}`, izin([sub, jenis === "profil" ? "SAHKAN" : "VERIFIKASI"]), tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      await kunci(k, f, "sumber");
      const r = await ambil(k, f, tabel, req.params.uuid, true);
      await pegawai(k, f, r.kepegawaian_uuid);
      if (r.status !== "draf" || r.dibuat_oleh === pengguna(req)) throw konflik("Pemeriksa harus berbeda dari pembuat versi draf");
      const status = jenis === "profil" ? "disahkan" : "terverifikasi";
      await tanpaTumpangTindih(k, f, tabel, "kepegawaian_uuid = $2 AND status = $3", [r.kepegawaian_uuid, status], r);
      if (jenis === "profil") await lindungiMasa(k, f, r.berlaku_mulai, r.berlaku_sampai);
      const perubahan = jenis === "profil" ? { status, disahkan_oleh: pengguna(req), disahkan_pada: sekarang(), bukti_pengesahan: wajibTeks(req.body?.bukti_pengesahan, "bukti_pengesahan", 4000) } : { status, diverifikasi_oleh: pengguna(req), diverifikasi_pada: sekarang(), catatan_verifikasi: teksOpsional(req.body?.catatan, "catatan") };
      const row = await ubah(tabel, r.uuid, f, perubahan, k);
      await catat(k, req, `${aksi}_${jenis}`, r.uuid, { alasan: perubahan.bukti_pengesahan ?? perubahan.catatan_verifikasi ?? null });
      return jenis === "rekening" ? samarkanRekening(row) : row;
    });
    kirim(res, hasil, "Pemeriksaan dicatat");
  }));
}
rute.get("/format-bank", izin([SUB.konfigurasi, "READ"], [SUB.ekspor, "READ"]), baca((k, req) => daftar(k, req, "hr_gaji_format_bank")));
rute.post("/format-bank", izin([SUB.konfigurasi, "CREATE"]), tangani(async (req, res) => {
  const b = req.body ?? {}, f = req.author.faskesUuid;
  const kode = wajibTeks(b.kode, "kode", 40), spesifikasi = validasiFormat(b.spesifikasi), bukti = wajibTeks(b.bukti_spesifikasi, "bukti_spesifikasi", 4000);
  const hasil = await transaksi(async (k) => {
    await kunci(k, f, "sumber");
    const v = await satu(`SELECT COALESCE(max(versi),0) + 1 AS versi FROM hr_gaji_format_bank WHERE faskes_uuid = $1 AND kode = $2`, [f, kode], k);
    const r = await sisipkan("hr_gaji_format_bank", { faskes_uuid: f, kode, versi: v.versi, spesifikasi, bukti_spesifikasi: bukti, dibuat_oleh: pengguna(req) }, k);
    await catat(k, req, "buat_format_bank", r.uuid);
    return r;
  });
  kirim(res, hasil, "Format bank dicatat");
}));
rute.post("/format-bank/:uuid/sahkan", izin([SUB.konfigurasi, "SAHKAN"]), tangani(async (req, res) => {
  const f = req.author.faskesUuid;
  const hasil = await transaksi(async (k) => {
    const r = await ambil(k, f, "hr_gaji_format_bank", req.params.uuid, true);
    validasiFormat(r.spesifikasi);
    if (r.status !== "draf" || r.dibuat_oleh === pengguna(req)) throw konflik("Pengesah harus berbeda dari pembuat format draf");
    const catatan = teksOpsional(req.body?.catatan, "catatan");
    const row = await ubah("hr_gaji_format_bank", r.uuid, f, { status: "disahkan", disahkan_oleh: pengguna(req), disahkan_pada: sekarang(), catatan_pengesahan: catatan }, k);
    await catat(k, req, "sahkan_format_bank", r.uuid, { alasan: catatan });
    return row;
  });
  kirim(res, hasil, "Pengesahan format bank dicatat");
}));
export default rute;
