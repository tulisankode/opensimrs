import express from "express";
import { query, satu } from "../db.js";
import { tangani, kirim } from "../umum/respons.js";
import { KELOMPOK, PENANDA, SPESIMEN, daftarNilai, hariIni, tanggalValid, tglLokal } from "./bersama.js";

// Laporan Mikrobiologi (rentang tanggal zona Asia/Jakarta).
const rute = express.Router();

const rentang = (q) => {
  const mulai = tanggalValid(q.tanggal_mulai || hariIni(), "tanggal_mulai");
  const selesai = tanggalValid(q.tanggal_selesai || mulai, "tanggal_selesai");
  return { mulai, selesai };
};

// Kunjungan: tanggal order; order batal tidak dihitung (kecuali jumlah_batal). Pendapatan = tarif item order tervalidasi.
// TAT (hari) = spesimen diterima → hasil final. Positivitas kultur = kultur tumbuh / kultur dengan hasil akhir.
rute.get(
  "/kunjungan",
  tangani(async (req, res) => {
    const { mulai, selesai } = rentang(req.query);
    const p = [req.author.faskesUuid, mulai, selesai];
    const w = `o.faskes_uuid = $1 AND o.deleted_at IS NULL AND o.status <> 'batal' AND ${tglLokal("o.created_at")} BETWEEN $2 AND $3`;
    const dari = `FROM mikro_order o JOIN mikro_order_item i ON i.order_uuid = o.uuid AND i.deleted_at IS NULL
                  LEFT JOIN mikro_spesimen s ON s.uuid = i.spesimen_uuid
                  LEFT JOIN mikro_hasil h ON h.item_uuid = i.uuid AND h.deleted_at IS NULL`;
    const PENDAPATAN = `COALESCE(SUM(i.harga) FILTER (WHERE o.status <> 'order'), 0)::float8`;
    const TAT = `ROUND(AVG((h.diverifikasi_pada - s.waktu_terima) / 86400.0) FILTER (WHERE h.status = 'final' AND s.waktu_terima IS NOT NULL), 1)::float8`;
    const KULTUR = `COUNT(i.uuid) FILTER (WHERE h.kultur_status IN ('tumbuh', 'tidak_tumbuh', 'kontaminan', 'flora_normal'))::int AS kultur_selesai,
                    COUNT(i.uuid) FILTER (WHERE h.kultur_status = 'tumbuh')::int AS kultur_positif,
                    COUNT(i.uuid) FILTER (WHERE h.kultur_status = 'kontaminan')::int AS kultur_kontaminan`;
    const [ringkasan, batal, perPemeriksaan, perSpesimen, perPelayanan, perHari, organisme, penanda, terlambat] = await Promise.all([
      satu(
        `SELECT COUNT(DISTINCT o.uuid)::int AS jumlah_order, COUNT(DISTINCT o.patient_uuid)::int AS jumlah_pasien,
                COUNT(i.uuid)::int AS jumlah_pemeriksaan,
                COUNT(i.uuid) FILTER (WHERE i.status = 'selesai')::int AS jumlah_final,
                COUNT(i.uuid) FILTER (WHERE i.status = 'sementara')::int AS jumlah_sementara,
                COUNT(i.uuid) FILTER (WHERE i.status IN ('menunggu', 'diterima', 'diproses'))::int AS jumlah_proses,
                COUNT(i.uuid) FILTER (WHERE i.status = 'ditolak')::int AS jumlah_ditolak,
                COUNT(DISTINCT o.uuid) FILTER (WHERE o.cito)::int AS jumlah_cito,
                COUNT(DISTINCT o.uuid) FILTER (WHERE o.status = 'order')::int AS belum_validasi,
                ${KULTUR}, ${PENDAPATAN} AS pendapatan, ${TAT} AS rerata_tat_hari
           ${dari} WHERE ${w}`,
        p,
      ),
      satu(`SELECT COUNT(*)::int n FROM mikro_order o WHERE o.faskes_uuid = $1 AND o.deleted_at IS NULL AND o.status = 'batal'
              AND ${tglLokal("o.created_at")} BETWEEN $2 AND $3`, p),
      query(
        `SELECT i.pemeriksaan_uuid, MAX(m.kode) AS kode, i.nama, MAX(m.tat_hari)::int AS tat_target, COUNT(i.uuid)::int AS jumlah,
                COUNT(i.uuid) FILTER (WHERE i.status = 'selesai')::int AS final, COUNT(i.uuid) FILTER (WHERE i.status = 'ditolak')::int AS ditolak,
                ${KULTUR}, ${PENDAPATAN} AS pendapatan, ${TAT} AS rerata_tat_hari
           ${dari} LEFT JOIN mikro_pemeriksaan m ON m.uuid = i.pemeriksaan_uuid
          WHERE ${w} GROUP BY i.pemeriksaan_uuid, i.nama ORDER BY jumlah DESC, i.nama`,
        p,
      ),
      query(
        `SELECT i.jenis_spesimen, COUNT(i.uuid)::int AS jumlah, COUNT(i.uuid) FILTER (WHERE i.status = 'ditolak')::int AS ditolak, ${KULTUR}
           ${dari} WHERE ${w} GROUP BY i.jenis_spesimen ORDER BY jumlah DESC`,
        p,
      ),
      query(
        `SELECT o.pelayanan, COUNT(DISTINCT o.uuid)::int AS jumlah_order, COUNT(i.uuid)::int AS jumlah_pemeriksaan, ${PENDAPATAN} AS pendapatan
           ${dari} WHERE ${w} GROUP BY o.pelayanan ORDER BY jumlah_order DESC`,
        p,
      ),
      query(
        `SELECT to_char(${tglLokal("o.created_at")}, 'YYYY-MM-DD') AS tanggal, COUNT(DISTINCT o.uuid)::int AS jumlah_order,
                COUNT(i.uuid)::int AS jumlah_pemeriksaan, ${PENDAPATAN} AS pendapatan
           ${dari} WHERE ${w} GROUP BY 1 ORDER BY 1`,
        p,
      ),
      // Organisme terbanyak (isolat dari hasil final).
      query(
        `SELECT x.organisme_uuid, x.nama_organisme AS nama, MAX(x.kelompok) AS kelompok, COUNT(x.uuid)::int AS jumlah
           ${dari} JOIN mikro_isolat x ON x.hasil_uuid = h.uuid AND x.deleted_at IS NULL
          WHERE ${w} AND h.status = 'final' GROUP BY x.organisme_uuid, x.nama_organisme ORDER BY jumlah DESC, nama LIMIT 20`,
        p,
      ),
      query(
        `SELECT pn AS penanda, COUNT(*)::int AS jumlah
           ${dari} JOIN mikro_isolat x ON x.hasil_uuid = h.uuid AND x.deleted_at IS NULL CROSS JOIN LATERAL unnest(x.penanda) pn
          WHERE ${w} AND h.status = 'final' GROUP BY pn ORDER BY jumlah DESC`,
        p,
      ),
      // Item final yang melewati target TAT pemeriksaan.
      satu(
        `SELECT COUNT(i.uuid)::int AS n ${dari}
          WHERE ${w} AND h.status = 'final' AND s.waktu_terima IS NOT NULL AND i.tat_hari IS NOT NULL
            AND (h.diverifikasi_pada - s.waktu_terima) > i.tat_hari * 86400`,
        p,
      ),
    ]);
    kirim(res, {
      tanggal_mulai: mulai,
      tanggal_selesai: selesai,
      ringkasan: { ...ringkasan, jumlah_batal: batal.n, melewati_tat: terlambat.n },
      per_pemeriksaan: perPemeriksaan,
      per_spesimen: perSpesimen.map((r) => ({ ...r, nama_spesimen: SPESIMEN[r.jenis_spesimen] ?? r.jenis_spesimen })),
      per_pelayanan: perPelayanan,
      per_hari: perHari,
      organisme_terbanyak: organisme.map((r) => ({ ...r, nama_kelompok: KELOMPOK[r.kelompok] ?? r.kelompok })),
      penanda_resistensi: penanda.map((r) => ({ ...r, nama: PENANDA[r.penanda] ?? r.penanda })),
    });
  }),
);

// Antibiogram kumulatif (mengikuti prinsip CLSI M39): hanya hasil final & isolat yang diuji kepekaannya, tanggal = waktu
// ambil spesimen (atau terima), default isolat pertama per pasien per spesies dalam periode (?isolat_pertama=0 untuk semua).
// %S = jumlah S / jumlah isolat yang diuji untuk antibiotik tsb. Organisme dengan < 30 isolat ditandai (cukup = false).
// Filter: ?spesimen=urin,darah &pelayanan=ranap &kelompok=ENTEROBACTERALES &gram=negatif &organisme_uuid=
rute.get(
  "/antibiogram",
  tangani(async (req, res) => {
    const { mulai, selesai } = rentang(req.query);
    const pertama = !["0", "false"].includes(String(req.query.isolat_pertama ?? "1"));
    const p = [req.author.faskesUuid, mulai, selesai];
    // Hanya isolat yang benar-benar diuji kepekaannya (minimal satu interpretasi S/I/R).
    let w = `x.faskes_uuid = $1 AND x.deleted_at IS NULL AND h.status = 'final' AND h.deleted_at IS NULL AND o.status <> 'batal' AND o.deleted_at IS NULL
             AND ${tglLokal("COALESCE(s.waktu_ambil, s.waktu_terima, o.created_at)")} BETWEEN $2 AND $3
             AND EXISTS (SELECT 1 FROM mikro_kepekaan kx WHERE kx.isolat_uuid = x.uuid AND kx.deleted_at IS NULL AND kx.interpretasi IS NOT NULL)`;
    for (const [param, kol] of [["spesimen", "i.jenis_spesimen"], ["pelayanan", "o.pelayanan"], ["kelompok", "x.kelompok"], ["gram", "org.gram"], ["organisme_uuid", "x.organisme_uuid"]]) {
      const v = daftarNilai(req.query[param]);
      if (!v.length) continue;
      p.push(v);
      w += ` AND ${kol} = ANY($${p.length})`;
    }
    const isolat = `
      SELECT ${pertama ? "DISTINCT ON (o.patient_uuid, x.organisme_uuid)" : ""} x.uuid, x.organisme_uuid, x.nama_organisme, x.kelompok, x.penanda,
             org.gram, o.patient_uuid
        FROM mikro_isolat x JOIN mikro_hasil h ON h.uuid = x.hasil_uuid
        JOIN mikro_order_item i ON i.uuid = h.item_uuid JOIN mikro_order o ON o.uuid = i.order_uuid
        LEFT JOIN mikro_spesimen s ON s.uuid = h.spesimen_uuid LEFT JOIN mikro_organisme org ON org.uuid = x.organisme_uuid
       WHERE ${w}
       ${pertama ? "ORDER BY o.patient_uuid, x.organisme_uuid, COALESCE(s.waktu_ambil, s.waktu_terima, o.created_at), x.urutan" : ""}`;
    const [perOrganisme, sel] = await Promise.all([
      query(
        `WITH iso AS (${isolat})
         SELECT organisme_uuid, MAX(nama_organisme) AS nama, MAX(kelompok) AS kelompok, MAX(gram) AS gram, COUNT(*)::int AS jumlah_isolat,
                COUNT(DISTINCT patient_uuid)::int AS jumlah_pasien
           FROM iso GROUP BY organisme_uuid ORDER BY jumlah_isolat DESC, nama`,
        p,
      ),
      query(
        `WITH iso AS (${isolat})
         SELECT iso.organisme_uuid, kp.antibiotik_uuid, MAX(kp.kode) AS kode, MAX(kp.nama) AS nama,
                COUNT(*)::int AS diuji,
                COUNT(*) FILTER (WHERE kp.interpretasi = 'S')::int AS s,
                COUNT(*) FILTER (WHERE kp.interpretasi = 'I')::int AS i,
                COUNT(*) FILTER (WHERE kp.interpretasi = 'R')::int AS r
           FROM iso JOIN mikro_kepekaan kp ON kp.isolat_uuid = iso.uuid AND kp.deleted_at IS NULL AND kp.interpretasi IS NOT NULL
          GROUP BY iso.organisme_uuid, kp.antibiotik_uuid`,
        p,
      ),
    ]);
    // Jumlah isolat per penanda resistensi per organisme.
    const penanda = await query(
      `WITH iso AS (${isolat})
       SELECT organisme_uuid, pn AS penanda, COUNT(*)::int AS jumlah FROM iso CROSS JOIN LATERAL unnest(iso.penanda) pn GROUP BY organisme_uuid, pn`,
      p,
    );
    const abUuids = [...new Set(sel.map((r) => r.antibiotik_uuid).filter(Boolean))];
    const antibiotik = abUuids.length
      ? await query(`SELECT uuid, kode, nama, golongan FROM mikro_antibiotik WHERE uuid = ANY($1) ORDER BY golongan NULLS LAST, nama`, [abUuids])
      : [];
    kirim(res, {
      tanggal_mulai: mulai,
      tanggal_selesai: selesai,
      isolat_pertama: pertama,
      minimal_isolat: 30,
      total_isolat: perOrganisme.reduce((n, r) => n + r.jumlah_isolat, 0),
      antibiotik,
      organisme: perOrganisme.map((o) => ({
        organisme_uuid: o.organisme_uuid,
        nama: o.nama,
        kelompok: o.kelompok,
        nama_kelompok: KELOMPOK[o.kelompok] ?? o.kelompok,
        gram: o.gram,
        jumlah_isolat: o.jumlah_isolat,
        jumlah_pasien: o.jumlah_pasien,
        cukup: o.jumlah_isolat >= 30,
        penanda: Object.fromEntries(penanda.filter((x) => x.organisme_uuid === o.organisme_uuid).map((x) => [x.penanda, x.jumlah])),
        kepekaan: Object.fromEntries(
          sel
            .filter((r) => r.organisme_uuid === o.organisme_uuid)
            .map((r) => [r.antibiotik_uuid, { diuji: r.diuji, s: r.s, i: r.i, r: r.r, persen_s: r.diuji ? Math.round((r.s / r.diuji) * 100) : null }]),
        ),
      })),
    });
  }),
);

export default rute;
