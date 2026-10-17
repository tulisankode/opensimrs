import express from "express";
import { wajibLogin } from "./auth.js";
import kia from "./kia/rute.js";
import kb from "./kb/rute.js";
import imunisasi from "./imunisasi/rute.js";
import mtbs from "./mtbs/rute.js";
import sasaran from "./sasaran/rute.js";
import ukm from "./ukm/rute.js";
import laporan from "./laporan/rute.js";
import referensi from "./referensi/rute.js";

// /api/v3/program-puskesmas/{kia|kb|imunisasi|mtbs|sasaran|ukm|laporan|referensi}/...
const rute = express.Router();
rute.get("/health", (req, res) => res.json({ message: "OK" }));
rute.use(wajibLogin);
rute.use("/kia", kia);
rute.use("/kb", kb);
rute.use("/imunisasi", imunisasi);
rute.use("/mtbs", mtbs);
rute.use("/sasaran", sasaran);
rute.use("/ukm", ukm);
rute.use("/laporan", laporan);
rute.use("/referensi", referensi);

export default rute;
