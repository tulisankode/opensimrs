import express from "express";
import { query, satu, sisipkan, sekarang, transaksi } from "../db.js";
import { tangani, kirim, wajib, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { izinLaundry } from "../umum/izin.js";
import { STATUS_DISTRIBUSI, STATUS_PERMINTAAN, angkaWajib, bulatPositif, cekPilihan, konflik, periode, rincianUnik, statusPermintaan, teks } from "./bersama.js";
import { catatTransaksiStok, keluarkanStok, validasiJenis, validasiRuangan } from "./stok.js";

// Permintaan & distribusi linen bersih (UC-3): ruangan meminta → laundry mengirim dari stok bersih (ditolak bila
// saldo tidak cukup — KT-10) → ruangan (≠ pengirim) mengonfirmasi jumlah diterima → stok ruangan bertambah.
// Distribusi sebagian membuat permintaan tetap "sebagian" sampai seluruh jumlah terpenuhi (KT-11).

export const rute = express.Router();

const filterPeriode = (req, p, kolom) => {
  const { dari, sampai } = periode(req.query);
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

// ── Permintaan
rute.get(
  "/permintaan",
  izinLaundry("Permintaan Linen", "READ"),
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    let w = "pm.faskes_uuid = $1 AND pm.deleted_at IS NULL";
    if (req.query.status) {
      p.push(cekPilihan(req.query.status, STATUS_PERMINTAAN, "status"));
      w += ` AND pm.status = $${p.length}`;
    }
    if (req.query.lokasi_uuid) {
      p.push(String(req.query.lokasi_uuid));
      w += ` AND pm.lokasi_uuid = $${p.length}`;
    }
    w += filterPeriode(req, p, "pm.waktu_permintaan");
    kirim(
      res,
      await query(
        `SELECT pm.*, l.name AS nama_ruangan,
                (SELECT COALESCE(json_agg(json_build_object('uuid', r.uuid, 'jenis_linen_uuid', r.jenis_linen_uuid, 'nama_linen', j.nama, 'satuan', j.satuan,
                          'jumlah_diminta', r.jumlah_diminta, 'jumlah_terpenuhi', r.jumlah_terpenuhi) ORDER BY j.nama), '[]')
                   FROM laundry_permintaan_rincian r JOIN laundry_jenis_linen j ON j.uuid = r.jenis_linen_uuid AND j.faskes_uuid = r.faskes_uuid
                  WHERE r.permintaan_uuid = pm.uuid AND r.faskes_uuid = pm.faskes_uuid AND r.deleted_at IS NULL) AS rincian
           FROM laundry_permintaan pm LEFT JOIN lokasi l ON l.uuid = pm.lokasi_uuid AND l.faskes_uuid = pm.faskes_uuid
          WHERE ${w} ORDER BY pm.waktu_permintaan DESC LIMIT 500`,
        p,
      ),
    );
  }),
);

rute.post(
  "/permintaan",
  izinLaundry("Permintaan Linen", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["lokasi_uuid", "rincian"]);
    const rincian = rincianUnik(b.rincian, "jenis_linen_uuid", "Rincian permintaan");
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const ruang = await validasiRuangan(b.lokasi_uuid, f, k);
      const pm = await sisipkan(
        "laundry_permintaan",
        { faskes_uuid: f, lokasi_uuid: ruang.uuid, status: "menunggu", waktu_permintaan: sekarang(), petugas_peminta: req.author.username, catatan: teks(b.catatan) ?? null },
        k,
      );
      for (const x of rincian) {
        const j = await validasiJenis(x.jenis_linen_uuid, f, k, { aktif: true });
        await sisipkan("laundry_permintaan_rincian", { faskes_uuid: f, permintaan_uuid: pm.uuid, jenis_linen_uuid: j.uuid, jumlah_diminta: bulatPositif(x.jumlah_diminta, "jumlah_diminta"), jumlah_terpenuhi: 0 }, k);
      }
      return pm;
    });
    kirim(res, hasil, "Permintaan linen bersih berhasil dicatat");
  }),
);

rute.post(
  "/permintaan/:uuid/batal",
  izinLaundry("Permintaan Linen", "BATAL"),
  tangani(async (req, res) => {
    const alasan = teks(req.body?.alasan);
    if (!alasan) throw permintaanSalah("alasan wajib diisi");
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const pm = await satu(`SELECT * FROM laundry_permintaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, f], k);
      if (!pm) throw tidakDitemukan("Permintaan");
      if (!["menunggu", "sebagian"].includes(pm.status)) throw konflik(`Permintaan berstatus ${STATUS_PERMINTAAN[pm.status] ?? pm.status} tidak dapat dibatalkan`);
      const tertunda = await satu(`SELECT 1 FROM laundry_distribusi WHERE permintaan_uuid = $1 AND faskes_uuid = $2 AND status = 'menunggu_konfirmasi' AND deleted_at IS NULL LIMIT 1`, [pm.uuid, f], k);
      if (tertunda) throw konflik("Masih ada distribusi untuk permintaan ini yang belum dikonfirmasi");
      return satu(`UPDATE laundry_permintaan SET status = 'dibatalkan', alasan_batal = $1, waktu_batal = $2, updated_at = $2 WHERE uuid = $3 RETURNING *`, [alasan, sekarang(), pm.uuid], k);
    });
    kirim(res, hasil, "Permintaan dibatalkan");
  }),
);

// ── Distribusi
rute.get(
  "/distribusi",
  izinLaundry("Distribusi", "READ"),
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    let w = "d.faskes_uuid = $1 AND d.deleted_at IS NULL";
    if (req.query.status) {
      p.push(cekPilihan(req.query.status, STATUS_DISTRIBUSI, "status"));
      w += ` AND d.status = $${p.length}`;
    }
    if (req.query.lokasi_uuid) {
      p.push(String(req.query.lokasi_uuid));
      w += ` AND d.lokasi_uuid = $${p.length}`;
    }
    w += filterPeriode(req, p, "d.waktu_kirim");
    kirim(
      res,
      await query(
        `SELECT d.*, l.name AS nama_ruangan,
                (SELECT COALESCE(json_agg(json_build_object('uuid', i.uuid, 'jenis_linen_uuid', i.jenis_linen_uuid, 'nama_linen', j.nama, 'satuan', j.satuan,
                          'jumlah_dikirim', i.jumlah_dikirim, 'jumlah_diterima', i.jumlah_diterima, 'alasan_selisih', i.alasan_selisih) ORDER BY j.nama), '[]')
                   FROM laundry_distribusi_rincian i JOIN laundry_jenis_linen j ON j.uuid = i.jenis_linen_uuid AND j.faskes_uuid = i.faskes_uuid
                  WHERE i.distribusi_uuid = d.uuid AND i.faskes_uuid = d.faskes_uuid AND i.deleted_at IS NULL) AS rincian
           FROM laundry_distribusi d LEFT JOIN lokasi l ON l.uuid = d.lokasi_uuid AND l.faskes_uuid = d.faskes_uuid
          WHERE ${w} ORDER BY d.waktu_kirim DESC LIMIT 500`,
        p,
      ),
    );
  }),
);

rute.post(
  "/distribusi",
  izinLaundry("Distribusi", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["lokasi_tujuan_uuid", "rincian"]);
    const rincian = rincianUnik(b.rincian, "jenis_linen_uuid", "Rincian distribusi");
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const ruang = await validasiRuangan(b.lokasi_tujuan_uuid, f, k, "Ruangan tujuan");
      let permintaan = null;
      if (b.permintaan_uuid) {
        permintaan = await satu(`SELECT * FROM laundry_permintaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [String(b.permintaan_uuid), f], k);
        if (!permintaan) throw tidakDitemukan("Permintaan");
        if (!["menunggu", "sebagian"].includes(permintaan.status)) throw konflik("Permintaan sudah selesai atau dibatalkan");
        if (permintaan.lokasi_uuid !== ruang.uuid) throw permintaanSalah("Ruangan tujuan berbeda dengan ruangan peminta");
      }
      const waktu = sekarang();
      const d = await sisipkan(
        "laundry_distribusi",
        { faskes_uuid: f, lokasi_uuid: ruang.uuid, permintaan_uuid: permintaan?.uuid ?? null, status: "menunggu_konfirmasi", petugas_pengirim: req.author.username, waktu_kirim: waktu, catatan: teks(b.catatan) ?? null },
        k,
      );
      for (const x of rincian) {
        const j = await validasiJenis(x.jenis_linen_uuid, f, k);
        const jumlah = bulatPositif(x.jumlah_dikirim, "jumlah_dikirim");
        await keluarkanStok(
          k,
          { faskesUuid: f, lokasiTipe: "laundry", jenisLinenUuid: j.uuid, sumberTipe: "distribusi_kirim", sumberUuid: d.uuid, jumlah, alasan: `Distribusi ke ${ruang.nama}`, petugasUuid: req.author.username, waktuTransaksi: waktu },
          j.nama,
        );
        await sisipkan("laundry_distribusi_rincian", { faskes_uuid: f, distribusi_uuid: d.uuid, jenis_linen_uuid: j.uuid, jumlah_dikirim: jumlah }, k);
      }
      return d;
    });
    kirim(res, hasil, "Distribusi linen bersih dikirim, menunggu konfirmasi ruangan");
  }),
);

rute.post(
  "/distribusi/:uuid/konfirmasi",
  izinLaundry("Distribusi", "KONFIRMASI"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["rincian"]);
    if (!Array.isArray(b.rincian)) throw permintaanSalah("rincian harus berupa daftar");
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const d = await satu(`SELECT * FROM laundry_distribusi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, f], k);
      if (!d) throw tidakDitemukan("Distribusi");
      if (d.status !== "menunggu_konfirmasi") throw konflik("Distribusi sudah dikonfirmasi");
      if (d.petugas_pengirim === req.author.username) throw permintaanSalah("Petugas penerima harus berbeda dari petugas pengirim");
      const tersimpan = await query(
        `SELECT i.*, j.nama AS nama_linen FROM laundry_distribusi_rincian i JOIN laundry_jenis_linen j ON j.uuid = i.jenis_linen_uuid AND j.faskes_uuid = i.faskes_uuid
          WHERE i.distribusi_uuid = $1 AND i.faskes_uuid = $2 AND i.deleted_at IS NULL ORDER BY i.jenis_linen_uuid`,
        [d.uuid, f],
        k,
      );
      const masukan = new Map(b.rincian.map((x) => [String(x?.uuid ?? ""), x]));
      if (masukan.size !== b.rincian.length || tersimpan.length !== b.rincian.length || tersimpan.some((r) => !masukan.has(r.uuid)))
        throw permintaanSalah("Konfirmasi harus memuat seluruh rincian distribusi tepat satu kali");
      const permintaan = d.permintaan_uuid
        ? await satu(`SELECT * FROM laundry_permintaan WHERE uuid = $1 AND faskes_uuid = $2 FOR UPDATE`, [d.permintaan_uuid, f], k)
        : null;
      const waktu = sekarang();
      for (const item of tersimpan) {
        const x = masukan.get(item.uuid);
        const n = angkaWajib(x.jumlah_diterima, "jumlah_diterima");
        if (!Number.isInteger(n) || n < 0) throw permintaanSalah("jumlah_diterima harus berupa bilangan bulat tidak negatif");
        if (n > Number(item.jumlah_dikirim)) throw permintaanSalah(`Jumlah diterima ${item.nama_linen} tidak boleh melebihi jumlah dikirim`);
        const alasan = teks(x.alasan_selisih) ?? null;
        if (n !== Number(item.jumlah_dikirim) && !alasan) throw permintaanSalah(`Alasan selisih wajib diisi untuk ${item.nama_linen}`);
        await query(`UPDATE laundry_distribusi_rincian SET jumlah_diterima = $1, alasan_selisih = $2, updated_at = $3 WHERE uuid = $4`, [n, alasan, waktu, item.uuid], k);
        if (n > 0)
          await catatTransaksiStok(k, {
            faskesUuid: f,
            lokasiTipe: "ruangan",
            lokasiUuid: d.lokasi_uuid,
            jenisLinenUuid: item.jenis_linen_uuid,
            sumberTipe: "distribusi_terima",
            sumberUuid: d.uuid,
            arah: "masuk",
            jumlah: n,
            alasan: "Penerimaan linen bersih",
            petugasUuid: req.author.username,
            waktuTransaksi: waktu,
          });
        if (permintaan && n > 0)
          await query(
            `UPDATE laundry_permintaan_rincian SET jumlah_terpenuhi = jumlah_terpenuhi + $1, updated_at = $2
              WHERE permintaan_uuid = $3 AND faskes_uuid = $4 AND jenis_linen_uuid = $5 AND deleted_at IS NULL`,
            [n, waktu, permintaan.uuid, f, item.jenis_linen_uuid],
            k,
          );
      }
      if (permintaan && permintaan.status !== "dibatalkan") {
        const rp = await query(`SELECT jumlah_diminta, jumlah_terpenuhi FROM laundry_permintaan_rincian WHERE permintaan_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [permintaan.uuid, f], k);
        await query(`UPDATE laundry_permintaan SET status = $1, updated_at = $2 WHERE uuid = $3`, [statusPermintaan(rp), waktu, permintaan.uuid], k);
      }
      return satu(`UPDATE laundry_distribusi SET status = 'selesai', petugas_penerima = $1, waktu_terima = $2, updated_at = $2 WHERE uuid = $3 RETURNING *`, [req.author.username, waktu, d.uuid], k);
    });
    kirim(res, hasil, "Penerimaan linen bersih dikonfirmasi");
  }),
);

export default rute;
