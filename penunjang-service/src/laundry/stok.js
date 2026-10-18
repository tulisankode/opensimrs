import express from "express";
import { query, satu, sisipkan, sekarang, transaksi } from "../db.js";
import { tangani, kirim, wajib, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { izinLaundry } from "../umum/izin.js";
import { angkaOpsional, cekPilihan, JENIS_KOREKSI, LOKASI_TIPE, bulatPositif, periode, teks } from "./bersama.js";
import { unitTerlacak } from "./unit-alur.js";

// Stok linen: saldo dibentuk dari buku transaksi laundry_transaksi_stok (bukan kolom yang diubah langsung), per
// lokasi (ruangan, atau "laundry" = stok bersih pusat laundry dengan lokasi_uuid NULL) dan jenis linen. Par level
// (acuan pemantauan/permintaan distribusi) disimpan terpisah di laundry_stok_lokasi, khusus ruangan.
// Jenis per unit (STD-0030) memakai buku yang sama; saldo ditampilkan bersama rinciannya: unit_terlacak (unit aktif
// berlabel di lokasi itu) dan saldo_tanpa_unit (stok lama yang belum diregistrasi) — tidak dijumlahkan ganda (KT-23).

export const kunciStok = (faskesUuid, lokasiTipe, lokasiUuid, jenisLinenUuid) =>
  `laundry_stok:${faskesUuid}:${lokasiTipe}:${lokasiTipe === "laundry" ? "-" : lokasiUuid ?? "-"}:${jenisLinenUuid}`;

// Saldo berjalan (masuk − keluar) untuk satu kombinasi lokasi/jenis linen.
export const saldoLinen = async (faskesUuid, lokasiTipe, lokasiUuid, jenisLinenUuid, k) => {
  const r = await satu(
    `SELECT COALESCE(SUM(CASE WHEN arah = 'masuk' THEN jumlah ELSE -jumlah END), 0)::numeric AS saldo
       FROM laundry_transaksi_stok
      WHERE faskes_uuid = $1 AND lokasi_tipe = $2 AND jenis_linen_uuid = $3 AND deleted_at IS NULL
        AND lokasi_uuid IS NOT DISTINCT FROM $4`,
    [faskesUuid, lokasiTipe, jenisLinenUuid, lokasiTipe === "laundry" ? null : lokasiUuid ?? null],
    k,
  );
  return Number(r?.saldo ?? 0);
};

// Mencatat satu baris buku transaksi stok (jejak audit: pelaku, waktu, sumber); dipanggil di dalam transaksi pemanggil.
export const catatTransaksiStok = (k, data) =>
  sisipkan(
    "laundry_transaksi_stok",
    {
      faskes_uuid: data.faskesUuid,
      lokasi_tipe: data.lokasiTipe,
      lokasi_uuid: data.lokasiTipe === "laundry" ? null : data.lokasiUuid ?? null,
      jenis_linen_uuid: data.jenisLinenUuid,
      sumber_tipe: data.sumberTipe,
      sumber_uuid: data.sumberUuid ?? null,
      arah: data.arah,
      jumlah: data.jumlah,
      alasan: teks(data.alasan) ?? null,
      petugas_uuid: teks(data.petugasUuid) ?? null,
      waktu_transaksi: data.waktuTransaksi ?? sekarang(),
    },
    k,
  );

const kunci = (k, teksKunci) => query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [teksKunci], k);

// Pengeluaran stok aman-serentak: kunci advisory per (faskes, lokasi, jenis) sampai transaksi selesai, baca saldo
// (sudah memuat transaksi lain yang lebih dulu commit), tolak bila tidak cukup, lalu catat KELUAR.
export const keluarkanStok = async (k, data, namaLinen = "Linen") => {
  if (!k) throw new Error("keluarkanStok wajib dipanggil di dalam transaksi");
  await kunci(k, kunciStok(data.faskesUuid, data.lokasiTipe, data.lokasiUuid, data.jenisLinenUuid));
  const saldo = await saldoLinen(data.faskesUuid, data.lokasiTipe, data.lokasiUuid, data.jenisLinenUuid, k);
  if (saldo < data.jumlah) {
    const tempat = data.lokasiTipe === "laundry" ? "stok bersih laundry" : `stok ruangan ${data.namaLokasi ?? ""}`.trim();
    throw permintaanSalah(`Saldo ${namaLinen} di ${tempat} tidak mencukupi (tersedia ${saldo}, diminta ${data.jumlah})`);
  }
  return catatTransaksiStok(k, { ...data, arah: "keluar" });
};

export const validasiJenis = async (uuid, faskes, k, { aktif = false } = {}) => {
  const j = await satu(`SELECT uuid, kode, nama, aktif, cara_pencatatan FROM laundry_jenis_linen WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [String(uuid ?? ""), faskes], k);
  if (!j) throw permintaanSalah("Jenis linen tidak ditemukan pada faskes ini");
  if (aktif && !j.aktif) throw permintaanSalah(`Jenis linen ${j.nama} nonaktif`);
  return j;
};

export const validasiRuangan = async (uuid, faskes, k, nama = "Ruangan") => {
  const l = await satu(`SELECT uuid, name AS nama FROM lokasi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [String(uuid ?? ""), faskes], k);
  if (!l) throw permintaanSalah(`${nama} tidak ditemukan pada faskes ini`);
  return l;
};

export const rute = express.Router();

// Banyaknya unit aktif per lokasi/jenis yang ikut saldo buku (lihat unit-alur.js) → kunci "lokasi|jenis".
const unitPerLokasi = async (faskes, lokasiTipe) => {
  const rows = await query(
    lokasiTipe === "laundry"
      ? `SELECT NULL AS lokasi_uuid, jenis_linen_uuid, count(*)::int AS n FROM laundry_unit
          WHERE faskes_uuid = $1 AND status = 'aktif' AND lokasi_tipe = 'laundry' AND deleted_at IS NULL GROUP BY jenis_linen_uuid`
      : `SELECT lokasi_uuid, jenis_linen_uuid, count(*)::int AS n FROM laundry_unit
          WHERE faskes_uuid = $1 AND status = 'aktif' AND lokasi_tipe IN ('ruangan','serah_kotor') AND deleted_at IS NULL GROUP BY lokasi_uuid, jenis_linen_uuid`,
    [faskes],
  );
  return new Map(rows.map((r) => [`${r.lokasi_uuid ?? "-"}|${r.jenis_linen_uuid}`, r.n]));
};
const rincianUnit = (r, peta, lokasiUuid) => {
  if (r.cara_pencatatan !== "per_unit") return { cara_pencatatan: r.cara_pencatatan ?? "per_jumlah", unit_terlacak: null, saldo_tanpa_unit: null };
  const n = peta.get(`${lokasiUuid ?? "-"}|${r.jenis_linen_uuid}`) ?? 0;
  return { cara_pencatatan: "per_unit", unit_terlacak: n, saldo_tanpa_unit: Number(r.saldo) - n };
};

// Saldo & par level per ruangan (lokasi_tipe=ruangan, bawaan) atau saldo bersih laundry (lokasi_tipe=laundry).
// Pasangan ruangan/jenis tampil bila par level dikonfigurasi ATAU sudah punya transaksi.
rute.get(
  "/stok",
  izinLaundry("Stok & Par Level", "READ"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const lokasiTipe = cekPilihan(req.query.lokasi_tipe || "ruangan", LOKASI_TIPE, "lokasi_tipe");

    if (lokasiTipe === "laundry") {
      const rows = await query(
        `SELECT jl.uuid AS jenis_linen_uuid, jl.kode, jl.nama, jl.satuan, jl.aktif, jl.cara_pencatatan,
                COALESCE(SUM(CASE WHEN t.arah = 'masuk' THEN t.jumlah WHEN t.arah = 'keluar' THEN -t.jumlah END), 0)::numeric AS saldo
           FROM laundry_jenis_linen jl
           LEFT JOIN laundry_transaksi_stok t ON t.jenis_linen_uuid = jl.uuid AND t.faskes_uuid = jl.faskes_uuid
                AND t.lokasi_tipe = 'laundry' AND t.deleted_at IS NULL
          WHERE jl.faskes_uuid = $1 AND jl.deleted_at IS NULL
          GROUP BY jl.uuid ORDER BY jl.nama`,
        [faskes],
      );
      // Linen kotor yang sudah diterima tetapi belum masuk batch, dan linen di batch yang belum selesai.
      const antrean = await query(
        `SELECT d.jenis_linen_uuid,
                SUM(COALESCE(d.jumlah_diterima, 0) - COALESCE((SELECT SUM(a.jumlah_diproses) FROM laundry_batch_asal a
                     WHERE a.rincian_penerimaan_uuid = d.uuid AND a.faskes_uuid = d.faskes_uuid AND a.deleted_at IS NULL), 0))::numeric AS jumlah
           FROM laundry_penerimaan_rincian d JOIN laundry_penerimaan p ON p.uuid = d.penerimaan_uuid AND p.faskes_uuid = d.faskes_uuid
          WHERE d.faskes_uuid = $1 AND p.status = 'selesai' AND d.deleted_at IS NULL AND p.deleted_at IS NULL
          GROUP BY d.jenis_linen_uuid`,
        [faskes],
      );
      const proses = await query(
        `SELECT d.jenis_linen_uuid, SUM(a.jumlah_diproses)::numeric AS jumlah FROM laundry_batch_asal a
           JOIN laundry_batch b ON b.uuid = a.batch_uuid AND b.faskes_uuid = a.faskes_uuid
           JOIN laundry_penerimaan_rincian d ON d.uuid = a.rincian_penerimaan_uuid AND d.faskes_uuid = a.faskes_uuid
          WHERE a.faskes_uuid = $1 AND b.status = 'proses' AND a.deleted_at IS NULL AND b.deleted_at IS NULL GROUP BY d.jenis_linen_uuid`,
        [faskes],
      );
      const unitBersih = await unitPerLokasi(faskes, "laundry");
      return kirim(
        res,
        rows.map((r) => ({
          ...r,
          ...rincianUnit(r, unitBersih, null),
          lokasi_tipe: "laundry",
          lokasi_uuid: null,
          saldo: Number(r.saldo),
          kotor_menunggu: Number(antrean.find((a) => a.jenis_linen_uuid === r.jenis_linen_uuid)?.jumlah ?? 0),
          dalam_proses: Number(proses.find((p) => p.jenis_linen_uuid === r.jenis_linen_uuid)?.jumlah ?? 0),
        })),
      );
    }

    const p = [faskes];
    let w = "";
    if (req.query.lokasi_uuid) {
      p.push(String(req.query.lokasi_uuid));
      w += ` AND x.lokasi_uuid = $${p.length}`;
    }
    if (req.query.jenis_linen_uuid) {
      p.push(String(req.query.jenis_linen_uuid));
      w += ` AND x.jenis_linen_uuid = $${p.length}`;
    }
    const rows = await query(
      `WITH pasangan AS (
         SELECT lokasi_uuid, jenis_linen_uuid FROM laundry_stok_lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL
         UNION
         SELECT lokasi_uuid, jenis_linen_uuid FROM laundry_transaksi_stok WHERE faskes_uuid = $1 AND lokasi_tipe = 'ruangan' AND deleted_at IS NULL
       ), saldo AS (
         SELECT lokasi_uuid, jenis_linen_uuid, SUM(CASE WHEN arah = 'masuk' THEN jumlah ELSE -jumlah END) AS saldo,
                bool_or(sumber_tipe = 'saldo_awal') AS ada_saldo_awal
           FROM laundry_transaksi_stok WHERE faskes_uuid = $1 AND lokasi_tipe = 'ruangan' AND deleted_at IS NULL
          GROUP BY lokasi_uuid, jenis_linen_uuid
       )
       SELECT x.lokasi_uuid, l.name AS nama_lokasi, x.jenis_linen_uuid, jl.kode, jl.nama, jl.satuan, jl.cara_pencatatan,
              COALESCE(sl.par_level, 0)::numeric AS par_level, COALESCE(s.saldo, 0)::numeric AS saldo, COALESCE(s.ada_saldo_awal, false) AS ada_saldo_awal
         FROM pasangan x
         JOIN laundry_jenis_linen jl ON jl.uuid = x.jenis_linen_uuid AND jl.faskes_uuid = $1
         LEFT JOIN lokasi l ON l.uuid = x.lokasi_uuid AND l.faskes_uuid = $1
         LEFT JOIN saldo s ON s.lokasi_uuid = x.lokasi_uuid AND s.jenis_linen_uuid = x.jenis_linen_uuid
         LEFT JOIN laundry_stok_lokasi sl ON sl.faskes_uuid = $1 AND sl.lokasi_uuid = x.lokasi_uuid AND sl.jenis_linen_uuid = x.jenis_linen_uuid AND sl.deleted_at IS NULL
        WHERE true ${w}
        ORDER BY l.name, jl.nama`,
      p,
    );
    const unitRuangan = await unitPerLokasi(faskes, "ruangan");
    let hasil = rows.map((r) => {
      const saldo = Number(r.saldo);
      const par = Number(r.par_level);
      return { ...r, ...rincianUnit(r, unitRuangan, r.lokasi_uuid), lokasi_tipe: "ruangan", saldo, par_level: par, selisih_par: saldo - par };
    });
    if (req.query.di_bawah_par === "1" || req.query.di_bawah_par === "true") hasil = hasil.filter((r) => r.selisih_par < 0);
    kirim(res, hasil);
  }),
);

// Saldo awal = transaksi pembukaan, hanya sekali per lokasi/jenis (indeks unik laundry_saldo_awal_unik); perubahan
// saldo sesudahnya lewat transaksi siklus atau koreksi stok, bukan menyuntik saldo awal lagi.
const catatSaldoAwal = async (k, { faskes, lokasiTipe, lokasiUuid, jenisLinenUuid, saldoAwal, petugas }) => {
  if (saldoAwal === undefined || saldoAwal === null) return null;
  if (!Number.isInteger(saldoAwal) || saldoAwal < 0) throw permintaanSalah("saldo_awal harus berupa bilangan bulat tidak negatif");
  if (saldoAwal === 0) return null;
  await kunci(k, kunciStok(faskes, lokasiTipe, lokasiUuid, jenisLinenUuid));
  const ada = await satu(
    `SELECT uuid FROM laundry_transaksi_stok WHERE faskes_uuid = $1 AND lokasi_tipe = $2 AND lokasi_uuid IS NOT DISTINCT FROM $3
        AND jenis_linen_uuid = $4 AND sumber_tipe = 'saldo_awal' AND deleted_at IS NULL`,
    [faskes, lokasiTipe, lokasiTipe === "laundry" ? null : lokasiUuid, jenisLinenUuid],
    k,
  );
  if (ada) throw permintaanSalah("Saldo awal sudah pernah dicatat; gunakan transaksi siklus atau koreksi stok untuk perubahan berikutnya");
  return catatTransaksiStok(k, { faskesUuid: faskes, lokasiTipe, lokasiUuid, jenisLinenUuid, sumberTipe: "saldo_awal", arah: "masuk", jumlah: saldoAwal, alasan: "Saldo awal", petugasUuid: petugas });
};

// Par level & saldo awal per ruangan/jenis linen.
rute.put(
  "/stok/:lokasiUuid/:jenisLinenUuid",
  izinLaundry("Stok & Par Level", "UPDATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const { lokasiUuid, jenisLinenUuid } = req.params;
    const b = req.body ?? {};
    const parLevel = angkaOpsional(b.par_level, "par_level");
    if (parLevel !== undefined && parLevel !== null && (!Number.isInteger(parLevel) || parLevel < 0)) throw permintaanSalah("par_level harus berupa bilangan bulat tidak negatif");
    const saldoAwal = angkaOpsional(b.saldo_awal, "saldo_awal");

    const hasil = await transaksi(async (k) => {
      await validasiRuangan(lokasiUuid, faskes, k);
      await validasiJenis(jenisLinenUuid, faskes, k);
      await kunci(k, `laundry_par:${faskes}:${lokasiUuid}:${jenisLinenUuid}`);
      let baris = await satu(
        `SELECT * FROM laundry_stok_lokasi WHERE faskes_uuid = $1 AND lokasi_uuid = $2 AND jenis_linen_uuid = $3 AND deleted_at IS NULL`,
        [faskes, lokasiUuid, jenisLinenUuid],
        k,
      );
      if (!baris) {
        baris = await sisipkan("laundry_stok_lokasi", { faskes_uuid: faskes, lokasi_uuid: lokasiUuid, jenis_linen_uuid: jenisLinenUuid, par_level: parLevel ?? 0 }, k);
      } else if (parLevel !== undefined && parLevel !== null) {
        baris = await satu(`UPDATE laundry_stok_lokasi SET par_level = $1, updated_at = $2 WHERE uuid = $3 RETURNING *`, [parLevel, sekarang(), baris.uuid], k);
      }
      const pembukaan = await catatSaldoAwal(k, { faskes, lokasiTipe: "ruangan", lokasiUuid, jenisLinenUuid, saldoAwal, petugas: req.author.username });
      const saldo = await saldoLinen(faskes, "ruangan", lokasiUuid, jenisLinenUuid, k);
      return { stok: { ...baris, par_level: Number(baris.par_level), saldo, selisih_par: saldo - Number(baris.par_level) }, transaksi_pembukaan: pembukaan };
    });
    kirim(res, hasil, "Stok & par level berhasil disimpan");
  }),
);

// Saldo awal stok bersih di pusat laundry (linen bersih yang sudah ada saat modul mulai dipakai).
rute.put(
  "/stok-laundry/:jenisLinenUuid",
  izinLaundry("Stok & Par Level", "UPDATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    wajib(req.body, ["saldo_awal"]);
    const saldoAwal = angkaOpsional(req.body.saldo_awal, "saldo_awal");
    const hasil = await transaksi(async (k) => {
      const j = await validasiJenis(req.params.jenisLinenUuid, faskes, k);
      const pembukaan = await catatSaldoAwal(k, { faskes, lokasiTipe: "laundry", lokasiUuid: null, jenisLinenUuid: j.uuid, saldoAwal, petugas: req.author.username });
      return { saldo: await saldoLinen(faskes, "laundry", null, j.uuid, k), transaksi_pembukaan: pembukaan };
    });
    kirim(res, hasil, "Saldo awal stok bersih laundry berhasil dicatat");
  }),
);

// Riwayat transaksi satu lokasi/jenis (penelusuran saldo).
rute.get(
  "/stok/riwayat",
  izinLaundry("Stok & Par Level", "READ"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const lokasiTipe = cekPilihan(req.query.lokasi_tipe || "ruangan", LOKASI_TIPE, "lokasi_tipe");
    if (!req.query.jenis_linen_uuid) throw permintaanSalah("jenis_linen_uuid wajib diisi");
    if (lokasiTipe === "ruangan" && !req.query.lokasi_uuid) throw permintaanSalah("lokasi_uuid wajib diisi");
    kirim(
      res,
      await query(
        `SELECT uuid, waktu_transaksi, sumber_tipe, sumber_uuid, arah, jumlah, alasan, petugas_uuid FROM laundry_transaksi_stok
          WHERE faskes_uuid = $1 AND lokasi_tipe = $2 AND lokasi_uuid IS NOT DISTINCT FROM $3 AND jenis_linen_uuid = $4 AND deleted_at IS NULL
          ORDER BY waktu_transaksi DESC, created_at DESC LIMIT 500`,
        [faskes, lokasiTipe, lokasiTipe === "laundry" ? null : String(req.query.lokasi_uuid), String(req.query.jenis_linen_uuid)],
      ),
    );
  }),
);

// ── Koreksi kehilangan/kerusakan/afkir (KF-12): transaksi KELUAR dengan alasan, pelaku, dan relasi batch opsional;
// jejak transaksi asal tidak dihapus.
rute.get(
  "/koreksi-stok",
  izinLaundry("Koreksi Stok", "READ"),
  tangani(async (req, res) => {
    const { dari, sampai } = periode(req.query);
    const p = [req.author.faskesUuid];
    let w = `t.faskes_uuid = $1 AND t.sumber_tipe IN ('hilang','rusak','afkir') AND t.deleted_at IS NULL`;
    if (dari) {
      p.push(dari);
      w += ` AND t.waktu_transaksi >= $${p.length}`;
    }
    if (sampai) {
      p.push(sampai);
      w += ` AND t.waktu_transaksi <= $${p.length}`;
    }
    kirim(
      res,
      await query(
        `SELECT t.uuid, t.waktu_transaksi, t.lokasi_tipe, t.lokasi_uuid, l.name AS nama_lokasi, t.jenis_linen_uuid, j.nama AS nama_linen,
                t.sumber_tipe AS jenis_koreksi, t.sumber_uuid AS batch_uuid, b.kode AS kode_batch, t.jumlah, t.alasan, t.petugas_uuid
           FROM laundry_transaksi_stok t
           JOIN laundry_jenis_linen j ON j.uuid = t.jenis_linen_uuid AND j.faskes_uuid = t.faskes_uuid
           LEFT JOIN lokasi l ON l.uuid = t.lokasi_uuid AND l.faskes_uuid = t.faskes_uuid
           LEFT JOIN laundry_batch b ON b.uuid = t.sumber_uuid AND b.faskes_uuid = t.faskes_uuid
          WHERE ${w} ORDER BY t.waktu_transaksi DESC LIMIT 500`,
        p,
      ),
    );
  }),
);

rute.post(
  "/koreksi-stok",
  izinLaundry("Koreksi Stok", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["lokasi_tipe", "jenis_linen_uuid", "jenis_koreksi", "jumlah", "alasan"]);
    const f = req.author.faskesUuid;
    const lokasiTipe = cekPilihan(b.lokasi_tipe, LOKASI_TIPE, "lokasi_tipe");
    const jenisKoreksi = cekPilihan(b.jenis_koreksi, JENIS_KOREKSI, "jenis_koreksi");
    const jumlah = bulatPositif(b.jumlah, "jumlah");
    const alasan = teks(b.alasan);
    if (!alasan) throw permintaanSalah("alasan wajib diisi");
    const row = await transaksi(async (k) => {
      const j = await validasiJenis(b.jenis_linen_uuid, f, k);
      const ruang = lokasiTipe === "ruangan" ? await validasiRuangan(b.lokasi_uuid, f, k) : null;
      let batchUuid = null;
      if (b.batch_uuid) {
        const bt = await satu(`SELECT uuid FROM laundry_batch WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [String(b.batch_uuid), f], k);
        if (!bt) throw tidakDitemukan("Batch");
        batchUuid = bt.uuid;
      }
      // Jenis per unit: koreksi jumlah hanya untuk saldo yang belum berlabel; unit berlabel dikoreksi lewat status unit
      // agar buku stok dan posisi unit tetap cocok. Saldo dibaca sebelum unit, di bawah kunci stok yang sama.
      if (j.cara_pencatatan === "per_unit") {
        await kunci(k, kunciStok(f, lokasiTipe, ruang?.uuid ?? null, j.uuid));
        const saldo = await saldoLinen(f, lokasiTipe, ruang?.uuid ?? null, j.uuid, k);
        const tanpaUnit = saldo - (await unitTerlacak(f, lokasiTipe, ruang?.uuid ?? null, j.uuid, k));
        if (jumlah > tanpaUnit)
          throw permintaanSalah(`${j.nama} dilacak per unit; saldo tanpa label hanya ${Math.max(tanpaUnit, 0)}. Koreksi unit berlabel lewat ubah status unit (Unit Linen)`);
      }
      return keluarkanStok(
        k,
        {
          faskesUuid: f,
          lokasiTipe,
          lokasiUuid: ruang?.uuid ?? null,
          namaLokasi: ruang?.nama,
          jenisLinenUuid: j.uuid,
          sumberTipe: jenisKoreksi,
          sumberUuid: batchUuid,
          jumlah,
          alasan,
          petugasUuid: req.author.username,
        },
        j.nama,
      );
    });
    kirim(res, row, "Koreksi stok berhasil dicatat");
  }),
);

export default rute;
