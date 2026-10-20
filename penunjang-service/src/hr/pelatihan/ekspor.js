import { permintaanSalah } from "../../umum/respons.js";

export const siapkanEkspor = async (req, { transaksi, laporan, audit }) => {
  const b = req.body ?? {};
  if (!["xlsx", "pdf"].includes(b.format)) throw permintaanSalah("Pilih format Excel atau PDF");
  const hasil = await transaksi(async (k) => {
    await k.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
    const hasil = await laporan(req.author.faskesUuid, b, b.jenis_laporan, k);
    if (!hasil.data.length && !hasil.kebijakan?.izinkan_ekspor_kosong) throw permintaanSalah("Ekspor kosong belum diizinkan dalam kebijakan tahun ini");
    if (hasil.data.length > 10000) throw permintaanSalah("Ekspor maksimal 10.000 baris; persempit filter");
    return hasil;
  });
  // Audit memakai transaksi baru agar rantai hash melihat baris terakhir setelah penguncian audit pusat.
  await transaksi((k) => audit(k, req, "baca", "sdm_pelatihan_ekspor", null, { format: b.format, jenis_laporan: b.jenis_laporan, tahun: hasil.tahun, jumlah_baris: hasil.data.length }));
  return { ...hasil, format: b.format, nama_berkas: `Pelatihan-${b.jenis_laporan}-${hasil.tahun}.${b.format}` };
};
