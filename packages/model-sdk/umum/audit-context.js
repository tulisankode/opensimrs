import { AsyncLocalStorage } from "node:async_hooks";
import { uuidv7 } from "uuidv7";

// STD-0029 — Audit Trail terpusat: konteks pengguna/permintaan per request, terbawa ke hook Sequelize global
// (afterCreate/afterUpdate/afterDestroy) lewat AsyncLocalStorage, karena hook tidak punya akses ke objek request.
const penyimpanan = new AsyncLocalStorage();

// Membaca payload JWT tanpa verifikasi tanda tangan: middleware ini hanya mengisi konteks untuk pelaporan audit,
// bukan gerbang otorisasi. Permintaan dengan token tidak valid tetap ditolak oleh middleware authorization-sdk /
// authorization-middleware masing-masing layanan sebelum tulisan apa pun terjadi, jadi payload yang terbaca di sini
// selalu sama dengan payload yang sudah diverifikasi saat ada tulisan audit.
function bacaPayloadToken(header) {
  try {
    if (!header) return null;
    const token = header.startsWith("Bearer ") ? header.slice(7) : header;
    const bagian = token.split(".")[1];
    if (!bagian) return null;
    const json = Buffer.from(bagian.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Pasang sebagai middleware Express paling awal (setelah body parser, sebelum rute). Tidak bergantung pada urutan
// terhadap middleware auth layanan karena membaca header Authorization sendiri.
export function auditContextMiddleware() {
  return function (request, response, nextFunction) {
    const author = bacaPayloadToken(request.get?.("Authorization"));
    const konteks = {
      penggunaUuid: author?.user_uuid ?? null,
      username: author?.username ?? null,
      peran: author?.role ?? null,
      faskesUuid: author?.faskesUuid ?? null,
      alamatIp: request.ip ?? request.socket?.remoteAddress ?? null,
      userAgent: String(request.get?.("User-Agent") ?? "").slice(0, 500) || null,
      requestId: request.get?.("X-Request-Id") || uuidv7(),
    };
    penyimpanan.run(konteks, nextFunction);
  };
}

// Dibaca dari dalam hook Sequelize / helper catatAudit. Null bila dipanggil di luar konteks permintaan (mis. job
// latar, seeder, atau uji unit) — pemanggil pada kondisi itu harus melengkapi konteks sendiri bila diperlukan.
export function ambilKonteksAudit() {
  return penyimpanan.getStore() ?? null;
}

// Menjalankan fn dalam konteks audit tertentu di luar siklus request (job latar, uji unit).
export function jalankanDenganKonteksAudit(konteks, fn) {
  return penyimpanan.run(konteks ?? {}, fn);
}
