import { dekripsi, timeoutMs } from "./utd-koneksi.js";
import { mappingSatu } from "./utd-peta.js";
import { Galat } from "../../umum/respons.js";
import { penjaminKunjungan } from "../../umum/kunjungan.js";

// Adapter kontrak REST generik ke UTD — kontrak didokumentasikan bersama scripts/utd-tiruan.mjs (README di
// scripts/README-utd-tiruan.md). Satu lapisan adapter agar konektor mitra nyata kelak hanya mengganti berkas ini,
// tanpa mengubah utd-service.js/utd-hasil.js (Rancangan Teknis STD-0017 §1/§10).
const strip = (v) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());

const jenisKelamin = (g) => {
  const s = String(g ?? "").toLowerCase();
  if (["female", "p", "perempuan", "f"].includes(s)) return "P";
  if (["male", "l", "laki-laki", "laki", "m"].includes(s)) return "L";
  return "-";
};

/**
 * Bangun payload minimum kontrak generik (KF-6): tidak memuat NIK, alamat, telepon, atau diagnosis lengkap.
 * Melempar Galat 422 bila komponen belum dipetakan (KF-7/KT-5) — ditangkap sebelum baris pengiriman dibuat.
 */
export const buatPayloadPermintaan = async (faskesUuid, permintaan, koneksi, noRegistrasi) => {
  const mapKomponen = await mappingSatu(faskesUuid, "komponen", koneksi.uuid, permintaan.komponen_uuid);
  if (!mapKomponen) throw new Galat(422, `Komponen "${permintaan.komponen_nama ?? permintaan.komponen_uuid}" belum dipetakan ke kode UTD (Bank Darah › Mapping UTD)`);
  // bdrs_permintaan tidak menyimpan penjamin: diambil dari kunjungan asal permintaan (no_reg), lalu dipetakan ke kode UTD.
  const penjamin = await penjaminKunjungan(permintaan.no_reg, faskesUuid);
  const [mapUnit, mapDokter, mapPenjamin] = await Promise.all([
    mappingSatu(faskesUuid, "unit", koneksi.uuid, permintaan.lokasi_asal_uuid),
    mappingSatu(faskesUuid, "dokter", koneksi.uuid, permintaan.dokter_peminta_uuid),
    mappingSatu(faskesUuid, "penjamin", koneksi.uuid, penjamin?.uuid ?? null),
  ]);
  const golonganAbo = permintaan.pemeriksaan?.golongan_abo ?? permintaan.golongan_diminta ?? null;
  const rhesus = permintaan.pemeriksaan?.rhesus ?? permintaan.rhesus_diminta ?? null;
  return {
    no_permintaan: permintaan.no_permintaan,
    no_registrasi: noRegistrasi,
    kode_rs: strip(koneksi.kode_rs),
    pasien: {
      no_rm: strip(permintaan.no_rm),
      nama: strip(permintaan.nama_pasien),
      tanggal_lahir: permintaan.birth_date ?? null,
      jenis_kelamin: jenisKelamin(permintaan.gender),
      golongan_abo: golonganAbo,
      rhesus,
    },
    komponen: { kode_utd: mapKomponen.kode_utd, jumlah: permintaan.jumlah_diminta },
    cito: !!permintaan.cito,
    unit_asal: mapUnit ? { kode_utd: mapUnit.kode_utd } : null,
    dokter_peminta: mapDokter ? { kode_utd: mapDokter.kode_utd } : null,
    penjamin: mapPenjamin ? { kode_utd: mapPenjamin.kode_utd } : null,
    indikasi: strip(permintaan.indikasi),
  };
};

const GALAT_BELUM_TERKIRIM = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH", "UND_ERR_CONNECT_TIMEOUT"]);

const pesanGalatUtd = (json, status) => {
  if (typeof json?.message === "string" && json.message) return json.message;
  return `UTD menolak permintaan (HTTP ${status})`;
};

/** Kirim payload ke URL registrasi UTD. "pasti" = kegagalan yang dapat dipastikan terjadi sebelum sampai ke UTD. */
export const kirimKeUtd = async (koneksi, payload) => {
  try {
    const res = await fetch(koneksi.url_registrasi, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": dekripsi(koneksi.api_key) ?? "" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const teks = await res.text();
    let json;
    try {
      json = JSON.parse(teks);
    } catch {
      json = { success: false, message: `Respons UTD bukan JSON (HTTP ${res.status})` };
    }
    const generik = [502, 503, 504].includes(res.status) || (res.status === 500 && json?.success === undefined);
    return { ok: res.ok && json?.success !== false, status: res.status, json, pasti: !generik };
  } catch (error) {
    const kode = error?.cause?.code ?? error?.code;
    const waktuHabis = error?.name === "TimeoutError" || error?.name === "AbortError";
    return {
      ok: false,
      status: 0,
      json: { success: false, message: `UTD tidak dapat dihubungi: ${waktuHabis ? "waktu habis menunggu respons" : kode || error.message}` },
      pasti: !waktuHabis && GALAT_BELUM_TERKIRIM.has(kode),
    };
  }
};

export const pesanGalat = pesanGalatUtd;

/** Ambil status/kantong terkini dari UTD (tarik manual atau Cek Status). */
export const ambilStatusUtd = async (koneksi, noRegistrasi) => {
  if (!koneksi.url_status) throw new Galat(422, `URL Status belum diatur di koneksi UTD ${koneksi.nama}`);
  const url = /\{no_registrasi\}/.test(koneksi.url_status)
    ? koneksi.url_status.replace(/\{no_registrasi\}/g, encodeURIComponent(noRegistrasi))
    : `${koneksi.url_status}${koneksi.url_status.includes("?") ? "&" : "?"}no_registrasi=${encodeURIComponent(noRegistrasi)}`;
  const res = await fetch(url, { headers: { Accept: "application/json", "x-api-key": dekripsi(koneksi.api_key) ?? "" }, signal: AbortSignal.timeout(timeoutMs) });
  const teks = await res.text();
  let json;
  try {
    json = JSON.parse(teks);
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
};

/** Cek stok UTD (KF-13), hanya bila url_stok dikonfigurasi. */
export const cekStokUtd = async (koneksi, { golongan_abo, rhesus, kode_komponen } = {}) => {
  if (!koneksi.url_stok) throw new Galat(422, `URL Cek Stok belum diatur di koneksi UTD ${koneksi.nama}`);
  const qs = new URLSearchParams(Object.fromEntries(Object.entries({ golongan_abo, rhesus, kode_komponen }).filter(([, v]) => v)));
  const url = `${koneksi.url_stok}${koneksi.url_stok.includes("?") ? "&" : "?"}${qs.toString()}`;
  const res = await fetch(url, { headers: { Accept: "application/json", "x-api-key": dekripsi(koneksi.api_key) ?? "" }, signal: AbortSignal.timeout(timeoutMs) });
  const teks = await res.text();
  let json;
  try {
    json = JSON.parse(teks);
  } catch {
    throw new Galat(502, `Respons UTD bukan JSON (HTTP ${res.status})`);
  }
  if (!res.ok || json?.success === false) throw new Galat(502, pesanGalatUtd(json, res.status));
  return json?.payload ?? json;
};
