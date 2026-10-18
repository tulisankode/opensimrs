import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KATALOG_INDIKATOR, bagiAman, bulatkan, hariPerawatanPasien, hariPeriode, hitungIndikatorRawatInap, lamaDirawatPasien,
  periodeSebelumnya, perubahanPersen, statusTarget, targetBerlaku,
} from "../src/helpers/indikator-eksekutif.js";
import { cocokIzin } from "../src/helpers/cocok-izin.js";
import EksekutifValidator from "../src/validations/eksekutif-validation.js";

test("bagiAman: pembagi nol/kosong → null, bukan 0 atau Infinity", () => {
  assert.equal(bagiAman(10, 0), null);
  assert.equal(bagiAman(10, null), null);
  assert.equal(bagiAman(null, 5), null);
  assert.equal(bagiAman("6", "3"), 2);
});

test("hariPeriode & periodeSebelumnya (tanggal awal & akhir ikut dihitung, lintas tahun kabisat)", () => {
  assert.equal(hariPeriode("2026-10-01", "2026-10-31"), 31);
  assert.equal(hariPeriode("2026-10-05", "2026-10-05"), 1);
  assert.equal(hariPeriode("2026-10-05", "2026-10-04"), 0);
  assert.equal(hariPeriode("2028-02-01", "2028-02-29"), 29);
  assert.deepEqual(periodeSebelumnya("2026-10-01", "2026-10-31"), { mulai: "2026-08-31", selesai: "2026-09-30" });
  assert.deepEqual(periodeSebelumnya("2026-01-01", "2026-01-07"), { mulai: "2025-12-25", selesai: "2025-12-31" });
});

test("hari perawatan per pasien: hari masuk dihitung, hari keluar tidak; masuk = keluar → 1 hari; dipotong periode", () => {
  const P = ["2026-10-01", "2026-10-10"];
  assert.equal(hariPerawatanPasien({ masuk: "2026-10-02", keluar: "2026-10-05" }, ...P), 3);
  assert.equal(hariPerawatanPasien({ masuk: "2026-10-03", keluar: "2026-10-03" }, ...P), 1);
  assert.equal(hariPerawatanPasien({ masuk: "2026-09-28", keluar: "2026-10-03" }, ...P), 2); // 1–2 Okt
  assert.equal(hariPerawatanPasien({ masuk: "2026-10-08", keluar: null }, ...P), 3); // masih dirawat: 8–10 Okt
  assert.equal(hariPerawatanPasien({ masuk: "2026-09-20", keluar: "2026-09-25" }, ...P), 0);
  assert.equal(hariPerawatanPasien({ masuk: "2026-10-10", keluar: "2026-10-12" }, ...P), 1);
  assert.equal(lamaDirawatPasien({ masuk: "2026-10-02", keluar: "2026-10-05" }), 3);
  assert.equal(lamaDirawatPasien({ masuk: "2026-10-03", keluar: "2026-10-03" }), 1);
  assert.equal(lamaDirawatPasien({ masuk: "2026-10-05", keluar: "2026-10-03" }), null);
});

test("indikator Barber-Johnson dari komponen (contoh hitung manual)", () => {
  // 10 TT, 30 hari, HP 240, 40 pasien keluar, lama dirawat 160 hari, 2 mati (1 di antaranya ≥ 48 jam)
  const r = hitungIndikatorRawatInap({ hariPerawatan: 240, tempatTidur: 10, hari: 30, keluar: 40, lamaDirawat: 160, mati: 2, mati48: 1 });
  assert.equal(r.bor, 80); // 240 / 300 × 100
  assert.equal(r.alos, 4); // 160 / 40
  assert.equal(r.toi, 1.5); // (300 − 240) / 40
  assert.equal(r.bto, 4); // 40 / 10
  assert.equal(r.gdr, 50); // 2 / 40 × 1000
  assert.equal(r.ndr, 25); // 1 / 40 × 1000
});

test("indikator rawat inap aman terhadap pembagi nol (TT kosong / tanpa pasien keluar)", () => {
  const tanpaTT = hitungIndikatorRawatInap({ hariPerawatan: 5, tempatTidur: 0, hari: 30, keluar: 2, lamaDirawat: 6, mati: 0, mati48: 0 });
  assert.equal(tanpaTT.bor, null);
  assert.equal(tanpaTT.toi, null);
  assert.equal(tanpaTT.bto, null);
  assert.equal(tanpaTT.alos, 3);
  assert.equal(tanpaTT.gdr, 0);
  const tanpaKeluar = hitungIndikatorRawatInap({ hariPerawatan: 0, tempatTidur: 10, hari: 7, keluar: 0, lamaDirawat: 0, mati: 0, mati48: 0 });
  assert.equal(tanpaKeluar.bor, 0);
  assert.equal(tanpaKeluar.alos, null);
  assert.equal(tanpaKeluar.toi, null);
  assert.equal(tanpaKeluar.gdr, null);
  assert.equal(tanpaKeluar.ndr, null);
  assert.equal(tanpaKeluar.bto, 0);
});

test("status target: hijau dalam rentang, kuning dalam toleransi, merah di luar; tanpa target → null", () => {
  const bor = { min: 75, maks: 85, toleransi_persen: 10 };
  assert.equal(statusTarget(82, bor), "hijau");
  assert.equal(statusTarget(70, bor), "kuning"); // ≥ 67,5
  assert.equal(statusTarget(60, bor), "merah");
  assert.equal(statusTarget(90, bor), "kuning"); // ≤ 93,5
  assert.equal(statusTarget(95, bor), "merah");
  const ndr = { min: null, maks: 25, toleransi_persen: 0 };
  assert.equal(statusTarget(25, ndr), "hijau");
  assert.equal(statusTarget(26, ndr), "merah");
  assert.equal(statusTarget(80, null), null);
  assert.equal(statusTarget(null, bor), null);
});

test("target berlaku: indikator volume disesuaikan panjang periode, rasio tidak", () => {
  const kunjungan = KATALOG_INDIKATOR.find((i) => i.kode === "kunjungan_rj");
  const bor = KATALOG_INDIKATOR.find((i) => i.kode === "bor");
  assert.deepEqual(targetBerlaku({ target_min: 3000, target_maks: null, toleransi_persen: "5" }, kunjungan, 7),
    { min: 700, maks: null, toleransi_persen: 5, disesuaikan_periode: true });
  assert.deepEqual(targetBerlaku({ target_min: "75", target_maks: "85" }, bor, 7),
    { min: 75, maks: 85, toleransi_persen: 10, disesuaikan_periode: false });
  assert.equal(targetBerlaku({ target_min: null, target_maks: null }, bor, 7), null);
  assert.equal(targetBerlaku(undefined, bor, 7), null);
});

test("perubahan persen & pembulatan", () => {
  assert.equal(perubahanPersen(115, 100), 15);
  assert.equal(perubahanPersen(5, 0), null);
  assert.equal(perubahanPersen(null, 10), null);
  assert.equal(bulatkan(2 / 3, 1), 0.7);
  assert.equal(bulatkan(NaN, 1), null);
});

test("katalog indikator: kode unik dan setiap indikator punya rumus & satuan", () => {
  const kode = KATALOG_INDIKATOR.map((i) => i.kode);
  assert.equal(new Set(kode).size, kode.length);
  for (const i of KATALOG_INDIKATOR) assert.ok(i.rumus && i.satuan && ["layanan", "keuangan", "mutu", "sdm"].includes(i.kelompok), i.kode);
});

test("cocokIzin: aksi per submodul Dashboard › Eksekutif (tanpa beda huruf besar/kecil)", () => {
  const izin = [{ module: "Dashboard", subModules: [{ name: "Eksekutif", allows: ["READ"] }] }];
  assert.equal(cocokIzin(izin, "dashboard", "eksekutif", "READ"), true);
  assert.equal(cocokIzin(izin, "Dashboard", "Eksekutif", "RINCIAN"), false);
  assert.equal(cocokIzin(izin, "Dashboard", "Eksekutif", ["RINCIAN", "READ"]), true);
  assert.equal(cocokIzin([{ module: "Dashboard", subModules: [] }], "Dashboard", "Eksekutif", "READ"), false);
  assert.equal(cocokIzin([], "Dashboard", "Eksekutif", "READ"), false);
});

test("validasi periode: wajib, tidak terbalik, maksimal 366 hari; faskes_uuid dipisah koma", () => {
  assert.throws(() => EksekutifValidator.RINGKASAN.parse({ startDate: "2026-10-10", endDate: "2026-10-01" }));
  assert.throws(() => EksekutifValidator.RINGKASAN.parse({ startDate: "2025-01-01", endDate: "2026-10-01" }));
  assert.throws(() => EksekutifValidator.RINGKASAN.parse({ endDate: "2026-10-01" }));
  assert.throws(() => EksekutifValidator.RINGKASAN.parse({ startDate: "10/01/2026", endDate: "2026-10-01" }));
  const ok = EksekutifValidator.RINGKASAN.parse({ startDate: "2026-10-01", endDate: "2026-10-31", faskes_uuid: "a, b,a" });
  assert.deepEqual(ok.faskes_uuid, ["a", "b"]);
  assert.throws(() => EksekutifValidator.RINCIAN.parse({ startDate: "2026-10-01", endDate: "2026-10-31", kode: "bor", dimensi: "poli" }));
  assert.equal(EksekutifValidator.RINCIAN.parse({ startDate: "2026-10-01", endDate: "2026-10-31", kode: "piutang", dimensi: "bulan" }).dimensi, "bulan");
  assert.throws(() => EksekutifValidator.TARGET.parse({ target: [{ kode: "bor", target_min: 90, target_maks: 80 }] }));
  assert.throws(() => EksekutifValidator.TARGET.parse({ target: [{ kode: "tidak_ada", target_min: 1 }] }));
  assert.deepEqual(EksekutifValidator.TARGET.parse({ target: [{ kode: "ndr", target_maks: 25 }] }).target[0],
    { kode: "ndr", target_min: null, target_maks: 25, toleransi_persen: 10 });
});
