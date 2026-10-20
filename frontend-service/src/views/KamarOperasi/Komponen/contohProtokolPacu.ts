// Contoh susunan protokol PACU untuk mempercepat penyusunan draf di Pengaturan Protokol. Ini BUKAN standar klinis:
// isi, pilihan, ambang skor, interval pemantauan, dan kriteria pindah WAJIB ditinjau & disahkan komite medik /
// SMF Anestesi faskes sebelum versi protokol diaktifkan. Interval sengaja dikosongkan agar ditetapkan faskes.
export type BarisProtokol = { kode: string; nama: string; tipe: "angka" | "teks" | "pilihan" | "boolean"; wajib: boolean; satuan: string; pilihanTeks: string };

const b = (kode: string, nama: string, tipe: BarisProtokol["tipe"], wajib: boolean, satuan = "", pilihanTeks = ""): BarisProtokol => ({
  kode,
  nama,
  tipe,
  wajib,
  satuan,
  pilihanTeks,
});

export const contohProtokolPacu = () => ({
  kode: "pacu_umum",
  nama: "Pemantauan Pascaanestesi (contoh — perlu disahkan komite medik)",
  parameter: [
    b("tekanan_sistolik", "Tekanan darah sistolik", "angka", true, "mmHg"),
    b("tekanan_diastolik", "Tekanan darah diastolik", "angka", true, "mmHg"),
    b("nadi", "Nadi", "angka", true, "x/menit"),
    b("laju_napas", "Laju napas", "angka", true, "x/menit"),
    b("spo2", "Saturasi oksigen", "angka", true, "%"),
    b("suhu", "Suhu", "angka", false, "°C"),
    b("kesadaran", "Kesadaran", "pilihan", true, "", "Sadar penuh, Bangun bila dipanggil, Tidak berespons"),
    b("jalan_napas", "Jalan napas", "pilihan", true, "", "Paten tanpa alat bantu, Paten dengan alat bantu, Terganggu"),
    b("skala_nyeri", "Skala nyeri", "angka", true, "skor"),
    b("mual_muntah", "Mual/muntah", "pilihan", true, "", "Tidak ada, Mual, Muntah"),
    b("aldrete_aktivitas", "Aldrete — aktivitas", "pilihan", false, "", "0, 1, 2"),
    b("aldrete_respirasi", "Aldrete — respirasi", "pilihan", false, "", "0, 1, 2"),
    b("aldrete_sirkulasi", "Aldrete — sirkulasi", "pilihan", false, "", "0, 1, 2"),
    b("aldrete_kesadaran", "Aldrete — kesadaran", "pilihan", false, "", "0, 1, 2"),
    b("aldrete_saturasi", "Aldrete — saturasi O2", "pilihan", false, "", "0, 1, 2"),
    b("skor_pemulihan", "Skor pemulihan (Aldrete/skala faskes)", "angka", true, "poin"),
  ],
  kriteria: [
    b("skor_pemulihan_memenuhi", "Skor pemulihan memenuhi ambang faskes", "boolean", true),
    b("tanda_vital_stabil", "Tanda vital stabil sesuai protokol", "boolean", true),
    b("jalan_napas_aman", "Jalan napas aman", "boolean", true),
    b("nyeri_terkendali", "Nyeri terkendali", "boolean", true),
    b("mual_terkendali", "Mual/muntah terkendali", "boolean", true),
  ],
  format: [
    b("ringkasan_kondisi", "Ringkasan kondisi pasien", "teks", true),
    b("instruksi_lanjutan", "Instruksi lanjutan", "teks", true),
    b("obat_terakhir", "Obat terakhir diberikan", "teks", false),
    b("alat_terpasang", "Alat/kateter terpasang", "teks", false),
  ],
});
