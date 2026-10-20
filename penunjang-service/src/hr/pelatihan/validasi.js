import { permintaanSalah } from "../../umum/respons.js";
import { bulatOpsional, epochWajib, epochOpsional, konflik, teks, teksWajib, wajibPilihan } from "../../sarpras/bersama.js";

export const KATEGORI = { internal: "Internal", eksternal: "Eksternal" };
export const KEHADIRAN = { belum_dicatat: "Belum dicatat", hadir: "Hadir", sebagian: "Sebagian", tidak_hadir: "Tidak hadir" };
export const HASIL = { belum_dinilai: "Belum dinilai", lulus: "Lulus", tidak_lulus: "Tidak lulus" };
export const STATUS = { rencana: "Rencana", terjadwal: "Terjadwal", berlangsung: "Berlangsung", selesai: "Selesai", dibatalkan: "Dibatalkan" };
export const CAKUPAN = { semua: "Semua pegawai", unit: "Unit kerja", jenis_pegawai: "Jenis pegawai", pegawai: "Pegawai" };

export const booleanWajib = (v, nama) => {
  if (typeof v !== "boolean") throw permintaanSalah(`${nama} harus bernilai benar atau salah`);
  return v;
};
// Jam dibatasi dua desimal; aritmetika pengakuan menggunakan perseratus jam agar hasil tetap pasti.
export const jam = (v, nama, min = 0) => {
  if ((typeof v !== "string" && typeof v !== "number") || !/^\d+(?:\.\d{1,2})?$/.test(String(v)) || !Number.isFinite(Number(v)))
    throw permintaanSalah(`${nama} harus berupa angka dengan maksimal dua desimal`);
  const n = Number(v);
  if (n < min || n > 999999.99) throw permintaanSalah(`${nama} di luar rentang yang diizinkan`);
  return n;
};
export const versiSama = (lama, versi) => {
  if (!Number.isInteger(versi) || versi !== Number(lama.versi)) throw konflik("Data telah berubah. Muat ulang sebelum menyimpan kembali.");
};
export const tahunValid = (v) => {
  const n = bulatOpsional(v, "tahun", { min: 2000, maks: 2200 });
  if (!n) throw permintaanSalah("tahun wajib diisi");
  return n;
};
export const tahunZona = (epoch, zona) => Number(new Intl.DateTimeFormat("en", { timeZone: zona, year: "numeric" }).format(new Date(Number(epoch) * 1000)));
export const zonaValid = (v) => {
  const zona = teksWajib(v, "zona_waktu", 60);
  try { tahunZona(1, zona); } catch { throw permintaanSalah("zona_waktu tidak valid"); }
  return zona;
};
export const validasiCakupan = (b = {}) => {
  if (!b || typeof b !== "object" || Array.isArray(b)) throw permintaanSalah("Setiap cakupan harus berupa objek");
  const jenis = wajibPilihan(b.jenis_cakupan, CAKUPAN, "jenis_cakupan");
  if (jenis === "semua" && b.referensi_uuid) throw permintaanSalah("Cakupan semua pegawai tidak memakai referensi");
  return { jenis_cakupan: jenis, referensi_uuid: jenis === "semua" ? null : teksWajib(b.referensi_uuid, "referensi_uuid", 255) };
};
export const validasiKatalog = (b) => {
  if (!Array.isArray(b.cakupan) || b.cakupan.length > 200) throw permintaanSalah("cakupan harus berupa daftar, maksimal 200 baris");
  const cakupan = b.cakupan.map((c) => {
    const x = { ...validasiCakupan(c), mulai_berlaku: epochWajib(c.mulai_berlaku, "mulai_berlaku"), akhir_berlaku: epochOpsional(c.akhir_berlaku, "akhir_berlaku") ?? null };
    if (x.akhir_berlaku !== null && x.akhir_berlaku <= x.mulai_berlaku) throw permintaanSalah("akhir_berlaku harus setelah mulai_berlaku");
    return x;
  });
  for (let i = 0; i < cakupan.length; i++) for (let j = 0; j < i; j++) {
    const a = cakupan[i], c = cakupan[j];
    const tumpang = a.mulai_berlaku < (c.akhir_berlaku ?? Infinity) && c.mulai_berlaku < (a.akhir_berlaku ?? Infinity);
    if (tumpang && (a.jenis_cakupan === "semua" || c.jenis_cakupan === "semua" || (a.jenis_cakupan === c.jenis_cakupan && a.referensi_uuid === c.referensi_uuid)))
      throw permintaanSalah("Cakupan bertumpang tindih atau menggabungkan semua pegawai dengan cakupan khusus");
  }
  const wajib = booleanWajib(b.wajib, "wajib");
  if (wajib && !cakupan.length) throw permintaanSalah("Pelatihan wajib memerlukan cakupan");
  return {
    kode: teksWajib(b.kode, "kode", 60), nama: teksWajib(b.nama, "nama", 255), kategori: wajibPilihan(b.kategori, KATEGORI, "kategori"),
    wajib, jam: jam(b.jam, "jam", 0.01), masa_berlaku_tahun: bulatOpsional(b.masa_berlaku_tahun, "masa_berlaku_tahun", { min: 1, maks: 100 }) ?? null,
    keterangan: teks(b.keterangan, "keterangan", 5000) ?? null, cakupan,
  };
};
export const validasiKegiatan = (b) => {
  const mulai = epochWajib(b.jadwal_mulai, "jadwal_mulai"), selesai = epochWajib(b.jadwal_selesai, "jadwal_selesai");
  if (selesai <= mulai) throw permintaanSalah("Jadwal selesai harus setelah jadwal mulai");
  return {
    jadwal_mulai: mulai, jadwal_selesai: selesai,
    lokasi: teks(b.lokasi, "lokasi", 255) ?? null, penyelenggara: teks(b.penyelenggara, "penyelenggara", 255) ?? null,
    kapasitas: bulatOpsional(b.kapasitas, "kapasitas", { min: 1, maks: 100000 }) ?? null,
    keterangan: teks(b.keterangan, "keterangan", 5000) ?? null,
  };
};
export const validasiHasil = (b, kegiatan) => {
  const kehadiran = wajibPilihan(b.kehadiran, KEHADIRAN, "kehadiran"), hasil = wajibPilihan(b.hasil, HASIL, "hasil");
  const hadir = jam(b.jam_hadir, "jam_hadir"), penuh = Number(kegiatan.jam);
  if (hadir > penuh || (kehadiran === "hadir" && hadir !== penuh) || (["tidak_hadir", "belum_dicatat"].includes(kehadiran) && hadir !== 0) || (kehadiran === "sebagian" && (hadir <= 0 || hadir >= penuh)))
    throw permintaanSalah("Jam hadir tidak sesuai status kehadiran atau jam kegiatan");
  if (["tidak_hadir", "belum_dicatat"].includes(kehadiran) && hasil === "lulus") throw permintaanSalah("Peserta yang tidak hadir tidak dapat dinyatakan lulus");
  return { kehadiran, hasil, jam_hadir: hadir, jam_diakui: 0 };
};
export const hitungJam = (peserta, kegiatan, kebijakan) => {
  if (peserta.kehadiran === "belum_dicatat" || peserta.hasil === "belum_dinilai") throw permintaanSalah("Kehadiran dan hasil wajib dicatat sebelum verifikasi");
  if (peserta.kehadiran === "tidak_hadir" || (kebijakan.dasar_jam === "lulus" && peserta.hasil !== "lulus")) return 0;
  if (peserta.kehadiran === "sebagian" && kebijakan.aturan_sebagian === "tidak_dihitung") return 0;
  return Math.min(Math.round(Number(peserta.jam_hadir) * 100), Math.round(Number(kegiatan.jam) * 100)) / 100;
};
export const validasiKebijakan = (b) => {
  if (!Array.isArray(b.target) || b.target.length > 200) throw permintaanSalah("target harus berupa daftar, maksimal 200 baris");
  const target = b.target.map((t) => ({ ...validasiCakupan(t), target_jam: jam(t.target_jam, "target_jam", 0.01) }));
  const prioritas = wajibPilihan(b.prioritas_target, { pegawai_unit_jenis_semua: 1, hanya_semua: 1 }, "prioritas_target");
  if (prioritas === "hanya_semua" && target.some((t) => t.jenis_cakupan !== "semua")) throw permintaanSalah("Kebijakan ini hanya mengizinkan target seluruh pegawai");
  const kunci = target.map((t) => `${t.jenis_cakupan}:${t.referensi_uuid ?? ""}`);
  if (new Set(kunci).size !== kunci.length) throw permintaanSalah("Target dengan cakupan yang sama tidak boleh ganda");
  const hari = bulatOpsional(b.hari_peringatan, "hari_peringatan", { min: 0, maks: 3650 });
  if (hari === null || hari === undefined) throw permintaanSalah("hari_peringatan wajib diisi");
  return {
    tahun: tahunValid(b.tahun), zona_waktu: zonaValid(b.zona_waktu), prioritas_target: prioritas,
    dasar_cakupan: wajibPilihan(b.dasar_cakupan, { saat_laporan: 1 }, "dasar_cakupan"),
    dasar_jam: wajibPilihan(b.dasar_jam, { hadir: 1, lulus: 1 }, "dasar_jam"),
    aturan_sebagian: wajibPilihan(b.aturan_sebagian, { tidak_dihitung: 1, jam_hadir: 1 }, "aturan_sebagian"),
    hari_peringatan: hari, izinkan_ekspor_kosong: booleanWajib(b.izinkan_ekspor_kosong, "izinkan_ekspor_kosong"),
    syarat_sertifikat: booleanWajib(b.syarat_sertifikat, "syarat_sertifikat"), target,
  };
};
export const cocokCakupan = (c, p) => c.jenis_cakupan === "semua" || String(c.referensi_uuid) === String(({ pegawai: p.uuid, unit: p.unit_uuid, jenis_pegawai: p.tipe })[c.jenis_cakupan]);
export const pilihTarget = (target, pegawai) => {
  for (const jenis of ["pegawai", "unit", "jenis_pegawai", "semua"]) {
    const t = target.find((x) => x.jenis_cakupan === jenis && cocokCakupan(x, pegawai));
    if (t) return t;
  }
  return null;
};
