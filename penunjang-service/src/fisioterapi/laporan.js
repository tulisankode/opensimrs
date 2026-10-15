import express from "express";
import { query, satu } from "../db.js";
import { tangani, kirim, halaman, denganHalaman } from "../umum/respons.js";
import { JENIS_FISIO, rentang, tglLokal } from "./bersama.js";

// Laporan Fisioterapi. Kunjungan = sesi terapi berstatus hadir/selesai pada rentang tanggal jadwal.
// Pendapatan = tindakan order yang sudah divalidasi (valid/terjadwal/selesai) menurut tanggal validasi.
// Order paket: nilai tindakan = nilai_paket (alokasi harga paket untuk seluruh sesi), per sesi = nilai_paket / jumlah_sesi.
const rute = express.Router();

const LAKI = `LOWER(COALESCE(p.gender, '')) IN ('male', 'laki-laki', 'l', 'm', 'pria')`;
const PEREMPUAN = `LOWER(COALESCE(p.gender, '')) IN ('female', 'perempuan', 'p', 'f', 'wanita')`;

// Sesi kunjungan pada rentang + penanda pasien baru (sesi fisio pertama pasien di faskes).
const KUNJUNGAN = `
  WITH sesi AS (
    SELECT j.uuid, j.tanggal, j.jam_slot, j.sesi_ke, j.status, j.bed_uuid, o.uuid AS order_uuid, o.no_order, o.patient_uuid,
           o.no_rm, o.no_reg, o.sumber, o.pelayanan, o.jenis_fisio, o.diagnosis, o.jumlah_sesi, o.payment_method,
           NOT EXISTS (
             SELECT 1 FROM fisio_jadwal j2 JOIN fisio_order o2 ON o2.uuid = j2.order_uuid
              WHERE o2.patient_uuid = o.patient_uuid AND o2.faskes_uuid = o.faskes_uuid AND j2.status IN ('hadir', 'selesai')
                AND j2.deleted_at IS NULL AND (j2.tanggal, j2.jam_slot, j2.created_at) < (j.tanggal, j.jam_slot, j.created_at)
           ) AS pasien_baru
      FROM fisio_jadwal j JOIN fisio_order o ON o.uuid = j.order_uuid
     WHERE j.faskes_uuid = $1 AND j.deleted_at IS NULL AND o.deleted_at IS NULL AND j.status IN ('hadir', 'selesai')
       AND j.tanggal BETWEEN $2::date AND $3::date
  )`;

// GET /laporan/kunjungan?tanggal_mulai=&tanggal_selesai=&jenis_fisio=&cari=&page=&limit=
rute.get(
  "/kunjungan",
  tangani(async (req, res) => {
    const { mulai, selesai } = rentang(req.query);
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid, mulai, selesai];
    let w = "TRUE";
    if (req.query.jenis_fisio) (p.push(req.query.jenis_fisio), (w += ` AND s.jenis_fisio = $${p.length}`));
    if (req.query.cari) (p.push(`%${req.query.cari}%`), (w += ` AND (p.name ILIKE $${p.length} OR s.no_rm ILIKE $${p.length} OR s.no_order ILIKE $${p.length})`));
    const dari = `sesi s LEFT JOIN patients p ON p.uuid = s.patient_uuid LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
                  LEFT JOIN fisio_bed b ON b.uuid = s.bed_uuid
                  LEFT JOIN fisio_evaluasi e ON e.jadwal_uuid = s.uuid AND e.deleted_at IS NULL`;
    const [ringkas, rows, harian] = await Promise.all([
      satu(
        `${KUNJUNGAN} SELECT COUNT(*)::int AS total_kunjungan, COUNT(DISTINCT s.patient_uuid)::int AS total_pasien,
                COUNT(*) FILTER (WHERE s.pasien_baru)::int AS kunjungan_baru, COUNT(*) FILTER (WHERE NOT s.pasien_baru)::int AS kunjungan_lama,
                COUNT(*) FILTER (WHERE ${LAKI})::int AS laki_laki, COUNT(*) FILTER (WHERE ${PEREMPUAN})::int AS perempuan
           FROM ${dari} WHERE ${w}`,
        p,
      ),
      query(
        `${KUNJUNGAN} SELECT s.uuid, to_char(s.tanggal, 'YYYY-MM-DD') AS tanggal, s.jam_slot, s.sesi_ke, s.jumlah_sesi, s.status,
                s.order_uuid, s.no_order, s.no_rm, s.no_reg, s.sumber, s.pelayanan, s.jenis_fisio, s.diagnosis, s.payment_method,
                s.pasien_baru, p.name AS nama_pasien, p.gender, to_char(bd.birth_date, 'YYYY-MM-DD') AS tanggal_lahir, b.nama AS bed,
                e.fase_rehabilitasi, e.terapis,
                (SELECT string_agg(t.nama, ', ' ORDER BY t.nama) FROM fisio_order_tindakan t WHERE t.order_uuid = s.order_uuid AND t.deleted_at IS NULL) AS tindakan
           FROM ${dari} WHERE ${w} ORDER BY s.tanggal, s.jam_slot, p.name LIMIT ${pg.limit} OFFSET ${pg.offset}`,
        p,
      ),
      query(
        `${KUNJUNGAN} SELECT to_char(s.tanggal, 'YYYY-MM-DD') AS tanggal, COUNT(*)::int AS kunjungan,
                COUNT(DISTINCT s.patient_uuid)::int AS pasien, COUNT(*) FILTER (WHERE s.pasien_baru)::int AS baru,
                COUNT(*) FILTER (WHERE NOT s.pasien_baru)::int AS lama
           FROM ${dari} WHERE ${w} GROUP BY s.tanggal ORDER BY s.tanggal`,
        p,
      ),
    ]);
    kirim(res, { periode: { mulai, selesai }, ringkasan: ringkas, rekap_harian: harian, ...denganHalaman(rows, ringkas.total_kunjungan, pg) });
  }),
);

// GET /laporan/rekap-jenis — rekap kunjungan per jenis fisioterapi (sport, saraf, orto, anak, geriatri).
rute.get(
  "/rekap-jenis",
  tangani(async (req, res) => {
    const { mulai, selesai } = rentang(req.query);
    const rows = await query(
      `${KUNJUNGAN} SELECT s.jenis_fisio, COUNT(*)::int AS kunjungan, COUNT(DISTINCT s.patient_uuid)::int AS pasien,
              COUNT(*) FILTER (WHERE s.pasien_baru)::int AS baru, COUNT(*) FILTER (WHERE NOT s.pasien_baru)::int AS lama,
              COUNT(*) FILTER (WHERE ${LAKI})::int AS laki_laki, COUNT(*) FILTER (WHERE ${PEREMPUAN})::int AS perempuan,
              COUNT(*) FILTER (WHERE s.pelayanan = 'aps')::int AS aps, COUNT(*) FILTER (WHERE s.pelayanan <> 'aps')::int AS rujukan
         FROM sesi s LEFT JOIN patients p ON p.uuid = s.patient_uuid GROUP BY s.jenis_fisio`,
      [req.author.faskesUuid, mulai, selesai],
    );
    const kosong = { kunjungan: 0, pasien: 0, baru: 0, lama: 0, laki_laki: 0, perempuan: 0, aps: 0, rujukan: 0 };
    const data = JENIS_FISIO.map((j) => ({ jenis_fisio: j, ...kosong, ...(rows.find((r) => r.jenis_fisio === j) ?? {}) }));
    const total = Object.fromEntries(Object.keys(kosong).map((k) => [k, data.reduce((n, r) => n + r[k], 0)]));
    kirim(res, { periode: { mulai, selesai }, data, total });
  }),
);

// GET /laporan/rekap-tindakan — jumlah tindakan terapi yang dilakukan (per sesi hadir/selesai × qty).
rute.get(
  "/rekap-tindakan",
  tangani(async (req, res) => {
    const { mulai, selesai } = rentang(req.query);
    const p = [req.author.faskesUuid, mulai, selesai];
    let w = "TRUE";
    if (req.query.jenis_fisio) (p.push(req.query.jenis_fisio), (w += ` AND s.jenis_fisio = $${p.length}`));
    const rows = await query(
      `${KUNJUNGAN} SELECT t.tindakan_uuid, t.nama, m.kode, SUM(t.qty)::int AS jumlah, COUNT(DISTINCT s.uuid)::int AS sesi,
              COUNT(DISTINCT s.patient_uuid)::int AS pasien,
              SUM(COALESCE(t.nilai_paket / NULLIF(s.jumlah_sesi, 0), t.qty * t.harga))::float8 AS nilai
         FROM sesi s JOIN fisio_order_tindakan t ON t.order_uuid = s.order_uuid AND t.deleted_at IS NULL
         LEFT JOIN fisio_tindakan m ON m.uuid = t.tindakan_uuid
        WHERE ${w} GROUP BY t.tindakan_uuid, t.nama, m.kode ORDER BY jumlah DESC, t.nama`,
      p,
    );
    const total = { jumlah: rows.reduce((n, r) => n + r.jumlah, 0), nilai: rows.reduce((n, r) => n + r.nilai, 0) };
    kirim(res, { periode: { mulai, selesai }, data: rows, total });
  }),
);

// GET /laporan/rekap-pendapatan — pendapatan tindakan dari order yang sudah divalidasi (harga × qty × jumlah sesi).
rute.get(
  "/rekap-pendapatan",
  tangani(async (req, res) => {
    const { mulai, selesai } = rentang(req.query);
    const dasar = `
      WITH item AS (
        SELECT o.uuid AS order_uuid, o.no_order, o.jenis_fisio, o.pelayanan, o.payment_method, o.patient_uuid,
               ${tglLokal("o.divalidasi_pada")} AS tanggal, t.tindakan_uuid, t.nama, (t.qty * o.jumlah_sesi)::int AS qty,
               COALESCE(t.nilai_paket, t.harga * t.qty * o.jumlah_sesi)::float8 AS nilai, o.paket_uuid
          FROM fisio_order o JOIN fisio_order_tindakan t ON t.order_uuid = o.uuid AND t.deleted_at IS NULL
         WHERE o.faskes_uuid = $1 AND o.deleted_at IS NULL AND o.status IN ('valid', 'terjadwal', 'selesai')
           AND o.divalidasi_pada IS NOT NULL AND ${tglLokal("o.divalidasi_pada")} BETWEEN $2::date AND $3::date
      )`;
    const p = [req.author.faskesUuid, mulai, selesai];
    const [perTindakan, perJenis, perHari, perBayar, ringkas, perPaket] = await Promise.all([
      query(`${dasar} SELECT tindakan_uuid, nama, SUM(qty)::int AS qty, SUM(nilai)::float8 AS nilai FROM item GROUP BY tindakan_uuid, nama ORDER BY nilai DESC`, p),
      query(`${dasar} SELECT jenis_fisio, COUNT(DISTINCT order_uuid)::int AS order, SUM(nilai)::float8 AS nilai FROM item GROUP BY jenis_fisio`, p),
      query(`${dasar} SELECT to_char(tanggal, 'YYYY-MM-DD') AS tanggal, COUNT(DISTINCT order_uuid)::int AS order, SUM(nilai)::float8 AS nilai FROM item GROUP BY tanggal ORDER BY tanggal`, p),
      query(`${dasar} SELECT CASE WHEN payment_method = 1 THEN 'umum' ELSE 'penjamin' END AS cara_bayar, COUNT(DISTINCT order_uuid)::int AS order, SUM(nilai)::float8 AS nilai FROM item GROUP BY 1`, p),
      satu(`${dasar} SELECT COUNT(DISTINCT order_uuid)::int AS total_order, COUNT(DISTINCT patient_uuid)::int AS total_pasien, COALESCE(SUM(nilai), 0)::float8 AS total_pendapatan FROM item`, p),
      query(
        `${dasar} SELECT i.paket_uuid, fp.kode, fp.nama, COUNT(DISTINCT i.order_uuid)::int AS order, SUM(i.nilai)::float8 AS nilai
           FROM item i JOIN fisio_paket fp ON fp.uuid = i.paket_uuid GROUP BY i.paket_uuid, fp.kode, fp.nama ORDER BY nilai DESC`,
        p,
      ),
    ]);
    kirim(res, {
      periode: { mulai, selesai },
      ringkasan: ringkas,
      per_tindakan: perTindakan,
      per_jenis: JENIS_FISIO.map((j) => perJenis.find((r) => r.jenis_fisio === j) ?? { jenis_fisio: j, order: 0, nilai: 0 }),
      per_hari: perHari,
      per_cara_bayar: perBayar,
      per_paket: perPaket,
    });
  }),
);

export default rute;
