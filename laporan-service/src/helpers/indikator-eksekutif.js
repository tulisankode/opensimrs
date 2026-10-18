// Definisi & perhitungan indikator Dashboard Eksekutif (STD-0034). Fungsi di berkas ini murni (tanpa database) agar
// bisa diuji unit; kueri agregat ada di repositories/eksekutif-repository.js.
//
// Indikator rawat inap mengikuti rumus baku Barber-Johnson (Depkes RI 2005, Pedoman Sistem Informasi RS; dipakai
// dalam pelaporan RL Kemenkes):
//   HP   = hari perawatan: jumlah pasien yang dirawat pada tiap hari sensus dalam periode (hari masuk dihitung, hari
//          keluar tidak; pasien masuk & keluar pada hari yang sama dihitung 1 hari)
//   TT   = tempat tidur siap pakai (room_monitorings bertipe "Bed"; bed cadangan & box bayi tidak dihitung)
//   t    = jumlah hari kalender dalam periode
//   D    = pasien keluar (hidup + mati) dalam periode
//   LD   = jumlah lama dirawat pasien keluar (tanggal keluar − tanggal masuk; masuk & keluar hari yang sama = 1 hari)
//   BOR  = HP / (TT × t) × 100%                 acuan Depkes 60–85%
//   ALOS = LD / D (hari)                        acuan 6–9 hari
//   TOI  = (TT × t − HP) / D (hari)             acuan 1–3 hari
//   BTO  = D / TT (kali dalam periode)          acuan 40–50 kali per tahun
//   GDR  = pasien mati seluruhnya / D × 1000‰   acuan ≤ 45‰
//   NDR  = pasien mati ≥ 48 jam / D × 1000‰     acuan ≤ 25‰
// Pembagi nol (mis. TT belum diisi, belum ada pasien keluar) menghasilkan null = "belum dapat dihitung", bukan 0.

export const STATUS_DATA = Object.freeze({
  TERSEDIA: "tersedia",
  BELUM_TERSEDIA: "belum_tersedia",
  GAGAL: "gagal",
  BELUM_DAPAT_DIHITUNG: "belum_dapat_dihitung",
});

// Zona waktu laporan: tanggal filter (YYYY-MM-DD) dibaca sebagai tanggal lokal faskes (bawaan WIB).
export const ZONA_WAKTU = process.env.REPORT_TZ || "Asia/Jakarta";
export const MAKS_HARI_PERIODE = 366;

// skala "per_30_hari": nilai bergantung panjang periode (volume), sehingga target dinyatakan per 30 hari dan
// disesuaikan dengan panjang periode terpilih (target × t / 30). skala "tetap": rasio/rerata, tidak disesuaikan.
// acuan = nilai rujukan untuk mengisi target (Setting target); TIDAK dipakai otomatis sebagai target faskes.
const def = (kode, nama, kelompok, satuan, rumus, { skala = "tetap", acuan = null, drill = [], desimal = 0 } = {}) =>
  Object.freeze({ kode, nama, kelompok, satuan, rumus, skala, acuan, dimensi_rincian: drill, desimal });

export const KATALOG_INDIKATOR = Object.freeze([
  // Layanan
  def("kunjungan_rj", "Kunjungan rawat jalan", "layanan", "kunjungan", "Pendaftaran rawat jalan (tanggal daftar dalam periode), tanpa kunjungan batal.", { skala: "per_30_hari", drill: ["poli", "dokter", "penjamin", "bulan"] }),
  def("kunjungan_ri", "Pasien masuk rawat inap", "layanan", "pasien", "Pendaftaran rawat inap (tanggal dirawat dalam periode), tanpa kunjungan batal.", { skala: "per_30_hari", drill: ["ruang", "dokter", "penjamin", "bulan"] }),
  def("kunjungan_igd", "Kunjungan IGD", "layanan", "kunjungan", "Pendaftaran IGD (tanggal daftar dalam periode), tanpa kunjungan batal.", { skala: "per_30_hari", drill: ["dokter", "penjamin", "bulan"] }),
  def("bor", "BOR", "layanan", "%", "HP / (TT × hari periode) × 100%", { acuan: { min: 60, maks: 85 }, desimal: 1 }),
  def("alos", "ALOS", "layanan", "hari", "Lama dirawat pasien keluar / pasien keluar (hidup + mati)", { acuan: { min: 6, maks: 9 }, desimal: 1 }),
  def("toi", "TOI", "layanan", "hari", "(TT × hari periode − HP) / pasien keluar (hidup + mati)", { acuan: { min: 1, maks: 3 }, desimal: 1 }),
  def("bto", "BTO", "layanan", "kali", "Pasien keluar (hidup + mati) / TT", { skala: "per_30_hari", acuan: { min: 3.3, maks: 4.1 }, desimal: 1 }),
  def("gdr", "GDR", "layanan", "‰", "Pasien keluar mati / pasien keluar (hidup + mati) × 1000", { acuan: { min: null, maks: 45 }, desimal: 1 }),
  def("ndr", "NDR", "layanan", "‰", "Pasien keluar mati ≥ 48 jam / pasien keluar (hidup + mati) × 1000", { acuan: { min: null, maks: 25 }, desimal: 1 }),
  def("waktu_tunggu_rj", "Waktu tunggu rawat jalan", "layanan", "menit", "Rata-rata (waktu mulai diperiksa − waktu check-in; tanpa check-in memakai waktu daftar) kunjungan rawat jalan yang sudah diperiksa; selisih negatif atau > 24 jam diabaikan.", { acuan: { min: null, maks: 60 }, drill: ["poli", "dokter"], desimal: 0 }),
  // Keuangan
  def("pendapatan", "Pendapatan (tagihan)", "keuangan", "Rp", "Jumlah grand total tagihan yang dibuat dalam periode.", { skala: "per_30_hari", drill: ["unit", "penjamin", "bulan"] }),
  def("kas_diterima", "Kas diterima", "keuangan", "Rp", "Jumlah pembayaran kasir (riwayat pembayaran) yang dicatat dalam periode.", { skala: "per_30_hari", drill: ["metode", "bulan"] }),
  def("piutang", "Piutang tagihan", "keuangan", "Rp", "Sisa tagihan belum lunas yang dibuat dalam periode (grand total − pembayaran tercatat).", { drill: ["bulan", "penjamin"] }),
  def("sep_bpjs", "SEP BPJS terbit", "keuangan", "SEP", "Jumlah SEP VClaim berstatus aktif dengan tanggal SEP dalam periode (dasar klaim; status klaim belum tersedia).", { skala: "per_30_hari", drill: ["bulan", "jenis_pelayanan"] }),
  // Mutu (modul Mutu & Akreditasi, STD-0028)
  def("kesiapan_akreditasi", "Kesiapan akreditasi", "mutu", "%", "Elemen penilaian instrumen aktif yang memiliki bukti dokumen disahkan / seluruh elemen × 100% (posisi saat ini).", { acuan: { min: 80, maks: null }, desimal: 1 }),
  def("kredensial_kedaluwarsa", "Kredensial staf kedaluwarsa", "mutu", "dokumen", "Kredensial staf aktif (STR/SIP/sertifikat/RKK/SPK) yang tanggal berakhirnya sudah lewat (posisi saat ini).", { acuan: { min: null, maks: 0 } }),
  // SDM
  def("jumlah_pegawai", "Pegawai aktif", "sdm", "orang", "Pegawai berstatus aktif di Data Master (posisi saat ini).", { drill: ["tipe"] }),
  def("rasio_nakes_tt", "Rasio tenaga kesehatan per TT", "sdm", "nakes/TT", "Pegawai aktif bertipe tenaga kesehatan / TT.", { desimal: 2 }),
]);

// Indikator yang diminta tetapi sumbernya belum ada di OpenSIMRS: ditampilkan "belum tersedia" (tidak dikarang).
export const INDIKATOR_BELUM_TERSEDIA = Object.freeze([
  { kode: "klaim_bpjs_status", nama: "Klaim BPJS diajukan/disetujui/pending", kelompok: "keuangan", alasan: "Belum ada modul e-Klaim/INA-CBG yang mencatat status pengajuan klaim; yang tersedia baru penerbitan SEP." },
  { kode: "target_anggaran", nama: "Realisasi terhadap anggaran", kelompok: "keuangan", alasan: "Belum ada modul anggaran; gunakan target KPI per faskes sebagai pembanding." },
  { kode: "inm", nama: "Indikator Nasional Mutu (INM)", kelompok: "mutu", alasan: "Modul Mutu belum memiliki pencatatan indikator mutu (baru dokumen akreditasi & kredensial)." },
  { kode: "ikp", nama: "Insiden keselamatan pasien", kelompok: "mutu", alasan: "Belum ada modul pelaporan insiden keselamatan pasien." },
  { kode: "kepuasan_pasien", nama: "Kepuasan pasien", kelompok: "mutu", alasan: "Belum ada modul survei kepuasan pasien." },
  { kode: "kehadiran_pegawai", nama: "Kehadiran pegawai", kelompok: "sdm", alasan: "Belum ada modul presensi/kehadiran pegawai." },
]);

export const cariIndikator = (kode) => KATALOG_INDIKATOR.find((i) => i.kode === kode) ?? null;

const angka = (x) => (x === null || x === undefined || x === "" ? null : Number.isFinite(Number(x)) ? Number(x) : null);

// Pembagian aman: pembagi 0/kosong → null (belum dapat dihitung).
export const bagiAman = (pembilang, penyebut) => {
  const a = angka(pembilang);
  const b = angka(penyebut);
  if (a === null || b === null || b === 0) return null;
  return a / b;
};

export const bulatkan = (x, desimal = 1) => {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  const f = 10 ** desimal;
  return Math.round(x * f) / f;
};

// Jumlah hari kalender periode (tanggal awal & akhir ikut dihitung). Tanggal berformat YYYY-MM-DD.
export const hariPeriode = (mulai, selesai) => {
  const a = Date.parse(`${mulai}T00:00:00Z`);
  const b = Date.parse(`${selesai}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
};

const geserTanggal = (tanggal, hari) => new Date(Date.parse(`${tanggal}T00:00:00Z`) + hari * 86400000).toISOString().slice(0, 10);

// Periode pembanding: rentang dengan panjang sama tepat sebelum periode terpilih.
export const periodeSebelumnya = (mulai, selesai) => {
  const t = hariPeriode(mulai, selesai);
  return { mulai: geserTanggal(mulai, -t), selesai: geserTanggal(mulai, -1) };
};

// Komponen → indikator rawat inap (Barber-Johnson).
export const hitungIndikatorRawatInap = ({ hariPerawatan, tempatTidur, hari, keluar, lamaDirawat, mati, mati48 }) => {
  const HP = angka(hariPerawatan) ?? 0;
  const TT = angka(tempatTidur) ?? 0;
  const t = angka(hari) ?? 0;
  const D = angka(keluar) ?? 0;
  const kapasitas = TT * t;
  const bor = bagiAman(HP * 100, kapasitas);
  const alos = bagiAman(lamaDirawat, D);
  const toi = kapasitas > 0 ? bagiAman(kapasitas - HP, D) : null;
  const bto = bagiAman(D, TT);
  const gdr = bagiAman((angka(mati) ?? 0) * 1000, D);
  const ndr = bagiAman((angka(mati48) ?? 0) * 1000, D);
  return { bor, alos, toi, bto, gdr, ndr };
};

// Hari perawatan & lama dirawat per pasien dari tanggal lokal (YYYY-MM-DD). Dipakai uji unit untuk memastikan
// aturan yang sama dengan kueri SQL (hari masuk dihitung, hari keluar tidak; masuk = keluar → 1 hari).
export const hariPerawatanPasien = ({ masuk, keluar = null }, mulai, selesai) => {
  const t = hariPeriode(mulai, selesai);
  if (!t || !masuk) return 0;
  const awal = Math.max(Date.parse(`${masuk}T00:00:00Z`), Date.parse(`${mulai}T00:00:00Z`));
  const batasAkhir = Date.parse(`${selesai}T00:00:00Z`) + 86400000; // eksklusif
  const akhirPasien = keluar ? Date.parse(`${keluar}T00:00:00Z`) : batasAkhir;
  if (keluar && keluar === masuk) return masuk >= mulai && masuk <= selesai ? 1 : 0;
  const hari = Math.round((Math.min(akhirPasien, batasAkhir) - awal) / 86400000);
  return Math.max(0, hari);
};

export const lamaDirawatPasien = ({ masuk, keluar }) => {
  if (!masuk || !keluar) return null;
  const hari = Math.round((Date.parse(`${keluar}T00:00:00Z`) - Date.parse(`${masuk}T00:00:00Z`)) / 86400000);
  if (hari < 0) return null;
  return hari === 0 ? 1 : hari;
};

// Target faskes yang berlaku untuk periode: indikator berskala per_30_hari disesuaikan dengan panjang periode.
export const targetBerlaku = (target, indikator, hari) => {
  if (!target) return null;
  const min = angka(target.target_min);
  const maks = angka(target.target_maks);
  if (min === null && maks === null) return null;
  const faktor = indikator?.skala === "per_30_hari" ? (angka(hari) ?? 30) / 30 : 1;
  return {
    min: min === null ? null : min * faktor,
    maks: maks === null ? null : maks * faktor,
    toleransi_persen: angka(target.toleransi_persen) ?? 10,
    disesuaikan_periode: faktor !== 1,
  };
};

// Warna status KPI: hijau = dalam rentang target; kuning = di luar rentang tetapi masih dalam toleransi (persen dari
// batas yang dilanggar); merah = di luar toleransi. Tanpa target atau nilai → null (tanpa warna, KT-8).
export const statusTarget = (nilai, berlaku) => {
  const v = angka(nilai);
  if (v === null || !berlaku) return null;
  const { min, maks } = berlaku;
  if (min === null && maks === null) return null;
  const tol = Math.max(0, angka(berlaku.toleransi_persen) ?? 10) / 100;
  if (min !== null && v < min) return v >= min - Math.abs(min) * tol ? "kuning" : "merah";
  if (maks !== null && v > maks) return v <= maks + Math.abs(maks) * tol ? "kuning" : "merah";
  return "hijau";
};

// Perubahan relatif terhadap periode pembanding (persen). Pembanding 0/kosong → null.
export const perubahanPersen = (sekarang, sebelumnya) => {
  const a = angka(sekarang);
  const b = angka(sebelumnya);
  if (a === null || b === null || b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
};
