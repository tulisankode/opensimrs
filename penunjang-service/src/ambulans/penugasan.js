import express from "express";
import { query, satu, sisipkan, ubah, sekarang, transaksi } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { izinAmbulans } from "../umum/izin.js";
import { kruTersedia } from "./kru.js";
import { detailPermintaan } from "./permintaan.js";
import { konflik, pastikanArmadaLayak } from "./bersama.js";

// Penugasan armada & kru untuk permintaan yang menunggu, serta pembatalan penugasan sebelum perjalanan dimulai.
// Dipasang di akar router ambulans (lihat rute.js) karena path menggabungkan prefix /permintaan & /penugasan.
const rute = express.Router();

// Worklist koordinator: penugasan aktif (sedang berjalan) beserta ringkasan permintaan, armada, kru & perjalanan.
rute.get(
  "/penugasan",
  izinAmbulans("Penugasan", "READ"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const rows = await query(
      `SELECT pn.uuid, pn.permintaan_uuid, pn.armada_uuid, a.nomor_polisi, a.jenis AS jenis_armada, pn.waktu_penugasan,
              pn.status, p.nomor_permintaan, p.jenis_layanan, p.prioritas, p.tujuan, p.waktu_permintaan, p.status AS status_permintaan,
              pj.uuid AS perjalanan_uuid, pj.status AS status_perjalanan,
              (SELECT json_agg(json_build_object('peran', pk.peran,
                        'nama_pegawai', TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, '')))))
                 FROM ambulans_penugasan_kru pk JOIN ambulans_kru kr ON kr.uuid = pk.kru_uuid JOIN pegawai pg ON pg.uuid = kr.pegawai_uuid
                WHERE pk.penugasan_uuid = pn.uuid AND pk.deleted_at IS NULL) AS kru
         FROM ambulans_penugasan pn
         JOIN ambulans_armada a ON a.uuid = pn.armada_uuid
         JOIN ambulans_permintaan p ON p.uuid = pn.permintaan_uuid
         LEFT JOIN ambulans_perjalanan pj ON pj.penugasan_uuid = pn.uuid AND pj.deleted_at IS NULL
        WHERE pn.faskes_uuid = $1 AND pn.status = 'aktif' AND pn.deleted_at IS NULL
        ORDER BY pn.waktu_penugasan DESC`,
      [faskes],
    );
    kirim(res, rows);
  }),
);

rute.post(
  "/permintaan/:permintaanUuid/penugasan",
  izinAmbulans("Penugasan", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["armada_uuid"]);
    const faskes = req.author.faskesUuid;
    await transaksi(async (k) => {
      const p = await satu(
        `SELECT * FROM ambulans_permintaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`,
        [req.params.permintaanUuid, faskes],
        k,
      );
      if (!p) throw tidakDitemukan("Permintaan ambulans");
      if (p.status !== "menunggu") throw konflik(`Permintaan berstatus ${p.status}, tidak dapat ditugaskan`);

      // KT-7/G3: armada harus siap, sesuai jenis layanan, & tidak punya penugasan aktif lain (dikunci FOR UPDATE).
      const armada = await satu(`SELECT * FROM ambulans_armada WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [b.armada_uuid, faskes], k);
      pastikanArmadaLayak(armada, p.jenis_layanan);
      const aktif = await satu(`SELECT uuid FROM ambulans_penugasan WHERE armada_uuid = $1 AND status = 'aktif' AND deleted_at IS NULL`, [armada.uuid], k);
      if (aktif) throw konflik(`Armada ${armada.nomor_polisi} sedang memiliki penugasan aktif`);

      // KT-8/G3: kru (sopir wajib, perawat opsional) harus aktif & punya jadwal jaga yang mencakup waktu penugasan.
      const waktu = sekarang();
      const anggota = [];
      if (b.sopir_kru_uuid) {
        const sopir = await satu(`SELECT * FROM ambulans_kru WHERE uuid = $1 AND faskes_uuid = $2 AND peran = 'sopir' AND aktif AND deleted_at IS NULL`, [b.sopir_kru_uuid, faskes], k);
        if (!sopir) throw permintaanSalah("Sopir tidak ditemukan atau tidak aktif");
        const tersedia = await kruTersedia(faskes, "sopir", waktu, k);
        if (!tersedia.some((x) => x.uuid === sopir.uuid)) throw konflik("Sopir tidak memiliki jadwal jaga pada waktu ini");
        anggota.push({ kru_uuid: sopir.uuid, peran: "sopir" });
      } else {
        throw permintaanSalah("sopir_kru_uuid wajib diisi");
      }
      if (b.perawat_kru_uuid) {
        const perawat = await satu(`SELECT * FROM ambulans_kru WHERE uuid = $1 AND faskes_uuid = $2 AND peran = 'perawat' AND aktif AND deleted_at IS NULL`, [b.perawat_kru_uuid, faskes], k);
        if (!perawat) throw permintaanSalah("Perawat pendamping tidak ditemukan atau tidak aktif");
        const tersedia = await kruTersedia(faskes, "perawat", waktu, k);
        if (!tersedia.some((x) => x.uuid === perawat.uuid)) throw konflik("Perawat pendamping tidak memiliki jadwal jaga pada waktu ini");
        anggota.push({ kru_uuid: perawat.uuid, peran: "perawat" });
      }

      const penugasan = await sisipkan(
        "ambulans_penugasan",
        {
          faskes_uuid: faskes,
          permintaan_uuid: p.uuid,
          armada_uuid: armada.uuid,
          waktu_penugasan: waktu,
          status: "aktif",
          ditugaskan_oleh: req.author.username ?? null,
        },
        k,
      );
      for (const a of anggota) await sisipkan("ambulans_penugasan_kru", { faskes_uuid: faskes, penugasan_uuid: penugasan.uuid, ...a }, k);
      await ubah("ambulans_armada", armada.uuid, faskes, { status: "bertugas", diubah_status_oleh: req.author.username ?? null, diubah_status_pada: waktu }, k);
      await ubah("ambulans_permintaan", p.uuid, faskes, { status: "ditugaskan" }, k);
    });
    kirim(res, await detailPermintaan(req.params.permintaanUuid, faskes), "Armada & kru berhasil ditugaskan");
  }),
);

// A3/KT-21: pembatalan penugasan sebelum perjalanan dimulai — melepas armada & kru, mempertahankan riwayat.
rute.post(
  "/penugasan/:uuid/batal",
  izinAmbulans("Penugasan", "BATAL"),
  tangani(async (req, res) => {
    wajib(req.body, ["alasan"]);
    const faskes = req.author.faskesUuid;
    let permintaanUuid;
    await transaksi(async (k) => {
      const pn = await satu(`SELECT * FROM ambulans_penugasan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, faskes], k);
      if (!pn) throw tidakDitemukan("Penugasan ambulans");
      if (pn.status !== "aktif") throw konflik(`Penugasan berstatus ${pn.status}, tidak dapat dibatalkan`);
      const perjalanan = await satu(`SELECT uuid FROM ambulans_perjalanan WHERE penugasan_uuid = $1 AND deleted_at IS NULL`, [pn.uuid], k);
      if (perjalanan) throw konflik("Perjalanan sudah dimulai, penugasan tidak dapat dibatalkan");
      permintaanUuid = pn.permintaan_uuid;
      const t = sekarang();
      await ubah("ambulans_penugasan", pn.uuid, faskes, { status: "batal", alasan_batal: String(req.body.alasan).trim(), dibatalkan_oleh: req.author.username ?? null, dibatalkan_pada: t }, k);
      await ubah("ambulans_armada", pn.armada_uuid, faskes, { status: "siap", diubah_status_oleh: req.author.username ?? null, diubah_status_pada: t }, k);
      await ubah("ambulans_permintaan", pn.permintaan_uuid, faskes, { status: "menunggu" }, k);
    });
    kirim(res, await detailPermintaan(permintaanUuid, faskes), "Penugasan dibatalkan, permintaan menunggu penugasan ulang");
  }),
);

export default rute;
