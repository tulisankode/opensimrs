import express from "express";
import DatamasterSatuanController from "../controllers/datamaster-satuan-controller.js";
import DatamasterBentukSediaanController from "../controllers/datamaster-bentuk-sediaan-controller.js";
import DatamasterKategoriObatController from "../controllers/datamaster-kategori-obat-controller.js";
import DatamasterManufactureController from "../controllers/datamaster-manufacture-controller.js";
import DatamasterCaraPakaiController from "../controllers/datamaster-cara-pakai-controller.js";
import DatamasterJenisStokController from "../controllers/datamaster-jenis-stok-controller.js";
import DatamasterLokasiStokController from "../controllers/datamaster-lokasi-stok-controller.js";
import DatamasterAturanPakaiController from "../controllers/datamaster-aturan-pakai-controller.js";
import DatamasterIngredientController from "../controllers/datamaster-ingredient-controller.js";
import KonfigurasiHargaController from "../controllers/konfigurasi-harga-controller.js";
import DatamasterBentukRacikanController from "../controllers/datamaster-bentuk-racikan-controller.js";
import DatamasterItemMedisController from "../controllers/datamaster-item-medis-controller.js";
import PrescriptionController from "../controllers/prescription-controller.js";
import PenjualanObatController from "../controllers/penjualan-obat-controller.js";
import AlkesController from "../controllers/alkes-controller.js";
import ReturController from "../controllers/retur-controller.js";
import RiwayatController from "../controllers/riwayat-controller.js";
import ReportController from "../controllers/report-controller.js";
import permissionSdk, { permissionAny } from "../middlewares/permission-middleware.js";

const apiBase = process.env.API_BASE || "api";
const apiVersion = process.env.API_VERSION || "v3";
const baseUrl = `/${apiBase}/${apiVersion}/farmasi`;

const routes = express.Router();
const farmasiPermission = (submodule, action = "READ", feature = null) =>
  permissionSdk("Farmasi", submodule, action, feature);

// Order alkes dari rekam medis pasien: izin Farmasi Ruangan ATAU izin "Alkes dan Penunjang" di RME
// Rawat Jalan / Detail Pasien Rawat Inap & IGD (nama fitur & aksi di katalog berbeda per modul).
const AKSI_ALKES_RM = {
  baca: { rj: ["READ"], ri: ["READ"] },
  order: {
    rj: ["CREATE ALKES", "CREATE ALKES MULTIPLE", "SIMPAN ORDER"],
    ri: ["ORDER ALKES CREATE ALKES", "ORDER ALKES CREATE ALKES MULTIPLE", "ORDER ALKES CREATE OBAT MULTIPLE", "ORDER ALKES SIMPAN ORDER"],
  },
  hapusItem: {
    rj: ["DELETE LIST ALKES", "DELETE LIST ALKES MULTIPLE"],
    ri: ["ORDER ALKES DELETE ALKES", "ORDER ALKES DELETE MULTIPLE", "ORDER ALKES DELETE ALKES MULTIPLE"],
  },
  batal: { rj: ["DELETE SEMUA"], ri: ["ORDER ALKES DELETE SEMUA"] },
};
const alkesPermission = (aksiFarmasi, jenisRm) =>
  permissionAny([
    { module: "Farmasi", submodule: "Farmasi Ruangan", action: aksiFarmasi },
    { module: "Rawat Jalan", submodule: "RME", feature: "Akses Dan Penunjang", action: AKSI_ALKES_RM[jenisRm].rj },
    { module: "Rawat Jalan", submodule: "RME", feature: "Alkes Dan Penunjang", action: AKSI_ALKES_RM[jenisRm].rj },
    { module: "Rawat Inap", submodule: "Detail Pasien", feature: "Alkes Dan Penunjang", action: AKSI_ALKES_RM[jenisRm].ri },
    { module: "IGD", submodule: "Detail Pasien", feature: "Alkes Dan Penunjang", action: AKSI_ALKES_RM[jenisRm].ri },
  ]);

// HEALTH CHECK
routes.get(`${baseUrl}/health`, (req, res) =>
  res.status(200).json({ message: "OK" })
);

// DATAMASTTER - SATUAN
routes.post(
  `${baseUrl}/datamaster/satuan`,
  farmasiPermission("Datamaster", "CREATE", "Satuan"),
  DatamasterSatuanController.create
);
routes.get(
  `${baseUrl}/datamaster/satuan`,
  farmasiPermission("Datamaster", "READ", "Satuan"),
  DatamasterSatuanController.getAll
);
routes.put(
  `${baseUrl}/datamaster/satuan/:uuid`,
  farmasiPermission("Datamaster", "UPDATE", "Satuan"),
  DatamasterSatuanController.update
);
routes.delete(
  `${baseUrl}/datamaster/satuan/:uuid`,
  farmasiPermission("Datamaster", "DELETE", "Satuan"),
  DatamasterSatuanController.delete
);
routes.post(
  `${baseUrl}/datamaster/satuan/import`,
  farmasiPermission("Datamaster", "IMPORT", "Satuan"),
  DatamasterSatuanController.import
);
routes.get(
  `${baseUrl}/datamaster/satuan/export`,
  farmasiPermission("Datamaster", "EXPORT", "Satuan"),
  DatamasterSatuanController.getAll
);

// DATAMASTER - BENTUK SEDIAAN
routes.post(
  `${baseUrl}/datamaster/bentuk-sediaan`,
  DatamasterBentukSediaanController.create
);
routes.get(
  `${baseUrl}/datamaster/bentuk-sediaan`,
  DatamasterBentukSediaanController.getAll
);
routes.put(
  `${baseUrl}/datamaster/bentuk-sediaan/:uuid`,
  DatamasterBentukSediaanController.update
);
routes.delete(
  `${baseUrl}/datamaster/bentuk-sediaan/:uuid`,
  DatamasterBentukSediaanController.delete
);
routes.post(
  `${baseUrl}/datamaster/bentuk-sediaan/import`,
  DatamasterBentukSediaanController.import
);
routes.get(
  `${baseUrl}/datamaster/bentuk-sediaan/export`,
  DatamasterBentukSediaanController.getAll
);

// DATAMASTER - KATEGORI OBAT
routes.post(
  `${baseUrl}/datamaster/kategori-obat`,
  DatamasterKategoriObatController.create
);
routes.get(
  `${baseUrl}/datamaster/kategori-obat`,
  DatamasterKategoriObatController.getAll
);
routes.put(
  `${baseUrl}/datamaster/kategori-obat/:uuid`,
  DatamasterKategoriObatController.update
);
routes.delete(
  `${baseUrl}/datamaster/kategori-obat/:uuid`,
  DatamasterKategoriObatController.delete
);
routes.post(
  `${baseUrl}/datamaster/kategori-obat/import`,
  DatamasterKategoriObatController.import
);
routes.get(
  `${baseUrl}/datamaster/kategori-obat/export`,
  DatamasterKategoriObatController.getAll
);

// DATAMASTER - MANUFACTURE
routes.post(
  `${baseUrl}/datamaster/manufacture`,
  DatamasterManufactureController.create
);
routes.get(
  `${baseUrl}/datamaster/manufacture`,
  DatamasterManufactureController.getAll
);
routes.put(
  `${baseUrl}/datamaster/manufacture/:uuid`,
  DatamasterManufactureController.update
);
routes.delete(
  `${baseUrl}/datamaster/manufacture/:uuid`,
  DatamasterManufactureController.delete
);
routes.post(
  `${baseUrl}/datamaster/manufacture/import`,
  DatamasterManufactureController.import
);
routes.get(
  `${baseUrl}/datamaster/manufacture/export`,
  DatamasterManufactureController.export
);

// DATAMASTER - CARA PAKAI
routes.post(
  `${baseUrl}/datamaster/cara-pakai`,
  DatamasterCaraPakaiController.create
);
routes.get(
  `${baseUrl}/datamaster/cara-pakai`,
  DatamasterCaraPakaiController.getAll
);
routes.put(
  `${baseUrl}/datamaster/cara-pakai/:uuid`,
  DatamasterCaraPakaiController.update
);
routes.delete(
  `${baseUrl}/datamaster/cara-pakai/:uuid`,
  DatamasterCaraPakaiController.delete
);
routes.post(
  `${baseUrl}/datamaster/cara-pakai/import`,
  DatamasterCaraPakaiController.import
);
routes.get(
  `${baseUrl}/datamaster/cara-pakai/export`,
  DatamasterCaraPakaiController.getAll
);

// DATAMASTER - JENIS STOK
routes.post(
  `${baseUrl}/datamaster/jenis-stok`,
  DatamasterJenisStokController.create
);
routes.get(
  `${baseUrl}/datamaster/jenis-stok`,
  DatamasterJenisStokController.getAll
);
routes.put(
  `${baseUrl}/datamaster/jenis-stok/:uuid`,
  DatamasterJenisStokController.update
);
routes.delete(
  `${baseUrl}/datamaster/jenis-stok/:uuid`,
  DatamasterJenisStokController.delete
);
routes.post(
  `${baseUrl}/datamaster/jenis-stok/import`,
  DatamasterJenisStokController.import
);
routes.get(
  `${baseUrl}/datamaster/jenis-stok/export`,
  DatamasterJenisStokController.getAll
);

// DATAMASTER - LOKASI STOK
routes.post(
  `${baseUrl}/datamaster/lokasi-stok`,
  DatamasterLokasiStokController.create
);
routes.get(
  `${baseUrl}/datamaster/lokasi-stok`,
  DatamasterLokasiStokController.getAll
);
routes.put(
  `${baseUrl}/datamaster/lokasi-stok/:uuid`,
  DatamasterLokasiStokController.update
);
routes.delete(
  `${baseUrl}/datamaster/lokasi-stok/:uuid`,
  DatamasterLokasiStokController.delete
);
routes.post(
  `${baseUrl}/datamaster/lokasi-stok/import`,
  DatamasterLokasiStokController.import
);
routes.get(
  `${baseUrl}/datamaster/lokasi-stok/export`,
  DatamasterLokasiStokController.export
);

// DATAMASTER - ATURAN PAKAI
routes.post(
  `${baseUrl}/datamaster/aturan-pakai`,
  DatamasterAturanPakaiController.create
);
routes.get(
  `${baseUrl}/datamaster/aturan-pakai`,
  DatamasterAturanPakaiController.getAll
);
routes.put(
  `${baseUrl}/datamaster/aturan-pakai/:uuid`,
  DatamasterAturanPakaiController.update
);
routes.delete(
  `${baseUrl}/datamaster/aturan-pakai/:uuid`,
  DatamasterAturanPakaiController.delete
);
routes.post(
  `${baseUrl}/datamaster/aturan-pakai/import`,
  DatamasterAturanPakaiController.import
);
routes.get(
  `${baseUrl}/datamaster/aturan-pakai/export`,
  DatamasterAturanPakaiController.getAll
);

// DATAMASTER - INGREDIENT
routes.post(
  `${baseUrl}/datamaster/ingredient`,
  DatamasterIngredientController.create
);
routes.get(
  `${baseUrl}/datamaster/ingredient`,
  DatamasterIngredientController.getAll
);
routes.put(
  `${baseUrl}/datamaster/ingredient/:uuid`,
  DatamasterIngredientController.update
);
routes.delete(
  `${baseUrl}/datamaster/ingredient/:uuid`,
  DatamasterIngredientController.delete
);
routes.post(
  `${baseUrl}/datamaster/ingredient/import`,
  DatamasterIngredientController.import
);
routes.get(
  `${baseUrl}/datamaster/ingredient/export`,
  DatamasterIngredientController.getAll
);

// DATAMASTER - BENTUK RACIKAN
routes.post(
  `${baseUrl}/datamaster/bentuk-racikan`,
  DatamasterBentukRacikanController.create
);
routes.get(
  `${baseUrl}/datamaster/bentuk-racikan`,
  DatamasterBentukRacikanController.getAll
);
routes.put(
  `${baseUrl}/datamaster/bentuk-racikan/:uuid`,
  DatamasterBentukRacikanController.update
);
routes.delete(
  `${baseUrl}/datamaster/bentuk-racikan/:uuid`,
  DatamasterBentukRacikanController.delete
);

// DATAMASTER - ITEM MEDIS
routes.get(
  `${baseUrl}/datamaster/item-medis/jenis-stok`,
  DatamasterItemMedisController.getItemMedisJenisStok
);
routes.post(
  `${baseUrl}/datamaster/item-medis`,
  DatamasterItemMedisController.create
);
routes.put(
  `${baseUrl}/datamaster/item-medis/:uuid`,
  DatamasterItemMedisController.update
);
routes.get(
  `${baseUrl}/datamaster/item-medis/all`,
  DatamasterItemMedisController.getAll
);
routes.get(
  `${baseUrl}/datamaster/item-medis/export`,
  DatamasterItemMedisController.export
);
routes.get(
  `${baseUrl}/datamaster/item-medis/pengadaan`,
  DatamasterItemMedisController.getForPengadaan
);
routes.post(
  `${baseUrl}/datamaster/item-medis/import`,
  DatamasterItemMedisController.import
);
routes.delete(
  `${baseUrl}/datamaster/item-medis/:uuid`,
  DatamasterItemMedisController.delete
);
routes.get(
  `${baseUrl}/datamaster/item-medis/:uuid/conversions`,
  DatamasterItemMedisController.getConversions
);
routes.get(
  `${baseUrl}/datamaster/item-medis/conversions`,
  DatamasterItemMedisController.getAllConversions
);
routes.get(
  `${baseUrl}/datamaster/item-medis/without-pagination`,
  DatamasterItemMedisController.getAllWithoutPagination
);
routes.get(
  `${baseUrl}/datamaster/item-medis/available-jenis-stock/:item_medis_jenis_stok_uuid`,
  DatamasterItemMedisController.getAvailableJenisStok
);


// KONFIGURASI HARGA
routes.get(
  `${baseUrl}/datamaster/konfig-harga`,
  KonfigurasiHargaController.get
);

routes.get(
  `${baseUrl}/datamaster/harga-item`,
  KonfigurasiHargaController.getHargaItem
);

routes.get(
  `${baseUrl}/datamaster/harga-item/:uuid`,
  KonfigurasiHargaController.getHargaItemByUuid
);

routes.put(
  `${baseUrl}/datamaster/konfig-harga`,
  KonfigurasiHargaController.update
);

// ORDER OBAT
routes.post(
  `${baseUrl}/prescriptions/first-order`,
  farmasiPermission("Resep Dokter", "UPDATE OBAT"),
  PrescriptionController.orderObat
);
routes.post(
  `${baseUrl}/prescriptions/add-obat`,
  farmasiPermission("Resep Dokter", "UPDATE OBAT"),
  PrescriptionController.addObat
);
routes.delete(
  `${baseUrl}/prescriptions/obat/:prescription_item_uuid`,
  farmasiPermission("Resep Dokter", "EDIT OBAT"),
  PrescriptionController.deleteObat
);
routes.get(
  `${baseUrl}/prescriptions/fpo`,
  farmasiPermission("Resep Dokter", "READ"),
  PrescriptionController.getForFpo
);
routes.patch(
  `${baseUrl}/prescriptions/:prescription_item_uuid`,
  farmasiPermission("Resep Dokter", "UPDATE OBAT"),
  PrescriptionController.editSisaObat
);
routes.get(
  `${baseUrl}/prescriptions/:uuid`,
  farmasiPermission("Resep Dokter", "READ"),
  PrescriptionController.getByUuid
);
routes.put(
  `${baseUrl}/prescriptions/substitution`,
  farmasiPermission("Resep Dokter", "SIMPAN DAN UBAH MENJADI RACIK"),
  PrescriptionController.substituteItem
);
routes.put(
  `${baseUrl}/prescriptions/:uuid`,
  farmasiPermission("Resep Dokter", "SIMPAN EDIT"),
  PrescriptionController.updatePrescription
);
routes.put(
  `${baseUrl}/prescriptions/obat/:uuid`,
  farmasiPermission("Resep Dokter", "EDIT OBAT"),
  PrescriptionController.updateObat
);
routes.get(
  `${baseUrl}/prescriptions/obat/history`,
  farmasiPermission("Resep Dokter", "READ"),
  PrescriptionController.getHistoryObat
);
routes.post(
  `${baseUrl}/prescriptions/some-order`,
  farmasiPermission("Resep Dokter", "READ"),
  PrescriptionController.getOrderBySomeUuid
);
routes.post(
  `${baseUrl}/prescriptions/status-telaah`,
  farmasiPermission("Resep Dokter", "RESEP MASUK SIMPAN TELAAH"),
  PrescriptionController.updateTelaah
);
routes.post(
  `${baseUrl}/prescriptions/batal-order`,
  farmasiPermission("Resep Dokter", "RESEP MASUK BATAL ORDER"),
  PrescriptionController.batalOrder
);
routes.post(
  `${baseUrl}/prescriptions/status-siap-diserahkan`,
  farmasiPermission("Resep Dokter", [
    "OBAT DISIAPKAN TUNAI OBAT SIAP DISERAHKAN",
    "OBAT DISIAPKAN ASURANSI OBAT SIAP DISERAHKAN",
  ]),
  PrescriptionController.updateSiapDiserahkan
);
routes.post(
  `${baseUrl}/prescriptions/status-verifikasi`,
  farmasiPermission("Resep Dokter", "RESEP MASUK VERIFIKASI"),
  PrescriptionController.updateVerifikasi
);
routes.post(
  `${baseUrl}/prescriptions/status-diserahkan`,
  farmasiPermission("Resep Dokter", "PENYERAHAN OBAT SERAHKAN OBAT"),
  PrescriptionController.updateDiserahkan
);
routes.post(
  `${baseUrl}/prescriptions/batal-siap-diserahkan`,
  farmasiPermission("Resep Dokter", [
    "MENUNGGU PEMBAYARAN BATAL",
    "OBAT DISIAPKAN ASURANSI BATAL",
    "PENYERAHAN OBAT BATAL PENYERAHAN",
  ]),
  PrescriptionController.batalSiapDiserahkan
);
routes.post(
  `${baseUrl}/prescriptions/lokasi-stok`,
  farmasiPermission("Resep Dokter", "RESEP MASUK PINDAH LOKASI"),
  PrescriptionController.updateLokasiStok
);
routes.post(
  `${baseUrl}/prescriptions/all`,
  farmasiPermission("Resep Dokter", "READ"),
  PrescriptionController.getAll
);
routes.put(
  `${baseUrl}/prescriptions/obat/:uuid/jenis-stok`,
  farmasiPermission("Resep Dokter", "EDIT OBAT"),
  PrescriptionController.updateJenisStokItem
);


// PENJUALAN OBAT
routes.post(
  `${baseUrl}/penjualan-obat`,
  farmasiPermission("Penjualan Obat", "CREATE BELI OBAT"),
  PenjualanObatController.create
);
routes.put(
  `${baseUrl}/penjualan-obat/:uuid/cancel`,
  farmasiPermission("Penjualan Obat", "BATAL PEMBELIAN"),
  PenjualanObatController.batalOtc
);
routes.get(
  `${baseUrl}/penjualan-obat`,
  farmasiPermission("Penjualan Obat", "READ"),
  PenjualanObatController.getAll
);
routes.get(
  `${baseUrl}/penjualan-obat/all`,
  farmasiPermission("Penjualan Obat", "READ"),
  PenjualanObatController.getAllWithoutPagination
);
routes.get(
  `${baseUrl}/penjualan-obat/code`,
  farmasiPermission("Penjualan Obat", "READ"),
  PenjualanObatController.getCode
);
routes.get(
  `${baseUrl}/penjualan-obat/:uuid`,
  farmasiPermission("Penjualan Obat", "READ"),
  PenjualanObatController.getDetail
);

// ALKES
routes.post(
  `${baseUrl}/alkes`,
  alkesPermission("ORDER MASUK UPDATE ITEM", "order"),
  AlkesController.orderAlkes
);
routes.get(
  `${baseUrl}/alkes/some-order`,
  alkesPermission("READ", "baca"),
  AlkesController.getOrderByRekamMedis
);
routes.post(
  `${baseUrl}/alkes/all`,
  farmasiPermission("Farmasi Ruangan", "READ"),
  AlkesController.getAllForFarmacy
);
routes.put(
  `${baseUrl}/alkes/lokasi-stok`,
  farmasiPermission("Farmasi Ruangan", "ORDER MASUK PINDAH LOKASI ORDER"),
  AlkesController.updateLokasiStok
);
routes.put(
  `${baseUrl}/alkes/update-verifikasi`,
  farmasiPermission("Farmasi Ruangan", "ORDER MASUK VERIFIKASI"),
  AlkesController.updateVerifikasi
);
routes.put(
  `${baseUrl}/alkes/siap-diserahkan`,
  farmasiPermission("Farmasi Ruangan", "SEDANG DISIAPKAN ALKES SIAP DISERAHKAN"),
  AlkesController.updateSiapDiserahkan
);
routes.put(
  `${baseUrl}/alkes/diserahkan`,
  farmasiPermission("Farmasi Ruangan", "PENYERAHAN SERAHKAN"),
  AlkesController.updateDiserahkan
);
routes.put(
  `${baseUrl}/alkes/batal-siap-diserahkan`,
  farmasiPermission("Farmasi Ruangan", "SEDANG DISIAPKAN BATAL"),
  AlkesController.batalSiapDiserahkan
);
routes.post(
  `${baseUrl}/alkes/:uuid/items`,
  alkesPermission("ORDER MASUK UPDATE ITEM", "order"),
  AlkesController.addAlkesItems
);
routes.get(
  `${baseUrl}/alkes/:uuid`,
  alkesPermission("READ", "baca"),
  AlkesController.getByUuid
);
routes.delete(
  `${baseUrl}/alkes/items/:alkes_item_uuid`,
  alkesPermission("ORDER MASUK UPDATE ITEM", "hapusItem"),
  AlkesController.deleteAlkesItem
);
routes.put(
  `${baseUrl}/alkes/:uuid`,
  farmasiPermission("Farmasi Ruangan", "ORDER MASUK UPDATE ITEM"),
  AlkesController.updateAlkes
);
routes.put(
  `${baseUrl}/alkes/items/:uuid`,
  farmasiPermission("Farmasi Ruangan", "ORDER MASUK UPDATE ITEM"),
  AlkesController.updateAlkesItem
);
routes.put(
  `${baseUrl}/alkes/items/:uuid/jenis-stok`,
  farmasiPermission("Farmasi Ruangan", "ORDER MASUK UPDATE ITEM"),
  AlkesController.updateJenisStokItem
);
routes.delete(
  `${baseUrl}/alkes/:uuid`,
  alkesPermission("ORDER MASUK BATAL", "batal"),
  AlkesController.batalOrder
);

// RETUR
routes.post(
  `${baseUrl}/retur`,
  farmasiPermission("Retur Obat dan Material", "RETUR"),
  ReturController.create
);
routes.get(
  `${baseUrl}/retur/detail`,
  farmasiPermission("Retur Obat dan Material", "READ"),
  ReturController.getDetail
);
routes.get(
  `${baseUrl}/retur/all`,
  farmasiPermission("Retur Obat dan Material", "READ"),
  ReturController.getAll
);

// RIWAYAT
routes.post(
  `${baseUrl}/riwayat/all`,
  farmasiPermission("Riwayat Transaksi", "READ"),
  RiwayatController.getAll
);
routes.post(
  `${baseUrl}/riwayat/detail`,
  farmasiPermission("Riwayat Transaksi", "READ"),
  RiwayatController.getDetail
);

// REKAP
routes.get(
  `${baseUrl}/rekap/pendapatan`,
  farmasiPermission("Riwayat Transaksi", "READ", "Pendapatan"),
  ReportController.getPendapatan
);
routes.get(
  `${baseUrl}/rekap/tat`,
  farmasiPermission("Riwayat Transaksi", "READ", "Waktu Tunggu"),
  ReportController.getTat
);
routes.get(
  `${baseUrl}/rekap/pendapatan-apotik`,
  farmasiPermission("Riwayat Transaksi", "READ", "Rekap Pendapatan Per Apotik"),
  ReportController.getPendapatanPerApotik
);

// CETAK
routes.get(
  `${baseUrl}/cetak/e-ticket/:uuid`,
  farmasiPermission("Resep Dokter", [
    "RESEP MASUK CETAK",
    "OBAT DISIAPKAN TUNAI CETAK",
    "OBAT DISIAPKAN ASURANSI CETAK",
    "PENYERAHAN OBAT CETAK",
  ]),
  PrescriptionController.getEticketData
);
routes.get(
  `${baseUrl}/cetak/e-resep/:uuid`,
  farmasiPermission("Resep Dokter", [
    "RESEP MASUK CETAK",
    "OBAT DISIAPKAN TUNAI CETAK",
    "OBAT DISIAPKAN ASURANSI CETAK",
    "PENYERAHAN OBAT CETAK",
  ]),
  PrescriptionController.getPrintPrescription
);
routes.get(
  `${baseUrl}/cetak/invoice/:uuid`,
  farmasiPermission("Resep Dokter", [
    "RESEP MASUK CETAK",
    "OBAT DISIAPKAN TUNAI CETAK",
    "OBAT DISIAPKAN ASURANSI CETAK",
    "PENYERAHAN OBAT CETAK",
  ]),
  PrescriptionController.getForInvoicePrint
);

export default routes;
