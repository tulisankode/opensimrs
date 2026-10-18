import { test } from "node:test";
import assert from "node:assert/strict";
import { cekKompatibilitas, kantongUniversal, klasifikasiKelompokKomponen, layakOPosPasien, syaratOverrideDarurat } from "../src/bank-darah/kompatibilitas.js";

test("klasifikasiKelompokKomponen: mengenali pola kode/nama komponen", () => {
  assert.equal(klasifikasiKelompokKomponen("PRC", "Packed Red Cell"), "sel_darah_merah");
  assert.equal(klasifikasiKelompokKomponen("WB", "Whole Blood"), "sel_darah_merah");
  assert.equal(klasifikasiKelompokKomponen("FFP", "Fresh Frozen Plasma"), "plasma");
  assert.equal(klasifikasiKelompokKomponen("TC", "Trombosit Konsentrat"), "trombosit");
  assert.equal(klasifikasiKelompokKomponen("XX", "Komponen Lain"), "lainnya");
});

test("sel darah merah: pasien O hanya menerima O", () => {
  for (const gol of ["A", "B", "AB"]) {
    const r = cekKompatibilitas({ kelompokKomponen: "sel_darah_merah", golonganPasien: "O", rhesusPasien: "positif", golonganKantong: gol, rhesusKantong: "positif", namaKomponen: "PRC" });
    assert.equal(r.kompatibel, false);
  }
  const ok = cekKompatibilitas({ kelompokKomponen: "sel_darah_merah", golonganPasien: "O", rhesusPasien: "positif", golonganKantong: "O", rhesusKantong: "positif" });
  assert.equal(ok.kompatibel, true);
});

test("sel darah merah: pasien AB menerima AB, A, B, O", () => {
  for (const gol of ["AB", "A", "B", "O"]) {
    const r = cekKompatibilitas({ kelompokKomponen: "sel_darah_merah", golonganPasien: "AB", rhesusPasien: "positif", golonganKantong: gol, rhesusKantong: "positif" });
    assert.equal(r.kompatibel, true, `AB seharusnya menerima ${gol}`);
  }
});

test("sel darah merah: pasien Rh negatif hanya menerima Rh negatif", () => {
  const r = cekKompatibilitas({ kelompokKomponen: "sel_darah_merah", golonganPasien: "O", rhesusPasien: "negatif", golonganKantong: "O", rhesusKantong: "positif" });
  assert.equal(r.kompatibel, false);
  const ok = cekKompatibilitas({ kelompokKomponen: "sel_darah_merah", golonganPasien: "O", rhesusPasien: "negatif", golonganKantong: "O", rhesusKantong: "negatif" });
  assert.equal(ok.kompatibel, true);
});

test("sel darah merah: pasien Rh positif menerima Rh positif maupun negatif", () => {
  for (const rh of ["positif", "negatif"]) {
    const r = cekKompatibilitas({ kelompokKomponen: "sel_darah_merah", golonganPasien: "O", rhesusPasien: "positif", golonganKantong: "O", rhesusKantong: rh });
    assert.equal(r.kompatibel, true);
  }
});

test("KT-1: pasien A Rh+ menolak kantong PRC B Rh+ dengan pesan yang menyebut golongan & komponen", () => {
  const r = cekKompatibilitas({ kelompokKomponen: "sel_darah_merah", golonganPasien: "A", rhesusPasien: "positif", golonganKantong: "B", rhesusKantong: "positif", namaKomponen: "PRC" });
  assert.equal(r.kompatibel, false);
  assert.match(r.alasan, /Golongan kantong B.*pasien A.*PRC/);
});

test("plasma: kompatibilitas ABO berlawanan arah", () => {
  for (const gol of ["O", "A", "B", "AB"]) {
    const r = cekKompatibilitas({ kelompokKomponen: "plasma", golonganPasien: "O", rhesusPasien: "positif", golonganKantong: gol, rhesusKantong: "positif" });
    assert.equal(r.kompatibel, true, `pasien O seharusnya menerima plasma ${gol}`);
  }
  const abOnly = cekKompatibilitas({ kelompokKomponen: "plasma", golonganPasien: "AB", rhesusPasien: "positif", golonganKantong: "A", rhesusKantong: "positif" });
  assert.equal(abOnly.kompatibel, false);
});

test("plasma: Rh tidak membatasi kecocokan", () => {
  const r = cekKompatibilitas({ kelompokKomponen: "plasma", golonganPasien: "AB", rhesusPasien: "negatif", golonganKantong: "AB", rhesusKantong: "positif" });
  assert.equal(r.kompatibel, true);
});

test("trombosit: ABO non-identik menghasilkan peringatan, bukan penolakan", () => {
  const r = cekKompatibilitas({ kelompokKomponen: "trombosit", golonganPasien: "A", rhesusPasien: "positif", golonganKantong: "B", rhesusKantong: "positif", namaKomponen: "TC" });
  assert.equal(r.kompatibel, true);
  assert.equal(r.peringatan.length, 1);
});

test("trombosit: pasien Rh negatif menerima kantong Rh positif dengan peringatan Rh", () => {
  const r = cekKompatibilitas({ kelompokKomponen: "trombosit", golonganPasien: "A", rhesusPasien: "negatif", golonganKantong: "A", rhesusKantong: "positif" });
  assert.equal(r.kompatibel, true);
  assert.equal(r.peringatan.length, 1);
  assert.match(r.peringatan[0], /Rhesus negatif/);
});

test("trombosit: ABO identik & Rh sama tidak menghasilkan peringatan", () => {
  const r = cekKompatibilitas({ kelompokKomponen: "trombosit", golonganPasien: "A", rhesusPasien: "positif", golonganKantong: "A", rhesusKantong: "positif" });
  assert.equal(r.kompatibel, true);
  assert.equal(r.peringatan.length, 0);
});

test("kelompok lainnya: selalu ditolak dengan pesan arahan ke Datamaster", () => {
  const r = cekKompatibilitas({ kelompokKomponen: "lainnya", golonganPasien: "O", rhesusPasien: "positif", golonganKantong: "O", rhesusKantong: "positif", namaKomponen: "Komponen X" });
  assert.equal(r.kompatibel, false);
  assert.match(r.alasan, /belum ditetapkan/);
});

test("data golongan tidak dikenal: ditolak, tidak diasumsikan kompatibel", () => {
  const r = cekKompatibilitas({ kelompokKomponen: "sel_darah_merah", golonganPasien: "X", rhesusPasien: "positif", golonganKantong: "O", rhesusKantong: "positif" });
  assert.equal(r.kompatibel, false);
});

test("kantongUniversal: PRC O Rh negatif selalu universal; O Rh positif hanya bila diizinkan pengaturan", () => {
  assert.equal(kantongUniversal({ kelompokKomponen: "sel_darah_merah", golonganKantong: "O", rhesusKantong: "negatif", izinkanOPos: false }), true);
  assert.equal(kantongUniversal({ kelompokKomponen: "sel_darah_merah", golonganKantong: "O", rhesusKantong: "positif", izinkanOPos: false }), false);
  assert.equal(kantongUniversal({ kelompokKomponen: "sel_darah_merah", golonganKantong: "O", rhesusKantong: "positif", izinkanOPos: true }), true);
});

test("kantongUniversal: plasma AB universal, selain itu tidak", () => {
  assert.equal(kantongUniversal({ kelompokKomponen: "plasma", golonganKantong: "AB", rhesusKantong: "positif", izinkanOPos: false }), true);
  assert.equal(kantongUniversal({ kelompokKomponen: "plasma", golonganKantong: "A", rhesusKantong: "positif", izinkanOPos: false }), false);
  assert.equal(kantongUniversal({ kelompokKomponen: "trombosit", golonganKantong: "O", rhesusKantong: "negatif", izinkanOPos: false }), false);
});

test("layakOPosPasien: laki-laki selalu layak; perempuan hanya di atas 50 tahun", () => {
  assert.equal(layakOPosPasien({ genderPasien: "Male", umurPasien: 20 }), true);
  assert.equal(layakOPosPasien({ genderPasien: "Female", umurPasien: 51 }), true);
  assert.equal(layakOPosPasien({ genderPasien: "Female", umurPasien: 50 }), false);
  assert.equal(layakOPosPasien({ genderPasien: "Female", umurPasien: 30 }), false);
});

// ── syaratOverrideDarurat (KF-7/KF-8, revisi tinjauan: alasan penolakan spesifik — bukan pesan ketidakcocokan umum)
const SYARAT_LENGKAP = {
  overrideDaruratAktif: true,
  punyaIzinOverride: true,
  alasanOverride: "Pasien syok hemoragik berat, kantong golongan diminta tidak tersedia",
  kelompokKomponen: "sel_darah_merah",
  golonganKantong: "O",
  rhesusKantong: "negatif",
  izinkanOPos: false,
  layakOPos: true,
};

test("syaratOverrideDarurat: sah bila seluruh syarat terpenuhi (PRC O Rh negatif)", () => {
  const r = syaratOverrideDarurat(SYARAT_LENGKAP);
  assert.equal(r.sah, true);
  assert.equal(r.alasan, null);
});

test("syaratOverrideDarurat: sah untuk plasma AB tanpa syarat usia/jenis kelamin", () => {
  const r = syaratOverrideDarurat({ ...SYARAT_LENGKAP, kelompokKomponen: "plasma", golonganKantong: "AB", rhesusKantong: "positif" });
  assert.equal(r.sah, true);
});

test("syaratOverrideDarurat: ditolak dengan alasan spesifik bila pengaturan faskes nonaktif", () => {
  const r = syaratOverrideDarurat({ ...SYARAT_LENGKAP, overrideDaruratAktif: false });
  assert.equal(r.sah, false);
  assert.match(r.alasan, /tidak aktif di Pengaturan BDRS/);
});

test("syaratOverrideDarurat: ditolak dengan alasan spesifik bila tidak punya izin OVERRIDE DARURAT", () => {
  const r = syaratOverrideDarurat({ ...SYARAT_LENGKAP, punyaIzinOverride: false });
  assert.equal(r.sah, false);
  assert.match(r.alasan, /OVERRIDE DARURAT/);
});

test("syaratOverrideDarurat: ditolak dengan alasan spesifik bila alasan kurang dari 10 karakter", () => {
  const r = syaratOverrideDarurat({ ...SYARAT_LENGKAP, alasanOverride: "darurat" });
  assert.equal(r.sah, false);
  assert.match(r.alasan, /minimal 10 karakter/);
});

test("syaratOverrideDarurat: ditolak dengan alasan spesifik bila kantong bukan kantong universal", () => {
  const r = syaratOverrideDarurat({ ...SYARAT_LENGKAP, kelompokKomponen: "sel_darah_merah", golonganKantong: "A", rhesusKantong: "positif" });
  assert.equal(r.sah, false);
  assert.match(r.alasan, /bukan kantong universal/);
});

test("syaratOverrideDarurat: PRC O Rh positif ditolak dengan alasan spesifik bila pasien tidak memenuhi syarat", () => {
  const r = syaratOverrideDarurat({ ...SYARAT_LENGKAP, golonganKantong: "O", rhesusKantong: "positif", izinkanOPos: true, layakOPos: false });
  assert.equal(r.sah, false);
  assert.match(r.alasan, /PRC O Rh positif/);
});

test("syaratOverrideDarurat: PRC O Rh positif sah bila pengaturan mengizinkan & pasien memenuhi syarat", () => {
  const r = syaratOverrideDarurat({ ...SYARAT_LENGKAP, golonganKantong: "O", rhesusKantong: "positif", izinkanOPos: true, layakOPos: true });
  assert.equal(r.sah, true);
});

// KT-3/KT-4: seluruh 64 kombinasi ABO/Rh pasien × kantong per kelompok, harapan ditulis ulang dari standar (bukan dari
// tabel di kompatibilitas.js) agar kesalahan pada tabel implementasi tertangkap.
const GOLONGAN = ["O", "A", "B", "AB"];
const RH = ["positif", "negatif"];
const sdmBoleh = (p, k) => k === "O" || p === k || p === "AB";
const plasmaBoleh = (p, k) => k === "AB" || p === k || p === "O";

test("KT-3: matriks sel darah merah lengkap untuk 64 kombinasi ABO/Rh", () => {
  for (const gp of GOLONGAN) for (const rp of RH) for (const gk of GOLONGAN) for (const rk of RH) {
    const harap = sdmBoleh(gp, gk) && (rp === "positif" || rk === "negatif");
    const { kompatibel } = cekKompatibilitas({ kelompokKomponen: "sel_darah_merah", golonganPasien: gp, rhesusPasien: rp, golonganKantong: gk, rhesusKantong: rk, namaKomponen: "PRC" });
    assert.equal(kompatibel, harap, `pasien ${gp}${rp} ← kantong ${gk}${rk}`);
  }
});

test("KT-4: matriks plasma lengkap untuk 64 kombinasi ABO/Rh (Rh tidak membatasi)", () => {
  for (const gp of GOLONGAN) for (const rp of RH) for (const gk of GOLONGAN) for (const rk of RH) {
    const { kompatibel } = cekKompatibilitas({ kelompokKomponen: "plasma", golonganPasien: gp, rhesusPasien: rp, golonganKantong: gk, rhesusKantong: rk, namaKomponen: "FFP" });
    assert.equal(kompatibel, plasmaBoleh(gp, gk), `pasien ${gp}${rp} ← kantong ${gk}${rk}`);
  }
});
