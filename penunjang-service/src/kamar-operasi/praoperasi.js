import express from "express";
import { query, satu, sisipkan, ubah, transaksi } from "../db.js";
import { tangani, kirim, permintaanSalah } from "../umum/respons.js";
import { izinOk } from "../umum/izin.js";
import { ambilJadwal } from "./jadwal.js";
import { PESAN_CONSENT_SAMA, consentBerbedaValid, consentSama } from "./bersama.js";

// Pra-operasi: asesmen pra-bedah/pra-anestesi, penandaan lokasi, dan referensi persetujuan (inform_consents yang
// sudah ada — tidak membangun ulang form consent di modul ini, sesuai keputusan PRD/Desain). `kelengkapan` dipakai
// checklist.js untuk menggerbang sign in (KF-8/KT-7).
const rute = express.Router();

const DARI_PERSETUJUAN = `inform_consents c
  JOIN ok_order o ON o.rekam_medis_uuid = c.rekam_medis_uuid AND o.faskes_uuid = c.faskes_uuid AND o.deleted_at IS NULL
  JOIN ok_jadwal j ON j.order_uuid = o.uuid AND j.faskes_uuid = o.faskes_uuid AND j.deleted_at IS NULL
  WHERE j.uuid = $1 AND c.faskes_uuid = $2 AND c.deleted_at IS NULL`;
const ambilConsent = (uuid, faskesUuid, jadwalUuid, k) =>
  uuid ? satu(`SELECT c.uuid, c.persetujuan FROM ${DARI_PERSETUJUAN} AND c.uuid = $3 ${k ? "FOR SHARE OF c, o" : ""}`, [jadwalUuid, faskesUuid, uuid], k) : null;

export const kelengkapanPraoperasi = async (jadwalUuid, faskesUuid, k) => {
  const p = await satu(`SELECT * FROM ok_praoperasi WHERE jadwal_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [jadwalUuid, faskesUuid], k);
  const kekurangan = [];
  if (!p?.asesmen_pra_bedah) kekurangan.push("Asesmen pra-bedah belum diisi");
  if (!p?.asesmen_pra_anestesi) kekurangan.push("Asesmen pra-anestesi belum diisi");
  if (!p?.penandaan_lokasi) kekurangan.push("Penandaan lokasi operasi belum dicatat");
  const [consentTindakan, consentAnestesi] = await Promise.all([ambilConsent(p?.consent_tindakan_uuid, faskesUuid, jadwalUuid, k), ambilConsent(p?.consent_anestesi_uuid, faskesUuid, jadwalUuid, k)]);
  if (!consentTindakan?.persetujuan) kekurangan.push("Persetujuan tindakan (inform consent) belum disetujui");
  if (!consentAnestesi?.persetujuan) kekurangan.push("Persetujuan anestesi (inform consent) belum disetujui");
  if (consentSama(p?.consent_tindakan_uuid, p?.consent_anestesi_uuid)) kekurangan.push(PESAN_CONSENT_SAMA);
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

// GET /jadwal/:uuid/praoperasi/referensi-persetujuan — daftar persetujuan tindakan (inform consent) milik rekam
// medis pada order jadwal ini, untuk dipilih pengguna (bukan mengetik UUID). Tindakan & anestesi memakai daftar
// yang sama karena inform_consents belum membedakan jenisnya; label pembeda ditampilkan di frontend.
rute.get(
  "/jadwal/:uuid/praoperasi/referensi-persetujuan",
  izinOk("Pra-Operasi", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    await ambilJadwal(req.params.uuid, f);
    kirim(
      res,
      await query(
        `SELECT c.uuid, c.tindakan_kedokteran, c.persetujuan, c.tgl_persetujuan
           FROM ${DARI_PERSETUJUAN} ORDER BY c.created_at DESC, c.uuid`,
        [req.params.uuid, f],
      ),
    );
  }),
);

// PUT /jadwal/:uuid/praoperasi { asesmen_pra_bedah, asesmen_pra_anestesi, penandaan_lokasi, consent_tindakan_uuid,
//   consent_anestesi_uuid, kebutuhan_darah }
rute.put(
  "/jadwal/:uuid/praoperasi",
  izinOk("Pra-Operasi", "UPDATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const j = await ambilJadwal(req.params.uuid, f, k);
      if (j.status !== "terjadwal") throw permintaanSalah(`Jadwal berstatus ${j.status}; pra-operasi hanya dapat diisi pada jadwal terjadwal`);
      const b = req.body ?? {};
      const ada = await satu(`SELECT * FROM ok_praoperasi WHERE jadwal_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [j.uuid, f], k);
      // Nilai efektif setelah simpan (field yang tidak dikirim memakai nilai tersimpan).
      const efektif = (kolom) => (b[kolom] === undefined ? ada?.[kolom] : b[kolom]);
      consentBerbedaValid(efektif("consent_tindakan_uuid"), efektif("consent_anestesi_uuid"));
      for (const kolom of ["consent_tindakan_uuid", "consent_anestesi_uuid"]) {
        const uuid = efektif(kolom);
        if (uuid && !(await ambilConsent(uuid, f, j.uuid, k))) {
          throw permintaanSalah("Persetujuan tidak lagi sesuai dengan rekam medis operasi. Muat ulang pilihan dan tinjau kembali isian.");
        }
      }
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
        await ubah("ok_praoperasi", ada.uuid, f, data, k);
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
        }, k);
      }
      const { praoperasi, ...kelengkapan } = await kelengkapanPraoperasi(j.uuid, f, k);
      return { praoperasi, kelengkapan };
    });
    kirim(res, hasil, "Data pra-operasi berhasil disimpan");
  }),
);

export default rute;
