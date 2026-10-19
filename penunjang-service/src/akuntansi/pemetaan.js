import express from "express";
import { query, satu, sisipkan, sekarang, transaksi } from "../db.js";
import { kirim, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { wajibIzin } from "../umum/izin.js";
import { awalHariWib, konflik, pilihAturan, teks, teksWajib } from "./bersama.js";
import { JENIS_EVENT, komponenSah } from "./event.js";
import { audit, tanganiAkuntansi } from "./dasar.js";

// Aturan pemetaan event → akun (KF-2/KF-3). Satu aturan = (jenis_event, komponen) → akun, berlaku mulai tanggal tertentu.
// Mengubah akun untuk tanggal berlaku baru MENAMBAH baris (riwayat tidak ditimpa), sehingga jurnal lama tetap dapat
// dijelaskan dengan aturan yang berlaku saat transaksi. Aturan pada tanggal berlaku yang sama diganti (dengan audit).
//   GET  /pemetaan                 jenis event + komponen + aturan berlaku hari ini + riwayat
//   POST /pemetaan                 { jenis_event, komponen, akun_uuid, berlaku_mulai?, keterangan? }
//   POST /pemetaan/:uuid/nonaktif  nonaktifkan satu aturan (event yang membutuhkannya akan ditahan)
const rute = express.Router();
const izin = (aksi) => wajibIzin("Akuntansi & Remunerasi", "Pemetaan Akun", aksi);

rute.get(
  "/",
  izin("READ"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const aturan = await query(
      `SELECT p.*, a.kode AS kode_akun, a.nama AS nama_akun, a.aktif AS akun_aktif, a.jenis AS jenis_akun
         FROM akuntansi_pemetaan p JOIN akuntansi_akun a ON a.uuid = p.akun_uuid
        WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL ORDER BY p.jenis_event, p.komponen, p.berlaku_mulai DESC`,
      [f],
    );
    const hariIni = awalHariWib(sekarang());
    const jenis = Object.entries(JENIS_EVENT).map(([kode, def]) => {
      const milik = aturan.filter((a) => a.jenis_event === kode);
      const komponen = [...new Set([...Object.keys(def.komponen), ...milik.map((a) => a.komponen)])].sort();
      return {
        kode,
        nama: def.nama,
        sumber: def.sumber,
        tersedia: def.tersedia,
        alasan: def.alasan ?? null,
        komponen_dasar: def.komponen,
        komponen: komponen.map((c) => {
          const riwayat = milik.filter((a) => a.komponen === c);
          return { komponen: c, berlaku: pilihAturan(riwayat, c, hariIni), riwayat };
        }),
      };
    });
    kirim(res, jenis);
  }),
);

rute.post(
  "/",
  izin("UPDATE"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const jenis = teksWajib(b.jenis_event, "jenis_event", 40);
    if (!JENIS_EVENT[jenis]) throw permintaanSalah(`jenis_event harus salah satu: ${Object.keys(JENIS_EVENT).join(", ")}`);
    const komponen = teksWajib(b.komponen, "komponen", 80);
    if (!komponenSah(jenis, komponen))
      throw permintaanSalah(`komponen harus salah satu dari ${Object.keys(JENIS_EVENT[jenis].komponen).join(", ") || "(tidak ada)"}, opsional dengan akhiran ":KODE"`);
    const akunUuid = teksWajib(b.akun_uuid, "akun_uuid", 255);
    const berlaku = b.berlaku_mulai === undefined || b.berlaku_mulai === null || b.berlaku_mulai === "" ? awalHariWib(sekarang()) : awalHariWib(Number(b.berlaku_mulai));
    if (!Number.isFinite(berlaku) || berlaku <= 0) throw permintaanSalah("berlaku_mulai harus berupa epoch detik");
    const keterangan = teks(b.keterangan, "keterangan", 500) ?? null;
    const hasil = await transaksi(async (k) => {
      const akun = await satu(`SELECT uuid, kode, nama, jenis, aktif FROM akuntansi_akun WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [akunUuid, f], k);
      if (!akun) throw permintaanSalah("Akun tidak ditemukan di faskes ini");
      if (akun.jenis !== "rinci" || !akun.aktif) throw permintaanSalah("Pemetaan harus ke akun rinci yang aktif");
      const sama = await satu(
        `SELECT * FROM akuntansi_pemetaan WHERE faskes_uuid = $1 AND jenis_event = $2 AND komponen = $3 AND berlaku_mulai = $4 AND deleted_at IS NULL FOR UPDATE`,
        [f, jenis, komponen, berlaku],
        k,
      );
      let row;
      if (sama) {
        row = await satu(
          `UPDATE akuntansi_pemetaan SET akun_uuid = $2, aktif = true, keterangan = $3, updated_at = $4 WHERE uuid = $1 RETURNING *`,
          [sama.uuid, akun.uuid, keterangan, sekarang()],
          k,
        );
      } else {
        row = await sisipkan("akuntansi_pemetaan", { faskes_uuid: f, jenis_event: jenis, komponen, akun_uuid: akun.uuid, berlaku_mulai: berlaku, aktif: true, keterangan, dibuat_oleh: req.author.username ?? null }, k);
      }
      await audit(k, req, sama ? "ubah" : "buat", "akuntansi_pemetaan", row.uuid, { jenis_event: jenis, komponen, akun: `${akun.kode} ${akun.nama}`, berlaku_mulai: berlaku, akun_sebelumnya: sama?.akun_uuid ?? null });
      return row;
    });
    kirim(res, hasil, "Pemetaan disimpan");
  }),
);

rute.post(
  "/:uuid/nonaktif",
  izin("UPDATE"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const p = await satu(`SELECT * FROM akuntansi_pemetaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, f], k);
      if (!p) throw tidakDitemukan("Pemetaan");
      if (!p.aktif) throw konflik("Pemetaan sudah nonaktif");
      const row = await satu(`UPDATE akuntansi_pemetaan SET aktif = false, updated_at = $2 WHERE uuid = $1 RETURNING *`, [p.uuid, sekarang()], k);
      await audit(k, req, "ubah", "akuntansi_pemetaan", p.uuid, { jenis_event: p.jenis_event, komponen: p.komponen, aktif: [true, false] });
      return row;
    });
    kirim(res, hasil, "Pemetaan dinonaktifkan");
  }),
);

export default rute;
