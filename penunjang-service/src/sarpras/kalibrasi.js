import express from "express";
import { query, satu, sisipkan, ubah, sekarang, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { izinSarpras } from "../umum/izin.js";
import { HARI, HASIL_KALIBRASI, STATUS_KALIBRASI, awalHariWib, cekPilihan, epochOpsional, epochWajib, konflik, teks, teksWajib, wajibPilihan } from "./bersama.js";
import { ambangKalibrasi, ambilAset, catatRiwayat } from "./dasar.js";
import { ambilBerkas, daftarBerkas, simpanBerkas } from "./berkas.js";

// Kalibrasi & uji fungsi (KF-14/KF-15, fitur sarpras_kalibrasi). Setiap catatan adalah baris baru — catatan &
// sertifikat terdahulu tidak ditimpa. Baris tanpa tanggal_kalibrasi = rencana (terjadwal); hasil diisi kemudian lewat
// /:uuid/hasil. Status masa berlaku dihitung dari catatan terealisasi TERBARU per aset terhadap hari ini (WIB) dan
// ambang faskes (sarpras_pengaturan): kedaluwarsa (KT-18), jatuh_tempo dalam ambang (KT-17), berlaku; catatan lama
// berstatus "digantikan". Hasil tidak lulus tidak mengubah status aset otomatis (desain §7 butir 8).
const rute = express.Router();

// $2 = awal hari ini (WIB), $3 = batas jatuh tempo (awal hari ini + ambang hari).
const EKSPRESI_STATUS = `CASE
    WHEN k.tanggal_kalibrasi IS NULL THEN 'terjadwal'
    WHEN EXISTS (SELECT 1 FROM sarpras_kalibrasi b WHERE b.aset_uuid = k.aset_uuid AND b.faskes_uuid = k.faskes_uuid AND b.deleted_at IS NULL
                   AND b.tanggal_kalibrasi IS NOT NULL AND (b.tanggal_kalibrasi > k.tanggal_kalibrasi OR (b.tanggal_kalibrasi = k.tanggal_kalibrasi AND b.uuid > k.uuid))) THEN 'digantikan'
    WHEN k.tanggal_berlaku IS NULL THEN 'tanpa_masa_berlaku'
    WHEN k.tanggal_berlaku < $2::bigint THEN 'kedaluwarsa'
    WHEN k.tanggal_berlaku <= $3::bigint THEN 'jatuh_tempo'
    ELSE 'berlaku' END`;
const DARI = `sarpras_kalibrasi k
  JOIN sarpras_aset a ON a.uuid = k.aset_uuid AND a.faskes_uuid = k.faskes_uuid
  LEFT JOIN lokasi l ON l.uuid = a.lokasi_uuid AND l.faskes_uuid = a.faskes_uuid`;
const PILIH = `k.*, a.kode_inventaris, a.nama AS nama_aset, a.status AS status_aset, l.name AS nama_lokasi, ${EKSPRESI_STATUS} AS status_kalibrasi,
  (SELECT COUNT(*)::int FROM sarpras_berkas s WHERE s.kalibrasi_uuid = k.uuid AND s.deleted_at IS NULL) AS jumlah_sertifikat`;

export const batasKalibrasi = async (faskesUuid, k, n = sekarang()) => {
  const ambang = await ambangKalibrasi(faskesUuid, k);
  const hariIni = awalHariWib(n);
  return { ambang, hariIni, batas: hariIni + ambang * HARI };
};

const ambilKalibrasi = async (uuid, faskesUuid, k, kunci = false) => {
  const r = await satu(`SELECT * FROM sarpras_kalibrasi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL${kunci ? " FOR UPDATE" : ""}`, [String(uuid), faskesUuid], k);
  if (!r) throw tidakDitemukan("Catatan kalibrasi");
  return r;
};

// Kolom hasil kalibrasi terealisasi: tanggal kalibrasi (tidak di masa depan) + hasil wajib; tanggal berlaku ≥ tanggal kalibrasi.
const isianHasil = (b, wajibRealisasi) => {
  const n = sekarang();
  const tanggalKalibrasi = epochOpsional(b.tanggal_kalibrasi, "tanggal_kalibrasi");
  if (wajibRealisasi && !tanggalKalibrasi) throw permintaanSalah("tanggal_kalibrasi wajib diisi");
  const isi = {
    lembaga_penguji: teks(b.lembaga_penguji, "lembaga_penguji", 255),
    nomor_sertifikat: teks(b.nomor_sertifikat, "nomor_sertifikat", 100),
    catatan_tindak_lanjut: teks(b.catatan_tindak_lanjut, "catatan_tindak_lanjut", 5000),
    tanggal_berlaku: b.tanggal_berlaku === undefined ? undefined : awalHariWib(epochWajib(b.tanggal_berlaku, "tanggal_berlaku")),
  };
  if (tanggalKalibrasi) {
    if (tanggalKalibrasi > n + 300) throw permintaanSalah("tanggal_kalibrasi tidak boleh di masa depan");
    isi.tanggal_kalibrasi = tanggalKalibrasi;
    isi.hasil = wajibPilihan(b.hasil, HASIL_KALIBRASI, "hasil");
    if (isi.tanggal_berlaku && isi.tanggal_berlaku < awalHariWib(tanggalKalibrasi)) throw permintaanSalah("tanggal_berlaku tidak boleh sebelum tanggal_kalibrasi");
    if (isi.hasil === "perlu_tindak_lanjut" && !isi.catatan_tindak_lanjut) throw permintaanSalah("catatan_tindak_lanjut wajib diisi untuk hasil perlu tindak lanjut");
  } else if ((b.hasil !== undefined && b.hasil !== null && b.hasil !== "") || isi.tanggal_berlaku) {
    throw permintaanSalah("hasil dan tanggal_berlaku hanya diisi bersama tanggal_kalibrasi");
  }
  return isi;
};

rute.get(
  "/",
  izinSarpras("Kalibrasi", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const pg = halaman(req.query);
    const { ambang, hariIni, batas } = await batasKalibrasi(f);
    const p = [f, hariIni, batas];
    let w = "k.faskes_uuid = $1 AND k.deleted_at IS NULL AND a.deleted_at IS NULL";
    if (req.query.aset_uuid) {
      p.push(String(req.query.aset_uuid));
      w += ` AND k.aset_uuid = $${p.length}`;
    }
    const status = cekPilihan(req.query.status || undefined, STATUS_KALIBRASI, "status");
    if (status) {
      p.push(status);
      w += ` AND (${EKSPRESI_STATUS}) = $${p.length}`;
    }
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND (a.nama ILIKE $${p.length} OR a.kode_inventaris ILIKE $${p.length} OR k.nomor_sertifikat ILIKE $${p.length})`;
    }
    // $2/$3 dipakai ekspresi status; disebut juga di sini agar tipe parameter tetap terdefinisi saat filter status kosong.
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI} WHERE ${w} AND $2::bigint <= $3::bigint`, p)).n;
    const rows = await query(
      `SELECT ${PILIH} FROM ${DARI} WHERE ${w}
        ORDER BY CASE ${EKSPRESI_STATUS} WHEN 'kedaluwarsa' THEN 0 WHEN 'jatuh_tempo' THEN 1 WHEN 'terjadwal' THEN 2 WHEN 'berlaku' THEN 3 ELSE 4 END,
                 COALESCE(k.tanggal_berlaku, k.tanggal_jadwal), a.nama
        LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, { ...denganHalaman(rows, total, pg), ambang_kalibrasi_hari: ambang });
  }),
);

rute.get(
  "/:uuid",
  izinSarpras("Kalibrasi", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const { hariIni, batas } = await batasKalibrasi(f);
    const r = await satu(`SELECT ${PILIH} FROM ${DARI} WHERE k.uuid = $4 AND k.faskes_uuid = $1 AND k.deleted_at IS NULL`, [f, hariIni, batas, req.params.uuid]);
    if (!r) throw tidakDitemukan("Catatan kalibrasi");
    kirim(res, { ...r, sertifikat: await daftarBerkas("sertifikat_kalibrasi", r.uuid, f) });
  }),
);

// Catat kalibrasi (terealisasi: tanggal_kalibrasi + hasil) atau rencana (tanggal_jadwal saja). Aset otomatis ditandai
// wajib kalibrasi & dicatat di riwayat aset (KT-16).
rute.post(
  "/",
  izinSarpras("Kalibrasi", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    if (!b.aset_uuid) throw permintaanSalah("aset_uuid wajib diisi");
    const isi = isianHasil(b, false);
    const tanggalJadwal = epochOpsional(b.tanggal_jadwal, "tanggal_jadwal");
    if (!isi.tanggal_kalibrasi && !tanggalJadwal) throw permintaanSalah("Isi tanggal_kalibrasi (hasil kalibrasi) atau tanggal_jadwal (rencana kalibrasi)");
    const hasil = await transaksi(async (k) => {
      const aset = await ambilAset(b.aset_uuid, f, k, { kunci: true, bisaDikerjakan: true });
      const r = await sisipkan(
        "sarpras_kalibrasi",
        { ...Object.fromEntries(Object.entries(isi).filter(([, v]) => v !== undefined)), faskes_uuid: f, aset_uuid: aset.uuid, tanggal_jadwal: tanggalJadwal ? awalHariWib(tanggalJadwal) : null, dicatat_oleh: req.author.username },
        k,
      );
      if (!aset.wajib_kalibrasi) await ubah("sarpras_aset", aset.uuid, f, { wajib_kalibrasi: true }, k);
      await catatRiwayat(
        k,
        f,
        aset.uuid,
        r.tanggal_kalibrasi ? "kalibrasi_dicatat" : "kalibrasi_dijadwalkan",
        { kalibrasi_uuid: r.uuid, hasil: r.hasil, tanggal_kalibrasi: r.tanggal_kalibrasi, tanggal_berlaku: r.tanggal_berlaku, tanggal_jadwal: r.tanggal_jadwal },
        req.author.username,
      );
      return r;
    });
    kirim(res, hasil, "Kalibrasi berhasil dicatat");
  }),
);

// Ubah jadwal rencana kalibrasi yang belum terlaksana (wajib alasan); catatan terealisasi tidak boleh diubah.
rute.put(
  "/:uuid/jadwal",
  izinSarpras("Kalibrasi", "UPDATE JADWAL"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const tanggalJadwal = awalHariWib(epochWajib(b.tanggal_jadwal, "tanggal_jadwal"));
    const alasan = teksWajib(b.alasan, "alasan", 2000);
    const hasil = await transaksi(async (k) => {
      const lama = await ambilKalibrasi(req.params.uuid, f, k, true);
      if (lama.tanggal_kalibrasi) throw konflik("Kalibrasi sudah terlaksana; catat kalibrasi baru untuk jadwal berikutnya");
      const r = await ubah("sarpras_kalibrasi", lama.uuid, f, { tanggal_jadwal: tanggalJadwal }, k);
      await catatRiwayat(k, f, lama.aset_uuid, "jadwal_kalibrasi_diubah", { kalibrasi_uuid: lama.uuid, sebelum: lama.tanggal_jadwal, sesudah: tanggalJadwal, alasan }, req.author.username);
      return r;
    });
    kirim(res, hasil, "Jadwal kalibrasi berhasil diubah");
  }),
);

// Isi hasil untuk rencana kalibrasi (sekali; setelah terealisasi catatan tidak ditimpa).
rute.patch(
  "/:uuid/hasil",
  izinSarpras("Kalibrasi", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const isi = isianHasil(b, true);
    const hasil = await transaksi(async (k) => {
      const lama = await ambilKalibrasi(req.params.uuid, f, k, true);
      if (lama.tanggal_kalibrasi) throw konflik("Hasil kalibrasi sudah dicatat dan tidak dapat ditimpa");
      await ambilAset(lama.aset_uuid, f, k, { bisaDikerjakan: true });
      const r = await ubah("sarpras_kalibrasi", lama.uuid, f, { ...isi, dicatat_oleh: req.author.username }, k);
      await catatRiwayat(k, f, lama.aset_uuid, "kalibrasi_dicatat", { kalibrasi_uuid: r.uuid, hasil: r.hasil, tanggal_kalibrasi: r.tanggal_kalibrasi, tanggal_berlaku: r.tanggal_berlaku }, req.author.username);
      return r;
    });
    kirim(res, hasil, "Hasil kalibrasi berhasil dicatat");
  }),
);

rute.post(
  "/:uuid/sertifikat",
  izinSarpras("Kalibrasi", "UNGGAH SERTIFIKAT"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const r = await ambilKalibrasi(req.params.uuid, f, k, true);
      return simpanBerkas(k, { faskesUuid: f, jenis: "sertifikat_kalibrasi", indukUuid: r.uuid, body: req.body ?? {}, pengguna: req.author.username });
    });
    kirim(res, hasil, "Sertifikat kalibrasi berhasil diunggah");
  }),
);

rute.get(
  "/:uuid/sertifikat/:berkasUuid",
  izinSarpras("Berkas", "READ"),
  tangani(async (req, res) => kirim(res, await ambilBerkas("sertifikat_kalibrasi", req.params.uuid, req.params.berkasUuid, req.author.faskesUuid))),
);

export default rute;
