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
let menunggu;
let logTersimpan;
beforeEach(() => {
  catat = { log: null, update: null, ubahLog: null, commit: 0, rollback: 0 };
  menunggu = 0;
  logTersimpan = null;
  status = PrescriptionHelper.STATUS.RESEP_MASUK;
  item = { uuid: "item-1", prescription_uuid: "resep-1", faskes_uuid: F, item_medis_uuid: "obat-a", jenis_stok_uuid: "umum", medication_qty: 10, is_compound: false, medication_dose_qty: 1, aturan_pakai_uuid: "ap" };
  stok = [{ item_medis_uuid: "obat-b", name: "Obat B", jenis_stok: "Umum", sisa_stok: 25 }];
  sequelizeInstance.transaction = async () => ({ commit: async () => catat.commit++, rollback: async () => catat.rollback++, LOCK: { UPDATE: "UPDATE" } });
  PrescriptionRepository.getPrescriptionItemByUuid = async () => item;
  PrescriptionRepository.lockPrescription = async (uuid, faskes) => (faskes === F ? { uuid, order_status: status } : null);
  PrescriptionRepository.getByUuid = async () => ({ lokasi_stok_uuid: "depo-rj" });
  PrescriptionRepository.getStokObatDiLokasi = async () => stok;
  PrescriptionRepository.createSubstitutionLog = async (d) => (catat.log = { uuid: "sub-1", ...d });
  PrescriptionRepository.countSubstitusiMenunggu = async () => menunggu;
  PrescriptionRepository.lockSubstitusi = async (uuid, faskes) => (faskes === F ? logTersimpan : null);
  PrescriptionRepository.updateSubstitusi = async (uuid, d) => (catat.ubahLog = d);
  PrescriptionRepository.updatePrescriptionItem = async (uuid, d) => (catat.update = d);
  DataMasterItemMedisRepository.getPrice = async () => ({ detail_harga: [{ harga_avg: 900, harga_terakhir: 1000 }] });
  KonfigurasiHargaService.get = async () => ({ metode_hpp: "avg" });
});

const lisan = { mode: "konfirmasi_lisan", dokter_penyetuju: "dr. Uji", cara_konfirmasi: "telepon" };

test("pengajuan (bawaan) dicatat menunggu dokter: obat di resep belum diganti", async () => {
  const hasil = await PrescriptionService.substituteItem({ ...body }, author);
  assert.equal(hasil.status, "menunggu");
  assert.equal(catat.log.status, "menunggu");
  assert.equal(catat.log.persetujuan_dokter, false);
  assert.equal(catat.log.dokter_penyetuju, null);
  assert.deepEqual(catat.log.perubahan, { item_medis_uuid: "obat-b", jenis_stok_uuid: "umum", medication_qty: 10, sisa_qty_order: 10, harga_satuan: null });
  assert.equal(catat.update, null);
  assert.equal(catat.commit, 1);
});

test("item yang masih punya pengajuan menunggu tidak bisa diajukan lagi", async () => {
  menunggu = 1;
  await assert.rejects(PrescriptionService.substituteItem({ ...body }, author), /menunggu persetujuan dokter/);
  await assert.rejects(PrescriptionService.substituteItem({ ...body, ...lisan }, author), /menunggu persetujuan dokter/);
  assert.equal(catat.log, null);
});

test("konfirmasi lisan status 1–2 langsung mengganti obat item & mencatat obat asal", async () => {
  for (const s of [PrescriptionHelper.STATUS.RESEP_MASUK, PrescriptionHelper.STATUS.SUDAH_DITELAAH]) {
    status = s;
    await PrescriptionService.substituteItem({ ...body, ...lisan }, author);
    assert.equal(catat.log.status, "disetujui_lisan");
    assert.equal(catat.log.dokter_penyetuju, "dr. Uji");
    assert.equal(catat.log.cara_konfirmasi, "telepon");
    assert.ok(catat.log.waktu_konfirmasi > 0);
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

test("validasi: alasan & kategori wajib; konfirmasi lisan butuh nama dokter & cara konfirmasi", () => {
  const V = PrescriptionValidation.SUBSTITUTE_PRESCRIPTION_ITEM;
  assert.equal(V.safeParse({ ...body, alasan: "  " }).success, false);
  assert.equal(V.safeParse({ ...body, kategori_alasan: "x" }).success, false);
  assert.equal(V.safeParse({ ...body, medication_qty: 0 }).success, false);
  assert.equal(V.parse({ ...body }).mode, "ajukan");
  assert.equal(V.safeParse({ ...body, mode: "konfirmasi_lisan", cara_konfirmasi: "telepon" }).success, false);
  assert.equal(V.safeParse({ ...body, mode: "konfirmasi_lisan", dokter_penyetuju: "dr. Uji" }).success, false);
  assert.equal(V.safeParse({ ...body, ...lisan }).success, true);
  assert.equal(V.safeParse({ ...body, mode: "langsung" }).success, false);
  // kolom harga/faskes dari klien dibuang
  assert.equal(V.parse({ ...body, harga_satuan: 1, faskes_uuid: "x" }).harga_satuan, undefined);
});

const pengajuan = (tambahan = {}) => ({
  uuid: "sub-1", faskes_uuid: F, prescription_uuid: "resep-1", prescription_item_uuid: "item-1",
  item_medis_asal_uuid: "obat-a", item_medis_uuid: "obat-b", jenis_stok_uuid: "umum", medication_qty: 10,
  status: "menunggu", perubahan: { item_medis_uuid: "obat-b", jenis_stok_uuid: "umum", medication_qty: 10, sisa_qty_order: 10, harga_satuan: null },
  ...tambahan,
});
const dokter = { faskesUuid: F, username: "dr.uji" };

test("dokter menyetujui pengajuan: obat item diganti & keputusan tercatat", async () => {
  logTersimpan = pengajuan();
  const hasil = await PrescriptionService.setujuiSubstitusi("sub-1", dokter);
  assert.equal(hasil.status, "disetujui");
  assert.deepEqual(catat.update, logTersimpan.perubahan);
  assert.equal(catat.ubahLog.status, "disetujui");
  assert.equal(catat.ubahLog.diputuskan_oleh, "dr.uji");
  assert.equal(catat.ubahLog.persetujuan_dokter, true);
  assert.equal(catat.ubahLog.harga_satuan, 900);
});

test("persetujuan ditolak bila resep sudah diverifikasi, obat sudah berubah, atau stok tidak cukup", async () => {
  logTersimpan = pengajuan();
  status = PrescriptionHelper.STATUS.OBAT_DISIAPKAN;
  await assert.rejects(PrescriptionService.setujuiSubstitusi("sub-1", dokter), /order status tidak memungkinkan/);
  status = PrescriptionHelper.STATUS.SUDAH_DITELAAH;
  item = { ...item, item_medis_uuid: "obat-c" };
  await assert.rejects(PrescriptionService.setujuiSubstitusi("sub-1", dokter), /sudah berubah/);
  item = { ...item, item_medis_uuid: "obat-a" };
  stok = [{ ...stok[0], sisa_stok: 3 }];
  await assert.rejects(PrescriptionService.setujuiSubstitusi("sub-1", dokter), /tidak mencukupi/);
  assert.equal(catat.update, null);
  assert.equal(catat.ubahLog, null);
});

test("konfirmasi lisan diverifikasi dokter tanpa mengubah resep lagi; tidak bisa dua kali", async () => {
  logTersimpan = pengajuan({ status: "disetujui_lisan" });
  const hasil = await PrescriptionService.setujuiSubstitusi("sub-1", dokter);
  assert.equal(hasil.diverifikasi, true);
  assert.equal(catat.ubahLog.diverifikasi_oleh, "dr.uji");
  assert.equal(catat.update, null);
  logTersimpan = pengajuan({ status: "disetujui_lisan", diverifikasi_at: 1 });
  await assert.rejects(PrescriptionService.setujuiSubstitusi("sub-1", dokter), /sudah diverifikasi/);
});

test("tolak (dokter) & batal (apoteker) hanya untuk pengajuan menunggu; alasan tolak wajib", async () => {
  logTersimpan = pengajuan();
  await assert.rejects(PrescriptionService.tolakSubstitusi("sub-1", { alasan_tolak: " " }, dokter), (e) =>
    e.errors?.some((x) => /Alasan penolakan/.test(x.message))
  );
  const tolak = await PrescriptionService.tolakSubstitusi("sub-1", { alasan_tolak: "Pasien alergi" }, dokter);
  assert.equal(tolak.status, "ditolak");
  assert.equal(catat.ubahLog.alasan_tolak, "Pasien alergi");
  assert.equal(catat.update, null);
  logTersimpan = pengajuan({ status: "disetujui" });
  await assert.rejects(PrescriptionService.batalSubstitusi("sub-1", author), /Hanya pengajuan yang menunggu/);
  await assert.rejects(PrescriptionService.setujuiSubstitusi("sub-1", dokter), /sudah diputuskan/);
  logTersimpan = null;
  await assert.rejects(PrescriptionService.batalSubstitusi("sub-1", author), (e) => e.constructor.name === "NotfoundException");
});

test("riwayat: penanda obat asal hanya dari substitusi yang diterapkan; pengajuan menunggu ditandai", () => {
  const resep = { obat_items: [{ uuid: "item-1" }] };
  PrescriptionHelper.lampirkanSubstitusi(resep, [
    { prescription_item_uuid: "item-1", nama_obat_asal: "Obat A", kategori_alasan: "stok_kosong", status: "ditolak" },
    { prescription_item_uuid: "item-1", nama_obat_asal: "Obat A", kategori_alasan: "stok_kosong", status: "menunggu" },
  ]);
  assert.equal(resep.obat_items[0].substitusi_dari, null);
  assert.equal(resep.obat_items[0].substitusi_menunggu.status_label, "Menunggu persetujuan dokter");
  assert.equal(resep.obat_items[0].substitusi[0].status_label, "Ditolak dokter");
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
