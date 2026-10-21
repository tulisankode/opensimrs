// Sanitasi isi General Consent (HTML dari CustomCkEditor) sebelum dirender dengan v-html.
import DOMPurify from "dompurify";

const KONFIGURASI_SANITASI: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "div",
    "span",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "sub",
    "sup",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "table",
    "caption",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "figure",
  ],
  ALLOWED_ATTR: ["colspan", "rowspan", "scope"],
};

// Mengembalikan HTML aman dari isiSurat General Consent, atau string kosong bila tidak valid/gagal disanitasi.
export function sanitizeGeneralConsent(isiSurat: unknown): string {
  if (typeof isiSurat !== "string" || !isiSurat) return "";
  try {
    return DOMPurify.sanitize(isiSurat, KONFIGURASI_SANITASI);
  } catch {
    return "";
  }
}
