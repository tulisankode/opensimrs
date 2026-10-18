import express from "express";
import config from "../config.js";
import { query, satu, ubah, sekarang, transaksi } from "../db.js";
import { kirim, halaman, denganHalaman, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { izinMutu } from "../umum/izin.js";
import {
  JENIS_KREDENSIAL,
  MASA_BERLAKU,
  STATUS_KREDENSIAL,
  TIPE_BERKAS_KREDENSIAL,
  awalHariWib,
  cekPilihan,
  epochOpsional,
  infoBerkas,
  konflik,
  saringMasaBerlaku,
  sisaHari,
  statusMasaBerlaku,
  teks,
  teksWajib,
  validasiBerkasMutu,
  wajibPilihan,
} from "./bersama.js";
import { NAMA_PEGAWAI, ambilMilik, catatAudit, cekPegawaiAktif, cekPractitioner, sisipkanBerkas, tanganiMutu, tanpaBerkas } from "./dasar.js";

// Kredensial staf (KF-8/KF-9): STR, SIP, sertifikat pelatihan, RKK, SPK tertaut pegawai (dan opsional practitioner)
// aktif Datamaster — tidak membuat data induk baru. Masa berlaku dihitung saat baca dari tanggal_berakhir (WIB):
// peringatan 90 & 30 hari, kedaluwarsa setelah hari terakhir berlaku lewat.
//   GET  /kredensial?pegawai_uuid=&jenis=&status=&masa_berlaku=&cari=     daftar + masa_berlaku + sisa_hari
//   GET  /kredensial/pegawai/:pegawai_uuid                                kredensial satu pegawai
//   GET  /kredensial/:uuid                                                detail + jejak audit
//   POST /kredensial                                                      catat (berkas opsional, PDF/JPG/PNG)
//   PUT  /kredensial/:uuid                                                ubah data (bukan untuk yang dicabut)
//   POST /kredensial/:uuid/berkas                                         ganti berkas
//   GET  /kredensial/:uuid/berkas                                         unduh berkas (base64)
//   PATCH /kredensial/:uuid/cabut                                         cabut (alasan wajib)
//   DELETE /kredensial/:uuid                                              hapus lunak (koreksi salah input)
const rute = express.Router();

const KOLOM = `k.uuid, k.faskes_uuid, k.pegawai_uuid, k.practitioner_uuid, k.jenis, k.nomor, k.uraian, k.tanggal_mulai, k.tanggal_berakhir,
  k.status, k.alasan_cabut, k.dicabut_oleh, k.dicabut_pada, k.berkas_info, k.dicatat_oleh, k.created_at, k.updated_at`;
const tanggal = (v, nama) => {
  const n = epochOpsional(v, nama);
  return n === undefined || n === null ? n : awalHariWib(n);
};
// Kolom BIGINT dibaca pg sebagai string → bandingkan sebagai angka.
const cekRentang = (mulai, akhir) => {
  if (mulai && akhir && Number(akhir) < Number(mulai)) throw permintaanSalah("tanggal_berakhir tidak boleh sebelum tanggal_mulai");
};
const berkasKredensial = (b) => validasiBerkasMutu(b, config.maxUploadMutuMb, TIPE_BERKAS_KREDENSIAL);
const denganMasaBerlaku = (r) => ({ ...r, masa_berlaku: statusMasaBerlaku(r.tanggal_berakhir), sisa_hari: sisaHari(r.tanggal_berakhir) });

const daftar = async (f, q, pg) => {
  const syarat = ["k.faskes_uuid = $1", "k.deleted_at IS NULL"];
  const p = [f];
  const jenis = cekPilihan(q.jenis || undefined, JENIS_KREDENSIAL, "jenis");
  const status = cekPilihan(q.status || undefined, STATUS_KREDENSIAL, "status");
  const masa = cekPilihan(q.masa_berlaku || undefined, MASA_BERLAKU, "masa_berlaku");
  const cari = teks(q.cari, "cari", 100);
  if (q.pegawai_uuid) syarat.push(`k.pegawai_uuid = $${p.push(String(q.pegawai_uuid))}`);
  if (jenis) syarat.push(`k.jenis = $${p.push(jenis)}`);
  if (status) syarat.push(`k.status = $${p.push(status)}`);
  if (masa) {
    const s = saringMasaBerlaku(masa, "k.tanggal_berakhir", p.length + 1);
    syarat.push(s.sql);
    p.push(...s.params);
  }
  if (cari) syarat.push(`(k.nomor ILIKE $${p.push(`%${cari}%`)} OR pg.name ILIKE $${p.length} OR k.uraian ILIKE $${p.length})`);
  const where = syarat.join(" AND ");
  const dari = `FROM mutu_kredensial k LEFT JOIN pegawai pg ON pg.uuid = k.pegawai_uuid AND pg.faskes_uuid = k.faskes_uuid`;
  const total = (await satu(`SELECT COUNT(*) n ${dari} WHERE ${where}`, p)).n;
  const rows = await query(
    `SELECT ${KOLOM}, ${NAMA_PEGAWAI("pg")} AS nama_pegawai ${dari} WHERE ${where}
      ORDER BY (k.status = 'aktif') DESC, k.tanggal_berakhir NULLS LAST, nama_pegawai LIMIT $${p.length + 1} OFFSET $${p.length + 2}`,
    [...p, pg.limit, pg.offset],
  );
  return denganHalaman(rows.map(denganMasaBerlaku), total, pg);
};

rute.get(
  "/",
  izinMutu("Kredensial Staf", "READ"),
  tanganiMutu(async (req, res) => kirim(res, await daftar(req.author.faskesUuid, req.query, halaman(req.query)))),
);

rute.get(
  "/pegawai/:pegawai_uuid",
  izinMutu("Kredensial Staf", "READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const pegawai = await satu(`SELECT p.uuid, ${NAMA_PEGAWAI("p")} AS nama, p.status FROM pegawai p WHERE p.uuid = $1 AND p.faskes_uuid = $2 AND p.deleted_at IS NULL`, [
      String(req.params.pegawai_uuid),
      f,
    ]);
    if (!pegawai) throw tidakDitemukan("Pegawai");
    const hasil = await daftar(f, { pegawai_uuid: pegawai.uuid }, { limit: 500, page: 1, offset: 0 });
    kirim(res, { pegawai, kredensial: hasil.data });
  }),
);

rute.get(
  "/:uuid",
  izinMutu("Kredensial Staf", "READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const row = await satu(
      `SELECT ${KOLOM}, ${NAMA_PEGAWAI("pg")} AS nama_pegawai FROM mutu_kredensial k LEFT JOIN pegawai pg ON pg.uuid = k.pegawai_uuid AND pg.faskes_uuid = k.faskes_uuid
        WHERE k.uuid = $1 AND k.faskes_uuid = $2 AND k.deleted_at IS NULL`,
      [String(req.params.uuid), f],
    );
    if (!row) throw tidakDitemukan("Kredensial");
    const audit = await query(
      `SELECT uuid, aksi, data_sebelum, data_sesudah, aktor, created_at FROM mutu_audit
        WHERE faskes_uuid = $1 AND entitas = 'kredensial' AND entitas_uuid = $2 ORDER BY created_at DESC, uuid DESC LIMIT 100`,
      [f, row.uuid],
    );
    kirim(res, { ...denganMasaBerlaku(row), audit });
  }),
);

rute.post(
  "/",
  izinMutu("Kredensial Staf", "CREATE"),
  tanganiMutu(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const jenis = wajibPilihan(b.jenis, JENIS_KREDENSIAL, "jenis");
    const mulai = tanggal(b.tanggal_mulai, "tanggal_mulai") ?? null;
    const akhir = tanggal(b.tanggal_berakhir, "tanggal_berakhir") ?? null;
    cekRentang(mulai, akhir);
    const berkas = b.berkas === undefined || b.berkas === null ? null : berkasKredensial(b.berkas);
    const hasil = await transaksi(async (k) => {
      const pegawai = await cekPegawaiAktif(b.pegawai_uuid, f, k);
      const practitioner = (await cekPractitioner(b.practitioner_uuid, pegawai.uuid, f, k)) ?? null;
      const row = await sisipkanBerkas(
        "mutu_kredensial",
        {
          faskes_uuid: f,
          pegawai_uuid: pegawai.uuid,
          practitioner_uuid: practitioner,
          jenis,
          nomor: teks(b.nomor, "nomor", 100) ?? null,
          uraian: teks(b.uraian, "uraian", 5000) ?? null,
          tanggal_mulai: mulai,
          tanggal_berakhir: akhir,
          status: "aktif",
          berkas: berkas?.data ?? null,
          berkas_info: berkas ? infoBerkas(berkas) : null,
          dicatat_oleh: req.author.username ?? null,
        },
        k,
      );
      await catatAudit(k, req, "kredensial", row.uuid, "buat", null, row);
      return denganMasaBerlaku({ ...tanpaBerkas(row), nama_pegawai: pegawai.nama });
    });
    kirim(res, hasil, "Kredensial staf berhasil dicatat");
  }),
);

rute.put(
  "/:uuid",
  izinMutu("Kredensial Staf", "UPDATE"),
  tanganiMutu(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const perubahan = {
      jenis: b.jenis === undefined ? undefined : wajibPilihan(b.jenis, JENIS_KREDENSIAL, "jenis"),
      nomor: teks(b.nomor, "nomor", 100),
      uraian: teks(b.uraian, "uraian", 5000),
      tanggal_mulai: tanggal(b.tanggal_mulai, "tanggal_mulai"),
      tanggal_berakhir: tanggal(b.tanggal_berakhir, "tanggal_berakhir"),
    };
    if (b.pegawai_uuid !== undefined) throw permintaanSalah("pegawai_uuid tidak dapat diubah; hapus dan catat ulang bila salah pegawai");
    const hasil = await transaksi(async (k) => {
      const lama = await ambilMilik("mutu_kredensial", req.params.uuid, f, k, { nama: "Kredensial", kunci: true });
      if (lama.status === "dicabut") throw konflik("Kredensial yang sudah dicabut tidak dapat diubah");
      perubahan.practitioner_uuid = await cekPractitioner(b.practitioner_uuid, lama.pegawai_uuid, f, k);
      cekRentang(
        perubahan.tanggal_mulai === undefined ? lama.tanggal_mulai : perubahan.tanggal_mulai,
        perubahan.tanggal_berakhir === undefined ? lama.tanggal_berakhir : perubahan.tanggal_berakhir,
      );
      const baru = await ubah("mutu_kredensial", lama.uuid, f, perubahan, k);
      await catatAudit(k, req, "kredensial", lama.uuid, "ubah", lama, baru);
      return denganMasaBerlaku(tanpaBerkas(baru));
    });
    kirim(res, hasil, "Kredensial staf berhasil diperbarui");
  }),
);

rute.post(
  "/:uuid/berkas",
  izinMutu("Kredensial Staf", "UPDATE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const berkas = berkasKredensial(req.body?.berkas ?? req.body);
    const hasil = await transaksi(async (k) => {
      const lama = await ambilMilik("mutu_kredensial", req.params.uuid, f, k, { nama: "Kredensial", kunci: true, kolom: KOLOM.replace(/\bk\./g, "") });
      if (lama.status === "dicabut") throw konflik("Kredensial yang sudah dicabut tidak dapat diubah");
      const baru = await satu(
        `UPDATE mutu_kredensial SET berkas = $1, berkas_info = $2::jsonb, updated_at = $3 WHERE uuid = $4 AND faskes_uuid = $5 RETURNING ${KOLOM.replace(/\bk\./g, "")}`,
        [berkas.data, JSON.stringify(infoBerkas(berkas)), sekarang(), lama.uuid, f],
        k,
      );
      await catatAudit(k, req, "kredensial", lama.uuid, "ganti_berkas", { berkas_info: lama.berkas_info }, { berkas_info: baru.berkas_info });
      return denganMasaBerlaku(baru);
    });
    kirim(res, hasil, "Berkas kredensial berhasil diunggah");
  }),
);

rute.get(
  "/:uuid/berkas",
  izinMutu("Kredensial Staf", "READ"),
  tanganiMutu(async (req, res) => {
    const row = await satu(`SELECT berkas, berkas_info FROM mutu_kredensial WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [String(req.params.uuid), req.author.faskesUuid]);
    if (!row?.berkas) throw tidakDitemukan("Berkas kredensial");
    kirim(res, { ...row.berkas_info, data_base64: row.berkas.toString("base64") });
  }),
);

rute.patch(
  "/:uuid/cabut",
  izinMutu("Kredensial Staf", "CABUT"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const alasan = teksWajib(req.body?.alasan, "alasan", 2000);
    const hasil = await transaksi(async (k) => {
      const lama = await ambilMilik("mutu_kredensial", req.params.uuid, f, k, { nama: "Kredensial", kunci: true });
      if (lama.status === "dicabut") throw konflik("Kredensial sudah dicabut");
      const baru = await ubah("mutu_kredensial", lama.uuid, f, { status: "dicabut", alasan_cabut: alasan, dicabut_oleh: req.author.username ?? null, dicabut_pada: sekarang() }, k);
      await catatAudit(k, req, "kredensial", lama.uuid, "cabut", { status: lama.status }, { status: "dicabut", alasan_cabut: alasan });
      return denganMasaBerlaku(tanpaBerkas(baru));
    });
    kirim(res, hasil, "Kredensial berhasil dicabut");
  }),
);

rute.delete(
  "/:uuid",
  izinMutu("Kredensial Staf", "DELETE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const lama = await ambilMilik("mutu_kredensial", req.params.uuid, f, k, { nama: "Kredensial", kunci: true });
      await ubah("mutu_kredensial", lama.uuid, f, { deleted_at: sekarang() }, k);
      await catatAudit(k, req, "kredensial", lama.uuid, "hapus", lama, null);
    });
    kirim(res, { uuid: req.params.uuid }, "Kredensial berhasil dihapus");
  }),
);

export default rute;
