import { test } from "node:test";
import assert from "node:assert/strict";
import { buatBundleRawatJalan, buatLocation, displayIcd10, idDariRespons, keIso } from "../src/fhir.js";

const dasar = {
  orgId: "100000001",
  kunjungan: { noPelayanan: "RJ2610130001", tanggalDaftar: 1791800000, tanggalPeriksa: 1791801800, tanggalPulang: 1791803600 },
  pasien: { ihs: "P02478375538", nama: "Budi" },
  dokter: { ihs: "N10000001", nama: "dr. Ani" },
  lokasi: { ihs: "b017aa54-f1df-4ec2-9d84-8823815d7228", nama: "Poli Umum" },
  diagnosis: [
    { kode: "J06.9", nama: "Acute upper respiratory infection, unspecified~ISPA" },
    { kode: "K30", nama: "Dyspepsia~Dispepsia" },
  ],
  tandaVital: { frekuensi_nadi: 80, frekuensi_nafas: 20, suhu: 36.7, tekanan_darah_sistole: 120, tekanan_darah_diastole: 0 },
};

test("keIso: epoch detik & milidetik → ISO UTC", () => {
  assert.equal(keIso(1791800000), "2026-10-12T10:13:20+00:00");
  assert.equal(keIso(1791800000000), "2026-10-12T10:13:20+00:00");
  assert.equal(keIso(null), null);
});

test("displayIcd10 memakai bagian Inggris dari nama master", () => {
  assert.equal(displayIcd10("Dyspepsia~Dispepsia"), "Dyspepsia");
});

test("bundle rawat jalan: Encounter + Condition + Observation dengan rujukan benar", () => {
  const b = buatBundleRawatJalan(dasar);
  assert.equal(b.resourceType, "Bundle");
  assert.equal(b.type, "transaction");

  const [enc, ...lain] = b.entry;
  assert.equal(enc.resource.resourceType, "Encounter");
  assert.equal(enc.request.url, "Encounter");
  assert.equal(enc.resource.class.code, "AMB");
  assert.equal(enc.resource.status, "finished");
  assert.deepEqual(enc.resource.identifier[0], { system: "http://sys-ids.kemkes.go.id/encounter/100000001", value: "RJ2610130001" });
  assert.equal(enc.resource.subject.reference, "Patient/P02478375538");
  assert.equal(enc.resource.participant[0].individual.reference, "Practitioner/N10000001");
  assert.equal(enc.resource.location[0].location.reference, "Location/b017aa54-f1df-4ec2-9d84-8823815d7228");
  assert.equal(enc.resource.serviceProvider.reference, "Organization/100000001");
  assert.deepEqual(enc.resource.statusHistory.map((s) => s.status), ["arrived", "in-progress", "finished"]);

  const kondisi = lain.filter((e) => e.resource.resourceType === "Condition");
  assert.equal(kondisi.length, 2);
  assert.equal(kondisi[0].resource.code.coding[0].code, "J06.9");
  assert.equal(kondisi[0].resource.code.coding[0].system, "http://hl7.org/fhir/sid/icd-10");
  assert.equal(kondisi[0].resource.encounter.reference, enc.fullUrl);
  // diagnosis Encounter merujuk Condition dalam bundle, berurutan
  assert.deepEqual(enc.resource.diagnosis.map((d) => [d.condition.reference, d.rank]), kondisi.map((k, i) => [k.fullUrl, i + 1]));

  const obs = lain.filter((e) => e.resource.resourceType === "Observation");
  // diastole bernilai 0 tidak dikirim
  assert.deepEqual(obs.map((o) => o.resource.code.coding[0].code).sort(), ["8310-5", "8480-6", "8867-4", "9279-1"]);
  assert.ok(obs.every((o) => o.resource.encounter.reference === enc.fullUrl));
  assert.ok(b.entry.every((e) => e.fullUrl.startsWith("urn:uuid:")));
});

test("bundle tanpa tanda vital hanya berisi Encounter dan Condition", () => {
  const b = buatBundleRawatJalan({ ...dasar, tandaVital: null });
  assert.deepEqual(b.entry.map((e) => e.resource.resourceType), ["Encounter", "Condition", "Condition"]);
});

test("Location memakai identifier sistem faskes dan managingOrganization", () => {
  const l = buatLocation({ orgId: "100000001", lokasi: { uuid: "u1", code: "POLI-UMUM", name: "Poli Umum" } });
  assert.equal(l.identifier[0].system, "http://sys-ids.kemkes.go.id/location/100000001");
  assert.equal(l.identifier[0].value, "POLI-UMUM");
  assert.equal(l.managingOrganization.reference, "Organization/100000001");
});

test("idDariRespons membaca resourceID atau location", () => {
  const ids = idDariRespons({
    entry: [
      { response: { resourceType: "Encounter", resourceID: "e1" } },
      { response: { location: "Condition/c1/_history/1" } },
    ],
  });
  assert.deepEqual(ids, [{ tipe: "Encounter", id: "e1" }, { tipe: "Condition", id: "c1" }]);
});
