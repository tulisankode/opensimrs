import config from "./config.js";
import { query, satu, mongo, keObjectId, sekarang, uuidv7 } from "./db.js";
import { pcare, GalatBpjs } from "./klien-pcare.js";
import { buatPendaftaran, buatKunjungan, buatMcu } from "./pcare-peta.js";
import { enkripsi, dekripsi, samarkan } from "./rahasia.js";

const STATUS_RJ_SELESAI = 5;

// Galat yang perlu diperbaiki pengguna (data/konfigurasi belum lengkap)
export class DataBelumLengkap extends Error {
  status = 422;
}

// --- Konfigurasi --------------------------------------------------------------------------------

const barisKonfigurasi = (faskesUuid) =>
  satu(
    `SELECT id, pcare_aktif, pcare_cons_id, pcare_secret_key, pcare_user_key, pcare_username, pcare_password,
            pcare_kd_aplikasi, pcare_kd_provider
     FROM integrations WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`,
    [faskesUuid]
  );

export const kredensial = async (faskesUuid) => {
  const k = await barisKonfigurasi(faskesUuid);
  return {
    aktif: !!k?.pcare_aktif,
    consId: k?.pcare_cons_id?.trim(),
    secretKey: dekripsi(k?.pcare_secret_key)?.trim(),
    userKey: dekripsi(k?.pcare_user_key)?.trim(),
    username: k?.pcare_username?.trim(),
    password: dekripsi(k?.pcare_password),
    kdAplikasi: k?.pcare_kd_aplikasi?.trim() || "095",
    kdProvider: k?.pcare_kd_provider?.trim(),
  };
};

const lengkap = (k) => !!(k.consId && k.secretKey && k.userKey && k.username && k.password && k.kdProvider);

// Untuk ditampilkan di browser: rahasia hanya 4 karakter terakhir
export const konfigurasiTersamar = async (faskesUuid) => {
  const k = await kredensial(faskesUuid);
  return {
    aktif: k.aktif,
    consId: k.consId ?? "",
    secretKey: samarkan(k.secretKey),
    userKey: samarkan(k.userKey),
    username: k.username ?? "",
    password: k.password ? "••••••••" : null,
    kdAplikasi: k.kdAplikasi,
    kdProvider: k.kdProvider ?? "",
    lengkap: lengkap(k),
    mode: config.mode,
    lingkungan: config.lingkungan,
  };
};

// Simpan konfigurasi. Field rahasia yang dikosongkan berarti "tidak diubah".
export const simpanKonfigurasi = async (faskesUuid, data) => {
  const baris = await barisKonfigurasi(faskesUuid);
  if (!baris) throw new DataBelumLengkap("Data integrasi faskes belum ada; buka Setting › Konfigurasi Integrasi sekali dulu");
  const teks = (v) => (v == null ? null : String(v).trim());
  const rahasia = (baru, lama) => (teks(baru) ? enkripsi(teks(baru)) : lama);
  const disimpan = await satu(
    `UPDATE integrations SET
       pcare_aktif = $2, pcare_cons_id = $3, pcare_secret_key = $4, pcare_user_key = $5,
       pcare_username = $6, pcare_password = $7, pcare_kd_aplikasi = $8, pcare_kd_provider = $9,
       updated_at = $10
     WHERE id = $1 AND faskes_uuid = $11 AND deleted_at IS NULL
     RETURNING id`,
    [
      baris.id,
      !!data.aktif,
      teks(data.consId) || null,
      rahasia(data.secretKey, baris.pcare_secret_key),
      rahasia(data.userKey, baris.pcare_user_key),
      teks(data.username) || null,
      rahasia(data.password, baris.pcare_password),
      teks(data.kdAplikasi) || "095",
      teks(data.kdProvider) || null,
      sekarang(),
      faskesUuid,
    ]
  );
  if (!disimpan) throw new DataBelumLengkap("Data integrasi faskes ini tidak ditemukan atau sudah dihapus");
  return konfigurasiTersamar(faskesUuid);
};

const kredensialSiap = async (faskesUuid) => {
  const k = await kredensial(faskesUuid);
  if (!lengkap(k)) throw new DataBelumLengkap("Konfigurasi BPJS PCare belum lengkap (Cons ID, Secret Key, User Key, Username, Password, Kode Provider)");
  return k;
};

// --- Uji koneksi & referensi ---------------------------------------------------------------------

export const ujiKoneksi = async (faskesUuid) => {
  const k = await kredensialSiap(faskesUuid);
  const { response } = await pcare(k, "GET", "/poli/fktp/0/100");
  return { mode: config.mode, lingkungan: config.lingkungan, jumlahPoli: response?.count ?? response?.list?.length ?? 0 };
};

export const referensi = async (faskesUuid, jenis, kata = "") => {
  const k = await kredensialSiap(faskesUuid);
  const jalur = {
    poli: "/poli/fktp/0/100",
    dokter: "/dokter/0/100",
    kesadaran: "/kesadaran",
    diagnosa: `/diagnosa/${encodeURIComponent(kata || "A")}/0/20`,
    "status-pulang": "/statuspulang/rawatInap/false",
  }[jenis];
  if (!jalur) throw new DataBelumLengkap(`Referensi "${jenis}" tidak dikenal`);
  const { response } = await pcare(k, "GET", jalur);
  return response?.list ?? [];
};

export const cekPeserta = async (faskesUuid, nomor) => {
  const k = await kredensialSiap(faskesUuid);
  const angka = String(nomor ?? "").replace(/\D/g, "");
  if (angka.length !== 13 && angka.length !== 16) throw new DataBelumLengkap("Nomor kartu BPJS (13 digit) atau NIK (16 digit) tidak valid");
  const jalur = angka.length === 16 ? `/peserta/nik/${angka}` : `/peserta/${angka}`;
  const { response } = await pcare(k, "GET", jalur);
  if (!response) throw new GalatBpjs("Peserta tidak ditemukan di BPJS", 404);
  return response;
};

// --- Pemetaan poli & dokter ----------------------------------------------------------------------

export const daftarPemetaan = async (faskesUuid) => {
  const [poli, dokter] = await Promise.all([
    query(
      `SELECT uuid, code, name, kd_poli_bpjs FROM lokasi
       WHERE faskes_uuid = $1 AND deleted_at IS NULL AND is_poli = true ORDER BY name`,
      [faskesUuid]
    ),
    query(
      `SELECT pr.uuid, pg.name, pg.first_title, pg.last_title, pr.code_bpjs FROM practitioner pr
       JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid AND pg.deleted_at IS NULL
       WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND pr.is_doctor = true ORDER BY pg.name`,
      [faskesUuid]
    ),
  ]);
  return { poli, dokter };
};

export const simpanPemetaan = async (faskesUuid, { poli = [], dokter = [] }) => {
  for (const p of poli) {
    await query(`UPDATE lokasi SET kd_poli_bpjs = $1 WHERE uuid = $2 AND faskes_uuid = $3`, [p.kdPoliBpjs || null, p.uuid, faskesUuid]);
  }
  for (const d of dokter) {
    await query(`UPDATE practitioner SET code_bpjs = $1 WHERE uuid = $2 AND faskes_uuid = $3`, [d.codeBpjs || null, d.uuid, faskesUuid]);
  }
  return daftarPemetaan(faskesUuid);
};

// --- Data klinis dari rekam medis -----------------------------------------------------------------

export const dataKlinis = async (rekamMedisUuid) => {
  const kosong = { diagnosis: [], tandaVital: null, antropometri: null, anamnesis: null };
  const id = keObjectId(rekamMedisUuid);
  if (!id) return kosong;
  const db = await mongo();
  const rm = await db.collection("rekam_medises").findOne({ _id: id });
  if (!rm) return kosong;
  const sesiIds = (rm.daily_records ?? []).flatMap((r) => r.sessions ?? []);
  const sesi = sesiIds.length ? await db.collection("sessions").find({ _id: { $in: sesiIds }, deleted_at: null }).toArray() : [];
  sesi.sort((a, b) => sesiIds.findIndex((x) => x.equals(a._id)) - sesiIds.findIndex((x) => x.equals(b._id)));

  const uuidDiagnosis = [];
  for (const s of sesi) for (const d of s.diagnosis_dokter ?? []) {
    if (!d.deleted_at && d.diagnosis_uuid && !uuidDiagnosis.includes(d.diagnosis_uuid)) uuidDiagnosis.push(d.diagnosis_uuid);
  }
  const master = uuidDiagnosis.length
    ? await query(`SELECT uuid, code FROM diagnosis WHERE uuid = ANY($1::text[]) AND deleted_at IS NULL`, [uuidDiagnosis])
    : [];
  const terakhir = (field) => [...sesi].reverse().find((s) => s[field] && !s[field].deleted_at)?.[field] ?? null;
  return {
    diagnosis: uuidDiagnosis.map((u) => master.find((m) => m.uuid === u)).filter((m) => m?.code).map((m) => ({ kode: m.code })),
    tandaVital: terakhir("tanda_vital"),
    antropometri: terakhir("antropometri"),
    anamnesis: terakhir("anamnesis"),
  };
};

// --- Kunjungan rawat jalan BPJS --------------------------------------------------------------------

// Kunjungan RJ dengan akun asuransi BPJS (nomor kartu = insurance_accounts.account_number)
const SQL_KUNJUNGAN_BPJS = `
  SELECT rj.uuid, rj.no_pelayanan, rj.no_reg, rj.status_rj, rj.lokasi_uuid, rj.practitioner_uuid, rj.rekam_medis_uuid,
         rj.tanggal_daftar, rj.tanggal_checkin, rj.discharge_date, rj.complaint,
         ia_acc.account_number AS no_kartu
  FROM rawat_jalans rj
  JOIN insurance_admissions ia ON ia.no_reg = rj.no_reg AND ia.faskes_uuid = rj.faskes_uuid AND ia.deleted_at IS NULL
  JOIN insurance_accounts ia_acc ON ia_acc.uuid = ia.insurance_account_uuid AND ia_acc.deleted_at IS NULL
  WHERE rj.faskes_uuid = $1 AND rj.deleted_at IS NULL AND ia_acc.name ILIKE 'BPJS%'`;

const simpanCatatan = async (faskesUuid, kunjungan, perubahan) => {
  const t = sekarang();
  const kolom = Object.keys(perubahan);
  const nilai = Object.values(perubahan);
  await query(
    `INSERT INTO bpjs_pcare_kunjungan (faskes_uuid, rawat_jalan_uuid, no_pelayanan, no_kartu, created_at, updated_at${kolom.map((c) => `, ${c}`).join("")})
     VALUES ($1, $2, $3, $4, $5, $5${kolom.map((_, i) => `, $${i + 6}`).join("")})
     ON CONFLICT (faskes_uuid, rawat_jalan_uuid) DO UPDATE SET
       no_pelayanan = EXCLUDED.no_pelayanan, no_kartu = EXCLUDED.no_kartu, updated_at = EXCLUDED.updated_at
       ${kolom.map((c) => `, ${c} = EXCLUDED.${c}`).join("")}`,
    [faskesUuid, kunjungan.uuid, kunjungan.no_pelayanan, kunjungan.no_kartu, t, ...nilai]
  );
};

export const sinkronKunjungan = async (faskesUuid, rawatJalanUuid) => {
  const kunjungan = await satu(`${SQL_KUNJUNGAN_BPJS} AND rj.uuid = $2`, [faskesUuid, rawatJalanUuid]);
  if (!kunjungan) throw new DataBelumLengkap("Kunjungan rawat jalan BPJS tidak ditemukan (pastikan penjamin BPJS)");
  const catatan = await satu(`SELECT * FROM bpjs_pcare_kunjungan WHERE faskes_uuid = $1 AND rawat_jalan_uuid = $2`, [faskesUuid, rawatJalanUuid]);
  const hasil = { pendaftaran: catatan?.status_pendaftaran ?? "belum", noUrut: catatan?.no_urut, kunjungan: catatan?.status_kunjungan ?? "belum", noKunjungan: catatan?.no_kunjungan };

  try {
    const k = await kredensialSiap(faskesUuid);
    const noKartu = String(kunjungan.no_kartu ?? "").replace(/\D/g, "");
    if (noKartu.length !== 13) throw new DataBelumLengkap(`Nomor kartu BPJS pasien tidak valid (${kunjungan.no_kartu || "kosong"})`);
    const poli = await satu(`SELECT name, kd_poli_bpjs FROM lokasi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [
      kunjungan.lokasi_uuid, faskesUuid,
    ]);
    if (!poli?.kd_poli_bpjs) throw new DataBelumLengkap(`Poli ${poli?.name ?? "-"} belum dipetakan ke kode poli BPJS`);
    const klinis = await dataKlinis(kunjungan.rekam_medis_uuid);
    const tanggalDaftar = kunjungan.tanggal_checkin || kunjungan.tanggal_daftar;

    // 1) Pendaftaran
    if (hasil.pendaftaran !== "terkirim") {
      const body = buatPendaftaran({
        kdProvider: k.kdProvider, noKartu, kdPoli: poli.kd_poli_bpjs, tanggal: tanggalDaftar,
        keluhan: kunjungan.complaint || klinis.anamnesis?.keluhan_utama, tandaVital: klinis.tandaVital, antropometri: klinis.antropometri,
      });
      const { response } = await pcare(k, "POST", "/pendaftaran", body);
      hasil.pendaftaran = "terkirim";
      hasil.noUrut = response?.message ?? null;
      await simpanCatatan(faskesUuid, kunjungan, {
        status_pendaftaran: "terkirim", no_urut: hasil.noUrut, tgl_daftar: body.tglDaftar, kd_poli: body.kdPoli, pesan: null,
      });
    }

    // 2) Kunjungan — setelah pemeriksaan selesai (discharge)
    if (hasil.kunjungan !== "terkirim" && Number(kunjungan.status_rj) === STATUS_RJ_SELESAI) {
      const dokter = await satu(
        `SELECT pr.code_bpjs, pg.name FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid AND pg.deleted_at IS NULL
         WHERE pr.uuid = $1 AND pr.faskes_uuid = $2 AND pr.deleted_at IS NULL`,
        [kunjungan.practitioner_uuid, faskesUuid]
      );
      if (!dokter?.code_bpjs) throw new DataBelumLengkap(`Dokter ${dokter?.name ?? "-"} belum memiliki kode dokter BPJS`);
      if (!klinis.diagnosis.length) throw new DataBelumLengkap("Diagnosis ICD-10 belum diisi di rekam medis");
      const body = buatKunjungan({
        noKartu, tanggalDaftar, tanggalPulang: kunjungan.discharge_date, kdPoli: poli.kd_poli_bpjs, kdDokter: dokter.code_bpjs,
        diagnosis: klinis.diagnosis, keluhan: kunjungan.complaint || klinis.anamnesis?.keluhan_utama, anamnesa: klinis.anamnesis?.anamnesis,
        tandaVital: klinis.tandaVital, antropometri: klinis.antropometri,
      });
      const { response } = await pcare(k, "POST", "/kunjungan", body);
      hasil.kunjungan = "terkirim";
      hasil.noKunjungan = response?.message ?? null;
      await simpanCatatan(faskesUuid, kunjungan, { status_kunjungan: "terkirim", no_kunjungan: hasil.noKunjungan, pesan: null });
    }
    return { status: "ok", ...hasil };
  } catch (error) {
    const kolom = hasil.pendaftaran !== "terkirim" ? "status_pendaftaran" : "status_kunjungan";
    await simpanCatatan(faskesUuid, kunjungan, { [kolom]: "gagal", pesan: error.message });
    await query(`UPDATE bpjs_pcare_kunjungan SET percobaan = percobaan + 1 WHERE faskes_uuid = $1 AND rawat_jalan_uuid = $2`, [faskesUuid, rawatJalanUuid]);
    return { status: "gagal", pesan: error.message, ...hasil, [kolom === "status_pendaftaran" ? "pendaftaran" : "kunjungan"]: "gagal" };
  }
};

export const daftarKunjungan = async (faskesUuid, { page = 1, limit = 10, status = "", q = "" }) => {
  const nilai = [faskesUuid];
  const kondisi = [];
  if (status === "belum") kondisi.push(`(c.id IS NULL OR c.status_kunjungan = 'belum')`);
  else if (status === "terkirim") kondisi.push(`c.status_kunjungan = 'terkirim'`);
  else if (status === "gagal") kondisi.push(`(c.status_pendaftaran = 'gagal' OR c.status_kunjungan = 'gagal')`);
  if (q) {
    nilai.push(`%${q}%`);
    kondisi.push(`(p.name ILIKE $${nilai.length} OR rj.no_rm ILIKE $${nilai.length} OR rj.no_pelayanan ILIKE $${nilai.length} OR rj0.no_kartu ILIKE $${nilai.length})`);
  }
  const dari = `FROM (${SQL_KUNJUNGAN_BPJS}) rj0
    JOIN rawat_jalans rj ON rj.uuid = rj0.uuid
    LEFT JOIN patients p ON p.uuid = rj.patient_uuid
    LEFT JOIN bpjs_pcare_kunjungan c ON c.faskes_uuid = rj.faskes_uuid AND c.rawat_jalan_uuid = rj.uuid
    ${kondisi.length ? `WHERE ${kondisi.join(" AND ")}` : ""}`;
  const batas = Math.min(100, Math.max(1, Number(limit) || 10));
  const halaman = Math.max(1, Number(page) || 1);
  const [total, data] = await Promise.all([
    satu(`SELECT COUNT(*)::int AS total ${dari}`, nilai),
    query(
      `SELECT rj.uuid, rj.no_pelayanan, rj.no_rm, p.name AS nama_pasien, rj0.no_kartu, rj.status_rj, rj.tanggal_daftar, rj.discharge_date,
              COALESCE(c.status_pendaftaran, 'belum') AS status_pendaftaran, c.no_urut,
              COALESCE(c.status_kunjungan, 'belum') AS status_kunjungan, c.no_kunjungan, c.pesan, c.percobaan
       ${dari} ORDER BY rj.tanggal_daftar DESC LIMIT ${batas} OFFSET ${(halaman - 1) * batas}`,
      nilai
    ),
  ]);
  return { data, pagination: { page: halaman, limit: batas, total: total?.total ?? 0 } };
};

// Pekerja otomatis: kunjungan BPJS beberapa hari terakhir yang belum tuntas
export const jalankanPekerja = async (hanyaFaskes = null) => {
  const faskes = await query(
    `SELECT DISTINCT faskes_uuid FROM integrations WHERE pcare_aktif = true AND deleted_at IS NULL AND ($1::text IS NULL OR faskes_uuid = $1)`,
    [hanyaFaskes]
  );
  const ringkasan = [];
  for (const { faskes_uuid } of faskes) {
    const batas = sekarang() - config.pekerjaRentangHari * 86400;
    const antrean = await query(
      `SELECT k.uuid FROM (${SQL_KUNJUNGAN_BPJS}) k
       LEFT JOIN bpjs_pcare_kunjungan c ON c.faskes_uuid = $1 AND c.rawat_jalan_uuid = k.uuid
       WHERE k.tanggal_daftar >= $2 AND k.status_rj <> 0
         AND COALESCE(c.percobaan, 0) < $3
         AND (c.id IS NULL OR c.status_pendaftaran <> 'terkirim'
              OR (c.status_kunjungan <> 'terkirim' AND k.status_rj = ${STATUS_RJ_SELESAI}))
       ORDER BY k.tanggal_daftar LIMIT 50`,
      [faskes_uuid, batas, config.maksPercobaan]
    );
    let ok = 0;
    let gagal = 0;
    for (const { uuid } of antrean) {
      const h = await sinkronKunjungan(faskes_uuid, uuid);
      h.status === "ok" ? ok++ : gagal++;
    }
    ringkasan.push({ faskesUuid: faskes_uuid, diproses: antrean.length, berhasil: ok, gagal });
  }
  return ringkasan;
};

// --- MCU PCare (STD-0020): pelaporan hasil MCU peserta JKN ---------------------------------------
// Satu-satunya jalur penulisan tabel mcu_pcare_kirim (penunjang-service hanya membaca untuk tampilan status —
// lihat penunjang-service/src/mcu/peserta.js, laporan.js, sama dengan pola lab_lis_kirim pada lab-service).

// Kandidat kunjungan PCare untuk seorang pasien: kunjungan yang pendaftaran & kunjungannya sudah terkirim
// (punya no_kunjungan) sehingga layak ditautkan ke laporan MCU. Lebih dari satu baris → petugas harus memilih
// secara eksplisit (use case "kunjungan ambigu"), bukan dipilih otomatis oleh sistem.
export const kandidatKunjunganMcu = (faskesUuid, patientUuid) => {
  if (!patientUuid) throw new DataBelumLengkap("patient_uuid wajib diisi");
  return query(
    `SELECT c.rawat_jalan_uuid, c.no_kunjungan, c.no_pelayanan, rj.tanggal_daftar, rj.discharge_date
       FROM bpjs_pcare_kunjungan c JOIN rawat_jalans rj ON rj.uuid = c.rawat_jalan_uuid
      WHERE c.faskes_uuid = $1 AND rj.patient_uuid = $2 AND rj.deleted_at IS NULL AND c.status_kunjungan = 'terkirim'
      ORDER BY rj.tanggal_daftar DESC`,
    [faskesUuid, patientUuid],
  );
};

const ambilKirimMcu = (faskesUuid, pesertaUuid) =>
  satu(`SELECT * FROM mcu_pcare_kirim WHERE faskes_uuid = $1 AND peserta_uuid = $2 AND deleted_at IS NULL`, [faskesUuid, pesertaUuid]);

const simpanKirimMcu = async (faskesUuid, uuid, perubahan) => {
  const data = { ...perubahan, updated_at: sekarang() };
  const kolom = Object.keys(data);
  const nilai = kolom.map((c) => (data[c] !== null && typeof data[c] === "object" ? JSON.stringify(data[c]) : data[c]));
  await query(
    `UPDATE mcu_pcare_kirim SET ${kolom.map((c, i) => `${c} = $${i + 1}`).join(", ")} WHERE uuid = $${kolom.length + 1} AND faskes_uuid = $${kolom.length + 2}`,
    [...nilai, uuid, faskesUuid]
  );
};

// Satu laporan MCU PCare per peserta (faskes_uuid + peserta_uuid unik, KF-6/KT-12). `operasi`: tambah | ubah | hapus.
// `payload` = data MCU lokal yang sudah dipetakan peserta (sumber: penunjang-service, lihat mcu/pcare.js#petakanNilaiMcu).
// Klaim atomik baris kirim → 'mengirim' hanya dari status yang diizinkan (cegah kirim ganda/bersamaan ke PCare).
// Baris 'mengirim' yang tersangkut > 5 menit (mis. proses mati di tengah kirim) boleh diklaim ulang.
const BATAS_TERSANGKUT_DETIK = 5 * 60;
const klaimKirimMcu = async (faskesUuid, uuid, statusBoleh, perubahan = {}) => {
  const t = sekarang();
  const data = { ...perubahan, status: "mengirim", mode: config.mode, updated_at: t };
  const kolom = Object.keys(data);
  const nilai = kolom.map((c) => data[c]);
  const baris = await satu(
    `UPDATE mcu_pcare_kirim SET ${kolom.map((c, i) => `${c} = $${i + 1}`).join(", ")}
      WHERE uuid = $${kolom.length + 1} AND faskes_uuid = $${kolom.length + 2} AND deleted_at IS NULL
        AND (status = ANY($${kolom.length + 3}) OR (status = 'mengirim' AND updated_at < $${kolom.length + 4}))
      RETURNING uuid`,
    [...nilai, uuid, faskesUuid, statusBoleh, t - BATAS_TERSANGKUT_DETIK],
  );
  if (!baris) throw new DataBelumLengkap("Laporan MCU PCare peserta ini sedang diproses atau statusnya sudah berubah — muat ulang lalu coba lagi");
};

export const operasiMcu = async (faskesUuid, { pesertaUuid, rawatJalanUuid, operasi, payload = {}, alasan, konfirmasi, dikirimOleh }) => {
  if (!pesertaUuid) throw new DataBelumLengkap("peserta_uuid wajib diisi");
  if (!["tambah", "ubah", "hapus"].includes(operasi)) throw new DataBelumLengkap("operasi harus tambah, ubah, atau hapus");
  let kirim = await ambilKirimMcu(faskesUuid, pesertaUuid);

  let noKunjungan;
  if (operasi === "tambah") {
    if (!rawatJalanUuid) throw new DataBelumLengkap("Kunjungan PCare belum ditautkan untuk peserta ini");
    const kand = await satu(
      `SELECT no_kunjungan FROM bpjs_pcare_kunjungan WHERE faskes_uuid = $1 AND rawat_jalan_uuid = $2 AND status_kunjungan = 'terkirim'`,
      [faskesUuid, rawatJalanUuid],
    );
    if (!kand?.no_kunjungan) throw new DataBelumLengkap("Kunjungan PCare yang dipilih belum memiliki nomor kunjungan (pendaftaran/kunjungan belum terkirim ke PCare)");
    noKunjungan = kand.no_kunjungan;
    if (kirim?.status === "tidak_pasti" && !konfirmasi) {
      throw new DataBelumLengkap(
        "Status pengiriman sebelumnya belum pasti — pastikan laporan belum diterima PCare (periksa manual) sebelum mengirim ulang, lalu centang konfirmasi",
      );
    }
    // Laporan yang sudah diterima PCare tidak boleh di-insert ulang (data MCU ganda di PCare) — gunakan Ubah/Hapus.
    if (kirim?.status === "terkirim") throw new DataBelumLengkap("Laporan MCU sudah terkirim ke PCare — gunakan Ubah untuk memperbarui atau Hapus untuk menarik laporan");
    const t = sekarang();
    if (!kirim) {
      const baru = { uuid: uuidv7(), percobaan: 0, no_referensi_pcare: null };
      const masuk = await satu(
        `INSERT INTO mcu_pcare_kirim (uuid, faskes_uuid, peserta_uuid, rawat_jalan_uuid, no_kunjungan, status, mode, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,'mengirim',$6,$7,$7)
         ON CONFLICT (faskes_uuid, peserta_uuid) WHERE deleted_at IS NULL DO NOTHING
         RETURNING uuid`,
        [baru.uuid, faskesUuid, pesertaUuid, rawatJalanUuid, noKunjungan, config.mode, t],
      );
      if (!masuk) throw new DataBelumLengkap("Laporan MCU PCare peserta ini sedang diproses — muat ulang lalu coba lagi");
      kirim = baru;
    } else {
      await klaimKirimMcu(faskesUuid, kirim.uuid, ["belum", "gagal", "tidak_pasti"], { rawat_jalan_uuid: rawatJalanUuid, no_kunjungan: noKunjungan });
    }
  } else {
    if (!kirim) throw new DataBelumLengkap("Laporan MCU PCare peserta ini belum pernah dikirim");
    if (kirim.status !== "terkirim") throw new DataBelumLengkap(`Laporan berstatus ${kirim.status}, tindakan ${operasi} hanya untuk laporan yang sudah terkirim`);
    if (!String(alasan ?? "").trim()) throw new DataBelumLengkap("Alasan wajib diisi");
    noKunjungan = kirim.no_kunjungan;
    await klaimKirimMcu(faskesUuid, kirim.uuid, ["terkirim"]);
  }

  // Pemetaan field MCU PCare masih draf (belum dikonfirmasi spesifikasi resmi) — kirim nyata (bukan mock) ditolak
  // sampai config.mcuPcareDikonfirmasi diaktifkan eksplisit (KF-3/KF-4: jangan kirim bila pemetaan belum dipastikan).
  if (config.mode !== "mock" && !config.mcuPcareDikonfirmasi) {
    const pesanTolak = "Pemetaan field MCU PCare belum dikonfirmasi dari spesifikasi resmi — pengiriman nyata belum diaktifkan (mode mock tetap tersedia untuk uji coba)";
    await simpanKirimMcu(faskesUuid, kirim.uuid, { status: "gagal", pesan: pesanTolak, operasi_terakhir: operasi, percobaan: (kirim.percobaan ?? 0) + 1, percobaan_pada: sekarang() });
    return { peserta_uuid: pesertaUuid, status: "gagal", mode: config.mode, no_kunjungan: noKunjungan, no_referensi_pcare: kirim.no_referensi_pcare ?? null, pesan: pesanTolak, operasi_terakhir: operasi };
  }

  // kredensialSiap/buatMcu ikut masuk try/catch: baris sudah bersetatus 'mengirim' di atas, jadi kegagalan di sini
  // pun harus disimpan sebagai status final (gagal), bukan dibiarkan tersangkut di 'mengirim'.
  let statusBaru;
  let pesan;
  let referensi = kirim.no_referensi_pcare ?? null;
  let body = null;
  try {
    const k = await kredensialSiap(faskesUuid);
    // payload dari penunjang-service memakai snake_case (tgl_periksa 'YYYY-MM-DD', tanda_vital); camelCase tetap diterima.
    body = buatMcu({
      noKunjungan,
      kdProviderPeserta: k.kdProvider,
      tglPeriksa: payload.tgl_periksa ?? payload.tglPeriksa,
      tandaVital: payload.tanda_vital ?? payload.tandaVital ?? null,
      kesimpulan: payload.kesimpulan ?? null,
    });
    const jalur = { tambah: "/mcu/insert", ubah: "/mcu/update", hapus: "/mcu/delete" }[operasi];
    const metode = operasi === "hapus" ? "DELETE" : "POST";
    const { response, pesan: pesanOk } = await pcare(k, metode, jalur, operasi === "hapus" ? { noKunjungan } : body);
    statusBaru = operasi === "hapus" ? "belum" : "terkirim";
    pesan = pesanOk || (operasi === "hapus" ? "Laporan MCU dihapus dari PCare" : "Laporan MCU diterima PCare");
    referensi = operasi === "hapus" ? null : (response?.message ?? referensi);
  } catch (error) {
    // 502 (lihat klien-pcare.js#pcare) = masalah koneksi/respons, penerimaan oleh PCare tidak dapat dipastikan;
    // kode lain (termasuk konfigurasi integrasi belum lengkap) = gagal, aman dikirim ulang setelah koreksi.
    statusBaru = Number(error.status) === 502 ? "tidak_pasti" : "gagal";
    pesan = error.message;
  }

  await simpanKirimMcu(faskesUuid, kirim.uuid, {
    status: statusBaru,
    pesan,
    no_referensi_pcare: referensi,
    operasi_terakhir: operasi,
    percobaan: (kirim.percobaan ?? 0) + 1,
    percobaan_pada: sekarang(),
    payload: body,
    dikirim_oleh: dikirimOleh ?? null,
  });

  // Hasil dikembalikan apa adanya (bukan exception) untuk gagal/tidak_pasti — sama dengan pola sinkronKunjungan():
  // rute yang menentukan status HTTP dari status bisnisnya.
  return { peserta_uuid: pesertaUuid, status: statusBaru, mode: config.mode, no_kunjungan: noKunjungan, no_referensi_pcare: referensi, pesan, operasi_terakhir: operasi };
};

// Status pengiriman MCU PCare terakhir untuk satu peserta (baca saja; dipakai juga oleh penunjang-service bila
// perlu konfirmasi status terbaru langsung dari bpjs-service, mis. setelah operasi gagal).
export const statusMcu = async (faskesUuid, pesertaUuid) => {
  const k = await ambilKirimMcu(faskesUuid, pesertaUuid);
  return k
    ? { peserta_uuid: pesertaUuid, status: k.status, mode: k.mode, no_kunjungan: k.no_kunjungan, no_referensi_pcare: k.no_referensi_pcare, pesan: k.pesan, operasi_terakhir: k.operasi_terakhir, percobaan: k.percobaan, percobaan_pada: k.percobaan_pada }
    : { peserta_uuid: pesertaUuid, status: "belum", mode: null, no_kunjungan: null, no_referensi_pcare: null, pesan: null, operasi_terakhir: null, percobaan: 0, percobaan_pada: null };
};
