import { satu } from "../db.js";

// Nomor dokumen per faskes, prefiks & tanggal, mis. FIS-20261014-0001. Penghitung disimpan di tabel
// penunjang_nomor (upsert atomik) sehingga aman dari tabrakan saat order bersamaan.
export const nomorBaru = async (faskesUuid, prefiks, k) => {
  const d = new Date();
  const tgl = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const r = await satu(
    `INSERT INTO penunjang_nomor (faskes_uuid, prefiks, tanggal, terakhir) VALUES ($1, $2, $3, 1)
     ON CONFLICT (faskes_uuid, prefiks, tanggal) DO UPDATE SET terakhir = penunjang_nomor.terakhir + 1
     RETURNING terakhir`,
    [faskesUuid, prefiks, tgl],
    k,
  );
  return `${prefiks}-${tgl}-${String(r.terakhir).padStart(4, "0")}`;
};
