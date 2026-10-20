import { query } from "../db.js";
import { susunPembayaran, susunPenerimaan, susunPengeluaran, susunPenggantian, susunRetur, susunTagihan } from "./event.js";

// Pengambil dokumen sumber dari database bersama (BACA SAJA; tabel modul Pembayaran & Inventory tidak diubah) untuk satu
// faskes dan rentang [awal, akhir] (epoch detik, satu periode). Setiap fungsi mengembalikan event tersusun (event.js);
// event yang tanggal transaksinya di luar rentang dibuang oleh pemanggil.

// Tagihan final: ditutup kasir (close_bill) atau tagihan anak gabungan keluarga yang induknya sudah ditutup. Tanggal
// pengakuan = tanggal layanan terakhir pada tagihan (stabil setelah ditutup; tagihan tidak lagi menerima item).
const tagihanFinal = async (f, awal, akhir) => {
  const bills = await query(
    `SELECT * FROM (
       SELECT b.uuid, b.invoice_code, b.bill_code, b.grand_total, b.ppn, b.admin_fee, b.created_at,
              COALESCE((SELECT MAX(NULLIF(bi.date_used, 0)) FROM bill_item bi JOIN service_bill sb ON sb.uuid = bi.service_bill_uuid
                         WHERE sb.bill_uuid = b.uuid AND sb.deleted_at IS NULL AND bi.deleted_at IS NULL), b.created_at) AS tanggal_layanan
         FROM bills b LEFT JOIN bills induk ON induk.uuid = b.merge_with AND induk.faskes_uuid = b.faskes_uuid
        WHERE b.faskes_uuid = $1 AND b.deleted_at IS NULL AND (b.close_bill = true OR induk.close_bill = true)
     ) x WHERE x.tanggal_layanan BETWEEN $2 AND $3
     ORDER BY x.tanggal_layanan, x.uuid`,
    [f, awal, akhir],
  );
  if (!bills.length) return [];
  const rincian = await query(
    `SELECT sb.bill_uuid, sb.type::text AS type, SUM(bi.qty * bi.price + COALESCE(bi.service_fee, 0)) AS nilai
       FROM service_bill sb JOIN bill_item bi ON bi.service_bill_uuid = sb.uuid AND bi.deleted_at IS NULL
      WHERE sb.faskes_uuid = $1 AND sb.deleted_at IS NULL AND sb.bill_uuid = ANY($2::varchar[])
      GROUP BY 1, 2`,
    [f, bills.map((b) => b.uuid)],
  );
  return bills.map((b) => susunTagihan(b, rincian.filter((r) => r.bill_uuid === b.uuid)));
};

// Penjamin tagihan: layanan bertanggungan (service_bill.with_insurance) → service_code = No. Registrasi kunjungan →
// insurance_admissions → insurance_accounts.code → penjamin faskes (pola umum/kunjungan.js#penjaminKunjungan).
const penjaminTagihan = async (f, billUuids) => {
  if (!billUuids.length) return new Map();
  const rows = await query(
    `SELECT DISTINCT ON (sb.bill_uuid) sb.bill_uuid, pj.uuid, pj.name AS nama
       FROM service_bill sb
       JOIN insurance_admissions ia ON ia.no_reg = sb.service_code AND ia.faskes_uuid = sb.faskes_uuid AND ia.deleted_at IS NULL
       JOIN insurance_accounts acc ON acc.uuid = ia.insurance_account_uuid AND acc.faskes_uuid = ia.faskes_uuid AND acc.deleted_at IS NULL
       JOIN penjamin pj ON pj.faskes_uuid = ia.faskes_uuid AND pj.code = acc.code AND pj.deleted_at IS NULL
      WHERE sb.faskes_uuid = $1 AND sb.deleted_at IS NULL AND sb.bill_uuid = ANY($2::varchar[])
      ORDER BY sb.bill_uuid, sb.with_insurance DESC, ia.status DESC, ia.created_at DESC`,
    [f, billUuids],
  );
  return new Map(rows.map((r) => [r.bill_uuid, { uuid: r.uuid, nama: r.nama }]));
};

// Pembayaran kasir (payment_history) beserta total tagihan keluarga (induk + anak gabungan) dan pembayaran sebelumnya.
const pembayaranKasir = async (f, awal, akhir) => {
  const rows = await query(
    `SELECT ph.uuid, ph.bill_uuid, ph.amount, ph.payment_type::text AS payment_type, ph.payment_method::text AS payment_method,
            ph.receipt_number, ph.created_at, ph.status, b.invoice_code,
            COALESCE(b.grand_total, 0) + COALESCE((SELECT SUM(c.grand_total) FROM bills c WHERE c.merge_with = b.uuid AND c.faskes_uuid = b.faskes_uuid AND c.deleted_at IS NULL), 0) AS total_tagihan,
            COALESCE((SELECT SUM(p2.amount) FROM payment_history p2
                       WHERE p2.bill_uuid = ph.bill_uuid AND p2.faskes_uuid = ph.faskes_uuid AND p2.deleted_at IS NULL AND p2.status = true
                         AND (p2.created_at < ph.created_at OR (p2.created_at = ph.created_at AND p2.id < ph.id))), 0) AS dibayar_sebelumnya
       FROM payment_history ph JOIN bills b ON b.uuid = ph.bill_uuid AND b.faskes_uuid = ph.faskes_uuid
      WHERE ph.faskes_uuid = $1 AND ph.deleted_at IS NULL AND ph.created_at BETWEEN $2 AND $3
      ORDER BY ph.created_at, ph.id`,
    [f, awal, akhir],
  );
  const asuransi = rows.filter((r) => String(r.payment_type).toUpperCase() === "INSURANCE").map((r) => r.bill_uuid);
  const penjamin = await penjaminTagihan(f, [...new Set(asuransi)]);
  return rows.map((r) => susunPembayaran(r, penjamin.get(r.bill_uuid) ?? null));
};

const penerimaanBarang = async (f, awal, akhir) => {
  const rows = await query(
    `SELECT * FROM (
       SELECT p.uuid, p.no_po, p.no_faktur, p.supplier_uuid, s.name AS nama_supplier, p.kategori_item::text AS kategori_item,
              p.jenis_item::text AS jenis_item, p.grand_total,
              CASE WHEN COALESCE(p.tanggal_penerimaan, p.tanggal_faktur, p.tanggal_pembelian) > 100000000000
                   THEN COALESCE(p.tanggal_penerimaan, p.tanggal_faktur, p.tanggal_pembelian) / 1000
                   ELSE COALESCE(p.tanggal_penerimaan, p.tanggal_faktur, p.tanggal_pembelian) END AS tanggal
         FROM "pembelian_Barang_supplier" p LEFT JOIN master_supplier s ON s.uuid = p.supplier_uuid AND s.faskes_uuid = p.faskes_uuid
        WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.status = 'diterima'
     ) x WHERE x.tanggal BETWEEN $2 AND $3 ORDER BY x.tanggal, x.uuid`,
    [f, awal, akhir],
  );
  return rows.map(susunPenerimaan);
};

const returSupplier = async (f, awal, akhir) => {
  const rows = await query(
    `SELECT r.uuid, r.no_retur_supplier, r.supplier_uuid, s.name AS nama_supplier, r.tanggal_retur, r.tanggal_penggantian,
            r.status::text AS status, r.jenis_penggantian::text AS jenis_penggantian, p.kategori_item::text AS kategori_item, p.jenis_item::text AS jenis_item,
            COALESCE((SELECT SUM(i.qty_retur * i.harga_satuan) FROM retur_supplier_item i
                       WHERE i.retur_supplier_uuid = r.uuid AND i.deleted_at IS NULL AND i.item_type = 'retur'), 0) AS nilai_retur,
            COALESCE((SELECT SUM(i.qty_retur * i.harga_satuan) FROM retur_supplier_item i
                       WHERE i.retur_supplier_uuid = r.uuid AND i.deleted_at IS NULL AND i.item_type = 'replacement'), 0) AS nilai_pengganti
       FROM retur_supplier r
       LEFT JOIN "pembelian_Barang_supplier" p ON p.uuid = r.pembelian_supplier_uuid AND p.faskes_uuid = r.faskes_uuid
       LEFT JOIN master_supplier s ON s.uuid = r.supplier_uuid AND s.faskes_uuid = r.faskes_uuid
      WHERE r.faskes_uuid = $1 AND r.deleted_at IS NULL
        AND (r.tanggal_retur BETWEEN $2 AND $3 OR (r.status = 'terima' AND r.tanggal_penggantian BETWEEN $2 AND $3))
      ORDER BY r.tanggal_retur, r.uuid`,
    [f, awal, akhir],
  );
  return rows;
};

const pengeluaranUnit = async (f, awal, akhir) => {
  const rows = await query(
    `SELECT u.uuid, u.no_pengeluaran, u.jenis_pengeluaran::text AS jenis_pengeluaran, u.kategori_item::text AS kategori_item,
            u.jenis_item, u.total_harga, u.tanggal_pengeluaran
       FROM pengeluaran_unit u
      WHERE u.faskes_uuid = $1 AND u.deleted_at IS NULL AND u.tanggal_pengeluaran BETWEEN $2 AND $3
      ORDER BY u.tanggal_pengeluaran, u.uuid`,
    [f, awal, akhir],
  );
  return rows.map(susunPengeluaran);
};

// Pengambil per jenis event (penarikan). Retur menghasilkan dua jenis event dari satu kueri.
export const AMBIL_SUMBER = {
  tagihan_final: tagihanFinal,
  pembayaran_kasir: pembayaranKasir,
  penerimaan_barang: penerimaanBarang,
  retur_supplier: async (f, awal, akhir) => (await returSupplier(f, awal, akhir)).map(susunRetur),
  penggantian_retur: async (f, awal, akhir) => (await returSupplier(f, awal, akhir)).filter((r) => r.status === "terima").map(susunPenggantian),
  pemakaian_stok: pengeluaranUnit,
};

// Semua event dalam rentang untuk jenis terpilih (tanggal transaksi di dalam rentang).
export const ambilEvent = async (f, awal, akhir, jenis = Object.keys(AMBIL_SUMBER)) => {
  const hasil = [];
  for (const j of jenis) {
    if (!AMBIL_SUMBER[j]) continue;
    for (const ev of await AMBIL_SUMBER[j](f, awal, akhir)) if (ev.tanggal >= awal && ev.tanggal <= akhir) hasil.push(ev);
  }
  return hasil;
};
