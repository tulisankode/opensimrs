import express from "express";
import config from "../config.js";
import { query, satu, ubah, sisipkan, sekarang, transaksi } from "../db.js";
import { kirim, halaman, denganHalaman, permintaanSalah, tidakDitemukan, Galat } from "../umum/respons.js";
import { galatIzin, wajibSalahSatu } from "../umum/izin.js";
import { cariKunjungan } from "../umum/kunjungan.js";
import { nomorBaru } from "../umum/nomor.js";
import { boolOpsional, cekPilihan, epochOpsional, epochWajib, konflik, teks, teksWajib, validasiBerkasMutu, infoBerkas, wajibPilihan } from "./bersama.js";
import {
  AKIBAT_INSIDEN,
  JENIS_INSIDEN,
  KATEGORI_INSIDEN,
  LAYANAN_INSIDEN,
  STATUS_LAPORAN,
  TINDAKAN_OLEH,
  GRADE,
  batasLapor,
  jamPelaporan,
  syaratTutup,
  terlambatLapor,
} from "./ikp-bersama.js";
import { sisipkanBerkas, tanganiMutu } from "./dasar.js";
import {
  DARI_LAPORAN,
  KOLOM_LAPORAN,
  MODUL,
  SUB,
  ambilLaporan,
  amankanLaporan,
  auditIkp,
  boleh,
  bolehLihatPasien,
  cekUnitIkp,
  konfigurasiPengingatLengkap,
  pasienMinimum,
  pengaturanFaskes,
  riwayatLaporan,
  ringkasLaporan,
  tandaiTenggat,
  tandaiTindakLanjut,
} from "./ikp-dasar.js";

// Laporan Insiden Keselamatan Pasien (STD-0026) — izin "Mutu & Akreditasi › Insiden Keselamatan Pasien":
//   POST /ikp/laporan                   lapor insiden (idempotency_key mencegah laporan ganda)        LAPOR
//   GET  /ikp/laporan/saya              laporan milik pelapor (termasuk anonim)                       LAPOR
//   GET  /ikp/laporan/kunci/:kunci      cek apakah pengiriman dengan kunci itu sudah tersimpan        LAPOR
//   GET  /ikp/laporan?status=&jenis_insiden=&grade=&unit_uuid=&dari=&sampai=&terlambat=&cari=      READ
//   GET  /ikp/laporan/:uuid             detail + grading + investigasi + tindak lanjut + lampiran + riwayat  READ / pelapor
//   PUT  /ikp/laporan/:uuid             lengkapi isian (pelapor saat dilaporkan/perlu_dilengkapi; TERIMA s.d. dinilai)
//   POST /ikp/laporan/:uuid/terima      kepala unit menerima laporan                                   TERIMA
//   POST /ikp/laporan/:uuid/minta-lengkapi  kembalikan ke pelapor dengan alasan                        TERIMA
//   PUT  /ikp/laporan/:uuid/pasien      tautkan/lepas rujukan pasien lewat No. Registrasi             LIHAT PASIEN
//   POST /ikp/laporan/:uuid/tutup       tutup laporan bila syarat terpenuhi                            TUTUP
//   POST /ikp/laporan/:uuid/buka-kembali  buka kembali laporan ditutup (alasan wajib)                  TUTUP
//   POST /ikp/laporan/:uuid/lampiran    unggah lampiran (pelapor saat belum diterima, atau TERIMA)
//   GET  /ikp/lampiran/:uuid            unduh lampiran (base64)                                         READ / pelapor
//   DELETE /ikp/lampiran/:uuid          hapus lunak lampiran                                            TERIMA
// Identitas pelapor laporan anonim tidak pernah dikembalikan API (pelapor melihat laporannya lewat milik_saya);
// rujukan pasien hanya untuk pemegang LIHAT PASIEN. Setiap baca detail & unduh lampiran dicatat di mutu_audit.
const rute = express.Router();
const izinIkp = (...aksi) => wajibSalahSatu(...aksi.map((a) => [MODUL, SUB, a]));
const TIPE_LAMPIRAN = ["application/pdf", "image/jpeg", "image/png"];
const MAKS_LAMPIRAN = 5;

const milik = (row, req) => !!req.author?.username && row?.dibuat_oleh === req.author.username;

// Isian laporan dari body. `baru` = pelaporan (kolom wajib harus ada); selain itu hanya kolom yang dikirim.
const bacaIsian = (b, baru) => {
  return {
    jenis_insiden: baru || b.jenis_insiden !== undefined ? wajibPilihan(b.jenis_insiden, JENIS_INSIDEN, "jenis_insiden") : undefined,
    kategori_insiden: cekPilihan(b.kategori_insiden, KATEGORI_INSIDEN, "kategori_insiden"),
    layanan: cekPilihan(b.layanan, LAYANAN_INSIDEN, "layanan"),
    waktu_kejadian: baru || b.waktu_kejadian !== undefined ? epochWajib(b.waktu_kejadian, "waktu_kejadian") : undefined,
    waktu_diketahui: epochOpsional(b.waktu_diketahui, "waktu_diketahui"),
    tempat_kejadian: teks(b.tempat_kejadian, "tempat_kejadian", 255),
    kronologi: baru || b.kronologi !== undefined ? teksWajib(b.kronologi, "kronologi", 10000) : undefined,
    tindakan_segera: teks(b.tindakan_segera, "tindakan_segera", 5000),
    tindakan_oleh: cekPilihan(b.tindakan_oleh, TINDAKAN_OLEH, "tindakan_oleh"),
    akibat: cekPilihan(b.akibat, AKIBAT_INSIDEN, "akibat"),
    pernah_terjadi: boolOpsional(b.pernah_terjadi),
    keterangan_pernah_terjadi: teks(b.keterangan_pernah_terjadi, "keterangan_pernah_terjadi", 2000),
  };
};

const cekWaktu = (kejadian, diketahui, lapor) => {
  if (kejadian > lapor + 300) throw permintaanSalah("waktu_kejadian tidak boleh di masa depan");
  if (diketahui < kejadian) throw permintaanSalah("waktu_diketahui tidak boleh sebelum waktu_kejadian");
  if (diketahui > lapor + 300) throw permintaanSalah("waktu_diketahui tidak boleh di masa depan");
};

// Rujukan pasien dari No. Registrasi kunjungan faskes ini → { patient_uuid, no_reg }.
const rujukanPasien = async (noReg, f) => {
  const k = await cariKunjungan(String(noReg).trim(), f);
  if (!k) throw permintaanSalah("No. Registrasi kunjungan tidak ditemukan di faskes ini");
  return { patient_uuid: k.patient_uuid, no_reg: k.no_reg };
};

const tampilkan = async (row, req, lihatPasien, sekarangDetik = sekarang()) => {
  let r = { ...row, jam_pelaporan: jamPelaporan(row.waktu_diketahui, row.waktu_lapor) };
  if (lihatPasien && row.patient_uuid) r = { ...r, ...(await pasienMinimum(row.patient_uuid, row.faskes_uuid)) };
  return tandaiTenggat(amankanLaporan(r, req, lihatPasien), false, sekarangDetik);
};

rute.post(
  "/laporan",
  izinIkp("LAPOR"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const kunci = teks(b.idempotency_key, "idempotency_key", 100) ?? null;
    if (kunci) {
      const ada = await satu(`SELECT uuid, nomor, dibuat_oleh FROM mutu_ikp_laporan WHERE faskes_uuid = $1 AND idempotency_key = $2`, [f, kunci]);
      if (ada && ada.dibuat_oleh === req.author.username) return kirim(res, { uuid: ada.uuid, nomor: ada.nomor, duplikat: true }, "Laporan dengan kunci ini sudah tersimpan");
      if (ada) throw konflik("idempotency_key sudah dipakai");
    }
    const isi = bacaIsian(b, true);
    const anonim = boolOpsional(b.anonim) ?? false;
    const n = sekarang();
    isi.waktu_diketahui = isi.waktu_diketahui ?? isi.waktu_kejadian;
    cekWaktu(isi.waktu_kejadian, isi.waktu_diketahui, n);
    const unit = await cekUnitIkp(b.unit_uuid, f);
    let pasien = {};
    if (b.no_reg) {
      if (!(await bolehLihatPasien(req))) throw galatIzin(MODUL, SUB, "LIHAT PASIEN");
      pasien = await rujukanPasien(b.no_reg, f);
    }
    const hasil = await transaksi(async (k) => {
      const p = await pengaturanFaskes(f, k);
      const baru = await sisipkan(
        "mutu_ikp_laporan",
        {
          faskes_uuid: f,
          nomor: await nomorBaru(f, "IKP", k),
          ...Object.fromEntries(Object.entries(isi).map(([c, v]) => [c, v ?? null])),
          unit_uuid: unit,
          waktu_lapor: n,
          anonim,
          pelapor_nama: anonim ? null : teks(b.pelapor_nama, "pelapor_nama", 255) ?? req.author.username ?? null,
          ...pasien,
          status: "dilaporkan",
          tenggat_lapor_jam: p.tenggat_lapor_jam,
          batas_lapor: batasLapor(isi.waktu_diketahui, p.tenggat_lapor_jam),
          terlambat_lapor: terlambatLapor(isi.waktu_diketahui, n, p.tenggat_lapor_jam),
          idempotency_key: kunci,
          dibuat_oleh: req.author.username ?? null,
        },
        k,
      );
      await auditIkp(k, req, "ikp_laporan", baru.uuid, "lapor", null, ringkasLaporan(baru), { anonim });
      return baru;
    });
    kirim(res, { uuid: hasil.uuid, nomor: hasil.nomor, status: hasil.status, terlambat_lapor: hasil.terlambat_lapor, batas_lapor: hasil.batas_lapor, anonim: hasil.anonim }, "Laporan insiden berhasil dikirim");
  }),
);

rute.get(
  "/laporan/saya",
  izinIkp("LAPOR"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const hal = halaman(req.query);
    const syarat = `l.faskes_uuid = $1 AND l.dibuat_oleh = $2 AND l.deleted_at IS NULL`;
    const rows = await query(
      `SELECT l.uuid, l.nomor, l.jenis_insiden, l.waktu_kejadian, l.waktu_lapor, l.unit_uuid, un.name AS unit_nama, l.anonim, l.status,
              l.alasan_perlu_lengkap, l.terlambat_lapor, l.created_at
         FROM ${DARI_LAPORAN} WHERE ${syarat} ORDER BY l.waktu_lapor DESC LIMIT $3 OFFSET $4`,
      [f, req.author.username ?? "", hal.limit, hal.offset],
    );
    const total = await satu(`SELECT COUNT(*)::int AS n FROM mutu_ikp_laporan l WHERE ${syarat}`, [f, req.author.username ?? ""]);
    kirim(res, denganHalaman(rows.map((r) => ({ ...r, milik_saya: true })), total?.n, hal));
  }),
);

rute.get(
  "/laporan/kunci/:kunci",
  izinIkp("LAPOR"),
  tanganiMutu(async (req, res) => {
    const row = await satu(`SELECT uuid, nomor, status FROM mutu_ikp_laporan WHERE faskes_uuid = $1 AND idempotency_key = $2 AND dibuat_oleh = $3`, [
      req.author.faskesUuid,
      String(req.params.kunci),
      req.author.username ?? "",
    ]);
    kirim(res, row ? { tersimpan: true, ...row } : { tersimpan: false });
  }),
);

rute.get(
  "/laporan",
  izinIkp("READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const q = req.query;
    const hal = halaman(q);
    const params = [f];
    const syarat = ["l.faskes_uuid = $1", "l.deleted_at IS NULL"];
    const tambah = (sql, v) => {
      params.push(v);
      syarat.push(sql.replace("?", `$${params.length}`));
    };
    const status = cekPilihan(q.status || undefined, STATUS_LAPORAN, "status");
    if (status) tambah("l.status = ?", status);
    else if (q.aktif === "true") syarat.push("l.status <> 'ditutup'");
    const jenis = cekPilihan(q.jenis_insiden || undefined, JENIS_INSIDEN, "jenis_insiden");
    if (jenis) tambah("l.jenis_insiden = ?", jenis);
    const grade = cekPilihan(q.grade || undefined, GRADE, "grade");
    if (grade) tambah("l.grade = ?", grade);
    if (q.grade === "belum") syarat.push("l.grade IS NULL");
    if (q.unit_uuid) tambah("l.unit_uuid = ?", String(q.unit_uuid));
    const dari = epochOpsional(q.dari || undefined, "dari");
    const sampai = epochOpsional(q.sampai || undefined, "sampai");
    if (dari) tambah("l.waktu_kejadian >= ?", dari);
    if (sampai) tambah("l.waktu_kejadian <= ?", sampai);
    if (q.terlambat === "true") syarat.push("l.terlambat_lapor = true");
    if (q.cari) {
      params.push(`%${String(q.cari).trim()}%`);
      syarat.push(`(l.nomor ILIKE ${params.length} OR un.name ILIKE ${params.length})`);
    }
    const where = syarat.join(" AND ");
    const rows = await query(`SELECT ${KOLOM_LAPORAN} FROM ${DARI_LAPORAN} WHERE ${where} ORDER BY l.waktu_lapor DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [
      ...params,
      hal.limit,
      hal.offset,
    ]);
    const total = await satu(`SELECT COUNT(*)::int AS n FROM ${DARI_LAPORAN} WHERE ${where}`, params);
    const lihatPasien = await bolehLihatPasien(req);
    const n = sekarang();
    // Daftar tanpa kronologi lengkap (cukup ringkasan) dan tanpa data pasien selain penanda.
    const data = await Promise.all(
      rows.map(async (r) => {
        const t = await tampilkan(r, req, lihatPasien, n);
        return { ...t, kronologi: String(r.kronologi ?? "").slice(0, 160) };
      }),
    );
    kirim(res, denganHalaman(data, total?.n, hal));
  }),
);

// Detail lengkap. Pelapor tanpa izin READ hanya boleh membuka laporannya sendiri.
const detail = async (req, uuid) => {
  const f = req.author.faskesUuid;
  const row = await ambilLaporan(uuid, f);
  const bacaSemua = await boleh(req, "READ");
  if (!bacaSemua && !milik(row, req)) throw tidakDitemukan("Laporan insiden");
  const lihatPasien = await bolehLihatPasien(req);
  const n = sekarang();
  const [grading, investigasi, tindakLanjut, lampiran, riwayat, p] = await Promise.all([
    query(`SELECT uuid, dampak, probabilitas, skor, grade, versi_matriks, aktif, alasan, dinilai_oleh, dinilai_pada FROM mutu_ikp_grading WHERE laporan_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY dinilai_pada DESC, uuid DESC`, [row.uuid, f]),
    satu(`SELECT * FROM mutu_ikp_investigasi WHERE laporan_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [row.uuid, f]),
    query(
      `SELECT t.*, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS pic_nama
         FROM mutu_ikp_tindak_lanjut t LEFT JOIN pegawai pg ON pg.uuid = t.pic_pegawai_uuid
        WHERE t.laporan_uuid = $1 AND t.faskes_uuid = $2 AND t.deleted_at IS NULL ORDER BY t.tenggat, t.uuid`,
      [row.uuid, f],
    ),
    query(`SELECT uuid, nama_berkas, tipe_mime, ukuran_bita, created_at FROM mutu_ikp_lampiran WHERE laporan_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY uuid`, [row.uuid, f]),
    bacaSemua ? riwayatLaporan(row.uuid, f) : [],
    pengaturanFaskes(f),
  ]);
  const t = tandaiTenggat(await tampilkan(row, req, lihatPasien, n), investigasi?.status === "selesai", n);
  // Pelapor tanpa izin READ hanya melihat isian laporannya, status, grade, dan status investigasi (umpan balik),
  // tanpa rincian analisis/tindak lanjut.
  if (!bacaSemua) return { ...t, grading: [], investigasi: investigasi ? { jenis: investigasi.jenis, status: investigasi.status } : null, tindak_lanjut: [], lampiran, riwayat: [], syarat_tutup: [] };
  return {
    ...t,
    grading,
    investigasi,
    tindak_lanjut: tindakLanjut.map((x) => tandaiTindakLanjut(x, n)),
    lampiran,
    riwayat,
    // Syarat yang belum terpenuhi (alasan penutupan diisi saat menutup, tidak dihitung di sini).
    syarat_tutup: row.status === "ditutup" ? [] : syaratTutup({ laporan: row, investigasi, tindakLanjut, alasan: "-" }),
    pengingat_lengkap: konfigurasiPengingatLengkap(p),
  };
};

rute.get(
  "/laporan/:uuid",
  izinIkp("READ", "LAPOR"),
  tanganiMutu(async (req, res) => {
    const hasil = await detail(req, req.params.uuid);
    await transaksi((k) => auditIkp(k, req, "ikp_laporan", hasil.uuid, "baca", null, null));
    kirim(res, hasil);
  }),
);

rute.put(
  "/laporan/:uuid",
  izinIkp("LAPOR", "TERIMA"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const isi = bacaIsian(b, false);
    if (b.anonim !== undefined) throw permintaanSalah("Pilihan anonim tidak dapat diubah setelah laporan dikirim");
    const unit = b.unit_uuid === undefined ? undefined : await cekUnitIkp(b.unit_uuid, f);
    const terima = await boleh(req, "TERIMA");
    await transaksi(async (k) => {
      const lama = await ambilLaporan(req.params.uuid, f, k, true);
      const sebagaiPelapor = milik(lama, req) && ["dilaporkan", "perlu_dilengkapi"].includes(lama.status);
      const sebagaiUnit = terima && ["dilaporkan", "perlu_dilengkapi", "diterima", "dinilai"].includes(lama.status);
      if (!sebagaiPelapor && !sebagaiUnit) {
        if (!terima && !milik(lama, req)) throw tidakDitemukan("Laporan insiden");
        throw konflik(`Laporan berstatus ${STATUS_LAPORAN[lama.status]} tidak dapat diubah`);
      }
      const kejadian = isi.waktu_kejadian ?? Number(lama.waktu_kejadian);
      const diketahui = isi.waktu_diketahui ?? (isi.waktu_kejadian !== undefined && Number(lama.waktu_diketahui) < kejadian ? kejadian : Number(lama.waktu_diketahui));
      cekWaktu(kejadian, diketahui, Number(lama.waktu_lapor));
      const perubahan = { ...isi, unit_uuid: unit, waktu_diketahui: diketahui };
      // Waktu lapor tidak berubah; status keterlambatan dihitung ulang bila waktu diketahui dikoreksi.
      perubahan.batas_lapor = batasLapor(diketahui, lama.tenggat_lapor_jam);
      perubahan.terlambat_lapor = terlambatLapor(diketahui, lama.waktu_lapor, lama.tenggat_lapor_jam);
      // Pelapor melengkapi laporan yang dikembalikan → kembali ke antrean kepala unit.
      if (lama.status === "perlu_dilengkapi" && milik(lama, req) && !sebagaiUnit) perubahan.status = "dilaporkan";
      const baru = await ubah("mutu_ikp_laporan", lama.uuid, f, perubahan, k);
      await auditIkp(k, req, "ikp_laporan", lama.uuid, "lengkapi", ringkasLaporan(lama), ringkasLaporan(baru), { anonim: lama.anonim && milik(lama, req) });
    });
    kirim(res, await detail(req, req.params.uuid), "Laporan insiden berhasil diperbarui");
  }),
);

rute.post(
  "/laporan/:uuid/terima",
  izinIkp("TERIMA"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const catatan = teks(req.body?.catatan, "catatan", 2000) ?? null;
    await transaksi(async (k) => {
      const lama = await ambilLaporan(req.params.uuid, f, k, true);
      if (!["dilaporkan", "perlu_dilengkapi"].includes(lama.status)) throw konflik(`Laporan berstatus ${STATUS_LAPORAN[lama.status]} tidak dapat diterima`);
      const baru = await ubah("mutu_ikp_laporan", lama.uuid, f, { status: "diterima", catatan_terima: catatan, diterima_oleh: req.author.username ?? null, diterima_pada: sekarang() }, k);
      await auditIkp(k, req, "ikp_laporan", lama.uuid, "terima", ringkasLaporan(lama), ringkasLaporan(baru));
    });
    kirim(res, await detail(req, req.params.uuid), "Laporan insiden diterima");
  }),
);

rute.post(
  "/laporan/:uuid/minta-lengkapi",
  izinIkp("TERIMA"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const alasan = teksWajib(req.body?.alasan, "alasan", 2000);
    await transaksi(async (k) => {
      const lama = await ambilLaporan(req.params.uuid, f, k, true);
      if (lama.status !== "dilaporkan") throw konflik("Hanya laporan berstatus Dilaporkan yang dapat dikembalikan ke pelapor");
      const baru = await ubah("mutu_ikp_laporan", lama.uuid, f, { status: "perlu_dilengkapi", alasan_perlu_lengkap: alasan }, k);
      await auditIkp(k, req, "ikp_laporan", lama.uuid, "minta_lengkapi", ringkasLaporan(lama), ringkasLaporan(baru));
    });
    kirim(res, await detail(req, req.params.uuid), "Laporan dikembalikan ke pelapor untuk dilengkapi");
  }),
);

rute.put(
  "/laporan/:uuid/pasien",
  izinIkp("LIHAT PASIEN"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const noReg = req.body?.no_reg;
    const rujukan = noReg ? await rujukanPasien(noReg, f) : { patient_uuid: null, no_reg: null };
    await transaksi(async (k) => {
      const lama = await ambilLaporan(req.params.uuid, f, k, true);
      if (lama.status === "ditutup") throw konflik("Laporan yang sudah ditutup tidak dapat diubah");
      await ubah("mutu_ikp_laporan", lama.uuid, f, rujukan, k);
      await auditIkp(k, req, "ikp_laporan", lama.uuid, noReg ? "tautkan_pasien" : "lepas_pasien", null, null);
    });
    kirim(res, await detail(req, req.params.uuid), noReg ? "Rujukan pasien ditautkan" : "Rujukan pasien dilepas");
  }),
);

rute.post(
  "/laporan/:uuid/tutup",
  izinIkp("TUTUP"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const alasan = teks(req.body?.alasan, "alasan", 2000) ?? null;
    await transaksi(async (k) => {
      const lama = await ambilLaporan(req.params.uuid, f, k, true);
      if (lama.status === "ditutup") throw konflik("Laporan sudah ditutup");
      const investigasi = await satu(`SELECT status FROM mutu_ikp_investigasi WHERE laporan_uuid = $1 AND deleted_at IS NULL`, [lama.uuid], k);
      const tindakLanjut = await query(`SELECT status FROM mutu_ikp_tindak_lanjut WHERE laporan_uuid = $1 AND deleted_at IS NULL`, [lama.uuid], k);
      const kurang = syaratTutup({ laporan: lama, investigasi, tindakLanjut, alasan });
      if (kurang.length) throw new Galat(409, `Laporan belum dapat ditutup: ${kurang.join("; ")}`);
      const baru = await ubah(
        "mutu_ikp_laporan",
        lama.uuid,
        f,
        { status: "ditutup", status_sebelum_tutup: lama.status, alasan_tutup: alasan, ditutup_oleh: req.author.username ?? null, ditutup_pada: sekarang() },
        k,
      );
      await auditIkp(k, req, "ikp_laporan", lama.uuid, "tutup", ringkasLaporan(lama), ringkasLaporan(baru));
    });
    kirim(res, await detail(req, req.params.uuid), "Laporan insiden ditutup");
  }),
);

rute.post(
  "/laporan/:uuid/buka-kembali",
  izinIkp("TUTUP"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const alasan = teksWajib(req.body?.alasan, "alasan", 2000);
    await transaksi(async (k) => {
      const lama = await ambilLaporan(req.params.uuid, f, k, true);
      if (lama.status !== "ditutup") throw konflik("Hanya laporan yang sudah ditutup yang dapat dibuka kembali");
      const baru = await ubah(
        "mutu_ikp_laporan",
        lama.uuid,
        f,
        { status: lama.status_sebelum_tutup || "investigasi", status_sebelum_tutup: null, ditutup_oleh: null, ditutup_pada: null, alasan_tutup: null },
        k,
      );
      await auditIkp(k, req, "ikp_laporan", lama.uuid, "buka_kembali", ringkasLaporan(lama), { ...ringkasLaporan(baru), alasan });
    });
    kirim(res, await detail(req, req.params.uuid), "Laporan insiden dibuka kembali");
  }),
);

// ── Lampiran (PDF/JPG/PNG, maks. MAX_UPLOAD_MUTU_MB; maks. 5 per laporan)
rute.post(
  "/laporan/:uuid/lampiran",
  izinIkp("LAPOR", "TERIMA"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const berkas = validasiBerkasMutu(req.body?.berkas ?? req.body, config.maxUploadMutuMb, TIPE_LAMPIRAN);
    const terima = await boleh(req, "TERIMA");
    const hasil = await transaksi(async (k) => {
      const lap = await ambilLaporan(req.params.uuid, f, k, true);
      const pelapor = milik(lap, req) && ["dilaporkan", "perlu_dilengkapi"].includes(lap.status);
      if (!pelapor && !terima) {
        if (!milik(lap, req)) throw tidakDitemukan("Laporan insiden");
        throw konflik("Lampiran hanya dapat ditambahkan pelapor sebelum laporan diterima unit");
      }
      if (lap.status === "ditutup") throw konflik("Laporan yang sudah ditutup tidak dapat diubah");
      const jumlah = await satu(`SELECT COUNT(*)::int AS n FROM mutu_ikp_lampiran WHERE laporan_uuid = $1 AND deleted_at IS NULL`, [lap.uuid], k);
      if (jumlah.n >= MAKS_LAMPIRAN) throw permintaanSalah(`Maksimal ${MAKS_LAMPIRAN} lampiran per laporan`);
      const baru = await sisipkanBerkas(
        "mutu_ikp_lampiran",
        { faskes_uuid: f, laporan_uuid: lap.uuid, ...infoBerkas(berkas), berkas: berkas.data, diunggah_oleh: lap.anonim && milik(lap, req) ? null : req.author.username ?? null },
        k,
      );
      await auditIkp(k, req, "ikp_lampiran", lap.uuid, "unggah_lampiran", null, { lampiran_uuid: baru.uuid, ...infoBerkas(berkas) }, { anonim: lap.anonim && milik(lap, req) });
      return { uuid: baru.uuid, ...infoBerkas(berkas) };
    });
    kirim(res, hasil, "Lampiran berhasil diunggah");
  }),
);

const ambilLampiran = async (req, kunci, k) => {
  const row = await satu(
    `SELECT a.uuid, a.laporan_uuid, a.nama_berkas, a.tipe_mime, a.ukuran_bita${kunci ? "" : ", a.berkas"}, l.dibuat_oleh
       FROM mutu_ikp_lampiran a JOIN mutu_ikp_laporan l ON l.uuid = a.laporan_uuid AND l.deleted_at IS NULL
      WHERE a.uuid = $1 AND a.faskes_uuid = $2 AND a.deleted_at IS NULL`,
    [String(req.params.uuid ?? ""), req.author.faskesUuid],
    k,
  );
  if (!row) throw tidakDitemukan("Lampiran");
  return row;
};

rute.get(
  "/lampiran/:uuid",
  izinIkp("READ", "LAPOR"),
  tanganiMutu(async (req, res) => {
    const row = await ambilLampiran(req, false);
    if (!(await boleh(req, "READ")) && !milik(row, req)) throw tidakDitemukan("Lampiran");
    await transaksi((k) => auditIkp(k, req, "ikp_lampiran", row.laporan_uuid, "unduh_lampiran", null, { lampiran_uuid: row.uuid }));
    kirim(res, { nama_berkas: row.nama_berkas, tipe_mime: row.tipe_mime, ukuran_bita: row.ukuran_bita, data_base64: row.berkas.toString("base64") });
  }),
);

rute.delete(
  "/lampiran/:uuid",
  izinIkp("TERIMA"),
  tanganiMutu(async (req, res) => {
    await transaksi(async (k) => {
      const row = await ambilLampiran(req, true, k);
      await query(`UPDATE mutu_ikp_lampiran SET deleted_at = $1, updated_at = $1 WHERE uuid = $2 AND faskes_uuid = $3`, [sekarang(), row.uuid, req.author.faskesUuid], k);
      await auditIkp(k, req, "ikp_lampiran", row.laporan_uuid, "hapus_lampiran", { lampiran_uuid: row.uuid, nama_berkas: row.nama_berkas }, null);
    });
    kirim(res, null, "Lampiran dihapus");
  }),
);

export { detail as detailLaporanIkp };
export default rute;
