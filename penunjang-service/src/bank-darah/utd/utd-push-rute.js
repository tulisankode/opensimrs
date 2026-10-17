import express from "express";
import { terimaHasilPush } from "./utd-hasil.js";

// Tanpa login JWT: UTD mengirim status & data kantong ke SIMRS (dipasang sebelum middleware otorisasi, server.js).
// Alamat yang didaftarkan di UTD: http(s)://<host penunjang-service>/adam-utd/bridging?key=<kunci masuk>
// (atau kirim kunci di header x-api-key). Alias /api/v3/penunjang/bank-darah/utd/hasil untuk akses lewat gateway.
// Koneksi ditentukan dari hash kunci masuk (bukan parameter URL) — lihat utd-hasil.js `terimaHasilPush`.
// Format galat konsisten dengan titik masuk PACS/LIS: { success: false, message }.
export const ruteMasuk = express.Router();
ruteMasuk.post(["/adam-utd/bridging", "/api/v3/penunjang/bank-darah/utd/hasil"], async (req, res) => {
  try {
    const kunci = req.get("x-api-key") || req.query.key;
    const hasil = await terimaHasilPush(kunci ? String(kunci) : "", req.body ?? {});
    res.json({ success: true, message: "Hasil UTD diterima", payload: hasil });
  } catch (error) {
    const status = Number(error.status) >= 400 && Number(error.status) < 600 ? Number(error.status) : 500;
    if (status >= 500) console.error("[bdrs-utd]", error);
    res.status(status).json({ success: false, message: error.message });
  }
});
