import { Galat, permintaanSalah } from "../umum/respons.js";

// Konstanta & helper bersama modul Manajemen Ambulans (STD-0024).

export const JENIS_ARMADA = ["transport", "gawat_darurat", "jenazah"];
export const STATUS_ARMADA = ["siap", "bertugas", "servis"];
export const PERAN_KRU = ["sopir", "perawat"];
export const SUMBER_PERMINTAAN = ["igd", "ruangan", "telepon", "rujukan"];
export const JENIS_LAYANAN = ["gawat_darurat", "rujukan", "pemulangan", "jenazah"];
export const PRIORITAS = ["darurat", "segera", "biasa"];
export const STATUS_PERMINTAAN = ["menunggu", "ditugaskan", "proses", "selesai", "batal"];
export const STATUS_PENUGASAN = ["aktif", "selesai", "batal"];
export const STATUS_PERJALANAN = ["berjalan", "selesai"];
export const TAHAP_PERJALANAN = ["berangkat", "tiba_lokasi", "berangkat_tujuan", "tiba_tujuan", "kembali"];
export const METODE_TARIF = ["jenis", "per_km", "zona"];
export const STATUS_PENERUSAN = ["belum_dihitung", "menunggu", "terkirim", "gagal"];

// KF-6/G3: jenis armada yang boleh dipakai untuk suatu jenis layanan. Gawat darurat & jenazah butuh armada khusus;
// rujukan/pemulangan dapat memakai armada transport biasa atau armada gawat darurat.
export const ARMADA_UNTUK_LAYANAN = {
  gawat_darurat: ["gawat_darurat"],
  rujukan: ["transport", "gawat_darurat"],
  pemulangan: ["transport", "gawat_darurat"],
  jenazah: ["jenazah"],
};

// Kolom tahap perjalanan → nama kolom waktu di ambulans_perjalanan.
export const KOLOM_TAHAP = {
  berangkat: "berangkat_pada",
  tiba_lokasi: "tiba_lokasi_pada",
  berangkat_tujuan: "berangkat_tujuan_pada",
  tiba_tujuan: "tiba_tujuan_pada",
  kembali: "kembali_pada",
};

export const konflik = (pesan) => new Galat(409, pesan);

export const teks = (v) => {
  const s = String(v ?? "").trim();
  return s || null;
};

export const cekPilihan = (nilai, daftar, nama) => {
  if (nilai === undefined) return undefined;
  if (nilai === null || nilai === "") return null;
  if (!daftar.includes(nilai)) throw permintaanSalah(`${nama} harus salah satu: ${daftar.join(", ")}`);
  return nilai;
};

export const wajibPilihan = (nilai, daftar, nama) => {
  if (!daftar.includes(nilai)) throw permintaanSalah(`${nama} harus salah satu: ${daftar.join(", ")}`);
  return nilai;
};

export const angkaOpsional = (v, nama) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw permintaanSalah(`${nama} harus berupa angka`);
  return n;
};

// Pelanggaran unique index → pesan ramah (409). Galat lain diteruskan.
export const ramah = (e, pesan) => {
  if (e?.code === "23505") throw new Galat(409, pesan);
  throw e;
};

// KT-7/G3: jenis armada harus sesuai layanan dan armada harus berstatus siap.
export const pastikanArmadaLayak = (armada, jenisLayanan) => {
  if (!armada) throw permintaanSalah("Armada tidak ditemukan");
  if (armada.status !== "siap") throw konflik(`Armada ${armada.nomor_polisi} berstatus ${armada.status}, tidak dapat ditugaskan`);
  const cocok = ARMADA_UNTUK_LAYANAN[jenisLayanan] ?? [];
  if (!cocok.includes(armada.jenis)) throw permintaanSalah(`Jenis armada (${armada.jenis}) tidak sesuai untuk layanan ${jenisLayanan}`);
};

// KT-11/G4: waktu tahap berikutnya harus >= waktu tahap sebelumnya yang sudah tercatat.
export const pastikanUrutanWaktu = (perjalanan, tahap, waktu) => {
  const idx = TAHAP_PERJALANAN.indexOf(tahap);
  for (let i = idx - 1; i >= 0; i--) {
    const sebelumnya = perjalanan[KOLOM_TAHAP[TAHAP_PERJALANAN[i]]];
    if (sebelumnya != null && waktu < Number(sebelumnya)) {
      throw permintaanSalah(`Waktu ${tahap} tidak boleh lebih awal dari tahap sebelumnya`);
    }
  }
  for (let i = idx + 1; i < TAHAP_PERJALANAN.length; i++) {
    const sesudahnya = perjalanan[KOLOM_TAHAP[TAHAP_PERJALANAN[i]]];
    if (sesudahnya != null && waktu > Number(sesudahnya)) {
      throw permintaanSalah(`Waktu ${tahap} tidak boleh lebih akhir dari tahap sesudahnya yang sudah tercatat`);
    }
  }
};

// KT-12/KT-13/G4: kilometer akhir >= kilometer awal; jarak = selisih keduanya.
export const hitungJarak = (kmAwal, kmAkhir) => {
  const awal = Number(kmAwal);
  const akhir = Number(kmAkhir);
  if (!Number.isFinite(awal) || !Number.isFinite(akhir)) throw permintaanSalah("km_awal dan km_akhir wajib diisi dengan angka");
  if (akhir < awal) throw permintaanSalah("km_akhir tidak boleh lebih kecil dari km_awal");
  return Math.round((akhir - awal) * 10) / 10;
};

// KF-6: waktu respons = waktu keberangkatan - waktu permintaan (detik), null bila belum berangkat.
export const waktuRespons = (waktuPermintaan, berangkatPada) =>
  berangkatPada == null ? null : Number(berangkatPada) - Number(waktuPermintaan);
