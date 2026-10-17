import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { nomorBaru } from "../umum/nomor.js";
import { cariKunjungan, kunjunganDariRekamMedis, pasien, namaPraktisi } from "../umum/kunjungan.js";
import { kirimTagihan } from "../umum/tagihan.js";
import { NAMA_PRAKTISI, STATUS_ORDER, SUMBER, daftarNilai, rentangOpsional, tglLokal } from "./bersama.js";
import { ekspansiPaket } from "./paket.js";

// Order Radiologi: dari RME (kunjungan RJ/RI/IGD), pasien APS (atas permintaan sendiri / rujukan luar), atau
// MCU (disisipkan langsung modul MCU: status 'valid', tanpa_tagihan). Alur: order → valid (tagihan dikirim ke
// Pembayaran) → diperiksa (radiografer) → selesai (expertise dokter Sp.Rad semua item) | batal.
const rute = express.Router();

// ── Kueri bersama ────────────────────────────────────────────────────────────

const KOLOM_ORDER = `
  o.uuid, o.no_order, o.patient_uuid, o.no_rm, o.no_reg, o.rekam_medis_uuid, o.sumber, o.pelayanan,
  o.lokasi_asal_uuid, o.dokter_pengirim_uuid, o.payment_method, o.klinis, o.catatan, o.cito, o.tanpa_tagihan,
  o.mcu_peserta_uuid, o.status, o.alasan_batal, o.divalidasi_oleh, o.divalidasi_pada, o.selesai_pada, o.dibuat_oleh,
  o.created_at, o.updated_at,
  p.name AS nama_pasien, p.gender, bd.birth_date,
  ${NAMA_PRAKTISI("o.dokter_pengirim_uuid")} AS dokter_pengirim,
  l.name AS lokasi_asal`;
const JOIN_ORDER = `
  LEFT JOIN patients p ON p.uuid = o.patient_uuid
  LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
  LEFT JOIN lokasi l ON l.uuid = o.lokasi_asal_uuid`;
const RINGKAS_ITEM = `
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS jumlah_item,
           COUNT(*) FILTER (WHERE i.status = 'selesai')::int AS jumlah_selesai,
           COUNT(*) FILTER (WHERE i.jadwal_uuid IS NOT NULL AND EXISTS (
             SELECT 1 FROM rad_jadwal jx WHERE jx.uuid = i.jadwal_uuid AND jx.status <> 'batal' AND jx.deleted_at IS NULL))::int AS jumlah_terjadwal,
           COALESCE(SUM(i.harga), 0)::float8 AS total,
           string_agg(i.nama, ', ' ORDER BY i.created_at, i.nama) AS pemeriksaan,
           (SELECT string_agg(pk.nama, ', ' ORDER BY pk.nama) FROM rad_paket pk WHERE pk.uuid IN (
              SELECT x.paket_uuid FROM rad_order_item x WHERE x.order_uuid = o.uuid AND x.deleted_at IS NULL)) AS paket,
           array_agg(DISTINCT i.modalitas) AS modalitas
      FROM rad_order_item i WHERE i.order_uuid = o.uuid AND i.deleted_at IS NULL
  ) ri ON true`;

// Item order (tanpa isi lampiran pada daftar; `dengan_lampiran` untuk detail/cetak).
const KOLOM_ITEM = (denganLampiran) => `
  i.uuid, i.order_uuid, i.pemeriksaan_uuid, i.nama, i.modalitas, i.harga::float8 AS harga, i.status,
  i.radiografer, i.waktu_periksa, i.dokter_radiologi_uuid, ${NAMA_PRAKTISI("i.dokter_radiologi_uuid")} AS dokter_radiologi,
  i.hasil, i.kesan, i.waktu_hasil, jsonb_array_length(i.lampiran) AS jumlah_lampiran,
  ${denganLampiran ? "i.lampiran," : ""} m.kode, m.bagian_tubuh, m.kode_icd9, m.persiapan, i.paket_uuid, pk.kode AS paket_kode, pk.nama AS paket_nama,
  i.radiografer_uuid, i.ruang_uuid, i.jadwal_uuid, COALESCE(ri.nama, rj.nama) AS ruang, COALESCE(ri.kode, rj.kode) AS ruang_kode,
  COALESCE(i.ruang_uuid, j.ruang_uuid) AS ruang_pakai_uuid,
  to_char(j.tanggal, 'YYYY-MM-DD') AS jadwal_tanggal, to_char(j.jam_mulai, 'HH24:MI') AS jadwal_jam, j.status AS jadwal_status, j.no_antrean,
  i.accession_number, i.pacs_koneksi_uuid, i.url_viewer,
  i.created_at, i.updated_at`;

export const itemOrder = (orderUuids, faskesUuid, denganLampiran = false, k) =>
  query(
    `SELECT ${KOLOM_ITEM(denganLampiran)}
       FROM rad_order_item i LEFT JOIN rad_pemeriksaan m ON m.uuid = i.pemeriksaan_uuid
       LEFT JOIN rad_paket pk ON pk.uuid = i.paket_uuid
       LEFT JOIN rad_jadwal j ON j.uuid = i.jadwal_uuid AND j.status <> 'batal' AND j.deleted_at IS NULL
       LEFT JOIN rad_ruang rj ON rj.uuid = j.ruang_uuid
       LEFT JOIN rad_ruang ri ON ri.uuid = i.ruang_uuid
      WHERE i.order_uuid = ANY($1) AND i.faskes_uuid = $2 AND i.deleted_at IS NULL
      ORDER BY i.created_at, i.nama`,
    [orderUuids, faskesUuid],
    k,
  );

// Detail order lengkap: data order + pasien + item (dengan hasil).
export const detailOrder = async (uuid, faskesUuid, k, denganLampiran = true) => {
  const o = await satu(
    `SELECT ${KOLOM_ORDER} FROM rad_order o ${JOIN_ORDER}
      WHERE o.uuid = $1 AND o.faskes_uuid = $2 AND o.deleted_at IS NULL`,
    [uuid, faskesUuid],
    k,
  );
  if (!o) throw tidakDitemukan("Order radiologi");
  const [p, items] = await Promise.all([pasien(o.patient_uuid, faskesUuid), itemOrder([o.uuid], faskesUuid, denganLampiran, k)]);
  return { ...o, pasien: p, items, total: items.reduce((n, i) => n + Number(i.harga), 0) };
};

// Kunci baris order (FOR UPDATE) dalam transaksi.
const kunciOrder = async (uuid, faskesUuid, k) => {
  const o = await satu(`SELECT * FROM rad_order WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [uuid, faskesUuid], k);
  if (!o) throw tidakDitemukan("Order radiologi");
  return o;
};

// Susun item order dari body: pemeriksaan satuan (items / pemeriksaan_uuids) + paket (paket_uuids).
// Paket diekspansi (harga dialokasikan dari harga paket); pemeriksaan satuan yang sudah tercakup paket diabaikan.
// Mengembalikan null bila body tidak menyebut item maupun paket (dipakai PUT: item tidak diubah).
const susunItem = async (b, faskes, k) => {
  const daftar = b.items ?? b.pemeriksaan_uuids;
  const paketUuids = b.paket_uuids ?? (b.paket_uuid ? [b.paket_uuid] : undefined);
  if (daftar === undefined && paketUuids === undefined) return null;
  if (paketUuids !== undefined && !Array.isArray(paketUuids)) throw permintaanSalah("paket_uuids harus berupa daftar");
  const dariPaket = await ekspansiPaket(paketUuids ?? [], faskes, k);
  const tercakup = new Set(dariPaket.map((i) => i.uuid));
  const uuids = [...new Set((daftar ?? []).map((x) => (typeof x === "string" ? x : x?.pemeriksaan_uuid)).filter(Boolean))].filter((u) => !tercakup.has(u));
  const master = uuids.length
    ? await query(
        `SELECT uuid, nama, modalitas, harga FROM rad_pemeriksaan WHERE uuid = ANY($1) AND faskes_uuid = $2 AND deleted_at IS NULL AND status`,
        [uuids, faskes],
        k,
      )
    : [];
  if (master.length !== uuids.length) throw permintaanSalah("Sebagian pemeriksaan tidak ditemukan atau tidak aktif");
  const hasil = [...dariPaket, ...master.map((m) => ({ ...m, paket_uuid: null }))];
  if (!hasil.length) throw permintaanSalah("Pilih minimal satu pemeriksaan atau paket");
  return hasil;
};

const sisipkanItem = async (orderUuid, faskes, items, k) => {
  for (const m of items) {
    await sisipkan(
      "rad_order_item",
      { faskes_uuid: faskes, order_uuid: orderUuid, pemeriksaan_uuid: m.uuid, nama: m.nama, modalitas: m.modalitas, harga: m.harga, paket_uuid: m.paket_uuid ?? null, status: "menunggu" },
      k,
    );
  }
};

// Tagihan per pemeriksaan (item paket memakai harga alokasi), ref unik "rad:<order>" (kirim ulang mengganti; hapus = batal).
const tagihanOrder = async (o, req, hapus = false, k) => {
  const items = hapus
    ? []
    : (await itemOrder([o.uuid], o.faskes_uuid, false, k)).map((i) => ({
        item_name: i.paket_nama ? `Radiologi (${i.paket_nama}): ${i.nama}` : `Radiologi: ${i.nama}`,
        price: Number(i.harga) || 0,
        qty: 1,
        additional_info: {
          kode_pemeriksaan: i.kode, modalitas: i.modalitas, no_order: o.no_order,
          // bill_item.additional_field varchar(255): cukup kode paket (nama paket sudah di item_name).
          ...(i.paket_uuid ? { kode_paket: i.paket_kode } : {}),
        },
      }));
  return kirimTagihan({
    faskesUuid: o.faskes_uuid,
    patientUuid: o.patient_uuid,
    noReg: o.sumber === "rme" ? o.no_reg : null,
    paymentMethod: o.payment_method,
    ref: `rad:${o.uuid}`,
    items,
    token: req.author.token,
    hapus,
    apsType: "RAD",
    apsServiceName: "Radiologi",
    apsServiceCode: o.no_order,
    apsLayananUuid: o.uuid,
    apsPraktisi: await namaPraktisi(o.dokter_pengirim_uuid),
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
    const rentang = rentangOpsional(req.query);
    if (rentang) {
      p.push(rentang.mulai, rentang.selesai);
      w += ` AND ${tglLokal("o.created_at")} BETWEEN $${p.length - 1} AND $${p.length}`;
    }
    const modalitas = daftarNilai(req.query.modalitas);
    if (modalitas.length) {
      p.push(modalitas);
      w += ` AND EXISTS (SELECT 1 FROM rad_order_item x WHERE x.order_uuid = o.uuid AND x.deleted_at IS NULL AND x.modalitas = ANY($${p.length}))`;
    }
    if (["1", "true"].includes(String(req.query.cito))) w += " AND o.cito";
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND (p.name ILIKE $${p.length} OR o.no_rm ILIKE $${p.length} OR o.no_order ILIKE $${p.length} OR o.no_reg ILIKE $${p.length})`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM rad_order o ${JOIN_ORDER} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${KOLOM_ORDER}, ri.* FROM rad_order o ${JOIN_ORDER} ${RINGKAS_ITEM}
        WHERE ${w} ORDER BY o.created_at DESC, o.no_order DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Order radiologi satu kunjungan (RME): ?rekam_medis_uuid= dan/atau ?no_reg= (atau ?patient_uuid= untuk riwayat pasien).
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
      `SELECT ${KOLOM_ORDER}, ri.* FROM rad_order o ${JOIN_ORDER} ${RINGKAS_ITEM}
        WHERE o.faskes_uuid = $1 AND o.deleted_at IS NULL AND (${syarat.join(" OR ")})
        ORDER BY o.created_at DESC LIMIT 100`,
      p,
    );
    const items = orders.length ? await itemOrder(orders.map((o) => o.uuid), req.author.faskesUuid) : [];
    kirim(res, orders.map((o) => ({ ...o, items: items.filter((i) => i.order_uuid === o.uuid) })));
  }),
);

rute.get(
  "/:uuid",
  tangani(async (req, res) => kirim(res, await detailOrder(req.params.uuid, req.author.faskesUuid))),
);

// ── Buat order ───────────────────────────────────────────────────────────────

rute.post(
  "/",
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    const sumber = b.sumber || (b.rekam_medis_uuid || b.no_reg ? "rme" : "aps");
    if (!["rme", "aps"].includes(sumber)) throw permintaanSalah("sumber harus rme atau aps (order MCU dibuat dari modul MCU)");

    // Pemeriksaan: array uuid / objek { pemeriksaan_uuid } dan/atau paket_uuids (paket pemeriksaan).
    const master = await susunItem({ ...b, items: b.items ?? b.pemeriksaan_uuids ?? [] }, faskes);

    // Data kunjungan / pasien.
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
        payment_method: Number(kunjungan.payment_method) || 1,
      };
    } else {
      wajib(b, ["patient_uuid"]);
      data = {
        patient_uuid: b.patient_uuid,
        no_reg: null,
        rekam_medis_uuid: null,
        pelayanan: "aps",
        lokasi_asal_uuid: b.lokasi_asal_uuid || null,
        dokter_pengirim_uuid: b.dokter_pengirim_uuid || null,
        payment_method: Number(b.payment_method) === 2 ? 2 : 1,
      };
    }
    const p = await pasien(data.patient_uuid, faskes);
    if (!p) throw permintaanSalah("Pasien tidak ditemukan di faskes ini");

    const order = await transaksi(async (k) => {
      const o = await sisipkan(
        "rad_order",
        {
          faskes_uuid: faskes,
          no_order: await nomorBaru(faskes, "RAD", k),
          ...data,
          no_rm: p.no_rm,
          sumber,
          klinis: b.klinis?.trim() || null,
          catatan: b.catatan?.trim() || null,
          cito: Boolean(b.cito),
          tanpa_tagihan: false,
          status: "order",
          dibuat_oleh: req.author.username ?? null,
        },
        k,
      );
      await sisipkanItem(o.uuid, faskes, master, k);
      return o;
    });
    kirim(res, await detailOrder(order.uuid, faskes), `Order radiologi ${order.no_order} berhasil dibuat`);
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
      await ubah(
        "rad_order",
        o.uuid,
        faskes,
        {
          klinis: b.klinis === undefined ? undefined : b.klinis?.trim() || null,
          catatan: b.catatan === undefined ? undefined : b.catatan?.trim() || null,
          cito: b.cito === undefined ? undefined : Boolean(b.cito),
          dokter_pengirim_uuid: b.dokter_pengirim_uuid === undefined ? undefined : b.dokter_pengirim_uuid || null,
        },
        k,
      );
      // Item/paket diganti seluruhnya (order belum divalidasi sehingga belum ada hasil pemeriksaan).
      const items = await susunItem(b, faskes, k);
      if (items) {
        await query(`UPDATE rad_order_item SET deleted_at = $1 WHERE order_uuid = $2 AND deleted_at IS NULL`, [sekarang(), o.uuid], k);
        await sisipkanItem(o.uuid, faskes, items, k);
      }
    });
    kirim(res, await detailOrder(req.params.uuid, faskes), "Order radiologi berhasil diperbarui");
  }),
);

// ── Validasi & batal ─────────────────────────────────────────────────────────

// Validasi petugas radiologi: status 'valid' + kirim tagihan (kecuali order tanpa tagihan, mis. MCU).
// Pengiriman tagihan di dalam transaksi: bila Pembayaran menolak, status order tidak berubah.
// Dipakai juga oleh "Validasi Saja" (pacs-rute.js) dan "Validasi & Kirim ke PACS" setelah pengiriman PACS berhasil.
export const jalankanValidasi = async (faskes, orderUuid, req) => {
  const tagihan = await transaksi(async (k) => {
    const o = await kunciOrder(orderUuid, faskes, k);
    if (o.status !== "order") throw new Galat(409, `Order berstatus ${o.status}, tidak dapat divalidasi`);
    await ubah("rad_order", o.uuid, faskes, { status: "valid", divalidasi_oleh: req.author.username ?? null, divalidasi_pada: sekarang() }, k);
    return o.tanpa_tagihan ? { dikirim: false, total: 0 } : tagihanOrder(o, req, false, k);
  });
  const o = await detailOrder(orderUuid, faskes);
  return { order: o, tagihan };
};

rute.post(
  "/:uuid/validasi",
  tangani(async (req, res) => {
    const { order: o, tagihan } = await jalankanValidasi(req.author.faskesUuid, req.params.uuid, req);
    kirim(res, { ...o, tagihan }, tagihan.dikirim ? `Order ${o.no_order} divalidasi, tagihan dikirim ke Pembayaran` : `Order ${o.no_order} divalidasi`);
  }),
);

// Batal: hanya sebelum ada pemeriksaan dikerjakan. Bila sudah valid, item tagihan order dihapus.
rute.post(
  "/:uuid/batal",
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const alasan = String(req.body?.alasan ?? req.body?.alasan_batal ?? "").trim();
    if (!alasan) throw permintaanSalah("alasan wajib diisi");
    await transaksi(async (k) => {
      const o = await kunciOrder(req.params.uuid, faskes, k);
      if (!["order", "valid"].includes(o.status)) throw new Galat(409, `Order berstatus ${o.status}, tidak dapat dibatalkan`);
      const dikerjakan = await satu(`SELECT COUNT(*)::int n FROM rad_order_item WHERE order_uuid = $1 AND deleted_at IS NULL AND status <> 'menunggu'`, [o.uuid], k);
      if (dikerjakan.n) throw new Galat(409, "Sebagian pemeriksaan sudah dikerjakan, order tidak dapat dibatalkan");
      await ubah("rad_order", o.uuid, faskes, { status: "batal", alasan_batal: alasan }, k);
      // Jadwal pemeriksaan aktif ikut dibatalkan (slot ruang kembali tersedia).
      await query(
        `UPDATE rad_jadwal SET status = 'batal', alasan_batal = $2, updated_at = $3 WHERE order_uuid = $1 AND status IN ('terjadwal', 'hadir') AND deleted_at IS NULL`,
        [o.uuid, `Order dibatalkan: ${alasan}`, sekarang()],
        k,
      );
      if (o.status === "valid" && !o.tanpa_tagihan) await tagihanOrder(o, req, true, k);
    });
    const o = await detailOrder(req.params.uuid, faskes, undefined, false);
    kirim(res, o, `Order ${o.no_order} dibatalkan`);
  }),
);

export default rute;
