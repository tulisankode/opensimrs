import { query, satu, sekarang, uuidv7 } from "../../db.js";
import { Galat, tidakDitemukan } from "../../umum/respons.js";
import { nomorBaru } from "../../umum/nomor.js";
import { detailPermintaan } from "../permintaan.js";
import { STATUS_PERMINTAAN_AKTIF } from "../bersama.js";
import { koneksiUntukKirim, ambilKoneksi, timeoutMs } from "./utd-koneksi.js";
import { buatPayloadPermintaan, kirimKeUtd as kirimHttp, ambilStatusUtd, cekStokUtd, pesanGalat } from "./adapter-generik.js";
import { terapkanHasilUtd } from "./utd-hasil.js";

// Orkestrasi pengiriman permintaan darah ke UTD (KF-4/KF-5/KF-6/T1): satu baris bdrs_utd_kirim per kombinasi
// faskes+permintaan+koneksi dengan no_registrasi stabil, dipakai ulang pada setiap percobaan (KT-3/KT-4).

// Payload tersanitasi untuk riwayat/log (KF-6/T8): tanpa nama pasien.
const sanitisasiPayload = (payload) => (payload ? { ...payload, pasien: { ...payload.pasien, nama: undefined } } : payload);

const ambilKirim = async (faskesUuid, { kirimUuid, permintaanUuid, koneksiUuid }) =>
  kirimUuid
    ? satu(`SELECT * FROM bdrs_utd_kirim WHERE uuid = $1 AND faskes_uuid = $2`, [kirimUuid, faskesUuid])
    : satu(`SELECT * FROM bdrs_utd_kirim WHERE faskes_uuid = $1 AND permintaan_uuid = $2 AND koneksi_uuid = $3`, [faskesUuid, permintaanUuid, koneksiUuid]);

/**
 * Kode RS untuk nomor registrasi: hanya huruf besar/angka/tanda hubung (maks. 30 karakter). Nomor dihitung per faskes,
 * sehingga tanpa kode RS dua faskes yang memakai UTD yang sama bisa menghasilkan nomor yang persis sama.
 */
export const kodeRsNomor = (kode) =>
  String(kode ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "");

/** UTDREG-YYYYMMDD-NNNN (penghitung per faskes, umum/nomor.js) → UTDREG-<kode_rs>-YYYYMMDD-NNNN. */
export const nomorRegistrasiUtd = (nomorDasar, kodeRs) => {
  const kode = kodeRsNomor(kodeRs);
  return kode ? String(nomorDasar).replace(/^UTDREG-/, `UTDREG-${kode}-`) : String(nomorDasar);
};

// Kode RS koneksi; bila kosong dipakai kode faskes agar nomor tetap unik antar faskes di UTD yang sama.
const nomorRegistrasiBaru = async (faskesUuid, koneksi) => {
  let kode = kodeRsNomor(koneksi.kode_rs);
  if (!kode) kode = kodeRsNomor((await satu(`SELECT code FROM faskes WHERE uuid = $1`, [faskesUuid]))?.code);
  return nomorRegistrasiUtd(await nomorBaru(faskesUuid, "UTDREG"), kode);
};

// Status pengiriman yang kantongnya sudah diterima ke stok: kirim ulang tidak boleh memundurkan status.
const STATUS_SELESAI = ["kantong_diterima", "diterima_sebagian"];
// Baris 'sedang_dikirim' dianggap macet (mis. proses mati di tengah) setelah melewati batas waktu HTTP + jeda.
const BATAS_SEDANG_DIKIRIM_DETIK = Math.ceil(timeoutMs / 1000) + 30;
const GALAT_SEDANG_DIKIRIM = "Permintaan ini sedang dikirim ke UTD oleh proses lain — tunggu sebentar lalu muat ulang status";

/** Kirim (atau kirim ulang) satu permintaan ke UTD. Nomor registrasi & baris pengiriman dipakai ulang bila sudah ada. */
const kirimSatuPermintaan = async (faskesUuid, permintaan, koneksi, pengguna) => {
  const existing = await ambilKirim(faskesUuid, { permintaanUuid: permintaan.uuid, koneksiUuid: koneksi.uuid });
  if (existing?.status === "tidak_pasti") throw new Galat(409, "Status pengiriman sebelumnya belum pasti — lakukan Cek Status sebelum mengirim ulang");
  if (STATUS_SELESAI.includes(existing?.status)) throw new Galat(409, `Pengiriman berstatus ${existing.status} (kantong UTD sudah diterima ke stok), tidak dapat dikirim ulang`);
  if (existing?.status === "sedang_dikirim" && Number(existing.updated_at) > sekarang() - BATAS_SEDANG_DIKIRIM_DETIK) throw new Galat(409, GALAT_SEDANG_DIKIRIM);
  const noRegistrasi = existing?.no_registrasi ?? (await nomorRegistrasiBaru(faskesUuid, koneksi));
  const payload = await buatPayloadPermintaan(faskesUuid, permintaan, koneksi, noRegistrasi);
  const t = sekarang();
  let kirimUuid = existing?.uuid;
  if (existing) {
    // Optimistik: hanya bila status belum diubah proses lain sejak dibaca (dua klik bersamaan → satu yang mengirim).
    const diubah = await satu(
      `UPDATE bdrs_utd_kirim SET status = 'sedang_dikirim', payload = $2, percobaan = percobaan + 1, dikirim_oleh = $3, updated_at = $4
        WHERE uuid = $1 AND status = $5 AND updated_at IS NOT DISTINCT FROM $6 RETURNING uuid`,
      [existing.uuid, JSON.stringify(sanitisasiPayload(payload)), pengguna, t, existing.status, existing.updated_at],
    );
    if (!diubah) throw new Galat(409, GALAT_SEDANG_DIKIRIM);
  } else {
    // ON CONFLICT DO NOTHING: klik ganda bersamaan tidak memunculkan galat duplicate key (nama constraint tidak bocor);
    // yang kalah balapan mendapat 409 dan tidak mengirim dua kali.
    const baru = await satu(
      `INSERT INTO bdrs_utd_kirim (uuid, faskes_uuid, koneksi_uuid, permintaan_uuid, no_registrasi, status, payload, percobaan, dikirim_oleh, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'sedang_dikirim',$6,1,$7,$8,$8)
       ON CONFLICT (faskes_uuid, permintaan_uuid, koneksi_uuid) DO NOTHING RETURNING uuid`,
      [uuidv7(), faskesUuid, koneksi.uuid, permintaan.uuid, noRegistrasi, JSON.stringify(sanitisasiPayload(payload)), pengguna, t],
    );
    if (!baru) throw new Galat(409, GALAT_SEDANG_DIKIRIM);
    kirimUuid = baru.uuid;
  }

  const { ok, status, json, pasti } = await kirimHttp(koneksi, payload);
  const statusBaru = ok ? "terkirim" : pasti ? "gagal" : "tidak_pasti";
  const pesan = ok
    ? json?.message || "Permintaan diterima UTD"
    : pasti
      ? pesanGalat(json, status)
      : `${pesanGalat(json, status)} — status di UTD belum pasti, lakukan Cek Status sebelum mengirim ulang`;
  await query(`UPDATE bdrs_utd_kirim SET status = $2, pesan = $3, no_registrasi_utd = COALESCE($4, no_registrasi_utd), respons = $5, updated_at = $6 WHERE uuid = $1`, [
    kirimUuid, statusBaru, pesan, json?.payload?.no_registrasi_utd ?? null, JSON.stringify({ status_http: status, message: json?.message ?? null }), sekarang(),
  ]);
  return { uuid: kirimUuid, no_registrasi: noRegistrasi, status: statusBaru, pesan };
};

export const kirimPermintaanKeUtd = async (faskesUuid, permintaanUuid, { koneksiUuid = null, pengguna = null } = {}) => {
  const permintaan = await detailPermintaan(permintaanUuid, faskesUuid);
  if (!STATUS_PERMINTAAN_AKTIF.includes(permintaan.status)) throw new Galat(409, `Permintaan berstatus ${permintaan.status}, tidak dapat dikirim ke UTD`);
  const koneksi = await koneksiUntukKirim(faskesUuid, koneksiUuid);
  const hasil = await kirimSatuPermintaan(faskesUuid, permintaan, koneksi, pengguna);
  return { ...hasil, koneksi: koneksi.nama };
};

export const kirimUlang = async (faskesUuid, kirimUuid, pengguna) => {
  const kirim = await satu(`SELECT * FROM bdrs_utd_kirim WHERE uuid = $1 AND faskes_uuid = $2`, [kirimUuid, faskesUuid]);
  if (!kirim) throw tidakDitemukan("Pengiriman UTD");
  if (kirim.status === "tidak_pasti") throw new Galat(409, "Status pengiriman sebelumnya belum pasti — lakukan Cek Status sebelum mengirim ulang");
  const permintaan = await detailPermintaan(kirim.permintaan_uuid, faskesUuid);
  const koneksi = await ambilKoneksi(faskesUuid, kirim.koneksi_uuid);
  if (!koneksi.aktif) throw new Galat(409, `Koneksi UTD ${koneksi.nama} nonaktif`);
  const hasil = await kirimSatuPermintaan(faskesUuid, permintaan, koneksi, pengguna);
  return { ...hasil, koneksi: koneksi.nama };
};

/**
 * Panggil URL Status UTD; waktu habis → 504, galat jaringan → 502 dengan pesan aman (tanpa 500), tanpa mengubah data.
 * `akibat` menjelaskan dampaknya bagi petugas (mis. status tetap belum pasti).
 */
const ambilStatusAman = async (koneksi, noRegistrasi, akibat) => {
  try {
    return await ambilStatusUtd(koneksi, noRegistrasi);
  } catch (error) {
    if (error instanceof Galat) throw error;
    const waktuHabis = error?.name === "TimeoutError" || error?.name === "AbortError";
    if (waktuHabis) throw new Galat(504, `UTD ${koneksi.nama} tidak menjawab dalam batas waktu — ${akibat}`);
    const kode = String(error?.cause?.code ?? error?.code ?? "galat jaringan").slice(0, 50);
    throw new Galat(502, `UTD ${koneksi.nama} tidak dapat dihubungi (${kode}) — ${akibat}`);
  }
};

/** Cek Status (khusus baris 'tidak_pasti', F6/A9/KT-7): tentukan status pasti sebelum pengiriman ulang diizinkan. */
export const cekStatusTidakPasti = async (faskesUuid, kirimUuid) => {
  const kirim = await satu(`SELECT * FROM bdrs_utd_kirim WHERE uuid = $1 AND faskes_uuid = $2`, [kirimUuid, faskesUuid]);
  if (!kirim) throw tidakDitemukan("Pengiriman UTD");
  if (kirim.status !== "tidak_pasti") return { status: "dilewati", pesan: `Status sudah pasti: ${kirim.status}` };
  const koneksi = await ambilKoneksi(faskesUuid, kirim.koneksi_uuid);
  if (!koneksi.url_status) return { status: "tidak_pasti", pesan: `URL Status koneksi ${koneksi.nama} belum diatur — cek manual di UTD` };
  const { ok, status, json } = await ambilStatusAman(koneksi, kirim.no_registrasi, "status pengiriman tetap belum pasti, coba Cek Status lagi nanti");
  const t = sekarang();
  if (ok && json?.success !== false && json?.payload) {
    await query(`UPDATE bdrs_utd_kirim SET status = 'terkirim', pesan = 'Ditemukan di UTD (hasil Cek Status)', updated_at = $2 WHERE uuid = $1`, [kirim.uuid, t]);
    const hasil = await terapkanHasilUtd(koneksi, { no_registrasi: kirim.no_registrasi, ...json.payload }, "pull");
    return { status: "terkirim", pesan: "Ditemukan di UTD (hasil Cek Status)", hasil };
  }
  if (status === 404 || /tidak ditemukan|not found/i.test(String(json?.message ?? ""))) {
    await query(`UPDATE bdrs_utd_kirim SET status = 'gagal', pesan = 'Tidak ditemukan di UTD (hasil Cek Status) — aman dikirim ulang', updated_at = $2 WHERE uuid = $1`, [kirim.uuid, t]);
    return { status: "gagal", pesan: "Tidak ditemukan di UTD — aman dikirim ulang" };
  }
  return { status: "tidak_pasti", pesan: `Jawaban UTD belum dapat dipastikan (HTTP ${status ?? 0})` };
};

/** Ambil Status UTD (tarik manual untuk pengiriman yang sudah terkirim) — menyimpan hasil & kantong terbaru. */
export const tarikStatus = async (faskesUuid, kirimUuid) => {
  const kirim = await satu(`SELECT * FROM bdrs_utd_kirim WHERE uuid = $1 AND faskes_uuid = $2`, [kirimUuid, faskesUuid]);
  if (!kirim) throw tidakDitemukan("Pengiriman UTD");
  if (!["terkirim", "kantong_diterima", "diterima_sebagian"].includes(kirim.status)) throw new Galat(409, `Pengiriman berstatus ${kirim.status}, belum dapat diambil statusnya`);
  const koneksi = await ambilKoneksi(faskesUuid, kirim.koneksi_uuid);
  if (!koneksi.url_status) throw new Galat(422, `URL Status belum diatur di koneksi UTD ${koneksi.nama}`);
  const { ok, status, json } = await ambilStatusAman(koneksi, kirim.no_registrasi, "status & data kantong tidak berubah, coba lagi nanti");
  if (!ok || json?.success === false || !json?.payload) throw new Galat(502, pesanGalat(json, status));
  return terapkanHasilUtd(koneksi, { no_registrasi: kirim.no_registrasi, ...json.payload }, "pull");
};

/** "Ambil Status UTD" dari halaman permintaan (step 18 use case): pakai pengiriman terbaru permintaan ini. */
export const ambilStatusPermintaan = async (faskesUuid, permintaanUuid, koneksiUuid = null) => {
  const kirim = koneksiUuid
    ? await satu(`SELECT * FROM bdrs_utd_kirim WHERE faskes_uuid = $1 AND permintaan_uuid = $2 AND koneksi_uuid = $3`, [faskesUuid, permintaanUuid, koneksiUuid])
    : await satu(`SELECT * FROM bdrs_utd_kirim WHERE faskes_uuid = $1 AND permintaan_uuid = $2 ORDER BY updated_at DESC LIMIT 1`, [faskesUuid, permintaanUuid]);
  if (!kirim) throw new Galat(409, "Permintaan ini belum pernah dikirim ke UTD");
  return tarikStatus(faskesUuid, kirim.uuid);
};

/** Cek stok UTD (KF-13) — informasi saat pengambilan, bukan jaminan pemenuhan. */
export const cekStokBridging = async (faskesUuid, koneksiUuid, filter) => {
  const koneksi = await koneksiUntukKirim(faskesUuid, koneksiUuid);
  const stok = await cekStokUtd(koneksi, filter);
  return { ...stok, diperiksa_pada: sekarang(), keterangan: "Stok UTD bersifat informasi saat pemeriksaan, bukan jaminan ketersediaan saat permintaan diproses" };
};

export const daftarPengiriman = async (faskesUuid, { page = 1, limit = 10, status = "", koneksiUuid = "" } = {}) => {
  const batas = Math.min(100, Math.max(1, Number(limit) || 10));
  const hal = Math.max(1, Number(page) || 1);
  const nilai = [faskesUuid];
  let kondisi = "k.faskes_uuid = $1";
  if (status) {
    nilai.push(status);
    kondisi += ` AND k.status = $${nilai.length}`;
  }
  if (koneksiUuid) {
    nilai.push(koneksiUuid);
    kondisi += ` AND k.koneksi_uuid = $${nilai.length}`;
  }
  const total = await satu(`SELECT COUNT(*)::int AS total FROM bdrs_utd_kirim k WHERE ${kondisi}`, nilai);
  const data = await query(
    `SELECT k.uuid, k.no_registrasi, k.no_registrasi_utd, k.status, k.pesan, k.percobaan, k.updated_at, k.dikirim_oleh,
            c.nama AS koneksi, p.no_permintaan, p.no_rm, p.status AS status_permintaan
       FROM bdrs_utd_kirim k
       JOIN bdrs_utd_koneksi c ON c.uuid = k.koneksi_uuid
       JOIN bdrs_permintaan p ON p.uuid = k.permintaan_uuid
      WHERE ${kondisi} ORDER BY k.updated_at DESC LIMIT ${batas} OFFSET ${(hal - 1) * batas}`,
    nilai,
  );
  return { data, pagination: { page: hal, limit: batas, total: total?.total ?? 0 } };
};

export const detailPengiriman = async (faskesUuid, uuid) => {
  const kirim = await satu(
    `SELECT k.*, c.nama AS koneksi, p.no_permintaan, p.no_rm, p.status AS status_permintaan
       FROM bdrs_utd_kirim k JOIN bdrs_utd_koneksi c ON c.uuid = k.koneksi_uuid JOIN bdrs_permintaan p ON p.uuid = k.permintaan_uuid
      WHERE k.uuid = $1 AND k.faskes_uuid = $2`,
    [uuid, faskesUuid],
  );
  if (!kirim) throw tidakDitemukan("Pengiriman UTD");
  const hasil = await query(`SELECT * FROM bdrs_utd_hasil WHERE faskes_uuid = $1 AND permintaan_uuid = $2 AND koneksi_uuid = $3 ORDER BY created_at DESC`, [
    faskesUuid, kirim.permintaan_uuid, kirim.koneksi_uuid,
  ]);
  const kantong = await query(`SELECT * FROM bdrs_utd_kantong WHERE faskes_uuid = $1 AND kirim_uuid = $2 ORDER BY created_at DESC`, [faskesUuid, kirim.uuid]);
  return { ...kirim, hasil, kantong };
};
