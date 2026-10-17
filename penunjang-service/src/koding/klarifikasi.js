import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, permintaanSalah, tidakDitemukan, Galat, wajib } from "../umum/respons.js";
import { izinKoding } from "../umum/izin.js";
import { ambilKoding, klarifikasiKunjungan, satuKunjunganSumber } from "./data.js";
import { teks } from "./bersama.js";

// Klarifikasi koder ↔ DPJP per kunjungan — /api/v3/penunjang/koding/...
//   GET  /kunjungan/:tipe/:uuid/klarifikasi    daftar klarifikasi kunjungan (?status=)
//   POST /kunjungan/:tipe/:uuid/klarifikasi    kirim pertanyaan baru ke DPJP kunjungan (practitioner_uuid mengikuti DPJP kunjungan)
//   POST /klarifikasi/:uuid/jawaban            dijawab DPJP yang dituju (practitioner_uuid pengguna harus sama)
//   POST /klarifikasi/:uuid/tutup              ditutup koder setelah meninjau jawaban
const rute = express.Router();

rute.get(
  "/kunjungan/:tipe/:uuid/klarifikasi",
  izinKoding("Klarifikasi", "READ"),
  tangani(async (req, res) => {
    const { tipe, uuid } = req.params;
    const faskes = req.author.faskesUuid;
    const sumber = await satuKunjunganSumber(tipe, uuid, faskes);
    const koding = await ambilKoding(tipe, uuid, faskes, sumber);
    const status = teks(req.query.status);
    kirim(res, await klarifikasiKunjungan(koding.uuid, status || undefined));
  }),
);

rute.post(
  "/kunjungan/:tipe/:uuid/klarifikasi",
  izinKoding("Klarifikasi", "CREATE"),
  tangani(async (req, res) => {
    const { tipe, uuid } = req.params;
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    wajib(b, ["pertanyaan"]);
    const sumber = await satuKunjunganSumber(tipe, uuid, faskes);
    if (!sumber.practitioner_uuid) throw permintaanSalah("Kunjungan belum memiliki DPJP, klarifikasi tidak dapat dikirim");
    const koding = await ambilKoding(tipe, uuid, faskes, sumber);
    const r = await sisipkan("koding_klarifikasi", {
      faskes_uuid: faskes, koding_kunjungan_uuid: koding.uuid, practitioner_uuid: sumber.practitioner_uuid,
      pengirim_uuid: req.author.username, pertanyaan: teks(b.pertanyaan, 2000), menghalangi: b.menghalangi !== false,
      status: "menunggu", dikirim_at: sekarang(),
    });
    kirim(res, r, "Klarifikasi terkirim ke DPJP");
  }),
);

const satuKlarifikasi = async (uuid, faskesUuid) => {
  const r = await satu(`SELECT * FROM koding_klarifikasi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid]);
  if (!r) throw tidakDitemukan("Klarifikasi");
  return r;
};

rute.post(
  "/klarifikasi/:uuid/jawaban",
  izinKoding("Klarifikasi", "UPDATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    wajib(b, ["jawaban"]);
    const kl = await satuKlarifikasi(req.params.uuid, faskes);
    if (kl.status === "ditutup") throw permintaanSalah("Klarifikasi sudah ditutup");
    const u = await satu(`SELECT practitioner_uuid FROM users WHERE username = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.author.username, faskes]);
    if (!u?.practitioner_uuid || u.practitioner_uuid !== kl.practitioner_uuid) {
      throw new Galat(403, "Hanya DPJP yang dituju yang dapat menjawab klarifikasi ini");
    }
    const r = await ubah("koding_klarifikasi", kl.uuid, faskes, { jawaban: teks(b.jawaban, 2000), status: "terjawab", dijawab_at: sekarang() });
    kirim(res, r, "Jawaban klarifikasi tersimpan");
  }),
);

rute.post(
  "/klarifikasi/:uuid/tutup",
  izinKoding("Klarifikasi", "UPDATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const kl = await satuKlarifikasi(req.params.uuid, faskes);
    if (kl.status === "ditutup") throw permintaanSalah("Klarifikasi sudah ditutup");
    const r = await ubah("koding_klarifikasi", kl.uuid, faskes, {
      status: "ditutup", ditutup_at: sekarang(), ditutup_oleh: req.author.username, catatan_tutup: teks(req.body?.catatan) ?? null,
    });
    kirim(res, r, "Klarifikasi ditutup");
  }),
);

export default rute;
