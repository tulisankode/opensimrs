import crypto from "node:crypto";

// STD-0029 — Audit Trail terpusat: helper murni (tanpa I/O) dipakai bersama oleh hook Sequelize (audit-sequelize.js)
// dan oleh setting-service saat menampilkan/mengekspor/memverifikasi catatan audit, agar aturan penyamaran dan
// perhitungan hash selalu konsisten di satu tempat.

// Nama kolom yang tidak boleh pernah tersimpan/tampil apa adanya pada ringkasan perubahan audit.
const KOLOM_RAHASIA = [
  "password",
  "sandi",
  "token",
  "refreshtoken",
  "accesstoken",
  "secret",
  "rahasia",
  "apikey",
  "kunci",
  "signature",
  "authorization",
];

const bersihkanNamaKolom = (nama) => String(nama ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const isKolomRahasia = (nama) => {
  const n = bersihkanNamaKolom(nama);
  return KOLOM_RAHASIA.some((k) => n.includes(k));
};

// Kolom nomor identitas kependudukan. Bukan sekadar mengandung "nik" (agar "klinik", "teknik", "nikah" tidak ikut
// tersamar), tetapi juga nama kolom yang dipakai model pasien (noIdentity/no_identity).
const KOLOM_NIK = ["nik", "nonik", "noidentity", "noidentitas", "nomoridentitas", "noktp", "nomorktp", "identitynumber"];
const isKolomNik = (nama) => {
  const mentah = String(nama ?? "");
  return (
    KOLOM_NIK.includes(bersihkanNamaKolom(mentah)) ||
    /(^|[^a-zA-Z])nik([^a-zA-Z]|$)/i.test(mentah) || // nik_pasien, pasien_nik
    /[a-z]Nik([A-Z]|$)/.test(mentah) // pasienNik
  );
};

// Menyisakan 6 digit depan (kode wilayah) & 2 digit belakang, selebihnya disamarkan.
const samarkanNik = (nilai) => {
  const s = String(nilai ?? "");
  if (s.length <= 8) return "*".repeat(s.length);
  return `${s.slice(0, 6)}${"*".repeat(s.length - 8)}${s.slice(-2)}`;
};

const BATAS_TEKS = 2000;

// Berkas biner (bytea: unggahan PDF pasien, berkas hasil rujukan) dan teks sangat panjang (foto base64) tidak disalin
// ke audit — cukup penandanya — agar isi dokumen klinis tidak bocor ke audit_trail dan baris audit tidak membengkak.
const ringkasNilaiBesar = (nilai) => {
  if (Buffer.isBuffer(nilai) || nilai instanceof Uint8Array) return `[BERKAS BINER ${nilai.length} byte]`;
  if (nilai && typeof nilai === "object" && nilai.type === "Buffer" && Array.isArray(nilai.data)) {
    return `[BERKAS BINER ${nilai.data.length} byte]`;
  }
  if (typeof nilai === "string" && nilai.length > BATAS_TEKS) return `${nilai.slice(0, 200)}… [DIPOTONG, ${nilai.length} karakter]`;
  return nilai;
};

// Menyamarkan satu nilai field. Field rahasia → ditandai disamarkan; NIK → disamarkan sebagian; objek/array JSON
// disamarkan rekursif per kunci (field rahasia di dalamnya dibuang); selain itu apa adanya.
export function samarkanNilaiField(nama, nilai) {
  if (nilai === null || nilai === undefined) return nilai;
  if (isKolomRahasia(nama)) return "[DISAMARKAN]";
  const ringkas = ringkasNilaiBesar(nilai);
  if (ringkas !== nilai) return ringkas;
  if (isKolomNik(nama)) return samarkanNik(nilai);
  if (Array.isArray(nilai)) return nilai.map((v) => samarkanNilaiField(nama, v));
  if (typeof nilai === "object" && !(nilai instanceof Date)) {
    const hasil = {};
    for (const [k, v] of Object.entries(nilai)) if (!isKolomRahasia(k)) hasil[k] = samarkanNilaiField(k, v);
    return hasil;
  }
  return nilai;
}

// Menyamarkan objek ringkasan perubahan berbentuk { field: nilai } atau { field: { lama, baru } }.
// Field rahasia dihilangkan sepenuhnya (tidak ikut tersimpan ke audit_trail).
export function samarkanRingkasan(ringkasan) {
  if (!ringkasan || typeof ringkasan !== "object") return ringkasan;
  const hasil = {};
  for (const [field, nilai] of Object.entries(ringkasan)) {
    if (isKolomRahasia(field)) continue;
    if (nilai && typeof nilai === "object" && !Array.isArray(nilai) && ("lama" in nilai || "baru" in nilai)) {
      hasil[field] = {
        lama: samarkanNilaiField(field, nilai.lama),
        baru: samarkanNilaiField(field, nilai.baru),
      };
    } else {
      hasil[field] = samarkanNilaiField(field, nilai);
    }
  }
  return hasil;
}

// Urutan kolom tetap untuk representasi kanonis baris (dipakai menghitung hash_baris). Jangan diubah urutannya pada
// data yang sudah tersimpan — perubahan urutan membuat hash lama tidak bisa diverifikasi ulang.
const KOLOM_HASH = [
  "uuid",
  "faskes_uuid",
  "waktu_epoch",
  "pengguna_uuid",
  "identitas_akun",
  "peran",
  "layanan",
  "aksi",
  "entitas",
  "entitas_uuid",
  "patient_uuid",
  "ringkasan_perubahan",
  "alamat_ip",
  "user_agent",
  "request_id",
  "hash_sebelumnya",
];

// JSON dengan kunci terurut (rekursif). Wajib untuk kolom JSONB: PostgreSQL menyusun ulang urutan kunci objek
// (mis. {lama, baru} dibaca kembali sebagai {baru, lama}), sehingga JSON.stringify biasa menghasilkan teks berbeda
// antara saat menulis dan saat verifikasi — semua baris yang punya ringkasan akan terdeteksi "tidak_cocok".
export function jsonKanonik(nilai) {
  if (nilai && typeof nilai.toJSON === "function") nilai = nilai.toJSON();
  if (Array.isArray(nilai)) {
    return `[${nilai.map((v) => (v === undefined || typeof v === "function" ? "null" : jsonKanonik(v))).join(",")}]`;
  }
  if (nilai && typeof nilai === "object") {
    const kunci = Object.keys(nilai).filter((k) => nilai[k] !== undefined && typeof nilai[k] !== "function").sort();
    return `{${kunci.map((k) => `${JSON.stringify(k)}:${jsonKanonik(nilai[k])}`).join(",")}}`;
  }
  return JSON.stringify(nilai) ?? "null";
}

export function kanonikBaris(baris) {
  return KOLOM_HASH.map((kolom) => {
    const nilai = baris?.[kolom];
    if (nilai === undefined || nilai === null) return "";
    return typeof nilai === "object" ? jsonKanonik(nilai) : String(nilai);
  }).join("");
}

export function hitungHashBaris(baris) {
  return crypto.createHash("sha256").update(kanonikBaris(baris), "utf8").digest("hex");
}

// Daftar putih tabel yang dicatat lewat hook Sequelize global (STD-0029 KF-14). Nama kolom entitas untuk tampilan;
// pemetaan nama tabel aktual perlu diperiksa ulang bila ada perubahan skema model-sdk/layanan.
export const DAFTAR_PUTIH_TABEL = {
  patients: { entitas: "Pasien" },
  addresses: { entitas: "Alamat" },
  birth_details: { entitas: "Detail Kelahiran" },
  rawat_jalans: { entitas: "Kunjungan Rawat Jalan" },
  rawat_inaps: { entitas: "Kunjungan Rawat Inap" },
  instalasi_gawat_darurats: { entitas: "Kunjungan IGD" },
  prescriptions: { entitas: "Resep" },
  order_lab: { entitas: "Order Laboratorium" },
  observation_item: { entitas: "Hasil Laboratorium" },
  bills: { entitas: "Tagihan" },
  payment_history: { entitas: "Pembayaran" },
  // field berikut, bila berubah, dicatat dengan aksi `ubah_izin` (bukan `ubah`) sesuai KT-23.
  users: { entitas: "Pengguna", fieldIzin: ["permissions", "roleUuid"] },
  role: { entitas: "Peran", fieldIzin: ["permissions"] },
  faskes: { entitas: "Faskes" },
};

const KANDIDAT_FIELD_PASIEN = ["patientUuid", "patient_uuid", "pasienUuid", "pasien_uuid"];

// Mengambil patient_uuid dari instance model bila ada; tabel `patients` sendiri memakai uuid-nya sendiri.
export function ambilPatientUuid(instance, tableName) {
  if (tableName === "patients") return instance?.uuid ?? instance?.dataValues?.uuid ?? null;
  for (const field of KANDIDAT_FIELD_PASIEN) {
    const nilai = instance?.dataValues?.[field] ?? instance?.[field];
    if (nilai) return nilai;
  }
  return null;
}

export function ambilFaskesUuid(instance) {
  return (
    instance?.dataValues?.faskesUuid ??
    instance?.faskesUuid ??
    instance?.dataValues?.faskes_uuid ??
    instance?.faskes_uuid ??
    null
  );
}
