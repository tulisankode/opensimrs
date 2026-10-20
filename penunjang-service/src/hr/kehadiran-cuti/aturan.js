import { createHash } from "node:crypto";
import { Galat, permintaanSalah } from "../../umum/respons.js";

export const konflik = (pesan) => new Galat(409, pesan);
export const wajibTeks = (v, nama, maks = 2000) => {
  if (typeof v !== "string" || !v.trim() || v.length > maks) throw permintaanSalah(`${nama} wajib diisi, maksimal ${maks} karakter`);
  return v.trim();
};
export const bulat = (v, nama, min = 0, maks = 100000) => {
  if (v === "" || v === null || v === undefined || !Number.isSafeInteger(Number(v)) || Number(v) < min || Number(v) > maks) throw permintaanSalah(`${nama} harus berupa bilangan bulat ${min}–${maks}`);
  return Number(v);
};
export const boolean = (v, nama) => {
  if (typeof v !== "boolean") throw permintaanSalah(`${nama} harus berupa nilai boolean`);
  return v;
};
export const tanggalWib = (epoch) => new Date((Number(epoch) + 25200) * 1000).toISOString().slice(0, 10);
export const tanggal = (v) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(`${v}T00:00:00Z`)) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) throw permintaanSalah("Tanggal harus berupa tanggal kalender YYYY-MM-DD yang sah");
  return v;
};
export const waktuImpor = (v, format) => {
  if (format === "epoch") return bulat(v, "waktu", 946659600, 4102419599);
  if (format !== "wib" || typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(v)) throw permintaanSalah("Waktu harus berupa epoch detik atau YYYY-MM-DD HH:mm:ss WIB sesuai pemetaan");
  tanggal(v.slice(0, 10));
  const jam = v.slice(11).split(":").map(Number);
  if (jam[0] > 23 || jam[1] > 59 || (jam[2] ?? 0) > 59) throw permintaanSalah("Jam tidak sah");
  return Math.floor(Date.parse(`${v.slice(0, 10)}T${v.slice(11)}${jam.length === 2 ? ":00" : ""}+07:00`) / 1000);
};
export const jenisAbsen = (v) => {
  if (!["masuk", "pulang"].includes(v)) throw permintaanSalah("Jenis catatan wajib masuk atau pulang; jenis tidak ditebak dari urutan");
  return v;
};
export const kunciKejadian = (f, mesin, pegawai, waktu, jenis, kejadian) => createHash("sha256").update(JSON.stringify(kejadian ? [f, mesin, kejadian] : [f, mesin, pegawai, Number(waktu), jenis])).digest("hex");
export const validasiUrutan = (terakhir, jenis, waktu, maksJam) => {
  jenisAbsen(jenis);
  if (terakhir && Number(terakhir.waktu) >= waktu) throw konflik("Waktu absen harus sesudah catatan terakhir");
  if (jenis === "masuk" && terakhir?.jenis === "masuk") throw konflik("Masih ada absen masuk yang belum dipasangkan; hubungi SDM untuk koreksi");
  if (jenis === "pulang" && (!terakhir || terakhir.jenis !== "masuk" || waktu - Number(terakhir.waktu) > maksJam * 3600)) throw konflik("Tidak ada sesi masuk yang sah; hubungi SDM untuk koreksi");
};
export const validasiKebijakan = (b) => ({
  tahun: bulat(b.tahun, "tahun", 2000, 2100),
  hak_tahunan: bulat(b.hak_tahunan, "hak_tahunan", 0, 366),
  dasar_hari: b.dasar_hari === "kalender" ? "kalender" : (() => { throw permintaanSalah("Dasar hari yang didukung adalah kalender; prorata belum diterapkan"); })(),
  batas_carry_over: bulat(b.batas_carry_over, "batas_carry_over", 0, 366),
  bulan_kedaluwarsa: bulat(b.bulan_kedaluwarsa, "bulan_kedaluwarsa", 1, 12),
  batal_sebelum_sah: boolean(b.batal_sebelum_sah, "batal_sebelum_sah"),
  batal_setelah_sah: boolean(b.batal_setelah_sah, "batal_setelah_sah"),
  batal_saat_berjalan: boolean(b.batal_saat_berjalan, "batal_saat_berjalan"),
  maks_sesi_jam: bulat(b.maks_sesi_jam, "maks_sesi_jam", 1, 48),
});
export const rincianHari = (mulai, selesai) => {
  tanggal(mulai); tanggal(selesai);
  const a = Date.parse(`${mulai}T00:00:00Z`), z = Date.parse(`${selesai}T00:00:00Z`);
  if (z < a || z - a > 365 * 86400000) throw permintaanSalah("Rentang pengajuan harus 1–366 hari");
  const hasil = {};
  for (let t = a; t <= z; t += 86400000) {
    const hari = new Date(t).toISOString().slice(0, 10);
    (hasil[hari.slice(0, 4)] ??= []).push(hari);
  }
  return hasil;
};
export const statusKeputusan = (p, aksi, pelaku, atasan, bolehSdm, catatan) => {
  if (pelaku === p.pemohon) throw new Galat(403, "Pengajuan sendiri tidak boleh diputuskan");
  if (aksi === "tolak") wajibTeks(catatan, "Catatan penolakan");
  if (p.status === "menunggu_atasan" && atasan && ["setujui", "tolak"].includes(aksi)) return aksi === "tolak" ? "ditolak" : "menunggu_sdm";
  if (p.status === "menunggu_sdm" && bolehSdm && ["sahkan", "tolak"].includes(aksi)) return aksi === "tolak" ? "ditolak" : "sah";
  throw konflik("Keputusan tidak sesuai tahap atau penugasan pemeriksa");
};
export const hitungSaldo = (mutasi, reservasi, pada) => {
  let hak = 0, carry = 0;
  for (const m of mutasi) {
    if (m.kedaluwarsa && Number(m.kedaluwarsa) <= pada) continue;
    if (m.sumber === "carry_over") carry += Number(m.jumlah_hari);
    else hak += Number(m.jumlah_hari);
  }
  return { hak_tersisa: hak, carry_over_berlaku: carry, sisa: hak + carry, reservasi: Number(reservasi), tersedia: hak + carry - Number(reservasi) };
};
export const alokasiSaldo = (saldo, jumlah) => {
  if (saldo.tersedia < jumlah) throw new Galat(422, "Saldo cuti tidak mencukupi setelah reservasi pengajuan lain");
  const carry = Math.min(Math.max(0, saldo.carry_over_berlaku), jumlah);
  return { carry_over: carry, hak: jumlah - carry };
};
export const selCsv = (v) => `"${String(v ?? "").replace(/^[\s]*[=+@-]/, (s) => `'${s}`).replaceAll('"', '""')}"`;
export const statusJadwal = () => ({ status_jadwal: "fitur_tidak_aktif", terlambat: null, pulang_cepat: null, tidak_hadir: null, lembur: null });
