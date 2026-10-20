import express from "express";
import { query, satu, transaksi, sekarang } from "../../db.js";
import { kirim, tangani, Galat, permintaanSalah } from "../../umum/respons.js";
import { wajibIzin, pastikanIzin } from "../../umum/izin.js";
import { buat, ambil, perbarui, audit, milikSaya, pegawai, dalamCakupan, kunciPegawai, catatKehadiran, cekVersi, daftarPegawai } from "./repository.js";
import { wajibTeks, bulat, tanggalWib, tanggal, jenisAbsen, kunciKejadian, validasiUrutan, waktuImpor, statusJadwal } from "./aturan.js";
import { kebijakan, tahunKini } from "./saldo.js";
import { bacaBerkasImpor } from "./impor.js";

const rute = express.Router();
const izin = (aksi) => wajibIzin("HR / SDM", "Kehadiran, Cuti & Izin", aksi);
rute.get("/saya", izin("READ"), tangani(async (req, res) => {
  const h = await milikSaya(req);
  const mulai = tanggal(req.query.tanggal_mulai ?? `${tanggalWib(sekarang()).slice(0, 7)}-01`);
  const akhir = tanggal(req.query.tanggal_selesai ?? tanggalWib(sekarang()));
  kirim(res, { pegawai: { uuid: h.uuid, nama: h.nama }, catatan: await query(`SELECT * FROM hr_kehadiran WHERE faskes_uuid = $1 AND kepegawaian_uuid = $2 AND deleted_at IS NULL AND tanggal_operasional BETWEEN $3 AND $4 ORDER BY waktu DESC LIMIT 500`, [req.author.faskesUuid, h.uuid, mulai, akhir]), ...statusJadwal() });
}));
rute.post("/absen", izin("ABSEN"), tangani(async (req, res) => {
  const b = req.body ?? {}, jenis = jenisAbsen(b.jenis);
  const idempotensi = wajibTeks(b.kunci_idempotensi, "Kunci idempotensi", 120);
  const lokasi = b.catatan_lokasi ? wajibTeks(b.catatan_lokasi, "Catatan lokasi", 500) : null;
  kirim(res, await transaksi(async (k) => {
    const h = await milikSaya(req, k), f = req.author.faskesUuid;
    await kunciPegawai(h.uuid, f, k);
    const kunci = kunciKejadian(f, "web", h.uuid, 0, jenis, `${h.uuid}:${idempotensi}`);
    const ada = await satu(`SELECT * FROM hr_kehadiran WHERE faskes_uuid = $1 AND kunci_deduplikasi = $2`, [f, kunci], k);
    if (ada) {
      if (ada.deleted_at || ada.jenis !== jenis || ada.catatan_lokasi !== lokasi) throw new Galat(409, "Kunci idempotensi telah digunakan untuk catatan berbeda");
      return ada;
    }
    const terakhir = await satu(`SELECT * FROM hr_kehadiran WHERE faskes_uuid = $1 AND kepegawaian_uuid = $2 AND deleted_at IS NULL ORDER BY waktu DESC LIMIT 1`, [f, h.uuid], k);
    const p = await kebijakan(f, tahunKini(), k);
    const waktu = sekarang();
    validasiUrutan(terakhir, jenis, waktu, p.data.maks_sesi_jam);
    const r = await catatKehadiran(req, { kepegawaian_uuid: h.uuid, waktu, jenis, sumber: "web", catatan_lokasi: lokasi, kunci_deduplikasi: kunci }, k);
    await audit(req, "hr_kehadiran", r.uuid, { jenis, waktu, sumber: "web" }, k);
    return { ...r, ...statusJadwal() };
  }), "Absen berhasil dicatat");
}));
rute.get("/pegawai", izin("READ"), tangani(async (req, res) => {
  const aksi = String(req.query.aksi ?? "lihat_rekap");
  if (!["lihat_rekap", "ekspor_rekap", "impor", "koreksi", "sesuaikan_saldo"].includes(aksi)) throw permintaanSalah("Aksi tidak sah");
  await pastikanIzin(req, "HR / SDM", "Kehadiran, Cuti & Izin", { lihat_rekap: "LIHAT REKAP", ekspor_rekap: "EKSPOR REKAP", impor: "IMPOR", koreksi: "KOREKSI", sesuaikan_saldo: "SESUAIKAN SALDO" }[aksi]);
  kirim(res, await daftarPegawai(req, aksi));
}));
rute.get("/kehadiran", izin("KOREKSI"), tangani(async (req, res) => {
  const h = await pegawai(wajibTeks(req.query.pegawai_uuid, "Pegawai", 255), req.author.faskesUuid);
  await dalamCakupan(req, h, "koreksi");
  const mulai = tanggal(req.query.tanggal_mulai), selesai = tanggal(req.query.tanggal_selesai);
  kirim(res, await query(`SELECT * FROM hr_kehadiran WHERE faskes_uuid = $1 AND kepegawaian_uuid = $2 AND deleted_at IS NULL AND tanggal_operasional BETWEEN $3 AND $4 ORDER BY waktu LIMIT 1000`, [req.author.faskesUuid, h.uuid, mulai, selesai]));
}));
rute.post("/kehadiran/manual", izin("KOREKSI"), tangani(async (req, res) => {
  const b = req.body ?? {}, alasan = wajibTeks(b.alasan, "Alasan"), jenis = jenisAbsen(b.jenis);
  const waktu = bulat(b.waktu, "Waktu", 946659600, sekarang());
  kirim(res, await transaksi(async (k) => {
    const h = await kunciPegawai(wajibTeks(b.pegawai_uuid, "Pegawai", 255), req.author.faskesUuid, k);
    await dalamCakupan(req, h, "koreksi", k);
    const r = await catatKehadiran(req, { kepegawaian_uuid: h.uuid, waktu, jenis, sumber: "manual", kunci_deduplikasi: kunciKejadian(req.author.faskesUuid, "manual", h.uuid, waktu, jenis) }, k);
    if (!r) throw new Galat(409, "Catatan manual sudah ada");
    await buat("hr_kehadiran_koreksi", req, { kehadiran_uuid: r.uuid, sebelum: null, sesudah: r, alasan }, k);
    await audit(req, "hr_kehadiran", r.uuid, { alasan, sesudah: r }, k);
    return r;
  }), "Catatan manual berhasil ditambahkan");
}));
rute.patch("/kehadiran/:uuid/koreksi", izin("KOREKSI"), tangani(async (req, res) => {
  const b = req.body ?? {}, alasan = wajibTeks(b.alasan, "Alasan"), f = req.author.faskesUuid;
  kirim(res, await transaksi(async (k) => {
    const awal = await ambil("hr_kehadiran", req.params.uuid, f, k);
    const h = await kunciPegawai(awal.kepegawaian_uuid, f, k);
    await dalamCakupan(req, h, "koreksi", k);
    const lama = await ambil("hr_kehadiran", awal.uuid, f, k, true);
    cekVersi(lama, b.versi);
    const input = b.perubahan ?? {};
    const data = { waktu: input.waktu === undefined ? Number(lama.waktu) : bulat(input.waktu, "Waktu", 946659600, sekarang()),
      jenis: input.jenis === undefined ? lama.jenis : jenisAbsen(input.jenis),
      catatan_lokasi: input.catatan_lokasi === undefined ? lama.catatan_lokasi : input.catatan_lokasi ? wajibTeks(input.catatan_lokasi, "Lokasi", 500) : null };
    data.tanggal_operasional = tanggalWib(data.waktu);
    const baru = await perbarui("hr_kehadiran", req, lama, { ...data, versi: lama.versi + 1 }, k);
    await buat("hr_kehadiran_koreksi", req, { kehadiran_uuid: lama.uuid, sebelum: lama, sesudah: baru, alasan }, k);
    await audit(req, "hr_kehadiran_koreksi", lama.uuid, { sebelum: lama, sesudah: baru, alasan }, k);
    return baru;
  }), "Koreksi berhasil dicatat");
}));

rute.post("/impor/pratinjau", izin("IMPOR"), tangani(async (req, res) => {
  const b = req.body ?? {}, tabel = bacaBerkasImpor(b);
  const mesin = wajibTeks(b.kode_mesin, "Kode mesin", 100), f = req.author.faskesUuid;
  if (!["epoch", "wib"].includes(b.format_waktu)) throw permintaanSalah("Format waktu harus epoch atau wib");
  kirim(res, await transaksi(async (k) => {
    const impor = await buat("hr_absensi_impor", req, { pemilik: req.author.username, pemetaan: { ...b.pemetaan, format_waktu: b.format_waktu }, kode_mesin: mesin, status: "pratinjau", kedaluwarsa: sekarang() + 86400 }, k);
    const ringkasan = { valid: 0, gagal: 0 };
    const kesalahan = [];
    const cakupan = new Map((await daftarPegawai(req, "impor", k)).map((h) => [h.pegawai_uuid, h]));
    for (const baris of tabel.baris) {
      let normalisasi = null, pesan = null;
      try {
        const v = baris.nilai, h = cakupan.get(v[b.pemetaan.pegawai]);
        if (!h) throw permintaanSalah("UUID pegawai Data Master tidak cocok secara tunggal dengan pegawai aktif dalam cakupan impor");
        const waktu = waktuImpor(v[b.pemetaan.waktu], b.format_waktu), jenis = jenisAbsen(v[b.pemetaan.jenis]);
        if (waktu > sekarang()) throw permintaanSalah("Waktu kejadian belum terjadi");
        const kejadian = b.pemetaan.kejadian ? v[b.pemetaan.kejadian] : null;
        normalisasi = { kepegawaian_uuid: h.uuid, waktu, jenis, sumber: "impor", kode_mesin: mesin,
          kunci_deduplikasi: kunciKejadian(f, mesin, h.uuid, waktu, jenis, kejadian) };
        ringkasan.valid++;
      } catch (e) { if (!e.status) throw e; pesan = e.message; ringkasan.gagal++; kesalahan.push({ nomor_baris: baris.nomor_baris, pesan }); }
      await buat("hr_absensi_impor_baris", req, { impor_uuid: impor.uuid, nomor_baris: baris.nomor_baris, normalisasi, status: pesan ? "gagal" : "valid", pesan }, k);
    }
    await perbarui("hr_absensi_impor", req, impor, { ringkasan }, k);
    await audit(req, "hr_absensi_impor", impor.uuid, { tahap: "pratinjau", ...ringkasan }, k);
    return { uuid: impor.uuid, header: tabel.header, ringkasan, kesalahan: kesalahan.slice(0, 100), zona_waktu: "Asia/Jakarta", format_waktu: b.format_waktu };
  }), "Pratinjau impor siap diperiksa");
}));
rute.post("/impor/:uuid/proses", izin("IMPOR"), tangani(async (req, res) => {
  wajibTeks(req.body?.kunci_idempotensi, "Kunci idempotensi", 120);
  const f = req.author.faskesUuid;
  const awal = await ambil("hr_absensi_impor", req.params.uuid, f);
  if (awal.pemilik !== req.author.username) throw new Galat(404, "Impor tidak ditemukan");
  // Setiap baris mempunyai transaksi sendiri. Pengulangan melanjutkan baris valid setelah proses terputus.
  if (awal.status !== "selesai" && Number(awal.kedaluwarsa) < sekarang()) throw new Galat(409, "Pratinjau kedaluwarsa; unggah ulang berkas");
  const baris = await query(`SELECT uuid FROM hr_absensi_impor_baris WHERE faskes_uuid = $1 AND impor_uuid = $2 AND status = 'valid' AND deleted_at IS NULL ORDER BY nomor_baris`, [f, awal.uuid]);
  for (const ref of baris) await transaksi(async (k) => {
    const i = await ambil("hr_absensi_impor_baris", ref.uuid, f, k, true);
    if (i.status !== "valid") return;
    const h = await kunciPegawai(i.normalisasi.kepegawaian_uuid, f, k);
    await dalamCakupan(req, h, "impor", k);
    const r = await catatKehadiran(req, { ...i.normalisasi, impor_uuid: awal.uuid }, k);
    await perbarui("hr_absensi_impor_baris", req, i, { status: r ? "diterima" : "diabaikan", normalisasi: null }, k);
    await audit(req, "hr_absensi_impor_baris", i.uuid, { impor_uuid: awal.uuid, nomor_baris: i.nomor_baris, hasil: r ? "diterima" : "diabaikan" }, k);
  });
  kirim(res, await transaksi(async (k) => {
    const jumlah = await query(`SELECT status, count(*)::int AS jumlah FROM hr_absensi_impor_baris WHERE faskes_uuid = $1 AND impor_uuid = $2 AND deleted_at IS NULL GROUP BY status`, [f, awal.uuid], k);
    const ringkasan = { diterima: 0, diabaikan: 0, gagal: 0, ...Object.fromEntries(jumlah.map((r) => [r.status, r.jumlah])) };
    const r = await perbarui("hr_absensi_impor", req, awal, { status: "selesai", ringkasan }, k);
    await audit(req, "hr_absensi_impor", awal.uuid, ringkasan, k);
    return r;
  }), "Pemrosesan impor selesai");
}));
rute.get("/impor/:uuid", izin("IMPOR"), tangani(async (req, res) => {
  const r = await ambil("hr_absensi_impor", req.params.uuid, req.author.faskesUuid);
  if (r.pemilik !== req.author.username) throw new Galat(404, "Impor tidak ditemukan");
  const page = bulat(req.query.page ?? 1, "Halaman", 1), limit = 100;
  kirim(res, { ...r, kesalahan: await query(`SELECT nomor_baris, pesan FROM hr_absensi_impor_baris WHERE faskes_uuid = $1 AND impor_uuid = $2 AND status = 'gagal' AND deleted_at IS NULL ORDER BY nomor_baris LIMIT $3 OFFSET $4`, [req.author.faskesUuid, r.uuid, limit, (page - 1) * limit]) });
}));

export default rute;
