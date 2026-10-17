import { permintaanSalah } from "../umum/respons.js";
// Helper tanggal/pesan ramah sama dengan Radiologi/Mikrobiologi.
import { TZ } from "../radiologi/bersama.js";
export { TZ, daftarNilai, hariIni, ramah, rentangOpsional, tanggalValid, tglLokal } from "../radiologi/bersama.js";

// Konstanta & helper bersama modul UTD / UPTD Produksi Darah.

export const GOLONGAN_DARAH = { A: "A", B: "B", AB: "AB", O: "O" };
export const RHESUS = { positif: "Rhesus Positif (+)", negatif: "Rhesus Negatif (-)" };
export const JENIS_KELAMIN = { L: "Laki-laki", P: "Perempuan" };
export const STATUS_AKTIF_DONOR = { aktif: "Aktif", ditahan: "Ditahan" };
export const STATUS_SELEKSI = { proses: "Dalam Proses", layak: "Layak", tunda: "Tunda", tolak: "Tolak" };
export const REAKSI_DONOR = { tidak_ada: "Tidak ada reaksi", ringan: "Reaksi ringan", sedang: "Reaksi sedang", berat: "Reaksi berat" };
export const STATUS_KANTONG = { karantina: "Karantina", karantina_reaktif: "Karantina/Reaktif", tersedia: "Tersedia", dimusnahkan: "Dimusnahkan" };
export const PARAMETER_IMLTD = { hiv: "HIV", hbsag: "HBsAg", hcv: "HCV", sifilis: "Sifilis" };
export const HASIL_IMLTD = { reaktif: "Reaktif", non_reaktif: "Non-Reaktif" };
export const STATUS_AKHIR_IMLTD = { pending: "Menunggu Hasil", non_reaktif: "Non-Reaktif", reaktif: "Reaktif" };
export const JENIS_KOMPONEN = { PRC: "Packed Red Cells (PRC)", TC: "Thrombocyte Concentrate (TC)", FFP: "Fresh Frozen Plasma (FFP)", CRYO: "Cryoprecipitate" };
export const STATUS_KOMPONEN = {
  karantina: "Karantina", tersedia: "Tersedia", dialokasikan: "Dialokasikan", didistribusikan: "Didistribusikan",
  dimusnahkan: "Dimusnahkan", kedaluwarsa: "Kedaluwarsa",
};
export const PENERIMA_TIPE = { bdrs_internal: "BDRS Internal", eksternal: "Eksternal (RS/Faskes lain)" };
export const STATUS_PERMINTAAN = { menunggu: "Menunggu", sebagian: "Terpenuhi Sebagian", terpenuhi: "Terpenuhi", ditolak: "Ditolak" };
export const STATUS_DISTRIBUSI = { terkirim: "Terkirim", menunggu_integrasi: "Menunggu Integrasi BDRS", gagal_integrasi: "Integrasi Gagal" };
export const ALASAN_MUSNAH = { reaktif: "Reaktif", kedaluwarsa: "Kedaluwarsa", lain: "Lainnya" };
export const JENIS_LAPORAN = {
  donor: "Donor", produksi: "Produksi", uji_saring: "Uji Saring IMLTD", distribusi: "Distribusi", pemusnahan: "Pemusnahan", bulanan: "Bulanan (Lengkap)",
};

export const pilihan = (obj) => Object.entries(obj).map(([kode, nama]) => ({ kode, nama }));

export const cekPilihan = (nilai, obj, nama) => {
  if (nilai === undefined || nilai === null || nilai === "") return nilai === "" ? null : nilai;
  if (!obj[nilai]) throw permintaanSalah(`${nama} harus salah satu: ${Object.keys(obj).join(", ")}`);
  return nilai;
};

export const teks = (v) => (v === undefined ? undefined : String(v ?? "").trim() || null);

export const angkaOpsional = (v, nama) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) throw permintaanSalah(`${nama} harus berupa angka`);
  return n;
};

// "YYYY-MM-DD" wajib (tanggal lahir, tanggal kedaluwarsa); null diperbolehkan bila opsional dicek pemanggil.
export const tanggalOpsional = (v, nama) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(v))) throw permintaanSalah(`${nama} harus berformat YYYY-MM-DD`);
  return v;
};

export const waktuOpsional = (v, nama) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw permintaanSalah(`${nama} tidak valid (detik epoch)`);
  return Math.floor(n);
};

// Selisih hari kalender UTC antara dua "YYYY-MM-DD".
export const selisihHari = (dariTgl, keTgl) => Math.round((new Date(`${keTgl}T00:00:00Z`) - new Date(`${dariTgl}T00:00:00Z`)) / 86400000);

// Tanggal kalender lokal faskes (Asia/Jakarta) "YYYY-MM-DD" dari epoch detik — selaras dengan hariIni() & tglLokal().
export const tglLokalEpoch = (detik) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Number(detik) * 1000));

// "YYYY-MM-DD" + n hari kalender → "YYYY-MM-DD" (dihitung di UTC agar tidak bergeser oleh zona waktu server).
export const tambahHariIso = (tgl, hari) => {
  const d = new Date(`${tgl}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(hari));
  return d.toISOString().slice(0, 10);
};

// ── Penyamaran hasil IMLTD reaktif & identitas donor (KF-18) ────────────────
// Tanpa izin "Lihat Hasil Reaktif", API tidak boleh mengirim nilai hasil per parameter yang memuat reaktif (hasil awal
// maupun konfirmasi) ataupun mengaitkan identitas donor dengan kantong/komponen yang reaktif. Yang tetap dikirim hanya
// status ringkas yang dibutuhkan alur kerja (status_akhir, kelengkapan, status pelepasan, status kantong).
export const PARAM_IMLTD = Object.keys(PARAMETER_IMLTD);
const KOLOM_IDENTITAS_DONOR = ["donor_uuid", "riwayat_uuid", "no_donor", "nama_donor", "nik"];
const KOLOM_INFO_REAKTIF_DONOR = ["alasan_ditahan", "perlu_notifikasi", "notifikasi_selesai", "catatan_notifikasi", "notifikasi_pada"];

// true bila baris utd_imltd memuat hasil reaktif di mana pun (status akhir, hasil awal, atau riwayat konfirmasi).
export const imltdAdaReaktif = (i) =>
  Boolean(i) &&
  (i.status_akhir === "reaktif" ||
    PARAM_IMLTD.some((p) => i[`${p}_hasil`] === "reaktif") ||
    (Array.isArray(i.hasil_konfirmasi) ? i.hasil_konfirmasi : []).some((k) => k?.hasil === "reaktif"));

export const imltdLengkap = (i) => Boolean(i) && PARAM_IMLTD.every((p) => i[`${p}_hasil`] != null);

// Baris utd_imltd untuk dikirim ke klien: utuh bila berizin atau tidak ada reaktif, selain itu hanya status ringkas.
export const samarkanImltd = (i, boleh) => {
  if (!i || boleh || !imltdAdaReaktif(i)) return i;
  return {
    uuid: i.uuid, aftap_uuid: i.aftap_uuid, status_akhir: i.status_akhir, lengkap: imltdLengkap(i),
    dilepas_oleh: i.dilepas_oleh ?? null, dilepas_pada: i.dilepas_pada ?? null, disamarkan: true,
  };
};

// Hapus identitas donor dari baris kantong/komponen/worklist yang reaktif (kolom yang tidak ada dibiarkan).
export const samarkanIdentitasDonor = (row) => {
  const out = { ...row };
  for (const k of KOLOM_IDENTITAS_DONOR) if (k in out) out[k] = null;
  out.identitas_disamarkan = true;
  return out;
};

// Baris berkolom bantu `reaktif` (lihat sqlKantongReaktif): samarkan identitas bila perlu, lalu buang kolom bantu.
export const samarkanBarisKantong = (row, boleh) => {
  const { reaktif, ...sisa } = row;
  return reaktif && !boleh ? samarkanIdentitasDonor(sisa) : sisa;
};

// Profil donor: tanpa izin, keterangan penahanan & tindak lanjut notifikasi (yang bersumber dari hasil reaktif)
// tidak dikirim; status_aktif tetap dikirim karena dibutuhkan alur seleksi.
export const samarkanDonor = (d, boleh) => {
  if (!d || boleh) return d;
  const out = { ...d };
  for (const k of KOLOM_INFO_REAKTIF_DONOR) if (k in out) out[k] = null;
  return out;
};

// Status kantong pada tampilan yang memuat identitas donor: "karantina_reaktif" diringkas menjadi "karantina".
export const statusKantongRingkas = (status, boleh) => (!boleh && status === "karantina_reaktif" ? "karantina" : status);

// Ekspresi SQL boolean: kantong (alias tabel utd_aftap) berstatus reaktif atau memiliki hasil IMLTD reaktif.
export const sqlKantongReaktif = (a = "a") =>
  `(${a}.status_kantong = 'karantina_reaktif' OR EXISTS (
     SELECT 1 FROM utd_imltd ir WHERE ir.aftap_uuid = ${a}.uuid AND ir.faskes_uuid = ${a}.faskes_uuid AND ir.deleted_at IS NULL
        AND (ir.status_akhir = 'reaktif' OR ${PARAM_IMLTD.map((p) => `ir.${p}_hasil = 'reaktif'`).join(" OR ")}
             OR ir.hasil_konfirmasi @> '[{"hasil": "reaktif"}]'::jsonb)))`;
