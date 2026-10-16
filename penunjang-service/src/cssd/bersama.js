import { permintaanSalah } from "../umum/respons.js";
// Helper tanggal/rentang & pesan ramah sama dengan Radiologi.
export { daftarNilai, hariIni, ramah, rentangOpsional, tanggalValid, tglLokal, TZ } from "../radiologi/bersama.js";

// Konstanta & helper bersama modul CSSD (Sterilisasi Alat & Pelacakan Set Instrumen).

export const METODE = { autoklaf: "Autoklaf (Uap Panas Bertekanan)", plasma: "Plasma (Hidrogen Peroksida)", eo: "Etilen Oksida (EO)", lain: "Lainnya" };

// Alur status set fisik: kotor → dekontaminasi dicatat → dikemas (lengkap) | menunggu_tindakan (tidak lengkap/rusak)
// → menunggu_keputusan (masuk load) → layak (indikator lulus) | tidak_layak (indikator gagal, otomatis satu load).
export const STATUS_SET = {
  kotor: "Kotor (menunggu dekontaminasi)",
  dekontaminasi: "Dalam dekontaminasi",
  dikemas: "Dikemas (siap dimuat)",
  menunggu_tindakan: "Menunggu tindak lanjut (tidak lengkap/rusak)",
  dalam_load: "Dalam load",
  menunggu_keputusan: "Menunggu keputusan (hasil load belum lengkap)",
  layak: "Layak/steril",
  tidak_layak: "Tidak layak",
  dikarantina: "Dikarantina",
  hilang: "Hilang",
  rusak: "Rusak",
};
// Status set yang boleh dipilih untuk distribusi/pemakaian (aturan bisnis #4).
export const STATUS_LAYAK_DIPAKAI = "layak";
// Status yang hanya bisa ditetapkan manual (bukan hasil alur otomatis) via PUT /set/:uuid/status.
export const STATUS_MANUAL = ["dikarantina", "hilang", "rusak", "menunggu_tindakan"];

export const STATUS_LOAD = { draf: "Draf", menunggu_hasil: "Menunggu hasil", lulus: "Lulus", gagal: "Gagal" };
export const STATUS_PERMINTAAN = { menunggu: "Menunggu", disetujui: "Disetujui", ditolak: "Ditolak", selesai: "Selesai" };
export const STATUS_RECALL = { dibuka: "Dibuka", ditindaklanjuti: "Ditindaklanjuti", selesai: "Selesai" };
export const STATUS_PENANGANAN_RECALL = {
  belum_ditindaklanjuti: "Belum ditindaklanjuti",
  ditemukan: "Ditemukan",
  dikarantina: "Dikarantina",
  dimusnahkan: "Dimusnahkan",
  tindak_lanjut_klinis: "Tindak lanjut klinis (pasien sudah terpakai)",
};
export const KONDISI_SERAH = { baik: "Baik", tidak_lengkap: "Tidak lengkap", rusak: "Rusak" };
export const JENIS_SERAH = { terima_kotor: "Terima Alat Kotor", distribusi: "Distribusi", pengembalian: "Pengembalian", recall: "Recall" };

// Ambang peringatan kedaluwarsa (H-3). Nilai tetap untuk MVP; disiapkan sebagai konstanta tunggal agar
// mudah dipindah ke kolom konfigurasi per faskes kelak tanpa mengubah pemanggilnya.
export const AMBANG_KEDALUWARSA_HARI = 3;

export const pilihan = (obj) => Object.entries(obj).map(([kode, nama]) => ({ kode, nama }));

export const cekPilihan = (nilai, obj, nama) => {
  if (nilai === undefined || nilai === null || nilai === "") return nilai === "" ? null : nilai;
  if (!Object.prototype.hasOwnProperty.call(obj, nilai)) throw permintaanSalah(`${nama} harus salah satu: ${Object.keys(obj).join(", ")}`);
  return nilai;
};

export const teks = (v) => (v === undefined ? undefined : String(v ?? "").trim() || null);

export const angkaOpsional = (v, nama) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) throw permintaanSalah(`${nama} harus berupa angka`);
  return n;
};

export const boolOpsional = (v) => (v === undefined ? undefined : Boolean(v));

// Tanggal kedaluwarsa steril (epoch detik) dari waktu load selesai + masa berlaku (jam) master set.
export const hitungKedaluwarsa = (waktuSelesai, masaBerlakuJam) => Number(waktuSelesai) + Number(masaBerlakuJam) * 3600;
