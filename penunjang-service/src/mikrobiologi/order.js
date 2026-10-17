import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { nomorBaru } from "../umum/nomor.js";
import { cariKunjungan, kunjunganDariRekamMedis, pasien, namaPraktisi } from "../umum/kunjungan.js";
import { kirimTagihan } from "../umum/tagihan.js";
import { NAMA_PRAKTISI, SPESIMEN, STATUS_ORDER, daftarNilai, rentangOpsional, tglLokal } from "./bersama.js";
import { izinMikro, pastikanIzin } from "../umum/izin.js";
import { kirimOrder as kirimOrderLis } from "./lis-service.js";

// Order Mikrobiologi: dari RME (kunjungan RJ/RI/IGD) atau pasien APS. Satu item = satu pemeriksaan atas satu spesimen
// (jenis + lokasi/sumber). Alur order: order → valid (tagihan "mikro:<uuid>" dikirim ke Pembayaran) → diproses
// (spesimen pertama diterima) → selesai (semua item final/ditolak) | batal (sebelum ada spesimen diterima).
const rute = express.Router();

const KOLOM_ORDER = `
  o.uuid, o.no_order, o.patient_uuid, o.no_rm, o.no_reg, o.rekam_medis_uuid, o.sumber, o.pelayanan,
  o.lokasi_asal_uuid, o.dokter_pengirim_uuid, o.payment_method, o.klinis, o.antibiotik_sedang, o.catatan, o.cito,
  o.status, o.alasan_batal, o.divalidasi_oleh, o.divalidasi_pada, o.selesai_pada, o.dibuat_oleh, o.created_at, o.updated_at,
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
           COUNT(*) FILTER (WHERE i.status = 'selesai')::int AS jumlah_final,
           COUNT(*) FILTER (WHERE i.status = 'sementara')::int AS jumlah_sementara,
           COUNT(*) FILTER (WHERE i.status = 'ditolak')::int AS jumlah_ditolak,
           COALESCE(SUM(i.harga), 0)::float8 AS total,
           string_agg(i.nama, ', ' ORDER BY i.created_at, i.nama) AS pemeriksaan
      FROM mikro_order_item i WHERE i.order_uuid = o.uuid AND i.deleted_at IS NULL
  ) ri ON true`;

// Item order + ringkasan hasil (status hasil, organisme). `lengkap` = sertakan hasil, isolat & kepekaan (detail/cetak).
export const itemOrder = async (orderUuids, faskesUuid, lengkap = false, k) => {
  const items = await query(
    `SELECT i.uuid, i.order_uuid, i.pemeriksaan_uuid, i.nama, i.jenis, i.harga::float8 AS harga, i.tat_hari, i.jenis_spesimen,
            i.lokasi_spesimen, i.status, i.no_mikro, i.spesimen_uuid, i.created_at, i.updated_at,
            m.kode, m.kode_lis, m.dengan_pewarnaan, m.dengan_kultur, m.dengan_ast,
            s.waktu_ambil, s.waktu_terima, s.diterima_oleh, s.status AS status_spesimen, s.alasan_tolak,
            h.uuid AS hasil_uuid, h.status AS status_hasil, h.kultur_status, h.sementara_pada, h.diverifikasi_pada,
            ${NAMA_PRAKTISI("h.dokter_mikro_uuid")} AS dokter_mikro,
            (SELECT string_agg(x.nama_organisme, ', ' ORDER BY x.urutan) FROM mikro_isolat x WHERE x.hasil_uuid = h.uuid AND x.deleted_at IS NULL) AS organisme
       FROM mikro_order_item i
       LEFT JOIN mikro_pemeriksaan m ON m.uuid = i.pemeriksaan_uuid
       LEFT JOIN mikro_spesimen s ON s.uuid = i.spesimen_uuid
       LEFT JOIN mikro_hasil h ON h.item_uuid = i.uuid AND h.deleted_at IS NULL
      WHERE i.order_uuid = ANY($1) AND i.faskes_uuid = $2 AND i.deleted_at IS NULL
      ORDER BY i.created_at, i.nama`,
    [orderUuids, faskesUuid],
    k,
  );
  const hasil = items.map((i) => ({ ...i, nama_spesimen: SPESIMEN[i.jenis_spesimen] ?? i.jenis_spesimen }));
  if (!lengkap || !hasil.length) return hasil;
  const detail = await hasilLengkap(hasil.map((i) => i.hasil_uuid).filter(Boolean), k);
  return hasil.map((i) => ({ ...i, hasil: detail.get(i.hasil_uuid) ?? null }));
};

// Hasil + isolat + kepekaan (Map hasil_uuid → objek). Kepekaan diurutkan sesuai panel (urutan) lalu nama.
export const hasilLengkap = async (hasilUuids, k) => {
  if (!hasilUuids.length) return new Map();
  const [hasil, isolat, kepekaan] = await Promise.all([
    query(
      `SELECT h.*, ${NAMA_PRAKTISI("h.dokter_mikro_uuid")} AS dokter_mikro FROM mikro_hasil h WHERE h.uuid = ANY($1)`,
      [hasilUuids],
      k,
    ),
    query(
      `SELECT x.uuid, x.hasil_uuid, x.urutan, x.organisme_uuid, x.nama_organisme, x.kelompok, x.jumlah_koloni, x.koloni_cfu::float8 AS koloni_cfu,
              x.penanda, x.catatan, x.sumber, o.gram, o.bentuk, o.kode AS kode_organisme
         FROM mikro_isolat x LEFT JOIN mikro_organisme o ON o.uuid = x.organisme_uuid
        WHERE x.hasil_uuid = ANY($1) AND x.deleted_at IS NULL ORDER BY x.urutan`,
      [hasilUuids],
      k,
    ),
    query(
      `SELECT kp.uuid, kp.isolat_uuid, kp.antibiotik_uuid, kp.kode, kp.nama, kp.urutan, kp.metode, kp.mic, kp.zona::float8 AS zona,
              kp.interpretasi, kp.dilaporkan, kp.sumber, a.golongan
         FROM mikro_kepekaan kp JOIN mikro_isolat x ON x.uuid = kp.isolat_uuid
         LEFT JOIN mikro_antibiotik a ON a.uuid = kp.antibiotik_uuid
        WHERE x.hasil_uuid = ANY($1) AND x.deleted_at IS NULL AND kp.deleted_at IS NULL ORDER BY kp.urutan, kp.nama`,
      [hasilUuids],
      k,
    ),
  ]);
  return new Map(
    hasil.map((h) => [
      h.uuid,
      { ...h, isolat: isolat.filter((x) => x.hasil_uuid === h.uuid).map((x) => ({ ...x, kepekaan: kepekaan.filter((kp) => kp.isolat_uuid === x.uuid) })) },
    ]),
  );
};

// Detail order lengkap: data order + pasien + item (dengan hasil bila `lengkap`).
export const detailOrder = async (uuid, faskesUuid, k, lengkap = true) => {
  const o = await satu(`SELECT ${KOLOM_ORDER} FROM mikro_order o ${JOIN_ORDER} WHERE o.uuid = $1 AND o.faskes_uuid = $2 AND o.deleted_at IS NULL`, [uuid, faskesUuid], k);
  if (!o) throw tidakDitemukan("Order mikrobiologi");
  const [p, items] = await Promise.all([pasien(o.patient_uuid, faskesUuid), itemOrder([o.uuid], faskesUuid, lengkap, k)]);
  return { ...o, pasien: p, items, total: items.reduce((n, i) => n + Number(i.harga), 0) };
};

const kunciOrder = async (uuid, faskesUuid, k) => {
  const o = await satu(`SELECT * FROM mikro_order WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [uuid, faskesUuid], k);
  if (!o) throw tidakDitemukan("Order mikrobiologi");
  return o;
};

// Susun item dari body.items: [{ pemeriksaan_uuid, jenis_spesimen, lokasi_spesimen? }]. Jenis spesimen wajib & harus
// termasuk spesimen yang diizinkan pemeriksaan (bila master membatasi). Pemeriksaan sama boleh berulang untuk spesimen
// berbeda (mis. kultur darah 2 set: lengan kanan & kiri).
const susunItem = async (daftar, faskes, k) => {
  if (!Array.isArray(daftar) || !daftar.length) throw permintaanSalah("Pilih minimal satu pemeriksaan");
  const uuids = [...new Set(daftar.map((x) => x?.pemeriksaan_uuid).filter(Boolean))];
  const master = await query(
    `SELECT uuid, nama, jenis, harga, tat_hari, spesimen FROM mikro_pemeriksaan WHERE uuid = ANY($1) AND faskes_uuid = $2 AND deleted_at IS NULL AND status`,
    [uuids, faskes],
    k,
  );
  return daftar.map((x) => {
    const m = master.find((mm) => mm.uuid === x?.pemeriksaan_uuid);
    if (!m) throw permintaanSalah("Sebagian pemeriksaan tidak ditemukan atau tidak aktif");
    const sp = String(x.jenis_spesimen ?? (m.spesimen.length === 1 ? m.spesimen[0] : "")).trim();
    if (!sp) throw permintaanSalah(`Jenis spesimen untuk ${m.nama} wajib dipilih`);
    if (!SPESIMEN[sp]) throw permintaanSalah(`Jenis spesimen tidak dikenal: ${sp}`);
    if (m.spesimen.length && !m.spesimen.includes(sp)) throw permintaanSalah(`${m.nama} tidak menerima spesimen ${SPESIMEN[sp]}`);
    return { ...m, jenis_spesimen: sp, lokasi_spesimen: String(x.lokasi_spesimen ?? "").trim() || null };
  });
};

const sisipkanItem = async (orderUuid, faskes, items, k) => {
  for (const m of items) {
    await sisipkan(
      "mikro_order_item",
      {
        faskes_uuid: faskes, order_uuid: orderUuid, pemeriksaan_uuid: m.uuid, nama: m.nama, jenis: m.jenis, harga: m.harga, tat_hari: m.tat_hari,
        jenis_spesimen: m.jenis_spesimen, lokasi_spesimen: m.lokasi_spesimen, status: "menunggu",
      },
      k,
    );
  }
};

// Tagihan per pemeriksaan, ref unik "mikro:<order>" (kirim ulang mengganti; hapus = batal).
const tagihanOrder = async (o, req, hapus = false, k) => {
  const items = hapus
    ? []
    : (await itemOrder([o.uuid], o.faskes_uuid, false, k)).map((i) => ({
        item_name: `Mikrobiologi: ${i.nama} (${i.nama_spesimen})`,
        price: Number(i.harga) || 0,
        qty: 1,
        additional_info: { kode_pemeriksaan: i.kode, spesimen: i.jenis_spesimen, no_order: o.no_order },
      }));
  return kirimTagihan({
    faskesUuid: o.faskes_uuid,
    patientUuid: o.patient_uuid,
    noReg: o.sumber === "rme" ? o.no_reg : null,
    paymentMethod: o.payment_method,
    ref: `mikro:${o.uuid}`,
    items,
    token: req.author.token,
    hapus,
    apsType: "MIKRO",
    apsServiceName: "Mikrobiologi",
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
    for (const kol of ["sumber", "pelayanan"]) {
      const v = daftarNilai(req.query[kol]);
      if (!v.length) continue;
      p.push(v);
      w += ` AND o.${kol} = ANY($${p.length})`;
    }
    const rentang = rentangOpsional(req.query);
    if (rentang) {
      p.push(rentang.mulai, rentang.selesai);
      w += ` AND ${tglLokal("o.created_at")} BETWEEN $${p.length - 1} AND $${p.length}`;
    }
    if (["1", "true"].includes(String(req.query.cito))) w += " AND o.cito";
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND (p.name ILIKE $${p.length} OR o.no_rm ILIKE $${p.length} OR o.no_order ILIKE $${p.length} OR o.no_reg ILIKE $${p.length})`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM mikro_order o ${JOIN_ORDER} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${KOLOM_ORDER}, ri.* FROM mikro_order o ${JOIN_ORDER} ${RINGKAS_ITEM}
        WHERE ${w} ORDER BY o.created_at DESC, o.no_order DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Order mikrobiologi satu kunjungan (RME): ?rekam_medis_uuid= dan/atau ?no_reg= (atau ?patient_uuid= untuk riwayat pasien).
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
      `SELECT ${KOLOM_ORDER}, ri.* FROM mikro_order o ${JOIN_ORDER} ${RINGKAS_ITEM}
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

// ── Buat & ubah order ────────────────────────────────────────────────────────

rute.post(
  "/",
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    const sumber = b.sumber || (b.rekam_medis_uuid || b.no_reg ? "rme" : "aps");
    if (!["rme", "aps"].includes(sumber)) throw permintaanSalah("sumber harus rme atau aps");
    // Order dari RME mengikuti hak akses rekam medis kunjungan; order APS dibuat petugas → Order Mikrobiologi › CREATE.
    if (sumber !== "rme") await pastikanIzin(req, "Mikrobiologi", "Order Mikrobiologi", "CREATE");
    const items = await susunItem(b.items, faskes);

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
        "mikro_order",
        {
          faskes_uuid: faskes,
          no_order: await nomorBaru(faskes, "MIK", k),
          ...data,
          no_rm: p.no_rm,
          sumber,
          klinis: b.klinis?.trim() || null,
          antibiotik_sedang: b.antibiotik_sedang?.trim() || null,
          catatan: b.catatan?.trim() || null,
          cito: Boolean(b.cito),
          status: "order",
          dibuat_oleh: req.author.username ?? null,
        },
        k,
      );
      await sisipkanItem(o.uuid, faskes, items, k);
      return o;
    });
    kirim(res, await detailOrder(order.uuid, faskes), `Order mikrobiologi ${order.no_order} berhasil dibuat`);
  }),
);

// Ubah data klinis / CITO / item selama order belum divalidasi.
rute.put(
  "/:uuid",
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    await transaksi(async (k) => {
      const o = await kunciOrder(req.params.uuid, faskes, k);
      if (o.status !== "order") throw permintaanSalah("Order yang sudah divalidasi tidak dapat diubah");
      if (o.dibuat_oleh !== req.author.username) await pastikanIzin(req, "Mikrobiologi", "Order Mikrobiologi", "CREATE");
      const opsional = (v) => (v === undefined ? undefined : String(v ?? "").trim() || null);
      await ubah(
        "mikro_order",
        o.uuid,
        faskes,
        {
          klinis: opsional(b.klinis),
          antibiotik_sedang: opsional(b.antibiotik_sedang),
          catatan: opsional(b.catatan),
          cito: b.cito === undefined ? undefined : Boolean(b.cito),
          dokter_pengirim_uuid: b.dokter_pengirim_uuid === undefined ? undefined : b.dokter_pengirim_uuid || null,
        },
        k,
      );
      if (b.items !== undefined) {
        const items = await susunItem(b.items, faskes, k);
        await query(`UPDATE mikro_order_item SET deleted_at = $1 WHERE order_uuid = $2 AND deleted_at IS NULL`, [sekarang(), o.uuid], k);
        await sisipkanItem(o.uuid, faskes, items, k);
      }
    });
    kirim(res, await detailOrder(req.params.uuid, faskes), "Order mikrobiologi berhasil diperbarui");
  }),
);

// ── Validasi & batal ─────────────────────────────────────────────────────────

// Validasi petugas lab mikrobiologi: status 'valid' + kirim tagihan (di dalam transaksi: bila Pembayaran menolak,
// status order tidak berubah). Body opsional { aksi: "validasi_saja" | "validasi_kirim", koneksi_uuid? } — "validasi_kirim"
// memerlukan fitur mikro_bridging_lis & koneksi LIS Mikrobiologi aktif; kegagalan kirim membatalkan validasi (KF-3, KT-4).
rute.post(
  "/:uuid/validasi",
  izinMikro("Order Mikrobiologi", "VALIDASI"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const kirimKeLis = req.body?.aksi === "validasi_kirim";
    const tagihan = await transaksi(async (k) => {
      const o = await kunciOrder(req.params.uuid, faskes, k);
      if (o.status !== "order") throw new Galat(409, `Order berstatus ${o.status}, tidak dapat divalidasi`);
      await ubah("mikro_order", o.uuid, faskes, { status: "valid", divalidasi_oleh: req.author.username ?? null, divalidasi_pada: sekarang() }, k);
      return tagihanOrder(o, req, false, k);
    });
    let hasilLis = null;
    if (kirimKeLis) {
      try {
        hasilLis = await kirimOrderLis(faskes, req.params.uuid, { koneksiUuid: req.body?.koneksi_uuid, pengguna: req.author.username });
        if (hasilLis.status !== "terkirim") throw new Error(hasilLis.pesan);
      } catch (error) {
        // Batalkan validasi gabungan: kembalikan status order & hapus tagihan agar status tidak tidak konsisten.
        await transaksi(async (k) => {
          const o = await kunciOrder(req.params.uuid, faskes, k);
          await ubah("mikro_order", o.uuid, faskes, { status: "order", divalidasi_oleh: null, divalidasi_pada: null }, k);
          await tagihanOrder(o, req, true, k);
        });
        throw new Galat(502, `Validasi dibatalkan: gagal mengirim ke LIS Mikrobiologi — ${error.message}`);
      }
    }
    const o = await detailOrder(req.params.uuid, faskes, undefined, false);
    const pesan = hasilLis
      ? `Order ${o.no_order} divalidasi & dikirim ke LIS Mikrobiologi`
      : tagihan.dikirim
        ? `Order ${o.no_order} divalidasi, tagihan dikirim ke Pembayaran`
        : `Order ${o.no_order} divalidasi`;
    kirim(res, { ...o, tagihan, kirim_lis: hasilLis }, pesan);
  }),
);

// Batal: hanya sebelum ada spesimen diterima. Bila sudah valid, item tagihan order dihapus.
rute.post(
  "/:uuid/batal",
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const alasan = String(req.body?.alasan ?? req.body?.alasan_batal ?? "").trim();
    if (!alasan) throw permintaanSalah("alasan wajib diisi");
    await transaksi(async (k) => {
      const o = await kunciOrder(req.params.uuid, faskes, k);
      if (!["order", "valid"].includes(o.status)) throw new Galat(409, `Order berstatus ${o.status}, tidak dapat dibatalkan`);
      // Pembuat order (mis. dokter dari RME) boleh membatalkan selama belum divalidasi; selain itu Order Mikrobiologi › BATAL.
      if (!(o.status === "order" && o.dibuat_oleh && o.dibuat_oleh === req.author.username))
        await pastikanIzin(req, "Mikrobiologi", "Order Mikrobiologi", "BATAL");
      const dikerjakan = await satu(
        `SELECT COUNT(*)::int n FROM mikro_order_item WHERE order_uuid = $1 AND deleted_at IS NULL AND status NOT IN ('menunggu', 'ditolak')`,
        [o.uuid],
        k,
      );
      if (dikerjakan.n) throw new Galat(409, "Spesimen sudah diterima/diproses, order tidak dapat dibatalkan");
      await ubah("mikro_order", o.uuid, faskes, { status: "batal", alasan_batal: alasan }, k);
      if (o.status === "valid") await tagihanOrder(o, req, true, k);
    });
    const o = await detailOrder(req.params.uuid, faskes, undefined, false);
    kirim(res, o, `Order ${o.no_order} dibatalkan`);
  }),
);

export default rute;
