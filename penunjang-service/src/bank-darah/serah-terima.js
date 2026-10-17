import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { izinBdrs, pastikanIzin } from "../umum/izin.js";
import { kunciPermintaan, detailPermintaan } from "./permintaan.js";
import { ambilPengaturan } from "./pengaturan.js";
import { kirimTagihan } from "../umum/tagihan.js";

// Serah terima kantong ke ruangan (KF-15/KF-16/KF-17): mensyaratkan konfirmasi dua akun pengguna berbeda
// (penyerah BDRS & penerima ruangan). Kantong dikunci ("dialokasikan") sejak transaksi dibuat agar tidak dapat
// dipakai transaksi lain (G9); stok baru benar-benar berkurang (status "diserahkan") setelah kedua konfirmasi
// lengkap, dalam satu transaksi DB (NFR-1). Biaya pengolahan & crossmatch dikirim ke tagihan kunjungan SETELAH
// transaksi klinis tersimpan, agar kegagalan integrasi tagihan tidak membatalkan serah terima (NFR-5).

const KOLOM = `
  st.uuid, st.permintaan_uuid, st.petugas_penyerah, st.waktu_konfirmasi_penyerah, st.petugas_penerima,
  st.waktu_konfirmasi_penerima, st.status, st.status_tagihan, st.pesan_tagihan, st.created_at, st.updated_at`;

const detailSerahTerima = async (uuid, faskes, k) => {
  const st = await satu(`SELECT ${KOLOM} FROM bdrs_serah_terima st WHERE st.uuid = $1 AND st.faskes_uuid = $2 AND st.deleted_at IS NULL`, [uuid, faskes], k);
  if (!st) throw tidakDitemukan("Transaksi serah terima");
  const items = await query(
    `SELECT i.uuid, i.stok_uuid, s.no_kantong, s.golongan_abo, s.rhesus, s.komponen_uuid, i.crossmatch_uuid
       FROM bdrs_serah_terima_item i JOIN bdrs_stok s ON s.uuid = i.stok_uuid
      WHERE i.serah_terima_uuid = $1 AND i.deleted_at IS NULL ORDER BY i.created_at`,
    [st.uuid],
    k,
  );
  return { ...st, items };
};

const kunciSerahTerima = async (uuid, faskes, k) => {
  const st = await satu(`SELECT * FROM bdrs_serah_terima WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [uuid, faskes], k);
  if (!st) throw tidakDitemukan("Transaksi serah terima");
  return st;
};

// Kirim komponen biaya pengolahan & crossmatch ke tagihan kunjungan permintaan ini (ref unik per transaksi serah
// terima, idempoten bila dikirim ulang — lihat umum/tagihan.js).
const kirimTagihanSerahTerima = async (st, pm, faskes, req) => {
  const pengaturan = await ambilPengaturan(faskes);
  const jumlahKantong = (await query(`SELECT COUNT(*)::int n FROM bdrs_serah_terima_item WHERE serah_terima_uuid = $1 AND deleted_at IS NULL`, [st.uuid]))[0].n;
  const items = [];
  if (Number(pengaturan.tarif_pengolahan) > 0)
    items.push({ item_name: `BDRS: Pengolahan Darah (${pm.no_permintaan})`, price: Number(pengaturan.tarif_pengolahan), qty: jumlahKantong, additional_info: { no_permintaan: pm.no_permintaan } });
  if (Number(pengaturan.tarif_crossmatch) > 0)
    items.push({ item_name: `BDRS: Uji Silang Serasi (${pm.no_permintaan})`, price: Number(pengaturan.tarif_crossmatch), qty: jumlahKantong, additional_info: { no_permintaan: pm.no_permintaan } });
  if (!items.length) return { dikirim: false, total: 0 };
  return kirimTagihan({
    faskesUuid: faskes,
    patientUuid: pm.patient_uuid,
    noReg: pm.no_reg,
    paymentMethod: 1,
    ref: `bdrs:${st.uuid}`,
    items,
    token: req.author.token,
    apsType: "BDRS",
    apsServiceName: "Bank Darah RS",
    apsServiceCode: pm.no_permintaan,
    apsLayananUuid: pm.uuid,
  });
};

// ── Dibuat dari /permintaan/:uuid/serah-terima (mergeParams) ───────────────────
export const buatSerahTerima = express.Router({ mergeParams: true });

buatSerahTerima.post(
  "/",
  izinBdrs("Serah Terima", "KONFIRMASI PENYERAH"),
  tangani(async (req, res) => {
    const stokUuids = [...new Set((req.body?.stok_uuids ?? []).filter(Boolean))];
    if (!stokUuids.length) throw permintaanSalah("Pilih minimal satu kantong untuk diserahkan");
    const faskes = req.author.faskesUuid;

    const st = await transaksi(async (k) => {
      const pm = await kunciPermintaan(req.params.uuid, faskes, k);
      if (!["diproses", "dipenuhi_sebagian"].includes(pm.status)) throw new Galat(409, "Permintaan tidak dalam status siap diserahkan");
      const sudahDiserahkan = (
        await satu(
          `SELECT COUNT(*)::int n FROM bdrs_serah_terima_item i JOIN bdrs_serah_terima st ON st.uuid = i.serah_terima_uuid
            WHERE st.permintaan_uuid = $1 AND st.status = 'selesai' AND i.deleted_at IS NULL`,
          [pm.uuid],
          k,
        )
      ).n;
      if (sudahDiserahkan + stokUuids.length > pm.jumlah_diminta) throw permintaanSalah(`Jumlah kantong melebihi sisa permintaan (sisa ${pm.jumlah_diminta - sudahDiserahkan})`);

      // Kunci baris stok & pastikan masih tersedia (mencegah dua transaksi memperebutkan kantong yang sama).
      const stokRows = await query(`SELECT * FROM bdrs_stok WHERE uuid = ANY($1) AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [stokUuids, faskes], k);
      if (stokRows.length !== stokUuids.length) throw permintaanSalah("Sebagian kantong tidak ditemukan");
      const tidakTersedia = stokRows.filter((s) => s.status !== "tersedia");
      if (tidakTersedia.length) throw new Galat(409, `Kantong ${tidakTersedia.map((s) => s.no_kantong).join(", ")} sudah tidak tersedia`);
      const sekarangEpoch = Math.floor(Date.now() / 1000);
      const kedaluwarsa = stokRows.filter((s) => s.tanggal_kedaluwarsa <= sekarangEpoch);
      if (kedaluwarsa.length) throw new Galat(409, `Kantong ${kedaluwarsa.map((s) => s.no_kantong).join(", ")} sudah kedaluwarsa`);

      const crossmatchRows = await query(
        `SELECT * FROM bdrs_crossmatch WHERE permintaan_uuid = $1 AND stok_uuid = ANY($2) AND deleted_at IS NULL`,
        [pm.uuid, stokUuids],
        k,
      );
      for (const s of stokRows) {
        const c = crossmatchRows.find((x) => x.stok_uuid === s.uuid);
        if (!c || !c.kompatibel || c.status_validasi !== "berlaku") throw new Galat(409, `Kantong ${s.no_kantong} belum dinyatakan kompatibel/berlaku untuk diserahkan`);
      }

      await query(`UPDATE bdrs_stok SET status = 'dialokasikan', updated_at = $2 WHERE uuid = ANY($1)`, [stokUuids, sekarangEpoch], k);
      const header = await sisipkan("bdrs_serah_terima", { faskes_uuid: faskes, permintaan_uuid: pm.uuid, status: "menunggu", status_tagihan: "belum" }, k);
      for (const s of stokRows) {
        const c = crossmatchRows.find((x) => x.stok_uuid === s.uuid);
        await sisipkan("bdrs_serah_terima_item", { faskes_uuid: faskes, serah_terima_uuid: header.uuid, stok_uuid: s.uuid, crossmatch_uuid: c.uuid }, k);
      }
      return header;
    });
    kirim(res, await detailSerahTerima(st.uuid, faskes), "Transaksi serah terima dibuat, menunggu konfirmasi penyerah & penerima");
  }),
);

// ── Router utama (mounted di /serah-terima) ────────────────────────────────────
const rute = express.Router();

rute.get(
  "/",
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const p = [faskes];
    let w = "st.faskes_uuid = $1 AND st.deleted_at IS NULL";
    if (req.query.status) {
      p.push(req.query.status);
      w += ` AND st.status = $${p.length}`;
    }
    if (req.query.permintaan_uuid) {
      p.push(req.query.permintaan_uuid);
      w += ` AND st.permintaan_uuid = $${p.length}`;
    }
    const rows = await query(
      `SELECT ${KOLOM}, pm.no_permintaan, pm.patient_uuid, p.name AS nama_pasien, pm.no_rm
         FROM bdrs_serah_terima st
         JOIN bdrs_permintaan pm ON pm.uuid = st.permintaan_uuid
         LEFT JOIN patients p ON p.uuid = pm.patient_uuid
        WHERE ${w} ORDER BY st.created_at DESC LIMIT 200`,
      p,
    );
    kirim(res, rows);
  }),
);

rute.get("/:uuid", tangani(async (req, res) => kirim(res, await detailSerahTerima(req.params.uuid, req.author.faskesUuid))));

rute.post(
  "/:uuid/konfirmasi",
  tangani(async (req, res) => {
    const peran = String(req.body?.peran ?? "");
    if (!["penyerah", "penerima"].includes(peran)) throw permintaanSalah("peran harus penyerah atau penerima");
    if (req.body?.verifikasi_pasien !== true || req.body?.verifikasi_nomor_kantong !== true)
      throw permintaanSalah("Verifikasi identitas pasien dan nomor kantong wajib dicentang sebelum konfirmasi");
    await pastikanIzin(req, "Bank Darah RS (BDRS)", "Serah Terima", peran === "penyerah" ? "KONFIRMASI PENYERAH" : "KONFIRMASI PENERIMA");
    const faskes = req.author.faskesUuid;
    const username = req.author.username ?? null;

    const hasil = await transaksi(async (k) => {
      const st = await kunciSerahTerima(req.params.uuid, faskes, k);
      if (st.status !== "menunggu") throw new Galat(409, `Transaksi berstatus ${st.status}, tidak dapat dikonfirmasi`);
      const kolom = peran === "penyerah" ? "petugas_penyerah" : "petugas_penerima";
      const kolomLawan = peran === "penyerah" ? "petugas_penerima" : "petugas_penyerah";
      if (st[kolom] && st[kolom] !== username) throw new Galat(409, `Sudah dikonfirmasi petugas ${peran} lain (${st[kolom]})`);
      if (st[kolomLawan] && st[kolomLawan] === username) throw permintaanSalah("Petugas penyerah dan penerima harus akun yang berbeda");

      const perubahan = { [kolom]: username, [`waktu_konfirmasi_${peran}`]: sekarang() };
      let header = await ubah("bdrs_serah_terima", st.uuid, faskes, perubahan, k);
      const keduaBelumLengkap = !header.petugas_penyerah || !header.petugas_penerima;
      let pm = null;
      if (!keduaBelumLengkap) {
        const items = await query(`SELECT * FROM bdrs_serah_terima_item WHERE serah_terima_uuid = $1 AND deleted_at IS NULL`, [st.uuid], k);
        const stokUuids = items.map((i) => i.stok_uuid);
        const stokRows = await query(`SELECT * FROM bdrs_stok WHERE uuid = ANY($1) AND faskes_uuid = $2 FOR UPDATE`, [stokUuids, faskes], k);
        const belumDialokasikan = stokRows.filter((s) => s.status !== "dialokasikan");
        if (belumDialokasikan.length) throw new Galat(409, "Sebagian kantong sudah tidak dalam status dialokasikan, konfirmasi dibatalkan");
        await query(`UPDATE bdrs_stok SET status = 'diserahkan', updated_at = $2 WHERE uuid = ANY($1)`, [stokUuids, sekarang()], k);
        header = await ubah("bdrs_serah_terima", st.uuid, faskes, { status: "selesai" }, k);

        pm = await kunciPermintaan(st.permintaan_uuid, faskes, k);
        const totalDiserahkan = (
          await satu(
            `SELECT COUNT(*)::int n FROM bdrs_serah_terima_item i JOIN bdrs_serah_terima st2 ON st2.uuid = i.serah_terima_uuid
              WHERE st2.permintaan_uuid = $1 AND st2.status = 'selesai' AND i.deleted_at IS NULL`,
            [pm.uuid],
            k,
          )
        ).n;
        const statusPermintaan = totalDiserahkan >= pm.jumlah_diminta ? "diserahkan" : "dipenuhi_sebagian";
        await ubah("bdrs_permintaan", pm.uuid, faskes, { jumlah_dipenuhi: Math.min(totalDiserahkan, pm.jumlah_diminta), status: statusPermintaan }, k);
      }
      return { header, selesai: !keduaBelumLengkap, pm: pm ?? (await satu(`SELECT * FROM bdrs_permintaan WHERE uuid = $1`, [st.permintaan_uuid], k)) };
    });

    if (hasil.selesai) {
      try {
        const tagihan = await kirimTagihanSerahTerima(hasil.header, hasil.pm, faskes, req);
        await ubah("bdrs_serah_terima", hasil.header.uuid, faskes, { status_tagihan: tagihan.dikirim ? "terkirim" : "belum", pesan_tagihan: null });
      } catch (e) {
        await ubah("bdrs_serah_terima", hasil.header.uuid, faskes, { status_tagihan: "gagal", pesan_tagihan: e.message });
      }
    }
    kirim(res, await detailSerahTerima(req.params.uuid, faskes), hasil.selesai ? "Serah terima selesai, stok berkurang" : "Konfirmasi tersimpan, menunggu pihak lain");
  }),
);

// Batal transaksi yang masih menunggu konfirmasi: lepas kembali kunci kantong ke status tersedia.
rute.post(
  "/:uuid/batal",
  izinBdrs("Serah Terima", "KONFIRMASI PENYERAH"),
  tangani(async (req, res) => {
    const alasan = String(req.body?.alasan ?? "").trim();
    if (!alasan) throw permintaanSalah("alasan wajib diisi");
    const faskes = req.author.faskesUuid;
    await transaksi(async (k) => {
      const st = await kunciSerahTerima(req.params.uuid, faskes, k);
      if (st.status !== "menunggu") throw new Galat(409, `Transaksi berstatus ${st.status}, tidak dapat dibatalkan`);
      const items = await query(`SELECT stok_uuid FROM bdrs_serah_terima_item WHERE serah_terima_uuid = $1 AND deleted_at IS NULL`, [st.uuid], k);
      await query(`UPDATE bdrs_stok SET status = 'tersedia', updated_at = $2 WHERE uuid = ANY($1)`, [items.map((i) => i.stok_uuid), sekarang()], k);
      await query(`UPDATE bdrs_serah_terima_item SET deleted_at = $2 WHERE serah_terima_uuid = $1 AND deleted_at IS NULL`, [st.uuid, sekarang()], k);
      await ubah("bdrs_serah_terima", st.uuid, faskes, { status: "batal" }, k);
    });
    kirim(res, { uuid: req.params.uuid, alasan }, "Transaksi serah terima dibatalkan, kantong kembali tersedia");
  }),
);

// Kirim ulang tagihan bila percobaan sebelumnya gagal/belum terkirim (NFR-5).
rute.post(
  "/:uuid/tagihan/kirim-ulang",
  izinBdrs("Serah Terima", "KONFIRMASI PENYERAH"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const st = await satu(`SELECT * FROM bdrs_serah_terima WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, faskes]);
    if (!st) throw tidakDitemukan("Transaksi serah terima");
    if (st.status !== "selesai") throw new Galat(409, "Tagihan hanya dapat dikirim untuk transaksi yang sudah selesai");
    const pm = await satu(`SELECT * FROM bdrs_permintaan WHERE uuid = $1`, [st.permintaan_uuid]);
    try {
      const tagihan = await kirimTagihanSerahTerima(st, pm, faskes, req);
      await ubah("bdrs_serah_terima", st.uuid, faskes, { status_tagihan: tagihan.dikirim ? "terkirim" : "belum", pesan_tagihan: null });
    } catch (e) {
      await ubah("bdrs_serah_terima", st.uuid, faskes, { status_tagihan: "gagal", pesan_tagihan: e.message });
    }
    kirim(res, await detailSerahTerima(st.uuid, faskes), "Pengiriman tagihan dicoba ulang");
  }),
);

export default rute;
