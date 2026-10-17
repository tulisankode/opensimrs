import express from "express";
import { satu, sisipkan, transaksi } from "../db.js";
import { tangani, kirim, wajib, Galat } from "../umum/respons.js";
import { izinBdrs } from "../umum/izin.js";
import { kunciPermintaan, detailPermintaan } from "./permintaan.js";
import { GOLONGAN_ABO, RHESUS, SKRINING_ANTIBODI, STATUS_PERMINTAAN, cekPilihan, teks } from "./bersama.js";

// Pemeriksaan golongan ABO/Rhesus & skrining antibodi pasien (KF-5): dicatat per permintaan (bukan atribut
// permanen pasien, aturan bisnis #5). Mencatat ulang setelah crossmatch tersimpan menandai crossmatch terkait
// untuk ditinjau ulang (KF-9, G11) sampai hasil baru dikonfirmasi lagi melalui pemeriksaan ulang.
const rute = express.Router({ mergeParams: true });

rute.post(
  "/",
  izinBdrs("Uji Silang Serasi", "CATAT PEMERIKSAAN"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    wajib(b, ["golongan_abo", "rhesus", "hasil_skrining_antibodi"]);
    const golonganAbo = cekPilihan(b.golongan_abo, GOLONGAN_ABO, "golongan_abo");
    const rhesus = cekPilihan(b.rhesus, RHESUS, "rhesus");
    const skrining = cekPilihan(b.hasil_skrining_antibodi, SKRINING_ANTIBODI, "hasil_skrining_antibodi");
    const catatan = teks(b.catatan);

    const hasil = await transaksi(async (k) => {
      const pm = await kunciPermintaan(req.params.uuid, faskes, k);
      if (!["diproses", "dipenuhi_sebagian"].includes(pm.status))
        throw new Galat(409, `Permintaan berstatus ${STATUS_PERMINTAAN[pm.status]}, pemeriksaan hanya dapat dicatat pada permintaan yang sedang diproses`);
      const sebelumnya = await satu(`SELECT uuid FROM bdrs_pemeriksaan WHERE permintaan_uuid = $1 AND deleted_at IS NULL`, [pm.uuid], k);
      if (sebelumnya) {
        // KF-9/G11: pencatatan ulang menandai crossmatch yang sudah ada agar ditinjau ulang sebelum dipakai serah terima.
        await k.query(
          `UPDATE bdrs_pemeriksaan SET golongan_abo = $1, rhesus = $2, hasil_skrining_antibodi = $3, catatan = $4,
             petugas = $5, waktu_periksa = extract(epoch from now())::bigint, updated_at = extract(epoch from now())::bigint
           WHERE uuid = $6`,
          [golonganAbo, rhesus, skrining, catatan, req.author.username ?? null, sebelumnya.uuid],
        );
        await k.query(
          `UPDATE bdrs_crossmatch SET status_validasi = 'perlu_tinjau', updated_at = extract(epoch from now())::bigint
            WHERE permintaan_uuid = $1 AND deleted_at IS NULL AND status_validasi = 'berlaku'`,
          [pm.uuid],
        );
      } else {
        await sisipkan(
          "bdrs_pemeriksaan",
          {
            faskes_uuid: faskes,
            permintaan_uuid: pm.uuid,
            patient_uuid: pm.patient_uuid,
            golongan_abo: golonganAbo,
            rhesus,
            hasil_skrining_antibodi: skrining,
            catatan,
            petugas: req.author.username ?? null,
            waktu_periksa: Math.floor(Date.now() / 1000),
          },
          k,
        );
      }
      return pm;
    });
    kirim(res, await detailPermintaan(hasil.uuid, faskes), "Hasil pemeriksaan golongan darah berhasil disimpan");
  }),
);

export default rute;
