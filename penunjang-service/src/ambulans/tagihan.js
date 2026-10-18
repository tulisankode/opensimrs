import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, tidakDitemukan, Galat } from "../umum/respons.js";
import { izinAmbulans } from "../umum/izin.js";
import { kirimTagihan } from "../umum/tagihan.js";
import { nomorBaru } from "../umum/nomor.js";
import { pilihTarif } from "./tarif.js";

// Perhitungan biaya perjalanan, penerusan ke Pembayaran (layanan bertaut pasien/kunjungan), & kuitansi umum
// (layanan tanpa pasien). Lihat juga perjalanan.js (pemicu otomatis saat perjalanan diselesaikan).
const rute = express.Router();

const LABEL_LAYANAN = { gawat_darurat: "Gawat Darurat", rujukan: "Rujukan", pemulangan: "Pemulangan", jenazah: "Jenazah" };

// KF-12/KT-14/KT-15/G5: pilih tarif berlaku & hitung jumlah. null bila tarif tidak ditemukan (biaya belum dihitung).
export const hitungBiaya = async (permintaan, jarakKm, zona, k) => {
  const tarif = await pilihTarif(permintaan.faskes_uuid, permintaan.jenis_layanan, zona, sekarang(), k);
  if (!tarif) return null;
  const jumlah = tarif.metode_hitung === "per_km" ? Number(tarif.nilai) * Number(jarakKm || 0) : Number(tarif.nilai);
  return {
    tarif_uuid: tarif.uuid,
    metode_hitung: tarif.metode_hitung,
    jumlah: Math.round(jumlah * 100) / 100,
    dasar_hitung: { metode_hitung: tarif.metode_hitung, nilai_tarif: Number(tarif.nilai), jarak_km: Number(jarakKm || 0), zona: tarif.zona ?? null },
  };
};

// Upsert satu baris ambulans_biaya per permintaan (unique index permintaan_uuid).
export const simpanBiaya = async (permintaan, hitung, k) => {
  const ada = await satu(`SELECT uuid FROM ambulans_biaya WHERE permintaan_uuid = $1 AND deleted_at IS NULL`, [permintaan.uuid], k);
  const data = hitung
    ? { tarif_uuid: hitung.tarif_uuid, metode_hitung: hitung.metode_hitung, dasar_hitung: hitung.dasar_hitung, jumlah: hitung.jumlah, status_penerusan: "menunggu" }
    : { tarif_uuid: null, metode_hitung: null, dasar_hitung: null, jumlah: null, status_penerusan: "belum_dihitung" };
  if (ada) return ubah("ambulans_biaya", ada.uuid, permintaan.faskes_uuid, data, k);
  return sisipkan("ambulans_biaya", { faskes_uuid: permintaan.faskes_uuid, permintaan_uuid: permintaan.uuid, ...data }, k);
};

// KF-13/KF-14/KT-16/KT-18/G6/G7: pasien terdaftar → tagihan ke Pembayaran (kunjungan bila ada no_reg, bila tidak
// tetap tertagih ke pasien lewat jalur APS); tanpa pasien → kuitansi umum. `ref` idempoten mencegah duplikasi saat
// diulang (KT-16/KT-17): payment-service mengganti item lama dengan ref yang sama, bukan menambah baris baru.
export const teruskanBiaya = async (permintaanUuid, faskesUuid, req) => {
  const permintaan = await satu(`SELECT * FROM ambulans_permintaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [permintaanUuid, faskesUuid]);
  if (!permintaan) throw tidakDitemukan("Permintaan ambulans");
  const biaya = await satu(`SELECT * FROM ambulans_biaya WHERE permintaan_uuid = $1 AND deleted_at IS NULL`, [permintaan.uuid]);
  if (!biaya) throw tidakDitemukan("Biaya ambulans");
  if (biaya.status_penerusan === "belum_dihitung") throw new Galat(409, "Tarif belum tersedia, biaya belum dapat diteruskan");
  if (biaya.status_penerusan === "terkirim") return biaya;

  if (!permintaan.patient_uuid) {
    // KF-14/KT-18: kuitansi umum untuk layanan tanpa pasien/kunjungan — tidak lewat jalur tagihan Pembayaran.
    const kuitansiAda = await satu(`SELECT * FROM ambulans_kuitansi WHERE permintaan_uuid = $1 AND deleted_at IS NULL`, [permintaan.uuid]);
    if (kuitansiAda) return ubah("ambulans_biaya", biaya.uuid, faskesUuid, { status_penerusan: "terkirim", referensi_pembayaran: kuitansiAda.nomor_kuitansi });
    const kuitansi = await sisipkan("ambulans_kuitansi", {
      faskes_uuid: faskesUuid,
      permintaan_uuid: permintaan.uuid,
      nomor_kuitansi: await nomorBaru(faskesUuid, "KWT-AMB"),
      jumlah: biaya.jumlah,
      status: "terbit",
    });
    return ubah("ambulans_biaya", biaya.uuid, faskesUuid, { status_penerusan: "terkirim", referensi_pembayaran: kuitansi.nomor_kuitansi });
  }

  const ref = `ambulans:${permintaan.uuid}`;
  try {
    await kirimTagihan({
      faskesUuid,
      patientUuid: permintaan.patient_uuid,
      noReg: permintaan.no_reg,
      paymentMethod: 1,
      ref,
      items: [{ item_name: `Ambulans (${LABEL_LAYANAN[permintaan.jenis_layanan] ?? permintaan.jenis_layanan})`, price: Number(biaya.jumlah) || 0, qty: 1 }],
      token: req?.author?.token,
      apsType: "AMB",
      apsServiceName: "Ambulans",
      apsServiceCode: permintaan.nomor_permintaan,
      apsLayananUuid: permintaan.uuid,
    });
    return ubah("ambulans_biaya", biaya.uuid, faskesUuid, { status_penerusan: "terkirim", referensi_pembayaran: ref, kunci_idempoten: ref, pesan_galat: null });
  } catch (e) {
    return ubah("ambulans_biaya", biaya.uuid, faskesUuid, { status_penerusan: "gagal", kunci_idempoten: ref, pesan_galat: e.message });
  }
};

rute.post(
  "/biaya/:uuid/teruskan",
  izinAmbulans("Biaya & Kuitansi", "TERUSKAN"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const biaya = await satu(`SELECT * FROM ambulans_biaya WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, faskes]);
    if (!biaya) throw tidakDitemukan("Biaya ambulans");
    const r = await teruskanBiaya(biaya.permintaan_uuid, faskes, req);
    kirim(res, r, r.status_penerusan === "terkirim" ? "Biaya berhasil diteruskan" : "Penerusan biaya gagal, dapat dicoba ulang");
  }),
);

rute.get(
  "/kuitansi",
  izinAmbulans("Biaya & Kuitansi", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "ku.faskes_uuid = $1 AND ku.deleted_at IS NULL";
    if (req.query.status) {
      p.push(req.query.status);
      w += ` AND ku.status = $${p.length}`;
    }
    if (req.query.tanggal_mulai && req.query.tanggal_selesai) {
      p.push(Number(req.query.tanggal_mulai), Number(req.query.tanggal_selesai));
      w += ` AND ku.created_at BETWEEN $${p.length - 1} AND $${p.length}`;
    }
    const DARI = `ambulans_kuitansi ku JOIN ambulans_permintaan p ON p.uuid = ku.permintaan_uuid`;
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ku.*, p.nomor_permintaan, p.jenis_layanan, p.tujuan FROM ${DARI} WHERE ${w} ORDER BY ku.created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/kuitansi/:uuid",
  izinAmbulans("Biaya & Kuitansi", "READ"),
  tangani(async (req, res) => {
    const r = await satu(
      `SELECT ku.*, p.nomor_permintaan, p.jenis_layanan, p.tujuan, p.lokasi_jemput, p.waktu_permintaan
         FROM ambulans_kuitansi ku JOIN ambulans_permintaan p ON p.uuid = ku.permintaan_uuid
        WHERE ku.uuid = $1 AND ku.faskes_uuid = $2 AND ku.deleted_at IS NULL`,
      [req.params.uuid, req.author.faskesUuid],
    );
    if (!r) throw tidakDitemukan("Kuitansi ambulans");
    kirim(res, r);
  }),
);

export default rute;
