import { query } from "../../db.js";
import { keSen, rentangPeriode } from "../bersama.js";
import { KATEGORI_ITEM } from "./bersama.js";

// Dasar perhitungan jaspel dari database bersama (BACA SAJA; tabel Pembayaran/Pendaftaran tidak diubah).
//
// Tagihan LUNAS pada periode: keluarga tagihan (induk bills.merge_with IS NULL + tagihan anak gabungan) yang sudah
// ditutup kasir (close_bill) dan kumulatif pembayaran sah (payment_history.status = true) mencapai total keluarga.
// Tanggal lunas = waktu pembayaran yang membuat kumulatif mencapai total; harus jatuh di bulan periode (WIB).
// Pembayaran berjenis INSURANCE adalah pengalihan ke piutang penjamin (bukan uang diterima) — item keluarga tersebut
// ditandai `penjamin` (tertahan) karena data pelunasan klaim penjamin/BPJS belum ada di database bersama.
//
// Pelaksana = practitioner_uuid kunjungan (RJ/RI/IGD; RI = DPJP) yang dicocokkan dari service_bill.layanan_uuid atau
// No. Registrasi (service_code). Layanan tanpa kunjungan (APS/OTC) → pelaksana kosong → pengecualian.
export const ambilSumber = async (k, f, tahun, bulan) => {
  const { awal, akhir } = rentangPeriode(tahun, bulan);
  const rows = await query(
    `WITH keluarga AS (
       SELECT p.uuid AS induk_uuid, p.invoice_code,
              p.grand_total + COALESCE((SELECT SUM(c.grand_total) FROM bills c
                                         WHERE c.merge_with = p.uuid AND c.faskes_uuid = p.faskes_uuid AND c.deleted_at IS NULL), 0) AS total_tagihan
         FROM bills p
        WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.merge_with IS NULL AND p.close_bill = true
     ),
     bayar AS (
       SELECT x.bill_uuid, x.created_at, x.jenis, SUM(x.amount) OVER (PARTITION BY x.bill_uuid ORDER BY x.created_at, x.id) AS kumulatif
         FROM (SELECT ph.id, ph.bill_uuid, ph.amount, ph.payment_type::text AS jenis,
                      -- epoch detik; data lama bermilidetik dinormalkan (pola akuntansi/event.js#epochDetik)
                      CASE WHEN ph.created_at > 100000000000 THEN ph.created_at / 1000 ELSE ph.created_at END AS created_at
                 FROM payment_history ph
                WHERE ph.faskes_uuid = $1 AND ph.deleted_at IS NULL AND ph.status = true
                  AND ph.bill_uuid IN (SELECT induk_uuid FROM keluarga)) x
        WHERE x.created_at <= $3
     ),
     lunas AS (
       SELECT k.*, (SELECT MIN(b.created_at) FROM bayar b WHERE b.bill_uuid = k.induk_uuid AND b.kumulatif >= k.total_tagihan - 0.005) AS tanggal_lunas,
              EXISTS (SELECT 1 FROM bayar b WHERE b.bill_uuid = k.induk_uuid AND b.jenis = 'INSURANCE') AS penjamin
         FROM keluarga k WHERE k.total_tagihan > 0
     )
     SELECT bi.uuid AS bill_item_uuid, b.uuid AS bill_uuid, sb.uuid AS service_bill_uuid, sb.type::text AS jenis_layanan,
            bi.category_code::text AS kategori_kode, bi.item_name, bi.qty, bi.price, bi.service_fee, NULLIF(bi.date_used, 0) AS tanggal_layanan,
            sb.service_code AS no_reg, l.induk_uuid, l.invoice_code, b.patient_uuid, l.tanggal_lunas, l.penjamin, kj.practitioner_uuid
       FROM lunas l
       JOIN bills b ON b.faskes_uuid = $1 AND b.deleted_at IS NULL AND (b.uuid = l.induk_uuid OR b.merge_with = l.induk_uuid)
       JOIN service_bill sb ON sb.bill_uuid = b.uuid AND sb.faskes_uuid = $1 AND sb.deleted_at IS NULL
       JOIN bill_item bi ON bi.service_bill_uuid = sb.uuid AND bi.faskes_uuid = $1 AND bi.deleted_at IS NULL
       LEFT JOIN LATERAL (
         SELECT x.practitioner_uuid FROM (
           SELECT r.uuid, r.no_reg, r.practitioner_uuid FROM rawat_jalans r WHERE r.faskes_uuid = $1 AND r.deleted_at IS NULL AND (r.uuid = sb.layanan_uuid OR r.no_reg = sb.service_code)
           UNION ALL
           SELECT r.uuid, r.no_reg, r.practitioner_uuid FROM rawat_inaps r WHERE r.faskes_uuid = $1 AND r.deleted_at IS NULL AND (r.uuid = sb.layanan_uuid OR r.no_reg = sb.service_code)
           UNION ALL
           SELECT r.uuid, r.no_reg, r.practitioner_uuid FROM instalasi_gawat_darurats r WHERE r.faskes_uuid = $1 AND r.deleted_at IS NULL AND (r.uuid = sb.layanan_uuid OR r.no_reg = sb.service_code)
         ) x WHERE x.practitioner_uuid IS NOT NULL ORDER BY (x.uuid = sb.layanan_uuid) DESC LIMIT 1
       ) kj ON true
      WHERE l.tanggal_lunas BETWEEN $2 AND $3
      ORDER BY l.tanggal_lunas, bi.uuid`,
    [f, awal, akhir],
    k,
  );
  return rows.map((r) => ({
    bill_item_uuid: r.bill_item_uuid,
    bill_uuid: r.bill_uuid,
    induk_uuid: r.induk_uuid,
    service_bill_uuid: r.service_bill_uuid,
    jenis_layanan: String(r.jenis_layanan ?? "").toUpperCase(),
    kategori: KATEGORI_ITEM[String(r.kategori_kode)] ?? "tindakan",
    nama_item: r.item_name,
    nilai: keSen(Number(r.qty || 0) * Number(r.price || 0) + Number(r.service_fee || 0)),
    tanggal_layanan: r.tanggal_layanan ? Number(r.tanggal_layanan) : null,
    tanggal_lunas: Number(r.tanggal_lunas),
    no_reg: r.no_reg,
    invoice_code: r.invoice_code,
    patient_uuid: r.patient_uuid,
    practitioner_uuid: r.practitioner_uuid ?? null,
    penjamin: !!r.penjamin,
  }));
};
