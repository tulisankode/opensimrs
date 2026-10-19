import { query, satu } from "../db.js";
import { punyaIzin } from "../umum/izin.js";
import { permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { catatAudit } from "./dasar.js";
import { amankanPasien, amankanPelapor, inisial, pengaturanBawaan, statusTenggat, tindakLanjutTerlambat } from "./ikp-bersama.js";

// Helper basis data fitur Insiden Keselamatan Pasien (STD-0026). Semua pencarian disaring faskes_uuid dari token;
// laporan milik faskes lain diperlakukan "tidak ditemukan". Laporan IKP bukan bagian rekam medis: rujukan pasien
// hanya patient_uuid & no_reg, data tampilan minimum (No. RM & inisial) dibaca saat dibutuhkan oleh pemegang izin
// LIHAT PASIEN.

export const MODUL = "Mutu & Akreditasi";
export const SUB = "Insiden Keselamatan Pasien";
export const SUB_RISIKO = "Register Risiko";
export const AKSI_IKP = ["LAPOR", "READ", "LIHAT PASIEN", "TERIMA", "GRADING", "INVESTIGASI", "TINDAK LANJUT", "VERIFIKASI", "TUTUP", "DASBOR", "EKSPOR", "PENGATURAN"];

export const boleh = (req, aksi) => punyaIzin(req, MODUL, SUB, aksi);
export const bolehLihatPasien = (req) => boleh(req, "LIHAT PASIEN");

// Pengaturan faskes (tanpa baris → bawaan aplikasi). matriks & tenggat dikembalikan sebagai objek.
export const pengaturanFaskes = async (f, k) => {
  const row = await satu(`SELECT * FROM mutu_ikp_pengaturan WHERE faskes_uuid = $1`, [f], k);
  const bawaan = pengaturanBawaan();
  if (!row) return { ...bawaan, bawaan: true };
  return {
    tenggat_lapor_jam: Number(row.tenggat_lapor_jam),
    tenggat_investigasi_hari: { ...bawaan.tenggat_investigasi_hari, ...(row.tenggat_investigasi_hari ?? {}) },
    matriks: row.matriks ?? bawaan.matriks,
    versi_matriks: Number(row.versi_matriks),
    pengingat_penerima: row.pengingat_penerima,
    pengingat_kanal: row.pengingat_kanal,
    diubah_oleh: row.diubah_oleh,
    updated_at: row.updated_at,
    bawaan: false,
  };
};
// Pengingat/eskalasi tidak dikirim otomatis (belum ada kanal notifikasi di SIMRS); konfigurasi hanya dinyatakan
// lengkap bila penerima & kanal diisi faskes — sistem tidak mengarang penerima (KT-12).
export const konfigurasiPengingatLengkap = (p) => !!(String(p?.pengingat_penerima ?? "").trim() && String(p?.pengingat_kanal ?? "").trim());

// Unit (lokasi Datamaster) milik faskes; wajib.
export const cekUnitIkp = async (uuid, f, k, nama = "unit_uuid") => {
  if (!uuid || typeof uuid !== "string") throw permintaanSalah(`${nama} wajib diisi`);
  const ada = await satu(`SELECT uuid FROM lokasi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, f], k);
  if (!ada) throw permintaanSalah("Unit tidak ditemukan di faskes ini");
  return uuid;
};

// Pegawai aktif (PIC) milik faskes; opsional bila `wajibIsi` false.
export const cekPic = async (uuid, f, k, wajibIsi = true) => {
  if (uuid === undefined && !wajibIsi) return undefined;
  if ((uuid === null || uuid === "") && !wajibIsi) return null;
  if (!uuid || typeof uuid !== "string") throw permintaanSalah("pic_pegawai_uuid wajib diisi");
  const ada = await satu(`SELECT uuid FROM pegawai WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status = true`, [uuid, f], k);
  if (!ada) throw permintaanSalah("PIC (pegawai) tidak ditemukan atau tidak aktif di faskes ini");
  return uuid;
};

export const KOLOM_LAPORAN = `l.uuid, l.faskes_uuid, l.nomor, l.jenis_insiden, l.kategori_insiden, l.layanan, l.waktu_kejadian, l.waktu_diketahui,
  l.waktu_lapor, l.unit_uuid, un.name AS unit_nama, l.tempat_kejadian, l.kronologi, l.tindakan_segera, l.tindakan_oleh, l.akibat,
  l.pernah_terjadi, l.keterangan_pernah_terjadi, l.anonim, l.pelapor_nama, l.dibuat_oleh, l.patient_uuid, l.no_reg, l.status,
  l.status_sebelum_tutup, l.tenggat_lapor_jam, l.batas_lapor, l.terlambat_lapor, l.grade, l.skor, l.dinilai_pada, l.batas_investigasi,
  l.alasan_perlu_lengkap, l.catatan_terima, l.diterima_oleh, l.diterima_pada, l.alasan_tutup, l.ditutup_oleh, l.ditutup_pada,
  l.created_at, l.updated_at`;
export const DARI_LAPORAN = `mutu_ikp_laporan l LEFT JOIN lokasi un ON un.uuid = l.unit_uuid`;

export const ambilLaporan = async (uuid, f, k, kunci = false) => {
  const row = await satu(
    `SELECT ${kunci ? "*" : KOLOM_LAPORAN} FROM ${kunci ? "mutu_ikp_laporan l" : DARI_LAPORAN}
      WHERE l.uuid = $1 AND l.faskes_uuid = $2 AND l.deleted_at IS NULL${kunci ? " FOR UPDATE" : ""}`,
    [String(uuid ?? ""), f],
    k,
  );
  if (!row) throw tidakDitemukan("Laporan insiden");
  return row;
};

// Data pasien minimum (No. RM & inisial nama) — hanya dipanggil untuk pemegang izin LIHAT PASIEN.
export const pasienMinimum = async (patientUuid, f) => {
  if (!patientUuid) return null;
  const p = await satu(`SELECT no_rm, name FROM patients WHERE uuid = $1 AND faskes_uuid = $2`, [patientUuid, f]);
  return p ? { pasien_no_rm: p.no_rm, pasien_nama: inisial(p.name) } : null;
};

// Penanda tenggat turunan (tidak disimpan): investigasi & tindak lanjut.
export const tandaiTenggat = (row, investigasiSelesai = false, sekarang) => ({
  ...row,
  status_tenggat_investigasi: row.grade ? statusTenggat(row.batas_investigasi, investigasiSelesai || row.status === "ditutup", sekarang) : null,
});
export const tandaiTindakLanjut = (tl, sekarang) => ({ ...tl, terlambat: tindakLanjutTerlambat(tl, sekarang) });

// Laporan aman untuk pemohon: identitas pelapor anonim & rujukan pasien disaring sesuai izin.
export const amankanLaporan = (row, req, lihatPasien) => amankanPasien(amankanPelapor(row, req.author?.username), lihatPasien);

// Audit IKP di mutu_audit. entitas_uuid = uuid laporan untuk seluruh perubahan turunan (grading, investigasi,
// tindak lanjut, lampiran) agar riwayat laporan mudah dibaca. Isi rahasia (kronologi, identitas pelapor anonim) tidak
// disalin: hanya kolom status/ringkas yang dicatat. Aktor laporan anonim dicatat "anonim".
const KOLOM_AUDIT_LAPORAN = ["nomor", "jenis_insiden", "status", "grade", "skor", "unit_uuid", "terlambat_lapor", "batas_investigasi", "alasan_perlu_lengkap", "alasan_tutup"];
export const ringkasLaporan = (row) => (row ? Object.fromEntries(KOLOM_AUDIT_LAPORAN.filter((c) => c in row).map((c) => [c, row[c]])) : null);
export const auditIkp = (k, req, entitas, uuid, aksi, sebelum, sesudah, { anonim = false } = {}) =>
  catatAudit(k, anonim ? { author: { ...req.author, username: "anonim" } } : req, entitas, uuid, aksi, sebelum, sesudah);

// Riwayat perubahan laporan (tanpa catatan akses baca).
export const riwayatLaporan = (uuid, f) =>
  query(
    `SELECT entitas, aksi, data_sesudah, aktor, created_at FROM mutu_audit
      WHERE faskes_uuid = $1 AND entitas_uuid = $2 AND entitas LIKE 'ikp%' AND aksi NOT IN ('baca', 'unduh_lampiran')
      ORDER BY created_at, uuid`,
    [f, uuid],
  );
