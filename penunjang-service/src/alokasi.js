// Alokasi harga paket ke komponennya (dipakai paket Radiologi & Fisioterapi).
// Membagi `total` (rupiah) proporsional terhadap `bobot` (mis. tarif satuan) dengan metode sisa terbesar,
// sehingga setiap bagian bilangan bulat dan jumlahnya tepat = total. Bobot nol semua → dibagi rata.
export const alokasiProporsional = (total, bobot) => {
  const n = bobot.length;
  if (!n) return [];
  const t = Math.round(Number(total) || 0);
  const b = bobot.map((x) => Math.max(Number(x) || 0, 0));
  const jumlah = b.reduce((s, x) => s + x, 0);
  const porsi = jumlah > 0 ? b.map((x) => (t * x) / jumlah) : b.map(() => t / n);
  const hasil = porsi.map(Math.floor);
  let sisa = t - hasil.reduce((s, x) => s + x, 0);
  const urut = porsi.map((p, i) => [p - Math.floor(p), i]).sort((a, c) => c[0] - a[0] || a[1] - c[1]);
  for (let j = 0; sisa > 0; j = (j + 1) % n, sisa--) hasil[urut[j][1]] += 1;
  return hasil;
};
