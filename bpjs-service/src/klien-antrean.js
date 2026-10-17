import jwt from "jsonwebtoken";
import config from "./config.js";
import { tandaTangan, GalatBpjs } from "./klien-pcare.js";

// Klien WS Antrean BPJS (Mobile JKN). Kontrak resmi (URL, payload, kode task id) belum terkonfirmasi — lihat
// catatan desain STD-0018 — sehingga modul ini membungkus dua hal yang sudah pasti dibutuhkan terlepas dari detail
// kontrak: (1) autentikasi masuk dipakai BPJS untuk memanggil endpoint kita, dan (2) pengiriman keluar
// (tambah antrean/task/batal) yang bisa diuji di mode mock tanpa menghubungi jaringan nyata.

// --- Autentikasi masuk (BPJS -> OpenSIMRS) ---------------------------------------------------------
// Pola sama dengan X-cons-id/X-timestamp/X-signature yang dipakai PCare/VClaim (lihat klien-pcare.js), dibalik:
// di sini OpenSIMRS yang memverifikasi tanda tangan BPJS memakai Cons ID/Secret Key milik faskes itu sendiri.
const TOLERANSI_TIMESTAMP_DETIK = 300;

export const signatureValid = (consId, secretKey, timestamp, signature) => {
  if (!consId || !secretKey || !timestamp || !signature) return false;
  const sekarangDetik = Math.floor(Date.now() / 1000);
  if (Math.abs(sekarangDetik - Number(timestamp)) > TOLERANSI_TIMESTAMP_DETIK) return false;
  return tandaTangan(consId, secretKey, timestamp) === signature;
};

// Token WS Antrean yang diterbitkan setelah /ws/token berhasil memverifikasi tanda tangan. Bukan token login
// (bukan JWT internal SECRET_KEY): kunci sendiri agar tidak tertukar dengan token auth-service, masa berlaku pendek.
export const terbitkanToken = (faskesUuid) =>
  jwt.sign({ faskesUuid, tipe: "ws-antrean" }, config.kunciRahasia, { algorithm: "HS256", expiresIn: config.antreanTokenKedaluwarsaDetik });

// Mengembalikan faskesUuid dari token yang valid, atau null. faskesUuid HANYA berasal dari token ini — tidak pernah
// dari body/query permintaan (KF-15/KT-11).
export const faskesDariToken = (token) => {
  try {
    const isi = jwt.verify(token, config.kunciRahasia, { algorithms: ["HS256"] });
    return isi?.tipe === "ws-antrean" && isi?.faskesUuid ? isi.faskesUuid : null;
  } catch {
    return null;
  }
};

// --- Pengiriman keluar (OpenSIMRS -> BPJS) ---------------------------------------------------------
const tiruan = (jenis, payload) => ({
  metaData: { code: "200", message: "Sukses (mode mock)" },
  response: { jenis, diterima: true, kodebooking: payload?.kodebooking ?? payload?.kode_booking ?? null },
});

// jenis: "tambah_antrean" | "task" | "batal"
export const kirimWsAntrean = async (kred, jenis, jalur, payload) => {
  if (kred.mode !== "nyata") return tiruan(jenis, payload);

  const timestamp = Math.floor(Date.now() / 1000);
  const url = `${String(kred.baseUrl).replace(/\/+$/, "")}/${String(jalur).replace(/^\/+/, "")}`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-cons-id": kred.consId,
        "X-timestamp": String(timestamp),
        "X-signature": tandaTangan(kred.consId, kred.secretKey, timestamp),
        user_key: kred.userKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    throw new GalatBpjs(`Gagal menghubungi WS Antrean BPJS: ${error.message}`, 502);
  }
  const teks = await res.text();
  let json;
  try {
    json = JSON.parse(teks);
  } catch {
    throw new GalatBpjs(`Respons WS Antrean bukan JSON (status ${res.status})`, 502);
  }
  const kode = String(json?.metaData?.code ?? json?.metadata?.code ?? "");
  if (kode !== "200" && kode !== "201") {
    throw new GalatBpjs(json?.metaData?.message || json?.metadata?.message || `Galat WS Antrean (kode ${kode})`, res.status || 502, json);
  }
  return json;
};
