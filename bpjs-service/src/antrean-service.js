import crypto from "node:crypto";
import config from "./config.js";
import { query, satu, sekarang } from "./db.js";
import { kredensialSiap } from "./antrean.js";
import { temukanJadwal, ringkasanAntrean, PemetaanTidakDitemukan } from "./antrean-peta.js";
import { kirimWsAntrean } from "./klien-antrean.js";
import { GalatBpjs } from "./klien-pcare.js";

// Orkestrasi Antrean Online BPJS (Mobile JKN). Pembuatan pendaftaran & pembatalan memakai endpoint "mobile" yang
// sudah ada di antrian-service (x-api-key, tanpa JWT, dipakai alur Mobile/APM) — lihat antrian-service/src/services/
// apm.service.js (registerPatientMobile) dan report-antrian.service.js (cancelBookingFromMobile). Catatan: endpoint
// tersebut mewajibkan data pasien lengkap (nama, alamat, dll — lihat PatientValidation.PATIENT_VALIDATOR), sehingga
// MVP ini hanya mendukung "pasien lama" yang datanya sudah terdaftar (data dipakai ulang apa adanya, bukan rekaan).
// Pasien baru lewat Mobile JKN diarahkan melengkapi pendaftaran di loket/APM (lihat ambilAntrean).

const OFFSET_WIB_MS = 7 * 3600 * 1000;
export const epochKeTanggal = (epoch) => (epoch ? new Date(Number(epoch) * 1000 + OFFSET_WIB_MS).toISOString().slice(0, 10) : null);
const tanggalKeEpoch = (ymd) => Math.floor(new Date(`${ymd}T00:00:00+07:00`).getTime() / 1000);

const panggilAntrian = async (metode, jalur, { faskesUuid, body } = {}) => {
  const url = `${String(config.antrianApiUrl).replace(/\/+$/, "")}${jalur}`;
  let res;
  try {
    res = await fetch(url, {
      method: metode,
      headers: { "Content-Type": "application/json", "faskes-uuid": faskesUuid, "x-api-key": config.antrianApiKey },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    throw new GalatBpjs(`Layanan Antrian tidak dapat dihubungi: ${error.message}`, 502);
  }
  const teks = await res.text();
  let json = null;
  try {
    json = teks ? JSON.parse(teks) : null;
  } catch {
    /* respons bukan JSON, biarkan null */
  }
  if (!res.ok) throw new GalatBpjs(json?.message || `Layanan Antrian menolak permintaan (status ${res.status})`, res.status, json);
  return json;
};

// Nilai beberapa kandidat nama field (camelCase/snake_case) dari objek respons antar-layanan.
const pilih = (obj, ...nama) => nama.map((n) => obj?.[n]).find((v) => v !== undefined && v !== null);

export class ValidasiAntreanGagal extends Error {
  status = 422;
}

const referensiAmbil = ({ nik, nomorkartu, kodepoli, kodedokter, tanggalperiksa }) =>
  [nik || nomorkartu, kodepoli, kodedokter || "-", tanggalperiksa].join("|");

const bookingTersimpan = (faskesUuid, { referensi, kodeBooking }) =>
  satu(
    `SELECT * FROM bpjs_antrean_booking WHERE faskes_uuid = $1 AND deleted_at IS NULL AND ${kodeBooking ? "kode_booking = $2" : "referensi = $2"} LIMIT 1`,
    [faskesUuid, kodeBooking || referensi]
  );

const buatBooking = async (faskesUuid, data) => {
  const baris = await satu(
    `INSERT INTO bpjs_antrean_booking
       (faskes_uuid, kode_booking, referensi, sumber, rawat_jalan_uuid, jadwal_dokter_uuid, patient_uuid,
        tanggal_periksa, status_lokal, status_sinkron, payload_ambil, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'aktif','terkirim',$9,$10,$10)
     ON CONFLICT (faskes_uuid, kode_booking) DO NOTHING
     RETURNING *`,
    [
      faskesUuid,
      data.kodeBooking,
      data.referensi,
      data.sumber,
      data.rawatJalanUuid,
      data.jadwalDokterUuid,
      data.patientUuid,
      data.tanggalPeriksa,
      JSON.stringify(data.payload ?? null),
      sekarang(),
    ]
  );
  return baris ?? bookingTersimpan(faskesUuid, { kodeBooking: data.kodeBooking });
};

const bentukRespons = (booking, jadwal) => ({
  kodebooking: booking.kode_booking,
  namapoli: jadwal?.poli?.name,
  namadokter: jadwal?.dokter?.name ?? jadwal?.jadwal?.practitioner_name,
  tanggalperiksa: epochKeTanggal(booking.tanggal_periksa),
  jampraktek: jadwal?.jadwal ? `${jadwal.jadwal.start_time}-${jadwal.jadwal.end_time}` : undefined,
  status: booking.status_lokal,
});

// --- Ambil antrean (BPJS -> OpenSIMRS): hanya pasien yang sudah terdaftar lokal ----------------------------------
export const ambilAntrean = async (faskesUuid, data) => {
  await kredensialSiap(faskesUuid);
  const referensi = referensiAmbil(data);

  const ada = await bookingTersimpan(faskesUuid, { referensi });
  if (ada) return bentukRespons(ada, null); // idempotensi (KT-9)

  const jadwal = await temukanJadwal(faskesUuid, data);
  const tanggalPeriksaEpoch = tanggalKeEpoch(data.tanggalperiksa);
  const ringkasan = await ringkasanAntrean(faskesUuid, jadwal.jadwal.uuid, tanggalPeriksaEpoch);
  if (ringkasan.sisaJkn <= 0) throw new GalatBpjs("Kuota antrean JKN untuk jadwal ini sudah penuh", 409);

  const identitas = data.nik ? { identity: "KTP", no_identity: data.nik } : null;
  if (data.pasienbaru && !data.norm) {
    throw new ValidasiAntreanGagal(
      "Pendaftaran pasien baru lewat Mobile JKN belum didukung di OpenSIMRS; silakan selesaikan pendaftaran pertama di loket/APM faskes."
    );
  }

  const pasienLama = await cariPasienLama(faskesUuid, { noRm: data.norm, ...identitas });
  if (!pasienLama) throw new ValidasiAntreanGagal("Data pasien tidak ditemukan di OpenSIMRS (periksa No. RM/NIK)");

  const hasil = await panggilAntrian("POST", "/mobile/apm/process-registration", {
    faskesUuid,
    body: {
      jadwal_dokter_uuid: jadwal.jadwal.uuid,
      jadwal_periksa: data.tanggalperiksa,
      payment_method: "ASURANSI",
      maternity: false,
      note: "",
      complaint: data.keluhan || "",
      patient_data: patientDataDariPasien(pasienLama),
    },
  });

  const kodeBooking = pilih(hasil, "kode_booking", "kodeBooking");
  const rawatJalanUuid = pilih(hasil, "uuid");
  if (!kodeBooking) throw new GalatBpjs("Layanan Antrian tidak mengembalikan kode booking", 502, hasil);

  const booking = await buatBooking(faskesUuid, {
    kodeBooking,
    referensi,
    sumber: "mobile_jkn",
    rawatJalanUuid,
    jadwalDokterUuid: jadwal.jadwal.uuid,
    patientUuid: pasienLama.uuid,
    tanggalPeriksa: tanggalPeriksaEpoch,
    payload: { kode_booking: kodeBooking, no_antrian_poli: pilih(hasil, "no_antrian_poli", "noAntrianPoli") },
  });

  return {
    ...bentukRespons(booking, jadwal),
    noantrean: pilih(hasil, "no_antrian_poli", "noAntrianPoli"),
    norm: pasienLama.no_rm,
  };
};

const patientDataDariPasien = (p) => ({
  patient_uuid: p.uuid,
  no_rm: p.no_rm,
  title: p.title || "Tn/Ny",
  name: p.name,
  identity: p.identity,
  no_identity: p.no_identity,
  gender: p.gender,
  phone: p.phone,
  religion: p.religion,
  language: p.language,
  maritial_status: p.maritial_status,
  mother_name: p.mother_name,
  birth_detail: { birth_place: p.birth_detail?.birth_place || "-", birth_date: p.birth_detail?.birth_date },
  address: {
    prov: p.address?.prov || "-",
    city: p.address?.city || "-",
    district: p.address?.district || "-",
    rt: p.address?.rt || "-",
    rw: p.address?.rw || "-",
    full_address: p.address?.full_address || "-",
    country: p.address?.country || "Indonesia",
    village: p.address?.village || "-",
    postal_code: p.address?.postal_code || "-",
  },
});

// Pencarian pasien lama langsung ke tabel `patients` (database bersama) — read-only, tidak membuat/mengubah pasien.
const cariPasienLama = async (faskesUuid, { noRm, identity, no_identity: noIdentity }) => {
  if (!noRm && !(identity && noIdentity)) return null;
  const pasien = await satu(
    `SELECT p.uuid, p.no_rm, p.title, p.name, p.identity, p.no_identity, p.gender, p.phone, p.religion, p.language,
            p.mother_name, p.maritial_status,
            jsonb_build_object('birth_place', bd.birth_place, 'birth_date', bd.birth_date) AS birth_detail,
            jsonb_build_object('prov', a.prov, 'city', a.city, 'district', a.district, 'rt', a.rt, 'rw', a.rw,
              'full_address', a.full_address, 'country', a.country, 'village', a.village, 'postal_code', a.postal_code) AS address
     FROM patients p
     LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid AND bd.deleted_at IS NULL
     LEFT JOIN addresses a ON a.patient_uuid = p.uuid
     WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.no_rm NOT LIKE 'XX%'
       AND (${noRm ? "p.no_rm = $2" : "p.identity = $2 AND p.no_identity = $3"})
     LIMIT 1`,
    noRm ? [faskesUuid, noRm] : [faskesUuid, identity, noIdentity]
  );
  return pasien;
};

// --- Status & sisa antrean (baca saja) -----------------------------------------------------------------------
export const statusAntrean = async (faskesUuid, data) => {
  await kredensialSiap(faskesUuid);
  const jadwal = await temukanJadwal(faskesUuid, data);
  const ringkasan = await ringkasanAntrean(faskesUuid, jadwal.jadwal.uuid, tanggalKeEpoch(data.tanggalperiksa));
  return {
    namapoli: jadwal.poli.name,
    namadokter: jadwal.dokter?.name ?? jadwal.jadwal.practitioner_name,
    kuota: ringkasan.kuotaJkn,
    sisaantrean: ringkasan.sisaJkn,
    totalantrean: ringkasan.totalTerdaftar,
  };
};

export const sisaAntrean = async (faskesUuid, data) => {
  await kredensialSiap(faskesUuid);
  if (data.kodebooking) {
    const booking = await bookingTersimpan(faskesUuid, { kodeBooking: data.kodebooking });
    if (!booking) throw new GalatBpjs("Kode booking tidak ditemukan", 404);
    const ringkasan = await ringkasanAntrean(faskesUuid, booking.jadwal_dokter_uuid, booking.tanggal_periksa);
    return { kodebooking: booking.kode_booking, sisaantrean: ringkasan.sisaJkn };
  }
  return statusAntrean(faskesUuid, data);
};

// --- Pembatalan -----------------------------------------------------------------------------------------------
export const batalAntrean = async (faskesUuid, { kodebooking, keterangan }) => {
  await kredensialSiap(faskesUuid);
  const booking = await bookingTersimpan(faskesUuid, { kodeBooking: kodebooking });
  if (!booking) throw new GalatBpjs("Kode booking tidak ditemukan", 404);
  if (booking.status_lokal === "batal") return { kodebooking, status: "batal" };

  await panggilAntrian("DELETE", "/mobile/report-antrian/cancel-booking", {
    faskesUuid,
    body: {
      jadwal_dokter_uuid: booking.jadwal_dokter_uuid,
      jadwal_periksa: epochKeTanggal(booking.tanggal_periksa),
      kode_booking: booking.kode_booking,
      faskes_uuid: faskesUuid,
    },
  });

  // Kunci (uuid) saja bukan bukti kewenangan (KF-5): kondisi pembaruan tetap mengikat faskes dan status aktif,
  // sama seperti pembacaan bookingTersimpan di atas, agar baris faskes lain tidak pernah ikut berubah.
  const dibatalkan = await satu(
    `UPDATE bpjs_antrean_booking SET status_lokal = 'batal', updated_at = $2
     WHERE uuid = $1 AND faskes_uuid = $3 AND deleted_at IS NULL
     RETURNING uuid`,
    [booking.uuid, sekarang(), faskesUuid]
  );
  if (!dibatalkan) throw new GalatBpjs("Kode booking tidak ditemukan", 404);
  await catatTask(faskesUuid, booking, 99);
  await logKirim(faskesUuid, booking.uuid, "batal", null, { keterangan });
  return { kodebooking, status: "batal" };
};

// --- Check-in ---------------------------------------------------------------------------------------------------
export const checkIn = async (faskesUuid, { kodebooking }) => {
  await kredensialSiap(faskesUuid);
  const booking = await bookingTersimpan(faskesUuid, { kodeBooking: kodebooking });
  if (!booking) throw new GalatBpjs("Kode booking tidak ditemukan", 404);
  if (booking.status_lokal === "batal") throw new GalatBpjs("Booking sudah dibatalkan", 409);

  const waktu = sekarang();
  await query(
    `UPDATE admission_rj SET tanggal_checkin = $2 WHERE uuid = $1 AND tanggal_checkin IS NULL`,
    [booking.rawat_jalan_uuid, waktu]
  );
  const tugas = await catatTask(faskesUuid, booking, 1);
  return { kodebooking, checkin: true, waktu, task_id: tugas ? 1 : null };
};

// --- Pasien baru (validasi saja, tidak membuat pasien/pendaftaran) ----------------------------------------------
export const pasienBaru = async (faskesUuid, { nik }) => {
  await kredensialSiap(faskesUuid);
  const pasien = await cariPasienLama(faskesUuid, { identity: "KTP", no_identity: nik });
  return { terdaftar: !!pasien, no_rm: pasien?.no_rm ?? null, nama: pasien?.name ?? null };
};

// --- Jadwal operasi (hanya bila modul Kamar Operasi aktif) -------------------------------------------------------
// Modul aktif = preset segmen, ditimpa override faskes bila ada (pola sama dengan migrasi izin_* lain).
const modulAktif = async (faskesUuid, modulKode) => {
  const preset = await satu(
    `SELECT 1 AS ada FROM faskes_segmen fs JOIN preset_segmen_modul p ON p.segmen_kode = fs.segmen_kode
     WHERE fs.faskes_uuid = $1 AND p.modul_kode = $2`,
    [faskesUuid, modulKode]
  );
  const override = await satu(`SELECT aktif FROM faskes_modul_override WHERE faskes_uuid = $1 AND modul_kode = $2`, [faskesUuid, modulKode]);
  return override ? !!override.aktif : !!preset;
};

export const jadwalOperasi = async (faskesUuid, { tanggal }) => {
  await kredensialSiap(faskesUuid);
  if (!(await modulAktif(faskesUuid, "kamar_operasi"))) throw new GalatBpjs("Modul Kamar Operasi tidak aktif di faskes ini", 422);

  const tgl = tanggal || epochKeTanggal(sekarang());
  const mulai = tanggalKeEpoch(tgl);
  const jadwal = await query(
    `SELECT oj.uuid, oj.waktu_mulai, oj.waktu_selesai, oj.status, r.name AS ruang
     FROM ok_jadwal oj JOIN ruangan r ON r.uuid = oj.ruang_uuid
     WHERE oj.faskes_uuid = $1 AND oj.deleted_at IS NULL AND oj.waktu_mulai >= $2 AND oj.waktu_mulai < $2 + 86400
     ORDER BY oj.waktu_mulai`,
    [faskesUuid, mulai]
  );
  return jadwal.map((j) => ({ uuid: j.uuid, ruang: j.ruang, waktu_mulai: j.waktu_mulai, waktu_selesai: j.waktu_selesai, status: j.status }));
};

// --- Pencatatan task id & jejak pengiriman ------------------------------------------------------------------------
// Dedup memakai kombinasi (faskes, kode_booking, task_id): satu task id dicatat sekali per booking.
export const catatTask = async (faskesUuid, booking, taskId) => {
  const ada = await satu(`SELECT 1 FROM pencatat_task_id WHERE faskes_uuid = $1 AND kode_booking = $2 AND task_id = $3 AND deleted_at IS NULL`, [
    faskesUuid,
    booking.kode_booking,
    taskId,
  ]);
  if (ada) return false;
  const waktu = sekarang();
  await query(
    `INSERT INTO pencatat_task_id (uuid, patient_uuid, faskes_uuid, task_id, kode_booking, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$6)`,
    [crypto.randomUUID(), booking.patient_uuid, faskesUuid, taskId, booking.kode_booking, waktu]
  );
  await logKirim(faskesUuid, booking.uuid, "task", taskId, { waktu });
  return true;
};

export const logKirim = (faskesUuid, bookingUuid, jenis, taskId, payload) =>
  query(
    `INSERT INTO bpjs_antrean_kirim (faskes_uuid, booking_uuid, jenis, task_id, status, payload, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'menunggu',$5,$6,$6)
     ON CONFLICT (booking_uuid, task_id) WHERE jenis = 'task' DO NOTHING`,
    [faskesUuid, bookingUuid, jenis, taskId, JSON.stringify(payload ?? null), sekarang()]
  );

// Kirim satu baris bpjs_antrean_kirim yang masih menunggu/gagal ke WS Antrean (mode mock/nyata sesuai konfigurasi).
export const prosesKirim = async (faskesUuid, kirimUuid) => {
  const kred = await kredensialSiap(faskesUuid);
  const baris = await satu(`SELECT * FROM bpjs_antrean_kirim WHERE uuid = $1 AND faskes_uuid = $2`, [kirimUuid, faskesUuid]);
  if (!baris) throw new GalatBpjs("Data pengiriman tidak ditemukan", 404);
  // Kunci (booking_uuid) saja bukan bukti kewenangan (KF-5): pembacaan booking tetap mengikat faskes yang sedang
  // diproses dan status aktif, supaya booking faskes lain atau yang sudah dihapus tidak pernah ikut dikirim.
  const booking = await satu(
    `SELECT * FROM bpjs_antrean_booking WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`,
    [baris.booking_uuid, faskesUuid]
  );
  if (!booking) {
    const pesan = "Booking tidak ditemukan atau sudah dihapus";
    await query(
      `UPDATE bpjs_antrean_kirim SET status = 'gagal', percobaan = percobaan + 1, pesan = $2, updated_at = $3 WHERE uuid = $1`,
      [kirimUuid, pesan, sekarang()]
    );
    return { status: "gagal", pesan };
  }

  try {
    const respons = await kirimWsAntrean(kred, baris.jenis, `ws/${baris.jenis}`, { kodebooking: booking?.kode_booking, ...baris.payload });
    await query(
      `UPDATE bpjs_antrean_kirim SET status = 'terkirim', percobaan = percobaan + 1, respons = $2, kode_respons = '200', pesan = NULL, updated_at = $3 WHERE uuid = $1`,
      [kirimUuid, JSON.stringify(respons), sekarang()]
    );
    return { status: "terkirim" };
  } catch (error) {
    await query(
      `UPDATE bpjs_antrean_kirim SET status = 'gagal', percobaan = percobaan + 1, kode_respons = $2, pesan = $3, updated_at = $4 WHERE uuid = $1`,
      [kirimUuid, String(error.status ?? ""), String(error.message).slice(0, 500), sekarang()]
    );
    return { status: "gagal", pesan: error.message };
  }
};

export const kirimUlang = async (faskesUuid, kodeBooking, { jenis, task_id: taskId }) => {
  const booking = await bookingTersimpan(faskesUuid, { kodeBooking: kodeBooking });
  if (!booking) throw new GalatBpjs("Kode booking tidak ditemukan", 404);
  const baris = await satu(
    `SELECT * FROM bpjs_antrean_kirim WHERE booking_uuid = $1 AND jenis = $2 AND ${taskId ? "task_id = $3" : "task_id IS NULL"}
     ORDER BY created_at DESC LIMIT 1`,
    taskId ? [booking.uuid, jenis, taskId] : [booking.uuid, jenis]
  );
  if (!baris) throw new GalatBpjs("Tidak ada riwayat pengiriman untuk dicoba ulang", 404);
  return prosesKirim(faskesUuid, baris.uuid);
};

// --- Monitoring -------------------------------------------------------------------------------------------------
export const monitoring = async (faskesUuid, { status, tanggal, page = 1, limit = 20 } = {}) => {
  const kondisi = ["b.faskes_uuid = $1", "b.deleted_at IS NULL"];
  const nilai = [faskesUuid];
  if (status) {
    kondisi.push(`b.status_sinkron = $${nilai.length + 1}`);
    nilai.push(status);
  }
  if (tanggal) {
    kondisi.push(`b.tanggal_periksa = $${nilai.length + 1}`);
    nilai.push(tanggalKeEpoch(tanggal));
  }
  const batas = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * batas;

  const data = await query(
    `SELECT b.uuid, b.kode_booking, b.sumber, b.status_lokal, b.status_sinkron, b.tanggal_periksa, b.rawat_jalan_uuid,
            (SELECT COUNT(*) FROM pencatat_task_id t WHERE t.faskes_uuid = b.faskes_uuid AND t.kode_booking = b.kode_booking AND t.deleted_at IS NULL) AS task_tercatat,
            (SELECT COUNT(*) FROM bpjs_antrean_kirim k WHERE k.booking_uuid = b.uuid AND k.status = 'gagal') AS kirim_gagal
     FROM bpjs_antrean_booking b
     WHERE ${kondisi.join(" AND ")}
     ORDER BY b.created_at DESC LIMIT ${batas} OFFSET ${offset}`,
    nilai
  );
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM bpjs_antrean_booking b WHERE ${kondisi.join(" AND ")}`, nilai);
  return { data, pagination: { page: Number(page) || 1, limit: batas, total: Number(total) } };
};

export const detailBooking = async (faskesUuid, kodeBooking) => {
  const booking = await bookingTersimpan(faskesUuid, { kodeBooking });
  if (!booking) throw new GalatBpjs("Kode booking tidak ditemukan", 404);
  const task = await query(
    `SELECT task_id, created_at FROM pencatat_task_id WHERE faskes_uuid = $1 AND kode_booking = $2 AND deleted_at IS NULL ORDER BY task_id`,
    [faskesUuid, kodeBooking]
  );
  const kirim = await query(
    `SELECT uuid, jenis, task_id, status, percobaan, kode_respons, pesan, created_at, updated_at FROM bpjs_antrean_kirim
     WHERE booking_uuid = $1 ORDER BY created_at DESC`,
    [booking.uuid]
  );
  return { booking, task, kirim };
};

export { PemetaanTidakDitemukan };
