// Perhitungan status "imunisasi dasar lengkap" & jadwal berikutnya. Logika ini hanya penanda sederhana berbasis
// datamaster "Jenis Vaksin & Jadwal" (urutan_dosis per kelompok_sasaran, flag wajib_dasar_lengkap) — BUKAN rujukan
// klinis definitif. Jadwal imunisasi Kemenkes dan definisi "dasar lengkap" yang sah harus ditetapkan tenaga
// klinis/bidan di datamaster sebelum dipakai mengambil keputusan pelayanan (lihat dokumen desain, bagian 9).

// riwayat: [{ jenis_vaksin_kode }]; vaksinAktif: daftar imunisasi_jenis_vaksin pada kelompok_sasaran yang sama.
export const vaksinBerikutnya = (riwayat, vaksinAktif) => {
  const sudah = new Set(riwayat.map((r) => r.jenis_vaksin_kode));
  return (
    vaksinAktif
      .filter((v) => !sudah.has(v.kode))
      .sort((a, b) => a.urutan_dosis - b.urutan_dosis)[0] ?? null
  );
};

export const dasarLengkap = (riwayat, vaksinAktif) => {
  const sudah = new Set(riwayat.map((r) => r.jenis_vaksin_kode));
  const wajib = vaksinAktif.filter((v) => v.wajib_dasar_lengkap);
  return wajib.length > 0 && wajib.every((v) => sudah.has(v.kode));
};
