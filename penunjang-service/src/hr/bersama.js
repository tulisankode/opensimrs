import { permintaanSalah } from "../umum/respons.js";
import { awalHariWib, bulatOpsional, epochOpsional, konflik, sekarangDetik, teks, teksWajib, wajibPilihan } from "../sarpras/bersama.js";

// Konstanta & helper murni HR / SDM — kepegawaian (STD-0035 fase 1). Tanpa database agar dapat diuji unit
// (test/sdm-kepegawaian.test.js). Helper validasi umum (teks, epoch, enum) dipakai ulang dari sarpras/bersama.js.
//
// Model riwayat (KF-2/KT-2): hr_kepegawaian menyimpan keadaan TERKINI; hr_riwayat_jabatan menyimpan potret
// (status, unit, jabatan, golongan) per masa berlaku. Setiap perubahan menutup potret terbuka pada tanggal berlaku
// (tanggal_selesai = tanggal_berlaku) lalu menambah potret baru — isi baris lama tidak pernah ditimpa.
// Tanggal disimpan sebagai epoch detik awal hari Asia/Jakarta (WIB).

export const STATUS_KEPEGAWAIAN = { tetap: "Pegawai Tetap", kontrak: "Kontrak", honorer: "Honorer", magang: "Magang", purna_tugas: "Purna Tugas" };
export const JENJANG_PENDIDIKAN = {
  sd: "SD",
  smp: "SMP",
  sma: "SMA/SMK",
  d1: "D1",
  d2: "D2",
  d3: "D3",
  d4: "D4 / Sarjana Terapan",
  s1: "S1",
  profesi: "Profesi",
  s2: "S2",
  spesialis: "Spesialis",
  s3: "S3",
  subspesialis: "Subspesialis",
};
// Kolom yang perubahannya dicatat sebagai riwayat.
export const KOLOM_RIWAYAT = ["status_kepegawaian", "unit_uuid", "jabatan", "golongan"];

const tanggal = (v, nama) => {
  const n = epochOpsional(v, nama);
  return n === undefined || n === null ? n : awalHariWib(n);
};
const tanggalWajib = (v, nama) => {
  const n = tanggal(v, nama);
  if (n === undefined || n === null) throw permintaanSalah(`${nama} wajib diisi`);
  return n;
};
const sama = (a, b) => String(a ?? "") === String(b ?? "");

// Body POST /kepegawaian → nilai tervalidasi (400 bila tidak sah).
export const validasiKepegawaianBaru = (b = {}) => ({
  pegawai_uuid: teksWajib(b.pegawai_uuid, "pegawai_uuid", 255),
  status_kepegawaian: wajibPilihan(b.status_kepegawaian, STATUS_KEPEGAWAIAN, "status_kepegawaian"),
  unit_uuid: teks(b.unit_uuid, "unit_uuid", 255) ?? null,
  jabatan: teks(b.jabatan, "jabatan", 150) ?? null,
  golongan: teks(b.golongan, "golongan", 50) ?? null,
  tanggal_mulai: tanggalWajib(b.tanggal_mulai, "tanggal_mulai"),
  nomor_sk: teks(b.nomor_sk, "nomor_sk", 100) ?? null,
  catatan: teks(b.catatan, "catatan", 2000) ?? null,
});

// Body PUT /kepegawaian/:uuid → { riwayat: {kolom riwayat yang dikirim}, tanggal_berlaku, tanggal_selesai, nomor_sk, catatan }.
export const validasiPerubahanKepegawaian = (b = {}) => {
  if (b.pegawai_uuid !== undefined) throw permintaanSalah("pegawai_uuid tidak dapat diubah; hapus dan catat ulang bila salah pegawai");
  if (b.tanggal_mulai !== undefined) throw permintaanSalah("tanggal_mulai tidak dapat diubah; hapus dan catat ulang bila salah input");
  const riwayat = {
    status_kepegawaian: b.status_kepegawaian === undefined ? undefined : wajibPilihan(b.status_kepegawaian, STATUS_KEPEGAWAIAN, "status_kepegawaian"),
    unit_uuid: teks(b.unit_uuid, "unit_uuid", 255),
    jabatan: teks(b.jabatan, "jabatan", 150),
    golongan: teks(b.golongan, "golongan", 50),
  };
  for (const k of Object.keys(riwayat)) if (riwayat[k] === undefined) delete riwayat[k];
  return {
    riwayat,
    tanggal_berlaku: tanggal(b.tanggal_berlaku, "tanggal_berlaku"),
    tanggal_selesai: tanggal(b.tanggal_selesai, "tanggal_selesai"),
    nomor_sk: teks(b.nomor_sk, "nomor_sk", 100) ?? null,
    catatan: teks(b.catatan, "catatan", 2000) ?? null,
  };
};

// Kolom riwayat yang nilainya benar-benar berubah dibanding keadaan terkini.
export const kolomBerubah = (lama, riwayat) => KOLOM_RIWAYAT.filter((k) => riwayat[k] !== undefined && !sama(riwayat[k], lama?.[k]));

const potret = (x) => Object.fromEntries(KOLOM_RIWAYAT.map((k) => [k, x?.[k] ?? null]));

// Rencana perubahan dari keadaan terkini `lama` (baris hr_kepegawaian), potret riwayat terbuka `terbuka` (boleh null),
// dan masukan tervalidasi. Mengembalikan { ubah, tutupRiwayat, riwayatBaru, kolom } — tanpa I/O.
//   - ubah kolom riwayat      : tanggal_berlaku wajib, tidak boleh sebelum TMT maupun awal potret terbuka;
//   - akhiri (tanggal_selesai): menutup potret terbuka, tidak boleh digabung dengan perubahan kolom;
//   - aktif kembali (tanggal_selesai = null pada kepegawaian yang sudah berakhir): potret baru mulai tanggal_berlaku.
export const susunPerubahan = (lama, terbuka, input) => {
  const kolom = kolomBerubah(lama, input.riwayat);
  const sudahBerakhir = lama.tanggal_selesai !== null && lama.tanggal_selesai !== undefined;
  const batasBawah = Math.max(Number(lama.tanggal_mulai) || 0, Number(terbuka?.tanggal_mulai) || 0);
  const ubah = Object.fromEntries(kolom.map((k) => [k, input.riwayat[k]]));
  const keterangan = { nomor_sk: input.nomor_sk ?? null, catatan: input.catatan ?? null };

  if (input.tanggal_selesai !== undefined && input.tanggal_selesai !== null) {
    if (sudahBerakhir) throw konflik("Kepegawaian sudah berakhir; aktifkan kembali (kosongkan tanggal_selesai) sebelum mengubahnya");
    if (kolom.length) throw permintaanSalah("Catat perubahan status/unit/jabatan/golongan dan pengakhiran kepegawaian secara terpisah");
    if (input.tanggal_selesai < batasBawah) throw permintaanSalah("tanggal_selesai tidak boleh sebelum tanggal mulai kepegawaian/riwayat terakhir");
    return { ubah: { tanggal_selesai: input.tanggal_selesai }, tutupRiwayat: terbuka ? input.tanggal_selesai : null, riwayatBaru: null, kolom: ["tanggal_selesai"] };
  }

  if (input.tanggal_selesai === null && sudahBerakhir) {
    const mulai = input.tanggal_berlaku;
    if (!mulai) throw permintaanSalah("tanggal_berlaku wajib diisi untuk mengaktifkan kembali kepegawaian");
    if (mulai < Number(lama.tanggal_selesai)) throw permintaanSalah("tanggal_berlaku tidak boleh sebelum tanggal kepegawaian berakhir");
    return {
      ubah: { ...ubah, tanggal_selesai: null },
      tutupRiwayat: null,
      riwayatBaru: { ...potret({ ...lama, ...ubah }), tanggal_mulai: mulai, jenis_perubahan: ["aktif_kembali", ...kolom].join(", "), ...keterangan },
      kolom: ["tanggal_selesai", ...kolom],
    };
  }

  if (!kolom.length) throw permintaanSalah("Tidak ada perubahan yang disimpan");
  if (sudahBerakhir) throw konflik("Kepegawaian sudah berakhir; aktifkan kembali sebelum mencatat perubahan");
  const mulai = input.tanggal_berlaku;
  if (!mulai) throw permintaanSalah("tanggal_berlaku wajib diisi bila status, unit, jabatan, atau golongan berubah");
  if (mulai < batasBawah) throw permintaanSalah("tanggal_berlaku tidak boleh sebelum tanggal mulai kepegawaian/riwayat terakhir");
  return {
    ubah,
    tutupRiwayat: terbuka ? mulai : null,
    riwayatBaru: { ...potret({ ...lama, ...ubah }), tanggal_mulai: mulai, jenis_perubahan: kolom.join(", "), ...keterangan },
    kolom,
  };
};

// Potret awal saat kepegawaian dicatat (riwayat pertama).
export const riwayatAwal = (baru) => ({ ...potret(baru), tanggal_mulai: baru.tanggal_mulai, jenis_perubahan: "awal", nomor_sk: baru.nomor_sk ?? null, catatan: baru.catatan ?? null });

// Ringkasan audit { kolom: { lama, baru } } hanya untuk kolom yang berubah (tanpa data pribadi pegawai).
export const ringkasanUbah = (lama, ubah) => Object.fromEntries(Object.keys(ubah).map((k) => [k, { lama: lama?.[k] ?? null, baru: ubah[k] ?? null }]));

// Pendidikan: jenjang & institusi wajib saat dicatat; tahun lulus 1950 s.d. tahun depan (WIB).
export const validasiPendidikan = (b = {}, { parsial = false } = {}) => {
  const tahunDepan = new Date((sekarangDetik() + 7 * 3600) * 1000).getUTCFullYear() + 1;
  const hasil = {
    jenjang: parsial && b.jenjang === undefined ? undefined : wajibPilihan(b.jenjang, JENJANG_PENDIDIKAN, "jenjang"),
    institusi: parsial && b.institusi === undefined ? undefined : teksWajib(b.institusi, "institusi", 255),
    bidang_studi: teks(b.bidang_studi, "bidang_studi", 150),
    tahun_lulus: bulatOpsional(b.tahun_lulus, "tahun_lulus", { min: 1950, maks: tahunDepan }),
  };
  if (!parsial) {
    hasil.bidang_studi ??= null;
    hasil.tahun_lulus ??= null;
  }
  return hasil;
};
