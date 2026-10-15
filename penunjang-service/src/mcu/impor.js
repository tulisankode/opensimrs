import express from "express";
import config from "../config.js";
import { query, satu } from "../db.js";
import { tangani, kirim, permintaanSalah } from "../umum/respons.js";
import { izinMcu } from "../umum/izin.js";
import { panggilLayanan } from "../umum/layanan.js";
import { tanggalValid, hariIni, JENIS_MCU, SQL_NAMA_DOKTER } from "./bersama.js";
import { katalogTarifLab } from "./lab.js";
import { ambilPerusahaanDaftar, daftarkanPeserta, sudahTerdaftar, ringkasPeserta } from "./daftar.js";

// Impor Excel rombongan MCU korporasi — jalur utama pendaftaran peserta perusahaan.
// Menerima format unggah massal adamLIS (sheet "Pasien": no_registrasi, nama, jenis_kelamin, jenis_identitas,
// no_identitas, tgl_lahir, no_rm, jenis_pasien, no_telp, alamat, provinsi, kabupaten, kecamatan, unit_asal,
// dokter_pengirim, penjamin, diagnosa_awal, icdt, paket_pemeriksaans, non_paket_pemeriksaans) maupun templat OpenSIMRS
// (kolom yang sama + NIK karyawan, jabatan, bagian, tanggal MCU). Header dicocokkan tanpa memedulikan kapital/spasi/
// tanda baca; nilai toleran (tanggal dd/mm/yyyy, yyyy-mm-dd, serial Excel, "12 Januari 1990"; NIK angka/teks).
//
// Alur: browser membaca file → kirim { header, baris } apa adanya → /pratinjau memvalidasi per baris (pasien lama/baru/
// galat + peringatan) → /simpan memvalidasi ulang, mendaftarkan pasien baru ke Admisi (per baris di server, aturan
// Admisi tetap berlaku), lalu mendaftarkan semua peserta valid dalam satu transaksi (order lab & radiologi otomatis).
const rute = express.Router();

const MAKS_BARIS = 1000;

// ── Kolom ────────────────────────────────────────────────────────────────────
const normKunci = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const KOLOM = {
  no_registrasi: ["noregistrasi", "noreg", "nomorregistrasi", "noregistrasieksternal", "nopendaftaran"],
  nama: ["nama", "namalengkap", "namapasien", "namapeserta", "namakaryawan"],
  jenis_kelamin: ["jeniskelamin", "jeniskelaminlp", "jk", "lp", "gender", "sex", "kelamin"],
  jenis_identitas: ["jenisidentitas", "identitas", "tipeidentitas"],
  no_identitas: ["noidentitas", "nik", "nikktp", "noktp", "ktp", "nomorktp", "nomoridentitas", "nopaspor", "nomornik"],
  tgl_lahir: ["tgllahir", "tanggallahir", "dob", "tanggallahirddmmyyyy", "tgllahirddmmyyyy", "lahir"],
  no_rm: ["norm", "nomorrm", "norekammedis", "nomorrekammedis", "rm"],
  jenis_pasien: ["jenispasien", "cito", "prioritas"],
  no_telp: ["notelp", "nohp", "telepon", "notelepon", "hp", "nomorhp", "handphone", "nohandphone", "nowa", "telp"],
  alamat: ["alamat", "alamatlengkap", "alamatdomisili"],
  provinsi: ["provinsi", "prov", "propinsi"],
  kabupaten: ["kabupaten", "kabupatenkota", "kota", "kab", "kabkota"],
  kecamatan: ["kecamatan", "kec"],
  unit_asal: ["unitasal", "poli", "unitpengirim"],
  dokter_pengirim: ["dokterpengirim", "dokter"],
  penjamin: ["penjamin", "asuransi", "carabayar"],
  diagnosa_awal: ["diagnosaawal", "diagnosa", "diagnosis", "keteranganklinis", "klinis"],
  icdt: ["icdt", "icd", "icd10", "kodeicd", "icdx"],
  paket: ["paketpemeriksaans", "paketpemeriksaan", "paket", "kodepaket", "paketmcu", "namapaket"],
  non_paket: ["nonpaketpemeriksaans", "nonpaketpemeriksaan", "pemeriksaantambahan", "tambahan", "nonpaket"],
  nik_karyawan: ["nikkaryawan", "nip", "idkaryawan", "nokaryawan", "nomorindukkaryawan", "npk", "nomorkaryawan"],
  jabatan: ["jabatan", "posisi"],
  bagian: ["bagian", "departemen", "bagiandepartemen", "divisi", "dept", "unitkerja", "departement"],
  tanggal_mcu: ["tanggalmcu", "tglmcu", "tanggalpemeriksaan", "tglpemeriksaan"],
};
const PETA_KOLOM = new Map(Object.entries(KOLOM).flatMap(([f, alias]) => alias.map((a) => [a, f])));

export const petaHeader = (header) => {
  const dikenali = {};
  const diabaikan = [];
  (header ?? []).forEach((h, i) => {
    const kunci = normKunci(h);
    if (!kunci || ["no", "nomor", "nourut"].includes(kunci)) return;
    const f = PETA_KOLOM.get(kunci);
    if (f && dikenali[f] === undefined) dikenali[f] = i;
    else if (String(h ?? "").trim()) diabaikan.push(String(h).trim());
  });
  return { dikenali, diabaikan };
};

// ── Nilai ────────────────────────────────────────────────────────────────────
const teks = (v) => (v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim());
const kosong = (v) => teks(v) === "" || teks(v) === "-";
const BULAN = { jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3, apr: 4, april: 4, mei: 5, may: 5,
  jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, agu: 8, agt: 8, agustus: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, nopember: 11, november: 11, des: 12, desember: 12, dec: 12, december: 12 };

const iso = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
const tahun4 = (y) => {
  const n = Number(y);
  if (String(y).length > 2) return n;
  const sekarangYY = new Date().getFullYear() % 100;
  return n > sekarangYY ? 1900 + n : 2000 + n;
};

// Tanggal toleran: serial Excel (angka), yyyy-mm-dd, dd/mm/yyyy, dd-mm-yyyy, dd.mm.yy, "12 Januari 1990", ISO datetime.
export const parseTanggal = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v < 1 || v > 80000) return null;
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const t = teks(v).toLowerCase();
  if (/^\d{4,5}(\.\d+)?$/.test(t)) return parseTanggal(Number(t));
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) return iso(tahun4(m[3]), Number(m[2]), Number(m[1]));
  m = t.match(/^(\d{1,2})[\s-]+([a-z]+)\.?[\s-]+(\d{2}|\d{4})$/);
  if (m && BULAN[m[2]]) return iso(tahun4(m[3]), BULAN[m[2]], Number(m[1]));
  return null;
};

const parseKelamin = (v) => {
  const t = normKunci(v);
  if (["l", "lk", "lakilaki", "laki", "pria", "male", "m", "1"].includes(t)) return "Male";
  if (["p", "pr", "perempuan", "wanita", "female", "f", "w", "2"].includes(t)) return "Female";
  return null;
};

const parseJenisIdentitas = (v, nomor) => {
  const t = normKunci(v);
  if (!t) return /^\d{16}$/.test(nomor) ? "KTP" : null;
  if (["ktp", "nik", "eKtp".toLowerCase()].includes(t)) return "KTP";
  if (["paspor", "passport", "pasport"].includes(t)) return "PASPOR";
  return "LAIN-LAIN";
};

// NIK/No. identitas: angka (Excel hanya menyimpan 15 digit signifikan → digit ke-16 bisa hilang) atau teks.
const parseNomorIdentitas = (v) => {
  if (v === null || v === undefined) return { nomor: "", dariAngka: false };
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return { nomor: "", dariAngka: true };
    return { nomor: BigInt(Math.round(v)).toString(), dariAngka: true };
  }
  let t = teks(v).replace(/^'+/, "");
  if (/^\d+(\.\d+)?e\+\d+$/i.test(t)) return { nomor: BigInt(Math.round(Number(t))).toString(), dariAngka: true };
  t = t.replace(/[\s.\-]/g, "");
  return { nomor: t.toUpperCase(), dariAngka: false };
};

export const parseTelp = (v) => {
  let t = typeof v === "number" ? String(Math.round(v)) : teks(v);
  t = t.replace(/[^\d+]/g, "");
  if (t.startsWith("+62")) t = "0" + t.slice(3);
  else if (t.startsWith("62") && t.length > 10) t = "0" + t.slice(2);
  else if (t.startsWith("8") && t.length >= 9) t = "0" + t;
  return t.slice(0, 15);
};

const parseCito = (v) => /cito|ya|yes|true|1/i.test(teks(v)) && !/reguler|tidak|no|false/i.test(teks(v));
const pecah = (v) =>
  teks(v)
    .split(/[;,|\n]+/)
    .map((x) => x.trim())
    .filter((x) => x && x !== "-");

// Nama dibandingkan tanpa gelar, kapital & tanda baca.
const normNama = (s) =>
  ` ${String(s ?? "").toLowerCase().replace(/[.,]/g, " ")} `
    .replace(/\s(dr|drg|prof|h|hj|ir|sp\s?\w+|m\s?kes|mars|sked|ns|amd|s\s?\w{1,4})(?=\s)/g, " ")
    .replace(/[^a-z0-9]/g, "");

// ── Wilayah ──────────────────────────────────────────────────────────────────
const judul = (s) => String(s ?? "").toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
const namaProvinsi = (n) => (/^dki /i.test(n) ? `DKI ${judul(n.slice(4))}` : judul(n));
const namaKabupaten = (n) => {
  const t = String(n ?? "").trim();
  if (/^kota\s/i.test(t)) return `Kota ${judul(t.replace(/^kota\s+/i, ""))}`;
  return `Kabupaten ${judul(t.replace(/^kab\.?\s+/i, ""))}`;
};
const normProv = (s) =>
  normKunci(
    String(s ?? "")
      .toLowerCase()
      .replace(/^provinsi\s+/, "")
      .replace(/daerah khusus ibu ?kota/, "dki")
      .replace(/^di\s+yogyakarta/, "daerah istimewa yogyakarta"),
  );
const jenisKab = (s) => {
  const t = String(s ?? "").trim().toLowerCase();
  if (/^kota\b/.test(t)) return "kota";
  if (/^(kabupaten|kab\.?)\b/.test(t)) return "kab";
  return null;
};
const normKab = (s) => normKunci(String(s ?? "").toLowerCase().replace(/^(kabupaten|kab\.?|kota)\s*/, ""));

let wilayahCache = null;
const muatWilayah = async () => {
  if (wilayahCache) return wilayahCache;
  const [prov, kab, kec] = await Promise.all([
    query(`SELECT code, name FROM provinsi ORDER BY code`),
    query(`SELECT code, provinsi_code, name FROM kabupaten ORDER BY code`),
    query(`SELECT code, kabupaten_code, name FROM kecamatan ORDER BY code`),
  ]);
  wilayahCache = {
    provinsi: prov.map((p) => ({ code: p.code, nama: namaProvinsi(p.name), kunci: normProv(p.name) })),
    kabupaten: kab.map((k) => ({ code: k.code, prov: k.provinsi_code, nama: namaKabupaten(k.name), kunci: normKab(k.name), jenis: jenisKab(k.name) ?? "kab" })),
    kecamatan: kec.map((k) => ({ code: k.code, kab: k.kabupaten_code, nama: judul(k.name), kunci: normKunci(k.name) })),
  };
  return wilayahCache;
};

const cocokWilayah = (w, provinsi, kabupaten, kecamatan, peringatan) => {
  const hasil = { prov: "", city: "", district: "" };
  if (kosong(provinsi) && kosong(kabupaten) && kosong(kecamatan)) return hasil;
  let p = null;
  if (!kosong(provinsi)) {
    p = w.provinsi.find((x) => x.kunci === normProv(provinsi));
    if (!p) peringatan.push(`Provinsi "${teks(provinsi)}" tidak dikenali`);
  }
  let kb = null;
  if (!kosong(kabupaten)) {
    const jenis = jenisKab(kabupaten);
    const kandidat = w.kabupaten.filter((x) => x.kunci === normKab(kabupaten) && (!p || x.prov === p.code));
    kb = kandidat.find((x) => !jenis || x.jenis === jenis) ?? null;
    if (!kb && kandidat.length) kb = kandidat[0];
    if (!jenis && kandidat.length > 1) peringatan.push(`Kabupaten/kota "${teks(kabupaten)}" ambigu, dipakai ${kb.nama}`);
    if (!kb) peringatan.push(`Kabupaten/kota "${teks(kabupaten)}" tidak dikenali${p ? ` di ${p.nama}` : ""}`);
    if (kb && !p) p = w.provinsi.find((x) => x.code === kb.prov) ?? null;
  }
  if (!kosong(kecamatan) && kb) {
    const kc = w.kecamatan.find((x) => x.kab === kb.code && x.kunci === normKunci(kecamatan));
    if (kc) hasil.district = kc.code;
    else peringatan.push(`Kecamatan "${teks(kecamatan)}" tidak dikenali di ${kb.nama}`);
  }
  hasil.prov = p?.code ?? "";
  hasil.city = kb?.code ?? "";
  return hasil;
};

// ── Referensi faskes ─────────────────────────────────────────────────────────
const referensi = async (f) => {
  const [paket, unit, dokter, penjamin, tarifLab, radiologi] = await Promise.all([
    query(`SELECT uuid, kode, nama, jenis, harga::float8 AS harga, status FROM mcu_paket WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY kode`, [f]),
    query(
      `SELECT uuid, name AS nama, location_type FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND COALESCE(location_type, '') <> 'Bed'
        ORDER BY name`,
      [f],
    ),
    query(
      `SELECT pr.uuid, ${SQL_NAMA_DOKTER("pr.uuid")} AS nama FROM practitioner pr
        WHERE pr.faskes_uuid = $1 AND pr.is_doctor AND pr.deleted_at IS NULL ORDER BY 2`,
      [f],
    ),
    query(`SELECT uuid, name AS nama FROM penjamin WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status IS NOT FALSE ORDER BY name`, [f]),
    katalogTarifLab(f),
    query(
      `SELECT uuid, kode, nama, modalitas, harga::float8 AS harga FROM rad_pemeriksaan WHERE faskes_uuid = $1 AND status AND deleted_at IS NULL ORDER BY nama`,
      [f],
    ),
  ]);
  return { paket, unit, dokter, penjamin, tarifLab, radiologi };
};

const cariPaket = (ref, nilai) => {
  const k = normKunci(nilai);
  return ref.paket.find((p) => normKunci(p.kode) === k) ?? ref.paket.find((p) => normKunci(p.nama) === k) ?? null;
};
const cariNama = (daftar, nilai) => {
  const k = normKunci(nilai);
  return daftar.find((x) => normKunci(x.nama) === k) ?? null;
};
const cariDokter = (ref, nilai) => {
  const k = normNama(nilai);
  if (!k) return null;
  return ref.dokter.find((d) => normNama(d.nama) === k) ?? ref.dokter.find((d) => normNama(d.nama).includes(k) || k.includes(normNama(d.nama))) ?? null;
};
const UMUM = /^(umum|tunai|pribadi|mandiri|cash|tunaiumum|umumtunai|perusahaan)$/;
const cariPenjamin = (ref, nilai) => {
  const k = normKunci(nilai);
  const p = ref.penjamin.find((x) => normKunci(x.nama) === k);
  if (p) return p;
  if (UMUM.test(k)) return ref.penjamin.find((x) => /umum|tunai/i.test(x.nama)) ?? { uuid: null, nama: "Umum", umum: true };
  return ref.penjamin.find((x) => normKunci(x.nama).startsWith(k) || k.startsWith(normKunci(x.nama))) ?? null;
};
const cariTambahan = (ref, nilai) => {
  const k = normKunci(nilai);
  const lab = ref.tarifLab.find((t) => normKunci(t.kode) === k) ?? ref.tarifLab.find((t) => normKunci(t.nama) === k);
  if (lab) return { jenis: "lab", uuid: lab.uuid, kode: lab.kode, nama: lab.nama, harga: lab.harga, items: [...lab.items] };
  const rad = ref.radiologi.find((r) => normKunci(r.kode) === k) ?? ref.radiologi.find((r) => normKunci(r.nama) === k);
  if (rad) return { jenis: "radiologi", uuid: rad.uuid, kode: rad.kode, nama: rad.nama, modalitas: rad.modalitas, harga: rad.harga };
  return null;
};

// ICD-10 (tabel diagnosis: "Nama Inggris~Nama Indonesia"): cocok berdasarkan kode atau nama.
const cariIcd = async (nilai) => {
  const t = teks(nilai);
  if (!t || t === "-") return null;
  const kode = t.match(/^([A-Z]\d{2}(\.\d{1,2})?)\b/i)?.[1];
  if (kode) {
    const r = await satu(`SELECT code, name FROM diagnosis WHERE UPPER(code) = UPPER($1) AND deleted_at IS NULL LIMIT 1`, [kode]);
    if (r) return { code: r.code, nama: r.name.split("~")[0] };
  }
  const r = await satu(
    `SELECT code, name FROM diagnosis WHERE deleted_at IS NULL
        AND (UPPER(split_part(name, '~', 1)) = UPPER($1) OR UPPER(split_part(name, '~', 2)) = UPPER($1)) LIMIT 1`,
    [t],
  );
  return r ? { code: r.code, nama: r.name.split("~")[0] } : null;
};

// ── Validasi baris ───────────────────────────────────────────────────────────
// Body: { perusahaan_uuid, paket_uuid? (paket bawaan), tanggal? (bawaan hari ini), jenis_mcu?, header: [...],
//         baris: [[...], ...], nomor_baris?: [no. baris Excel] }
const validasi = async (req) => {
  const b = req.body ?? {};
  const f = req.author.faskesUuid;
  const perusahaan = await ambilPerusahaanDaftar(b.perusahaan_uuid, f);
  const tanggalBawaan = tanggalValid(b.tanggal || hariIni(), "tanggal");
  const jenisMcu = b.jenis_mcu || "berkala";
  if (!JENIS_MCU.includes(jenisMcu)) throw permintaanSalah(`jenis_mcu harus salah satu: ${JENIS_MCU.join(", ")}`);
  if (!Array.isArray(b.header) || !Array.isArray(b.baris)) throw permintaanSalah("Format data impor tidak valid (header & baris wajib)");
  const { dikenali, diabaikan } = petaHeader(b.header);
  if (dikenali.nama === undefined || (dikenali.no_identitas === undefined && dikenali.no_rm === undefined))
    throw permintaanSalah("Kolom wajib tidak ditemukan: file harus memuat kolom nama dan no_identitas/NIK (atau no_rm)");

  const ambil = (r, fld) => (dikenali[fld] === undefined ? undefined : r[dikenali[fld]]);
  const mentah = b.baris
    .map((r, i) => ({ r: Array.isArray(r) ? r : [], no: Number(b.nomor_baris?.[i]) || i + 2 }))
    .filter(({ r }) => r.some((c) => !kosong(c)));
  if (!mentah.length) throw permintaanSalah("File tidak berisi data peserta (tidak ada data). Isi sheet Pasien mulai baris 2.");
  if (mentah.length > MAKS_BARIS) throw permintaanSalah(`Maksimal ${MAKS_BARIS} baris per impor (file berisi ${mentah.length} baris)`);

  const ref = await referensi(f);
  const paketBawaan = b.paket_uuid ? ref.paket.find((p) => p.uuid === b.paket_uuid) : null;
  if (b.paket_uuid && !paketBawaan) throw permintaanSalah("Paket bawaan tidak ditemukan");
  const w = await muatWilayah();

  // Kumpulkan kunci pencocokan pasien sekaligus (efisien untuk ratusan baris).
  const baris = mentah.map(({ r, no }) => {
    const { nomor, dariAngka } = parseNomorIdentitas(ambil(r, "no_identitas"));
    return { no, r, nomor, dariAngka, noRm: teks(ambil(r, "no_rm")) };
  });
  const [pasienNik, pasienRm] = await Promise.all([
    query(
      `SELECT p.uuid, p.no_rm, p.name, p.gender, p.no_identity, p.status, bd.birth_date::text AS tgl_lahir FROM patients p
         LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
        WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.no_identity = ANY($2) AND p.no_rm NOT LIKE 'XX%'
        ORDER BY p.created_at`,
      [f, [...new Set(baris.map((x) => x.nomor).filter(Boolean))]],
    ),
    query(
      `SELECT p.uuid, p.no_rm, p.name, p.gender, p.no_identity, p.status, bd.birth_date::text AS tgl_lahir FROM patients p
         LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
        WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.no_rm = ANY($2)`,
      [f, [...new Set(baris.map((x) => x.noRm).filter(Boolean))]],
    ),
  ]);

  const nikDipakai = new Map();
  const regDipakai = new Map();
  const pasienDipakai = new Map();
  const hasil = [];
  for (const x of baris) {
    const { r, no, nomor, dariAngka } = x;
    const galat = [];
    const peringatan = [];
    const nama = teks(ambil(r, "nama"));
    if (!nama) galat.push("Nama wajib diisi");

    const jenisId = parseJenisIdentitas(ambil(r, "jenis_identitas"), nomor);
    if (nomor) {
      if (jenisId === "KTP" && !/^\d{16}$/.test(nomor)) galat.push(`NIK (KTP) harus 16 digit angka (terbaca "${nomor}", ${nomor.length} karakter)`);
      if (jenisId === "KTP" && dariAngka && /^\d{16}$/.test(nomor))
        peringatan.push("NIK tersimpan sebagai angka di Excel — pastikan digit terakhir benar (Excel hanya menyimpan 15 digit)");
      if (jenisId === "PASPOR" && !/^[A-Z]\d{8}$/.test(nomor)) galat.push("Nomor paspor harus 1 huruf diikuti 8 digit (aturan Admisi)");
      if (nikDipakai.has(nomor)) galat.push(`No. identitas ${nomor} duplikat dengan baris ${nikDipakai.get(nomor)}`);
      else nikDipakai.set(nomor, no);
    }

    const noReg = teks(ambil(r, "no_registrasi"));
    if (noReg) {
      if (regDipakai.has(noReg)) galat.push(`No. registrasi ${noReg} duplikat dengan baris ${regDipakai.get(noReg)}`);
      else regDipakai.set(noReg, no);
    }

    // Cocokkan pasien: No. RM lebih dulu, lalu No. identitas.
    let pasien = null;
    if (x.noRm) {
      pasien = pasienRm.find((p) => p.no_rm === x.noRm) ?? null;
      if (!pasien) peringatan.push(`No. RM ${x.noRm} tidak ditemukan; dicocokkan berdasarkan no. identitas`);
      else if (nomor && pasien.no_identity && pasien.no_identity !== nomor)
        peringatan.push(`No. identitas di file (${nomor}) berbeda dengan data pasien No. RM ${pasien.no_rm} (${pasien.no_identity})`);
    }
    if (!pasien && nomor) pasien = pasienNik.find((p) => p.no_identity === nomor) ?? null;
    if (!pasien && !nomor) galat.push("No. identitas (NIK) wajib diisi untuk pasien baru");
    if (pasien && pasien.status === false) galat.push(`Pasien ${pasien.no_rm} (${pasien.name}) berstatus non-aktif — aktifkan dulu di Admisi › Data Pasien`);
    if (pasien) {
      if (pasienDipakai.has(pasien.uuid)) galat.push(`Pasien ${pasien.no_rm} sudah ada di baris ${pasienDipakai.get(pasien.uuid)}`);
      else pasienDipakai.set(pasien.uuid, no);
      if (nama && normKunci(nama) !== normKunci(pasien.name)) peringatan.push(`Nama di file "${nama}" berbeda dengan data pasien "${pasien.name}" (data pasien tidak diubah)`);
    }

    const tglMentah = ambil(r, "tgl_lahir");
    const tglLahir = parseTanggal(tglMentah);
    const jk = parseKelamin(ambil(r, "jenis_kelamin"));
    if (!kosong(tglMentah) && !tglLahir) galat.push(`Tanggal lahir "${teks(tglMentah)}" tidak valid`);
    else if (tglLahir && (tglLahir > hariIni() || tglLahir < "1900-01-01")) galat.push(`Tanggal lahir ${tglLahir} di luar rentang wajar`);
    if (!pasien) {
      if (!tglLahir && kosong(tglMentah)) galat.push("Tanggal lahir wajib diisi untuk pasien baru");
      if (!jk) galat.push(kosong(ambil(r, "jenis_kelamin")) ? "Jenis kelamin wajib diisi untuk pasien baru" : `Jenis kelamin "${teks(ambil(r, "jenis_kelamin"))}" tidak dikenali (L/P)`);
      if (jenisId === "LAIN-LAIN") peringatan.push("Jenis identitas LAIN-LAIN: pasien baru dicatat dengan identitas 'Lainya'");
    } else if (tglLahir && pasien.tgl_lahir && String(pasien.tgl_lahir).slice(0, 10) !== tglLahir) {
      peringatan.push(`Tanggal lahir di file (${tglLahir}) berbeda dengan data pasien (${String(pasien.tgl_lahir).slice(0, 10)}) — data pasien tidak diubah`);
    }

    // Paket: kode / nama; satu paket per peserta.
    let paket = paketBawaan;
    const daftarPaket = pecah(ambil(r, "paket"));
    if (daftarPaket.length) {
      paket = cariPaket(ref, daftarPaket[0]);
      if (!paket) galat.push(`Paket "${daftarPaket[0]}" tidak ditemukan (gunakan kode/nama paket MCU)`);
      if (daftarPaket.length > 1) peringatan.push(`Lebih dari satu paket (${daftarPaket.join(", ")}); MCU memakai satu paket per peserta — dipakai ${daftarPaket[0]}`);
    } else if (!paket) galat.push("Paket kosong dan paket bawaan belum dipilih");
    if (paket && !paket.status) galat.push(`Paket ${paket.nama} tidak aktif`);
    if (paket && paket.jenis === "perorangan") galat.push(`Paket ${paket.nama} khusus MCU perorangan`);

    // Tanggal MCU per baris (opsional).
    let tanggal = tanggalBawaan;
    const tglMcu = ambil(r, "tanggal_mcu");
    if (!kosong(tglMcu)) {
      const t = parseTanggal(tglMcu);
      if (!t) galat.push(`Tanggal MCU "${teks(tglMcu)}" tidak valid`);
      else tanggal = t;
    }

    const unitTeks = teks(ambil(r, "unit_asal"));
    const unit = unitTeks && unitTeks !== "-" ? cariNama(ref.unit, unitTeks) : null;
    if (unitTeks && unitTeks !== "-" && !unit) peringatan.push(`Unit asal "${unitTeks}" tidak ada di master lokasi — diabaikan`);
    const dokterTeks = teks(ambil(r, "dokter_pengirim"));
    const dokter = dokterTeks && dokterTeks !== "-" ? cariDokter(ref, dokterTeks) : null;
    if (dokterTeks && dokterTeks !== "-" && !dokter) peringatan.push(`Dokter pengirim "${dokterTeks}" tidak ada di master dokter — diabaikan`);
    const penjaminTeks = teks(ambil(r, "penjamin"));
    const penjamin = penjaminTeks && penjaminTeks !== "-" ? cariPenjamin(ref, penjaminTeks) : null;
    if (penjaminTeks && penjaminTeks !== "-" && !penjamin) peringatan.push(`Penjamin "${penjaminTeks}" tidak ada di master penjamin — diabaikan (biaya MCU tetap ditagihkan ke perusahaan)`);

    const icdTeks = teks(ambil(r, "icdt"));
    const icd = icdTeks && icdTeks !== "-" ? await cariIcd(icdTeks) : null;
    if (icdTeks && icdTeks !== "-" && !icd) peringatan.push(`ICD-10 "${icdTeks}" tidak dikenali — disimpan sebagai teks`);

    const tambahan = [];
    for (const t of pecah(ambil(r, "non_paket"))) {
      const m = cariTambahan(ref, t);
      if (m) tambahan.push(m);
      else peringatan.push(`Pemeriksaan tambahan "${t}" tidak ditemukan di master tarif lab / radiologi — dilewati`);
    }

    const peringatanWilayah = [];
    const wilayah = pasien ? { prov: "", city: "", district: "" } : cocokWilayah(w, ambil(r, "provinsi"), ambil(r, "kabupaten"), ambil(r, "kecamatan"), peringatanWilayah);
    peringatan.push(...peringatanWilayah);

    hasil.push({
      no,
      status: galat.length ? "galat" : pasien ? "lama" : "baru",
      galat,
      peringatan,
      nama,
      jenis_kelamin: jk ?? pasien?.gender ?? null,
      jenis_identitas: jenisId,
      no_identitas: nomor || pasien?.no_identity || null,
      tgl_lahir: tglLahir ?? (pasien?.tgl_lahir ? String(pasien.tgl_lahir).slice(0, 10) : null),
      no_telp: parseTelp(ambil(r, "no_telp")),
      alamat: teks(ambil(r, "alamat")),
      wilayah,
      patient_uuid: pasien?.uuid ?? null,
      no_rm: pasien?.no_rm ?? null,
      nama_terdaftar: pasien?.name ?? null,
      no_registrasi: noReg || null,
      cito: parseCito(ambil(r, "jenis_pasien")),
      paket_uuid: paket?.uuid ?? null,
      kode_paket: paket?.kode ?? null,
      nama_paket: paket?.nama ?? null,
      tanggal,
      unit_asal_uuid: unit?.uuid ?? null,
      unit_asal: unit?.nama ?? null,
      dokter_pengirim_uuid: dokter?.uuid ?? null,
      dokter_pengirim: dokter?.nama ?? null,
      penjamin_uuid: penjamin?.uuid ?? null,
      penjamin: penjamin?.nama ?? null,
      diagnosa_awal: teks(ambil(r, "diagnosa_awal")) || null,
      icd10_code: icd?.code ?? null,
      icd10_nama: icd?.nama ?? (icdTeks && icdTeks !== "-" ? icdTeks : null),
      tambahan,
      nik_karyawan: teks(ambil(r, "nik_karyawan")) || null,
      jabatan: teks(ambil(r, "jabatan")) || null,
      bagian: teks(ambil(r, "bagian")) || null,
    });
  }

  // Pasien lama yang sudah terdaftar MCU pada tanggal yang sama.
  const lama = hasil.filter((h) => h.status === "lama");
  if (lama.length) {
    const sudah = await sudahTerdaftar(f, lama.map((h) => h.patient_uuid), [...new Set(lama.map((h) => h.tanggal))]);
    for (const h of lama) {
      const s = sudah.find((x) => x.patient_uuid === h.patient_uuid && x.tanggal === h.tanggal);
      if (s) {
        h.galat.push(`Sudah terdaftar MCU pada ${h.tanggal} (${s.no_mcu})`);
        h.status = "galat";
      }
    }
  }

  const ringkasan = {
    total: hasil.length,
    lama: hasil.filter((h) => h.status === "lama").length,
    baru: hasil.filter((h) => h.status === "baru").length,
    galat: hasil.filter((h) => h.status === "galat").length,
    peringatan: hasil.filter((h) => h.peringatan.length).length,
  };
  return { perusahaan, jenisMcu, kolom: { dikenali: Object.keys(dikenali), diabaikan }, baris: hasil, ringkasan };
};

rute.get(
  "/referensi",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const ref = await referensi(f);
    const w = await muatWilayah();
    const icd = ["1", "true"].includes(String(req.query.dengan_icd))
      ? (await query(`SELECT code, split_part(name, '~', 1) AS nama FROM diagnosis WHERE deleted_at IS NULL AND status IS NOT FALSE ORDER BY code`)).map(
          (d) => `${d.code} ${d.nama}`,
        )
      : undefined;
    kirim(res, {
      paket: ref.paket.filter((p) => p.status && p.jenis !== "perorangan"),
      unit_asal: ref.unit.map((u) => u.nama),
      dokter: ref.dokter.map((d) => d.nama),
      penjamin: ref.penjamin.map((p) => p.nama),
      tambahan: [
        ...ref.tarifLab.map((t) => ({ jenis: "Laboratorium", kode: t.kode, nama: t.nama, harga: t.harga })),
        ...ref.radiologi.map((r) => ({ jenis: "Radiologi", kode: r.kode, nama: r.nama, harga: r.harga })),
      ],
      wilayah: {
        provinsi: w.provinsi.map(({ code, nama }) => ({ code, nama })),
        kabupaten: w.kabupaten.map(({ code, prov, nama }) => ({ code, prov, nama })),
        kecamatan: w.kecamatan.map(({ code, kab, nama }) => ({ code, kab, nama })),
      },
      icd,
    });
  }),
);

rute.post(
  "/pratinjau",
  izinMcu("Peserta", "IMPOR"),
  tangani(async (req, res) => {
    const v = await validasi(req);
    kirim(res, { kolom: v.kolom, ringkasan: v.ringkasan, baris: v.baris });
  }),
);

// Admisi: daftarkan pasien baru (aturan & validasi Admisi), lalu ambil uuid-nya lewat no. identitas.
export const daftarkanPasienBaru = async (h, f, token) => {
  const umur = h.tgl_lahir ? (Date.now() - Date.parse(h.tgl_lahir)) / (365.25 * 864e5) : 30;
  const title = umur < 17 ? "An. (Anak)" : h.jenis_kelamin === "Male" ? "Tn. (Tuan)" : "Ny. (Nyonya)";
  const identity = h.jenis_identitas === "PASPOR" ? "Passport" : h.jenis_identitas === "LAIN-LAIN" ? "Lainya" : "KTP";
  await panggilLayanan(`${config.admisiUrl}/patient`, {
    method: "POST",
    token,
    nama: "Admisi",
    body: {
      title,
      name: h.nama,
      identity,
      no_identity: h.no_identitas,
      birth_detail: { birth_place: "", birth_date: h.tgl_lahir },
      gender: h.jenis_kelamin,
      phone: h.no_telp || "",
      religion: "",
      language: "ID",
      maritial_status: "",
      mother_name: "",
      address: {
        prov: h.wilayah?.prov || "",
        city: h.wilayah?.city || "",
        district: h.wilayah?.district || "",
        village: "",
        rt: "",
        rw: "",
        postal_code: "",
        full_address: (h.alamat || "").slice(0, 255),
        country: "id-ID",
      },
    },
  });
  const p = await satu(
    `SELECT uuid, no_rm, name FROM patients WHERE faskes_uuid = $1 AND no_identity = $2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    [f, h.no_identitas],
  );
  if (!p) throw new Error("Pasien tersimpan di Admisi tetapi tidak ditemukan kembali");
  return p;
};

rute.post(
  "/simpan",
  izinMcu("Peserta", "IMPOR"),
  tangani(async (req, res) => {
    const mulai = Date.now();
    const f = req.author.faskesUuid;
    const v = await validasi(req);
    const gagal = v.baris.filter((h) => h.status === "galat").map((h) => ({ ...h, alasan: h.galat.join("; ") }));
    const valid = v.baris.filter((h) => h.status !== "galat");
    if (!valid.length) throw permintaanSalah("Tidak ada baris valid untuk disimpan; perbaiki baris yang galat");

    // 1) Pasien baru → Admisi (per baris di server; nomor RM dibuat Admisi).
    const pasienBaru = [];
    const siap = [];
    for (const h of valid) {
      if (h.status === "lama") {
        siap.push({ ...h, pasien: { uuid: h.patient_uuid, no_rm: h.no_rm, name: h.nama_terdaftar } });
        continue;
      }
      try {
        const p = await daftarkanPasienBaru(h, f, req.author.token);
        pasienBaru.push({ no: h.no, no_rm: p.no_rm, nama: p.name });
        siap.push({ ...h, patient_uuid: p.uuid, pasien: p });
      } catch (e) {
        gagal.push({ ...h, status: "galat", alasan: `Pendaftaran pasien baru gagal: ${e.message}` });
      }
    }
    const waktuAdmisi = Date.now() - mulai;

    // 2) Peserta MCU: dikelompokkan per paket + tanggal, semua dalam satu transaksi.
    const kelompok = new Map();
    for (const h of siap) {
      const kunci = `${h.paket_uuid}|${h.tanggal}`;
      if (!kelompok.has(kunci)) kelompok.set(kunci, []);
      kelompok.get(kunci).push(h);
    }
    const paketDb = await query(`SELECT * FROM mcu_paket WHERE uuid = ANY($1)`, [[...new Set(siap.map((h) => h.paket_uuid))]]);
    let berhasil = [];
    if (siap.length) {
      try {
        const dibuat = await daftarkanPeserta(
          req.author,
          [...kelompok.values()].map((rows) => ({
            caraBayar: "korporasi",
            jenisMcu: v.jenisMcu,
            tanggal: rows[0].tanggal,
            paket: paketDb.find((p) => p.uuid === rows[0].paket_uuid),
            perusahaan: v.perusahaan,
            paymentMethod: 1,
            daftar: rows,
          })),
        );
        berhasil = dibuat.map((p) => {
          const h = siap.find((x) => x.pasien.uuid === p.patient_uuid);
          return { no: h?.no, ...ringkasPeserta(p), peringatan: h?.peringatan ?? [] };
        });
      } catch (e) {
        for (const h of siap) gagal.push({ ...h, status: "galat", alasan: `Pendaftaran MCU gagal (seluruh batch dibatalkan): ${e.message}` });
      }
    }
    gagal.sort((a, b) => a.no - b.no);
    berhasil.sort((a, b) => a.no - b.no);
    kirim(
      res,
      {
        ringkasan: { total: v.baris.length, berhasil: berhasil.length, gagal: gagal.length, pasien_baru: pasienBaru.length },
        berhasil,
        gagal,
        pasien_baru: pasienBaru,
        waktu_ms: Date.now() - mulai,
        waktu_admisi_ms: waktuAdmisi,
      },
      `${berhasil.length} peserta MCU ${v.perusahaan.nama} berhasil didaftarkan${gagal.length ? `, ${gagal.length} baris gagal` : ""}`,
    );
  }),
);

export default rute;
