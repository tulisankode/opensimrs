import { test } from "node:test";
import assert from "node:assert/strict";
import { KUNJUNGAN_TIPE, TABEL_KUNJUNGAN, TARGET_KODING_DETIK, epoch, teks, unionKunjungan } from "../src/koding/bersama.js";
import { checklistBelumLengkap, checklistLengkapSemua, diagnosisUtamaDari, klarifikasiTerbuka, prasyaratSiapKlaim } from "../src/koding/data.js";
import { bedaDariDiagnosisDokter, validasiDiagnosisInput, validasiTindakanInput } from "../src/koding/validasi.js";

// ── bersama.js: helper murni tanggal/teks/SQL union kunjungan

test("epoch: undefined/null/kosong, detik, milidetik, dan tanggal ISO", () => {
  assert.equal(epoch(undefined), undefined);
  assert.equal(epoch(null), null);
  assert.equal(epoch(""), null);
  assert.equal(epoch(1700000000), 1700000000);
  assert.equal(epoch(1700000000000), 1700000000);
  assert.equal(epoch("2024-01-01"), Math.floor(Date.parse("2024-01-01") / 1000));
  assert.equal(epoch("bukan-tanggal"), null);
});

test("teks: trim, kosong jadi null, potong sesuai panjang maksimum", () => {
  assert.equal(teks(undefined), undefined);
  assert.equal(teks(null), null);
  assert.equal(teks("   "), null);
  assert.equal(teks("  halo  "), "halo");
  assert.equal(teks("Diagnosis utama berbeda", 9), "Diagnosis");
});

test("unionKunjungan: UNION ALL untuk ketiga tabel kunjungan sumber (rj/ri/igd)", () => {
  const sql = unionKunjungan("uuid AS kunjungan_uuid");
  assert.equal(KUNJUNGAN_TIPE.length, 3);
  for (const tipe of KUNJUNGAN_TIPE) {
    assert.match(sql, new RegExp(`SELECT '${tipe}' AS kunjungan_tipe, uuid AS kunjungan_uuid FROM ${TABEL_KUNJUNGAN[tipe]}`));
  }
  assert.equal(sql.split("UNION ALL").length, 3);
});

test("TARGET_KODING_DETIK: target koding rawat inap 2×24 jam (PRD T2)", () => {
  assert.equal(TARGET_KODING_DETIK, 172800);
});

// ── data.js: aturan bisnis "siap klaim" (KF-7, aturan bisnis #6)

const itemChecklist = (over = {}) => ({ checklist_item_uuid: "c1", nama: "Resume Medis", wajib: true, status: "tidak_lengkap", ...over });

test("checklistBelumLengkap/checklistLengkapSemua: item wajib harus lengkap atau tidak_berlaku", () => {
  assert.deepEqual(checklistBelumLengkap([itemChecklist()]), [itemChecklist()]);
  assert.equal(checklistLengkapSemua([itemChecklist()]), false);
  assert.equal(checklistLengkapSemua([itemChecklist({ status: "lengkap" })]), true);
  assert.equal(checklistLengkapSemua([itemChecklist({ status: "tidak_berlaku", alasan: "Tidak ada tindakan operasi" })]), true);
  // item tidak wajib yang belum lengkap tidak menghalangi kelengkapan keseluruhan.
  assert.equal(checklistLengkapSemua([itemChecklist({ wajib: false, status: "tidak_lengkap" })]), true);
});

test("diagnosisUtamaDari: menemukan baris peran utama atau null bila belum ada (KT-2)", () => {
  assert.equal(diagnosisUtamaDari([]), null);
  assert.equal(diagnosisUtamaDari([{ peran: "sekunder" }]), null);
  const utama = { peran: "utama", kode: "A09" };
  assert.deepEqual(diagnosisUtamaDari([{ peran: "sekunder" }, utama]), utama);
});

test("klarifikasiTerbuka: true bila ada klarifikasi menghalangi yang belum ditutup (KT-5)", () => {
  assert.equal(klarifikasiTerbuka([]), false);
  assert.equal(klarifikasiTerbuka([{ menghalangi: true, status: "ditutup" }]), false);
  assert.equal(klarifikasiTerbuka([{ menghalangi: false, status: "menunggu" }]), false);
  assert.equal(klarifikasiTerbuka([{ menghalangi: true, status: "menunggu" }]), true);
  assert.equal(klarifikasiTerbuka([{ menghalangi: true, status: "terjawab" }]), true);
});

test("prasyaratSiapKlaim: menolak bila diagnosis utama kosong (KT-2)", () => {
  const prasyarat = prasyaratSiapKlaim([], [], []);
  assert.ok(prasyarat.includes("Diagnosis utama belum diisi"));
});

test("prasyaratSiapKlaim: menolak dan menyebut item saat checklist wajib belum lengkap (KT-7)", () => {
  const diagnosis = [{ peran: "utama" }];
  const prasyarat = prasyaratSiapKlaim(diagnosis, [itemChecklist({ nama: "Resume Medis" })], []);
  assert.ok(prasyarat.some((p) => p.includes("Resume Medis")));
});

test("prasyaratSiapKlaim: menolak bila ada klarifikasi menghalangi terbuka (KT-5)", () => {
  const diagnosis = [{ peran: "utama" }];
  const checklist = [itemChecklist({ status: "lengkap" })];
  const prasyarat = prasyaratSiapKlaim(diagnosis, checklist, [{ menghalangi: true, status: "menunggu" }]);
  assert.deepEqual(prasyarat, ["Ada klarifikasi menghalangi yang belum ditutup"]);
});

test("prasyaratSiapKlaim: kosong (boleh siap klaim) bila seluruh syarat terpenuhi (KT-8)", () => {
  const diagnosis = [{ peran: "utama" }];
  const checklist = [itemChecklist({ status: "lengkap" }), itemChecklist({ checklist_item_uuid: "c2", status: "tidak_berlaku" })];
  const klarifikasi = [{ menghalangi: true, status: "ditutup" }, { menghalangi: false, status: "menunggu" }];
  assert.deepEqual(prasyaratSiapKlaim(diagnosis, checklist, klarifikasi), []);
});

// ── validasi.js: validasi payload koding diagnosis/tindakan (KF-3, KF-4, KT-2, KT-3)

test("validasiDiagnosisInput: menolak payload kosong, peran tidak valid, dan lebih dari satu utama", () => {
  assert.throws(() => validasiDiagnosisInput([]), /Pilih minimal satu diagnosis/);
  assert.throws(() => validasiDiagnosisInput([{ peran: "lainnya", diagnosis_uuid: "d1" }]), /Peran diagnosis harus utama atau sekunder/);
  assert.throws(
    () => validasiDiagnosisInput([{ peran: "utama", diagnosis_uuid: "d1" }, { peran: "utama", diagnosis_uuid: "d2" }]),
    /Hanya boleh satu diagnosis utama/,
  );
  assert.throws(() => validasiDiagnosisInput([{ peran: "utama", diagnosis_uuid: "" }]), /diagnosis_uuid wajib diisi/);
});

test("validasiDiagnosisInput: payload valid tidak melempar galat", () => {
  assert.doesNotThrow(() => validasiDiagnosisInput([{ peran: "utama", diagnosis_uuid: "d1" }, { peran: "sekunder", diagnosis_uuid: "d2" }]));
});

test("validasiTindakanInput: tindakan opsional (array kosong boleh), tetapi icd9_uuid wajib bila diisi", () => {
  assert.doesNotThrow(() => validasiTindakanInput([]));
  assert.throws(() => validasiTindakanInput([{ icd9_uuid: "" }]), /icd9_uuid wajib diisi/);
  assert.doesNotThrow(() => validasiTindakanInput([{ icd9_uuid: "t1" }]));
});

test("bedaDariDiagnosisDokter: tidak wajib alasan bila dokter belum mencatat apa pun, wajib bila kode berbeda (KT-3)", () => {
  assert.equal(bedaDariDiagnosisDokter("d1", new Set()), false);
  assert.equal(bedaDariDiagnosisDokter("d1", new Set(["d1", "d2"])), false);
  assert.equal(bedaDariDiagnosisDokter("d3", new Set(["d1", "d2"])), true);
});
