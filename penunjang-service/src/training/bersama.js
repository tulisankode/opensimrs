import { Galat, permintaanSalah } from "../umum/respons.js";

// Konstanta & helper bersama modul Training (kelas olahraga/edukasi berbayar: Zumba, Yoga, Pilates, edukasi).
// Satu baris training_order = booking atau order peserta. Status: booking → order → (batal). Slot dihitung
// per kelas + tanggal (+ sesi bila is_sesi) dari order berstatus booking/order (bukan batal, belum dihapus).
const TZ = "Asia/Jakarta";

export const tanggalValid = (t, nama = "tanggal") => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t ?? "")) || Number.isNaN(Date.parse(t))) throw permintaanSalah(`${nama} harus berformat YYYY-MM-DD`);
  return t;
};

// Hari ini (tanggal lokal) YYYY-MM-DD.
export const hariIni = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

// Rentang tanggal dari query (?tanggal_mulai=&tanggal_selesai=) dengan bawaan hari ini.
export const rentang = (q) => {
  const mulai = q.tanggal_mulai || q.mulai || q.tanggal || hariIni();
  const selesai = q.tanggal_selesai || q.selesai || q.tanggal || mulai;
  return { mulai: tanggalValid(mulai, "tanggal_mulai"), selesai: tanggalValid(selesai, "tanggal_selesai") };
};

// Pelanggaran unique index → pesan ramah (409). Galat lain diteruskan.
export const ramah = (e, pesan) => {
  if (e?.code === "23505") throw new Galat(409, pesan);
  throw e;
};

export const jumlahSlotValid = (n) => {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 1) throw permintaanSalah("jumlah_slot harus bilangan bulat positif");
  return v;
};

export const hargaValid = (h) => {
  const v = Number(h ?? 0);
  if (!Number.isFinite(v) || v < 0) throw permintaanSalah("harga tidak boleh negatif");
  return v;
};

// Validasi & siapkan daftar sesi (wajib minimal satu bila is_sesi = true). Dipakai saat membuat/mengubah kelas.
export const siapkanSesi = (isSesi, daftar) => {
  if (!isSesi) return [];
  if (!Array.isArray(daftar) || daftar.length === 0) throw permintaanSalah("Kelas bersesi wajib memiliki minimal satu sesi");
  return daftar.map((s, i) => {
    const nama = String(s?.nama_sesi ?? "").trim();
    if (!nama) throw permintaanSalah("nama_sesi wajib diisi pada setiap sesi");
    return { nama_sesi: nama, jam_mulai: s?.jam_mulai || null, jam_selesai: s?.jam_selesai || null, urutan: Number(s?.urutan) || i + 1 };
  });
};

// Sisa slot (tidak pernah negatif) dari kuota kelas dan jumlah yang sudah terisi (booking/order aktif).
export const sisaSlot = (kuota, terisi) => Math.max(Number(kuota) - Number(terisi), 0);
