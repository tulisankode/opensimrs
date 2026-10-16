import { AsyncLocalStorage } from "node:async_hooks";

// Konteks per permintaan HTTP (author/JWT, token). Dulu disimpan di field statis sehingga permintaan yang berjalan
// bersamaan bisa saling membaca faskes/pengguna/token milik permintaan lain. Kini setiap permintaan punya penyimpanan
// sendiri lewat AsyncLocalStorage (dibuka oleh Context.middleware di app.js) dan terbawa ke semua await, transaksi,
// interceptor axios, dan listener event yang dipicu dari permintaan itu.
const penyimpanan = new AsyncLocalStorage();

export class Context {
  // Pasang paling awal di app.js: app.use(Context.middleware)
  static middleware(request, response, nextFunction) {
    penyimpanan.run(new Map(), nextFunction);
  }

  // Jalankan fn dalam konteks baru (uji, pekerjaan latar).
  static jalankan(fn) {
    return penyimpanan.run(new Map(), fn);
  }

  static set(key, value) {
    const simpanan = penyimpanan.getStore();
    if (simpanan) return void simpanan.set(key, value);
    // Di luar permintaan (mis. uji unit lama): cadangan proses.
    (this.cadangan ??= new Map()).set(key, value);
  }

  static get(key) {
    const simpanan = penyimpanan.getStore();
    if (simpanan) return simpanan.has(key) ? simpanan.get(key) : null;
    return this.cadangan?.get(key) ?? null;
  }
}
