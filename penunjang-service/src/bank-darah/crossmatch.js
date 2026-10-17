import express from "express";
import { satu, transaksi, uuidv7 } from "../db.js";
import { tangani, kirim, wajib, permintaanSalah, Galat } from "../umum/respons.js";
import { izinBdrs } from "../umum/izin.js";
import { kunciPermintaan, detailPermintaan } from "./permintaan.js";
import { HASIL_UJI, STATUS_PERMINTAAN, cekPilihan, teks } from "./bersama.js";

// Uji silang serasi (crossmatch) mayor & minor per kantong kandidat (KF-6/KF-7). Hanya kantong kompatibel &
// berlaku yang boleh dilanjutkan ke serah terima (bdrs_crossmatch.kompatibel + status_validasi, ditegakkan lagi
// saat serah terima dibuat). Status permintaan bergerak ke "dipenuhi_sebagian" bila kantong siap belum mencukupi
// jumlah yang diminta (KT-12), tanpa mengurangi stok (pengurangan baru terjadi saat serah terima selesai).
const rute = express.Router({ mergeParams: true });

rute.post(
  "/",
  izinBdrs("Uji Silang Serasi", "CATAT CROSSMATCH"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    wajib(b, ["stok_uuid", "hasil_mayor", "hasil_minor"]);
    const hasilMayor = cekPilihan(b.hasil_mayor, HASIL_UJI, "hasil_mayor");
    const hasilMinor = cekPilihan(b.hasil_minor, HASIL_UJI, "hasil_minor");
    const kompatibel = hasilMayor === "kompatibel" && hasilMinor === "kompatibel";
    const catatan = teks(b.catatan);
    const sekarangEpoch = Math.floor(Date.now() / 1000);

    const hasil = await transaksi(async (k) => {
      const pm = await kunciPermintaan(req.params.uuid, faskes, k);
      if (!["diproses", "dipenuhi_sebagian"].includes(pm.status))
        throw new Galat(409, `Permintaan berstatus ${STATUS_PERMINTAAN[pm.status]}, crossmatch hanya dapat dicatat pada permintaan yang sedang diproses`);
      const pemeriksaan = await satu(`SELECT uuid FROM bdrs_pemeriksaan WHERE permintaan_uuid = $1 AND deleted_at IS NULL`, [pm.uuid], k);
      if (!pemeriksaan) throw new Galat(409, "Catat pemeriksaan golongan darah pasien terlebih dahulu");
      const stok = await satu(`SELECT * FROM bdrs_stok WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [b.stok_uuid, faskes], k);
      if (!stok) throw permintaanSalah("Kantong darah tidak ditemukan");
      if (stok.komponen_uuid !== pm.komponen_uuid) throw permintaanSalah("Komponen kantong tidak sesuai dengan komponen yang diminta");
      if (stok.status !== "tersedia") throw new Galat(409, `Kantong berstatus tidak tersedia, tidak dapat di-crossmatch`);
      if (stok.tanggal_kedaluwarsa <= sekarangEpoch) throw new Galat(409, "Kantong sudah kedaluwarsa, tidak dapat di-crossmatch");

      await k.query(
        `INSERT INTO bdrs_crossmatch (uuid, faskes_uuid, permintaan_uuid, stok_uuid, hasil_mayor, hasil_minor, kompatibel,
            status_validasi, petugas, waktu_periksa, catatan, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'berlaku', $8, $9, $10, $9, $9)
         ON CONFLICT (faskes_uuid, permintaan_uuid, stok_uuid) WHERE deleted_at IS NULL
         DO UPDATE SET hasil_mayor = EXCLUDED.hasil_mayor, hasil_minor = EXCLUDED.hasil_minor, kompatibel = EXCLUDED.kompatibel,
           status_validasi = 'berlaku', petugas = EXCLUDED.petugas, waktu_periksa = EXCLUDED.waktu_periksa,
           catatan = EXCLUDED.catatan, updated_at = EXCLUDED.updated_at`,
        [uuidv7(), faskes, pm.uuid, b.stok_uuid, hasilMayor, hasilMinor, kompatibel, req.author.username ?? null, sekarangEpoch, catatan],
      );

      // Jumlah kantong siap = crossmatch kompatibel & berlaku, kantong masih tersedia (belum dipakai transaksi lain).
      const siap = await satu(
        `SELECT COUNT(*)::int n FROM bdrs_crossmatch c JOIN bdrs_stok s ON s.uuid = c.stok_uuid
          WHERE c.permintaan_uuid = $1 AND c.deleted_at IS NULL AND c.kompatibel AND c.status_validasi = 'berlaku'
            AND s.status = 'tersedia' AND s.tanggal_kedaluwarsa > $2`,
        [pm.uuid, sekarangEpoch],
        k,
      );
      if (["diproses", "dipenuhi_sebagian"].includes(pm.status)) {
        const statusBaru = siap.n > 0 && siap.n < pm.jumlah_diminta ? "dipenuhi_sebagian" : "diproses";
        await k.query(`UPDATE bdrs_permintaan SET jumlah_dipenuhi = $1, status = $2, updated_at = extract(epoch from now())::bigint WHERE uuid = $3`, [
          Math.min(siap.n, pm.jumlah_diminta),
          statusBaru,
          pm.uuid,
        ]);
      }
      return pm;
    });
    kirim(res, await detailPermintaan(hasil.uuid, faskes), "Hasil crossmatch berhasil disimpan");
  }),
);

export default rute;
