import { test } from "node:test";
import assert from "node:assert/strict";
import { buatRegistrasi, pesanGalatLis, petakanHasil } from "../src/lis/lis-peta.js";

const order = {
  no_order: "LPK9TCX",
  no_rm: "00-10-06",
  cito: false,
  payment_method: 1,
  diagnosis: null,
  keluhan_utama: "Demam",
  catatan: "-",
  dokter_pengirim_uuid: "dok-1",
  dokterPengirim: { pegawai: { first_title: "Dr.", name: "Jhordania", last_title: "Sp.PA" } },
  lokasi: { name: "Poli Dalam" },
  lokasi_kode: "K6",
  patient: {
    name: "Diana Roses", gender: "Female", phone: "0812", noIdentity: "9999010101010004",
    address: { full_address: "Jalan", provData: { name: "SUMATERA BARAT" }, cityData: { name: "KAB. SIJUNJUNG" }, districtData: { name: "Kamang Baru" } },
    birth_detail: { birth_date: "2025-09-29T00:00:00.000Z" },
  },
  order_lab_pemeriksaan: [{ tarif_lab: { code: "LAB-001", name: "Darah Rutin" } }, { tarif_lab: null }],
};

test("registrasi adamLIS: struktur & isian sesuai dokumentasi bridging_sim_rs", () => {
  const r = buatRegistrasi(order, { kode_rs: "RS02" });
  assert.deepEqual(r.registrasi, { no_registrasi: "LPK9TCX", diagnosa_awal: "-", keterangan_klinis: "Demam", kode_rs: "RS02" });
  assert.equal(r.pasien.jenis_kelamin, "P");
  assert.equal(r.pasien.tanggal_lahir, "2025-09-29");
  assert.equal(r.pasien.jenis_registrasi, "Reguler");
  assert.equal(r.pasien.m_kecamatan_id, "Kamang Baru");
  assert.equal(r.nama_dokter_pengirim, "Dr. Jhordania Sp.PA");
  assert.equal(r.kode_unit_asal, "K6");
  assert.equal(r.kode_penjamin, "UMUM");
  assert.deepEqual(r.tindakan, [{ kode_tindakan: "LAB-001", nama_tindakan: "Darah Rutin" }]);
  assert.equal(buatRegistrasi({ ...order, cito: true }, {}).pasien.jenis_registrasi, "Cito");
});

test("pesan galat LIS: teks atau daftar belum dimappingkan", () => {
  assert.equal(pesanGalatLis({ message: "x-api-key salah" }, 401), "x-api-key salah");
  assert.equal(
    pesanGalatLis({ message: [{ value: "1", msg: "Data Tindakan Darah Lengkap(1)Belum Dimappingkan" }, { value: "2", msg: "Data Tindakan SGOT(2)Belum Dimappingkan" }] }, 500),
    "Data Tindakan Darah Lengkap(1)Belum Dimappingkan; Data Tindakan SGOT(2)Belum Dimappingkan"
  );
  assert.match(pesanGalatLis(null, 502), /HTTP 502/);
  assert.equal(
    pesanGalatLis({ success: false, message: "Data gagal disimpan", code: 500, description: "Cannot read properties of undefined (reading 'tanggal_lahir')" }, 200),
    "Data gagal disimpan: Cannot read properties of undefined (reading 'tanggal_lahir')"
  );
});

test("hasil LIS dipetakan: kode LIS → kode item → nama item; sisanya dilaporkan", () => {
  const obs = [
    { uuid: "a", item_kode_lis: "RBC", item_kode: "ER", item_nama: "Erittosit" },
    { uuid: "b", item_kode_lis: null, item_kode: "MC", item_nama: "MCV" },
    { uuid: "c", item_kode_lis: null, item_kode: "HGB", item_nama: "Hemoglobin" },
  ];
  const { hasil, tidakTerpetakan } = petakanHasil(
    [
      { kode_pemeriksaan_lis: "RBC", nama_pemeriksaan_lis: "Eritrosit", hasil: { nilai_hasil: "4.8", flag_kode: "N" } },
      { kode_pemeriksaan_lis: "MCV", nama_pemeriksaan_lis: "mcv", hasil: { nilai_hasil: 104, flag_kode: "h" } },
      { kode_pemeriksaan_lis: "hgb", nama_pemeriksaan_lis: "Hb", hasil: { nilai_hasil: "13" } },
      { kode_pemeriksaan_lis: "PLT", nama_pemeriksaan_lis: "Trombosit", hasil: { nilai_hasil: "250" } },
    ],
    obs
  );
  assert.deepEqual(hasil, [
    { observation_item_uuid: "a", result: "4.8", flag_lis: "N" },
    { observation_item_uuid: "b", result: "104", flag_lis: "H" },
    { observation_item_uuid: "c", result: "13", flag_lis: null },
  ]);
  assert.deepEqual(tidakTerpetakan, [{ kode: "PLT", nama: "Trombosit", nilai: "250" }]);
});
