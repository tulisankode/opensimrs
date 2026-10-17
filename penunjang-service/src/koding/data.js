import { query, satu, sisipkan } from "../db.js";
import { tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { KUNJUNGAN_TIPE, TABEL_KUNJUNGAN } from "./bersama.js";

// Akses bersama ke agregat koding_kunjungan & data kunjungan sumber (RJ/RI/IGD), dipakai oleh worklist, checklist,
// klarifikasi, dan laporan. Query selalu memfilter faskes_uuid dari token (lihat pemanggil).

export const satuKunjunganSumber = async (tipe, uuid, faskesUuid) => {
  if (!KUNJUNGAN_TIPE.includes(tipe)) throw permintaanSalah("Jenis kunjungan tidak valid");
  const r = await satu(
    `SELECT r.uuid, r.no_reg, r.no_rm, r.patient_uuid, r.practitioner_uuid, r.payment_method, r.lokasi_uuid,
            r.rekam_medis_uuid, r.status_pulang, r.discharge_date, l.name AS lokasi_nama
       FROM ${TABEL_KUNJUNGAN[tipe]} r LEFT JOIN lokasi l ON l.uuid = r.lokasi_uuid
      WHERE r.uuid = $1 AND r.faskes_uuid = $2 AND r.deleted_at IS NULL`,
    [uuid, faskesUuid],
  );
  if (!r) throw tidakDitemukan("Kunjungan");
  return r;
};

// Baris agregat koding_kunjungan; dibuat otomatis (lazy) saat kunjungan pertama kali dibuka/dikoding.
export const ambilKoding = async (tipe, uuid, faskesUuid, sumber, k) => {
  const cari = () =>
    satu(
      `SELECT * FROM koding_kunjungan WHERE faskes_uuid = $1 AND kunjungan_tipe = $2 AND kunjungan_uuid = $3 AND deleted_at IS NULL`,
      [faskesUuid, tipe, uuid],
      k,
    );
  let row = await cari();
  if (row) return row;
  try {
    row = await sisipkan(
      "koding_kunjungan",
      {
        faskes_uuid: faskesUuid, kunjungan_tipe: tipe, kunjungan_uuid: uuid, no_reg: sumber.no_reg, no_rm: sumber.no_rm,
        patient_uuid: sumber.patient_uuid, status: "proses", versi_terakhir: 0,
      },
      k,
    );
  } catch (e) {
    if (e?.code !== "23505") throw e;
    row = await cari();
  }
  return row;
};

export const satuKoding = (tipe, uuid, faskesUuid, k) =>
  satu(`SELECT * FROM koding_kunjungan WHERE faskes_uuid = $1 AND kunjungan_tipe = $2 AND kunjungan_uuid = $3 AND deleted_at IS NULL`, [faskesUuid, tipe, uuid], k);

export const diagnosisTerkini = (kodingUuid, versi, k) =>
  !versi ? [] : query(`SELECT * FROM koding_diagnosis WHERE koding_kunjungan_uuid = $1 AND versi = $2 ORDER BY peran, created_at`, [kodingUuid, versi], k);

export const tindakanTerkini = (kodingUuid, versi, k) =>
  !versi ? [] : query(`SELECT * FROM koding_tindakan WHERE koding_kunjungan_uuid = $1 AND versi = $2 ORDER BY created_at`, [kodingUuid, versi], k);

// Checklist item yang berlaku untuk jenis kunjungan ini, digabung dengan status terkini (default tidak_lengkap bila
// belum pernah diperiksa).
export const checklistKunjungan = (kodingUuid, tipe, faskesUuid, k) =>
  query(
    `SELECT ci.uuid AS checklist_item_uuid, ci.nama, ci.wajib, ci.urutan,
            COALESCE(ck.status, 'tidak_lengkap') AS status, ck.alasan, ck.petugas_uuid, ck.updated_at
       FROM koding_checklist_item ci
       LEFT JOIN koding_checklist_kunjungan ck ON ck.checklist_item_uuid = ci.uuid AND ck.koding_kunjungan_uuid = $1
      WHERE ci.faskes_uuid = $2 AND ci.status AND (ci.berlaku_kunjungan_tipe IS NULL OR $3 = ANY(ci.berlaku_kunjungan_tipe))
      ORDER BY ci.urutan, ci.nama`,
    [kodingUuid, faskesUuid, tipe],
    k,
  );

// Item checklist wajib yang belum "lengkap" dan belum ditandai "tidak_berlaku" (KF-12).
export const checklistBelumLengkap = (checklist) => checklist.filter((c) => c.wajib && !["lengkap", "tidak_berlaku"].includes(c.status));
export const checklistLengkapSemua = (checklist) => checklistBelumLengkap(checklist).length === 0;

export const klarifikasiKunjungan = (kodingUuid, status, k) =>
  query(
    `SELECT * FROM koding_klarifikasi WHERE koding_kunjungan_uuid = $1 AND deleted_at IS NULL ${status ? "AND status = $2" : ""} ORDER BY dikirim_at DESC`,
    status ? [kodingUuid, status] : [kodingUuid],
    k,
  );

// ── Aturan bisnis "siap klaim" (KF-7, aturan bisnis #6), murni fungsi data agar bisa diuji tanpa basis data.

export const diagnosisUtamaDari = (diagnosis) => diagnosis.find((d) => d.peran === "utama") ?? null;

export const klarifikasiTerbuka = (klarifikasi) => klarifikasi.some((k) => k.menghalangi && k.status !== "ditutup");

// Daftar prasyarat yang belum terpenuhi untuk status siap_klaim; kosong berarti seluruh syarat terpenuhi.
export const prasyaratSiapKlaim = (diagnosis, checklist, klarifikasi) => {
  const prasyarat = [];
  if (!diagnosisUtamaDari(diagnosis)) prasyarat.push("Diagnosis utama belum diisi");
  const belum = checklistBelumLengkap(checklist);
  if (belum.length) prasyarat.push(`Checklist belum lengkap: ${belum.map((c) => c.nama).join(", ")}`);
  if (klarifikasiTerbuka(klarifikasi)) prasyarat.push("Ada klarifikasi menghalangi yang belum ditutup");
  return prasyarat;
};
