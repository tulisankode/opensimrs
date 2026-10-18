import { Galat, permintaanSalah } from "../umum/respons.js";

// Konstanta & helper bersama modul Sarana dan Prasarana / IPSRS (STD-0022). Fungsi murni (tanpa database) agar
// dapat diuji unit (test/sarpras-bersama.test.js).
//
// Waktu disimpan sebagai epoch detik. Tanggal jadwal (pemeliharaan, kalibrasi, masa berlaku) dihitung per hari
// kalender Asia/Jakarta (WIB, UTC+7, tanpa DST): tanggal disimpan sebagai awal hari WIB (00.00 WIB), "terlambat" /
// "kedaluwarsa" baru berlaku setelah hari tersebut lewat, sehingga hasilnya tidak bergantung zona waktu server.

export const konflik = (pesan) => new Galat(409, pesan);

export const KATEGORI_ASET = { alat_medis: "Alat Medis", non_medis: "Nonmedis", gedung_utilitas: "Gedung/Utilitas", kendaraan: "Kendaraan" };
export const STATUS_ASET = { aktif: "Aktif", rusak: "Rusak", dalam_perbaikan: "Dalam Perbaikan", dihapuskan: "Dihapuskan" };
export const STATUS_LAPORAN = {
  baru: "Baru",
  diproses: "Diproses",
  menunggu_suku_cadang: "Menunggu Suku Cadang",
  selesai: "Selesai",
  tidak_dapat_diperbaiki: "Tidak Dapat Diperbaiki",
};
export const PRIORITAS = { darurat: "Darurat", tinggi: "Tinggi", sedang: "Sedang", rendah: "Rendah" };
export const FREKUENSI = { harian: "Harian", mingguan: "Mingguan", bulanan: "Bulanan", tahunan: "Tahunan" };
export const HASIL_KALIBRASI = { lulus: "Lulus", tidak_lulus: "Tidak Lulus", perlu_tindak_lanjut: "Perlu Tindak Lanjut" };
export const JENIS_UTILITAS = { listrik: "Listrik", air: "Air", genset: "Genset", oksigen_sentral: "Oksigen Sentral" };
export const STATUS_JADWAL = { aktif: "Aktif", nonaktif: "Nonaktif" };
export const STATUS_KALIBRASI = {
  terjadwal: "Terjadwal",
  berlaku: "Berlaku",
  jatuh_tempo: "Mendekati Jatuh Tempo",
  kedaluwarsa: "Kedaluwarsa",
  tanpa_masa_berlaku: "Tanpa Masa Berlaku",
  digantikan: "Digantikan",
};

export const pilihan = (obj) => Object.entries(obj).map(([kode, nama]) => ({ kode, nama }));

// Nilai enum opsional: undefined → undefined (tidak diubah), "" / null → null, selain daftar → 400.
export const cekPilihan = (nilai, obj, nama) => {
  if (nilai === undefined) return undefined;
  if (nilai === null || nilai === "") return null;
  if (typeof nilai !== "string" || !Object.prototype.hasOwnProperty.call(obj, nilai)) throw permintaanSalah(`${nama} harus salah satu: ${Object.keys(obj).join(", ")}`);
  return nilai;
};
export const wajibPilihan = (nilai, obj, nama) => {
  const v = cekPilihan(nilai, obj, nama);
  if (!v) throw permintaanSalah(`${nama} wajib diisi`);
  return v;
};

// Teks opsional (dipangkas; "" → null; undefined dibiarkan) dengan batas panjang.
export const teks = (v, nama = "teks", maks = 5000) => {
  if (v === undefined) return undefined;
  if (v !== null && typeof v === "object") throw permintaanSalah(`${nama} harus berupa teks`);
  const t = String(v ?? "").trim() || null;
  if (t && t.length > maks) throw permintaanSalah(`${nama} maksimal ${maks} karakter`);
  return t;
};
export const teksWajib = (v, nama, maks = 5000) => {
  const t = teks(v, nama, maks);
  if (!t) throw permintaanSalah(`${nama} wajib diisi`);
  return t;
};

export const angkaOpsional = (v, nama, { min = 0, maks = 1e11 } = {}) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) throw permintaanSalah(`${nama} harus berupa angka`);
  if (n < min || n > maks) throw permintaanSalah(`${nama} harus di antara ${min} dan ${maks}`);
  return n;
};

export const bulatOpsional = (v, nama, batas) => {
  const n = angkaOpsional(v, nama, batas);
  if (n !== undefined && n !== null && !Number.isInteger(n)) throw permintaanSalah(`${nama} harus bilangan bulat`);
  return n;
};

export const boolOpsional = (v) => (v === undefined || v === null || v === "" ? undefined : v === true || v === "true" || v === 1 || v === "1");

// Epoch detik (bukan milidetik).
export const epochOpsional = (v, nama) => {
  const n = angkaOpsional(v, nama, { min: 0, maks: 1e11 });
  if (n === undefined || n === null) return n;
  if (!Number.isInteger(n) || n <= 0) throw permintaanSalah(`${nama} harus berupa waktu epoch detik`);
  return n;
};
export const epochWajib = (v, nama) => {
  const n = epochOpsional(v, nama);
  if (n === undefined || n === null) throw permintaanSalah(`${nama} wajib diisi`);
  return n;
};

// Filter periode ?tanggal_mulai=&tanggal_selesai= (epoch detik, inklusif).
export const periode = (q = {}, wajibIsi = false) => {
  const mulai = epochOpsional(q.tanggal_mulai || undefined, "tanggal_mulai");
  const selesai = epochOpsional(q.tanggal_selesai || undefined, "tanggal_selesai");
  if (wajibIsi && (!mulai || !selesai)) throw permintaanSalah("tanggal_mulai dan tanggal_selesai wajib diisi");
  if (mulai && selesai && mulai > selesai) throw permintaanSalah("Rentang tanggal tidak valid (tanggal_mulai > tanggal_selesai)");
  return { mulai: mulai ?? null, selesai: selesai ?? null };
};

// ── Waktu Asia/Jakarta
export const OFFSET_WIB = 7 * 3600;
export const HARI = 86400;
export const awalHariWib = (epoch) => Math.floor((Number(epoch) + OFFSET_WIB) / HARI) * HARI - OFFSET_WIB;
export const sekarangDetik = () => Math.floor(Date.now() / 1000);

// Jadwal berikutnya dari tanggal dasar (awal hari WIB): harian +1 hari, mingguan +7 hari, bulanan +1 bulan kalender,
// tahunan +1 tahun kalender. Tanggal yang tidak ada di bulan tujuan dibulatkan ke hari terakhir bulan itu
// (31 Jan → 28/29 Feb, 29 Feb → 28 Feb tahun berikutnya). Hasil = awal hari WIB.
export const tanggalBerikutnya = (epoch, frekuensi) => {
  if (!Object.prototype.hasOwnProperty.call(FREKUENSI, frekuensi)) throw permintaanSalah("frekuensi tidak valid");
  const dasar = awalHariWib(epoch);
  if (frekuensi === "harian") return dasar + HARI;
  if (frekuensi === "mingguan") return dasar + 7 * HARI;
  // Geser ke "jam dinding" WIB lalu hitung kalender memakai metode UTC (tanpa DST).
  const d = new Date((dasar + OFFSET_WIB) * 1000);
  const y = d.getUTCFullYear() + (frekuensi === "tahunan" ? 1 : 0);
  const m = d.getUTCMonth() + (frekuensi === "bulanan" ? 1 : 0);
  const akhirBulan = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(d.getUTCDate(), akhirBulan)) / 1000 - OFFSET_WIB;
};

// Status jadwal pemeliharaan aktif terhadap hari ini (WIB): terlambat bila hari jatuh tempo sudah lewat (KT-14),
// jatuh_tempo bila jatuh tempo hari ini, selain itu terjadwal.
export const statusJadwal = (tanggalJatuhTempo, sekarang = sekarangDetik()) => {
  const hariIni = awalHariWib(sekarang);
  const jt = awalHariWib(tanggalJatuhTempo);
  return jt < hariIni ? "terlambat" : jt === hariIni ? "jatuh_tempo" : "terjadwal";
};

// Pelaksanaan dianggap terlambat bila dilakukan setelah hari jatuh tempo jadwal (dibandingkan per hari WIB).
export const pelaksanaanTerlambat = (waktuMulai, tanggalJatuhTempo) => awalHariWib(waktuMulai) > awalHariWib(tanggalJatuhTempo);

// Status masa berlaku kalibrasi: kedaluwarsa bila hari terakhir berlaku sudah lewat (KT-18); jatuh_tempo bila
// tanggal berlaku dalam `ambang` hari ke depan (inklusif, KT-17); selain itu berlaku.
export const statusKalibrasi = (tanggalBerlaku, ambang, sekarang = sekarangDetik()) => {
  if (tanggalBerlaku === null || tanggalBerlaku === undefined || tanggalBerlaku === "") return "tanpa_masa_berlaku";
  const hariIni = awalHariWib(sekarang);
  const berlaku = awalHariWib(tanggalBerlaku);
  if (berlaku < hariIni) return "kedaluwarsa";
  if (berlaku <= hariIni + Number(ambang) * HARI) return "jatuh_tempo";
  return "berlaku";
};

// ── Work order (laporan kerusakan)
// baru → diproses (lewat penugasan teknisi); diproses ⇄ menunggu_suku_cadang;
// diproses | menunggu_suku_cadang → selesai | tidak_dapat_diperbaiki (penutupan). Status selesai/tidak_dapat_diperbaiki final.
export const TRANSISI_LAPORAN = {
  baru: ["diproses"],
  diproses: ["menunggu_suku_cadang", "selesai", "tidak_dapat_diperbaiki"],
  menunggu_suku_cadang: ["diproses", "selesai", "tidak_dapat_diperbaiki"],
  selesai: [],
  tidak_dapat_diperbaiki: [],
};
export const transisiLaporanSah = (dari, ke) => (TRANSISI_LAPORAN[dari] ?? []).includes(ke);
export const STATUS_LAPORAN_TERBUKA = ["baru", "diproses", "menunggu_suku_cadang"];

// Waktu respons = waktu penugasan teknisi pertama − waktu laporan (detik); null bila belum ditugaskan.
export const waktuRespons = (lapor, penugasan) => (penugasan === null || penugasan === undefined ? null : Number(penugasan) - Number(lapor));

// Aset berstatus "dihapuskan" final dan tidak menerima pekerjaan baru (KT-22).
export const transisiAsetSah = (dari, ke) => dari !== "dihapuskan" && dari !== ke && Object.prototype.hasOwnProperty.call(STATUS_ASET, ke);

// Checklist jadwal: larik teks (1–100 butir, tiap butir ≤ 200 karakter).
export const validasiChecklist = (v) => {
  if (!Array.isArray(v) || !v.length) throw permintaanSalah("checklist wajib berupa daftar butir pemeriksaan (minimal 1)");
  if (v.length > 100) throw permintaanSalah("checklist maksimal 100 butir");
  return v.map((x, i) => {
    const t = teks(typeof x === "object" && x !== null ? x.butir ?? x.item : x, `checklist butir ${i + 1}`, 200);
    if (!t) throw permintaanSalah(`checklist butir ${i + 1} wajib diisi`);
    return t;
  });
};

// Hasil checklist pelaksanaan: [{ butir, ok, catatan? }] (≤ 100 baris).
export const validasiChecklistHasil = (v) => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw permintaanSalah("checklist_hasil harus berupa daftar");
  if (v.length > 100) throw permintaanSalah("checklist_hasil maksimal 100 baris");
  return v.map((x, i) => {
    if (!x || typeof x !== "object") throw permintaanSalah(`checklist_hasil baris ${i + 1} tidak valid`);
    const butir = teks(x.butir ?? x.item, `checklist_hasil baris ${i + 1}`, 200);
    if (!butir) throw permintaanSalah(`butir checklist_hasil baris ${i + 1} wajib diisi`);
    return { butir, ok: x.ok === true || x.ok === "true", catatan: teks(x.catatan, "catatan checklist", 500) ?? null };
  });
};

// ── Berkas (foto kerusakan & sertifikat kalibrasi): PDF/JPG/PNG dikirim base64; tipe diperiksa dari isi (magic bytes).
export const TIPE_BERKAS = { "application/pdf": "PDF", "image/jpeg": "JPG", "image/png": "PNG" };
const cocokTipe = (buf, tipe) => {
  if (tipe === "application/pdf") return buf.subarray(0, 5).toString("latin1") === "%PDF-";
  if (tipe === "image/png") return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (tipe === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  return false;
};
export const validasiBerkas = (b, maksMb) => {
  const nama = teksWajib(b?.nama_berkas, "nama_berkas", 255);
  const tipe = String(b?.tipe_mime ?? "").toLowerCase();
  if (!TIPE_BERKAS[tipe]) throw permintaanSalah(`Tipe berkas harus salah satu: ${Object.values(TIPE_BERKAS).join(", ")}`);
  const mentah = String(b?.data_base64 ?? "").replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
  if (!mentah || !/^[A-Za-z0-9+/]+={0,2}$/.test(mentah)) throw permintaanSalah("data_base64 wajib berisi isi berkas (base64)");
  const data = Buffer.from(mentah, "base64");
  if (!data.length) throw permintaanSalah("Berkas kosong");
  if (data.length > maksMb * 1024 * 1024) throw permintaanSalah(`Ukuran berkas maksimal ${maksMb} MB`);
  if (!cocokTipe(data, tipe)) throw permintaanSalah(`Isi berkas tidak sesuai tipe ${TIPE_BERKAS[tipe]}`);
  return { nama_berkas: nama, tipe_mime: tipe, ukuran_bita: data.length, data };
};
