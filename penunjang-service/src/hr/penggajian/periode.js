import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../../db.js";
import { kirim, permintaanSalah, halaman, denganHalaman } from "../../umum/respons.js";
import { SUB, cekVersi, transisi, konflik, wajibTeks, rentang, epoch } from "./bersama.js";
import { uang, sen, senAman } from "./perhitungan.js";
import { izin, tangani, baca, daftar, ambil, pegawai, catat, draf, pengguna } from "./dasar.js";
import { kunci } from "./komponen.js";
import { muatSumber, hitungSumber } from "./sumber.js";
import { reservasiJaspel } from "../../akuntansi/remunerasi/penggajian.js";
import { cobaJurnal } from "./jurnal.js";
import { susunPenggajian } from "../../akuntansi/event.js";

const rute = express.Router();
const bacaPeriode = [[SUB.periode, "READ"], [SUB.verifikasi, "READ"], [SUB.persetujuan, "READ"], [SUB.pembayaran, "READ"], [SUB.administratif, "READ"]];
export const kunciPeriode = async (k, req) => {
  await kunci(k, req.author.faskesUuid, "sumber");
  const p = await ambil(k, req.author.faskesUuid, "hr_gaji_periode", req.params.uuid, true);
  cekVersi(p, req.body ?? {});
  return p;
};
export const pastikanSumberTetap = async (k, f, p, b) => {
  if (!p.penghitungan_uuid || !p.hash_hitung || p.hash_hitung !== b.hash_hitung) throw konflik("Hash penghitungan tidak sesuai; hitung ulang");
  if (p.jumlah_pengecualian > 0) throw konflik("Masih ada pengecualian penghitungan");
  const s = await muatSumber(k, f, p);
  if (s.hash !== p.hash_hitung) throw konflik("Sumber berubah; hitung dan verifikasi ulang");
};
// Daftar periode juga untuk pemegang izin Rekap/Ekspor (memilih periode terkunci yang akan direkap/diekspor).
rute.get("/periode", izin(...bacaPeriode, [SUB.rekap, "READ"], [SUB.ekspor, "READ"]), baca((k, req) => {
  const filter = [], params = [];
  for (const c of ["tahun", "bulan", "status"]) if (req.query[c]) { params.push(req.query[c]); filter.push(`${c} = $${params.length + 1}`); }
  return daftar(k, req, "hr_gaji_periode", filter.length ? `AND ${filter.join(" AND ")}` : "", params);
}));
rute.post("/periode", izin([SUB.periode, "CREATE"]), tangani(async (req, res) => {
  const b = req.body ?? {}, f = req.author.faskesUuid;
  rentang(b.tahun, b.bulan);
  const hasil = await transaksi(async (k) => {
    await kunci(k, f, "sumber");
    await ambil(k, f, "hr_gaji_konfigurasi", wajibTeks(b.konfigurasi_uuid, "konfigurasi_uuid", 255));
    await ambil(k, f, "remunerasi_periode", wajibTeks(b.remunerasi_periode_uuid, "remunerasi_periode_uuid", 255));
    const p = await sisipkan("hr_gaji_periode", { faskes_uuid: f, tahun: b.tahun, bulan: b.bulan, konfigurasi_uuid: b.konfigurasi_uuid, remunerasi_periode_uuid: b.remunerasi_periode_uuid, dibuat_oleh: pengguna(req) }, k);
    await catat(k, req, "buat_periode", p.uuid, { periodeUuid: p.uuid });
    return p;
  });
  kirim(res, hasil, "Periode draf dibuat");
}));
rute.get("/periode/:uuid", izin(...bacaPeriode), baca(async (k, req) => {
  const f = req.author.faskesUuid, p = await ambil(k, f, "hr_gaji_periode", req.params.uuid);
  const hitung = p.penghitungan_uuid ? await ambil(k, f, "hr_gaji_penghitungan", p.penghitungan_uuid) : null;
  const jurnal = await satu(`SELECT status, jurnal_uuid, percobaan, alasan FROM hr_gaji_jurnal WHERE faskes_uuid = $1 AND periode_uuid = $2 AND deleted_at IS NULL`, [f, p.uuid], k);
  return { ...p, ringkasan: hitung?.ringkasan ?? null, konfigurasi: hitung?.sumber?.konfigurasi ?? null, jurnal };
}));
rute.get("/periode/:uuid/hasil", izin(...bacaPeriode), baca(async (k, req) => {
  const p = await ambil(k, req.author.faskesUuid, "hr_gaji_periode", req.params.uuid);
  const params = [req.author.faskesUuid, p.penghitungan_uuid];
  let kondisi = "h.faskes_uuid = $1 AND h.penghitungan_uuid = $2 AND h.deleted_at IS NULL";
  for (const c of ["unit_uuid", "kepegawaian_uuid"]) if (req.query[c]) { params.push(req.query[c]); kondisi += ` AND h.${c} = $${params.length}`; }
  const paginasi = halaman({ ...req.query, limit: Math.min(Number(req.query.limit) || 20, 200) });
  const total = await satu(`SELECT count(*) AS jumlah FROM hr_gaji_hasil h WHERE ${kondisi}`, params, k);
  const rows = await query(`SELECT h.*, peg.name AS nama, l.name AS unit,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('komponen_uuid', r.komponen_uuid, 'kode', r.kode, 'jenis', r.jenis, 'nilai', r.nilai::text,
      'sumber_tabel', r.sumber_tabel, 'sumber_uuid', r.sumber_uuid, 'dasar_perhitungan', r.dasar_perhitungan) ORDER BY r.kode, r.uuid)
      FROM hr_gaji_rincian r WHERE r.faskes_uuid = h.faskes_uuid AND r.hasil_uuid = h.uuid AND r.deleted_at IS NULL), '[]'::jsonb) AS rincian
    FROM hr_gaji_hasil h LEFT JOIN hr_kepegawaian s ON s.uuid = h.kepegawaian_uuid AND s.faskes_uuid = h.faskes_uuid AND s.deleted_at IS NULL
    LEFT JOIN pegawai peg ON peg.uuid = s.pegawai_uuid AND peg.faskes_uuid = s.faskes_uuid AND peg.deleted_at IS NULL
    LEFT JOIN lokasi l ON l.uuid = h.unit_uuid AND l.faskes_uuid = h.faskes_uuid AND l.deleted_at IS NULL
    WHERE ${kondisi} ORDER BY h.kepegawaian_uuid LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, paginasi.limit, paginasi.offset], k);
  return denganHalaman(rows, total?.jumlah ?? 0, paginasi);
}));
rute.post("/periode/:uuid/hitung", izin([SUB.periode, "HITUNG"]), tangani(async (req, res) => {
  const f = req.author.faskesUuid;
  const hasil = await transaksi(async (k) => {
    const p = await kunciPeriode(k, req); draf(p);
    const { sumber, hash } = await muatSumber(k, f, p);
    if (p.hash_hitung === hash && p.penghitungan_uuid) return p;
    const { hasil, ringkasan } = hitungSumber(sumber);
    for (const c of ["bruto", "potongan", "iuran_pemberi_kerja", "bersih"]) senAman(ringkasan[c]);
    if (!ringkasan.jumlah_pengecualian) susunPenggajian({ ...p, bersih: ringkasan.bersih, tanggal_bayar: rentang(p.tahun, p.bulan).awal }, hasil.flatMap((h) => h.rincian));
    await reservasiJaspel(k, f, p.uuid, sumber.jaspel);
    const g = await sisipkan("hr_gaji_penghitungan", { faskes_uuid: f, periode_uuid: p.uuid, nomor_versi: p.versi + 1, hash_sumber: hash, konfigurasi_uuid: sumber.konfigurasi.uuid, ringkasan, sumber, dihitung_oleh: pengguna(req), dihitung_pada: sekarang() }, k);
    for (const { rincian, ...data } of hasil) {
      const h = await sisipkan("hr_gaji_hasil", { faskes_uuid: f, penghitungan_uuid: g.uuid, ...data }, k);
      for (const r of rincian) await sisipkan("hr_gaji_rincian", { faskes_uuid: f, hasil_uuid: h.uuid, ...r }, k);
    }
    const { kehadiran, ...total } = ringkasan;
    const row = await ubah("hr_gaji_periode", p.uuid, f, { ...total, penghitungan_uuid: g.uuid, hash_hitung: hash, dihitung_oleh: pengguna(req), versi: p.versi + 1 }, k);
    await catat(k, req, "hitung_periode", p.uuid, { periodeUuid: p.uuid, sebelum: p.hash_hitung, sesudah: hash });
    return row;
  });
  kirim(res, hasil, "Penghitungan periode selesai");
}));
for (const [aksi, sub, hak] of [["ajukan", SUB.periode, "AJUKAN"], ["verifikasi", SUB.verifikasi, "VALIDASI"], ["kembalikan", SUB.verifikasi, "KEMBALIKAN"], ["setujui", SUB.persetujuan, "SETUJUI"], ["tolak", SUB.persetujuan, "TOLAK"]]) {
  rute.post(`/periode/:uuid/${aksi}`, izin([sub, hak]), tangani(async (req, res) => {
    const f = req.author.faskesUuid, b = req.body ?? {};
    const hasil = await transaksi(async (k) => {
      const p = await kunciPeriode(k, req);
      const status = transisi(p, aksi, pengguna(req));
      const kembali = ["kembalikan", "tolak"].includes(aksi);
      const alasan = kembali ? wajibTeks(b.alasan, "alasan") : null;
      if (!kembali) await pastikanSumberTetap(k, f, p, b);
      const data = { status, versi: p.versi + 1 };
      if (aksi === "verifikasi") data.diverifikasi_oleh = pengguna(req);
      if (aksi === "setujui") { data.disetujui_oleh = pengguna(req); data.terkunci_pada = sekarang(); }
      if (kembali) { data.diverifikasi_oleh = null; data.disetujui_oleh = null; }
      const row = await ubah("hr_gaji_periode", p.uuid, f, data, k);
      await catat(k, req, aksi, p.uuid, { periodeUuid: p.uuid, alasan, sesudah: p.hash_hitung });
      return row;
    });
    kirim(res, hasil, "Perubahan status dicatat");
  }));
}
rute.post("/periode/:uuid/batalkan", izin([SUB.periode, "BATALKAN"]), tangani(async (req, res) => {
  const f = req.author.faskesUuid, alasan = wajibTeks(req.body?.alasan, "alasan");
  await transaksi(async (k) => {
    const p = await kunciPeriode(k, req); draf(p);
    // Kunci sumber yang sama dengan pembayaran Remunerasi sebelum melepaskan reservasi.
    await ambil(k, f, "remunerasi_periode", p.remunerasi_periode_uuid, true);
    await query(`UPDATE hr_gaji_jaspel_sumber SET status = 'dilepas', updated_at = $3 WHERE faskes_uuid = $1 AND periode_uuid = $2 AND status = 'reservasi' AND deleted_at IS NULL`, [f, p.uuid, sekarang()], k);
    await ubah("hr_gaji_periode", p.uuid, f, { deleted_at: sekarang(), versi: p.versi + 1 }, k);
    await catat(k, req, "batalkan_periode", p.uuid, { periodeUuid: p.uuid, alasan });
  });
  kirim(res, null, "Draf dibatalkan dan reservasi dilepas");
}));
rute.post("/periode/:uuid/koreksi", izin([SUB.periode, "KOREKSI"]), tangani(async (req, res) => {
  const f = req.author.faskesUuid, b = req.body ?? {}, nilai = uang(sen(b.nilai)), alasan = wajibTeks(b.alasan, "alasan");
  if (!sen(nilai)) throw permintaanSalah("Nilai koreksi tidak boleh nol");
  const hasil = await transaksi(async (k) => {
    const p = await kunciPeriode(k, req); draf(p);
    const h = await ambil(k, f, "hr_gaji_hasil", b.hasil_asal_uuid);
    const g = await ambil(k, f, "hr_gaji_penghitungan", h.penghitungan_uuid);
    const asal = await ambil(k, f, "hr_gaji_periode", g.periode_uuid);
    if (!asal.terkunci_pada || asal.penghitungan_uuid !== g.uuid || p.tahun * 12 + p.bulan !== asal.tahun * 12 + asal.bulan + 1) throw konflik("Koreksi hanya pada periode berikutnya dari hasil terkunci yang digunakan");
    await pegawai(k, f, h.kepegawaian_uuid);
    await ambil(k, f, "hr_gaji_komponen", b.komponen_uuid);
    const r = await sisipkan("hr_gaji_koreksi", { faskes_uuid: f, periode_tujuan_uuid: p.uuid, hasil_asal_uuid: h.uuid, kepegawaian_uuid: h.kepegawaian_uuid, komponen_uuid: b.komponen_uuid, nilai, alasan }, k);
    await ubah("hr_gaji_periode", p.uuid, f, { versi: p.versi + 1, hash_hitung: null }, k);
    await catat(k, req, "koreksi_periode", r.uuid, { periodeUuid: p.uuid, alasan });
    return r;
  });
  kirim(res, hasil, "Koreksi dicatat; hitung ulang periode tujuan");
}));
rute.post("/periode/:uuid/bayar", izin([SUB.pembayaran, "BAYAR"]), tangani(async (req, res) => {
  const f = req.author.faskesUuid, b = req.body ?? {};
  const hasil = await transaksi(async (k) => {
    await kunci(k, f, "sumber");
    let p = await ambil(k, f, "hr_gaji_periode", req.params.uuid, true);
    if (p.status === "dibayar") {
      if (b.referensi_bayar !== p.referensi_bayar || b.tanggal_bayar !== Number(p.tanggal_bayar) || b.metode_bayar !== p.metode_bayar) throw konflik("Metadata pembayaran berbeda dari pembayaran tersimpan");
      return { ...p, jurnal: await satu(`SELECT status, jurnal_uuid FROM hr_gaji_jurnal WHERE faskes_uuid = $1 AND periode_uuid = $2 AND deleted_at IS NULL`, [f, p.uuid], k) };
    }
    cekVersi(p, b); transisi(p, "bayar", pengguna(req));
    const tanggal = epoch(b.tanggal_bayar, "tanggal_bayar");
    if (tanggal < rentang(p.tahun, p.bulan).awal || tanggal > sekarang()) throw permintaanSalah("Tanggal pembayaran di luar rentang yang diizinkan");
    if (b.metode_bayar !== "TRANSFER") throw permintaanSalah("Penggajian dasar hanya mendukung metode TRANSFER");
    const referensi = wajibTeks(b.referensi_bayar, "referensi_bayar", 255);
    await ambil(k, f, "remunerasi_periode", p.remunerasi_periode_uuid, true);
    const sumber = await satu(`SELECT uuid FROM hr_gaji_jaspel_sumber WHERE faskes_uuid = $1 AND periode_uuid = $2 AND status = 'reservasi' AND deleted_at IS NULL FOR UPDATE`, [f, p.uuid], k);
    if (!sumber) throw konflik("Reservasi sumber pembayaran tidak tersedia");
    p = await ubah("hr_gaji_periode", p.uuid, f, { status: "dibayar", versi: p.versi + 1, dibayar_oleh: pengguna(req), tanggal_bayar: tanggal, metode_bayar: b.metode_bayar, referensi_bayar: referensi }, k);
    await ubah("hr_gaji_jaspel_sumber", sumber.uuid, f, { status: "dibayar" }, k);
    await catat(k, req, "bayar_periode", p.uuid, { periodeUuid: p.uuid, sesudah: p.hash_hitung });
    return { ...p, jurnal: await cobaJurnal(k, req, p) };
  });
  kirim(res, hasil, "Pembayaran dicatat; periksa status jurnal sebelum menerbitkan slip");
}));
rute.post("/periode/:uuid/jurnal/ulang", izin([SUB.pembayaran, "ULANG JURNAL"]), tangani(async (req, res) => {
  const hasil = await transaksi(async (k) => {
    const p = await kunciPeriode(k, req);
    await ambil(k, req.author.faskesUuid, "remunerasi_periode", p.remunerasi_periode_uuid, true);
    return cobaJurnal(k, req, p);
  });
  kirim(res, hasil, "Percobaan jurnal dicatat");
}));
rute.get("/periode/:uuid/riwayat", izin(...bacaPeriode), baca(async (k, req) => {
  await ambil(k, req.author.faskesUuid, "hr_gaji_periode", req.params.uuid);
  // Pembacaan tetap tercatat di audit pusat; riwayat periode hanya menampilkan tindakan yang mengubah.
  return daftar(k, req, "hr_gaji_riwayat_tindakan", "AND periode_uuid = $2 AND aksi <> 'baca_penggajian'", [req.params.uuid]);
}));
export default rute;
