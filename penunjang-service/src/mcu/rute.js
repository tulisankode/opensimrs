import express from "express";
import { query, satu } from "../db.js";
import { izinMcu } from "../umum/izin.js";
import { daftarkanPasienBaru, parseTanggal, parseTelp } from "./impor.js";
import { tangani, kirim, permintaanSalah } from "../umum/respons.js";

const hariIniJakarta = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
import { STASIUN, JENIS_MCU, LABEL_KESIMPULAN, SQL_NAMA_DOKTER } from "./bersama.js";
import perusahaan from "./perusahaan.js";
import paket from "./paket.js";
import peserta from "./peserta.js";
import pemeriksaan from "./pemeriksaan.js";
import invoice from "./invoice.js";
import laporan from "./laporan.js";
import impor from "./impor.js";
import lis from "./lis.js";
import pcare from "./pcare.js";
import { katalogTarifLab } from "./lab.js";

// Medical Check Up (MCU) — /api/v3/penunjang/mcu/...
const rute = express.Router();

// Referensi form: stasiun, jenis MCU, kesimpulan, master radiologi & item lab faskes, dokter pemeriksa.
rute.get(
  "/referensi",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const [radiologi, lab, dokter, tarifLab] = await Promise.all([
      query(
        `SELECT uuid, kode, nama, modalitas, harga::float8 AS harga FROM rad_pemeriksaan
          WHERE faskes_uuid = $1 AND status AND deleted_at IS NULL ORDER BY nama`,
        [f],
      ),
      query(
        `SELECT uuid, code AS kode, name AS nama, satuan, metode FROM item_pemeriksaan
          WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY no_urut NULLS LAST, name LIMIT 1000`,
        [f],
      ),
      query(
        `SELECT pr.uuid, ${SQL_NAMA_DOKTER("pr.uuid")} AS nama, pr.sip FROM practitioner pr
          WHERE pr.faskes_uuid = $1 AND pr.is_doctor AND pr.deleted_at IS NULL ORDER BY 2`,
        [f],
      ),
      katalogTarifLab(f),
    ]);
    kirim(res, {
      stasiun: STASIUN,
      jenis_mcu: JENIS_MCU,
      kesimpulan: Object.entries(LABEL_KESIMPULAN).map(([kode, nama]) => ({ kode, nama })),
      radiologi,
      lab,
      // Pemeriksaan lab yang dapat diorder (tarif lab; panel/kelompok mis. Darah Rutin) untuk isi paket.
      lab_tarif: tarifLab.map((t) => ({ uuid: t.uuid, kode: t.kode, nama: t.nama, harga: t.harga, jumlah_parameter: t.items.size })),
      dokter,
    });
  }),
);

// Cari pasien terdaftar (peserta MCU wajib pasien terdaftar; pasien baru didaftarkan lewat Admisi).
rute.get(
  "/pasien",
  tangani(async (req, res) => {
    const cari = String(req.query.cari ?? "").trim();
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const rows = await query(
      `SELECT p.uuid, p.no_rm, p.name, p.gender, p.no_identity AS nik, p.phone, bd.birth_date::text AS tanggal_lahir,
              DATE_PART('year', AGE(CURRENT_DATE, bd.birth_date))::int AS umur
         FROM patients p LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
        WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.status IS NOT FALSE
          AND ($2 = '' OR p.name ILIKE '%' || $2 || '%' OR p.no_rm ILIKE '%' || $2 || '%' OR p.no_identity ILIKE '%' || $2 || '%')
        ORDER BY p.name LIMIT ${limit}`,
      [req.author.faskesUuid, cari],
    );
    kirim(res, rows);
  }),
);

// Daftarkan pasien baru langsung dari MCU (dialog pendaftaran satuan). Aturan sama dengan impor: bila no. identitas
// sudah terdaftar di faskes, pasien lama dipakai apa adanya (tidak diubah, tidak dibuat ganda); bila belum, pasien
// didaftarkan lewat Admisi (No. RM, alamat/wilayah, birth detail & validasi identitas mengikuti aturan Admisi).
// Body: { nama, jenis_identitas: KTP|PASPOR|LAIN-LAIN, no_identitas, jenis_kelamin: Male|Female, tgl_lahir, no_telp?,
//         alamat?, prov?, city?, district? }
rute.post(
  "/pasien",
  izinMcu("Peserta", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const nama = String(b.nama ?? "").trim();
    const jenis = ["KTP", "PASPOR", "LAIN-LAIN"].includes(b.jenis_identitas) ? b.jenis_identitas : "KTP";
    const nomor = String(b.no_identitas ?? "").replace(/[\s.\-]/g, "").toUpperCase();
    if (!nama) throw permintaanSalah("Nama wajib diisi");
    if (!nomor) throw permintaanSalah("No. identitas wajib diisi");
    if (jenis === "KTP" && !/^\d{16}$/.test(nomor)) throw permintaanSalah("NIK (KTP) harus 16 digit angka");
    if (jenis === "PASPOR" && !/^[A-Z]\d{8}$/.test(nomor)) throw permintaanSalah("Nomor paspor harus 1 huruf diikuti 8 digit");
    const lama = await query(
      `SELECT p.uuid, p.no_rm, p.name, p.gender, p.no_identity AS nik, p.phone, bd.birth_date::text AS tanggal_lahir, p.status,
              DATE_PART('year', AGE(CURRENT_DATE, bd.birth_date))::int AS umur
         FROM patients p LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
        WHERE p.faskes_uuid = $1 AND p.no_identity = $2 AND p.deleted_at IS NULL AND p.no_rm NOT LIKE 'XX%' ORDER BY p.created_at LIMIT 1`,
      [f, nomor],
    );
    const tgl = parseTanggal(b.tgl_lahir);
    if (lama[0]) {
      const p = lama[0];
      if (p.status === false) throw permintaanSalah(`Pasien ${p.no_rm} (${p.name}) berstatus non-aktif — aktifkan dulu di Admisi › Data Pasien`);
      delete p.status;
      const peringatan = [];
      if (p.name.trim().toLowerCase() !== nama.toLowerCase()) peringatan.push(`Nama di master: ${p.name}`);
      if (tgl && p.tanggal_lahir && String(p.tanggal_lahir).slice(0, 10) !== tgl) peringatan.push(`Tanggal lahir di master: ${String(p.tanggal_lahir).slice(0, 10)}`);
      return kirim(res, { status: "lama", pasien: p, peringatan }, `No. identitas sudah terdaftar — memakai pasien lama ${p.no_rm} (data pasien tidak diubah)`);
    }
    if (!tgl || tgl > hariIniJakarta()) throw permintaanSalah("Tanggal lahir tidak valid");
    if (!["Male", "Female"].includes(b.jenis_kelamin)) throw permintaanSalah("Jenis kelamin wajib dipilih");
    const baru = await daftarkanPasienBaru(
      {
        nama, jenis_identitas: jenis, no_identitas: nomor, jenis_kelamin: b.jenis_kelamin, tgl_lahir: tgl, no_telp: parseTelp(b.no_telp ?? ""),
        alamat: String(b.alamat ?? "").trim(), wilayah: { prov: b.prov || "", city: b.city || "", district: b.district || "" },
      },
      f,
      req.author.token,
    );
    const p = await satu(
      `SELECT p.uuid, p.no_rm, p.name, p.gender, p.no_identity AS nik, p.phone, bd.birth_date::text AS tanggal_lahir,
              DATE_PART('year', AGE(CURRENT_DATE, bd.birth_date))::int AS umur
         FROM patients p LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid WHERE p.uuid = $1`,
      [baru.uuid],
    );
    kirim(res, { status: "baru", pasien: p, peringatan: [] }, `Pasien baru ${p.no_rm} berhasil didaftarkan`);
  }),
);

rute.use("/perusahaan", perusahaan);
rute.use("/paket", paket);
rute.use("/impor", impor);
rute.use("/peserta", peserta);
rute.use("/pemeriksaan", pemeriksaan);
rute.use("/invoice", invoice);
rute.use("/laporan", laporan);
// Kirim order lab peserta ke LIS secara massal (batch di lab-service)
rute.use("/lis", lis);
// Pelaporan hasil MCU peserta JKN ke BPJS PCare (STD-0020)
rute.use("/pcare", pcare);

export default rute;
