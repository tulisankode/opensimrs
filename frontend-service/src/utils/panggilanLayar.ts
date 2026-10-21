// Panggilan yang tampil di layar antrean. "Panggil" hanya menandai nomor baru berstatus 1 (dipanggil); nomor sebelumnya
// baru berganti status bila petugas menekan Proses/Lewati/Selesai. Bila petugas langsung memanggil nomor berikutnya,
// beberapa nomor sama-sama berstatus dipanggil — layar harus menampilkan panggilan TERBARU, bukan nomor terkecil.
// Data datang dalam bentuk snake_case (kiosk) atau camelCase (layar admin), jadi keduanya dibaca.

const waktuPanggil = (x: any) => Number(x?.updated_at ?? x?.updatedAt ?? x?.created_at ?? x?.createdAt ?? 0);

const kunciPoliDokter = (x: any) => {
  const jd = x?.patient_data?.jadwal_dokter ?? x?.patientData?.jadwalDokter ?? {};
  return `${jd.lokasi_uuid ?? jd.lokasiUuid ?? jd.nama_poli ?? jd.namaPoli ?? ""}|${jd.nama_dokter ?? jd.namaDokter ?? ""}`;
};

// Terbaru di depan.
export const urutPanggilanTerbaru = <T>(daftar: T[]): T[] => [...daftar].sort((a, b) => waktuPanggil(b) - waktuPanggil(a));

// Poli: satu panggilan (terakhir) per poli-dokter, terbaru di depan.
export const panggilanPoliTerkini = <T>(daftar: T[]): T[] => {
  const dilihat = new Set<string>();
  return urutPanggilanTerbaru(daftar).filter((x) => {
    const k = kunciPoliDokter(x);
    if (dilihat.has(k)) return false;
    dilihat.add(k);
    return true;
  });
};
