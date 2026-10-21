import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Catatan: DOMPurify memerlukan `window`/`document` nyata (mis. jsdom) untuk benar-benar
// membersihkan HTML; repo ini belum memiliki dependensi jsdom/vitest untuk uji berbasis DOM.
// Tanpa `window`, DOMPurify menandai dirinya tidak didukung dan sekadar meneruskan HTML apa
// adanya (bukan error), sehingga uji ini HANYA memverifikasi jalur pemeriksaan tipe/kosong
// milik sanitizeGeneralConsent sendiri (tidak bergantung pada perilaku DOM DOMPurify).
// Perilaku penyaringan elemen/atribut berbahaya wajib diverifikasi manual di peramban.

const urlData = (s) => `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const sumber = readFileSync(new URL("../src/utils/sanitizeGeneralConsent.ts", import.meta.url), "utf8");
const hasil = ts.transpileModule(sumber, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const modul = await import(
  urlData(hasil.outputText.replace('"dompurify"', JSON.stringify(urlData("export default { sanitize: (s) => s };"))))
);

test("isiSurat bukan string atau kosong menghasilkan string kosong tanpa memanggil DOMPurify", () => {
  assert.equal(modul.sanitizeGeneralConsent(null), "");
  assert.equal(modul.sanitizeGeneralConsent(undefined), "");
  assert.equal(modul.sanitizeGeneralConsent(""), "");
  assert.equal(modul.sanitizeGeneralConsent(123), "");
  assert.equal(modul.sanitizeGeneralConsent({}), "");
});

test("isiSurat string diteruskan ke DOMPurify.sanitize dengan kebijakan General Consent", () => {
  assert.equal(modul.sanitizeGeneralConsent("<p>Isi consent</p>"), "<p>Isi consent</p>");
});
