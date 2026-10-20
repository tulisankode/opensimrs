import { createHash } from "node:crypto";
import { Galat, permintaanSalah } from "../../umum/respons.js";

export const SUB = {
  komponen: "Komponen Penggajian", konfigurasi: "Konfigurasi Penggajian", rekening: "Rekening Penggajian",
  periode: "Periode Penggajian", verifikasi: "Verifikasi Penggajian", persetujuan: "Persetujuan Penggajian",
  pembayaran: "Pembayaran Penggajian", rekap: "Rekap Penggajian", ekspor: "Ekspor Bank Penggajian",
  slip: "Slip Penggajian", administratif: "Slip Administratif Penggajian",
};
export const konflik = (pesan) => new Galat(409, pesan);
export const teksOpsional = (v, nama, maks = 4000) => {
  if (v == null || String(v).trim() === "") return null;
  return wajibTeks(v, nama, maks);
};
export const wajibTeks = (v, nama, maks = 1000) => {
  if (typeof v !== "string" || !v.trim() || v.length > maks) throw permintaanSalah(`${nama} wajib berupa teks, maksimal ${maks} karakter`);
  return v.trim();
};
export const epoch = (v, nama) => {
  if (!Number.isSafeInteger(v) || v <= 0 || v > 9999999999) throw permintaanSalah(`${nama} wajib berupa epoch detik`);
  return v;
};
export const masaBerlaku = (b) => {
  const mulai = epoch(b.berlaku_mulai, "berlaku_mulai");
  const sampai = b.berlaku_sampai == null ? null : epoch(b.berlaku_sampai, "berlaku_sampai");
  if (sampai !== null && sampai <= mulai) throw permintaanSalah("Akhir masa berlaku harus sesudah awal");
  return { berlaku_mulai: mulai, berlaku_sampai: sampai };
};
export const berlaku = (r, t) => Number(r.berlaku_mulai) <= t && (r.berlaku_sampai == null || Number(r.berlaku_sampai) > t);
export const rentang = (tahun, bulan) => {
  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2200 || !Number.isInteger(bulan) || bulan < 1 || bulan > 12) throw permintaanSalah("Tahun atau bulan tidak sah");
  return { awal: Date.UTC(tahun, bulan - 1, 1, -7) / 1000, akhir: Date.UTC(tahun, bulan, 1, -7) / 1000 };
};
const urut = (v) => Array.isArray(v) ? v.map(urut) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, urut(v[k])])) : v;
export const hash = (v) => createHash("sha256").update(JSON.stringify(urut(v))).digest("hex");
export const cekVersi = (p, b) => {
  if (!Number.isSafeInteger(b.versi) || b.versi !== p.versi) throw konflik("Versi periode berubah; muat ulang data");
};
export const transisi = (p, aksi, pelaku) => {
  const aturan = { ajukan: ["draf", "verifikasi"], verifikasi: ["verifikasi", "menunggu_persetujuan"], setujui: ["menunggu_persetujuan", "disetujui"], bayar: ["disetujui", "dibayar"], kembalikan: ["verifikasi", "draf"], tolak: ["menunggu_persetujuan", "draf"] };
  const a = aturan[aksi];
  if (!a || a[0] !== p.status) throw konflik("Tindakan tidak sesuai status periode");
  if (aksi === "verifikasi" && pelaku === p.dihitung_oleh) throw konflik("Verifikator harus berbeda dari penghitung");
  if (aksi === "setujui" && [p.dihitung_oleh, p.diverifikasi_oleh].includes(pelaku)) throw konflik("Penyetuju harus berbeda dari penghitung dan verifikator");
  return a[1];
};
export const tanpaCakupan = (req) => {
  if (!req.author?.faskesUuid || !req.author?.username) throw new Galat(403, "Konteks akun dan faskes wajib tersedia");
  if ([req.body, req.query].some((x) => x && ("faskes_uuid" in x || "faskesUuid" in x))) throw permintaanSalah("Faskes hanya berasal dari token");
};
