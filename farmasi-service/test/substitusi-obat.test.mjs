// Uji aturan Substitusi Obat Resep Dokter (repositori dipalsukan, tanpa basis data).
// Jalankan: TZ=UTC node --test test/substitusi-obat.test.mjs (berkas .mjs tidak diambil jest).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import PrescriptionHelper from "../src/helpers/prescriptionHelper.js";
import PrescriptionService from "../src/services/prescription-service.js";
import PrescriptionRepository from "../src/repositories/prescription-repository.js";
import PrescriptionValidation from "../src/validations/prescription-validation.js";
import DataMasterItemMedisRepository from "../src/repositories/datamaster-item-medis-repository.js";
import KonfigurasiHargaService from "../src/services/konfigurasi-harga-service.js";

const F = "faskes-1";
const author = { faskesUuid: F, username: "apoteker.uji" };
const body = {
  prescription_item_uuid: "item-1",
  item_medis_uuid: "obat-b",
  jenis_stok_uuid: "umum",
  medication_qty: 10,
  kategori_alasan: "stok_kosong",
  alasan: "Stok kosong di depo",
};

let catat;
let status;
let item;
let stok;
beforeEach(() => {
  catat = { log: null, update: null, commit: 0, rollback: 0 };
  status = PrescriptionHelper.STATUS.RESEP_MASUK;
  item = { uuid: "item-1", prescription_uuid: "resep-1", faskes_uuid: F, item_medis_uuid: "obat-a", jenis_stok_uuid: "umum", medication_qty: 10, is_compound: false, medication_dose_qty: 1, aturan_pakai_uuid: "ap" };
  stok = [{ item_medis_uuid: "obat-b", name: "Obat B", jenis_stok: "Umum", sisa_stok: 25 }];
  sequelizeInstance.transaction = async () => ({ commit: async () => catat.commit++, rollback: async () => catat.rollback++, LOCK: { UPDATE: "UPDATE" } });
  PrescriptionRepository.getPrescriptionItemByUuid = async () => item;
  PrescriptionRepository.lockPrescription = async (uuid, faskes) => (faskes === F ? { uuid, order_status: status } : null);
  PrescriptionRepository.getByUuid = async () => ({ lokasi_stok_uuid: "depo-rj" });
  PrescriptionRepository.getStokObatDiLokasi = async () => stok;
  PrescriptionRepository.createSubstitutionLog = async (d) => (catat.log = d);
  PrescriptionRepository.updatePrescriptionItem = async (uuid, d) => (catat.update = d);
  DataMasterItemMedisRepository.getPrice = async () => ({ detail_harga: [{ harga_avg: 900, harga_terakhir: 1000 }] });
  KonfigurasiHargaService.get = async () => ({ metode_hpp: "avg" });
});

test("substitusi status 1–2 mengganti obat item & mencatat obat asal", async () => {
  for (const s of [PrescriptionHelper.STATUS.RESEP_MASUK, PrescriptionHelper.STATUS.SUDAH_DITELAAH]) {
    status = s;
    await PrescriptionService.substituteItem({ ...body }, author);
    assert.equal(catat.log.item_medis_asal_uuid, "obat-a");
    assert.equal(catat.log.item_medis_uuid, "obat-b");
    assert.equal(catat.log.petugas, "apoteker.uji");
    assert.equal(catat.log.harga_satuan, 900);
    assert.equal(catat.log.data_asal.aturan_pakai_uuid, "ap");
    assert.deepEqual(catat.update, { item_medis_uuid: "obat-b", jenis_stok_uuid: "umum", medication_qty: 10, sisa_qty_order: 10, harga_satuan: null });
  }
  assert.equal(catat.commit, 2);
});

test("substitusi ditolak setelah verifikasi (stok & tagihan sudah terbentuk)", async () => {
  for (const s of [3, 4, 5, 6, 0]) {
    status = s;
    await assert.rejects(PrescriptionService.substituteItem({ ...body }, author), /order status tidak memungkinkan/);
  }
  assert.equal(catat.log, null);
});

test("stok pengganti kurang / tidak ada di depo ditolak", async () => {
  stok = [{ ...stok[0], sisa_stok: 5 }];
  await assert.rejects(PrescriptionService.substituteItem({ ...body }, author), /tidak mencukupi/);
  stok = [];
  await assert.rejects(PrescriptionService.substituteItem({ ...body }, author), /tidak tersedia/);
  assert.equal(catat.log, null);
});

test("item faskes lain = 404; racikan & obat sama ditolak", async () => {
  item = { ...item, faskes_uuid: "faskes-lain" };
  await assert.rejects(PrescriptionService.substituteItem({ ...body }, author), (e) => e.constructor.name === "NotfoundException");
  item = { ...item, faskes_uuid: F, is_compound: true };
  await assert.rejects(PrescriptionService.substituteItem({ ...body }, author), /racikan/);
  item = { ...item, is_compound: false };
  await assert.rejects(PrescriptionService.substituteItem({ ...body, item_medis_uuid: "obat-a" }, author), /sama/);
});

test("validasi: alasan & kategori wajib; persetujuan dokter butuh nama dokter", () => {
  const V = PrescriptionValidation.SUBSTITUTE_PRESCRIPTION_ITEM;
  assert.equal(V.safeParse({ ...body, alasan: "  " }).success, false);
  assert.equal(V.safeParse({ ...body, kategori_alasan: "x" }).success, false);
  assert.equal(V.safeParse({ ...body, medication_qty: 0 }).success, false);
  assert.equal(V.safeParse({ ...body, persetujuan_dokter: true }).success, false);
  assert.equal(V.safeParse({ ...body, persetujuan_dokter: true, dokter_penyetuju: "dr. Uji" }).success, true);
  // kolom harga/faskes dari klien dibuang
  assert.equal(V.parse({ ...body, harga_satuan: 1, faskes_uuid: "x" }).harga_satuan, undefined);
});

test("riwayat substitusi ditempel per item: penanda obat asal pertama", () => {
  const resep = { obat_items: [{ uuid: "item-1" }, { uuid: "item-2" }] };
  PrescriptionHelper.lampirkanSubstitusi(resep, [
    { prescription_item_uuid: "item-1", nama_obat_asal: "Obat A", kategori_alasan: "stok_kosong" },
    { prescription_item_uuid: "item-1", nama_obat_asal: "Obat B", kategori_alasan: "permintaan_pasien" },
  ]);
  assert.equal(resep.obat_items[0].substitusi_dari, "Obat A");
  assert.equal(resep.obat_items[0].substitusi.length, 2);
  assert.equal(resep.obat_items[0].substitusi[1].kategori_alasan_label, "Permintaan pasien");
  assert.equal(resep.obat_items[1].substitusi_dari, null);
  assert.equal(resep.riwayat_substitusi.length, 2);
});
