import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { izinTraining } from "../umum/izin.js";
import { pasien } from "../umum/kunjungan.js";
import { nomorBaru } from "../umum/nomor.js";
import { tanggalValid, hariIni, sisaSlot } from "./bersama.js";
import { tagihanOrder } from "./tagihan.js";

// Booking & order peserta kelas Training. Satu tabel (training_order) menampung booking (status 'booking', belum
// ada tagihan) maupun order (status 'order', tagihan terkirim) agar keduanya berbagi pemeriksaan kapasitas slot.
// Dipakai juga oleh booking.js (slot, booking, lanjut daftar).
const rute = express.Router();

export const PILIH_ORDER = `
  o.uuid, o.faskes_uuid, o.no_order, o.kelas_uuid, kl.kode AS kelas_kode, kl.nama AS kelas_nama, kl.jenis AS kelas_jenis,
  kl.instruktur, kl.is_sesi, o.sesi_uuid, ks.nama_sesi, ks.jam_mulai, ks.jam_selesai,
  to_char(o.tanggal_kelas, 'YYYY-MM-DD') AS tanggal_kelas, o.patient_uuid, o.no_rm,
  p.name AS nama_pasien, p.gender, p.phone AS no_hp,
  o.payment_method, o.penjamin_uuid, o.harga::float8 AS harga, o.status,
  o.alasan_batal, o.dibatalkan_oleh, o.dibatalkan_pada::float8 AS dibatalkan_pada, o.dibuat_oleh,
  o.created_at::float8 AS created_at, o.updated_at::float8 AS updated_at`;

export const DARI_ORDER = `
  training_order o
  JOIN training_kelas kl ON kl.uuid = o.kelas_uuid
  LEFT JOIN training_kelas_sesi ks ON ks.uuid = o.sesi_uuid
  LEFT JOIN patients p ON p.uuid = o.patient_uuid`;

// Baris mentah (dikunci FOR UPDATE bila di dalam transaksi). Tidak memfilter deleted_at: order batal tetap
// tersimpan sebagai jejak audit (NF-4) dan harus tetap dapat dibaca untuk detail/riwayat.
export const ambilOrder = async (uuid, faskesUuid, k) => {
  const o = await satu(`SELECT * FROM training_order WHERE uuid = $1 AND faskes_uuid = $2 ${k ? "FOR UPDATE" : ""}`, [uuid, faskesUuid], k);
  if (!o) throw tidakDitemukan("Booking/order Training");
  return o;
};

export const detailOrder = async (uuid, faskesUuid, k) => {
  const o = await satu(`SELECT ${PILIH_ORDER} FROM ${DARI_ORDER} WHERE o.uuid = $1 AND o.faskes_uuid = $2`, [uuid, faskesUuid], k);
  if (!o) throw tidakDitemukan("Booking/order Training");
  return o;
};

// Kunci baris kelas & pastikan masih aktif (dipakai sebelum menghitung kapasitas agar aman dari permintaan bersamaan).
const kunciKelasAktif = async (kelasUuid, faskesUuid, k) => {
  const kelas = await satu(`SELECT * FROM training_kelas WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [kelasUuid, faskesUuid], k);
  if (!kelas) throw tidakDitemukan("Kelas Training");
  if (!kelas.status) throw permintaanSalah("Kelas sedang tidak aktif");
  return kelas;
};

// Validasi sesi sesuai is_sesi kelas; mengembalikan sesi_uuid (null bila kelas tanpa sesi).
const sesiValid = async (kelas, sesiUuid, k) => {
  if (!kelas.is_sesi) return null;
  if (!sesiUuid) throw permintaanSalah("sesi_uuid wajib diisi untuk kelas bersesi");
  const sesi = await satu(`SELECT uuid FROM training_kelas_sesi WHERE uuid = $1 AND kelas_uuid = $2 AND deleted_at IS NULL`, [sesiUuid, kelas.uuid], k);
  if (!sesi) throw tidakDitemukan("Sesi kelas");
  return sesi.uuid;
};

// Jumlah booking/order aktif pada kelas + tanggal (+ sesi); `kecuali` mengecualikan satu uuid (dipakai saat konversi
// booking → order, baris itu sendiri sudah memakai slot).
export const hitungTerisi = (faskesUuid, kelasUuid, tanggalKelas, sesiUuid, k, kecuali = null) =>
  satu(
    `SELECT COUNT(*)::int n FROM training_order
      WHERE faskes_uuid = $1 AND kelas_uuid = $2 AND tanggal_kelas = $3 AND sesi_uuid IS NOT DISTINCT FROM $4
        AND status IN ('booking', 'order') AND deleted_at IS NULL AND uuid IS DISTINCT FROM $5`,
    [faskesUuid, kelasUuid, tanggalKelas, sesiUuid, kecuali],
    k,
  ).then((r) => r.n);

// Ketersediaan slot kelas + tanggal (+ sesi): { kuota, terisi, tersedia }.
export const ketersediaan = async (faskesUuid, kelas, tanggalKelas, sesiUuid, k, kecuali = null) => {
  const terisi = await hitungTerisi(faskesUuid, kelas.uuid, tanggalKelas, sesiUuid, k, kecuali);
  return { kuota: kelas.jumlah_slot, terisi, tersedia: sisaSlot(kelas.jumlah_slot, terisi) };
};

// Buat baris booking ('status: booking', tanpa tagihan) atau order langsung ('status: order', kirim tagihan).
// b: { kelas_uuid, tanggal_kelas, sesi_uuid?, patient_uuid, payment_method?, penjamin_uuid? }
export const buatBaris = async (b, author, k, status) => {
  const f = author.faskesUuid;
  wajib(b, ["kelas_uuid", "tanggal_kelas", "patient_uuid"]);
  const tanggal = tanggalValid(b.tanggal_kelas, "tanggal_kelas");
  if (tanggal < hariIni()) throw permintaanSalah("Tanggal kelas sudah lewat");
  const kelas = await kunciKelasAktif(b.kelas_uuid, f, k);
  const sesiUuid = await sesiValid(kelas, b.sesi_uuid, k);
  const p = await pasien(b.patient_uuid, f);
  if (!p) throw tidakDitemukan("Pasien");

  const duplikat = await satu(
    `SELECT uuid FROM training_order WHERE faskes_uuid = $1 AND kelas_uuid = $2 AND tanggal_kelas = $3
        AND sesi_uuid IS NOT DISTINCT FROM $4 AND patient_uuid = $5 AND status <> 'batal' AND deleted_at IS NULL`,
    [f, kelas.uuid, tanggal, sesiUuid, p.uuid],
    k,
  );
  if (duplikat) throw new Galat(409, "Pasien sudah terdaftar (booking/order aktif) pada kelas, tanggal, dan sesi yang sama");

  const slot = await ketersediaan(f, kelas, tanggal, sesiUuid, k);
  if (slot.tersedia < 1) throw new Galat(409, "Slot kelas pada tanggal/sesi tersebut sudah penuh");

  if (status === "order") wajib(b, ["payment_method"]);
  const baris = await sisipkan(
    "training_order",
    {
      faskes_uuid: f, no_order: await nomorBaru(f, "TRN", k), kelas_uuid: kelas.uuid, sesi_uuid: sesiUuid,
      tanggal_kelas: tanggal, patient_uuid: p.uuid, no_rm: p.no_rm,
      payment_method: b.payment_method === undefined ? null : Number(b.payment_method),
      penjamin_uuid: b.penjamin_uuid ?? null, harga: kelas.harga, status, dibuat_oleh: author.username ?? null,
    },
    k,
  );
  if (status === "order") await tagihanOrder({ ...baris, kelas_nama: kelas.nama }, author, k);
  return detailOrder(baris.uuid, f, k);
};

// Perbarui booking (tanggal/sesi/pasien) selagi masih berstatus booking; slot divalidasi ulang (uuid sendiri dikecualikan).
export const perbaruiBooking = async (uuid, faskesUuid, b, k) => {
  const o = await ambilOrder(uuid, faskesUuid, k);
  if (o.status !== "booking") throw new Galat(409, `Booking berstatus ${o.status}, tidak dapat diubah`);
  const kelas = await kunciKelasAktif(o.kelas_uuid, faskesUuid, k);
  const tanggal = b.tanggal_kelas === undefined ? o.tanggal_kelas : tanggalValid(b.tanggal_kelas, "tanggal_kelas");
  if (tanggal < hariIni()) throw permintaanSalah("Tanggal kelas sudah lewat");
  const sesiUuid = b.sesi_uuid === undefined ? o.sesi_uuid : await sesiValid(kelas, b.sesi_uuid, k);
  const patientUuid = b.patient_uuid ?? o.patient_uuid;
  const p = await pasien(patientUuid, faskesUuid);
  if (!p) throw tidakDitemukan("Pasien");

  const duplikat = await satu(
    `SELECT uuid FROM training_order WHERE faskes_uuid = $1 AND kelas_uuid = $2 AND tanggal_kelas = $3
        AND sesi_uuid IS NOT DISTINCT FROM $4 AND patient_uuid = $5 AND status <> 'batal' AND deleted_at IS NULL AND uuid <> $6`,
    [faskesUuid, kelas.uuid, tanggal, sesiUuid, p.uuid, o.uuid],
    k,
  );
  if (duplikat) throw new Galat(409, "Pasien sudah terdaftar (booking/order aktif) pada kelas, tanggal, dan sesi yang sama");

  const slot = await ketersediaan(faskesUuid, kelas, tanggal, sesiUuid, k, o.uuid);
  if (slot.tersedia < 1) throw new Galat(409, "Slot kelas pada tanggal/sesi tersebut sudah penuh");

  await ubah("training_order", o.uuid, faskesUuid, { tanggal_kelas: tanggal, sesi_uuid: sesiUuid, patient_uuid: p.uuid, no_rm: p.no_rm, harga: kelas.harga }, k);
  return detailOrder(o.uuid, faskesUuid, k);
};

// Konversi booking → order (lanjut ke pendaftaran): kirim tagihan, slot tetap (baris yang sama).
export const konversiKeOrder = async (uuid, faskesUuid, b, author, k) => {
  wajib(b, ["payment_method"]);
  const o = await ambilOrder(uuid, faskesUuid, k);
  if (o.status !== "booking") throw new Galat(409, `Booking berstatus ${o.status}, tidak dapat dilanjutkan ke pendaftaran`);
  const kelas = await kunciKelasAktif(o.kelas_uuid, faskesUuid, k);
  const slot = await ketersediaan(faskesUuid, kelas, o.tanggal_kelas, o.sesi_uuid, k, o.uuid);
  if (slot.tersedia < 1) throw new Galat(409, "Slot kelas pada tanggal/sesi tersebut sudah penuh");
  const baru = await ubah(
    "training_order",
    o.uuid,
    faskesUuid,
    { status: "order", payment_method: Number(b.payment_method), penjamin_uuid: b.penjamin_uuid ?? null, harga: kelas.harga },
    k,
  );
  await tagihanOrder({ ...baru, kelas_nama: kelas.nama }, author, k);
  return detailOrder(o.uuid, faskesUuid, k);
};

// Batalkan booking/order: wajib alasan; tagihan dihapus bila sudah berstatus order; soft delete (deleted_at) + status batal.
export const batalkan = async (uuid, faskesUuid, alasan, author, k) => {
  const o = await ambilOrder(uuid, faskesUuid, k);
  if (o.status === "batal") throw new Galat(409, "Booking/order sudah dibatalkan sebelumnya");
  if (o.status === "order") {
    const kelas = await satu(`SELECT nama FROM training_kelas WHERE uuid = $1`, [o.kelas_uuid], k);
    await tagihanOrder({ ...o, kelas_nama: kelas?.nama }, author, k, true);
  }
  await ubah("training_order", o.uuid, faskesUuid, { status: "batal", alasan_batal: alasan, dibatalkan_oleh: author.username ?? null, dibatalkan_pada: sekarang(), deleted_at: sekarang() }, k);
  return detailOrder(o.uuid, faskesUuid, k);
};

const daftarQuery = (statusTetap) =>
  tangani(async (req, res) => {
    const q = req.query;
    const pg = halaman(q);
    const p = [req.author.faskesUuid];
    let w = "o.faskes_uuid = $1";
    const tambah = (nilai, kondisi) => {
      p.push(nilai);
      w += ` AND ${kondisi.replaceAll("$?", `$${p.length}`)}`;
    };
    if (statusTetap) tambah(statusTetap, "o.status = $?");
    else if (q.status) tambah(String(q.status).split(","), "o.status = ANY($?)");
    if (q.kelas_uuid) tambah(q.kelas_uuid, "o.kelas_uuid = $?");
    if (q.patient_uuid) tambah(q.patient_uuid, "o.patient_uuid = $?");
    if (q.tanggal_mulai) tambah(tanggalValid(q.tanggal_mulai, "tanggal_mulai"), "o.tanggal_kelas >= $?::date");
    if (q.tanggal_selesai) tambah(tanggalValid(q.tanggal_selesai, "tanggal_selesai"), "o.tanggal_kelas <= $?::date");
    if (q.cari) tambah(`%${q.cari}%`, "(p.name ILIKE $? OR o.no_rm ILIKE $? OR o.no_order ILIKE $?)");
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI_ORDER} WHERE ${w}`, p)).n;
    const rows = await query(`SELECT ${PILIH_ORDER} FROM ${DARI_ORDER} WHERE ${w} ORDER BY o.tanggal_kelas DESC, o.created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
  });

rute.get("/", izinTraining("Daftar Kelas", "READ"), daftarQuery(null));

rute.get(
  "/:uuid",
  izinTraining("Daftar Kelas", "READ"),
  tangani(async (req, res) => kirim(res, await detailOrder(req.params.uuid, req.author.faskesUuid))),
);

// POST /order — pendaftaran langsung (tanpa booking terlebih dahulu); payment_method wajib.
rute.post(
  "/",
  izinTraining("Daftar Kelas", "CREATE DAFTAR KELAS"),
  tangani(async (req, res) => {
    const hasil = await transaksi((k) => buatBaris(req.body, req.author, k, "order"));
    kirim(res, hasil, `Order ${hasil.no_order} berhasil didaftarkan`);
  }),
);

// PUT /order/:uuid/batal — batal order (wajib alasan); tagihan terkait dihapus.
rute.put(
  "/:uuid/batal",
  izinTraining("Daftar Kelas", "BATAL DAFTAR"),
  tangani(async (req, res) => {
    wajib(req.body, ["alasan"]);
    const hasil = await transaksi((k) => batalkan(req.params.uuid, req.author.faskesUuid, req.body.alasan, req.author, k));
    kirim(res, hasil, `Order ${hasil.no_order} dibatalkan`);
  }),
);

export default rute;
