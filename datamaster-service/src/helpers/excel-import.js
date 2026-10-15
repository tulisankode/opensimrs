import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { generateErrorResponse } from "./generate-message.js";

// Pembantu import Excel (hasil node-xlsx): buang baris kosong, rapikan nilai sel, ubah tanggal seri Excel,
// dan kumpulkan galat per baris agar pengguna tahu baris mana yang harus diperbaiki.

// galat ditampilkan frontend sebagai daftar di toast, jadi dibatasi
const MAKS_GALAT = 10;

/**
 * Baris data setelah baris judul kolom, tanpa baris kosong.
 * @param {Array<Array<any>>} rows - data sheet dari node-xlsx
 * @param {number} jumlahHeader - jumlah baris judul di atas data
 * @returns {Array<{nomor: number, sel: Array<any>}>} nomor = nomor baris di Excel
 */
export function barisData(rows, jumlahHeader = 1) {
  return (rows ?? [])
    .map((sel, index) => ({ nomor: index + 1, sel }))
    .slice(jumlahHeader)
    .filter(({ sel }) => sel.some((nilai) => teks(nilai) !== undefined));
}

/**
 * Nilai sel sebagai teks yang sudah di-trim; undefined bila kosong.
 * Angka besar (mis. NIK yang tersimpan sebagai angka) ditulis tanpa notasi ilmiah.
 */
export function teks(nilai) {
  if (nilai === undefined || nilai === null) return undefined;
  const hasil =
    typeof nilai === "number" && Number.isInteger(nilai)
      ? BigInt(nilai).toString()
      : String(nilai).trim();
  return hasil === "" ? undefined : hasil;
}

/**
 * Tanggal dari sel Excel menjadi teks DD-MM-YYYY.
 * Sel bertipe tanggal dibaca node-xlsx sebagai nomor seri (hari sejak 30-12-1899).
 */
export function tanggalExcel(nilai) {
  if (typeof nilai === "number") {
    const tanggal = new Date(Date.UTC(1899, 11, 30) + Math.round(nilai) * 86400000);
    const dd = String(tanggal.getUTCDate()).padStart(2, "0");
    const mm = String(tanggal.getUTCMonth() + 1).padStart(2, "0");
    return `${dd}-${mm}-${tanggal.getUTCFullYear()}`;
  }
  return (teks(nilai) ?? "").replace(/\//g, "-");
}

/**
 * Pesan dari ZodError menjadi daftar teks singkat.
 * @param {import("zod").ZodError} error
 */
export function pesanZod(error) {
  return error.issues.map((issue) => issue.message);
}

/**
 * Lempar galat import bila ada; tiap galat sudah memuat nomor baris.
 * @param {Array<string>} galat
 */
export function lemparGalatImport(galat) {
  if (galat.length === 0) return;
  const errors = galat.slice(0, MAKS_GALAT).map((message) => ({ type: "invalid", message }));
  if (galat.length > MAKS_GALAT) {
    errors.push({ type: "invalid", message: `... dan ${galat.length - MAKS_GALAT} galat lain` });
  }
  const response = generateErrorResponse("Gagal import", "invalid", errors[0].message);
  response.errors = errors;
  throw new HttpException(response, HttpStatus.BAD_REQUEST);
}

/**
 * Galat bila file tidak berisi baris data.
 */
export function lemparFileKosong(jenis) {
  throw new HttpException(
    generateErrorResponse("Gagal import", "required", `file tidak berisi data ${jenis}`),
    HttpStatus.BAD_REQUEST
  );
}
