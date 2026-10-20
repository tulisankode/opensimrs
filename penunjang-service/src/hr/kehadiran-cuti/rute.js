import express from "express";
import konfigurasi from "./konfigurasi.js";
import kehadiran from "./kehadiran.js";
import cuti from "./cuti.js";
import rekap from "./rekap.js";

const rute = express.Router();
rute.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
rute.use(konfigurasi, kehadiran, cuti, rekap);
export default rute;
