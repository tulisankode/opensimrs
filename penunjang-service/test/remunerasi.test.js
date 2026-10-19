import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SKEMA_CONTOH,
  SUB,
  angkaKonfigurasi,
  angkaSenti,
  bagiBulat,
  bagiProporsional,
  cekPemisahanTugas,
  hashMasukan,
  hitungRemunerasi,
  pastikanStatus,
  persenBp,
  poinPenerima,
  porsiUntuk,
  refPasien,
  tanggalAkhirPeriode,
  validasiIndeks,
  validasiKonfigurasi,
} from "../src/akuntansi/remunerasi/bersama.js";
import { JENIS_EVENT, JENIS_EVENT_TERSEDIA, komponenSah, susunBayarJaspel, susunJaspel } from "../src/akuntansi/event.js";
import { PEMETAAN_BAWAAN } from "../src/akuntansi/coa-bawaan.js";
import { periodeDari } from "../src/akuntansi/bersama.js";
import { akuntansiPermission } from "../../auth-service/src/helpers/permission-list.js";
import katalog from "../../database/data/katalog-modul.json" with { type: "json" };

// Uji unit perhitungan & aturan Remunerasi / jasa pelayanan (STD-0032). Semua data fiktif.
const konf = angkaKonfigurasi(validasiKonfigurasi(SKEMA_CONTOH));
const penerima = [
  { practitioner_uuid: "dr-1", nama: "dr. Contoh Satu, Sp.B", profesi: "dokter_spesialis", unit: "Bedah", indeks: validasiIndeks({ pendidikan: 3, risiko: 2, jabatan: 1, masa_kerja: 2 }), aktif: true, ikut_kebersamaan: true },
  { practitioner_uuid: "dr-2", nama: "dr. Contoh Dua", profesi: "dokter_umum", unit: "IGD", indeks: validasiIndeks({ pendidikan: 2, risiko: 1, jabatan: 0, masa_kerja: 1 }), aktif: true, ikut_kebersamaan: true },
  { practitioner_uuid: "ns-1", nama: "Ns. Contoh Tiga", profesi: "perawat", unit: "Bedah", indeks: validasiIndeks({ pendidikan: 1, risiko: 1, jabatan: 0, masa_kerja: 4 }), aktif: true, ikut_kebersamaan: true },
  { practitioner_uuid: "dr-x", nama: "dr. Nonaktif", profesi: "dokter_umum", unit: null, indeks: validasiIndeks({}), aktif: false, ikut_kebersamaan: true },
];
const sumber = () => [
  { bill_item_uuid: "i-a", jenis_layanan: "RJ", kategori: "tindakan", nilai: 15000000, practitioner_uuid: "dr-1" },
  { bill_item_uuid: "i-b", jenis_layanan: "RI", kategori: "tindakan", nilai: 33333, practitioner_uuid: "dr-2" },
  { bill_item_uuid: "i-c", jenis_layanan: "LAB", kategori: "penunjang", nilai: 100000, practitioner_uuid: "dr-1" },
  { bill_item_uuid: "i-d", jenis_layanan: "RJ", kategori: "obat", nilai: 2500000, practitioner_uuid: "dr-1" },
  { bill_item_uuid: "i-e", jenis_layanan: "RJ", kategori: "tindakan", nilai: 50000, practitioner_uuid: null },
  { bill_item_uuid: "i-f", jenis_layanan: "RJ", kategori: "tindakan", nilai: 70000, practitioner_uuid: "dr-2", penjamin: true },
  { bill_item_uuid: "i-g", jenis_layanan: "IGD", kategori: "tindakan", nilai: 90000, practitioner_uuid: "dr-x" },
  { bill_item_uuid: "i-h", jenis_layanan: "IGD", kategori: "tindakan", nilai: 80000, practitioner_uuid: "dr-2", periode_lain: true },
];
const wib = (y, m, d, jam = 0) => Date.UTC(y, m - 1, d, jam - 7) / 1000;

test("angka: persen/indeks ≤ 2 desimal tanpa floating point; pembulatan setengah ke atas", () => {
  assert.equal(persenBp("40"), 4000);
  assert.equal(persenBp("12.5"), 1250);
  assert.equal(persenBp(0.35), 35);
  assert.equal(angkaSenti("1,25", "x"), 125);
  assert.throws(() => persenBp("100.01"), /maksimal/);
  assert.throws(() => persenBp("-1"), /tidak negatif/);
  assert.throws(() => persenBp("1.234"), /2 desimal/);
  assert.throws(() => persenBp(""), /wajib/);
  assert.equal(bagiBulat(5, 10), 1);
  assert.equal(bagiBulat(4, 10), 0);
  assert.equal(bagiBulat(-5, 10), -1);
  assert.equal(bagiBulat(33333 * 3500, 10000), 11667);
});

test("skema: contoh valid; langsung + kebersamaan wajib 100; porsi ganda/kategori asing ditolak", () => {
  const k = validasiKonfigurasi(SKEMA_CONTOH);
  assert.equal(k.persen_langsung, "60.00");
  assert.equal(k.indeks_profesi.dokter_spesialis, "4.00");
  assert.throws(() => validasiKonfigurasi({ ...SKEMA_CONTOH, persen_kebersamaan: "30" }), /tepat 100/);
  assert.throws(() => validasiKonfigurasi({ ...SKEMA_CONTOH, porsi: [...SKEMA_CONTOH.porsi, { jenis_layanan: "RJ", kategori: "tindakan", persen: 10 }] }), /ganda/);
  assert.throws(() => validasiKonfigurasi({ ...SKEMA_CONTOH, porsi: [{ jenis_layanan: "RJ", kategori: "gaji", persen: 10 }] }), /kategori/);
  assert.throws(() => validasiKonfigurasi({ ...SKEMA_CONTOH, porsi: [] }), /minimal/);
  assert.throws(() => validasiKonfigurasi({ ...SKEMA_CONTOH, kinerja_min: "120", kinerja_maks: "100" }), /kinerja_min/);
  // Porsi: aturan persis lebih dulu, lalu fallback "*"; tanpa aturan = 0.
  assert.equal(porsiUntuk(konf.porsi, "RJ", "tindakan"), 4000);
  assert.equal(porsiUntuk(konf.porsi, "OTC", "tindakan"), 3000);
  assert.equal(porsiUntuk(konf.porsi, "LAB", "penunjang"), 1500);
  assert.equal(porsiUntuk(konf.porsi, "RJ", "obat"), 0);
});

test("bagi proporsional (sisa terbesar): jumlah tepat sama dengan total, deterministik, bobot nol → null", () => {
  assert.deepEqual(bagiProporsional(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(bagiProporsional(10, [1, 2, 7]), [1, 2, 7]);
  assert.deepEqual(bagiProporsional(0, [0, 0]), [0, 0]);
  assert.equal(bagiProporsional(5, [0, 0]), null);
  const besar = bagiProporsional(987654321, [123456789n, 987654321n, 5n, 0n]);
  assert.equal(besar.reduce((t, x) => t + x, 0), 987654321);
  assert.equal(besar[3], 0);
});

test("poin penerima = indeks profesi + Σ indeks × bobot", () => {
  assert.equal(poinPenerima(konf, penerima[0]), 110000); // 4 + 3 + 2 + 1 + 2×0,5 = 11
  assert.equal(poinPenerima(konf, penerima[1]), 65000); // 3 + 2 + 1 + 0 + 0,5 = 6,5
  assert.equal(poinPenerima(konf, penerima[2]), 60000); // 2 + 1 + 1 + 0 + 2 = 6
});

test("hitung: porsi, langsung/kebersamaan, pool berbobot kinerja, pengecualian & status sumber; total rincian = langsung + pool + koreksi", () => {
  const kinerja = new Map([["ns-1", 12000]]);
  const koreksi = [{ uuid: "k-1", practitioner_uuid: "dr-2", nilai: -1000 }];
  const h = hitungRemunerasi({ sumber: sumber(), konf, penerima, kinerja, koreksi });
  const st = Object.fromEntries(h.sumber.map((s) => [s.bill_item_uuid, s.status]));
  assert.deepEqual(st, { "i-a": "dihitung", "i-b": "dihitung", "i-c": "dihitung", "i-e": "pengecualian", "i-f": "tertahan_penjamin", "i-g": "pengecualian", "i-h": "periode_lain" });
  assert.equal(h.ringkasan.item_tanpa_porsi, 1, "obat tanpa porsi tidak disimpan sebagai sumber");
  const a = h.sumber.find((s) => s.bill_item_uuid === "i-a");
  assert.deepEqual([a.jaspel, a.langsung, a.kebersamaan], [6000000, 3600000, 2400000]);
  const b = h.sumber.find((s) => s.bill_item_uuid === "i-b");
  assert.deepEqual([b.jaspel, b.langsung, b.kebersamaan], [11667, 7000, 4667]);
  assert.equal(h.ringkasan.pool, 2400000 + 4667 + 6000);
  assert.equal(h.ringkasan.total_jaspel, 6000000 + 11667 + 15000);
  assert.equal(h.ringkasan.total_dasar, 15000000 + 33333 + 100000);
  // Total rincian tepat = jasa langsung + pool + koreksi (tidak ada sen hilang/bertambah).
  assert.equal(h.ringkasan.total, h.ringkasan.total_langsung + h.ringkasan.pool + h.ringkasan.total_koreksi);
  assert.equal(h.ringkasan.total_kebersamaan, h.ringkasan.pool);
  const r = Object.fromEntries(h.rincian.map((x) => [x.practitioner_uuid, x]));
  assert.equal(r["dr-1"].langsung, 3600000 + 9000);
  assert.equal(r["dr-1"].jumlah_layanan, 2);
  assert.equal(r["ns-1"].langsung, 0, "perawat tanpa layanan langsung hanya mendapat bagian kebersamaan");
  // Pool: poin efektif 11 : 6,5 : 7,2 (perawat × 120%).
  const pool = h.ringkasan.pool;
  const harap = (bobot) => (pool * bobot) / 24.7;
  assert.ok(Math.abs(r["dr-1"].kebersamaan - harap(11)) <= 1);
  assert.ok(Math.abs(r["ns-1"].kebersamaan - harap(7.2)) <= 1);
  assert.equal(r["dr-2"].koreksi, -1000);
  assert.equal(r["dr-1"].rumus.kinerja_persen, "100.00");
  assert.equal(r["ns-1"].rumus.kinerja_persen, "120.00");
  assert.ok(!r["dr-x"], "penerima nonaktif tidak ikut pool");
  assert.equal(h.pengecualian[0].kode, "sumber_pengecualian");
  assert.equal(h.ringkasan.jumlah_status.pengecualian, 2);
});

test("hitung: penyelesaian pengecualian (tetapkan/abaikan) menghapus pengecualian; total negatif setelah koreksi = pengecualian", () => {
  const penyelesaian = new Map([
    ["i-e", { tindakan: "tetapkan", practitioner_uuid: "ns-1" }],
    ["i-g", { tindakan: "abaikan", alasan: "Tindakan dibatalkan (contoh)" }],
  ]);
  const h = hitungRemunerasi({ sumber: sumber(), konf, penerima, penyelesaian });
  assert.equal(h.pengecualian.length, 0);
  assert.equal(h.sumber.find((s) => s.bill_item_uuid === "i-e").pelaksana_uuid, "ns-1");
  assert.equal(h.sumber.find((s) => s.bill_item_uuid === "i-g").status, "diabaikan");
  const neg = hitungRemunerasi({ sumber: [], konf, penerima, koreksi: [{ uuid: "k", practitioner_uuid: "dr-2", nilai: -500 }] });
  assert.equal(neg.pengecualian[0].kode, "total_negatif");
  // Pool tanpa penerima ber-poin → tidak dapat dibagi.
  const kosong = hitungRemunerasi({ sumber: sumber().slice(0, 1), konf, penerima: [{ ...penerima[0], ikut_kebersamaan: false }] });
  assert.equal(kosong.pengecualian.at(-1).kode, "pool_tidak_terbagi");
});

test("hash masukan: tidak bergantung urutan, berubah bila data sumber/indeks/kinerja berubah", () => {
  const skema = { uuid: "s-1", versi: 1 };
  const dasar = { skema, sumber: sumber(), penerima, kinerja: new Map(), koreksi: [], penyelesaian: new Map() };
  const h1 = hashMasukan(dasar);
  assert.equal(hashMasukan({ ...dasar, sumber: sumber().reverse(), penerima: [...penerima].reverse() }), h1);
  assert.notEqual(hashMasukan({ ...dasar, sumber: sumber().map((s, i) => (i ? s : { ...s, nilai: s.nilai + 1 })) }), h1);
  assert.notEqual(hashMasukan({ ...dasar, kinerja: new Map([["dr-1", 9000]]) }), h1);
  assert.notEqual(hashMasukan({ ...dasar, skema: { uuid: "s-1", versi: 2 } }), h1);
  assert.notEqual(hashMasukan({ ...dasar, penerima: penerima.map((p, i) => (i ? p : { ...p, indeks: validasiIndeks({ pendidikan: 4 }) })) }), h1);
});

test("alur status & pemisahan tugas: penghitung ≠ verifikator ≠ penyetuju", () => {
  assert.throws(() => pastikanStatus({ status: "draf" }, "setujui"), /Diverifikasi/);
  assert.throws(() => pastikanStatus({ status: "disetujui" }, "hitung"));
  assert.throws(() => pastikanStatus({ status: "dibayar" }, "ubah"));
  pastikanStatus({ status: "dihitung" }, "hitung");
  pastikanStatus({ status: "disetujui" }, "bayar");
  const p = { dihitung_oleh: "remun", diverifikasi_oleh: "verif" };
  assert.throws(() => cekPemisahanTugas(p, "Remun", "verifikasi"), /berbeda/);
  cekPemisahanTugas(p, "verif", "verifikasi");
  assert.throws(() => cekPemisahanTugas(p, "remun", "setujui"), /pembuat ≠ penyetuju/);
  assert.throws(() => cekPemisahanTugas(p, "VERIF", "setujui"), /verifikator/);
  cekPemisahanTugas(p, "direktur", "setujui");
});

test("jurnal jaspel: D beban jaspel / K utang jaspel di akhir bulan periode; pembayaran D utang jaspel / K kas; kunci idempoten", () => {
  const t = tanggalAkhirPeriode(2026, 10);
  assert.deepEqual(periodeDari(t), { tahun: 2026, bulan: 10 });
  assert.equal(t, wib(2026, 10, 31));
  const ev = susunJaspel({ uuid: "p-1", nomor: "JASPEL-2026-10", tanggal: t, total: "1234567.89" });
  assert.equal(ev.kunci, "jaspel:p-1");
  assert.deepEqual(ev.baris.map((b) => [b.komponen, b.debit, b.kredit]), [["beban_jaspel", 123456789, 0], ["utang_jaspel", 0, 123456789]]);
  const bayar = susunBayarJaspel({ uuid: "p-1", nomor: "JASPEL-2026-10", tanggal_bayar: wib(2026, 11, 5, 10), total: "1234567.89", metode_bayar: "transfer", referensi_bayar: "TRF-CONTOH-1" });
  assert.equal(bayar.kunci, "jaspel_bayar:p-1");
  assert.equal(bayar.tanggal, wib(2026, 11, 5));
  assert.deepEqual(bayar.baris.map((b) => [b.komponen, b.debit, b.kredit]), [["utang_jaspel", 123456789, 0], ["kas:TRANSFER", 0, 123456789]]);
  assert.ok(susunJaspel({ uuid: "p-0", nomor: "x", tanggal: t, total: "0.00" }).lewati);
  // Event dorong: terdaftar & berpemetaan bawaan, tetapi tidak ikut "proses jurnal periode" (penarikan).
  assert.ok(JENIS_EVENT.jaspel.dorong && JENIS_EVENT.jaspel_bayar.dorong);
  assert.ok(!JENIS_EVENT_TERSEDIA.includes("jaspel") && !JENIS_EVENT_TERSEDIA.includes("jaspel_bayar"));
  for (const b of ev.baris) assert.ok(komponenSah("jaspel", b.komponen), b.komponen);
  for (const b of bayar.baris) assert.ok(komponenSah("jaspel_bayar", b.komponen), b.komponen);
  for (const [j, c] of [["jaspel", "beban_jaspel"], ["jaspel", "utang_jaspel"], ["jaspel_bayar", "utang_jaspel"], ["jaspel_bayar", "kas"]]) assert.ok(PEMETAAN_BAWAAN.some(([pj, pc]) => pj === j && pc === c), `pemetaan bawaan ${j}/${c}`);
});

test("slip: penanda pasien anonim, tidak memuat uuid pasien, berbeda antarperiode", () => {
  const a = refPasien("periode-1", "pasien-9999");
  assert.match(a, /^PSN-[0-9A-F]{6}$/);
  assert.ok(!a.includes("9999"));
  assert.equal(refPasien("periode-1", "pasien-9999"), a);
  assert.notEqual(refPasien("periode-2", "pasien-9999"), a);
});

test("izin & katalog: submodul Remunerasi di modul izin Akuntansi & Remunerasi; fitur akuntansi_remunerasi tidak wajib", () => {
  const sub = Object.fromEntries(akuntansiPermission.subModules.map((s) => [s.name, s.allows]));
  for (const s of Object.values(SUB)) assert.ok(sub[s]?.includes("READ"), `submodul ${s}`);
  assert.ok(sub[SUB.konfigurasi].includes("SAHKAN"));
  assert.ok(sub[SUB.periode].includes("HITUNG") && sub[SUB.periode].includes("KOREKSI"));
  assert.ok(sub[SUB.verifikasi].includes("VALIDASI"));
  assert.ok(sub[SUB.persetujuan].includes("SETUJUI"));
  assert.ok(sub[SUB.pembayaran].includes("BAYAR"));
  assert.ok(sub[SUB.rekap].includes("EKSPOR"));
  assert.ok(sub["Jurnal"], "submodul Akuntansi lama tetap ada");
  const f = katalog.fitur.find((x) => x.kode === "akuntansi_remunerasi");
  assert.equal(f.modul, "akuntansi");
  assert.equal(f.wajib, false);
  assert.deepEqual(f.rute, ["/akuntansi/remunerasi"]);
});
