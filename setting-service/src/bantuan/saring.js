// Penyaring data pribadi untuk pertanyaan Helpdesk sebelum dikirim ke Gateway AI (docs/rancangan/HELPDESK-OPENCLAW.md §4).
// Data contoh fiktif (NIK berawalan 9999, HP 080000000000, email @contoh.id) tidak disamarkan.

const POLA = [
  // Nomor rekam medis yang disebut eksplisit: "no RM 001234", "norm: A-12", "rekam medis 12345"
  { nama: "NO-RM", pola: /\b(no\.?\s*rm|norm|nomor\s+rekam\s+medis|rekam\s+medis)(\s*[:#.]?\s*)([A-Za-z0-9][\w./-]{2,})/gi, ganti: (_, a, b) => `${a}${b}[NO-RM]` },
  { nama: "NIK", pola: /\b\d{16}\b/g, lewati: (n) => n.startsWith("9999") },
  // Nomor kartu BPJS/JKN 13 digit
  { nama: "NO-KARTU", pola: /\b\d{13}\b/g, lewati: (n) => /^0+$/.test(n) },
  { nama: "HP", pola: /(?<![\w])(\+62|62|0)8\d{8,11}\b/g, lewati: (n) => /^0?80{10}$/.test(n.replace(/^\+?62/, "0")) },
  { nama: "EMAIL", pola: /[\w.+-]+@[\w-]+\.[\w.]+/g, lewati: (n) => /@contoh\.id$/i.test(n) },
];

/**
 * @param {string} teks
 * @returns {{ teks: string, disamarkan: number }}
 */
export const samarkanDataPribadi = (teks = "") => {
  let hasil = String(teks);
  let disamarkan = 0;
  for (const p of POLA) {
    hasil = hasil.replace(p.pola, (...cocok) => {
      if (p.lewati?.(cocok[0])) return cocok[0];
      disamarkan++;
      return p.ganti ? p.ganti(...cocok) : `[${p.nama}]`;
    });
  }
  return { teks: hasil, disamarkan };
};
