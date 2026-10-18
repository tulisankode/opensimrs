import express from "express";
import MarketplaceController from "../controllers/marketplace-controller.js";

// STD-0019 — Webhook marketplace mitra: TANPA JWT, otentikasi memakai kunci masuk per koneksi (header x-api-key),
// bukan token login. Didaftarkan di app.js SEBELUM authorizationSdk, pola sama dengan
// lab-service/src/lis/lis-rute.js (ruteMasuk). faskes_uuid HANYA diambil dari koneksi yang ditemukan lewat
// :koneksi_uuid di path — body tidak pernah dipercaya untuk menentukan faskes (lihat MarketplaceService.webhook).
const apiBase = process.env.API_BASE || "api";
const apiVersion = process.env.API_VERSION || "v3";
const baseUrl = `/${apiBase}/${apiVersion}/inventory/marketplace`;

const ruteWebhookMarketplace = express.Router();

ruteWebhookMarketplace.post(`${baseUrl}/webhook/:koneksi_uuid`, MarketplaceController.webhook);

export default ruteWebhookMarketplace;
