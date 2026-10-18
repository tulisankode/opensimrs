import express from "express";
import MarketplaceController from "../controllers/marketplace-controller.js";
import { izinMarketplace } from "../helpers/izin.js";
import { wajibFiturMarketplaceAktif } from "../helpers/fitur-marketplace.js";

// STD-0019 — Pembelian via Marketplace. Semua rute di sini memakai izin "Inventory" › "Pembelian Marketplace".
// Rute webhook (tanpa JWT, pakai kunci masuk per koneksi) didaftarkan terpisah di app.js SEBELUM
// authorizationSdk — lihat marketplace-webhook-routes.js.
const marketplaceRoutes = express.Router();

// Fitur katalog "inv_marketplace" mati bawaan: tolak semua rute bila belum diaktifkan untuk faskes (fail-closed).
marketplaceRoutes.use(wajibFiturMarketplaceAktif);

marketplaceRoutes.get("/konfigurasi", izinMarketplace("READ"), MarketplaceController.getKonfigurasi);
marketplaceRoutes.put("/konfigurasi", izinMarketplace("KONFIGURASI KONEKSI"), MarketplaceController.putKonfigurasi);

marketplaceRoutes.get("/penawaran", izinMarketplace("CARI PENAWARAN"), MarketplaceController.cariPenawaran);
marketplaceRoutes.get("/konversi-item", izinMarketplace("KELOLA PEMETAAN"), MarketplaceController.getKonversiItem);

marketplaceRoutes.get("/pemetaan", izinMarketplace("READ"), MarketplaceController.getPemetaan);
marketplaceRoutes.put("/pemetaan/:produk_mitra_id", izinMarketplace("KELOLA PEMETAAN"), MarketplaceController.putPemetaan);

marketplaceRoutes.post("/permintaan", izinMarketplace("AJUKAN PERMINTAAN"), MarketplaceController.createPermintaan);
marketplaceRoutes.get("/permintaan", izinMarketplace("READ"), MarketplaceController.getListPesanan);
marketplaceRoutes.get("/permintaan/:uuid", izinMarketplace("READ"), MarketplaceController.getDetailPesanan);
marketplaceRoutes.post("/permintaan/:uuid/persetujuan", izinMarketplace("PERSETUJUAN"), MarketplaceController.persetujuan);
marketplaceRoutes.post("/permintaan/:uuid/checkout", izinMarketplace("CHECKOUT"), MarketplaceController.checkout);
marketplaceRoutes.post("/permintaan/:uuid/sinkron-status", izinMarketplace("SINKRON STATUS"), MarketplaceController.sinkronStatus);
marketplaceRoutes.get("/permintaan/:uuid/penerimaan", izinMarketplace("READ"), MarketplaceController.getPenerimaan);

marketplaceRoutes.get("/laporan", izinMarketplace("LIHAT LAPORAN"), MarketplaceController.laporan);

export default marketplaceRoutes;
