import { randomUUID } from "node:crypto";
import { query, satu, sisipkan, ubah, transaksi, sekarang, uuidv7 } from "../db.js";
import { Galat } from "../umum/respons.js";
import { SPESIMEN } from "./bersama.js";
import { detailOrder } from "./order.js";
import { buatRegistrasi, pemeriksaanBelumDipetakan, pesanGalatLis, petakanIsolat } from "./lis-peta.js";
import { enkripsi, dekripsi, hashKunci, buatKunci, samarkan } from "./lis-kripto.js";

// Bridging LIS Mikrobiologi (STD-0014) — pola sama dengan Bridging LIS laboratorium (lab-service/src/lis),
// konteks/tabel terpisah (mikro_koneksi_lis, mikro_kiriman_lis, mikro_hasil_lis_mentah, mikro_pemetaan_ref,
// mikro_spesimen_jenis_lis, mikro_organisme.kode_lis, mikro_antibiotik.kode_lis).
// orderUuid/itemUuid opsional: dipakai prosesHasil() untuk mencatat konteks galat ke mikro_hasil_lis_mentah.
export class GalatLis extends Galat {
  constructor(status, message, orderUuid = null, itemUuid = null) {
    super(status, message);
    this.orderUuid = orderUuid;
    this.itemUuid = itemUuid;
  }
}

const MODE = process.env.LIS_MIKRO_MODE || process.env.LIS_MODE || "nyata";
const TIMEOUT_MS = Number(process.env.LIS_MIKRO_TIMEOUT_MS) || 15000;

// --- Koneksi LIS (bisa lebih dari satu per faskes) -----------------------------------------------------

const tampilKoneksi = (k) => ({
  uuid: k.uuid,
  nama: k.nama,
  kode_rs: k.kode_rs,
  url_registrasi: k.url_registrasi,
  url_hasil: k.url_hasil ?? null,
  api_key: samarkan(dekripsi(k.api_key)),
  kunci_masuk: samarkan(dekripsi(k.kunci_masuk)),
  aktif: k.aktif,
  bawaan: k.bawaan,
  maks_paralel: k.maks_paralel ?? 2,
  jeda_ms: k.jeda_ms ?? 0,
  updated_at: k.updated_at,
});

export const daftarKoneksi = async (faskesUuid) =>
  (await query(`SELECT * FROM mikro_koneksi_lis WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY bawaan DESC, nama`, [faskesUuid])).map(tampilKoneksi);

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

// data: { nama, url_registrasi, url_hasil?, api_key?, kode_rs?, aktif?, bawaan?, maks_paralel?, jeda_ms? };
// api_key kosong saat ubah = tidak diubah. Kunci masuk dibuat otomatis saat koneksi baru, dikembalikan utuh sekali.
export const simpanKoneksi = async (faskesUuid, uuid, data) => {
  const nama = String(data?.nama ?? "").trim();
  const urlReg = String(data?.url_registrasi ?? "").trim();
  const urlHasil = String(data?.url_hasil ?? "").trim() || null;
  if (!nama) throw new GalatLis(422, "Nama LIS wajib diisi");
  if (!validUrl(urlReg)) throw new GalatLis(422, "URL Registrasi tidak valid (contoh: http://alamat-lis:2612/adam-lis-mikro/registrasi)");
  if (urlHasil && !validUrl(urlHasil.replace(/\{no_registrasi\}/g, "x"))) {
    throw new GalatLis(422, "URL Ambil Hasil tidak valid (contoh: http://alamat-lis:2612/adam-lis-mikro/hasil?no_registrasi={no_registrasi})");
  }
  const t = sekarang();
  const apiKey = String(data?.api_key ?? "").trim();
  const maksParalel = bulat(data?.maks_paralel, 1, 10, 2);
  const jedaMs = bulat(data?.jeda_ms, 0, 60000, 0);
  let kunciBaru = null;
  let barisUuid = uuid;

  if (uuid) {
    const lama = await satu(`SELECT * FROM mikro_koneksi_lis WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid]);
    if (!lama) throw new GalatLis(404, "Koneksi LIS Mikrobiologi tidak ditemukan");
    await ubah("mikro_koneksi_lis", uuid, faskesUuid, {
      nama, url_registrasi: urlReg, url_hasil: urlHasil, kode_rs: String(data?.kode_rs ?? "").trim() || null,
      api_key: apiKey ? enkripsi(apiKey) : undefined, aktif: data?.aktif !== false, maks_paralel: maksParalel, jeda_ms: jedaMs,
    });
  } else {
    kunciBaru = buatKunci();
    const bawaanBaru = !(await satu(`SELECT 1 n FROM mikro_koneksi_lis WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [faskesUuid]));
    const baris = await sisipkan("mikro_koneksi_lis", {
      faskes_uuid: faskesUuid, nama, url_registrasi: urlReg, url_hasil: urlHasil, kode_rs: String(data?.kode_rs ?? "").trim() || null,
      api_key: enkripsi(apiKey), kunci_masuk: enkripsi(kunciBaru), kunci_masuk_hash: hashKunci(kunciBaru),
      aktif: data?.aktif !== false, bawaan: bawaanBaru, maks_paralel: maksParalel, jeda_ms: jedaMs,
    });
    barisUuid = baris.uuid;
  }
  if (data?.bawaan) await jadikanBawaan(faskesUuid, barisUuid);
  const hasil = (await daftarKoneksi(faskesUuid)).find((k) => k.uuid === barisUuid);
  return kunciBaru ? { ...hasil, kunci_masuk_baru: kunciBaru } : hasil;
};

export const jadikanBawaan = async (faskesUuid, uuid) => {
  await query(`UPDATE mikro_koneksi_lis SET bawaan = (uuid = $2), updated_at = $3 WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [faskesUuid, uuid, sekarang()]);
};

export const buatUlangKunciMasuk = async (faskesUuid, uuid) => {
  const ada = await satu(`SELECT 1 n FROM mikro_koneksi_lis WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid]);
  if (!ada) throw new GalatLis(404, "Koneksi LIS Mikrobiologi tidak ditemukan");
  const kunci = buatKunci();
  await query(`UPDATE mikro_koneksi_lis SET kunci_masuk = $3, kunci_masuk_hash = $4, updated_at = $5 WHERE uuid = $1 AND faskes_uuid = $2`, [
    uuid, faskesUuid, enkripsi(kunci), hashKunci(kunci), sekarang(),
  ]);
  return { uuid, kunci_masuk_baru: kunci };
};

export const hapusKoneksi = async (faskesUuid, uuid) => {
  await query(`UPDATE mikro_koneksi_lis SET deleted_at = $3, aktif = false, bawaan = false, kunci_masuk_hash = NULL WHERE uuid = $1 AND faskes_uuid = $2`, [
    uuid, faskesUuid, sekarang(),
  ]);
  return { uuid };
};

export const koneksiUntukKirim = async (faskesUuid, uuid) => {
  const rows = await query(
    `SELECT * FROM mikro_koneksi_lis WHERE faskes_uuid = $1 AND deleted_at IS NULL AND aktif = true AND ($2::text IS NULL OR uuid = $2) ORDER BY bawaan DESC, nama LIMIT 1`,
    [faskesUuid, uuid || null],
  );
  if (!rows[0]) throw new GalatLis(422, uuid ? "Koneksi LIS Mikrobiologi tidak ditemukan atau nonaktif" : "Belum ada koneksi LIS Mikrobiologi aktif. Atur di Setting › Konfigurasi Integrasi › Konfigurasi LIS Mikrobiologi.");
  return rows[0];
};

// --- Mapping kode LIS (pemeriksaan, spesimen, organisme, antibiotik, unit, dokter, penjamin) -----------

// Penjamin order mikrobiologi disederhanakan dari payment_method (mikro_order belum menyimpan penjamin_uuid):
// 1 = Tunai/Umum, selain itu = penjamin lain (BPJS dsb). Dipetakan seperti unit/dokter via mikro_pemetaan_ref.
export const REF_PENJAMIN_TUNAI = "TUNAI";
export const REF_PENJAMIN_LAIN = "LAINNYA";

const daftarPemeriksaan = (faskesUuid) =>
  query(`SELECT uuid, kode, nama, kode_lis FROM mikro_pemeriksaan WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY nama`, [faskesUuid]);

const simpanPemeriksaan = async (faskesUuid, items) => {
  for (const it of items) {
    const kode = String(it?.kode_lis ?? "").trim().slice(0, 50) || null;
    await query(`UPDATE mikro_pemeriksaan SET kode_lis = $1, updated_at = $4 WHERE uuid = $2 AND faskes_uuid = $3`, [kode, it?.uuid, faskesUuid, sekarang()]);
  }
  return daftarPemeriksaan(faskesUuid);
};

const daftarSpesimen = async (faskesUuid) => {
  const peta = await query(`SELECT jenis_spesimen, kode_lis, nama_lis FROM mikro_spesimen_jenis_lis WHERE faskes_uuid = $1`, [faskesUuid]);
  return Object.entries(SPESIMEN).map(([kode, nama]) => ({ kode, nama, ...(peta.find((p) => p.jenis_spesimen === kode) ?? { kode_lis: null, nama_lis: null }) }));
};

const simpanSpesimen = async (faskesUuid, items) => {
  for (const it of items) {
    const jenis = String(it?.kode ?? it?.jenis_spesimen ?? "");
    if (!SPESIMEN[jenis]) continue;
    const kode = String(it?.kode_lis ?? "").trim().slice(0, 50);
    if (!kode) {
      await query(`DELETE FROM mikro_spesimen_jenis_lis WHERE faskes_uuid = $1 AND jenis_spesimen = $2`, [faskesUuid, jenis]);
      continue;
    }
    await query(
      `INSERT INTO mikro_spesimen_jenis_lis (faskes_uuid, jenis_spesimen, kode_lis, nama_lis, updated_at) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (faskes_uuid, jenis_spesimen) DO UPDATE SET kode_lis = EXCLUDED.kode_lis, nama_lis = EXCLUDED.nama_lis, updated_at = EXCLUDED.updated_at`,
      [faskesUuid, jenis, kode, String(it?.nama_lis ?? "").trim().slice(0, 100) || null, sekarang()],
    );
  }
  return daftarSpesimen(faskesUuid);
};

const daftarOrganisme = (faskesUuid) =>
  query(`SELECT uuid, kode, nama, kelompok, kode_whonet, kode_lis FROM mikro_organisme WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY nama`, [faskesUuid]);
const simpanOrganisme = async (faskesUuid, items) => {
  for (const it of items) {
    const kode = String(it?.kode_lis ?? "").trim().slice(0, 50) || null;
    await query(`UPDATE mikro_organisme SET kode_lis = $1, updated_at = $4 WHERE uuid = $2 AND faskes_uuid = $3`, [kode, it?.uuid, faskesUuid, sekarang()]);
  }
  return daftarOrganisme(faskesUuid);
};

const daftarAntibiotik = (faskesUuid) =>
  query(`SELECT uuid, kode, nama, golongan, kode_lis FROM mikro_antibiotik WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY nama`, [faskesUuid]);
const simpanAntibiotik = async (faskesUuid, items) => {
  for (const it of items) {
    const kode = String(it?.kode_lis ?? "").trim().slice(0, 50) || null;
    await query(`UPDATE mikro_antibiotik SET kode_lis = $1, updated_at = $4 WHERE uuid = $2 AND faskes_uuid = $3`, [kode, it?.uuid, faskesUuid, sekarang()]);
  }
  return daftarAntibiotik(faskesUuid);
};

export const daftarPemetaanRef = async (faskesUuid) => {
  const peta = await query(`SELECT jenis, ref_uuid, kode_lis, nama_lis FROM mikro_pemetaan_ref WHERE faskes_uuid = $1`, [faskesUuid]);
  const cari = (jenis, uuid) => peta.find((p) => p.jenis === jenis && p.ref_uuid === uuid);
  const gabung = (jenis, rows) => rows.map((r) => ({ ...r, jenis, kode_lis: cari(jenis, r.uuid)?.kode_lis ?? null, nama_lis: cari(jenis, r.uuid)?.nama_lis ?? null }));
  const unit = await query(
    `SELECT uuid, code AS kode, name AS nama FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND (is_poli OR location_type IN ('Ward', 'Room')) ORDER BY is_poli DESC, name`,
    [faskesUuid],
  );
  const dokter = await query(
    `SELECT pr.uuid, pr.code_bpjs AS kode, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, pg.last_title)) AS nama
     FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND pr.is_doctor ORDER BY pg.name`,
    [faskesUuid],
  );
  const penjamin = [
    { uuid: REF_PENJAMIN_TUNAI, kode: "UMUM", nama: "Umum / Tunai (tanpa penjamin)" },
    { uuid: REF_PENJAMIN_LAIN, kode: "LAIN", nama: "Penjamin lain (BPJS, asuransi, dsb.)" },
  ];
  return { unit: gabung("unit", unit), dokter: gabung("dokter", dokter), penjamin: gabung("penjamin", penjamin) };
};

export const simpanPemetaanRef = async (faskesUuid, jenis, items) => {
  for (const it of items) {
    const ref = String(it?.uuid ?? "");
    if (!ref) continue;
    const kode = String(it?.kode_lis ?? "").trim().slice(0, 50);
    const nama = String(it?.nama_lis ?? "").trim().slice(0, 200) || null;
    if (!kode) {
      await query(`DELETE FROM mikro_pemetaan_ref WHERE faskes_uuid = $1 AND jenis = $2 AND ref_uuid = $3`, [faskesUuid, jenis, ref]);
      continue;
    }
    await query(
      `INSERT INTO mikro_pemetaan_ref (faskes_uuid, jenis, ref_uuid, kode_lis, nama_lis, updated_at) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (faskes_uuid, jenis, ref_uuid) DO UPDATE SET kode_lis = EXCLUDED.kode_lis, nama_lis = EXCLUDED.nama_lis, updated_at = EXCLUDED.updated_at`,
      [faskesUuid, jenis, ref, kode, nama, sekarang()],
    );
  }
  return (await daftarPemetaanRef(faskesUuid))[jenis];
};

const JENIS_PEMETAAN = ["pemeriksaan", "spesimen", "organisme", "antibiotik", "unit", "dokter", "penjamin"];

export const daftarPemetaan = async (faskesUuid, jenis) => {
  if (!JENIS_PEMETAAN.includes(jenis)) throw new GalatLis(400, `jenis harus salah satu: ${JENIS_PEMETAAN.join(", ")}`);
  if (jenis === "pemeriksaan") return daftarPemeriksaan(faskesUuid);
  if (jenis === "spesimen") return daftarSpesimen(faskesUuid);
  if (jenis === "organisme") return daftarOrganisme(faskesUuid);
  if (jenis === "antibiotik") return daftarAntibiotik(faskesUuid);
  return (await daftarPemetaanRef(faskesUuid))[jenis];
};

export const simpanPemetaan = async (faskesUuid, jenis, items) => {
  if (!JENIS_PEMETAAN.includes(jenis)) throw new GalatLis(400, `jenis harus salah satu: ${JENIS_PEMETAAN.join(", ")}`);
  if (!Array.isArray(items)) throw new GalatLis(400, "items harus berupa daftar");
  if (jenis === "pemeriksaan") return simpanPemeriksaan(faskesUuid, items);
  if (jenis === "spesimen") return simpanSpesimen(faskesUuid, items);
  if (jenis === "organisme") return simpanOrganisme(faskesUuid, items);
  if (jenis === "antibiotik") return simpanAntibiotik(faskesUuid, items);
  return simpanPemetaanRef(faskesUuid, jenis, items);
};

// --- Kirim registrasi order ke LIS ----------------------------------------------------------------------

const panggilLis = async (koneksi, body) => {
  if (MODE === "mock") {
    const tgl = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    return { ok: true, status: 200, pasti: true, json: { success: true, message: "Registrasi berhasil (mock)", payload: { no_registrasi_lis: `SIMMB${tgl}${String(Date.now()).slice(-4)}` } } };
  }
  try {
    const res = await fetch(koneksi.url_registrasi, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": dekripsi(koneksi.api_key) ?? "" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const teks = await res.text();
    let json;
    try {
      json = JSON.parse(teks);
    } catch {
      json = { success: false, message: `Respons LIS bukan JSON (HTTP ${res.status})` };
    }
    const generik = [502, 503, 504].includes(res.status) || (res.status === 500 && json?.success === undefined);
    return { ok: res.ok && json?.success !== false, status: res.status, json, pasti: !generik };
  } catch (error) {
    const kode = error?.cause?.code ?? error?.code;
    const waktuHabis = error?.name === "TimeoutError" || error?.name === "AbortError";
    return {
      ok: false, status: 0,
      json: { success: false, message: `LIS Mikrobiologi tidak dapat dihubungi: ${waktuHabis ? "waktu habis menunggu respons" : kode || error.message}` },
      pasti: !waktuHabis && ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"].includes(kode),
    };
  }
};

/** Klaim atomik 1 baris mikro_kiriman_lis per (faskes, order, koneksi) — anti kirim dobel (KT-3). */
const klaimKirim = async ({ faskesUuid, orderUuid, koneksiUuid, noRegistrasi, pemroses, bolehTerkirim = false }) => {
  const [baris] = await query(
    `INSERT INTO mikro_kiriman_lis (uuid, faskes_uuid, order_uuid, koneksi_uuid, no_registrasi, status, percobaan, diklaim_pada, diklaim_oleh, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'mengirim', 0, $6, $7, $6, $6)
     ON CONFLICT (faskes_uuid, order_uuid, koneksi_uuid) DO UPDATE SET
       status = 'mengirim', diklaim_pada = EXCLUDED.diklaim_pada, diklaim_oleh = EXCLUDED.diklaim_oleh, no_registrasi = EXCLUDED.no_registrasi, updated_at = EXCLUDED.updated_at
     WHERE mikro_kiriman_lis.status = ANY($8::varchar[])
     RETURNING uuid`,
    [uuidv7(), faskesUuid, orderUuid, koneksiUuid, noRegistrasi, sekarang(), pemroses, bolehTerkirim ? ["baru", "gagal", "terkirim"] : ["baru", "gagal"]],
  );
  return baris?.uuid ?? null;
};

const selesaikanKirim = async ({ kirimUuid, pemroses, status, pesan, permintaan, respons, pengguna }) => {
  await query(
    `UPDATE mikro_kiriman_lis SET status = $3, pesan = $4, permintaan = $5::jsonb, respons = $6::jsonb, dikirim_oleh = COALESCE($7, dikirim_oleh),
            percobaan = percobaan + 1, diklaim_pada = CASE WHEN $3 = 'tidak_pasti' THEN diklaim_pada END, updated_at = $8
     WHERE uuid = $1 AND diklaim_oleh = $2 AND status IN ('mengirim', 'tidak_pasti')`,
    [kirimUuid, pemroses, status, pesan, JSON.stringify(permintaan ?? null), JSON.stringify(respons ?? null), pengguna, sekarang()],
  );
};

/** Kirim registrasi order mikrobiologi ke LIS (Order Mikrobiologi › Validasi & Kirim, atau kirim ulang). */
export const kirimOrder = async (faskesUuid, orderUuid, { koneksiUuid = null, pengguna = null } = {}) => {
  const koneksi = await koneksiUntukKirim(faskesUuid, koneksiUuid);
  const order = await detailOrder(orderUuid, faskesUuid);
  if (order.status === "batal") throw new GalatLis(422, "Order mikrobiologi sudah dibatalkan");
  const belum = pemeriksaanBelumDipetakan(order);
  if (belum.length) throw new GalatLis(422, `Pemeriksaan belum dipetakan ke kode LIS: ${belum.join(", ")} (Mikrobiologi › Mapping LIS › Pemeriksaan)`);
  const refPeta = await daftarPemetaanRef(faskesUuid);
  const spesimenPeta = new Map((await daftarSpesimen(faskesUuid)).map((s) => [s.kode, s]));
  const ref = {
    unit: refPeta.unit.find((u) => u.uuid === order.lokasi_asal_uuid),
    dokter: refPeta.dokter.find((d) => d.uuid === order.dokter_pengirim_uuid),
    penjamin: refPeta.penjamin.find((p) => p.uuid === (Number(order.payment_method) === 1 ? REF_PENJAMIN_TUNAI : REF_PENJAMIN_LAIN)),
  };
  const body = buatRegistrasi(order, koneksi, ref, spesimenPeta);
  const pemroses = `manual:${randomUUID()}`;
  const kirimUuid = await klaimKirim({ faskesUuid, orderUuid, koneksiUuid: koneksi.uuid, noRegistrasi: order.no_order, pemroses, bolehTerkirim: true });
  if (!kirimUuid) {
    const existing = await satu(`SELECT status FROM mikro_kiriman_lis WHERE faskes_uuid = $1 AND order_uuid = $2 AND koneksi_uuid = $3`, [faskesUuid, orderUuid, koneksi.uuid]);
    throw new GalatLis(
      409,
      existing?.status === "tidak_pasti"
        ? "Status order ini di LIS Mikrobiologi belum pasti (pengiriman sebelumnya tidak mendapat respons). Lakukan Cek Status terlebih dahulu."
        : "Order ini sedang dikirim ke LIS Mikrobiologi oleh proses lain. Tunggu hingga selesai.",
    );
  }
  const { ok, status, json, pasti } = await panggilLis(koneksi, body);
  const hasil = {
    status: ok ? "terkirim" : pasti ? "gagal" : "tidak_pasti",
    pesan: ok ? json?.message || "Registrasi berhasil" : pasti ? pesanGalatLis(json, status) : `${pesanGalatLis(json, status)} — status di LIS belum pasti, lakukan Cek Status sebelum mengirim ulang`,
    lis: koneksi.nama,
    no_registrasi: order.no_order,
  };
  await selesaikanKirim({ kirimUuid, pemroses, status: hasil.status, pesan: hasil.pesan, permintaan: body, respons: json, pengguna });
  return hasil;
};

export const statusKirimOrder = (faskesUuid, orderUuid) =>
  query(
    `SELECT k.status, k.status_hasil, k.pesan, k.no_registrasi, k.percobaan, k.updated_at, c.nama AS lis
     FROM mikro_kiriman_lis k JOIN mikro_koneksi_lis c ON c.uuid = k.koneksi_uuid
     WHERE k.faskes_uuid = $1 AND k.order_uuid = $2 ORDER BY k.updated_at DESC`,
    [faskesUuid, orderUuid],
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
  const total = await satu(`SELECT COUNT(*) n FROM mikro_kiriman_lis k WHERE ${kondisi}`, nilai);
  const data = await query(
    `SELECT k.uuid, k.order_uuid, k.no_registrasi, k.status, k.status_hasil, k.pesan, k.percobaan, k.updated_at, k.dikirim_oleh, c.nama AS lis,
            o.no_order, o.no_rm, p.name AS nama_pasien
     FROM mikro_kiriman_lis k JOIN mikro_koneksi_lis c ON c.uuid = k.koneksi_uuid
     LEFT JOIN mikro_order o ON o.uuid = k.order_uuid LEFT JOIN patients p ON p.uuid = o.patient_uuid
     WHERE ${kondisi} ORDER BY k.updated_at DESC LIMIT ${batas} OFFSET ${(hal - 1) * batas}`,
    nilai,
  );
  return { data, pagination: { page: hal, limit: batas, total: Number(total?.n) || 0 } };
};

// --- Cek status registrasi yang tidak pasti --------------------------------------------------------------

const urlHasilOrder = (kirim) => {
  const url = String(kirim.url_hasil);
  if (/\{no_registrasi\}/.test(url)) return url.replace(/\{no_registrasi\}/g, encodeURIComponent(kirim.no_registrasi));
  return `${url}${url.includes("?") ? "&" : "?"}no_registrasi=${encodeURIComponent(kirim.no_registrasi)}`;
};

export const cekStatusOrder = async (faskesUuid, orderUuid) => {
  const k = await satu(
    `SELECT k.uuid AS kirim_uuid, k.status AS status_kirim, k.no_registrasi, c.nama, c.url_hasil, c.api_key, c.aktif
     FROM mikro_kiriman_lis k JOIN mikro_koneksi_lis c ON c.uuid = k.koneksi_uuid
     WHERE k.faskes_uuid = $1 AND k.order_uuid = $2 AND c.deleted_at IS NULL ORDER BY (k.status = 'tidak_pasti') DESC, k.updated_at DESC LIMIT 1`,
    [faskesUuid, orderUuid],
  );
  if (!k) return { status: "dilewati", pesan: "Belum pernah dikirim ke LIS Mikrobiologi" };
  if (k.status_kirim !== "tidak_pasti") return { status: "dilewati", pesan: `Status sudah pasti: ${k.status_kirim}` };
  if (!k.url_hasil) return { status: "tidak_pasti", pesan: `URL Ambil Hasil koneksi ${k.nama} belum diatur — cek manual di LIS lalu tandai gagal bila memang tidak terdaftar` };
  let res, json;
  try {
    res = await fetch(urlHasilOrder(k), { headers: { Accept: "application/json", "x-api-key": dekripsi(k.api_key) ?? "" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    try {
      json = JSON.parse(await res.text());
    } catch {
      json = null;
    }
  } catch (error) {
    return { status: "tidak_pasti", pesan: `LIS Mikrobiologi tidak dapat dihubungi saat cek status: ${error.name === "TimeoutError" ? "waktu habis" : error.message}` };
  }
  const t = sekarang();
  if (res.ok && json?.success !== false) {
    await query(`UPDATE mikro_kiriman_lis SET status = 'terkirim', diklaim_pada = NULL, diklaim_oleh = NULL, updated_at = $2, pesan = 'Terdaftar di LIS (hasil Cek Status)' WHERE uuid = $1 AND status = 'tidak_pasti'`, [k.kirim_uuid, t]);
    return { status: "terkirim", pesan: "Terdaftar di LIS Mikrobiologi" };
  }
  if (res.status === 404 || /tidak ditemukan|not found/i.test(String(json?.message ?? ""))) {
    await query(`UPDATE mikro_kiriman_lis SET status = 'gagal', diklaim_pada = NULL, diklaim_oleh = NULL, updated_at = $2, pesan = 'Tidak ditemukan di LIS (hasil Cek Status) — aman dikirim ulang' WHERE uuid = $1 AND status = 'tidak_pasti'`, [k.kirim_uuid, t]);
    return { status: "gagal", pesan: "Tidak ditemukan di LIS — aman dikirim ulang" };
  }
  return { status: "tidak_pasti", pesan: `Jawaban LIS belum dapat dipastikan (HTTP ${res.status})` };
};

// --- Terima & proses hasil (push tanpa JWT, atau tarik manual) --------------------------------------------

const kunciItemHasil = async (orderUuid, faskesUuid, kodePemeriksaanLis, k) => {
  const items = await query(
    `SELECT i.uuid, i.status, i.jenis_spesimen, i.spesimen_uuid, m.kode_lis
       FROM mikro_order_item i LEFT JOIN mikro_pemeriksaan m ON m.uuid = i.pemeriksaan_uuid
      WHERE i.order_uuid = $1 AND i.faskes_uuid = $2 AND i.deleted_at IS NULL AND i.status <> 'ditolak'`,
    [orderUuid, faskesUuid],
    k,
  );
  if (!items.length) throw new GalatLis(409, "Order tidak memiliki item pemeriksaan aktif", orderUuid);
  if (kodePemeriksaanLis) {
    const cocok = items.find((i) => String(i.kode_lis ?? "").trim().toLowerCase() === String(kodePemeriksaanLis).trim().toLowerCase());
    if (!cocok) throw new GalatLis(422, `Item dengan kode_pemeriksaan_lis "${kodePemeriksaanLis}" tidak ditemukan pada order ini`, orderUuid);
    return cocok;
  }
  if (items.length > 1) throw new GalatLis(422, "Order memiliki lebih dari satu item pemeriksaan — sertakan kode_pemeriksaan_lis untuk menentukan item", orderUuid);
  return items[0];
};

// Recompute status order dari status item (sama dengan hasil.js sinkronOrder).
const sinkronOrder = async (orderUuid, faskesUuid, k) => {
  const o = await satu(`SELECT * FROM mikro_order WHERE uuid = $1 AND faskes_uuid = $2 FOR UPDATE`, [orderUuid, faskesUuid], k);
  const r = await satu(
    `SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status = 'selesai')::int AS selesai,
            COUNT(*) FILTER (WHERE status IN ('selesai', 'ditolak'))::int AS tuntas,
            COUNT(*) FILTER (WHERE status IN ('diterima', 'diproses', 'sementara', 'selesai'))::int AS jalan
       FROM mikro_order_item WHERE order_uuid = $1 AND deleted_at IS NULL`,
    [orderUuid],
    k,
  );
  let status = o.status;
  if (r.selesai && r.tuntas === r.n) status = "selesai";
  else if (r.jalan) status = "diproses";
  if (status !== o.status) await ubah("mikro_order", o.uuid, faskesUuid, { status, selesai_pada: status === "selesai" ? sekarang() : null }, k);
};

/**
 * Terapkan satu payload hasil LIS Mikrobiologi ke item pemeriksaan (push maupun tarik). Idempotensi berdasarkan
 * (koneksi_uuid, no_registrasi, identitas_hasil_lis) pada mikro_hasil_lis_mentah — payload yang identik (retry
 * jaringan) tidak diproses ulang (KT-9). Koreksi atas hasil yang sudah diverifikasi Sp.MK ditolak (KT-10).
 */
const prosesHasil = async (koneksi, body, sumber) => {
  const faskesUuid = koneksi.faskes_uuid;
  const noReg = String(body?.no_registrasi ?? "").trim();
  const identitas = String(body?.identitas_hasil_lis ?? "").trim();
  if (!noReg) throw new GalatLis(400, "no_registrasi wajib diisi");
  if (!identitas) throw new GalatLis(400, "identitas_hasil_lis wajib diisi");

  // Catatan payload mentah (idempotensi & audit) disimpan DI LUAR transaksi penerapan: bila penerapan gagal/ditolak,
  // payload & alasannya tetap tersimpan untuk ditinjau petugas (bukan ikut rollback — aturan bisnis #13).
  const mentah = await query(
    `INSERT INTO mikro_hasil_lis_mentah (uuid, faskes_uuid, koneksi_uuid, no_registrasi, identitas_hasil_lis, status_proses, payload, sumber, diterima_pada)
     VALUES ($1,$2,$3,$4,$5,'diproses',$6::jsonb,$7,$8)
     ON CONFLICT (koneksi_uuid, no_registrasi, identitas_hasil_lis) DO NOTHING RETURNING uuid`,
    [uuidv7(), faskesUuid, koneksi.uuid, noReg, identitas, JSON.stringify(body), sumber, sekarang()],
  );
  if (!mentah.length) {
    const ulang = await satu(`SELECT status_proses, pesan FROM mikro_hasil_lis_mentah WHERE koneksi_uuid = $1 AND no_registrasi = $2 AND identitas_hasil_lis = $3`, [koneksi.uuid, noReg, identitas]);
    return { status: ulang?.status_proses ?? "hasil_diterima", pesan: `Duplikat (identitas_hasil_lis sudah pernah diproses): ${ulang?.pesan ?? "tidak ada perubahan"}`, duplikat: true, tidakCocok: [] };
  }
  const mentahUuid = mentah[0].uuid;
  const catat = (status_proses, pesan, orderUuid = null, itemUuid = null) =>
    query(`UPDATE mikro_hasil_lis_mentah SET status_proses = $1, pesan = $2, order_uuid = $3, item_uuid = $4 WHERE uuid = $5`, [status_proses, pesan, orderUuid, itemUuid, mentahUuid]);

  try {
    const hasilAkhir = await transaksi(async (k) => {
      const kirim = await satu(`SELECT order_uuid FROM mikro_kiriman_lis WHERE faskes_uuid = $1 AND koneksi_uuid = $2 AND no_registrasi = $3 ORDER BY updated_at DESC LIMIT 1`, [faskesUuid, koneksi.uuid, noReg], k);
      if (!kirim) throw new GalatLis(404, `Order dengan no_registrasi ${noReg} tidak ditemukan untuk koneksi ini`);
      const orderUuid = kirim.order_uuid;
      const order = await satu(`SELECT status FROM mikro_order WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [orderUuid, faskesUuid], k);
      if (!order || order.status === "batal") throw new GalatLis(409, "Order mikrobiologi tidak ditemukan atau sudah dibatalkan", orderUuid);

      const item = await kunciItemHasil(orderUuid, faskesUuid, body?.kode_pemeriksaan_lis, k);
      if (!["diterima", "diproses", "sementara"].includes(item.status)) {
        throw new GalatLis(409, `Item berstatus ${item.status}, spesimen belum diterima di SIMRS`, orderUuid, item.uuid);
      }
      const h = await satu(`SELECT * FROM mikro_hasil WHERE item_uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [item.uuid], k);
      if (item.status === "selesai" || h?.status === "final") {
        throw new GalatLis(409, "Hasil sudah diverifikasi Sp.MK — buka verifikasi di SIMRS sebelum koreksi LIS ini dapat diterapkan", orderUuid, item.uuid);
      }
      const hasil = h ?? (await sisipkan("mikro_hasil", { faskes_uuid: faskesUuid, item_uuid: item.uuid, spesimen_uuid: item.spesimen_uuid, status: "draft" }, k));

      const perubahan = { sumber: "lis", ref_lis: identitas };
      const pewarnaan = body?.pewarnaan ?? {};
      if (pewarnaan.jenis !== undefined) perubahan.pewarnaan_jenis = pewarnaan.jenis || null;
      if (pewarnaan.gram_temuan !== undefined) perubahan.gram_temuan = Array.isArray(pewarnaan.gram_temuan) ? pewarnaan.gram_temuan : [];
      if (pewarnaan.hasil_pewarnaan !== undefined) perubahan.hasil_pewarnaan = pewarnaan.hasil_pewarnaan || null;
      const kultur = body?.kultur ?? {};
      if (kultur.status !== undefined) perubahan.kultur_status = kultur.status || null;
      if (kultur.media !== undefined) perubahan.media = kultur.media || null;
      if (kultur.keterangan !== undefined) perubahan.keterangan_kultur = kultur.keterangan || null;
      if (body?.laporan_sementara) {
        perubahan.laporan_sementara = String(body.laporan_sementara);
        perubahan.sementara_pada = sekarang();
        perubahan.sementara_oleh = `LIS: ${koneksi.nama}`;
        if (hasil.status === "draft") perubahan.status = "sementara";
      }
      await ubah("mikro_hasil", hasil.uuid, faskesUuid, perubahan, k);

      let tidakCocok = [];
      if (Array.isArray(body?.isolat)) {
        const organisme = await query(`SELECT uuid, nama, kelompok, kode_whonet, kode_lis FROM mikro_organisme WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [faskesUuid], k);
        const antibiotik = await query(`SELECT uuid, kode, nama, kode_lis FROM mikro_antibiotik WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [faskesUuid], k);
        const { isolat, tidakCocok: tc } = petakanIsolat(body.isolat, organisme, antibiotik);
        tidakCocok = tc;
        await query(`DELETE FROM mikro_isolat WHERE hasil_uuid = $1`, [hasil.uuid], k);
        for (const x of isolat) {
          const iso = await sisipkan("mikro_isolat", {
            faskes_uuid: faskesUuid, hasil_uuid: hasil.uuid, urutan: x.urutan, organisme_uuid: x.organisme_uuid, nama_organisme: x.nama_organisme,
            kelompok: x.kelompok, jumlah_koloni: x.jumlah_koloni, penanda: "{}",
            catatan: x.cocok ? null : `Organisme tidak cocok dengan item (kode/nama asal LIS, identitas isolat: ${x.identitas_isolat})`, sumber: "lis",
          }, k);
          for (const kp of x.kepekaan) {
            await sisipkan("mikro_kepekaan", {
              faskes_uuid: faskesUuid, isolat_uuid: iso.uuid, antibiotik_uuid: kp.antibiotik_uuid, kode: kp.kode, nama: kp.nama,
              mic: kp.mic, zona: kp.zona, interpretasi: kp.interpretasi, dilaporkan: true, sumber: "lis",
            }, k);
          }
        }
      }
      if (item.status === "diterima") await ubah("mikro_order_item", item.uuid, faskesUuid, { status: "diproses" }, k);
      if (perubahan.status === "sementara") await ubah("mikro_order_item", item.uuid, faskesUuid, { status: "sementara" }, k);
      await sinkronOrder(orderUuid, faskesUuid, k);

      const diterapkan = Object.keys(perubahan).length > 2 || Array.isArray(body?.isolat);
      if (!diterapkan) throw new GalatLis(422, "Payload hasil tidak berisi data yang dapat diterapkan (pewarnaan/kultur/laporan_sementara/isolat kosong)", orderUuid, item.uuid);
      const statusProses = tidakCocok.length ? "hasil_sebagian" : "hasil_diterima";
      const pesan = tidakCocok.length ? `Hasil disimpan, ${tidakCocok.length} organisme/antibiotik tidak cocok dengan item (lihat Mapping LIS)` : "Hasil disimpan";
      await query(`UPDATE mikro_kiriman_lis SET status_hasil = $1, updated_at = $2 WHERE faskes_uuid = $3 AND order_uuid = $4 AND koneksi_uuid = $5`, [statusProses, sekarang(), faskesUuid, orderUuid, koneksi.uuid], k);
      return { status: statusProses, pesan, duplikat: false, tidakCocok, orderUuid, itemUuid: item.uuid };
    });
    await catat(hasilAkhir.status, hasilAkhir.pesan, hasilAkhir.orderUuid, hasilAkhir.itemUuid);
    return hasilAkhir;
  } catch (error) {
    await catat("gagal", error.message, error.orderUuid ?? null, error.itemUuid ?? null);
    throw error;
  }
};

/** Hasil push dari LIS Mikrobiologi, diautentikasi kunci masuk koneksi (header x-api-key atau ?key=). */
export const terimaHasil = async (kunci, body) => {
  if (!kunci) throw new GalatLis(401, "Kunci akses tidak ada (header x-api-key atau parameter ?key=)");
  const koneksi = await satu(`SELECT * FROM mikro_koneksi_lis WHERE kunci_masuk_hash = $1 AND deleted_at IS NULL`, [hashKunci(kunci)]);
  if (!koneksi) throw new GalatLis(401, "Kunci akses tidak valid");
  if (!koneksi.aktif) throw new GalatLis(403, "Koneksi LIS Mikrobiologi nonaktif di SIMRS");
  return prosesHasil(koneksi, body, "push");
};

/** Tarik hasil dari LIS Mikrobiologi (GET url_hasil koneksi) untuk satu order yang sudah terkirim. */
export const tarikHasil = async (faskesUuid, orderUuid) => {
  const kirim = await satu(
    `SELECT k.no_registrasi, c.* FROM mikro_kiriman_lis k JOIN mikro_koneksi_lis c ON c.uuid = k.koneksi_uuid
     WHERE k.faskes_uuid = $1 AND k.order_uuid = $2 AND k.status = 'terkirim' AND c.deleted_at IS NULL ORDER BY k.updated_at DESC LIMIT 1`,
    [faskesUuid, orderUuid],
  );
  if (!kirim) throw new GalatLis(409, "Order ini belum terkirim ke LIS Mikrobiologi");
  if (!kirim.aktif) throw new GalatLis(409, `Koneksi LIS Mikrobiologi ${kirim.nama} nonaktif`);
  if (!kirim.url_hasil) throw new GalatLis(422, `URL Ambil Hasil belum diatur di koneksi ${kirim.nama}`);
  if (MODE === "mock") throw new GalatLis(422, "LIS_MIKRO_MODE=mock: tarik hasil tidak tersedia");
  let json;
  try {
    const res = await fetch(urlHasilOrder(kirim), { headers: { Accept: "application/json", "x-api-key": dekripsi(kirim.api_key) ?? "" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const teks = await res.text();
    try {
      json = JSON.parse(teks);
    } catch {
      throw new GalatLis(502, `Respons LIS bukan JSON (HTTP ${res.status})`);
    }
    if (!res.ok || json?.success === false) throw new GalatLis(502, `LIS menolak: ${pesanGalatLis(json, res.status)}`);
  } catch (error) {
    if (error instanceof GalatLis) throw error;
    throw new GalatLis(502, `LIS Mikrobiologi tidak dapat dihubungi: ${error.name === "TimeoutError" ? "waktu habis" : error.message}`);
  }
  const body = json?.payload ?? json;
  if (!body?.identitas_hasil_lis) throw new GalatLis(404, "Hasil belum tersedia di LIS Mikrobiologi");
  if (!body.no_registrasi) body.no_registrasi = kirim.no_registrasi;
  return prosesHasil(kirim, body, "tarik");
};
