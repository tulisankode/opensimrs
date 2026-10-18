import express from "express";
import { query, satu } from "../db.js";
import { tangani, kirim, permintaanSalah } from "../umum/respons.js";
import { izinHd } from "../umum/izin.js";
import { KOMPLIKASI, hariIni, tambahHari, tanggalValid } from "./bersama.js";

// Laporan unit HD (KF-16/KT-20) per periode tanggal jadwal untuk faskes token: jumlah tindakan, utilisasi mesin,
// komplikasi, dan adekuasi. Definisi indikator dicantumkan di respons (PRD §13 no. 11 belum memutuskan definisi resmi);
// laporan tidak memberi penilaian klinis (tidak ada ambang "adekuat").
const rute = express.Router();

const DEFINISI = {
  jumlah_tindakan: "Sesi HD berstatus selesai dengan tanggal jadwal dalam periode",
  utilisasi_mesin: "Sesi selesai ÷ (jumlah hari periode × shift aktif) per mesin, dalam persen",
  komplikasi: "Jumlah catatan observasi (versi terbaru) yang memuat kategori komplikasi, dan jumlah sesi terdampak",
  adekuasi: "Rekap Kt/V & URR tersimpan (formula bawaan perlu disahkan tenaga klinis); tanpa ambang kecukupan",
};

const periode = (q) => {
  const sampai = q.sampai ? tanggalValid(q.sampai, "sampai") : hariIni();
  const dari = q.dari ? tanggalValid(q.dari, "dari") : tambahHari(sampai, -29);
  if (sampai < dari) throw permintaanSalah("sampai tidak boleh sebelum dari");
  if (sampai > tambahHari(dari, 365)) throw permintaanSalah("Periode laporan maksimal 366 hari");
  const jumlahHari = Math.round((Date.parse(`${sampai}T00:00:00Z`) - Date.parse(`${dari}T00:00:00Z`)) / 86400000) + 1;
  return { dari, sampai, jumlahHari };
};

rute.get(
  "/laporan",
  izinHd("Laporan Hemodialisa", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const { dari, sampai, jumlahHari } = periode(req.query);
    const p = [f, dari, sampai];
    const SESI = `hd_sesi se JOIN hd_jadwal j ON j.uuid = se.jadwal_uuid JOIN hd_registrasi r ON r.uuid = j.registrasi_uuid
      WHERE se.faskes_uuid = $1 AND se.deleted_at IS NULL AND j.tanggal BETWEEN $2::date AND $3::date`;

    const [ringkas, perJenis, perHari, jadwal, shift, mesin, komplikasi, adekuasi] = await Promise.all([
      satu(
        `SELECT COUNT(*) FILTER (WHERE se.status = 'selesai')::int AS selesai, COUNT(*) FILTER (WHERE se.status = 'batal')::int AS batal,
                COUNT(DISTINCT r.patient_uuid) FILTER (WHERE se.status = 'selesai')::int AS pasien,
                COUNT(*) FILTER (WHERE se.status = 'selesai' AND se.status_tagihan = 'terkirim')::int AS tertagih,
                COUNT(*) FILTER (WHERE se.status = 'selesai' AND se.status_tagihan <> 'terkirim')::int AS belum_tertagih
           FROM ${SESI}`,
        p,
      ),
      query(`SELECT r.jenis, COUNT(*)::int AS jumlah FROM ${SESI} AND se.status = 'selesai' GROUP BY r.jenis ORDER BY r.jenis`, p),
      query(`SELECT to_char(j.tanggal, 'YYYY-MM-DD') AS tanggal, COUNT(*)::int AS jumlah FROM ${SESI} AND se.status = 'selesai' GROUP BY j.tanggal ORDER BY j.tanggal`, p),
      satu(
        `SELECT COUNT(*) FILTER (WHERE status <> 'batal')::int AS terjadwal, COUNT(*) FILTER (WHERE status = 'batal')::int AS batal
           FROM hd_jadwal WHERE faskes_uuid = $1 AND deleted_at IS NULL AND tanggal BETWEEN $2::date AND $3::date`,
        p,
      ),
      satu(`SELECT COUNT(*)::int AS n FROM hd_shift WHERE faskes_uuid = $1 AND deleted_at IS NULL AND aktif`, [f]),
      query(
        `SELECT m.uuid, m.kode, m.nama, m.status,
                COUNT(j.uuid) FILTER (WHERE j.status <> 'batal')::int AS terjadwal,
                COUNT(se.uuid) FILTER (WHERE se.status = 'selesai')::int AS selesai
           FROM hd_mesin m
           LEFT JOIN hd_jadwal j ON j.mesin_uuid = m.uuid AND j.deleted_at IS NULL AND j.tanggal BETWEEN $2::date AND $3::date
           LEFT JOIN hd_sesi se ON se.jadwal_uuid = j.uuid AND se.deleted_at IS NULL AND se.status = 'selesai'
          WHERE m.faskes_uuid = $1 AND m.deleted_at IS NULL
          GROUP BY m.uuid ORDER BY m.kode`,
        p,
      ),
      query(
        `SELECT k.kode, COUNT(*)::int AS kejadian, COUNT(DISTINCT o.sesi_uuid)::int AS sesi
           FROM hd_observasi o JOIN hd_sesi se ON se.uuid = o.sesi_uuid JOIN hd_jadwal j ON j.uuid = se.jadwal_uuid
           CROSS JOIN LATERAL jsonb_array_elements_text(o.komplikasi) AS k(kode)
          WHERE o.faskes_uuid = $1 AND o.deleted_at IS NULL AND NOT o.digantikan AND se.status <> 'batal' AND j.tanggal BETWEEN $2::date AND $3::date
          GROUP BY k.kode ORDER BY kejadian DESC`,
        p,
      ),
      satu(
        `SELECT COUNT(a.uuid) FILTER (WHERE a.status = 'tersedia')::int AS tersedia, COUNT(a.uuid) FILTER (WHERE a.status = 'belum_tersedia')::int AS belum_tersedia,
                COUNT(*) FILTER (WHERE a.uuid IS NULL)::int AS tanpa_data,
                ROUND(AVG(a.kt_v) FILTER (WHERE a.status = 'tersedia'), 2)::float8 AS rata_kt_v, ROUND(AVG(a.urr) FILTER (WHERE a.status = 'tersedia'), 2)::float8 AS rata_urr,
                MIN(a.kt_v) FILTER (WHERE a.status = 'tersedia')::float8 AS min_kt_v, MAX(a.kt_v) FILTER (WHERE a.status = 'tersedia')::float8 AS maks_kt_v
           FROM hd_sesi se JOIN hd_jadwal j ON j.uuid = se.jadwal_uuid LEFT JOIN hd_adekuasi a ON a.sesi_uuid = se.uuid AND a.deleted_at IS NULL
          WHERE se.faskes_uuid = $1 AND se.deleted_at IS NULL AND se.status = 'selesai' AND j.tanggal BETWEEN $2::date AND $3::date`,
        p,
      ),
    ]);

    const slot = jumlahHari * shift.n;
    kirim(res, {
      periode: { dari, sampai, jumlah_hari: jumlahHari },
      definisi: DEFINISI,
      tindakan: { ...ringkas, jadwal_terjadwal: jadwal.terjadwal, jadwal_batal: jadwal.batal, per_jenis: perJenis, per_hari: perHari },
      utilisasi_mesin: mesin.map((m) => ({ ...m, slot_tersedia: slot, persen: slot ? Math.round((m.selesai / slot) * 1000) / 10 : null })),
      komplikasi: komplikasi.map((k) => ({ ...k, label: KOMPLIKASI[k.kode] ?? k.kode })),
      adekuasi,
    });
  }),
);

export default rute;
