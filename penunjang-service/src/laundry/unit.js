import express from "express";
import { query, satu, sisipkan, sekarang, transaksi, uuidv7 } from "../db.js";
import { tangani, kirim, wajib, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { izinLaundry, wajibSalahSatu } from "../umum/izin.js";
import { cekPilihan, konflik, periode, pilihan, teks } from "./bersama.js";
import { catatTransaksiStok, keluarkanStok, kunciStok, saldoLinen, validasiRuangan } from "./stok.js";
import {
  PERISTIWA_UNIT,
  POSISI_UNIT,
  STATUS_UNIT,
  SUMBER_STATUS,
  awalanKode,
  cekKonfigurasiSiklus,
  cekTransisiStatus,
  kodeUnitKe,
  konflikUnik,
  kunciUnit,
  normalKode,
  pindahkanUnit,
  statusSiklus,
  unitTerlacak,
} from "./unit-alur.js";

// Pelacakan per unit linen (STD-0030) — /api/v3/penunjang/laundry/unit/...
//   /unit/referensi                 pilihan status/posisi/peristiwa + jenis linen + ruangan
//   /unit/jenis, PATCH /unit/jenis/:uuid   cara pencatatan per jenis (per_jumlah | per_unit) & batas umur pakai
//   /unit (GET/POST)                daftar & registrasi unit (kode unik per faskes, label QR/barcode)
//   /unit/pindai?kode=              hasil pindai satu kode → unit & posisinya (layar pemindaian)
//   /unit/label?uuid=a,b            data label cetak ulang (tanpa membuat unit baru)
//   /unit/bed?lokasi_uuid=          bed/kamar ruangan untuk tautan opsional (tanpa data pasien)
//   /unit/:uuid, /unit/:uuid/status, /unit/:uuid/lokasi, /unit/:uuid/bed   detail, status, koreksi lokasi, tautan bed
//   /unit/laporan/{riwayat|status|siklus|perputaran}
// Perpindahan alur (serah terima kotor, batch, selesai cuci, distribusi, penerimaan ruangan) dicatat lewat endpoint
// alur yang sudah ada dengan `kode_unit` hasil pindai — lihat penerimaan.js, batch.js, distribusi.js, unit-alur.js.

export const rute = express.Router();
const MODUL = "Laundry";

const SQL_UNIT = `
  SELECT u.uuid, u.kode_unit, u.jenis_linen_uuid, j.kode AS kode_jenis, j.nama AS nama_jenis, j.cara_pencatatan, j.batas_siklus, j.peringatan_siklus,
         u.status, u.siklus_cuci, u.lokasi_tipe, u.lokasi_uuid, l.name AS nama_lokasi, u.dokumen_uuid, u.rincian_uuid,
         u.bed_uuid, rm.no_bed, u.kamar_uuid, rg.name AS nama_kamar, u.waktu_registrasi, u.waktu_cuci_terakhir, u.waktu_status, u.alasan_status
    FROM laundry_unit u
    JOIN laundry_jenis_linen j ON j.uuid = u.jenis_linen_uuid AND j.faskes_uuid = u.faskes_uuid
    LEFT JOIN lokasi l ON l.uuid = u.lokasi_uuid AND l.faskes_uuid = u.faskes_uuid
    LEFT JOIN room_monitorings rm ON rm.uuid = u.bed_uuid AND rm.faskes_uuid = u.faskes_uuid
    LEFT JOIN ruangan rg ON rg.uuid = u.kamar_uuid AND rg.faskes_uuid = u.faskes_uuid`;

const denganSiklus = (u) => ({ ...u, siklus_cuci: Number(u.siklus_cuci), status_siklus: statusSiklus(u.siklus_cuci, u.batas_siklus, u.peringatan_siklus) });

const jenisFaskes = (uuid, faskes, k, kunci = "") =>
  satu(`SELECT * FROM laundry_jenis_linen WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ${kunci}`, [String(uuid ?? ""), faskes], k);

const kunciAdvisory = (k, teksKunci) => query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [teksKunci], k);

// Lokasi tujuan registrasi/koreksi: ruangan (lokasi_uuid wajib, milik faskes) atau stok bersih laundry.
const lokasiTujuan = async (b, faskes, k) => {
  const tipe = cekPilihan(b.lokasi_tipe || "laundry", { ruangan: 1, laundry: 1 }, "lokasi_tipe");
  if (tipe === "laundry") return { tipe, uuid: null, nama: "stok bersih laundry" };
  const r = await validasiRuangan(b.lokasi_uuid, faskes, k);
  return { tipe, uuid: r.uuid, nama: r.nama };
};

// Penyusun filter WHERE berparameter.
const penyaring = (awal, params) => {
  const p = [...params];
  let w = awal;
  return {
    p,
    get w() {
      return w;
    },
    tambah(nilai, sql) {
      p.push(nilai);
      w += ` AND ${sql.replaceAll("?", `$${p.length}`)}`;
    },
    sisip(sql) {
      w += sql;
    },
  };
};

const filterWaktu = (q, s, kolom) => {
  const { dari, sampai } = periode(q);
  if (dari) s.tambah(dari, `${kolom} >= ?`);
  if (sampai) s.tambah(sampai, `${kolom} <= ?`);
};

rute.get(
  "/unit/referensi",
  wajibSalahSatu([MODUL, "Unit Linen", "READ"], [MODUL, "Pemindaian Unit", "READ"], [MODUL, "Koreksi Unit", "READ"], [MODUL, "Laporan Unit", "READ"]),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    kirim(res, {
      jenis_linen: await query(
        `SELECT uuid, kode, nama, satuan, aktif, cara_pencatatan, batas_siklus, peringatan_siklus FROM laundry_jenis_linen
          WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY nama`,
        [f],
      ),
      ruangan: await query(`SELECT uuid, name AS nama FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [f]),
      status: pilihan(STATUS_UNIT),
      posisi: pilihan(POSISI_UNIT),
      peristiwa: pilihan(PERISTIWA_UNIT),
    });
  }),
);

// ── Konfigurasi cara pencatatan per jenis linen (hibrida: per_jumlah tetap memakai alur jumlah apa adanya — KT-1)
rute.get(
  "/unit/jenis",
  wajibSalahSatu([MODUL, "Unit Linen", "READ"], [MODUL, "Datamaster", "READ", "Jenis Linen"]),
  tangani(async (req, res) => {
    kirim(
      res,
      await query(
        `SELECT j.uuid, j.kode, j.nama, j.satuan, j.aktif, j.cara_pencatatan, j.batas_siklus, j.peringatan_siklus,
                count(u.uuid) FILTER (WHERE u.status = 'aktif')::int AS unit_aktif, count(u.uuid)::int AS unit_total
           FROM laundry_jenis_linen j
           LEFT JOIN laundry_unit u ON u.jenis_linen_uuid = j.uuid AND u.faskes_uuid = j.faskes_uuid AND u.deleted_at IS NULL
          WHERE j.faskes_uuid = $1 AND j.deleted_at IS NULL GROUP BY j.uuid ORDER BY j.nama`,
        [req.author.faskesUuid],
      ),
    );
  }),
);

rute.patch(
  "/unit/jenis/:uuid",
  izinLaundry("Datamaster", "UPDATE", "Jenis Linen"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const cara = b.cara_pencatatan === undefined ? undefined : cekPilihan(b.cara_pencatatan, { per_jumlah: 1, per_unit: 1 }, "cara_pencatatan");
    const hasil = await transaksi(async (k) => {
      const j = await jenisFaskes(req.params.uuid, f, k, "FOR UPDATE");
      if (!j) throw tidakDitemukan("Jenis linen");
      const siklus = cekKonfigurasiSiklus(
        b.batas_siklus === undefined ? j.batas_siklus : b.batas_siklus,
        b.peringatan_siklus === undefined ? j.peringatan_siklus : b.peringatan_siklus,
      );
      const caraBaru = cara ?? j.cara_pencatatan;
      if (j.cara_pencatatan === "per_unit" && caraBaru === "per_jumlah") {
        // Kembali ke per_jumlah hanya bila tidak ada unit aktif: posisi unit tidak lagi mengikuti alur jumlah.
        const aktif = await satu(`SELECT count(*)::int AS n FROM laundry_unit WHERE faskes_uuid = $1 AND jenis_linen_uuid = $2 AND status = 'aktif' AND deleted_at IS NULL`, [f, j.uuid], k);
        if (aktif.n > 0) throw konflik(`Jenis ${j.nama} masih memiliki ${aktif.n} unit aktif; ubah status unit terlebih dahulu sebelum kembali ke pencatatan per jumlah`);
      }
      return satu(
        `UPDATE laundry_jenis_linen SET cara_pencatatan = $1, batas_siklus = $2, peringatan_siklus = $3, updated_at = $4
          WHERE uuid = $5 AND faskes_uuid = $6 RETURNING uuid, kode, nama, cara_pencatatan, batas_siklus, peringatan_siklus`,
        [caraBaru, siklus.batas, siklus.peringatan, sekarang(), j.uuid, f],
        k,
      );
    });
    kirim(res, hasil, "Konfigurasi pelacakan jenis linen berhasil disimpan");
  }),
);

// ── Daftar & registrasi unit
rute.get(
  "/unit",
  izinLaundry("Unit Linen", "READ"),
  tangani(async (req, res) => {
    const q = req.query;
    const s = penyaring("u.faskes_uuid = $1 AND u.deleted_at IS NULL", [req.author.faskesUuid]);
    if (q.q) s.tambah(`%${String(q.q).trim()}%`, "(u.kode_unit ILIKE ? OR j.nama ILIKE ?)");
    if (q.jenis_linen_uuid) s.tambah(String(q.jenis_linen_uuid), "u.jenis_linen_uuid = ?");
    if (q.status) s.tambah(cekPilihan(q.status, STATUS_UNIT, "status"), "u.status = ?");
    if (q.lokasi_tipe) s.tambah(cekPilihan(q.lokasi_tipe, POSISI_UNIT, "lokasi_tipe"), "u.lokasi_tipe = ?");
    if (q.lokasi_uuid) s.tambah(String(q.lokasi_uuid), "u.lokasi_uuid = ?");
    if (q.siklus) {
      cekPilihan(q.siklus, { mendekati: 1, tercapai: 1 }, "siklus");
      s.sisip(
        q.siklus === "tercapai"
          ? " AND j.batas_siklus IS NOT NULL AND u.siklus_cuci >= j.batas_siklus"
          : " AND j.peringatan_siklus IS NOT NULL AND u.siklus_cuci >= j.peringatan_siklus AND (j.batas_siklus IS NULL OR u.siklus_cuci < j.batas_siklus)",
      );
    }
    const rows = await query(`${SQL_UNIT} WHERE ${s.w} ORDER BY u.kode_unit LIMIT 1000`, s.p);
    kirim(res, rows.map(denganSiklus));
  }),
);

// Registrasi unit (KF-2). sumber "stok_ada" = memberi label linen yang sudah tercatat di buku stok (tanpa menambah
// saldo; ditolak bila melebihi saldo yang belum berlabel — tidak ada konversi diam-diam, KF-16), "baru" = linen baru
// masuk (saldo lokasi bertambah sebanyak unit, sumber_tipe registrasi_unit).
rute.post(
  "/unit",
  izinLaundry("Unit Linen", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["jenis_linen_uuid"]);
    const f = req.author.faskesUuid;
    const sumber = cekPilihan(b.sumber || "stok_ada", { stok_ada: 1, baru: 1 }, "sumber");
    const kodeManual = b.kode_unit === undefined || b.kode_unit === null || b.kode_unit === "" ? null : normalKode(b.kode_unit);
    if (kodeManual !== null && !/^[A-Z0-9][A-Z0-9-]{0,59}$/.test(kodeManual)) throw permintaanSalah("kode_unit hanya boleh huruf, angka, dan tanda hubung (maksimal 60 karakter)");
    const jumlah = b.jumlah === undefined || b.jumlah === null || b.jumlah === "" ? 1 : Number(b.jumlah);
    if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > 200) throw permintaanSalah("jumlah harus berupa bilangan bulat 1 sampai 200");
    if (kodeManual && jumlah !== 1) throw permintaanSalah("kode_unit manual hanya untuk registrasi satu unit");

    const dibuat = await transaksi(async (k) => {
      const jenis = await jenisFaskes(b.jenis_linen_uuid, f, k, "FOR SHARE");
      if (!jenis) throw permintaanSalah("Jenis linen tidak ditemukan pada faskes ini");
      if (!jenis.aktif) throw permintaanSalah(`Jenis linen ${jenis.nama} nonaktif`);
      if (jenis.cara_pencatatan !== "per_unit") throw permintaanSalah(`Jenis linen ${jenis.nama} belum diatur dilacak per unit`);
      const tujuan = await lokasiTujuan(b, f, k);
      await kunciAdvisory(k, kunciStok(f, tujuan.tipe, tujuan.uuid, jenis.uuid));
      if (sumber === "stok_ada") {
        // Saldo dibaca lebih dulu, baru jumlah unit, di bawah kunci stok yang sama (lihat unitTerlacak).
        const saldo = await saldoLinen(f, tujuan.tipe, tujuan.uuid, jenis.uuid, k);
        const berlabel = await unitTerlacak(f, tujuan.tipe, tujuan.uuid, jenis.uuid, k);
        if (saldo - berlabel < jumlah)
          throw permintaanSalah(`Saldo ${jenis.nama} di ${tujuan.nama} yang belum berlabel hanya ${Math.max(saldo - berlabel, 0)}; pilih sumber "baru" untuk linen baru`);
      }
      const awalan = kodeManual ? null : awalanKode(b.kode_awal || jenis.kode);
      let nomor = 0;
      if (awalan) {
        await kunciAdvisory(k, `laundry_unit_kode:${f}:${awalan}`);
        const terakhir = await satu(
          `SELECT max(substring(upper(kode_unit) FROM $2)::bigint) AS n FROM laundry_unit WHERE faskes_uuid = $1 AND upper(kode_unit) ~ $2`,
          [f, `^${awalan}-([0-9]{1,15})$`],
          k,
        );
        nomor = Number(terakhir?.n ?? 0);
      } else if (await satu(`SELECT 1 FROM laundry_unit WHERE faskes_uuid = $1 AND upper(kode_unit) = $2 AND deleted_at IS NULL`, [f, kodeManual], k)) {
        throw konflik(`Kode unit ${kodeManual} sudah dipakai`);
      }
      const waktu = sekarang();
      const hasil = [];
      for (let i = 0; i < jumlah; i++) {
        const kode = kodeManual ?? kodeUnitKe(awalan, nomor + i + 1);
        const uuid = uuidv7();
        const unit = await sisipkan(
          "laundry_unit",
          { uuid, faskes_uuid: f, jenis_linen_uuid: jenis.uuid, kode_unit: kode, status: "aktif", siklus_cuci: 0, lokasi_tipe: tujuan.tipe, lokasi_uuid: tujuan.uuid, waktu_registrasi: waktu },
          k,
        ).catch((e) => konflikUnik(e, `Kode unit ${kode} sudah dipakai`));
        await sisipkan("laundry_unit_pengenal", { faskes_uuid: f, unit_uuid: uuid, jenis_pengenal: "qr", nilai: kode, aktif: true, berlaku_mulai: waktu }, k).catch((e) =>
          konflikUnik(e, `Kode ${kode} sudah dipakai sebagai pengenal unit lain`),
        );
        await sisipkan(
          "laundry_unit_riwayat",
          {
            faskes_uuid: f,
            unit_uuid: uuid,
            peristiwa: "registrasi",
            lokasi_tipe_sesudah: tujuan.tipe,
            lokasi_uuid_sesudah: tujuan.uuid,
            status_sesudah: "aktif",
            siklus_sesudah: 0,
            alasan: sumber === "baru" ? "Linen baru" : "Label untuk stok yang sudah tercatat",
            pelaku_uuid: req.author.username,
            waktu,
          },
          k,
        );
        hasil.push({ ...unit, nama_jenis: jenis.nama, kode_jenis: jenis.kode, nama_lokasi: tujuan.uuid ? tujuan.nama : null });
      }
      if (sumber === "baru")
        await catatTransaksiStok(k, {
          faskesUuid: f,
          lokasiTipe: tujuan.tipe,
          lokasiUuid: tujuan.uuid,
          jenisLinenUuid: jenis.uuid,
          sumberTipe: "registrasi_unit",
          arah: "masuk",
          jumlah,
          alasan: `Registrasi ${jumlah} unit baru (${hasil[0].kode_unit}${jumlah > 1 ? ` s.d. ${hasil[hasil.length - 1].kode_unit}` : ""})`,
          petugasUuid: req.author.username,
          waktuTransaksi: waktu,
        });
      return hasil;
    });
    kirim(res, { unit: dibuat }, `${dibuat.length} unit linen berhasil didaftarkan`);
  }),
);

// Hasil pindai satu kode (layar pemindaian & pencarian): unit, posisi, dokumen alur yang memegangnya.
rute.get(
  "/unit/pindai",
  wajibSalahSatu([MODUL, "Pemindaian Unit", "READ"], [MODUL, "Unit Linen", "READ"]),
  tangani(async (req, res) => {
    const kode = normalKode(req.query.kode);
    if (!kode) throw permintaanSalah("kode wajib diisi");
    const f = req.author.faskesUuid;
    const u = await satu(
      `${SQL_UNIT}
        JOIN laundry_unit_pengenal p ON p.unit_uuid = u.uuid AND p.faskes_uuid = u.faskes_uuid AND p.aktif AND p.deleted_at IS NULL
       WHERE u.faskes_uuid = $1 AND upper(p.nilai) = $2 AND u.deleted_at IS NULL`,
      [f, kode],
    );
    if (!u) throw tidakDitemukan(`Kode unit ${kode}`);
    // Kategori & penerimaan asal untuk unit kotor (pengelompokan batch), kode batch untuk unit dalam batch.
    const dok =
      ["serah_kotor", "kotor", "batch"].includes(u.lokasi_tipe) && u.rincian_uuid
        ? await satu(`SELECT d.uuid, d.penerimaan_uuid, d.kategori FROM laundry_penerimaan_rincian d WHERE d.uuid = $1 AND d.faskes_uuid = $2`, [u.rincian_uuid, f])
        : null;
    const batch = u.lokasi_tipe === "batch" ? await satu(`SELECT uuid, kode, status FROM laundry_batch WHERE uuid = $1 AND faskes_uuid = $2`, [u.dokumen_uuid, f]) : null;
    kirim(res, { ...denganSiklus(u), kategori: dok?.kategori ?? null, penerimaan_uuid: dok?.penerimaan_uuid ?? null, kode_batch: batch?.kode ?? null });
  }),
);

// Data label (KF-4): kode unik per faskes; QR/barcode hanya berisi kode unit (tanpa data pasien). Cetak ulang memakai
// unit yang sama.
rute.get(
  "/unit/label",
  izinLaundry("Unit Linen", "CETAK LABEL"),
  tangani(async (req, res) => {
    const uuids = [...new Set(String(req.query.uuid ?? "").split(",").map((x) => x.trim()).filter(Boolean))];
    if (!uuids.length) throw permintaanSalah("uuid unit wajib diisi");
    if (uuids.length > 200) throw permintaanSalah("Maksimal 200 label per cetak");
    const f = req.author.faskesUuid;
    const rows = await query(
      `SELECT u.uuid, u.kode_unit, j.kode AS kode_jenis, j.nama AS nama_jenis, fk.name AS nama_faskes
         FROM laundry_unit u
         JOIN laundry_jenis_linen j ON j.uuid = u.jenis_linen_uuid AND j.faskes_uuid = u.faskes_uuid
         LEFT JOIN faskes fk ON fk.uuid = u.faskes_uuid
        WHERE u.faskes_uuid = $1 AND u.uuid = ANY($2::varchar[]) AND u.deleted_at IS NULL ORDER BY u.kode_unit`,
      [f, uuids],
    );
    if (rows.length !== uuids.length) throw tidakDitemukan("Sebagian unit linen");
    kirim(res, { label: rows.map((r) => ({ ...r, nilai: r.kode_unit })) });
  }),
);

// Bed/kamar pada ruangan (rujukan tautan opsional). Kolom pasien sengaja tidak dibaca.
rute.get(
  "/unit/bed",
  izinLaundry("Unit Linen", "READ"),
  tangani(async (req, res) => {
    if (!req.query.lokasi_uuid) throw permintaanSalah("lokasi_uuid wajib diisi");
    kirim(
      res,
      await query(
        `SELECT rm.uuid, rm.no_bed, rm.type AS tipe, rm.room_uuid AS kamar_uuid, rg.name AS nama_kamar
           FROM room_monitorings rm LEFT JOIN ruangan rg ON rg.uuid = rm.room_uuid AND rg.faskes_uuid = rm.faskes_uuid
          WHERE rm.faskes_uuid = $1 AND rm.lokasi_uuid = $2 AND rm.deleted_at IS NULL ORDER BY rg.name, rm.no_bed`,
        [req.author.faskesUuid, String(req.query.lokasi_uuid)],
      ),
    );
  }),
);

// ── Laporan (KF-15) — hanya perpindahan tersimpan; pindai yang ditolak tidak pernah tercatat (KT-20).
const riwayatUnit = (f, unitUuid, q = {}) => {
  const s = penyaring("r.faskes_uuid = $1 AND r.unit_uuid = $2 AND r.deleted_at IS NULL", [f, unitUuid]);
  filterWaktu(q, s, "r.waktu");
  return query(
    `SELECT r.uuid, r.peristiwa, r.dokumen_tipe, r.dokumen_uuid, r.lokasi_tipe_sebelum, r.lokasi_uuid_sebelum, ls.name AS nama_lokasi_sebelum,
            r.lokasi_tipe_sesudah, r.lokasi_uuid_sesudah, ld.name AS nama_lokasi_sesudah, r.status_sebelum, r.status_sesudah, r.siklus_sesudah,
            r.bed_uuid, rm.no_bed, r.alasan, r.pelaku_uuid, r.waktu
       FROM laundry_unit_riwayat r
       LEFT JOIN lokasi ls ON ls.uuid = r.lokasi_uuid_sebelum AND ls.faskes_uuid = r.faskes_uuid
       LEFT JOIN lokasi ld ON ld.uuid = r.lokasi_uuid_sesudah AND ld.faskes_uuid = r.faskes_uuid
       LEFT JOIN room_monitorings rm ON rm.uuid = r.bed_uuid AND rm.faskes_uuid = r.faskes_uuid
      WHERE ${s.w}
      ORDER BY r.waktu, r.created_at, r.uuid LIMIT 2000`,
    s.p,
  );
};

rute.get(
  "/unit/laporan/riwayat",
  izinLaundry("Laporan Unit", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const kode = normalKode(req.query.kode);
    if (!req.query.unit_uuid && !kode) throw permintaanSalah("unit_uuid atau kode wajib diisi");
    const u = await satu(
      `${SQL_UNIT} WHERE u.faskes_uuid = $1 AND u.deleted_at IS NULL AND ${req.query.unit_uuid ? "u.uuid = $2" : "upper(u.kode_unit) = $2"}`,
      [f, req.query.unit_uuid ? String(req.query.unit_uuid) : kode],
    );
    if (!u) throw tidakDitemukan("Unit linen");
    kirim(res, { unit: denganSiklus(u), riwayat: await riwayatUnit(f, u.uuid, req.query) });
  }),
);

// Unit rusak/hilang/dimusnahkan menurut ruangan terakhir (KT-19) + ringkasan per ruangan/status.
rute.get(
  "/unit/laporan/status",
  izinLaundry("Laporan Unit", "READ"),
  tangani(async (req, res) => {
    const q = req.query;
    const s = penyaring("u.faskes_uuid = $1 AND u.deleted_at IS NULL AND u.status <> 'aktif'", [req.author.faskesUuid]);
    if (q.status) s.tambah(cekPilihan(q.status, { rusak: 1, hilang: 1, dimusnahkan: 1 }, "status"), "u.status = ?");
    if (q.lokasi_uuid) s.tambah(String(q.lokasi_uuid), "u.lokasi_uuid = ?");
    if (q.jenis_linen_uuid) s.tambah(String(q.jenis_linen_uuid), "u.jenis_linen_uuid = ?");
    filterWaktu(q, s, "u.waktu_status");
    const rows = (await query(`${SQL_UNIT} WHERE ${s.w} ORDER BY l.name NULLS LAST, u.waktu_status DESC LIMIT 2000`, s.p)).map(denganSiklus);
    const ringkas = new Map();
    for (const r of rows) {
      const kunci = `${r.lokasi_tipe === "laundry" ? "-" : r.lokasi_uuid}|${r.status}`;
      const x = ringkas.get(kunci) ?? { lokasi_uuid: r.lokasi_tipe === "laundry" ? null : r.lokasi_uuid, nama_lokasi: r.lokasi_tipe === "laundry" ? "Stok bersih laundry" : r.nama_lokasi, status: r.status, jumlah: 0 };
      x.jumlah += 1;
      ringkas.set(kunci, x);
    }
    kirim(res, { ringkasan: [...ringkas.values()], unit: rows });
  }),
);

// Unit aktif mendekati / mencapai batas umur pakai (KT-17).
rute.get(
  "/unit/laporan/siklus",
  izinLaundry("Laporan Unit", "READ"),
  tangani(async (req, res) => {
    const q = req.query;
    const ambang = q.ambang ? cekPilihan(q.ambang, { dekat: 1, tercapai: 1 }, "ambang") : null;
    const s = penyaring(
      `u.faskes_uuid = $1 AND u.deleted_at IS NULL AND u.status = 'aktif'
       AND ((j.batas_siklus IS NOT NULL AND u.siklus_cuci >= j.batas_siklus) OR (j.peringatan_siklus IS NOT NULL AND u.siklus_cuci >= j.peringatan_siklus))`,
      [req.author.faskesUuid],
    );
    if (q.jenis_linen_uuid) s.tambah(String(q.jenis_linen_uuid), "u.jenis_linen_uuid = ?");
    if (q.lokasi_uuid) s.tambah(String(q.lokasi_uuid), "u.lokasi_uuid = ?");
    const rows = (await query(`${SQL_UNIT} WHERE ${s.w} ORDER BY u.siklus_cuci DESC, u.kode_unit LIMIT 2000`, s.p))
      .map(denganSiklus)
      .filter((r) => !ambang || (ambang === "tercapai" ? r.status_siklus === "tercapai" : r.status_siklus === "mendekati"));
    kirim(res, rows);
  }),
);

// Perputaran: banyaknya perpindahan tersimpan per peristiwa & jenis dalam rentang waktu (+ jumlah unit berbeda).
rute.get(
  "/unit/laporan/perputaran",
  izinLaundry("Laporan Unit", "READ"),
  tangani(async (req, res) => {
    const q = req.query;
    const s = penyaring(
      `r.faskes_uuid = $1 AND r.deleted_at IS NULL AND r.peristiwa IN ('serah_kotor','terima_kotor','masuk_batch','selesai_cuci','distribusi','terima_ruangan')`,
      [req.author.faskesUuid],
    );
    filterWaktu(q, s, "r.waktu");
    if (q.jenis_linen_uuid) s.tambah(String(q.jenis_linen_uuid), "u.jenis_linen_uuid = ?");
    if (q.lokasi_uuid) s.tambah(String(q.lokasi_uuid), "(r.lokasi_uuid_sebelum = ? OR r.lokasi_uuid_sesudah = ?)");
    kirim(
      res,
      await query(
        `SELECT u.jenis_linen_uuid, j.nama AS nama_jenis, r.peristiwa, count(*)::int AS jumlah_perpindahan, count(DISTINCT r.unit_uuid)::int AS jumlah_unit
           FROM laundry_unit_riwayat r
           JOIN laundry_unit u ON u.uuid = r.unit_uuid AND u.faskes_uuid = r.faskes_uuid
           JOIN laundry_jenis_linen j ON j.uuid = u.jenis_linen_uuid AND j.faskes_uuid = u.faskes_uuid
          WHERE ${s.w}
          GROUP BY u.jenis_linen_uuid, j.nama, r.peristiwa ORDER BY j.nama, r.peristiwa`,
        s.p,
      ),
    );
  }),
);

// Unit yang sedang dipegang dokumen alur (serah terima, batch, distribusi) — daftar harapan pada layar pemindaian.
rute.get(
  "/unit/dokumen/:uuid",
  wajibSalahSatu([MODUL, "Pemindaian Unit", "READ"], [MODUL, "Unit Linen", "READ"]),
  tangani(async (req, res) => {
    const rows = await query(`${SQL_UNIT} WHERE u.faskes_uuid = $1 AND u.dokumen_uuid = $2 AND u.deleted_at IS NULL ORDER BY u.kode_unit`, [req.author.faskesUuid, req.params.uuid]);
    kirim(res, rows.map(denganSiklus));
  }),
);

// ── Detail & koreksi per unit
rute.get(
  "/unit/:uuid",
  wajibSalahSatu([MODUL, "Unit Linen", "READ"], [MODUL, "Koreksi Unit", "READ"], [MODUL, "Laporan Unit", "READ"]),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const u = await satu(`${SQL_UNIT} WHERE u.uuid = $1 AND u.faskes_uuid = $2 AND u.deleted_at IS NULL`, [req.params.uuid, f]);
    if (!u) throw tidakDitemukan("Unit linen");
    const tautan = await query(
      `SELECT t.uuid, t.lokasi_uuid, l.name AS nama_lokasi, t.bed_uuid, rm.no_bed, t.kamar_uuid, rg.name AS nama_kamar, t.waktu_mulai, t.waktu_selesai, t.pelaku_uuid, t.alasan
         FROM laundry_unit_lokasi t
         LEFT JOIN lokasi l ON l.uuid = t.lokasi_uuid AND l.faskes_uuid = t.faskes_uuid
         LEFT JOIN room_monitorings rm ON rm.uuid = t.bed_uuid AND rm.faskes_uuid = t.faskes_uuid
         LEFT JOIN ruangan rg ON rg.uuid = t.kamar_uuid AND rg.faskes_uuid = t.faskes_uuid
        WHERE t.faskes_uuid = $1 AND t.unit_uuid = $2 AND t.deleted_at IS NULL ORDER BY t.waktu_mulai DESC LIMIT 200`,
      [f, u.uuid],
    );
    kirim(res, { ...denganSiklus(u), riwayat: await riwayatUnit(f, u.uuid), tautan_bed: tautan });
  }),
);

const kunciSatuUnit = async (k, f, uuid) => {
  const [u] = await kunciUnit(k, f, [String(uuid)]);
  if (!u) throw tidakDitemukan("Unit linen");
  return u;
};

// Ubah status (KF-12/KT-15/KT-16). Aktif → rusak/hilang/dimusnahkan mengeluarkan satu lembar dari buku stok lokasinya
// (sumber hilang/rusak/afkir, sama dengan koreksi stok); kembali aktif wajib menyebut lokasi dan memasukkannya lagi.
rute.patch(
  "/unit/:uuid/status",
  izinLaundry("Koreksi Unit", "UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["status", "alasan"]);
    const f = req.author.faskesUuid;
    const alasan = teks(b.alasan);
    const hasil = await transaksi(async (k) => {
      const u = await kunciSatuUnit(k, f, req.params.uuid);
      const { keluarBuku, masukBuku } = cekTransisiStatus(u, String(b.status), alasan);
      const waktu = sekarang();
      const dasar = { faskesUuid: f, jenisLinenUuid: u.jenis_linen_uuid, sumberUuid: u.uuid, jumlah: 1, petugasUuid: req.author.username, waktuTransaksi: waktu };
      let sesudah = { status: b.status };
      if (keluarBuku)
        await keluarkanStok(
          k,
          { ...dasar, lokasiTipe: u.lokasi_tipe, lokasiUuid: u.lokasi_uuid, namaLokasi: u.nama_lokasi, sumberTipe: SUMBER_STATUS[b.status], alasan: `Unit ${u.kode_unit}: ${alasan}` },
          u.nama_jenis,
        );
      if (masukBuku) {
        if (u.cara_pencatatan !== "per_unit") throw permintaanSalah(`Jenis ${u.nama_jenis} tidak lagi dilacak per unit`);
        if (!b.lokasi_tipe) throw permintaanSalah("lokasi_tipe (ruangan/laundry) wajib diisi saat unit diaktifkan kembali");
        const tujuan = await lokasiTujuan(b, f, k);
        await catatTransaksiStok(k, { ...dasar, lokasiTipe: tujuan.tipe, lokasiUuid: tujuan.uuid, sumberTipe: "koreksi_unit", arah: "masuk", alasan: `Unit ${u.kode_unit} aktif kembali: ${alasan}` });
        sesudah = { ...sesudah, lokasi_tipe: tujuan.tipe, lokasi_uuid: tujuan.uuid, dokumen_uuid: null, rincian_uuid: null };
      }
      const [baru] = await pindahkanUnit(k, [u], sesudah, { faskes: f, peristiwa: "ubah_status", alasan, pelaku: req.author.username, waktu });
      return baru;
    });
    kirim(res, denganSiklus(hasil), "Status unit berhasil diperbarui");
  }),
);

// Koreksi lokasi beralasan (KF-14): unit aktif yang ternyata berada di ruangan/stok lain dipindahkan, buku stok
// lokasi lama berkurang satu dan lokasi baru bertambah satu; riwayat lama tidak diubah.
rute.put(
  "/unit/:uuid/lokasi",
  izinLaundry("Koreksi Unit", "UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["lokasi_tipe", "alasan"]);
    const f = req.author.faskesUuid;
    const alasan = teks(b.alasan);
    if (!alasan) throw permintaanSalah("alasan wajib diisi");
    const hasil = await transaksi(async (k) => {
      const u = await kunciSatuUnit(k, f, req.params.uuid);
      if (u.status !== "aktif") throw konflik(`Unit ${u.kode_unit} berstatus ${STATUS_UNIT[u.status]}; ubah statusnya bila ditemukan kembali`);
      if (!["ruangan", "laundry"].includes(u.lokasi_tipe)) throw konflik(`Unit ${u.kode_unit} sedang ${POSISI_UNIT[u.lokasi_tipe]}; selesaikan alurnya terlebih dahulu`);
      const tujuan = await lokasiTujuan(b, f, k);
      if (tujuan.tipe === u.lokasi_tipe && tujuan.uuid === u.lokasi_uuid) throw permintaanSalah("Lokasi tujuan sama dengan lokasi unit saat ini");
      const waktu = sekarang();
      const dasar = { faskesUuid: f, jenisLinenUuid: u.jenis_linen_uuid, sumberTipe: "koreksi_unit", sumberUuid: u.uuid, jumlah: 1, petugasUuid: req.author.username, waktuTransaksi: waktu };
      await keluarkanStok(k, { ...dasar, lokasiTipe: u.lokasi_tipe, lokasiUuid: u.lokasi_uuid, namaLokasi: u.nama_lokasi, alasan: `Koreksi lokasi unit ${u.kode_unit}: ${alasan}` }, u.nama_jenis);
      await catatTransaksiStok(k, { ...dasar, lokasiTipe: tujuan.tipe, lokasiUuid: tujuan.uuid, arah: "masuk", alasan: `Koreksi lokasi unit ${u.kode_unit}: ${alasan}` });
      const [baru] = await pindahkanUnit(k, [u], { lokasi_tipe: tujuan.tipe, lokasi_uuid: tujuan.uuid }, { faskes: f, peristiwa: "koreksi_lokasi", alasan, pelaku: req.author.username, waktu });
      return baru;
    });
    kirim(res, denganSiklus(hasil), "Lokasi unit berhasil dikoreksi");
  }),
);

// Tautan opsional unit ↔ bed/kamar (KF-13/KT-13): hanya untuk unit aktif di ruangan; bed harus milik ruangan unit.
// bed_uuid kosong = lepas tautan. Riwayat tautan disimpan tanpa identitas pasien.
rute.put(
  "/unit/:uuid/bed",
  izinLaundry("Unit Linen", "UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const bedUuid = teks(b.bed_uuid) ?? null;
    const hasil = await transaksi(async (k) => {
      const u = await kunciSatuUnit(k, f, req.params.uuid);
      if (u.status !== "aktif" || u.lokasi_tipe !== "ruangan") throw konflik(`Unit ${u.kode_unit} tidak sedang aktif di ruangan`);
      let bed = null;
      if (bedUuid) {
        bed = await satu(`SELECT uuid, no_bed, room_uuid, lokasi_uuid FROM room_monitorings WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [bedUuid, f], k);
        if (!bed) throw permintaanSalah("Bed tidak ditemukan pada faskes ini");
        if (bed.lokasi_uuid !== u.lokasi_uuid) throw permintaanSalah(`Bed ${bed.no_bed} bukan bagian dari ruangan ${u.nama_lokasi ?? "unit"}`);
      }
      if ((u.bed_uuid ?? null) === (bed?.uuid ?? null)) throw permintaanSalah(bed ? "Unit sudah tertaut ke bed tersebut" : "Unit tidak sedang tertaut ke bed");
      const waktu = sekarang();
      await query(`UPDATE laundry_unit_lokasi SET waktu_selesai = $1, updated_at = $1 WHERE faskes_uuid = $2 AND unit_uuid = $3 AND waktu_selesai IS NULL AND deleted_at IS NULL`, [waktu, f, u.uuid], k);
      if (bed)
        await sisipkan(
          "laundry_unit_lokasi",
          { faskes_uuid: f, unit_uuid: u.uuid, lokasi_uuid: u.lokasi_uuid, bed_uuid: bed.uuid, kamar_uuid: bed.room_uuid ?? null, waktu_mulai: waktu, pelaku_uuid: req.author.username, alasan: teks(b.alasan) ?? null },
          k,
        );
      const baru = await satu(`UPDATE laundry_unit SET bed_uuid = $1, kamar_uuid = $2, updated_at = $3 WHERE uuid = $4 AND faskes_uuid = $5 RETURNING *`, [bed?.uuid ?? null, bed?.room_uuid ?? null, waktu, u.uuid, f], k);
      await sisipkan(
        "laundry_unit_riwayat",
        {
          faskes_uuid: f,
          unit_uuid: u.uuid,
          peristiwa: "tautan_bed",
          lokasi_tipe_sebelum: u.lokasi_tipe,
          lokasi_uuid_sebelum: u.lokasi_uuid,
          lokasi_tipe_sesudah: u.lokasi_tipe,
          lokasi_uuid_sesudah: u.lokasi_uuid,
          status_sebelum: u.status,
          status_sesudah: u.status,
          siklus_sesudah: u.siklus_cuci,
          bed_uuid: bed?.uuid ?? null,
          alasan: teks(b.alasan) ?? (bed ? `Ditautkan ke bed ${bed.no_bed}` : "Tautan bed dilepas"),
          pelaku_uuid: req.author.username,
          waktu,
        },
        k,
      );
      return baru;
    });
    kirim(res, hasil, bedUuid ? "Unit berhasil ditautkan ke bed" : "Tautan bed unit dilepas");
  }),
);

export default rute;
