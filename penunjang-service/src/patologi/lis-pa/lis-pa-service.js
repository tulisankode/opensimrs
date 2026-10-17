import { query, satu, sisipkan, ubah, transaksi, sekarang, uuidv7 } from "../../db.js";
import { Galat, tidakDitemukan, permintaanSalah } from "../../umum/respons.js";
import { buatRegistrasi, pesanGalatLis, petakanHasil } from "./lis-pa-peta.js";
import { enkripsi, dekripsi, hashKunci, buatKunci, samarkan } from "./kripto.js";
import { segarkanStatusOrder } from "../order.js";

// Bridging LIS Patologi Anatomi (pola sama dengan Bridging LIS Laboratorium, lab-service/src/lis).
// Granularitas pengiriman = kasus PA (pa_order_item): satu kasus → satu no_registrasi stabil (= uuid kasus,
// tidak pernah berubah antar-percobaan) → aman dikirim ulang tanpa membuat kasus ganda di sisi tujuan.
const TIMEOUT_MS = Number(process.env.PA_LIS_TIMEOUT_MS) || 15000;
const MODE = process.env.PA_LIS_MODE || "nyata";

const validUrl = (u) => {
  try {
    const url = new URL(String(u));
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

// --- Koneksi LIS PA (bisa lebih dari satu per faskes) -------------------------------------------------

const tampilKoneksi = (k) => ({
  uuid: k.uuid,
  nama: k.nama,
  kode_rs: k.kode_rs,
  url_registrasi: k.url_registrasi,
  url_hasil: k.url_hasil ?? null,
  url_laporan: k.url_laporan ?? null,
  api_key: samarkan(dekripsi(k.api_key)),
  kunci_masuk: samarkan(dekripsi(k.kunci_masuk)),
  aktif: k.aktif,
  bawaan: k.bawaan,
  maks_paralel: k.maks_paralel ?? 2,
  jeda_ms: k.jeda_ms ?? 0,
  updated_at: k.updated_at,
});

export const daftarKoneksi = async (faskesUuid) =>
  (await query(`SELECT * FROM pa_lis_koneksi WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY bawaan DESC, nama`, [faskesUuid])).map(tampilKoneksi);

// data: { nama, kode_rs, url_registrasi, url_hasil?, url_laporan?, api_key?, aktif, bawaan, maks_paralel, jeda_ms }
// api_key kosong saat ubah = tidak diubah. Kunci masuk dibuat otomatis saat koneksi baru, dikembalikan utuh sekali.
export const simpanKoneksi = async (faskesUuid, uuid, data) => {
  const nama = String(data?.nama ?? "").trim();
  if (!nama) throw permintaanSalah("Nama koneksi wajib diisi");
  const urlReg = String(data?.url_registrasi ?? "").trim();
  if (!validUrl(urlReg)) throw permintaanSalah("URL Registrasi tidak valid (contoh: http://lis-pa.contoh.id/adam-pa-lis/registrasi)");
  const urlHasil = String(data?.url_hasil ?? "").trim() || null;
  if (urlHasil && !validUrl(urlHasil.replace(/\{(no_registrasi|no_pa)\}/g, "x"))) throw permintaanSalah("URL Ambil Hasil tidak valid");
  const urlLaporan = String(data?.url_laporan ?? "").trim() || null;
  const maksParalel = Math.min(10, Math.max(1, Math.round(Number(data?.maks_paralel)) || 2));
  const jedaMs = Math.min(60000, Math.max(0, Math.round(Number(data?.jeda_ms)) || 0));
  const apiKey = String(data?.api_key ?? "").trim();
  const t = sekarang();
  let kunciBaru = null;
  let barisUuid = uuid;

  if (uuid) {
    const lama = await satu(`SELECT * FROM pa_lis_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid]);
    if (!lama) throw tidakDitemukan("Koneksi LIS PA");
    await query(
      `UPDATE pa_lis_koneksi SET nama = $3, kode_rs = $4, url_registrasi = $5, url_hasil = $6, url_laporan = $7,
              api_key = $8, aktif = $9, maks_paralel = $10, jeda_ms = $11, updated_at = $12
       WHERE uuid = $1 AND faskes_uuid = $2`,
      [uuid, faskesUuid, nama, String(data?.kode_rs ?? "").trim() || null, urlReg, urlHasil, urlLaporan, apiKey ? enkripsi(apiKey) : lama.api_key, data?.aktif !== false, maksParalel, jedaMs, t],
    );
  } else {
    kunciBaru = buatKunci();
    const baris = await sisipkan("pa_lis_koneksi", {
      faskes_uuid: faskesUuid, nama, kode_rs: String(data?.kode_rs ?? "").trim() || null,
      url_registrasi: urlReg, url_hasil: urlHasil, url_laporan: urlLaporan,
      api_key: enkripsi(apiKey), kunci_masuk: enkripsi(kunciBaru), kunci_masuk_hash: hashKunci(kunciBaru),
      aktif: data?.aktif !== false, bawaan: false, maks_paralel: maksParalel, jeda_ms: jedaMs,
    });
    barisUuid = baris.uuid;
  }
  if (data?.bawaan) await jadikanBawaan(faskesUuid, barisUuid);
  const hasil = (await daftarKoneksi(faskesUuid)).find((k) => k.uuid === barisUuid);
  return kunciBaru ? { ...hasil, kunci_masuk_baru: kunciBaru } : hasil;
};

export const jadikanBawaan = async (faskesUuid, uuid) => {
  await query(`UPDATE pa_lis_koneksi SET bawaan = (uuid = $2), updated_at = $3 WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [faskesUuid, uuid, sekarang()]);
};

export const buatUlangKunciMasuk = async (faskesUuid, uuid) => {
  const ada = await satu(`SELECT 1 FROM pa_lis_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid]);
  if (!ada) throw tidakDitemukan("Koneksi LIS PA");
  const kunci = buatKunci();
  await query(`UPDATE pa_lis_koneksi SET kunci_masuk = $3, kunci_masuk_hash = $4, updated_at = $5 WHERE uuid = $1 AND faskes_uuid = $2`, [
    uuid, faskesUuid, enkripsi(kunci), hashKunci(kunci), sekarang(),
  ]);
  return { uuid, kunci_masuk_baru: kunci };
};

export const hapusKoneksi = async (faskesUuid, uuid) => {
  await query(`UPDATE pa_lis_koneksi SET deleted_at = $3, aktif = false, bawaan = false, kunci_masuk_hash = NULL WHERE uuid = $1 AND faskes_uuid = $2`, [uuid, faskesUuid, sekarang()]);
  return { uuid };
};

export const koneksiUntukKirim = async (faskesUuid, uuid) => {
  const row = await satu(
    `SELECT * FROM pa_lis_koneksi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND aktif = true AND ($2::text IS NULL OR uuid = $2) ORDER BY bawaan DESC, nama LIMIT 1`,
    [faskesUuid, uuid || null],
  );
  if (!row) throw new Galat(422, uuid ? "Koneksi LIS PA tidak ditemukan atau nonaktif" : "Belum ada koneksi LIS PA aktif. Atur di Setting › Konfigurasi Integrasi › LIS PA.");
  return row;
};

// Uji koneksi ringan: pastikan URL registrasi dapat dihubungi (bukan uji registrasi sungguhan).
export const ujiKoneksi = async (faskesUuid, uuid) => {
  const koneksi = await satu(`SELECT * FROM pa_lis_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskesUuid]);
  if (!koneksi) throw tidakDitemukan("Koneksi LIS PA");
  try {
    await fetch(koneksi.url_registrasi, { method: "OPTIONS", signal: AbortSignal.timeout(5000) });
    return { terhubung: true, pesan: "URL registrasi dapat dihubungi" };
  } catch (error) {
    return { terhubung: false, pesan: `Tidak dapat dihubungi: ${error.name === "TimeoutError" ? "waktu habis" : error.message}` };
  }
};

// Mapping disimpan per koneksi: koneksi wajib milik faskes pengguna agar mapping faskes lain tidak terbaca/terubah.
const pastikanKoneksiFaskes = async (faskesUuid, koneksiUuid) => {
  if (!koneksiUuid) throw permintaanSalah("koneksi_uuid wajib diisi");
  const ada = await satu(`SELECT 1 FROM pa_lis_koneksi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [koneksiUuid, faskesUuid]);
  if (!ada) throw tidakDitemukan("Koneksi LIS PA");
};

// --- Mapping pemeriksaan PA → kode LIS PA, per koneksi ------------------------------------------------

export const daftarPemetaanPemeriksaan = async (faskesUuid, koneksiUuid) => {
  await pastikanKoneksiFaskes(faskesUuid, koneksiUuid);
  return query(
    `SELECT m.uuid, m.kode, m.nama, m.jenis, m.kategori, pt.kode_lis, pt.nama_lis
       FROM pa_pemeriksaan m
       LEFT JOIN pa_lis_peta_pemeriksaan pt ON pt.pemeriksaan_uuid = m.uuid AND pt.koneksi_uuid = $2
      WHERE m.faskes_uuid = $1 AND m.deleted_at IS NULL ORDER BY m.kategori NULLS LAST, m.nama`,
    [faskesUuid, koneksiUuid],
  );
};

export const simpanPemetaanPemeriksaan = async (faskesUuid, koneksiUuid, items = []) => {
  await pastikanKoneksiFaskes(faskesUuid, koneksiUuid);
  for (const it of items) {
    const kode = String(it?.kode_lis ?? "").trim().slice(0, 50);
    const nama = String(it?.nama_lis ?? "").trim().slice(0, 200) || null;
    const pemeriksaanUuid = String(it?.uuid ?? it?.pemeriksaan_uuid ?? "");
    if (!pemeriksaanUuid) continue;
    if (!kode) {
      await query(`DELETE FROM pa_lis_peta_pemeriksaan WHERE koneksi_uuid = $1 AND pemeriksaan_uuid = $2`, [koneksiUuid, pemeriksaanUuid]);
      continue;
    }
    await query(
      `INSERT INTO pa_lis_peta_pemeriksaan (faskes_uuid, koneksi_uuid, pemeriksaan_uuid, kode_lis, nama_lis, updated_at) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (koneksi_uuid, pemeriksaan_uuid) DO UPDATE SET kode_lis = EXCLUDED.kode_lis, nama_lis = EXCLUDED.nama_lis, updated_at = EXCLUDED.updated_at`,
      [faskesUuid, koneksiUuid, pemeriksaanUuid, kode, nama, sekarang()],
    );
  }
  return daftarPemetaanPemeriksaan(faskesUuid, koneksiUuid);
};

// --- Mapping unit asal / dokter pengirim / penjamin → kode LIS PA, per koneksi ------------------------
// PA tidak mencatat penjamin per-entitas (hanya payment_method 1/2) → ref penjamin memakai sentinel tetap.
export const REF_TUNAI = "TUNAI";
export const REF_ASURANSI = "ASURANSI";

export const daftarPemetaanRef = async (faskesUuid, koneksiUuid) => {
  await pastikanKoneksiFaskes(faskesUuid, koneksiUuid);
  const peta = await query(`SELECT jenis, ref_uuid, kode_lis, nama_lis FROM pa_lis_peta_ref WHERE koneksi_uuid = $1`, [koneksiUuid]);
  const cari = (jenis, uuid) => peta.find((p) => p.jenis === jenis && p.ref_uuid === uuid);
  const unit = await query(
    `SELECT uuid, code AS kode, name AS nama FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND (is_poli OR location_type IN ('Ward', 'Room')) ORDER BY is_poli DESC, name`,
    [faskesUuid],
  );
  const dokter = await query(
    `SELECT pr.uuid, pr.code_bpjs AS kode, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, pg.last_title)) AS nama
       FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
      WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND pr.is_doctor ORDER BY pg.name`,
    [faskesUuid],
  );
  const gabung = (jenis, rows) => rows.map((r) => ({ ...r, jenis, kode_lis: cari(jenis, r.uuid)?.kode_lis ?? null, nama_lis: cari(jenis, r.uuid)?.nama_lis ?? null }));
  return {
    unit: gabung("unit", unit),
    dokter: gabung("dokter", dokter),
    penjamin: gabung("penjamin", [{ uuid: REF_TUNAI, kode: "UMUM", nama: "Umum / Tunai" }, { uuid: REF_ASURANSI, kode: "ASURANSI", nama: "Asuransi / Penjamin lain" }]),
  };
};

export const simpanPemetaanRef = async (faskesUuid, koneksiUuid, items = []) => {
  await pastikanKoneksiFaskes(faskesUuid, koneksiUuid);
  for (const it of items) {
    const jenis = String(it?.jenis ?? "");
    const ref = String(it?.uuid ?? it?.ref_uuid ?? "");
    if (!["unit", "dokter", "penjamin"].includes(jenis) || !ref) continue;
    const kode = String(it?.kode_lis ?? "").trim().slice(0, 50);
    const nama = String(it?.nama_lis ?? "").trim().slice(0, 200) || null;
    if (!kode) {
      await query(`DELETE FROM pa_lis_peta_ref WHERE koneksi_uuid = $1 AND jenis = $2 AND ref_uuid = $3`, [koneksiUuid, jenis, ref]);
      continue;
    }
    await query(
      `INSERT INTO pa_lis_peta_ref (faskes_uuid, koneksi_uuid, jenis, ref_uuid, kode_lis, nama_lis, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (koneksi_uuid, jenis, ref_uuid) DO UPDATE SET kode_lis = EXCLUDED.kode_lis, nama_lis = EXCLUDED.nama_lis, updated_at = EXCLUDED.updated_at`,
      [faskesUuid, koneksiUuid, jenis, ref, kode, nama, sekarang()],
    );
  }
  return daftarPemetaanRef(faskesUuid, koneksiUuid);
};

// --- Mapping field hasil vendor → field laporan SIMRS, per koneksi ------------------------------------

export const daftarPemetaanHasil = async (faskesUuid, koneksiUuid) => {
  await pastikanKoneksiFaskes(faskesUuid, koneksiUuid);
  return query(`SELECT field_simrs, field_lis FROM pa_lis_peta_hasil WHERE koneksi_uuid = $1 ORDER BY field_simrs`, [koneksiUuid]);
};

export const simpanPemetaanHasil = async (faskesUuid, koneksiUuid, items = []) => {
  await pastikanKoneksiFaskes(faskesUuid, koneksiUuid);
  for (const it of items) {
    const field = String(it?.field_simrs ?? "");
    const lintasan = String(it?.field_lis ?? "").trim().slice(0, 100);
    if (!lintasan) {
      await query(`DELETE FROM pa_lis_peta_hasil WHERE koneksi_uuid = $1 AND field_simrs = $2`, [koneksiUuid, field]);
      continue;
    }
    await query(
      `INSERT INTO pa_lis_peta_hasil (faskes_uuid, koneksi_uuid, field_simrs, field_lis, updated_at) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (koneksi_uuid, field_simrs) DO UPDATE SET field_lis = EXCLUDED.field_lis, updated_at = EXCLUDED.updated_at`,
      [faskesUuid, koneksiUuid, field, lintasan, sekarang()],
    );
  }
  return daftarPemetaanHasil(faskesUuid, koneksiUuid);
};

// --- Data kasus untuk dikirim --------------------------------------------------------------------------

// no_registrasi stabil = uuid kasus (tidak pernah berubah antar-percobaan kirim ulang).
export const noRegistrasiKasus = (orderItemUuid) => orderItemUuid;

const dataKasus = async (faskesUuid, orderItemUuid) => {
  const item = await satu(
    `SELECT i.*, m.kode, m.nama AS nama_pemeriksaan, s.jenis_spesimen, s.lokasi_anatomi, s.lateralitas, s.cara_pengambilan, s.jumlah_wadah, s.fiksasi,
            ki.no_pa AS induk_no_pa
       FROM pa_order_item i
       LEFT JOIN pa_pemeriksaan m ON m.uuid = i.pemeriksaan_uuid
       LEFT JOIN LATERAL (SELECT * FROM pa_spesimen x WHERE x.order_item_uuid = i.uuid AND x.deleted_at IS NULL AND x.status = 'diterima'
                           ORDER BY x.waktu_terima DESC, x.created_at DESC LIMIT 1) s ON true
       LEFT JOIN pa_order_item ki ON ki.uuid = i.kasus_induk_uuid
      WHERE i.uuid = $1 AND i.faskes_uuid = $2 AND i.deleted_at IS NULL`,
    [orderItemUuid, faskesUuid],
  );
  if (!item) throw tidakDitemukan("Kasus PA");
  const order = await satu(
    `SELECT o.*, p.name, p.gender, p.phone, p.no_identity, bd.birth_date, l.name AS lokasi_asal,
            COALESCE(TRIM(CONCAT_WS(' ', pg.first_title, pg.name, pg.last_title)), o.dokter_pengirim_luar) AS dokter_pengirim
       FROM pa_order o
       LEFT JOIN patients p ON p.uuid = o.patient_uuid
       LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
       LEFT JOIN lokasi l ON l.uuid = o.lokasi_asal_uuid
       LEFT JOIN practitioner pr ON pr.uuid = o.dokter_pengirim_uuid
       LEFT JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
      WHERE o.uuid = $1 AND o.faskes_uuid = $2 AND o.deleted_at IS NULL`,
    [item.order_uuid, faskesUuid],
  );
  if (!order) throw tidakDitemukan("Order PA");
  return {
    ...item,
    nama: item.nama ?? item.nama_pemeriksaan,
    no_registrasi: noRegistrasiKasus(item.uuid),
    order: { ...order, pasien: { name: order.name, gender: order.gender, phone: order.phone, no_identity: order.no_identity, birth_date: order.birth_date, no_rm: order.no_rm } },
  };
};

const ambilRef = async (faskesUuid, koneksiUuid, item, order) => {
  const penjaminRef = Number(order.payment_method) === 2 ? REF_ASURANSI : REF_TUNAI;
  const rows = await query(
    `SELECT jenis, kode_lis, nama_lis FROM pa_lis_peta_ref WHERE koneksi_uuid = $1 AND ((jenis = 'unit' AND ref_uuid = $2)
       OR (jenis = 'dokter' AND ref_uuid = $3) OR (jenis = 'penjamin' AND ref_uuid = $4))`,
    [koneksiUuid, order.lokasi_asal_uuid ?? "", order.dokter_pengirim_uuid ?? "", penjaminRef],
  );
  const pemeriksaan = await satu(`SELECT kode_lis, nama_lis FROM pa_lis_peta_pemeriksaan WHERE koneksi_uuid = $1 AND pemeriksaan_uuid = $2`, [koneksiUuid, item.pemeriksaan_uuid]);
  const ref = { pemeriksaan: pemeriksaan ?? null };
  for (const r of rows) ref[r.jenis] = r;
  return ref;
};

// --- Kirim registrasi kasus ke LIS PA --------------------------------------------------------------------

const panggilLisPa = async (koneksi, body) => {
  if (MODE === "mock") {
    return { ok: true, status: 200, pasti: true, json: { success: true, message: "Registrasi tiruan berhasil", payload: { no_pa: null } } };
  }
  let teks = "";
  try {
    const res = await fetch(koneksi.url_registrasi, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": dekripsi(koneksi.api_key) ?? "" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    teks = await res.text();
    let json;
    try {
      json = JSON.parse(teks);
    } catch {
      json = { success: false, message: `Respons LIS PA bukan JSON (HTTP ${res.status}): ${teks.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)}` };
    }
    const generik = [502, 503, 504].includes(res.status) || (res.status === 500 && json?.success === undefined);
    return { ok: res.ok && json?.success !== false, status: res.status, json, pasti: !generik };
  } catch (error) {
    const kode = error?.cause?.code ?? error?.code;
    const waktuHabis = error?.name === "TimeoutError" || error?.name === "AbortError";
    return {
      ok: false, status: 0, pasti: false,
      json: { success: false, message: `LIS PA tidak dapat dihubungi: ${waktuHabis ? "waktu habis menunggu respons" : kode || error.message}` },
    };
  }
};

// Klaim atomik per kasus (satu baris pa_lis_kirim per kasus+koneksi, UNIQUE). Sama dengan pola lab_lis_kirim.
const klaimKirim = async ({ faskesUuid, koneksiUuid, orderItemUuid, noRegistrasi, pemroses }) => {
  const t = sekarang();
  const baris = await satu(
    `INSERT INTO pa_lis_kirim (uuid, faskes_uuid, koneksi_uuid, order_item_uuid, no_registrasi, status, percobaan, diklaim_pada, diklaim_oleh, created_at, updated_at)
     VALUES ($7, $1, $2, $3, $4, 'mengirim', 0, $5, $6, $5, $5)
     ON CONFLICT (faskes_uuid, order_item_uuid, koneksi_uuid) DO UPDATE SET
       status = 'mengirim', diklaim_pada = EXCLUDED.diklaim_pada, diklaim_oleh = EXCLUDED.diklaim_oleh, updated_at = EXCLUDED.updated_at
     WHERE pa_lis_kirim.status IN ('mengirim', 'gagal', 'terkirim', 'tidak_pasti') RETURNING uuid`,
    [faskesUuid, koneksiUuid, orderItemUuid, noRegistrasi, t, pemroses, uuidv7()],
  );
  return baris?.uuid ?? null;
};

const selesaikanKirim = async ({ kirimUuid, pemroses, status, pesan, lisNoPa = null, permintaan = null, respons = null, pengguna = null }) => {
  await query(
    `UPDATE pa_lis_kirim SET status = $3, pesan = $4, lis_no_pa = COALESCE($5, lis_no_pa), permintaan = COALESCE($6::jsonb, permintaan),
            respons = $7::jsonb, dikirim_oleh = COALESCE($8, dikirim_oleh), percobaan = percobaan + 1, updated_at = $9
      WHERE uuid = $1 AND diklaim_oleh = $2`,
    [kirimUuid, pemroses, status, pesan, lisNoPa, permintaan ? JSON.stringify(permintaan) : null, JSON.stringify(respons ?? null), pengguna, sekarang()],
  );
};

/** Kirim registrasi satu kasus PA ke LIS PA. Galat LIS PA tidak dilempar: dicatat & dikembalikan (status gagal/tidak_pasti). */
export const kirimKasus = async (faskesUuid, orderItemUuid, { koneksiUuid = null, pengguna = null } = {}) => {
  const koneksi = await koneksiUntukKirim(faskesUuid, koneksiUuid);
  const item = await dataKasus(faskesUuid, orderItemUuid);
  const order = item.order;
  const ref = await ambilRef(faskesUuid, koneksi.uuid, item, order);
  if (!ref.pemeriksaan?.kode_lis) {
    return { status: "gagal", pesan: `Pemeriksaan "${item.nama}" belum dipetakan ke kode LIS PA (Patologi Anatomi › Mapping LIS)` };
  }
  const induk = item.kasus_induk_uuid && item.induk_no_pa ? { no_pa: item.induk_no_pa } : null;
  if (item.jenis === "ihk" && item.kasus_induk_uuid && !induk) {
    return { status: "gagal", pesan: "Kasus PA induk belum memiliki Nomor PA; tidak dapat dikirim sebagai IHK lanjutan" };
  }
  const body = buatRegistrasi(item, order, koneksi, ref, induk);
  const pemroses = `manual:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const kirimUuid = await klaimKirim({ faskesUuid, koneksiUuid: koneksi.uuid, orderItemUuid, noRegistrasi: item.no_registrasi, pemroses });
  if (!kirimUuid) throw new Galat(409, "Kasus ini sedang dikirim ke LIS PA oleh proses lain. Tunggu hingga selesai.");
  const { ok, status, json, pasti } = await panggilLisPa(koneksi, body);
  const hasil = {
    status: ok ? "terkirim" : pasti ? "gagal" : "tidak_pasti",
    pesan: ok ? json?.message || "Registrasi berhasil" : pasti ? pesanGalatLis(json, status) : `${pesanGalatLis(json, status)} — status di LIS PA belum pasti, lakukan Cek Status sebelum mengirim ulang`,
    no_pa: json?.payload?.no_pa ?? null,
  };
  await selesaikanKirim({ kirimUuid, pemroses, status: hasil.status, pesan: hasil.pesan, lisNoPa: hasil.no_pa, permintaan: body, respons: json, pengguna });
  return hasil;
};

/** "Validasi & Kirim ke LIS PA": kirim semua kasus (item) aktif order. Bila ada yang gagal/tidak pasti, lempar galat (validasi dibatalkan). */
export const kirimOrderKePa = async (faskesUuid, orderUuid, { koneksiUuid = null, pengguna = null } = {}) => {
  const items = await query(`SELECT uuid FROM pa_order_item WHERE order_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY created_at`, [orderUuid, faskesUuid]);
  if (!items.length) throw permintaanSalah("Order tidak memiliki pemeriksaan");
  const hasil = [];
  for (const it of items) hasil.push({ order_item_uuid: it.uuid, ...(await kirimKasus(faskesUuid, it.uuid, { koneksiUuid, pengguna })) });
  const gagal = hasil.filter((h) => h.status !== "terkirim");
  if (gagal.length) throw new Galat(400, `Pengiriman ke LIS PA gagal: ${gagal.map((g) => g.pesan).join("; ")}`);
  return hasil;
};

export const statusKirimKasus = (faskesUuid, orderItemUuid) =>
  query(
    `SELECT k.status, k.pesan, k.lis_no_pa, k.no_registrasi, k.percobaan, k.updated_at, c.nama AS lis
       FROM pa_lis_kirim k JOIN pa_lis_koneksi c ON c.uuid = k.koneksi_uuid
      WHERE k.faskes_uuid = $1 AND k.order_item_uuid = $2 ORDER BY k.updated_at DESC`,
    [faskesUuid, orderItemUuid],
  );

export const daftarKirim = async (faskesUuid, { page = 1, limit = 10, status = "", koneksi_uuid: koneksiUuid = "" } = {}) => {
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
  const total = (await satu(`SELECT COUNT(*)::int AS n FROM pa_lis_kirim k WHERE ${kondisi}`, nilai)).n;
  const data = await query(
    `SELECT k.uuid, k.order_item_uuid, k.no_registrasi, k.lis_no_pa, k.status, k.pesan, k.percobaan, k.updated_at, k.dikirim_oleh,
            c.nama AS lis, i.no_pa, i.nama AS pemeriksaan, o.no_order, o.no_rm, p.name AS nama_pasien,
            (SELECT h.status FROM pa_lis_hasil h WHERE h.order_item_uuid = k.order_item_uuid ORDER BY h.created_at DESC LIMIT 1) AS status_hasil
       FROM pa_lis_kirim k
       JOIN pa_lis_koneksi c ON c.uuid = k.koneksi_uuid
       LEFT JOIN pa_order_item i ON i.uuid = k.order_item_uuid
       LEFT JOIN pa_order o ON o.uuid = i.order_uuid
       LEFT JOIN patients p ON p.uuid = o.patient_uuid
      WHERE ${kondisi} ORDER BY k.updated_at DESC LIMIT ${batas} OFFSET ${(hal - 1) * batas}`,
    nilai,
  );
  return { data, pagination: { page: hal, limit: batas, total } };
};

// --- Cek status (registrasi tidak pasti) & ambil hasil (tarik) ----------------------------------------

const urlDenganPlaceholder = (url, noRegistrasi, noPa) => {
  if (/\{no_registrasi\}|\{no_pa\}/.test(url)) return url.replace(/\{no_registrasi\}/g, encodeURIComponent(noRegistrasi)).replace(/\{no_pa\}/g, encodeURIComponent(noPa ?? ""));
  return `${url}${url.includes("?") ? "&" : "?"}no_registrasi=${encodeURIComponent(noRegistrasi)}`;
};

export const cekStatusKasus = async (faskesUuid, orderItemUuid) => {
  const k = await satu(
    `SELECT k.uuid AS kirim_uuid, k.status AS status_kirim, k.no_registrasi, k.lis_no_pa, c.nama, c.url_hasil, c.api_key
       FROM pa_lis_kirim k JOIN pa_lis_koneksi c ON c.uuid = k.koneksi_uuid
      WHERE k.faskes_uuid = $1 AND k.order_item_uuid = $2 AND c.deleted_at IS NULL ORDER BY (k.status = 'tidak_pasti') DESC, k.updated_at DESC LIMIT 1`,
    [faskesUuid, orderItemUuid],
  );
  if (!k) return { status: "dilewati", pesan: "Belum pernah dikirim ke LIS PA" };
  if (k.status_kirim !== "tidak_pasti") return { status: "dilewati", pesan: `Status sudah pasti: ${k.status_kirim}` };
  if (!k.url_hasil) return { status: "tidak_pasti", pesan: `URL Ambil Hasil koneksi ${k.nama} belum diatur — cek manual di sistem PA` };
  let res, json;
  try {
    res = await fetch(urlDenganPlaceholder(k.url_hasil, k.no_registrasi, k.lis_no_pa), { headers: { Accept: "application/json", "x-api-key": dekripsi(k.api_key) ?? "" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    json = JSON.parse(await res.text());
  } catch (error) {
    return { status: "tidak_pasti", pesan: `LIS PA tidak dapat dihubungi saat cek status: ${error.name === "TimeoutError" ? "waktu habis" : error.message}` };
  }
  const t = sekarang();
  if (res.ok && json?.success !== false) {
    await query(`UPDATE pa_lis_kirim SET status = 'terkirim', updated_at = $2, pesan = 'Terdaftar di LIS PA (hasil Cek Status)' WHERE uuid = $1 AND status = 'tidak_pasti'`, [k.kirim_uuid, t]);
    return { status: "terkirim", pesan: "Terdaftar di LIS PA" };
  }
  if (res.status === 404) {
    await query(`UPDATE pa_lis_kirim SET status = 'gagal', updated_at = $2, pesan = 'Tidak ditemukan di LIS PA (hasil Cek Status) — aman dikirim ulang' WHERE uuid = $1 AND status = 'tidak_pasti'`, [k.kirim_uuid, t]);
    return { status: "gagal", pesan: "Tidak ditemukan di LIS PA — aman dikirim ulang" };
  }
  return { status: "tidak_pasti", pesan: `Jawaban LIS PA belum dapat dipastikan (HTTP ${res.status})` };
};

export const tarikHasil = async (faskesUuid, orderItemUuid) => {
  const k = await satu(
    `SELECT k.no_registrasi, k.lis_no_pa, c.* FROM pa_lis_kirim k JOIN pa_lis_koneksi c ON c.uuid = k.koneksi_uuid
      WHERE k.faskes_uuid = $1 AND k.order_item_uuid = $2 AND k.status = 'terkirim' AND c.deleted_at IS NULL ORDER BY k.updated_at DESC LIMIT 1`,
    [faskesUuid, orderItemUuid],
  );
  if (!k) throw new Galat(409, "Kasus ini belum terkirim ke LIS PA");
  if (!k.url_hasil) throw permintaanSalah(`URL Ambil Hasil belum diatur di koneksi LIS PA ${k.nama}`);
  let json;
  try {
    const res = await fetch(urlDenganPlaceholder(k.url_hasil, k.no_registrasi, k.lis_no_pa), { headers: { Accept: "application/json", "x-api-key": dekripsi(k.api_key) ?? "" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const teks = await res.text();
    try {
      json = JSON.parse(teks);
    } catch {
      throw new Galat(502, `Respons LIS PA bukan JSON (HTTP ${res.status})`);
    }
    if (!res.ok || json?.success === false) throw new Galat(502, `LIS PA menolak: ${pesanGalatLis(json, res.status)}`);
  } catch (error) {
    if (error instanceof Galat) throw error;
    throw new Galat(502, `LIS PA tidak dapat dihubungi: ${error.name === "TimeoutError" ? "waktu habis" : error.message}`);
  }
  const body = { ...(json?.payload ?? json), no_registrasi: json?.payload?.no_registrasi ?? json?.no_registrasi ?? k.no_registrasi };
  return prosesHasil(k, body, "tarik");
};

// --- Terima hasil dari LIS PA (push maupun tarik) -------------------------------------------------------

export const terimaHasil = async (kunci, body) => {
  if (!kunci) throw new Galat(401, "Kunci akses tidak ada (header x-api-key atau parameter ?key=)");
  const koneksi = await satu(`SELECT * FROM pa_lis_koneksi WHERE kunci_masuk_hash = $1 AND deleted_at IS NULL`, [hashKunci(kunci)]);
  if (!koneksi) throw new Galat(401, "Kunci akses tidak valid");
  if (!koneksi.aktif) throw new Galat(403, "Koneksi LIS PA nonaktif di SIMRS");
  return prosesHasil(koneksi, body, "push");
};

const laporanKasus = async (orderItemUuid, faskesUuid, k) =>
  (await satu(`SELECT * FROM pa_laporan WHERE order_item_uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [orderItemUuid], k)) ??
  (await sisipkan("pa_laporan", { faskes_uuid: faskesUuid, order_item_uuid: orderItemUuid, status: "draft" }, k));

const STATUS_HASIL_ETERNAL = new Set(["selesai", "verifikasi", "menunggu_verifikasi"]);

// Inti penyimpanan hasil LIS PA (push maupun tarik): cocokkan kasus, petakan field, simpan laporan + versi.
const prosesHasil = async (koneksi, body, sumber) => {
  const faskesUuid = koneksi.faskes_uuid;
  const noReg = String(body?.no_registrasi ?? "").trim();
  const noPa = String(body?.no_pa ?? "").trim();
  const t = sekarang();
  const catat = (status, pesan, orderItemUuid = null) =>
    query(
      `INSERT INTO pa_lis_hasil (uuid, faskes_uuid, koneksi_uuid, order_item_uuid, no_registrasi, no_pa, status, pesan, payload, sumber, created_at)
       VALUES ($11,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [faskesUuid, koneksi.uuid, orderItemUuid, noReg || null, noPa || null, status, pesan, JSON.stringify(body ?? null), sumber, t, uuidv7()],
    );

  if (!noReg && !noPa) {
    await catat("gagal", "no_registrasi / no_pa kosong");
    throw permintaanSalah("no_registrasi atau no_pa wajib diisi");
  }
  // Pencocokan kasus: no_registrasi (kirim 'terkirim') diutamakan, lalu Nomor PA internal (bila sudah ada).
  const kirimAda = noReg
    ? await satu(`SELECT order_item_uuid FROM pa_lis_kirim WHERE faskes_uuid = $1 AND koneksi_uuid = $2 AND no_registrasi = $3 AND status = 'terkirim'`, [faskesUuid, koneksi.uuid, noReg])
    : null;
  const item = kirimAda
    ? await satu(`SELECT * FROM pa_order_item WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [kirimAda.order_item_uuid, faskesUuid])
    : noPa
      ? await satu(`SELECT * FROM pa_order_item WHERE no_pa = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [noPa, faskesUuid])
      : null;
  if (!item) {
    await catat("gagal", `Kasus dengan no_registrasi/no_pa ${noReg || noPa} tidak ditemukan atau sudah dihapus`);
    throw tidakDitemukan(`Kasus PA dengan no_registrasi/no_pa ${noReg || noPa}`);
  }
  if (noReg) await query(`UPDATE pa_lis_kirim SET lis_no_pa = COALESCE($3, lis_no_pa) WHERE faskes_uuid = $1 AND order_item_uuid = $2 AND koneksi_uuid = $4`, [faskesUuid, item.uuid, noPa || null, koneksi.uuid]);

  const peta = await query(`SELECT field_simrs, field_lis FROM pa_lis_peta_hasil WHERE koneksi_uuid = $1`, [koneksi.uuid]);
  const field = petakanHasil(body, peta);
  const statusLis = String(body?.status ?? "").trim().toLowerCase();

  // Penolakan eksternal: kolom terpisah, tidak pernah menghapus penerimaan jaringan / Nomor PA internal.
  if (statusLis === "ditolak") {
    await ubah("pa_order_item", item.uuid, faskesUuid, {
      ditolak_eksternal_pada: t, ditolak_eksternal_alasan: String(body?.alasan_tolak ?? body?.alasan ?? "Ditolak oleh sistem PA tujuan").trim(), ditolak_eksternal_koneksi_uuid: koneksi.uuid,
    });
    await catat("ditolak", "Spesimen ditolak oleh sistem PA tujuan", item.uuid);
    return { status: "ditolak", pesan: "Spesimen ditolak oleh sistem PA tujuan — dicatat sebagai penolakan eksternal" };
  }

  if (!Object.keys(field).length && !noPa) {
    await catat("gagal", "Tidak ada field laporan yang cocok/dipetakan pada payload", item.uuid);
    throw permintaanSalah("Tidak ada field laporan (makroskopis/mikroskopis/diagnosis/dst.) yang cocok pada payload");
  }
  if (noPa && !item.no_pa) await ubah("pa_order_item", item.uuid, faskesUuid, { no_pa: noPa }, undefined);

  await transaksi(async (k) => {
    const lp = await laporanKasus(item.uuid, faskesUuid, k);
    const gabungan = {
      makroskopis: field.makroskopis ?? lp.makroskopis,
      mikroskopis: field.mikroskopis ?? lp.mikroskopis,
      diagnosis: field.diagnosis ?? lp.diagnosis,
      icd_o_topografi: field.icd_o_topografi ?? lp.icd_o_topografi,
      icd_o_morfologi: field.icd_o_morfologi ?? lp.icd_o_morfologi,
      icd10: field.icd10 ?? lp.icd10,
      icd10_nama: lp.icd10_nama,
      komentar: field.komentar ?? lp.komentar,
      dokter_pa_nama: body?.dokter_verifikator?.nama ?? lp.dokter_pa_nama,
      dokter_pa_sip: body?.dokter_verifikator?.sip ?? lp.dokter_pa_sip,
    };
    const versi = (await satu(`SELECT COALESCE(MAX(versi), 0) + 1 AS v FROM pa_laporan_versi WHERE order_item_uuid = $1`, [item.uuid], k)).v;
    await sisipkan(
      "pa_laporan_versi",
      { faskes_uuid: faskesUuid, order_item_uuid: item.uuid, versi, sumber: "lis_pa", ...gabungan, alasan: body?.alasan ?? (lp.diagnosis ? "Pembaruan hasil dari LIS PA" : null), dibuat_oleh: `lis_pa:${koneksi.nama}` },
      k,
    );
    const sudahFinal = STATUS_HASIL_ETERNAL.has(statusLis) && body?.dokter_verifikator?.nama;
    await ubah("pa_laporan", lp.uuid, faskesUuid, { ...gabungan, status: sudahFinal ? "verifikasi" : lp.status, revisi: lp.status === "verifikasi" || item.status === "selesai" ? Number(lp.revisi || 0) + 1 : lp.revisi }, k);
    if (sudahFinal && item.status !== "selesai") {
      await ubah("pa_order_item", item.uuid, faskesUuid, { status: "selesai", waktu_selesai: item.waktu_selesai ?? t }, k);
    } else if (!sudahFinal && item.status === "diterima") {
      await ubah("pa_order_item", item.uuid, faskesUuid, { status: "diproses" }, k);
    }
    await segarkanStatusOrder(item.order_uuid, faskesUuid, k);
  });

  const status = field.diagnosis || noPa ? "diterima" : "sebagian";
  await catat(status, status === "sebagian" ? "Hasil sebagian diterima" : "Hasil diterima dan disimpan", item.uuid);
  return { status, pesan: status === "sebagian" ? "Hasil sebagian disimpan" : "Hasil disimpan ke laporan PA", no_pa: noPa || item.no_pa };
};

// Riwayat versi laporan hanya untuk faskes pengguna (laporan PA memuat diagnosis pasien).
export const riwayatLaporan = (faskesUuid, orderItemUuid) =>
  query(`SELECT * FROM pa_laporan_versi WHERE faskes_uuid = $1 AND order_item_uuid = $2 ORDER BY versi DESC`, [faskesUuid, orderItemUuid]);
