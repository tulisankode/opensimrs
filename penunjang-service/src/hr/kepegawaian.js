import express from "express";
import { query, satu, sisipkan, sekarang, ubah, transaksi } from "../db.js";
import { kirim, halaman, denganHalaman, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { wajibIzin } from "../umum/izin.js";
import { cekPilihan, konflik, teks, teksWajib } from "../sarpras/bersama.js";
import { NAMA_PEGAWAI, cekPegawaiAktif, tanganiMutu } from "../mutu/dasar.js";
import {
  STATUS_KEPEGAWAIAN,
  riwayatAwal,
  ringkasanUbah,
  susunPerubahan,
  validasiKepegawaianBaru,
  validasiPendidikan,
  validasiPerubahanKepegawaian,
} from "./bersama.js";
import { catatAuditPusat } from "./audit.js";

// Kepegawaian HR / SDM (STD-0035 fase 1, KF-1/KF-2). Catatan kepegawaian SELALU tertaut pegawai aktif Datamaster
// (tabel pegawai) — tidak membuat identitas baru; satu catatan aktif per pegawai per faskes (indeks unik, KT-1).
// Data pribadi Datamaster (NIK, tanggal lahir, jenis kelamin) tidak pernah dikirim; cukup nama + gelar.
//   GET    /kepegawaian?cari=&unit_uuid=&status_kepegawaian=&aktif=&page=&limit=   daftar berhalaman
//   GET    /kepegawaian/calon?cari=                     pegawai aktif Datamaster yang belum punya catatan kepegawaian
//   POST   /kepegawaian                                 catat (pegawai_uuid, status, unit, jabatan, golongan, TMT)
//   GET    /kepegawaian/:uuid                           detail + riwayat + pendidikan + akun tertaut
//   PUT    /kepegawaian/:uuid                           perubahan bertanggal berlaku / akhiri / aktifkan kembali
//   DELETE /kepegawaian/:uuid                           hapus lunak (koreksi salah input)
//   POST/PUT/DELETE /kepegawaian/:uuid/pendidikan[/:pendidikanUuid]
//   POST/DELETE     /kepegawaian/:uuid/akun[/:akunUuid]  tautan akun login (layanan mandiri, fase lanjutan)
// Semua penulisan dalam transaksi + audit_trail pusat; filter faskes_uuid dari token; rujukan faskes lain = 404/400.
const rute = express.Router();
const izin = (aksi) => wajibIzin("HR / SDM", "Kepegawaian", aksi);
const pesanUnik = "Pegawai sudah memiliki data kepegawaian aktif di faskes ini";

const KOLOM = `h.uuid, h.faskes_uuid, h.pegawai_uuid, h.status_kepegawaian, h.unit_uuid, h.jabatan, h.golongan, h.tanggal_mulai,
  h.tanggal_selesai, h.dibuat_oleh, h.created_at, h.updated_at`;
const audit = (k, req, aksi, entitas, entitasUuid, ringkasan) =>
  catatAuditPusat(k, { faskesUuid: req.author.faskesUuid, aksi, entitas, entitasUuid, ringkasan, pengguna: req.author.username });

const ambilKepegawaian = async (uuid, f, k, kunci = false) => {
  const row = await satu(
    `SELECT h.* FROM hr_kepegawaian h WHERE h.uuid = $1 AND h.faskes_uuid = $2 AND h.deleted_at IS NULL${kunci ? " FOR UPDATE" : ""}`,
    [String(uuid ?? ""), f],
    k,
  );
  if (!row) throw tidakDitemukan("Data kepegawaian");
  return row;
};
const cekUnit = async (unitUuid, f, k) => {
  if (!unitUuid) return;
  if (!(await satu(`SELECT uuid FROM lokasi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [unitUuid, f], k)))
    throw permintaanSalah("Unit kerja tidak ditemukan di faskes ini");
};
const riwayatTerbuka = (kepegawaianUuid, f, k) =>
  satu(
    `SELECT * FROM hr_riwayat_jabatan WHERE kepegawaian_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND tanggal_selesai IS NULL
      ORDER BY tanggal_mulai DESC, created_at DESC LIMIT 1 FOR UPDATE`,
    [kepegawaianUuid, f],
    k,
  );
const sisipkanRiwayat = (k, req, kepegawaianUuid, potret) =>
  sisipkan("hr_riwayat_jabatan", { faskes_uuid: req.author.faskesUuid, kepegawaian_uuid: kepegawaianUuid, ...potret, dicatat_oleh: req.author.username ?? null }, k);

rute.get(
  "/",
  izin("READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const q = req.query;
    const syarat = ["h.faskes_uuid = $1", "h.deleted_at IS NULL"];
    const p = [f];
    const cari = teks(q.cari ?? q.q, "cari", 100);
    const status = cekPilihan(q.status_kepegawaian || undefined, STATUS_KEPEGAWAIAN, "status_kepegawaian");
    if (cari) syarat.push(`(pg.name ILIKE $${p.push(`%${cari}%`)} OR h.jabatan ILIKE $${p.length} OR h.golongan ILIKE $${p.length})`);
    if (q.unit_uuid) syarat.push(`h.unit_uuid = $${p.push(String(q.unit_uuid))}`);
    if (status) syarat.push(`h.status_kepegawaian = $${p.push(status)}`);
    if (q.aktif === "1" || q.aktif === "true") syarat.push("h.tanggal_selesai IS NULL");
    if (q.aktif === "0" || q.aktif === "false") syarat.push("h.tanggal_selesai IS NOT NULL");
    const pg = halaman(q);
    const dari = `FROM hr_kepegawaian h JOIN pegawai pg ON pg.uuid = h.pegawai_uuid AND pg.faskes_uuid = h.faskes_uuid
      LEFT JOIN lokasi l ON l.uuid = h.unit_uuid AND l.faskes_uuid = h.faskes_uuid`;
    const where = syarat.join(" AND ");
    const total = (await satu(`SELECT COUNT(*) n ${dari} WHERE ${where}`, p)).n;
    const rows = await query(
      `SELECT ${KOLOM}, ${NAMA_PEGAWAI("pg")} AS nama_pegawai, pg.status AS pegawai_aktif, l.name AS nama_unit ${dari}
        WHERE ${where} ORDER BY (h.tanggal_selesai IS NULL) DESC, pg.name LIMIT $${p.length + 1} OFFSET $${p.length + 2}`,
      [...p, pg.limit, pg.offset],
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/calon",
  izin("CREATE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const cari = teks(req.query.cari, "cari", 100) ?? "";
    kirim(
      res,
      await query(
        `SELECT p.uuid AS pegawai_uuid, ${NAMA_PEGAWAI("p")} AS nama_pegawai FROM pegawai p
          WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.status = true AND ($2 = '' OR p.name ILIKE '%' || $2 || '%')
            AND NOT EXISTS (SELECT 1 FROM hr_kepegawaian h WHERE h.pegawai_uuid = p.uuid AND h.faskes_uuid = p.faskes_uuid AND h.deleted_at IS NULL)
          ORDER BY p.name LIMIT 500`,
        [f, cari],
      ),
    );
  }),
);

rute.post(
  "/",
  izin("CREATE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = validasiKepegawaianBaru(req.body ?? {});
    const hasil = await transaksi(async (k) => {
      const pegawai = await cekPegawaiAktif(b.pegawai_uuid, f, k);
      await cekUnit(b.unit_uuid, f, k);
      if (await satu(`SELECT 1 FROM hr_kepegawaian WHERE faskes_uuid = $1 AND pegawai_uuid = $2 AND deleted_at IS NULL`, [f, pegawai.uuid], k)) throw konflik(pesanUnik);
      const row = await sisipkan(
        "hr_kepegawaian",
        {
          faskes_uuid: f,
          pegawai_uuid: pegawai.uuid,
          status_kepegawaian: b.status_kepegawaian,
          unit_uuid: b.unit_uuid,
          jabatan: b.jabatan,
          golongan: b.golongan,
          tanggal_mulai: b.tanggal_mulai,
          tanggal_selesai: null,
          dibuat_oleh: req.author.username ?? null,
        },
        k,
      );
      await sisipkanRiwayat(k, req, row.uuid, riwayatAwal(b));
      await audit(k, req, "buat", "hr_kepegawaian", row.uuid, {
        pegawai_uuid: row.pegawai_uuid,
        status_kepegawaian: row.status_kepegawaian,
        unit_uuid: row.unit_uuid,
        jabatan: row.jabatan,
        golongan: row.golongan,
        tanggal_mulai: row.tanggal_mulai,
      });
      return { ...row, nama_pegawai: pegawai.nama };
    });
    kirim(res, hasil, "Data kepegawaian berhasil dicatat");
  }, pesanUnik),
);

rute.get(
  "/:uuid",
  izin("READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const row = await satu(
      `SELECT ${KOLOM}, ${NAMA_PEGAWAI("pg")} AS nama_pegawai, pg.status AS pegawai_aktif, l.name AS nama_unit
        FROM hr_kepegawaian h JOIN pegawai pg ON pg.uuid = h.pegawai_uuid AND pg.faskes_uuid = h.faskes_uuid
        LEFT JOIN lokasi l ON l.uuid = h.unit_uuid AND l.faskes_uuid = h.faskes_uuid
        WHERE h.uuid = $1 AND h.faskes_uuid = $2 AND h.deleted_at IS NULL`,
      [String(req.params.uuid), f],
    );
    if (!row) throw tidakDitemukan("Data kepegawaian");
    row.riwayat = await query(
      `SELECT r.uuid, r.status_kepegawaian, r.unit_uuid, l.name AS nama_unit, r.jabatan, r.golongan, r.tanggal_mulai, r.tanggal_selesai,
          r.jenis_perubahan, r.nomor_sk, r.catatan, r.dicatat_oleh, r.created_at
        FROM hr_riwayat_jabatan r LEFT JOIN lokasi l ON l.uuid = r.unit_uuid AND l.faskes_uuid = r.faskes_uuid
        WHERE r.kepegawaian_uuid = $1 AND r.faskes_uuid = $2 AND r.deleted_at IS NULL ORDER BY r.tanggal_mulai DESC, r.created_at DESC`,
      [row.uuid, f],
    );
    row.pendidikan = await query(
      `SELECT uuid, jenjang, institusi, bidang_studi, tahun_lulus, dicatat_oleh, created_at, updated_at FROM hr_pendidikan
        WHERE kepegawaian_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY tahun_lulus DESC NULLS LAST, created_at DESC`,
      [row.uuid, f],
    );
    row.akun = await query(
      `SELECT uuid, username, ditautkan_oleh, created_at FROM hr_akun_pegawai WHERE kepegawaian_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY created_at`,
      [row.uuid, f],
    );
    kirim(res, row);
  }),
);

rute.put(
  "/:uuid",
  izin("UPDATE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const input = validasiPerubahanKepegawaian(req.body ?? {});
    const hasil = await transaksi(async (k) => {
      const lama = await ambilKepegawaian(req.params.uuid, f, k, true);
      const rencana = susunPerubahan(lama, await riwayatTerbuka(lama.uuid, f, k), input);
      if (rencana.ubah.unit_uuid) await cekUnit(rencana.ubah.unit_uuid, f, k);
      if (rencana.tutupRiwayat !== null)
        await query(
          `UPDATE hr_riwayat_jabatan SET tanggal_selesai = $1, updated_at = $2
            WHERE kepegawaian_uuid = $3 AND faskes_uuid = $4 AND tanggal_selesai IS NULL AND deleted_at IS NULL`,
          [rencana.tutupRiwayat, sekarang(), lama.uuid, f],
          k,
        );
      if (rencana.riwayatBaru) await sisipkanRiwayat(k, req, lama.uuid, rencana.riwayatBaru);
      const baru = await ubah("hr_kepegawaian", lama.uuid, f, rencana.ubah, k);
      await audit(k, req, "ubah", "hr_kepegawaian", lama.uuid, {
        ...ringkasanUbah(lama, rencana.ubah),
        ...(rencana.riwayatBaru ? { tanggal_berlaku: rencana.riwayatBaru.tanggal_mulai, nomor_sk: rencana.riwayatBaru.nomor_sk } : {}),
      });
      return baru;
    });
    kirim(res, hasil, "Data kepegawaian berhasil diperbarui");
  }),
);

rute.delete(
  "/:uuid",
  izin("DELETE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const lama = await ambilKepegawaian(req.params.uuid, f, k, true);
      const n = sekarang();
      await ubah("hr_kepegawaian", lama.uuid, f, { deleted_at: n }, k);
      // Tautan akun dilepas agar username dapat ditautkan lagi; riwayat & pendidikan tetap tersimpan (ikut tersembunyi).
      await query(`UPDATE hr_akun_pegawai SET deleted_at = $1, updated_at = $1 WHERE kepegawaian_uuid = $2 AND faskes_uuid = $3 AND deleted_at IS NULL`, [n, lama.uuid, f], k);
      await audit(k, req, "hapus", "hr_kepegawaian", lama.uuid, { pegawai_uuid: lama.pegawai_uuid });
    });
    kirim(res, { uuid: req.params.uuid }, "Data kepegawaian berhasil dihapus");
  }),
);

// ── Pendidikan
const ambilPendidikan = async (kepegawaianUuid, uuid, f, k) => {
  const row = await satu(
    `SELECT * FROM hr_pendidikan WHERE uuid = $1 AND kepegawaian_uuid = $2 AND faskes_uuid = $3 AND deleted_at IS NULL FOR UPDATE`,
    [String(uuid ?? ""), kepegawaianUuid, f],
    k,
  );
  if (!row) throw tidakDitemukan("Riwayat pendidikan");
  return row;
};

rute.post(
  "/:uuid/pendidikan",
  izin("UPDATE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = validasiPendidikan(req.body ?? {});
    const hasil = await transaksi(async (k) => {
      const peg = await ambilKepegawaian(req.params.uuid, f, k);
      const row = await sisipkan("hr_pendidikan", { faskes_uuid: f, kepegawaian_uuid: peg.uuid, ...b, dicatat_oleh: req.author.username ?? null }, k);
      await audit(k, req, "buat", "hr_pendidikan", row.uuid, { kepegawaian_uuid: peg.uuid, jenjang: b.jenjang, institusi: b.institusi, tahun_lulus: b.tahun_lulus });
      return row;
    });
    kirim(res, hasil, "Riwayat pendidikan berhasil ditambahkan");
  }),
);

rute.put(
  "/:uuid/pendidikan/:pendidikanUuid",
  izin("UPDATE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = validasiPendidikan(req.body ?? {}, { parsial: true });
    const hasil = await transaksi(async (k) => {
      const peg = await ambilKepegawaian(req.params.uuid, f, k);
      const lama = await ambilPendidikan(peg.uuid, req.params.pendidikanUuid, f, k);
      const perubahan = Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined));
      const baru = await ubah("hr_pendidikan", lama.uuid, f, perubahan, k);
      await audit(k, req, "ubah", "hr_pendidikan", lama.uuid, ringkasanUbah(lama, perubahan));
      return baru;
    });
    kirim(res, hasil, "Riwayat pendidikan berhasil diperbarui");
  }),
);

rute.delete(
  "/:uuid/pendidikan/:pendidikanUuid",
  izin("UPDATE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const peg = await ambilKepegawaian(req.params.uuid, f, k);
      const lama = await ambilPendidikan(peg.uuid, req.params.pendidikanUuid, f, k);
      await ubah("hr_pendidikan", lama.uuid, f, { deleted_at: sekarang() }, k);
      await audit(k, req, "hapus", "hr_pendidikan", lama.uuid, { jenjang: lama.jenjang, institusi: lama.institusi });
    });
    kirim(res, { uuid: req.params.pendidikanUuid }, "Riwayat pendidikan berhasil dihapus");
  }),
);

// ── Tautan akun login (satu akun per catatan kepegawaian; satu akun hanya untuk satu pegawai)
rute.post(
  "/:uuid/akun",
  izin("TAUTKAN AKUN"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const username = teksWajib(req.body?.username, "username", 120);
    const hasil = await transaksi(async (k) => {
      const peg = await ambilKepegawaian(req.params.uuid, f, k, true);
      const akun = await satu(`SELECT username FROM users WHERE lower(username) = lower($1) AND faskes_uuid = $2 AND deleted_at IS NULL`, [username, f], k);
      if (!akun) throw permintaanSalah("Akun pengguna tidak ditemukan di faskes ini");
      if (await satu(`SELECT 1 FROM hr_akun_pegawai WHERE kepegawaian_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [peg.uuid, f], k))
        throw konflik("Pegawai ini sudah memiliki akun tertaut; lepas tautan lama terlebih dahulu");
      const row = await sisipkan("hr_akun_pegawai", { faskes_uuid: f, kepegawaian_uuid: peg.uuid, username: akun.username, ditautkan_oleh: req.author.username ?? null }, k);
      await audit(k, req, "buat", "hr_akun_pegawai", row.uuid, { kepegawaian_uuid: peg.uuid, username: akun.username });
      return row;
    });
    kirim(res, hasil, "Akun berhasil ditautkan");
  }, "Akun sudah ditautkan ke pegawai lain"),
);

rute.delete(
  "/:uuid/akun/:akunUuid",
  izin("TAUTKAN AKUN"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const peg = await ambilKepegawaian(req.params.uuid, f, k);
      const akun = await satu(
        `SELECT * FROM hr_akun_pegawai WHERE uuid = $1 AND kepegawaian_uuid = $2 AND faskes_uuid = $3 AND deleted_at IS NULL FOR UPDATE`,
        [String(req.params.akunUuid), peg.uuid, f],
        k,
      );
      if (!akun) throw tidakDitemukan("Tautan akun");
      await ubah("hr_akun_pegawai", akun.uuid, f, { deleted_at: sekarang() }, k);
      await audit(k, req, "hapus", "hr_akun_pegawai", akun.uuid, { kepegawaian_uuid: peg.uuid, username: akun.username });
    });
    kirim(res, { uuid: req.params.akunUuid }, "Tautan akun berhasil dilepas");
  }),
);

export default rute;
