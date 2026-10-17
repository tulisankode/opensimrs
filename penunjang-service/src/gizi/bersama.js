import { Galat, permintaanSalah } from "../umum/respons.js";

// Konstanta & helper bersama modul Gizi. Helper tanggal/SQL generik dipakai bersama modul Radiologi/Patologi.
export { TZ, hariIni, tglLokal, tanggalValid, rentangOpsional, ramah, daftarNilai } from "../radiologi/bersama.js";

export const konflik = (pesan) => new Galat(409, pesan);

export const WAKTU_MAKAN = ["pagi", "siang", "sore", "snack"];
export const LABEL_WAKTU_MAKAN = { pagi: "Pagi", siang: "Siang", sore: "Sore", snack: "Snack" };

export const RUTE_DIET = ["oral", "enteral", "parenteral"];

// Instrumen skrining gizi bawaan (MST/NRS-2002) dengan daftar pertanyaan referensi untuk form & ambang risiko.
// Catatan: ambang risiko saat ini tetap (belum dapat dikonfigurasi per faskes) — lihat keputusan terbuka PRD STD-0007.
export const INSTRUMEN = {
  mst: {
    label: "Malnutrition Screening Tool (MST)",
    ambang: 2,
    pertanyaan: [
      {
        kode: "penurunan_bb",
        teks: "Apakah pasien mengalami penurunan berat badan yang tidak diinginkan dalam 6 bulan terakhir?",
        opsi: [
          { nilai: "tidak", label: "Tidak", skor: 0 },
          { nilai: "tidak_yakin", label: "Tidak yakin", skor: 2 },
          { nilai: "ya_1_5", label: "Ya, 1–5 kg", skor: 1 },
          { nilai: "ya_6_10", label: "Ya, 6–10 kg", skor: 2 },
          { nilai: "ya_11_15", label: "Ya, 11–15 kg", skor: 3 },
          { nilai: "ya_lebih_15", label: "Ya, lebih dari 15 kg", skor: 4 },
        ],
      },
      {
        kode: "asupan_turun",
        teks: "Apakah asupan makan berkurang karena nafsu makan menurun?",
        opsi: [
          { nilai: "tidak", label: "Tidak", skor: 0 },
          { nilai: "ya", label: "Ya", skor: 1 },
        ],
      },
    ],
  },
  nrs2002: {
    label: "Nutritional Risk Screening (NRS-2002)",
    ambang: 3,
    pertanyaan: [
      {
        kode: "imt_rendah",
        teks: "Indeks Massa Tubuh (IMT) < 20,5?",
        opsi: [
          { nilai: "tidak", label: "Tidak", skor: 0 },
          { nilai: "ya", label: "Ya", skor: 1 },
        ],
      },
      {
        kode: "penurunan_bb_3bulan",
        teks: "Penurunan berat badan dalam 3 bulan terakhir?",
        opsi: [
          { nilai: "tidak", label: "Tidak", skor: 0 },
          { nilai: "ya", label: "Ya", skor: 1 },
        ],
      },
      {
        kode: "asupan_turun_seminggu",
        teks: "Asupan makan berkurang pada minggu terakhir?",
        opsi: [
          { nilai: "tidak", label: "Tidak", skor: 0 },
          { nilai: "ya", label: "Ya", skor: 1 },
        ],
      },
      {
        kode: "sakit_berat",
        teks: "Pasien dengan penyakit berat (mis. dirawat di ruang intensif)?",
        opsi: [
          { nilai: "tidak", label: "Tidak", skor: 0 },
          { nilai: "ya", label: "Ya", skor: 1 },
        ],
      },
      {
        kode: "usia_lanjut",
        teks: "Usia 70 tahun atau lebih?",
        opsi: [
          { nilai: "tidak", label: "Tidak", skor: 0 },
          { nilai: "ya", label: "Ya", skor: 1 },
        ],
      },
    ],
  },
};

export const kategoriRisiko = (instrumen, skor) => (Number(skor) >= (INSTRUMEN[instrumen]?.ambang ?? 0) ? "berisiko" : "tidak_berisiko");

// Hitung skor skrining dari definisi pertanyaan (INSTRUMEN), bukan dari skor yang dikirim klien, agar tidak bisa
// dimanipulasi. Melempar permintaanSalah (400) bila instrumen tidak dikenal atau jawaban kurang/tidak valid.
export const hitungSkor = (kodeInstrumen, jawabanKirim) => {
  const instrumen = INSTRUMEN[kodeInstrumen];
  if (!instrumen) throw permintaanSalah(`instrumen harus salah satu dari: ${Object.keys(INSTRUMEN).join(", ")}`);
  const dikirim = Array.isArray(jawabanKirim) ? jawabanKirim : [];
  let skor = 0;
  const jawaban = instrumen.pertanyaan.map((p) => {
    const j = dikirim.find((x) => x?.kode === p.kode);
    if (!j) throw permintaanSalah(`Jawaban "${p.teks}" wajib diisi`);
    const opsi = p.opsi.find((o) => o.nilai === j.nilai);
    if (!opsi) throw permintaanSalah(`Nilai jawaban untuk "${p.teks}" tidak valid`);
    skor += opsi.skor;
    return { kode: p.kode, nilai: opsi.nilai, skor: opsi.skor };
  });
  return { jawaban, skor, kategoriRisiko: kategoriRisiko(kodeInstrumen, skor) };
};

// Teks opsional dari body: undefined = tidak diubah, kosong = null.
export const teks = (v, maks = 0) => {
  if (v === undefined) return undefined;
  const s = String(v ?? "").trim();
  return s ? (maks ? s.slice(0, maks) : s) : null;
};
