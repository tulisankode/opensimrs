import { test } from "node:test";
import assert from "node:assert/strict";
import {
  imltdAdaReaktif, imltdLengkap, samarkanImltd, samarkanBarisKantong, samarkanDonor, statusKantongRingkas, sqlKantongReaktif,
  tglLokalEpoch, tambahHariIso,
} from "../src/utd/bersama.js";
import utd from "../src/utd/rute.js";

// Penyamaran hasil IMLTD reaktif & identitas donor (KF-18) serta helper tanggal lokal UTD. Fungsi murni: tanpa database.

const imltdAwal = (ubah = {}) => ({
  uuid: "i1", aftap_uuid: "a1", faskes_uuid: "f1", status_akhir: "non_reaktif",
  hiv_hasil: "non_reaktif", hbsag_hasil: "non_reaktif", hcv_hasil: "non_reaktif", sifilis_hasil: "non_reaktif",
  hiv_metode: "ELISA", hasil_konfirmasi: [], dilepas_oleh: null, dilepas_pada: null, ...ubah,
});

test("imltdAdaReaktif: mendeteksi reaktif di status akhir, hasil awal, maupun riwayat konfirmasi", () => {
  assert.equal(imltdAdaReaktif(null), false);
  assert.equal(imltdAdaReaktif(imltdAwal()), false);
  assert.equal(imltdAdaReaktif(imltdAwal({ status_akhir: "reaktif", hcv_hasil: "reaktif" })), true);
  // Hasil awal reaktif yang dikoreksi konfirmasi menjadi non-reaktif tetap dianggap memuat hasil reaktif.
  assert.equal(imltdAdaReaktif(imltdAwal({ hiv_hasil: "reaktif", hasil_konfirmasi: [{ parameter: "hiv", hasil: "non_reaktif" }] })), true);
  assert.equal(imltdAdaReaktif(imltdAwal({ hasil_konfirmasi: [{ parameter: "sifilis", hasil: "reaktif" }] })), true);
});

test("samarkanImltd: tanpa izin, baris reaktif hanya berisi status ringkas tanpa nilai per parameter", () => {
  const reaktif = imltdAwal({ status_akhir: "reaktif", hiv_hasil: "reaktif", hasil_konfirmasi: [{ parameter: "hiv", hasil: "reaktif" }] });
  const s = samarkanImltd(reaktif, false);
  assert.deepEqual(s, { uuid: "i1", aftap_uuid: "a1", status_akhir: "reaktif", lengkap: true, dilepas_oleh: null, dilepas_pada: null, disamarkan: true });
  assert.ok(!JSON.stringify(s).includes("hiv"));
  // Berizin → utuh; tanpa reaktif → utuh (tidak ada yang perlu disembunyikan).
  assert.equal(samarkanImltd(reaktif, true), reaktif);
  const bersih = imltdAwal();
  assert.equal(samarkanImltd(bersih, false), bersih);
  assert.equal(samarkanImltd(null, false), null);
});

test("imltdLengkap: semua parameter punya hasil awal", () => {
  assert.equal(imltdLengkap(imltdAwal()), true);
  assert.equal(imltdLengkap(imltdAwal({ hcv_hasil: null })), false);
  assert.equal(samarkanImltd(imltdAwal({ hiv_hasil: "reaktif", hcv_hasil: null }), false).lengkap, false);
});

test("samarkanBarisKantong: identitas donor dihapus pada kantong reaktif tanpa izin; kolom bantu reaktif dibuang", () => {
  const baris = { uuid: "a1", no_kantong: "K-1", status_kantong: "karantina_reaktif", donor_uuid: "d1", no_donor: "DNR-1", nama_donor: "Donor Fiktif", reaktif: true };
  const s = samarkanBarisKantong(baris, false);
  assert.equal(s.no_kantong, "K-1");
  assert.equal(s.status_kantong, "karantina_reaktif");
  assert.equal(s.donor_uuid, null);
  assert.equal(s.no_donor, null);
  assert.equal(s.nama_donor, null);
  assert.equal(s.identitas_disamarkan, true);
  assert.ok(!("reaktif" in s));
  assert.equal(samarkanBarisKantong(baris, true).nama_donor, "Donor Fiktif");
  assert.equal(samarkanBarisKantong({ ...baris, reaktif: false }, false).nama_donor, "Donor Fiktif");
  assert.ok(!("identitas_disamarkan" in samarkanBarisKantong({ ...baris, reaktif: false }, false)));
});

test("samarkanDonor & statusKantongRingkas: info penahanan/notifikasi reaktif disembunyikan tanpa izin", () => {
  const d = {
    uuid: "d1", nama: "Donor Fiktif", status_aktif: "ditahan", alasan_ditahan: "Hasil IMLTD reaktif pada kantong K-1",
    perlu_notifikasi: true, notifikasi_selesai: false, catatan_notifikasi: "x", notifikasi_pada: 1760000000,
  };
  const s = samarkanDonor(d, false);
  assert.equal(s.status_aktif, "ditahan");
  assert.equal(s.alasan_ditahan, null);
  assert.equal(s.perlu_notifikasi, null);
  assert.equal(s.catatan_notifikasi, null);
  assert.equal(samarkanDonor(d, true), d);
  assert.equal(statusKantongRingkas("karantina_reaktif", false), "karantina");
  assert.equal(statusKantongRingkas("karantina_reaktif", true), "karantina_reaktif");
  assert.equal(statusKantongRingkas("tersedia", false), "tersedia");
});

test("sqlKantongReaktif: memeriksa status kantong, status akhir, hasil awal per parameter, & konfirmasi", () => {
  const sql = sqlKantongReaktif("a");
  for (const bagian of ["a.status_kantong = 'karantina_reaktif'", "ir.status_akhir = 'reaktif'", "ir.hiv_hasil", "ir.sifilis_hasil", "hasil_konfirmasi @>", "ir.faskes_uuid = a.faskes_uuid"])
    assert.ok(sql.includes(bagian), bagian);
});

test("tglLokalEpoch: tanggal kalender WIB, bukan UTC", () => {
  // 2026-10-16T18:30:00Z = 2026-10-17 01.30 WIB.
  assert.equal(tglLokalEpoch(Date.UTC(2026, 9, 16, 18, 30) / 1000), "2026-10-17");
  assert.equal(tglLokalEpoch(String(Date.UTC(2026, 9, 16, 10, 0) / 1000)), "2026-10-16");
});

test("tambahHariIso: penjumlahan hari kalender lintas bulan/tahun", () => {
  assert.equal(tambahHariIso("2026-10-17", 60), "2026-12-16");
  assert.equal(tambahHariIso("2026-12-31", 1), "2027-01-01");
  assert.equal(tambahHariIso("2028-02-28", 1), "2028-02-29");
});

// Regresi: setiap rute GET UTD wajib punya penjaga izin (middleware) sebelum handler, bukan hanya cek login.
test("setiap rute GET UTD memasang middleware izin", () => {
  const tanpaIzin = [];
  const telusuri = (router) => {
    for (const lapisan of router.stack) {
      if (lapisan.route) {
        if (lapisan.route.methods.get && lapisan.route.stack.length < 2) tanpaIzin.push(lapisan.route.path);
      } else if (lapisan.handle?.stack) {
        telusuri(lapisan.handle);
      }
    }
  };
  telusuri(utd);
  assert.deepEqual(tanpaIzin, []);
});
