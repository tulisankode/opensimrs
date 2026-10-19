import express from "express";
import { query, satu, sisipkan, ubah, transaksi } from "../db.js";
import { kirim, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { wajibIzin } from "../umum/izin.js";
import { ARUS_KAS, BUKU_PEMBANTU, JENIS_AKUN, KELOMPOK_AKUN, KLASIFIKASI, KLASIFIKASI_KELOMPOK, SALDO_NORMAL, awalHariWib, cekPilihan, konflik, teks, teksWajib, wajibPilihan } from "./bersama.js";
import { COA_BAWAAN, PEMETAAN_BAWAAN } from "./coa-bawaan.js";
import { audit, tanganiAkuntansi } from "./dasar.js";

// Bagan akun / COA (KF-1/KF-2) per faskes.
//   GET  /akun?aktif=&q=           daftar datar urut kode (+ jumlah baris jurnal) — frontend menyusun pohon dari induk_uuid
//   POST /akun                     tambah akun
//   PUT  /akun/:uuid               ubah (kelompok/saldo normal/jenis terkunci bila akun sudah dipakai jurnal)
//   POST /akun/pasang-bawaan       pasang COA & pemetaan bawaan RS (hanya kode/komponen yang belum ada; idempoten)
// Akun tidak dihapus (jejak jurnal harus tetap terbaca) — cukup dinonaktifkan.
const rute = express.Router();
const izin = (aksi) => wajibIzin("Akuntansi & Remunerasi", "Bagan Akun", aksi);
const pesanUnik = "Kode akun sudah dipakai di faskes ini";
const POLA_KODE = /^[0-9A-Za-z][0-9A-Za-z.\-]{0,29}$/;

const validasiAkun = (b, lama = null) => {
  const kode = lama && b.kode === undefined ? lama.kode : teksWajib(b.kode, "kode", 30);
  if (!POLA_KODE.test(kode)) throw permintaanSalah("kode hanya boleh huruf, angka, titik, dan minus (maks. 30)");
  const kelompok = lama && b.kelompok === undefined ? lama.kelompok : wajibPilihan(b.kelompok, KELOMPOK_AKUN, "kelompok");
  const klasifikasi = lama && b.klasifikasi === undefined ? lama.klasifikasi : wajibPilihan(b.klasifikasi, KLASIFIKASI, "klasifikasi");
  if (!KLASIFIKASI_KELOMPOK[kelompok].includes(klasifikasi)) throw permintaanSalah(`klasifikasi ${KLASIFIKASI[klasifikasi]} tidak sesuai kelompok ${KELOMPOK_AKUN[kelompok]}`);
  const saldoBawaan = kelompok === "aset" || kelompok === "beban" ? "debit" : "kredit";
  const data = {
    kode,
    nama: lama && b.nama === undefined ? lama.nama : teksWajib(b.nama, "nama", 255),
    kelompok,
    klasifikasi,
    saldo_normal: cekPilihan(b.saldo_normal, SALDO_NORMAL, "saldo_normal") ?? (lama?.saldo_normal && b.kelompok === undefined ? lama.saldo_normal : saldoBawaan),
    jenis: cekPilihan(b.jenis, JENIS_AKUN, "jenis") ?? lama?.jenis ?? "rinci",
    induk_uuid: b.induk_uuid === undefined ? (lama?.induk_uuid ?? null) : teks(b.induk_uuid, "induk_uuid", 255) ?? null,
    kas_setara_kas: b.kas_setara_kas === undefined ? (lama?.kas_setara_kas ?? false) : b.kas_setara_kas === true || b.kas_setara_kas === "true",
    arus_kas: b.arus_kas === undefined ? (lama?.arus_kas ?? null) : cekPilihan(b.arus_kas, ARUS_KAS, "arus_kas"),
    buku_pembantu: b.buku_pembantu === undefined ? (lama?.buku_pembantu ?? null) : cekPilihan(b.buku_pembantu, BUKU_PEMBANTU, "buku_pembantu"),
    aktif: b.aktif === undefined ? (lama?.aktif ?? true) : b.aktif === true || b.aktif === "true",
    keterangan: b.keterangan === undefined ? (lama?.keterangan ?? null) : teks(b.keterangan, "keterangan", 1000) ?? null,
  };
  if (data.kas_setara_kas && kelompok !== "aset") throw permintaanSalah("Hanya akun aset yang dapat ditandai kas & setara kas");
  if (data.buku_pembantu === "piutang" && kelompok !== "aset") throw permintaanSalah("Buku pembantu piutang hanya untuk akun aset");
  if (data.buku_pembantu === "utang" && kelompok !== "kewajiban") throw permintaanSalah("Buku pembantu utang hanya untuk akun kewajiban");
  return data;
};

// Induk harus akun induk faskes yang sama, satu kelompok, dan tidak membentuk lingkaran.
const cekInduk = async (k, f, data, uuid = null) => {
  if (!data.induk_uuid) return;
  if (data.induk_uuid === uuid) throw permintaanSalah("Akun tidak boleh menjadi induk dirinya sendiri");
  const induk = await satu(`SELECT uuid, kelompok, jenis FROM akuntansi_akun WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [data.induk_uuid, f], k);
  if (!induk) throw permintaanSalah("Akun induk tidak ditemukan di faskes ini");
  if (induk.jenis !== "induk") throw permintaanSalah("Akun induk harus berjenis induk");
  if (induk.kelompok !== data.kelompok) throw permintaanSalah("Akun induk harus satu kelompok");
  if (uuid) {
    const lingkar = await satu(
      `WITH RECURSIVE naik AS (SELECT uuid, induk_uuid FROM akuntansi_akun WHERE uuid = $1 AND faskes_uuid = $3
         UNION ALL SELECT a.uuid, a.induk_uuid FROM akuntansi_akun a JOIN naik n ON a.uuid = n.induk_uuid WHERE a.faskes_uuid = $3)
       SELECT 1 FROM naik WHERE uuid = $2 LIMIT 1`,
      [data.induk_uuid, uuid, f],
      k,
    );
    if (lingkar) throw permintaanSalah("Hierarki akun tidak boleh melingkar");
  }
};

rute.get(
  "/",
  izin("READ"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const q = teks(req.query.q, "q", 100);
    const p = [f];
    const syarat = ["a.faskes_uuid = $1", "a.deleted_at IS NULL"];
    if (req.query.aktif === "1" || req.query.aktif === "true") syarat.push("a.aktif = true");
    if (q) syarat.push(`(a.kode ILIKE $${p.push(`%${q}%`)} OR a.nama ILIKE $${p.length})`);
    const rows = await query(
      `SELECT a.*, induk.kode AS kode_induk, induk.nama AS nama_induk,
              (SELECT COUNT(*)::int FROM akuntansi_jurnal_baris b WHERE b.akun_uuid = a.uuid) AS jumlah_baris
         FROM akuntansi_akun a LEFT JOIN akuntansi_akun induk ON induk.uuid = a.induk_uuid
        WHERE ${syarat.join(" AND ")} ORDER BY a.kode`,
      p,
    );
    kirim(res, rows);
  }),
);

rute.post(
  "/",
  izin("CREATE"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const data = validasiAkun(req.body ?? {});
    const baru = await transaksi(async (k) => {
      await cekInduk(k, f, data);
      const row = await sisipkan("akuntansi_akun", { faskes_uuid: f, ...data, bawaan: false, dibuat_oleh: req.author.username ?? null }, k);
      await audit(k, req, "buat", "akuntansi_akun", row.uuid, { kode: row.kode, nama: row.nama, kelompok: row.kelompok });
      return row;
    });
    kirim(res, baru, "Akun berhasil ditambahkan");
  }, pesanUnik),
);

rute.post(
  "/pasang-bawaan",
  izin("CREATE"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      await k.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`akuntansi-coa:${f}`]);
      const ada = new Map((await query(`SELECT uuid, kode FROM akuntansi_akun WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [f], k)).map((r) => [r.kode, r.uuid]));
      let akunBaru = 0;
      for (const [kode, nama, kodeInduk, kelompok, saldo, klasifikasi, jenis, opsi = {}] of COA_BAWAAN) {
        if (ada.has(kode)) continue;
        const row = await sisipkan(
          "akuntansi_akun",
          {
            faskes_uuid: f,
            kode,
            nama,
            induk_uuid: kodeInduk ? (ada.get(kodeInduk) ?? null) : null,
            kelompok,
            saldo_normal: saldo,
            klasifikasi,
            jenis,
            kas_setara_kas: !!opsi.kas,
            arus_kas: opsi.kas ? null : (opsi.arus ?? null),
            buku_pembantu: opsi.pembantu ?? null,
            aktif: true,
            bawaan: true,
            dibuat_oleh: req.author.username ?? null,
          },
          k,
        );
        ada.set(kode, row.uuid);
        akunBaru += 1;
      }
      // Pemetaan bawaan: hanya komponen yang belum punya aturan sama sekali; berlaku sejak 1 Januari 2000 (WIB).
      const sudah = new Set((await query(`SELECT jenis_event || '|' || komponen AS k FROM akuntansi_pemetaan WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [f], k)).map((r) => r.k));
      let pemetaanBaru = 0;
      for (const [jenis, komponen, kode] of PEMETAAN_BAWAAN) {
        if (sudah.has(`${jenis}|${komponen}`) || !ada.has(kode)) continue;
        await sisipkan(
          "akuntansi_pemetaan",
          { faskes_uuid: f, jenis_event: jenis, komponen, akun_uuid: ada.get(kode), berlaku_mulai: awalHariWib(Date.UTC(2000, 0, 1, 12) / 1000), aktif: true, keterangan: "Bawaan", dibuat_oleh: req.author.username ?? null },
          k,
        );
        pemetaanBaru += 1;
      }
      await audit(k, req, "buat", "akuntansi_coa_bawaan", null, { akun_baru: akunBaru, pemetaan_baru: pemetaanBaru });
      return { akun_baru: akunBaru, pemetaan_baru: pemetaanBaru };
    });
    kirim(res, hasil, hasil.akun_baru || hasil.pemetaan_baru ? "COA & pemetaan bawaan dipasang" : "COA & pemetaan bawaan sudah lengkap");
  }),
);

rute.put(
  "/:uuid",
  izin("UPDATE"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const lama = await satu(`SELECT * FROM akuntansi_akun WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, f], k);
      if (!lama) throw tidakDitemukan("Akun");
      const data = validasiAkun(req.body ?? {}, lama);
      const dipakai = (await satu(`SELECT COUNT(*)::int AS n FROM akuntansi_jurnal_baris WHERE akun_uuid = $1`, [lama.uuid], k)).n;
      if (dipakai && (data.kelompok !== lama.kelompok || data.saldo_normal !== lama.saldo_normal || data.jenis !== lama.jenis))
        throw konflik("Akun sudah dipakai jurnal: kelompok, saldo normal, dan jenis tidak dapat diubah. Buat akun baru bila perlu.");
      if (data.jenis === "rinci" && lama.jenis === "induk" && (await satu(`SELECT 1 FROM akuntansi_akun WHERE induk_uuid = $1 AND deleted_at IS NULL LIMIT 1`, [lama.uuid], k)))
        throw konflik("Akun masih memiliki sub-akun; tidak dapat diubah menjadi akun rinci");
      if (data.kelompok !== lama.kelompok && (await satu(`SELECT 1 FROM akuntansi_akun WHERE induk_uuid = $1 AND deleted_at IS NULL LIMIT 1`, [lama.uuid], k)))
        throw konflik("Akun masih memiliki sub-akun; kelompok tidak dapat diubah");
      await cekInduk(k, f, data, lama.uuid);
      const baru = await ubah("akuntansi_akun", lama.uuid, f, data, k);
      const berubah = Object.keys(data).filter((c) => String(data[c] ?? "") !== String(lama[c] ?? ""));
      await audit(k, req, "ubah", "akuntansi_akun", lama.uuid, { kode: baru.kode, berubah, sebelum: Object.fromEntries(berubah.map((c) => [c, lama[c]])), sesudah: Object.fromEntries(berubah.map((c) => [c, baru[c]])) });
      return baru;
    });
    kirim(res, hasil, "Akun berhasil diubah");
  }, pesanUnik),
);

export default rute;
