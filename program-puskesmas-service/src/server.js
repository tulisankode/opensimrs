import express from "express";
import config from "./config.js";
import rute from "./rute.js";

const app = express();

// CORS sebelum autentikasi: preflight OPTIONS tidak membawa token
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "5mb" }));
app.use(config.basePath, rute);

app.listen(config.port, config.host, () => {
  console.log(`program-puskesmas-service berjalan di ${config.host}:${config.port}${config.basePath}`);
});
