import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { izinAmbulans } from "../umum/izin.js";
import { PERAN_KRU, ramah, wajibPilihan, cekPilihan } from "./bersama.js";

// Master Kru (sopir & perawat pendamping) & jadwal jaga.
const rute = express.Router();

const PILIH_KRU = `k.uuid, k.faskes_uuid, k.pegawai_uuid, k.peran, k.aktif, k.created_at, k.updated_at,
  TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS nama_pegawai`;

rute.get(
  "/",
  izinAmbulans("Kru & Jadwal Jaga", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "k.faskes_uuid = $1 AND k.deleted_at IS NULL";
    const peran = cekPilihan(req.query.peran || undefined, PERAN_KRU, "peran");
    if (peran) {
      p.push(peran);
      w += ` AND k.peran = $${p.length}`;
    }
    if (req.query.aktif !== undefined && req.query.aktif !== "") {
      p.push(["1", "true"].includes(String(req.query.aktif)));
      w += ` AND k.aktif = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM ambulans_kru k WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${PILIH_KRU} FROM ambulans_kru k LEFT JOIN pegawai pg ON pg.uuid = k.pegawai_uuid
        WHERE ${w} ORDER BY nama_pegawai LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

export const kruDetail = (uuid, faskesUuid, k) =>
  satu(`SELECT ${PILIH_KRU} FROM ambulans_kru k LEFT JOIN pegawai pg ON pg.uuid = k.pegawai_uuid
          WHERE k.uuid = $1 AND k.faskes_uuid = $2 AND k.deleted_at IS NULL`, [uuid, faskesUuid], k);

rute.post(
  "/",
  izinAmbulans("Kru & Jadwal Jaga", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["pegawai_uuid", "peran"]);
    const faskes = req.author.faskesUuid;
    const pegawai = await satu(`SELECT uuid FROM pegawai WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [b.pegawai_uuid, faskes]);
    if (!pegawai) throw permintaanSalah("Pegawai tidak ditemukan di faskes ini");
    const r = await sisipkan("ambulans_kru", {
      faskes_uuid: faskes,
      pegawai_uuid: b.pegawai_uuid,
      peran: wajibPilihan(b.peran, PERAN_KRU, "peran"),
      aktif: b.aktif ?? true,
    }).catch((e) => ramah(e, "Pegawai tersebut sudah terdaftar sebagai kru ambulans"));
    kirim(res, await kruDetail(r.uuid, faskes), "Kru berhasil ditambahkan");
  }),
);

rute.put(
  "/:uuid",
  izinAmbulans("Kru & Jadwal Jaga", "UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const perubahan = {
      peran: cekPilihan(b.peran, PERAN_KRU, "peran"),
      aktif: b.aktif === undefined ? undefined : Boolean(b.aktif),
    };
    const r = await ubah("ambulans_kru", req.params.uuid, req.author.faskesUuid, perubahan);
    if (!r) throw tidakDitemukan("Kru");
    kirim(res, await kruDetail(r.uuid, req.author.faskesUuid), "Kru berhasil diperbarui");
  }),
);

rute.get(
  "/:uuid/jadwal",
  izinAmbulans("Kru & Jadwal Jaga", "READ"),
  tangani(async (req, res) => {
    const k = await kruDetail(req.params.uuid, req.author.faskesUuid);
    if (!k) throw tidakDitemukan("Kru");
    const p = [k.uuid];
    let w = "kru_uuid = $1 AND deleted_at IS NULL";
    if (req.query.dari) {
      p.push(Number(req.query.dari));
      w += ` AND waktu_selesai >= $${p.length}`;
    }
    if (req.query.sampai) {
      p.push(Number(req.query.sampai));
      w += ` AND waktu_mulai <= $${p.length}`;
    }
    kirim(res, await query(`SELECT * FROM ambulans_jadwal_jaga WHERE ${w} ORDER BY waktu_mulai`, p));
  }),
);

rute.post(
  "/:uuid/jadwal",
  izinAmbulans("Kru & Jadwal Jaga", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["waktu_mulai", "waktu_selesai"]);
    const faskes = req.author.faskesUuid;
    const k = await kruDetail(req.params.uuid, faskes);
    if (!k) throw tidakDitemukan("Kru");
    const mulai = Number(b.waktu_mulai);
    const selesai = Number(b.waktu_selesai);
    if (!(selesai > mulai)) throw permintaanSalah("waktu_selesai harus lebih besar dari waktu_mulai");
    // Benturan jadwal: tolak jika rentang baru beririsan dengan jadwal aktif kru yang sama.
    const bentrok = await satu(
      `SELECT uuid FROM ambulans_jadwal_jaga WHERE kru_uuid = $1 AND deleted_at IS NULL AND waktu_mulai < $2 AND waktu_selesai > $3`,
      [k.uuid, selesai, mulai],
    );
    if (bentrok) throw permintaanSalah("Jadwal jaga bentrok dengan jadwal yang sudah ada");
    const r = await sisipkan("ambulans_jadwal_jaga", { faskes_uuid: faskes, kru_uuid: k.uuid, waktu_mulai: mulai, waktu_selesai: selesai });
    kirim(res, r, "Jadwal jaga berhasil ditambahkan");
  }),
);

rute.delete(
  "/:uuid/jadwal/:jadwalUuid",
  izinAmbulans("Kru & Jadwal Jaga", "DELETE"),
  tangani(async (req, res) => {
    const r = await ubah("ambulans_jadwal_jaga", req.params.jadwalUuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!r) throw tidakDitemukan("Jadwal jaga");
    kirim(res, { uuid: r.uuid, dihapus: true }, "Jadwal jaga berhasil dihapus");
  }),
);

// Kru aktif yang memiliki jadwal jaga mencakup waktu tertentu & peran tertentu (dipakai validasi penugasan).
export const kruTersedia = (faskesUuid, peran, waktu, k) =>
  query(
    `SELECT kr.uuid, kr.pegawai_uuid, kr.peran, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS nama_pegawai
       FROM ambulans_kru kr JOIN pegawai pg ON pg.uuid = kr.pegawai_uuid
      WHERE kr.faskes_uuid = $1 AND kr.peran = $2 AND kr.aktif AND kr.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM ambulans_jadwal_jaga j WHERE j.kru_uuid = kr.uuid AND j.deleted_at IS NULL
                      AND j.waktu_mulai <= $3 AND j.waktu_selesai >= $3)
      ORDER BY nama_pegawai`,
    [faskesUuid, peran, waktu],
    k,
  );

export default rute;
