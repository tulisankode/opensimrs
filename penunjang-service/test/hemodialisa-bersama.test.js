import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PARAMETER,
  cekBatasDializer,
  hitungAdekuasi,
  kunciKirimJadwal,
  normalisasiKomplikasi,
  normalisasiParameter,
  tanggalRutin,
  tanggalValid,
  waktuUkur,
} from "../src/hemodialisa/bersama.js";
import { validasiAsesmen, validasiPasca } from "../src/hemodialisa/sesi.js";
import { kodeTarifSesi } from "../src/hemodialisa/tagihan.js";
import { hemodialisaPermission } from "../../auth-service/src/helpers/permission-list.js";

// STD-0033 — fungsi murni Unit Hemodialisa (tanpa database).

test("normalisasiParameter: nilai + satuan dari skema, menolak parameter/satuan/nilai di luar kontrak", () => {
  assert.deepEqual(normalisasiParameter({ td_sistolik: 130, nadi: { nilai: "82", satuan: "x/menit" } }), {
    td_sistolik: { nilai: 130, satuan: "mmHg" },
    nadi: { nilai: 82, satuan: "x/menit" },
  });
  assert.throws(() => normalisasiParameter({ gula_darah: 100 }), /tidak dikenal/);
  assert.throws(() => normalisasiParameter({ qb_ml_menit: { nilai: 250, satuan: "L/jam" } }), /Satuan QB harus mL\/menit/);
  assert.throws(() => normalisasiParameter({ nadi: "cepat" }), /harus berupa angka/);
  assert.throws(() => normalisasiParameter({ nadi: true }), /harus berupa angka/);
  assert.throws(() => normalisasiParameter({ spo2: 140 }), /batas kewajaran/);
  assert.throws(() => normalisasiParameter({}), /minimal berisi satu/);
  assert.throws(() => normalisasiParameter([1]), /harus berupa objek/);
  for (const [kode, p] of Object.entries(PARAMETER)) assert.ok(p.satuan && p.min < p.maks, `skema ${kode} tidak lengkap`);
});

test("normalisasiKomplikasi: kategori dikenal saja, tanpa duplikat", () => {
  assert.deepEqual(normalisasiKomplikasi(["kram", "kram", "hipotensi"]), ["kram", "hipotensi"]);
  assert.deepEqual(normalisasiKomplikasi(undefined), []);
  assert.throws(() => normalisasiKomplikasi(["pingsan"]), /tidak dikenal/);
});

test("tanggalRutin: Senin & Kamis dalam dua minggu, batas periode, hari tidak valid", () => {
  // 2026-10-19 = Senin
  assert.deepEqual(tanggalRutin([1, 4], "2026-10-19", "2026-11-01"), ["2026-10-19", "2026-10-22", "2026-10-26", "2026-10-29"]);
  assert.throws(() => tanggalRutin([8], "2026-10-19", "2026-10-25"), /1 \(Senin\) sampai 7/);
  assert.throws(() => tanggalRutin([1], "2026-10-25", "2026-10-19"), /tidak boleh sebelum/);
  assert.throws(() => tanggalRutin([1], "2026-10-19", "2027-03-01"), /maksimal 91 hari/);
  assert.throws(() => tanggalRutin([7], "2026-10-19", "2026-10-24"), /Tidak ada tanggal/);
});

test("tanggalValid & waktuUkur menolak format/tanggal tidak sah dan waktu di masa depan", () => {
  assert.equal(tanggalValid("2026-02-28"), "2026-02-28");
  assert.throws(() => tanggalValid("2026-02-30"), /YYYY-MM-DD/);
  assert.throws(() => tanggalValid("19-10-2026"), /YYYY-MM-DD/);
  const kini = Math.floor(Date.now() / 1000);
  assert.equal(waktuUkur(kini), kini);
  assert.throws(() => waktuUkur(kini + 3600), /masa depan/);
  assert.throws(() => waktuUkur("kemarin"), /epoch detik/);
});

test("cekBatasDializer: pemakaian berikutnya, batas tercapai, dan dializer dihentikan ditolak", () => {
  assert.deepEqual(cekBatasDializer({ serial: "D-1", status: "aktif", jumlah_pakai: 0, pemakaian_maksimal: 1 }), { boleh: true, pemakaian_ke: 1 });
  assert.deepEqual(cekBatasDializer({ serial: "D-1", status: "aktif", jumlah_pakai: 4, pemakaian_maksimal: 5 }), { boleh: true, pemakaian_ke: 5 });
  const penuh = cekBatasDializer({ serial: "D-1", status: "aktif", jumlah_pakai: 5, pemakaian_maksimal: 5 });
  assert.equal(penuh.boleh, false);
  assert.match(penuh.alasan, /batas pemakaian \(5\/5\)/);
  assert.equal(cekBatasDializer({ serial: "D-2", status: "berhenti", jumlah_pakai: 1, pemakaian_maksimal: 5 }).boleh, false);
  assert.equal(cekBatasDializer(null).boleh, false);
});

test("hitungAdekuasi: Daugirdas II & URR dengan masukan lengkap, belum tersedia + alasan bila kurang/tidak masuk akal", () => {
  const h = hitungAdekuasi({ bun_pre: 60, bun_post: 20, durasi_jam: 4, uf_liter: 2, berat_pasca_kg: 70 });
  assert.equal(h.status, "tersedia");
  assert.equal(h.kt_v, 1.28);
  assert.equal(h.urr, 66.67);
  assert.match(h.metode, /perlu disahkan/);
  const kurang = hitungAdekuasi({ bun_pre: 60 });
  assert.equal(kurang.status, "belum_tersedia");
  assert.match(kurang.alasan, /bun_post/);
  assert.equal(hitungAdekuasi({ bun_pre: 20, bun_post: 30, durasi_jam: 4, uf_liter: 2, berat_pasca_kg: 70 }).status, "belum_tersedia");
  assert.equal(hitungAdekuasi({ bun_pre: 60, bun_post: 2, durasi_jam: 40, uf_liter: 2, berat_pasca_kg: 70 }).status, "belum_tersedia");
  assert.equal(hitungAdekuasi({ bun_pre: 60, bun_post: 20, durasi_jam: 4, uf_liter: -1, berat_pasca_kg: 70 }).status, "belum_tersedia");
});

test("validasiAsesmen & validasiPasca: data wajib minimum, tanpa ambang klinis", () => {
  const a = validasiAsesmen({ identitas_terkonfirmasi: true, resep_terkonfirmasi: true, berat_pra_kg: 62.5, td_sistolik: 150, td_diastolik: 90, nadi: 88 });
  assert.equal(a.berat_pra_kg, 62.5);
  assert.equal(a.suhu, null);
  assert.throws(() => validasiAsesmen({ resep_terkonfirmasi: true, berat_pra_kg: 60, td_sistolik: 120, td_diastolik: 80, nadi: 80 }), /Identitas/);
  assert.throws(() => validasiAsesmen({ identitas_terkonfirmasi: true, resep_terkonfirmasi: true, td_sistolik: 120, td_diastolik: 80, nadi: 80 }), /berat_pra_kg wajib/);
  const p = validasiPasca({ berat_pasca_kg: 60, uf_aktual_ml: 2500, td_sistolik: 130, td_diastolik: 80, nadi: 80 });
  assert.equal(p.uf_aktual_ml, 2500);
  assert.throws(() => validasiPasca({ berat_pasca_kg: 60, td_sistolik: 130, td_diastolik: 80, nadi: 80 }), /uf_aktual_ml wajib/);
});

test("kunci idempoten jadwal berubah hanya bila jadwal berubah; kode tarif per jenis HD", () => {
  assert.equal(kunciKirimJadwal({ uuid: "j1", versi: 3, updated_at: "1760000000" }), "jadwal:j1:v3");
  assert.notEqual(kunciKirimJadwal({ uuid: "j1", versi: 1, updated_at: 5 }), kunciKirimJadwal({ uuid: "j1", versi: 2, updated_at: 5 }));
  assert.deepEqual(kodeTarifSesi("kronis"), ["HD-KRONIS", "HD-TINDAKAN"]);
});

test("permission-list: modul Hemodialisa memuat submodul & aksi yang dipakai rute", () => {
  const sub = Object.fromEntries(hemodialisaPermission.subModules.map((s) => [s.name, s]));
  assert.deepEqual(sub["Sesi HD"].allows, ["READ", "ASESMEN", "MULAI", "OBSERVASI", "TUTUP", "KOREKSI", "BATAL"]);
  assert.ok(sub["Resep HD"].allows.includes("SAHKAN"));
  assert.deepEqual(sub.Datamaster.features.map((f) => f.name), ["Mesin & Shift", "Aturan Reuse Dializer", "Mapping HDIS"]);
});
