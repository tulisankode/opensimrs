import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { nomorBaru } from "../umum/nomor.js";
import { cariKunjungan, kunjunganDariRekamMedis, pasien, namaPraktisi } from "../umum/kunjungan.js";
import { kirimTagihan } from "../umum/tagihan.js";
import { JENIS, NAMA_PRAKTISI, STATUS_ORDER, SUMBER, daftarNilai, rentangOpsional, teks, tglLokal } from "./bersama.js";
import { izinPa, pastikanIzin } from "../umum/izin.js";

// Order Patologi Anatomi: dari RME (kunjungan RJ/RI/IGD), pasien APS (atas permintaan sendiri) atau rujukan luar
// (dokter/faskes perujuk dicatat sebagai teks). Alur order: order → valid (tagihan dikirim ke Pembayaran, ref
// "pa:<uuid>") → diproses (jaringan diterima) → selesai (semua kasus terverifikasi Sp.PA) | ditolak (semua spesimen
// ditolak) | batal (hanya sebelum ada jaringan diterima; tagihan dihapus).
// Satu item order = satu kasus PA (nomor PA diberikan saat jaringan diterima). Item IHK merujuk kasus PA induk.
const rute = express.Router();

// ── Kueri bersama ────────────────────────────────────────────────────────────

const KOLOM_ORDER = `
  o.uuid, o.no_order, o.patient_uuid, o.no_rm, o.no_reg, o.rekam_medis_uuid, o.sumber, o.pelayanan,
  o.lokasi_asal_uuid, o.dokter_pengirim_uuid, o.dokter_pengirim_luar, o.faskes_perujuk, o.payment_method,
  o.klinis, o.riwayat, o.lokasi_anatomi, o.cara_pengambilan, o.catatan, o.cito, o.status, o.alasan_batal,
  o.divalidasi_oleh, o.divalidasi_pada, o.selesai_pada, o.dibuat_oleh, o.created_at, o.updated_at,
  p.name AS nama_pasien, p.gender, bd.birth_date,
  COALESCE(${NAMA_PRAKTISI("o.dokter_pengirim_uuid")}, o.dokter_pengirim_luar) AS dokter_pengirim,
  l.name AS lokasi_asal`;
const JOIN_ORDER = `
  LEFT JOIN patients p ON p.uuid = o.patient_uuid
  LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
  LEFT JOIN lokasi l ON l.uuid = o.lokasi_asal_uuid`;
const RINGKAS_ITEM = `
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS jumlah_item,
           COUNT(*) FILTER (WHERE i.status = 'selesai')::int AS jumlah_selesai,
           COUNT(*) FILTER (WHERE i.status = 'ditolak')::int AS jumlah_ditolak,
           COUNT(*) FILTER (WHERE i.no_pa IS NOT NULL)::int AS jumlah_diterima,
           COALESCE(SUM(i.harga), 0)::float8 AS total,
           string_agg(i.nama, ', ' ORDER BY i.created_at, i.nama) AS pemeriksaan,
           string_agg(i.no_pa, ', ' ORDER BY i.created_at) AS no_pa,
           array_agg(DISTINCT i.jenis) AS jenis
      FROM pa_order_item i WHERE i.order_uuid = o.uuid AND i.deleted_at IS NULL
  ) ri ON true`;

// Item order (kasus) + spesimen diterima terakhir + ringkasan laporan. `lengkap` = sertakan isi laporan & gambar.
export const itemOrder = async (orderUuids, faskesUuid, lengkap = false, k) => {
  const items = await query(
    `SELECT i.uuid, i.order_uuid, i.pemeriksaan_uuid, i.nama, i.jenis, i.harga::float8 AS harga, i.tat_hari, i.status,
            i.no_pa, i.waktu_terima, i.target_selesai, i.waktu_selesai, i.kasus_induk_uuid, ki.no_pa AS no_pa_induk,
            i.ditolak_eksternal_pada, i.ditolak_eksternal_alasan,
            m.kode, m.kategori, m.kode_icd9, i.created_at, i.updated_at,
            s.jenis_spesimen, s.lokasi_anatomi, s.lateralitas, s.cara_pengambilan, s.jumlah_wadah, s.fiksasi,
            s.waktu_pengambilan, s.waktu_fiksasi, s.kondisi, s.petugas AS petugas_terima,
            t.alasan_tolak, t.waktu_terima AS waktu_tolak,
            lp.uuid AS laporan_uuid, lp.status AS status_laporan, lp.jumlah_blok, lp.jumlah_slide,
            lp.dokter_pa_nama, lp.dokter_pa_sip, lp.waktu_verifikasi, lp.revisi, lp.diagnosis, lp.icd_o_topografi, lp.icd_o_morfologi,
            lp.icd10, lp.icd10_nama
            ${lengkap ? `, lp.makroskopis, lp.mikroskopis, lp.komentar, lp.gambar_makro, lp.petugas_makroskopis, lp.waktu_makroskopis,
                         lp.waktu_mikroskopis, lp.waktu_diagnosis, lp.diverifikasi_oleh, lp.alasan_revisi, lp.dokter_pa_uuid, lp.template_uuid` : ""}
       FROM pa_order_item i
       LEFT JOIN pa_pemeriksaan m ON m.uuid = i.pemeriksaan_uuid
       LEFT JOIN pa_order_item ki ON ki.uuid = i.kasus_induk_uuid
       LEFT JOIN LATERAL (SELECT * FROM pa_spesimen x WHERE x.order_item_uuid = i.uuid AND x.deleted_at IS NULL AND x.status = 'diterima'
                           ORDER BY x.waktu_terima DESC, x.created_at DESC LIMIT 1) s ON true
       LEFT JOIN LATERAL (SELECT * FROM pa_spesimen x WHERE x.order_item_uuid = i.uuid AND x.deleted_at IS NULL AND x.status = 'ditolak'
                           ORDER BY x.waktu_terima DESC, x.created_at DESC LIMIT 1) t ON i.status = 'ditolak'
       LEFT JOIN pa_laporan lp ON lp.order_item_uuid = i.uuid AND lp.deleted_at IS NULL
      WHERE i.order_uuid = ANY($1) AND i.faskes_uuid = $2 AND i.deleted_at IS NULL
      ORDER BY i.created_at, i.nama`,
    [orderUuids, faskesUuid],
    k,
  );
  return items;
};

// Detail order lengkap: data order + pasien + item/kasus.
export const detailOrder = async (uuid, faskesUuid, k, lengkap = true) => {
  const o = await satu(`SELECT ${KOLOM_ORDER} FROM pa_order o ${JOIN_ORDER} WHERE o.uuid = $1 AND o.faskes_uuid = $2 AND o.deleted_at IS NULL`, [uuid, faskesUuid], k);
  if (!o) throw tidakDitemukan("Order PA");
  const [p, items] = await Promise.all([pasien(o.patient_uuid, faskesUuid), itemOrder([o.uuid], faskesUuid, lengkap, k)]);
  return { ...o, pasien: p, items, total: items.reduce((n, i) => n + Number(i.harga), 0) };
};

const kunciOrder = async (uuid, faskesUuid, k) => {
  const o = await satu(`SELECT * FROM pa_order WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [uuid, faskesUuid], k);
  if (!o) throw tidakDitemukan("Order PA");
  return o;
};

// Status order mengikuti kasusnya (dipanggil setelah terima/tolak/verifikasi/revisi). Order 'order'/'batal' tidak diubah.
export const segarkanStatusOrder = async (orderUuid, faskesUuid, k) => {
  const o = await satu(`SELECT status, selesai_pada FROM pa_order WHERE uuid = $1 FOR UPDATE`, [orderUuid], k);
  if (!o || ["order", "batal"].includes(o.status)) return o?.status;
  const items = await query(`SELECT status FROM pa_order_item WHERE order_uuid = $1 AND deleted_at IS NULL`, [orderUuid], k);
  const aktif = items.filter((i) => i.status !== "ditolak");
  let status = "valid";
  if (!aktif.length) status = "ditolak";
  else if (aktif.every((i) => i.status === "selesai")) status = "selesai";
  else if (aktif.some((i) => i.status !== "menunggu")) status = "diproses";
  if (status !== o.status) {
    await ubah("pa_order", orderUuid, faskesUuid, { status, selesai_pada: status === "selesai" ? sekarang() : null }, k);
  }
  return status;
};

// Susun item dari body: items = [uuid | { pemeriksaan_uuid, kasus_induk_uuid }]. IHK wajib merujuk kasus PA induk
// (pasien sama, sudah bernomor PA) — kasus_induk_uuid per item atau di tingkat order.
// Diekspor agar kamar-operasi/laporan.js dapat membuat order PA dari laporan operasi (KF-18) tanpa menduplikasi
// validasi item/IHK di sini.
export const susunItem = async (b, faskes, patientUuid, k) => {
  const daftar = b.items ?? b.pemeriksaan_uuids;
  if (daftar === undefined) return null;
  if (!Array.isArray(daftar) || !daftar.length) throw permintaanSalah("Pilih minimal satu pemeriksaan");
  const baris = daftar.map((x) => (typeof x === "string" ? { pemeriksaan_uuid: x } : x ?? {})).filter((x) => x.pemeriksaan_uuid);
  const uuids = [...new Set(baris.map((x) => x.pemeriksaan_uuid))];
  const master = await query(
    `SELECT uuid, nama, jenis, harga, tat_hari FROM pa_pemeriksaan WHERE uuid = ANY($1) AND faskes_uuid = $2 AND deleted_at IS NULL AND status`,
    [uuids, faskes],
    k,
  );
  if (master.length !== uuids.length) throw permintaanSalah("Sebagian pemeriksaan tidak ditemukan atau tidak aktif");
  const hasil = [];
  for (const x of baris) {
    const m = master.find((r) => r.uuid === x.pemeriksaan_uuid);
    let induk = null;
    if (m.jenis === "ihk") {
      const indukUuid = x.kasus_induk_uuid || b.kasus_induk_uuid;
      if (!indukUuid) throw permintaanSalah(`${m.nama}: pilih kasus PA induk (blok parafin) untuk pemeriksaan IHK`);
      induk = await satu(
        `SELECT i.uuid FROM pa_order_item i JOIN pa_order o ON o.uuid = i.order_uuid
          WHERE i.uuid = $1 AND i.faskes_uuid = $2 AND i.deleted_at IS NULL AND i.no_pa IS NOT NULL AND i.jenis <> 'ihk'
            AND i.status <> 'ditolak' AND o.patient_uuid = $3`,
        [indukUuid, faskes, patientUuid],
        k,
      );
      if (!induk) throw permintaanSalah("Kasus PA induk tidak ditemukan (harus kasus pasien yang sama dan sudah bernomor PA)");
    }
    hasil.push({ ...m, kasus_induk_uuid: induk?.uuid ?? null });
  }
  return hasil;
};

export const sisipkanItem = async (orderUuid, faskes, items, k) => {
  for (const m of items) {
    await sisipkan(
      "pa_order_item",
      {
        faskes_uuid: faskes, order_uuid: orderUuid, pemeriksaan_uuid: m.uuid, nama: m.nama, jenis: m.jenis, harga: m.harga,
        tat_hari: m.tat_hari ?? 5, kasus_induk_uuid: m.kasus_induk_uuid ?? null, status: "menunggu",
      },
      k,
    );
  }
};

// Tagihan per pemeriksaan, ref unik "pa:<order>" (kirim ulang mengganti; hapus = batal).
const tagihanOrder = async (o, req, hapus = false, k) => {
  const items = hapus
    ? []
    : (await itemOrder([o.uuid], o.faskes_uuid, false, k)).map((i) => ({
        item_name: `Patologi Anatomi: ${i.nama}`,
        price: Number(i.harga) || 0,
        qty: 1,
        additional_info: { kode_pemeriksaan: i.kode, jenis: i.jenis, no_order: o.no_order },
      }));
  return kirimTagihan({
    faskesUuid: o.faskes_uuid,
    patientUuid: o.patient_uuid,
    noReg: o.sumber === "rme" ? o.no_reg : null,
    paymentMethod: o.payment_method,
    ref: `pa:${o.uuid}`,
    items,
    token: req.author.token,
    hapus,
    apsType: "PA",
    apsServiceName: "Patologi Anatomi",
    apsServiceCode: o.no_order,
    apsLayananUuid: o.uuid,
    apsPraktisi: (await namaPraktisi(o.dokter_pengirim_uuid)) ?? o.dokter_pengirim_luar ?? null,
  });
};

// ── Daftar order ─────────────────────────────────────────────────────────────

rute.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "o.faskes_uuid = $1 AND o.deleted_at IS NULL";
    const status = daftarNilai(req.query.status).filter((s) => STATUS_ORDER.includes(s));
    if (status.length) {
      p.push(status);
      w += ` AND o.status = ANY($${p.length})`;
    }
    const sumber = daftarNilai(req.query.sumber).filter((s) => SUMBER.includes(s));
    if (sumber.length) {
      p.push(sumber);
      w += ` AND o.sumber = ANY($${p.length})`;
    }
    const pelayanan = daftarNilai(req.query.pelayanan);
    if (pelayanan.length) {
      p.push(pelayanan);
      w += ` AND o.pelayanan = ANY($${p.length})`;
    }
    const jenis = daftarNilai(req.query.jenis).filter((j) => JENIS[j]);
    if (jenis.length) {
      p.push(jenis);
      w += ` AND EXISTS (SELECT 1 FROM pa_order_item x WHERE x.order_uuid = o.uuid AND x.deleted_at IS NULL AND x.jenis = ANY($${p.length}))`;
    }
    const rentang = rentangOpsional(req.query);
    if (rentang) {
      p.push(rentang.mulai, rentang.selesai);
      w += ` AND ${tglLokal("o.created_at")} BETWEEN $${p.length - 1} AND $${p.length}`;
    }
    if (["1", "true"].includes(String(req.query.cito))) w += " AND o.cito";
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND (p.name ILIKE $${p.length} OR o.no_rm ILIKE $${p.length} OR o.no_order ILIKE $${p.length} OR o.no_reg ILIKE $${p.length}
                  OR EXISTS (SELECT 1 FROM pa_order_item x WHERE x.order_uuid = o.uuid AND x.no_pa ILIKE $${p.length}))`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM pa_order o ${JOIN_ORDER} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${KOLOM_ORDER}, ri.* FROM pa_order o ${JOIN_ORDER} ${RINGKAS_ITEM}
        WHERE ${w} ORDER BY o.created_at DESC, o.no_order DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Order PA satu kunjungan (RME): ?rekam_medis_uuid= dan/atau ?no_reg= (atau ?patient_uuid= untuk riwayat pasien).
rute.get(
  "/kunjungan",
  tangani(async (req, res) => {
    const { rekam_medis_uuid: rm, no_reg: noReg, patient_uuid: patientUuid } = req.query;
    if (!rm && !noReg && !patientUuid) throw permintaanSalah("rekam_medis_uuid, no_reg, atau patient_uuid wajib diisi");
    const p = [req.author.faskesUuid];
    const syarat = [];
    for (const [kolom, nilai] of [["o.rekam_medis_uuid", rm], ["o.no_reg", noReg], ["o.patient_uuid", patientUuid]]) {
      if (!nilai) continue;
      p.push(nilai);
      syarat.push(`${kolom} = $${p.length}`);
    }
    const orders = await query(
      `SELECT ${KOLOM_ORDER}, ri.* FROM pa_order o ${JOIN_ORDER} ${RINGKAS_ITEM}
        WHERE o.faskes_uuid = $1 AND o.deleted_at IS NULL AND (${syarat.join(" OR ")})
        ORDER BY o.created_at DESC LIMIT 100`,
      p,
    );
    const items = orders.length ? await itemOrder(orders.map((o) => o.uuid), req.author.faskesUuid) : [];
    kirim(res, orders.map((o) => ({ ...o, items: items.filter((i) => i.order_uuid === o.uuid) })));
  }),
);

rute.get("/:uuid", tangani(async (req, res) => kirim(res, await detailOrder(req.params.uuid, req.author.faskesUuid))));

// ── Buat & ubah order ────────────────────────────────────────────────────────

rute.post(
  "/",
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    const sumber = b.sumber || (b.rekam_medis_uuid || b.no_reg ? "rme" : "aps");
    if (!SUMBER.includes(sumber)) throw permintaanSalah("sumber harus rme, aps, atau rujukan");
    // Order dari RME mengikuti hak akses rekam medis kunjungan (sama dengan order lab/radiologi);
    // order APS/rujukan dibuat petugas PA → Order PA › CREATE.
    if (sumber !== "rme") await pastikanIzin(req, "Patologi Anatomi", "Order PA", "CREATE");

    let data;
    if (sumber === "rme") {
      const kunjungan = b.no_reg ? await cariKunjungan(b.no_reg, faskes) : await kunjunganDariRekamMedis(b.rekam_medis_uuid, faskes);
      if (!kunjungan) throw permintaanSalah("Kunjungan (No. Reg / rekam medis) tidak ditemukan");
      data = {
        patient_uuid: kunjungan.patient_uuid,
        no_reg: kunjungan.no_reg,
        rekam_medis_uuid: b.rekam_medis_uuid || kunjungan.rekam_medis_uuid || null,
        pelayanan: kunjungan.pelayanan,
        lokasi_asal_uuid: b.lokasi_asal_uuid || kunjungan.lokasi_uuid || null,
        dokter_pengirim_uuid: b.dokter_pengirim_uuid || kunjungan.practitioner_uuid || null,
        dokter_pengirim_luar: null,
        faskes_perujuk: null,
        payment_method: Number(kunjungan.payment_method) || 1,
      };
    } else {
      wajib(b, ["patient_uuid"]);
      if (sumber === "rujukan" && !String(b.dokter_pengirim_luar ?? "").trim() && !String(b.faskes_perujuk ?? "").trim())
        throw permintaanSalah("Order rujukan luar: isi dokter atau faskes perujuk");
      data = {
        patient_uuid: b.patient_uuid,
        no_reg: null,
        rekam_medis_uuid: null,
        pelayanan: "aps",
        lokasi_asal_uuid: b.lokasi_asal_uuid || null,
        dokter_pengirim_uuid: b.dokter_pengirim_uuid || null,
        dokter_pengirim_luar: teks(b.dokter_pengirim_luar, 200) ?? null,
        faskes_perujuk: teks(b.faskes_perujuk, 200) ?? null,
        payment_method: Number(b.payment_method) === 2 ? 2 : 1,
      };
    }
    const p = await pasien(data.patient_uuid, faskes);
    if (!p) throw permintaanSalah("Pasien tidak ditemukan di faskes ini");
    const master = await susunItem({ ...b, items: b.items ?? b.pemeriksaan_uuids ?? [] }, faskes, data.patient_uuid);

    const order = await transaksi(async (k) => {
      const o = await sisipkan(
        "pa_order",
        {
          faskes_uuid: faskes,
          no_order: await nomorBaru(faskes, "OPA", k),
          ...data,
          no_rm: p.no_rm,
          sumber,
          klinis: teks(b.klinis) ?? null,
          riwayat: teks(b.riwayat) ?? null,
          lokasi_anatomi: teks(b.lokasi_anatomi, 200) ?? null,
          cara_pengambilan: teks(b.cara_pengambilan, 100) ?? null,
          catatan: teks(b.catatan) ?? null,
          cito: Boolean(b.cito),
          status: "order",
          dibuat_oleh: req.author.username ?? null,
        },
        k,
      );
      await sisipkanItem(o.uuid, faskes, master, k);
      return o;
    });
    kirim(res, await detailOrder(order.uuid, faskes), `Order PA ${order.no_order} berhasil dibuat`);
  }),
);

// Ubah data klinis / CITO / pemeriksaan selama order belum divalidasi.
rute.put(
  "/:uuid",
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    await transaksi(async (k) => {
      const o = await kunciOrder(req.params.uuid, faskes, k);
      if (o.status !== "order") throw permintaanSalah("Order yang sudah divalidasi tidak dapat diubah");
      if (o.dibuat_oleh !== req.author.username) await pastikanIzin(req, "Patologi Anatomi", "Order PA", "CREATE");
      await ubah(
        "pa_order",
        o.uuid,
        faskes,
        {
          klinis: teks(b.klinis),
          riwayat: teks(b.riwayat),
          lokasi_anatomi: teks(b.lokasi_anatomi, 200),
          cara_pengambilan: teks(b.cara_pengambilan, 100),
          catatan: teks(b.catatan),
          cito: b.cito === undefined ? undefined : Boolean(b.cito),
          dokter_pengirim_uuid: b.dokter_pengirim_uuid === undefined ? undefined : b.dokter_pengirim_uuid || null,
          dokter_pengirim_luar: teks(b.dokter_pengirim_luar, 200),
          faskes_perujuk: teks(b.faskes_perujuk, 200),
        },
        k,
      );
      const items = await susunItem(b, faskes, o.patient_uuid, k);
      if (items) {
        await query(`UPDATE pa_order_item SET deleted_at = $1 WHERE order_uuid = $2 AND deleted_at IS NULL`, [sekarang(), o.uuid], k);
        await sisipkanItem(o.uuid, faskes, items, k);
      }
    });
    kirim(res, await detailOrder(req.params.uuid, faskes), "Order PA berhasil diperbarui");
  }),
);

// ── Validasi & batal ─────────────────────────────────────────────────────────

// Validasi petugas PA: status 'valid' + kirim tagihan (dalam transaksi: bila Pembayaran menolak, status tidak berubah).
// "Validasi & Kirim ke LIS PA" (body.kirim_lis_pa / body.koneksi_uuid): seluruh kasus (item) order dikirim ke LIS PA
// SEBELUM status order diubah; bila pengiriman gagal/tidak pasti, validasi dibatalkan (pola sama dengan Bridging LIS).
rute.post(
  "/:uuid/validasi",
  izinPa("Order PA", "VALIDASI"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    let lis = null;
    if (b.kirim_lis_pa) {
      const { kirimOrderKePa } = await import("./lis-pa/lis-pa-service.js");
      lis = await kirimOrderKePa(faskes, req.params.uuid, { koneksiUuid: b.koneksi_uuid || null, pengguna: req.author.username ?? null });
    }
    const tagihan = await transaksi(async (k) => {
      const o = await kunciOrder(req.params.uuid, faskes, k);
      if (o.status !== "order") throw new Galat(409, `Order berstatus ${o.status}, tidak dapat divalidasi`);
      await ubah("pa_order", o.uuid, faskes, { status: "valid", divalidasi_oleh: req.author.username ?? null, divalidasi_pada: sekarang() }, k);
      return tagihanOrder(o, req, false, k);
    });
    const o = await detailOrder(req.params.uuid, faskes);
    const pesanLis = lis ? `, ${lis.length} kasus terkirim ke LIS PA` : "";
    kirim(res, { ...o, tagihan, lis }, `${tagihan.dikirim ? `Order ${o.no_order} divalidasi, tagihan dikirim ke Pembayaran` : `Order ${o.no_order} divalidasi`}${pesanLis}`);
  }),
);

// Batal: hanya bila belum ada jaringan diterima (spesimen ditolak boleh). Bila sudah divalidasi, item tagihan dihapus.
rute.post(
  "/:uuid/batal",
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const alasan = String(req.body?.alasan ?? req.body?.alasan_batal ?? "").trim();
    if (!alasan) throw permintaanSalah("alasan wajib diisi");
    await transaksi(async (k) => {
      const o = await kunciOrder(req.params.uuid, faskes, k);
      if (!["order", "valid", "ditolak"].includes(o.status)) throw new Galat(409, `Order berstatus ${o.status}, tidak dapat dibatalkan`);
      // Pembuat order (mis. dokter dari RME) boleh membatalkan selama belum divalidasi; selain itu Order PA › BATAL.
      if (!(o.status === "order" && o.dibuat_oleh && o.dibuat_oleh === req.author.username))
        await pastikanIzin(req, "Patologi Anatomi", "Order PA", "BATAL");
      const diterima = await satu(
        `SELECT COUNT(*)::int n FROM pa_order_item WHERE order_uuid = $1 AND deleted_at IS NULL AND status NOT IN ('menunggu', 'ditolak')`,
        [o.uuid],
        k,
      );
      if (diterima.n) throw new Galat(409, "Jaringan sudah diterima/diproses, order tidak dapat dibatalkan");
      await ubah("pa_order", o.uuid, faskes, { status: "batal", alasan_batal: alasan }, k);
      if (o.status !== "order") await tagihanOrder(o, req, true, k);
    });
    const o = await detailOrder(req.params.uuid, faskes, undefined, false);
    kirim(res, o, `Order ${o.no_order} dibatalkan`);
  }),
);

export default rute;
