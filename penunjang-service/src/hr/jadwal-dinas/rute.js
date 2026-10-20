import express from "express";
import * as db from "../../db.js";
import { punyaIzin } from "../../umum/izin.js";
import { catatAuditPusat } from "../audit.js";
import { buatRepositori } from "./repositori.js";
import { buatAkses } from "./akses.js";
import { buatMaster } from "./master.js";
import { buatJadwal } from "./jadwal.js";
import { buatPersetujuan } from "./persetujuan.js";
import { buatTukar } from "./tukar.js";
import { buatKeluaran } from "./keluaran.js";
import { wajib } from "./bersama.js";

const r = buatRepositori(db, catatAuditPusat), a = buatAkses(r, punyaIzin), master = buatMaster(r, a);
const jadwal = buatJadwal(r, a, master), persetujuan = buatPersetujuan(r, a, jadwal), tukar = buatTukar(r, a, jadwal), keluaran = buatKeluaran(r, a);
const rute = express.Router();
const daftar = (metode, path, fn) => rute[metode](path, async (req, res) => {
  try {
    a.faskes(req);
    if (metode !== "get") wajib(req.body && typeof req.body === "object" && !Array.isArray(req.body), "Body permintaan harus berupa objek");
    const payload = await fn(req);
    res.status(metode === "post" && ["/jadwal", "/pola-shift", "/rotasi", "/tukar"].includes(path) ? 201 : 200).json({ message: "Permintaan berhasil diproses", payload });
  } catch (e) {
    const status = e.status >= 400 && e.status < 500 ? e.status : 500;
    // Pesan asli hanya di log server (respons tetap umum); "Galat internal" saja tidak bisa ditelusuri.
    if (status === 500) console.error("[sdm-jadwal]", `${req.method} ${req.path}`, e.code ?? "", e.message);
    res.status(status).json({ message: status === 500 ? "Permintaan gagal diproses" : e.message, payload: e.payload ?? null });
  }
});
daftar("get", "/referensi", master.referensi);
daftar("get", "/pegawai", master.pegawai);
for (const jenis of ["pola-shift", "aturan", "rotasi", "kewenangan"]) daftar("get", `/${jenis}`, (req) => master.baca(req, jenis));
daftar("post", "/pola-shift", master.simpanPola);
daftar("put", "/pola-shift/:uuid", master.simpanPola);
daftar("delete", "/pola-shift/:uuid", (req) => master.simpanPola(req, true));
daftar("put", "/aturan/:unitUuid", master.simpanAturan);
daftar("post", "/rotasi", master.simpanRotasi);
daftar("put", "/rotasi/:uuid", master.simpanRotasi);
daftar("put", "/kewenangan/:unitUuid", master.kewenangan);
daftar("get", "/jadwal", jadwal.daftar);
daftar("post", "/jadwal", jadwal.buat);
daftar("get", "/jadwal/:uuid", jadwal.detail);
daftar("put", "/versi/:uuid/penempatan", jadwal.simpan);
for (const op of ["salin", "rotasi"]) daftar("post", `/versi/:uuid/${op}`, (req) => jadwal.simpan(req, op));
daftar("post", "/versi/:uuid/validasi", jadwal.validasi);
for (const op of ["ajukan", "setujui", "tolak", "terbitkan", "revisi"]) daftar("post", `/versi/:uuid/${op}`, (req) => persetujuan(req, op));
daftar("get", "/saya", (req) => keluaran.baca(req, true));
daftar("get", "/terbit", (req) => keluaran.baca(req));
daftar("post", "/keluaran", keluaran.keluaran);
daftar("get", "/calon-tukar", tukar.calon);
daftar("get", "/tukar", tukar.daftar);
daftar("post", "/tukar", tukar.buat);
for (const op of ["tanggapi", "putuskan", "batalkan"]) daftar("post", `/tukar/:uuid/${op}`, (req) => tukar.proses(req, op));
export default rute;
