import express from "express";
import { query, satu, sisipkan } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { izinOk } from "../umum/izin.js";
import { panggilLayanan } from "../umum/layanan.js";
import { kirimTagihan } from "../umum/tagihan.js";
import config from "../config.js";
import { ambilJadwal } from "./jadwal.js";
import { hariIni } from "./bersama.js";

// Pemakaian BHP/obat OK: order_alkes dibuat di farmasi-service (lokasi_stok = depo OK) agar pengurangan stok tetap
// lewat alur otoritatif yang sama dengan Farmasi Ruangan (StockMedisRepository.reduceQuantity) — tidak membangun
// mesin stok baru. Pengurangan stok sesungguhnya baru terjadi saat farmasi memverifikasi order (worklist Farmasi
// Ruangan), bukan seketika permintaan ini disimpan: izin "ORDER MASUK VERIFIKASI" sengaja dikhususkan untuk petugas
// farmasi (pemisahan tugas pemesan/pemeriksa stok), sehingga permintaan OK tidak memverifikasi stoknya sendiri.
// Tagihan BHP dibuat segera (ref per pemakaian, tidak pernah dikirim ulang) mengikuti pola billing Alkes RME.
const rute = express.Router();

rute.get(
  "/jadwal/:uuid/pemakaian",
  izinOk("Pemakaian BHP", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    await ambilJadwal(req.params.uuid, f);
    kirim(
      res,
      await query(
        `SELECT uuid, item_medis_uuid, nama_item, lokasi_stok_uuid, qty, harga_satuan::float8 AS harga_satuan,
                order_alkes_uuid, petugas, created_at::float8 AS created_at
           FROM ok_pemakaian_item WHERE jadwal_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY created_at`,
        [req.params.uuid, f],
      ),
    );
  }),
);

// POST /jadwal/:uuid/pemakaian { item_medis_uuid, qty, lokasi_stok_uuid }
rute.post(
  "/jadwal/:uuid/pemakaian",
  izinOk("Pemakaian BHP", "CREATE"),
  tangani(async (req, res) => {
    wajib(req.body, ["item_medis_uuid", "qty", "lokasi_stok_uuid"]);
    const f = req.author.faskesUuid;
    const qty = Number(req.body.qty);
    if (!Number.isInteger(qty) || qty <= 0) throw permintaanSalah("qty harus bilangan bulat positif");

    const j = await ambilJadwal(req.params.uuid, f);
    if (j.status !== "terjadwal") throw new Galat(409, `Jadwal berstatus ${j.status}; pemakaian hanya dapat dicatat pada jadwal terjadwal`);
    const order = await satu(`SELECT * FROM ok_order WHERE uuid = $1 AND faskes_uuid = $2`, [j.order_uuid, f]);
    if (!order?.rekam_medis_uuid || !order?.no_reg) throw permintaanSalah("Order operasi tidak memiliki referensi rekam medis; pemakaian tidak dapat dicatat");

    const lokasiStok = await satu(`SELECT uuid, jenis_lokasi FROM lokasi_stok WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status`, [req.body.lokasi_stok_uuid, f]);
    if (!lokasiStok) throw tidakDitemukan("Lokasi stok (depo OK)");
    if (lokasiStok.jenis_lokasi !== "depo") throw permintaanSalah("Lokasi stok harus berjenis depo");

    const item = await satu(`SELECT uuid, name FROM item_medis WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status`, [req.body.item_medis_uuid, f]);
    if (!item) throw tidakDitemukan("Item medis (atau sedang tidak aktif)");

    // Perkiraan ketersediaan (non-otoritatif, hanya umpan balik cepat); otoritas tetap pada verifikasi farmasi.
    const stok = await satu(
      `SELECT COALESCE(SUM(s.sisa_stok), 0)::int AS tersedia FROM stock_medis s JOIN item_medis_jenis_stok jm ON jm.uuid = s.item_medis_jenis_stok_uuid
        WHERE jm.item_medis_uuid = $1 AND s.lokasi_stok_uuid = $2 AND s.deleted_at IS NULL AND s.sisa_stok > 0 AND s.exp_date > now()`,
      [item.uuid, req.body.lokasi_stok_uuid],
    );
    if (stok.tersedia < qty) throw new Galat(409, `Stok ${item.name} di lokasi tersebut hanya tersedia ${stok.tersedia}`);

    const ruang = await satu(`SELECT lokasi_uuid FROM ok_ruang WHERE uuid = $1`, [j.ruang_uuid]);
    const lokasiUuid = ruang?.lokasi_uuid ?? order.lokasi_asal_uuid;
    if (!lokasiUuid) throw permintaanSalah("Ruang OK dan order tidak memiliki referensi lokasi; tidak dapat membuat order alkes");

    const dibuat = await panggilLayanan(`${config.farmasiUrl}/alkes`, {
      method: "POST",
      token: req.author.token,
      nama: "Farmasi (order alkes depo OK)",
      body: {
        no_reg: order.no_reg,
        patient_uuid: order.patient_uuid,
        no_rm: order.no_rm,
        jenis_pelayanan: "ok",
        rekam_medis_uuid: order.rekam_medis_uuid,
        rekam_medis_date: hariIni(),
        lokasi_uuid: lokasiUuid,
        lokasi_stok_uuid: req.body.lokasi_stok_uuid,
        payment_method: Number(order.payment_method ?? 1),
        alkes: [{ item_medis_uuid: item.uuid, qty }],
      },
    });
    const orderAlkes = dibuat?.payload;
    if (!orderAlkes?.uuid) throw new Galat(502, "Farmasi: respons order alkes tidak lengkap");
    const hargaSatuan = Number(orderAlkes?.alkes_items?.[0]?.harga_satuan ?? 0);

    const pemakaian = await sisipkan("ok_pemakaian_item", {
      faskes_uuid: f,
      jadwal_uuid: j.uuid,
      item_medis_uuid: item.uuid,
      nama_item: item.name,
      lokasi_stok_uuid: req.body.lokasi_stok_uuid,
      qty,
      harga_satuan: hargaSatuan,
      order_alkes_uuid: orderAlkes.uuid,
      petugas: req.author.username ?? null,
    });

    const tagihan = await kirimTagihan({
      faskesUuid: f,
      patientUuid: order.patient_uuid,
      noReg: order.no_reg,
      paymentMethod: order.payment_method,
      ref: `ok-pemakaian:${pemakaian.uuid}`,
      items: [{ item_name: `BHP/Obat OK: ${item.name}`, qty, price: hargaSatuan, additional_info: { jadwal_uuid: j.uuid, item_medis_uuid: item.uuid } }],
      token: req.author.token,
    });

    kirim(res, { pemakaian, order_alkes_uuid: orderAlkes.uuid, tagihan }, `Pemakaian ${item.name} dicatat; menunggu verifikasi stok oleh Farmasi`);
  }),
);

export default rute;
