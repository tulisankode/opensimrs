// Matriks kompatibilitas ABO/Rh BDRS (STD-0016, KF-2/KF-3/KF-4). Fungsi murni bertabel — tidak mengakses database
// atau state global — agar dapat diuji unit dan mudah ditinjau oleh dokter penanggung jawab pelayanan darah/kepala
// BDRS sebelum rilis produksi (lihat PRD § Kebutuhan fungsional & Desain Teknis § 6).

// Kelompok komponen menentukan matriks yang berlaku; nilai sama dengan kolom bdrs_komponen_darah.kelompok.
export const KELOMPOK_KOMPONEN = { sel_darah_merah: "Sel Darah Merah", plasma: "Plasma", trombosit: "Trombosit", lainnya: "Lainnya" };

// Klasifikasi kelompok dari kode/nama komponen (dipakai migrasi & saat admin belum menetapkan kelompok) — KF-16.
export const klasifikasiKelompokKomponen = (kode, nama) => {
  const k = String(kode ?? "").trim().toUpperCase();
  const n = String(nama ?? "").trim().toLowerCase();
  if (["PRC", "WB", "WE"].includes(k) || n.includes("sel darah merah")) return "sel_darah_merah";
  if (["FFP", "CRYO"].includes(k) || n.includes("plasma") || n.includes("kriopresipitat") || n.includes("cryo")) return "plasma";
  if (k === "TC" || n.includes("trombosit")) return "trombosit";
  return "lainnya";
};

// Golongan ABO yang dapat diterima pasien, per kelompok komponen (Permenkes 91/2015 — bawaan, menunggu pengesahan klinis).
const ABO_DITERIMA_SEL_DARAH_MERAH = { O: ["O"], A: ["A", "O"], B: ["B", "O"], AB: ["AB", "A", "B", "O"] };
const ABO_DITERIMA_PLASMA = { O: ["O", "A", "B", "AB"], A: ["A", "AB"], B: ["B", "AB"], AB: ["AB"] };

/**
 * Mengevaluasi kompatibilitas ABO/Rh pasien terhadap kantong untuk kelompok komponen tertentu.
 * @returns {{ kompatibel: boolean, peringatan: string[], alasan: string|null }}
 */
export const cekKompatibilitas = ({ kelompokKomponen, golonganPasien, rhesusPasien, golonganKantong, rhesusKantong, namaKomponen }) => {
  const golPasien = String(golonganPasien ?? "").toUpperCase();
  const golKantong = String(golonganKantong ?? "").toUpperCase();
  const nama = namaKomponen ?? kelompokKomponen;

  if (!["A", "B", "AB", "O"].includes(golPasien) || !["A", "B", "AB", "O"].includes(golKantong) || !["positif", "negatif"].includes(rhesusPasien) || !["positif", "negatif"].includes(rhesusKantong))
    return { kompatibel: false, peringatan: [], alasan: "Data golongan darah pasien atau kantong tidak lengkap/tidak dikenal" };

  if (kelompokKomponen === "sel_darah_merah") {
    const aboCocok = ABO_DITERIMA_SEL_DARAH_MERAH[golPasien]?.includes(golKantong);
    const rhCocok = rhesusPasien === "negatif" ? rhesusKantong === "negatif" : true;
    if (!aboCocok || !rhCocok)
      return { kompatibel: false, peringatan: [], alasan: `Golongan kantong ${golKantong}${rhesusKantong === "negatif" ? "-" : "+"} tidak kompatibel dengan pasien ${golPasien}${rhesusPasien === "negatif" ? "-" : "+"} untuk komponen ${nama}` };
    return { kompatibel: true, peringatan: [], alasan: null };
  }

  if (kelompokKomponen === "plasma") {
    const aboCocok = ABO_DITERIMA_PLASMA[golPasien]?.includes(golKantong);
    if (!aboCocok) return { kompatibel: false, peringatan: [], alasan: `Golongan kantong ${golKantong} tidak kompatibel dengan pasien ${golPasien} untuk komponen ${nama}` };
    return { kompatibel: true, peringatan: [], alasan: null };
  }

  if (kelompokKomponen === "trombosit") {
    // ABO non-identik diperbolehkan dengan peringatan, bukan penolakan otomatis (KF-4/KT-5).
    const peringatan = [];
    if (golPasien !== golKantong) peringatan.push(`Golongan kantong ${golKantong} tidak identik dengan pasien ${golPasien} untuk komponen ${nama} (trombosit, diperbolehkan dengan peringatan)`);
    if (rhesusPasien === "negatif" && rhesusKantong !== "negatif") peringatan.push(`Pasien Rhesus negatif menerima kantong trombosit Rhesus positif, perhatikan risiko sensitisasi Rh`);
    return { kompatibel: true, peringatan, alasan: null };
  }

  return { kompatibel: false, peringatan: [], alasan: `Kelompok komponen ${nama} belum ditetapkan; atur di Datamaster › Komponen Darah` };
};

// Kantong universal yang boleh dipertimbangkan untuk pengecualian darurat (KF-8). `izinkanOPos` berasal dari
// pengaturan faskes (override_o_pos_aktif) & kelayakan pasien (laki-laki, atau perempuan berusia > 50 tahun).
export const kantongUniversal = ({ kelompokKomponen, golonganKantong, rhesusKantong, izinkanOPos }) => {
  const gol = String(golonganKantong ?? "").toUpperCase();
  if (kelompokKomponen === "sel_darah_merah" && gol === "O") {
    if (rhesusKantong === "negatif") return true;
    if (rhesusKantong === "positif" && izinkanOPos) return true;
    return false;
  }
  if (kelompokKomponen === "plasma" && gol === "AB") return true;
  return false;
};

// Kelayakan pasien untuk pengecualian PRC O Rh positif: laki-laki, atau perempuan berusia > 50 tahun (KF-8).
export const layakOPosPasien = ({ genderPasien, umurPasien }) => genderPasien === "Male" || (genderPasien === "Female" && Number(umurPasien) > 50);

/**
 * Syarat pengecualian darurat (KF-7/KF-8) sebagai fungsi murni: seluruh masukan (sakelar pengaturan, hasil cek izin,
 * kelayakan pasien) sudah diselesaikan pemanggil (lihat bersama.js § cekOverrideDarurat) agar fungsi ini dapat diuji
 * unit tanpa database. Mengembalikan alasan penolakan spesifik, bukan pesan ketidakcocokan golongan generik.
 * @returns {{ sah: boolean, alasan: string|null }}
 */
export const syaratOverrideDarurat = ({ overrideDaruratAktif, punyaIzinOverride, alasanOverride, kelompokKomponen, golonganKantong, rhesusKantong, izinkanOPos, layakOPos = true }) => {
  if (!overrideDaruratAktif) return { sah: false, alasan: "Pengecualian darurat tidak aktif di Pengaturan BDRS" };
  if (!punyaIzinOverride) return { sah: false, alasan: "Tidak memiliki izin Uji Silang Serasi › OVERRIDE DARURAT" };
  if ((alasanOverride?.length ?? 0) < 10) return { sah: false, alasan: "Alasan pengecualian minimal 10 karakter" };
  if (!kantongUniversal({ kelompokKomponen, golonganKantong, rhesusKantong, izinkanOPos })) return { sah: false, alasan: "Kantong bukan kantong universal untuk pengecualian darurat" };
  if (kelompokKomponen === "sel_darah_merah" && String(golonganKantong ?? "").toUpperCase() === "O" && rhesusKantong === "positif" && !layakOPos)
    return { sah: false, alasan: "Pasien tidak memenuhi syarat PRC O Rh positif" };
  return { sah: true, alasan: null };
};
