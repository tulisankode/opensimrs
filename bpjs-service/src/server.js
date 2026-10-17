import express from "express";
import config from "./config.js";
import rute from "./rute.js";
import { jalankanPekerja } from "./pcare.js";
import { ruteWs as ruteAntreanWs } from "./antrean-route.js";
import { jalankanPekerjaAntrean } from "./antrean-pekerja.js";

const app = express();

// CORS sebelum autentikasi: preflight OPTIONS tidak membawa token
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-cons-id, X-timestamp, X-signature, user_key");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "1mb" }));
// Rute WS Antrean BPJS (Mobile JKN): autentikasi token WS sendiri, bukan JWT — lihat antrean-auth.js.
app.use(`${config.basePath}/antrean/ws`, ruteAntreanWs);
app.use(config.basePath, rute);

app.listen(config.port, config.host, () => {
  console.log(`bpjs-service berjalan di ${config.host}:${config.port} (mode ${config.mode}, ${config.lingkungan})`);
});

// Pekerja otomatis PCare: pendaftaran & kunjungan BPJS yang belum terkirim
if (config.pekerjaAktif) {
  let berjalan = false;
  const putaran = async () => {
    if (berjalan) return;
    berjalan = true;
    try {
      const hasil = await jalankanPekerja();
      if (hasil.some((h) => h.diproses)) console.log("[pekerja] PCare:", JSON.stringify(hasil));
    } catch (error) {
      console.error("[pekerja] PCare gagal:", error.message);
    } finally {
      berjalan = false;
    }
  };
  setTimeout(putaran, 30_000);
  setInterval(putaran, config.pekerjaIntervalMenit * 60_000);
}

// Pekerja otomatis Antrean Online BPJS: jembatani pendaftaran JKN lokal, catat task id, kirim ulang yang gagal.
if (config.antreanPekerjaAktif) {
  let berjalanAntrean = false;
  const putaranAntrean = async () => {
    if (berjalanAntrean) return;
    berjalanAntrean = true;
    try {
      const hasil = await jalankanPekerjaAntrean();
      if (hasil.some((h) => h.dijembatani || h.task || h.terkirim || h.gagal)) console.log("[pekerja] Antrean BPJS:", JSON.stringify(hasil));
    } catch (error) {
      console.error("[pekerja] Antrean BPJS gagal:", error.message);
    } finally {
      berjalanAntrean = false;
    }
  };
  setTimeout(putaranAntrean, 45_000);
  setInterval(putaranAntrean, config.antreanPekerjaIntervalMenit * 60_000);
}
