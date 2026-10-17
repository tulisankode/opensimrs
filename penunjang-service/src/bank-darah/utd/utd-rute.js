import express from "express";
import { tangani, kirim, halaman } from "../../umum/respons.js";
import { wajibSalahSatu } from "../../umum/izin.js";
import { wajibFiturBdrsBridgingAktif } from "./izin.js";
import { daftarKoneksi, simpanKoneksi, jadikanBawaan, buatUlangKunciMasuk, hapusKoneksi, ujiKoneksi } from "./utd-koneksi.js";
import { daftarMapping, simpanMapping } from "./utd-peta.js";
import { cekStokBridging, kirimUlang, cekStatusTidakPasti, daftarPengiriman, detailPengiriman } from "./utd-service.js";
import { daftarKantongPermintaan, terimaKantongUtd } from "./utd-hasil.js";

// Bridging Bank Darah ke UTD — /api/v3/penunjang/bank-darah/utd/... (dipasang di bank-darah/rute.js). Dua aksi yang
// menempel pada permintaan (kirim-utd, ambil-status-utd) ada di utd-permintaan-rute.js.
const rute = express.Router();
rute.use(wajibFiturBdrsBridgingAktif);

const BDRS = "Bank Darah RS (BDRS)";
const INTEGRASI = ["Setting", "Konfigurasi Integrasi"];
// Koneksi = konfigurasi integrasi; mapping bisa lewat Konfigurasi Integrasi atau Datamaster Komponen Darah.
const bacaKoneksi = wajibSalahSatu([...INTEGRASI, "READ"], [BDRS, "Permintaan Darah", "READ"]);
const ubahKoneksi = wajibSalahSatu([...INTEGRASI, "UPDATE KONFIGURASI LAINNYA"]);
const peta = wajibSalahSatu([...INTEGRASI, "UPDATE KONFIGURASI LAINNYA"], [BDRS, "Datamaster", "UPDATE", "Komponen Darah"]);
const bacaKirim = wajibSalahSatu([BDRS, "Permintaan Darah", "READ"], [...INTEGRASI, "READ"]);
const terimaKantongIzin = wajibSalahSatu([BDRS, "Stok & Penerimaan", "TERIMA KANTONG"]);

// ── Koneksi ──────────────────────────────────────────────────────────────────
rute.get("/koneksi", bacaKoneksi, tangani(async (req, res) => kirim(res, await daftarKoneksi(req.author.faskesUuid))));
rute.post("/koneksi", ubahKoneksi, tangani(async (req, res) => kirim(res, await simpanKoneksi(req.author.faskesUuid, null, req.body), "Koneksi UTD ditambahkan")));
rute.put("/koneksi/:uuid", ubahKoneksi, tangani(async (req, res) => kirim(res, await simpanKoneksi(req.author.faskesUuid, req.params.uuid, req.body), "Koneksi UTD disimpan")));
rute.delete("/koneksi/:uuid", ubahKoneksi, tangani(async (req, res) => kirim(res, await hapusKoneksi(req.author.faskesUuid, req.params.uuid), "Koneksi UTD dihapus")));
rute.post("/koneksi/:uuid/bawaan", ubahKoneksi, tangani(async (req, res) => kirim(res, await jadikanBawaan(req.author.faskesUuid, req.params.uuid), "UTD bawaan diubah")));
rute.post("/koneksi/:uuid/kunci-masuk", ubahKoneksi, tangani(async (req, res) => kirim(res, await buatUlangKunciMasuk(req.author.faskesUuid, req.params.uuid), "Kunci masuk baru dibuat")));
rute.post("/koneksi/:uuid/uji", ubahKoneksi, tangani(async (req, res) => kirim(res, await ujiKoneksi(req.author.faskesUuid, req.params.uuid))));

// ── Mapping (KF-7) ───────────────────────────────────────────────────────────
rute.get(
  "/peta/:jenis",
  peta,
  tangani(async (req, res) =>
    kirim(res, await daftarMapping(req.author.faskesUuid, req.params.jenis, { koneksiUuid: req.query.koneksi_uuid, belumDipetakan: ["1", "true"].includes(String(req.query.belum_dipetakan)) })),
  ),
);
rute.put(
  "/peta/:jenis",
  peta,
  tangani(async (req, res) => kirim(res, await simpanMapping(req.author.faskesUuid, req.params.jenis, req.body?.koneksi_uuid, req.body?.ref_uuid, req.body?.kode_utd), "Mapping UTD disimpan")),
);

// ── Cek stok UTD (KF-13) ───────────────────────────────────────────────────
rute.get(
  "/stok",
  bacaKirim,
  tangani(async (req, res) =>
    kirim(res, await cekStokBridging(req.author.faskesUuid, req.query.koneksi_uuid || null, { golongan_abo: req.query.golongan_abo, rhesus: req.query.rhesus, kode_komponen: req.query.kode_komponen })),
  ),
);

// ── Pengiriman (riwayat, KF-14) ────────────────────────────────────────────
rute.get(
  "/pengiriman",
  bacaKirim,
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const { data, pagination } = await daftarPengiriman(req.author.faskesUuid, { page: pg.page, limit: pg.limit, status: req.query.status ?? "", koneksiUuid: req.query.koneksi_uuid ?? "" });
    res.json({ message: "Data berhasil ditampilkan", payload: data, pagination });
  }),
);
rute.get("/pengiriman/:uuid", bacaKirim, tangani(async (req, res) => kirim(res, await detailPengiriman(req.author.faskesUuid, req.params.uuid))));
rute.post(
  "/pengiriman/:uuid/kirim-ulang",
  wajibSalahSatu([BDRS, "Permintaan Darah", "UPDATE"]),
  tangani(async (req, res) => kirim(res, await kirimUlang(req.author.faskesUuid, req.params.uuid, req.author.username ?? null), "Permintaan dikirim ulang ke UTD")),
);
rute.post("/pengiriman/:uuid/cek-status", bacaKirim, tangani(async (req, res) => kirim(res, await cekStatusTidakPasti(req.author.faskesUuid, req.params.uuid))));

// ── Kantong bridging (KF-9/KF-10/KF-12) ─────────────────────────────────────
rute.get("/permintaan/:uuid/kantong", wajibSalahSatu([BDRS, "Permintaan Darah", "READ"]), tangani(async (req, res) => kirim(res, await daftarKantongPermintaan(req.author.faskesUuid, req.params.uuid))));
rute.post(
  "/kantong/:uuid/terima",
  terimaKantongIzin,
  tangani(async (req, res) => kirim(res, await terimaKantongUtd(req.author.faskesUuid, req.params.uuid, req.author.username ?? null), "Kantong UTD berhasil diterima ke stok")),
);

export default rute;
