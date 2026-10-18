import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KATEGORI_LINEN,
  URUTAN_TAHAP,
  beratPositif,
  bulatPositif,
  cekPilihan,
  cekTransisiTahap,
  epochOpsional,
  periode,
  rincianUnik,
  statusPermintaan,
  teks,
} from "../src/laundry/bersama.js";
import { kunciStok } from "../src/laundry/stok.js";
import { laundryPermission } from "../../auth-service/src/helpers/permission-list.js";

const tahapan = (pencucian, pengeringan, setrika_lipat) =>
  Object.entries({ pencucian, pengeringan, setrika_lipat }).map(([tahap, status]) => ({ tahap, status }));

test("bulatPositif: jumlah linen per unit harus bilangan bulat > 0", () => {
  assert.equal(bulatPositif("12", "jumlah"), 12);
  assert.throws(() => bulatPositif(0, "jumlah"), /lebih besar dari nol/);
  assert.throws(() => bulatPositif(-3, "jumlah"), /lebih besar dari nol/);
  assert.throws(() => bulatPositif(2.5, "jumlah"), /bilangan bulat/);
  assert.throws(() => bulatPositif("", "jumlah"), /wajib diisi/);
  assert.throws(() => bulatPositif("abc", "jumlah"), /harus berupa angka/);
});

test("beratPositif: berat batch dalam kg boleh desimal (koma/titik), dibulatkan 3 angka", () => {
  assert.equal(beratPositif("12,5", "berat_kg"), 12.5);
  assert.equal(beratPositif(0.1234, "berat_kg"), 0.123);
  assert.throws(() => beratPositif(0, "berat_kg"), /lebih besar dari nol/);
});

test("epochOpsional & periode: memvalidasi epoch detik dan rentang", () => {
  assert.equal(epochOpsional(undefined, "waktu", 99), 99);
  assert.equal(epochOpsional("1700000000", "waktu", 99), 1700000000);
  assert.throws(() => epochOpsional("kemarin", "waktu", 99), /harus berupa angka/);
  assert.throws(() => epochOpsional(1.5, "waktu", 99), /epoch detik/);
  assert.deepEqual(periode({}), { dari: null, sampai: null });
  assert.deepEqual(periode({ dari: "10", sampai: "20" }), { dari: 10, sampai: 20 });
  assert.throws(() => periode({ dari: 20, sampai: 10 }), /Rentang tanggal tidak valid/);
});

test("rincianUnik: menolak jenis linen ganda & rincian kosong, mengurutkan agar urutan kunci stok tetap", () => {
  const hasil = rincianUnik([{ jenis_linen_uuid: "b" }, { jenis_linen_uuid: "a" }], "jenis_linen_uuid");
  assert.deepEqual(hasil.map((x) => x.jenis_linen_uuid), ["a", "b"]);
  assert.throws(() => rincianUnik([], "jenis_linen_uuid"), /wajib diisi/);
  assert.throws(() => rincianUnik([{ jenis_linen_uuid: "a" }, { jenis_linen_uuid: "a" }], "jenis_linen_uuid"), /lebih dari sekali/);
  assert.throws(() => rincianUnik([{}], "jenis_linen_uuid"), /wajib diisi/);
});

test("cekPilihan: kategori linen hanya biasa/infeksius/bernoda_berat", () => {
  assert.equal(cekPilihan("infeksius", KATEGORI_LINEN, "kategori"), "infeksius");
  assert.throws(() => cekPilihan("steril", KATEGORI_LINEN, "kategori"), /kategori harus salah satu/);
  assert.equal(teks("  LNR-01 "), "LNR-01");
});

test("cekTransisiTahap: tahapan maju berurutan; setrika/lipat selesai menutup batch", () => {
  assert.deepEqual(URUTAN_TAHAP, ["pencucian", "pengeringan", "setrika_lipat"]);
  assert.deepEqual(cekTransisiTahap(tahapan("belum", "belum", "belum"), "pencucian", "berjalan"), { selesaiBatch: false });
  assert.deepEqual(cekTransisiTahap(tahapan("berjalan", "belum", "belum"), "pencucian", "selesai"), { selesaiBatch: false });
  assert.throws(() => cekTransisiTahap(tahapan("berjalan", "belum", "belum"), "pengeringan", "selesai"), /Pencucian harus diselesaikan/);
  assert.throws(() => cekTransisiTahap(tahapan("selesai", "selesai", "belum"), "pencucian", "berjalan"), /sudah selesai/);
  assert.throws(() => cekTransisiTahap(tahapan("selesai", "belum", "belum"), "pengeringan", "belum"), /berjalan atau selesai/);
  assert.throws(() => cekTransisiTahap(tahapan("selesai", "berjalan", "belum"), "pengeringan", "berjalan"), /sudah berstatus/);
  assert.throws(() => cekTransisiTahap(tahapan("belum", "belum", "belum"), "lipat", "selesai"), /tahap harus salah satu/);
  assert.deepEqual(cekTransisiTahap(tahapan("selesai", "selesai", "berjalan"), "setrika_lipat", "selesai"), { selesaiBatch: true });
});

test("statusPermintaan: distribusi sebagian tetap 'sebagian' sampai semua jumlah terpenuhi", () => {
  assert.equal(statusPermintaan([{ jumlah_diminta: 10, jumlah_terpenuhi: 0 }]), "menunggu");
  assert.equal(statusPermintaan([{ jumlah_diminta: 10, jumlah_terpenuhi: 4 }, { jumlah_diminta: 5, jumlah_terpenuhi: 5 }]), "sebagian");
  assert.equal(statusPermintaan([{ jumlah_diminta: "10", jumlah_terpenuhi: "10" }, { jumlah_diminta: 5, jumlah_terpenuhi: 6 }]), "selesai");
});

test("kunciStok: stok bersih laundry tidak bergantung lokasi_uuid; ruangan dibedakan per lokasi & faskes", () => {
  assert.equal(kunciStok("f1", "laundry", "x", "j1"), kunciStok("f1", "laundry", null, "j1"));
  assert.notEqual(kunciStok("f1", "ruangan", "r1", "j1"), kunciStok("f1", "ruangan", "r2", "j1"));
  assert.notEqual(kunciStok("f1", "ruangan", "r1", "j1"), kunciStok("f2", "ruangan", "r1", "j1"));
});

// Setiap izin yang dipakai backend Laundry harus terdaftar di permission-list (editor peran) — bila tidak, tidak
// ada peran yang bisa diberi akses ke rute tersebut.
test("izin backend Laundry terdaftar di laundryPermission", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "src", "laundry");
  const sumber = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
  const ada = (sub, aksi, fitur) => {
    const s = laundryPermission.subModules.find((x) => x.name === sub);
    const allows = fitur ? s?.features?.find((x) => x.name === fitur)?.allows : s?.allows;
    return (allows ?? []).includes(aksi);
  };
  const pakai = [...sumber.matchAll(/izinLaundry\("([^"]+)", "([^"]+)"(?:, "([^"]+)")?\)/g)];
  assert.ok(pakai.length >= 20);
  for (const [, sub, aksi, fitur] of pakai) assert.ok(ada(sub, aksi, fitur), `${sub} › ${fitur ?? ""} › ${aksi} tidak ada di permission-list`);
});
