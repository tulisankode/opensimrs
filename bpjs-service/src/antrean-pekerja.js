import config from "./config.js";
import { query, sekarang } from "./db.js";
import { catatTask, logKirim, prosesKirim } from "./antrean-service.js";

// Pekerja berkala Antrean Online BPJS — pola sama dengan jalankanPekerja (pcare.js). Tidak ada perubahan di
// antrian-service/admisi-service/rawat-jalan-service/farmasi-service pada iterasi ini (lihat catatan desain
// STD-0018, keputusan #9): job ini membaca status yang SUDAH tercatat di tabel bersama (antrian, admission_rj)
// untuk tiga hal, tanpa pernah merekayasa waktu:
//  1) Menjembatani pendaftaran JKN lokal (non-Mobile JKN) yang memenuhi kebijakan pelaporan ke bpjs_antrean_booking.
//  2) Mencatat task id 1-7/99 dari kejadian yang sudah tersimpan (check-in, status_panggilan admisi/poli/farmasi).
//  3) Mengirim ulang baris bpjs_antrean_kirim yang masih menunggu/gagal (percobaan < batas).
// Pemetaan task id di sini bersifat sementara (lihat komentar PETA_TASK) dan perlu disahkan terhadap kontrak WS
// Antrean resmi sebelum dipakai produksi.
const PETA_TASK = {
  admisi: { 1: 2, 4: 3 }, // status_panggilan dipanggil(1)->task2, selesai(4)->task3
  poli: { 1: 4, 4: 5 },
  farmasi: { 1: 6, 4: 7 },
};

const faskesAktif = () => query(`SELECT faskes_uuid FROM integrations WHERE antrean_bpjs_aktif = true AND deleted_at IS NULL`);

// (1) Jembatani pendaftaran JKN lokal (loket/APM, bukan Mobile JKN) yang belum punya booking.
const jembataniLokal = async (faskesUuid) => {
  const batas = sekarang() - 3 * 86400;
  const baru = await query(
    `SELECT uuid, patient_uuid, kode_booking, jadwal_dokter_uuid, jadwal_periksa
     FROM admission_rj
     WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status_rj <> 0 AND payment_method = 2
       AND kode_booking IS NOT NULL AND platform IS DISTINCT FROM 'MOBILE' AND created_at >= $2
       AND NOT EXISTS (SELECT 1 FROM bpjs_antrean_booking b WHERE b.faskes_uuid = $1 AND b.kode_booking = admission_rj.kode_booking)
     ORDER BY created_at LIMIT 50`,
    [faskesUuid, batas]
  );
  for (const r of baru) {
    const baris = await query(
      `INSERT INTO bpjs_antrean_booking
         (faskes_uuid, kode_booking, referensi, sumber, rawat_jalan_uuid, jadwal_dokter_uuid, patient_uuid,
          tanggal_periksa, status_lokal, status_sinkron, created_at, updated_at)
       VALUES ($1,$2,NULL,'lokal',$3,$4,$5,$6,'aktif','menunggu',$7,$7)
       ON CONFLICT (faskes_uuid, kode_booking) DO NOTHING RETURNING uuid`,
      [faskesUuid, r.kode_booking, r.uuid, r.jadwal_dokter_uuid, r.patient_uuid, r.jadwal_periksa, sekarang()]
    );
    if (baris[0]) await logKirim(faskesUuid, baris[0].uuid, "tambah_antrean", null, { kode_booking: r.kode_booking });
  }
  return baru.length;
};

// (2) Catat task id dari check-in & status_panggilan yang sudah tersimpan untuk booking yang masih aktif.
const catatTaskBerjalan = async (faskesUuid) => {
  const booking = await query(
    `SELECT b.uuid, b.kode_booking, b.patient_uuid, b.rawat_jalan_uuid, a.tanggal_checkin
     FROM bpjs_antrean_booking b JOIN admission_rj a ON a.uuid = b.rawat_jalan_uuid
     WHERE b.faskes_uuid = $1 AND b.status_lokal = 'aktif' AND b.deleted_at IS NULL AND a.deleted_at IS NULL`,
    [faskesUuid]
  );
  let dicatat = 0;
  for (const b of booking) {
    if (b.tanggal_checkin && (await catatTask(faskesUuid, b, 1))) dicatat++;
    const antrian = await query(
      `SELECT pelayanan, status_panggilan FROM antrian WHERE faskes_uuid = $1 AND rawat_jalan_uuid = $2 AND deleted_at IS NULL`,
      [faskesUuid, b.rawat_jalan_uuid]
    );
    for (const a of antrian) {
      const taskId = PETA_TASK[a.pelayanan]?.[a.status_panggilan];
      if (taskId && (await catatTask(faskesUuid, b, taskId))) dicatat++;
    }
  }
  return dicatat;
};

// (3) Kirim ulang baris yang masih menunggu/gagal.
const prosesAntrean = async (faskesUuid) => {
  const pending = await query(
    `SELECT uuid FROM bpjs_antrean_kirim WHERE faskes_uuid = $1 AND status IN ('menunggu', 'gagal') AND percobaan < $2 ORDER BY created_at LIMIT 50`,
    [faskesUuid, config.antreanMaksPercobaan]
  );
  let ok = 0;
  let gagal = 0;
  for (const { uuid } of pending) {
    const hasil = await prosesKirim(faskesUuid, uuid);
    hasil.status === "terkirim" ? ok++ : gagal++;
  }
  return { ok, gagal };
};

export const jalankanPekerjaAntrean = async () => {
  const ringkasan = [];
  for (const { faskes_uuid } of await faskesAktif()) {
    const dijembatani = await jembataniLokal(faskes_uuid);
    const task = await catatTaskBerjalan(faskes_uuid);
    const { ok, gagal } = await prosesAntrean(faskes_uuid);
    ringkasan.push({ faskesUuid: faskes_uuid, dijembatani, task, terkirim: ok, gagal });
  }
  return ringkasan;
};
