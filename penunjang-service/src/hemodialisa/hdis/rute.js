import express from "express";
import { query, satu } from "../../db.js";
import { tangani, kirim, halaman, denganHalaman, tidakDitemukan } from "../../umum/respons.js";
import { wajibSalahSatu } from "../../umum/izin.js";
import { wajibFiturHdisAktif } from "./izin.js";
import { daftarKoneksi, simpanKoneksi, jadikanBawaan, buatUlangKunciMasuk, hapusKoneksi, ujiKoneksi } from "./koneksi.js";
import { daftarPeta, simpanPeta } from "./peta.js";
import { kirimUlang } from "./kirim.js";

// Bridging HDIS — /api/v3/penunjang/hemodialisa/hdis/... (fitur hd_bridging_hdis, fail-closed). Koneksi = konfigurasi
// integrasi (Setting › Konfigurasi Integrasi › Hemodialisa › HDIS) atau Datamaster › Mapping HDIS; rahasia tidak pernah
// dikembalikan utuh kecuali kunci masuk baru (sekali).
const rute = express.Router();
rute.use(wajibFiturHdisAktif);

const HD = "Hemodialisa";
const INTEGRASI = ["Setting", "Konfigurasi Integrasi"];
const bacaKoneksi = wajibSalahSatu([...INTEGRASI, "READ"], [HD, "Datamaster", "READ", "Mapping HDIS"]);
const ubahKoneksi = wajibSalahSatu([...INTEGRASI, "UPDATE KONFIGURASI LAINNYA"], [HD, "Datamaster", "UPDATE", "Mapping HDIS"]);
const bacaPeta = wajibSalahSatu([HD, "Datamaster", "READ", "Mapping HDIS"], [...INTEGRASI, "READ"]);
const ubahPeta = wajibSalahSatu([HD, "Datamaster", "UPDATE", "Mapping HDIS"], [...INTEGRASI, "UPDATE KONFIGURASI LAINNYA"]);
const bacaPesan = wajibSalahSatu([HD, "Registrasi & Jadwal", "READ"], [HD, "Datamaster", "READ", "Mapping HDIS"], [...INTEGRASI, "READ"]);
const kirimPesan = wajibSalahSatu([HD, "Registrasi & Jadwal", "UPDATE"], [HD, "Datamaster", "UPDATE", "Mapping HDIS"]);

// ── Koneksi ──────────────────────────────────────────────────────────────────
rute.get("/koneksi", bacaKoneksi, tangani(async (req, res) => kirim(res, await daftarKoneksi(req.author.faskesUuid))));
rute.post("/koneksi", ubahKoneksi, tangani(async (req, res) => kirim(res, await simpanKoneksi(req.author.faskesUuid, null, req.body, req.author.username ?? null), "Koneksi HDIS ditambahkan")));
rute.put("/koneksi/:uuid", ubahKoneksi, tangani(async (req, res) => kirim(res, await simpanKoneksi(req.author.faskesUuid, req.params.uuid, req.body, req.author.username ?? null), "Koneksi HDIS disimpan")));
rute.delete("/koneksi/:uuid", ubahKoneksi, tangani(async (req, res) => kirim(res, await hapusKoneksi(req.author.faskesUuid, req.params.uuid), "Koneksi HDIS dihapus")));
rute.post("/koneksi/:uuid/bawaan", ubahKoneksi, tangani(async (req, res) => kirim(res, await jadikanBawaan(req.author.faskesUuid, req.params.uuid), "Koneksi HDIS bawaan diubah")));
rute.post("/koneksi/:uuid/kunci-masuk", ubahKoneksi, tangani(async (req, res) => kirim(res, await buatUlangKunciMasuk(req.author.faskesUuid, req.params.uuid, req.author.username ?? null), "Kunci masuk baru dibuat")));
rute.post("/koneksi/:uuid/uji", ubahKoneksi, tangani(async (req, res) => kirim(res, await ujiKoneksi(req.author.faskesUuid, req.params.uuid))));

// ── Pemetaan mesin ───────────────────────────────────────────────────────────
rute.get("/peta-mesin", bacaPeta, tangani(async (req, res) => kirim(res, await daftarPeta(req.author.faskesUuid, req.query.koneksi_uuid))));
rute.put("/peta-mesin", ubahPeta, tangani(async (req, res) => kirim(res, await simpanPeta(req.author.faskesUuid, req.body ?? {}, req.author.username ?? null), "Pemetaan mesin HDIS disimpan")));

// ── Riwayat pesan masuk/keluar ───────────────────────────────────────────────
rute.get(
  "/pesan",
  bacaPesan,
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "m.faskes_uuid = $1";
    for (const kolom of ["status", "arah", "jadwal_uuid", "sesi_uuid"]) {
      if (req.query[kolom]) {
        p.push(String(req.query[kolom]));
        w += ` AND m.${kolom} = $${p.length}`;
      }
    }
    const DARI = `hd_hdis_pesan m JOIN hd_hdis_koneksi k ON k.uuid = m.koneksi_uuid`;
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT m.uuid, m.arah, m.jenis, m.kunci_idempoten, m.jadwal_uuid, m.sesi_uuid, m.observasi_uuid, m.status, m.percobaan, m.pesan,
              m.status_http, m.pengguna, m.created_at, m.updated_at, k.nama AS koneksi
         FROM ${DARI} WHERE ${w} ORDER BY m.updated_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/pesan/:uuid",
  bacaPesan,
  tangani(async (req, res) => {
    const r = await satu(`SELECT * FROM hd_hdis_pesan WHERE uuid = $1 AND faskes_uuid = $2`, [req.params.uuid, req.author.faskesUuid]);
    if (!r) throw tidakDitemukan("Pesan HDIS");
    kirim(res, r);
  }),
);

rute.post(
  "/pesan/:uuid/kirim-ulang",
  kirimPesan,
  tangani(async (req, res) => {
    const hasil = await kirimUlang(req.author.faskesUuid, req.params.uuid, req.author.username ?? null);
    kirim(res, hasil, hasil.status === "terkirim" ? "Jadwal terkirim ke HDIS" : `Pengiriman ke HDIS: ${hasil.status}`);
  }),
);

export default rute;
