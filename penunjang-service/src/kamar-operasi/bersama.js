import { Galat, permintaanSalah } from "../umum/respons.js";

// Konstanta & helper bersama modul Kamar Operasi (penjadwalan, laporan operasi & anestesi).

export const JENIS_OPERASI = ["elektif", "cito"];
export const KELAS_OPERASI = ["kecil", "sedang", "besar", "khusus"];
export const PERAN_TIM = ["operator", "asisten", "anestesi", "perawat_instrumen", "perawat_sirkuler"];
// Peran yang menghasilkan komponen jasa pada tagihan (perawat instrumen/sirkuler tidak bertarif jasa tersendiri).
export const PERAN_JASA = ["operator", "asisten", "anestesi"];
export const SUMBER_ORDER = ["rajal", "ranap", "igd"];
export const STATUS_ORDER = ["menunggu_jadwal", "perlu_klarifikasi", "terjadwal", "batal"];
export const STATUS_JADWAL = ["terjadwal", "selesai", "batal"];
export const TAHAP_CHECKLIST = ["sign_in", "time_out", "sign_out"];

// Daftar standar Checklist Keselamatan Bedah WHO (sign in/time out/sign out). Kustomisasi per faskes di luar
// cakupan rilis ini (dokumen Desain, keputusan terbuka #2); daftar ini dipakai sebagai acuan/referensi UI.
export const ITEM_CHECKLIST = {
  sign_in: [
    { kode: "identitas", label: "Identitas, lokasi, prosedur, dan persetujuan tindakan telah dikonfirmasi" },
    { kode: "penandaan_lokasi", label: "Lokasi operasi telah ditandai" },
    { kode: "mesin_anestesi", label: "Mesin dan obat anestesi telah dicek lengkap" },
    { kode: "pulse_oximeter", label: "Pulse oximeter terpasang dan berfungsi" },
    { kode: "alergi", label: "Riwayat alergi diketahui" },
    { kode: "jalan_napas", label: "Risiko jalan napas sulit/aspirasi dinilai, alat/bantuan tersedia" },
    { kode: "risiko_perdarahan", label: "Risiko kehilangan darah > 500 mL dinilai, akses & cairan memadai" },
  ],
  time_out: [
    { kode: "konfirmasi_tim", label: "Seluruh anggota tim memperkenalkan nama dan peran" },
    { kode: "konfirmasi_identitas", label: "Tim mengonfirmasi identitas, lokasi, dan prosedur" },
    { kode: "antisipasi_kritis", label: "Antisipasi kejadian kritis telah dibahas (operator/anestesi/perawat)" },
    { kode: "antibiotik_profilaksis", label: "Antibiotik profilaksis telah diberikan dalam 60 menit terakhir" },
    { kode: "pencitraan", label: "Pencitraan penting yang diperlukan telah ditampilkan" },
  ],
  sign_out: [
    { kode: "nama_prosedur", label: "Perawat mengonfirmasi nama prosedur yang tercatat" },
    { kode: "hitung_instrumen", label: "Hitung instrumen, kasa, dan jarum telah lengkap dan benar" },
    { kode: "label_spesimen", label: "Spesimen telah diberi label dengan benar (termasuk nama pasien)" },
    { kode: "masalah_alat", label: "Masalah terkait peralatan yang perlu ditindaklanjuti telah dicatat" },
    { kode: "rencana_pemulihan", label: "Operator/anestesi/perawat membahas rencana pemulihan & perawatan pasien" },
  ],
};

export const TZ = "Asia/Jakarta";
export const tglLokal = (kolom) => `(to_timestamp(${kolom}) AT TIME ZONE '${TZ}')::date`;

export const tanggalValid = (t, nama = "tanggal") => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t ?? "")) || Number.isNaN(Date.parse(t))) throw permintaanSalah(`${nama} harus berformat YYYY-MM-DD`);
  return t;
};

export const hariIni = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

export const epoch = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 1e8) return Math.trunc(n);
  const t = Date.parse(v);
  if (Number.isNaN(t)) throw permintaanSalah("Format waktu tidak valid");
  return Math.floor(t / 1000);
};

export const sumberValid = (s) => {
  if (!SUMBER_ORDER.includes(s)) throw permintaanSalah(`sumber harus salah satu: ${SUMBER_ORDER.join(", ")}`);
  return s;
};
export const jenisOperasiValid = (j) => {
  if (!JENIS_OPERASI.includes(j)) throw permintaanSalah(`jenis_operasi harus salah satu: ${JENIS_OPERASI.join(", ")}`);
  return j;
};
export const kelasOperasiValid = (k) => {
  if (k === undefined || k === null || k === "") return null;
  if (!KELAS_OPERASI.includes(k)) throw permintaanSalah(`kelas_operasi harus salah satu: ${KELAS_OPERASI.join(", ")}`);
  return k;
};
export const peranValid = (p) => {
  if (!PERAN_TIM.includes(p)) throw permintaanSalah(`peran tim harus salah satu: ${PERAN_TIM.join(", ")}`);
  return p;
};
export const tahapValid = (t) => {
  const v = String(t ?? "").replaceAll("-", "_");
  if (!TAHAP_CHECKLIST.includes(v)) throw permintaanSalah(`tahap checklist harus salah satu: sign-in, time-out, sign-out`);
  return v;
};

// Persetujuan tindakan & persetujuan anestesi wajib dua dokumen inform consent berbeda (KF-8): satu consent yang
// sama tidak boleh dipakai untuk keduanya. Nilai kosong diabaikan (kelengkapan yang menandai belum diisi).
export const PESAN_CONSENT_SAMA = "Persetujuan tindakan dan persetujuan anestesi harus dokumen inform consent yang berbeda";
export const consentSama = (tindakanUuid, anestesiUuid) => !!tindakanUuid && !!anestesiUuid && tindakanUuid === anestesiUuid;
export const consentBerbedaValid = (tindakanUuid, anestesiUuid) => {
  if (consentSama(tindakanUuid, anestesiUuid)) throw permintaanSalah(PESAN_CONSENT_SAMA);
};

// Kelas operasi tertinggi di antara rencana tindakan order (dipakai menentukan tarif jasa tim saat finalisasi).
export const kelasTertinggi = (tindakan) => {
  let hasil = null;
  for (const t of tindakan) {
    const i = KELAS_OPERASI.indexOf(t.kelas_operasi);
    if (i > (hasil === null ? -1 : KELAS_OPERASI.indexOf(hasil))) hasil = t.kelas_operasi;
  }
  return hasil;
};

// Pelanggaran unique index → pesan ramah (409). Galat lain diteruskan.
export const ramah = (e, pesan) => {
  if (e?.code === "23505") throw new Galat(409, pesan);
  throw e;
};
