import express from "express";
import { query, satu, sisipkan, ubah, sekarang, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { nomorBaru } from "../umum/nomor.js";
import { GOLONGAN_DARAH, JENIS_KELAMIN, cekPilihan, angkaOpsional, ramah, selisihHari, tanggalOpsional, teks, waktuOpsional } from "./bersama.js";
import { izinUtd, bolehLihatReaktif } from "../umum/izin.js";
import { pengaturanUtd } from "./pengaturan.js";

// Rekrutmen & Seleksi Donor (utd_donor): pendaftaran, pencarian, kuesioner & pemeriksaan per kunjungan seleksi
// (utd_donor_riwayat), serta keputusan layak/tunda/tolak. KF-4: interval minimal antar-donor dihitung sistem dari
// aftap terakhir dan konfigurasi faskes (utd_pengaturan); klien tidak dapat memaksa status "layak".
const rute = express.Router();

const KOLOM_DONOR = `uuid, no_donor, nik, nama, tanggal_lahir, jenis_kelamin, golongan_darah, rhesus, telepon, alamat,
  status_aktif, alasan_ditahan, perlu_notifikasi, notifikasi_selesai, catatan_notifikasi, notifikasi_pada, created_at, updated_at`;

const ambilDonor = (uuid, faskes) => satu(`SELECT ${KOLOM_DONOR} FROM utd_donor WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskes]);

rute.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL";
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND (no_donor ILIKE $${p.length} OR nik ILIKE $${p.length} OR nama ILIKE $${p.length})`;
    }
    if (req.query.status_aktif) {
      p.push(cekPilihan(req.query.status_aktif, { aktif: 1, ditahan: 1 }, "status_aktif"));
      w += ` AND status_aktif = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM utd_donor WHERE ${w}`, p)).n;
    const rows = await query(`SELECT ${KOLOM_DONOR} FROM utd_donor WHERE ${w} ORDER BY created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.post(
  "/",
  izinUtd("Donor", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["nama"]);
    const faskes = req.author.faskesUuid;
    const noDonor = await nomorBaru(faskes, "DNR");
    const t = await sisipkan("utd_donor", {
      faskes_uuid: faskes, no_donor: noDonor, nik: teks(b.nik), nama: String(b.nama).trim(),
      tanggal_lahir: tanggalOpsional(b.tanggal_lahir, "tanggal_lahir") ?? null,
      jenis_kelamin: b.jenis_kelamin === undefined ? null : cekPilihan(b.jenis_kelamin, JENIS_KELAMIN, "jenis_kelamin"),
      golongan_darah: b.golongan_darah === undefined ? null : cekPilihan(b.golongan_darah, GOLONGAN_DARAH, "golongan_darah"),
      rhesus: b.rhesus === undefined ? null : cekPilihan(b.rhesus, { positif: 1, negatif: 1 }, "rhesus"),
      telepon: teks(b.telepon), alamat: teks(b.alamat), status_aktif: "aktif", dibuat_oleh: req.author.username ?? null,
    }).catch((e) => ramah(e, `Nomor donor ${noDonor} sudah dipakai`));
    kirim(res, await ambilDonor(t.uuid, faskes), `Donor ${noDonor} berhasil didaftarkan`);
  }),
);

rute.put(
  "/:uuid",
  izinUtd("Donor", "UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    const t = await ubah("utd_donor", req.params.uuid, faskes, {
      nik: teks(b.nik), nama: b.nama === undefined ? undefined : String(b.nama).trim() || undefined,
      tanggal_lahir: tanggalOpsional(b.tanggal_lahir, "tanggal_lahir"),
      jenis_kelamin: b.jenis_kelamin === undefined ? undefined : cekPilihan(b.jenis_kelamin || null, JENIS_KELAMIN, "jenis_kelamin"),
      golongan_darah: b.golongan_darah === undefined ? undefined : cekPilihan(b.golongan_darah || null, GOLONGAN_DARAH, "golongan_darah"),
      rhesus: b.rhesus === undefined ? undefined : cekPilihan(b.rhesus || null, { positif: 1, negatif: 1 }, "rhesus"),
      telepon: teks(b.telepon), alamat: teks(b.alamat),
    });
    if (!t) throw tidakDitemukan("Donor");
    kirim(res, await ambilDonor(t.uuid, faskes), "Donor berhasil diperbarui");
  }),
);

// Detail donor + ringkasan: aftap terakhir, jumlah aftap, serta status IMLTD paling akhir (reaktif disembunyikan
// tanpa izin "Lihat Hasil Reaktif"; upaya akses dicatat di utd_akses_log).
rute.get(
  "/:uuid",
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const d = await ambilDonor(req.params.uuid, faskes);
    if (!d) throw tidakDitemukan("Donor");
    const aftapTerakhir = await satu(
      `SELECT uuid, no_kantong, status_kantong, created_at FROM utd_aftap WHERE donor_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
      [d.uuid, faskes],
    );
    const jumlahAftap = await satu(`SELECT COUNT(*)::int n FROM utd_aftap WHERE donor_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [d.uuid, faskes]);
    const adaReaktif = await satu(
      `SELECT COUNT(*)::int n FROM utd_imltd i JOIN utd_aftap a ON a.uuid = i.aftap_uuid
        WHERE a.donor_uuid = $1 AND i.faskes_uuid = $2 AND i.status_akhir = 'reaktif' AND i.deleted_at IS NULL`,
      [d.uuid, faskes],
    );
    const bolehReaktif = await bolehLihatReaktif(req);
    if (adaReaktif.n && !bolehReaktif) {
      await sisipkan("utd_akses_log", {
        faskes_uuid: faskes, aftap_uuid: aftapTerakhir?.uuid ?? null, username: req.author.username ?? null,
        keterangan: `Membuka profil donor ${d.no_donor} tanpa izin Lihat Hasil Reaktif`,
      });
    }
    kirim(res, {
      ...d,
      aftap_terakhir: aftapTerakhir ?? null,
      jumlah_aftap: jumlahAftap.n,
      pernah_reaktif: bolehReaktif ? Boolean(adaReaktif.n) : null,
    });
  }),
);

// Riwayat kunjungan seleksi (terbaru dulu).
rute.get(
  "/:uuid/riwayat",
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const d = await satu(`SELECT uuid FROM utd_donor WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, faskes]);
    if (!d) throw tidakDitemukan("Donor");
    const pg = halaman(req.query);
    const total = (await satu(`SELECT COUNT(*)::int n FROM utd_donor_riwayat WHERE donor_uuid = $1 AND deleted_at IS NULL`, [d.uuid])).n;
    const rows = await query(
      `SELECT * FROM utd_donor_riwayat WHERE donor_uuid = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      [d.uuid],
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Hitung keputusan interval donor (KF-4): jarak hari sejak aftap terakhir vs interval minimal faskes.
const periksaInterval = async (donorUuid, faskes) => {
  const pengaturan = await pengaturanUtd(faskes);
  const terakhir = await satu(
    `SELECT created_at FROM utd_aftap WHERE donor_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    [donorUuid, faskes],
  );
  if (!terakhir) return { cukup: true };
  const tglTerakhir = new Date(Number(terakhir.created_at) * 1000).toISOString().slice(0, 10);
  const hariIni = new Date().toISOString().slice(0, 10);
  const hari = selisihHari(tglTerakhir, hariIni);
  if (hari >= pengaturan.interval_minimal_hari) return { cukup: true };
  const berikutnya = new Date(Number(terakhir.created_at) * 1000);
  berikutnya.setUTCDate(berikutnya.getUTCDate() + pengaturan.interval_minimal_hari);
  return {
    cukup: false, hari, interval: pengaturan.interval_minimal_hari,
    tanggal_layak_berikutnya: berikutnya.toISOString().slice(0, 10),
  };
};

const susunKeputusan = async (donorUuid, faskes, status, alasan) => {
  if (status !== "layak") return { status, alasan: alasan ?? null, tanggal_layak_berikutnya: null };
  const interval = await periksaInterval(donorUuid, faskes);
  if (interval.cukup) return { status: "layak", alasan: alasan ?? null, tanggal_layak_berikutnya: null };
  return {
    status: "tolak",
    alasan: `Jarak belum cukup (${interval.hari} hari sejak donor terakhir, minimal ${interval.interval} hari)`,
    tanggal_layak_berikutnya: interval.tanggal_layak_berikutnya,
  };
};

const kolomPemeriksaan = (b) => ({
  kuesioner: b.kuesioner && typeof b.kuesioner === "object" ? b.kuesioner : {},
  hb: angkaOpsional(b.hb, "hb") ?? null,
  tekanan_sistolik: angkaOpsional(b.tekanan_sistolik, "tekanan_sistolik") ?? null,
  tekanan_diastolik: angkaOpsional(b.tekanan_diastolik, "tekanan_diastolik") ?? null,
  berat_badan: angkaOpsional(b.berat_badan, "berat_badan") ?? null,
  nadi: angkaOpsional(b.nadi, "nadi") ?? null,
  suhu: angkaOpsional(b.suhu, "suhu") ?? null,
});

// Catat kunjungan seleksi: kuesioner + pemeriksaan, dan keputusan bila sudah diputuskan (status layak/tunda/tolak).
// Permintaan status "layak" otomatis dialihkan sistem menjadi "tolak" bila interval donor belum terpenuhi.
rute.post(
  "/:uuid/seleksi",
  izinUtd("Donor", "SELEKSI"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    const d = await satu(`SELECT uuid, status_aktif FROM utd_donor WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, faskes]);
    if (!d) throw tidakDitemukan("Donor");
    if (d.status_aktif === "ditahan") throw new Galat(409, "Donor berstatus ditahan; tinjauan petugas berwenang diperlukan sebelum seleksi baru");
    let status = b.status === undefined ? "proses" : cekPilihan(b.status, { proses: 1, layak: 1, tunda: 1, tolak: 1 }, "status");
    const keputusan = status === "proses"
      ? { status: "proses", alasan: teks(b.alasan) ?? null, tanggal_layak_berikutnya: null }
      : await susunKeputusan(d.uuid, faskes, status, teks(b.alasan));
    const t = await sisipkan("utd_donor_riwayat", {
      faskes_uuid: faskes, donor_uuid: d.uuid, ...kolomPemeriksaan(b), ...keputusan,
      pemeriksa_uuid: teks(b.pemeriksa_uuid), waktu_keputusan: keputusan.status === "proses" ? null : sekarang(),
      dibuat_oleh: req.author.username ?? null,
    });
    kirim(res, t, keputusan.status === "tolak" && status === "layak" ? `Donor ditolak otomatis: ${keputusan.alasan}` : "Kunjungan seleksi tersimpan");
  }),
);

// Finalisasi/ubah keputusan kunjungan seleksi yang masih "proses" (mis. dokter menetapkan setelah kuesioner dicatat petugas).
rute.put(
  "/:uuid/seleksi/:riwayatUuid",
  izinUtd("Donor", "SELEKSI"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const faskes = req.author.faskesUuid;
    await transaksi(async (k) => {
      const r = await satu(
        `SELECT * FROM utd_donor_riwayat WHERE uuid = $1 AND donor_uuid = $2 AND faskes_uuid = $3 AND deleted_at IS NULL FOR UPDATE`,
        [req.params.riwayatUuid, req.params.uuid, faskes], k,
      );
      if (!r) throw tidakDitemukan("Kunjungan seleksi");
      if (r.status !== "proses") throw new Galat(409, `Kunjungan seleksi sudah diputuskan (${r.status})`);
      const status = cekPilihan(b.status, { layak: 1, tunda: 1, tolak: 1 }, "status");
      const keputusan = await susunKeputusan(r.donor_uuid, faskes, status, teks(b.alasan));
      await ubah("utd_donor_riwayat", r.uuid, faskes, { ...keputusan, pemeriksa_uuid: teks(b.pemeriksa_uuid), waktu_keputusan: sekarang() }, k);
    });
    const t = await satu(`SELECT * FROM utd_donor_riwayat WHERE uuid = $1`, [req.params.riwayatUuid]);
    kirim(res, t, "Keputusan kunjungan seleksi tersimpan");
  }),
);

// Tandai tindak lanjut notifikasi/konseling donor dengan hasil reaktif selesai dilakukan (KF-17).
rute.put(
  "/:uuid/notifikasi",
  izinUtd("Lihat Hasil Reaktif", "READ"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const t = await ubah("utd_donor", req.params.uuid, faskes, {
      notifikasi_selesai: true, catatan_notifikasi: teks(req.body?.catatan), notifikasi_pada: sekarang(),
    });
    if (!t) throw tidakDitemukan("Donor");
    kirim(res, await ambilDonor(t.uuid, faskes), "Notifikasi/konseling donor dicatat selesai");
  }),
);

export default rute;
