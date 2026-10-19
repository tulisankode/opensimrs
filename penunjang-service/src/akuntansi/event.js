import { awalHariWib, keSen, rapikanBaris } from "./bersama.js";

// Daftar jenis event akuntansi (sumber jurnal otomatis) & penyusun baris jurnalnya (fungsi murni, diuji di
// test/akuntansi.test.js). Setiap event menghasilkan baris berkomponen (mis. "pendapatan:RJ") yang dipetakan ke akun
// lewat akuntansi_pemetaan; baris tanpa aturan membuat event DITAHAN (tidak ada akun tebakan).
//
// Kunci idempotensi = "<jenis_event>:<uuid dokumen sumber>" — satu dokumen satu jurnal per jenis event. Data yang
// memengaruhi nilai jurnal di-hash; bila dokumen berubah setelah dijurnal, event ditandai "konflik" untuk rekonsiliasi
// (jurnal lama tidak diubah; perbaikan lewat jurnal koreksi).
//
// Menambah sumber baru (mis. jasa pelayanan dari Remunerasi STD-0032): daftarkan di JENIS_EVENT (komponen + label),
// tulis penyusun baris murni di sini, pengambil data di sumber.js (penarikan) ATAU panggil jurnalkanEvent() dari
// proses.js di dalam transaksi modul sumber (dorong), lalu tambahkan pemetaan bawaan di coa-bawaan.js.
export const JENIS_EVENT = {
  tagihan_final: {
    nama: "Tagihan Final (Pengakuan Pendapatan)",
    sumber: "Pembayaran › tagihan ditutup (bills.close_bill)",
    tersedia: true,
    komponen: {
      piutang_pasien: "Piutang pasien (debit sebesar grand total)",
      pendapatan: "Pendapatan layanan — per jenis layanan pendapatan:RJ/RI/IGD/LAB/FISIO/OTC; tanpa akhiran = fallback",
      pendapatan_administrasi: "Biaya administrasi tagihan",
      utang_ppn: "PPN tagihan",
      potongan_pendapatan: "Diskon/voucher (grand total < rincian)",
      pendapatan_lain: "Selisih lebih grand total terhadap rincian",
    },
  },
  pembayaran_kasir: {
    nama: "Pembayaran Kasir",
    sumber: "Pembayaran › riwayat pembayaran (payment_history)",
    tersedia: true,
    komponen: {
      kas: "Kas/bank penerimaan — per metode kas:CASH/DEBIT/DEBIT_KREDIT/TRANSFER/CREDIT; tanpa akhiran = fallback",
      piutang_pasien: "Pelunasan piutang pasien (kredit)",
      piutang_penjamin: "Pengalihan ke piutang penjamin (pembayaran jenis INSURANCE)",
    },
  },
  penerimaan_barang: {
    nama: "Penerimaan Barang Supplier",
    sumber: "Inventory › pembelian berstatus diterima",
    tersedia: true,
    komponen: {
      persediaan: "Persediaan — persediaan:obat/alkes/non_medis; tanpa akhiran = fallback",
      utang_supplier: "Utang usaha supplier",
    },
  },
  retur_supplier: {
    nama: "Retur Barang ke Supplier",
    sumber: "Inventory › retur supplier (item retur)",
    tersedia: true,
    komponen: { utang_supplier: "Pengurangan utang supplier", persediaan: "Pengurangan persediaan — persediaan:obat/alkes/non_medis" },
  },
  penggantian_retur: {
    nama: "Penggantian Barang Retur",
    sumber: "Inventory › retur supplier diterima dengan penggantian barang",
    tersedia: true,
    komponen: { persediaan: "Persediaan pengganti — persediaan:obat/alkes/non_medis", utang_supplier: "Utang supplier kembali diakui" },
  },
  pemakaian_stok: {
    nama: "Pemakaian & Pemusnahan Stok",
    sumber: "Inventory › pengeluaran unit (pemakaian unit / pemusnahan barang)",
    tersedia: true,
    komponen: {
      beban_pemakaian: "Beban pemakaian obat & BHP (pemakaian unit)",
      beban_pemusnahan: "Beban kerugian persediaan (pemusnahan rusak/kedaluwarsa)",
      persediaan: "Pengurangan persediaan — persediaan:obat/alkes/non_medis",
    },
  },
  pelunasan_klaim: {
    nama: "Pelunasan Klaim Penjamin",
    sumber: "-",
    tersedia: false,
    alasan: "Belum ada data klaim/pelunasan penjamin (BPJS/INA-CBG/asuransi) di database bersama. Catat pelunasan & selisih klaim lewat jurnal manual (D Bank, D Selisih Klaim Penjamin, K Piutang Penjamin).",
    komponen: {},
  },
  pembayaran_supplier: {
    nama: "Pembayaran Utang Supplier",
    sumber: "-",
    tersedia: false,
    alasan: "Belum ada data pembayaran utang supplier di database bersama. Catat lewat jurnal manual (D Utang Usaha Supplier, K Bank) dengan supplier terisi agar aging utang benar.",
    komponen: {},
  },
  jaspel: {
    nama: "Jasa Pelayanan (Remunerasi)",
    sumber: "Remunerasi (STD-0032)",
    tersedia: false,
    alasan: "Disediakan modul Remunerasi (STD-0032).",
    komponen: { beban_jaspel: "Beban jasa pelayanan", utang_jaspel: "Utang jasa pelayanan" },
  },
};
export const JENIS_EVENT_TERSEDIA = Object.keys(JENIS_EVENT).filter((k) => JENIS_EVENT[k].tersedia);

// Komponen sah untuk jenis event: nama dasar terdaftar, opsional akhiran ":<KODE>".
export const komponenSah = (jenisEvent, komponen) => {
  const def = JENIS_EVENT[jenisEvent];
  if (!def || typeof komponen !== "string") return false;
  const m = /^([a-z_]+)(?::([A-Za-z0-9_-]{1,40}))?$/.exec(komponen);
  return !!m && Object.prototype.hasOwnProperty.call(def.komponen, m[1]);
};

const angka = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v));
// Epoch detik; nilai milidetik (data lama) dinormalkan.
export const epochDetik = (v) => {
  const n = angka(v);
  return n > 1e11 ? Math.floor(n / 1000) : Math.floor(n);
};
const D = (komponen, sen, dimensi = {}) => ({ komponen, debit: sen, kredit: 0, ...dimensi });
const K = (komponen, sen, dimensi = {}) => ({ komponen, debit: 0, kredit: sen, ...dimensi });
const lewati = (ev, alasan) => ({ ...ev, lewati: alasan, baris: [] });

// Komponen persediaan dari kategori/jenis item inventory.
export const jenisPersediaan = (kategori, jenisItem) => {
  if (String(kategori ?? "").toLowerCase() === "non-medis") return "persediaan:non_medis";
  const j = String(jenisItem ?? "").toLowerCase();
  return j === "obat" || j === "alkes" ? `persediaan:${j}` : "persediaan";
};

// Tagihan final. `rincian`: [{ type, nilai }] jumlah item per jenis layanan. Baris: D piutang pasien = grand total;
// K pendapatan per jenis layanan, K PPN, K administrasi; selisih (diskon/voucher/pembulatan) → potongan pendapatan (D)
// atau pendapatan lain (K) sehingga jurnal selalu seimbang dan sama dengan grand total.
export const susunTagihan = (bill, rincian = []) => {
  const tanggal = awalHariWib(epochDetik(bill.tanggal_layanan || bill.created_at));
  const total = keSen(angka(bill.grand_total));
  const ppn = keSen(angka(bill.ppn));
  const admin = keSen(angka(bill.admin_fee));
  const per = rincian.map((r) => ({ type: String(r.type || "LAINNYA").toUpperCase(), sen: keSen(angka(r.nilai)) })).filter((r) => r.sen !== 0);
  const ev = {
    jenis_event: "tagihan_final",
    kunci: `tagihan_final:${bill.uuid}`,
    sumber_tabel: "bills",
    sumber_uuid: bill.uuid,
    sumber_nomor: bill.invoice_code || bill.bill_code || null,
    tanggal,
    nilai: total,
    uraian: `Pendapatan tagihan ${bill.invoice_code || bill.bill_code || bill.uuid}`,
    data: { grand_total: total, ppn, admin, rincian: per, tanggal },
  };
  if (total <= 0) return lewati(ev, "Grand total tagihan nol");
  const baris = [D("piutang_pasien", total), ...per.map((r) => K(`pendapatan:${r.type}`, r.sen)), K("utang_ppn", ppn), K("pendapatan_administrasi", admin)];
  const selisih = total - (per.reduce((t, r) => t + r.sen, 0) + ppn + admin);
  if (selisih < 0) baris.push(D("potongan_pendapatan", -selisih));
  if (selisih > 0) baris.push(K("pendapatan_lain", selisih));
  return { ...ev, baris: rapikanBaris(baris) };
};

// Pembayaran kasir. Nominal yang dijurnal = jumlah dibayar dibatasi sisa tagihan (tagihan + tagihan anak gabungan −
// pembayaran sebelumnya) karena payment_history mencatat uang yang diserahkan termasuk kembalian. INSURANCE = pengalihan
// piutang pasien ke piutang penjamin (bukan kas masuk).
export const susunPembayaran = (ph, penjamin = null) => {
  const tanggal = awalHariWib(epochDetik(ph.created_at));
  const dibayar = keSen(angka(ph.amount));
  const sisa = Math.max(keSen(angka(ph.total_tagihan)) - keSen(angka(ph.dibayar_sebelumnya)), 0);
  const nominal = Math.max(Math.min(dibayar, sisa), 0);
  const jenis = String(ph.payment_type ?? "CASH").toUpperCase();
  const metode = String(ph.payment_method || "CASH").toUpperCase();
  const ev = {
    jenis_event: "pembayaran_kasir",
    kunci: `pembayaran_kasir:${ph.uuid}`,
    sumber_tabel: "payment_history",
    sumber_uuid: ph.uuid,
    sumber_nomor: ph.receipt_number || ph.invoice_code || null,
    tanggal,
    nilai: nominal,
    uraian: `${jenis === "INSURANCE" ? "Pengalihan ke piutang penjamin" : `Penerimaan kasir (${metode})`} tagihan ${ph.invoice_code ?? ""}`.trim(),
    data: { dibayar, nominal, jenis, metode, bill: ph.bill_uuid, status: ph.status !== false, penjamin: penjamin?.uuid ?? null, tanggal },
  };
  if (ph.status === false) return lewati(ev, "Pembayaran berstatus batal");
  if (nominal <= 0) return lewati(ev, "Tidak ada sisa tagihan yang dilunasi (kembalian/lebih bayar)");
  const debit = jenis === "INSURANCE" ? D("piutang_penjamin", nominal, { penjamin_uuid: penjamin?.uuid ?? null }) : D(`kas:${metode}`, nominal);
  return { ...ev, baris: [debit, K("piutang_pasien", nominal)] };
};

// Penerimaan barang supplier: D persediaan / K utang supplier sebesar grand total pembelian.
export const susunPenerimaan = (po) => {
  const tanggal = awalHariWib(epochDetik(po.tanggal));
  const total = keSen(angka(po.grand_total));
  const sup = { supplier_uuid: po.supplier_uuid ?? null };
  const ev = {
    jenis_event: "penerimaan_barang",
    kunci: `penerimaan_barang:${po.uuid}`,
    sumber_tabel: "pembelian_Barang_supplier",
    sumber_uuid: po.uuid,
    sumber_nomor: po.no_faktur ? `${po.no_po} / ${po.no_faktur}` : po.no_po,
    tanggal,
    nilai: total,
    uraian: `Penerimaan barang ${po.no_po}${po.nama_supplier ? ` dari ${po.nama_supplier}` : ""}`,
    data: { total, supplier: sup.supplier_uuid, persediaan: jenisPersediaan(po.kategori_item, po.jenis_item), tanggal },
  };
  if (total <= 0) return lewati(ev, "Nilai pembelian nol");
  return { ...ev, baris: [D(jenisPersediaan(po.kategori_item, po.jenis_item), total), K("utang_supplier", total, sup)] };
};

// Retur ke supplier (item retur) dan penggantian barang retur (item replacement) — dua event dari satu dokumen retur.
export const susunRetur = (r) => {
  const tanggal = awalHariWib(epochDetik(r.tanggal_retur));
  const nilai = keSen(angka(r.nilai_retur));
  const sup = { supplier_uuid: r.supplier_uuid ?? null };
  const persediaan = jenisPersediaan(r.kategori_item, r.jenis_item);
  const ev = {
    jenis_event: "retur_supplier",
    kunci: `retur_supplier:${r.uuid}`,
    sumber_tabel: "retur_supplier",
    sumber_uuid: r.uuid,
    sumber_nomor: r.no_retur_supplier,
    tanggal,
    nilai,
    uraian: `Retur barang ${r.no_retur_supplier}${r.nama_supplier ? ` ke ${r.nama_supplier}` : ""}`,
    data: { nilai, supplier: sup.supplier_uuid, persediaan, tanggal },
  };
  if (nilai <= 0) return lewati(ev, "Nilai retur nol");
  return { ...ev, baris: [D("utang_supplier", nilai, sup), K(persediaan, nilai)] };
};
export const susunPenggantian = (r) => {
  const tanggal = awalHariWib(epochDetik(r.tanggal_penggantian || r.tanggal_retur));
  const nilai = keSen(angka(r.nilai_pengganti));
  const sup = { supplier_uuid: r.supplier_uuid ?? null };
  const persediaan = jenisPersediaan(r.kategori_item, r.jenis_item);
  const ev = {
    jenis_event: "penggantian_retur",
    kunci: `penggantian_retur:${r.uuid}`,
    sumber_tabel: "retur_supplier",
    sumber_uuid: r.uuid,
    sumber_nomor: r.no_retur_supplier,
    tanggal,
    nilai,
    uraian: `Penggantian barang retur ${r.no_retur_supplier}`,
    data: { nilai, jenis: r.jenis_penggantian, supplier: sup.supplier_uuid, persediaan, tanggal },
  };
  if (r.jenis_penggantian === "uang")
    return lewati(ev, "Penggantian berupa uang: catat penerimaan kas lewat jurnal manual sesuai status pelunasan utang supplier");
  if (nilai <= 0) return lewati(ev, "Nilai barang pengganti nol");
  return { ...ev, baris: [D(persediaan, nilai), K("utang_supplier", nilai, sup)] };
};

// Pengeluaran unit inventory: pemakaian unit → beban pemakaian; pemusnahan → beban kerugian persediaan; pengeluaran
// tanpa permintaan = mutasi antarlokasi (persediaan tetap) → dilewati.
export const susunPengeluaran = (u) => {
  const tanggal = awalHariWib(epochDetik(u.tanggal_pengeluaran));
  const nilai = keSen(angka(u.total_harga));
  const persediaan = jenisPersediaan(u.kategori_item, u.jenis_item);
  const ev = {
    jenis_event: "pemakaian_stok",
    kunci: `pemakaian_stok:${u.uuid}`,
    sumber_tabel: "pengeluaran_unit",
    sumber_uuid: u.uuid,
    sumber_nomor: u.no_pengeluaran,
    tanggal,
    nilai,
    uraian: `${u.jenis_pengeluaran === "pemusnahan barang" ? "Pemusnahan" : "Pemakaian"} stok ${u.no_pengeluaran}`,
    data: { nilai, jenis: u.jenis_pengeluaran, persediaan, tanggal },
  };
  if (u.jenis_pengeluaran === "pengeluaran tanpa permintaan") return lewati(ev, "Mutasi antarlokasi stok (nilai persediaan tetap)");
  if (nilai <= 0) return lewati(ev, "Nilai pengeluaran nol");
  const beban = u.jenis_pengeluaran === "pemusnahan barang" ? "beban_pemusnahan" : "beban_pemakaian";
  return { ...ev, baris: [D(beban, nilai), K(persediaan, nilai)] };
};
