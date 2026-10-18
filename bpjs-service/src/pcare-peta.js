// Pembentuk isian (payload) BPJS PCare. Fungsi murni: tidak mengakses database maupun jaringan.
// Nama field mengikuti katalog web service PCare (pendaftaran & kunjungan rawat jalan tingkat pertama).
// CATATAN: kode referensi bawaan (kesadaran, status pulang, prognosa, alergi, TACC) wajib dicocokkan
// dengan endpoint referensi PCare faskes saat kredensial tersedia; nilainya dapat diubah via `opsi`.

const OFFSET_WIB_DETIK = 7 * 3600;

// epoch (detik/ms) → dd-mm-yyyy (tanggal WIB), format tanggal PCare
export const keTanggalPcare = (epoch) => {
  // Tanggal kalender 'YYYY-MM-DD' (mis. tanggal MCU dari penunjang-service) langsung diubah tanpa geser zona waktu.
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(epoch ?? "").trim());
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const n = Number(epoch);
  if (!n) return null;
  const d = new Date((n > 1e12 ? n : n * 1000) + OFFSET_WIB_DETIK * 1000);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
};

const angka = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : 0);
const desimal = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

// Kode TKP (tempat kunjungan pelayanan): 10 = RJTP (rawat jalan tingkat pertama)
export const KD_TKP_RJTP = "10";

/**
 * Pendaftaran peserta ke poli FKTP.
 * @param {object} p { kdProvider, noKartu, kdPoli, tanggal (epoch), keluhan, kunjSakit, tandaVital, antropometri }
 */
export const buatPendaftaran = ({ kdProvider, noKartu, kdPoli, tanggal, keluhan = null, kunjSakit = true, tandaVital = null, antropometri = null }) => ({
  kdProviderPeserta: kdProvider,
  tglDaftar: keTanggalPcare(tanggal),
  noKartu,
  kdPoli,
  keluhan: keluhan || null,
  kunjSakit: !!kunjSakit,
  sistole: angka(tandaVital?.tekanan_darah_sistole),
  diastole: angka(tandaVital?.tekanan_darah_diastole),
  beratBadan: desimal(antropometri?.berat_badan),
  tinggiBadan: desimal(antropometri?.tinggi_badan),
  respRate: angka(tandaVital?.frekuensi_nafas),
  lingkarPerut: desimal(antropometri?.lingkar_perut),
  heartRate: angka(tandaVital?.frekuensi_nadi),
  rujukBalik: 0,
  kdTkp: KD_TKP_RJTP,
});

export const OPSI_KUNJUNGAN_BAWAAN = {
  kdSadar: "01", // Compos mentis
  kdStatusPulang: "3", // Berobat jalan
  kdPrognosa: "02", // Bonam (baik)
  alergiMakan: "00", // Tidak ada
  alergiObat: "00", // Tidak ada
  kdTacc: -1, // tanpa TACC (tidak dirujuk)
};

/**
 * Kunjungan (pelayanan) rawat jalan setelah pemeriksaan selesai.
 * @param {object} p { noKartu, tanggalDaftar, tanggalPulang, kdPoli, kdDokter, diagnosis[{kode}], keluhan,
 *                     anamnesa, tandaVital, antropometri, terapiObat, terapiNonObat, opsi }
 */
export const buatKunjungan = ({
  noKartu, tanggalDaftar, tanggalPulang, kdPoli, kdDokter, diagnosis = [], keluhan = null, anamnesa = null,
  tandaVital = null, antropometri = null, terapiObat = null, terapiNonObat = null, opsi = {},
}) => {
  const o = { ...OPSI_KUNJUNGAN_BAWAAN, ...opsi };
  const kode = diagnosis.map((d) => d.kode).filter(Boolean);
  return {
    noKunjungan: null,
    noKartu,
    tglDaftar: keTanggalPcare(tanggalDaftar),
    kdPoli,
    keluhan: keluhan || "-",
    kdSadar: o.kdSadar,
    sistole: angka(tandaVital?.tekanan_darah_sistole),
    diastole: angka(tandaVital?.tekanan_darah_diastole),
    beratBadan: desimal(antropometri?.berat_badan),
    tinggiBadan: desimal(antropometri?.tinggi_badan),
    respRate: angka(tandaVital?.frekuensi_nafas),
    heartRate: angka(tandaVital?.frekuensi_nadi),
    lingkarPerut: desimal(antropometri?.lingkar_perut),
    suhu: tandaVital?.suhu ? String(tandaVital.suhu) : null,
    kdStatusPulang: o.kdStatusPulang,
    tglPulang: keTanggalPcare(tanggalPulang ?? tanggalDaftar),
    kdDokter,
    kdDiag1: kode[0] ?? null,
    kdDiag2: kode[1] ?? null,
    kdDiag3: kode[2] ?? null,
    kdPoliRujukInternal: null,
    rujukLanjut: null,
    kdTacc: o.kdTacc,
    alasanTacc: null,
    anamnesa: anamnesa || keluhan || "-",
    alergiMakan: o.alergiMakan,
    alergiObat: o.alergiObat,
    kdPrognosa: o.kdPrognosa,
    terapiObat: terapiObat || null,
    terapiNonObat: terapiNonObat || null,
    bmhp: null,
  };
};

// Kode kesimpulan MCU → PCare. DRAF (belum dikonfirmasi ke spesifikasi resmi, lihat config.mcuPcareDikonfirmasi):
// dipetakan ke kesan pemeriksaan umum (1 = sehat/baik, 2 = perlu tindak lanjut) sebagai representasi sementara.
export const KESAN_MCU_PCARE = { fit: 1, fit_catatan: 2, unfit: 2 };

/**
 * STD-0020 — Pelaporan MCU ke PCare. DRAF versi 1: nama & bentuk field belum dikonfirmasi ke spesifikasi resmi
 * layanan MCU PCare (lihat bpjs-service/src/pcare.js#operasiMcu & config.mcuPcareDikonfirmasi). Nilai yang tidak
 * diperiksa di SIMRS dikirim null (kosong) sesuai KF-3/KF-4 — tidak boleh diisi dengan nilai perkiraan.
 * @param {object} p { noKunjungan, kdProviderPeserta, tglPeriksa (epoch), tandaVital, kesimpulan }
 */
export const buatMcu = ({ noKunjungan, kdProviderPeserta, tglPeriksa, tandaVital = null, kesimpulan = null }) => ({
  noKunjungan,
  kdProviderPeserta,
  tglPeriksa: keTanggalPcare(tglPeriksa),
  sistole: tandaVital?.sistole != null ? angka(tandaVital.sistole) : null,
  diastole: tandaVital?.diastole != null ? angka(tandaVital.diastole) : null,
  beratBadan: tandaVital?.berat_badan != null ? desimal(tandaVital.berat_badan) : null,
  tinggiBadan: tandaVital?.tinggi_badan != null ? desimal(tandaVital.tinggi_badan) : null,
  lingkarPerut: tandaVital?.lingkar_perut != null ? desimal(tandaVital.lingkar_perut) : null,
  gulaDarah: tandaVital?.gula_darah != null ? desimal(tandaVital.gula_darah) : null,
  keteranganGulaDarah: tandaVital?.keterangan_gula_darah ?? null,
  kolesterolTotal: tandaVital?.kolesterol_total != null ? desimal(tandaVital.kolesterol_total) : null,
  kesimpulan: kesimpulan ? (KESAN_MCU_PCARE[kesimpulan] ?? null) : null,
});
