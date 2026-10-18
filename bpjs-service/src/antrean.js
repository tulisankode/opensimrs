import config from "./config.js";
import { query, satu, sekarang } from "./db.js";
import { enkripsi, dekripsi, samarkan } from "./rahasia.js";

// Konfigurasi WS Antrean BPJS (Mobile JKN) per faskes — satu baris per faskes di `integrations`, pola sama dengan
// pcare_*/vclaim_* (lihat pcare.js). Fitur katalog "antrian_online_bpjs" (mati bawaan) harus diaktifkan superadmin
// di Setting › Manajemen Modul sebelum konfigurasi ini berarti; endpoint WS tetap memeriksa `aktif` di sini.

export class DataBelumLengkap extends Error {
  status = 422;
}

const barisKonfigurasi = (faskesUuid) =>
  satu(
    `SELECT id, antrean_bpjs_aktif, antrean_bpjs_mode, antrean_bpjs_base_url, antrean_bpjs_cons_id,
            antrean_bpjs_secret_key, antrean_bpjs_user_key
     FROM integrations WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`,
    [faskesUuid]
  );

export const kredensial = async (faskesUuid) => {
  const k = await barisKonfigurasi(faskesUuid);
  return {
    aktif: !!k?.antrean_bpjs_aktif,
    mode: k?.antrean_bpjs_mode === "nyata" ? "nyata" : "mock",
    baseUrl: k?.antrean_bpjs_base_url?.trim() || null,
    consId: k?.antrean_bpjs_cons_id?.trim() || null,
    secretKey: dekripsi(k?.antrean_bpjs_secret_key)?.trim() || null,
    userKey: dekripsi(k?.antrean_bpjs_user_key)?.trim() || null,
  };
};

const lengkap = (k) => k.mode === "mock" || !!(k.baseUrl && k.consId && k.secretKey && k.userKey);

export const konfigurasiTersamar = async (faskesUuid) => {
  const k = await kredensial(faskesUuid);
  return {
    aktif: k.aktif,
    mode: k.mode,
    baseUrl: k.baseUrl ?? "",
    consId: k.consId ?? "",
    secretKey: samarkan(k.secretKey),
    userKey: samarkan(k.userKey),
    lengkap: lengkap(k),
  };
};

// Kredensial siap dipakai (dipanggil oleh antrean-service sebelum mengirim/memverifikasi WS). Baris integrations
// faskes wajib sudah ada (dibuat saat Setting › Konfigurasi Integrasi pertama kali dibuka).
export const kredensialSiap = async (faskesUuid) => {
  const k = await kredensial(faskesUuid);
  if (!k.aktif) throw new DataBelumLengkap("Fitur Antrean Online BPJS belum aktif untuk faskes ini");
  if (!lengkap(k)) throw new DataBelumLengkap("Konfigurasi WS Antrean BPJS belum lengkap (URL, Cons ID, Secret Key, User Key)");
  return k;
};

export const simpanKonfigurasi = async (faskesUuid, data) => {
  const baris = await barisKonfigurasi(faskesUuid);
  if (!baris) throw new DataBelumLengkap("Data integrasi faskes belum ada; buka Setting › Konfigurasi Integrasi sekali dulu");
  const teks = (v) => (v == null ? null : String(v).trim());
  const rahasia = (baru, lama) => (teks(baru) ? enkripsi(teks(baru)) : lama);
  const mode = data.mode === "nyata" ? "nyata" : "mock";
  await query(
    `UPDATE integrations SET
       antrean_bpjs_aktif = $2, antrean_bpjs_mode = $3, antrean_bpjs_base_url = $4, antrean_bpjs_cons_id = $5,
       antrean_bpjs_secret_key = $6, antrean_bpjs_user_key = $7, updated_at = $8
     WHERE id = $1`,
    [
      baris.id,
      !!data.aktif,
      mode,
      teks(data.baseUrl) || null,
      teks(data.consId) || null,
      rahasia(data.secretKey, baris.antrean_bpjs_secret_key),
      rahasia(data.userKey, baris.antrean_bpjs_user_key),
      sekarang(),
    ]
  );
  return konfigurasiTersamar(faskesUuid);
};

// Dipakai endpoint /ws/token untuk mencocokkan Cons ID yang dikirim BPJS dengan faskes pemiliknya (konteks faskes
// diturunkan dari kredensial yang cocok, bukan dari isi permintaan — KT-11).
export const faskesDariConsId = async (consId) => {
  if (!consId) return null;
  const baris = await satu(
    `SELECT faskes_uuid FROM integrations WHERE antrean_bpjs_cons_id = $1 AND antrean_bpjs_aktif = true AND deleted_at IS NULL LIMIT 1`,
    [consId]
  );
  return baris?.faskes_uuid ?? null;
};
