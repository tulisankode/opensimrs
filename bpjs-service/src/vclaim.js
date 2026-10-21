import config from "./config.js";
import { query, satu, sekarang } from "./db.js";
import { vclaim } from "./klien-vclaim.js";
import { GalatBpjs } from "./klien-pcare.js";
import {
  buatSep as bentukSep,
  hapusSep as bentukHapusSep,
  buatRencanaKontrol as bentukRencanaKontrol,
  ubahRencanaKontrol as bentukUbahRencanaKontrol,
  hapusRencanaKontrol as bentukHapusSurat,
  buatSpri as bentukSpri,
  ubahSpri as bentukUbahSpri,
  keTanggalVclaim,
  JENIS_PELAYANAN,
  JALUR_SURAT,
} from "./vclaim-peta.js";
import {
  JENIS_SURAT,
  BATAS_DIAJUKAN_DETIK,
  tanggalLokal,
  tanggalValid,
  teksTanggal,
  pastikanUuid,
  statusPemantauan,
  validasiBuatSurat,
  validasiUbahSurat,
  sidikPermintaan,
  keputusanIdempotensi,
  periksaBolehUbah,
  caraNoSuratSep,
  periksaSuratUntukSep,
  validasiFilterDaftar,
  pilihKandidatRekonsiliasi,
} from "./vclaim-surat.js";
import { enkripsi, dekripsi, samarkan } from "./rahasia.js";
import { DataBelumLengkap } from "./pcare.js";

// --- Konfigurasi --------------------------------------------------------------------------------

const barisKonfigurasi = (faskesUuid) =>
  satu(
    `SELECT id, vclaim_aktif, vclaim_cons_id, vclaim_secret_key, vclaim_user_key, vclaim_kd_ppk,
            cons_id, secret_key, user_key, p_p_k
     FROM integrations WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`,
    [faskesUuid]
  );

// Kolom lama (cons_id, secret_key, user_key, p_p_k — dari halaman VClaim versi lama, tidak terenkripsi)
// dipakai sebagai cadangan sampai konfigurasi disimpan ulang lewat bpjs-service.
export const kredensial = async (faskesUuid) => {
  const k = await barisKonfigurasi(faskesUuid);
  return {
    aktif: !!k?.vclaim_aktif,
    consId: (k?.vclaim_cons_id || k?.cons_id)?.trim(),
    secretKey: (dekripsi(k?.vclaim_secret_key) || k?.secret_key)?.trim(),
    userKey: (dekripsi(k?.vclaim_user_key) || k?.user_key)?.trim(),
    kdPpk: (k?.vclaim_kd_ppk || k?.p_p_k)?.trim(),
  };
};

const lengkap = (k) => !!(k.consId && k.secretKey && k.userKey && k.kdPpk);

export const konfigurasiTersamar = async (faskesUuid) => {
  const k = await kredensial(faskesUuid);
  return {
    aktif: k.aktif,
    consId: k.consId ?? "",
    secretKey: samarkan(k.secretKey),
    userKey: samarkan(k.userKey),
    kdPpk: k.kdPpk ?? "",
    lengkap: lengkap(k),
    mode: config.mode,
    lingkungan: config.lingkungan,
  };
};

export const simpanKonfigurasi = async (faskesUuid, data) => {
  const baris = await barisKonfigurasi(faskesUuid);
  if (!baris) throw new DataBelumLengkap("Data integrasi faskes belum ada; buka Setting › Konfigurasi Integrasi sekali dulu");
  const teks = (v) => (v == null ? null : String(v).trim());
  // rahasia kosong = tidak diubah (ambil nilai terenkripsi lama, atau enkripsi nilai kolom lama)
  const rahasia = (baru, lamaTerenkripsi, lamaPolos) =>
    teks(baru) ? enkripsi(teks(baru)) : lamaTerenkripsi || (lamaPolos ? enkripsi(lamaPolos.trim()) : null);
  const disimpan = await satu(
    `UPDATE integrations SET
       vclaim_aktif = $2, vclaim_cons_id = $3, vclaim_secret_key = $4, vclaim_user_key = $5, vclaim_kd_ppk = $6,
       secret_key = NULL, user_key = NULL, updated_at = $7
     WHERE id = $1 AND faskes_uuid = $8 AND deleted_at IS NULL
     RETURNING id`,
    [
      baris.id,
      !!data.aktif,
      teks(data.consId) || null,
      rahasia(data.secretKey, baris.vclaim_secret_key, baris.secret_key),
      rahasia(data.userKey, baris.vclaim_user_key, baris.user_key),
      teks(data.kdPpk) || null,
      sekarang(),
      faskesUuid,
    ]
  );
  if (!disimpan) throw new DataBelumLengkap("Data integrasi faskes ini tidak ditemukan atau sudah dihapus");
  return konfigurasiTersamar(faskesUuid);
};

const kredensialSiap = async (faskesUuid) => {
  const k = await kredensial(faskesUuid);
  if (!lengkap(k)) throw new DataBelumLengkap("Konfigurasi BPJS VClaim belum lengkap (Cons ID, Secret Key, User Key, Kode PPK)");
  return k;
};

export const ujiKoneksi = async (faskesUuid) => {
  const k = await kredensialSiap(faskesUuid);
  const { response } = await vclaim(k, "GET", "/referensi/propinsi");
  return { mode: config.mode, lingkungan: config.lingkungan, jumlahPropinsi: response?.list?.length ?? 0, kdPpk: k.kdPpk };
};

// --- Peserta, rujukan, referensi -----------------------------------------------------------------

export const cekPeserta = async (faskesUuid, nomor, tgl) => {
  const k = await kredensialSiap(faskesUuid);
  const angka = String(nomor ?? "").replace(/\D/g, "");
  if (angka.length !== 13 && angka.length !== 16) throw new DataBelumLengkap("Nomor kartu BPJS (13 digit) atau NIK (16 digit) tidak valid");
  const tanggal = keTanggalVclaim(tgl || Date.now());
  const jalur = angka.length === 16 ? `/Peserta/nik/${angka}/tglSEP/${tanggal}` : `/Peserta/nokartu/${angka}/tglSEP/${tanggal}`;
  const { response } = await vclaim(k, "GET", jalur);
  if (!response?.peserta) throw new GalatBpjs("Peserta tidak ditemukan di BPJS", 404);
  return response.peserta;
};

// Rujukan aktif peserta dari FKTP (asal 1) dan dari RS lain (asal 2)
export const daftarRujukan = async (faskesUuid, noKartu) => {
  const k = await kredensialSiap(faskesUuid);
  const ambil = async (jalur, asal) => {
    try {
      const { response } = await vclaim(k, "GET", jalur);
      return (response?.rujukan ?? []).map((r) => ({ ...r, asalRujukan: asal }));
    } catch (error) {
      if (error.status === 422) return []; // "data tidak ditemukan"
      throw error;
    }
  };
  const [fktp, rs] = await Promise.all([
    ambil(`/Rujukan/List/Peserta/${noKartu}`, "1"),
    ambil(`/Rujukan/RS/List/Peserta/${noKartu}`, "2"),
  ]);
  return [...fktp, ...rs].sort((a, b) => String(b.tglKunjungan).localeCompare(String(a.tglKunjungan)));
};

export const referensi = async (faskesUuid, jenis, { q = "", jnsPelayanan = "2", tgl = "", spesialis = "" } = {}) => {
  const k = await kredensialSiap(faskesUuid);
  let jalur;
  if (jenis === "diagnosa") jalur = `/referensi/diagnosa/${encodeURIComponent(q || "A")}`;
  else if (jenis === "poli") jalur = `/referensi/poli/${encodeURIComponent(q || "A")}`;
  else if (jenis === "dokter") {
    if (!spesialis) throw new DataBelumLengkap("Kode spesialis/poli wajib untuk referensi dokter");
    jalur = `/referensi/dokter/pelayanan/${jnsPelayanan}/tglPelayanan/${keTanggalVclaim(tgl || Date.now())}/Spesialis/${encodeURIComponent(spesialis)}`;
  } else throw new DataBelumLengkap(`Referensi "${jenis}" tidak dikenal`);
  try {
    const { response } = await vclaim(k, "GET", jalur);
    return response?.diagnosa ?? response?.poli ?? response?.list ?? [];
  } catch (error) {
    if (error.status === 422) return [];
    throw error;
  }
};

// --- Pasien & kunjungan OpenSIMRS untuk dikaitkan ke SEP ---------------------------------------------

export const cariPasien = async (faskesUuid, noKartu) => {
  const pasien = await query(
    `SELECT DISTINCT p.uuid, p.name, p.no_rm, p.phone, ia.account_number AS no_kartu
     FROM insurance_accounts ia JOIN patients p ON p.uuid = ia.patient_uuid AND p.deleted_at IS NULL
     WHERE ia.faskes_uuid = $1 AND ia.deleted_at IS NULL AND ia.name ILIKE 'BPJS%' AND regexp_replace(ia.account_number, '\\D', '', 'g') = $2`,
    [faskesUuid, String(noKartu).replace(/\D/g, "")]
  );
  for (const p of pasien) {
    p.kunjungan = await query(
      `SELECT 'rawat_jalan' AS sumber, rj.uuid, rj.no_reg, rj.no_pelayanan, rj.tanggal_daftar, rj.status_rj AS status,
              l.name AS lokasi, l.kd_poli_vclaim, pr.code_bpjs AS kd_dpjp, pg.name AS dokter
       FROM rawat_jalans rj
       LEFT JOIN lokasi l ON l.uuid = rj.lokasi_uuid AND l.deleted_at IS NULL
       LEFT JOIN practitioner pr ON pr.uuid = rj.practitioner_uuid AND pr.deleted_at IS NULL
       LEFT JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid AND pg.deleted_at IS NULL
       WHERE rj.faskes_uuid = $1 AND rj.patient_uuid = $2 AND rj.deleted_at IS NULL AND rj.status_rj <> 0
         AND rj.tanggal_daftar >= $3
       ORDER BY rj.tanggal_daftar DESC LIMIT 10`,
      [faskesUuid, p.uuid, sekarang() - 30 * 86400]
    );
  }
  return pasien;
};

// --- Rencana Kontrol & SPRI (STD-0021) ------------------------------------------------------------
// Satu tabel bpjs_vclaim_surat untuk kedua jenis surat. VClaim adalah sumber nomor surat: no_surat tetap NULL sampai
// status_operasi='terkonfirmasi'. Aturan murni (validasi, sidik, idempotensi, status, syarat SEP) ada di vclaim-surat.js.
// Semua perubahan status memakai UPDATE bersyarat (klaim atomik) sehingga permintaan bersamaan tidak saling menimpa:
// - buat  : INSERT ... ON CONFLICT (faskes, jenis, idempotency_key) DO NOTHING — hanya satu permintaan yang mengirim;
// - ubah/hapus: terkonfirmasi & belum_dipakai → 'diajukan' selama VClaim dipanggil (SEP tidak bisa memakai surat itu);
// - SEP   : belum_dipakai → dipakai sebelum SEP dikirim; dilepas kembali bila BPJS menolak SEP secara pasti.

export { JENIS_SURAT };

const PILIH_SURAT = `SELECT *, to_char(tgl_rencana, 'YYYY-MM-DD') AS tgl_rencana_teks FROM bpjs_vclaim_surat`;
const KEMBALI_SURAT = `RETURNING *, to_char(tgl_rencana, 'YYYY-MM-DD') AS tgl_rencana_teks`;
const pesanGalat = (error) => String(error?.message || "Galat BPJS VClaim").slice(0, 500);
// 422 = BPJS menolak secara pasti (metaData 201/validasi); selain itu (jaringan, 5xx, respons aneh) = hasil tidak pasti
const gagalPasti = (error) => Number(error?.status) === 422;

const petaSurat = (b) => {
  if (!b) return b;
  const tglRencana = b.tgl_rencana_teks ?? teksTanggal(b.tgl_rencana);
  return {
    uuid: b.uuid,
    jenis: b.jenis,
    noSurat: b.no_surat,
    noKartu: b.no_kartu,
    noRm: b.no_rm,
    patientUuid: b.patient_uuid,
    namaPasien: b.nama_pasien ?? null,
    sumber: b.sumber,
    sumberUuid: b.sumber_uuid,
    dpjp: b.dpjp,
    namaDokter: b.respons?.namaDokter ?? null,
    poliTujuan: b.poli_tujuan,
    noSepAsal: b.no_sep_asal ?? null,
    tglRencana,
    statusOperasi: b.status_operasi,
    statusPakai: b.status_pakai,
    status: statusPemantauan({ ...b, tgl_rencana_teks: tglRencana }),
    operasiTerakhir: b.operasi_terakhir ?? null,
    simulasi: b.simulasi,
    pesanGalat: b.pesan_galat,
    sepNoSep: b.sep_no_sep,
    dibuatOleh: b.dibuat_oleh,
    diubahOleh: b.diubah_oleh,
    createdAt: Number(b.created_at),
    updatedAt: Number(b.updated_at),
    deletedAt: b.deleted_at != null ? Number(b.deleted_at) : null,
  };
};

// Operasi Rencana Kontrol/SPRI di luar mode mock ditolak SEBELUM koneksi keluar sampai jalur & payload VClaim
// diverifikasi (config.vclaimRenkonDikonfirmasi) — pola sama dengan MCU PCare (config.mcuPcareDikonfirmasi).
export const pastikanModeSurat = () => {
  if (config.mode !== "mock" && !config.vclaimRenkonDikonfirmasi) {
    throw new GalatBpjs(
      "Jalur & payload Rencana Kontrol/SPRI VClaim belum diverifikasi ke katalog resmi BPJS — operasi nyata belum diaktifkan " +
        "(BPJS_VCLAIM_RENKON_DIKONFIRMASI). Mode mock tetap tersedia untuk uji coba.",
      422
    );
  }
};

// Pasien wajib milik faskes ini; kunjungan asal (bila diisi) wajib milik pasien yang sama. No. RM diambil dari pasien.
const lengkapiPasien = async (faskesUuid, kolom) => {
  const pasien = await satu(`SELECT uuid, no_rm FROM patients WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [
    kolom.patientUuid, faskesUuid,
  ]);
  if (!pasien) throw new GalatBpjs("Pasien tidak ditemukan di faskes ini", 422);
  kolom.noRm = pasien.no_rm ?? kolom.noRm;
  if (kolom.sumberUuid) {
    const tabel = { rawat_jalan: "rawat_jalans", rawat_inap: "rawat_inaps", igd: "instalasi_gawat_darurats" }[kolom.sumber];
    const kunjungan = await satu(`SELECT uuid FROM ${tabel} WHERE uuid = $1 AND faskes_uuid = $2 AND patient_uuid = $3 AND deleted_at IS NULL`, [
      kolom.sumberUuid, faskesUuid, kolom.patientUuid,
    ]);
    if (!kunjungan) throw new GalatBpjs("Kunjungan asal tidak ditemukan atau bukan milik pasien ini", 422);
  }
  return kolom;
};

// Membuat surat (POST) dengan idempotensi atomik per (faskes, jenis, idempotency_key) dan sidik isi permintaan.
const buatSurat = async ({ faskesUuid, pengguna, jenis, data, buatPermintaan, jalurVclaim, ambilNoSurat }) => {
  const kolom = validasiBuatSurat(jenis, data);
  pastikanModeSurat();
  const k = await kredensialSiap(faskesUuid);
  await lengkapiPasien(faskesUuid, kolom);
  const sidik = sidikPermintaan(jenis, kolom);
  const permintaan = buatPermintaan(kolom, pengguna);
  const isi = [
    kolom.noKartu, kolom.noRm || null, kolom.patientUuid, kolom.sumber, kolom.sumberUuid || null, kolom.dpjp,
    kolom.poliTujuan || null, kolom.tglRencana, kolom.noSepAsal || null, config.mode === "mock", sidik, JSON.stringify(permintaan), pengguna,
  ];

  let baris = await satu(
    `INSERT INTO bpjs_vclaim_surat (faskes_uuid, jenis, idempotency_key, no_kartu, no_rm, patient_uuid, sumber, sumber_uuid, dpjp,
       poli_tujuan, tgl_rencana, no_sep_asal, simulasi, sidik, permintaan, dibuat_oleh, status_operasi, status_pakai, operasi_terakhir,
       created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'diajukan','belum_dipakai','buat',$17,$17)
     ON CONFLICT (faskes_uuid, jenis, idempotency_key) DO NOTHING ${KEMBALI_SURAT}`,
    [faskesUuid, jenis, kolom.idempotencyKey, ...isi, sekarang()]
  );

  if (!baris) {
    const ada = await satu(`${PILIH_SURAT} WHERE faskes_uuid = $1 AND jenis = $2 AND idempotency_key = $3`, [faskesUuid, jenis, kolom.idempotencyKey]);
    if (!ada) throw new GalatBpjs("Permintaan bentrok dengan permintaan lain; coba lagi", 409);
    const keputusan = keputusanIdempotensi(ada, sidik);
    if (keputusan.kembalikan) return { ...petaSurat(ada), diulang: true }; // sudah terkonfirmasi: hasil sama, tanpa memanggil VClaim
    if (keputusan.tolak) throw new GalatBpjs(keputusan.pesan, keputusan.tolak, { uuid: ada.uuid, statusOperasi: ada.status_operasi });
    // Ulang setelah 'gagal': klaim ulang atomik sekaligus memperbarui kolom dengan isi permintaan yang baru
    baris = await satu(
      `UPDATE bpjs_vclaim_surat SET no_kartu = $2, no_rm = $3, patient_uuid = $4, sumber = $5, sumber_uuid = $6, dpjp = $7, poli_tujuan = $8,
         tgl_rencana = $9, no_sep_asal = $10, simulasi = $11, sidik = $12, permintaan = $13, dibuat_oleh = $14, status_operasi = 'diajukan',
         operasi_terakhir = 'buat', pesan_galat = NULL, respons = NULL, updated_at = $15
       WHERE id = $1 AND status_operasi = 'gagal' AND no_surat IS NULL ${KEMBALI_SURAT}`,
      [ada.id, ...isi, sekarang()]
    );
    if (!baris) throw new GalatBpjs("Permintaan dengan kunci idempotensi ini sedang diproses", 409, { uuid: ada.uuid });
  }

  try {
    const { response } = await vclaim(k, "POST", jalurVclaim, permintaan);
    const noSurat = ambilNoSurat(response);
    if (!noSurat) throw new GalatBpjs("BPJS tidak mengembalikan nomor surat", 502, response);
    const diperbarui = await satu(
      `UPDATE bpjs_vclaim_surat SET no_surat = $2, status_operasi = 'terkonfirmasi', respons = $3, pesan_galat = NULL, updated_at = $4
       WHERE id = $1 ${KEMBALI_SURAT}`,
      [baris.id, noSurat, JSON.stringify(response), sekarang()]
    );
    return petaSurat(diperbarui);
  } catch (error) {
    await query(`UPDATE bpjs_vclaim_surat SET status_operasi = $2, pesan_galat = $3, updated_at = $4 WHERE id = $1`, [
      baris.id, gagalPasti(error) ? "gagal" : "tidak_pasti", pesanGalat(error), sekarang(),
    ]);
    throw error;
  }
};

// Sengaja TIDAK menyaring deleted_at di SQL: semua pemanggil (ubahSurat, hapusSurat, rekonsiliasiSurat) memang perlu
// membaca surat yang sudah dihapus untuk memberi pesan yang tepat (409 "sudah dihapus") atau idempotensi penghapusan,
// lalu memeriksa baris.deleted_at sendiri — surat terhapus tidak pernah dikembalikan sebagai surat aktif dari sini.
const ambilSuratAktif = async (faskesUuid, jenis, uuid) => {
  const baris = await satu(`${PILIH_SURAT} WHERE faskes_uuid = $1 AND uuid = $2 AND jenis = $3`, [faskesUuid, pastikanUuid(uuid), jenis]);
  if (!baris) throw new GalatBpjs("Surat tidak ditemukan", 404);
  return baris;
};

// Klaim atomik ubah/hapus: hanya surat terkonfirmasi yang belum dipakai SEP. Selama VClaim dipanggil status menjadi
// 'diajukan' sehingga SEP, ubah, atau hapus lain yang bersamaan tidak dapat memakai surat ini.
const klaimUbah = async (baris, operasi) => {
  periksaBolehUbah(baris, operasi === "hapus" ? "dihapus" : "diubah");
  if (baris.simulasi && config.mode !== "mock") throw new GalatBpjs("Surat simulasi (mode mock) tidak dapat diubah/dihapus di mode nyata", 409);
  const diklaim = await satu(
    `UPDATE bpjs_vclaim_surat SET status_operasi = 'diajukan', operasi_terakhir = $2, updated_at = $3
     WHERE id = $1 AND status_operasi = 'terkonfirmasi' AND status_pakai = 'belum_dipakai' AND deleted_at IS NULL ${KEMBALI_SURAT}`,
    [baris.id, operasi, sekarang()]
  );
  if (!diklaim) throw new GalatBpjs("Surat sedang diproses atau sudah dipakai SEP; muat ulang lalu coba lagi", 409);
  return diklaim;
};

// Kegagalan ubah/hapus: penolakan pasti BPJS mengembalikan status 'terkonfirmasi' (surat lama tetap berlaku);
// kegagalan jaringan/ambigu menandai 'tidak_pasti' untuk direkonsiliasi lewat "Cek status di VClaim".
const kembalikanKlaim = (baris, error, keterangan) =>
  query(`UPDATE bpjs_vclaim_surat SET status_operasi = $2, pesan_galat = $3, updated_at = $4 WHERE id = $1`, [
    baris.id, gagalPasti(error) ? "terkonfirmasi" : "tidak_pasti", `${keterangan}: ${pesanGalat(error)}`.slice(0, 500), sekarang(),
  ]);

// Mengubah surat (PUT): hanya untuk surat terkonfirmasi & belum dipakai; sukses → kembali 'terkonfirmasi'.
const ubahSurat = async ({ faskesUuid, pengguna, jenis, uuid, data, buatPermintaan, jalurVclaim, ambilNoSurat }) => {
  const perubahan = validasiUbahSurat(jenis, data);
  pastikanModeSurat();
  const lama = await ambilSuratAktif(faskesUuid, jenis, uuid);
  if (lama.deleted_at) throw new GalatBpjs("Surat sudah dihapus", 409);
  const k = await kredensialSiap(faskesUuid);
  const baris = await klaimUbah(lama, "ubah");
  const baru = {
    dpjp: perubahan.dpjp ?? baris.dpjp,
    poliTujuan: perubahan.poliTujuan ?? baris.poli_tujuan,
    tglRencana: perubahan.tglRencana ?? baris.tgl_rencana_teks,
  };
  const permintaan = buatPermintaan(baris, baru, pengguna);
  try {
    const { response } = await vclaim(k, "PUT", jalurVclaim, permintaan);
    const diperbarui = await satu(
      `UPDATE bpjs_vclaim_surat SET no_surat = $2, dpjp = $3, poli_tujuan = $4, tgl_rencana = $5, status_operasi = 'terkonfirmasi',
         respons = $6, permintaan = $7, pesan_galat = NULL, diubah_oleh = $8, updated_at = $9
       WHERE id = $1 ${KEMBALI_SURAT}`,
      [
        baris.id, ambilNoSurat(response) || baris.no_surat, baru.dpjp, baru.poliTujuan, baru.tglRencana,
        JSON.stringify(response), JSON.stringify(permintaan), pengguna, sekarang(),
      ]
    );
    return petaSurat(diperbarui);
  } catch (error) {
    await kembalikanKlaim(baris, error, "Perubahan surat gagal");
    throw error;
  }
};

// Menghapus surat (DELETE): hanya untuk surat terkonfirmasi & belum dipakai SEP; sudah dihapus = idempoten.
const hapusSurat = async ({ faskesUuid, pengguna, jenis, uuid }) => {
  const lama = await ambilSuratAktif(faskesUuid, jenis, uuid);
  if (lama.deleted_at) return petaSurat(lama);
  pastikanModeSurat();
  const k = await kredensialSiap(faskesUuid);
  const baris = await klaimUbah(lama, "hapus");
  try {
    await vclaim(k, "DELETE", JALUR_SURAT.HAPUS, bentukHapusSurat({ noSuratKontrol: baris.no_surat, user: pengguna }));
  } catch (error) {
    await kembalikanKlaim(baris, error, "Penghapusan surat gagal");
    throw error;
  }
  const t0 = sekarang();
  const diperbarui = await satu(
    `UPDATE bpjs_vclaim_surat SET status_operasi = 'dihapus', pesan_galat = NULL, dihapus_oleh = $2, deleted_at = $3, updated_at = $3
     WHERE id = $1 ${KEMBALI_SURAT}`,
    [baris.id, pengguna, t0]
  );
  return petaSurat(diperbarui);
};

/**
 * Rekonsiliasi surat berstatus 'tidak_pasti' (atau 'diajukan' yang macet > BATAS_DIAJUKAN_DETIK) — "Cek status di VClaim".
 * - Sudah bernomor (ubah/hapus tidak pasti): cari nomor surat di VClaim → selaraskan isi, atau tandai dihapus bila
 *   surat tidak ada lagi.
 * - Belum bernomor (buat tidak pasti): cari daftar surat peserta pada bulan tanggal rencana → satu kandidat cocok =
 *   terkonfirmasi; tidak ada = 'gagal' (aman diulang dengan kunci yang sama); beberapa = operator memilih noSurat.
 */
const rekonsiliasiSurat = async ({ faskesUuid, pengguna, jenis, uuid, data }) => {
  const baris = await ambilSuratAktif(faskesUuid, jenis, uuid);
  const macet = baris.status_operasi === "diajukan" && sekarang() - Number(baris.updated_at) > BATAS_DIAJUKAN_DETIK;
  if (baris.deleted_at || (baris.status_operasi !== "tidak_pasti" && !macet)) {
    throw new GalatBpjs(
      `Cek status hanya untuk surat berstatus tidak pasti atau diajukan lebih dari ${BATAS_DIAJUKAN_DETIK / 60} menit (status sekarang: ${statusPemantauan(baris)})`,
      409
    );
  }
  pastikanModeSurat();
  const k = await kredensialSiap(faskesUuid);
  const ambil = async (jalur) => {
    try {
      return (await vclaim(k, "GET", jalur)).response;
    } catch (error) {
      if (gagalPasti(error)) return null; // "data tidak ditemukan"
      throw error;
    }
  };
  // Pembaruan bersyarat: hanya bila status belum diubah permintaan lain sejak dibaca
  const selaraskan = (set, nilai) =>
    satu(
      `UPDATE bpjs_vclaim_surat SET ${set}, updated_at = $3 WHERE id = $1 AND status_operasi = $2 AND deleted_at IS NULL ${KEMBALI_SURAT}`,
      [baris.id, baris.status_operasi, sekarang(), ...nilai]
    );

  let hasil;
  let kandidat = [];
  if (baris.no_surat) {
    const surat = await ambil(JALUR_SURAT.cariNomor(baris.no_surat));
    if (!surat) {
      hasil = await selaraskan(`status_operasi = 'dihapus', pesan_galat = $4, dihapus_oleh = $5, deleted_at = $3`, [
        baris.operasi_terakhir === "hapus" ? null : "Surat tidak ditemukan lagi di VClaim saat cek status", pengguna,
      ]);
    } else {
      hasil = await selaraskan(
        `status_operasi = 'terkonfirmasi', pesan_galat = NULL, dpjp = COALESCE($4, dpjp), poli_tujuan = COALESCE($5, poli_tujuan),
         tgl_rencana = COALESCE($6::date, tgl_rencana), respons = $7`,
        [surat.kodeDokter || null, surat.poliTujuan || null, tanggalValid(surat.tglRencanaKontrol) ? surat.tglRencanaKontrol : null, JSON.stringify(surat)]
      );
    }
  } else {
    const [tahun, bulan] = String(baris.tgl_rencana_teks ?? "").split("-");
    const daftar = (await ambil(JALUR_SURAT.daftarPeserta(bulan, tahun, baris.no_kartu)))?.list ?? [];
    const nomor = daftar.map((x) => x?.noSuratKontrol).filter(Boolean);
    const terpakai = nomor.length
      ? new Set((await query(`SELECT no_surat FROM bpjs_vclaim_surat WHERE faskes_uuid = $1 AND no_surat = ANY($2)`, [faskesUuid, nomor])).map((r) => r.no_surat))
      : new Set();
    const pilihan = pilihKandidatRekonsiliasi(daftar, baris, terpakai, data?.noSurat ? String(data.noSurat) : null);
    kandidat = pilihan.kandidat;
    if (pilihan.terpilih) {
      hasil = await selaraskan(`status_operasi = 'terkonfirmasi', no_surat = $4, respons = $5, pesan_galat = NULL`, [
        pilihan.terpilih.noSuratKontrol, JSON.stringify(pilihan.terpilih),
      ]);
    } else if (!kandidat.length) {
      hasil = await selaraskan(`status_operasi = 'gagal', pesan_galat = $4`, [
        "Surat tidak ditemukan di VClaim saat cek status; aman untuk mencoba lagi dengan kunci idempotensi yang sama",
      ]);
    } else {
      hasil = await selaraskan(`pesan_galat = $4`, [`Ditemukan ${kandidat.length} surat yang cocok di VClaim; pilih nomor surat yang benar`]);
    }
  }
  if (!hasil) throw new GalatBpjs("Status surat berubah oleh permintaan lain; muat ulang lalu coba lagi", 409);
  return {
    ...petaSurat(hasil),
    kandidat: kandidat.map((x) => ({
      noSurat: x.noSuratKontrol, tglRencana: x.tglRencanaKontrol, kodeDokter: x.kodeDokter, namaDokter: x.namaDokter, poliTujuan: x.poliTujuan,
    })),
  };
};

const daftarSurat = async (faskesUuid, jenis, q) => {
  const f = validasiFilterDaftar(q);
  const hariIni = tanggalLokal();
  const nilai = [faskesUuid, jenis];
  const kondisi = ["s.faskes_uuid = $1", "s.jenis = $2"];
  const tambah = (sql, v) => {
    nilai.push(v);
    kondisi.push(sql.replaceAll("?", `$${nilai.length}`));
  };
  if (f.noSurat) tambah("s.no_surat ILIKE ?", `%${f.noSurat}%`);
  if (f.noKartu) tambah("s.no_kartu ILIKE ?", `%${f.noKartu}%`);
  if (f.q) tambah("(s.no_surat ILIKE ? OR s.no_kartu ILIKE ? OR s.no_rm ILIKE ? OR p.name ILIKE ?)", `%${f.q}%`);
  if (f.patientUuid) tambah("s.patient_uuid = ?", f.patientUuid);
  if (f.sumberUuid) tambah("s.sumber_uuid = ?", f.sumberUuid);
  if (f.dari) tambah("s.tgl_rencana >= ?::date", f.dari);
  if (f.sampai) tambah("s.tgl_rencana <= ?::date", f.sampai);
  if (f.status === "dihapus") kondisi.push("s.deleted_at IS NOT NULL");
  else kondisi.push("s.deleted_at IS NULL");
  if (["diajukan", "gagal", "tidak_pasti"].includes(f.status)) tambah("s.status_operasi = ?", f.status);
  if (f.status === "digunakan") kondisi.push("s.status_operasi = 'terkonfirmasi'", "s.status_pakai = 'dipakai'");
  if (f.status === "aktif" || f.status === "jatuh_tempo") {
    kondisi.push("s.status_operasi = 'terkonfirmasi'", "s.status_pakai = 'belum_dipakai'");
    tambah(f.status === "aktif" ? "s.tgl_rencana >= ?::date" : "s.tgl_rencana < ?::date", hariIni);
  }
  const dariTabel = `FROM bpjs_vclaim_surat s LEFT JOIN patients p ON p.uuid = s.patient_uuid WHERE ${kondisi.join(" AND ")}`;
  const [total, baris] = await Promise.all([
    satu(`SELECT COUNT(*)::int AS total ${dariTabel}`, nilai),
    query(
      `SELECT s.*, to_char(s.tgl_rencana, 'YYYY-MM-DD') AS tgl_rencana_teks, p.name AS nama_pasien
       ${dariTabel} ORDER BY s.created_at DESC LIMIT ${f.limit} OFFSET ${(f.page - 1) * f.limit}`,
      nilai
    ),
  ]);
  return { data: baris.map(petaSurat), pagination: { page: f.page, limit: f.limit, total: total?.total ?? 0 } };
};

// Sengaja TIDAK menyaring deleted_at: daftarSurat mengizinkan filter status=dihapus, jadi detail surat yang sudah
// dihapus harus tetap bisa dibuka (statusPemantauan menandainya "dihapus"); surat ini tidak dipakai untuk operasi aktif.
const detailSurat = async (faskesUuid, jenis, uuid) => {
  const baris = await satu(
    `SELECT s.*, to_char(s.tgl_rencana, 'YYYY-MM-DD') AS tgl_rencana_teks, p.name AS nama_pasien
     FROM bpjs_vclaim_surat s LEFT JOIN patients p ON p.uuid = s.patient_uuid
     WHERE s.faskes_uuid = $1 AND s.jenis = $2 AND s.uuid = $3`,
    [faskesUuid, jenis, pastikanUuid(uuid)]
  );
  if (!baris) throw new GalatBpjs("Surat tidak ditemukan", 404);
  return petaSurat(baris);
};

// --- Rencana Kontrol -------------------------------------------------------------------------------

const RK = JENIS_SURAT.RENCANA_KONTROL;
const noSuratRk = (r) => r?.noSuratKontrol;

export const buatRencanaKontrol = (faskesUuid, pengguna, data) =>
  buatSurat({
    faskesUuid, pengguna, jenis: RK, data,
    buatPermintaan: (kolom, user) =>
      bentukRencanaKontrol({
        noKartu: kolom.noKartu, noSep: kolom.noSepAsal, kodeDokter: kolom.dpjp, poliKontrol: kolom.poliTujuan, tglRencanaKontrol: kolom.tglRencana, user,
      }),
    jalurVclaim: JALUR_SURAT.RENCANA_KONTROL_BUAT,
    ambilNoSurat: noSuratRk,
  });

export const ubahRencanaKontrol = (faskesUuid, pengguna, uuid, data) =>
  ubahSurat({
    faskesUuid, pengguna, jenis: RK, uuid, data,
    buatPermintaan: (baris, baru, user) =>
      bentukUbahRencanaKontrol({
        noSuratKontrol: baris.no_surat, noKartu: baris.no_kartu, noSep: baris.no_sep_asal, kodeDokter: baru.dpjp, poliKontrol: baru.poliTujuan,
        tglRencanaKontrol: baru.tglRencana, user,
      }),
    jalurVclaim: JALUR_SURAT.RENCANA_KONTROL_UBAH,
    ambilNoSurat: noSuratRk,
  });

export const hapusRencanaKontrol = (faskesUuid, pengguna, uuid) => hapusSurat({ faskesUuid, pengguna, jenis: RK, uuid });
export const cekStatusRencanaKontrol = (faskesUuid, pengguna, uuid, data) => rekonsiliasiSurat({ faskesUuid, pengguna, jenis: RK, uuid, data });
export const daftarRencanaKontrol = (faskesUuid, q) => daftarSurat(faskesUuid, RK, q);
export const detailRencanaKontrol = (faskesUuid, uuid) => detailSurat(faskesUuid, RK, uuid);

// --- SPRI (Surat Perintah Rawat Inap) --------------------------------------------------------------

const SPRI = JENIS_SURAT.SPRI;
const noSuratSpri = (r) => r?.noSuratSPRI ?? r?.noSPRI;

export const buatSpri = (faskesUuid, pengguna, data) =>
  buatSurat({
    faskesUuid, pengguna, jenis: SPRI, data,
    buatPermintaan: (kolom, user) =>
      bentukSpri({ noKartu: kolom.noKartu, kodeDokter: kolom.dpjp, poliKontrol: kolom.poliTujuan, tglRencana: kolom.tglRencana, user }),
    jalurVclaim: JALUR_SURAT.SPRI_BUAT,
    ambilNoSurat: noSuratSpri,
  });

export const ubahSpri = (faskesUuid, pengguna, uuid, data) =>
  ubahSurat({
    faskesUuid, pengguna, jenis: SPRI, uuid, data,
    buatPermintaan: (baris, baru, user) =>
      bentukUbahSpri({
        noSuratSPRI: baris.no_surat, noKartu: baris.no_kartu, kodeDokter: baru.dpjp, poliKontrol: baru.poliTujuan, tglRencana: baru.tglRencana, user,
      }),
    jalurVclaim: JALUR_SURAT.SPRI_UBAH,
    ambilNoSurat: noSuratSpri,
  });

export const hapusSpri = (faskesUuid, pengguna, uuid) => hapusSurat({ faskesUuid, pengguna, jenis: SPRI, uuid });
export const cekStatusSpri = (faskesUuid, pengguna, uuid, data) => rekonsiliasiSurat({ faskesUuid, pengguna, jenis: SPRI, uuid, data });
export const daftarSpri = (faskesUuid, q) => daftarSurat(faskesUuid, SPRI, q);
export const detailSpri = (faskesUuid, uuid) => detailSurat(faskesUuid, SPRI, uuid);

// --- SEP -----------------------------------------------------------------------------------------

/**
 * @param {object} opsi
 * @param {boolean|null} opsi.fiturSurat  status fitur vclaim_rencana_kontrol (null = tidak diketahui); diperiksa rute
 *   bila permintaan memuat suratUuid/noSurat. Izin "PILIH SURAT SEP" juga diperiksa di rute (rute.js).
 */
export const buatSep = async (faskesUuid, pengguna, data, { fiturSurat = null } = {}) => {
  const k = await kredensialSiap(faskesUuid);
  const jns = data.jnsPelayanan === JENIS_PELAYANAN.RAWAT_INAP ? JENIS_PELAYANAN.RAWAT_INAP : JENIS_PELAYANAN.RAWAT_JALAN;
  // Nomor surat bebas dari klien tidak dipakai bila fitur Rencana Kontrol & SPRI aktif: surat harus dipilih lewat suratUuid
  const cara = caraNoSuratSep({ suratUuid: data.suratUuid, noSurat: data.noSurat, fiturSurat });
  const wajib = { noKartu: "Nomor kartu", diagAwal: "Diagnosis awal", klsRawatHak: "Hak kelas" };
  for (const [f, nama] of Object.entries(wajib)) if (!data?.[f]) throw new DataBelumLengkap(`${nama} wajib diisi`);
  const noKartu = String(data.noKartu).replace(/\D/g, "");
  if (jns === JENIS_PELAYANAN.RAWAT_JALAN) {
    if (!data.poliTujuan) throw new DataBelumLengkap("Poli tujuan wajib diisi untuk rawat jalan");
    // IGD (poli "IGD") tidak memerlukan rujukan
    if (data.poliTujuan !== "IGD" && !data.rujukan?.no) throw new DataBelumLengkap("Nomor rujukan wajib dipilih untuk rawat jalan");
  }
  if (jns === JENIS_PELAYANAN.RAWAT_INAP && cara === "tanpa") throw new DataBelumLengkap("SPRI wajib dipilih untuk rawat inap");
  if (!data.dpjp) throw new DataBelumLengkap("Dokter DPJP wajib dipilih");

  let noSurat = cara === "manual" ? String(data.noSurat).trim() : "";
  let surat = null;
  if (cara === "surat") {
    const baris = await satu(`${PILIH_SURAT} WHERE faskes_uuid = $1 AND uuid = $2`, [faskesUuid, pastikanUuid(data.suratUuid, "suratUuid")]);
    periksaSuratUntukSep(baris, { patientUuid: data.patientUuid, noKartu, jenisPelayanan: jns, modeNyata: config.mode !== "mock" });
    // Kunci atomik SEBELUM SEP dikirim: dua SEP bersamaan tidak dapat memakai surat yang sama
    surat = await satu(
      `UPDATE bpjs_vclaim_surat SET status_pakai = 'dipakai', sep_no_sep = NULL, sep_uuid = NULL, updated_at = $3
       WHERE id = $1 AND faskes_uuid = $2 AND status_pakai = 'belum_dipakai' AND status_operasi = 'terkonfirmasi' AND deleted_at IS NULL
       RETURNING id, no_surat`,
      [baris.id, faskesUuid, sekarang()]
    );
    if (!surat) throw new GalatBpjs("Surat sedang atau sudah dipakai pada SEP lain", 409);
    noSurat = surat.no_surat;
  }

  const permintaan = bentukSep({
    ppkPelayanan: k.kdPpk,
    noKartu,
    tglSep: data.tglSep || Date.now(),
    jnsPelayanan: jns,
    klsRawatHak: data.klsRawatHak,
    noMR: data.noMR,
    // IGD / rawat inap tanpa rujukan eksternal: rujukan internal dari RS sendiri (rawat inap: nomor SPRI)
    rujukan: data.rujukan?.no
      ? data.rujukan
      : { asal: "2", tgl: data.tglSep || Date.now(), no: jns === JENIS_PELAYANAN.RAWAT_INAP ? noSurat : "", ppk: k.kdPpk },
    diagAwal: data.diagAwal,
    poliTujuan: data.poliTujuan,
    dpjp: data.dpjp,
    noSurat,
    noTelp: data.noTelp,
    catatan: data.catatan,
    user: pengguna,
  });

  let sep;
  let response;
  try {
    ({ response } = await vclaim(k, "POST", "/SEP/2.0/insert", permintaan));
    sep = response?.sep;
    if (!sep?.noSep) throw new GalatBpjs("BPJS tidak mengembalikan nomor SEP", 502, response);
  } catch (error) {
    if (surat) {
      // Penolakan pasti BPJS: lepas kunci surat. Hasil tidak pasti: surat tetap terkunci sampai SEP diperiksa di VClaim.
      if (gagalPasti(error)) {
        await query(`UPDATE bpjs_vclaim_surat SET status_pakai = 'belum_dipakai', updated_at = $2 WHERE id = $1 AND sep_no_sep IS NULL`, [
          surat.id, sekarang(),
        ]);
      } else {
        await query(`UPDATE bpjs_vclaim_surat SET pesan_galat = $2, updated_at = $3 WHERE id = $1`, [
          surat.id, `SEP dengan surat ini belum pasti terbit (${pesanGalat(error)}); periksa SEP peserta di VClaim`.slice(0, 500), sekarang(),
        ]);
      }
    }
    throw error;
  }
  // SEP sudah terbit: catat nomornya di surat lebih dulu agar kunci tidak dapat dilepas
  if (surat) await query(`UPDATE bpjs_vclaim_surat SET sep_no_sep = $2, pesan_galat = NULL, updated_at = $3 WHERE id = $1`, [surat.id, sep.noSep, sekarang()]);

  const t = permintaan.request.t_sep;
  const t0 = sekarang();
  const baris = await satu(
    `INSERT INTO bpjs_vclaim_sep (faskes_uuid, no_sep, no_kartu, no_rm, patient_uuid, sumber, sumber_uuid, no_reg,
       jenis_pelayanan, tgl_sep, poli_tujuan, diag_awal, no_rujukan, ppk_rujukan, asal_rujukan, kelas_rawat, dpjp, catatan,
       permintaan, respons, dibuat_oleh, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22) RETURNING uuid`,
    [
      faskesUuid, sep.noSep, t.noKartu, t.noMR || null, data.patientUuid || null, data.sumber || null, data.sumberUuid || null,
      data.noReg || null, jns, t.tglSep, t.poli.tujuan || null, t.diagAwal, t.rujukan.noRujukan || null, t.rujukan.ppkRujukan || null,
      t.rujukan.asalRujukan, t.klsRawat.klsRawatHak, data.dpjp, t.catatan || null, JSON.stringify(permintaan), JSON.stringify(response), pengguna, t0,
    ]
  );
  if (surat) await query(`UPDATE bpjs_vclaim_surat SET sep_uuid = $2, updated_at = $3 WHERE id = $1`, [surat.id, baris?.uuid ?? null, sekarang()]);
  return sep;
};

export const daftarSep = async (faskesUuid, { page = 1, limit = 10, q = "", status = "aktif", sumber = "", dari = "", sampai = "" }) => {
  const nilai = [faskesUuid];
  const kondisi = ["s.faskes_uuid = $1"];
  if (sumber) {
    nilai.push(sumber);
    kondisi.push(`s.sumber = $${nilai.length}`);
  }
  if (status) {
    nilai.push(status);
    kondisi.push(`s.status = $${nilai.length}`);
  }
  if (dari) {
    nilai.push(dari);
    kondisi.push(`s.tgl_sep >= $${nilai.length}::date`);
  }
  if (sampai) {
    nilai.push(sampai);
    kondisi.push(`s.tgl_sep <= $${nilai.length}::date`);
  }
  if (q) {
    nilai.push(`%${q}%`);
    kondisi.push(`(s.no_sep ILIKE $${nilai.length} OR s.no_kartu ILIKE $${nilai.length} OR s.no_rm ILIKE $${nilai.length} OR p.name ILIKE $${nilai.length})`);
  }
  const batas = Math.min(100, Math.max(1, Number(limit) || 10));
  const halaman = Math.max(1, Number(page) || 1);
  const dariTabel = `FROM bpjs_vclaim_sep s LEFT JOIN patients p ON p.uuid = s.patient_uuid WHERE ${kondisi.join(" AND ")}`;
  const [total, data] = await Promise.all([
    satu(`SELECT COUNT(*)::int AS total ${dariTabel}`, nilai),
    query(
      `SELECT s.uuid, s.no_sep, s.no_kartu, s.no_rm, p.name AS nama_pasien, s.jenis_pelayanan, to_char(s.tgl_sep, 'YYYY-MM-DD') AS tgl_sep,
              s.poli_tujuan, s.diag_awal, s.no_rujukan, s.asal_rujukan, s.kelas_rawat, s.dpjp, s.catatan, s.status, s.no_reg,
              s.dibuat_oleh, s.created_at, s.respons->'sep' AS sep
       ${dariTabel} ORDER BY s.created_at DESC LIMIT ${batas} OFFSET ${(halaman - 1) * batas}`,
      nilai
    ),
  ]);
  return { data, pagination: { page: halaman, limit: batas, total: total?.total ?? 0 } };
};

export const hapusSep = async (faskesUuid, pengguna, noSep) => {
  const baris = await satu(`SELECT id, status FROM bpjs_vclaim_sep WHERE faskes_uuid = $1 AND no_sep = $2`, [faskesUuid, noSep]);
  if (!baris) throw new GalatBpjs("SEP tidak ditemukan di OpenSIMRS", 404);
  if (baris.status === "dihapus") return { noSep, status: "dihapus" };
  const k = await kredensialSiap(faskesUuid);
  await vclaim(k, "DELETE", "/SEP/2.0/delete", bentukHapusSep({ noSep, user: pengguna }));
  await query(`UPDATE bpjs_vclaim_sep SET status = 'dihapus', dihapus_oleh = $2, updated_at = $3 WHERE id = $1`, [baris.id, pengguna, sekarang()]);
  return { noSep, status: "dihapus" };
};

// --- Pemetaan poli VClaim -------------------------------------------------------------------------

export const daftarPemetaanPoli = (faskesUuid) =>
  query(
    `SELECT uuid, code, name, kd_poli_vclaim FROM lokasi
     WHERE faskes_uuid = $1 AND deleted_at IS NULL AND is_poli = true ORDER BY name`,
    [faskesUuid]
  );

export const simpanPemetaanPoli = async (faskesUuid, poli = []) => {
  for (const p of poli) {
    await query(`UPDATE lokasi SET kd_poli_vclaim = $1 WHERE uuid = $2 AND faskes_uuid = $3`, [p.kdPoliVclaim || null, p.uuid, faskesUuid]);
  }
  return daftarPemetaanPoli(faskesUuid);
};
