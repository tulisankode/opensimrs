import { permintaanSalah } from "../umum/respons.js";
import { HARI, awalHariWib, sekarangDetik } from "./bersama.js";

// Konstanta & helper murni fitur Indikator Mutu (STD-0025, fitur katalog mutu_indikator) di modul Mutu & Akreditasi.
// Tanpa database agar dapat diuji unit (test/mutu-indikator.test.js).
//
// Waktu: tanggal data disimpan sebagai epoch detik awal hari Asia/Jakarta (WIB); data berfrekuensi bulanan memakai
// awal hari tanggal 1 bulan itu. periode_bulan ("YYYY-MM") dihitung dari tanggal WIB sehingga rekap bulanan &
// triwulanan tidak bergantung zona waktu server.
//
// Capaian = Σ numerator / Σ denominator × pengali satuan (persen ×100, nilai ×1) dari data TERVALIDASI saja; pembagi
// nol/kosong → capaian null (bukan galat, bukan 0).

export const JENIS_INDIKATOR = { inm: "INM (Nasional)", imp_rs: "IMP-RS (Prioritas Rumah Sakit)", impu: "IMPU (Prioritas Unit)" };
export const SATUAN_INDIKATOR = { persen: "Persen (%)", nilai: "Nilai rata-rata" };
export const PENGALI_SATUAN = { persen: 100, nilai: 1 };
export const ARAH_TARGET = { naik: "≥ target (makin tinggi makin baik)", turun: "≤ target (makin rendah makin baik)" };
export const SUMBER_TARGET = { regulasi: "Regulasi", faskes: "Keputusan Faskes" };
export const FREKUENSI_INDIKATOR = { harian: "Harian (sensus)", bulanan: "Bulanan" };
export const SUMBER_DATA = { manual: "Manual", otomatis: "Otomatis (data SIMRS)" };
export const STATUS_DATA = { draf: "Draf", diajukan: "Diajukan", tervalidasi: "Tervalidasi", dikembalikan: "Dikembalikan" };
export const STATUS_TINDAK_LANJUT = { rencana: "Rencana", berjalan: "Berjalan", selesai: "Selesai" };
export const STATUS_CAPAIAN = {
  tercapai: "Tercapai",
  tidak_tercapai: "Tidak Tercapai",
  belum_lengkap: "Data Belum Lengkap",
  tanpa_target: "Target Belum Ditetapkan",
  belum_ada_data: "Belum Ada Data",
};

// Alur validasi (pengumpul → validator):
//   draf | dikembalikan → diajukan (aksi INPUT DATA), diajukan → tervalidasi | dikembalikan (aksi VALIDASI),
//   tervalidasi → draf (buka kembali, aksi VALIDASI + alasan wajib). Data hanya dapat diubah/dihapus selama draf atau
//   dikembalikan; data tervalidasi terkunci.
export const TRANSISI_DATA = { draf: ["diajukan"], dikembalikan: ["diajukan"], diajukan: ["tervalidasi", "dikembalikan"], tervalidasi: ["draf"] };
export const transisiDataSah = (dari, ke) => (TRANSISI_DATA[dari] ?? []).includes(ke);
export const STATUS_DAPAT_DIUBAH = ["draf", "dikembalikan"];
export const dataDapatDiubah = (status) => STATUS_DAPAT_DIUBAH.includes(status);

// Pemisahan tugas: validator tidak boleh orang yang mengisi atau mengajukan data yang sama.
export const validatorSah = (data, username) => !!username && username !== data?.diisi_oleh && username !== data?.diajukan_oleh;

// Sumber otomatis yang datanya memang tersedia di OpenSIMRS (baca saja). Kunci = kode_otomatis profil indikator.
//   waktu_tunggu_rj : rawat_jalans.tanggal_checkin (check-in/registrasi, admisi-service) → tanggal_periksa (pasien
//                     dipanggil dokter, rawat-jalan-service). Kunjungan batal (status_rj 0) & terhapus dikecualikan;
//                     kunjungan tanpa salah satu cap waktu atau dengan urutan waktu terbalik tidak dihitung dan
//                     dilaporkan sebagai "tidak_lengkap". Unit = poli (rawat_jalans.lokasi_uuid).
// Kandidat lain (hasil kritis lab, penundaan operasi, formularium, visite) belum didaftarkan: definisi & kelengkapan
// datanya belum terverifikasi, sehingga diisi manual.
export const KODE_OTOMATIS = {
  waktu_tunggu_rj: {
    nama: "Waktu tunggu rawat jalan (check-in → dipanggil periksa)",
    sumber: "rawat_jalans.tanggal_checkin → rawat_jalans.tanggal_periksa (kunjungan tidak batal, per hari WIB, per poli)",
    modul_sumber: "rawat_jalan",
    parameter: { ambang_menit: { nama: "Ambang waktu tunggu (menit)", bawaan: 60, min: 1, maks: 1440 } },
  },
};

// Parameter otomatis: hanya kunci yang terdaftar, angka bulat dalam batas; kosong → nilai bawaan.
export const parameterOtomatis = (kode, nilai) => {
  const def = KODE_OTOMATIS[kode];
  if (!def) throw permintaanSalah(`kode_otomatis harus salah satu: ${Object.keys(KODE_OTOMATIS).join(", ")}`);
  const masuk = nilai && typeof nilai === "object" && !Array.isArray(nilai) ? nilai : {};
  const hasil = {};
  for (const [k, p] of Object.entries(def.parameter)) {
    const v = masuk[k] === undefined || masuk[k] === null || masuk[k] === "" ? p.bawaan : Number(masuk[k]);
    if (!Number.isInteger(v) || v < p.min || v > p.maks) throw permintaanSalah(`${p.nama} harus bilangan bulat ${p.min}–${p.maks}`);
    hasil[k] = v;
  }
  return hasil;
};

// Ringkasan hitung otomatis waktu tunggu dari baris [{ tanggal_checkin, tanggal_periksa }] (epoch detik).
export const ringkasWaktuTunggu = (baris, ambangMenit) => {
  let numerator = 0;
  let denominator = 0;
  let tidakLengkap = 0;
  for (const r of baris) {
    const masuk = Number(r.tanggal_checkin);
    const periksa = Number(r.tanggal_periksa);
    if (!masuk || !periksa || periksa < masuk) {
      tidakLengkap += 1;
      continue;
    }
    denominator += 1;
    if (periksa - masuk <= ambangMenit * 60) numerator += 1;
  }
  return { numerator, denominator, tidak_lengkap: tidakLengkap };
};

// Capaian satu nilai (2 desimal); null bila pembagi nol/kosong/tidak valid.
export const hitungCapaian = (numerator, denominator, satuan = "persen") => {
  const n = Number(numerator);
  const d = Number(denominator);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  const hasil = (n / d) * (PENGALI_SATUAN[satuan] ?? 100);
  return Math.round(hasil * 100) / 100;
};

// Status capaian terhadap target & arah. Data belum lengkap tidak pernah dinyatakan tercapai/tidak tercapai (KT-10);
// tanpa target hanya menampilkan nilai (KT-4).
export const statusCapaian = (capaian, target, arah = "naik", lengkap = true) => {
  if (capaian === null || capaian === undefined) return "belum_ada_data";
  if (target === null || target === undefined || target === "") return "tanpa_target";
  if (!lengkap) return "belum_lengkap";
  const c = Number(capaian);
  const t = Number(target);
  return (arah === "turun" ? c <= t : c >= t) ? "tercapai" : "tidak_tercapai";
};

// Numerator/denominator: angka ≥ 0 (maks. 2 desimal disimpan); numerator ≤ denominator bila profil mensyaratkan.
export const nilaiData = (numerator, denominator, indikator = {}) => {
  const angka = (v, nama) => {
    if (v === undefined || v === null || v === "") throw permintaanSalah(`${nama} wajib diisi`);
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 1e11) throw permintaanSalah(`${nama} harus berupa angka ≥ 0`);
    return Math.round(n * 100) / 100;
  };
  const n = angka(numerator, "numerator");
  const d = angka(denominator, "denominator");
  if (indikator.numerator_maks_denominator !== false && n > d) throw permintaanSalah("numerator tidak boleh lebih besar dari denominator");
  return { numerator: n, denominator: d };
};

// ── Periode (WIB)
const OFFSET_WIB = 7 * 3600;
const pad = (n) => String(n).padStart(2, "0");
const tglWib = (epoch) => new Date((Number(epoch) + OFFSET_WIB) * 1000);
// Epoch awal hari WIB untuk tanggal kalender (bulan 1–12).
export const epochTanggalWib = (tahun, bulan, hari = 1) => Date.UTC(tahun, bulan - 1, hari) / 1000 - OFFSET_WIB;
export const bulanDariEpoch = (epoch) => {
  const d = tglWib(epoch);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
export const hariDalamBulan = (tahun, bulan) => new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();

// Tanggal data dinormalkan sesuai frekuensi: harian → awal hari WIB, bulanan → awal tanggal 1 bulan itu (WIB).
export const tanggalData = (epoch, frekuensi) => {
  const awal = awalHariWib(epoch);
  if (frekuensi !== "bulanan") return awal;
  const d = tglWib(awal);
  return epochTanggalWib(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
};

// "YYYY-MM" → { kode, tahun, bulan, awal, akhir } (akhir eksklusif); 400 bila format salah.
export const uraiBulan = (v, nama = "bulan") => {
  const m = String(v ?? "").trim().match(/^(\d{4})-(\d{2})$/);
  const tahun = Number(m?.[1]);
  const bulan = Number(m?.[2]);
  if (!m || bulan < 1 || bulan > 12 || tahun < 2000 || tahun > 2100) throw permintaanSalah(`${nama} harus berformat YYYY-MM`);
  const akhir = bulan === 12 ? epochTanggalWib(tahun + 1, 1, 1) : epochTanggalWib(tahun, bulan + 1, 1);
  return { kode: `${tahun}-${pad(bulan)}`, tahun, bulan, awal: epochTanggalWib(tahun, bulan, 1), akhir };
};

// Periode analisis: "YYYY-MM" (bulanan) atau "YYYY-Qn" (triwulan) → { kode, jenis, bulan: ["YYYY-MM", ...], awal, akhir }.
export const uraiPeriode = (v, nama = "periode") => {
  const s = String(v ?? "").trim().toUpperCase();
  const q = s.match(/^(\d{4})-Q([1-4])$/);
  if (q) {
    const tahun = Number(q[1]);
    const tw = Number(q[2]);
    if (tahun < 2000 || tahun > 2100) throw permintaanSalah(`${nama} tidak valid`);
    const bulan = [1, 2, 3].map((i) => `${tahun}-${pad((tw - 1) * 3 + i)}`);
    return { kode: `${tahun}-Q${tw}`, jenis: "triwulan", bulan, awal: uraiBulan(bulan[0]).awal, akhir: uraiBulan(bulan[2]).akhir };
  }
  try {
    const b = uraiBulan(s, nama);
    return { kode: b.kode, jenis: "bulanan", bulan: [b.kode], awal: b.awal, akhir: b.akhir };
  } catch {
    throw permintaanSalah(`${nama} harus berformat YYYY-MM atau YYYY-Qn`);
  }
};
export const triwulanDariBulan = (kodeBulan) => {
  const [t, b] = kodeBulan.split("-").map(Number);
  return `${t}-Q${Math.ceil(b / 3)}`;
};

// Daftar bulan dari..sampai (inklusif, maks. 36 bulan).
export const rentangBulan = (dari, sampai) => {
  const a = uraiBulan(dari, "dari");
  const b = uraiBulan(sampai, "sampai");
  const n = (b.tahun - a.tahun) * 12 + (b.bulan - a.bulan) + 1;
  if (n < 1) throw permintaanSalah("Rentang bulan tidak valid (dari > sampai)");
  if (n > 36) throw permintaanSalah("Rentang maksimal 36 bulan");
  return Array.from({ length: n }, (_, i) => {
    const total = a.tahun * 12 + (a.bulan - 1) + i;
    return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
  });
};

// Jumlah hari yang diharapkan terisi dalam periode untuk indikator harian: hari kalender periode, dipotong sampai
// hari ini bila periode masih berjalan (0 bila periode belum dimulai). Bulanan: 1 data per bulan.
export const hariDiharapkan = (periode, frekuensi, sekarang = sekarangDetik()) => {
  if (frekuensi === "bulanan") return periode.bulan.filter((b) => uraiBulan(b).awal <= awalHariWib(sekarang)).length;
  const batas = Math.min(periode.akhir, awalHariWib(sekarang) + HARI);
  return Math.max(0, Math.round((batas - periode.awal) / HARI));
};

// Rekap baris data tervalidasi [{ numerator, denominator, tanggal }] menjadi capaian + kelengkapan periode.
export const rekapPeriode = (baris, indikator, periode, sekarang = sekarangDetik()) => {
  const num = baris.reduce((a, r) => a + Number(r.numerator), 0);
  const den = baris.reduce((a, r) => a + Number(r.denominator), 0);
  const terisi = new Set(baris.map((r) => String(r.tanggal))).size;
  const diharapkan = hariDiharapkan(periode, indikator.frekuensi, sekarang);
  const lengkap = diharapkan > 0 && terisi >= diharapkan;
  const capaian = hitungCapaian(num, den, indikator.satuan);
  return {
    numerator: Math.round(num * 100) / 100,
    denominator: Math.round(den * 100) / 100,
    capaian,
    terisi,
    diharapkan,
    lengkap,
    status: statusCapaian(capaian, indikator.target_nilai, indikator.arah, lengkap),
  };
};

// Validasi lintas kolom profil indikator (setelah digabung dengan data lama saat ubah).
export const cekProfilIndikator = (p) => {
  if (p.target_sumber && (p.target_nilai === null || p.target_nilai === undefined)) throw permintaanSalah("target_nilai wajib diisi bila sumber target ditetapkan");
  if (p.target_sumber === "regulasi" && !p.regulasi_acuan) throw permintaanSalah("regulasi_acuan wajib diisi untuk target dari regulasi");
  if (p.sumber_data === "otomatis" && !KODE_OTOMATIS[p.kode_otomatis]) throw permintaanSalah("kode_otomatis wajib dipilih untuk sumber data otomatis");
  if (p.satuan === "persen" && p.target_nilai !== null && p.target_nilai !== undefined && Number(p.target_nilai) > 100) throw permintaanSalah("Target persen maksimal 100");
};

// ── Set INM bawaan (Indikator Nasional Mutu rumah sakit). Acuan: PMK No. 30 Tahun 2022 tentang Indikator Nasional Mutu
// Pelayanan Kesehatan Tempat Praktik Mandiri Dokter dan Dokter Gigi, Klinik, Puskesmas, Rumah Sakit, Laboratorium
// Kesehatan, dan Unit Transfusi Darah. Isi (definisi & target) WAJIB ditinjau dan disahkan Komite Mutu faskes terhadap
// naskah regulasi resmi yang berlaku sebelum dipakai; faskes dapat mengubah setiap profil setelah dipasang. Set ini
// tidak dimasukkan migrasi — faskes memasangnya sendiri lewat POST /mutu/indikator/pasang-inm.
export const REGULASI_INM = "PMK No. 30 Tahun 2022 tentang Indikator Nasional Mutu Pelayanan Kesehatan";
const inm = (kode_bawaan, judul, dimensi_mutu, definisi_operasional, definisi_numerator, definisi_denominator, target_nilai, lain = {}) => ({
  kode_bawaan,
  kode: kode_bawaan,
  judul,
  jenis: "inm",
  dimensi_mutu,
  definisi_operasional,
  definisi_numerator,
  definisi_denominator,
  kriteria_inklusi: null,
  kriteria_eksklusi: null,
  satuan: "persen",
  target_nilai,
  arah: "naik",
  target_sumber: "regulasi",
  regulasi_acuan: REGULASI_INM,
  frekuensi: "bulanan",
  sumber_data: "manual",
  kode_otomatis: null,
  parameter_otomatis: null,
  numerator_maks_denominator: true,
  ...lain,
});
export const INM_BAWAAN = [
  inm(
    "INM-01",
    "Kepatuhan Kebersihan Tangan",
    "Keselamatan",
    "Kebersihan tangan dengan handrub berbasis alkohol atau sabun dan air mengalir oleh pemberi layanan pada lima momen (sebelum kontak pasien, sebelum tindakan aseptik, setelah terpapar cairan tubuh, setelah kontak pasien, setelah kontak lingkungan pasien).",
    "Jumlah tindakan kebersihan tangan yang dilakukan",
    "Jumlah peluang kebersihan tangan yang seharusnya dilakukan selama periode observasi",
    85,
  ),
  inm(
    "INM-02",
    "Kepatuhan Penggunaan Alat Pelindung Diri (APD)",
    "Keselamatan",
    "Kepatuhan petugas menggunakan APD dengan tepat sesuai indikasi saat melakukan tindakan yang berisiko pajanan darah, cairan tubuh, atau infeksi.",
    "Jumlah petugas yang patuh menggunakan APD sesuai indikasi dalam periode observasi",
    "Jumlah seluruh petugas yang terindikasi menggunakan APD dalam periode observasi",
    100,
  ),
  inm(
    "INM-03",
    "Kepatuhan Identifikasi Pasien",
    "Keselamatan",
    "Pemberi pelayanan melakukan identifikasi pasien dengan minimal dua identitas (nama lengkap, tanggal lahir, dan/atau nomor rekam medis) sebelum pemberian obat, darah, pengambilan spesimen, tindakan, dan pelayanan lain.",
    "Jumlah pemberi pelayanan yang melakukan identifikasi pasien secara benar dalam periode observasi",
    "Jumlah pemberi pelayanan yang diobservasi dalam periode observasi",
    100,
  ),
  inm(
    "INM-04",
    "Waktu Tanggap Operasi Seksio Sesarea Emergensi",
    "Tepat waktu",
    "Seksio sesarea emergensi kategori I dimulai (insisi) dalam waktu ≤ 30 menit sejak keputusan operasi ditetapkan.",
    "Jumlah pasien seksio sesarea emergensi kategori I dengan waktu tanggap ≤ 30 menit",
    "Jumlah pasien seksio sesarea emergensi kategori I",
    80,
  ),
  inm(
    "INM-05",
    "Waktu Tunggu Rawat Jalan",
    "Tepat waktu, berorientasi pasien",
    "Waktu tunggu pasien rawat jalan ≤ 60 menit sejak pasien terdaftar/check-in hingga mendapat pelayanan dokter. Hitung otomatis memakai cap waktu check-in dan saat pasien dipanggil periksa di OpenSIMRS.",
    "Jumlah pasien rawat jalan dengan waktu tunggu ≤ 60 menit",
    "Jumlah pasien rawat jalan yang diobservasi (kunjungan dengan cap waktu lengkap)",
    80,
    { frekuensi: "harian", sumber_data: "otomatis", kode_otomatis: "waktu_tunggu_rj", parameter_otomatis: { ambang_menit: 60 } },
  ),
  inm(
    "INM-06",
    "Penundaan Operasi Elektif",
    "Tepat waktu, efisien",
    "Operasi elektif yang tertunda lebih dari 1 jam dari jadwal yang ditetapkan atau dipindah ke hari lain.",
    "Jumlah pasien yang jadwal operasi elektifnya tertunda lebih dari 1 jam",
    "Jumlah pasien operasi elektif",
    5,
    { arah: "turun" },
  ),
  inm(
    "INM-07",
    "Kepatuhan Waktu Visite Dokter",
    "Tepat waktu, berorientasi pasien",
    "Visite dokter penanggung jawab pelayanan (DPJP) kepada pasien rawat inap dilakukan pada pukul 06.00–14.00.",
    "Jumlah pasien yang divisite DPJP pada pukul 06.00–14.00",
    "Jumlah pasien rawat inap yang diobservasi",
    80,
  ),
  inm(
    "INM-08",
    "Pelaporan Hasil Kritis Laboratorium",
    "Tepat waktu, keselamatan",
    "Hasil pemeriksaan laboratorium yang termasuk nilai kritis dilaporkan kepada DPJP/perawat penanggung jawab dalam waktu ≤ 30 menit sejak hasil diverifikasi.",
    "Jumlah hasil kritis laboratorium yang dilaporkan ≤ 30 menit",
    "Jumlah hasil kritis laboratorium yang diobservasi",
    100,
  ),
  inm(
    "INM-09",
    "Kepatuhan Penggunaan Formularium Nasional",
    "Efisien",
    "Peresepan obat oleh dokter yang sesuai Formularium Nasional (Fornas) pada pasien Jaminan Kesehatan Nasional.",
    "Jumlah R/ obat yang sesuai Formularium Nasional",
    "Jumlah seluruh R/ obat dalam resep yang diobservasi",
    80,
    { kriteria_inklusi: "Resep pasien JKN" },
  ),
  inm(
    "INM-10",
    "Kepatuhan terhadap Alur Klinis (Clinical Pathway)",
    "Efektif",
    "Pelayanan oleh profesional pemberi asuhan (PPA) pada kasus yang ditetapkan sesuai dengan clinical pathway yang berlaku di faskes.",
    "Jumlah pelayanan oleh PPA yang sesuai clinical pathway",
    "Jumlah pelayanan oleh PPA pada clinical pathway yang diobservasi",
    80,
  ),
  inm(
    "INM-11",
    "Kepatuhan Upaya Pencegahan Risiko Pasien Jatuh",
    "Keselamatan",
    "Pasien rawat inap berisiko tinggi jatuh mendapat ketiga upaya pencegahan: asesmen awal, asesmen ulang, dan intervensi pencegahan risiko jatuh.",
    "Jumlah pasien risiko tinggi jatuh yang mendapat ketiga upaya pencegahan",
    "Jumlah pasien rawat inap berisiko tinggi jatuh yang diobservasi",
    100,
  ),
  inm(
    "INM-12",
    "Kecepatan Waktu Tanggap Komplain",
    "Berorientasi pasien",
    "Komplain ditanggapi sesuai batas waktu menurut kategori risiko/dampak (merah ≤ 1×24 jam, kuning ≤ 3 hari, hijau ≤ 7 hari).",
    "Jumlah komplain yang ditanggapi sesuai batas waktu kategorinya",
    "Jumlah komplain yang diterima",
    80,
  ),
  inm(
    "INM-13",
    "Kepuasan Pasien",
    "Berorientasi pasien",
    "Hasil pengukuran kepuasan pasien terhadap pelayanan dengan instrumen survei kepuasan masyarakat (nilai indeks skala 0–100).",
    "Jumlah nilai indeks kepuasan seluruh responden",
    "Jumlah responden",
    76.61,
    { satuan: "nilai", numerator_maks_denominator: false },
  ),
];
