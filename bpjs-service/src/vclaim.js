import config from "./config.js";
import { query, satu, sekarang } from "./db.js";
import { vclaim } from "./klien-vclaim.js";
import { GalatBpjs } from "./klien-pcare.js";
import { buatSep as bentukSep, hapusSep as bentukHapusSep, keTanggalVclaim, JENIS_PELAYANAN } from "./vclaim-peta.js";
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
  await query(
    `UPDATE integrations SET
       vclaim_aktif = $2, vclaim_cons_id = $3, vclaim_secret_key = $4, vclaim_user_key = $5, vclaim_kd_ppk = $6,
       secret_key = NULL, user_key = NULL, updated_at = $7
     WHERE id = $1`,
    [
      baris.id,
      !!data.aktif,
      teks(data.consId) || null,
      rahasia(data.secretKey, baris.vclaim_secret_key, baris.secret_key),
      rahasia(data.userKey, baris.vclaim_user_key, baris.user_key),
      teks(data.kdPpk) || null,
      sekarang(),
    ]
  );
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
       LEFT JOIN lokasi l ON l.uuid = rj.lokasi_uuid
       LEFT JOIN practitioner pr ON pr.uuid = rj.practitioner_uuid
       LEFT JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
       WHERE rj.faskes_uuid = $1 AND rj.patient_uuid = $2 AND rj.deleted_at IS NULL AND rj.status_rj <> 0
         AND rj.tanggal_daftar >= $3
       ORDER BY rj.tanggal_daftar DESC LIMIT 10`,
      [faskesUuid, p.uuid, sekarang() - 30 * 86400]
    );
  }
  return pasien;
};

// --- SEP -----------------------------------------------------------------------------------------

export const buatSep = async (faskesUuid, pengguna, data) => {
  const k = await kredensialSiap(faskesUuid);
  const wajib = { noKartu: "Nomor kartu", diagAwal: "Diagnosis awal", klsRawatHak: "Hak kelas" };
  for (const [f, nama] of Object.entries(wajib)) if (!data?.[f]) throw new DataBelumLengkap(`${nama} wajib diisi`);
  const jns = data.jnsPelayanan === JENIS_PELAYANAN.RAWAT_INAP ? JENIS_PELAYANAN.RAWAT_INAP : JENIS_PELAYANAN.RAWAT_JALAN;
  if (jns === JENIS_PELAYANAN.RAWAT_JALAN) {
    if (!data.poliTujuan) throw new DataBelumLengkap("Poli tujuan wajib diisi untuk rawat jalan");
    // IGD (poli "IGD") tidak memerlukan rujukan
    if (data.poliTujuan !== "IGD" && !data.rujukan?.no) throw new DataBelumLengkap("Nomor rujukan wajib dipilih untuk rawat jalan");
  }
  if (jns === JENIS_PELAYANAN.RAWAT_INAP && !data.noSurat) throw new DataBelumLengkap("Nomor SPRI wajib diisi untuk rawat inap");
  if (!data.dpjp) throw new DataBelumLengkap("Dokter DPJP wajib dipilih");

  const permintaan = bentukSep({
    ppkPelayanan: k.kdPpk,
    noKartu: String(data.noKartu).replace(/\D/g, ""),
    tglSep: data.tglSep || Date.now(),
    jnsPelayanan: jns,
    klsRawatHak: data.klsRawatHak,
    noMR: data.noMR,
    // IGD / rawat inap tanpa rujukan eksternal: rujukan internal dari RS sendiri (rawat inap: nomor SPRI)
    rujukan: data.rujukan?.no
      ? data.rujukan
      : { asal: "2", tgl: data.tglSep || Date.now(), no: jns === JENIS_PELAYANAN.RAWAT_INAP ? data.noSurat : "", ppk: k.kdPpk },
    diagAwal: data.diagAwal,
    poliTujuan: data.poliTujuan,
    dpjp: data.dpjp,
    noSurat: data.noSurat,
    noTelp: data.noTelp,
    catatan: data.catatan,
    user: pengguna,
  });
  const { response } = await vclaim(k, "POST", "/SEP/2.0/insert", permintaan);
  const sep = response?.sep;
  if (!sep?.noSep) throw new GalatBpjs("BPJS tidak mengembalikan nomor SEP", 502, response);

  const t = permintaan.request.t_sep;
  const t0 = sekarang();
  await query(
    `INSERT INTO bpjs_vclaim_sep (faskes_uuid, no_sep, no_kartu, no_rm, patient_uuid, sumber, sumber_uuid, no_reg,
       jenis_pelayanan, tgl_sep, poli_tujuan, diag_awal, no_rujukan, ppk_rujukan, asal_rujukan, kelas_rawat, dpjp, catatan,
       permintaan, respons, dibuat_oleh, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22)`,
    [
      faskesUuid, sep.noSep, t.noKartu, t.noMR || null, data.patientUuid || null, data.sumber || null, data.sumberUuid || null,
      data.noReg || null, jns, t.tglSep, t.poli.tujuan || null, t.diagAwal, t.rujukan.noRujukan || null, t.rujukan.ppkRujukan || null,
      t.rujukan.asalRujukan, t.klsRawat.klsRawatHak, data.dpjp, t.catatan || null, JSON.stringify(permintaan), JSON.stringify(response), pengguna, t0,
    ]
  );
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
