import crypto from "node:crypto";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { Galat, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { nomorBaru } from "../umum/nomor.js";
import { detailOrder, jalankanValidasi } from "../radiologi/order.js";
import { mappingTindakan, mappingRef, aeTitleRuang, dokterRingkas } from "./pacs-peta.js";
import { enkripsi, dekripsi, hashKunci, buatKunci, samarkan } from "./kripto.js";

// Bridging PACS/RIS Radiologi — pola sama dengan Bridging LIS (lab-service/src/lis/lis-service.js), diadaptasi:
// satu Accession Number per item pemeriksaan (bukan per order), status pengiriman terpisah dari status klinis.
export class GalatPacs extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

const TIMEOUT_MS = Number(process.env.RAD_PACS_TIMEOUT_MS) || 15000;
// Galat jaringan yang pasti terjadi SEBELUM request sampai ke PACS → aman dikirim ulang (lihat lis-service.js).
const GALAT_BELUM_TERKIRIM = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH", "UND_ERR_CONNECT_TIMEOUT"]);
const strip = (v) => (v === undefined || v === null || String(v).trim() === "" ? "-" : String(v).trim());

// ── Koneksi PACS/RIS (bisa lebih dari satu per faskes) ──────────────────────

const tampilKoneksi = (k) => ({
  uuid: k.uuid,
  nama: k.nama,
  kode_rs: k.kode_rs,
  url_kirim_order: k.url_kirim_order,
  url_hasil: k.url_hasil ?? null,
  url_viewer: k.url_viewer ?? null,
  api_key: samarkan(dekripsi(k.api_key)),
  kunci_masuk: samarkan(dekripsi(k.kunci_masuk)),
  aktif: k.aktif,
  bawaan: k.bawaan,
  maks_paralel: k.maks_paralel,
  jeda_ms: k.jeda_ms,
  updated_at: k.updated_at,
});

export const daftarKoneksi = async (faskesUuid, hanyaAktif = false) =>
  (
    await query(
      `SELECT * FROM rad_pacs_koneksi WHERE faskes_uuid = $1 AND deleted_at IS NULL ${hanyaAktif ? "AND aktif = true" : ""} ORDER BY bawaan DESC, nama`,
      [faskesUuid],
    )
  ).map(tampilKoneksi);

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

export const simpanKoneksi = async (faskesUuid, uuid, data) => {
  const nama = String(data?.nama ?? "").trim();
  if (!nama) throw permintaanSalah("Nama koneksi PACS wajib diisi");
  const urlKirim = String(data?.url_kirim_order ?? "").trim();
  if (!validUrl(urlKirim)) throw permintaanSalah("URL Kirim Order tidak valid (contoh: http://pacs.contoh.id/order)");
  const urlHasil = String(data?.url_hasil ?? "").trim() || null;
  if (urlHasil && !validUrl(urlHasil.replace(/\{accession_number\}/g, "x"))) throw permintaanSalah("URL Ambil Hasil tidak valid (contoh: http://pacs.contoh.id/hasil?accession={accession_number})");
  const urlViewer = String(data?.url_viewer ?? "").trim() || null;
  const kodeRs = String(data?.kode_rs ?? "").trim() || null;
  const apiKey = String(data?.api_key ?? "").trim();
  const maksParalel = bulat(data?.maks_paralel, 1, 10, 2);
  const jedaMs = bulat(data?.jeda_ms, 0, 60000, 0);
  const t = sekarang();
  let kunciBaru = null;
  let barisUuid = uuid;

  if (uuid) {
    const lama = await satu(`SELECT * FROM rad_pacs_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid]);
    if (!lama) throw tidakDitemukan("Koneksi PACS");
    await query(
      `UPDATE rad_pacs_koneksi SET nama = $3, kode_rs = $4, url_kirim_order = $5, url_hasil = $6, url_viewer = $7, api_key = $8,
              maks_paralel = $9, jeda_ms = $10, aktif = $11, updated_at = $12
       WHERE uuid = $1 AND faskes_uuid = $2`,
      [uuid, faskesUuid, nama, kodeRs, urlKirim, urlHasil, urlViewer, apiKey ? enkripsi(apiKey) : lama.api_key, maksParalel, jedaMs, data?.aktif !== false, t],
    );
  } else {
    kunciBaru = buatKunci();
    const baris = await sisipkan("rad_pacs_koneksi", {
      faskes_uuid: faskesUuid,
      nama,
      kode_rs: kodeRs,
      url_kirim_order: urlKirim,
      url_hasil: urlHasil,
      url_viewer: urlViewer,
      api_key: enkripsi(apiKey),
      kunci_masuk: enkripsi(kunciBaru),
      kunci_masuk_hash: hashKunci(kunciBaru),
      aktif: data?.aktif !== false,
      bawaan: false,
      maks_paralel: maksParalel,
      jeda_ms: jedaMs,
    });
    barisUuid = baris.uuid;
    // Koneksi pertama faskes otomatis jadi bawaan.
    const jumlah = await satu(`SELECT COUNT(*)::int n FROM rad_pacs_koneksi WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [faskesUuid]);
    if (jumlah.n === 1) await query(`UPDATE rad_pacs_koneksi SET bawaan = true WHERE uuid = $1`, [barisUuid]);
  }
  if (data?.bawaan) await jadikanBawaan(faskesUuid, barisUuid);
  const hasil = (await daftarKoneksi(faskesUuid)).find((k) => k.uuid === barisUuid);
  return kunciBaru ? { ...hasil, kunci_masuk_baru: kunciBaru } : hasil;
};

export const jadikanBawaan = async (faskesUuid, uuid) => {
  const ada = await satu(`SELECT 1 FROM rad_pacs_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND aktif = true`, [uuid, faskesUuid]);
  if (!ada) throw permintaanSalah("Hanya koneksi aktif yang dapat dijadikan bawaan");
  await query(`UPDATE rad_pacs_koneksi SET bawaan = (uuid = $2), updated_at = $3 WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [faskesUuid, uuid, sekarang()]);
  return (await daftarKoneksi(faskesUuid)).find((k) => k.uuid === uuid);
};

export const buatUlangKunciMasuk = async (faskesUuid, uuid) => {
  const ada = await satu(`SELECT 1 FROM rad_pacs_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid]);
  if (!ada) throw tidakDitemukan("Koneksi PACS");
  const kunci = buatKunci();
  await query(`UPDATE rad_pacs_koneksi SET kunci_masuk = $3, kunci_masuk_hash = $4, updated_at = $5 WHERE uuid = $1 AND faskes_uuid = $2`, [
    uuid, faskesUuid, enkripsi(kunci), hashKunci(kunci), sekarang(),
  ]);
  return { uuid, kunci_masuk_baru: kunci };
};

export const hapusKoneksi = async (faskesUuid, uuid) => {
  await query(`UPDATE rad_pacs_koneksi SET deleted_at = $3, aktif = false, bawaan = false, kunci_masuk_hash = NULL WHERE uuid = $1 AND faskes_uuid = $2`, [
    uuid, faskesUuid, sekarang(),
  ]);
  return { uuid };
};

export const koneksiUntukKirim = async (faskesUuid, uuid) => {
  const rows = await query(
    `SELECT * FROM rad_pacs_koneksi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND aktif = true AND ($2::text IS NULL OR uuid = $2::text)
     ORDER BY bawaan DESC, nama`,
    [faskesUuid, uuid || null],
  );
  if (!rows.length) throw new GalatPacs(uuid ? "Koneksi PACS tidak ditemukan atau nonaktif" : "Belum ada koneksi PACS aktif. Atur di Setting › Konfigurasi Integrasi › Konfigurasi PACS.", 409);
  if (!uuid && rows.length > 1 && !rows[0].bawaan) {
    const e = new GalatPacs("Lebih dari satu koneksi PACS aktif — pilih koneksi tujuan", 409);
    e.koneksi = rows.map(tampilKoneksi);
    throw e;
  }
  return rows[0];
};

export const ujiKoneksi = async (faskesUuid, uuid) => {
  const koneksi = await satu(`SELECT * FROM rad_pacs_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid]);
  if (!koneksi) throw tidakDitemukan("Koneksi PACS");
  try {
    const res = await fetch(koneksi.url_kirim_order, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": dekripsi(koneksi.api_key) ?? "" },
      body: JSON.stringify({ accession_number: "UJI-KONEKSI", uji: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { berhasil: res.status < 500, pesan: res.status < 500 ? `Koneksi berhasil dihubungi (HTTP ${res.status})` : `PACS mengembalikan galat server (HTTP ${res.status})`, status_http: res.status };
  } catch (error) {
    const waktuHabis = error?.name === "TimeoutError" || error?.name === "AbortError";
    return { berhasil: false, pesan: `Tidak dapat menghubungi PACS: ${waktuHabis ? "waktu habis" : error?.cause?.code ?? error.message}` };
  }
};

// ── Kirim permintaan HTTP ke PACS ───────────────────────────────────────────

const postPacs = async (url, apiKey, body, timeoutMs = TIMEOUT_MS) => {
  let json;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": apiKey ?? "" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const teks = await res.text();
    try {
      json = JSON.parse(teks);
    } catch {
      json = { success: false, message: `Respons PACS bukan JSON (HTTP ${res.status}): ${teks.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)}` };
    }
    const generik = [502, 503, 504].includes(res.status) || (res.status === 500 && json?.success === undefined);
    return { ok: res.ok && json?.success !== false, status: res.status, json, pasti: !generik };
  } catch (error) {
    const kode = error?.cause?.code ?? error?.code;
    const waktuHabis = error?.name === "TimeoutError" || error?.name === "AbortError";
    return {
      ok: false,
      status: 0,
      json: { success: false, message: `PACS tidak dapat dihubungi: ${waktuHabis ? "waktu habis menunggu respons" : kode || error.message}` },
      pasti: !waktuHabis && GALAT_BELUM_TERKIRIM.has(kode),
    };
  }
};

const pesanGalatPacs = (json, status) => {
  if (typeof json?.message === "string" && json.message) return json.message;
  if (Array.isArray(json?.errors) && json.errors.length) return json.errors.map((e) => (typeof e === "string" ? e : e?.message)).filter(Boolean).join("; ");
  return `PACS menolak permintaan (HTTP ${status})`;
};

// ── Payload order item → PACS ───────────────────────────────────────────────

const identitasPasien = async (patientUuid, faskesUuid) =>
  satu(`SELECT no_identity FROM patients WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [patientUuid, faskesUuid]);

const jenisKelamin = (g) => {
  const s = String(g ?? "").toLowerCase();
  if (["female", "p", "perempuan", "f"].includes(s)) return "P";
  if (["male", "l", "laki-laki", "laki", "m"].includes(s)) return "L";
  return "-";
};

/** Body yang dikirim ke PACS untuk satu item pemeriksaan. Melempar GalatPacs bila tindakan belum dipetakan. */
export const buatPermintaanItem = async (faskesUuid, order, item, koneksi) => {
  const mapping = await mappingTindakan(faskesUuid, item.pemeriksaan_uuid);
  if (!mapping) throw new GalatPacs(`Tindakan "${item.nama}" belum dipetakan ke kode prosedur PACS (Radiologi › Mapping PACS › Tindakan)`, 422);
  // rad_order tidak menyimpan penjamin_uuid eksplisit (hanya payment_method); mapping penjamin hanya tersedia
  // untuk pembayaran tunai ("TUNAI") — asuransi dipetakan manual bila dibutuhkan vendor PACS tertentu.
  const [identitas, unitRef, dokterRef, penjaminRef, aeTitle] = await Promise.all([
    identitasPasien(order.patient_uuid, faskesUuid),
    mappingRef(faskesUuid, "unit", order.lokasi_asal_uuid),
    mappingRef(faskesUuid, "dokter", order.dokter_pengirim_uuid),
    Number(order.payment_method) === 1 ? mappingRef(faskesUuid, "penjamin", "TUNAI") : null,
    item.ruang_pakai_uuid ? aeTitleRuang(item.ruang_pakai_uuid) : null,
  ]);
  const dokter = !dokterRef && order.dokter_pengirim_uuid ? await dokterRingkas(order.dokter_pengirim_uuid) : null;
  return {
    accession_number: item.accession_number,
    kode_rs: strip(koneksi.kode_rs),
    no_order: order.no_order,
    cito: !!order.cito,
    klinis: strip(order.klinis),
    pasien: {
      nama: strip(order.nama_pasien ?? order.pasien?.name),
      no_rm: strip(order.no_rm),
      jenis_kelamin: jenisKelamin(order.gender ?? order.pasien?.gender),
      tanggal_lahir: order.birth_date ?? order.pasien?.birth_date ?? null,
      nik: strip(identitas?.no_identity),
    },
    pemeriksaan: { nama: item.nama, kode_prosedur_pacs: mapping.kode_prosedur_pacs, modalitas_pacs: mapping.modalitas_pacs },
    unit_asal: unitRef ? { kode_pacs: unitRef.kode_pacs, nama: unitRef.nama_pacs ?? order.lokasi_asal ?? null } : null,
    dokter_pengirim: dokterRef
      ? { kode_pacs: dokterRef.kode_pacs, nama: dokterRef.nama_pacs ?? order.dokter_pengirim ?? null }
      : dokter
        ? { kode_pacs: dokter.code_bpjs || dokter.uuid, nama: dokter.nama }
        : null,
    penjamin: penjaminRef ? { kode_pacs: penjaminRef.kode_pacs, nama: penjaminRef.nama_pacs } : null,
    ae_title: aeTitle || null,
  };
};

// ── Klaim atomik per item (anti kirim dobel) — pola sama dengan lab-service klaimKirim ──────────────────

const klaimKirim = async ({ faskesUuid, koneksiUuid, itemUuid, accessionNumber, pemroses }) => {
  const t = sekarang();
  const baris = await satu(
    `INSERT INTO rad_pacs_kirim (uuid, faskes_uuid, koneksi_uuid, order_item_uuid, accession_number, status, percobaan, diklaim_pada, diklaim_oleh, created_at, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'mengirim', 0, $5, $6, $5, $5)
     ON CONFLICT (faskes_uuid, order_item_uuid, koneksi_uuid) DO UPDATE SET
       status = 'mengirim', diklaim_pada = EXCLUDED.diklaim_pada, diklaim_oleh = EXCLUDED.diklaim_oleh, updated_at = EXCLUDED.updated_at
     WHERE rad_pacs_kirim.status = ANY('{baru,gagal,tidak_pasti,terkirim}'::varchar[])
     RETURNING uuid`,
    [faskesUuid, koneksiUuid, itemUuid, accessionNumber, t, pemroses],
  );
  return baris?.uuid ?? null;
};

const selesaikanKirim = async ({ kirimUuid, pemroses, status, pesan, permintaan, respons, pengguna }) => {
  await query(
    `UPDATE rad_pacs_kirim SET status = $3, pesan = $4, permintaan = $5::jsonb, respons = $6::jsonb, dikirim_oleh = COALESCE($7, dikirim_oleh),
            percobaan = percobaan + 1, updated_at = $8
     WHERE uuid = $1 AND diklaim_oleh = $2`,
    [kirimUuid, pemroses, status, pesan, JSON.stringify(permintaan ?? null), JSON.stringify(respons ?? null), pengguna, sekarang()],
  );
};

/** Kirim satu item ke PACS. Membuat/mengambil Accession Number, mengklaim, memanggil PACS, mencatat riwayat. */
const kirimSatuItem = async (faskesUuid, order, item, koneksi, pengguna) => {
  let accessionNumber = item.accession_number;
  if (!accessionNumber) {
    accessionNumber = await nomorBaru(faskesUuid, "ACC");
    await ubah("rad_order_item", item.uuid, faskesUuid, { accession_number: accessionNumber, pacs_koneksi_uuid: koneksi.uuid });
    item = { ...item, accession_number: accessionNumber };
  }
  const body = await buatPermintaanItem(faskesUuid, order, item, koneksi);
  const pemroses = `manual:${crypto.randomUUID()}`;
  const kirimUuid = await klaimKirim({ faskesUuid, koneksiUuid: koneksi.uuid, itemUuid: item.uuid, accessionNumber, pemroses });
  if (!kirimUuid) throw new GalatPacs(`Item "${item.nama}" sedang dikirim ke PACS oleh proses lain. Tunggu hingga selesai.`, 409);
  const { ok, status, json, pasti } = await postPacs(koneksi.url_kirim_order, dekripsi(koneksi.api_key), body);
  const hasil = {
    itemUuid: item.uuid,
    nama: item.nama,
    accession_number: accessionNumber,
    status: ok ? "terkirim" : pasti ? "gagal" : "tidak_pasti",
    pesan: ok ? json?.message || "Order diterima PACS" : pasti ? pesanGalatPacs(json, status) : `${pesanGalatPacs(json, status)} — status di PACS belum pasti, lakukan Cek Status sebelum mengirim ulang`,
  };
  await selesaikanKirim({ kirimUuid, pemroses, status: hasil.status, pesan: hasil.pesan, permintaan: body, respons: json, pengguna });
  if (ok && json?.payload?.url_viewer) await ubah("rad_order_item", item.uuid, faskesUuid, { url_viewer: String(json.payload.url_viewer) });
  return hasil;
};

// ── Validasi & Kirim ke PACS (order) ─────────────────────────────────────────

/** "Validasi & Kirim ke PACS": kirim semua item order, hanya validasi lokal bila SELURUH item terkirim. */
export const validasiDanKirimOrder = async (faskesUuid, orderUuid, { koneksiUuid = null, pengguna = null, req }) => {
  const koneksi = await koneksiUntukKirim(faskesUuid, koneksiUuid);
  const order = await satu(`SELECT * FROM rad_order WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [orderUuid, faskesUuid]);
  if (!order) throw tidakDitemukan("Order radiologi");
  if (order.status !== "order") throw new Galat(409, `Order berstatus ${order.status}, tidak dapat divalidasi`);
  const detail = await detailOrder(orderUuid, faskesUuid);
  if (!detail.items.length) throw permintaanSalah("Order tidak memiliki pemeriksaan");

  const pengiriman = [];
  for (const item of detail.items) {
    pengiriman.push(await kirimSatuItem(faskesUuid, detail, item, koneksi, pengguna));
    if (koneksi.jeda_ms) await new Promise((r) => setTimeout(r, koneksi.jeda_ms));
  }
  const gagal = pengiriman.filter((p) => p.status !== "terkirim");
  if (gagal.length) {
    throw new GalatPacs(
      `Pengiriman ke PACS ${gagal.length === pengiriman.length ? "gagal" : "sebagian gagal"} — validasi dibatalkan: ${gagal.map((g) => `${g.nama} (${g.pesan})`).join("; ")}`,
      502,
    );
  }
  const { order: hasilOrder, tagihan } = await jalankanValidasi(faskesUuid, orderUuid, req);
  return { order: hasilOrder, tagihan, pengiriman, koneksi: koneksi.nama };
};

/** Kirim ulang / kirim lagi satu item (Pengiriman PACS, atau order sudah valid). Accession Number tetap sama. */
export const kirimUlangItem = async (faskesUuid, itemUuid, { koneksiUuid = null, pengguna = null } = {}) => {
  const item = await satu(`SELECT * FROM rad_order_item WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [itemUuid, faskesUuid]);
  if (!item) throw tidakDitemukan("Item pemeriksaan radiologi");
  const koneksi = await koneksiUntukKirim(faskesUuid, koneksiUuid ?? item.pacs_koneksi_uuid);
  const order = await detailOrder(item.order_uuid, faskesUuid);
  const i = order.items.find((x) => x.uuid === itemUuid) ?? item;
  return kirimSatuItem(faskesUuid, order, i, koneksi, pengguna);
};

// ── Cek status (item "tidak_pasti") & ambil hasil manual ────────────────────

const urlDenganAccession = (urlTemplat, accessionNumber) => {
  if (/\{accession_number\}/.test(urlTemplat)) return urlTemplat.replace(/\{accession_number\}/g, encodeURIComponent(accessionNumber));
  return `${urlTemplat}${urlTemplat.includes("?") ? "&" : "?"}accession_number=${encodeURIComponent(accessionNumber)}`;
};

export const cekStatusItem = async (faskesUuid, itemUuid) => {
  const k = await satu(
    `SELECT k.uuid AS kirim_uuid, k.status AS status_kirim, k.accession_number, c.nama, c.url_hasil, c.api_key, c.aktif
       FROM rad_pacs_kirim k JOIN rad_pacs_koneksi c ON c.uuid = k.koneksi_uuid
      WHERE k.faskes_uuid = $1 AND k.order_item_uuid = $2 AND c.deleted_at IS NULL
      ORDER BY (k.status = 'tidak_pasti') DESC, k.updated_at DESC LIMIT 1`,
    [faskesUuid, itemUuid],
  );
  if (!k) return { status: "dilewati", pesan: "Belum pernah dikirim ke PACS" };
  if (k.status_kirim !== "tidak_pasti") return { status: "dilewati", pesan: `Status sudah pasti: ${k.status_kirim}` };
  if (!k.url_hasil) return { status: "tidak_pasti", pesan: `URL Ambil Hasil koneksi ${k.nama} belum diatur — cek manual di PACS` };
  let res;
  let json = null;
  try {
    res = await fetch(urlDenganAccession(k.url_hasil, k.accession_number), { headers: { Accept: "application/json", "x-api-key": dekripsi(k.api_key) ?? "" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    try {
      json = JSON.parse(await res.text());
    } catch {
      json = null;
    }
  } catch (error) {
    return { status: "tidak_pasti", pesan: `PACS tidak dapat dihubungi saat cek status: ${error.name === "TimeoutError" ? "waktu habis" : error.message}` };
  }
  const t = sekarang();
  if (res.ok && json?.success !== false && json?.payload) {
    await query(`UPDATE rad_pacs_kirim SET status = 'terkirim', diklaim_pada = NULL, diklaim_oleh = NULL, updated_at = $2, pesan = 'Terdaftar di PACS (hasil Cek Status)' WHERE uuid = $1 AND status = 'tidak_pasti'`, [k.kirim_uuid, t]);
    return { status: "terkirim", pesan: "Terdaftar di PACS (hasil Cek Status)" };
  }
  if (res.status === 404 || /tidak ditemukan|not found/i.test(String(json?.message ?? ""))) {
    await query(`UPDATE rad_pacs_kirim SET status = 'gagal', diklaim_pada = NULL, diklaim_oleh = NULL, updated_at = $2, pesan = 'Tidak ditemukan di PACS (hasil Cek Status) — aman dikirim ulang' WHERE uuid = $1 AND status = 'tidak_pasti'`, [k.kirim_uuid, t]);
    return { status: "gagal", pesan: "Tidak ditemukan di PACS — aman dikirim ulang" };
  }
  return { status: "tidak_pasti", pesan: `Jawaban PACS belum dapat dipastikan (HTTP ${res?.status ?? 0})` };
};

/** Tarik hasil dari PACS (GET url_hasil) untuk satu item yang sudah terkirim, lalu simpan seperti push. */
export const ambilHasilItem = async (faskesUuid, itemUuid) => {
  const k = await satu(
    `SELECT k.accession_number, c.* FROM rad_pacs_kirim k JOIN rad_pacs_koneksi c ON c.uuid = k.koneksi_uuid
      WHERE k.faskes_uuid = $1 AND k.order_item_uuid = $2 AND k.status IN ('terkirim', 'hasil_sebagian') AND c.deleted_at IS NULL
      ORDER BY k.updated_at DESC LIMIT 1`,
    [faskesUuid, itemUuid],
  );
  if (!k) throw new GalatPacs("Item ini belum terkirim ke PACS", 409);
  if (!k.aktif) throw new GalatPacs(`Koneksi PACS ${k.nama} nonaktif`, 409);
  if (!k.url_hasil) throw new GalatPacs(`URL Ambil Hasil belum diatur di koneksi PACS ${k.nama}`, 422);
  let json;
  try {
    const res = await fetch(urlDenganAccession(k.url_hasil, k.accession_number), { headers: { Accept: "application/json", "x-api-key": dekripsi(k.api_key) ?? "" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const teks = await res.text();
    try {
      json = JSON.parse(teks);
    } catch {
      throw new GalatPacs(`Respons PACS bukan JSON (HTTP ${res.status})`, 502);
    }
    if (!res.ok || json?.success === false) throw new GalatPacs(`PACS menolak: ${pesanGalatPacs(json, res.status)}`, 502);
  } catch (error) {
    if (error instanceof GalatPacs) throw error;
    throw new GalatPacs(`PACS tidak dapat dihubungi: ${error.name === "TimeoutError" ? "waktu habis" : error.message}`, 502);
  }
  const body = json?.payload ?? json;
  return terapkanHasil(k, { accession_number: k.accession_number, ...body }, "pull");
};

// ── Terima hasil dari PACS (push) ───────────────────────────────────────────

export const terimaHasil = async (kunci, body) => {
  if (!kunci) throw new GalatPacs("Kunci akses tidak ada (header x-api-key atau parameter ?key=)", 401);
  const koneksi = await satu(`SELECT * FROM rad_pacs_koneksi WHERE kunci_masuk_hash = $1 AND deleted_at IS NULL`, [hashKunci(kunci)]);
  if (!koneksi) throw new GalatPacs("Kunci akses tidak valid", 401);
  if (!koneksi.aktif) throw new GalatPacs("Koneksi PACS nonaktif di SIMRS", 403);
  return terapkanHasil(koneksi, body, "push");
};

// Inti penyimpanan hasil PACS (push maupun tarik): cocokkan item lewat Accession Number, terapkan expertise bila
// belum diisi manual, catat riwayat (termasuk hasil yang diterima tetapi tidak diterapkan — expertise manual sudah ada).
const terapkanHasil = async (koneksi, body, sumber) => {
  const faskesUuid = koneksi.faskes_uuid;
  const accessionNumber = String(body?.accession_number ?? "").trim();
  const t = sekarang();
  const catat = (status, pesan, extra = {}) =>
    sisipkan("rad_pacs_hasil", {
      faskes_uuid: faskesUuid, koneksi_uuid: koneksi.uuid, order_item_uuid: extra.itemUuid ?? null, accession_number: accessionNumber || null,
      status, pesan, payload: body ?? null, diterapkan: !!extra.diterapkan, sumber, created_at: t,
    });

  if (!accessionNumber) {
    await catat("ditolak", "accession_number kosong");
    throw new GalatPacs("accession_number wajib diisi", 400);
  }
  const item = await satu(
    `SELECT i.*, o.faskes_uuid AS order_faskes_uuid FROM rad_order_item i JOIN rad_order o ON o.uuid = i.order_uuid
      WHERE i.accession_number = $1 AND i.deleted_at IS NULL`,
    [accessionNumber],
  );
  if (!item || item.order_faskes_uuid !== faskesUuid) {
    await catat("ditolak", `Accession Number ${accessionNumber} tidak ditemukan pada faskes koneksi ini`);
    throw new GalatPacs(`Accession Number ${accessionNumber} tidak ditemukan`, 404);
  }
  const statusPemeriksaan = String(body?.status ?? "").trim().toLowerCase();
  const expertiseManualAda = !!item.hasil && item.status === "selesai";
  const adaExpertiseBaru = body?.hasil || body?.kesan;

  const perubahan = {};
  if (body?.url_viewer) perubahan.url_viewer = String(body.url_viewer);
  let diterapkan = false;
  if (adaExpertiseBaru && !expertiseManualAda) {
    perubahan.hasil = String(body?.hasil ?? item.hasil ?? "");
    perubahan.kesan = String(body?.kesan ?? item.kesan ?? "");
    perubahan.status = "selesai";
    perubahan.waktu_hasil = sekarang();
    diterapkan = true;
  } else if (statusPemeriksaan === "diperiksa" && item.status === "menunggu") {
    perubahan.status = "diperiksa";
    perubahan.waktu_periksa = item.waktu_periksa ?? sekarang();
  }
  if (Object.keys(perubahan).length) await ubah("rad_order_item", item.uuid, faskesUuid, perubahan);

  // Order selesai bila seluruh item selesai (mengikuti aturan Radiologi — lihat penunjang-service/src/radiologi/hasil.js).
  if (perubahan.status === "selesai") {
    const sisa = await satu(`SELECT COUNT(*)::int n FROM rad_order_item WHERE order_uuid = $1 AND deleted_at IS NULL AND status <> 'selesai'`, [item.order_uuid]);
    if (!sisa.n) await ubah("rad_order", item.order_uuid, faskesUuid, { status: "selesai", selesai_pada: sekarang() });
    else await ubah("rad_order", item.order_uuid, faskesUuid, { status: "diperiksa" });
  }

  const statusLog = diterapkan ? "diterima" : adaExpertiseBaru ? "sebagian" : "diterima";
  const pesan = diterapkan
    ? "Hasil & expertise disimpan"
    : adaExpertiseBaru
      ? "Hasil diterima tetapi tidak diterapkan (expertise manual sudah ada)"
      : "Status/tautan citra disimpan";
  await catat(statusLog, pesan, { itemUuid: item.uuid, diterapkan });
  // Riwayat kirim terkait diberi tanda hasil diterima agar tampil di Pengiriman PACS.
  await query(`UPDATE rad_pacs_kirim SET status = 'terkirim', pesan = $2, updated_at = $3 WHERE order_item_uuid = $1 AND status <> 'terkirim'`, [item.uuid, `${pesan} (hasil diterima)`, t]).catch(() => {});
  return { status: statusLog, pesan, diterapkan, item_uuid: item.uuid };
};

// ── Riwayat pengiriman (Setting › Konfigurasi Integrasi › Pengiriman PACS) ──

export const daftarPengiriman = async (faskesUuid, { page = 1, limit = 10, status = "" } = {}) => {
  const batas = Math.min(100, Math.max(1, Number(limit) || 10));
  const hal = Math.max(1, Number(page) || 1);
  const nilai = [faskesUuid];
  let kondisi = "k.faskes_uuid = $1";
  if (status) {
    nilai.push(status);
    kondisi += ` AND k.status = $${nilai.length}`;
  }
  const total = await satu(`SELECT COUNT(*)::int AS total FROM rad_pacs_kirim k WHERE ${kondisi}`, nilai);
  const data = await query(
    `SELECT k.uuid, k.order_item_uuid, k.accession_number, k.status, k.pesan, k.percobaan, k.updated_at, k.dikirim_oleh,
            c.nama AS koneksi, i.nama AS pemeriksaan, i.status AS status_item, o.no_order, o.no_rm, p.name AS nama_pasien
       FROM rad_pacs_kirim k
       JOIN rad_pacs_koneksi c ON c.uuid = k.koneksi_uuid
       LEFT JOIN rad_order_item i ON i.uuid = k.order_item_uuid
       LEFT JOIN rad_order o ON o.uuid = i.order_uuid
       LEFT JOIN patients p ON p.uuid = o.patient_uuid
      WHERE ${kondisi} ORDER BY k.updated_at DESC LIMIT ${batas} OFFSET ${(hal - 1) * batas}`,
    nilai,
  );
  return { data, pagination: { page: hal, limit: batas, total: total?.total ?? 0 } };
};
