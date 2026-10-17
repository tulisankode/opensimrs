import express from "express";
import { query, satu, sisipkan, ubah } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { izinBdrs, pastikanIzin } from "../umum/izin.js";
import { ambilPengaturan } from "./pengaturan.js";
import { catatAuditBdrs, cekPilihan, daftarNilai, ramah, segarkanKedaluwarsa, teks, GOLONGAN_ABO, RHESUS, STATUS_IMLTD, STATUS_STOK, SUMBER_STOK } from "./bersama.js";

// Stok kantong darah: satu baris per kantong. Penerimaan manual dari UTD (KF-10/KF-12 IMLTD), ringkasan per
// golongan/komponen dengan peringatan kedaluwarsa (KF-11), serta pengembalian/pemusnahan beralasan tanpa menghapus
// riwayat (KF-13). Status kedaluwarsa disegarkan (KF-10) sebelum daftar/detail dihitung — lihat bersama.js.
const rute = express.Router();
const TABEL = "bdrs_stok";
const PILIH = `
  s.uuid, s.no_kantong, s.komponen_uuid, k.kode AS komponen_kode, k.nama AS komponen_nama,
  s.golongan_abo, s.rhesus, s.volume_ml, s.tanggal_produksi, s.tanggal_kedaluwarsa, s.lokasi_penyimpanan,
  s.sumber, s.utd_referensi_uuid, s.status, s.status_imltd, s.alasan_keluar, s.diterima_oleh, s.created_at, s.updated_at`;
const JOIN = `LEFT JOIN bdrs_komponen_darah k ON k.uuid = s.komponen_uuid`;

const ambil = (uuid, faskes) => satu(`SELECT ${PILIH} FROM ${TABEL} s ${JOIN} WHERE s.uuid = $1 AND s.faskes_uuid = $2 AND s.deleted_at IS NULL`, [uuid, faskes]);

rute.get(
  "/",
  tangani(async (req, res) => {
    await segarkanKedaluwarsa(req.author.faskesUuid);
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "s.faskes_uuid = $1 AND s.deleted_at IS NULL";
    for (const [kol, nilai] of [["s.komponen_uuid", req.query.komponen_uuid], ["s.lokasi_penyimpanan", req.query.lokasi_uuid]]) {
      if (!nilai) continue;
      p.push(nilai);
      w += ` AND ${kol} = $${p.length}`;
    }
    for (const [kol, q] of [["s.golongan_abo", req.query.golongan_abo], ["s.rhesus", req.query.rhesus], ["s.status", req.query.status]]) {
      const v = daftarNilai(q);
      if (!v.length) continue;
      p.push(v);
      w += ` AND ${kol} = ANY($${p.length})`;
    }
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND s.no_kantong ILIKE $${p.length}`;
    }
    if (req.query.kedaluwarsa_dalam_hari) {
      p.push(Number(req.query.kedaluwarsa_dalam_hari) || 0);
      w += ` AND s.tanggal_kedaluwarsa <= EXTRACT(EPOCH FROM (now() + ($${p.length} || ' days')::interval))::bigint`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM ${TABEL} s WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${PILIH} FROM ${TABEL} s ${JOIN} WHERE ${w}
        ORDER BY (s.status = 'tersedia') DESC, s.tanggal_kedaluwarsa ASC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    const pengaturan = await ambilPengaturan(req.author.faskesUuid);
    const batasHari = pengaturan.ambang_kedaluwarsa_hari;
    const sekarangEpoch = Math.floor(Date.now() / 1000);
    const batasEpoch = sekarangEpoch + batasHari * 86400;
    const tandai = (r) => ({
      ...r,
      kedaluwarsa: r.tanggal_kedaluwarsa < sekarangEpoch,
      peringatan_kedaluwarsa: r.status === "tersedia" && r.tanggal_kedaluwarsa >= sekarangEpoch && r.tanggal_kedaluwarsa <= batasEpoch,
    });
    const ringkasan = await query(
      `SELECT s.komponen_uuid, k.nama AS komponen_nama, s.golongan_abo, s.rhesus, COUNT(*)::int AS jumlah,
              MIN(s.tanggal_kedaluwarsa) AS kedaluwarsa_terdekat
         FROM ${TABEL} s ${JOIN} WHERE s.faskes_uuid = $1 AND s.deleted_at IS NULL AND s.status = 'tersedia'
        GROUP BY s.komponen_uuid, k.nama, s.golongan_abo, s.rhesus ORDER BY k.nama, s.golongan_abo, s.rhesus`,
      [req.author.faskesUuid],
    );
    kirim(res, { ...denganHalaman(rows.map(tandai), total, pg), ambang_kedaluwarsa_hari: batasHari, ringkasan });
  }),
);

rute.get("/:uuid", tangani(async (req, res) => {
  await segarkanKedaluwarsa(req.author.faskesUuid);
  const s = await ambil(req.params.uuid, req.author.faskesUuid);
  if (!s) throw tidakDitemukan("Kantong darah");
  kirim(res, s);
}));

rute.post(
  "/penerimaan",
  izinBdrs("Stok & Penerimaan", "TERIMA KANTONG"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    wajib(b, ["no_kantong", "komponen_uuid", "golongan_abo", "rhesus", "tanggal_kedaluwarsa"]);
    const komponen = await satu(`SELECT uuid FROM bdrs_komponen_darah WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status`, [b.komponen_uuid, faskes]);
    if (!komponen) throw permintaanSalah("Komponen darah tidak ditemukan atau tidak aktif");
    const produksi = Number(b.tanggal_produksi) || Math.floor(Date.now() / 1000);
    const kedaluwarsa = Number(b.tanggal_kedaluwarsa);
    if (!Number.isFinite(kedaluwarsa)) throw permintaanSalah("tanggal_kedaluwarsa tidak valid");
    if (kedaluwarsa <= produksi) throw permintaanSalah("tanggal_kedaluwarsa harus setelah tanggal_produksi");
    if (kedaluwarsa <= Math.floor(Date.now() / 1000)) throw new Galat(409, "Kantong sudah kedaluwarsa, tidak dapat diterima ke stok");
    const sumber = cekPilihan(b.sumber || "utd_manual", SUMBER_STOK, "sumber");
    const volume = b.volume_ml === undefined || b.volume_ml === null || b.volume_ml === "" ? null : Number(b.volume_ml);
    if (volume !== null && (!Number.isFinite(volume) || volume <= 0)) throw permintaanSalah("volume_ml tidak valid");
    const noKantong = String(b.no_kantong).trim();
    const statusImltd = cekPilihan(b.status_imltd || "belum_diperiksa", STATUS_IMLTD, "status_imltd");

    // Kantong IMLTD reaktif ditolak dari stok (tidak disimpan) & penolakannya dicatat (KF-12/F3).
    if (statusImltd === "reaktif") {
      await catatAuditBdrs(faskes, "tolak_imltd_reaktif", {
        pengguna: req.author.username ?? null,
        data: { no_kantong: noKantong, komponen_uuid: b.komponen_uuid, golongan_abo: b.golongan_abo, rhesus: b.rhesus },
      });
      throw new Galat(409, `Kantong ${noKantong} berstatus IMLTD reaktif, tidak dapat diterima sebagai stok`);
    }

    const kantong = await sisipkan(
      TABEL,
      {
        faskes_uuid: faskes,
        no_kantong: noKantong,
        komponen_uuid: b.komponen_uuid,
        golongan_abo: cekPilihan(b.golongan_abo, GOLONGAN_ABO, "golongan_abo"),
        rhesus: cekPilihan(b.rhesus, RHESUS, "rhesus"),
        volume_ml: volume,
        tanggal_produksi: produksi,
        tanggal_kedaluwarsa: kedaluwarsa,
        lokasi_penyimpanan: teks(b.lokasi_penyimpanan),
        sumber,
        utd_referensi_uuid: teks(b.utd_referensi_uuid),
        status: "tersedia",
        status_imltd: statusImltd,
        diterima_oleh: req.author.username ?? null,
      },
    ).catch((e) => ramah(e, `No. kantong ${b.no_kantong} sudah terdaftar`));
    kirim(res, await ambil(kantong.uuid, faskes), `Kantong ${kantong.no_kantong} berhasil diterima`);
  }),
);

// Perubahan status IMLTD setelah penerimaan (KF-12/KT-12/KT-13): hanya petugas berizin TERIMA KANTONG, tercatat di audit.
rute.patch(
  "/:uuid/imltd",
  izinBdrs("Stok & Penerimaan", "TERIMA KANTONG"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const statusBaru = cekPilihan(req.body?.status_imltd, STATUS_IMLTD, "status_imltd");
    if (!statusBaru) throw permintaanSalah("status_imltd wajib diisi");
    const s = await satu(`SELECT * FROM ${TABEL} WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, faskes]);
    if (!s) throw tidakDitemukan("Kantong darah");
    const hasil = await ubah(TABEL, s.uuid, faskes, { status_imltd: statusBaru });
    await catatAuditBdrs(faskes, "ubah_imltd", {
      stokUuid: s.uuid,
      pengguna: req.author.username ?? null,
      data: { no_kantong: s.no_kantong, status_lama: s.status_imltd, status_baru: statusBaru },
    });
    kirim(res, await ambil(hasil.uuid, faskes), `Status IMLTD kantong ${s.no_kantong} berhasil diperbarui`);
  }),
);

// Pengembalian (ke UTD) atau pemusnahan: hanya kantong yang belum diserahkan/dialokasikan untuk transaksi aktif.
rute.post(
  "/:uuid/pengeluaran",
  tangani(async (req, res) => {
    const aksi = String(req.body?.aksi ?? "");
    if (!["kembalikan", "musnahkan"].includes(aksi)) throw permintaanSalah("aksi harus kembalikan atau musnahkan");
    // Izin baru diperiksa setelah `aksi` diketahui dari body (KEMBALIKAN / MUSNAHKAN berbeda hak).
    await pastikanIzin(req, "Bank Darah RS (BDRS)", "Stok & Penerimaan", aksi === "kembalikan" ? "KEMBALIKAN" : "MUSNAHKAN");
    const alasan = String(req.body?.alasan ?? "").trim();
    if (!alasan) throw permintaanSalah("alasan wajib diisi");
    const faskes = req.author.faskesUuid;
    const s = await satu(`SELECT * FROM ${TABEL} WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, faskes]);
    if (!s) throw tidakDitemukan("Kantong darah");
    if (!["tersedia", "kedaluwarsa"].includes(s.status)) throw new Galat(409, `Kantong berstatus ${STATUS_STOK[s.status] ?? s.status}, tidak dapat diproses`);
    const statusBaru = aksi === "kembalikan" ? "dikembalikan" : "dimusnahkan";
    const hasil = await ubah(TABEL, s.uuid, faskes, { status: statusBaru, alasan_keluar: alasan });
    kirim(res, await ambil(hasil.uuid, faskes), `Kantong ${s.no_kantong} berhasil ${aksi === "kembalikan" ? "dikembalikan" : "dimusnahkan"}`);
  }),
);
export default rute;
