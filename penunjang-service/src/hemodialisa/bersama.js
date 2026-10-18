import { Galat, permintaanSalah } from "../umum/respons.js";

// Konstanta & helper bersama modul Unit Hemodialisa (STD-0033). Fungsi murni di sini diuji di
// test/hemodialisa-bersama.test.js (tanpa database).

export const TZ = "Asia/Jakarta";
export const JENIS_HD = ["akut", "kronis"];
export const POLA_JADWAL = ["satu_kali", "rutin"];
export const STATUS_JADWAL = ["terjadwal", "hadir", "berjalan", "selesai", "batal"];
export const STATUS_SESI = ["asesmen", "berjalan", "selesai", "batal"];
export const STATUS_MESIN = ["aktif", "perawatan", "nonaktif"];
// Jadwal rutin dibuat paling jauh 13 minggu (± satu triwulan) per permintaan agar tidak membentuk ratusan baris sekaligus.
export const MAKS_HARI_RUTIN = 91;

// Skema parameter intradialitik (kontrak manual & HDIS). Satuan ditetapkan sistem sehingga setiap nilai tersimpan bersama
// satuannya (KT-6). Rentang di bawah hanya batas kewajaran input/fisik (menolak salah ketik/satuan keliru), BUKAN ambang
// klinis: SIMRS tidak menilai normal/abnormal maupun memberi peringatan klinis (non-tujuan PRD §2).
export const PARAMETER = {
  td_sistolik: { label: "TD sistolik", satuan: "mmHg", min: 0, maks: 350 },
  td_diastolik: { label: "TD diastolik", satuan: "mmHg", min: 0, maks: 250 },
  nadi: { label: "Nadi", satuan: "x/menit", min: 0, maks: 300 },
  suhu: { label: "Suhu", satuan: "°C", min: 25, maks: 45 },
  napas: { label: "Frekuensi napas", satuan: "x/menit", min: 0, maks: 80 },
  spo2: { label: "SpO2", satuan: "%", min: 0, maks: 100 },
  qb_ml_menit: { label: "QB", satuan: "mL/menit", min: 0, maks: 1000 },
  qd_ml_menit: { label: "QD", satuan: "mL/menit", min: 0, maks: 1500 },
  uf_volume_ml: { label: "Volume UF", satuan: "mL", min: 0, maks: 10000 },
  uf_rate_ml_jam: { label: "Laju UF", satuan: "mL/jam", min: 0, maks: 5000 },
  tmp_mmhg: { label: "TMP", satuan: "mmHg", min: -500, maks: 800 },
  tekanan_arteri_mmhg: { label: "Tekanan arteri", satuan: "mmHg", min: -500, maks: 500 },
  tekanan_vena_mmhg: { label: "Tekanan vena", satuan: "mmHg", min: -500, maks: 600 },
  konduktivitas_ms_cm: { label: "Konduktivitas", satuan: "mS/cm", min: 0, maks: 30 },
  suhu_dialisat: { label: "Suhu dialisat", satuan: "°C", min: 20, maks: 45 },
  heparin_ml_jam: { label: "Heparin", satuan: "mL/jam", min: 0, maks: 100 },
};

// Kategori keluhan/komplikasi intradialitik untuk pencatatan & laporan (bukan diagnosis otomatis).
export const KOMPLIKASI = {
  hipotensi: "Hipotensi",
  hipertensi: "Hipertensi",
  kram: "Kram otot",
  mual_muntah: "Mual/muntah",
  sakit_kepala: "Sakit kepala",
  nyeri_dada: "Nyeri dada",
  gatal: "Gatal",
  demam_menggigil: "Demam/menggigil",
  sesak: "Sesak napas",
  masalah_akses: "Masalah akses vaskular",
  pembekuan_sirkuit: "Pembekuan sirkuit",
  lainnya: "Lainnya",
};

export const teks = (v, maks = 2000) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, maks) : null;
};

export const pilihan = (v, daftar, nama) => {
  if (!daftar.includes(v)) throw permintaanSalah(`${nama} harus salah satu: ${daftar.join(", ")}`);
  return v;
};

export const tanggalValid = (t, nama = "tanggal") => {
  const s = String(t ?? "");
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null;
  if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw permintaanSalah(`${nama} harus berformat YYYY-MM-DD`);
  return s;
};

export const jamValid = (j, nama) => {
  const s = String(j ?? "");
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(s)) throw permintaanSalah(`${nama} harus berformat HH:MM`);
  return s.slice(0, 5);
};

export const hariIni = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
export const tambahHari = (tanggal, n) => {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Angka wajib (atau opsional bila `wajibIsi` false) dalam rentang [min, maks].
export const angka = (v, nama, { min = -Infinity, maks = Infinity, bulat = false, wajibIsi = true } = {}) => {
  if (v === undefined || v === null || v === "") {
    if (wajibIsi) throw permintaanSalah(`${nama} wajib diisi`);
    return null;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || (bulat && !Number.isInteger(n))) throw permintaanSalah(`${nama} harus berupa angka${bulat ? " bulat" : ""}`);
  if (n < min || n > maks) throw permintaanSalah(`${nama} harus di antara ${min} dan ${maks}`);
  return n;
};

// Epoch detik (atau string tanggal-waktu ISO) → epoch detik; menolak waktu lebih dari 10 menit di masa depan.
export const waktuUkur = (v, nama = "waktu_pengukuran") => {
  if (v === undefined || v === null || v === "") throw permintaanSalah(`${nama} wajib diisi`);
  const n = Number(v);
  const e = Number.isFinite(n) ? Math.trunc(n) : Math.floor(Date.parse(String(v)) / 1000);
  if (!Number.isFinite(e) || e < 1e9) throw permintaanSalah(`${nama} harus berupa epoch detik`);
  if (e > Math.floor(Date.now() / 1000) + 600) throw permintaanSalah(`${nama} tidak boleh di masa depan`);
  return e;
};

/**
 * Normalisasi parameter intradialitik → { kode: { nilai, satuan } }. Parameter di luar skema, nilai bukan angka, satuan
 * yang berbeda dari skema, atau nilai di luar batas kewajaran → galat 400 (KT-9: pesan tidak mengubah catatan klinis).
 * Masukan boleh berupa angka langsung ({ nadi: 80 }) atau objek ({ nadi: { nilai: 80, satuan: "x/menit" } }).
 */
export const normalisasiParameter = (parameter) => {
  if (!parameter || typeof parameter !== "object" || Array.isArray(parameter)) throw permintaanSalah("parameter harus berupa objek");
  const kode = Object.keys(parameter);
  if (!kode.length) throw permintaanSalah("parameter minimal berisi satu pengukuran");
  const hasil = {};
  for (const k of kode) {
    const def = PARAMETER[k];
    if (!def) throw permintaanSalah(`Parameter "${k}" tidak dikenal (lihat GET /hemodialisa/referensi)`);
    const v = parameter[k];
    const objek = v !== null && typeof v === "object";
    const mentah = objek ? v.nilai : v;
    if (objek && v.satuan !== undefined && v.satuan !== def.satuan) throw permintaanSalah(`Satuan ${def.label} harus ${def.satuan}`);
    const n = Number(mentah);
    if (mentah === null || mentah === undefined || mentah === "" || typeof mentah === "boolean" || !Number.isFinite(n)) throw permintaanSalah(`Nilai ${def.label} harus berupa angka`);
    if (n < def.min || n > def.maks) throw permintaanSalah(`Nilai ${def.label} di luar batas kewajaran input (${def.min}–${def.maks} ${def.satuan})`);
    hasil[k] = { nilai: n, satuan: def.satuan };
  }
  return hasil;
};

export const normalisasiKomplikasi = (v) => {
  if (v === undefined || v === null || v === "") return [];
  const daftar = Array.isArray(v) ? v : [v];
  for (const k of daftar) if (!KOMPLIKASI[k]) throw permintaanSalah(`Komplikasi "${k}" tidak dikenal; pilih: ${Object.keys(KOMPLIKASI).join(", ")}`);
  return [...new Set(daftar)];
};

// Daftar tanggal jadwal rutin: setiap tanggal di [mulai, selesai] yang hari ISO-nya (1 = Senin … 7 = Minggu) ada di `hari`.
export const tanggalRutin = (hari, mulai, selesai) => {
  const daftarHari = [...new Set((Array.isArray(hari) ? hari : []).map(Number))];
  if (!daftarHari.length || daftarHari.some((h) => !Number.isInteger(h) || h < 1 || h > 7)) throw permintaanSalah("hari harus berisi angka 1 (Senin) sampai 7 (Minggu)");
  tanggalValid(mulai, "tanggal_mulai");
  tanggalValid(selesai, "tanggal_selesai");
  if (selesai < mulai) throw permintaanSalah("tanggal_selesai tidak boleh sebelum tanggal_mulai");
  if (selesai > tambahHari(mulai, MAKS_HARI_RUTIN - 1)) throw permintaanSalah(`Periode jadwal rutin maksimal ${MAKS_HARI_RUTIN} hari per pembuatan`);
  const hasil = [];
  for (let t = mulai; t <= selesai; t = tambahHari(t, 1)) {
    const iso = ((new Date(`${t}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    if (daftarHari.includes(iso)) hasil.push(t);
  }
  if (!hasil.length) throw permintaanSalah("Tidak ada tanggal yang cocok dengan hari terpilih pada periode tersebut");
  return hasil;
};

// Batas pemakaian dializer (KT-14): `jumlah_pakai` = pemakaian yang sudah tercatat (pemakaian pertama termasuk);
// boleh dipakai lagi bila aktif dan jumlah_pakai < pemakaian_maksimal. Batas diambil dari aturan faskes (datamaster).
export const cekBatasDializer = (d) => {
  if (!d) return { boleh: false, alasan: "Dializer tidak ditemukan" };
  if (d.status !== "aktif") return { boleh: false, alasan: `Dializer ${d.serial} sudah dihentikan${d.alasan_berhenti ? `: ${d.alasan_berhenti}` : ""}` };
  if (Number(d.jumlah_pakai) >= Number(d.pemakaian_maksimal)) {
    return { boleh: false, alasan: `Dializer ${d.serial} sudah mencapai batas pemakaian (${d.jumlah_pakai}/${d.pemakaian_maksimal})` };
  }
  return { boleh: true, pemakaian_ke: Number(d.jumlah_pakai) + 1 };
};

export const METODE_ADEKUASI = "Daugirdas generasi kedua single-pool (Kt/V) & URR — bawaan, perlu disahkan tenaga klinis";

/**
 * Kt/V single-pool Daugirdas generasi kedua & URR dari BUN pra/pasca, durasi (jam), UF (liter), dan berat pasca-HD (kg).
 * Formula bawaan ini perlu ditinjau dan disahkan dokter konsultan ginjal-hipertensi (dokumen desain STD-0033 §9) — hasil
 * ditandai "perlu tinjauan" di respons & UI, sama seperti skor SOFA di ICU. Masukan tidak lengkap/tidak masuk akal →
 * status belum_tersedia beserta alasannya (KT-12), tidak mengarang nilai.
 */
export const hitungAdekuasi = ({ bun_pre, bun_post, durasi_jam, uf_liter, berat_pasca_kg } = {}) => {
  const input = { bun_pre, bun_post, durasi_jam, uf_liter, berat_pasca_kg };
  const kurang = Object.entries(input).filter(([, v]) => v === undefined || v === null || v === "" || !Number.isFinite(Number(v))).map(([k]) => k);
  if (kurang.length) return { status: "belum_tersedia", alasan: `Data belum lengkap: ${kurang.join(", ")}`, input };
  const pre = Number(bun_pre);
  const post = Number(bun_post);
  const jam = Number(durasi_jam);
  const uf = Number(uf_liter);
  const berat = Number(berat_pasca_kg);
  if (pre <= 0 || post <= 0 || jam <= 0 || berat <= 0 || uf < 0) return { status: "belum_tersedia", alasan: "BUN, durasi, dan berat harus lebih dari 0; UF tidak boleh negatif", input };
  if (post >= pre) return { status: "belum_tersedia", alasan: "BUN pasca-HD harus lebih rendah dari BUN pra-HD", input };
  const r = post / pre;
  const dalamLog = r - 0.008 * jam;
  if (dalamLog <= 0) return { status: "belum_tersedia", alasan: "Kombinasi BUN dan durasi di luar jangkauan formula", input };
  const ktv = -Math.log(dalamLog) + (4 - 3.5 * r) * (uf / berat);
  const urr = (1 - r) * 100;
  return {
    status: "tersedia",
    metode: METODE_ADEKUASI,
    kt_v: Math.round(ktv * 100) / 100,
    urr: Math.round(urr * 100) / 100,
    input: { bun_pre: pre, bun_post: post, durasi_jam: jam, uf_liter: uf, berat_pasca_kg: berat },
  };
};

// Pelanggaran unique index → pesan ramah (409). Galat lain diteruskan.
export const ramah = (e, pesan) => {
  if (e?.code === "23505") throw new Galat(409, pesan);
  throw e;
};

// Kunci idempoten pengiriman jadwal ke HDIS: berubah bila slot/status jadwal berubah (kolom versi dinaikkan saat
// pindah/batal), tetap sama pada percobaan ulang. Tidak memakai updated_at karena dua perubahan dalam detik yang sama
// akan menghasilkan kunci kembar.
export const kunciKirimJadwal = (jadwal) => `jadwal:${jadwal.uuid}:v${Number(jadwal.versi ?? 1)}`;
