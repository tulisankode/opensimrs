import config from "../config.js";
import { query } from "../db.js";
import { tangani, kirim, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { konflik } from "./bersama.js";
import { panggilLayanan } from "../umum/layanan.js";
import { izinMcu } from "../umum/izin.js";
import { detailPeserta } from "./peserta.js";
import express from "express";

// STD-0020 — MCU PCare (BPJS): pelaporan hasil MCU peserta JKN ke layanan MCU PCare. Pengiriman nyata hanya
// lewat bpjs-service (klien PCare & tanda tangan baku, lihat bpjs-service/src/pcare.js#operasiMcu); modul ini
// hanya memetakan & memvalidasi data lokal, lalu meneruskan permintaan. Status tersimpan di mcu_pcare_kirim
// (ditulis oleh bpjs-service) — di sini hanya dibaca untuk status (sama dengan pola lab_lis_kirim pada
// penunjang-service/src/mcu/peserta.js#DARI_LIS).

// Status fitur mcu_pcare dari Setting › Manajemen Modul & Fitur. null/gagal dianggap tidak aktif (fail-closed,
// sama dengan pacs/izin.js & bank-darah/utd/izin.js) karena integrasi ini mengirim data pemeriksaan klinis ke BPJS.
export const fiturMcuPcareAktif = async (token) => {
  try {
    const res = await fetch(`${config.settingUrl}/modul`, {
      signal: AbortSignal.timeout(5000),
      headers: token ? { Authorization: token } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const aktif = data?.payload?.fitur_aktif;
    return Array.isArray(aktif) && aktif.includes("mcu_pcare");
  } catch (error) {
    console.warn("[mcu-pcare] Gagal membaca status fitur mcu_pcare:", error.message);
    return false;
  }
};

export const wajibFiturMcuPcareAktif = async (req, res, next) => {
  if (!(await fiturMcuPcareAktif(req.author?.token))) {
    return res.status(403).json({ message: "Fitur MCU PCare (BPJS) belum diaktifkan untuk faskes ini (Setting › Manajemen Modul)" });
  }
  next();
};

// ── Pemetaan & validasi nilai (KF-3/KF-4/KT-6/KT-7) ──────────────────────────────────────────────
// Sumber lokal: stasiun "tanda_vital" (mcu_pemeriksaan.data) & hasil laboratorium order lab (observation_item,
// nama dicocokkan dengan pola yang sama dipakai laporan.js#temuanPeserta). Pemeriksaan yang tidak dilakukan /
// tidak ditemukan tetap null — tidak boleh diperkirakan (KF-4).
const CARI_GULA_DARAH = /glukosa darah|gula darah/i;
const CARI_KOLESTEROL = /kolesterol total|^kolesterol$/i;

// Angka di awal hasil lab ("120", "120,5", "120 mg/dL" → 120 / 120.5); selain itu null — tidak ditebak.
export const angkaHasilLab = (hasil) => {
  const m = String(hasil ?? "").trim().match(/^(\d+(?:[.,]\d+)?)(?!\d)/);
  return m ? Number(m[1].replace(",", ".")) : null;
};

export const petakanNilaiMcu = (detail) => {
  const tv = detail.stasiun?.find((s) => s.kode === "tanda_vital")?.data ?? {};
  const hasilLab = detail.laboratorium?.hasil ?? [];
  const cariLab = (pola) => hasilLab.find((h) => pola.test(h.nama ?? "") && String(h.hasil ?? "").trim() !== "");
  const gula = cariLab(CARI_GULA_DARAH);
  const kolesterol = cariLab(CARI_KOLESTEROL);
  return {
    sistole: tv.sistole ?? null,
    diastole: tv.diastole ?? null,
    berat_badan: tv.berat_badan ?? null,
    tinggi_badan: tv.tinggi_badan ?? null,
    lingkar_perut: tv.lingkar_perut ?? null,
    gula_darah: gula ? angkaHasilLab(gula.hasil) : null,
    keterangan_gula_darah: gula?.nama ?? null,
    kolesterol_total: kolesterol ? angkaHasilLab(kolesterol.hasil) : null,
  };
};

// Rentang kewajaran DRAF (belum ditetapkan/disetujui penanggung jawab klinis — lihat Rancangan Teknis STD-0020
// "Hal yang perlu diputuskan"): batas longgar sekadar menangkap kesalahan input yang jelas keliru (mis. salah
// satuan/salah ketik), bukan ambang klinis. Tinjau ulang sebelum dipakai sebagai acuan baku.
const RENTANG_MCU_PCARE = {
  sistole: [60, 260],
  diastole: [40, 160],
  berat_badan: [1, 300],
  tinggi_badan: [30, 250],
  lingkar_perut: [20, 200],
  gula_darah: [20, 600],
  kolesterol_total: [50, 500],
};

export const validasiRentangMcu = (nilai) => {
  const masalah = [];
  for (const [field, [min, max]] of Object.entries(RENTANG_MCU_PCARE)) {
    const v = nilai[field];
    if (v != null && (v < min || v > max)) masalah.push(`Nilai ${field} (${v}) di luar rentang wajar ${min}–${max}`);
  }
  return masalah;
};

// ── Status tersimpan (baca langsung; ditulis oleh bpjs-service) ─────────────────────────────────
export const statusMcuPcare = async (pesertaUuid, faskesUuid) =>
  (
    await query(
      `SELECT uuid, status, mode, rawat_jalan_uuid, no_kunjungan, no_referensi_pcare, operasi_terakhir, percobaan, percobaan_pada, pesan
         FROM mcu_pcare_kirim WHERE faskes_uuid = $1 AND peserta_uuid = $2 AND deleted_at IS NULL`,
      [faskesUuid, pesertaUuid],
    )
  )[0] ?? { status: "belum", mode: null, rawat_jalan_uuid: null, no_kunjungan: null, no_referensi_pcare: null, operasi_terakhir: null, percobaan: 0, percobaan_pada: null, pesan: null };

// Prasyarat alur utama (KT-3/KT-4/KT-5): peserta berpenjamin BPJS, selesai & kesimpulan final.
const pastikanSiapKirim = (detail) => {
  const belum = [];
  if (!/^BPJS/i.test(detail.nama_penjamin ?? "")) belum.push("Peserta tidak berpenjamin BPJS");
  if (detail.status !== "selesai") belum.push("MCU belum selesai");
  if (!detail.kesimpulan) belum.push("Kesimpulan dokter belum final");
  if (belum.length) throw konflik(belum.join("; "));
};

// Kunjungan PCare kandidat dari bpjs-service (KF-2): >1 kandidat → petugas harus memilih eksplisit, sistem tidak
// boleh menebak (KT-4).
const kandidatKunjungan = (faskesUuid, patientUuid, token) =>
  panggilLayanan(`${config.bpjsUrl}/pcare/mcu/kunjungan?patient_uuid=${encodeURIComponent(patientUuid)}`, { token, nama: "BPJS PCare" });

const pilihKunjungan = async (detail, rawatJalanUuidDiminta, token) => {
  const { payload: kandidat } = await kandidatKunjungan(detail.faskes_uuid, detail.patient_uuid, token);
  const daftar = kandidat ?? [];
  if (rawatJalanUuidDiminta) {
    const c = daftar.find((k) => k.rawat_jalan_uuid === rawatJalanUuidDiminta);
    if (!c) throw permintaanSalah("Kunjungan PCare yang dipilih tidak ditemukan pada daftar kandidat peserta ini");
    return { rawatJalanUuid: c.rawat_jalan_uuid, kandidat: daftar };
  }
  if (!daftar.length) throw konflik("Peserta belum memiliki kunjungan PCare — lengkapi pendaftaran/kunjungan PCare terlebih dahulu");
  // >1 kandidat: GET /mcu/pcare/kunjungan (dipakai frontend sebelum membuka dialog kirim) sudah menampilkan daftar
  // kandidat agar petugas memilih lebih dahulu — di sini cukup tolak tanpa menebak (KT-4).
  if (daftar.length > 1) throw konflik("Peserta memiliki lebih dari satu kunjungan PCare yang cocok — pilih kunjungan secara eksplisit");
  return { rawatJalanUuid: daftar[0].rawat_jalan_uuid, kandidat: daftar };
};

const operasiPcare = (faskesUuid, body, token) =>
  panggilLayanan(`${config.bpjsUrl}/pcare/mcu/operasi`, { method: "POST", token, nama: "BPJS PCare", body });

// Siapkan & kirim (tambah) / kirim ulang — alur & aturan sama, hanya beda rawat_jalan_uuid eksplisit opsional
// (koreksi tautan, use case "A. Pengiriman ulang") dan konfirmasi saat status sebelumnya tidak pasti.
// Catatan: bpjs-service mengembalikan HTTP 422 untuk hasil bisnis gagal/tidak_pasti (lihat bpjs-service/src/rute.js),
// sehingga `panggilLayanan` (umum/layanan.js) melempar galat untuk kasus itu — tercapainya baris setelah
// `operasiPcare` di sini berarti PCare sudah menerima (status terkirim/belum pada hapus).
const prosesKirim = async (req, res) => {
  const f = req.author.faskesUuid;
  const b = req.body ?? {};
  const detail = await detailPeserta(req.params.uuid, f);
  if (!detail) throw tidakDitemukan("Peserta MCU");
  pastikanSiapKirim(detail);
  const { rawatJalanUuid, kandidat } = await pilihKunjungan(detail, b.rawat_jalan_uuid || null, req.author.token);
  const nilai = petakanNilaiMcu(detail);
  const masalah = validasiRentangMcu(nilai);
  if (masalah.length) throw permintaanSalah(masalah.join("; "));
  const hasil = await operasiPcare(
    f,
    {
      peserta_uuid: detail.uuid,
      rawat_jalan_uuid: rawatJalanUuid,
      operasi: "tambah",
      konfirmasi: !!b.konfirmasi,
      payload: { tgl_periksa: detail.tanggal, tanda_vital: nilai, kesimpulan: detail.kesimpulan },
    },
    req.author.token,
  );
  kirim(res, { ...hasil?.payload, kandidat }, hasil?.message ?? "Laporan MCU PCare diproses");
};

const rutePcare = express.Router();

rutePcare.use(wajibFiturMcuPcareAktif);

rutePcare.get(
  "/kunjungan",
  izinMcu("MCU PCare", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const detail = await detailPeserta(req.query.peserta_uuid, f);
    if (!detail) throw tidakDitemukan("Peserta MCU");
    const { payload } = await kandidatKunjungan(f, detail.patient_uuid, req.author.token);
    kirim(res, payload ?? []);
  }),
);

rutePcare.get(
  "/peserta/:uuid",
  izinMcu("MCU PCare", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const detail = await detailPeserta(req.params.uuid, f);
    if (!detail) throw tidakDitemukan("Peserta MCU");
    kirim(res, await statusMcuPcare(detail.uuid, f));
  }),
);

rutePcare.post("/peserta/:uuid/kirim", izinMcu("MCU PCare", "KIRIM"), tangani(prosesKirim));
rutePcare.post("/peserta/:uuid/ulang", izinMcu("MCU PCare", "KIRIM"), tangani(prosesKirim));

rutePcare.put(
  "/peserta/:uuid",
  izinMcu("MCU PCare", "UBAH"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    if (!String(b.alasan ?? "").trim()) throw permintaanSalah("alasan wajib diisi");
    const detail = await detailPeserta(req.params.uuid, f);
    if (!detail) throw tidakDitemukan("Peserta MCU");
    pastikanSiapKirim(detail);
    const status = await statusMcuPcare(detail.uuid, f);
    if (status.status !== "terkirim") throw konflik(`Laporan berstatus ${status.status}, hanya laporan yang sudah terkirim yang dapat diubah`);
    const nilai = petakanNilaiMcu(detail);
    const masalah = validasiRentangMcu(nilai);
    if (masalah.length) throw permintaanSalah(masalah.join("; "));
    const hasil = await operasiPcare(
      f,
      {
        peserta_uuid: detail.uuid,
        rawat_jalan_uuid: b.rawat_jalan_uuid || status.rawat_jalan_uuid,
        operasi: "ubah",
        alasan: String(b.alasan).trim(),
        payload: { tgl_periksa: detail.tanggal, tanda_vital: nilai, kesimpulan: detail.kesimpulan },
      },
      req.author.token,
    );
    kirim(res, hasil?.payload, hasil?.message ?? "Laporan MCU PCare diperbarui");
  }),
);

rutePcare.delete(
  "/peserta/:uuid",
  izinMcu("MCU PCare", "HAPUS"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    // DELETE tanpa body (konvensi apiPenunjangDelete di frontend) — alasan dikirim lewat query string.
    const b = req.query ?? {};
    if (!String(b.alasan ?? "").trim()) throw permintaanSalah("alasan wajib diisi");
    const detail = await detailPeserta(req.params.uuid, f);
    if (!detail) throw tidakDitemukan("Peserta MCU");
    const status = await statusMcuPcare(detail.uuid, f);
    if (status.status !== "terkirim") throw konflik(`Laporan berstatus ${status.status}, hanya laporan yang sudah terkirim yang dapat dihapus`);
    const hasil = await operasiPcare(
      f,
      { peserta_uuid: detail.uuid, operasi: "hapus", alasan: String(b.alasan).trim() },
      req.author.token,
    );
    kirim(res, hasil?.payload, hasil?.message ?? "Laporan MCU PCare dihapus dari PCare");
  }),
);

export default rutePcare;
