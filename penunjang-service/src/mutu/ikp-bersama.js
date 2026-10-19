import { permintaanSalah } from "../umum/respons.js";
import { HARI, awalHariWib, sekarangDetik } from "../sarpras/bersama.js";

// Konstanta & helper murni fitur Insiden Keselamatan Pasien (IKP) & manajemen risiko (STD-0026, fitur mutu_ikp).
// Tanpa database agar dapat diuji unit (test/mutu-ikp.test.js).
//
// Acuan istilah: Pedoman Pelaporan Insiden Keselamatan Pasien (KKPRS) dan PMK No. 11 Tahun 2017 tentang Keselamatan
// Pasien — jenis insiden KTD/KNC/KTC/KPC/sentinel, laporan ke atasan langsung paling lambat 2 × 24 jam sejak insiden
// diketahui, grading risiko dampak × probabilitas (biru/hijau/kuning/merah), investigasi sederhana untuk biru/hijau
// dan RCA untuk kuning/merah. Matriks & tenggat bawaan dapat diubah faskes (Pengaturan IKP) dan perlu disahkan Tim KP.
// Seluruh waktu disimpan epoch detik; "WIB" = Asia/Jakarta (UTC+7, tanpa DST).

export const JENIS_INSIDEN = {
  ktd: "KTD — Kejadian Tidak Diharapkan",
  knc: "KNC — Kejadian Nyaris Cedera",
  ktc: "KTC — Kejadian Tidak Cedera",
  kpc: "KPC — Kondisi Potensial Cedera",
  sentinel: "Sentinel",
};
// Akibat insiden terhadap pasien (isian formulir laporan insiden internal).
export const AKIBAT_INSIDEN = {
  kematian: "Kematian",
  cedera_berat: "Cedera irreversibel / berat",
  cedera_sedang: "Cedera reversibel / sedang",
  cedera_ringan: "Cedera ringan",
  tidak_cedera: "Tidak ada cedera",
};
// Kelompok insiden untuk rekap internal faskes (bukan kode pelaporan nasional).
export const KATEGORI_INSIDEN = {
  medikasi: "Medikasi / obat",
  identifikasi: "Identifikasi pasien",
  pasien_jatuh: "Pasien jatuh",
  prosedur_klinis: "Prosedur / tindakan klinis",
  infeksi: "Infeksi terkait pelayanan",
  alat_medis: "Alat medis / sarana",
  transfusi: "Darah / transfusi",
  dokumentasi: "Dokumentasi / komunikasi",
  lainnya: "Lainnya",
};
export const LAYANAN_INSIDEN = { rawat_jalan: "Rawat Jalan", rawat_inap: "Rawat Inap", igd: "IGD", penunjang: "Penunjang", lainnya: "Lainnya" };
export const TINDAKAN_OLEH = { dokter: "Dokter", perawat: "Perawat / bidan", tim: "Tim", petugas_lain: "Petugas lain" };

// Alur laporan: dilaporkan → (perlu_dilengkapi ⇄ dilaporkan) → diterima (kepala unit) → dinilai (grading)
// → investigasi → ditutup; ditutup dapat dibuka kembali (kembali ke status sebelum ditutup).
export const STATUS_LAPORAN = {
  dilaporkan: "Dilaporkan",
  perlu_dilengkapi: "Perlu Dilengkapi",
  diterima: "Diterima Unit",
  dinilai: "Sudah Digrading",
  investigasi: "Investigasi / RCA",
  ditutup: "Ditutup",
};
export const STATUS_DAPAT_DIGRADING = ["diterima", "dinilai", "investigasi"];
export const GRADE = { biru: "Biru (rendah)", hijau: "Hijau (moderat)", kuning: "Kuning (tinggi)", merah: "Merah (ekstrem)" };
export const URUTAN_GRADE = ["biru", "hijau", "kuning", "merah"];
export const LEVEL_DAMPAK = { 1: "Tidak signifikan", 2: "Minor", 3: "Moderat", 4: "Mayor", 5: "Katastropik" };
export const LEVEL_PROBABILITAS = { 1: "Sangat jarang (> 5 tahun sekali)", 2: "Jarang (2–5 tahun sekali)", 3: "Mungkin (1–2 tahun sekali)", 4: "Sering (beberapa kali setahun)", 5: "Sangat sering (tiap minggu / bulan)" };
export const JENIS_INVESTIGASI = { sederhana: "Investigasi Sederhana", rca: "RCA (Root Cause Analysis)" };
export const STATUS_INVESTIGASI = { berjalan: "Berjalan", selesai: "Selesai" };
export const STATUS_TINDAK_LANJUT = { rencana: "Rencana", berjalan: "Berjalan", selesai: "Selesai", terverifikasi: "Terverifikasi" };
export const STATUS_RISIKO = { terbuka: "Terbuka", dimitigasi: "Dalam Mitigasi", terkendali: "Terkendali", ditutup: "Ditutup" };

// Matriks bawaan: baris = probabilitas 1..5, kolom = dampak 1..5 (acuan matriks grading risiko pedoman KKPRS).
// matriks[p-1][d-1] = grade.
export const MATRIKS_BAWAAN = [
  ["biru", "biru", "hijau", "kuning", "merah"],
  ["biru", "biru", "hijau", "kuning", "merah"],
  ["biru", "hijau", "kuning", "merah", "merah"],
  ["hijau", "hijau", "kuning", "merah", "merah"],
  ["hijau", "hijau", "kuning", "merah", "merah"],
];
// Batas waktu investigasi (hari sejak grading): biru 7, hijau 14, kuning & merah & sentinel 45.
export const TENGGAT_INVESTIGASI_BAWAAN = { biru: 7, hijau: 14, kuning: 45, merah: 45, sentinel: 45 };
export const TENGGAT_LAPOR_JAM_BAWAAN = 48;
// Ambang "mendekati batas" (detik) untuk penanda tenggat.
export const AMBANG_MENDEKATI = 2 * HARI;

export const pengaturanBawaan = () => ({
  tenggat_lapor_jam: TENGGAT_LAPOR_JAM_BAWAAN,
  tenggat_investigasi_hari: { ...TENGGAT_INVESTIGASI_BAWAAN },
  matriks: MATRIKS_BAWAAN.map((b) => [...b]),
  versi_matriks: 1,
  pengingat_penerima: null,
  pengingat_kanal: null,
});

// Matriks 5×5 berisi grade sah; 400 bila tidak.
export const validasiMatriks = (m) => {
  if (!Array.isArray(m) || m.length !== 5 || m.some((b) => !Array.isArray(b) || b.length !== 5))
    throw permintaanSalah("matriks harus berukuran 5 × 5 (probabilitas × dampak)");
  if (m.some((b) => b.some((g) => !URUTAN_GRADE.includes(g)))) throw permintaanSalah(`Isi matriks harus salah satu: ${URUTAN_GRADE.join(", ")}`);
  return m.map((b) => [...b]);
};

export const validasiTenggatInvestigasi = (t) => {
  if (!t || typeof t !== "object" || Array.isArray(t)) throw permintaanSalah("tenggat_investigasi_hari tidak valid");
  const hasil = {};
  for (const k of Object.keys(TENGGAT_INVESTIGASI_BAWAAN)) {
    const n = Number(t[k]);
    if (!Number.isInteger(n) || n < 1 || n > 365) throw permintaanSalah(`tenggat_investigasi_hari.${k} harus bilangan bulat 1–365`);
    hasil[k] = n;
  }
  return hasil;
};

export const levelSah = (v, nama) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw permintaanSalah(`${nama} harus bilangan bulat 1–5`);
  return n;
};

// Grade dari matriks: dampak & probabilitas 1..5 → { skor, grade }.
export const gradeDariMatriks = (dampak, probabilitas, matriks = MATRIKS_BAWAAN) => {
  const d = levelSah(dampak, "dampak");
  const p = levelSah(probabilitas, "probabilitas");
  return { skor: d * p, grade: matriks[p - 1][d - 1] };
};

// Kuning/merah dan sentinel wajib RCA (sentinel tetap RCA walau grade matriks biru/hijau).
export const perluRca = (jenisInsiden, grade) => jenisInsiden === "sentinel" || grade === "kuning" || grade === "merah";
export const jenisInvestigasiUntuk = (jenisInsiden, grade) => (perluRca(jenisInsiden, grade) ? "rca" : "sederhana");

// Batas laporan: waktu insiden diketahui + tenggat (jam). Terlambat bila waktu lapor melewati batas.
export const batasLapor = (waktuDiketahui, jam = TENGGAT_LAPOR_JAM_BAWAAN) => Number(waktuDiketahui) + Number(jam) * 3600;
export const terlambatLapor = (waktuDiketahui, waktuLapor, jam = TENGGAT_LAPOR_JAM_BAWAAN) => Number(waktuLapor) > batasLapor(waktuDiketahui, jam);
// Lama pelaporan (jam, 1 desimal) sejak insiden diketahui.
export const jamPelaporan = (waktuDiketahui, waktuLapor) => Math.round(((Number(waktuLapor) - Number(waktuDiketahui)) / 3600) * 10) / 10;

// Batas investigasi: waktu grading + hari menurut grade (sentinel memakai tenggat sentinel bila lebih ketat/longgar
// sesuai pengaturan faskes).
export const batasInvestigasi = (dinilaiPada, jenisInsiden, grade, hari = TENGGAT_INVESTIGASI_BAWAAN) => {
  const kunci = jenisInsiden === "sentinel" ? "sentinel" : grade;
  const n = Number(hari?.[kunci] ?? TENGGAT_INVESTIGASI_BAWAAN[kunci]);
  return Number(dinilaiPada) + n * HARI;
};

// Status tenggat terhadap sekarang: selesai | terlambat | mendekati | tepat_waktu | null (belum ada batas).
export const statusTenggat = (batas, selesai = false, sekarang = sekarangDetik()) => {
  if (selesai) return "selesai";
  if (batas === null || batas === undefined || batas === "") return null;
  const b = Number(batas);
  if (sekarang > b) return "terlambat";
  if (b - sekarang <= AMBANG_MENDEKATI) return "mendekati";
  return "tepat_waktu";
};

// Tindak lanjut terlambat bila hari tenggat (WIB) sudah lewat dan belum selesai/terverifikasi. Tidak ditutup otomatis.
export const tindakLanjutTerlambat = (tl, sekarang = sekarangDetik()) =>
  !!tl && !["selesai", "terverifikasi"].includes(tl.status) && tl.tenggat !== null && tl.tenggat !== undefined && awalHariWib(tl.tenggat) < awalHariWib(sekarang);

// Syarat penutupan laporan → daftar alasan yang belum terpenuhi (kosong = boleh ditutup).
//   - wajib sudah digrading dan investigasi (sederhana/RCA) selesai;
//   - RCA (kuning/merah/sentinel) wajib punya minimal satu tindak lanjut dengan PIC & tenggat;
//   - seluruh tindak lanjut wajib terverifikasi;
//   - tanpa tindak lanjut sama sekali → alasan penutupan wajib diisi.
export const syaratTutup = ({ laporan, investigasi, tindakLanjut = [], alasan }) => {
  const kurang = [];
  if (!laporan?.grade) kurang.push("Laporan belum digrading");
  if (!investigasi) kurang.push("Investigasi belum dicatat");
  else if (investigasi.status !== "selesai") kurang.push("Investigasi/RCA belum diselesaikan");
  const rca = perluRca(laporan?.jenis_insiden, laporan?.grade);
  if (rca && !tindakLanjut.length) kurang.push("RCA wajib memiliki rencana tindak lanjut (PIC & tenggat)");
  const belum = tindakLanjut.filter((t) => t.status !== "terverifikasi").length;
  if (belum) kurang.push(`${belum} tindak lanjut belum terverifikasi`);
  if (!tindakLanjut.length && !rca && !String(alasan ?? "").trim()) kurang.push("Alasan penutupan wajib diisi bila tanpa tindak lanjut");
  return kurang;
};

// Identitas pelapor dihapus dari baris bila laporan anonim (semua peninjau), atau bila pemohon tidak boleh melihat
// identitas. Pelapor tetap dapat mengenali laporannya lewat `milik_saya` (dicocokkan di server).
export const KOLOM_PELAPOR = ["dibuat_oleh", "pelapor_nama"];
export const amankanPelapor = (row, username) => {
  if (!row) return row;
  const milik = !!username && row.dibuat_oleh === username;
  const hasil = { ...row, milik_saya: milik };
  if (row.anonim) for (const k of KOLOM_PELAPOR) hasil[k] = null;
  return hasil;
};

// Rujukan pasien hanya untuk pemegang izin LIHAT PASIEN; selainnya hanya penanda "terkait pasien".
export const KOLOM_PASIEN = ["patient_uuid", "no_reg", "pasien_no_rm", "pasien_nama"];
export const amankanPasien = (row, bolehLihat) => {
  if (!row) return row;
  const hasil = { ...row, terkait_pasien: !!row.patient_uuid };
  if (!bolehLihat) for (const k of KOLOM_PASIEN) if (k in hasil) hasil[k] = null;
  return hasil;
};

// Inisial nama pasien (data minimum pada laporan IKP): "Budi Santoso" → "B. S."
export const inisial = (nama) =>
  String(nama ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((k) => `${k[0].toUpperCase()}.`)
    .join(" ") || null;

// Median (1 desimal); null bila kosong.
export const median = (angka) => {
  const a = angka.map(Number).filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const t = Math.floor(a.length / 2);
  const m = a.length % 2 ? a[t] : (a[t - 1] + a[t]) / 2;
  return Math.round(m * 10) / 10;
};

// Tren bulanan: baris [{ bulan: "YYYY-MM", kunci, jumlah }] + daftar bulan → [{ bulan, total, <kunci>: n, ... }].
export const susunTren = (baris, bulan, kunciDaftar) =>
  bulan.map((b) => {
    const isi = { bulan: b, total: 0 };
    for (const k of kunciDaftar) isi[k] = 0;
    for (const r of baris) {
      if (r.bulan !== b) continue;
      const n = Number(r.jumlah) || 0;
      if (r.kunci in isi) isi[r.kunci] += n;
      isi.total += n;
    }
    return isi;
  });
