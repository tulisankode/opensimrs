import crypto from "node:crypto";

// Pembentuk resource FHIR R4 sesuai profil SATUSEHAT (alur minimal rawat jalan).
// Fungsi murni: tidak mengakses database maupun jaringan.

const SISTEM = {
  icd10: "http://hl7.org/fhir/sid/icd-10",
  loinc: "http://loinc.org",
  ucum: "http://unitsofmeasure.org",
  actCode: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  participantType: "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
  diagnosisRole: "http://terminology.hl7.org/CodeSystem/diagnosis-role",
  conditionCategory: "http://terminology.hl7.org/CodeSystem/condition-category",
  conditionClinical: "http://terminology.hl7.org/CodeSystem/condition-clinical",
  observationCategory: "http://terminology.hl7.org/CodeSystem/observation-category",
  locationPhysicalType: "http://terminology.hl7.org/CodeSystem/location-physical-type",
  locationMode: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
};

// epoch (detik/milidetik) → ISO 8601 UTC, format yang diterima SATUSEHAT
export const keIso = (epoch) => {
  const n = Number(epoch);
  if (!n) return null;
  return new Date(n > 1e12 ? n : n * 1000).toISOString().replace(/\.\d{3}Z$/, "+00:00");
};

const urn = () => `urn:uuid:${crypto.randomUUID()}`;

// Nama master diagnosis berformat "English~Indonesia": SATUSEHAT memakai display ICD-10 (Inggris)
export const displayIcd10 = (nama) => String(nama ?? "").split("~")[0].trim();

export const buatLocation = ({ orgId, lokasi }) => ({
  resourceType: "Location",
  identifier: [{ system: `http://sys-ids.kemkes.go.id/location/${orgId}`, value: lokasi.code || lokasi.uuid }],
  status: "active",
  name: lokasi.name,
  description: lokasi.description || lokasi.name,
  mode: "instance",
  physicalType: { coding: [{ system: SISTEM.locationPhysicalType, code: "ro", display: "Room" }] },
  managingOrganization: { reference: `Organization/${orgId}` },
});

// Tanda vital → Observation (LOINC). Nilai kosong/0 tidak dikirim.
const TANDA_VITAL = [
  { field: "frekuensi_nadi", kode: "8867-4", nama: "Heart rate", satuan: "/min", kodeSatuan: "/min" },
  { field: "frekuensi_nafas", kode: "9279-1", nama: "Respiratory rate", satuan: "breaths/minute", kodeSatuan: "/min" },
  { field: "tekanan_darah_sistole", kode: "8480-6", nama: "Systolic blood pressure", satuan: "mm[Hg]", kodeSatuan: "mm[Hg]" },
  { field: "tekanan_darah_diastole", kode: "8462-4", nama: "Diastolic blood pressure", satuan: "mm[Hg]", kodeSatuan: "mm[Hg]" },
  { field: "suhu", kode: "8310-5", nama: "Body temperature", satuan: "Cel", kodeSatuan: "Cel" },
];

/**
 * Bundle transaksi kunjungan rawat jalan: Encounter + Condition (diagnosis ICD-10) + Observation (tanda vital).
 * @param {object} p
 * @param {string} p.orgId              ID Organization faskes di SATUSEHAT
 * @param {object} p.kunjungan          { noPelayanan, tanggalDaftar, tanggalPeriksa, tanggalPulang }
 * @param {object} p.pasien             { ihs, nama }
 * @param {object} p.dokter             { ihs, nama }
 * @param {object} p.lokasi             { ihs, nama }
 * @param {Array}  p.diagnosis          [{ kode, nama }] — diagnosis pertama = utama
 * @param {object|null} p.tandaVital    field tanda_vital dari sesi rekam medis
 */
export const buatBundleRawatJalan = ({ orgId, kunjungan, pasien, dokter, lokasi, diagnosis = [], tandaVital = null }) => {
  const mulai = keIso(kunjungan.tanggalDaftar);
  const diperiksa = keIso(kunjungan.tanggalPeriksa) ?? mulai;
  const selesai = keIso(kunjungan.tanggalPulang) ?? diperiksa;
  const encounterUrl = urn();

  const pasienRef = { reference: `Patient/${pasien.ihs}`, display: pasien.nama };
  const dokterRef = { reference: `Practitioner/${dokter.ihs}`, display: dokter.nama };
  const encounterRef = { reference: encounterUrl, display: `Kunjungan ${pasien.nama} ${kunjungan.noPelayanan}` };

  const kondisi = diagnosis.map((d, i) => ({
    fullUrl: urn(),
    rank: i + 1,
    resource: {
      resourceType: "Condition",
      clinicalStatus: { coding: [{ system: SISTEM.conditionClinical, code: "active", display: "Active" }] },
      category: [{ coding: [{ system: SISTEM.conditionCategory, code: "encounter-diagnosis", display: "Encounter Diagnosis" }] }],
      code: { coding: [{ system: SISTEM.icd10, code: d.kode, display: displayIcd10(d.nama) }] },
      subject: pasienRef,
      encounter: encounterRef,
      onsetDateTime: diperiksa,
      recordedDate: diperiksa,
    },
  }));

  const observasi = tandaVital
    ? TANDA_VITAL.filter((t) => Number(tandaVital[t.field]) > 0).map((t) => ({
        fullUrl: urn(),
        resource: {
          resourceType: "Observation",
          status: "final",
          category: [{ coding: [{ system: SISTEM.observationCategory, code: "vital-signs", display: "Vital Signs" }] }],
          code: { coding: [{ system: SISTEM.loinc, code: t.kode, display: t.nama }] },
          subject: pasienRef,
          performer: [{ reference: `Practitioner/${dokter.ihs}` }],
          encounter: encounterRef,
          effectiveDateTime: diperiksa,
          issued: diperiksa,
          valueQuantity: { value: Number(tandaVital[t.field]), unit: t.satuan, system: SISTEM.ucum, code: t.kodeSatuan },
        },
      }))
    : [];

  const encounter = {
    fullUrl: encounterUrl,
    resource: {
      resourceType: "Encounter",
      identifier: [{ system: `http://sys-ids.kemkes.go.id/encounter/${orgId}`, value: kunjungan.noPelayanan }],
      status: "finished",
      class: { system: SISTEM.actCode, code: "AMB", display: "ambulatory" },
      subject: pasienRef,
      participant: [
        {
          type: [{ coding: [{ system: SISTEM.participantType, code: "ATND", display: "attender" }] }],
          individual: dokterRef,
        },
      ],
      period: { start: mulai, end: selesai },
      location: [{ location: { reference: `Location/${lokasi.ihs}`, display: lokasi.nama } }],
      diagnosis: kondisi.map((k) => ({
        condition: { reference: k.fullUrl, display: k.resource.code.coding[0].display },
        use: { coding: [{ system: SISTEM.diagnosisRole, code: "DD", display: "Discharge diagnosis" }] },
        rank: k.rank,
      })),
      statusHistory: [
        { status: "arrived", period: { start: mulai, end: diperiksa } },
        { status: "in-progress", period: { start: diperiksa, end: selesai } },
        { status: "finished", period: { start: selesai, end: selesai } },
      ],
      serviceProvider: { reference: `Organization/${orgId}` },
    },
  };

  const entri = [encounter, ...kondisi, ...observasi].map(({ fullUrl, resource }) => ({
    fullUrl,
    resource,
    request: { method: "POST", url: resource.resourceType },
  }));

  return { resourceType: "Bundle", type: "transaction", entry: entri };
};

// Ambil ID resource dari respons Bundle transaksi, urut sesuai entri yang dikirim
export const idDariRespons = (respons) =>
  (respons?.entry ?? []).map((e) => {
    if (e.response?.resourceID) return { tipe: e.response.resourceType, id: e.response.resourceID };
    const [tipe, id] = String(e.response?.location ?? "").split("/");
    return { tipe, id };
  });
