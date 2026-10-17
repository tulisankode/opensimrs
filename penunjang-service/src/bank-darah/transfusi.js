import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { izinBdrs } from "../umum/izin.js";
import { STATUS_TINDAK_LANJUT_REAKSI, cekPilihan, teks } from "./bersama.js";

// Status yang boleh dicatat lewat endpoint ini; "reaksi" hanya ditetapkan otomatis saat reaksi dilaporkan (di bawah).
const STATUS_TRANSFUSI_DICATAT = { berlangsung: "Berlangsung", selesai_tanpa_reaksi: "Selesai Tanpa Reaksi" };

// Pemantauan transfusi & reaksi per kantong yang sudah diserahkan (KF-18/KF-19). Satu bdrs_transfusi per item serah
// terima; laporan reaksi menandai transfusi berstatus "reaksi" dan masuk antrean tindak lanjut BDRS (hemovigilans).
const rute = express.Router();

const KOLOM_ITEM = `
  i.uuid AS serah_terima_item_uuid, i.stok_uuid, s.no_kantong, s.golongan_abo, s.rhesus, k.nama AS komponen_nama,
  st.permintaan_uuid, pm.no_permintaan, pm.patient_uuid, p.name AS nama_pasien, pm.no_rm, pm.lokasi_asal_uuid,
  t.uuid AS transfusi_uuid, t.waktu_mulai, t.waktu_selesai, t.status AS status_transfusi, t.hasil_pemantauan, t.dicatat_oleh`;
const JOIN_ITEM = `
  JOIN bdrs_serah_terima st ON st.uuid = i.serah_terima_uuid
  JOIN bdrs_permintaan pm ON pm.uuid = st.permintaan_uuid
  JOIN bdrs_stok s ON s.uuid = i.stok_uuid
  LEFT JOIN bdrs_komponen_darah k ON k.uuid = s.komponen_uuid
  LEFT JOIN patients p ON p.uuid = pm.patient_uuid
  LEFT JOIN bdrs_transfusi t ON t.serah_terima_item_uuid = i.uuid AND t.deleted_at IS NULL`;

// Daftar kantong yang sudah diserahkan untuk dipantau transfusinya (?status=berlangsung|selesai_tanpa_reaksi|reaksi
// atau kosongkan untuk melihat semua, termasuk yang belum dicatat transfusinya).
rute.get(
  "/transfusi",
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const p = [faskes];
    let w = "i.faskes_uuid = $1 AND i.deleted_at IS NULL AND st.status = 'selesai'";
    if (req.query.permintaan_uuid) {
      p.push(req.query.permintaan_uuid);
      w += ` AND st.permintaan_uuid = $${p.length}`;
    }
    if (req.query.status === "belum_dicatat") w += " AND t.uuid IS NULL";
    else if (req.query.status) {
      p.push(req.query.status);
      w += ` AND t.status = $${p.length}`;
    }
    const rows = await query(`SELECT ${KOLOM_ITEM} FROM bdrs_serah_terima_item i ${JOIN_ITEM} WHERE ${w} ORDER BY st.created_at DESC LIMIT 200`, p);
    kirim(res, rows);
  }),
);

rute.post(
  "/serah-terima-item/:uuid/transfusi",
  izinBdrs("Pemantauan Transfusi", "CATAT TRANSFUSI"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    const item = await satu(
      `SELECT i.*, st.status AS status_serah_terima FROM bdrs_serah_terima_item i JOIN bdrs_serah_terima st ON st.uuid = i.serah_terima_uuid
        WHERE i.uuid = $1 AND i.faskes_uuid = $2 AND i.deleted_at IS NULL`,
      [req.params.uuid, faskes],
    );
    if (!item) throw tidakDitemukan("Item serah terima");
    if (item.status_serah_terima !== "selesai") throw new Galat(409, "Transfusi hanya dapat dicatat untuk kantong yang sudah diserahkan");
    const waktuMulai = Number(b.waktu_mulai) || sekarang();
    const waktuSelesai = b.waktu_selesai === undefined || b.waktu_selesai === null || b.waktu_selesai === "" ? null : Number(b.waktu_selesai);
    if (waktuSelesai !== null && waktuSelesai < waktuMulai) throw permintaanSalah("waktu_selesai tidak boleh sebelum waktu_mulai");
    const status = cekPilihan(b.status || (waktuSelesai ? "selesai_tanpa_reaksi" : "berlangsung"), STATUS_TRANSFUSI_DICATAT, "status");
    const hasilPemantauan = teks(b.hasil_pemantauan);

    const ada = await satu(`SELECT uuid FROM bdrs_transfusi WHERE serah_terima_item_uuid = $1 AND deleted_at IS NULL`, [item.uuid]);
    let t;
    if (ada) {
      t = await ubah("bdrs_transfusi", ada.uuid, faskes, { waktu_mulai: waktuMulai, waktu_selesai: waktuSelesai, status, hasil_pemantauan: hasilPemantauan, dicatat_oleh: req.author.username ?? null });
    } else {
      t = await sisipkan("bdrs_transfusi", {
        faskes_uuid: faskes,
        serah_terima_item_uuid: item.uuid,
        waktu_mulai: waktuMulai,
        waktu_selesai: waktuSelesai,
        status,
        hasil_pemantauan: hasilPemantauan,
        dicatat_oleh: req.author.username ?? null,
      });
    }
    kirim(res, t, "Catatan transfusi berhasil disimpan");
  }),
);

rute.post(
  "/transfusi/:uuid/reaksi",
  izinBdrs("Pemantauan Transfusi", "LAPOR REAKSI"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    wajib(b, ["jenis_reaksi", "gejala"]);
    const t = await satu(`SELECT * FROM bdrs_transfusi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, faskes]);
    if (!t) throw tidakDitemukan("Catatan transfusi");
    const reaksi = await sisipkan("bdrs_reaksi_transfusi", {
      faskes_uuid: faskes,
      transfusi_uuid: t.uuid,
      jenis_reaksi: String(b.jenis_reaksi).trim(),
      gejala: String(b.gejala).trim(),
      tindak_lanjut: teks(b.tindak_lanjut),
      dilaporkan_oleh: req.author.username ?? null,
      status_tindak_lanjut: "baru",
    });
    await ubah("bdrs_transfusi", t.uuid, faskes, { status: "reaksi" });
    kirim(res, reaksi, "Laporan reaksi transfusi berhasil disimpan, BDRS akan menindaklanjuti");
  }),
);

// Antrean reaksi yang perlu ditindaklanjuti BDRS (hemovigilans).
rute.get(
  "/reaksi",
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const p = [faskes];
    let w = "r.faskes_uuid = $1 AND r.deleted_at IS NULL";
    if (req.query.status) {
      p.push(req.query.status);
      w += ` AND r.status_tindak_lanjut = $${p.length}`;
    }
    const rows = await query(
      `SELECT r.uuid, r.transfusi_uuid, r.jenis_reaksi, r.gejala, r.tindak_lanjut, r.dilaporkan_oleh, r.diterima_bdrs_oleh,
              r.status_tindak_lanjut, r.created_at, pm.no_permintaan, pm.patient_uuid, p.name AS nama_pasien, pm.no_rm, s.no_kantong
         FROM bdrs_reaksi_transfusi r
         JOIN bdrs_transfusi t ON t.uuid = r.transfusi_uuid
         JOIN bdrs_serah_terima_item i ON i.uuid = t.serah_terima_item_uuid
         JOIN bdrs_serah_terima st ON st.uuid = i.serah_terima_uuid
         JOIN bdrs_permintaan pm ON pm.uuid = st.permintaan_uuid
         JOIN bdrs_stok s ON s.uuid = i.stok_uuid
         LEFT JOIN patients p ON p.uuid = pm.patient_uuid
        WHERE ${w} ORDER BY r.created_at DESC LIMIT 200`,
      p,
    );
    kirim(res, rows);
  }),
);

rute.patch(
  "/reaksi/:uuid/tindak-lanjut",
  izinBdrs("Pemantauan Transfusi", "LAPOR REAKSI"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    wajib(b, ["status_tindak_lanjut"]);
    const status = cekPilihan(b.status_tindak_lanjut, STATUS_TINDAK_LANJUT_REAKSI, "status_tindak_lanjut");
    const r = await ubah("bdrs_reaksi_transfusi", req.params.uuid, faskes, {
      status_tindak_lanjut: status,
      tindak_lanjut: teks(b.tindak_lanjut),
      diterima_bdrs_oleh: req.author.username ?? null,
    });
    if (!r) throw tidakDitemukan("Laporan reaksi transfusi");
    kirim(res, r, "Tindak lanjut reaksi transfusi berhasil disimpan");
  }),
);

export default rute;
