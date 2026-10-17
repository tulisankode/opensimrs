import express from "express";
import { query, satu, sisipkan, sekarang } from "../db.js";
import { tangani, kirim, permintaanSalah, Galat } from "../umum/respons.js";
import { izinOk } from "../umum/izin.js";
import { ambilJadwal } from "./jadwal.js";
import { kelengkapanPraoperasi } from "./praoperasi.js";
import { TAHAP_CHECKLIST, ITEM_CHECKLIST, tahapValid, ramah } from "./bersama.js";

// Checklist Keselamatan Bedah WHO: sign in → time out → sign out, berurutan (KF-9). Sign in mensyaratkan pra-operasi
// lengkap (KF-8/KT-7); laporan operasi tidak dapat difinalkan sebelum ketiganya lengkap (KF-11, lihat laporan.js).
const rute = express.Router();

export const checklistJadwal = async (jadwalUuid, k) => {
  const rows = await query(`SELECT tahap, item, waktu_diisi::float8 AS waktu_diisi, petugas FROM ok_checklist WHERE jadwal_uuid = $1 AND deleted_at IS NULL`, [jadwalUuid], k);
  const byTahap = Object.fromEntries(rows.map((r) => [r.tahap, r]));
  return { sign_in: byTahap.sign_in ?? null, time_out: byTahap.time_out ?? null, sign_out: byTahap.sign_out ?? null, lengkap: TAHAP_CHECKLIST.every((t) => byTahap[t]) };
};

rute.get(
  "/jadwal/:uuid/checklist",
  izinOk("Checklist Keselamatan", "READ"),
  tangani(async (req, res) => {
    await ambilJadwal(req.params.uuid, req.author.faskesUuid);
    kirim(res, await checklistJadwal(req.params.uuid));
  }),
);

rute.get("/checklist/referensi", (req, res) => kirim(res, ITEM_CHECKLIST));

// PUT /jadwal/:uuid/checklist/:tahap { item: [{kode, label, jawaban, catatan}] }
rute.put(
  "/jadwal/:uuid/checklist/:tahap",
  izinOk("Checklist Keselamatan", "UPDATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const tahap = tahapValid(req.params.tahap);
    const item = req.body?.item;
    if (!Array.isArray(item) || item.length === 0) throw permintaanSalah("item checklist wajib diisi");

    const j = await ambilJadwal(req.params.uuid, f);
    if (j.status !== "terjadwal") throw new Galat(409, `Jadwal berstatus ${j.status}; checklist hanya dapat diisi pada jadwal terjadwal`);
    const sekarangChecklist = await checklistJadwal(j.uuid);

    if (tahap === "sign_in") {
      const { lengkap, kekurangan } = await kelengkapanPraoperasi(j.uuid, f);
      if (!lengkap) throw new Galat(409, `Pra-operasi belum lengkap: ${kekurangan.join("; ")}`);
    } else if (tahap === "time_out" && !sekarangChecklist.sign_in) {
      throw new Galat(409, "Sign in belum diisi");
    } else if (tahap === "sign_out" && !sekarangChecklist.time_out) {
      throw new Galat(409, "Time out belum diisi");
    }
    if (sekarangChecklist[tahap]) throw new Galat(409, `${tahap.replaceAll("_", " ")} sudah diisi`);

    await sisipkan("ok_checklist", { faskes_uuid: f, jadwal_uuid: j.uuid, tahap, item, waktu_diisi: sekarang(), petugas: req.author.username ?? null }).catch((e) =>
      ramah(e, `${tahap.replaceAll("_", " ")} sudah diisi`),
    );
    const hasil = await checklistJadwal(j.uuid);
    kirim(res, hasil, `${tahap.replaceAll("_", " ")} berhasil disimpan`);
  }),
);

export default rute;
