import express from "express";
import { satu, sisipkan, ubah } from "../db.js";
import { tangani, kirim, permintaanSalah } from "../umum/respons.js";
import { izinOk } from "../umum/izin.js";
import { ambilJadwal } from "./jadwal.js";
import { ramah } from "./bersama.js";

// Pra-operasi: asesmen pra-bedah/pra-anestesi, penandaan lokasi, dan referensi persetujuan (inform_consents yang
// sudah ada — tidak membangun ulang form consent di modul ini, sesuai keputusan PRD/Desain). `kelengkapan` dipakai
// checklist.js untuk menggerbang sign in (KF-8/KT-7).
const rute = express.Router();

const ambilConsent = (uuid, faskesUuid, k) =>
  uuid ? satu(`SELECT uuid, persetujuan FROM inform_consents WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid], k) : null;

export const kelengkapanPraoperasi = async (jadwalUuid, faskesUuid, k) => {
  const p = await satu(`SELECT * FROM ok_praoperasi WHERE jadwal_uuid = $1 AND deleted_at IS NULL`, [jadwalUuid], k);
  const kekurangan = [];
  if (!p?.asesmen_pra_bedah) kekurangan.push("Asesmen pra-bedah belum diisi");
  if (!p?.asesmen_pra_anestesi) kekurangan.push("Asesmen pra-anestesi belum diisi");
  if (!p?.penandaan_lokasi) kekurangan.push("Penandaan lokasi operasi belum dicatat");
  const [consentTindakan, consentAnestesi] = await Promise.all([ambilConsent(p?.consent_tindakan_uuid, faskesUuid, k), ambilConsent(p?.consent_anestesi_uuid, faskesUuid, k)]);
  if (!consentTindakan?.persetujuan) kekurangan.push("Persetujuan tindakan (inform consent) belum disetujui");
  if (!consentAnestesi?.persetujuan) kekurangan.push("Persetujuan anestesi (inform consent) belum disetujui");
  return { lengkap: kekurangan.length === 0, kekurangan, praoperasi: p };
};

rute.get(
  "/jadwal/:uuid/praoperasi",
  izinOk("Pra-Operasi", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    await ambilJadwal(req.params.uuid, f);
    const { praoperasi, ...kelengkapan } = await kelengkapanPraoperasi(req.params.uuid, f);
    kirim(res, { praoperasi, kelengkapan });
  }),
);

// PUT /jadwal/:uuid/praoperasi { asesmen_pra_bedah, asesmen_pra_anestesi, penandaan_lokasi, consent_tindakan_uuid,
//   consent_anestesi_uuid, kebutuhan_darah }
rute.put(
  "/jadwal/:uuid/praoperasi",
  izinOk("Pra-Operasi", "UPDATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const j = await ambilJadwal(req.params.uuid, f);
    if (j.status !== "terjadwal") throw permintaanSalah(`Jadwal berstatus ${j.status}; pra-operasi hanya dapat diisi pada jadwal terjadwal`);
    const b = req.body ?? {};
    if (b.consent_tindakan_uuid && !(await ambilConsent(b.consent_tindakan_uuid, f))) throw permintaanSalah("consent_tindakan_uuid tidak ditemukan");
    if (b.consent_anestesi_uuid && !(await ambilConsent(b.consent_anestesi_uuid, f))) throw permintaanSalah("consent_anestesi_uuid tidak ditemukan");
    const ada = await satu(`SELECT uuid FROM ok_praoperasi WHERE jadwal_uuid = $1 AND deleted_at IS NULL`, [j.uuid]);
    const data = {
      asesmen_pra_bedah: b.asesmen_pra_bedah,
      asesmen_pra_anestesi: b.asesmen_pra_anestesi,
      penandaan_lokasi: b.penandaan_lokasi,
      consent_tindakan_uuid: b.consent_tindakan_uuid,
      consent_anestesi_uuid: b.consent_anestesi_uuid,
      kebutuhan_darah: b.kebutuhan_darah,
      petugas: req.author.username ?? null,
    };
    if (ada) {
      await ubah("ok_praoperasi", ada.uuid, f, data);
    } else {
      await sisipkan("ok_praoperasi", {
        faskes_uuid: f,
        jadwal_uuid: j.uuid,
        asesmen_pra_bedah: data.asesmen_pra_bedah ?? null,
        asesmen_pra_anestesi: data.asesmen_pra_anestesi ?? null,
        penandaan_lokasi: data.penandaan_lokasi ?? null,
        consent_tindakan_uuid: data.consent_tindakan_uuid ?? null,
        consent_anestesi_uuid: data.consent_anestesi_uuid ?? null,
        kebutuhan_darah: data.kebutuhan_darah ?? null,
        petugas: data.petugas,
      });
    }
    const { praoperasi, ...kelengkapan } = await kelengkapanPraoperasi(j.uuid, f);
    kirim(res, { praoperasi, kelengkapan }, "Data pra-operasi berhasil disimpan");
  }),
);

export default rute;
