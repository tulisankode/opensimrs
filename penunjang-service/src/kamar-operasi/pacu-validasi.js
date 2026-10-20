import { Galat } from "../umum/respons.js";

export const pastikan = (syarat, pesan, status = 422) => {
  if (!syarat) throw new Galat(status, pesan);
};
export const objek = (nilai) => nilai !== null && typeof nilai === "object" && !Array.isArray(nilai);
export const teksWajib = (nilai, nama) => {
  pastikan(typeof nilai === "string" && nilai.trim().length > 0, `${nama} wajib diisi`);
  return nilai.trim();
};
export const waktu = (nilai) => {
  pastikan(typeof nilai === "number" && Number.isSafeInteger(nilai) && nilai > 0, "Waktu wajib berupa epoch detik positif");
  return nilai;
};
export const versiValid = (baris, versi) => pastikan(Number.isSafeInteger(versi) && versi === baris.versi, "Versi sudah berubah; muat ulang data", 409);
export const statusValid = (episode, ...status) => pastikan(status.includes(episode.status), "Tindakan tidak sesuai status episode", 409);

export const definisiValid = (p) => {
  pastikan(objek(p), "Definisi protokol tidak valid");
  teksWajib(p.nama, "Nama protokol");
  for (const nama of ["parameter", "kriteria_pindah", "format_serah_terima"]) {
    pastikan(Array.isArray(p[nama]) && p[nama].length > 0, `${nama} wajib diisi`);
    const kode = new Set();
    for (const x of p[nama]) {
      pastikan(objek(x) && /^[a-z][a-z0-9_]*$/.test(x.kode) && !kode.has(x.kode), `Kode ${nama} tidak valid atau berulang`);
      kode.add(x.kode);
      teksWajib(x.nama, "Nama parameter");
      pastikan(["angka", "teks", "pilihan", "boolean"].includes(x.tipe) && typeof x.wajib === "boolean", "Tipe dan kewajiban parameter harus ditetapkan");
      if (x.tipe === "angka") teksWajib(x.satuan, "Satuan");
      if (x.tipe === "pilihan") pastikan(Array.isArray(x.pilihan) && x.pilihan.length > 0 && x.pilihan.every((v) => typeof v === "string" && v.trim()), "Pilihan parameter tidak valid");
    }
  }
  pastikan(Number.isSafeInteger(p.interval_pemantauan_detik) && p.interval_pemantauan_detik > 0, "Interval pemantauan harus ditetapkan faskes");
  return p;
};
export const nilaiValid = (definisi, nilai) => {
  pastikan(objek(nilai), "Nilai parameter harus berupa objek");
  pastikan(Object.keys(nilai).every((k) => definisi.some((d) => d.kode === k)), "Parameter tidak tercantum pada protokol");
  for (const d of definisi) {
    const v = nilai[d.kode];
    if (v === undefined || v === null || v === "") {
      pastikan(!d.wajib, `${d.nama} wajib diisi`);
      continue;
    }
    pastikan(d.tipe === "angka" ? typeof v === "number" && Number.isFinite(v)
      : d.tipe === "boolean" ? typeof v === "boolean"
      : d.tipe === "pilihan" ? d.pilihan.includes(v)
      : typeof v === "string" && !!v.trim(), `${d.nama} tidak sesuai tipe protokol`);
  }
};
export const urutanWaktu = (e, catatan = []) => {
  let terakhir = 0;
  for (const nama of ["waktu_tiba", "waktu_mulai_pemantauan", "waktu_siap_pindah", "waktu_keluar"]) {
    if (e[nama] === null || e[nama] === undefined) continue;
    const t = waktu(Number(e[nama]));
    pastikan(t >= terakhir, "Urutan waktu episode tidak valid");
    terakhir = t;
  }
  for (const c of catatan) {
    const t = waktu(Number(c.waktu_kejadian));
    pastikan(e.waktu_tiba != null && t >= Number(e.waktu_tiba) && (e.waktu_keluar == null || t <= Number(e.waktu_keluar)), "Waktu catatan berada di luar episode");
    if (["pemantauan", "asesmen", "intervensi"].includes(c.jenis)) pastikan(e.waktu_mulai_pemantauan != null && t >= Number(e.waktu_mulai_pemantauan), "Catatan mendahului pemantauan");
  }
};

export const konfigurasiBiaya = (nilai) => {
  if (nilai === undefined || nilai === null) return { aktif: false };
  pastikan(objek(nilai) && typeof nilai.aktif === "boolean", "Konfigurasi biaya tidak valid");
  if (!nilai.aktif) return { aktif: false };
  pastikan(typeof nilai.termasuk_paket === "boolean", "Cakupan paket operasi wajib ditetapkan");
  if (nilai.termasuk_paket) return { aktif: true, termasuk_paket: true };
  teksWajib(nilai.layanan_uuid, "Layanan biaya");
  teksWajib(nilai.nama, "Nama layanan biaya");
  pastikan(typeof nilai.tarif === "number" && Number.isFinite(nilai.tarif) && nilai.tarif > 0, "Tarif biaya harus ditetapkan faskes");
  return { aktif: true, termasuk_paket: false, layanan_uuid: nilai.layanan_uuid, nama: nilai.nama, tarif: nilai.tarif };
};
