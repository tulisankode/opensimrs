import express from "express";
import { satu, sisipkan, ubah, sekarang, transaksi } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { izinAmbulans, punyaIzin } from "../umum/izin.js";
import { detailPermintaan, sembunyikanPendamping as sembunyikanPendampingDetail } from "./permintaan.js";
import { hitungBiaya, simpanBiaya, teruskanBiaya } from "./tagihan.js";
import { KOLOM_TAHAP, STATUS_ARMADA, TAHAP_PERJALANAN, konflik, hitungJarak, pastikanUrutanWaktu, teks } from "./bersama.js";

// Pencatatan perjalanan: mulai, tahapan (berangkat/tiba lokasi/berangkat tujuan/tiba tujuan/kembali), kilometer,
// BBM, catatan pendamping, serta penyelesaian (hitung jarak & biaya, update status armada/permintaan).
// Dipasang di akar router ambulans (lihat rute.js) karena path menggabungkan prefix /penugasan & /perjalanan.
const rute = express.Router();

const sembunyikanPendamping = async (req, perjalanan) => {
  if (!perjalanan) return perjalanan;
  const boleh = await punyaIzin(req, "Manajemen Ambulans", "Catatan Pendamping", "READ");
  return boleh ? perjalanan : { ...perjalanan, catatan_pendamping: undefined };
};

rute.post(
  "/penugasan/:uuid/perjalanan",
  izinAmbulans("Perjalanan", "CATAT TAHAP"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const r = await transaksi(async (k) => {
      const pn = await satu(`SELECT * FROM ambulans_penugasan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, faskes], k);
      if (!pn) throw tidakDitemukan("Penugasan ambulans");
      if (pn.status !== "aktif") throw konflik(`Penugasan berstatus ${pn.status}, tidak dapat memulai perjalanan`);
      const ada = await satu(`SELECT uuid FROM ambulans_perjalanan WHERE penugasan_uuid = $1 AND deleted_at IS NULL`, [pn.uuid], k);
      if (ada) throw konflik("Perjalanan untuk penugasan ini sudah dibuat");
      const perjalanan = await sisipkan("ambulans_perjalanan", { faskes_uuid: faskes, penugasan_uuid: pn.uuid, status: "berjalan" }, k);
      await ubah("ambulans_permintaan", pn.permintaan_uuid, faskes, { status: "proses" }, k);
      return perjalanan;
    });
    kirim(res, await sembunyikanPendamping(req, r), "Perjalanan dimulai");
  }),
);

rute.patch(
  "/perjalanan/:uuid/tahap",
  izinAmbulans("Perjalanan", "CATAT TAHAP"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["tahap"]);
    if (!TAHAP_PERJALANAN.includes(b.tahap)) throw permintaanSalah(`tahap harus salah satu: ${TAHAP_PERJALANAN.join(", ")}`);
    const faskes = req.author.faskesUuid;
    const r = await transaksi(async (k) => {
      const pj = await satu(`SELECT * FROM ambulans_perjalanan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, faskes], k);
      if (!pj) throw tidakDitemukan("Perjalanan ambulans");
      if (pj.status !== "berjalan") throw konflik(`Perjalanan berstatus ${pj.status}, tidak dapat dicatat`);
      const waktu = b.waktu ? Number(b.waktu) : sekarang();
      pastikanUrutanWaktu(pj, b.tahap, waktu);
      const perubahan = { [KOLOM_TAHAP[b.tahap]]: waktu };
      if (b.tahap === "berangkat") {
        if (b.km_awal === undefined) throw permintaanSalah("km_awal wajib diisi saat tahap berangkat");
        perubahan.km_awal = Number(b.km_awal);
      }
      if (b.tahap === "kembali" && b.km_akhir !== undefined) perubahan.km_akhir = Number(b.km_akhir);
      return ubah("ambulans_perjalanan", pj.uuid, faskes, perubahan, k);
    });
    kirim(res, await sembunyikanPendamping(req, r), `Tahap ${b.tahap} berhasil dicatat`);
  }),
);

// KT-12/KT-13/KT-14/KT-15/G4/G5: hitung jarak & biaya, selesaikan perjalanan+penugasan+permintaan, perbarui status
// armada. Penerusan biaya (HTTP ke Pembayaran) dijalankan SETELAH transaksi lokal commit (G6: kegagalan jaringan
// tidak boleh membatalkan penyelesaian perjalanan yang sudah valid).
rute.patch(
  "/perjalanan/:uuid/selesai",
  izinAmbulans("Perjalanan", "SELESAIKAN"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["km_akhir", "status_armada"]);
    if (!STATUS_ARMADA.includes(b.status_armada) || b.status_armada === "bertugas") throw permintaanSalah("status_armada harus siap atau servis");
    const faskes = req.author.faskesUuid;
    const { permintaanUuid, biaya } = await transaksi(async (k) => {
      const pj = await satu(`SELECT * FROM ambulans_perjalanan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, faskes], k);
      if (!pj) throw tidakDitemukan("Perjalanan ambulans");
      if (pj.status !== "berjalan") throw konflik(`Perjalanan berstatus ${pj.status}, tidak dapat diselesaikan`);
      if (pj.km_awal == null) throw permintaanSalah("Perjalanan belum mencatat tahap berangkat (km_awal)");
      const waktu = sekarang();
      pastikanUrutanWaktu(pj, "kembali", waktu);
      const jarak = hitungJarak(pj.km_awal, b.km_akhir);

      await ubah(
        "ambulans_perjalanan",
        pj.uuid,
        faskes,
        {
          kembali_pada: pj.kembali_pada ?? waktu,
          km_akhir: Number(b.km_akhir),
          jarak_km: jarak,
          bbm_nilai: b.bbm_nilai === undefined ? undefined : Number(b.bbm_nilai),
          bbm_satuan: b.bbm_satuan === undefined ? undefined : teks(b.bbm_satuan),
          catatan_pendamping: b.catatan_pendamping === undefined ? undefined : teks(b.catatan_pendamping),
          status: "selesai",
        },
        k,
      );
      const pn = await satu(`SELECT * FROM ambulans_penugasan WHERE uuid = $1 AND faskes_uuid = $2 FOR UPDATE`, [pj.penugasan_uuid, faskes], k);
      await ubah("ambulans_penugasan", pn.uuid, faskes, { status: "selesai" }, k);
      await ubah("ambulans_armada", pn.armada_uuid, faskes, { status: b.status_armada, diubah_status_oleh: req.author.username ?? null, diubah_status_pada: waktu }, k);
      const permintaan = await satu(`SELECT * FROM ambulans_permintaan WHERE uuid = $1 AND faskes_uuid = $2 FOR UPDATE`, [pn.permintaan_uuid, faskes], k);
      await ubah("ambulans_permintaan", permintaan.uuid, faskes, { status: "selesai" }, k);

      const hitung = await hitungBiaya(permintaan, jarak, teks(b.zona), k);
      const biayaRow = await simpanBiaya(permintaan, hitung, k);
      return { permintaanUuid: permintaan.uuid, biaya: biayaRow };
    });

    if (biaya.status_penerusan === "menunggu") {
      try {
        await teruskanBiaya(permintaanUuid, faskes, req);
      } catch {
        // Kegagalan penerusan sudah dicatat di ambulans_biaya oleh teruskanBiaya (status 'gagal'); tidak perlu gagalkan respons.
      }
    }
    kirim(res, await sembunyikanPendampingDetail(req, await detailPermintaan(permintaanUuid, faskes)), "Perjalanan selesai");
  }),
);

export default rute;
