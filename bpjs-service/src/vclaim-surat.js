import crypto from "crypto";
import { JENIS_PELAYANAN } from "./vclaim-peta.js";

// Aturan Rencana Kontrol & SPRI (STD-0021) sebagai fungsi murni: validasi masukan, sidik isi permintaan,
// keputusan idempotensi, status pemantauan (tanggal Asia/Jakarta), syarat surat untuk SEP, dan pemilihan kandidat
// rekonsiliasi. Tidak mengakses database maupun jaringan — dipakai vclaim.js dan diuji di test/vclaim-surat.test.js.

export const JENIS_SURAT = { RENCANA_KONTROL: "rencana_kontrol", SPRI: "spri" };
export const SUMBER_SURAT = ["rawat_jalan", "rawat_inap", "igd"];
// Filter status daftar surat (PRD KF-10): sama dengan nilai statusPemantauan
export const STATUS_SURAT = ["aktif", "jatuh_tempo", "digunakan", "diajukan", "gagal", "tidak_pasti", "dihapus"];
// Baris 'diajukan' lebih lama dari ini dianggap macet (proses terhenti di tengah) dan boleh direkonsiliasi
export const BATAS_DIAJUKAN_DETIK = 120;

export class GalatSurat extends Error {
  constructor(pesan, status = 400, detail) {
    super(pesan);
    this.status = status;
    this.detail = detail;
  }
}

const OFFSET_WIB_MS = 7 * 3600 * 1000; // Asia/Jakarta (WIB, tanpa musim panas)

// Tanggal lokal Asia/Jakarta 'YYYY-MM-DD' untuk suatu waktu (ms)
export const tanggalLokal = (ms = Date.now()) => new Date(ms + OFFSET_WIB_MS).toISOString().slice(0, 10);

export const tanggalValid = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const uuidValid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s ?? ""));

export const pastikanUuid = (s, nama = "UUID surat") => {
  if (!uuidValid(s)) throw new GalatSurat(`${nama} tidak valid`, 400);
  return String(s).toLowerCase();
};

// Nilai kolom DATE → 'YYYY-MM-DD'. Kolom dibaca lewat to_char di SQL (tgl_rencana_teks); cadangan untuk objek Date
// dari driver pg (DATE diurai sebagai tengah malam waktu lokal proses, jadi komponen lokal yang dipakai).
export const teksTanggal = (v) => {
  if (!v) return null;
  if (v instanceof Date) {
    const d2 = (n) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${d2(v.getMonth() + 1)}-${d2(v.getDate())}`;
  }
  return String(v).slice(0, 10);
};

// Status ringkas untuk pemantauan (KF-10): dihapus > diajukan/gagal/tidak_pasti > digunakan > jatuh_tempo > aktif.
// Jatuh tempo = tanggal rencana SEBELUM hari ini (Asia/Jakarta); surat bertanggal hari ini masih aktif.
export const statusPemantauan = (b, hariIni = tanggalLokal()) => {
  if (b.deleted_at) return "dihapus";
  if (b.status_operasi !== "terkonfirmasi") return b.status_operasi;
  if (b.status_pakai === "dipakai") return "digunakan";
  const tgl = b.tgl_rencana_teks ?? teksTanggal(b.tgl_rencana);
  if (tgl && tgl < hariIni) return "jatuh_tempo";
  return "aktif";
};

const teks = (v, maks, nama) => {
  if (v == null || v === "") return null;
  if (typeof v !== "string" && typeof v !== "number") throw new GalatSurat(`${nama} tidak valid`, 400);
  const s = String(v).trim();
  if (s.length > maks) throw new GalatSurat(`${nama} terlalu panjang (maks. ${maks} karakter)`, 400);
  return s || null;
};

const kode = (v, nama) => {
  const s = teks(v, 30, nama);
  if (s && !/^[A-Za-z0-9.\-]+$/.test(s)) throw new GalatSurat(`${nama} tidak valid`, 400);
  return s;
};

export const nomorKartu = (v) => {
  const s = String(v ?? "").replace(/\s/g, "");
  if (!/^\d{13}$/.test(s)) throw new GalatSurat("Nomor kartu BPJS harus 13 digit angka", 400);
  return s;
};

const tanggalRencana = (v, hariIni, nama) => {
  if (!tanggalValid(v)) throw new GalatSurat(`${nama} wajib berformat YYYY-MM-DD`, 400);
  if (v < hariIni) throw new GalatSurat(`${nama} tidak boleh sebelum hari ini (${hariIni})`, 400);
  return v;
};

/**
 * Validasi & normalisasi masukan pembuatan surat.
 * Rencana Kontrol: noKartu, patientUuid, sumber, dpjp, poliTujuan, tglRencana wajib; noSepAsal (SEP kunjungan asal) opsional.
 * SPRI: noKartu, patientUuid, sumber, dpjp, poliTujuan (spesialis DPJP), tglRencana wajib.
 */
export const validasiBuatSurat = (jenis, data, hariIni = tanggalLokal()) => {
  if (!data || typeof data !== "object") throw new GalatSurat("Isi permintaan tidak valid", 400);
  const spri = jenis === JENIS_SURAT.SPRI;
  const idempotencyKey = teks(data.idempotencyKey, 100, "Kunci idempotensi");
  if (!idempotencyKey) throw new GalatSurat("Kunci idempotensi wajib diisi", 400);
  const kolom = {
    idempotencyKey,
    noKartu: nomorKartu(data.noKartu),
    patientUuid: teks(data.patientUuid, 255, "Pasien"),
    noRm: teks(data.noRm, 50, "No. RM"),
    sumber: teks(data.sumber, 30, "Sumber"),
    sumberUuid: teks(data.sumberUuid, 255, "Kunjungan asal"),
    dpjp: kode(data.dpjp, "Kode dokter DPJP BPJS"),
    poliTujuan: kode(data.poliTujuan, spri ? "Spesialis/poli DPJP" : "Poli tujuan"),
    noSepAsal: spri ? null : kode(data.noSepAsal, "No. SEP asal"),
  };
  if (!kolom.patientUuid) throw new GalatSurat("Pasien OpenSIMRS wajib dipilih", 400);
  if (!kolom.sumber) throw new GalatSurat("Sumber (rawat_jalan | rawat_inap | igd) wajib diisi", 400);
  if (!SUMBER_SURAT.includes(kolom.sumber)) throw new GalatSurat("Sumber harus salah satu dari rawat_jalan, rawat_inap, igd", 400);
  if (!kolom.dpjp) throw new GalatSurat("Kode dokter DPJP BPJS wajib diisi", 400);
  if (!kolom.poliTujuan) throw new GalatSurat(spri ? "Spesialis/poli DPJP wajib diisi" : "Poli tujuan wajib diisi", 400);
  kolom.tglRencana = tanggalRencana(data.tglRencana, hariIni, spri ? "Tanggal rencana rawat inap" : "Tanggal rencana kontrol");
  return kolom;
};

// Perubahan surat: hanya DPJP, poli, dan tanggal rencana; minimal satu diisi.
export const validasiUbahSurat = (jenis, data, hariIni = tanggalLokal()) => {
  if (!data || typeof data !== "object") throw new GalatSurat("Isi permintaan tidak valid", 400);
  const ubah = {
    dpjp: kode(data.dpjp, "Kode dokter DPJP BPJS"),
    poliTujuan: kode(data.poliTujuan, "Poli tujuan"),
    tglRencana: data.tglRencana ? tanggalRencana(data.tglRencana, hariIni, "Tanggal rencana") : null,
  };
  if (!ubah.dpjp && !ubah.poliTujuan && !ubah.tglRencana) throw new GalatSurat("Tidak ada perubahan (DPJP, poli, atau tanggal rencana)", 400);
  return ubah;
};

// Sidik isi permintaan pembuatan surat: kunci idempotensi yang sama dengan isi berbeda ditolak (409).
export const sidikPermintaan = (jenis, k) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        jenis, k.noKartu, k.patientUuid, k.sumber, k.sumberUuid ?? null, k.dpjp, k.poliTujuan ?? null, k.tglRencana, k.noSepAsal ?? null,
      ])
    )
    .digest("hex");

/**
 * Keputusan saat baris dengan (faskes, jenis, idempotency_key) yang sama sudah ada (INSERT ... ON CONFLICT tidak menyisipkan).
 * Baris boleh berasal dari surat yang sudah dihapus (deleted_at terisi) karena kunci idempotensi tetap unik walau
 * surat dihapus — baris tersebut HARUS ditolak di sini, bukan dikembalikan sebagai surat aktif (KF-2).
 * - dihapus → 409, kunci idempotensi ini sudah dipakai surat yang terhapus;
 * - gagal (BPJS menolak pasti, belum ada surat) → klaim ulang dengan isi baru;
 * - isi berbeda → 409; terkonfirmasi → kembalikan surat yang sama tanpa memanggil VClaim;
 * - tidak_pasti → 409 (rekonsiliasi dulu); diajukan → 409 sedang diproses.
 */
export const keputusanIdempotensi = (baris, sidik) => {
  if (baris.deleted_at) {
    return { tolak: 409, pesan: "Kunci idempotensi ini sudah dipakai untuk surat yang telah dihapus; buat surat baru dengan kunci baru" };
  }
  if (baris.status_operasi === "gagal" && !baris.no_surat) return { klaimUlang: true };
  if (baris.sidik && baris.sidik !== sidik) {
    return { tolak: 409, pesan: "Kunci idempotensi ini sudah dipakai untuk permintaan dengan isi berbeda; buat surat baru dengan kunci baru" };
  }
  if (baris.no_surat) return { kembalikan: true };
  if (baris.status_operasi === "tidak_pasti") {
    return {
      tolak: 409,
      pesan: "Hasil permintaan sebelumnya dengan kunci idempotensi ini belum dapat dipastikan; jalankan \"Cek status di VClaim\" sebelum mencoba lagi",
    };
  }
  return { tolak: 409, pesan: "Permintaan dengan kunci idempotensi ini sedang diproses; tunggu sebentar lalu muat ulang daftar surat" };
};

// Ubah/hapus hanya untuk surat terkonfirmasi yang belum dipakai SEP (409 bila tidak).
export const periksaBolehUbah = (baris, aksi = "diubah") => {
  if (baris.status_pakai === "dipakai") throw new GalatSurat(`Surat sudah dipakai pada SEP${baris.sep_no_sep ? ` ${baris.sep_no_sep}` : ""}; tidak dapat ${aksi}`, 409);
  if (baris.status_operasi !== "terkonfirmasi" || !baris.no_surat) {
    throw new GalatSurat(`Hanya surat berstatus terkonfirmasi yang dapat ${aksi} (status sekarang: ${baris.status_operasi})`, 409);
  }
};

/**
 * Cara nomor surat (SKDP/SPRI) diisi pada SEP:
 * - 'surat'  : suratUuid → surat terdaftar di OpenSIMRS, divalidasi & dikunci atomik;
 * - 'manual' : nomor diketik bebas, HANYA bila fitur Rencana Kontrol & SPRI tidak aktif (perilaku sebelum STD-0021,
 *              surat dibuat di luar OpenSIMRS mis. aplikasi VClaim web) — status fitur tak diketahui = ditolak;
 * - 'tanpa'  : tanpa surat.
 */
export const caraNoSuratSep = ({ suratUuid, noSurat, fiturSurat }) => {
  if (suratUuid) return "surat";
  if (noSurat && String(noSurat).trim()) {
    if (fiturSurat === false) return "manual";
    throw new GalatSurat(
      fiturSurat === true
        ? "Nomor surat tidak boleh diketik bebas: pilih Rencana Kontrol/SPRI yang terdaftar (suratUuid)"
        : "Status fitur Rencana Kontrol & SPRI tidak dapat diperiksa; nomor surat bebas ditolak",
      400
    );
  }
  return "tanpa";
};

// Syarat surat untuk dipakai SEP (KF-8). Dipanggil sebelum penguncian atomik di vclaim.js#buatSep.
export const periksaSuratUntukSep = (baris, { patientUuid, noKartu, jenisPelayanan, modeNyata }) => {
  if (!baris || baris.deleted_at) throw new GalatSurat("Surat tidak ditemukan", 404);
  if (!baris.no_surat || baris.status_operasi !== "terkonfirmasi") throw new GalatSurat("Surat belum terkonfirmasi BPJS", 409);
  if (baris.status_pakai === "dipakai") throw new GalatSurat("Surat sudah digunakan pada SEP lain", 409);
  const jenisSesuai =
    jenisPelayanan === JENIS_PELAYANAN.RAWAT_INAP ? baris.jenis === JENIS_SURAT.SPRI : baris.jenis === JENIS_SURAT.RENCANA_KONTROL;
  if (!jenisSesuai) throw new GalatSurat("Jenis surat tidak sesuai dengan jenis pelayanan SEP", 422);
  if (!patientUuid || !baris.patient_uuid) throw new GalatSurat("Surat dan SEP wajib terkait pasien OpenSIMRS yang sama", 422);
  if (String(baris.patient_uuid) !== String(patientUuid)) throw new GalatSurat("Surat tidak sesuai dengan pasien", 422);
  if (String(baris.no_kartu) !== String(noKartu ?? "").replace(/\D/g, "")) throw new GalatSurat("Nomor kartu pada surat berbeda dengan nomor kartu SEP", 422);
  if (modeNyata && baris.simulasi) throw new GalatSurat("Surat simulasi (mode mock) tidak dapat dipakai untuk SEP nyata", 422);
  return baris;
};

// Filter daftar surat; nilai tidak valid → 400 (bukan galat database 500).
export const validasiFilterDaftar = (q = {}) => {
  const f = {
    page: Math.max(1, Math.floor(Number(q.page)) || 1),
    limit: Math.min(100, Math.max(1, Math.floor(Number(q.limit)) || 10)),
    status: String(q.status ?? "").trim(),
    noSurat: teks(q.noSurat, 30, "No. surat"),
    noKartu: teks(q.noKartu, 30, "No. kartu"),
    q: teks(q.q, 100, "Kata kunci"),
    patientUuid: teks(q.patientUuid, 255, "Pasien"),
    sumberUuid: teks(q.sumberUuid, 255, "Kunjungan asal"),
    dari: q.dari ? String(q.dari) : null,
    sampai: q.sampai ? String(q.sampai) : null,
  };
  if (f.status === "semua") f.status = "";
  if (f.status && !STATUS_SURAT.includes(f.status)) throw new GalatSurat(`Status harus salah satu dari: ${STATUS_SURAT.join(", ")}`, 400);
  if (f.dari && !tanggalValid(f.dari)) throw new GalatSurat("Parameter dari wajib berformat YYYY-MM-DD", 400);
  if (f.sampai && !tanggalValid(f.sampai)) throw new GalatSurat("Parameter sampai wajib berformat YYYY-MM-DD", 400);
  if (f.dari && f.sampai && f.dari > f.sampai) throw new GalatSurat("Parameter dari tidak boleh setelah sampai", 400);
  return f;
};

/**
 * Rekonsiliasi pembuatan surat yang tidak pasti: cocokkan daftar surat peserta dari VClaim dengan baris lokal.
 * Kandidat = surat peserta yang sama, tanggal rencana sama, DPJP sama (bila tersedia), jenis sama (bila tersedia),
 * dan nomornya belum tercatat di OpenSIMRS. noSuratDipilih (opsional) dipakai operator bila kandidat lebih dari satu.
 */
export const pilihKandidatRekonsiliasi = (daftar, baris, nomorTerpakai = new Set(), noSuratDipilih = null) => {
  const tgl = baris.tgl_rencana_teks ?? teksTanggal(baris.tgl_rencana);
  const jnsKontrol = baris.jenis === JENIS_SURAT.SPRI ? "1" : "2";
  const kandidat = (Array.isArray(daftar) ? daftar : []).filter(
    (x) =>
      x?.noSuratKontrol &&
      !nomorTerpakai.has(x.noSuratKontrol) &&
      (!x.noKartu || String(x.noKartu) === String(baris.no_kartu)) &&
      String(x.tglRencanaKontrol ?? "").slice(0, 10) === tgl &&
      (!x.kodeDokter || !baris.dpjp || String(x.kodeDokter) === String(baris.dpjp)) &&
      (!x.jnsKontrol || String(x.jnsKontrol) === jnsKontrol)
  );
  if (noSuratDipilih) {
    const terpilih = kandidat.find((x) => x.noSuratKontrol === noSuratDipilih);
    if (!terpilih) throw new GalatSurat("Nomor surat yang dipilih tidak termasuk kandidat yang cocok dari VClaim", 400);
    return { kandidat, terpilih };
  }
  return { kandidat, terpilih: kandidat.length === 1 ? kandidat[0] : null };
};
