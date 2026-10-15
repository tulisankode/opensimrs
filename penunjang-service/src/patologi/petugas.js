import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { ramah } from "./bersama.js";
import { izinPa } from "../umum/izin.js";

// Petugas Patologi Anatomi: dokter spesialis patologi anatomi (Sp.PA, verifikator laporan) dan teknisi/analis
// histoteknik (penerima jaringan & pemotongan makroskopis). Dapat dihubungkan ke praktisi faskes (practitioner_uuid)
// atau dicatat langsung (nama + SIP), mis. dokter Sp.PA tamu/konsulen.
// GET /pilihan?peran=dokter|teknisi → petugas aktif untuk dialog laporan.
const rute = express.Router();

const PERAN = { dokter: "Dokter Sp.PA", teknisi: "Teknisi / Analis PA" };
const NAMA_PR = `TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, '')))`;

const PILIH = `t.uuid, t.practitioner_uuid, t.nama, t.peran, t.sip, t.keterangan, t.status, t.created_at,
  (t.practitioner_uuid IS NOT NULL AND (pr.uuid IS NULL OR pr.deleted_at IS NOT NULL OR NOT COALESCE(pr.status, true))) AS praktisi_nonaktif`;
const DARI = `pa_petugas t LEFT JOIN practitioner pr ON pr.uuid = t.practitioner_uuid`;

rute.get(
  "/",
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    let w = "t.faskes_uuid = $1 AND t.deleted_at IS NULL";
    if (PERAN[req.query.peran]) {
      p.push(req.query.peran);
      w += ` AND t.peran = $${p.length}`;
    }
    kirim(res, await query(`SELECT ${PILIH} FROM ${DARI} WHERE ${w} ORDER BY t.peran, t.nama`, p));
  }),
);

rute.get(
  "/pilihan",
  tangani(async (req, res) => {
    const peran = PERAN[req.query.peran] ? req.query.peran : "dokter";
    kirim(
      res,
      await query(
        `SELECT t.uuid, t.nama, t.sip FROM ${DARI}
          WHERE t.faskes_uuid = $1 AND t.deleted_at IS NULL AND t.status AND t.peran = $2
            AND (t.practitioner_uuid IS NULL OR (pr.deleted_at IS NULL AND COALESCE(pr.status, true)))
          ORDER BY t.nama`,
        [req.author.faskesUuid, peran],
      ),
    );
  }),
);

rute.post(
  "/",
  izinPa("Datamaster", ["CREATE", "UPDATE"], "Pemeriksaan PA"),
  tangani(async (req, res) => {
    wajib(req.body, ["peran"]);
    const f = req.author.faskesUuid;
    const b = req.body;
    if (!PERAN[b.peran]) throw permintaanSalah("peran harus dokter atau teknisi");
    let nama = String(b.nama ?? "").trim();
    let sip = String(b.sip ?? "").trim() || null;
    if (b.practitioner_uuid) {
      const pr = await satu(
        `SELECT pr.uuid, pr.sip, ${NAMA_PR} AS nama FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
          WHERE pr.uuid = $1 AND pr.faskes_uuid = $2 AND pr.deleted_at IS NULL`,
        [b.practitioner_uuid, f],
      );
      if (!pr) throw permintaanSalah("Praktisi tidak ditemukan di faskes ini");
      nama = nama || pr.nama;
      sip = sip || pr.sip || null;
    }
    if (!nama) throw permintaanSalah("nama wajib diisi (atau pilih praktisi)");
    const t = await sisipkan("pa_petugas", {
      faskes_uuid: f,
      practitioner_uuid: b.practitioner_uuid || null,
      nama,
      peran: b.peran,
      sip,
      keterangan: String(b.keterangan ?? "").trim() || null,
      status: b.status ?? true,
    }).catch((e) => ramah(e, `${nama} sudah terdaftar sebagai ${PERAN[b.peran].toLowerCase()}`));
    kirim(res, t, `${PERAN[t.peran]} berhasil ditambahkan`);
  }),
);

rute.put(
  "/:uuid",
  izinPa("Datamaster", "UPDATE", "Pemeriksaan PA"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const t = (v) => (v === undefined ? undefined : String(v ?? "").trim() || null);
    if (b.nama !== undefined && !String(b.nama ?? "").trim()) throw permintaanSalah("nama tidak boleh kosong");
    const r = await ubah("pa_petugas", req.params.uuid, req.author.faskesUuid, {
      nama: b.nama === undefined ? undefined : String(b.nama).trim(),
      sip: t(b.sip),
      keterangan: t(b.keterangan),
      status: b.status === undefined ? undefined : Boolean(b.status),
    }).catch((e) => ramah(e, "Nama petugas sudah dipakai"));
    if (!r) throw tidakDitemukan("Petugas PA");
    kirim(res, r, "Petugas PA berhasil diperbarui");
  }),
);

rute.delete(
  "/:uuid",
  izinPa("Datamaster", ["DELETE", "UPDATE"], "Pemeriksaan PA"),
  tangani(async (req, res) => {
    const t = await ubah("pa_petugas", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!t) throw tidakDitemukan("Petugas PA");
    kirim(res, { uuid: t.uuid }, "Petugas PA berhasil dihapus");
  }),
);

export default rute;
