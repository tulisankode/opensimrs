import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { MODALITAS, HARI, ramah, daftarNilai, keMenit, dariMenit, hariIni } from "./bersama.js";

// Datamaster Ruang Pemeriksaan & Alat Radiologi: modalitas yang dilayani, merk/tipe alat, jam & hari operasional,
// durasi slot penjadwalan. Ruang nonaktif tidak muncul di papan jadwal; jadwal lama tetap tersimpan.
const rute = express.Router();

export const PILIH_RUANG = `uuid, faskes_uuid, kode, nama, modalitas, nama_alat, lokasi_uuid,
  to_char(jam_buka, 'HH24:MI') AS jam_buka, to_char(jam_tutup, 'HH24:MI') AS jam_tutup,
  hari_operasional, durasi_slot, keterangan, status, created_at, updated_at`;

const KOLOM = (b, baru = false) => {
  const k = {};
  if (b.kode !== undefined) k.kode = String(b.kode ?? "").trim();
  if (b.nama !== undefined) k.nama = String(b.nama ?? "").trim();
  if ((b.kode !== undefined && !k.kode) || (b.nama !== undefined && !k.nama)) throw permintaanSalah("kode dan nama tidak boleh kosong");
  if (b.modalitas !== undefined) {
    const m = [...new Set(Array.isArray(b.modalitas) ? b.modalitas : daftarNilai(b.modalitas))];
    if (!m.length) throw permintaanSalah("Pilih minimal satu modalitas yang dilayani ruang");
    const salah = m.filter((x) => !MODALITAS[x]);
    if (salah.length) throw permintaanSalah(`Modalitas tidak dikenal: ${salah.join(", ")}`);
    k.modalitas = m;
  } else if (baru) throw permintaanSalah("modalitas wajib diisi");
  if (b.jam_buka !== undefined) k.jam_buka = keMenit(b.jam_buka, "jam_buka");
  if (b.jam_tutup !== undefined) k.jam_tutup = keMenit(b.jam_tutup, "jam_tutup");
  if (b.hari_operasional !== undefined) {
    const h = [...new Set((Array.isArray(b.hari_operasional) ? b.hari_operasional : daftarNilai(b.hari_operasional)).map(Number))].sort();
    if (!h.length || h.some((x) => !HARI[x])) throw permintaanSalah("hari_operasional berisi angka 1 (Senin) sampai 7 (Minggu)");
    k.hari_operasional = h;
  }
  if (b.durasi_slot !== undefined) {
    const d = Number(b.durasi_slot);
    if (!Number.isInteger(d) || d < 5 || d > 240) throw permintaanSalah("durasi_slot harus 5–240 menit");
    k.durasi_slot = d;
  }
  const teks = (v) => (v === undefined ? undefined : String(v ?? "").trim() || null);
  k.nama_alat = teks(b.nama_alat);
  k.keterangan = teks(b.keterangan);
  k.lokasi_uuid = b.lokasi_uuid === undefined ? undefined : b.lokasi_uuid || null;
  if (b.status !== undefined) k.status = Boolean(b.status);
  return k;
};

// Jam disimpan sebagai TIME; validasi rentang & ubah ke teks HH:MM.
const siapkanJam = (k, lama = {}) => {
  const buka = k.jam_buka ?? (lama.jam_buka ? keMenit(lama.jam_buka) : 8 * 60);
  const tutup = k.jam_tutup ?? (lama.jam_tutup ? keMenit(lama.jam_tutup) : 16 * 60);
  const durasi = k.durasi_slot ?? lama.durasi_slot ?? 15;
  if (tutup <= buka) throw permintaanSalah("Jam tutup harus setelah jam buka");
  if (buka + durasi > tutup) throw permintaanSalah("Durasi slot lebih panjang dari jam operasional");
  // Array disimpan sebagai literal array PostgreSQL (helper sisipkan/ubah menyimpan objek/array sebagai JSON).
  const arr = (a) => (a === undefined ? undefined : `{${a.join(",")}}`);
  return {
    ...k,
    modalitas: arr(k.modalitas),
    hari_operasional: arr(k.hari_operasional),
    jam_buka: k.jam_buka === undefined ? undefined : dariMenit(k.jam_buka),
    jam_tutup: k.jam_tutup === undefined ? undefined : dariMenit(k.jam_tutup),
  };
};

export const ambilRuang = async (uuid, faskesUuid, k, kunci = false) => {
  const r = await satu(
    `SELECT ${PILIH_RUANG} FROM rad_ruang WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ${kunci ? "FOR UPDATE" : ""}`,
    [uuid, faskesUuid],
    k,
  );
  if (!r) throw tidakDitemukan("Ruang radiologi");
  return r;
};

rute.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL";
    if (req.query.cari) {
      p.push(`%${req.query.cari}%`);
      w += ` AND (kode ILIKE $${p.length} OR nama ILIKE $${p.length} OR nama_alat ILIKE $${p.length})`;
    }
    const modalitas = daftarNilai(req.query.modalitas);
    if (modalitas.length) {
      // Ruang yang melayani SEMUA modalitas yang diminta (untuk memilih ruang item order).
      p.push(modalitas);
      w += ` AND modalitas @> $${p.length}::varchar[]`;
    }
    if (req.query.status !== undefined && req.query.status !== "") {
      p.push(["1", "true", "aktif"].includes(String(req.query.status)));
      w += ` AND status = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM rad_ruang WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${PILIH_RUANG},
              (SELECT COUNT(*)::int FROM rad_jadwal j WHERE j.ruang_uuid = rad_ruang.uuid AND j.deleted_at IS NULL
                  AND j.status IN ('terjadwal', 'hadir') AND j.tanggal >= $${p.length + 1}::date) AS jadwal_aktif
         FROM rad_ruang WHERE ${w} ORDER BY kode LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      [...p, hariIni()],
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/:uuid",
  tangani(async (req, res) => kirim(res, await ambilRuang(req.params.uuid, req.author.faskesUuid))),
);

rute.post(
  "/",
  tangani(async (req, res) => {
    wajib(req.body, ["kode", "nama", "modalitas"]);
    const k = siapkanJam(KOLOM(req.body, true));
    const r = await sisipkan(
      "rad_ruang",
      { faskes_uuid: req.author.faskesUuid, status: true, ...Object.fromEntries(Object.entries(k).filter(([, v]) => v !== undefined)) },
    ).catch((e) => ramah(e, `Kode ruang ${req.body.kode} sudah dipakai`));
    kirim(res, await ambilRuang(r.uuid, req.author.faskesUuid), "Ruang radiologi berhasil ditambahkan");
  }),
);

rute.put(
  "/:uuid",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const lama = await ambilRuang(req.params.uuid, f);
    const k = siapkanJam(KOLOM(req.body), lama);
    // Modalitas yang dihapus tidak boleh masih dipakai jadwal aktif.
    if (k.modalitas) {
      const dipakai = await satu(
        `SELECT string_agg(DISTINCT i.modalitas, ', ') AS m FROM rad_jadwal j JOIN rad_order_item i ON i.jadwal_uuid = j.uuid AND i.deleted_at IS NULL
          WHERE j.ruang_uuid = $1 AND j.faskes_uuid = $2 AND j.deleted_at IS NULL AND j.status IN ('terjadwal', 'hadir')
            AND NOT (i.modalitas = ANY($3::varchar[]))`,
        [lama.uuid, f, k.modalitas],
      );
      if (dipakai?.m) throw new Galat(409, `Modalitas ${dipakai.m} masih dipakai jadwal aktif di ruang ini`);
    }
    await ubah("rad_ruang", lama.uuid, f, k).catch((e) => ramah(e, `Kode ruang ${req.body.kode} sudah dipakai`));
    kirim(res, await ambilRuang(lama.uuid, f), "Ruang radiologi berhasil diperbarui");
  }),
);

rute.delete(
  "/:uuid",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const aktif = await satu(
      `SELECT COUNT(*)::int n FROM rad_jadwal WHERE ruang_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL
          AND status IN ('terjadwal', 'hadir') AND tanggal >= $3::date`,
      [req.params.uuid, f, hariIni()],
    );
    if (aktif.n) throw new Galat(409, `Ruang masih memiliki ${aktif.n} jadwal aktif; pindahkan atau batalkan dahulu`);
    const r = await ubah("rad_ruang", req.params.uuid, f, { deleted_at: sekarang() });
    if (!r) throw tidakDitemukan("Ruang radiologi");
    kirim(res, { uuid: r.uuid }, "Ruang radiologi berhasil dihapus");
  }),
);

export default rute;
