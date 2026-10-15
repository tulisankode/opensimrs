import { randomUUID } from "node:crypto";
import { QueryTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import OrderLabRepository from "../repositories/order-lab-repository.js";
import HasilPemeriksaanService from "../services/hasil-pemeriksaan-service.js";
import { buatRegistrasi, pesanGalatLis, daftarPesanGalat, petakanHasil } from "./lis-peta.js";
import { enkripsi, dekripsi, hashKunci, buatKunci, samarkan } from "./rahasia.js";

// Bridging adamLIS. LIS_MODE=mock → registrasi dibalas tiruan (pengujian tanpa server LIS).
const MODE = process.env.LIS_MODE || "nyata";
const TIMEOUT_MS = Number(process.env.LIS_TIMEOUT_MS) || 15000;

export class GalatLis extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

const sekarang = () => Math.floor(Date.now() / 1000);
const q = (sql, bind = []) => sequelizeInstance.query(sql, { bind, type: QueryTypes.SELECT });
const exec = (sql, bind = []) => sequelizeInstance.query(sql, { bind });

// --- Koneksi LIS (bisa lebih dari satu per faskes) ---------------------------------------------------

const tampil = (k) => ({
  uuid: k.uuid,
  nama: k.nama,
  url_registrasi: k.url_registrasi,
  url_hasil: k.url_hasil ?? null,
  api_key: samarkan(dekripsi(k.api_key)),
  kode_rs: k.kode_rs,
  kunci_masuk: samarkan(dekripsi(k.kunci_masuk)),
  aktif: k.aktif,
  bawaan: k.bawaan,
  updated_at: k.updated_at,
  // kirim massal (MCU): mode per_order | bulk, URL registrasi bulk + kode_lab adamLIS, ukuran batch, jeda & paralel
  mode_kirim: k.mode_kirim ?? "per_order",
  url_registrasi_bulk: k.url_registrasi_bulk ?? null,
  kode_lab: k.kode_lab ?? null,
  ukuran_batch: k.ukuran_batch ?? 100,
  jeda_ms: k.jeda_ms ?? 0,
  maks_paralel: k.maks_paralel ?? 2,
});

// Batas LIS: registrasi bulk menolak data.length >= 150.
export const BATAS_BULK = 149;
const bulat = (v, min, maks, bawaan) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(maks, Math.max(min, n)) : bawaan;
};
const pengaturanKirim = (data, lama = {}) => {
  const mode = String(data?.mode_kirim ?? lama.mode_kirim ?? "per_order");
  if (!["per_order", "bulk"].includes(mode)) throw new GalatLis("Mode kirim harus per_order atau bulk");
  const urlBulk = String(data?.url_registrasi_bulk ?? (data && "url_registrasi_bulk" in data ? "" : lama.url_registrasi_bulk ?? "")).trim() || null;
  if (urlBulk && !validUrl(urlBulk)) {
    throw new GalatLis("URL Registrasi Bulk tidak valid (contoh: http://lis.contoh.id/adam-lis/api/v1/registrasi_bulk_mcu/create)");
  }
  const kodeLab = String(data?.kode_lab ?? (data && "kode_lab" in data ? "" : lama.kode_lab ?? "")).trim().slice(0, 50) || null;
  if (mode === "bulk" && !urlBulk) throw new GalatLis("Mode bulk memerlukan URL Registrasi Bulk");
  if (mode === "bulk" && !kodeLab) throw new GalatLis("Mode bulk memerlukan Kode Lab adamLIS (parameter kode_lab, mis. LAB_EP)");
  return {
    mode,
    urlBulk,
    kodeLab,
    ukuran: bulat(data?.ukuran_batch ?? lama.ukuran_batch, 1, BATAS_BULK, 100),
    jeda: bulat(data?.jeda_ms ?? lama.jeda_ms, 0, 60000, 0),
    paralel: bulat(data?.maks_paralel ?? lama.maks_paralel, 1, 10, 2),
  };
};

export const daftarKoneksi = async (faskesUuid) =>
  (await q(`SELECT * FROM lab_lis_koneksi WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY bawaan DESC, nama`, [faskesUuid])).map(tampil);

const validUrl = (u) => {
  try {
    const url = new URL(String(u));
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

// data: { nama, url_registrasi, api_key?, kode_rs, aktif, bawaan }; api_key kosong saat ubah = tidak diubah.
// Kunci masuk dibuat otomatis saat koneksi baru dan dikembalikan utuh sekali (untuk dipasang di LIS).
export const simpanKoneksi = async (faskesUuid, uuid, data) => {
  const nama = String(data?.nama ?? "").trim();
  const url = String(data?.url_registrasi ?? "").trim();
  const urlHasil = String(data?.url_hasil ?? "").trim() || null;
  if (urlHasil && !validUrl(urlHasil.replace(/\{(no_registrasi|no_lab)\}/g, "x"))) {
    throw new GalatLis("URL Ambil Hasil tidak valid (contoh: http://192.168.1.10:3001/api/v1/arsip/bridging/read?no_reg_rs={no_registrasi})");
  }
  if (!nama) throw new GalatLis("Nama LIS wajib diisi");
  if (!validUrl(url)) throw new GalatLis("URL registrasi LIS tidak valid (contoh: http://192.168.1.10:2311/adam-lis/bridging_sim_rs/registrasi)");
  const t = sekarang();
  const apiKey = String(data?.api_key ?? "").trim();
  let kunciBaru = null;
  let barisUuid = uuid;

  if (uuid) {
    const lama = (await q(`SELECT * FROM lab_lis_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid]))[0];
    if (!lama) throw new GalatLis("Koneksi LIS tidak ditemukan", 404);
    const m = pengaturanKirim(data, lama);
    await exec(
      `UPDATE lab_lis_koneksi SET nama = $3, url_registrasi = $4, api_key = $5, kode_rs = $6, aktif = $7, updated_at = $8, url_hasil = $9,
              mode_kirim = $10, url_registrasi_bulk = $11, kode_lab = $12, ukuran_batch = $13, jeda_ms = $14, maks_paralel = $15
       WHERE uuid = $1 AND faskes_uuid = $2`,
      [uuid, faskesUuid, nama, url, apiKey ? enkripsi(apiKey) : lama.api_key, String(data?.kode_rs ?? "").trim() || null, data?.aktif !== false, t, urlHasil,
       m.mode, m.urlBulk, m.kodeLab, m.ukuran, m.jeda, m.paralel]
    );
  } else {
    kunciBaru = buatKunci();
    const m = pengaturanKirim(data);
    const [baris] = await q(
      `INSERT INTO lab_lis_koneksi (faskes_uuid, nama, url_registrasi, api_key, kode_rs, kunci_masuk, kunci_masuk_hash, aktif, bawaan, created_at, updated_at, url_hasil,
                                    mode_kirim, url_registrasi_bulk, kode_lab, ukuran_batch, jeda_ms, maks_paralel)
       VALUES ($1::varchar,$2,$3,$4,$5,$6,$7,$8,
               NOT EXISTS (SELECT 1 FROM lab_lis_koneksi WHERE faskes_uuid = $1::varchar AND deleted_at IS NULL), $9, $9, $10,
               $11, $12, $13, $14, $15, $16)
       RETURNING uuid`,
      [faskesUuid, nama, url, enkripsi(apiKey), String(data?.kode_rs ?? "").trim() || null, enkripsi(kunciBaru), hashKunci(kunciBaru), data?.aktif !== false, t, urlHasil,
       m.mode, m.urlBulk, m.kodeLab, m.ukuran, m.jeda, m.paralel]
    );
    barisUuid = baris.uuid;
  }
  if (data?.bawaan) await jadikanBawaan(faskesUuid, barisUuid);
  const hasil = (await daftarKoneksi(faskesUuid)).find((k) => k.uuid === barisUuid);
  return kunciBaru ? { ...hasil, kunci_masuk_baru: kunciBaru } : hasil;
};

export const jadikanBawaan = async (faskesUuid, uuid) => {
  await exec(`UPDATE lab_lis_koneksi SET bawaan = (uuid = $2), updated_at = $3 WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [faskesUuid, uuid, sekarang()]);
};

export const buatUlangKunciMasuk = async (faskesUuid, uuid) => {
  const ada = await q(`SELECT 1 FROM lab_lis_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid]);
  if (!ada.length) throw new GalatLis("Koneksi LIS tidak ditemukan", 404);
  const kunci = buatKunci();
  await exec(
    `UPDATE lab_lis_koneksi SET kunci_masuk = $3, kunci_masuk_hash = $4, updated_at = $5 WHERE uuid = $1 AND faskes_uuid = $2`,
    [uuid, faskesUuid, enkripsi(kunci), hashKunci(kunci), sekarang()]
  );
  return { uuid, kunci_masuk_baru: kunci };
};

export const hapusKoneksi = async (faskesUuid, uuid) => {
  await exec(`UPDATE lab_lis_koneksi SET deleted_at = $3, aktif = false, bawaan = false, kunci_masuk_hash = NULL WHERE uuid = $1 AND faskes_uuid = $2`, [uuid, faskesUuid, sekarang()]);
  return { uuid };
};

export const koneksiUntukKirim = async (faskesUuid, uuid) => {
  const rows = await q(
    `SELECT * FROM lab_lis_koneksi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND aktif = true AND ($2::text IS NULL OR uuid = $2::uuid)
     ORDER BY bawaan DESC, nama LIMIT 1`,
    [faskesUuid, uuid || null]
  );
  if (!rows[0]) throw new GalatLis(uuid ? "Koneksi LIS tidak ditemukan atau nonaktif" : "Belum ada koneksi LIS aktif. Atur di Setting › Konfigurasi Integrasi › LIS.");
  return rows[0];
};

// --- Pemetaan item pemeriksaan OpenSIMRS → kode pemeriksaan LIS ---------------------------------------

export const daftarPemetaanItem = (faskesUuid) =>
  q(
    `SELECT ip.uuid, ip.code, ip.name, ip.satuan, ip.kode_lis, cp.name AS kategori
     FROM item_pemeriksaan ip LEFT JOIN category_pemeriksaan cp ON cp.uuid = ip.category_pemeriksaan_uuid
     WHERE ip.faskes_uuid = $1 AND ip.deleted_at IS NULL ORDER BY cp.name NULLS LAST, ip.no_urut NULLS LAST, ip.name`,
    [faskesUuid]
  );

export const simpanPemetaanItem = async (faskesUuid, items = []) => {
  for (const it of items) {
    const kode = String(it?.kode_lis ?? "").trim().slice(0, 50) || null;
    await exec(`UPDATE item_pemeriksaan SET kode_lis = $1 WHERE uuid::text = $2 AND faskes_uuid = $3`, [kode, String(it?.uuid ?? ""), faskesUuid]);
  }
  return daftarPemetaanItem(faskesUuid);
};

// --- Pemetaan tarif lab OpenSIMRS → kode tindakan LIS (tindakan[].kode_tindakan saat registrasi) ------

export const daftarPemetaanTarif = (faskesUuid) =>
  q(
    `SELECT t.uuid, t.code, t.name, t.kode_lis, t.grand_total,
            (SELECT COUNT(*)::int FROM tarif_lab_item i WHERE i.tarif_lab_uuid = t.uuid AND i.deleted_at IS NULL) AS jumlah_item
     FROM tarif_lab t WHERE t.faskes_uuid = $1 AND t.deleted_at IS NULL ORDER BY t.name`,
    [faskesUuid]
  );

export const simpanPemetaanTarif = async (faskesUuid, items = []) => {
  for (const it of items) {
    const kode = String(it?.kode_lis ?? "").trim().slice(0, 50) || null;
    await exec(`UPDATE tarif_lab SET kode_lis = $1 WHERE uuid::text = $2 AND faskes_uuid = $3`, [kode, String(it?.uuid ?? ""), faskesUuid]);
  }
  return daftarPemetaanTarif(faskesUuid);
};

// --- Pemetaan unit asal / dokter / penjamin → kode master LIS ----------------------------------------
// LIS menolak kode baru bila namanya sudah ada di masternya ("Data Unit Asal sudah ada di master data (0202 - …)"),
// jadi kode (dan opsional nama) LIS dipakai menggantikan kode OpenSIMRS saat registrasi.

// Ref khusus order lab MCU: unit asal "MCU" & dokter MCU bawaan (dipetakan di Mapping LIS › Unit, Dokter & Penjamin).
export const REF_MCU = "MCU";

export const daftarPemetaanRef = async (faskesUuid) => {
  const peta = await q(`SELECT jenis, ref_uuid, kode_lis, nama_lis FROM lab_lis_peta_ref WHERE faskes_uuid = $1`, [faskesUuid]);
  const cari = (jenis, uuid) => peta.find((p) => p.jenis === jenis && p.ref_uuid === uuid);
  const gabung = (jenis, rows) =>
    rows.map((r) => ({ ...r, jenis, kode_lis: cari(jenis, r.uuid)?.kode_lis ?? null, nama_lis: cari(jenis, r.uuid)?.nama_lis ?? null }));
  const unit = await q(
    `SELECT uuid, code AS kode, name AS nama, CASE WHEN is_poli THEN 'Poli' WHEN pelayanan = 'IGD' THEN 'IGD' ELSE 'Ruang' END AS keterangan
     FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND (is_poli OR location_type IN ('Ward', 'Room')) ORDER BY is_poli DESC, name`,
    [faskesUuid]
  );
  const dokter = await q(
    `SELECT pr.uuid, pr.code_bpjs AS kode, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, pg.last_title)) AS nama, pr.sip AS keterangan
     FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
     WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND pr.is_doctor ORDER BY pg.name`,
    [faskesUuid]
  );
  const penjamin = await q(
    `SELECT uuid, code AS kode, name AS nama, NULL AS keterangan FROM penjamin WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`,
    [faskesUuid]
  );
  // Perusahaan MCU sebagai penjamin order lab MCU korporasi (ref "mcu:<uuid perusahaan>")
  const perusahaanMcu = await q(
    `SELECT 'mcu:' || uuid AS uuid, kode, nama, 'Perusahaan MCU' AS keterangan FROM mcu_perusahaan
     WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY nama`,
    [faskesUuid]
  ).catch(() => []);
  return {
    unit: gabung("unit", [{ uuid: REF_MCU, kode: "MCU", nama: "Medical Check Up", keterangan: "unit asal order lab MCU" }, ...unit]),
    dokter: gabung("dokter", [
      { uuid: REF_MCU, kode: "MCU", nama: "Dokter MCU", keterangan: "bawaan bila peserta MCU tanpa dokter pengirim" },
      ...dokter,
    ]),
    penjamin: gabung("penjamin", [{ uuid: "TUNAI", kode: "UMUM", nama: "Umum / Tunai (tanpa penjamin)", keterangan: null }, ...perusahaanMcu, ...penjamin]),
  };
};

export const simpanPemetaanRef = async (faskesUuid, items = []) => {
  for (const it of items) {
    const jenis = String(it?.jenis ?? "");
    const ref = String(it?.uuid ?? "");
    if (!["unit", "dokter", "penjamin"].includes(jenis) || !ref) continue;
    const kode = String(it?.kode_lis ?? "").trim().slice(0, 50);
    const nama = String(it?.nama_lis ?? "").trim().slice(0, 200) || null;
    if (!kode) {
      await exec(`DELETE FROM lab_lis_peta_ref WHERE faskes_uuid = $1 AND jenis = $2 AND ref_uuid = $3`, [faskesUuid, jenis, ref]);
      continue;
    }
    await exec(
      `INSERT INTO lab_lis_peta_ref (faskes_uuid, jenis, ref_uuid, kode_lis, nama_lis, updated_at) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (faskes_uuid, jenis, ref_uuid) DO UPDATE SET kode_lis = EXCLUDED.kode_lis, nama_lis = EXCLUDED.nama_lis, updated_at = EXCLUDED.updated_at`,
      [faskesUuid, jenis, ref, kode, nama, sekarang()]
    );
  }
  return daftarPemetaanRef(faskesUuid);
};

// --- Kirim registrasi order ke LIS -----------------------------------------------------------------

const TIMEOUT_BULK_MS = Number(process.env.LIS_BULK_TIMEOUT_MS) || 90000;
// Klaim 'mengirim' yang lebih tua dari ini tanpa hasil tercatat = pemroses mati/restart di tengah request. Order tsb
// TIDAK dikirim ulang otomatis (LIS mungkin sudah menerimanya) melainkan ditandai 'tidak_pasti' → "Cek Status".
// Harus lebih besar dari batas waktu request LIS (bawaan 90 dtk untuk bulk).
export const KLAIM_KEDALUWARSA_DETIK = Math.max(Number(process.env.LIS_KLAIM_DETIK) || 300, Math.ceil(TIMEOUT_BULK_MS / 1000) + 30);

// Galat jaringan yang pasti terjadi SEBELUM request sampai ke LIS → aman dikirim ulang.
const GALAT_BELUM_TERKIRIM = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH", "UND_ERR_CONNECT_TIMEOUT"]);

/**
 * POST JSON ke LIS → { ok, status, json, pasti }. pasti=false: request mungkin sudah diproses LIS tetapi respons tidak
 * diterima utuh (waktu habis, koneksi putus, 502/503/504 proksi, atau 500 bawaan framework tanpa format LIS).
 */
export const postLis = async (url, apiKey, body, timeoutMs = TIMEOUT_MS) => {
  let teks = "";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": apiKey ?? "" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    teks = await res.text();
    let json;
    try {
      json = JSON.parse(teks);
    } catch {
      json = { success: false, message: `Respons LIS bukan JSON (HTTP ${res.status}): ${teks.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)}` };
    }
    const generik = [502, 503, 504].includes(res.status) || (res.status === 500 && json?.success === undefined);
    return { ok: res.ok && json?.success !== false, status: res.status, json, pasti: !generik };
  } catch (error) {
    const kode = error?.cause?.code ?? error?.code;
    const waktuHabis = error?.name === "TimeoutError" || error?.name === "AbortError";
    return {
      ok: false,
      status: 0,
      json: { success: false, message: `LIS tidak dapat dihubungi: ${waktuHabis ? "waktu habis menunggu respons" : kode || error.message}` },
      pasti: !waktuHabis && GALAT_BELUM_TERKIRIM.has(kode),
    };
  }
};

const panggilLis = async (koneksi, body) => {
  if (MODE === "mock") {
    if (!body.tindakan.length) return { ok: false, status: 500, pasti: true, json: { success: false, status: 500, message: [{ value: "-", msg: "Tidak ada tindakan", param: "Kode" }] } };
    const tgl = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    return { ok: true, status: 200, pasti: true, json: { success: true, status: 200, message: "Registrasi Berhasil", payload: { registrasi: { no_lab: `SIM/${tgl}/${String(Date.now()).slice(-4)}`, no_registrasi: `${tgl}${String(Date.now()).slice(-4)}` } } } };
  }
  return postLis(koneksi.url_registrasi, dekripsi(koneksi.api_key), body);
};

/** URL registrasi bulk + ?kode_rs=&kode_lab= (bila belum ada di URL). */
export const urlBulk = (koneksi) => {
  const url = new URL(koneksi.url_registrasi_bulk);
  if (!url.searchParams.has("kode_rs") && koneksi.kode_rs) url.searchParams.set("kode_rs", koneksi.kode_rs);
  if (!url.searchParams.has("kode_lab") && koneksi.kode_lab) url.searchParams.set("kode_lab", koneksi.kode_lab);
  return url.toString();
};
export const panggilLisBulk = (koneksi, body) => postLis(urlBulk(koneksi), dekripsi(koneksi.api_key), body, TIMEOUT_BULK_MS);

// Data peserta MCU pemilik order lab (penunjang-service, database bersama).
const dataMcu = async (orderUuid) =>
  (
    await q(
      `SELECT s.uuid, s.no_mcu, s.no_registrasi, s.cara_bayar, s.perusahaan_uuid, s.penjamin_uuid, s.unit_asal_uuid, s.dokter_pengirim_uuid,
              s.dokter_pemeriksa_uuid, s.icd10_code, s.icd10_nama, s.tanggal::text AS tanggal, pr.nama AS perusahaan, pr.kode AS kode_perusahaan
       FROM mcu_peserta s LEFT JOIN mcu_perusahaan pr ON pr.uuid = s.perusahaan_uuid
       WHERE s.lab_order_uuid = $1 AND s.deleted_at IS NULL ORDER BY s.created_at DESC LIMIT 1`,
      [orderUuid]
    ).catch(() => [])
  )[0] ?? null;

const dokterRingkas = async (uuid) =>
  uuid
    ? (
        await q(
          `SELECT pr.uuid, pr.code_bpjs, pr.satu_sehat_id, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, pg.last_title)) AS nama
           FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid WHERE pr.uuid = $1`,
          [uuid]
        )
      )[0] ?? null
    : null;

export const dataOrder = async (faskesUuid, orderUuid) => {
  const order = await OrderLabRepository.findByUuid(orderUuid, faskesUuid);
  if (!order) throw new GalatLis("Order lab tidak ditemukan", 404);
  const o = typeof order.toJSON === "function" ? order.toJSON() : order;
  const [lokasi] = o.lokasi_uuid ? await q(`SELECT code, name FROM lokasi WHERE uuid = $1`, [o.lokasi_uuid]) : [];
  const [penjamin] = o.penjamin_uuid ? await q(`SELECT code, name FROM penjamin WHERE uuid = $1`, [o.penjamin_uuid]) : [];
  const [ekstra] = await q(`SELECT is_mcu, practitioner_uuid, cito FROM order_lab WHERE uuid = $1`, [orderUuid]);
  // kode tindakan LIS per tarif (kolom kode_lis tidak ada di model SDK → kueri langsung)
  const tarifUuids = (o.order_lab_pemeriksaan ?? []).map((p) => p.tarif_lab?.uuid ?? p.tarif_lab_uuid).filter(Boolean);
  if (tarifUuids.length) {
    const kode = new Map((await q(`SELECT uuid, kode_lis FROM tarif_lab WHERE uuid = ANY($1)`, [tarifUuids])).map((t) => [t.uuid, t.kode_lis]));
    for (const p of o.order_lab_pemeriksaan ?? []) {
      if (p.tarif_lab) p.tarif_lab.kode_lis = kode.get(p.tarif_lab.uuid ?? p.tarif_lab_uuid) ?? null;
    }
  }
  // Order lab MCU: unit asal "MCU", dokter pengirim = dokter peserta (impor) / dokter pemeriksa / Dokter MCU bawaan,
  // penjamin = penjamin peserta (impor) / perusahaan korporasi / Umum — masing-masing lewat Mapping LIS bila ada.
  const mcu = ekstra?.is_mcu ? await dataMcu(orderUuid) : null;
  const dokterUuid = o.dokter_pengirim_uuid ?? mcu?.dokter_pengirim_uuid ?? mcu?.dokter_pemeriksa_uuid ?? null;
  const unitRef = mcu && !mcu.unit_asal_uuid ? REF_MCU : o.lokasi_uuid ?? "";
  const penjaminRef = mcu
    ? mcu.penjamin_uuid ?? (mcu.cara_bayar === "korporasi" && mcu.perusahaan_uuid ? `mcu:${mcu.perusahaan_uuid}` : "TUNAI")
    : o.penjamin_uuid && Number(o.payment_method) !== 1 ? o.penjamin_uuid : "TUNAI";
  // kode master LIS untuk unit asal, dokter pengirim & penjamin (Laboratorium › Mapping LIS)
  const lisRef = {};
  for (const r of await q(
    `SELECT jenis, kode_lis, nama_lis FROM lab_lis_peta_ref WHERE faskes_uuid = $1 AND ((jenis = 'unit' AND ref_uuid = $2)
       OR (jenis = 'dokter' AND ref_uuid = $3) OR (jenis = 'penjamin' AND ref_uuid = $4))`,
    [faskesUuid, unitRef, dokterUuid ?? (mcu ? REF_MCU : ""), penjaminRef]
  )) lisRef[r.jenis] = r;
  if (mcu) {
    // pemetaan boleh hanya berisi kode LIS: nama dilengkapi dari nama bawaan MCU / perusahaan
    if (unitRef === REF_MCU) lisRef.unit = { kode_lis: lisRef.unit?.kode_lis ?? "MCU", nama_lis: lisRef.unit?.nama_lis ?? "Medical Check Up" };
    if (penjaminRef.startsWith("mcu:")) lisRef.penjamin = { kode_lis: lisRef.penjamin?.kode_lis ?? mcu.kode_perusahaan, nama_lis: lisRef.penjamin?.nama_lis ?? mcu.perusahaan };
    if (!lisRef.dokter) {
      // dokter tanpa pemetaan: kode BPJS/SATUSEHAT praktisi; tanpa dokter: pemetaan "Dokter MCU" bawaan atau "MCU"
      const d = await dokterRingkas(dokterUuid);
      const bawaan = d ? null : (await q(`SELECT kode_lis, nama_lis FROM lab_lis_peta_ref WHERE faskes_uuid = $1 AND jenis = 'dokter' AND ref_uuid = $2`, [faskesUuid, REF_MCU]))[0];
      lisRef.dokter = d
        ? { kode_lis: d.code_bpjs || d.satu_sehat_id || d.uuid, nama_lis: d.nama }
        : { kode_lis: bawaan?.kode_lis ?? "MCU", nama_lis: bawaan?.nama_lis ?? "Dokter MCU" };
    } else if (!lisRef.dokter.nama_lis) {
      lisRef.dokter = { ...lisRef.dokter, nama_lis: (await dokterRingkas(dokterUuid))?.nama ?? "Dokter MCU" };
    }
  }
  return {
    ...o,
    is_mcu: !!ekstra?.is_mcu,
    cito: o.cito ?? ekstra?.cito,
    practitioner_uuid: o.practitioner_uuid ?? ekstra?.practitioner_uuid ?? null,
    mcu,
    dokter_mcu_uuid: dokterUuid,
    icdt: mcu?.icd10_code ? { kode: mcu.icd10_code, nama: mcu.icd10_nama } : null,
    lis_ref: lisRef,
    lokasi: { ...(o.lokasi ?? {}), ...(lokasi ?? {}) },
    lokasi_kode: lokasi?.code,
    penjamin: penjamin ?? o.penjamin ?? null,
  };
};

/** Tarif order yang belum punya Kode Tindakan LIS (Mapping LIS › Tindakan). */
export const tindakanBelumDipetakan = (order) =>
  (order.order_lab_pemeriksaan ?? []).filter((p) => p.tarif_lab && !String(p.tarif_lab.kode_lis ?? "").trim()).map((p) => p.tarif_lab.name);

/** Pratinjau body registrasi yang akan dikirim ke LIS (tanpa mengirim). */
export const pratinjauOrder = async (faskesUuid, orderUuid, { koneksiUuid = null } = {}) => {
  const koneksi = await koneksiUntukKirim(faskesUuid, koneksiUuid);
  const order = await dataOrder(faskesUuid, orderUuid);
  return { lis: koneksi.nama, url_registrasi: koneksi.url_registrasi, body: buatRegistrasi(order, koneksi) };
};

// --- Klaim atomik per order (anti kirim dobel) --------------------------------------------------------
// Satu baris lab_lis_kirim per (faskes, order, koneksi) (UNIQUE). Sebelum request ke LIS, pemroses wajib mengklaim
// baris tsb dalam SATU pernyataan INSERT … ON CONFLICT DO UPDATE … WHERE status boleh-kirim … RETURNING. PostgreSQL
// mengunci baris yang bentrok; pemroses kedua menunggu lalu mengevaluasi ulang WHERE terhadap versi terbaru
// (status sudah 'mengirim') → tidak mendapat baris → tidak mengirim. Jadi dua klik, dua petugas/tab, atau retry saat
// batch berjalan tidak pernah mengirim order yang sama dua kali. 'terkirim' hanya boleh diklaim ulang lewat kirim manual
// per order (Laboratorium › "Kirim ulang"), tidak pernah lewat kirim massal; 'tidak_pasti' tidak pernah diklaim otomatis.
export const klaimKirim = async ({ faskesUuid, koneksiUuid, orderUuid, noRegistrasi, pemroses, batchUuid = null, bolehTerkirim = false }) => {
  const t = sekarang();
  const [baris] = await q(
    `INSERT INTO lab_lis_kirim (faskes_uuid, koneksi_uuid, order_lab_uuid, no_registrasi, status, percobaan, diklaim_pada, diklaim_oleh, batch_uuid, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'mengirim', 0, $5, $6, $7, $5, $5)
     ON CONFLICT (faskes_uuid, order_lab_uuid, koneksi_uuid) DO UPDATE SET
       status = 'mengirim', diklaim_pada = EXCLUDED.diklaim_pada, diklaim_oleh = EXCLUDED.diklaim_oleh, batch_uuid = EXCLUDED.batch_uuid,
       no_registrasi = EXCLUDED.no_registrasi, updated_at = EXCLUDED.updated_at
     WHERE lab_lis_kirim.status = ANY($8::varchar[])
     RETURNING uuid`,
    [faskesUuid, koneksiUuid, orderUuid, noRegistrasi, t, pemroses, batchUuid, bolehTerkirim ? ["baru", "gagal", "terkirim"] : ["baru", "gagal"]]
  );
  return baris?.uuid ?? null;
};

/** Catat hasil request untuk klaim milik pemroses (status mengirim, atau tidak_pasti bila klaim sempat dianggap macet). */
export const selesaikanKirim = async ({ kirimUuid, pemroses, status, pesan, noLab = null, noRegLis = null, permintaan = null, respons = null, pengguna = null }) => {
  const [baris] = await q(
    `UPDATE lab_lis_kirim SET status = $3::varchar, pesan = $4, lis_no_lab = COALESCE($5, lis_no_lab), lis_no_registrasi = COALESCE($6, lis_no_registrasi),
            permintaan = COALESCE($7::jsonb, permintaan), respons = $8::jsonb, dikirim_oleh = COALESCE($9, dikirim_oleh), percobaan = percobaan + 1,
            diklaim_pada = CASE WHEN $3::varchar = 'tidak_pasti' THEN diklaim_pada END,
            diklaim_oleh = CASE WHEN $3::varchar = 'tidak_pasti' THEN diklaim_oleh END,
            updated_at = $10
     WHERE uuid = $1 AND diklaim_oleh = $2 AND status IN ('mengirim', 'tidak_pasti')
     RETURNING uuid`,
    [kirimUuid, pemroses, status, pesan, noLab, noRegLis, permintaan ? JSON.stringify(permintaan) : null, JSON.stringify(respons ?? null), pengguna, sekarang()]
  );
  return !!baris;
};

/** Klaim 'mengirim' yang kedaluwarsa (pemroses mati) → 'tidak_pasti'. Dipanggil berkala oleh pengelola batch. */
export const tandaiKlaimMacet = async () => {
  const rows = await q(
    `UPDATE lab_lis_kirim SET status = 'tidak_pasti', updated_at = $2,
            pesan = 'Pengiriman terhenti sebelum respons LIS diterima (layanan berhenti/restart?). Order mungkin sudah terdaftar di LIS — lakukan Cek Status sebelum mengirim ulang.'
     WHERE status = 'mengirim' AND diklaim_pada < $1 RETURNING uuid`,
    [sekarang() - KLAIM_KEDALUWARSA_DETIK, sekarang()]
  );
  return rows.length;
};

// Validasi otomatis order lab MCU setelah registrasi LIS berhasil (status 1 → 2; tanpa tagihan karena is_mcu, harga
// sudah termasuk paket MCU). Dokter penanggung jawab = dokter MCU peserta, bila kosong dokter bawaan faskes (dokter
// Sp.PK pertama, selain itu dokter pertama menurut nama). Spesimen dibiarkan kosong (diisi petugas lab bila perlu).
export const validasiOrderMcu = async (faskesUuid, order) => {
  if (!order.is_mcu || Number(order.order_status) !== 1) return false;
  let dokter = order.practitioner_uuid ?? order.dokter_mcu_uuid ?? null;
  if (!dokter) {
    const [d] = await q(
      `SELECT pr.uuid FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
       WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND pr.is_doctor
       ORDER BY (CONCAT_WS(' ', pg.first_title, pg.name, pg.last_title) ~* 'sp\\.? ?pk') DESC, pg.name LIMIT 1`,
      [faskesUuid]
    );
    dokter = d?.uuid ?? null;
  }
  const rows = await q(
    `UPDATE order_lab SET order_status = 2, practitioner_uuid = COALESCE(practitioner_uuid, $3), waktu_validasi = $4, updated_at = $5
     WHERE uuid = $1 AND faskes_uuid = $2 AND order_status = 1 AND is_mcu = true RETURNING uuid`,
    [String(order.uuid), faskesUuid, dokter, String(Date.now()), sekarang()]
  );
  return rows.length > 0;
};

/**
 * Kirim registrasi satu order ke LIS (Laboratorium: "Validasi & Kirim ke LIS" / "Kirim ulang"). Memakai klaim atomik:
 * bila order sedang dikirim proses lain (mis. batch MCU) → galat 409. Galat LIS tidak dilempar: dicatat & dikembalikan.
 */
export const kirimOrder = async (faskesUuid, orderUuid, { koneksiUuid = null, pengguna = null } = {}) => {
  const koneksi = await koneksiUntukKirim(faskesUuid, koneksiUuid);
  const order = await dataOrder(faskesUuid, orderUuid);
  if (Number(order.order_status) === 0) throw new GalatLis("Order lab sudah dibatalkan");
  const body = buatRegistrasi(order, koneksi);
  const pemroses = `manual:${randomUUID()}`;
  const kirimUuid = await klaimKirim({ faskesUuid, koneksiUuid: koneksi.uuid, orderUuid, noRegistrasi: body.registrasi.no_registrasi, pemroses, bolehTerkirim: true });
  if (!kirimUuid) {
    const [st] = await q(`SELECT status FROM lab_lis_kirim WHERE faskes_uuid = $1 AND order_lab_uuid = $2 AND koneksi_uuid = $3`, [faskesUuid, orderUuid, koneksi.uuid]);
    throw new GalatLis(
      st?.status === "tidak_pasti"
        ? "Status order ini di LIS belum pasti (pengiriman sebelumnya tidak mendapat respons). Lakukan Cek Status terlebih dahulu."
        : "Order ini sedang dikirim ke LIS oleh proses lain. Tunggu hingga selesai.",
      409
    );
  }
  const { ok, status, json, pasti } = await panggilLis(koneksi, body);
  const reg = json?.payload?.registrasi ?? {};
  const hasil = {
    status: ok ? "terkirim" : pasti ? "gagal" : "tidak_pasti",
    pesan: ok ? json?.message || "Registrasi berhasil" : pasti ? pesanGalatLis(json, status) : `${pesanGalatLis(json, status)} — status di LIS belum pasti, lakukan Cek Status sebelum mengirim ulang`,
    lis: koneksi.nama,
    no_lab: reg.no_lab ?? null,
    no_registrasi_lis: reg.no_registrasi ?? null,
  };
  await selesaikanKirim({
    kirimUuid, pemroses, status: hasil.status, pesan: hasil.pesan, noLab: hasil.no_lab, noRegLis: hasil.no_registrasi_lis,
    permintaan: body, respons: json, pengguna,
  });
  return hasil;
};

/** Kirim satu order untuk batch (mode per_order): klaim → kirim → catat → validasi otomatis order MCU. */
export const kirimOrderBatch = async ({ koneksi, faskesUuid, orderUuid, pemroses, batchUuid, pengguna }) => {
  const order = await dataOrder(faskesUuid, orderUuid);
  const cegah = alasanTidakDikirim(order);
  if (cegah) return { status: cegah.status, pesan: cegah.pesan };
  const body = buatRegistrasi(order, koneksi);
  const kirimUuid = await klaimKirim({ faskesUuid, koneksiUuid: koneksi.uuid, orderUuid, noRegistrasi: body.registrasi.no_registrasi, pemroses, batchUuid });
  if (!kirimUuid) return statusBukanKlaim(faskesUuid, orderUuid, koneksi.uuid);
  const { ok, status, json, pasti } = await panggilLis(koneksi, body);
  const reg = json?.payload?.registrasi ?? {};
  const hasil = {
    status: ok ? "terkirim" : pasti ? "gagal" : "tidak_pasti",
    pesan: ok ? json?.message || "Registrasi berhasil" : pasti ? pesanGalatLis(json, status) : `${pesanGalatLis(json, status)} — status di LIS belum pasti, lakukan Cek Status sebelum mengirim ulang`,
    no_lab: reg.no_lab ?? null,
  };
  await selesaikanKirim({ kirimUuid, pemroses, status: hasil.status, pesan: hasil.pesan, noLab: hasil.no_lab, noRegLis: reg.no_registrasi ?? null, permintaan: body, respons: json, pengguna });
  if (ok) await validasiOrderMcu(faskesUuid, order);
  return hasil;
};

/** Order yang tidak boleh/tidak perlu dikirim: dibatalkan, selesai, atau belum divalidasi (non-MCU). */
export const alasanTidakDikirim = (order) => {
  const st = Number(order.order_status);
  if (st === 0) return { status: "gagal", pesan: "Order lab sudah dibatalkan" };
  if (st === 3) return { status: "dilewati", pesan: "Order lab sudah selesai (hasil lengkap) — tidak dikirim" };
  if (st === 1 && !order.is_mcu) return { status: "gagal", pesan: "Order lab belum divalidasi" };
  if (!(order.order_lab_pemeriksaan ?? []).some((p) => p.tarif_lab)) return { status: "gagal", pesan: "Order lab tidak memiliki pemeriksaan" };
  return null;
};

/** Alasan klaim tidak didapat (status baris saat ini). */
export const statusBukanKlaim = async (faskesUuid, orderUuid, koneksiUuid) => {
  const [k] = await q(`SELECT status, lis_no_lab FROM lab_lis_kirim WHERE faskes_uuid = $1 AND order_lab_uuid = $2 AND koneksi_uuid = $3`, [faskesUuid, orderUuid, koneksiUuid]);
  if (k?.status === "terkirim") return { status: "dilewati", pesan: `Sudah terkirim (No. Lab ${k.lis_no_lab ?? "-"})`, no_lab: k.lis_no_lab };
  if (k?.status === "tidak_pasti") return { status: "tidak_pasti", pesan: "Status di LIS belum pasti — lakukan Cek Status sebelum mengirim ulang" };
  return { status: "dilewati", pesan: "Sedang dikirim oleh proses lain" };
};

export const statusKirimOrder = (faskesUuid, orderUuid) =>
  q(
    `SELECT k.status, k.pesan, k.lis_no_lab, k.lis_no_registrasi, k.percobaan, k.updated_at, c.nama AS lis
     FROM lab_lis_kirim k JOIN lab_lis_koneksi c ON c.uuid = k.koneksi_uuid
     WHERE k.faskes_uuid = $1 AND k.order_lab_uuid = $2 ORDER BY k.updated_at DESC`,
    [faskesUuid, orderUuid]
  );

export const daftarKirim = async (faskesUuid, { page = 1, limit = 10, status = "" } = {}) => {
  const batas = Math.min(100, Math.max(1, Number(limit) || 10));
  const hal = Math.max(1, Number(page) || 1);
  const nilai = [faskesUuid];
  let kondisi = "k.faskes_uuid = $1";
  if (status) {
    nilai.push(status);
    kondisi += ` AND k.status = $${nilai.length}`;
  }
  const [total] = await q(`SELECT COUNT(*)::int AS total FROM lab_lis_kirim k WHERE ${kondisi}`, nilai);
  const data = await q(
    `SELECT k.uuid, k.order_lab_uuid, k.no_registrasi, k.lis_no_lab, k.status, k.pesan, k.percobaan, k.updated_at, k.dikirim_oleh,
            c.nama AS lis, o.no_rm, p.name AS nama_pasien,
            (SELECT h.status FROM lab_lis_hasil h WHERE h.faskes_uuid = k.faskes_uuid AND h.order_lab_uuid = k.order_lab_uuid ORDER BY h.created_at DESC LIMIT 1) AS status_hasil
     FROM lab_lis_kirim k
     JOIN lab_lis_koneksi c ON c.uuid = k.koneksi_uuid
     LEFT JOIN order_lab o ON o.uuid::text = k.order_lab_uuid
     LEFT JOIN patients p ON p.uuid = o.patient_uuid
     WHERE ${kondisi} ORDER BY k.updated_at DESC LIMIT ${batas} OFFSET ${(hal - 1) * batas}`,
    nilai
  );
  return { data, pagination: { page: hal, limit: batas, total: total?.total ?? 0 } };
};

// --- Terima hasil dari LIS ---------------------------------------------------------------------------

/**
 * @param {string} kunci   kunci masuk (header x-api-key atau ?key=)
 * @param {object} body    payload LIS
 * @returns {{ status, pesan, terpetakan, tidakTerpetakan }}
 */
export const terimaHasil = async (kunci, body) => {
  if (!kunci) throw new GalatLis("Kunci akses tidak ada (header x-api-key atau parameter ?key=)", 401);
  const [koneksi] = await q(`SELECT * FROM lab_lis_koneksi WHERE kunci_masuk_hash = $1 AND deleted_at IS NULL`, [hashKunci(kunci)]);
  if (!koneksi) throw new GalatLis("Kunci akses tidak valid", 401);
  if (!koneksi.aktif) throw new GalatLis("Koneksi LIS nonaktif di SIMRS", 403);
  return prosesHasil(koneksi, body, "push");
};

/**
 * Tarik hasil dari LIS (GET url_hasil koneksi) untuk satu order yang sudah terkirim, lalu simpan seperti push.
 * url_hasil boleh memuat {no_registrasi} / {no_lab}; tanpa placeholder → ditambah ?no_reg_rs=<no_registrasi>.
 */
export const tarikHasil = async (faskesUuid, orderUuid) => {
  const [kirim] = await q(
    `SELECT k.no_registrasi, k.lis_no_lab, c.* FROM lab_lis_kirim k JOIN lab_lis_koneksi c ON c.uuid = k.koneksi_uuid
     WHERE k.faskes_uuid = $1 AND k.order_lab_uuid = $2 AND k.status = 'terkirim' AND c.deleted_at IS NULL
     ORDER BY k.updated_at DESC LIMIT 1`,
    [faskesUuid, orderUuid]
  );
  if (!kirim) throw new GalatLis("Order ini belum terkirim ke LIS", 409);
  if (!kirim.aktif) throw new GalatLis(`Koneksi LIS ${kirim.nama} nonaktif`, 409);
  if (!kirim.url_hasil) throw new GalatLis(`URL Ambil Hasil belum diatur di koneksi LIS ${kirim.nama} (Setting › Konfigurasi Integrasi › LIS)`, 422);
  const url = urlHasilOrder(kirim);
  if (MODE === "mock") throw new GalatLis("LIS_MODE=mock: tarik hasil tidak tersedia", 422);
  let json;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "x-api-key": dekripsi(kirim.api_key) ?? "" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const teks = await res.text();
    try {
      json = JSON.parse(teks);
    } catch {
      throw new GalatLis(`Respons LIS bukan JSON (HTTP ${res.status})`, 502);
    }
    if (!res.ok || json?.success === false) throw new GalatLis(`LIS menolak: ${pesanGalatLis(json, res.status)}`, 502);
  } catch (error) {
    if (error instanceof GalatLis) throw error;
    throw new GalatLis(`LIS tidak dapat dihubungi: ${error.name === "TimeoutError" ? "waktu habis" : error.message}`, 502);
  }
  const body = json?.payload ?? json;
  if (!Array.isArray(body?.pemeriksaan) || !body.pemeriksaan.length) throw new GalatLis("Hasil belum tersedia di LIS", 404);
  // pastikan respons milik order ini (no. registrasi / no. lab sama)
  if (!body.no_laboratorium && !body.no_registrasi) body.no_registrasi = kirim.no_registrasi;
  return prosesHasil(kirim, body, "tarik");
};

// Inti penyimpanan hasil LIS (push maupun tarik): cocokkan order, petakan item, simpan via service input hasil.
const prosesHasil = async (koneksi, body, sumber) => {
  const faskesUuid = koneksi.faskes_uuid;
  const noReg = String(body?.no_registrasi ?? "").trim();
  const noLab = String(body?.no_laboratorium ?? "").trim();
  const pemeriksaan = Array.isArray(body?.pemeriksaan) ? body.pemeriksaan : [];
  const t = sekarang();
  const catat = (status, pesan, extra = {}) =>
    exec(
      `INSERT INTO lab_lis_hasil (faskes_uuid, koneksi_uuid, order_lab_uuid, no_registrasi, no_laboratorium, status, pesan, jumlah_hasil, jumlah_terpetakan, tidak_terpetakan, payload, created_at, sumber)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [faskesUuid, koneksi.uuid, extra.orderUuid ?? null, noReg || null, noLab || null, status, pesan, pemeriksaan.length,
       extra.terpetakan ?? 0, JSON.stringify(extra.tidakTerpetakan ?? []), JSON.stringify(body ?? null), t, sumber]
    );

  if (!noReg && !noLab) {
    await catat("gagal", "no_registrasi / no_laboratorium kosong");
    throw new GalatLis("no_registrasi atau no_laboratorium wajib diisi", 400);
  }
  // Pencocokan order: No. Lab LIS (dikembalikan LIS saat registrasi & disimpan di lab_lis_kirim.lis_no_lab) diutamakan,
  // lalu nomor order SIMRS (no_registrasi) / nomor registrasi LIS.
  const [kirim] = await q(
    `SELECT order_lab_uuid FROM lab_lis_kirim
     WHERE faskes_uuid = $1 AND status = 'terkirim'
       AND (($3::varchar <> '' AND lis_no_lab = $3::varchar)
            OR ($2::varchar <> '' AND (no_registrasi = $2::varchar OR lis_no_registrasi = $2::varchar)))
     ORDER BY ($3::varchar <> '' AND lis_no_lab = $3::varchar) DESC, updated_at DESC LIMIT 1`,
    [faskesUuid, noReg, noLab]
  );
  const [order] = kirim
    ? await q(`SELECT uuid, order_status FROM order_lab WHERE uuid::text = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [kirim.order_lab_uuid, faskesUuid])
    : await q(`SELECT uuid, order_status FROM order_lab WHERE no_order = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [noReg, faskesUuid]);
  if (!order) {
    await catat("gagal", `Order dengan no_registrasi ${noReg || "-"} tidak ditemukan`);
    throw new GalatLis(`Order dengan no_registrasi ${noReg || "-"} tidak ditemukan di SIMRS`, 404);
  }
  const orderUuid = String(order.uuid);
  if (Number(order.order_status) !== 2) {
    const pesan = Number(order.order_status) === 3 ? "Order sudah selesai di SIMRS; hasil tidak diubah" : "Order belum divalidasi di SIMRS";
    await catat("gagal", pesan, { orderUuid });
    throw new GalatLis(pesan, 409);
  }

  const observasi = await q(
    `SELECT oi.uuid, oi.item_pemeriksaan_uuid AS item_uuid, ip.kode_lis AS item_kode_lis, ip.code AS item_kode, ip.name AS item_nama
     FROM observation_item oi JOIN item_pemeriksaan ip ON ip.uuid = oi.item_pemeriksaan_uuid
     WHERE oi.order_lab_uuid = $1 AND oi.faskes_uuid = $2 AND oi.deleted_at IS NULL`,
    [orderUuid, faskesUuid]
  );
  // kode tindakan (kode tarif + kode tindakan LIS) yang memuat tiap item order, untuk pencocokan per kode_tindakan_simrs
  const tindakanItem = await q(
    `SELECT DISTINCT x.item_uuid, t.code, t.kode_lis
     FROM order_lab_pemeriksaan olp
     JOIN tarif_lab t ON t.uuid = olp.tarif_lab_uuid
     JOIN tarif_lab_item tli ON tli.tarif_lab_uuid = t.uuid AND tli.deleted_at IS NULL
     JOIN LATERAL (
       SELECT tli.item_pemeriksaan_uuid AS item_uuid WHERE tli.item_pemeriksaan_uuid IS NOT NULL
       UNION SELECT ikp.item_pemeriksaan_uuid FROM item_kelompok_pemeriksaan ikp
        WHERE ikp.kelompok_pemeriksaan_uuid = tli.kelompok_pemeriksaan_uuid AND ikp.deleted_at IS NULL
     ) x ON true
     WHERE olp.order_lab_uuid::text = $1 AND olp.deleted_at IS NULL`,
    [orderUuid]
  );
  const { hasil, tidakTerpetakan } = petakanHasil(
    pemeriksaan,
    observasi.map((o) => {
      const itemUuid = String(o.item_uuid);
      const tindakan = tindakanItem.filter((t) => String(t.item_uuid) === itemUuid).flatMap((t) => [t.code, t.kode_lis].filter(Boolean));
      return { ...o, uuid: String(o.uuid), tindakan };
    })
  );
  if (!hasil.length) {
    const pesan = "Tidak ada hasil yang cocok dengan item pemeriksaan order (cocokkan kode item pemeriksaan OpenSIMRS dengan kode_pemeriksaan_lis)";
    await catat("gagal", pesan, { orderUuid, tidakTerpetakan });
    throw new GalatLis(pesan, 422);
  }
  // simpan lewat service input hasil agar flag dihitung dari nilai rujukan OpenSIMRS seperti input manual
  await HasilPemeriksaanService.inputHasilPemeriksaan({
    order_lab_uuid: orderUuid,
    faskes_uuid: faskesUuid,
    ...(body?.keterangan_hasil && body.keterangan_hasil !== "-" ? { catatan_analis: String(body.keterangan_hasil) } : {}),
    hasil_pemeriksaan: hasil.map(({ observation_item_uuid, result }) => ({ observation_item_uuid, result })),
  });
  // item tanpa nilai rujukan di OpenSIMRS: pakai flag dari LIS (N/H/L/…) sebagai cadangan
  for (const h of hasil.filter((x) => x.flag_lis)) {
    await exec(`UPDATE observation_item SET flag = $2 WHERE uuid::text = $1 AND flag IS NULL AND result IS NOT NULL`, [h.observation_item_uuid, h.flag_lis]);
  }
  const status = tidakTerpetakan.length ? "sebagian" : "diterima";
  const pesan = tidakTerpetakan.length
    ? `${hasil.length} hasil disimpan, ${tidakTerpetakan.length} tidak cocok dengan item pemeriksaan`
    : `${hasil.length} hasil disimpan`;
  await catat(status, pesan, { orderUuid, terpetakan: hasil.length, tidakTerpetakan });
  return { status, pesan, terpetakan: hasil.length, tidakTerpetakan };
};

// --- Cek status registrasi yang tidak pasti ----------------------------------------------------------------
// Request yang tidak mendapat respons (waktu habis / layanan restart) mungkin sudah diterima LIS. Sebelum boleh dikirim
// ulang, statusnya dicek lewat URL Ambil Hasil (GET per no_registrasi): data ditemukan → 'terkirim' (No. Lab dari LIS);
// LIS menjawab tidak ditemukan (404 / "tidak ditemukan") → 'gagal' (aman dikirim ulang); selain itu tetap tidak pasti.
const urlHasilOrder = (kirim) => {
  const isi = (v) => encodeURIComponent(String(v ?? ""));
  let url = String(kirim.url_hasil);
  if (/\{no_registrasi\}|\{no_lab\}/.test(url)) return url.replace(/\{no_registrasi\}/g, isi(kirim.no_registrasi)).replace(/\{no_lab\}/g, isi(kirim.lis_no_lab));
  return `${url}${url.includes("?") ? "&" : "?"}no_reg_rs=${isi(kirim.no_registrasi)}`;
};

export const cekStatusOrder = async (faskesUuid, orderUuid) => {
  const [k] = await q(
    `SELECT k.uuid AS kirim_uuid, k.status AS status_kirim, k.no_registrasi, k.lis_no_lab, c.nama, c.url_hasil, c.api_key, c.aktif
     FROM lab_lis_kirim k JOIN lab_lis_koneksi c ON c.uuid = k.koneksi_uuid
     WHERE k.faskes_uuid = $1 AND k.order_lab_uuid = $2 AND c.deleted_at IS NULL ORDER BY (k.status = 'tidak_pasti') DESC, k.updated_at DESC LIMIT 1`,
    [faskesUuid, orderUuid]
  );
  if (!k) return { status: "dilewati", pesan: "Belum pernah dikirim ke LIS" };
  if (k.status_kirim !== "tidak_pasti") return { status: "dilewati", pesan: `Status sudah pasti: ${k.status_kirim}` };
  if (!k.url_hasil) return { status: "tidak_pasti", pesan: `URL Ambil Hasil koneksi ${k.nama} belum diatur — cek manual di LIS lalu pilih "Tandai Belum Terdaftar" bila memang tidak ada` };
  let res;
  let json = null;
  try {
    res = await fetch(urlHasilOrder(k), { headers: { Accept: "application/json", "x-api-key": dekripsi(k.api_key) ?? "" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    try {
      json = JSON.parse(await res.text());
    } catch {
      json = null;
    }
  } catch (error) {
    return { status: "tidak_pasti", pesan: `LIS tidak dapat dihubungi saat cek status: ${error.name === "TimeoutError" ? "waktu habis" : error.message}` };
  }
  const body = json?.payload ?? json ?? {};
  const data = Array.isArray(body) ? body[0] : body;
  const noLab = data?.no_laboratorium ?? data?.no_lab ?? data?.nolab ?? null;
  const t = sekarang();
  if (res.ok && json?.success !== false && (noLab || Array.isArray(data?.pemeriksaan))) {
    await exec(
      `UPDATE lab_lis_kirim SET status = 'terkirim', lis_no_lab = COALESCE($2, lis_no_lab), diklaim_pada = NULL, diklaim_oleh = NULL, updated_at = $3,
              pesan = 'Terdaftar di LIS (hasil Cek Status)' WHERE uuid = $1 AND status = 'tidak_pasti'`,
      [k.kirim_uuid, noLab, t]
    );
    // order MCU yang ternyata sudah terdaftar di LIS divalidasi seperti kirim berhasil
    await validasiOrderMcu(faskesUuid, await dataOrder(faskesUuid, orderUuid)).catch(() => false);
    return { status: "terkirim", pesan: `Terdaftar di LIS${noLab ? ` (No. Lab ${noLab})` : ""}`, no_lab: noLab };
  }
  const teks = daftarPesanGalat(json ?? {}).join("; ");
  if (res.status === 404 || /tidak ditemukan|not found|belum terdaftar|tidak ada data|data kosong/i.test(teks)) {
    await exec(
      `UPDATE lab_lis_kirim SET status = 'gagal', diklaim_pada = NULL, diklaim_oleh = NULL, updated_at = $2,
              pesan = 'Tidak ditemukan di LIS (hasil Cek Status) — aman dikirim ulang' WHERE uuid = $1 AND status = 'tidak_pasti'`,
      [k.kirim_uuid, t]
    );
    return { status: "gagal", pesan: "Tidak ditemukan di LIS — aman dikirim ulang" };
  }
  return { status: "tidak_pasti", pesan: `Jawaban LIS belum dapat dipastikan (HTTP ${res.status}${teks ? `: ${teks}` : ""})` };
};

/** Petugas memastikan manual (di aplikasi LIS) bahwa order TIDAK terdaftar → boleh dikirim ulang. */
export const tandaiBelumTerdaftar = async (faskesUuid, orderUuids, pengguna) => {
  const rows = await q(
    `UPDATE lab_lis_kirim SET status = 'gagal', diklaim_pada = NULL, diklaim_oleh = NULL, updated_at = $3,
            pesan = $4 WHERE faskes_uuid = $1 AND order_lab_uuid = ANY($2::varchar[]) AND status = 'tidak_pasti' RETURNING order_lab_uuid`,
    [faskesUuid, orderUuids, sekarang(), `Ditandai belum terdaftar di LIS oleh ${pengguna ?? "petugas"} setelah dicek manual — boleh dikirim ulang`]
  );
  return rows.map((r) => r.order_lab_uuid);
};
