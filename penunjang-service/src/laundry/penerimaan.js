import express from "express";
import { query, satu, sisipkan, sekarang, transaksi } from "../db.js";
import { tangani, kirim, wajib, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { izinLaundry } from "../umum/izin.js";
import { KATEGORI_LINEN, STATUS_PENERIMAAN, angkaWajib, bulatPositif, cekPilihan, epochOpsional, konflik, periode, teks } from "./bersama.js";
import { keluarkanStok, saldoLinen, validasiJenis, validasiRuangan } from "./stok.js";

// Serah terima linen kotor (UC-1): ruangan menyerahkan → petugas laundry (≠ penyerah) mengonfirmasi jumlah aktual.
// Rincian awal (jumlah_diserahkan) tidak pernah ditimpa; jumlah diterima & alasan selisih disimpan terpisah (KT-5).

export const rute = express.Router();

const SQL_DAFTAR = `
  SELECT p.*, l.name AS nama_ruangan,
         (SELECT COALESCE(json_agg(json_build_object(
                    'uuid', d.uuid, 'jenis_linen_uuid', d.jenis_linen_uuid, 'nama_linen', j.nama, 'satuan', j.satuan, 'kategori', d.kategori,
                    'jumlah_diserahkan', d.jumlah_diserahkan, 'jumlah_diterima', d.jumlah_diterima, 'alasan_selisih', d.alasan_selisih,
                    'jumlah_diproses', COALESCE((SELECT SUM(a.jumlah_diproses) FROM laundry_batch_asal a
                                                 WHERE a.rincian_penerimaan_uuid = d.uuid AND a.faskes_uuid = d.faskes_uuid AND a.deleted_at IS NULL), 0)
                  ) ORDER BY j.nama), '[]')
            FROM laundry_penerimaan_rincian d JOIN laundry_jenis_linen j ON j.uuid = d.jenis_linen_uuid AND j.faskes_uuid = d.faskes_uuid
           WHERE d.penerimaan_uuid = p.uuid AND d.faskes_uuid = p.faskes_uuid AND d.deleted_at IS NULL) AS rincian
    FROM laundry_penerimaan p
    LEFT JOIN lokasi l ON l.uuid = p.lokasi_uuid AND l.faskes_uuid = p.faskes_uuid`;

rute.get(
  "/penerimaan",
  izinLaundry("Penerimaan", "READ"),
  tangani(async (req, res) => {
    const { dari, sampai } = periode(req.query);
    const p = [req.author.faskesUuid];
    let w = "p.faskes_uuid = $1 AND p.deleted_at IS NULL";
    if (req.query.status) {
      p.push(cekPilihan(req.query.status, STATUS_PENERIMAAN, "status"));
      w += ` AND p.status = $${p.length}`;
    }
    if (req.query.lokasi_uuid) {
      p.push(String(req.query.lokasi_uuid));
      w += ` AND p.lokasi_uuid = $${p.length}`;
    }
    if (req.query.kategori) {
      p.push(cekPilihan(req.query.kategori, KATEGORI_LINEN, "kategori"));
      w += ` AND EXISTS (SELECT 1 FROM laundry_penerimaan_rincian d WHERE d.penerimaan_uuid = p.uuid AND d.faskes_uuid = p.faskes_uuid AND d.kategori = $${p.length} AND d.deleted_at IS NULL)`;
    }
    if (dari) {
      p.push(dari);
      w += ` AND p.waktu_serah >= $${p.length}`;
    }
    if (sampai) {
      p.push(sampai);
      w += ` AND p.waktu_serah <= $${p.length}`;
    }
    kirim(res, await query(`${SQL_DAFTAR} WHERE ${w} ORDER BY p.waktu_serah DESC LIMIT 500`, p));
  }),
);

// Antrean cuci: rincian penerimaan terkonfirmasi yang masih punya sisa belum masuk batch (bahan form batch).
rute.get(
  "/penerimaan/antrean",
  izinLaundry("Batch", "READ"),
  tangani(async (req, res) => {
    kirim(
      res,
      await query(
        `SELECT * FROM (
           SELECT d.uuid AS rincian_penerimaan_uuid, d.penerimaan_uuid, p.lokasi_uuid, l.name AS nama_ruangan, p.waktu_terima,
                  d.jenis_linen_uuid, j.nama AS nama_linen, j.satuan, d.kategori, d.jumlah_diterima,
                  d.jumlah_diterima - COALESCE((SELECT SUM(a.jumlah_diproses) FROM laundry_batch_asal a
                       WHERE a.rincian_penerimaan_uuid = d.uuid AND a.faskes_uuid = d.faskes_uuid AND a.deleted_at IS NULL), 0) AS sisa
             FROM laundry_penerimaan_rincian d
             JOIN laundry_penerimaan p ON p.uuid = d.penerimaan_uuid AND p.faskes_uuid = d.faskes_uuid
             JOIN laundry_jenis_linen j ON j.uuid = d.jenis_linen_uuid AND j.faskes_uuid = d.faskes_uuid
             LEFT JOIN lokasi l ON l.uuid = p.lokasi_uuid AND l.faskes_uuid = p.faskes_uuid
            WHERE d.faskes_uuid = $1 AND p.status = 'selesai' AND d.deleted_at IS NULL AND p.deleted_at IS NULL
         ) x WHERE x.sisa > 0 ORDER BY x.kategori, x.waktu_terima LIMIT 1000`,
        [req.author.faskesUuid],
      ),
    );
  }),
);

rute.post(
  "/penerimaan",
  izinLaundry("Penerimaan", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["lokasi_uuid", "rincian"]);
    if (!Array.isArray(b.rincian) || !b.rincian.length) throw permintaanSalah("Rincian linen wajib diisi");
    if (b.rincian.length > 200) throw permintaanSalah("Rincian linen maksimal 200 baris");
    const f = req.author.faskesUuid;
    const waktuSerah = epochOpsional(b.waktu_serah, "waktu_serah", sekarang());
    if (waktuSerah > sekarang() + 300) throw permintaanSalah("waktu_serah tidak boleh di masa depan");
    // Jenis + kategori yang sama cukup satu baris (kategori berbeda dari jenis yang sama boleh, mis. infeksius terpisah).
    const lihat = new Set();
    const rincian = b.rincian.map((d) => {
      wajib(d, ["jenis_linen_uuid", "jumlah_diserahkan", "kategori"]);
      const kategori = cekPilihan(d.kategori, KATEGORI_LINEN, "kategori");
      const kunci = `${d.jenis_linen_uuid}|${kategori}`;
      if (lihat.has(kunci)) throw permintaanSalah("Rincian memuat jenis linen & kategori yang sama lebih dari sekali");
      lihat.add(kunci);
      return { jenis_linen_uuid: String(d.jenis_linen_uuid), kategori, jumlah: bulatPositif(d.jumlah_diserahkan, "jumlah_diserahkan") };
    });
    const hasil = await transaksi(async (k) => {
      const ruang = await validasiRuangan(b.lokasi_uuid, f, k);
      const p = await sisipkan(
        "laundry_penerimaan",
        { faskes_uuid: f, lokasi_uuid: ruang.uuid, waktu_serah: waktuSerah, status: "menunggu_konfirmasi", petugas_penyerah: req.author.username, catatan: teks(b.catatan) ?? null },
        k,
      );
      // Pemeriksaan awal saldo ruangan (pengurangan sebenarnya dikunci & divalidasi ulang saat konfirmasi).
      const perJenis = new Map();
      for (const d of rincian) perJenis.set(d.jenis_linen_uuid, (perJenis.get(d.jenis_linen_uuid) ?? 0) + d.jumlah);
      for (const [jenisUuid, total] of perJenis) {
        const j = await validasiJenis(jenisUuid, f, k);
        const saldo = await saldoLinen(f, "ruangan", ruang.uuid, j.uuid, k);
        if (saldo < total) throw permintaanSalah(`Saldo ${j.nama} di ruangan ${ruang.nama} hanya ${saldo}; catat saldo awal/distribusi terlebih dahulu`);
      }
      for (const d of rincian) {
        await sisipkan("laundry_penerimaan_rincian", { faskes_uuid: f, penerimaan_uuid: p.uuid, jenis_linen_uuid: d.jenis_linen_uuid, jumlah_diserahkan: d.jumlah, kategori: d.kategori }, k);
      }
      return p;
    });
    kirim(res, hasil, "Serah terima linen kotor berhasil dicatat, menunggu konfirmasi petugas laundry");
  }),
);

// Konfirmasi petugas laundry: jumlah aktual per rincian; stok ruangan asal berkurang sebanyak jumlah diterima.
rute.post(
  "/penerimaan/:uuid/konfirmasi",
  izinLaundry("Penerimaan", "KONFIRMASI"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["rincian"]);
    if (!Array.isArray(b.rincian)) throw permintaanSalah("rincian harus berupa daftar");
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const p = await satu(`SELECT * FROM laundry_penerimaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, f], k);
      if (!p) throw tidakDitemukan("Penerimaan");
      if (p.status !== "menunggu_konfirmasi") throw konflik("Penerimaan sudah dikonfirmasi");
      if (p.petugas_penyerah === req.author.username) throw permintaanSalah("Petugas penerima harus berbeda dari petugas penyerah");
      const tersimpan = await query(
        `SELECT d.*, j.nama AS nama_linen FROM laundry_penerimaan_rincian d JOIN laundry_jenis_linen j ON j.uuid = d.jenis_linen_uuid AND j.faskes_uuid = d.faskes_uuid
          WHERE d.penerimaan_uuid = $1 AND d.faskes_uuid = $2 AND d.deleted_at IS NULL ORDER BY d.jenis_linen_uuid, d.kategori`,
        [p.uuid, f],
        k,
      );
      const masukan = new Map(b.rincian.map((x) => [String(x?.uuid ?? ""), x]));
      if (masukan.size !== b.rincian.length || tersimpan.length !== b.rincian.length || tersimpan.some((r) => !masukan.has(r.uuid)))
        throw permintaanSalah("Konfirmasi harus memuat seluruh rincian penerimaan tepat satu kali");
      const ruang = await satu(`SELECT name AS nama FROM lokasi WHERE uuid = $1 AND faskes_uuid = $2`, [p.lokasi_uuid, f], k);
      const waktu = sekarang();
      for (const r of tersimpan) {
        const x = masukan.get(r.uuid);
        const jumlah = angkaWajib(x.jumlah_diterima, "jumlah_diterima");
        if (!Number.isInteger(jumlah) || jumlah < 0) throw permintaanSalah("jumlah_diterima harus berupa bilangan bulat tidak negatif");
        const alasan = teks(x.alasan_selisih) ?? null;
        if (jumlah !== Number(r.jumlah_diserahkan) && !alasan) throw permintaanSalah(`Alasan selisih wajib diisi untuk ${r.nama_linen}`);
        await query(`UPDATE laundry_penerimaan_rincian SET jumlah_diterima = $1, alasan_selisih = $2, updated_at = $3 WHERE uuid = $4`, [jumlah, alasan, waktu, r.uuid], k);
        if (jumlah > 0)
          await keluarkanStok(
            k,
            {
              faskesUuid: f,
              lokasiTipe: "ruangan",
              lokasiUuid: p.lokasi_uuid,
              namaLokasi: ruang?.nama,
              jenisLinenUuid: r.jenis_linen_uuid,
              sumberTipe: "penerimaan_kotor",
              sumberUuid: p.uuid,
              jumlah,
              alasan: `Serah terima linen kotor (${KATEGORI_LINEN[r.kategori] ?? r.kategori})`,
              petugasUuid: req.author.username,
              waktuTransaksi: waktu,
            },
            r.nama_linen,
          );
      }
      return satu(
        `UPDATE laundry_penerimaan SET status = 'selesai', petugas_penerima = $1, waktu_terima = $2, updated_at = $2 WHERE uuid = $3 RETURNING *`,
        [req.author.username, waktu, p.uuid],
        k,
      );
    });
    kirim(res, hasil, "Penerimaan linen kotor dikonfirmasi");
  }),
);

// Pembatalan oleh petugas penyerah, hanya sebelum dikonfirmasi (belum ada transaksi stok) — soft delete.
rute.delete(
  "/penerimaan/:uuid",
  izinLaundry("Penerimaan", "CREATE"),
  tangani(async (req, res) => {
    const rows = await query(
      `UPDATE laundry_penerimaan SET deleted_at = $1, updated_at = $1
        WHERE uuid = $2 AND faskes_uuid = $3 AND status = 'menunggu_konfirmasi' AND petugas_penyerah = $4 AND deleted_at IS NULL RETURNING uuid`,
      [sekarang(), req.params.uuid, req.author.faskesUuid, req.author.username],
    );
    if (!rows.length) throw tidakDitemukan("Serah terima milik Anda yang belum dikonfirmasi");
    kirim(res, { uuid: rows[0].uuid }, "Serah terima dibatalkan");
  }),
);

export default rute;
