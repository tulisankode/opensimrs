import { test } from "node:test";
import assert from "node:assert/strict";
import {
  balikBaris,
  cekBolehSetujui,
  dariSen,
  hashData,
  hitungAging,
  hitungArusKasLangsung,
  hitungArusKasTidakLangsung,
  hitungLabaRugi,
  hitungNeraca,
  keSen,
  KLASIFIKASI_KELOMPOK,
  nominalWajib,
  pastikanSeimbang,
  periodeDari,
  petakanBaris,
  pilihAturan,
  rentangPeriode,
  tanggalWajib,
  tingkatWajib,
  validasiBarisManual,
} from "../src/akuntansi/bersama.js";
import { JENIS_EVENT, komponenSah, susunPembayaran, susunPenerimaan, susunPengeluaran, susunPenggantian, susunRetur, susunTagihan } from "../src/akuntansi/event.js";
import { COA_BAWAAN, PEMETAAN_BAWAAN } from "../src/akuntansi/coa-bawaan.js";
import { jurnalkanEvent } from "../src/akuntansi/proses.js";
import { pastikanPeriodeTerbuka } from "../src/akuntansi/dasar.js";
import { akuntansiPermission, mapPermission } from "../../auth-service/src/helpers/permission-list.js";
import katalog from "../../database/data/katalog-modul.json" with { type: "json" };

// Epoch detik untuk tanggal/jam WIB (UTC+7).
const wib = (y, m, d, jam = 0, menit = 0) => Date.UTC(y, m - 1, d, jam - 7, menit) / 1000;
const total = (baris) => baris.reduce((t, b) => ({ d: t.d + b.debit, k: t.k + b.kredit }), { d: 0, k: 0 });
const seimbang = (baris) => {
  const t = total(baris);
  assert.equal(t.d, t.k, `debit ${t.d} ≠ kredit ${t.k}`);
  return t.d;
};

test("uang dalam sen: teks/angka → sen tanpa galat floating point, dan kembali ke teks 2 desimal", () => {
  assert.equal(keSen("350000.00"), 35000000);
  assert.equal(keSen("0.1"), 10);
  assert.equal(keSen(0.1 + 0.2), 30);
  assert.equal(keSen("1234,5"), 123450);
  assert.equal(dariSen(35000000), "350000.00");
  assert.equal(dariSen(-5), "-0.05");
  assert.equal(nominalWajib("12.34", "x"), 1234);
  assert.throws(() => nominalWajib("12.345", "x"), (e) => e.status === 400);
  assert.throws(() => nominalWajib("-1", "x"), (e) => e.status === 400);
  assert.throws(() => nominalWajib("abc", "x"), (e) => e.status === 400);
});

test("periode & tanggal per hari Asia/Jakarta: 31 Okt 23.30 WIB masih Oktober, 1 Nov 00.10 WIB sudah November", () => {
  assert.deepEqual(periodeDari(wib(2026, 10, 31, 23, 30)), { tahun: 2026, bulan: 10 });
  assert.deepEqual(periodeDari(wib(2026, 11, 1, 0, 10)), { tahun: 2026, bulan: 11 });
  const r = rentangPeriode(2026, 10);
  assert.equal(r.awal, wib(2026, 10, 1));
  assert.equal(r.akhir, wib(2026, 11, 1) - 1);
  assert.equal(tanggalWajib(wib(2026, 10, 5, 15)), wib(2026, 10, 5));
  assert.throws(() => tanggalWajib(""), (e) => e.status === 400);
});

test("keseimbangan: jurnal D ≠ K ditolak 400 dengan selisih; baris wajib tepat satu sisi", () => {
  assert.equal(pastikanSeimbang([{ debit: 100, kredit: 0 }, { debit: 0, kredit: 100 }]).debit, 100);
  assert.throws(() => pastikanSeimbang([{ debit: 100, kredit: 0 }, { debit: 0, kredit: 90 }]), (e) => e.status === 400 && /selisih 0\.10/.test(e.message));
  assert.throws(() => pastikanSeimbang([{ debit: 100, kredit: 100 }, { debit: 0, kredit: 0 }]), (e) => e.status === 400);
  assert.throws(() => pastikanSeimbang([{ debit: 100, kredit: 0 }]), (e) => e.status === 400);
  const ok = validasiBarisManual([
    { akun_uuid: "a1", debit: "350000", kredit: 0 },
    { akun_uuid: "a2", debit: 0, kredit: "350000.00", uraian: " Pendapatan " },
  ]);
  assert.equal(ok[0].debit, 35000000);
  assert.equal(ok[1].uraian, "Pendapatan");
  assert.throws(
    () => validasiBarisManual([{ akun_uuid: "a1", debit: 100 }, { akun_uuid: "a2", kredit: 99.99 }]),
    (e) => e.status === 400 && /tidak seimbang/.test(e.message) && /selisih 0\.01/.test(e.message),
  );
  assert.throws(() => validasiBarisManual([{ akun_uuid: "a1", debit: 1, kredit: 1 }, { akun_uuid: "a2", kredit: 1 }]), (e) => e.status === 400);
  assert.throws(() => validasiBarisManual([{ debit: 1 }, { akun_uuid: "a2", kredit: 1 }]), (e) => e.status === 400 && /akun_uuid/.test(e.message));
  const balik = balikBaris(ok);
  assert.equal(balik[0].kredit, 35000000);
  assert.equal(balik[0].debit, 0);
});

test("pemetaan: aturan spesifik didahulukan, fallback ke komponen dasar, berlaku_mulai terbaru ≤ tanggal transaksi", () => {
  const aturan = [
    { komponen: "kas", akun_uuid: "bank", berlaku_mulai: wib(2000, 1, 1) },
    { komponen: "kas:CASH", akun_uuid: "kas-lama", berlaku_mulai: wib(2000, 1, 1) },
    { komponen: "kas:CASH", akun_uuid: "kas-baru", berlaku_mulai: wib(2026, 10, 15) },
    { komponen: "kas:CASH", akun_uuid: "nonaktif", berlaku_mulai: wib(2026, 10, 20), aktif: false },
  ];
  assert.equal(pilihAturan(aturan, "kas:CASH", wib(2026, 10, 14)).akun_uuid, "kas-lama");
  assert.equal(pilihAturan(aturan, "kas:CASH", wib(2026, 10, 25)).akun_uuid, "kas-baru");
  assert.equal(pilihAturan(aturan, "kas:TRANSFER", wib(2026, 10, 25)).akun_uuid, "bank");
  assert.equal(pilihAturan(aturan, "piutang_pasien", wib(2026, 10, 25)), null);
  const { baris, kurang } = petakanBaris([{ komponen: "kas:CASH", debit: 1, kredit: 0 }, { komponen: "piutang_pasien", debit: 0, kredit: 1 }], aturan, wib(2026, 10, 25));
  assert.equal(baris[0].akun_uuid, "kas-baru");
  assert.equal(baris[1].akun_uuid, null);
  assert.deepEqual(kurang, ["piutang_pasien"]);
  assert.ok(komponenSah("tagihan_final", "pendapatan:RJ"));
  assert.ok(komponenSah("pembayaran_kasir", "kas"));
  assert.ok(!komponenSah("pembayaran_kasir", "pendapatan:RJ"));
  assert.ok(!komponenSah("tagihan_final", "pendapatan:RJ; DROP"));
  assert.ok(!komponenSah("tidak_ada", "kas"));
});

test("tagihan final: piutang = grand total, pendapatan per jenis layanan, PPN & administrasi, selisih diskon → potongan", () => {
  const ev = susunTagihan(
    { uuid: "b1", invoice_code: "INV-1", grand_total: 1111500, ppn: 101000, admin_fee: 500, tanggal_layanan: String(wib(2026, 10, 5, 10)) },
    [
      { type: "RJ", nilai: 350000 },
      { type: "LAB", nilai: 660000 },
    ],
  );
  assert.equal(ev.kunci, "tagihan_final:b1");
  assert.equal(ev.tanggal, wib(2026, 10, 5));
  assert.equal(seimbang(ev.baris), 111150000);
  assert.equal(ev.baris.length, 5, "tanpa baris selisih bila rincian cocok");
  const cari = (k) => ev.baris.find((b) => b.komponen === k);
  assert.equal(cari("piutang_pasien").debit, 111150000);
  assert.equal(cari("pendapatan:RJ").kredit, 35000000);
  assert.equal(cari("pendapatan:LAB").kredit, 66000000);
  assert.equal(cari("utang_ppn").kredit, 10100000);
  assert.equal(cari("pendapatan_administrasi").kredit, 50000);
  // Diskon Rp 10.500 → grand total lebih kecil dari rincian → baris potongan pendapatan (debit).
  const diskon = susunTagihan({ uuid: "b2", grand_total: 1100000, ppn: 101000, admin_fee: 500, created_at: wib(2026, 10, 6) }, [{ type: "RJ", nilai: 1010000 }]);
  seimbang(diskon.baris);
  assert.equal(diskon.baris.find((b) => b.komponen === "potongan_pendapatan").debit, 1150000);
  // Contoh permintaan: tagihan RJ Rp 350.000 tanpa PPN/administrasi.
  const rj = susunTagihan({ uuid: "b3", grand_total: 350000, ppn: 0, admin_fee: 0, created_at: wib(2026, 10, 7) }, [{ type: "RJ", nilai: 350000 }]);
  assert.deepEqual(rj.baris.map((b) => [b.komponen, b.debit, b.kredit]), [["piutang_pasien", 35000000, 0], ["pendapatan:RJ", 0, 35000000]]);
  assert.equal(susunTagihan({ uuid: "b4", grand_total: 0, created_at: wib(2026, 10, 7) }).lewati, "Grand total tagihan nol");
});

test("pembayaran kasir: kas per metode, kembalian tidak dijurnal, INSURANCE dialihkan ke piutang penjamin", () => {
  const tunai = susunPembayaran({ uuid: "p1", bill_uuid: "b3", amount: 400000, payment_type: "CASH", payment_method: "CASH", total_tagihan: 350000, dibayar_sebelumnya: 0, created_at: wib(2026, 10, 7, 9) });
  assert.deepEqual(tunai.baris.map((b) => [b.komponen, b.debit, b.kredit]), [["kas:CASH", 35000000, 0], ["piutang_pasien", 0, 35000000]]);
  const cicil = susunPembayaran({ uuid: "p2", amount: 100000, payment_type: "CASH", payment_method: "TRANSFER", total_tagihan: 350000, dibayar_sebelumnya: 300000, created_at: wib(2026, 10, 8) });
  assert.equal(cicil.nilai, 5000000);
  assert.equal(cicil.baris[0].komponen, "kas:TRANSFER");
  const lebih = susunPembayaran({ uuid: "p3", amount: 50000, payment_type: "CASH", total_tagihan: 350000, dibayar_sebelumnya: 350000, created_at: wib(2026, 10, 8) });
  assert.match(lebih.lewati, /kembalian/);
  const batal = susunPembayaran({ uuid: "p4", amount: 50000, status: false, total_tagihan: 50000, dibayar_sebelumnya: 0, created_at: wib(2026, 10, 8) });
  assert.match(batal.lewati, /batal/);
  const bpjs = susunPembayaran({ uuid: "p5", amount: 900000, payment_type: "INSURANCE", payment_method: "CREDIT", total_tagihan: 900000, dibayar_sebelumnya: 0, created_at: wib(2026, 10, 9) }, { uuid: "pj-bpjs" });
  assert.deepEqual(bpjs.baris.map((b) => [b.komponen, b.debit, b.kredit, b.penjamin_uuid ?? null]), [["piutang_penjamin", 90000000, 0, "pj-bpjs"], ["piutang_pasien", 0, 90000000, null]]);
});

test("penerimaan, retur, penggantian barang, pemakaian & pemusnahan stok seimbang; mutasi antarlokasi dilewati", () => {
  const po = susunPenerimaan({ uuid: "po1", no_po: "PO-1", no_faktur: "F-9", supplier_uuid: "s1", kategori_item: "medis", jenis_item: "obat", grand_total: 1250000.5, tanggal: wib(2026, 10, 3, 14) });
  assert.equal(seimbang(po.baris), 125000050);
  assert.deepEqual(po.baris.map((b) => [b.komponen, b.supplier_uuid ?? null]), [["persediaan:obat", null], ["utang_supplier", "s1"]]);
  const r = { uuid: "r1", no_retur_supplier: "RT-1", supplier_uuid: "s1", kategori_item: "medis", jenis_item: "alkes", tanggal_retur: wib(2026, 10, 10), nilai_retur: 200000, nilai_pengganti: 200000, jenis_penggantian: "barang", tanggal_penggantian: wib(2026, 10, 20) };
  assert.deepEqual(susunRetur(r).baris.map((b) => [b.komponen, b.debit, b.kredit]), [["utang_supplier", 20000000, 0], ["persediaan:alkes", 0, 20000000]]);
  const ganti = susunPenggantian(r);
  assert.equal(ganti.tanggal, wib(2026, 10, 20));
  assert.equal(ganti.baris[0].komponen, "persediaan:alkes");
  assert.match(susunPenggantian({ ...r, jenis_penggantian: "uang" }).lewati, /uang/);
  const pakai = susunPengeluaran({ uuid: "u1", no_pengeluaran: "PGL-1", jenis_pengeluaran: "pemakaian unit", kategori_item: "non-medis", total_harga: 75000, tanggal_pengeluaran: wib(2026, 10, 11) });
  assert.deepEqual(pakai.baris.map((b) => b.komponen), ["beban_pemakaian", "persediaan:non_medis"]);
  assert.equal(susunPengeluaran({ uuid: "u2", jenis_pengeluaran: "pemusnahan barang", jenis_item: "obat", total_harga: 1000, tanggal_pengeluaran: wib(2026, 10, 11) }).baris[0].komponen, "beban_pemusnahan");
  assert.match(susunPengeluaran({ uuid: "u3", jenis_pengeluaran: "pengeluaran tanpa permintaan", total_harga: 1000, tanggal_pengeluaran: wib(2026, 10, 11) }).lewati, /antarlokasi/);
});

test("hash data event stabil terhadap urutan kunci (dasar idempotensi), berubah bila nilai berubah", () => {
  assert.equal(hashData({ a: 1, b: { c: 2, d: 3 } }), hashData({ b: { d: 3, c: 2 }, a: 1 }));
  assert.notEqual(hashData({ a: 1 }), hashData({ a: 2 }));
  const ev1 = susunTagihan({ uuid: "b1", grand_total: 1000, created_at: wib(2026, 10, 1) }, [{ type: "RJ", nilai: 1000 }]);
  const ev2 = susunTagihan({ uuid: "b1", grand_total: 1000, created_at: wib(2026, 10, 1) }, [{ type: "RJ", nilai: 1000 }]);
  assert.equal(hashData(ev1.data), hashData(ev2.data));
});

test("persetujuan berjenjang: pembuat ≠ penyetuju, penyetuju tingkat 2 berbeda, ambang menentukan jumlah tingkat", () => {
  assert.equal(tingkatWajib(4999999999, "50000000.00"), 1);
  assert.equal(tingkatWajib(5000000000, "50000000.00"), 2);
  assert.equal(tingkatWajib(9e12, null), 1);
  const j = { status: "menunggu", dibuat_oleh: "akuntan1", tingkat_disetujui: 0, tingkat_wajib: 2 };
  assert.throws(() => cekBolehSetujui(j, "AKUNTAN1"), (e) => e.status === 409 && /Pembuat/.test(e.message));
  assert.equal(cekBolehSetujui(j, "kabag"), 1);
  assert.throws(() => cekBolehSetujui({ ...j, tingkat_disetujui: 1 }, "kabag", ["kabag"]), (e) => e.status === 409 && /berbeda/.test(e.message));
  assert.equal(cekBolehSetujui({ ...j, tingkat_disetujui: 1 }, "direktur", ["kabag"]), 2);
  assert.throws(() => cekBolehSetujui({ ...j, status: "final" }, "kabag"), (e) => e.status === 409);
});

// Akun ringkas untuk perhitungan laporan (sen).
const akun = (kode, kelompok, klasifikasi, debit, kredit, opsi = {}) => ({
  uuid: kode,
  kode,
  nama: kode,
  kelompok,
  klasifikasi,
  saldo_normal: opsi.normal ?? (kelompok === "aset" || kelompok === "beban" ? "debit" : "kredit"),
  kas_setara_kas: !!opsi.kas,
  arus_kas: opsi.arus ?? null,
  jenis: "rinci",
  debit,
  kredit,
});

test("laporan: neraca seimbang dengan surplus berjalan, laba rugi, arus kas langsung = tidak langsung = mutasi kas", () => {
  // Skenario (sen): modal 10jt ke kas; pendapatan RJ 350rb (piutang), dibayar tunai; beli obat 1jt kredit; pakai 200rb.
  const jurnal = [
    { j: "J1", kode: "1-1101", d: 1000000000, k: 0 }, { j: "J1", kode: "3-1101", d: 0, k: 1000000000 },
    { j: "J2", kode: "1-1301", d: 35000000, k: 0 }, { j: "J2", kode: "4-1101", d: 0, k: 35000000 },
    { j: "J3", kode: "1-1101", d: 35000000, k: 0 }, { j: "J3", kode: "1-1301", d: 0, k: 35000000 },
    { j: "J4", kode: "1-1401", d: 100000000, k: 0 }, { j: "J4", kode: "2-1101", d: 0, k: 100000000 },
    { j: "J5", kode: "5-1201", d: 20000000, k: 0 }, { j: "J5", kode: "1-1401", d: 0, k: 20000000 },
  ];
  const def = {
    "1-1101": ["aset", "aset_lancar", { kas: true }],
    "1-1301": ["aset", "aset_lancar", { arus: "operasi" }],
    "1-1401": ["aset", "aset_lancar", { arus: "operasi" }],
    "2-1101": ["kewajiban", "kewajiban_pendek", { arus: "operasi" }],
    "3-1101": ["ekuitas", "ekuitas", { arus: "pendanaan" }],
    "4-1101": ["pendapatan", "pendapatan_usaha"],
    "5-1201": ["beban", "beban_pelayanan"],
  };
  const saldo = Object.entries(def).map(([kode, [kel, kls, o]]) => {
    const s = jurnal.filter((x) => x.kode === kode).reduce((t, x) => ({ d: t.d + x.d, k: t.k + x.k }), { d: 0, k: 0 });
    return akun(kode, kel, kls, s.d, s.k, o);
  });
  const lr = hitungLabaRugi(saldo);
  assert.equal(lr.total_pendapatan, 35000000);
  assert.equal(lr.total_beban, 20000000);
  assert.equal(lr.surplus, 15000000);
  const n = hitungNeraca(saldo, []);
  assert.equal(n.total_aset, 1000000000 + 35000000 + 80000000); // kas 10,35jt + persediaan 800rb
  assert.equal(n.total_kewajiban, 100000000);
  assert.equal(n.surplus_tahun_berjalan, 15000000);
  assert.ok(n.seimbang);
  // Surplus tahun lalu dipisahkan dari surplus tahun berjalan.
  const n2 = hitungNeraca(saldo, [akun("4-1101", "pendapatan", "pendapatan_usaha", 0, 5000000)]);
  assert.equal(n2.surplus_tahun_lalu, 5000000);
  assert.equal(n2.surplus_tahun_berjalan, 10000000);
  assert.ok(n2.seimbang);
  const peta = Object.fromEntries(saldo.map((a) => [a.kode, a]));
  const langsung = hitungArusKasLangsung(jurnal.map((x) => ({ jurnal_uuid: x.j, akun_uuid: x.kode, ...peta[x.kode], debit: x.d, kredit: x.k })));
  const tidak = hitungArusKasTidakLangsung(saldo);
  assert.equal(langsung.operasi.total, 35000000);
  assert.equal(langsung.pendanaan.total, 1000000000);
  assert.equal(langsung.kenaikan_kas, 1035000000);
  assert.equal(tidak.operasi.surplus, 15000000);
  assert.equal(tidak.operasi.total, 35000000); // surplus 150rb + utang 1jt − persediaan 800rb = 350rb
  assert.equal(tidak.kenaikan_kas, langsung.kenaikan_kas);
});

test("aging FIFO per penjamin/supplier: pelunasan menutup tagihan tertua, umur 0–30/31–60/61–90/>90, lebih bayar", () => {
  const acuan = wib(2026, 10, 31);
  const piutang = hitungAging(
    [
      { tanggal: wib(2026, 6, 1), penjamin_uuid: "bpjs", nama_pihak: "BPJS", debit: 100, kredit: 0 },
      { tanggal: wib(2026, 8, 20), penjamin_uuid: "bpjs", debit: 200, kredit: 0 },
      { tanggal: wib(2026, 10, 20), penjamin_uuid: "bpjs", debit: 300, kredit: 0 },
      { tanggal: wib(2026, 10, 25), penjamin_uuid: "bpjs", debit: 0, kredit: 150 },
      { tanggal: wib(2026, 10, 1), penjamin_uuid: null, debit: 50, kredit: 0 },
      { tanggal: wib(2026, 10, 2), penjamin_uuid: null, debit: 0, kredit: 80 },
    ],
    "piutang",
    acuan,
  );
  const bpjs = piutang.find((p) => p.pihak_uuid === "bpjs");
  assert.equal(bpjs.nama, "BPJS");
  assert.equal(bpjs.b90, 0); // 100 (Juni) lunas FIFO
  assert.equal(bpjs.b61_90, 150); // sisa 200 (20 Agt, 72 hari) − 50
  assert.equal(bpjs.b0_30, 300);
  assert.equal(bpjs.total, 450);
  const umum = piutang.find((p) => p.pihak_uuid === null);
  assert.equal(umum.lebih_bayar, 30);
  assert.equal(umum.total, -30);
  const utang = hitungAging([{ tanggal: wib(2026, 9, 1), supplier_uuid: "s1", debit: 0, kredit: 1000 }, { tanggal: wib(2026, 10, 5), supplier_uuid: "s1", debit: 400, kredit: 0 }], "utang", acuan);
  assert.equal(utang[0].b31_60, 600);
});

// Basis data tiruan minimal untuk jalur jurnalkanEvent (idempotensi & penguncian periode) tanpa PostgreSQL.
const dbTiruan = ({ statusPeriode = "terbuka" } = {}) => {
  const s = { event: new Map(), jurnal: [], baris: [], nomor: 0 };
  const akunAda = ["a-piutang", "a-rj"].map((uuid) => ({ uuid, kode: uuid, nama: uuid, jenis: "rinci", aktif: true }));
  const k = {
    s,
    async query(sql, p = []) {
      const r = (rows) => ({ rows });
      if (/pg_advisory_xact_lock/.test(sql)) return r([]);
      if (/^SELECT \* FROM akuntansi_event/.test(sql)) return r(s.event.has(p[1]) ? [s.event.get(p[1])] : []);
      if (/UPDATE akuntansi_event SET status = 'konflik'/.test(sql)) {
        Object.assign(s.event.get(p[1]), { status: "konflik", hash_terbaru: p[2] });
        return r([]);
      }
      if (/UPDATE akuntansi_event SET status = 'dijurnal'/.test(sql)) {
        Object.assign(s.event.get(p[1]), { status: "dijurnal", hash_terbaru: null });
        return r([]);
      }
      if (/SELECT uuid FROM akuntansi_jurnal WHERE faskes_uuid = \$1 AND kunci_sumber/.test(sql)) return r(s.jurnal.filter((j) => j.kunci_sumber === p[1]));
      if (/INSERT INTO akuntansi_event/.test(sql)) {
        const lama = s.event.get(p[3]);
        s.event.set(p[3], { ...lama, kunci: p[3], nilai: p[10], hash_data: p[11], status: p[12], alasan: p[13], jurnal_uuid: p[14], percobaan: (lama?.percobaan ?? 0) + 1 });
        return r([]);
      }
      if (/INSERT INTO akuntansi_periode/.test(sql)) return r([]);
      if (/FROM akuntansi_periode/.test(sql)) return r([{ uuid: "per", status: statusPeriode }]);
      if (/FROM akuntansi_akun/.test(sql)) return r(akunAda.filter((a) => p[1].includes(a.uuid)));
      if (/INSERT INTO penunjang_nomor/.test(sql)) return r([{ terakhir: ++s.nomor }]);
      if (/INSERT INTO akuntansi_jurnal_baris/.test(sql)) {
        s.baris.push({ jurnal_uuid: p[2], akun_uuid: p[4], debit: p[5], kredit: p[6] });
        return r([]);
      }
      if (/INSERT INTO akuntansi_jurnal/.test(sql)) {
        const kolom = sql.match(/\(([^)]*)\) VALUES/)[1].split(",").map((c) => c.trim().replace(/"/g, ""));
        const row = Object.fromEntries(kolom.map((c, i) => [c, p[i]]));
        s.jurnal.push(row);
        return r([row]);
      }
      if (/SUM\(debit\)/.test(sql)) {
        const b = s.baris.filter((x) => x.jurnal_uuid === p[0]);
        return r([{ d: dariSen(b.reduce((t, x) => t + keSen(x.debit), 0)), k: dariSen(b.reduce((t, x) => t + keSen(x.kredit), 0)) }]);
      }
      throw new Error(`SQL tak dikenal di tiruan: ${sql.slice(0, 60)}`);
    },
  };
  return k;
};
const aturanRj = [
  { komponen: "piutang_pasien", akun_uuid: "a-piutang", berlaku_mulai: wib(2000, 1, 1) },
  { komponen: "pendapatan:RJ", akun_uuid: "a-rj", berlaku_mulai: wib(2000, 1, 1) },
];
const tagihanRj = (nilai = 350000) => susunTagihan({ uuid: "b-rj", invoice_code: "INV-RJ", grand_total: nilai, created_at: wib(2026, 10, 7, 9) }, [{ type: "RJ", nilai }]);

test("idempotensi jurnal otomatis: proses ulang tidak menggandakan; data sumber berubah → konflik tanpa mengubah jurnal lama", async () => {
  const k = dbTiruan();
  const r1 = await jurnalkanEvent(k, "f1", tagihanRj(), { aturan: aturanRj, pengguna: "akuntan" });
  assert.equal(r1.hasil, "dijurnal");
  assert.equal(k.s.jurnal.length, 1);
  assert.equal(k.s.jurnal[0].kunci_sumber, "tagihan_final:b-rj");
  assert.equal(k.s.jurnal[0].total_debit, "350000.00");
  assert.equal(k.s.baris.length, 2);
  const r2 = await jurnalkanEvent(k, "f1", tagihanRj(), { aturan: aturanRj });
  assert.equal(r2.hasil, "sudah");
  assert.equal(k.s.jurnal.length, 1, "proses ulang tidak boleh membuat jurnal baru");
  const r3 = await jurnalkanEvent(k, "f1", tagihanRj(400000), { aturan: aturanRj });
  assert.equal(r3.hasil, "konflik");
  assert.equal(k.s.jurnal.length, 1);
  assert.equal(k.s.event.get("tagihan_final:b-rj").status, "konflik");
  // Data kembali seperti saat dijurnal → status pulih.
  assert.equal((await jurnalkanEvent(k, "f1", tagihanRj(), { aturan: aturanRj })).hasil, "sudah");
  assert.equal(k.s.event.get("tagihan_final:b-rj").status, "dijurnal");
});

test("pemetaan belum lengkap → event ditahan (tanpa akun tebakan); setelah dilengkapi, proses ulang menjurnal", async () => {
  const k = dbTiruan();
  const r1 = await jurnalkanEvent(k, "f1", tagihanRj(), { aturan: aturanRj.slice(0, 1) });
  assert.equal(r1.hasil, "tertahan");
  assert.match(r1.alasan, /pendapatan:RJ/);
  assert.equal(k.s.jurnal.length, 0);
  const r2 = await jurnalkanEvent(k, "f1", tagihanRj(), { aturan: aturanRj });
  assert.equal(r2.hasil, "dijurnal");
  assert.equal(k.s.event.get("tagihan_final:b-rj").percobaan, 2);
});

test("penguncian periode: periode tutup menolak jurnal (409) dan tidak ada jurnal tersimpan", async () => {
  const k = dbTiruan({ statusPeriode: "tutup" });
  await assert.rejects(() => jurnalkanEvent(k, "f1", tagihanRj(), { aturan: aturanRj }), (e) => e.status === 409 && /Oktober 2026 sudah ditutup/.test(e.message));
  assert.equal(k.s.jurnal.length, 0);
  await assert.rejects(() => pastikanPeriodeTerbuka(k, "f1", wib(2026, 10, 3)), (e) => e.status === 409);
  await pastikanPeriodeTerbuka(dbTiruan(), "f1", wib(2026, 10, 3));
});

test("COA & pemetaan bawaan konsisten: induk ada, klasifikasi sesuai kelompok, kode unik, pemetaan ke akun rinci yang ada", () => {
  const kode = new Set();
  const peta = new Map(COA_BAWAAN.map((a) => [a[0], a]));
  for (const [k, nama, induk, kelompok, saldo, klas, jenis] of COA_BAWAAN) {
    assert.ok(!kode.has(k), `kode ganda ${k}`);
    kode.add(k);
    assert.ok(nama);
    if (induk) {
      assert.ok(peta.has(induk), `induk ${induk} untuk ${k}`);
      assert.equal(peta.get(induk)[3], kelompok, `kelompok induk ${k}`);
      assert.equal(peta.get(induk)[6], "induk");
    }
    assert.ok(KLASIFIKASI_KELOMPOK[kelompok].includes(klas), `klasifikasi ${k}`);
    assert.ok(["debit", "kredit"].includes(saldo));
    assert.ok(["induk", "rinci"].includes(jenis));
  }
  for (const [jenis, komponen, k] of PEMETAAN_BAWAAN) {
    assert.ok(komponenSah(jenis, komponen), `${jenis}/${komponen}`);
    assert.equal(peta.get(k)?.[6], "rinci", `akun ${k} harus rinci`);
  }
  // Setiap komponen dasar event yang tersedia punya pemetaan bawaan (event tidak tertahan setelah pasang bawaan).
  for (const [jenis, def] of Object.entries(JENIS_EVENT).filter(([, d]) => d.tersedia && !d.pemetaan_manual))
    for (const c of Object.keys(def.komponen)) assert.ok(PEMETAAN_BAWAAN.some(([j, kc]) => j === jenis && (kc === c || kc.startsWith(`${c}:`))), `pemetaan bawaan ${jenis}/${c}`);
});

test("izin & katalog: modul Akuntansi & Remunerasi terdaftar, fitur akuntansi_jurnal (wajib) & akuntansi_laporan tersedia", () => {
  assert.equal(akuntansiPermission.module, "Akuntansi & Remunerasi");
  const sub = Object.fromEntries(akuntansiPermission.subModules.map((s) => [s.name, s.allows]));
  assert.ok(sub["Persetujuan Jurnal"].includes("SETUJUI TINGKAT 2"));
  assert.ok(sub["Periode"].includes("TUTUP BUKU"));
  assert.ok(sub["Laporan Keuangan"].includes("EKSPOR"));
  assert.deepEqual(mapPermission(["Akuntansi & Remunerasi"]).map((m) => m.module), ["Akuntansi & Remunerasi"]);
  const modul = katalog.modul.find((m) => m.kode === "akuntansi");
  assert.equal(modul.tersedia, true);
  assert.deepEqual(modul.rute, ["/akuntansi"]);
  const fitur = katalog.fitur.filter((f) => f.modul === "akuntansi");
  assert.deepEqual(fitur.map((f) => [f.kode, f.wajib, f.tersedia]), [["akuntansi_jurnal", true, true], ["akuntansi_laporan", false, true], ["akuntansi_remunerasi", false, true]]);
});

test("laporan: akun kontra (potongan pendapatan, akumulasi penyusutan) menjadi pengurang di kelompoknya; laba rugi = surplus neraca", () => {
  const saldo = [
    akun("1-1101", "aset", "aset_lancar", 100000, 0, { kas: true }),
    akun("1-2103", "aset", "aset_tidak_lancar", 50000, 0),
    akun("1-2109", "aset", "aset_tidak_lancar", 0, 5000, { normal: "kredit" }),
    akun("4-1101", "pendapatan", "pendapatan_usaha", 0, 120000),
    akun("4-1901", "pendapatan", "pendapatan_usaha", 20000, 0, { normal: "debit" }),
    akun("5-2103", "beban", "beban_umum", 5000, 0),
    akun("3-1101", "ekuitas", "ekuitas", 0, 50000),
  ];
  const lr = hitungLabaRugi(saldo);
  assert.equal(lr.total_pendapatan, 100000);
  assert.equal(lr.pendapatan[0].akun.find((a) => a.kode === "4-1901").nilai, -20000);
  assert.equal(lr.surplus, 95000);
  const n = hitungNeraca(saldo, []);
  assert.equal(n.aset.find((g) => g.klasifikasi === "aset_tidak_lancar").total, 45000);
  assert.equal(n.surplus_tahun_berjalan, lr.surplus);
  assert.ok(n.seimbang);
});
