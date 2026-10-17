import { permintaanSalah } from "../umum/respons.js";
import { teks } from "./bersama.js";

// Validasi murni (tanpa basis data) untuk payload koding diagnosis/tindakan — KF-3, KF-4, KF-6, KT-2, KT-3.
export const PERAN_DIAGNOSIS = ["utama", "sekunder"];

export const validasiDiagnosisInput = (diagnosisInput) => {
  if (!diagnosisInput.length) throw permintaanSalah("Pilih minimal satu diagnosis");
  if (diagnosisInput.some((d) => !PERAN_DIAGNOSIS.includes(d?.peran))) throw permintaanSalah("Peran diagnosis harus utama atau sekunder");
  if (diagnosisInput.filter((d) => d.peran === "utama").length > 1) throw permintaanSalah("Hanya boleh satu diagnosis utama");
  if (diagnosisInput.some((d) => !teks(d.diagnosis_uuid))) throw permintaanSalah("diagnosis_uuid wajib diisi untuk tiap baris diagnosis");
};

export const validasiTindakanInput = (tindakanInput) => {
  if (tindakanInput.some((t) => !teks(t.icd9_uuid))) throw permintaanSalah("icd9_uuid wajib diisi untuk tiap baris tindakan");
};

// Diagnosis koder dianggap "berbeda dari diagnosis dokter" bila dokter sudah mencatat sesuatu (kodeDokterSet
// tidak kosong) tetapi kode ini tidak ada di antara yang dicatat dokter (KF-6, KT-3).
export const bedaDariDiagnosisDokter = (diagnosisUuid, kodeDokterSet) => kodeDokterSet.size > 0 && !kodeDokterSet.has(diagnosisUuid);
