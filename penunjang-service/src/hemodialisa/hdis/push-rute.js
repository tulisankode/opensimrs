import express from "express";
import { terimaParameter } from "./terima.js";

// Tanpa login JWT: HDIS mengirim parameter mesin per sesi ke SIMRS (dipasang sebelum rute terautentikasi, server.js).
// Alamat yang didaftarkan di HDIS: http(s)://<host penunjang-service>/adam-hdis/bridging?key=<kunci masuk>
// (atau kirim kunci di header x-api-key). Alias /api/v3/penunjang/hemodialisa/hdis/masuk untuk akses lewat gateway.
// Format galat konsisten dengan titik masuk PACS/LIS/UTD: { success: false, message }.
export const ruteMasuk = express.Router();
ruteMasuk.post(["/adam-hdis/bridging", "/api/v3/penunjang/hemodialisa/hdis/masuk"], async (req, res) => {
  try {
    const kunci = req.get("x-api-key") || req.query.key;
    const hasil = await terimaParameter({ kunci: kunci ? String(kunci) : "", body: req.body });
    res.json({ success: true, message: hasil.duplikat ? "Pesan HDIS sudah diproses sebelumnya" : "Parameter HDIS diterima", payload: hasil });
  } catch (error) {
    const status = Number(error.status) >= 400 && Number(error.status) < 600 ? Number(error.status) : 500;
    if (status >= 500) console.error("[hd-hdis]", error);
    res.status(status).json({ success: false, message: status >= 500 ? "Galat internal saat memproses pesan HDIS" : error.message, payload: error.payload ?? null });
  }
});
