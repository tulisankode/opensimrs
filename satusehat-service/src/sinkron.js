import config from "./config.js";
import { query, satu, mongo, keObjectId, sekarang } from "./db.js";
import { fhir, ambilToken, GalatSatuSehat } from "./klien-satusehat.js";
import { buatBundleRawatJalan, buatLocation, idDariRespons } from "./fhir.js";

const NIK = "https://fhir.kemkes.go.id/id/nik";
const STATUS_RJ_SELESAI = 5;

// Galat yang bisa diperbaiki pengguna (data belum lengkap) — tidak dicoba ulang otomatis sampai data diubah
class DataBelumLengkap extends Error {
  status = 422;
}

// Mode simulasi tidak boleh menulis ID tiruan ke kolom ID SATUSEHAT di database
const simpanId = async (sql, params) => {
  if (config.mode === "mock") return;
  await query(sql, params);
};

export const kredensialFaskes = async (faskesUuid) => {
  const row = await satu(
    `SELECT client_id, client_secret, organization_id, status_satu_sehat
     FROM integrations WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`,
    [faskesUuid]
  );
  return {
    aktif: !!row?.status_satu_sehat,
    clientId: row?.client_id?.trim(),
    clientSecret: row?.client_secret?.trim(),
    orgId: row?.organization_id?.trim(),
  };
};

const pastikanKredensial = (kred) => {
  if (!kred.clientId || !kred.clientSecret || !kred.orgId) {
    throw new DataBelumLengkap("Konfigurasi SATUSEHAT (Client ID, Client Secret, Organization ID) belum lengkap");
  }
};

// --- Pemetaan ID SATUSEHAT (IHS) ---------------------------------------------------------------

const cariIhsByNik = async (kred, resource, nik) => {
  const hasil = await fhir(kred, "GET", `/${resource}?identifier=${encodeURIComponent(`${NIK}|${nik}`)}`);
  return hasil?.entry?.[0]?.resource?.id ?? null;
};

export const pastikanIhsPasien = async (kred, patientUuid) => {
  const p = await satu(
    `SELECT uuid, name, identity, no_identity, satu_sehat_uuid FROM patients WHERE uuid = $1`,
    [patientUuid]
  );
  if (!p) throw new DataBelumLengkap("Data pasien tidak ditemukan");
  if (p.satu_sehat_uuid) return { ihs: p.satu_sehat_uuid, nama: p.name };

  const nik = String(p.no_identity ?? "").replace(/\D/g, "");
  if (!/^ktp$/i.test(String(p.identity ?? "").trim()) || nik.length !== 16) {
    throw new DataBelumLengkap(`Pasien ${p.name} tidak memiliki NIK 16 digit (identitas: ${p.identity || "-"})`);
  }
  const ihs = await cariIhsByNik(kred, "Patient", nik);
  if (!ihs) throw new DataBelumLengkap(`NIK pasien ${p.name} belum terdaftar di SATUSEHAT`);
  await simpanId(`UPDATE patients SET satu_sehat_uuid = $1 WHERE uuid = $2`, [ihs, patientUuid]);
  return { ihs, nama: p.name };
};

export const pastikanIhsDokter = async (kred, practitionerUuid) => {
  const d = await satu(
    `SELECT pr.uuid, pr.satu_sehat_id, pg.name, pg.nik, pg.first_title, pg.last_title
     FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid WHERE pr.uuid = $1`,
    [practitionerUuid]
  );
  if (!d) throw new DataBelumLengkap("Data dokter (DPJP) kunjungan tidak ditemukan");
  const nama = [d.first_title, d.name, d.last_title].filter(Boolean).join(" ");
  if (d.satu_sehat_id) return { ihs: d.satu_sehat_id, nama };

  const nik = String(d.nik ?? "").replace(/\D/g, "");
  if (nik.length !== 16) throw new DataBelumLengkap(`Dokter ${nama} belum memiliki NIK 16 digit di data pegawai`);
  const ihs = await cariIhsByNik(kred, "Practitioner", nik);
  if (!ihs) throw new DataBelumLengkap(`NIK dokter ${nama} belum terdaftar sebagai Practitioner di SATUSEHAT`);
  await simpanId(`UPDATE practitioner SET satu_sehat_id = $1 WHERE uuid = $2`, [ihs, practitionerUuid]);
  return { ihs, nama };
};

export const pastikanLokasi = async (kred, lokasiUuid) => {
  const l = await satu(`SELECT uuid, code, name, description, satu_sehat_id FROM lokasi WHERE uuid = $1`, [lokasiUuid]);
  if (!l) throw new DataBelumLengkap("Lokasi (poli) kunjungan tidak ditemukan");
  if (l.satu_sehat_id) return { ihs: l.satu_sehat_id, nama: l.name };

  const hasil = await fhir(kred, "POST", "/Location", buatLocation({ orgId: kred.orgId, lokasi: l }));
  if (!hasil?.id) throw new GalatSatuSehat("SATUSEHAT tidak mengembalikan ID Location", 502, hasil);
  await simpanId(`UPDATE lokasi SET satu_sehat_id = $1, organization_ihs_number = $2 WHERE uuid = $3`, [hasil.id, kred.orgId, lokasiUuid]);
  return { ihs: hasil.id, nama: l.name };
};

// --- Data klinis dari rekam medis (MongoDB) ------------------------------------------------------

export const dataKlinis = async (rekamMedisUuid) => {
  const id = keObjectId(rekamMedisUuid);
  if (!id) return { diagnosis: [], tandaVital: null };
  const db = await mongo();
  const rm = await db.collection("rekam_medises").findOne({ _id: id });
  if (!rm) return { diagnosis: [], tandaVital: null };

  const sesiIds = (rm.daily_records ?? []).flatMap((r) => r.sessions ?? []);
  const sesi = sesiIds.length
    ? await db.collection("sessions").find({ _id: { $in: sesiIds }, deleted_at: null }).toArray()
    : [];
  // urutan sesi mengikuti urutan di rekam medis
  sesi.sort((a, b) => sesiIds.findIndex((x) => x.equals(a._id)) - sesiIds.findIndex((x) => x.equals(b._id)));

  const uuidDiagnosis = [];
  for (const s of sesi) {
    for (const d of s.diagnosis_dokter ?? []) {
      if (!d.deleted_at && d.diagnosis_uuid && !uuidDiagnosis.includes(d.diagnosis_uuid)) uuidDiagnosis.push(d.diagnosis_uuid);
    }
  }
  const master = uuidDiagnosis.length
    ? await query(`SELECT uuid, code, name FROM diagnosis WHERE uuid = ANY($1::text[])`, [uuidDiagnosis])
    : [];
  const diagnosis = uuidDiagnosis
    .map((u) => master.find((m) => m.uuid === u))
    .filter((m) => m?.code)
    .map((m) => ({ kode: m.code, nama: m.name }));

  const tandaVital = [...sesi].reverse().find((s) => s.tanda_vital && !s.tanda_vital.deleted_at)?.tanda_vital ?? null;
  return { diagnosis, tandaVital };
};

// --- Catatan sinkronisasi ------------------------------------------------------------------------

const simpanCatatan = async ({ faskesUuid, sumber, sumberUuid, noPelayanan, status, encounterId = null, resourceIds = null, pesan = null, tambahPercobaan = true }) => {
  const t = sekarang();
  await query(
    `INSERT INTO satusehat_sinkron (faskes_uuid, sumber, sumber_uuid, no_pelayanan, status, encounter_id, resource_ids, percobaan, pesan, dikirim_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
     ON CONFLICT (faskes_uuid, sumber, sumber_uuid) DO UPDATE SET
       no_pelayanan = EXCLUDED.no_pelayanan, status = EXCLUDED.status,
       encounter_id = COALESCE(EXCLUDED.encounter_id, satusehat_sinkron.encounter_id),
       resource_ids = COALESCE(EXCLUDED.resource_ids, satusehat_sinkron.resource_ids),
       percobaan = satusehat_sinkron.percobaan + $8, pesan = EXCLUDED.pesan,
       dikirim_at = COALESCE(EXCLUDED.dikirim_at, satusehat_sinkron.dikirim_at), updated_at = EXCLUDED.updated_at`,
    [faskesUuid, sumber, sumberUuid, noPelayanan, status, encounterId, resourceIds ? JSON.stringify(resourceIds) : null, tambahPercobaan ? 1 : 0, pesan, status === "terkirim" ? t : null, t]
  );
};

// --- Sinkronisasi kunjungan rawat jalan ---------------------------------------------------------

export const sinkronRawatJalan = async (faskesUuid, rawatJalanUuid, { paksa = false } = {}) => {
  const kunjungan = await satu(
    `SELECT uuid, no_pelayanan, no_rm, patient_uuid, practitioner_uuid, lokasi_uuid, rekam_medis_uuid, status_rj,
            tanggal_daftar, tanggal_checkin, tanggal_periksa, discharge_date
     FROM rawat_jalans WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`,
    [rawatJalanUuid, faskesUuid]
  );
  if (!kunjungan) throw new DataBelumLengkap("Kunjungan rawat jalan tidak ditemukan");

  const catatan = await satu(
    `SELECT status, encounter_id FROM satusehat_sinkron WHERE faskes_uuid = $1 AND sumber = 'rawat_jalan' AND sumber_uuid = $2`,
    [faskesUuid, rawatJalanUuid]
  );
  if (catatan?.status === "terkirim" && !paksa) {
    return { status: "terkirim", encounterId: catatan.encounter_id, pesan: "Sudah terkirim sebelumnya" };
  }
  if (catatan?.status === "terkirim" && catatan.encounter_id) {
    // mengirim ulang Encounter yang sudah ada akan membuat data ganda di SATUSEHAT
    return { status: "terkirim", encounterId: catatan.encounter_id, pesan: "Encounter sudah ada di SATUSEHAT; tidak dikirim ulang" };
  }

  const dasar = { faskesUuid, sumber: "rawat_jalan", sumberUuid: rawatJalanUuid, noPelayanan: kunjungan.no_pelayanan };
  try {
    if (Number(kunjungan.status_rj) !== STATUS_RJ_SELESAI) {
      throw new DataBelumLengkap("Kunjungan belum selesai (discharge)");
    }
    const kred = await kredensialFaskes(faskesUuid);
    pastikanKredensial(kred);

    const [pasien, dokter, lokasi, klinis] = await Promise.all([
      pastikanIhsPasien(kred, kunjungan.patient_uuid),
      pastikanIhsDokter(kred, kunjungan.practitioner_uuid),
      pastikanLokasi(kred, kunjungan.lokasi_uuid),
      dataKlinis(kunjungan.rekam_medis_uuid),
    ]);
    if (!klinis.diagnosis.length) throw new DataBelumLengkap("Diagnosis ICD-10 belum diisi di rekam medis");

    const bundle = buatBundleRawatJalan({
      orgId: kred.orgId,
      kunjungan: {
        noPelayanan: kunjungan.no_pelayanan,
        tanggalDaftar: kunjungan.tanggal_checkin || kunjungan.tanggal_daftar,
        tanggalPeriksa: kunjungan.tanggal_periksa,
        tanggalPulang: kunjungan.discharge_date,
      },
      pasien,
      dokter,
      lokasi,
      diagnosis: klinis.diagnosis,
      tandaVital: klinis.tandaVital,
    });
    const respons = await fhir(kred, "POST", "/", bundle);
    const ids = idDariRespons(respons);
    const encounterId = ids.find((i) => i.tipe === "Encounter")?.id ?? null;
    if (!encounterId) throw new GalatSatuSehat("SATUSEHAT tidak mengembalikan ID Encounter", 502, respons);

    await simpanCatatan({ ...dasar, status: "terkirim", encounterId, resourceIds: ids });
    return { status: "terkirim", encounterId, resource: ids };
  } catch (error) {
    await simpanCatatan({ ...dasar, status: "gagal", pesan: error.message });
    return { status: "gagal", pesan: error.message, dataBelumLengkap: error instanceof DataBelumLengkap };
  }
};

// --- Pekerja otomatis ------------------------------------------------------------------------------

export const jalankanPekerja = async (hanyaFaskes = null) => {
  const faskesAktif = await query(
    `SELECT DISTINCT faskes_uuid FROM integrations
     WHERE status_satu_sehat = true AND deleted_at IS NULL AND ($1::text IS NULL OR faskes_uuid = $1)`,
    [hanyaFaskes]
  );
  const ringkasan = [];
  for (const { faskes_uuid } of faskesAktif) {
    const batas = sekarang() - config.pekerjaRentangHari * 86400;
    const antrean = await query(
      `SELECT rj.uuid FROM rawat_jalans rj
       LEFT JOIN satusehat_sinkron s ON s.faskes_uuid = rj.faskes_uuid AND s.sumber = 'rawat_jalan' AND s.sumber_uuid = rj.uuid
       WHERE rj.faskes_uuid = $1 AND rj.deleted_at IS NULL AND rj.status_rj = $2 AND rj.discharge_date >= $3
         AND (s.id IS NULL OR (s.status = 'gagal' AND s.percobaan < $4))
       ORDER BY rj.discharge_date LIMIT 50`,
      [faskes_uuid, STATUS_RJ_SELESAI, batas, config.maksPercobaan]
    );
    let terkirim = 0;
    let gagal = 0;
    for (const { uuid } of antrean) {
      const hasil = await sinkronRawatJalan(faskes_uuid, uuid);
      hasil.status === "terkirim" ? terkirim++ : gagal++;
    }
    ringkasan.push({ faskesUuid: faskes_uuid, diproses: antrean.length, terkirim, gagal });
  }
  return ringkasan;
};

// --- Uji koneksi ---------------------------------------------------------------------------------

export const ujiKoneksi = async (faskesUuid) => {
  const kred = await kredensialFaskes(faskesUuid);
  pastikanKredensial(kred);
  await ambilToken(kred, { paksa: true });
  const org = await fhir(kred, "GET", `/Organization/${kred.orgId}`);
  return {
    mode: config.mode,
    lingkungan: config.lingkungan,
    aktif: kred.aktif,
    organisasi: { id: org?.id ?? kred.orgId, nama: org?.name ?? null },
  };
};

export { DataBelumLengkap };
