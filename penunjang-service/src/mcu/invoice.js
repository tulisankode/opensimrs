import express from "express";
import { query, satu, sisipkan, sekarang, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { nomorBaru } from "../umum/nomor.js";
import { izinMcu } from "../umum/izin.js";
import { konflik, tanggalValid, hariIni } from "./bersama.js";

// Invoice MCU korporasi: kumpulkan peserta korporasi (status proses/selesai) suatu perusahaan dalam periode yang
// belum ber-invoice → draft → terbit → pembayaran dicatat (sebagian / lunas) dengan riwayat & sisa tagihan.
// Batal melepaskan peserta agar bisa ditagihkan ulang (hanya bila belum ada pembayaran).
//
// Catatan desain: pembayaran korporasi dicatat di modul MCU (bukan payment-service) karena tagihan payment-service
// berbasis pasien (bills.patient_uuid wajib, satu tagihan aktif per pasien, PPN & biaya admin per tagihan, tutup kasir
// per shift) sementara invoice korporasi menagih banyak pasien ke satu perusahaan lewat transfer/giro dengan termin.
const rute = express.Router();

const METODE = ["transfer", "tunai", "giro", "cek", "lainnya"];
const SQL_BAYAR = (alias) =>
  `(SELECT COALESCE(SUM(b.jumlah), 0) FROM mcu_invoice_bayar b WHERE b.invoice_uuid = ${alias}.uuid AND b.deleted_at IS NULL)`;

const PILIH = `i.uuid, i.no_invoice, i.perusahaan_uuid, i.periode_mulai::text AS periode_mulai, i.periode_selesai::text AS periode_selesai,
  i.tanggal::text AS tanggal, i.jatuh_tempo::text AS jatuh_tempo, i.total::float8 AS total, i.jumlah_peserta, i.status, i.catatan,
  i.alasan_batal, i.terbit_pada, i.lunas_pada, i.dibuat_oleh, i.created_at, i.updated_at,
  ${SQL_BAYAR("i")}::float8 AS total_bayar, (i.total - ${SQL_BAYAR("i")})::float8 AS sisa,
  p.nama AS nama_perusahaan, p.kode AS kode_perusahaan, p.alamat AS alamat_perusahaan, p.pic, p.telepon, p.email`;
const DARI = `mcu_invoice i JOIN mcu_perusahaan p ON p.uuid = i.perusahaan_uuid`;

// Tagihan per peserta = harga paket (kontrak bila ada) + pemeriksaan tambahan di luar paket.
const kandidat = (faskesUuid, perusahaanUuid, mulai, selesai, k) =>
  query(
    `SELECT s.uuid, s.no_mcu, s.tanggal::text AS tanggal, s.no_rm, s.status, s.kesimpulan, s.harga::float8 AS harga_paket,
            s.harga_tambahan::float8 AS harga_tambahan, (s.harga + s.harga_tambahan)::float8 AS harga,
            s.nik_karyawan, s.jabatan, s.bagian, pt.name AS nama_pasien, pk.nama AS nama_paket
       FROM mcu_peserta s JOIN patients pt ON pt.uuid = s.patient_uuid JOIN mcu_paket pk ON pk.uuid = s.paket_uuid
      WHERE s.faskes_uuid = $1 AND s.perusahaan_uuid = $2 AND s.cara_bayar = 'korporasi' AND s.invoice_uuid IS NULL
        AND s.status IN ('proses', 'selesai') AND s.tanggal BETWEEN $3 AND $4 AND s.deleted_at IS NULL
      ORDER BY s.tanggal, s.no_mcu`,
    [faskesUuid, perusahaanUuid, mulai, selesai],
    k,
  );

export const detailInvoice = async (uuid, faskesUuid, k) => {
  const i = await satu(`SELECT ${PILIH} FROM ${DARI} WHERE i.uuid = $1 AND i.faskes_uuid = $2 AND i.deleted_at IS NULL`, [uuid, faskesUuid], k);
  if (!i) return null;
  const [peserta, pembayaran] = await Promise.all([
    query(
      `SELECT s.uuid, s.no_mcu, s.tanggal::text AS tanggal, s.no_rm, s.status, s.kesimpulan, s.harga::float8 AS harga_paket,
              s.harga_tambahan::float8 AS harga_tambahan, (s.harga + s.harga_tambahan)::float8 AS harga, s.tambahan,
              s.nik_karyawan, s.jabatan, s.bagian, pt.name AS nama_pasien, pk.nama AS nama_paket, pk.kode AS kode_paket
         FROM mcu_peserta s JOIN patients pt ON pt.uuid = s.patient_uuid JOIN mcu_paket pk ON pk.uuid = s.paket_uuid
        WHERE s.invoice_uuid = $1 AND s.deleted_at IS NULL ORDER BY s.tanggal, s.no_mcu`,
      [uuid],
      k,
    ),
    query(
      `SELECT uuid, no_bayar, tanggal::text AS tanggal, jumlah::float8 AS jumlah, metode, no_referensi, catatan, dibuat_oleh, created_at,
              deleted_at, alasan_batal, dibatalkan_oleh
         FROM mcu_invoice_bayar WHERE invoice_uuid = $1 ORDER BY tanggal, created_at`,
      [uuid],
      k,
    ),
  ]);
  // Rincian: per paket & harga (harga kontrak bisa berbeda dari harga paket), plus pemeriksaan tambahan.
  const rincian = Object.values(
    peserta.reduce((acc, s) => {
      const kunci = `${s.kode_paket}|${s.harga_paket}`;
      const r = (acc[kunci] ??= { kode_paket: s.kode_paket, nama_paket: s.nama_paket, harga: s.harga_paket, jumlah: 0, subtotal: 0 });
      r.jumlah += 1;
      r.subtotal += s.harga_paket;
      return acc;
    }, {}),
  );
  const tambahan = {};
  for (const s of peserta)
    for (const t of Array.isArray(s.tambahan) ? s.tambahan : []) {
      const r = (tambahan[`${t.nama}|${t.harga}`] ??= {
        kode_paket: t.kode ?? "-",
        nama_paket: `Tambahan: ${t.nama}`,
        harga: Number(t.harga) || 0,
        jumlah: 0,
        subtotal: 0,
        tambahan: true,
      });
      r.jumlah += 1;
      r.subtotal += Number(t.harga) || 0;
    }
  return { ...i, peserta, rincian: [...rincian, ...Object.values(tambahan)], pembayaran };
};

rute.get(
  "/",
  izinMcu("Tagihan Korporasi", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const q = req.query;
    const p = [req.author.faskesUuid];
    let w = "i.faskes_uuid = $1 AND i.deleted_at IS NULL";
    if (q.perusahaan_uuid) {
      p.push(q.perusahaan_uuid);
      w += ` AND i.perusahaan_uuid = $${p.length}`;
    }
    if (q.status) {
      p.push(String(q.status).split(","));
      w += ` AND i.status = ANY($${p.length})`;
    }
    if (q.tanggal_mulai && q.tanggal_selesai) {
      p.push(tanggalValid(q.tanggal_mulai, "tanggal_mulai"), tanggalValid(q.tanggal_selesai, "tanggal_selesai"));
      w += ` AND COALESCE(i.tanggal, (to_timestamp(i.created_at) AT TIME ZONE 'Asia/Jakarta')::date) BETWEEN $${p.length - 1} AND $${p.length}`;
    }
    if (q.cari) {
      p.push(`%${q.cari}%`);
      w += ` AND (i.no_invoice ILIKE $${p.length} OR p.nama ILIKE $${p.length})`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI} WHERE ${w}`, p)).n;
    const rows = await query(`SELECT ${PILIH} FROM ${DARI} WHERE ${w} ORDER BY i.created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Pratinjau peserta yang akan ditagihkan: ?perusahaan_uuid=&periode_mulai=&periode_selesai=
rute.get(
  "/kandidat",
  izinMcu("Tagihan Korporasi", "READ"),
  tangani(async (req, res) => {
    wajib(req.query, ["perusahaan_uuid", "periode_mulai", "periode_selesai"]);
    const rows = await kandidat(
      req.author.faskesUuid,
      req.query.perusahaan_uuid,
      tanggalValid(req.query.periode_mulai, "periode_mulai"),
      tanggalValid(req.query.periode_selesai, "periode_selesai"),
    );
    kirim(res, { peserta: rows, total: rows.reduce((n, r) => n + r.harga, 0) });
  }),
);

rute.get(
  "/:uuid",
  izinMcu("Tagihan Korporasi", "READ"),
  tangani(async (req, res) => {
    const d = await detailInvoice(req.params.uuid, req.author.faskesUuid);
    if (!d) throw tidakDitemukan("Invoice MCU");
    kirim(res, d);
  }),
);

// Body: { perusahaan_uuid, periode_mulai, periode_selesai, peserta_uuids?: [...] (bawaan: semua kandidat), jatuh_tempo?, catatan? }
rute.post(
  "/",
  izinMcu("Tagihan Korporasi", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    wajib(b, ["perusahaan_uuid", "periode_mulai", "periode_selesai"]);
    const mulai = tanggalValid(b.periode_mulai, "periode_mulai");
    const selesai = tanggalValid(b.periode_selesai, "periode_selesai");
    if (mulai > selesai) throw permintaanSalah("periode_mulai harus sebelum periode_selesai");
    const hasil = await transaksi(async (k) => {
      const prs = await satu(`SELECT uuid, nama FROM mcu_perusahaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [b.perusahaan_uuid, f], k);
      if (!prs) throw tidakDitemukan("Perusahaan");
      let rows = await kandidat(f, prs.uuid, mulai, selesai, k);
      if (Array.isArray(b.peserta_uuids) && b.peserta_uuids.length) rows = rows.filter((r) => b.peserta_uuids.includes(r.uuid));
      if (!rows.length) throw permintaanSalah(`Tidak ada peserta ${prs.nama} periode ${mulai} s.d. ${selesai} yang dapat ditagihkan`);
      const total = rows.reduce((n, r) => n + r.harga, 0);
      const inv = await sisipkan(
        "mcu_invoice",
        {
          faskes_uuid: f,
          no_invoice: await nomorBaru(f, "INV-MCU", k),
          perusahaan_uuid: prs.uuid,
          periode_mulai: mulai,
          periode_selesai: selesai,
          tanggal: hariIni(),
          jatuh_tempo: b.jatuh_tempo ? tanggalValid(b.jatuh_tempo, "jatuh_tempo") : null,
          total,
          jumlah_peserta: rows.length,
          status: "draft",
          catatan: b.catatan ? String(b.catatan).trim() : null,
          dibuat_oleh: req.author.username,
        },
        k,
      );
      // Kunci peserta (hanya yang masih belum ber-invoice untuk mencegah tabrakan).
      const terkunci = await query(
        `UPDATE mcu_peserta SET invoice_uuid = $1, updated_at = $2 WHERE uuid = ANY($3) AND invoice_uuid IS NULL RETURNING uuid`,
        [inv.uuid, sekarang(), rows.map((r) => r.uuid)],
        k,
      );
      if (terkunci.length !== rows.length) throw konflik("Sebagian peserta baru saja ditagihkan di invoice lain, ulangi");
      return detailInvoice(inv.uuid, f, k);
    });
    kirim(res, hasil, `Invoice ${hasil.no_invoice} berhasil dibuat`);
  }),
);

const kunciInvoice = async (uuid, f, k) => {
  const i = await satu(
    `SELECT *, total::float8 AS total_n, ${SQL_BAYAR("mcu_invoice")}::float8 AS total_bayar FROM mcu_invoice
      WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`,
    [uuid, f],
    k,
  );
  if (!i) throw tidakDitemukan("Invoice MCU");
  return i;
};

// Terbitkan draft.
rute.post(
  "/:uuid/terbit",
  izinMcu("Tagihan Korporasi", "UPDATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const i = await kunciInvoice(req.params.uuid, f, k);
      if (i.status !== "draft") throw konflik(`Invoice berstatus ${i.status} tidak dapat diterbitkan`);
      const t = sekarang();
      await query(
        `UPDATE mcu_invoice SET status = 'terbit', terbit_pada = $1, jatuh_tempo = COALESCE($2::date, jatuh_tempo), updated_at = $1 WHERE uuid = $3`,
        [t, req.body?.jatuh_tempo ? tanggalValid(req.body.jatuh_tempo, "jatuh_tempo") : null, i.uuid],
        k,
      );
      return detailInvoice(i.uuid, f, k);
    });
    kirim(res, hasil, `Invoice diterbitkan (${hasil.no_invoice})`);
  }),
);

// Batalkan invoice (draft/terbit tanpa pembayaran): peserta dilepas agar dapat ditagihkan ulang.
rute.post(
  "/:uuid/batal",
  izinMcu("Tagihan Korporasi", "UPDATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    wajib(req.body, ["alasan"]);
    const hasil = await transaksi(async (k) => {
      const i = await kunciInvoice(req.params.uuid, f, k);
      if (!["draft", "terbit"].includes(i.status)) throw konflik(`Invoice berstatus ${i.status} tidak dapat dibatalkan`);
      if (i.total_bayar > 0) throw konflik("Invoice sudah memiliki pembayaran; batalkan pembayaran terlebih dahulu");
      const t = sekarang();
      await query(`UPDATE mcu_invoice SET status = 'batal', alasan_batal = $1, updated_at = $2 WHERE uuid = $3`, [String(req.body.alasan).trim(), t, i.uuid], k);
      await query(`UPDATE mcu_peserta SET invoice_uuid = NULL, updated_at = $1 WHERE invoice_uuid = $2`, [t, i.uuid], k);
      return detailInvoice(i.uuid, f, k);
    });
    kirim(res, hasil, `Invoice dibatalkan (${hasil.no_invoice})`);
  }),
);

const statusSetelahBayar = async (i, k) => {
  const r = await satu(`SELECT ${SQL_BAYAR("mcu_invoice")}::float8 AS bayar, total::float8 AS total FROM mcu_invoice WHERE uuid = $1`, [i.uuid], k);
  const status = r.bayar >= r.total - 0.5 ? "lunas" : r.bayar > 0 ? "sebagian" : "terbit";
  await query(
    `UPDATE mcu_invoice SET status = $1::varchar, lunas_pada = CASE WHEN $1::varchar = 'lunas' THEN COALESCE(lunas_pada, $2) ELSE NULL END, updated_at = $2
      WHERE uuid = $3`,
    [status, sekarang(), i.uuid],
    k,
  );
  return status;
};

// Catat pembayaran. Body: { tanggal, jumlah, metode: transfer|tunai|giro|cek|lainnya, no_referensi?, catatan? }
rute.post(
  "/:uuid/pembayaran",
  izinMcu("Tagihan Korporasi", "PEMBAYARAN"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    wajib(b, ["tanggal", "jumlah", "metode"]);
    const tanggal = tanggalValid(String(b.tanggal).substring(0, 10), "tanggal");
    if (tanggal > hariIni()) throw permintaanSalah("Tanggal pembayaran tidak boleh di masa depan");
    const jumlah = Math.round(Number(b.jumlah) * 100) / 100;
    if (!Number.isFinite(jumlah) || jumlah <= 0) throw permintaanSalah("Jumlah pembayaran harus lebih dari 0");
    if (!METODE.includes(b.metode)) throw permintaanSalah(`metode harus salah satu: ${METODE.join(", ")}`);
    if (["transfer", "giro", "cek"].includes(b.metode) && !String(b.no_referensi ?? "").trim())
      throw permintaanSalah("No. referensi wajib diisi untuk pembayaran transfer/giro/cek");
    const hasil = await transaksi(async (k) => {
      const i = await kunciInvoice(req.params.uuid, f, k);
      if (!["terbit", "sebagian"].includes(i.status)) throw konflik(`Pembayaran hanya untuk invoice terbit / dibayar sebagian (status: ${i.status})`);
      const sisa = Math.round((i.total_n - i.total_bayar) * 100) / 100;
      if (jumlah > sisa + 0.5) throw permintaanSalah(`Jumlah melebihi sisa tagihan (sisa Rp ${sisa.toLocaleString("id-ID")})`);
      await sisipkan(
        "mcu_invoice_bayar",
        {
          faskes_uuid: f,
          invoice_uuid: i.uuid,
          no_bayar: await nomorBaru(f, "BYR-MCU", k),
          tanggal,
          jumlah,
          metode: b.metode,
          no_referensi: String(b.no_referensi ?? "").trim() || null,
          catatan: String(b.catatan ?? "").trim() || null,
          dibuat_oleh: req.author.username,
        },
        k,
      );
      await statusSetelahBayar(i, k);
      return detailInvoice(i.uuid, f, k);
    });
    kirim(
      res,
      hasil,
      hasil.status === "lunas"
        ? `Pembayaran dicatat — invoice ${hasil.no_invoice} LUNAS`
        : `Pembayaran dicatat — sisa tagihan Rp ${Number(hasil.sisa).toLocaleString("id-ID")}`,
    );
  }),
);

// Batalkan (koreksi) satu pembayaran. Body: { alasan }
rute.post(
  "/:uuid/pembayaran/:bayarUuid/batal",
  izinMcu("Tagihan Korporasi", "PEMBAYARAN"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    wajib(req.body, ["alasan"]);
    const hasil = await transaksi(async (k) => {
      const i = await kunciInvoice(req.params.uuid, f, k);
      const r = await satu(
        `UPDATE mcu_invoice_bayar SET deleted_at = $1, updated_at = $1, alasan_batal = $2, dibatalkan_oleh = $3
          WHERE uuid = $4 AND invoice_uuid = $5 AND deleted_at IS NULL RETURNING uuid`,
        [sekarang(), String(req.body.alasan).trim(), req.author.username, req.params.bayarUuid, i.uuid],
        k,
      );
      if (!r) throw tidakDitemukan("Pembayaran");
      await statusSetelahBayar(i, k);
      return detailInvoice(i.uuid, f, k);
    });
    kirim(res, hasil, "Pembayaran dibatalkan");
  }),
);

export default rute;
