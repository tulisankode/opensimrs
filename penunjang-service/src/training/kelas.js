import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { izinTraining } from "../umum/izin.js";
import { ramah, jumlahSlotValid, hargaValid, siapkanSesi } from "./bersama.js";

// Datamaster kelas Training (Zumba, Yoga, Pilates, edukasi) & sesi (bila is_sesi = true, slot dihitung per sesi).
const rute = express.Router();

const sesiKelas = (kelasUuid, k) =>
  query(`SELECT uuid, nama_sesi, jam_mulai, jam_selesai, urutan FROM training_kelas_sesi WHERE kelas_uuid = $1 AND deleted_at IS NULL ORDER BY urutan, created_at`, [kelasUuid], k);

const ambilKelas = async (uuid, faskesUuid, k) => {
  const kelas = await satu(`SELECT * FROM training_kelas WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ${k ? "FOR UPDATE" : ""}`, [uuid, faskesUuid], k);
  if (!kelas) throw tidakDitemukan("Kelas Training");
  return kelas;
};

const detailKelas = async (uuid, faskesUuid, k) => ({ ...(await ambilKelas(uuid, faskesUuid, k)), sesi: await sesiKelas(uuid, k) });

const simpanSesi = async (kelasUuid, faskesUuid, daftar, k) => {
  await query(`UPDATE training_kelas_sesi SET deleted_at = $1 WHERE kelas_uuid = $2 AND deleted_at IS NULL`, [sekarang(), kelasUuid], k);
  for (const s of daftar) await sisipkan("training_kelas_sesi", { faskes_uuid: faskesUuid, kelas_uuid: kelasUuid, ...s }, k);
};

rute.get(
  "/",
  izinTraining("Datamaster", "READ", "Kelas"),
  tangani(async (req, res) => {
    const q = req.query;
    const pg = halaman(q);
    const p = [req.author.faskesUuid];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL";
    const tambah = (nilai, kondisi) => {
      p.push(nilai);
      w += ` AND ${kondisi.replaceAll("$?", `$${p.length}`)}`;
    };
    if (q.status !== undefined) tambah(["1", "true"].includes(String(q.status)), "status = $?");
    if (q.cari) tambah(`%${q.cari}%`, "(nama ILIKE $? OR kode ILIKE $? OR instruktur ILIKE $?)");
    const total = (await satu(`SELECT COUNT(*) n FROM training_kelas WHERE ${w}`, p)).n;
    const rows = await query(`SELECT * FROM training_kelas WHERE ${w} ORDER BY nama LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/:uuid",
  izinTraining("Datamaster", "READ", "Kelas"),
  tangani(async (req, res) => kirim(res, await detailKelas(req.params.uuid, req.author.faskesUuid))),
);

rute.post(
  "/",
  izinTraining("Datamaster", "CREATE", "Kelas"),
  tangani(async (req, res) => {
    wajib(req.body, ["kode", "nama", "jumlah_slot"]);
    const b = req.body;
    const f = req.author.faskesUuid;
    const isSesi = Boolean(b.is_sesi);
    const sesi = siapkanSesi(isSesi, b.sesi);
    const hasil = await transaksi(async (k) => {
      const kelas = await sisipkan(
        "training_kelas",
        {
          faskes_uuid: f, kode: String(b.kode).trim(), nama: String(b.nama).trim(), jenis: b.jenis ?? null,
          instruktur: b.instruktur ?? null, is_sesi: isSesi, jumlah_slot: jumlahSlotValid(b.jumlah_slot),
          harga: hargaValid(b.harga), status: b.status === undefined ? true : Boolean(b.status),
        },
        k,
      ).catch((e) => ramah(e, "Kode kelas sudah dipakai di faskes ini"));
      await simpanSesi(kelas.uuid, f, sesi, k);
      return detailKelas(kelas.uuid, f, k);
    });
    kirim(res, hasil, `Kelas ${hasil.nama} berhasil disimpan`);
  }),
);

rute.put(
  "/:uuid",
  izinTraining("Datamaster", "UPDATE", "Kelas"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body;
    const hasil = await transaksi(async (k) => {
      const kelas = await ambilKelas(req.params.uuid, f, k);
      const isSesi = b.is_sesi === undefined ? kelas.is_sesi : Boolean(b.is_sesi);
      const baru = await ubah(
        "training_kelas",
        kelas.uuid,
        f,
        {
          kode: b.kode === undefined ? undefined : String(b.kode).trim(),
          nama: b.nama === undefined ? undefined : String(b.nama).trim(),
          jenis: b.jenis,
          instruktur: b.instruktur,
          is_sesi: isSesi,
          jumlah_slot: b.jumlah_slot === undefined ? undefined : jumlahSlotValid(b.jumlah_slot),
          harga: b.harga === undefined ? undefined : hargaValid(b.harga),
          status: b.status === undefined ? undefined : Boolean(b.status),
        },
        k,
      ).catch((e) => ramah(e, "Kode kelas sudah dipakai di faskes ini"));
      if (b.sesi !== undefined || (isSesi && !kelas.is_sesi)) await simpanSesi(kelas.uuid, f, siapkanSesi(isSesi, b.sesi ?? (await sesiKelas(kelas.uuid, k))), k);
      else if (!isSesi && kelas.is_sesi) await simpanSesi(kelas.uuid, f, [], k);
      return detailKelas(baru.uuid, f, k);
    });
    kirim(res, hasil, `Kelas ${hasil.nama} berhasil diperbarui`);
  }),
);

rute.delete(
  "/:uuid",
  izinTraining("Datamaster", "DELETE", "Kelas"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const kelas = await ambilKelas(req.params.uuid, f, k);
      const aktif = await satu(`SELECT COUNT(*)::int n FROM training_order WHERE kelas_uuid = $1 AND status <> 'batal' AND deleted_at IS NULL`, [kelas.uuid], k);
      if (aktif.n > 0) throw new Galat(409, `Kelas masih memiliki ${aktif.n} booking/order aktif, tidak dapat dihapus`);
      await ubah("training_kelas", kelas.uuid, f, { deleted_at: sekarang() }, k);
    });
    kirim(res, { uuid: req.params.uuid }, "Kelas berhasil dihapus");
  }),
);

// POST /impor { baris: [{ kode, nama, jenis?, instruktur?, is_sesi?, jumlah_slot, harga?, status?, sesi? }, ...] }
// Baris dengan kode yang sudah terdaftar di faskes (atau duplikat dalam berkas) ditolak, bukan ditimpa.
rute.post(
  "/impor",
  izinTraining("Datamaster", "IMPORT KELAS", "Kelas"),
  tangani(async (req, res) => {
    const baris = Array.isArray(req.body?.baris) ? req.body.baris : [];
    if (!baris.length) throw permintaanSalah("Tidak ada baris untuk diimpor");
    const f = req.author.faskesUuid;
    const ada = new Set((await query(`SELECT kode FROM training_kelas WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [f])).map((r) => r.kode));
    const berhasil = [];
    const gagal = [];
    for (const [i, b] of baris.entries()) {
      const kode = String(b?.kode ?? "").trim();
      try {
        if (!kode) throw new Error("kode wajib diisi");
        if (!String(b?.nama ?? "").trim()) throw new Error("nama wajib diisi");
        if (ada.has(kode)) throw new Error(`Kode ${kode} sudah terdaftar`);
        const isSesi = Boolean(b.is_sesi);
        const sesi = siapkanSesi(isSesi, b.sesi);
        const kelas = await transaksi(async (k) => {
          const row = await sisipkan(
            "training_kelas",
            {
              faskes_uuid: f, kode, nama: String(b.nama).trim(), jenis: b.jenis ?? null, instruktur: b.instruktur ?? null,
              is_sesi: isSesi, jumlah_slot: jumlahSlotValid(b.jumlah_slot), harga: hargaValid(b.harga),
              status: b.status === undefined ? true : Boolean(b.status),
            },
            k,
          );
          await simpanSesi(row.uuid, f, sesi, k);
          return row;
        });
        ada.add(kode);
        berhasil.push({ baris: i + 1, kode, uuid: kelas.uuid });
      } catch (e) {
        gagal.push({ baris: i + 1, kode: kode || null, alasan: e.message });
      }
    }
    kirim(res, { total: baris.length, berhasil: berhasil.length, gagal: gagal.length, rincian_gagal: gagal }, `${berhasil.length} dari ${baris.length} kelas berhasil diimpor`);
  }),
);

export default rute;
