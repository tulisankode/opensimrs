import express from "express";
import { query, satu } from "../db.js";
import { kirim } from "../umum/respons.js";
import { izinMutu, punyaIzin } from "../umum/izin.js";
import { batasMasaBerlaku, bulatOpsional, persen, sisaHari, statusMasaBerlaku, susunKesiapan } from "./bersama.js";
import { NAMA_PEGAWAI, tanganiMutu } from "./dasar.js";

// Dasbor kesiapan akreditasi (KF-10, KT-9..12): GET /dasbor?limit=20&instrumen_uuid=
//   ringkasan  : jumlah lengkap (bukan terpotong limit) elemen, elemen terbukti, persen kesiapan, dokumen perlu
//                ditinjau, kredensial peringatan 90/30 hari & kedaluwarsa (hanya kredensial berstatus aktif);
//   kesiapan   : persentase kelengkapan per instrumen aktif → bab → standar;
//   daftar     : elemen tanpa bukti, dokumen perlu ditinjau, kredensial per kategori (dibatasi `limit`).
// Elemen "terbukti" = punya pemetaan aktif ke dokumen berstatus disahkan yang belum dihapus (keputusan desain §9.7).
// Daftar rinci hanya dikirim bila pengguna juga berhak membaca sumbernya (KT-13): dokumen → Dokumen › READ,
// kredensial → Kredensial › READ, elemen → Instrumen › READ atau Dokumen › READ. Ringkasan angka selalu dikirim.
const rute = express.Router();
const MODUL = "Mutu & Akreditasi";

rute.get(
  "/",
  izinMutu("Dasbor Kesiapan", "READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const limit = bulatOpsional(req.query.limit || undefined, "limit", { min: 1, maks: 200 }) ?? 20;
    const instrumenUuid = req.query.instrumen_uuid ? String(req.query.instrumen_uuid) : null;
    const { hariIni, batas30, batas90 } = batasMasaBerlaku();
    const [bolehDokumen, bolehKredensial, bolehInstrumen] = await Promise.all([
      punyaIzin(req, MODUL, "Dokumen Akreditasi", "READ"),
      punyaIzin(req, MODUL, "Kredensial Staf", "READ"),
      punyaIzin(req, MODUL, "Instrumen Akreditasi", "READ"),
    ]);

    const baris = await query(
      `SELECT i.uuid AS instrumen_uuid, i.kode AS instrumen_kode, i.nama AS instrumen_nama,
              b.uuid AS bab_uuid, b.kode AS bab_kode, b.nama AS bab_nama,
              s.uuid AS standar_uuid, s.kode AS standar_kode, s.nama AS standar_nama,
              e.uuid AS elemen_uuid, e.kode AS elemen_kode, e.uraian AS elemen_uraian,
              (e.uuid IS NOT NULL AND EXISTS (
                 SELECT 1 FROM mutu_dokumen_elemen de JOIN mutu_dokumen d ON d.uuid = de.dokumen_uuid
                  WHERE de.elemen_uuid = e.uuid AND de.deleted_at IS NULL AND d.deleted_at IS NULL AND d.status = 'disahkan' AND d.faskes_uuid = $1)) AS ada_bukti
         FROM mutu_instrumen i
         LEFT JOIN mutu_bab b ON b.instrumen_uuid = i.uuid AND b.deleted_at IS NULL
         LEFT JOIN mutu_standar s ON s.bab_uuid = b.uuid AND s.deleted_at IS NULL
         LEFT JOIN mutu_elemen_penilaian e ON e.standar_uuid = s.uuid AND e.deleted_at IS NULL
        WHERE i.faskes_uuid = $1 AND i.deleted_at IS NULL AND i.aktif = true AND ($2::varchar IS NULL OR i.uuid = $2)
        ORDER BY i.nama, b.urutan, b.kode, s.urutan, s.kode, e.urutan, e.kode`,
      [f, instrumenUuid],
    );
    const kesiapan = susunKesiapan(baris);
    const totalElemen = kesiapan.reduce((a, i) => a + i.total_elemen, 0);
    const elemenTerbukti = kesiapan.reduce((a, i) => a + i.elemen_terbukti, 0);
    const tanpaBukti = baris.filter((r) => r.elemen_uuid && !r.ada_bukti);

    const tinjau = `FROM mutu_dokumen d WHERE d.faskes_uuid = $1 AND d.deleted_at IS NULL AND d.status = 'disahkan'
      AND d.tanggal_tinjau_ulang IS NOT NULL AND d.tanggal_tinjau_ulang <= $2`;
    const jumlahTinjau = Number((await satu(`SELECT COUNT(*) n ${tinjau}`, [f, hariIni])).n);

    const kred = await satu(
      `SELECT COUNT(*) FILTER (WHERE tanggal_berakhir < $2) AS kedaluwarsa,
              COUNT(*) FILTER (WHERE tanggal_berakhir BETWEEN $2 AND $3) AS peringatan_30,
              COUNT(*) FILTER (WHERE tanggal_berakhir > $3 AND tanggal_berakhir <= $4) AS peringatan_90
         FROM mutu_kredensial WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status = 'aktif' AND tanggal_berakhir IS NOT NULL`,
      [f, hariIni, batas30, batas90],
    );
    const daftarKredensial = async (kondisi, params) =>
      (
        await query(
          `SELECT k.uuid, k.pegawai_uuid, ${NAMA_PEGAWAI("pg")} AS nama_pegawai, k.jenis, k.nomor, k.tanggal_berakhir
             FROM mutu_kredensial k LEFT JOIN pegawai pg ON pg.uuid = k.pegawai_uuid AND pg.faskes_uuid = k.faskes_uuid
            WHERE k.faskes_uuid = $1 AND k.deleted_at IS NULL AND k.status = 'aktif' AND ${kondisi}
            ORDER BY k.tanggal_berakhir, nama_pegawai LIMIT ${limit}`,
          [f, ...params],
        )
      ).map((r) => ({ ...r, masa_berlaku: statusMasaBerlaku(r.tanggal_berakhir), sisa_hari: sisaHari(r.tanggal_berakhir) }));

    kirim(res, {
      ringkasan: {
        total_elemen: totalElemen,
        elemen_terbukti: elemenTerbukti,
        elemen_tanpa_bukti: totalElemen - elemenTerbukti,
        persen_kesiapan: persen(elemenTerbukti, totalElemen),
        dokumen_perlu_tinjau: jumlahTinjau,
        kredensial_peringatan_90: Number(kred.peringatan_90),
        kredensial_peringatan_30: Number(kred.peringatan_30),
        kredensial_kedaluwarsa: Number(kred.kedaluwarsa),
      },
      kesiapan,
      izin: { dokumen: bolehDokumen, kredensial: bolehKredensial, elemen: bolehInstrumen || bolehDokumen },
      elemen_tanpa_bukti:
        bolehInstrumen || bolehDokumen
          ? tanpaBukti.slice(0, limit).map((r) => ({
              uuid: r.elemen_uuid,
              kode: r.elemen_kode,
              uraian: r.elemen_uraian,
              instrumen_nama: r.instrumen_nama,
              bab_kode: r.bab_kode,
              bab_nama: r.bab_nama,
              standar_kode: r.standar_kode,
              standar_nama: r.standar_nama,
            }))
          : [],
      dokumen_perlu_tinjau: bolehDokumen
        ? await query(`SELECT d.uuid, d.nomor, d.judul, d.versi, d.jenis, d.unit_pemilik, d.tanggal_tinjau_ulang, d.status ${tinjau} ORDER BY d.tanggal_tinjau_ulang LIMIT ${limit}`, [f, hariIni])
        : [],
      kredensial_peringatan_90: bolehKredensial ? await daftarKredensial(`k.tanggal_berakhir > $2 AND k.tanggal_berakhir <= $3`, [batas30, batas90]) : [],
      kredensial_peringatan_30: bolehKredensial ? await daftarKredensial(`k.tanggal_berakhir BETWEEN $2 AND $3`, [hariIni, batas30]) : [],
      kredensial_kedaluwarsa: bolehKredensial ? await daftarKredensial(`k.tanggal_berakhir < $2`, [hariIni]) : [],
    });
  }),
);

export default rute;
