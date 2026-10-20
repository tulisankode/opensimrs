import { test } from "node:test";
import assert from "node:assert/strict";
import { berlaku, masaBerlaku, hash, rentang, transisi, cekVersi, tanpaCakupan } from "../src/hr/penggajian/bersama.js";
import { desimal, sen, uang, senAman, bulat, evaluasi, evaluasiEksak, validasiKonfigurasi, hitungAturan } from "../src/hr/penggajian/perhitungan.js";
import { susunPenggajian, JENIS_EVENT_TERSEDIA, komponenSah } from "../src/akuntansi/event.js";

const k = (nilai) => ({ op: "konstanta", nilai });
// Seluruh angka di bawah adalah skenario fiktif pengujian evaluator, bukan tarif produksi.
const aturan = () => ({ metode: "periodik", rekonsiliasi: "tidak_diperlukan", parameter_wajib: ["dasar"], definisi: {}, pembulatan: { metode: "setengah_ke_atas", satuan: "0.01" }, potongan: ["bpjs_kesehatan", "bpjs_ketenagakerjaan", "pph21"].map((kode) => ({ kode, kategori: kode === "pph21" ? "pph21" : "bpjs", dasar_aturan: "Kasus fiktif", rumus: { op: "bagi", argumen: [{ op: "variabel", nama: "dasar" }, k("7")] } })), iuran_pemberi_kerja: [] });
const konfigurasi = () => {
  const a = aturan();
  return { dasar_aturan: "Skenario fiktif pengujian", aturan: a, kebijakan: { tanggal_acuan: "awal_bulan", kehadiran_tidak_digunakan: true, perlakuan_pajak_jaspel: "kena_pajak", penyaluran_jaspel: "utuh", waktu_jurnal: "pembayaran", penerbitan_slip: "pembayaran_dan_jurnal", pemisahan_tugas: "wajib", perubahan_tengah_bulan: "tanggal_acuan" }, kasus_uji: [{ parameter: { dasar: "1" }, ekspektasi: { bpjs_kesehatan: "0.14", bpjs_ketenagakerjaan: "0.14", pph21: "0.14" } }] };
};
test("nominal tidak memakai pecahan biner; batas individual dan antarmuka Akuntansi", () => {
  assert.equal(uang(sen("0.10") + sen("0.20")), "0.30");
  assert.equal(uang(sen("9999999999999999.99")), "9999999999999999.99");
  for (const n of [0.1, "1e2", "1.234", "10000000000000000.00", "", "NaN"]) assert.throws(() => sen(n));
  assert.throws(() => senAman("9999999999999999.99"), /Akuntansi/);
  assert.throws(() => uang(1000000000000000000n), /NUMERIC/);
});
test("pembulatan eksplisit: setengah, ke bawah, ke atas, dan satuan", () => {
  assert.equal(bulat(desimal("1.235"), { metode: "setengah_ke_atas", satuan: "0.01" }), "1.24");
  assert.equal(bulat(desimal("-1.235"), { metode: "setengah_ke_atas", satuan: "0.01" }), "-1.24");
  assert.equal(bulat(desimal("1.239"), { metode: "ke_bawah", satuan: "0.01" }), "1.23");
  assert.equal(bulat(desimal("1.231"), { metode: "ke_atas", satuan: "0.01" }), "1.24");
  assert.equal(bulat(desimal("14.50"), { metode: "setengah_ke_atas", satuan: "5.00" }), "15.00");
  assert.throws(() => bulat(1n, {}));
  assert.equal(bulat(desimal("-1.239"), { metode: "ke_atas", satuan: "0.01" }), "-1.23");
  assert.equal(bulat(desimal("-1.239"), { metode: "ke_bawah", satuan: "0.01" }), "-1.24");
  const e = { op: "kali", argumen: [{ op: "bagi", argumen: [k("1"), k("3")] }, k("3")] };
  assert.equal(bulat(evaluasiEksak(e), { metode: "ke_bawah", satuan: "0.01" }), "1.00");
});
test("evaluator menolak skrip bebas, parameter hilang, siklus, nol, dan kompleksitas", () => {
  for (const e of [{ op: "eval", nilai: "process.exit()" }, { op: "variabel", nama: "hilang" }, { op: "bagi", argumen: [k("1"), k("0")] }]) assert.throws(() => evaluasi(e));
  assert.throws(() => evaluasi({ op: "variabel", nama: "a" }, {}, { a: { op: "variabel", nama: "b" }, b: { op: "variabel", nama: "a" } }), /siklik/);
  let e = k("1"); for (let i = 0; i < 40; i++) e = { op: "tambah", argumen: [e, k("1")] };
  assert.throws(() => evaluasi(e), /kompleks/);
  assert.equal(evaluasi({ op: "kondisi", kiri: k("1"), kanan: k("2"), perbandingan: "lt", jika: k("7"), selain: k("8") }), desimal("7"));
});
test("rentang tarif eksklusif, celah, dan tumpang tindih", () => {
  const e = { op: "rentang", dasar: k("10"), rentang: [{ mulai: "0", sampai: "10", hasil: k("1") }, { mulai: "10", sampai: null, hasil: k("2") }] };
  assert.equal(evaluasi(e), desimal("2"));
  e.rentang[1].mulai = "9"; assert.throws(() => evaluasi(e), /tumpang/);
  e.rentang[1].mulai = "11"; assert.throws(() => evaluasi(e), /tercakup/);
});
test("konfigurasi lengkap dan kasus uji wajib; metode yang belum didukung ditolak", () => {
  assert.ok(validasiKonfigurasi(konfigurasi()));
  const c = konfigurasi(); c.kasus_uji[0].ekspektasi.pph21 = "0.15"; assert.throws(() => validasiKonfigurasi(c), /ekspektasi/);
  c.kasus_uji = []; assert.throws(() => validasiKonfigurasi(c), /Kasus uji/);
  const d = konfigurasi(); d.aturan.potongan.pop(); assert.throws(() => validasiKonfigurasi(d), /pph21/);
  const e = konfigurasi(); e.aturan.rekonsiliasi = "tahunan"; assert.throws(() => validasiKonfigurasi(e), /belum didukung/);
  assert.throws(() => hitungAturan(aturan(), {}), /Parameter/);
});
test("masa berlaku inklusif/eksklusif, versi optimistis, faskes dari token", () => {
  const m = masaBerlaku({ berlaku_mulai: 100, berlaku_sampai: 200 });
  assert.equal(berlaku(m, 100), true); assert.equal(berlaku(m, 200), false);
  assert.throws(() => masaBerlaku({ berlaku_mulai: 200, berlaku_sampai: 100 }));
  assert.throws(() => cekVersi({ versi: 2 }, { versi: 1 }), /Versi/);
  assert.equal(rentang(2026, 10).awal, Date.UTC(2026, 8, 30, 17) / 1000);
  for (const posisi of ["body", "query"]) assert.throws(() => tanpaCakupan({ author: { faskesUuid: "fiktif", username: "contoh" }, [posisi]: { faskes_uuid: "lain" } }), /token/);
});
test("transisi mengunci nominal dan memisahkan penghitung, verifikator, penyetuju", () => {
  assert.equal(transisi({ status: "draf" }, "ajukan", "a"), "verifikasi");
  assert.throws(() => transisi({ status: "draf" }, "bayar", "a"), /status/);
  assert.throws(() => transisi({ status: "verifikasi", dihitung_oleh: "a" }, "verifikasi", "a"), /berbeda/);
  for (const x of ["a", "b"]) assert.throws(() => transisi({ status: "menunggu_persetujuan", dihitung_oleh: "a", diverifikasi_oleh: "b" }, "setujui", x), /berbeda/);
  assert.throws(() => transisi({ status: "dibayar" }, "tolak", "c"), /status/);
  assert.equal(hash({ z: "1", a: { y: 1, x: 2 } }), hash({ a: { x: 2, y: 1 }, z: "1" }));
});
test("jurnal seimbang, jaspel tidak dibebankan ulang, koreksi negatif, kunci tetap", () => {
  const p = { uuid: "periode-fiktif", tahun: 2026, bulan: 10, tanggal_bayar: 100, hash_hitung: "h", bersih: "112.00" };
  const r = [{ kode: "pokok", jenis: "penghasilan", kategori: "gaji_pokok", nilai: "100.00" }, { kode: "jaspel", jenis: "penghasilan", kategori: "jaspel", nilai: "20.00" }, { kode: "pph21", jenis: "potongan", kategori: "pph21", nilai: "8.00" }, { kode: "pemberi", jenis: "iuran_pemberi_kerja", kategori: "bpjs", nilai: "2.00" }];
  const ev = susunPenggajian(p, r);
  assert.equal(ev.kunci, "penggajian:periode-fiktif"); assert.equal(ev.nilai, 12200);
  assert.ok(ev.baris.some((x) => x.komponen === "utang_jaspel" && x.debit === 2000));
  assert.equal(ev.baris.some((x) => x.komponen === "beban_jaspel"), false);
  assert.equal(JENIS_EVENT_TERSEDIA.includes("penggajian"), false);
  assert.ok(komponenSah("penggajian", "beban_gaji:pokok"));
  assert.equal(ev.baris.reduce((n, x) => n + x.debit - x.kredit, 0), 0);
  assert.deepEqual(susunPenggajian(p, r.toReversed()), ev);
  assert.throws(() => susunPenggajian({ ...p, bersih: "113.00" }, r), /seimbang/);
});
