import express from "express";
import { createHash } from "node:crypto";
import { query, satu, transaksi, sekarang } from "../../db.js";
import { Galat, kirim, tangani, permintaanSalah, tidakDitemukan } from "../../umum/respons.js";
import { wajibIzin, punyaIzin } from "../../umum/izin.js";
import { sisipkanBerkas } from "../../mutu/dasar.js";
import { ambil, buat, perbarui, audit, pegawai, milikSaya, kunciPegawai, dalamCakupan, bolehDetail, cekVersi, aktifSql } from "./repository.js";
import { wajibTeks, bulat, tanggalWib, rincianHari, statusKeputusan } from "./aturan.js";
import { pastikanSaldo, bacaSaldo, reservasiSaldo, sahkanSaldo, lepasReservasi, kembalikanSaldo, kebijakan, tahunKini, mutasi } from "./saldo.js";

const rute = express.Router(), SUB = "Kehadiran, Cuti & Izin";
const izin = (aksi) => wajibIzin("HR / SDM", SUB, aksi);
const boleh = (req, aksi) => punyaIzin(req, "HR / SDM", SUB, aksi);
const lampiranMeta = (r) => ({ uuid: r.uuid, tipe: r.tipe, ukuran: r.ukuran });
const cekDetail = async (req, p, k) => {
  if (p.pemohon === req.author.username) return bolehDetail(req, p, k);
  if (await boleh(req, "SAHKAN SDM")) {
    const h = await pegawai(p.kepegawaian_uuid, req.author.faskesUuid, k);
    try { await dalamCakupan(req, h, "sahkan_sdm", k); return h; } catch (e) { if (e.status !== 403) throw e; }
  }
  if (await boleh(req, "TINJAU ATASAN")) return bolehDetail(req, p, k);
  throw tidakDitemukan();
};
const cekTumpangTindih = async (f, h, mulai, selesai, k, kecuali = "") => {
  const ada = await satu(`SELECT 1 FROM hr_pengajuan_cuti WHERE faskes_uuid = $1 AND kepegawaian_uuid = $2 AND deleted_at IS NULL
    AND status IN ('menunggu_atasan','menunggu_sdm','sah') AND tanggal_mulai <= $4 AND tanggal_selesai >= $3 AND uuid <> $5`, [f, h.uuid, mulai, selesai, kecuali], k);
  if (ada) throw new Galat(409, "Periode bertumpang tindih dengan pengajuan aktif");
};
rute.post("/lampiran", izin("AJUKAN"), tangani(async (req, res) => {
  await milikSaya(req);
  const b = req.body ?? {}, tipe = wajibTeks(b.tipe, "Jenis media", 100);
  const isi = wajibTeks(b.base64, "Isi lampiran", 7 * 1024 * 1024);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(isi)) throw permintaanSalah("Isi lampiran bukan base64 yang sah");
  const berkas = Buffer.from(isi, "base64");
  const cocok = (tipe === "application/pdf" && berkas.subarray(0, 5).toString() === "%PDF-") ||
    (tipe === "image/png" && berkas.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
    (tipe === "image/jpeg" && berkas[0] === 255 && berkas[1] === 216 && berkas[2] === 255);
  if (!cocok || berkas.length > 5 * 1024 * 1024) throw permintaanSalah("Lampiran harus PDF, PNG, atau JPEG dengan ukuran maksimal 5 MB");
  kirim(res, await transaksi(async (k) => {
    const r = await sisipkanBerkas("hr_lampiran_cuti", { faskes_uuid: req.author.faskesUuid, dibuat_oleh: req.author.username, pemilik: req.author.username, berkas, tipe, ukuran: berkas.length,
      hash: createHash("sha256").update(berkas).digest("hex"), kedaluwarsa: sekarang() + 86400 }, k);
    await audit(req, "hr_lampiran_cuti", r.uuid, { tipe, ukuran: berkas.length }, k);
    return lampiranMeta(r);
  }), "Lampiran tersimpan secara privat");
}));
rute.get("/lampiran/:uuid", izin("READ"), tangani(async (req, res) => {
  const f = req.author.faskesUuid;
  const r = await ambil("hr_lampiran_cuti", req.params.uuid, f);
  if (r.pengajuan_uuid) await cekDetail(req, await ambil("hr_pengajuan_cuti", r.pengajuan_uuid, f));
  else if (r.pemilik !== req.author.username || Number(r.kedaluwarsa) < sekarang()) throw tidakDitemukan();
  res.set({ "Content-Type": r.tipe, "Content-Disposition": `attachment; filename="lampiran.${r.tipe === "application/pdf" ? "pdf" : r.tipe === "image/png" ? "png" : "jpg"}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.send(r.berkas);
}));

rute.post("/pengajuan", izin("AJUKAN"), tangani(async (req, res) => {
  const b = req.body ?? {}, hari = rincianHari(b.tanggal_mulai, b.tanggal_selesai), f = req.author.faskesUuid;
  const alasan = wajibTeks(b.alasan, "Alasan"), idempotensi = wajibTeks(b.kunci_idempotensi, "Kunci idempotensi", 120);
  const jenisUuid = wajibTeks(b.jenis_uuid, "Jenis cuti", 255);
  if (b.tanggal_mulai < tanggalWib(sekarang())) throw permintaanSalah("Pengajuan baru tidak boleh dimulai sebelum hari ini");
  if (b.lampiran_uuid !== undefined && (!Array.isArray(b.lampiran_uuid) || b.lampiran_uuid.length > 5 || b.lampiran_uuid.some((x) => typeof x !== "string") || new Set(b.lampiran_uuid).size !== b.lampiran_uuid.length)) throw permintaanSalah("Maksimal lima UUID lampiran yang berbeda");
  kirim(res, await transaksi(async (k) => {
    const h = await milikSaya(req, k);
    await kunciPegawai(h.uuid, f, k);
    const lama = await satu(`SELECT * FROM hr_pengajuan_cuti WHERE faskes_uuid = $1 AND pemohon = $2 AND kunci_idempotensi = $3`, [f, req.author.username, idempotensi], k);
    if (lama) {
      if (lama.deleted_at || lama.jenis_uuid !== jenisUuid || lama.tanggal_mulai !== b.tanggal_mulai || lama.tanggal_selesai !== b.tanggal_selesai || lama.alasan !== alasan) throw new Galat(409, "Kunci idempotensi telah dipakai untuk pengajuan berbeda");
      return lama;
    }
    const jenis = await ambil("hr_jenis_cuti", jenisUuid, f, k, true);
    if (!jenis.aktif) throw permintaanSalah("Jenis cuti tidak aktif");
    const atasan = await satu(`SELECT * FROM hr_atasan_pegawai WHERE faskes_uuid = $1 AND kepegawaian_uuid = $2 AND deleted_at IS NULL`, [f, h.uuid], k);
    if (!atasan) throw new Galat(422, "Atasan langsung belum ditetapkan");
    await pegawai(atasan.atasan_uuid, f, k);
    const potret = {};
    for (const tahun of Object.keys(hari).sort()) potret[tahun] = await kebijakan(f, Number(tahun), k);
    const lampiran = [];
    for (const uuid of b.lampiran_uuid ?? []) {
      const r = await ambil("hr_lampiran_cuti", uuid, f, k, true);
      if (r.pemilik !== req.author.username || r.pengajuan_uuid || Number(r.kedaluwarsa) < sekarang()) throw permintaanSalah("Lampiran tidak tersedia bagi pengajuan ini");
      lampiran.push(r);
    }
    if (jenis.lampiran_wajib && !lampiran.length) throw permintaanSalah("Jenis cuti ini mewajibkan lampiran");
    await cekTumpangTindih(f, h, b.tanggal_mulai, b.tanggal_selesai, k);
    const p = await buat("hr_pengajuan_cuti", req, { kepegawaian_uuid: h.uuid, pemohon: req.author.username, jenis_uuid: jenis.uuid,
      tanggal_mulai: b.tanggal_mulai, tanggal_selesai: b.tanggal_selesai, alasan, hari, potret,
      memotong_saldo: jenis.memotong_saldo, atasan_uuid: atasan.atasan_uuid, status: "menunggu_atasan", kunci_idempotensi: idempotensi }, k);
    if (p.memotong_saldo) await reservasiSaldo(req, h, p, k);
    for (const r of lampiran) await perbarui("hr_lampiran_cuti", req, r, { pengajuan_uuid: p.uuid }, k);
    await audit(req, "hr_pengajuan_cuti", p.uuid, { status: p.status, kepegawaian_uuid: h.uuid, tanggal_mulai: p.tanggal_mulai, tanggal_selesai: p.tanggal_selesai }, k);
    return p;
  }), "Pengajuan menunggu persetujuan atasan");
}));
rute.get("/pengajuan", izin("READ"), tangani(async (req, res) => {
  const f = req.author.faskesUuid, akun = req.author.username;
  const tinjau = await boleh(req, "TINJAU ATASAN"), sahkan = await boleh(req, "SAHKAN SDM");
  const page = bulat(req.query.page ?? 1, "Halaman", 1), limit = 25;
  const syarat = `c.faskes_uuid = $1 AND c.deleted_at IS NULL AND ${aktifSql}
    AND (c.pemohon = $2 OR ($3 AND EXISTS (SELECT 1 FROM hr_akun_pegawai a JOIN hr_kepegawaian ah ON ah.uuid = a.kepegawaian_uuid AND ah.faskes_uuid = a.faskes_uuid
      JOIN pegawai ap ON ap.uuid = ah.pegawai_uuid AND ap.faskes_uuid = ah.faskes_uuid WHERE a.faskes_uuid = c.faskes_uuid AND lower(a.username) = lower($2) AND a.kepegawaian_uuid = c.atasan_uuid AND a.deleted_at IS NULL AND ah.deleted_at IS NULL AND ah.tanggal_selesai IS NULL AND ap.deleted_at IS NULL AND ap.status = true))
      OR ($4 AND EXISTS (SELECT 1 FROM hr_cakupan_unit u WHERE u.faskes_uuid = c.faskes_uuid AND lower(u.username) = lower($2) AND u.unit_uuid = h.unit_uuid AND u.aksi = 'sahkan_sdm' AND u.deleted_at IS NULL)))`;
  const dari = `FROM hr_pengajuan_cuti c JOIN hr_kepegawaian h ON h.uuid = c.kepegawaian_uuid AND h.faskes_uuid = c.faskes_uuid JOIN pegawai p ON p.uuid = h.pegawai_uuid AND p.faskes_uuid = h.faskes_uuid`;
  const total = await satu(`SELECT count(*) AS n ${dari} WHERE ${syarat}`, [f, akun, tinjau, sahkan]);
  const items = await query(`SELECT c.*, p.name AS nama ${dari} WHERE ${syarat} ORDER BY c.created_at DESC, c.uuid DESC LIMIT $5 OFFSET $6`, [f, akun, tinjau, sahkan, limit, (page - 1) * limit]);
  kirim(res, { items, pagination: { page, limit, total: Number(total.n) } });
}));
rute.get("/pengajuan/:uuid", izin("READ"), tangani(async (req, res) => {
  const p = await ambil("hr_pengajuan_cuti", req.params.uuid, req.author.faskesUuid);
  await cekDetail(req, p);
  kirim(res, { ...p, keputusan: await query(`SELECT uuid, tahap, aksi, catatan, dibuat_oleh, created_at FROM hr_pengajuan_cuti_keputusan WHERE faskes_uuid = $1 AND pengajuan_uuid = $2 AND deleted_at IS NULL ORDER BY created_at, uuid`, [req.author.faskesUuid, p.uuid]),
    lampiran: await query(`SELECT uuid, tipe, ukuran FROM hr_lampiran_cuti WHERE faskes_uuid = $1 AND pengajuan_uuid = $2 AND deleted_at IS NULL`, [req.author.faskesUuid, p.uuid]) });
}));
const keputusan = (pembatalan) => tangani(async (req, res) => {
  const b = req.body ?? {}, f = req.author.faskesUuid;
  const awal = await ambil("hr_pengajuan_cuti", req.params.uuid, f);
  const catatan = b.catatan ? wajibTeks(b.catatan, "Catatan") : null;
  kirim(res, await transaksi(async (k) => {
    const h = await kunciPegawai(awal.kepegawaian_uuid, f, k);
    const p = await ambil("hr_pengajuan_cuti", awal.uuid, f, k, true);
    cekVersi(p, b.versi);
    if (p.pemohon === req.author.username) throw new Galat(403, "Pengajuan sendiri tidak boleh diputuskan");
    let status;
    if (pembatalan) {
      if (!await boleh(req, "SAHKAN SDM")) throw new Galat(403, "Izin pengesahan SDM diperlukan");
      await dalamCakupan(req, h, "sahkan_sdm", k);
      if (p.status !== "sah" || !p.pembatalan || !["setujui", "tolak"].includes(b.aksi)) throw new Galat(409, "Pembatalan tidak sedang menunggu peninjauan");
      if (b.aksi === "tolak") wajibTeks(catatan, "Catatan penolakan");
      const keb = p.potret[p.tanggal_mulai.slice(0, 4)].data;
      if (b.aksi === "setujui" && !keb.batal_saat_berjalan && tanggalWib(sekarang()) >= p.tanggal_mulai) throw new Galat(422, "Kebijakan tidak mengizinkan pembatalan setelah cuti berjalan");
      status = b.aksi === "setujui" ? "batal" : "sah";
      if (status === "batal" && p.memotong_saldo) await kembalikanSaldo(req, p, k);
    } else {
      let atasan = false, sdm = false;
      if (p.status === "menunggu_atasan" && await boleh(req, "TINJAU ATASAN")) {
        const diri = await milikSaya(req, k);
        atasan = diri.uuid === p.atasan_uuid;
      }
      if (p.status === "menunggu_sdm" && await boleh(req, "SAHKAN SDM")) { await dalamCakupan(req, h, "sahkan_sdm", k); sdm = true; }
      status = statusKeputusan(p, b.aksi, req.author.username, atasan, sdm, catatan);
      if (status === "sah") {
        await cekTumpangTindih(f, h, p.tanggal_mulai, p.tanggal_selesai, k, p.uuid);
        if (p.memotong_saldo) await sahkanSaldo(req, h, p, k);
      }
      if (["sah", "ditolak"].includes(status)) await lepasReservasi(req, p, k);
    }
    await buat("hr_pengajuan_cuti_keputusan", req, { pengajuan_uuid: p.uuid, tahap: pembatalan ? "pembatalan" : p.status, aksi: b.aksi, catatan }, k);
    const baru = await perbarui("hr_pengajuan_cuti", req, p, { status, versi: p.versi + 1, pembatalan: false }, k);
    await audit(req, "hr_pengajuan_cuti", p.uuid, { sebelum: p.status, sesudah: status, aksi: b.aksi, catatan, pembatalan }, k);
    return baru;
  }), "Keputusan berhasil dicatat");
});
rute.post("/pengajuan/:uuid/keputusan", izin("READ"), keputusan(false));
rute.post("/pengajuan/:uuid/keputusan-pembatalan", izin("SAHKAN SDM"), keputusan(true));
rute.post("/pengajuan/:uuid/pembatalan", izin("BATALKAN"), tangani(async (req, res) => {
  const b = req.body ?? {}, f = req.author.faskesUuid, alasan = wajibTeks(b.alasan, "Alasan pembatalan");
  wajibTeks(b.kunci_idempotensi, "Kunci idempotensi", 120);
  kirim(res, await transaksi(async (k) => {
    const h = await milikSaya(req, k);
    await kunciPegawai(h.uuid, f, k);
    const p = await ambil("hr_pengajuan_cuti", req.params.uuid, f, k, true);
    if (p.kepegawaian_uuid !== h.uuid || p.pemohon !== req.author.username) throw tidakDitemukan();
    if (p.status === "batal" || p.pembatalan) return p;
    cekVersi(p, b.versi);
    const keb = p.potret[p.tanggal_mulai.slice(0, 4)].data;
    if (!["menunggu_atasan", "menunggu_sdm", "sah"].includes(p.status) || (p.status === "sah" ? !keb.batal_setelah_sah : !keb.batal_sebelum_sah) || (!keb.batal_saat_berjalan && tanggalWib(sekarang()) >= p.tanggal_mulai)) throw new Galat(422, "Pembatalan tidak diizinkan oleh kebijakan pengajuan");
    const sah = p.status === "sah";
    const r = await perbarui("hr_pengajuan_cuti", req, p, { status: sah ? "sah" : "batal", pembatalan: sah, versi: p.versi + 1 }, k);
    if (!sah) await lepasReservasi(req, p, k);
    await buat("hr_pengajuan_cuti_keputusan", req, { pengajuan_uuid: p.uuid, tahap: "permintaan_pembatalan", aksi: "batalkan", catatan: alasan }, k);
    await audit(req, "hr_pengajuan_cuti", p.uuid, { alasan, status: r.status, pembatalan: r.pembatalan }, k);
    return r;
  }), "Permintaan pembatalan berhasil dicatat");
}));
rute.get("/saldo", izin("READ"), tangani(async (req, res) => {
  kirim(res, await transaksi(async (k) => {
    const h = req.query.pegawai_uuid ? await pegawai(String(req.query.pegawai_uuid), req.author.faskesUuid, k) : await milikSaya(req, k);
    if (req.query.pegawai_uuid) {
      if (!await boleh(req, "SESUAIKAN SALDO")) throw new Galat(403, "Izin penyesuaian saldo diperlukan");
      await dalamCakupan(req, h, "sesuaikan_saldo", k);
    }
    await kunciPegawai(h.uuid, req.author.faskesUuid, k);
    const tahun = bulat(req.query.tahun ?? tahunKini(), "Tahun", 2000, 2100);
    const s = await pastikanSaldo(req, h, tahun, k);
    return { ...await bacaSaldo(req, s, sekarang(), k), mutasi: await query(`SELECT sumber, jenis, jumlah_hari, kedaluwarsa, created_at FROM hr_saldo_cuti_mutasi WHERE faskes_uuid = $1 AND saldo_uuid = $2 AND deleted_at IS NULL ORDER BY created_at, uuid`, [req.author.faskesUuid, s.uuid], k) };
  }));
}));
rute.post("/saldo/penyesuaian", izin("SESUAIKAN SALDO"), tangani(async (req, res) => {
  const b = req.body ?? {}, alasan = wajibTeks(b.alasan, "Alasan penyesuaian"), id = wajibTeks(b.kunci_idempotensi, "Kunci idempotensi", 120);
  const jumlah = bulat(b.jumlah_hari, "Jumlah hari", -366, 366), tahun = bulat(b.tahun, "Tahun", tahunKini(), 2100);
  kirim(res, await transaksi(async (k) => {
    const h = await kunciPegawai(wajibTeks(b.pegawai_uuid, "Pegawai", 255), req.author.faskesUuid, k);
    await dalamCakupan(req, h, "sesuaikan_saldo", k);
    const s = await pastikanSaldo(req, h, tahun, k);
    const kunci = `penyesuaian:${createHash("sha256").update(JSON.stringify([req.author.username, id])).digest("hex")}`;
    const lama = await satu(`SELECT * FROM hr_saldo_cuti_mutasi WHERE faskes_uuid = $1 AND kunci_idempotensi = $2`, [req.author.faskesUuid, kunci], k);
    if (lama) {
      if (lama.saldo_uuid !== s.uuid || Number(lama.jumlah_hari) !== jumlah || lama.alasan !== alasan) throw new Galat(409, "Kunci idempotensi telah dipakai untuk penyesuaian berbeda");
      return lama;
    }
    const saldo = await bacaSaldo(req, s, sekarang(), k);
    if (saldo.tersedia + jumlah < 0) throw new Galat(422, "Penyesuaian menghasilkan saldo negatif setelah reservasi");
    return mutasi(req, s, { jenis: "penyesuaian", sumber: "hak", jumlah_hari: jumlah, alasan, kunci_idempotensi: kunci }, k);
  }), "Penyesuaian saldo berhasil dicatat");
}));
export default rute;
