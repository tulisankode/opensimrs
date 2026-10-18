import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { izinAmbulans } from "../umum/izin.js";
import { JENIS_LAYANAN, METODE_TARIF, teks, wajibPilihan, cekPilihan } from "./bersama.js";

// Tarif layanan ambulans: per jenis layanan, per kilometer, atau per zona, dengan masa berlaku (KF-11/A5).
const rute = express.Router();

rute.get(
  "/",
  izinAmbulans("Tarif", "READ"),
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL";
    const jenis = cekPilihan(req.query.jenis_layanan || undefined, JENIS_LAYANAN, "jenis_layanan");
    if (jenis) {
      p.push(jenis);
      w += ` AND jenis_layanan = $${p.length}`;
    }
    if (req.query.aktif !== undefined && req.query.aktif !== "") {
      p.push(["1", "true"].includes(String(req.query.aktif)));
      w += ` AND aktif = $${p.length}`;
    }
    kirim(res, await query(`SELECT * FROM ambulans_tarif WHERE ${w} ORDER BY jenis_layanan, berlaku_mulai DESC`, p));
  }),
);

rute.post(
  "/",
  izinAmbulans("Tarif", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["jenis_layanan", "metode_hitung", "nilai", "berlaku_mulai"]);
    const metode = wajibPilihan(b.metode_hitung, METODE_TARIF, "metode_hitung");
    if (metode === "zona" && !teks(b.zona)) throw permintaanSalah("zona wajib diisi untuk metode_hitung zona");
    const nilai = Number(b.nilai);
    if (!Number.isFinite(nilai) || nilai < 0) throw permintaanSalah("nilai tarif harus angka >= 0");
    const r = await sisipkan("ambulans_tarif", {
      faskes_uuid: req.author.faskesUuid,
      jenis_layanan: wajibPilihan(b.jenis_layanan, JENIS_LAYANAN, "jenis_layanan"),
      metode_hitung: metode,
      nilai,
      zona: metode === "zona" ? teks(b.zona) : null,
      berlaku_mulai: Number(b.berlaku_mulai),
      berlaku_sampai: b.berlaku_sampai ? Number(b.berlaku_sampai) : null,
      aktif: b.aktif ?? true,
    });
    kirim(res, r, "Tarif berhasil ditambahkan");
  }),
);

// Perubahan tarif tidak menimpa rincian biaya yang sudah dihitung (ambulans_biaya menyimpan dasar_hitung sendiri).
rute.put(
  "/:uuid",
  izinAmbulans("Tarif", "UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const metode = cekPilihan(b.metode_hitung, METODE_TARIF, "metode_hitung");
    const perubahan = {
      jenis_layanan: cekPilihan(b.jenis_layanan, JENIS_LAYANAN, "jenis_layanan"),
      metode_hitung: metode,
      nilai: b.nilai === undefined ? undefined : Number(b.nilai),
      zona: b.zona === undefined ? undefined : teks(b.zona),
      berlaku_mulai: b.berlaku_mulai === undefined ? undefined : Number(b.berlaku_mulai),
      berlaku_sampai: b.berlaku_sampai === undefined ? undefined : b.berlaku_sampai ? Number(b.berlaku_sampai) : null,
      aktif: b.aktif === undefined ? undefined : Boolean(b.aktif),
    };
    const r = await ubah("ambulans_tarif", req.params.uuid, req.author.faskesUuid, perubahan);
    if (!r) throw tidakDitemukan("Tarif");
    kirim(res, r, "Tarif berhasil diperbarui");
  }),
);

rute.delete(
  "/:uuid",
  izinAmbulans("Tarif", "UPDATE"),
  tangani(async (req, res) => {
    const r = await ubah("ambulans_tarif", req.params.uuid, req.author.faskesUuid, { aktif: false, deleted_at: sekarang() });
    if (!r) throw tidakDitemukan("Tarif");
    kirim(res, { uuid: r.uuid }, "Tarif berhasil dinonaktifkan");
  }),
);

// G5/A5/KT-14/KT-15: pilih tarif aktif yang berlaku pada `waktu` untuk jenis layanan tsb. Tarif zona diprioritaskan
// bila zona diminta & tersedia; selain itu memakai tarif per_km/jenis yang berlaku. null bila tidak ditemukan
// (biaya ditandai belum dihitung, bukan mengarang nilai).
export const pilihTarif = async (faskesUuid, jenisLayanan, zona, waktu, k) => {
  const p = [faskesUuid, jenisLayanan, waktu];
  let w = `faskes_uuid = $1 AND jenis_layanan = $2 AND aktif AND deleted_at IS NULL
            AND berlaku_mulai <= $3 AND (berlaku_sampai IS NULL OR berlaku_sampai >= $3)`;
  if (zona) {
    p.push(zona);
    const zonaRows = await query(`SELECT * FROM ambulans_tarif WHERE ${w} AND metode_hitung = 'zona' AND zona = $${p.length} ORDER BY berlaku_mulai DESC LIMIT 1`, p, k);
    if (zonaRows.length) return zonaRows[0];
  }
  const rows = await query(`SELECT * FROM ambulans_tarif WHERE ${w} AND metode_hitung <> 'zona' ORDER BY berlaku_mulai DESC LIMIT 1`, p, k);
  return rows[0] ?? null;
};

export default rute;
