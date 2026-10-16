// Respons & galat seragam: { message, payload } seperti layanan OpenSIMRS lain.

export class Galat extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const tidakDitemukan = (apa = "Data") => new Galat(404, `${apa} tidak ditemukan`);
export const permintaanSalah = (pesan) => new Galat(400, pesan);

// Bungkus handler async: galat → status HTTP + pesan.
export const tangani = (fn) => (req, res) =>
  fn(req, res).catch((error) => {
    const status = Number(error.status) >= 400 && Number(error.status) < 600 ? Number(error.status) : 500;
    if (status >= 500) console.error("[studio]", error);
    res.status(status).json({ message: error.message });
  });

export const kirim = (res, payload, message = "Data berhasil ditampilkan") => res.json({ message, payload });

// Paginasi dari query (?page=1&limit=10) → { limit, offset, page }.
export const halaman = (q) => {
  const limit = Math.min(Math.max(Number(q.limit ?? q.page_size) || 10, 1), 9999);
  const page = Math.max(Number(q.page) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
};
export const denganHalaman = (rows, total, { page, limit }) => ({
  data: rows,
  pagination: { page, limit, total: Number(total) || 0, total_page: Math.max(Math.ceil((Number(total) || 0) / limit), 1) },
});

// Wajib ada & tidak kosong.
export const wajib = (obj, kolom) => {
  const kosong = kolom.filter((k) => obj?.[k] === undefined || obj?.[k] === null || obj?.[k] === "");
  if (kosong.length) throw permintaanSalah(`${kosong.join(", ")} wajib diisi`);
};
