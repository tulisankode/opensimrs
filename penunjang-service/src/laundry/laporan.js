import express from "express";
import { query } from "../db.js";
import { tangani, kirim } from "../umum/respons.js";
import { izinLaundry } from "../umum/izin.js";
import { periode } from "./bersama.js";

// Laporan Laundry (UC-4/UC-5): beban kg per ruangan, perputaran, selisih serah terima & distribusi, koreksi
// (hilang/rusak/afkir), pemisahan infeksius, rekonsiliasi buku stok, dan data ekspor. Semua agregat diambil dari
// data tercatat faskes token. Biaya per kg tidak disajikan karena sumber biaya belum dikonfigurasi (KT-16).

export const rute = express.Router();

// Kondisi periode untuk kolom waktu tertentu; parameter ditambahkan ke p.
const rentang = (p, kolom, { dari, sampai }) => {
  let w = "";
  if (dari) {
    p.push(dari);
    w += ` AND ${kolom} >= $${p.length}`;
  }
  if (sampai) {
    p.push(sampai);
    w += ` AND ${kolom} <= $${p.length}`;
  }
  return w;
};

rute.get(
  "/laporan",
  izinLaundry("Laporan Laundry", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const per = periode(req.query);

    // Beban kg per ruangan: berat batch dialokasikan proporsional terhadap jumlah unit asal tiap ruangan.
    const pb = [f];
    const beban = await query(
      `SELECT p.lokasi_uuid, l.name AS nama_ruangan, ROUND(SUM(b.berat_kg * a.jumlah_diproses / NULLIF(t.total, 0)), 3)::numeric AS berat_kg,
              SUM(a.jumlah_diproses)::numeric AS jumlah_unit
         FROM laundry_batch b
         JOIN laundry_batch_asal a ON a.batch_uuid = b.uuid AND a.faskes_uuid = b.faskes_uuid AND a.deleted_at IS NULL
         JOIN laundry_penerimaan_rincian d ON d.uuid = a.rincian_penerimaan_uuid AND d.faskes_uuid = a.faskes_uuid
         JOIN laundry_penerimaan p ON p.uuid = d.penerimaan_uuid AND p.faskes_uuid = d.faskes_uuid
         LEFT JOIN lokasi l ON l.uuid = p.lokasi_uuid AND l.faskes_uuid = p.faskes_uuid
         CROSS JOIN LATERAL (SELECT SUM(jumlah_diproses) AS total FROM laundry_batch_asal WHERE batch_uuid = b.uuid AND faskes_uuid = b.faskes_uuid AND deleted_at IS NULL) t
        WHERE b.faskes_uuid = $1 AND b.deleted_at IS NULL ${rentang(pb, "b.waktu_mulai", per)}
        GROUP BY p.lokasi_uuid, l.name ORDER BY l.name`,
      pb,
    );

    // Perputaran per ruangan/jenis: linen kotor keluar (cuci) & bersih masuk; putaran = keluar cuci ÷ par level.
    const pp = [f];
    const perputaran = await query(
      `SELECT t.lokasi_uuid, l.name AS nama_ruangan, t.jenis_linen_uuid, j.nama AS nama_linen,
              SUM(CASE WHEN t.arah = 'masuk' AND t.sumber_tipe = 'distribusi_terima' THEN t.jumlah ELSE 0 END)::numeric AS jumlah_masuk,
              SUM(CASE WHEN t.arah = 'keluar' AND t.sumber_tipe = 'penerimaan_kotor' THEN t.jumlah ELSE 0 END)::numeric AS jumlah_keluar,
              MAX(sl.par_level)::numeric AS par_level
         FROM laundry_transaksi_stok t
         JOIN laundry_jenis_linen j ON j.uuid = t.jenis_linen_uuid AND j.faskes_uuid = t.faskes_uuid
         LEFT JOIN lokasi l ON l.uuid = t.lokasi_uuid AND l.faskes_uuid = t.faskes_uuid
         LEFT JOIN laundry_stok_lokasi sl ON sl.faskes_uuid = t.faskes_uuid AND sl.lokasi_uuid = t.lokasi_uuid AND sl.jenis_linen_uuid = t.jenis_linen_uuid AND sl.deleted_at IS NULL
        WHERE t.faskes_uuid = $1 AND t.lokasi_tipe = 'ruangan' AND t.deleted_at IS NULL ${rentang(pp, "t.waktu_transaksi", per)}
        GROUP BY t.lokasi_uuid, l.name, t.jenis_linen_uuid, j.nama ORDER BY l.name, j.nama`,
      pp,
    );

    const ps = [f];
    const selisihPenerimaan = await query(
      `SELECT p.lokasi_uuid, l.name AS nama_ruangan, d.kategori, SUM(d.jumlah_diserahkan)::numeric AS jumlah_diserahkan,
              SUM(d.jumlah_diterima)::numeric AS jumlah_diterima, SUM(d.jumlah_diserahkan - d.jumlah_diterima)::numeric AS selisih
         FROM laundry_penerimaan_rincian d
         JOIN laundry_penerimaan p ON p.uuid = d.penerimaan_uuid AND p.faskes_uuid = d.faskes_uuid
         LEFT JOIN lokasi l ON l.uuid = p.lokasi_uuid AND l.faskes_uuid = p.faskes_uuid
        WHERE d.faskes_uuid = $1 AND p.status = 'selesai' AND d.deleted_at IS NULL AND p.deleted_at IS NULL ${rentang(ps, "p.waktu_serah", per)}
        GROUP BY p.lokasi_uuid, l.name, d.kategori HAVING SUM(d.jumlah_diserahkan - d.jumlah_diterima) <> 0 ORDER BY l.name`,
      ps,
    );

    const pd = [f];
    const selisihDistribusi = await query(
      `SELECT d.lokasi_uuid, l.name AS nama_ruangan, j.nama AS nama_linen, SUM(i.jumlah_dikirim)::numeric AS jumlah_dikirim,
              SUM(i.jumlah_diterima)::numeric AS jumlah_diterima, SUM(i.jumlah_dikirim - i.jumlah_diterima)::numeric AS selisih
         FROM laundry_distribusi_rincian i
         JOIN laundry_distribusi d ON d.uuid = i.distribusi_uuid AND d.faskes_uuid = i.faskes_uuid
         JOIN laundry_jenis_linen j ON j.uuid = i.jenis_linen_uuid AND j.faskes_uuid = i.faskes_uuid
         LEFT JOIN lokasi l ON l.uuid = d.lokasi_uuid AND l.faskes_uuid = d.faskes_uuid
        WHERE i.faskes_uuid = $1 AND d.status = 'selesai' AND i.deleted_at IS NULL AND d.deleted_at IS NULL ${rentang(pd, "d.waktu_kirim", per)}
        GROUP BY d.lokasi_uuid, l.name, j.nama HAVING SUM(i.jumlah_dikirim - i.jumlah_diterima) <> 0 ORDER BY l.name, j.nama`,
      pd,
    );

    const pk = [f];
    const koreksi = await query(
      `SELECT t.sumber_tipe AS jenis_koreksi, t.lokasi_tipe, t.lokasi_uuid, l.name AS nama_lokasi, SUM(t.jumlah)::numeric AS jumlah
         FROM laundry_transaksi_stok t LEFT JOIN lokasi l ON l.uuid = t.lokasi_uuid AND l.faskes_uuid = t.faskes_uuid
        WHERE t.faskes_uuid = $1 AND t.sumber_tipe IN ('hilang','rusak','afkir') AND t.deleted_at IS NULL ${rentang(pk, "t.waktu_transaksi", per)}
        GROUP BY t.sumber_tipe, t.lokasi_tipe, t.lokasi_uuid, l.name ORDER BY t.sumber_tipe, l.name`,
      pk,
    );

    // Pemisahan kategori (KF-7/KT-7): linen diterima per kategori vs yang sudah tercatat diproses di batch berkategori sama.
    const pi = [f];
    const pemisahan = await query(
      `SELECT d.kategori, SUM(d.jumlah_diterima)::numeric AS jumlah_diterima,
              SUM(COALESCE((SELECT SUM(a.jumlah_diproses) FROM laundry_batch_asal a JOIN laundry_batch b ON b.uuid = a.batch_uuid AND b.faskes_uuid = a.faskes_uuid
                             WHERE a.rincian_penerimaan_uuid = d.uuid AND a.faskes_uuid = d.faskes_uuid AND b.kategori = d.kategori AND a.deleted_at IS NULL AND b.deleted_at IS NULL), 0))::numeric AS jumlah_diproses_terpisah
         FROM laundry_penerimaan_rincian d JOIN laundry_penerimaan p ON p.uuid = d.penerimaan_uuid AND p.faskes_uuid = d.faskes_uuid
        WHERE d.faskes_uuid = $1 AND p.status = 'selesai' AND d.deleted_at IS NULL AND p.deleted_at IS NULL ${rentang(pi, "p.waktu_serah", per)}
        GROUP BY d.kategori ORDER BY d.kategori`,
      pi,
    );

    kirim(res, {
      periode: per,
      beban_kg_per_ruangan: beban,
      perputaran: perputaran.map((r) => ({ ...r, putaran: Number(r.par_level) > 0 ? Math.round((Number(r.jumlah_keluar) / Number(r.par_level)) * 100) / 100 : null })),
      selisih_penerimaan: selisihPenerimaan,
      selisih_distribusi: selisihDistribusi,
      koreksi,
      pemisahan_kategori: pemisahan.map((r) => ({ ...r, belum_terlacak: Number(r.jumlah_diterima) - Number(r.jumlah_diproses_terpisah) })),
      biaya_per_kg: null,
      keterangan_biaya: "Biaya per kg tidak ditampilkan: sumber biaya belum dikonfigurasi",
    });
  }),
);

// Rekonsiliasi buku stok per lokasi & jenis: saldo awal (sebelum periode), mutasi periode per sumber, saldo akhir.
rute.get(
  "/laporan/rekonsiliasi",
  izinLaundry("Laporan Laundry", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const { dari, sampai } = periode(req.query);
    const p = [f, dari ?? 0, sampai ?? 9999999999];
    let w = "";
    if (req.query.lokasi_uuid) {
      p.push(String(req.query.lokasi_uuid));
      w = ` AND t.lokasi_uuid = $${p.length}`;
    }
    const rows = await query(
      `SELECT t.lokasi_tipe, t.lokasi_uuid, l.name AS nama_lokasi, t.jenis_linen_uuid, j.nama AS nama_linen,
              SUM(CASE WHEN t.waktu_transaksi < $2 THEN (CASE WHEN t.arah = 'masuk' THEN t.jumlah ELSE -t.jumlah END) ELSE 0 END)::numeric AS saldo_awal,
              SUM(CASE WHEN t.waktu_transaksi BETWEEN $2 AND $3 AND t.arah = 'masuk' THEN t.jumlah ELSE 0 END)::numeric AS masuk,
              SUM(CASE WHEN t.waktu_transaksi BETWEEN $2 AND $3 AND t.arah = 'keluar' AND t.sumber_tipe NOT IN ('hilang','rusak','afkir') THEN t.jumlah ELSE 0 END)::numeric AS keluar,
              SUM(CASE WHEN t.waktu_transaksi BETWEEN $2 AND $3 AND t.sumber_tipe = 'hilang' THEN t.jumlah ELSE 0 END)::numeric AS hilang,
              SUM(CASE WHEN t.waktu_transaksi BETWEEN $2 AND $3 AND t.sumber_tipe = 'rusak' THEN t.jumlah ELSE 0 END)::numeric AS rusak,
              SUM(CASE WHEN t.waktu_transaksi BETWEEN $2 AND $3 AND t.sumber_tipe = 'afkir' THEN t.jumlah ELSE 0 END)::numeric AS afkir,
              SUM(CASE WHEN t.waktu_transaksi <= $3 THEN (CASE WHEN t.arah = 'masuk' THEN t.jumlah ELSE -t.jumlah END) ELSE 0 END)::numeric AS saldo_akhir
         FROM laundry_transaksi_stok t
         JOIN laundry_jenis_linen j ON j.uuid = t.jenis_linen_uuid AND j.faskes_uuid = t.faskes_uuid
         LEFT JOIN lokasi l ON l.uuid = t.lokasi_uuid AND l.faskes_uuid = t.faskes_uuid
        WHERE t.faskes_uuid = $1 AND t.deleted_at IS NULL ${w}
        GROUP BY t.lokasi_tipe, t.lokasi_uuid, l.name, t.jenis_linen_uuid, j.nama
        ORDER BY t.lokasi_tipe DESC, l.name, j.nama`,
      p,
    );
    // Selisih = saldo akhir − (saldo awal + masuk − keluar − hilang − rusak − afkir); selalu 0 bila buku konsisten.
    kirim(
      res,
      rows.map((r) => {
        const n = (x) => Number(x ?? 0);
        return { ...r, selisih: n(r.saldo_akhir) - (n(r.saldo_awal) + n(r.masuk) - n(r.keluar) - n(r.hilang) - n(r.rusak) - n(r.afkir)) };
      }),
    );
  }),
);

// Data ekspor (frontend menyusun berkas Excel): buku transaksi stok periode, cakupan faskes token.
rute.get(
  "/laporan/ekspor",
  izinLaundry("Laporan Laundry", "CETAK LAPORAN"),
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    const w = rentang(p, "t.waktu_transaksi", periode(req.query));
    kirim(
      res,
      await query(
        `SELECT t.waktu_transaksi, t.lokasi_tipe, l.name AS nama_ruangan, j.kode AS kode_linen, j.nama AS jenis_linen,
                t.sumber_tipe, t.arah, t.jumlah, t.alasan, t.petugas_uuid AS petugas
           FROM laundry_transaksi_stok t
           JOIN laundry_jenis_linen j ON j.uuid = t.jenis_linen_uuid AND j.faskes_uuid = t.faskes_uuid
           LEFT JOIN lokasi l ON l.uuid = t.lokasi_uuid AND l.faskes_uuid = t.faskes_uuid
          WHERE t.faskes_uuid = $1 AND t.deleted_at IS NULL ${w} ORDER BY t.waktu_transaksi LIMIT 50000`,
        p,
      ),
      "Data ekspor Laundry berhasil disiapkan",
    );
  }),
);

export default rute;
