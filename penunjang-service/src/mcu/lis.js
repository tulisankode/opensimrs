import express from "express";
import config from "../config.js";
import { query } from "../db.js";
import { tangani, kirim, permintaanSalah } from "../umum/respons.js";
import { konflik } from "./bersama.js";
import { izinMcu } from "../umum/izin.js";
import { panggilLayanan } from "../umum/layanan.js";
import { DARI_LIS, SQL_STATUS_LIS, filterPeserta } from "./peserta.js";

// Kirim order lab peserta MCU ke LIS secara massal — /api/v3/penunjang/mcu/lis/...
// penunjang-service memilih peserta (pilihan / semua sesuai filter daftar) & menegakkan izin MCU › Peserta › KIRIM LIS,
// lalu menyerahkan daftar order lab ke lab-service (pemilik koneksi LIS, klaim anti-dobel & antrean batch) dengan token
// pengguna yang sama. Batch diproses asinkron oleh lab-service; frontend memantau progres lewat GET /batch/:uuid.
const rute = express.Router();
const MAKS = 1000;

// Aksi → status LIS peserta yang diproses (lainnya dilewati & dilaporkan).
const AKSI = {
  kirim: { jenis: "kirim", status: ["belum", "gagal"], label: "Kirim ke LIS" },
  ulang: { jenis: "kirim", status: ["gagal"], label: "Kirim ulang yang gagal" },
  hasil: { jenis: "hasil", status: ["terkirim", "hasil_sebagian"], label: "Ambil hasil LIS" },
  cek: { jenis: "cek", status: ["tidak_pasti"], label: "Cek status LIS" },
  tandai: { jenis: null, status: ["tidak_pasti"], label: "Tandai belum terdaftar" },
};

const lab = (path, opsi) => panggilLayanan(`${config.labUrl}/lis${path}`, { nama: "Laboratorium", ...opsi });

// Peserta terpilih (uuid) atau semua sesuai filter daftar, beserta status LIS-nya.
const pesertaTarget = async (b, faskesUuid) => {
  let w;
  let p;
  if (Array.isArray(b.peserta_uuids) && b.peserta_uuids.length) {
    if (b.peserta_uuids.length > MAKS) throw permintaanSalah(`Maksimal ${MAKS} peserta per proses`);
    p = [faskesUuid, b.peserta_uuids.map(String)];
    w = "s.faskes_uuid = $1 AND s.deleted_at IS NULL AND s.uuid = ANY($2::varchar[])";
  } else if (b.filter && typeof b.filter === "object") {
    ({ w, p } = filterPeserta(b.filter, faskesUuid));
  } else throw permintaanSalah("Pilih peserta (peserta_uuids) atau kirim filter daftar (filter)");
  const rows = await query(
    `SELECT s.uuid, s.no_mcu, s.status, s.lab_order_uuid, pt.name AS nama_pasien, pr.nama AS perusahaan, ${SQL_STATUS_LIS} AS status_lis
       FROM ${DARI_LIS} WHERE ${w} ORDER BY s.tanggal, s.no_mcu LIMIT ${MAKS + 1}`,
    p,
  );
  if (rows.length > MAKS) throw permintaanSalah(`Filter mencakup lebih dari ${MAKS} peserta — persempit filter (tanggal/perusahaan)`);
  return rows;
};

const LABEL_STATUS = {
  belum: "belum dikirim", mengirim: "sedang dikirim", terkirim: "sudah terkirim", gagal: "gagal", tidak_pasti: "status tidak pasti",
  hasil_sebagian: "hasil sebagian masuk", hasil_lengkap: "hasil lengkap", tanpa_order: "tanpa order lab", batal: "peserta batal",
};

// Body: { aksi: kirim|ulang|hasil|cek|tandai, peserta_uuids?: [], filter?: {query daftar}, koneksi_uuid?, periksa_now? }
rute.post(
  "/proses",
  izinMcu("Peserta", "KIRIM LIS"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const aksi = AKSI[b.aksi];
    if (!aksi) throw permintaanSalah(`aksi harus salah satu: ${Object.keys(AKSI).join(", ")}`);
    const semua = await pesertaTarget(b, req.author.faskesUuid);
    const dilewati = {};
    const target = [];
    for (const s of semua) {
      const st = s.status === "batal" ? "batal" : s.status_lis;
      if (st !== "batal" && aksi.status.includes(st)) target.push(s);
      else dilewati[st] = (dilewati[st] ?? 0) + 1;
    }
    const ringkasLewat = Object.entries(dilewati).map(([k, n]) => `${n} ${LABEL_STATUS[k] ?? k}`).join(", ");
    if (!target.length) {
      throw konflik(`Tidak ada peserta yang dapat diproses untuk "${aksi.label}"${ringkasLewat ? ` (${ringkasLewat})` : ""}`);
    }
    const items = target.map((s) => ({ order_lab_uuid: s.lab_order_uuid, ref_uuid: s.uuid }));
    if (!aksi.jenis) {
      const r = await lab("/kirim-tandai-belum-terdaftar", {
        method: "POST", token: req.author.token, body: { sumber: "mcu", order_lab_uuids: items.map((i) => i.order_lab_uuid) },
      });
      return kirim(res, { batch: null, dipilih: semua.length, diproses: r?.payload?.length ?? 0, dilewati }, r?.message ?? "Selesai");
    }
    const perusahaan = [...new Set(target.map((s) => s.perusahaan ?? "Perorangan"))];
    const judul = `${aksi.label} — ${target.length} peserta${perusahaan.length === 1 ? ` (${perusahaan[0]})` : ""}`;
    const r = await lab("/batch", {
      method: "POST",
      token: req.author.token,
      body: { sumber: "mcu", jenis: aksi.jenis, items, koneksi_uuid: b.koneksi_uuid || null, opsi: { periksa_now: b.periksa_now !== false }, judul },
    });
    kirim(
      res,
      { batch: r?.payload ?? null, dipilih: semua.length, diproses: target.length, dilewati },
      `${aksi.label}: ${target.length} peserta diproses di server${ringkasLewat ? `; dilewati ${ringkasLewat}` : ""}`,
    );
  }),
);

// Riwayat & progres batch (lab-service) + no. MCU per item.
rute.get(
  "/batch",
  tangani(async (req, res) => {
    const qs = new URLSearchParams({ sumber: "mcu", page: String(req.query.page ?? 1), limit: String(req.query.limit ?? 10) });
    const r = await lab(`/batch?${qs}`, { token: req.author.token });
    res.json({ message: "Data berhasil ditampilkan", payload: r?.payload ?? [], pagination: r?.pagination });
  }),
);

rute.get(
  "/batch/:uuid",
  tangani(async (req, res) => {
    const r = await lab(`/batch/${encodeURIComponent(req.params.uuid)}${req.query.item === "0" ? "?item=0" : ""}`, { token: req.author.token });
    const batch = r?.payload;
    if (batch?.items?.length) {
      const peserta = await query(`SELECT uuid, no_mcu FROM mcu_peserta WHERE uuid = ANY($1::varchar[]) AND faskes_uuid = $2`, [
        batch.items.map((i) => i.ref_uuid).filter(Boolean),
        req.author.faskesUuid,
      ]);
      const peta = new Map(peserta.map((x) => [x.uuid, x.no_mcu]));
      batch.items = batch.items.map((i) => ({ ...i, no_mcu: peta.get(i.ref_uuid) ?? null }));
    }
    kirim(res, batch);
  }),
);

for (const aksi of ["ulang", "hentikan"]) {
  rute.post(
    `/batch/:uuid/${aksi}`,
    izinMcu("Peserta", "KIRIM LIS"),
    tangani(async (req, res) => {
      const r = await lab(`/batch/${encodeURIComponent(req.params.uuid)}/${aksi}`, { method: "POST", token: req.author.token, body: req.body ?? {} });
      kirim(res, r?.payload, r?.message);
    }),
  );
}

// Koneksi LIS aktif (untuk dialog kirim: pilihan LIS & mode).
rute.get(
  "/koneksi",
  tangani(async (req, res) => {
    const r = await lab("/koneksi", { token: req.author.token });
    kirim(
      res,
      (r?.payload ?? []).filter((k) => k.aktif).map((k) => ({
        uuid: k.uuid, nama: k.nama, bawaan: k.bawaan, mode_kirim: k.mode_kirim, ukuran_batch: k.ukuran_batch, maks_paralel: k.maks_paralel, ada_url_hasil: !!k.url_hasil,
      })),
    );
  }),
);

export default rute;
