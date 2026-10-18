import express from "express";
import config from "./config.js";
import rute from "./rute.js";
import { ruteMasuk as ruteMasukLisMikro } from "./mikrobiologi/lis-rute.js";
import { ruteMasuk as ruteMasukLisPa } from "./patologi/lis-pa/lis-pa-rute.js";
import { ruteMasuk as ruteMasukPacs } from "./pacs/pacs-rute.js";
import { ruteMasuk as ruteMasukBdrsUtd } from "./bank-darah/utd/utd-push-rute.js";
import { ruteMasuk as ruteMasukHdis } from "./hemodialisa/hdis/push-rute.js";

const app = express();

// CORS sebelum autentikasi: preflight OPTIONS tidak membawa token
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, x-api-key");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
// Sarana & Prasarana menerima foto/sertifikat sebagai base64 di JSON (ukuran ≈ 4/3 berkas): batas tubuh mengikuti
// MAX_UPLOAD_BERKAS_SARPRAS_MB, dipasang sebelum parser umum sehingga parser umum dilewati untuk rute ini.
app.use(`${config.basePath}/sarpras`, express.json({ limit: `${Math.ceil(config.berkasSarprasMaksMb * 1.4) + 1}mb` }));
// Mutu & Akreditasi: berkas dokumen/kredensial juga base64 di JSON, batas mengikuti MAX_UPLOAD_MUTU_MB (juga impor CSV).
app.use(`${config.basePath}/mutu`, express.json({ limit: `${Math.ceil(config.maxUploadMutuMb * 1.4) + 1}mb` }));
// Kredensial pegawai HR / SDM memakai batas berkas yang sama dengan Mutu (satu sumber data mutu_kredensial, STD-0035).
app.use(`${config.basePath}/hr`, express.json({ limit: `${Math.ceil(config.maxUploadMutuMb * 1.4) + 1}mb` }));
app.use(express.json({ limit: "5mb" }));
// Hasil dari PACS/RIS, sistem PA, dan LIS Mikrobiologi memakai kunci masuk per koneksi, bukan token login (dipasang sebelum wajibLogin di rute.js)
app.use(ruteMasukPacs);
app.use(ruteMasukLisPa);
app.use(ruteMasukLisMikro);
app.use(ruteMasukBdrsUtd);
app.use(ruteMasukHdis);
app.use(config.basePath, rute);
// Galat pembaca badan JSON (terlalu besar / JSON rusak) → JSON { message } dengan status aslinya (413/400), bukan halaman HTML.
app.use((err, req, res, next) => {
  if (!err?.type?.startsWith?.("entity.") && err?.type !== "encoding.unsupported") return next(err);
  res.status(err.status || 400).json({ message: err.type === "entity.too.large" ? "Ukuran data/berkas melebihi batas yang diizinkan" : "Format permintaan tidak valid" });
});

app.listen(config.port, config.host, () => {
  console.log(`penunjang-service berjalan di ${config.host}:${config.port}${config.basePath}`);
});
