import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { ramah } from "./bersama.js";

// Datamaster Petugas Radiologi: praktisi (tabel practitioner) yang bertugas sebagai dokter radiologi (pembaca
// expertise, umumnya Sp.Rad) atau radiografer. Dipakai sebagai pilihan pada dialog periksa & expertise.
// GET /pilihan?peran=dokter|radiografer → petugas aktif; bila belum ada dokter radiologi terdaftar, seluruh dokter
// aktif faskes dikembalikan (fallback, ditandai `terdaftar: false`) agar alur lama tidak terhambat.
const rute = express.Router();

const PERAN = { dokter: "Dokter Radiologi", radiografer: "Radiografer" };
const NAMA = `TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, '')))`;

rute.get(
  "/",
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    let w = "t.faskes_uuid = $1 AND t.deleted_at IS NULL";
    if (PERAN[req.query.peran]) {
      p.push(req.query.peran);
      w += ` AND t.peran = $${p.length}`;
    }
    kirim(
      res,
      await query(
        `SELECT t.uuid, t.practitioner_uuid, t.peran, t.keterangan, t.status, ${NAMA} AS nama, pr.sip, pr.str, pr.is_doctor,
                (pr.uuid IS NULL OR pr.deleted_at IS NOT NULL OR NOT COALESCE(pr.status, true)) AS praktisi_nonaktif
           FROM rad_petugas t LEFT JOIN practitioner pr ON pr.uuid = t.practitioner_uuid LEFT JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
          WHERE ${w} ORDER BY t.peran, pg.name`,
        p,
      ),
    );
  }),
);

rute.get(
  "/pilihan",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const peran = PERAN[req.query.peran] ? req.query.peran : "dokter";
    const terdaftar = await query(
      `SELECT pr.uuid, ${NAMA} AS nama, true AS terdaftar
         FROM rad_petugas t JOIN practitioner pr ON pr.uuid = t.practitioner_uuid JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
        WHERE t.faskes_uuid = $1 AND t.deleted_at IS NULL AND t.status AND t.peran = $2 AND pr.deleted_at IS NULL AND COALESCE(pr.status, true)
        ORDER BY pg.name`,
      [f, peran],
    );
    if (terdaftar.length || peran !== "dokter") return kirim(res, terdaftar);
    kirim(
      res,
      await query(
        `SELECT pr.uuid, ${NAMA} AS nama, false AS terdaftar
           FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
          WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND pr.is_doctor AND COALESCE(pr.status, true) ORDER BY pg.name`,
        [f],
      ),
    );
  }),
);

rute.post(
  "/",
  tangani(async (req, res) => {
    wajib(req.body, ["practitioner_uuid", "peran"]);
    const f = req.author.faskesUuid;
    if (!PERAN[req.body.peran]) throw permintaanSalah("peran harus dokter atau radiografer");
    const pr = await satu(`SELECT uuid, is_doctor FROM practitioner WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.body.practitioner_uuid, f]);
    if (!pr) throw permintaanSalah("Praktisi tidak ditemukan di faskes ini");
    if (req.body.peran === "dokter" && !pr.is_doctor) throw permintaanSalah("Dokter radiologi harus praktisi berstatus dokter");
    const t = await sisipkan("rad_petugas", {
      faskes_uuid: f,
      practitioner_uuid: pr.uuid,
      peran: req.body.peran,
      keterangan: String(req.body.keterangan ?? "").trim() || null,
      status: req.body.status ?? true,
    }).catch((e) => ramah(e, `Praktisi sudah terdaftar sebagai ${PERAN[req.body.peran].toLowerCase()}`));
    kirim(res, t, `${PERAN[t.peran]} berhasil ditambahkan`);
  }),
);

rute.put(
  "/:uuid",
  tangani(async (req, res) => {
    const t = await ubah("rad_petugas", req.params.uuid, req.author.faskesUuid, {
      keterangan: req.body.keterangan === undefined ? undefined : String(req.body.keterangan ?? "").trim() || null,
      status: req.body.status === undefined ? undefined : Boolean(req.body.status),
    });
    if (!t) throw tidakDitemukan("Petugas radiologi");
    kirim(res, t, "Petugas radiologi berhasil diperbarui");
  }),
);

rute.delete(
  "/:uuid",
  tangani(async (req, res) => {
    const t = await ubah("rad_petugas", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!t) throw tidakDitemukan("Petugas radiologi");
    kirim(res, { uuid: t.uuid }, "Petugas radiologi berhasil dihapus");
  }),
);

export default rute;
