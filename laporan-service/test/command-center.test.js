import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KATALOG_AMBANG, SUMBER_AMBANG, evaluasiAmbang, kunciPeringatan, labelKelas, melampaui, persen, sampelAmbang, statusSetelahTindakan,
  susunAntreanPoli, susunTempatTidur, tingkatPelanggaran,
} from "../src/helpers/command-center.js";
import { cocokIzin } from "../src/helpers/cocok-izin.js";
import CommandCenterValidator from "../src/validations/command-center-validation.js";

test("setiap kode ambang punya sumber data", () => {
  for (const a of KATALOG_AMBANG) assert.ok(SUMBER_AMBANG[a.kode], a.kode);
});

test("persen & BOR: total 0 → null (belum tersedia), bukan 0", () => {
  assert.equal(persen(3, 4), 75);
  assert.equal(persen(0, 0), null);
  assert.equal(persen(2, 3), 66.7);
});

test("labelKelas: kode ruangan → label, cadangan dari lokasi bila tidak dikenal", () => {
  assert.equal(labelKelas(1), "Kelas 1");
  assert.equal(labelKelas(4), "VIP");
  assert.equal(labelKelas(null, "Kelas 2"), "Kelas 2");
  assert.equal(labelKelas(null), "Tanpa kelas");
});

test("susunTempatTidur: status tak terpetakan tidak dihitung kosong (KT-6), agregat per kelas", () => {
  const hasil = susunTempatTidur([
    { ruangan_uuid: "r1", ruangan: "Melati", kelas_kode: 3, total: 4, terisi: 3, kosong: 0, cadangan_total: 1, cadangan_terisi: 1 },
    { ruangan_uuid: "r2", ruangan: "Mawar", kelas_kode: 3, total: 2, terisi: 0, kosong: 2, cadangan_total: 0, cadangan_terisi: 0 },
    { ruangan_uuid: "r3", ruangan: "Anggrek", kelas_kode: 4, total: 2, terisi: 2, kosong: 0, cadangan_total: 0, cadangan_terisi: 0 },
    { ruangan_uuid: "r4", ruangan: "Kosong", kelas_kode: 1, total: 0, terisi: 0, kosong: 0, cadangan_total: 0, cadangan_terisi: 0 },
  ]);
  assert.equal(hasil.per_ruangan.length, 3);
  const melati = hasil.per_ruangan.find((r) => r.ruangan === "Melati");
  assert.equal(melati.lainnya, 1);
  assert.equal(melati.bor, 75);
  assert.deepEqual(hasil.ringkasan, { ruangan: 3, total: 8, terisi: 5, kosong: 2, lainnya: 1, bor: 62.5, cadangan_total: 1, cadangan_terisi: 1 });
  assert.deepEqual(hasil.per_kelas.map((k) => [k.kelas, k.total, k.terisi, k.bor]), [["Kelas 3", 6, 3, 50], ["VIP", 2, 2, 100]]);
  assert.equal(susunTempatTidur([]).ringkasan.bor, null);
});

test("susunAntreanPoli: rata-rata tunggu tertimbang sampel, terlama = maksimum poli", () => {
  const hasil = susunAntreanPoli([
    { poli_uuid: "p1", poli: "Anak", booking: 1, menunggu: 3, dilayani: 1, selesai: 2, rata_tunggu_menit: 30, sampel_tunggu: 3, terlama_menunggu_menit: 75.4 },
    { poli_uuid: "p2", poli: "Umum", booking: 0, menunggu: 1, dilayani: 0, selesai: 1, rata_tunggu_menit: 10, sampel_tunggu: 1, terlama_menunggu_menit: null },
  ]);
  assert.equal(hasil.ringkasan.menunggu, 4);
  assert.equal(hasil.ringkasan.rata_tunggu_menit, 25);
  assert.equal(hasil.ringkasan.terlama_menunggu_menit, 75);
  assert.equal(susunAntreanPoli([]).ringkasan.rata_tunggu_menit, null);
});

test("melampaui & tingkatPelanggaran: operator > / >=, kritis didahulukan, ambang nonaktif diabaikan", () => {
  assert.equal(melampaui(85, ">", 85), false);
  assert.equal(melampaui(85, ">=", 85), true);
  assert.equal(melampaui(null, ">", 1), false);
  const a = { operator: ">", batas_peringatan: 85, batas_kritis: 95, aktif: true };
  assert.equal(tingkatPelanggaran(80, a), null);
  assert.deepEqual(tingkatPelanggaran(90, a), { tingkat: "peringatan", batas: 85, operator: ">" });
  assert.deepEqual(tingkatPelanggaran(96, a), { tingkat: "kritis", batas: 95, operator: ">" });
  assert.equal(tingkatPelanggaran(96, { ...a, aktif: false }), null);
  assert.deepEqual(tingkatPelanggaran(3, { operator: ">=", batas_peringatan: null, batas_kritis: 3 }), { tingkat: "kritis", batas: 3, operator: ">=" });
});

test("evaluasiAmbang: per sasaran dengan kunci stabil; tanpa ambang tidak ada peringatan", () => {
  const tt = susunTempatTidur([
    { ruangan_uuid: "r1", ruangan: "Melati", kelas_kode: 3, total: 4, terisi: 4, kosong: 0 },
    { ruangan_uuid: "r2", ruangan: "Mawar", kelas_kode: 3, total: 4, terisi: 1, kosong: 3 },
  ]);
  const sampel = sampelAmbang({ tempatTidur: tt });
  assert.equal(evaluasiAmbang([], sampel).length, 0);
  const hasil = evaluasiAmbang([{ kode: "bor_ruangan", operator: ">", batas_peringatan: 90, batas_kritis: null, aktif: true }], sampel);
  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].kunci, kunciPeringatan("bor_ruangan", "r1"));
  assert.equal(hasil[0].sasaran_label, "Melati");
  assert.equal(hasil[0].nilai, 100);
});

test("sampelAmbang: lama IGD dikonversi ke jam, bagian gagal (null) dilewati", () => {
  const sampel = sampelAmbang({
    igd: { ringkasan: { dirawat: 5, terlama_dirawat_menit: 390, menunggu_kamar: 2, menunggu_kamar_terlama_menit: null } },
  });
  assert.deepEqual(sampel.find((s) => s.kode === "igd_lama_jam").nilai, 6.5);
  assert.equal(sampel.find((s) => s.kode === "igd_menunggu_kamar_jam").nilai, null);
  assert.equal(sampel.some((s) => s.kode === "bor_total"), false);
});

test("statusSetelahTindakan: eskalasi tidak turun menjadi ditinjau", () => {
  assert.equal(statusSetelahTindakan("aktif", "tinjau"), "ditinjau");
  assert.equal(statusSetelahTindakan("aktif", "eskalasi"), "dieskalasi");
  assert.equal(statusSetelahTindakan("dieskalasi", "tinjau"), "dieskalasi");
});

test("validasi ambang & tindakan", () => {
  const ok = CommandCenterValidator.AMBANG.parse({ ambang: [{ kode: "bor_total", batas_peringatan: 85, batas_kritis: 95 }] });
  assert.equal(ok.ambang[0].operator, ">");
  assert.equal(ok.ambang[0].aktif, true);
  assert.throws(() => CommandCenterValidator.AMBANG.parse({ ambang: [{ kode: "bor_total", batas_peringatan: 95, batas_kritis: 85 }] }));
  assert.throws(() => CommandCenterValidator.AMBANG.parse({ ambang: [{ kode: "tidak_ada", batas_peringatan: 1 }] }));
  assert.throws(() => CommandCenterValidator.AMBANG.parse({ ambang: [{ kode: "bor_total", operator: "<", batas_peringatan: 1 }] }));
  assert.throws(() => CommandCenterValidator.AMBANG.parse({ ambang: [{ kode: "bor_total", batas_peringatan: -1 }] }));
  assert.throws(() => CommandCenterValidator.AMBANG.parse({ ambang: [{ kode: "bor_total" }, { kode: "bor_total" }] }));
  assert.equal(CommandCenterValidator.TINDAKAN.parse({ uuid: "x", jenis: "tinjau", catatan: "  Sudah dikoordinasikan  " }).catatan, "Sudah dikoordinasikan");
  assert.throws(() => CommandCenterValidator.TINDAKAN.parse({ uuid: "x", jenis: "eskalasi", catatan: "Perlu bantuan" }));
  assert.throws(() => CommandCenterValidator.TINDAKAN.parse({ uuid: "x", jenis: "tinjau", catatan: "" }));
});

test("izin Command Center terpisah per aksi", () => {
  const izin = [{ module: "Dashboard", subModules: [{ name: "Command Center", allows: ["READ"] }] }];
  assert.equal(cocokIzin(izin, "Dashboard", "Command Center", "READ"), true);
  assert.equal(cocokIzin(izin, "Dashboard", "Command Center", "ATUR AMBANG"), false);
  assert.equal(cocokIzin(izin, "Dashboard", "Command Center", "ESKALASI PERINGATAN"), false);
  assert.equal(cocokIzin([{ module: "Dashboard", subModules: [] }], "Dashboard", "Command Center", "READ"), false);
});
