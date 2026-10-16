// Kelompok umur untuk rekap LB1. Batas kelompok memakai pola yang sudah dipakai laporan-service (rekapitulasi
// diagnosis) sebagai pendekatan awal — BUKAN kelompok umur baku LB1 Kemenkes yang final; perlu dikonfirmasi
// petugas pelaporan/Dinkes sebelum dipakai sebagai laporan resmi (lihat dokumen desain, pertanyaan terbuka #2).
export const KELOMPOK_UMUR = ["<1", "1-4", "5-14", "15-24", "25-44", "45-64", "65+"];

export const kelompokUmur = (ageYear) => {
  if (ageYear === null || ageYear === undefined) return null;
  if (ageYear < 1) return "<1";
  if (ageYear <= 4) return "1-4";
  if (ageYear <= 14) return "5-14";
  if (ageYear <= 24) return "15-24";
  if (ageYear <= 44) return "25-44";
  if (ageYear <= 64) return "45-64";
  return "65+";
};

// Rentang epoch detik (UTC) untuk satu bulan "YYYY-MM". Pendekatan UTC sederhana; selisih dengan WIB (+7) tidak
// signifikan untuk rekap bulanan dan dicatat sebagai penyederhanaan, bukan definisi final zona waktu laporan.
export const rentangPeriode = (periode) => {
  if (!/^\d{4}-\d{2}$/.test(periode ?? "")) return null;
  const [tahun, bulan] = periode.split("-").map(Number);
  const mulai = Math.floor(Date.UTC(tahun, bulan - 1, 1) / 1000);
  const selesai = Math.floor(Date.UTC(tahun, bulan, 1) / 1000) - 1;
  return { mulai, selesai };
};
