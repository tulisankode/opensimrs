import express from "express";
import { query, satu, sisipkan, ubah, sekarang, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, permintaanSalah } from "../umum/respons.js";
import { izinSarpras } from "../umum/izin.js";
import {
  KATEGORI_ASET,
  STATUS_ASET,
  angkaOpsional,
  boolOpsional,
  bulatOpsional,
  cekPilihan,
  konflik,
  teks,
  teksWajib,
  transisiAsetSah,
  wajibPilihan,
} from "./bersama.js";
import { NAMA_PEGAWAI, ambangKalibrasi, ambilAset, catatRiwayat, cekLokasi, cekPegawai, tanganiUnik } from "./dasar.js";

// Register aset (KF-4–KF-7): daftar & detail, tambah/ubah (kode inventaris unik per faskes — KT-3/KT-4), pindah
// lokasi (lokasi wajib milik faskes yang sama — KT-5), ubah status (dihapuskan = final, wajib alasan), riwayat.
const rute = express.Router();

const PILIH = `a.*, l.name AS nama_lokasi, ${NAMA_PEGAWAI("pg")} AS nama_penanggung_jawab`;
const DARI = `sarpras_aset a
  LEFT JOIN lokasi l ON l.uuid = a.lokasi_uuid AND l.faskes_uuid = a.faskes_uuid
  LEFT JOIN pegawai pg ON pg.uuid = a.penanggung_jawab_uuid AND pg.faskes_uuid = a.faskes_uuid`;
const DUPLIKAT = "Kode inventaris sudah dipakai aset lain di faskes ini";

// Kolom isian aset dari body (undefined = tidak diubah). Validasi tipe & batas sebelum menyentuh database.
const isianAset = (b) => ({
  kode_inventaris: teks(b.kode_inventaris, "kode_inventaris", 50),
  kategori: cekPilihan(b.kategori, KATEGORI_ASET, "kategori"),
  nama: teks(b.nama, "nama", 255),
  merek: teks(b.merek, "merek", 100),
  tipe: teks(b.tipe, "tipe", 100),
  nomor_seri: teks(b.nomor_seri, "nomor_seri", 100),
  tahun_perolehan: bulatOpsional(b.tahun_perolehan, "tahun_perolehan", { min: 1900, maks: new Date().getFullYear() + 1 }),
  nilai_perolehan: angkaOpsional(b.nilai_perolehan, "nilai_perolehan", { min: 0, maks: 99999999999999 }),
  wajib_kalibrasi: boolOpsional(b.wajib_kalibrasi),
  keterangan: teks(b.keterangan, "keterangan", 2000),
});

rute.get(
  "/",
  izinSarpras("Aset", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "a.faskes_uuid = $1 AND a.deleted_at IS NULL";
    const kategori = cekPilihan(req.query.kategori || undefined, KATEGORI_ASET, "kategori");
    if (kategori) {
      p.push(kategori);
      w += ` AND a.kategori = $${p.length}`;
    }
    const status = cekPilihan(req.query.status || undefined, STATUS_ASET, "status");
    if (status) {
      p.push(status);
      w += ` AND a.status = $${p.length}`;
    }
    if (req.query.lokasi_uuid) {
      p.push(String(req.query.lokasi_uuid));
      w += ` AND a.lokasi_uuid = $${p.length}`;
    }
    if (req.query.wajib_kalibrasi === "true" || req.query.wajib_kalibrasi === "false") {
      p.push(req.query.wajib_kalibrasi === "true");
      w += ` AND a.wajib_kalibrasi = $${p.length}`;
    }
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND (a.nama ILIKE $${p.length} OR a.kode_inventaris ILIKE $${p.length} OR a.nomor_seri ILIKE $${p.length} OR a.merek ILIKE $${p.length})`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI} WHERE ${w}`, p)).n;
    const rows = await query(`SELECT ${PILIH} FROM ${DARI} WHERE ${w} ORDER BY a.nama, a.kode_inventaris LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Detail: aset + jadwal pemeliharaan aktif + kalibrasi terakhir + 5 laporan kerusakan terakhir. Dipakai juga saat
// label QR dipindai (/sarpras/aset?buka=<uuid>) — tetap lewat login, izin, & filter faskes (KT-6).
rute.get(
  "/:uuid",
  izinSarpras("Aset", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    await ambilAset(req.params.uuid, f);
    const aset = await satu(`SELECT ${PILIH} FROM ${DARI} WHERE a.uuid = $1 AND a.faskes_uuid = $2 AND a.deleted_at IS NULL`, [req.params.uuid, f]);
    const jadwal = await query(
      `SELECT uuid, frekuensi, tanggal_berikutnya, status FROM sarpras_jadwal_pemeliharaan
        WHERE aset_uuid = $1 AND faskes_uuid = $2 AND status = 'aktif' AND deleted_at IS NULL ORDER BY tanggal_berikutnya`,
      [aset.uuid, f],
    );
    const kalibrasi = await satu(
      `SELECT uuid, lembaga_penguji, tanggal_kalibrasi, hasil, nomor_sertifikat, tanggal_berlaku FROM sarpras_kalibrasi
        WHERE aset_uuid = $1 AND faskes_uuid = $2 AND tanggal_kalibrasi IS NOT NULL AND deleted_at IS NULL
        ORDER BY tanggal_kalibrasi DESC, created_at DESC LIMIT 1`,
      [aset.uuid, f],
    );
    const laporan = await query(
      `SELECT uuid, nomor_laporan, uraian, prioritas, status, waktu_laporan, waktu_selesai FROM sarpras_laporan_kerusakan
        WHERE aset_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY waktu_laporan DESC LIMIT 5`,
      [aset.uuid, f],
    );
    kirim(res, { ...aset, jadwal_pemeliharaan: jadwal, kalibrasi_terakhir: kalibrasi, laporan_kerusakan: laporan, ambang_kalibrasi_hari: await ambangKalibrasi(f) });
  }),
);

rute.post(
  "/",
  izinSarpras("Aset", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const isi = isianAset(b);
    isi.kode_inventaris = teksWajib(b.kode_inventaris, "kode_inventaris", 50);
    isi.nama = teksWajib(b.nama, "nama", 255);
    isi.kategori = wajibPilihan(b.kategori, KATEGORI_ASET, "kategori");
    if (!b.lokasi_uuid) throw permintaanSalah("lokasi_uuid wajib diisi");
    const hasil = await transaksi(async (k) => {
      const lokasi = await cekLokasi(b.lokasi_uuid, f, k);
      const pj = await cekPegawai(b.penanggung_jawab_uuid, f, k, "Penanggung jawab");
      const ada = await satu(`SELECT 1 FROM sarpras_aset WHERE faskes_uuid = $1 AND lower(kode_inventaris) = lower($2) AND deleted_at IS NULL`, [f, isi.kode_inventaris], k);
      if (ada) throw konflik(DUPLIKAT);
      const aset = await sisipkan(
        "sarpras_aset",
        { ...isi, wajib_kalibrasi: isi.wajib_kalibrasi ?? false, faskes_uuid: f, lokasi_uuid: lokasi.uuid, penanggung_jawab_uuid: pj ?? null, status: "aktif", dibuat_oleh: req.author.username },
        k,
      ).catch(tanganiUnik(DUPLIKAT));
      await catatRiwayat(k, f, aset.uuid, "dibuat", { kode_inventaris: aset.kode_inventaris, nama: aset.nama, lokasi_uuid: aset.lokasi_uuid }, req.author.username);
      return aset;
    });
    kirim(res, hasil, "Aset berhasil dicatat");
  }),
);

// Ubah data aset (parsial). Lokasi & status punya aksi & izin tersendiri (PINDAH LOKASI / UBAH STATUS).
rute.put(
  "/:uuid",
  izinSarpras("Aset", "UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    if (b.status !== undefined) throw permintaanSalah("Status aset diubah lewat aksi Ubah Status");
    const isi = isianAset(b);
    for (const k of ["kode_inventaris", "nama", "kategori"]) if (isi[k] === null) throw permintaanSalah(`${k} tidak boleh kosong`);
    const hasil = await transaksi(async (k) => {
      const lama = await ambilAset(req.params.uuid, f, k, { kunci: true });
      if (lama.status === "dihapuskan") throw konflik("Aset sudah dihapuskan dan tidak dapat diubah");
      if (b.lokasi_uuid !== undefined && b.lokasi_uuid !== lama.lokasi_uuid) throw permintaanSalah("Lokasi aset diubah lewat aksi Pindah Lokasi");
      isi.penanggung_jawab_uuid = await cekPegawai(b.penanggung_jawab_uuid, f, k, "Penanggung jawab");
      if (isi.kode_inventaris && isi.kode_inventaris.toLowerCase() !== lama.kode_inventaris.toLowerCase()) {
        const ada = await satu(
          `SELECT 1 FROM sarpras_aset WHERE faskes_uuid = $1 AND lower(kode_inventaris) = lower($2) AND deleted_at IS NULL AND uuid <> $3`,
          [f, isi.kode_inventaris, lama.uuid],
          k,
        );
        if (ada) throw konflik(DUPLIKAT);
      }
      const berubah = Object.fromEntries(Object.entries(isi).filter(([c, v]) => v !== undefined && String(v ?? "") !== String(lama[c] ?? "")));
      if (!Object.keys(berubah).length) return lama;
      const aset = await ubah("sarpras_aset", lama.uuid, f, berubah, k).catch(tanganiUnik(DUPLIKAT));
      await catatRiwayat(
        k,
        f,
        aset.uuid,
        "diubah",
        Object.fromEntries(Object.keys(berubah).map((c) => [c, { sebelum: lama[c], sesudah: aset[c] }])),
        req.author.username,
      );
      return aset;
    });
    kirim(res, hasil, "Aset berhasil diperbarui");
  }),
);

rute.patch(
  "/:uuid/lokasi",
  izinSarpras("Aset", "PINDAH LOKASI"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    if (!b.lokasi_uuid) throw permintaanSalah("lokasi_uuid wajib diisi");
    const catatan = teks(b.catatan, "catatan", 1000);
    const hasil = await transaksi(async (k) => {
      const lama = await ambilAset(req.params.uuid, f, k, { kunci: true, bisaDikerjakan: true });
      const lokasi = await cekLokasi(b.lokasi_uuid, f, k);
      if (lokasi.uuid === lama.lokasi_uuid) throw permintaanSalah("Aset sudah berada di lokasi tersebut");
      const aset = await ubah("sarpras_aset", lama.uuid, f, { lokasi_uuid: lokasi.uuid }, k);
      await catatRiwayat(k, f, aset.uuid, "dipindah", { lokasi_asal_uuid: lama.lokasi_uuid, lokasi_tujuan_uuid: lokasi.uuid, lokasi_tujuan: lokasi.nama, catatan }, req.author.username);
      return aset;
    });
    kirim(res, hasil, "Lokasi aset berhasil dipindah");
  }),
);

// Status manual (aktif/rusak/dalam_perbaikan/dihapuskan). Sistem tidak mengubah status otomatis dari hasil kalibrasi
// atau laporan kerusakan (desain §7 butir 8). Penghapusan aset final: jadwal pemeliharaan aktifnya ikut dinonaktifkan.
rute.patch(
  "/:uuid/status",
  izinSarpras("Aset", "UBAH STATUS"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const status = wajibPilihan(b.status, STATUS_ASET, "status");
    const alasan = teks(b.alasan, "alasan", 2000);
    if (status === "dihapuskan" && !alasan) throw permintaanSalah("alasan wajib diisi untuk penghapusan aset");
    const hasil = await transaksi(async (k) => {
      const lama = await ambilAset(req.params.uuid, f, k, { kunci: true });
      if (!transisiAsetSah(lama.status, status))
        throw konflik(lama.status === "dihapuskan" ? "Aset sudah dihapuskan; status tidak dapat diubah lagi" : `Aset sudah berstatus ${STATUS_ASET[status]}`);
      const n = sekarang();
      const aset = await ubah(
        "sarpras_aset",
        lama.uuid,
        f,
        status === "dihapuskan" ? { status, alasan_dihapuskan: alasan, dihapuskan_oleh: req.author.username, dihapuskan_pada: n } : { status },
        k,
      );
      if (status === "dihapuskan") {
        await query(
          `UPDATE sarpras_jadwal_pemeliharaan SET status = 'nonaktif', alasan_nonaktif = 'Aset dihapuskan', dinonaktifkan_oleh = $1, dinonaktifkan_pada = $2, updated_at = $2
            WHERE aset_uuid = $3 AND faskes_uuid = $4 AND status = 'aktif' AND deleted_at IS NULL`,
          [req.author.username, n, lama.uuid, f],
          k,
        );
      }
      await catatRiwayat(k, f, aset.uuid, "status_diubah", { status_sebelum: lama.status, status_sesudah: status, alasan }, req.author.username);
      return aset;
    });
    kirim(res, hasil, "Status aset berhasil diubah");
  }),
);

rute.get(
  "/:uuid/riwayat",
  izinSarpras("Aset", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const aset = await ambilAset(req.params.uuid, f);
    const pg = halaman(req.query);
    const total = (await satu(`SELECT COUNT(*) n FROM sarpras_riwayat_aset WHERE aset_uuid = $1 AND faskes_uuid = $2`, [aset.uuid, f])).n;
    const rows = await query(
      `SELECT uuid, jenis_peristiwa, data_perubahan, pengguna, waktu_peristiwa FROM sarpras_riwayat_aset
        WHERE aset_uuid = $1 AND faskes_uuid = $2 ORDER BY waktu_peristiwa DESC, uuid DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      [aset.uuid, f],
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

export default rute;
