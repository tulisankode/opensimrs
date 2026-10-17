import { query, satu, sisipkan, sekarang } from "../../db.js";
import { permintaanSalah, tidakDitemukan, Galat } from "../../umum/respons.js";
import { enkripsi, dekripsi, hashKunci, buatKunci, samarkan } from "./kripto.js";

// Koneksi UTD (bisa lebih dari satu per faskes) — pola sama dengan Bridging PACS/RIS (penunjang-service/src/pacs/pacs-service.js).
const TIMEOUT_MS = Number(process.env.BDRS_UTD_TIMEOUT_MS) || 15000;
export const timeoutMs = TIMEOUT_MS;

const validUrl = (u) => {
  try {
    const url = new URL(String(u));
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};
const bulat = (v, min, maks, bawaan) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(maks, Math.max(min, n)) : bawaan;
};

const tampilKoneksi = (k) => ({
  uuid: k.uuid,
  nama: k.nama,
  kode_rs: k.kode_rs,
  url_registrasi: k.url_registrasi,
  url_status: k.url_status ?? null,
  url_stok: k.url_stok ?? null,
  api_key: samarkan(dekripsi(k.api_key)),
  kunci_masuk: samarkan(dekripsi(k.kunci_masuk)),
  aktif: k.aktif,
  bawaan: k.bawaan,
  maks_paralel: k.maks_paralel,
  jeda_ms: k.jeda_ms,
  updated_at: k.updated_at,
});

export const daftarKoneksi = async (faskesUuid) =>
  (await query(`SELECT * FROM bdrs_utd_koneksi WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY bawaan DESC, nama`, [faskesUuid])).map(tampilKoneksi);

export const jadikanBawaan = async (faskesUuid, uuid) => {
  const ada = await satu(`SELECT 1 FROM bdrs_utd_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND aktif = true`, [uuid, faskesUuid]);
  if (!ada) throw permintaanSalah("Hanya koneksi aktif yang dapat dijadikan bawaan");
  await query(`UPDATE bdrs_utd_koneksi SET bawaan = (uuid = $2), updated_at = $3 WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [faskesUuid, uuid, sekarang()]);
  return (await daftarKoneksi(faskesUuid)).find((k) => k.uuid === uuid);
};

export const simpanKoneksi = async (faskesUuid, uuid, data) => {
  const nama = String(data?.nama ?? "").trim();
  if (!nama) throw permintaanSalah("Nama koneksi UTD wajib diisi");
  const urlRegistrasi = String(data?.url_registrasi ?? "").trim();
  if (!validUrl(urlRegistrasi)) throw permintaanSalah("URL Kirim Permintaan tidak valid (contoh: http://utd.contoh.id/permintaan)");
  const urlStatus = String(data?.url_status ?? "").trim() || null;
  if (urlStatus && !validUrl(urlStatus.replace(/\{no_registrasi\}/g, "x"))) throw permintaanSalah("URL Status tidak valid (contoh: http://utd.contoh.id/status/{no_registrasi})");
  const urlStok = String(data?.url_stok ?? "").trim() || null;
  if (urlStok && !validUrl(urlStok)) throw permintaanSalah("URL Cek Stok tidak valid");
  const kodeRs = String(data?.kode_rs ?? "").trim() || null;
  const apiKey = String(data?.api_key ?? "").trim();
  const maksParalel = bulat(data?.maks_paralel, 1, 10, 2);
  const jedaMs = bulat(data?.jeda_ms, 0, 60000, 0);
  const t = sekarang();
  let kunciBaru = null;
  let barisUuid = uuid;

  if (uuid) {
    const lama = await satu(`SELECT * FROM bdrs_utd_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid]);
    if (!lama) throw tidakDitemukan("Koneksi UTD");
    await query(
      `UPDATE bdrs_utd_koneksi SET nama = $3, kode_rs = $4, url_registrasi = $5, url_status = $6, url_stok = $7, api_key = $8,
              maks_paralel = $9, jeda_ms = $10, aktif = $11, updated_at = $12
       WHERE uuid = $1 AND faskes_uuid = $2`,
      [uuid, faskesUuid, nama, kodeRs, urlRegistrasi, urlStatus, urlStok, apiKey ? enkripsi(apiKey) : lama.api_key, maksParalel, jedaMs, data?.aktif !== false, t],
    );
  } else {
    kunciBaru = buatKunci();
    const baris = await sisipkan("bdrs_utd_koneksi", {
      faskes_uuid: faskesUuid,
      nama,
      kode_rs: kodeRs,
      url_registrasi: urlRegistrasi,
      url_status: urlStatus,
      url_stok: urlStok,
      api_key: enkripsi(apiKey),
      kunci_masuk: enkripsi(kunciBaru),
      kunci_masuk_hash: hashKunci(kunciBaru),
      aktif: data?.aktif !== false,
      bawaan: false,
      maks_paralel: maksParalel,
      jeda_ms: jedaMs,
    });
    barisUuid = baris.uuid;
    const jumlah = await satu(`SELECT COUNT(*)::int n FROM bdrs_utd_koneksi WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [faskesUuid]);
    if (jumlah.n === 1) await query(`UPDATE bdrs_utd_koneksi SET bawaan = true WHERE uuid = $1`, [barisUuid]);
  }
  if (data?.bawaan) await jadikanBawaan(faskesUuid, barisUuid);
  const hasil = (await daftarKoneksi(faskesUuid)).find((k) => k.uuid === barisUuid);
  return kunciBaru ? { ...hasil, kunci_masuk_baru: kunciBaru } : hasil;
};

export const buatUlangKunciMasuk = async (faskesUuid, uuid) => {
  const ada = await satu(`SELECT 1 FROM bdrs_utd_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid]);
  if (!ada) throw tidakDitemukan("Koneksi UTD");
  const kunci = buatKunci();
  await query(`UPDATE bdrs_utd_koneksi SET kunci_masuk = $3, kunci_masuk_hash = $4, updated_at = $5 WHERE uuid = $1 AND faskes_uuid = $2`, [
    uuid, faskesUuid, enkripsi(kunci), hashKunci(kunci), sekarang(),
  ]);
  return { uuid, kunci_masuk_baru: kunci };
};

export const hapusKoneksi = async (faskesUuid, uuid) => {
  await query(`UPDATE bdrs_utd_koneksi SET deleted_at = $3, aktif = false, bawaan = false, kunci_masuk_hash = NULL WHERE uuid = $1 AND faskes_uuid = $2`, [
    uuid, faskesUuid, sekarang(),
  ]);
  return { uuid };
};

// Koneksi aktif untuk mengirim: uuid diberikan secara eksplisit, atau koneksi bawaan bila ambigu (F12/KT-18).
export const koneksiUntukKirim = async (faskesUuid, uuid) => {
  const rows = await query(
    `SELECT * FROM bdrs_utd_koneksi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND aktif = true AND ($2::text IS NULL OR uuid = $2::text)
     ORDER BY bawaan DESC, nama`,
    [faskesUuid, uuid || null],
  );
  if (!rows.length) throw new Galat(409, uuid ? "Koneksi UTD tidak ditemukan atau nonaktif" : "Belum ada koneksi UTD aktif. Atur di Setting › Konfigurasi Integrasi › Konfigurasi Bank Darah/UTD.");
  if (!uuid && rows.length > 1 && !rows[0].bawaan) {
    const e = new Galat(409, "Lebih dari satu koneksi UTD aktif — pilih koneksi tujuan");
    e.koneksi = rows.map(tampilKoneksi);
    throw e;
  }
  return rows[0];
};

export const ambilKoneksi = async (faskesUuid, uuid) => {
  const k = await satu(`SELECT * FROM bdrs_utd_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid]);
  if (!k) throw tidakDitemukan("Koneksi UTD");
  return k;
};

export const ujiKoneksi = async (faskesUuid, uuid) => {
  const koneksi = await ambilKoneksi(faskesUuid, uuid);
  try {
    const res = await fetch(koneksi.url_registrasi, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": dekripsi(koneksi.api_key) ?? "" },
      body: JSON.stringify({ no_registrasi: "UJI-KONEKSI", uji: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { berhasil: res.status < 500, pesan: res.status < 500 ? `Koneksi berhasil dihubungi (HTTP ${res.status})` : `UTD mengembalikan galat server (HTTP ${res.status})`, status_http: res.status };
  } catch (error) {
    const waktuHabis = error?.name === "TimeoutError" || error?.name === "AbortError";
    return { berhasil: false, pesan: `Tidak dapat menghubungi UTD: ${waktuHabis ? "waktu habis" : error?.cause?.code ?? error.message}` };
  }
};

export { dekripsi, hashKunci };
