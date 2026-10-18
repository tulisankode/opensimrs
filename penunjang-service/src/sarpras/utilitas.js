import express from "express";
import { query, satu, sisipkan, sekarang, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, permintaanSalah } from "../umum/respons.js";
import { izinSarpras } from "../umum/izin.js";
import { JENIS_UTILITAS, angkaOpsional, cekPilihan, epochOpsional, periode, teks, teksWajib, wajibPilihan } from "./bersama.js";
import { cekLokasi } from "./dasar.js";

// Pencatatan meter utilitas (KF-19, fitur opsional sarpras_utilitas): listrik/air/genset/oksigen sentral per lokasi.
const rute = express.Router();

rute.get(
  "/",
  izinSarpras("Utilitas", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "u.faskes_uuid = $1 AND u.deleted_at IS NULL";
    if (req.query.lokasi_uuid) {
      p.push(String(req.query.lokasi_uuid));
      w += ` AND u.lokasi_uuid = $${p.length}`;
    }
    const jenis = cekPilihan(req.query.jenis_utilitas || undefined, JENIS_UTILITAS, "jenis_utilitas");
    if (jenis) {
      p.push(jenis);
      w += ` AND u.jenis_utilitas = $${p.length}`;
    }
    const { mulai, selesai } = periode(req.query);
    if (mulai) {
      p.push(mulai);
      w += ` AND u.waktu_catat >= $${p.length}`;
    }
    if (selesai) {
      p.push(selesai);
      w += ` AND u.waktu_catat <= $${p.length}`;
    }
    const dari = `sarpras_utilitas_catatan u LEFT JOIN lokasi l ON l.uuid = u.lokasi_uuid AND l.faskes_uuid = u.faskes_uuid`;
    const total = (await satu(`SELECT COUNT(*) n FROM ${dari} WHERE ${w}`, p)).n;
    // Selisih terhadap catatan sebelumnya untuk lokasi & jenis yang sama (pemakaian periode).
    const rows = await query(
      `SELECT u.*, l.name AS nama_lokasi,
              u.nilai_meter - (SELECT s.nilai_meter FROM sarpras_utilitas_catatan s
                                WHERE s.faskes_uuid = u.faskes_uuid AND s.lokasi_uuid = u.lokasi_uuid AND s.jenis_utilitas = u.jenis_utilitas
                                  AND s.deleted_at IS NULL AND (s.waktu_catat < u.waktu_catat OR (s.waktu_catat = u.waktu_catat AND s.uuid < u.uuid))
                                ORDER BY s.waktu_catat DESC, s.uuid DESC LIMIT 1) AS selisih
         FROM ${dari} WHERE ${w} ORDER BY u.waktu_catat DESC, u.uuid DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.post(
  "/",
  izinSarpras("Utilitas", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    if (!b.lokasi_uuid) throw permintaanSalah("lokasi_uuid wajib diisi");
    const n = sekarang();
    const waktu = epochOpsional(b.waktu_catat, "waktu_catat") ?? n;
    if (waktu > n + 300) throw permintaanSalah("waktu_catat tidak boleh di masa depan");
    const nilai = angkaOpsional(b.nilai_meter, "nilai_meter", { min: 0, maks: 999999999999 });
    if (nilai === null || nilai === undefined) throw permintaanSalah("nilai_meter wajib diisi");
    const isi = {
      jenis_utilitas: wajibPilihan(b.jenis_utilitas, JENIS_UTILITAS, "jenis_utilitas"),
      satuan: teksWajib(b.satuan, "satuan", 20),
      catatan: teks(b.catatan, "catatan", 2000) ?? null,
    };
    const hasil = await transaksi(async (k) => {
      const lokasi = await cekLokasi(b.lokasi_uuid, f, k);
      return sisipkan("sarpras_utilitas_catatan", { ...isi, faskes_uuid: f, lokasi_uuid: lokasi.uuid, waktu_catat: waktu, nilai_meter: nilai, dicatat_oleh: req.author.username }, k);
    });
    kirim(res, hasil, "Catatan utilitas berhasil disimpan");
  }),
);

export default rute;
