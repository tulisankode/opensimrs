import express from "express";
import config from "./config.js";
import rute from "./rute.js";
import { ruteMasuk as ruteMasukLisPa } from "./patologi/lis-pa/lis-pa-rute.js";
import { ruteMasuk as ruteMasukPacs } from "./pacs/pacs-rute.js";

const app = express();

// CORS sebelum autentikasi: preflight OPTIONS tidak membawa token
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, x-api-key");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "5mb" }));
// Hasil dari PACS/RIS dan sistem PA memakai kunci masuk per koneksi, bukan token login (dipasang sebelum wajibLogin di rute.js)
app.use(ruteMasukPacs);
app.use(ruteMasukLisPa);
app.use(config.basePath, rute);

app.listen(config.port, config.host, () => {
  console.log(`penunjang-service berjalan di ${config.host}:${config.port}${config.basePath}`);
});
