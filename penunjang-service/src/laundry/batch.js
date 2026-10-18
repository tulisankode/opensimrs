import express from "express";
import { query, satu, sisipkan, sekarang, transaksi, uuidv7 } from "../db.js";
import { tangani, kirim, wajib, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { izinLaundry } from "../umum/izin.js";
import { KATEGORI_LINEN, STATUS_BATCH, URUTAN_TAHAP, beratPositif, bulatPositif, cekPilihan, cekTransisiTahap, epochOpsional, periode, rincianUnik, teks } from "./bersama.js";
import { catatTransaksiStok } from "./stok.js";

// Pemrosesan batch (UC-2): batch dibentuk dari rincian penerimaan terkonfirmasi berkategori sama (boleh lintas
// ruangan — KF-7), berat dicatat dalam kg terpisah dari jumlah unit. Tahapan pencucian → pengeringan →
// setrika/lipat berurutan; saat setrika/lipat selesai, linen masuk stok bersih laundry (sekali, di transaksi yang sama).

export const rute = express.Router();

rute.get(
  "/batch",
  izinLaundry("Batch", "READ"),
  tangani(async (req, res) => {
    const { dari, sampai } = periode(req.query);
    const p = [req.author.faskesUuid];
    let w = "b.faskes_uuid = $1 AND b.deleted_at IS NULL";
    if (req.query.status) {
      p.push(cekPilihan(req.query.status, STATUS_BATCH, "status"));
      w += ` AND b.status = $${p.length}`;
    }
    if (req.query.kategori) {
      p.push(cekPilihan(req.query.kategori, KATEGORI_LINEN, "kategori"));
      w += ` AND b.kategori = $${p.length}`;
    }
    if (dari) {
      p.push(dari);
      w += ` AND b.waktu_mulai >= $${p.length}`;
    }
    if (sampai) {
      p.push(sampai);
      w += ` AND b.waktu_mulai <= $${p.length}`;
    }
    kirim(
      res,
      await query(
        `SELECT b.*,
                (SELECT COALESCE(json_agg(t ORDER BY array_position(ARRAY['pencucian','pengeringan','setrika_lipat']::varchar[], t.tahap)), '[]')
                   FROM laundry_batch_tahap t WHERE t.batch_uuid = b.uuid AND t.faskes_uuid = b.faskes_uuid AND t.deleted_at IS NULL) AS tahapan,
                (SELECT COALESCE(json_agg(json_build_object('uuid', a.uuid, 'rincian_penerimaan_uuid', a.rincian_penerimaan_uuid, 'jumlah_diproses', a.jumlah_diproses,
                          'jenis_linen_uuid', d.jenis_linen_uuid, 'nama_linen', j.nama, 'lokasi_uuid', pn.lokasi_uuid, 'nama_ruangan', l.name)), '[]')
                   FROM laundry_batch_asal a
                   JOIN laundry_penerimaan_rincian d ON d.uuid = a.rincian_penerimaan_uuid AND d.faskes_uuid = a.faskes_uuid
                   JOIN laundry_penerimaan pn ON pn.uuid = d.penerimaan_uuid AND pn.faskes_uuid = d.faskes_uuid
                   JOIN laundry_jenis_linen j ON j.uuid = d.jenis_linen_uuid AND j.faskes_uuid = d.faskes_uuid
                   LEFT JOIN lokasi l ON l.uuid = pn.lokasi_uuid AND l.faskes_uuid = pn.faskes_uuid
                  WHERE a.batch_uuid = b.uuid AND a.faskes_uuid = b.faskes_uuid AND a.deleted_at IS NULL) AS asal
           FROM laundry_batch b WHERE ${w} ORDER BY b.waktu_mulai DESC LIMIT 500`,
        p,
      ),
    );
  }),
);

rute.post(
  "/batch",
  izinLaundry("Batch", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["rincian_asal", "berat_kg"]);
    const asal = rincianUnik(b.rincian_asal, "rincian_penerimaan_uuid", "Asal batch");
    const beratKg = beratPositif(b.berat_kg, "berat_kg");
    const waktuMulai = epochOpsional(b.waktu_mulai, "waktu_mulai", sekarang());
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      // Kunci rincian asal (urutan uuid tetap) agar dua batch bersamaan tidak memproses sisa yang sama dua kali.
      const refs = [];
      for (const x of asal) {
        const r = await satu(
          `SELECT d.* FROM laundry_penerimaan_rincian d JOIN laundry_penerimaan p ON p.uuid = d.penerimaan_uuid AND p.faskes_uuid = d.faskes_uuid
            WHERE d.uuid = $1 AND d.faskes_uuid = $2 AND p.status = 'selesai' AND d.deleted_at IS NULL AND p.deleted_at IS NULL FOR UPDATE OF d`,
          [String(x.rincian_penerimaan_uuid), f],
          k,
        );
        if (!r) throw permintaanSalah("Asal batch tidak valid atau penerimaan belum dikonfirmasi");
        const jumlah = bulatPositif(x.jumlah_diproses, "jumlah_diproses");
        const total = await satu(
          `SELECT COALESCE(SUM(jumlah_diproses), 0)::numeric AS jumlah FROM laundry_batch_asal WHERE rincian_penerimaan_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`,
          [r.uuid, f],
          k,
        );
        const sisa = Number(r.jumlah_diterima ?? 0) - Number(total.jumlah);
        if (jumlah > sisa) throw permintaanSalah(`Jumlah yang diproses melebihi sisa linen kotor yang belum dicuci (sisa ${sisa})`);
        refs.push({ ...r, jumlah });
      }
      if (new Set(refs.map((x) => x.kategori)).size !== 1) throw permintaanSalah("Kategori berbeda harus diproses dalam batch terpisah");
      const uuid = uuidv7();
      const batch = await sisipkan(
        "laundry_batch",
        {
          uuid,
          faskes_uuid: f,
          kode: teks(b.kode) ?? `LDR-${new Date(waktuMulai * 1000).toISOString().slice(0, 10).replace(/-/g, "")}-${uuid.slice(-6).toUpperCase()}`,
          status: "proses",
          kategori: refs[0].kategori,
          berat_kg: beratKg,
          waktu_mulai: waktuMulai,
          petugas_uuid: req.author.username,
          catatan: teks(b.catatan) ?? null,
        },
        k,
      );
      for (const x of refs) await sisipkan("laundry_batch_asal", { faskes_uuid: f, batch_uuid: batch.uuid, rincian_penerimaan_uuid: x.uuid, jumlah_diproses: x.jumlah }, k);
      for (const tahap of URUTAN_TAHAP) await sisipkan("laundry_batch_tahap", { faskes_uuid: f, batch_uuid: batch.uuid, tahap, status: "belum" }, k);
      return batch;
    });
    kirim(res, hasil, "Batch laundry berhasil dibuat");
  }),
);

rute.patch(
  "/batch/:uuid/tahap/:tahap",
  izinLaundry("Batch", "UPDATE"),
  tangani(async (req, res) => {
    wajib(req.body, ["status"]);
    const f = req.author.faskesUuid;
    const tahap = String(req.params.tahap);
    const status = String(req.body.status);
    const hasil = await transaksi(async (k) => {
      const b = await satu(`SELECT * FROM laundry_batch WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, f], k);
      if (!b) throw tidakDitemukan("Batch");
      if (b.status !== "proses") throw permintaanSalah("Batch sudah selesai");
      const tahapan = await query(`SELECT * FROM laundry_batch_tahap WHERE batch_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [b.uuid, f], k);
      const { selesaiBatch } = cekTransisiTahap(tahapan, tahap, status);
      const waktu = sekarang();
      const t = await satu(
        `UPDATE laundry_batch_tahap
            SET status = $1::varchar, waktu_mulai = COALESCE(waktu_mulai, $2::bigint),
                waktu_selesai = CASE WHEN $1::varchar = 'selesai' THEN $2::bigint ELSE NULL END,
                petugas_uuid = $3, catatan = COALESCE($4::text, catatan), updated_at = $2::bigint
          WHERE batch_uuid = $5 AND tahap = $6 AND faskes_uuid = $7 AND deleted_at IS NULL RETURNING *`,
        [status, waktu, req.author.username, teks(req.body.catatan) ?? null, b.uuid, tahap, f],
        k,
      );
      let batch = b;
      if (selesaiBatch) {
        batch = await satu(`UPDATE laundry_batch SET status = 'selesai', waktu_selesai = $1, updated_at = $1 WHERE uuid = $2 RETURNING *`, [waktu, b.uuid], k);
        // Linen bersih masuk stok laundry per jenis (jumlah unit dari asal batch).
        const perJenis = await query(
          `SELECT d.jenis_linen_uuid, SUM(a.jumlah_diproses)::numeric AS jumlah FROM laundry_batch_asal a
             JOIN laundry_penerimaan_rincian d ON d.uuid = a.rincian_penerimaan_uuid AND d.faskes_uuid = a.faskes_uuid
            WHERE a.batch_uuid = $1 AND a.faskes_uuid = $2 AND a.deleted_at IS NULL GROUP BY d.jenis_linen_uuid ORDER BY d.jenis_linen_uuid`,
          [b.uuid, f],
          k,
        );
        for (const x of perJenis)
          await catatTransaksiStok(k, {
            faskesUuid: f,
            lokasiTipe: "laundry",
            jenisLinenUuid: x.jenis_linen_uuid,
            sumberTipe: "batch_selesai",
            sumberUuid: b.uuid,
            arah: "masuk",
            jumlah: Number(x.jumlah),
            alasan: `Batch ${b.kode} selesai`,
            petugasUuid: req.author.username,
            waktuTransaksi: waktu,
          });
      }
      return { batch, tahap: t };
    });
    kirim(res, hasil, hasil.batch.status === "selesai" ? "Batch selesai; linen bersih masuk stok laundry" : "Tahap batch berhasil diperbarui");
  }),
);

export default rute;
