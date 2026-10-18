import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { izinAmbulans } from "../umum/izin.js";
import { JENIS_ARMADA, STATUS_ARMADA, konflik, ramah, teks, wajibPilihan, cekPilihan } from "./bersama.js";

// Master Armada: data kendaraan, status (siap/bertugas/servis), jadwal servis/pajak-STNK, & riwayat servis.
const rute = express.Router();

rute.get(
  "/",
  izinAmbulans("Armada", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL";
    const status = cekPilihan(req.query.status || undefined, STATUS_ARMADA, "status");
    if (status) {
      p.push(status);
      w += ` AND status = $${p.length}`;
    }
    const jenis = cekPilihan(req.query.jenis || undefined, JENIS_ARMADA, "jenis");
    if (jenis) {
      p.push(jenis);
      w += ` AND jenis = $${p.length}`;
    }
    if (req.query.cari) {
      p.push(`%${req.query.cari}%`);
      w += ` AND nomor_polisi ILIKE $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM ambulans_armada WHERE ${w}`, p)).n;
    const rows = await query(`SELECT * FROM ambulans_armada WHERE ${w} ORDER BY nomor_polisi LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

export const armadaDetail = (uuid, faskesUuid, k) =>
  satu(`SELECT * FROM ambulans_armada WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid], k);

rute.get(
  "/:uuid",
  izinAmbulans("Armada", "READ"),
  tangani(async (req, res) => {
    const a = await armadaDetail(req.params.uuid, req.author.faskesUuid);
    if (!a) throw tidakDitemukan("Armada");
    const servis = await query(
      `SELECT * FROM ambulans_riwayat_servis WHERE armada_uuid = $1 AND deleted_at IS NULL ORDER BY tanggal_servis DESC LIMIT 50`,
      [a.uuid],
    );
    kirim(res, { ...a, riwayat_servis: servis });
  }),
);

rute.post(
  "/",
  izinAmbulans("Armada", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["nomor_polisi", "jenis"]);
    const r = await sisipkan("ambulans_armada", {
      faskes_uuid: req.author.faskesUuid,
      nomor_polisi: String(b.nomor_polisi).trim().toUpperCase(),
      jenis: wajibPilihan(b.jenis, JENIS_ARMADA, "jenis"),
      kelengkapan: b.kelengkapan ?? null,
      status: "siap",
      jadwal_servis_berikutnya: b.jadwal_servis_berikutnya ?? null,
      pajak_stnk_berlaku_sampai: b.pajak_stnk_berlaku_sampai ?? null,
    }).catch((e) => ramah(e, `Nomor polisi ${b.nomor_polisi} sudah terdaftar`));
    kirim(res, r, `Armada ${r.nomor_polisi} berhasil ditambahkan`);
  }),
);

rute.put(
  "/:uuid",
  izinAmbulans("Armada", "UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const perubahan = {
      nomor_polisi: b.nomor_polisi === undefined ? undefined : String(b.nomor_polisi).trim().toUpperCase(),
      jenis: cekPilihan(b.jenis, JENIS_ARMADA, "jenis"),
      kelengkapan: b.kelengkapan === undefined ? undefined : b.kelengkapan,
      jadwal_servis_berikutnya: b.jadwal_servis_berikutnya === undefined ? undefined : b.jadwal_servis_berikutnya,
      pajak_stnk_berlaku_sampai: b.pajak_stnk_berlaku_sampai === undefined ? undefined : b.pajak_stnk_berlaku_sampai,
    };
    const r = await ubah("ambulans_armada", req.params.uuid, req.author.faskesUuid, perubahan).catch((e) =>
      ramah(e, `Nomor polisi ${b.nomor_polisi} sudah terdaftar`),
    );
    if (!r) throw tidakDitemukan("Armada");
    kirim(res, r, "Armada berhasil diperbarui");
  }),
);

// KT-9/A4: perubahan status manual oleh koordinator/kru (tanpa GPS). Armada yang sedang ditugaskan aktif
// tidak boleh dipaksa 'siap'/'servis' lewat endpoint ini — lepaskan penugasan terlebih dahulu.
rute.patch(
  "/:uuid/status",
  izinAmbulans("Armada", "UBAH STATUS"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["status"]);
    const faskes = req.author.faskesUuid;
    const status = wajibPilihan(b.status, STATUS_ARMADA, "status");
    const a = await armadaDetail(req.params.uuid, faskes);
    if (!a) throw tidakDitemukan("Armada");
    const bertugas = await satu(
      `SELECT uuid FROM ambulans_penugasan WHERE armada_uuid = $1 AND status = 'aktif' AND deleted_at IS NULL`,
      [a.uuid],
    );
    if (bertugas && status !== "bertugas") throw konflik("Armada sedang memiliki penugasan aktif, tidak dapat diubah statusnya");
    const r = await ubah("ambulans_armada", a.uuid, faskes, {
      status,
      catatan_status: teks(b.catatan),
      diubah_status_oleh: req.author.username ?? null,
      diubah_status_pada: sekarang(),
    });
    kirim(res, r, `Status armada ${r.nomor_polisi} diubah menjadi ${status}`);
  }),
);

rute.get(
  "/:uuid/servis",
  izinAmbulans("Servis Armada", "READ"),
  tangani(async (req, res) => {
    const a = await armadaDetail(req.params.uuid, req.author.faskesUuid);
    if (!a) throw tidakDitemukan("Armada");
    const pg = halaman(req.query);
    const total = (await satu(`SELECT COUNT(*) n FROM ambulans_riwayat_servis WHERE armada_uuid = $1 AND deleted_at IS NULL`, [a.uuid])).n;
    const rows = await query(
      `SELECT * FROM ambulans_riwayat_servis WHERE armada_uuid = $1 AND deleted_at IS NULL
        ORDER BY tanggal_servis DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      [a.uuid],
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// KF-16/KT-19: riwayat servis tercatat di modul ambulans; work_order_uuid hanya diterima bila dikirim eksplisit
// (frontend hanya menampilkan field ini saat modul Sarana & Prasarana aktif — tidak divalidasi silang di sini
// karena work-order-service berada di luar cakupan STD-0024).
rute.post(
  "/:uuid/servis",
  izinAmbulans("Servis Armada", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["tanggal_servis", "uraian"]);
    const faskes = req.author.faskesUuid;
    const a = await armadaDetail(req.params.uuid, faskes);
    if (!a) throw tidakDitemukan("Armada");
    const r = await sisipkan("ambulans_riwayat_servis", {
      faskes_uuid: faskes,
      armada_uuid: a.uuid,
      tanggal_servis: Number(b.tanggal_servis),
      uraian: String(b.uraian).trim(),
      work_order_uuid: teks(b.work_order_uuid),
      dicatat_oleh: req.author.username ?? null,
    });
    kirim(res, r, "Riwayat servis berhasil dicatat");
  }),
);

export default rute;
