import express from "express";
import { query, satu, sekarang, transaksi, uuidv7 } from "../db.js";
import { tangani, kirim, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { detailPeserta } from "./peserta.js";
import { konflik, KESIMPULAN, namaStasiun } from "./bersama.js";
import { izinMcu } from "../umum/izin.js";
import { statusOrderLab } from "./lab.js";

// Pemeriksaan per stasiun MCU. Data isian tiap stasiun disimpan bebas (JSON) per peserta+stasiun (upsert).
// Stasiun "kesimpulan" menutup MCU: kesimpulan fit / fit dengan catatan / unfit + saran + dokter pemeriksa.
const rute = express.Router();

// Kategori IMT (Kemenkes RI / Asia-Pasifik).
const kategoriImt = (imt) =>
  imt < 18.5 ? "Berat badan kurang" : imt < 23 ? "Normal" : imt < 25 ? "Berat badan lebih" : imt < 30 ? "Obesitas I" : "Obesitas II";

// Pelengkap otomatis per stasiun (mis. IMT dari BB & TB).
const lengkapi = (stasiun, data) => {
  if (stasiun === "tanda_vital") {
    const bb = Number(data.berat_badan);
    const tb = Number(data.tinggi_badan);
    if (bb > 0 && tb > 0) {
      const imt = Math.round((bb / (tb / 100) ** 2) * 10) / 10;
      return { ...data, imt, kategori_imt: kategoriImt(imt) };
    }
  }
  return data;
};

const ambilPeserta = async (uuid, faskesUuid, k) => {
  const s = await satu(`SELECT * FROM mcu_peserta WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [uuid, faskesUuid], k);
  if (!s) throw tidakDitemukan("Peserta MCU");
  if (s.status === "batal") throw konflik("Peserta MCU sudah dibatalkan");
  return s;
};

rute.get(
  "/:pesertaUuid",
  tangani(async (req, res) => {
    const d = await detailPeserta(req.params.pesertaUuid, req.author.faskesUuid);
    if (!d) throw tidakDitemukan("Peserta MCU");
    kirim(res, d);
  }),
);

// Kesimpulan dokter. Semua stasiun lain harus selesai (radiologi dianggap selesai bila hasil radiologi lengkap),
// kecuali `paksa: true` (mis. hasil penunjang menyusul).
rute.put(
  "/:pesertaUuid/kesimpulan",
  izinMcu("Peserta", "KESIMPULAN"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    if (!KESIMPULAN.includes(b.kesimpulan)) throw permintaanSalah(`kesimpulan harus salah satu: ${KESIMPULAN.join(", ")}`);
    if (!b.dokter_pemeriksa_uuid) throw permintaanSalah("dokter_pemeriksa_uuid wajib diisi");
    if (b.kesimpulan !== "fit" && !String(b.catatan ?? b.catatan_kesimpulan ?? "").trim() && !String(b.saran ?? "").trim())
      throw permintaanSalah("Catatan atau saran wajib diisi untuk kesimpulan fit dengan catatan / unfit");
    await transaksi(async (k) => {
      const s = await ambilPeserta(req.params.pesertaUuid, f, k);
      const dokter = await satu(`SELECT uuid FROM practitioner WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [b.dokter_pemeriksa_uuid, f], k);
      if (!dokter) throw permintaanSalah("Dokter pemeriksa tidak ditemukan");
      if (!b.paksa) {
        const d = await detailPeserta(s.uuid, f, k);
        const belum = d.stasiun.filter((x) => x.kode !== "kesimpulan" && x.status !== "selesai");
        if (belum.length) throw konflik(`Stasiun belum selesai: ${belum.map((x) => x.nama).join(", ")}`);
      }
      const catatan = String(b.catatan ?? b.catatan_kesimpulan ?? "").trim() || null;
      const saran = String(b.saran ?? "").trim() || null;
      await query(
        `UPDATE mcu_peserta SET kesimpulan = $1, saran = $2, catatan_kesimpulan = $3, dokter_pemeriksa_uuid = $4, status = 'selesai',
                selesai_pada = COALESCE(selesai_pada, $5), updated_at = $5 WHERE uuid = $6`,
        [b.kesimpulan, saran, catatan, b.dokter_pemeriksa_uuid, sekarang(), s.uuid],
        k,
      );
      await simpan(s, "kesimpulan", { kesimpulan: b.kesimpulan, saran, catatan, dokter_pemeriksa_uuid: b.dokter_pemeriksa_uuid }, "selesai", req.author.username, k);
    });
    kirim(res, await detailPeserta(req.params.pesertaUuid, f), "Kesimpulan MCU berhasil disimpan");
  }),
);

// Buka kembali MCU yang sudah selesai (koreksi kesimpulan). Ditolak bila sudah ditagihkan lewat invoice terbit/lunas.
rute.delete(
  "/:pesertaUuid/kesimpulan",
  izinMcu("Peserta", "KESIMPULAN"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const s = await ambilPeserta(req.params.pesertaUuid, f, k);
      if (!s.kesimpulan) throw konflik("Peserta belum memiliki kesimpulan");
      if (s.invoice_uuid) {
        const iv = await satu(`SELECT status FROM mcu_invoice WHERE uuid = $1`, [s.invoice_uuid], k);
        if (iv && ["terbit", "sebagian", "lunas"].includes(iv.status)) throw konflik("Peserta sudah masuk invoice yang terbit/dibayar");
      }
      await query(
        `UPDATE mcu_peserta SET kesimpulan = NULL, status = 'proses', selesai_pada = NULL, updated_at = $1 WHERE uuid = $2`,
        [sekarang(), s.uuid],
        k,
      );
      await query(`UPDATE mcu_pemeriksaan SET status = 'belum', updated_at = $1 WHERE peserta_uuid = $2 AND stasiun = 'kesimpulan'`, [sekarang(), s.uuid], k);
    });
    kirim(res, await detailPeserta(req.params.pesertaUuid, f), "Kesimpulan MCU dibuka kembali");
  }),
);

const simpan = (s, stasiun, data, status, petugas, k) =>
  satu(
    `INSERT INTO mcu_pemeriksaan (uuid, faskes_uuid, peserta_uuid, stasiun, data, status, petugas, waktu, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $8)
     ON CONFLICT (peserta_uuid, stasiun) DO UPDATE
       SET data = EXCLUDED.data, status = EXCLUDED.status, petugas = EXCLUDED.petugas, waktu = EXCLUDED.waktu,
           updated_at = EXCLUDED.updated_at, deleted_at = NULL
     RETURNING stasiun, data, status, petugas, waktu`,
    [uuidv7(), s.faskes_uuid, s.uuid, stasiun, JSON.stringify(data ?? {}), status, petugas, sekarang()],
    k,
  );

// Simpan isian satu stasiun. Body: { data: {...}, status?: 'selesai'|'belum' } (bawaan 'selesai').
rute.put(
  "/:pesertaUuid/:stasiun",
  izinMcu("Pemeriksaan", "INPUT HASIL"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const { stasiun } = req.params;
    if (stasiun === "kesimpulan") throw permintaanSalah("Gunakan /kesimpulan untuk menyimpan kesimpulan");
    const data = req.body?.data ?? {};
    if (typeof data !== "object" || Array.isArray(data)) throw permintaanSalah("data harus berupa objek");
    const status = req.body?.status === "belum" ? "belum" : "selesai";
    const hasil = await transaksi(async (k) => {
      const s = await ambilPeserta(req.params.pesertaUuid, f, k);
      if (!(s.stasiun ?? []).includes(stasiun)) throw permintaanSalah(`Stasiun ${namaStasiun(stasiun)} tidak termasuk paket peserta`);
      // Stasiun laboratorium baru bisa ditutup bila hasil order lab (lab-service / LIS) sudah lengkap.
      if (stasiun === "laboratorium" && status === "selesai" && s.lab_order_uuid) {
        const st = await statusOrderLab(s.lab_order_uuid, k);
        if (st && Number(st.order_status) !== 0 && st.terisi < st.total)
          throw konflik(
            `Hasil laboratorium ${st.no_order} belum lengkap (${st.terisi} dari ${st.total} parameter). Simpan sebagai draft dan tunggu hasil dari Laboratorium/LIS.`,
          );
      }
      const r = await simpan(s, stasiun, lengkapi(stasiun, data), status, req.author.username, k);
      if (s.status === "terdaftar") await query(`UPDATE mcu_peserta SET status = 'proses', updated_at = $1 WHERE uuid = $2`, [sekarang(), s.uuid], k);
      return r;
    });
    kirim(res, hasil, `Stasiun ${namaStasiun(stasiun)} berhasil disimpan`);
  }),
);

export default rute;
