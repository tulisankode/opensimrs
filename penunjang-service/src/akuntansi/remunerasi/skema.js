import express from "express";
import { query, satu, sisipkan, sekarang, transaksi, ubah } from "../../db.js";
import { kirim, permintaanSalah, tidakDitemukan } from "../../umum/respons.js";
import { wajibIzin } from "../../umum/izin.js";
import { konflik, periodeWajib, rentangPeriode, teks, teksWajib } from "../bersama.js";
import { tanganiAkuntansi } from "../dasar.js";
import { MODUL_IZIN, PERINGATAN_CONTOH, PROFESI, SKEMA_CONTOH, SUB, validasiIndeks, validasiKonfigurasi } from "./bersama.js";
import { audit, daftarPraktisi, izinSalahSatu, muatPenerima, praktisi } from "./dasar.js";

// Konfigurasi Remunerasi (KF-1/KF-2/KF-6): skema jaspel berversi & penerima (dokter/nakes) beserta indeksnya.
//   GET  /skema                     semua versi skema faskes
//   POST /skema                     { nama, tahun, bulan (berlaku mulai), konfigurasi?, contoh?, catatan? } → versi baru (draf)
//                                   konfigurasi kosong + contoh=true → diisi nilai CONTOH (wajib ditinjau sebelum disahkan)
//   PUT  /skema/:uuid               ubah skema DRAF (skema disahkan tidak dapat diubah; buat versi baru)
//   POST /skema/:uuid/sahkan        { dasar_pengesahan, konfirmasi_contoh? } izin SAHKAN; skema berasal dari contoh wajib
//                                   konfirmasi eksplisit bahwa nilainya sudah ditetapkan bagian keuangan
//   GET  /penerima, POST /penerima, PUT /penerima/:uuid   penerima & indeks
//   GET  /praktisi                  daftar praktisi faskes untuk dipilih
// Periode memakai skema DISAHKAN dengan berlaku_mulai ≤ awal periode (versi terbaru) — versi tercatat di periode
// sehingga perubahan berikutnya tidak mengubah hasil periode lama.
const rute = express.Router();
const izin = (aksi) => wajibIzin(MODUL_IZIN, SUB.konfigurasi, aksi);
const BACA_SKEMA = [
  [SUB.konfigurasi, "READ"],
  [SUB.periode, "READ"],
  [SUB.verifikasi, "READ"],
  [SUB.persetujuan, "READ"],
];

const isiSkema = (b, lama = null) => {
  const nama = teksWajib(b.nama ?? lama?.nama, "nama", 255);
  let berlaku = lama?.berlaku_mulai;
  if (b.tahun !== undefined || b.bulan !== undefined || !lama) {
    const { tahun, bulan } = periodeWajib(b);
    berlaku = rentangPeriode(tahun, bulan).awal;
  }
  const contoh = lama ? lama.contoh : b.contoh === true;
  const sumberKonfigurasi = b.konfigurasi ?? (lama ? lama.konfigurasi : contoh ? SKEMA_CONTOH : null);
  if (!sumberKonfigurasi) throw permintaanSalah("konfigurasi wajib diisi (atau pilih mulai dari nilai contoh)");
  return {
    nama,
    berlaku_mulai: berlaku,
    contoh,
    konfigurasi: validasiKonfigurasi(sumberKonfigurasi),
    catatan: b.catatan !== undefined ? (teks(b.catatan, "catatan", 2000) ?? null) : (lama?.catatan ?? null),
  };
};

rute.get(
  "/skema",
  izinSalahSatu(...BACA_SKEMA),
  tanganiAkuntansi(async (req, res) => {
    const rows = await query(`SELECT * FROM remunerasi_skema WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY versi DESC`, [req.author.faskesUuid]);
    kirim(res, rows.map((r) => ({ ...r, peringatan: r.contoh ? PERINGATAN_CONTOH : null })));
  }),
);

rute.post(
  "/skema",
  izin("CREATE"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const data = isiSkema(req.body ?? {});
    const baru = await transaksi(async (k) => {
      await k.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`remunerasi-skema:${f}`]);
      const versi = (await satu(`SELECT COALESCE(MAX(versi), 0) + 1 AS v FROM remunerasi_skema WHERE faskes_uuid = $1`, [f], k)).v;
      const row = await sisipkan("remunerasi_skema", { faskes_uuid: f, versi, status: "draf", ...data, dibuat_oleh: req.author.username ?? null }, k);
      await audit(k, req, "buat", "remunerasi_skema", row.uuid, { versi, nama: row.nama, berlaku_mulai: row.berlaku_mulai, contoh: row.contoh, konfigurasi: row.konfigurasi });
      return row;
    });
    kirim(res, baru, `Skema versi ${baru.versi} dibuat (draf)`);
  }),
);

rute.put(
  "/skema/:uuid",
  izin("UPDATE"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const lama = await satu(`SELECT * FROM remunerasi_skema WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, f], k);
      if (!lama) throw tidakDitemukan("Skema");
      if (lama.status !== "draf") throw konflik("Skema yang sudah disahkan tidak dapat diubah; buat versi baru");
      const data = isiSkema(req.body ?? {}, lama);
      const baru = await ubah("remunerasi_skema", lama.uuid, f, data, k);
      await audit(k, req, "ubah", "remunerasi_skema", lama.uuid, { versi: lama.versi, sebelum: { nama: lama.nama, berlaku_mulai: lama.berlaku_mulai, konfigurasi: lama.konfigurasi }, sesudah: { nama: baru.nama, berlaku_mulai: baru.berlaku_mulai, konfigurasi: baru.konfigurasi } });
      return baru;
    });
    kirim(res, hasil, "Skema diubah");
  }),
);

rute.post(
  "/skema/:uuid/sahkan",
  izin("SAHKAN"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const dasar = teksWajib(req.body?.dasar_pengesahan, "dasar_pengesahan (mis. nomor & tanggal SK direksi)", 1000);
    const hasil = await transaksi(async (k) => {
      const s = await satu(`SELECT * FROM remunerasi_skema WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, f], k);
      if (!s) throw tidakDitemukan("Skema");
      if (s.status !== "draf") throw konflik("Skema sudah disahkan");
      if (s.contoh && req.body?.konfirmasi_contoh !== true)
        throw konflik("Skema ini berasal dari nilai CONTOH. Pastikan porsi, indeks, dan bobot sudah ditetapkan bagian keuangan/direksi, lalu sahkan dengan konfirmasi_contoh = true.");
      validasiKonfigurasi(s.konfigurasi);
      const baru = await satu(
        `UPDATE remunerasi_skema SET status = 'disahkan', dasar_pengesahan = $3, disahkan_oleh = $4, disahkan_pada = $5, updated_at = $5
          WHERE uuid = $1 AND faskes_uuid = $2 RETURNING *`,
        [s.uuid, f, dasar, req.author.username ?? null, sekarang()],
        k,
      );
      await audit(k, req, "ubah", "remunerasi_skema", s.uuid, { versi: s.versi, status: ["draf", "disahkan"], dasar_pengesahan: dasar, contoh: s.contoh });
      return baru;
    });
    kirim(res, hasil, `Skema versi ${hasil.versi} disahkan`);
  }),
);

// ── Penerima
const isiPenerima = (b, lama = null) => {
  const profesi = String(b.profesi ?? lama?.profesi ?? "");
  if (!PROFESI[profesi]) throw permintaanSalah(`profesi harus salah satu dari ${Object.keys(PROFESI).join(", ")}`);
  return {
    profesi,
    unit: b.unit !== undefined ? (teks(b.unit, "unit", 255) ?? null) : (lama?.unit ?? null),
    indeks: validasiIndeks(b.indeks ?? lama?.indeks ?? {}),
    ikut_kebersamaan: b.ikut_kebersamaan !== undefined ? b.ikut_kebersamaan !== false : (lama?.ikut_kebersamaan ?? true),
    aktif: b.aktif !== undefined ? b.aktif !== false : (lama?.aktif ?? true),
    catatan: b.catatan !== undefined ? (teks(b.catatan, "catatan", 1000) ?? null) : (lama?.catatan ?? null),
  };
};

rute.get(
  "/penerima",
  izinSalahSatu(...BACA_SKEMA),
  tanganiAkuntansi(async (req, res) => kirim(res, await muatPenerima(undefined, req.author.faskesUuid))),
);

rute.get(
  "/praktisi",
  izinSalahSatu([SUB.konfigurasi, "READ"], [SUB.periode, "KOREKSI"], [SUB.periode, "UPDATE"]),
  tanganiAkuntansi(async (req, res) => kirim(res, await daftarPraktisi(req.author.faskesUuid))),
);

rute.post(
  "/penerima",
  izin("CREATE"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const data = isiPenerima(b);
    const baru = await transaksi(async (k) => {
      const pr = await praktisi(k, f, teksWajib(b.practitioner_uuid, "practitioner_uuid", 255));
      if (!pr) throw permintaanSalah("Praktisi tidak ditemukan di faskes ini");
      const row = await sisipkan("remunerasi_penerima", { faskes_uuid: f, practitioner_uuid: pr.uuid, ...data, dibuat_oleh: req.author.username ?? null }, k);
      await audit(k, req, "buat", "remunerasi_penerima", row.uuid, { praktisi: pr.nama, ...data });
      return { ...row, nama: pr.nama };
    }).catch((e) => {
      throw e?.code === "23505" ? konflik("Praktisi ini sudah terdaftar sebagai penerima") : e;
    });
    kirim(res, baru, "Penerima ditambahkan");
  }),
);

rute.put(
  "/penerima/:uuid",
  izin("UPDATE"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const lama = await satu(`SELECT * FROM remunerasi_penerima WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [req.params.uuid, f], k);
      if (!lama) throw tidakDitemukan("Penerima");
      const data = isiPenerima(req.body ?? {}, lama);
      const baru = await ubah("remunerasi_penerima", lama.uuid, f, data, k);
      const berubah = Object.keys(data).filter((c) => JSON.stringify(data[c]) !== JSON.stringify(lama[c]));
      await audit(k, req, "ubah", "remunerasi_penerima", lama.uuid, { berubah, sebelum: Object.fromEntries(berubah.map((c) => [c, lama[c]])), sesudah: Object.fromEntries(berubah.map((c) => [c, data[c]])) });
      return baru;
    });
    kirim(res, hasil, "Penerima diubah");
  }),
);

export default rute;
