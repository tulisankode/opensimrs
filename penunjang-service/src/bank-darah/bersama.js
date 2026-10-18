import { query, satu, uuidv7 } from "../db.js";
import { permintaanSalah } from "../umum/respons.js";
import { punyaIzin } from "../umum/izin.js";
import { layakOPosPasien, syaratOverrideDarurat } from "./kompatibilitas.js";
// Helper umum (tanggal lokal, rentang, pesan ramah, nama praktisi) sama dengan Radiologi/Mikrobiologi.
export { NAMA_PRAKTISI, daftarNilai, hariIni, ramah, rentangOpsional, tanggalValid, tglLokal } from "../radiologi/bersama.js";

// Konstanta & helper bersama modul Bank Darah RS (BDRS).

export const GOLONGAN_ABO = { A: "A", B: "B", AB: "AB", O: "O" };
export const RHESUS = { positif: "Rhesus Positif (+)", negatif: "Rhesus Negatif (-)" };
// OK (Kamar Operasi) belum punya kunjungan tersendiri di repo (modul kamar_operasi masih "segera").
export const SUMBER_KUNJUNGAN = { rajal: "Rawat Jalan", ranap: "Rawat Inap", igd: "IGD" };

export const STATUS_PERMINTAAN = {
  baru: "Baru",
  diproses: "Diproses BDRS",
  perlu_dilengkapi: "Perlu Dilengkapi",
  dipenuhi_sebagian: "Dipenuhi Sebagian",
  diserahkan: "Diserahkan",
  dibatalkan: "Dibatalkan",
  ditolak: "Ditolak",
};
export const STATUS_PERMINTAAN_AKTIF = ["baru", "diproses", "perlu_dilengkapi", "dipenuhi_sebagian"];

export const HASIL_UJI = { kompatibel: "Kompatibel", inkompatibel: "Inkompatibel" };
export const SKRINING_ANTIBODI = { negatif: "Negatif", positif: "Positif" };

export const STATUS_STOK = {
  tersedia: "Tersedia",
  dialokasikan: "Dialokasikan",
  diserahkan: "Diserahkan",
  kedaluwarsa: "Kedaluwarsa",
  dimusnahkan: "Dimusnahkan",
  dikembalikan: "Dikembalikan",
};
export const SUMBER_STOK = { utd_manual: "UTD (manual)", utd_otomatis: "UTD (otomatis)" };

// Hasil IMLTD saat penerimaan kantong (STD-0016/KF-12): hanya non_reaktif yang layak dialokasikan/di-crossmatch/diserahkan.
export const STATUS_IMLTD = { belum_diperiksa: "Belum Diperiksa", non_reaktif: "Non-Reaktif", reaktif: "Reaktif" };

export const STATUS_SERAH_TERIMA = { menunggu: "Menunggu Konfirmasi", selesai: "Selesai", batal: "Batal" };
export const STATUS_TAGIHAN_ST = { belum: "Belum Dikirim", terkirim: "Terkirim", gagal: "Gagal" };

export const STATUS_TRANSFUSI = { berlangsung: "Berlangsung", selesai_tanpa_reaksi: "Selesai Tanpa Reaksi", reaksi: "Reaksi" };
export const STATUS_TINDAK_LANJUT_REAKSI = { baru: "Baru Dilaporkan", ditindaklanjuti: "Ditindaklanjuti", selesai: "Selesai" };

export const AMBANG_KEDALUWARSA_BAWAAN = 3;

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

// Segarkan status kedaluwarsa (KF-10/G11): kantong tersedia/dialokasikan yang sudah lewat tanggal kedaluwarsa menjadi
// 'kedaluwarsa', mengisi updated_at. Dipanggil sebelum daftar/detail stok, crossmatch, dan serah terima dihitung.
export const segarkanKedaluwarsa = async (faskesUuid, k) => {
  const sekarangEpoch = Math.floor(Date.now() / 1000);
  await query(
    `UPDATE bdrs_stok SET status = 'kedaluwarsa', updated_at = $2
      WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status IN ('tersedia', 'dialokasikan') AND tanggal_kedaluwarsa <= $2`,
    [faskesUuid, sekarangEpoch],
    k,
  );
  return sekarangEpoch;
};

// Catat audit BDRS (KF-9/KT-13): perubahan IMLTD, override darurat, dan penolakan kantong reaktif.
export const catatAuditBdrs = (faskesUuid, jenis, { stokUuid = null, permintaanUuid = null, pengguna = null, data = {} } = {}, k) =>
  query(
    `INSERT INTO bdrs_audit (uuid, faskes_uuid, jenis, stok_uuid, permintaan_uuid, pengguna, data, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [uuidv7(), faskesUuid, jenis, stokUuid, permintaanUuid, pengguna, JSON.stringify(data), Math.floor(Date.now() / 1000)],
    k,
  );

// Umur pasien dalam tahun penuh dari birth_date (dipakai hanya untuk kelayakan override PRC O Rh positif — KF-8).
const umurTahun = (birthDate) => (birthDate ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null);

// Orkestrasi syarat pengecualian darurat (KF-7/KF-8): mengambil izin OVERRIDE DARURAT & kelayakan pasien (PRC O Rh
// positif) dari database, lalu mendelegasikan keputusan ke fungsi murni `syaratOverrideDarurat` (kompatibilitas.js)
// agar logikanya identik dan dapat diuji unit. Dipakai sama oleh crossmatch & serah terima agar syarat tidak
// menyimpang. Mengembalikan alasan penolakan spesifik (bukan pesan ketidakcocokan golongan) — lihat PRD F4/KT-7.
export const cekOverrideDarurat = async ({ req, pengaturan, kelompokKomponen, golonganKantong, rhesusKantong, patientUuid, alasanOverride, k }) => {
  const punyaIzinOverride = await punyaIzin(req, "Bank Darah RS (BDRS)", "Uji Silang Serasi", "OVERRIDE DARURAT");
  let layakOPos = true;
  if (kelompokKomponen === "sel_darah_merah" && String(golonganKantong ?? "").toUpperCase() === "O" && rhesusKantong === "positif") {
    const pasien = await satu(`SELECT p.gender, bd.birth_date FROM patients p LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid WHERE p.uuid = $1`, [patientUuid], k);
    layakOPos = Boolean(pasien) && layakOPosPasien({ genderPasien: pasien.gender, umurPasien: umurTahun(pasien.birth_date) });
  }
  return syaratOverrideDarurat({
    overrideDaruratAktif: pengaturan.override_darurat_aktif,
    punyaIzinOverride,
    alasanOverride,
    kelompokKomponen,
    golonganKantong,
    rhesusKantong,
    izinkanOPos: pengaturan.override_o_pos_aktif,
    layakOPos,
  });
};
