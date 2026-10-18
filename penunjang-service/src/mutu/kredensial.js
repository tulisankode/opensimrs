import express from "express";
import config from "../config.js";
import { query, satu, ubah, sekarang, transaksi } from "../db.js";
import { kirim, halaman, denganHalaman, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { pastikanIzin, wajibIzin } from "../umum/izin.js";
import {
  JENIS_KREDENSIAL,
  MASA_BERLAKU,
  STATUS_KREDENSIAL,
  STATUS_VERIFIKASI,
  TIPE_BERKAS_KREDENSIAL,
  awalHariWib,
  cekPilihan,
  epochOpsional,
  infoBerkas,
  konflik,
  perluVerifikasiUlang,
  saringMasaBerlaku,
  sisaHari,
  statusMasaBerlaku,
  teks,
  teksWajib,
  validasiBerkasMutu,
  wajibPilihan,
} from "./bersama.js";
import { NAMA_PEGAWAI, ambilMilik, catatAudit, cekPegawaiAktif, cekPractitioner, sisipkanBerkas, tanganiMutu, tanpaBerkas } from "./dasar.js";

// Kredensial staf (KF-8/KF-9): STR, SIP, sertifikat pelatihan/kompetensi, RKK, SPK tertaut pegawai (dan opsional
// practitioner) aktif Datamaster — tidak membuat data induk baru. Masa berlaku dihitung saat baca dari tanggal_berakhir
// (WIB): peringatan 90 & 30 hari, kedaluwarsa setelah hari terakhir berlaku lewat.
//
// SATU sumber data (tabel mutu_kredensial) untuk dua modul: router dibuat oleh buatRuteKredensial() dan dipasang di
// /mutu/kredensial (izin "Mutu & Akreditasi › Kredensial Staf") dan /hr/kredensial (izin "HR / SDM › Kredensial",
// STD-0035). Data yang dicatat dari salah satu modul langsung terlihat di modul lain; jejak audit (mutu_audit) juga satu.
//   GET  /kredensial?pegawai_uuid=&jenis=&status=&status_verifikasi=&masa_berlaku=&cari=   daftar + masa_berlaku
//   GET  /kredensial/pegawai/:pegawai_uuid                                kredensial satu pegawai
//   GET  /kredensial/:uuid                                                detail + jejak audit
//   POST /kredensial                                                      catat (berkas opsional, PDF/JPG/PNG)
//   PUT  /kredensial/:uuid                                                ubah data (bukan untuk yang dicabut)
//   POST /kredensial/:uuid/berkas                                         ganti berkas
//   GET  /kredensial/:uuid/berkas                                         unduh berkas (base64)
//   PATCH /kredensial/:uuid/verifikasi                                    terverifikasi / ditolak (+ catatan)
//   PATCH /kredensial/:uuid/cabut                                         cabut (alasan wajib)
//   DELETE /kredensial/:uuid                                              hapus lunak (koreksi salah input)
// Perubahan data inti (jenis, nomor, penerbit, tanggal, practitioner) atau penggantian berkas mengembalikan status
// verifikasi ke belum_diverifikasi agar status "terverifikasi" selalu merujuk data yang benar-benar diperiksa.

const KOLOM = `k.uuid, k.faskes_uuid, k.pegawai_uuid, k.practitioner_uuid, k.jenis, k.nomor, k.penerbit, k.uraian, k.tanggal_mulai,
  k.tanggal_berakhir, k.status, k.alasan_cabut, k.dicabut_oleh, k.dicabut_pada, k.status_verifikasi, k.catatan_verifikasi,
  k.diverifikasi_oleh, k.diverifikasi_pada, k.berkas_info, k.dicatat_oleh, k.created_at, k.updated_at`;
const KOLOM_POLOS = KOLOM.replace(/\bk\./g, "");
const BELUM_DIVERIFIKASI = { status_verifikasi: "belum_diverifikasi", catatan_verifikasi: null, diverifikasi_oleh: null, diverifikasi_pada: null };
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
  const verifikasi = cekPilihan(q.status_verifikasi || undefined, STATUS_VERIFIKASI, "status_verifikasi");
  const masa = cekPilihan(q.masa_berlaku || undefined, MASA_BERLAKU, "masa_berlaku");
  const cari = teks(q.cari, "cari", 100);
  if (q.pegawai_uuid) syarat.push(`k.pegawai_uuid = $${p.push(String(q.pegawai_uuid))}`);
  if (jenis) syarat.push(`k.jenis = $${p.push(jenis)}`);
  if (status) syarat.push(`k.status = $${p.push(status)}`);
  if (verifikasi) syarat.push(`k.status_verifikasi = $${p.push(verifikasi)}`);
  if (masa) {
    const s = saringMasaBerlaku(masa, "k.tanggal_berakhir", p.length + 1);
    syarat.push(s.sql);
    p.push(...s.params);
  }
  if (cari) syarat.push(`(k.nomor ILIKE $${p.push(`%${cari}%`)} OR pg.name ILIKE $${p.length} OR k.uraian ILIKE $${p.length} OR k.penerbit ILIKE $${p.length})`);
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

// opsi.modul/opsi.submodul: hak akses (Setting › Hak Akses) modul pemasang. opsi.aksi memetakan aksi logis
// (READ, CREATE, UPDATE, BERKAS, VERIFIKASI, CABUT, DELETE) ke nama aksi izin modul tersebut. opsi.berkasSaatCatat:
// berkas yang dikirim bersama POST juga mensyaratkan aksi BERKAS (HR / SDM memisahkan izin unggah dokumen).
export const buatRuteKredensial = ({ modul, submodul, aksi, berkasSaatCatat = false }) => {
  const rute = express.Router();
  const izin = (a) => wajibIzin(modul, submodul, aksi[a]);

  rute.get(
    "/",
    izin("READ"),
    tanganiMutu(async (req, res) => kirim(res, await daftar(req.author.faskesUuid, req.query, halaman(req.query)))),
  );

  rute.get(
    "/pegawai/:pegawai_uuid",
    izin("READ"),
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
    izin("READ"),
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
    izin("CREATE"),
    tanganiMutu(async (req, res) => {
      const b = req.body ?? {};
      const f = req.author.faskesUuid;
      const jenis = wajibPilihan(b.jenis, JENIS_KREDENSIAL, "jenis");
      const mulai = tanggal(b.tanggal_mulai, "tanggal_mulai") ?? null;
      const akhir = tanggal(b.tanggal_berakhir, "tanggal_berakhir") ?? null;
      cekRentang(mulai, akhir);
      const nomor = teks(b.nomor, "nomor", 100) ?? null;
      const penerbit = teks(b.penerbit, "penerbit", 255) ?? null;
      const uraian = teks(b.uraian, "uraian", 5000) ?? null;
      const berkas = b.berkas === undefined || b.berkas === null ? null : berkasKredensial(b.berkas);
      if (berkas && berkasSaatCatat) await pastikanIzin(req, modul, submodul, aksi.BERKAS);
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
            nomor,
            penerbit,
            uraian,
            tanggal_mulai: mulai,
            tanggal_berakhir: akhir,
            status: "aktif",
            status_verifikasi: "belum_diverifikasi",
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
    izin("UPDATE"),
    tanganiMutu(async (req, res) => {
      const b = req.body ?? {};
      const f = req.author.faskesUuid;
      const perubahan = {
        jenis: b.jenis === undefined ? undefined : wajibPilihan(b.jenis, JENIS_KREDENSIAL, "jenis"),
        nomor: teks(b.nomor, "nomor", 100),
        penerbit: teks(b.penerbit, "penerbit", 255),
        uraian: teks(b.uraian, "uraian", 5000),
        tanggal_mulai: tanggal(b.tanggal_mulai, "tanggal_mulai"),
        tanggal_berakhir: tanggal(b.tanggal_berakhir, "tanggal_berakhir"),
      };
      if (b.pegawai_uuid !== undefined) throw permintaanSalah("pegawai_uuid tidak dapat diubah; hapus dan catat ulang bila salah pegawai");
      const hasil = await transaksi(async (k) => {
        const lama = await ambilMilik("mutu_kredensial", req.params.uuid, f, k, { nama: "Kredensial", kunci: true, kolom: KOLOM_POLOS });
        if (lama.status === "dicabut") throw konflik("Kredensial yang sudah dicabut tidak dapat diubah");
        perubahan.practitioner_uuid = await cekPractitioner(b.practitioner_uuid, lama.pegawai_uuid, f, k);
        cekRentang(
          perubahan.tanggal_mulai === undefined ? lama.tanggal_mulai : perubahan.tanggal_mulai,
          perubahan.tanggal_berakhir === undefined ? lama.tanggal_berakhir : perubahan.tanggal_berakhir,
        );
        const ulang = lama.status_verifikasi !== "belum_diverifikasi" && perluVerifikasiUlang(lama, perubahan);
        const baru = await ubah("mutu_kredensial", lama.uuid, f, { ...perubahan, ...(ulang ? BELUM_DIVERIFIKASI : {}) }, k);
        await catatAudit(k, req, "kredensial", lama.uuid, "ubah", lama, tanpaBerkas(baru));
        return denganMasaBerlaku(tanpaBerkas(baru));
      });
      kirim(res, hasil, "Kredensial staf berhasil diperbarui");
    }),
  );

  rute.post(
    "/:uuid/berkas",
    izin("BERKAS"),
    tanganiMutu(async (req, res) => {
      const f = req.author.faskesUuid;
      const berkas = berkasKredensial(req.body?.berkas ?? req.body);
      const hasil = await transaksi(async (k) => {
        const lama = await ambilMilik("mutu_kredensial", req.params.uuid, f, k, { nama: "Kredensial", kunci: true, kolom: KOLOM_POLOS });
        if (lama.status === "dicabut") throw konflik("Kredensial yang sudah dicabut tidak dapat diubah");
        const baru = await satu(
          `UPDATE mutu_kredensial SET berkas = $1, berkas_info = $2::jsonb, updated_at = $3,
              status_verifikasi = 'belum_diverifikasi', catatan_verifikasi = NULL, diverifikasi_oleh = NULL, diverifikasi_pada = NULL
            WHERE uuid = $4 AND faskes_uuid = $5 RETURNING ${KOLOM_POLOS}`,
          [berkas.data, JSON.stringify(infoBerkas(berkas)), sekarang(), lama.uuid, f],
          k,
        );
        await catatAudit(
          k,
          req,
          "kredensial",
          lama.uuid,
          "ganti_berkas",
          { berkas_info: lama.berkas_info, status_verifikasi: lama.status_verifikasi },
          { berkas_info: baru.berkas_info, status_verifikasi: baru.status_verifikasi },
        );
        return denganMasaBerlaku(baru);
      });
      kirim(res, hasil, "Berkas kredensial berhasil diunggah");
    }),
  );

  rute.get(
    "/:uuid/berkas",
    izin("READ"),
    tanganiMutu(async (req, res) => {
      const row = await satu(`SELECT berkas, berkas_info FROM mutu_kredensial WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [String(req.params.uuid), req.author.faskesUuid]);
      if (!row?.berkas) throw tidakDitemukan("Berkas kredensial");
      kirim(res, { ...row.berkas_info, data_base64: row.berkas.toString("base64") });
    }),
  );

  rute.patch(
    "/:uuid/verifikasi",
    izin("VERIFIKASI"),
    tanganiMutu(async (req, res) => {
      const f = req.author.faskesUuid;
      const status = wajibPilihan(req.body?.status_verifikasi, STATUS_VERIFIKASI, "status_verifikasi");
      if (status === "belum_diverifikasi") throw permintaanSalah("status_verifikasi harus terverifikasi atau ditolak");
      const catatan = teks(req.body?.catatan_verifikasi, "catatan_verifikasi", 2000) ?? null;
      if (status === "ditolak" && !catatan) throw permintaanSalah("catatan_verifikasi wajib diisi bila kredensial ditolak");
      const hasil = await transaksi(async (k) => {
        const lama = await ambilMilik("mutu_kredensial", req.params.uuid, f, k, { nama: "Kredensial", kunci: true, kolom: KOLOM_POLOS });
        if (lama.status === "dicabut") throw konflik("Kredensial yang sudah dicabut tidak dapat diverifikasi");
        const baru = await ubah(
          "mutu_kredensial",
          lama.uuid,
          f,
          { status_verifikasi: status, catatan_verifikasi: catatan, diverifikasi_oleh: req.author.username ?? null, diverifikasi_pada: sekarang() },
          k,
        );
        await catatAudit(k, req, "kredensial", lama.uuid, "verifikasi", { status_verifikasi: lama.status_verifikasi }, { status_verifikasi: status, catatan_verifikasi: catatan });
        return denganMasaBerlaku(tanpaBerkas(baru));
      });
      kirim(res, hasil, status === "terverifikasi" ? "Kredensial berhasil diverifikasi" : "Kredensial ditandai ditolak");
    }),
  );

  rute.patch(
    "/:uuid/cabut",
    izin("CABUT"),
    tanganiMutu(async (req, res) => {
      const f = req.author.faskesUuid;
      const alasan = teksWajib(req.body?.alasan, "alasan", 2000);
      const hasil = await transaksi(async (k) => {
        const lama = await ambilMilik("mutu_kredensial", req.params.uuid, f, k, { nama: "Kredensial", kunci: true, kolom: KOLOM_POLOS });
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
    izin("DELETE"),
    tanganiMutu(async (req, res) => {
      const f = req.author.faskesUuid;
      await transaksi(async (k) => {
        const lama = await ambilMilik("mutu_kredensial", req.params.uuid, f, k, { nama: "Kredensial", kunci: true, kolom: KOLOM_POLOS });
        await ubah("mutu_kredensial", lama.uuid, f, { deleted_at: sekarang() }, k);
        await catatAudit(k, req, "kredensial", lama.uuid, "hapus", lama, null);
      });
      kirim(res, { uuid: req.params.uuid }, "Kredensial berhasil dihapus");
    }),
  );

  return rute;
};

// Pemasangan Mutu & Akreditasi (fitur mutu_dokumen_kredensial). Unggah/ganti berkas tetap memakai aksi UPDATE.
export const IZIN_KREDENSIAL_MUTU = {
  modul: "Mutu & Akreditasi",
  submodul: "Kredensial Staf",
  aksi: { READ: "READ", CREATE: "CREATE", UPDATE: "UPDATE", BERKAS: "UPDATE", VERIFIKASI: "VERIFIKASI", CABUT: "CABUT", DELETE: "DELETE" },
};
export default buatRuteKredensial(IZIN_KREDENSIAL_MUTU);
