import express from "express";
import config from "./config.js";
import rute from "./rute.js";
import { jalankanPekerja } from "./sinkron.js";

const app = express();

// CORS sebelum autentikasi: preflight OPTIONS tidak membawa token (konfigurasi sama dengan layanan lain)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "2mb" }));
app.use(config.basePath, rute);

app.listen(config.port, config.host, () => {
  console.log(`satusehat-service berjalan di ${config.host}:${config.port} (mode ${config.mode}, ${config.lingkungan})`);
});

// Pekerja otomatis: kirim kunjungan rawat jalan yang sudah selesai secara berkala
if (config.pekerjaAktif) {
  let berjalan = false;
  const putaran = async () => {
    if (berjalan) return;
    berjalan = true;
    try {
      const hasil = await jalankanPekerja();
      const total = hasil.reduce((n, h) => n + h.diproses, 0);
      if (total) console.log("[pekerja] sinkronisasi SATUSEHAT:", JSON.stringify(hasil));
    } catch (error) {
      console.error("[pekerja] gagal:", error.message);
    } finally {
      berjalan = false;
    }
  };
  setTimeout(putaran, 30_000);
  setInterval(putaran, config.pekerjaIntervalMenit * 60_000);
}
