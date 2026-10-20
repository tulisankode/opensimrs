import { test } from "node:test";
import assert from "node:assert/strict";
import { bulan, hari, tanggalWib, tanggalBulan, validasiPola, rentang, rencanaSalin, rencanaRotasi, validasiAturan, samaPotret } from "../src/hr/jadwal-dinas/bersama.js";
import { awalMinggu, validasiJadwal } from "../src/hr/jadwal-dinas/validasi.js";

const t = tanggalWib(2026, 11, 2), periode = tanggalWib(2026, 11);
const aturan = { istirahat_minimum_menit: 480, batas_kerja_mingguan_menit: 2400, jenis_minggu: "kalender", tingkat_istirahat: "pemblokir", tingkat_jam_mingguan: "pemblokir", tingkat_staf: "peringatan" };
const p = (mulai, selesai, data = {}) => ({ kepegawaian_uuid: "pegawai-fiktif", tanggal_kerja: t, pola_shift_uuid: "pagi", mulai_epoch: mulai, selesai_epoch: selesai, libur: false, ...data });
const periksa = (kandidat, tambahan = {}) => validasiJadwal({ kandidat, aturan, periode, ...tambahan });

test("kalender WIB, Februari kabisat dan lintas tahun tidak bergantung zona perangkat", () => {
  assert.equal(hari(t), t);
  assert.throws(() => hari(t + 1)); assert.throws(() => bulan(t));
  assert.equal(tanggalBulan(tanggalWib(2024, 2)).length, 29);
  assert.equal(tanggalBulan(tanggalWib(2025, 2)).length, 28);
  assert.equal(tanggalBulan(tanggalWib(2026, 12)).at(-1) + 86400, tanggalWib(2027, 1));
  assert.equal(awalMinggu(t + 6 * 86400 + 86399, aturan), t);
  assert.equal(awalMinggu(t + 7 * 86400, aturan), t + 7 * 86400);
});
test("shift lintas tengah malam dan libur; rentang nol atau 24 jam ditolak", () => {
  const b = { kode: "M", nama: "Malam", mulai_menit: 1320, selesai_menit: 360, lintas_hari: true, libur: false };
  const x = rentang(t, validasiPola(b));
  assert.equal(x.selesai_epoch - x.mulai_epoch, 8 * 3600);
  assert.equal(x.selesai_epoch, t + 86400 + 360 * 60);
  assert.throws(() => validasiPola({ ...b, lintas_hari: false }));
  assert.throws(() => validasiPola({ ...b, selesai_menit: 1320 }));
  assert.equal(rentang(t, validasiPola({ ...b, libur: true, mulai_menit: 0, selesai_menit: 0, lintas_hari: false })).mulai_epoch, null);
});
test("konfigurasi tidak membuat batas jam kerja bawaan dan memerlukan jangkar sah", () => {
  assert.throws(() => validasiAturan({ ...aturan, batas_kerja_mingguan_menit: undefined }));
  assert.throws(() => validasiAturan({ ...aturan, jenis_minggu: "tetap" }));
  assert.equal(validasiAturan({ ...aturan, jenis_minggu: "tetap", jangkar_minggu: t }).jangkar_minggu, t);
  assert.ok(samaPotret({ a: 1, b: { x: 2, y: 3 } }, { b: { y: 3, x: 2 }, a: 1 }));
});
test("benturan identik, sebagian dan lintas unit selalu memblokir; batas bersambung hanya melanggar istirahat", () => {
  for (const [mulai, akhir] of [[t, t + 3600], [t + 1800, t + 7200], [t - 1800, t + 100]]) {
    const x = periksa([p(t, t + 3600)], { lainnya: [p(mulai, akhir, { jadwal_uuid: "unit-lain", versi_uuid: "lain", status: "terbit" })] });
    assert.ok(x.temuan.some((x) => x.aturan === "benturan")); assert.equal(x.boleh_diajukan, false);
  }
  const x = periksa([p(t, t + 3600), p(t + 3600, t + 7200)]);
  assert.ok(!x.temuan.some((x) => x.aturan === "benturan"));
  assert.ok(x.temuan.some((x) => x.aturan === "istirahat_minimum" && x.jeda_menit === 0));
});
test("jeda di bawah, tepat dan di atas 8 jam; pemeriksaan shift sebelum dan sesudah", () => {
  for (const jam of [7, 8, 9]) {
    const x = periksa([p(t, t + 3600)], { lainnya: [p(t + (jam + 1) * 3600, t + (jam + 2) * 3600, { jadwal_uuid: "lain", versi_uuid: "l", status: "terbit" })] });
    assert.equal(x.boleh_diajukan, jam >= 8);
  }
  const x = periksa([p(t, t + 3600)], { aturan: { ...aturan, tingkat_istirahat: "peringatan" }, lainnya: [p(t - 7200, t - 3600)] });
  assert.equal(x.boleh_diajukan, true); assert.equal(x.temuan[0].tingkat, "peringatan");
});
test("jam mingguan dibagi pada batas minggu kalender maupun jangkar tetap", () => {
  const x = periksa([p(t - 3600, t + 3600)], { aturan: { ...aturan, batas_kerja_mingguan_menit: 60 } });
  assert.equal(x.boleh_diajukan, true);
  const y = periksa([p(t - 3600, t + 7200)], { aturan: { ...aturan, batas_kerja_mingguan_menit: 60, jenis_minggu: "tetap", jangkar_minggu: t } });
  assert.equal(y.temuan.find((x) => x.aturan === "jam_mingguan").aktual_menit, 120);
});
test("versi terbit dan revisi tidak dihitung ganda; kombinasi durasi maksimum beberapa keluarga tetap memblokir", () => {
  const lain = [p(t + 86400, t + 86400 + 3600, { jadwal_uuid: "a", versi_uuid: "a1", status: "terbit" }), p(t + 86400, t + 86400 + 3600, { jadwal_uuid: "a", versi_uuid: "a2", status: "draf" })];
  assert.equal(periksa([p(t, t + 3600)], { lainnya: lain, aturan: { ...aturan, batas_kerja_mingguan_menit: 120 } }).boleh_diajukan, true);
  const baris = [];
  for (let i = 0; i < 4; i++) for (let v = 0; v < 2; v++) baris.push(p(t + (i + 1) * 86400, t + (i + 1) * 86400 + (v === i % 2 ? 7200 : 3600), { jadwal_uuid: `j${i}`, versi_uuid: `${i}-${v}`, status: v ? "draf" : "terbit" }));
  const x = periksa([p(t, t + 3600)], { lainnya: baris, aturan: { ...aturan, batas_kerja_mingguan_menit: 480 } });
  assert.equal(x.temuan.find((x) => x.aturan === "jam_mingguan").aktual_menit, 540);
});
test("kebutuhan staf menghitung pegawai unik, tanggal khusus mengganti hari biasa dan libur dikecualikan", () => {
  const kebutuhan = [{ pola_shift_uuid: "pagi", hari_minggu: 1, tanggal_kerja: null, minimum_staf: 1 }, { pola_shift_uuid: "pagi", tanggal_kerja: t, minimum_staf: 3 }];
  const x = periksa([p(t, t + 3600), p(t, t + 3600), p(null, null, { libur: true, kepegawaian_uuid: "libur" })], { kebutuhan });
  assert.equal(x.temuan.find((x) => x.aturan === "kebutuhan_staf" && x.tanggal_kerja === t).kekurangan, 2);
  const y = periksa([], { kebutuhan, aturan: { ...aturan, tingkat_staf: "pemblokir" } }); assert.equal(y.boleh_diajukan, false);
});
test("salin 31 ke 30 hari melaporkan tanggal dilewati; rotasi offset dan jangkar", () => {
  const x = rencanaSalin([p(0, 1, { tanggal_kerja: tanggalWib(2026, 10, 31) }), p(0, 1, { tanggal_kerja: tanggalWib(2026, 10, 1) })], periode);
  assert.equal(x.dilewati.length, 1); assert.equal(x.penempatan[0].tanggal_kerja, periode);
  const y = rencanaRotasi(periode, ["P", "M", "L"], periode, [{ kepegawaian_uuid: "pegawai-fiktif", offset: 1 }]);
  assert.equal(y.length, 30); assert.equal(y[0].pola_shift_uuid, "M"); assert.equal(y[2].pola_shift_uuid, "P");
});
