import express from "express";
import { query, satu, sisipkan, sekarang, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { GOLONGAN_DARAH, JENIS_KOMPONEN, cekPilihan, angkaOpsional, daftarNilai, hariIni, tanggalOpsional } from "./bersama.js";
import { izinUtd } from "../umum/izin.js";
import { jejakAftap } from "./aftap.js";

// Pengolahan Komponen: satu aftap → ≥1 komponen (PRC/TC/FFP/cryo), label unik otomatis, status awal karantina
// (kecuali kantong sudah dilepas lebih dulu). Penyimpanan & Distribusi: stok hanya komponen tersedia,
// belum kedaluwarsa, tidak ditahan (KF-25, KT-7).
const rute = express.Router();

const KOLOM_KOMPONEN = `k.uuid, k.aftap_uuid, k.jenis_komponen, k.label_unik, k.volume_ml, k.golongan_darah, k.rhesus,
  k.tanggal_kedaluwarsa, k.status, k.dilepas_oleh, k.dilepas_pada, k.created_at,
  a.no_kantong, d.no_donor, d.nama AS nama_donor`;
const DARI_KOMPONEN = `FROM utd_komponen k JOIN utd_aftap a ON a.uuid = k.aftap_uuid JOIN utd_donor d ON d.uuid = a.donor_uuid`;

// Komponen "tersedia" yang sudah lewat tanggal kedaluwarsa otomatis ditandai (KF-24).
const segarkanKedaluwarsa = (faskes, k) =>
  query(
    `UPDATE utd_komponen SET status = 'kedaluwarsa', updated_at = $2
       WHERE faskes_uuid = $1 AND status = 'tersedia' AND tanggal_kedaluwarsa < $3 AND deleted_at IS NULL`,
    [faskes, sekarang(), hariIni()], k,
  );

rute.get(
  "/komponen",
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    await segarkanKedaluwarsa(faskes);
    const pg = halaman(req.query);
    const p = [faskes];
    let w = "k.faskes_uuid = $1 AND k.deleted_at IS NULL";
    const golongan = daftarNilai(req.query.golongan_darah).filter((g) => GOLONGAN_DARAH[g]);
    if (golongan.length) {
      p.push(golongan);
      w += ` AND k.golongan_darah = ANY($${p.length})`;
    }
    const jenis = daftarNilai(req.query.jenis_komponen).filter((g) => JENIS_KOMPONEN[g]);
    if (jenis.length) {
      p.push(jenis);
      w += ` AND k.jenis_komponen = ANY($${p.length})`;
    }
    if (["1", "true"].includes(String(req.query.tersedia_saja))) {
      p.push(hariIni());
      w += ` AND k.status = 'tersedia' AND k.tanggal_kedaluwarsa >= $${p.length}`;
    } else {
      const status = daftarNilai(req.query.status).filter((s) => Boolean(s));
      if (status.length) {
        p.push(status);
        w += ` AND k.status = ANY($${p.length})`;
      }
    }
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND (k.label_unik ILIKE $${p.length} OR a.no_kantong ILIKE $${p.length})`;
    }
    const total = (await satu(`SELECT COUNT(*) n ${DARI_KOMPONEN} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${KOLOM_KOMPONEN} ${DARI_KOMPONEN} WHERE ${w} ORDER BY k.tanggal_kedaluwarsa, k.created_at LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/komponen/:uuid/jejak",
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const k = await satu(`SELECT aftap_uuid FROM utd_komponen WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, faskes]);
    if (!k) throw tidakDitemukan("Komponen");
    const jejak = await jejakAftap(k.aftap_uuid, faskes, req);
    kirim(res, { ...jejak, komponen_dipilih: req.params.uuid });
  }),
);

// Pengolahan komponen dari satu kantong. Body: { items: [{ jenis_komponen, volume_ml, tanggal_kedaluwarsa, golongan_darah?, rhesus? }] }.
rute.post(
  "/aftap/:uuid/komponen",
  izinUtd("Komponen", "CREATE"),
  tangani(async (req, res) => {
    const items = req.body?.items;
    if (!Array.isArray(items) || !items.length) throw permintaanSalah("items wajib diisi (minimal satu komponen)");
    const faskes = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const a = await satu(`SELECT * FROM utd_aftap WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, faskes], k);
      if (!a) throw tidakDitemukan("Aftap");
      if (["karantina_reaktif", "dimusnahkan"].includes(a.status_kantong))
        throw new Galat(409, `Kantong berstatus ${a.status_kantong}, tidak dapat diolah menjadi komponen`);
      const imltd = await satu(`SELECT * FROM utd_imltd WHERE aftap_uuid = $1 AND deleted_at IS NULL`, [a.uuid], k);
      const lengkap = imltd && ["hiv", "hbsag", "hcv", "sifilis"].every((p) => imltd[`${p}_hasil`] != null);
      if (!lengkap) throw new Galat(409, "Hasil IMLTD kantong ini belum lengkap; komponen belum dapat diolah");
      // Kantong yang sudah dilepas (tersedia): komponen baru langsung tersedia; selain itu tetap karantina sampai pelepasan.
      const statusAwal = a.status_kantong === "tersedia" ? "tersedia" : "karantina";
      const existing = await satu(`SELECT COUNT(*)::int n FROM utd_komponen WHERE aftap_uuid = $1 AND deleted_at IS NULL`, [a.uuid], k);
      const dibuat = [];
      for (const [idx, item] of items.entries()) {
        wajib(item, ["jenis_komponen", "volume_ml", "tanggal_kedaluwarsa"]);
        const jenis = cekPilihan(item.jenis_komponen, JENIS_KOMPONEN, "jenis_komponen");
        const volume = angkaOpsional(item.volume_ml, "volume_ml");
        if (!volume || volume <= 0) throw permintaanSalah("volume_ml harus lebih dari 0");
        const kedaluwarsa = tanggalOpsional(item.tanggal_kedaluwarsa, "tanggal_kedaluwarsa");
        if (kedaluwarsa < hariIni()) throw permintaanSalah("tanggal_kedaluwarsa tidak boleh sudah lewat");
        const golongan = item.golongan_darah === undefined ? a.golongan_darah : cekPilihan(item.golongan_darah, GOLONGAN_DARAH, "golongan_darah");
        const rhesus = item.rhesus === undefined ? a.rhesus : cekPilihan(item.rhesus, { positif: 1, negatif: 1 }, "rhesus");
        const label = `${a.no_kantong}-${jenis}${existing.n + idx + 1 > 1 ? `-${existing.n + idx + 1}` : ""}`;
        const komp = await sisipkan(
          "utd_komponen",
          {
            faskes_uuid: faskes, aftap_uuid: a.uuid, jenis_komponen: jenis, label_unik: label, volume_ml: volume,
            golongan_darah: golongan ?? null, rhesus: rhesus ?? null, tanggal_kedaluwarsa: kedaluwarsa, status: statusAwal,
            dilepas_oleh: statusAwal === "tersedia" ? req.author.username ?? null : null,
            dilepas_pada: statusAwal === "tersedia" ? sekarang() : null,
            dibuat_oleh: req.author.username ?? null,
          },
          k,
        );
        dibuat.push(komp);
      }
      return dibuat;
    });
    kirim(res, hasil, `${hasil.length} komponen tersimpan (${hasil[0].status})`);
  }),
);

export default rute;
