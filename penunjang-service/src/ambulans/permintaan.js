import express from "express";
import { query, satu, sisipkan, ubah, sekarang, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { nomorBaru } from "../umum/nomor.js";
import { izinAmbulans, punyaIzin } from "../umum/izin.js";
import { cariKunjungan, pasien } from "../umum/kunjungan.js";
import { JENIS_LAYANAN, PRIORITAS, STATUS_PERMINTAAN, SUMBER_PERMINTAAN, konflik, teks, wajibPilihan, cekPilihan } from "./bersama.js";

// Permintaan layanan ambulans: pembuatan, daftar, detail, & pembatalan sebelum penugasan.
const rute = express.Router();

const PILIH = `p.uuid, p.faskes_uuid, p.nomor_permintaan, p.sumber, p.jenis_layanan, p.patient_uuid, p.no_reg,
  p.lokasi_jemput, p.tujuan, p.prioritas, p.waktu_permintaan, p.status, p.alasan_batal, p.dibatalkan_oleh,
  p.dibatalkan_pada, p.dibuat_oleh, p.created_at, p.updated_at, pt.name AS nama_pasien, pt.no_rm`;
const DARI = `ambulans_permintaan p LEFT JOIN patients pt ON pt.uuid = p.patient_uuid`;

rute.get(
  "/",
  izinAmbulans("Permintaan", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "p.faskes_uuid = $1 AND p.deleted_at IS NULL";
    const status = cekPilihan(req.query.status || undefined, STATUS_PERMINTAAN, "status");
    if (status) {
      p.push(status);
      w += ` AND p.status = $${p.length}`;
    }
    const jenis = cekPilihan(req.query.jenis_layanan || undefined, JENIS_LAYANAN, "jenis_layanan");
    if (jenis) {
      p.push(jenis);
      w += ` AND p.jenis_layanan = $${p.length}`;
    }
    const prioritas = cekPilihan(req.query.prioritas || undefined, PRIORITAS, "prioritas");
    if (prioritas) {
      p.push(prioritas);
      w += ` AND p.prioritas = $${p.length}`;
    }
    if (req.query.tanggal_mulai && req.query.tanggal_selesai) {
      p.push(Number(req.query.tanggal_mulai), Number(req.query.tanggal_selesai));
      w += ` AND p.waktu_permintaan BETWEEN $${p.length - 1} AND $${p.length}`;
    }
    if (req.query.cari) {
      p.push(`%${req.query.cari}%`);
      w += ` AND (p.nomor_permintaan ILIKE $${p.length} OR pt.name ILIKE $${p.length} OR p.tujuan ILIKE $${p.length})`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI} WHERE ${w}`, p)).n;
    const rows = await query(`SELECT ${PILIH} FROM ${DARI} WHERE ${w} ORDER BY p.waktu_permintaan DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Detail lengkap: permintaan + penugasan + perjalanan + ringkasan biaya. Catatan pendamping disembunyikan bila
// pemanggil tidak memiliki izin "Catatan Pendamping" (KF-10: akses terbatas, bukan bawaan dari izin lain).
export const detailPermintaan = async (uuid, faskesUuid, k) => {
  const p = await satu(`SELECT ${PILIH} FROM ${DARI} WHERE p.uuid = $1 AND p.faskes_uuid = $2 AND p.deleted_at IS NULL`, [uuid, faskesUuid], k);
  if (!p) return null;
  const penugasan = await query(
    `SELECT pn.uuid, pn.armada_uuid, a.nomor_polisi, a.jenis AS jenis_armada, pn.waktu_penugasan, pn.status,
            pn.alasan_batal, pn.dibatalkan_oleh, pn.dibatalkan_pada, pn.ditugaskan_oleh, pn.created_at,
            (SELECT json_agg(json_build_object('kru_uuid', pk.kru_uuid, 'peran', pk.peran,
                      'nama_pegawai', TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, '')))))
               FROM ambulans_penugasan_kru pk JOIN ambulans_kru kr ON kr.uuid = pk.kru_uuid
                 JOIN pegawai pg ON pg.uuid = kr.pegawai_uuid
              WHERE pk.penugasan_uuid = pn.uuid AND pk.deleted_at IS NULL) AS kru
       FROM ambulans_penugasan pn JOIN ambulans_armada a ON a.uuid = pn.armada_uuid
      WHERE pn.permintaan_uuid = $1 AND pn.deleted_at IS NULL ORDER BY pn.created_at DESC`,
    [p.uuid],
    k,
  );
  const perjalanan = penugasan.length
    ? await query(`SELECT * FROM ambulans_perjalanan WHERE penugasan_uuid = ANY($1) AND deleted_at IS NULL`, [penugasan.map((x) => x.uuid)], k)
    : [];
  const biaya = await satu(`SELECT * FROM ambulans_biaya WHERE permintaan_uuid = $1 AND deleted_at IS NULL`, [p.uuid], k);
  const kuitansi = await satu(`SELECT * FROM ambulans_kuitansi WHERE permintaan_uuid = $1 AND deleted_at IS NULL`, [p.uuid], k);
  return {
    ...p,
    penugasan: penugasan.map((pn) => ({ ...pn, perjalanan: perjalanan.find((j) => j.penugasan_uuid === pn.uuid) ?? null })),
    biaya,
    kuitansi,
  };
};

// KF-10: catatan pendamping hanya tampil bagi pemanggil dengan izin "Catatan Pendamping" tersendiri (tidak
// diwariskan dari izin Permintaan/Perjalanan/Laporan lain). Dipakai juga oleh perjalanan.js.
export const sembunyikanPendamping = async (req, detail) => {
  if (!detail) return detail;
  const boleh = await punyaIzin(req, "Manajemen Ambulans", "Catatan Pendamping", "READ");
  if (!boleh) for (const pn of detail.penugasan ?? []) if (pn.perjalanan) pn.perjalanan.catatan_pendamping = undefined;
  return detail;
};

rute.get(
  "/:uuid",
  izinAmbulans("Permintaan", "READ"),
  tangani(async (req, res) => {
    const d = await detailPermintaan(req.params.uuid, req.author.faskesUuid);
    if (!d) throw tidakDitemukan("Permintaan ambulans");
    kirim(res, await sembunyikanPendamping(req, d));
  }),
);

rute.post(
  "/",
  izinAmbulans("Permintaan", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["sumber", "jenis_layanan", "tujuan", "prioritas"]);
    const faskes = req.author.faskesUuid;
    const sumber = wajibPilihan(b.sumber, SUMBER_PERMINTAAN, "sumber");
    const jenisLayanan = wajibPilihan(b.jenis_layanan, JENIS_LAYANAN, "jenis_layanan");
    const prioritas = wajibPilihan(b.prioritas, PRIORITAS, "prioritas");

    // KF-5/KT-6: kunjungan & pasien harus konsisten dan berada di faskes yang sama (faskes diambil dari token).
    let patientUuid = teks(b.patient_uuid);
    let noReg = teks(b.no_reg);
    if (noReg) {
      const kunjungan = await cariKunjungan(noReg, faskes);
      if (!kunjungan) throw permintaanSalah("Kunjungan (no_reg) tidak ditemukan di faskes ini");
      if (patientUuid && patientUuid !== kunjungan.patient_uuid) throw permintaanSalah("Pasien tidak sesuai dengan kunjungan yang ditautkan");
      patientUuid = kunjungan.patient_uuid;
    } else if (patientUuid) {
      const p = await pasien(patientUuid, faskes);
      if (!p) throw permintaanSalah("Pasien tidak ditemukan di faskes ini");
    }

    const r = await sisipkan("ambulans_permintaan", {
      faskes_uuid: faskes,
      nomor_permintaan: await nomorBaru(faskes, "AMB"),
      sumber,
      jenis_layanan: jenisLayanan,
      patient_uuid: patientUuid,
      no_reg: noReg,
      lokasi_jemput: teks(b.lokasi_jemput),
      tujuan: String(b.tujuan).trim(),
      prioritas,
      waktu_permintaan: b.waktu_permintaan ? Number(b.waktu_permintaan) : sekarang(),
      status: "menunggu",
      dibuat_oleh: req.author.username ?? null,
    });
    kirim(res, await detailPermintaan(r.uuid, faskes), `Permintaan ${r.nomor_permintaan} berhasil dibuat`);
  }),
);

// A2: pembatalan hanya sebelum penugasan (G3/KT-20). Setelah penugasan, gunakan POST /penugasan/:uuid/batal.
rute.post(
  "/:uuid/batal",
  izinAmbulans("Permintaan", "BATAL"),
  tangani(async (req, res) => {
    wajib(req.body, ["alasan"]);
    const faskes = req.author.faskesUuid;
    await transaksi(async (k) => {
      const p = await satu(`SELECT * FROM ambulans_permintaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, faskes], k);
      if (!p) throw tidakDitemukan("Permintaan ambulans");
      if (p.status !== "menunggu") throw konflik(`Permintaan berstatus ${p.status}, tidak dapat dibatalkan lewat aksi ini (batalkan penugasan terlebih dahulu)`);
      await ubah(
        "ambulans_permintaan",
        p.uuid,
        faskes,
        { status: "batal", alasan_batal: String(req.body.alasan).trim(), dibatalkan_oleh: req.author.username ?? null, dibatalkan_pada: sekarang() },
        k,
      );
    });
    kirim(res, await detailPermintaan(req.params.uuid, faskes), "Permintaan ambulans dibatalkan");
  }),
);

export default rute;
