import express from "express";
import { query, satu, ubah, sisipkan, sekarang, transaksi } from "../db.js";
import { kirim, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { wajibSalahSatu } from "../umum/izin.js";
import { cekPilihan, epochOpsional, epochWajib, konflik, teks, teksWajib } from "./bersama.js";
import { STATUS_DAPAT_DIGRADING, STATUS_LAPORAN, STATUS_TINDAK_LANJUT, batasInvestigasi, gradeDariMatriks, jenisInvestigasiUntuk } from "./ikp-bersama.js";
import { tanganiMutu } from "./dasar.js";
import { MODUL, SUB, ambilLaporan, auditIkp, cekPic, pengaturanFaskes, ringkasLaporan } from "./ikp-dasar.js";
import { detailLaporanIkp } from "./ikp-laporan.js";

// Grading, investigasi/RCA, dan tindak lanjut laporan IKP (STD-0026) — izin "Mutu & Akreditasi › Insiden Keselamatan Pasien":
//   POST /ikp/laporan/:uuid/grading             dampak × probabilitas → grade (matriks aktif faskes); grading ulang
//                                                wajib alasan, riwayat lama tetap tersimpan                   GRADING
//   PUT  /ikp/laporan/:uuid/investigasi          catat/ubah investigasi (jenis ditentukan server: RCA untuk
//                                                kuning/merah/sentinel, selain itu investigasi sederhana)    INVESTIGASI
//   POST /ikp/laporan/:uuid/investigasi/selesai  selesaikan (RCA wajib akar masalah, rekomendasi, ≥ 1 tindak lanjut)  INVESTIGASI
//   POST /ikp/laporan/:uuid/investigasi/buka     buka kembali investigasi yang selesai (alasan wajib)        INVESTIGASI
//   POST /ikp/laporan/:uuid/tindak-lanjut        rekomendasi/tindak lanjut (uraian, PIC pegawai, tenggat)     TINDAK LANJUT
//   PUT  /ikp/tindak-lanjut/:uuid                ubah / perbarui progres & status (selesai → hasil wajib)     TINDAK LANJUT
//   DELETE /ikp/tindak-lanjut/:uuid              hapus lunak (belum terverifikasi)                            TINDAK LANJUT
//   POST /ikp/tindak-lanjut/:uuid/verifikasi     verifikasi hasil tindak lanjut yang sudah selesai           VERIFIKASI
// Tenggat yang lewat hanya ditandai (terlambat), tidak menutup apa pun otomatis.
const rute = express.Router();
const izinIkp = (...aksi) => wajibSalahSatu(...aksi.map((a) => [MODUL, SUB, a]));
const terkunci = (lap) => {
  if (lap.status === "ditutup") throw konflik("Laporan yang sudah ditutup tidak dapat diubah; buka kembali terlebih dahulu");
};

rute.post(
  "/laporan/:uuid/grading",
  izinIkp("GRADING"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    await transaksi(async (k) => {
      const lap = await ambilLaporan(req.params.uuid, f, k, true);
      terkunci(lap);
      if (!STATUS_DAPAT_DIGRADING.includes(lap.status)) throw konflik(`Laporan berstatus ${STATUS_LAPORAN[lap.status]} belum dapat digrading (terima laporan terlebih dahulu)`);
      const p = await pengaturanFaskes(f, k);
      const { skor, grade } = gradeDariMatriks(b.dampak, b.probabilitas, p.matriks);
      const lama = await satu(`SELECT * FROM mutu_ikp_grading WHERE laporan_uuid = $1 AND aktif AND deleted_at IS NULL FOR UPDATE`, [lap.uuid], k);
      const alasan = teks(b.alasan, "alasan", 2000) ?? null;
      if (lama && !alasan) throw permintaanSalah("alasan wajib diisi untuk grading ulang");
      const investigasi = await satu(`SELECT uuid, jenis, status FROM mutu_ikp_investigasi WHERE laporan_uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [lap.uuid], k);
      const jenisBaru = jenisInvestigasiUntuk(lap.jenis_insiden, grade);
      if (investigasi?.status === "selesai" && investigasi.jenis === "sederhana" && jenisBaru === "rca")
        throw konflik("Investigasi sederhana sudah selesai; grade baru mewajibkan RCA — buka kembali investigasi sebelum grading ulang");
      const n = sekarang();
      if (lama) await query(`UPDATE mutu_ikp_grading SET aktif = false, updated_at = $1 WHERE uuid = $2`, [n, lama.uuid], k);
      const g = await sisipkan(
        "mutu_ikp_grading",
        { faskes_uuid: f, laporan_uuid: lap.uuid, dampak: Number(b.dampak), probabilitas: Number(b.probabilitas), skor, grade, versi_matriks: p.versi_matriks, aktif: true, alasan, dinilai_oleh: req.author.username ?? null, dinilai_pada: n },
        k,
      );
      // Investigasi berjalan menyesuaikan jenis yang diwajibkan grade baru.
      if (investigasi && investigasi.status === "berjalan" && investigasi.jenis !== jenisBaru) await ubah("mutu_ikp_investigasi", investigasi.uuid, f, { jenis: jenisBaru }, k);
      const baru = await ubah(
        "mutu_ikp_laporan",
        lap.uuid,
        f,
        { grade, skor, dinilai_pada: n, batas_investigasi: batasInvestigasi(n, lap.jenis_insiden, grade, p.tenggat_investigasi_hari), status: lap.status === "diterima" ? "dinilai" : lap.status },
        k,
      );
      await auditIkp(k, req, "ikp_grading", lap.uuid, lama ? "grading_ulang" : "grading", lama ? { grade: lama.grade, skor: lama.skor } : null, {
        grading_uuid: g.uuid,
        dampak: g.dampak,
        probabilitas: g.probabilitas,
        grade,
        skor,
        versi_matriks: g.versi_matriks,
        alasan,
        status: baru.status,
      });
    });
    kirim(res, await detailLaporanIkp(req, req.params.uuid), "Grading risiko tersimpan");
  }),
);

rute.put(
  "/laporan/:uuid/investigasi",
  izinIkp("INVESTIGASI"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const isi = {
      tim: teks(b.tim, "tim", 2000),
      penyebab_langsung: teks(b.penyebab_langsung, "penyebab_langsung", 5000),
      akar_masalah: teks(b.akar_masalah, "akar_masalah", 10000),
      analisis: teks(b.analisis, "analisis", 10000),
      rekomendasi: teks(b.rekomendasi, "rekomendasi", 5000),
    };
    await transaksi(async (k) => {
      const lap = await ambilLaporan(req.params.uuid, f, k, true);
      terkunci(lap);
      if (!lap.grade) throw konflik("Laporan harus digrading sebelum investigasi dicatat");
      const lama = await satu(`SELECT * FROM mutu_ikp_investigasi WHERE laporan_uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [lap.uuid], k);
      if (lama?.status === "selesai") throw konflik("Investigasi sudah selesai");
      const jenis = jenisInvestigasiUntuk(lap.jenis_insiden, lap.grade);
      const inv = lama
        ? await ubah("mutu_ikp_investigasi", lama.uuid, f, { ...isi, jenis }, k)
        : await sisipkan("mutu_ikp_investigasi", { faskes_uuid: f, laporan_uuid: lap.uuid, jenis, status: "berjalan", ...Object.fromEntries(Object.entries(isi).map(([c, v]) => [c, v ?? null])), dicatat_oleh: req.author.username ?? null }, k);
      if (lap.status !== "investigasi") await ubah("mutu_ikp_laporan", lap.uuid, f, { status: "investigasi" }, k);
      await auditIkp(k, req, "ikp_investigasi", lap.uuid, lama ? "ubah_investigasi" : "catat_investigasi", null, { investigasi_uuid: inv.uuid, jenis, status: inv.status });
    });
    kirim(res, await detailLaporanIkp(req, req.params.uuid), "Investigasi tersimpan");
  }),
);

rute.post(
  "/laporan/:uuid/investigasi/selesai",
  izinIkp("INVESTIGASI"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const lap = await ambilLaporan(req.params.uuid, f, k, true);
      terkunci(lap);
      const inv = await satu(`SELECT * FROM mutu_ikp_investigasi WHERE laporan_uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [lap.uuid], k);
      if (!inv) throw konflik("Investigasi belum dicatat");
      if (inv.status === "selesai") throw konflik("Investigasi sudah selesai");
      const kurang = [];
      if (inv.jenis === "rca") {
        if (!inv.akar_masalah) kurang.push("akar masalah");
        if (!inv.rekomendasi) kurang.push("rekomendasi");
        const tl = await satu(`SELECT COUNT(*)::int AS n FROM mutu_ikp_tindak_lanjut WHERE laporan_uuid = $1 AND deleted_at IS NULL`, [lap.uuid], k);
        if (!tl.n) kurang.push("minimal satu rencana tindak lanjut (PIC & tenggat)");
      } else {
        if (!inv.penyebab_langsung) kurang.push("penyebab langsung");
        if (!inv.rekomendasi) kurang.push("rekomendasi / tindakan");
      }
      if (kurang.length) throw konflik(`${inv.jenis === "rca" ? "RCA" : "Investigasi sederhana"} belum lengkap: ${kurang.join(", ")}`);
      await ubah("mutu_ikp_investigasi", inv.uuid, f, { status: "selesai", diselesaikan_oleh: req.author.username ?? null, diselesaikan_pada: sekarang() }, k);
      await auditIkp(k, req, "ikp_investigasi", lap.uuid, "selesai_investigasi", { status: inv.status }, { investigasi_uuid: inv.uuid, jenis: inv.jenis, status: "selesai" });
    });
    kirim(res, await detailLaporanIkp(req, req.params.uuid), "Investigasi diselesaikan");
  }),
);

rute.post(
  "/laporan/:uuid/investigasi/buka",
  izinIkp("INVESTIGASI"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const alasan = teksWajib(req.body?.alasan, "alasan", 2000);
    await transaksi(async (k) => {
      const lap = await ambilLaporan(req.params.uuid, f, k, true);
      terkunci(lap);
      const inv = await satu(`SELECT * FROM mutu_ikp_investigasi WHERE laporan_uuid = $1 AND deleted_at IS NULL FOR UPDATE`, [lap.uuid], k);
      if (inv?.status !== "selesai") throw konflik("Hanya investigasi yang sudah selesai yang dapat dibuka kembali");
      const jenis = jenisInvestigasiUntuk(lap.jenis_insiden, lap.grade);
      await ubah("mutu_ikp_investigasi", inv.uuid, f, { status: "berjalan", jenis, diselesaikan_oleh: null, diselesaikan_pada: null }, k);
      await auditIkp(k, req, "ikp_investigasi", lap.uuid, "buka_investigasi", { status: inv.status, jenis: inv.jenis }, { investigasi_uuid: inv.uuid, jenis, status: "berjalan", alasan });
    });
    kirim(res, await detailLaporanIkp(req, req.params.uuid), "Investigasi dibuka kembali");
  }),
);

rute.post(
  "/laporan/:uuid/tindak-lanjut",
  izinIkp("TINDAK LANJUT"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const uraian = teksWajib(b.uraian, "uraian", 5000);
    const tenggat = epochWajib(b.tenggat, "tenggat");
    await transaksi(async (k) => {
      const lap = await ambilLaporan(req.params.uuid, f, k, true);
      terkunci(lap);
      if (!lap.grade) throw konflik("Laporan harus digrading sebelum tindak lanjut dicatat");
      const pic = await cekPic(b.pic_pegawai_uuid, f, k);
      const tl = await sisipkan(
        "mutu_ikp_tindak_lanjut",
        { faskes_uuid: f, laporan_uuid: lap.uuid, uraian, pic_pegawai_uuid: pic, tenggat, status: "rencana", dibuat_oleh: req.author.username ?? null },
        k,
      );
      await auditIkp(k, req, "ikp_tindak_lanjut", lap.uuid, "buat_tindak_lanjut", null, { tindak_lanjut_uuid: tl.uuid, pic_pegawai_uuid: pic, tenggat, status: tl.status });
    });
    kirim(res, await detailLaporanIkp(req, req.params.uuid), "Tindak lanjut tersimpan");
  }),
);

const ambilTindakLanjut = async (uuid, f, k) => {
  const tl = await satu(`SELECT * FROM mutu_ikp_tindak_lanjut WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL FOR UPDATE`, [String(uuid ?? ""), f], k);
  if (!tl) throw tidakDitemukan("Tindak lanjut");
  const lap = await ambilLaporan(tl.laporan_uuid, f, k, true);
  terkunci(lap);
  return { tl, lap };
};

rute.put(
  "/tindak-lanjut/:uuid",
  izinIkp("TINDAK LANJUT"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const status = cekPilihan(b.status, STATUS_TINDAK_LANJUT, "status");
    if (status === "terverifikasi") throw permintaanSalah("Status terverifikasi hanya melalui verifikasi");
    const laporanUuid = await transaksi(async (k) => {
      const { tl, lap } = await ambilTindakLanjut(req.params.uuid, f, k);
      if (tl.status === "terverifikasi") throw konflik("Tindak lanjut yang sudah terverifikasi tidak dapat diubah");
      const perubahan = {
        uraian: b.uraian === undefined ? undefined : teksWajib(b.uraian, "uraian", 5000),
        pic_pegawai_uuid: b.pic_pegawai_uuid === undefined ? undefined : await cekPic(b.pic_pegawai_uuid, f, k),
        tenggat: b.tenggat === undefined ? undefined : epochOpsional(b.tenggat, "tenggat") ?? tl.tenggat,
        progres: teks(b.progres, "progres", 5000),
        hasil: teks(b.hasil, "hasil", 5000),
        status: status ?? undefined,
      };
      const hasilAkhir = perubahan.hasil === undefined ? tl.hasil : perubahan.hasil;
      if ((status ?? tl.status) === "selesai" && !hasilAkhir) throw permintaanSalah("hasil wajib diisi bila tindak lanjut selesai");
      const baru = await ubah("mutu_ikp_tindak_lanjut", tl.uuid, f, perubahan, k);
      await auditIkp(k, req, "ikp_tindak_lanjut", lap.uuid, "ubah_tindak_lanjut", { status: tl.status, tenggat: tl.tenggat }, { tindak_lanjut_uuid: tl.uuid, status: baru.status, tenggat: baru.tenggat });
      return lap.uuid;
    });
    kirim(res, await detailLaporanIkp(req, laporanUuid), "Tindak lanjut diperbarui");
  }),
);

rute.delete(
  "/tindak-lanjut/:uuid",
  izinIkp("TINDAK LANJUT"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const laporanUuid = await transaksi(async (k) => {
      const { tl, lap } = await ambilTindakLanjut(req.params.uuid, f, k);
      if (tl.status === "terverifikasi") throw konflik("Tindak lanjut yang sudah terverifikasi tidak dapat dihapus");
      await query(`UPDATE mutu_ikp_tindak_lanjut SET deleted_at = $1, updated_at = $1 WHERE uuid = $2`, [sekarang(), tl.uuid], k);
      await auditIkp(k, req, "ikp_tindak_lanjut", lap.uuid, "hapus_tindak_lanjut", { tindak_lanjut_uuid: tl.uuid, status: tl.status }, null);
      return lap.uuid;
    });
    kirim(res, await detailLaporanIkp(req, laporanUuid), "Tindak lanjut dihapus");
  }),
);

rute.post(
  "/tindak-lanjut/:uuid/verifikasi",
  izinIkp("VERIFIKASI"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const catatan = teks(req.body?.catatan, "catatan", 2000) ?? null;
    const laporanUuid = await transaksi(async (k) => {
      const { tl, lap } = await ambilTindakLanjut(req.params.uuid, f, k);
      if (tl.status !== "selesai") throw konflik("Hanya tindak lanjut berstatus Selesai yang dapat diverifikasi");
      await ubah("mutu_ikp_tindak_lanjut", tl.uuid, f, { status: "terverifikasi", catatan_verifikasi: catatan, diverifikasi_oleh: req.author.username ?? null, diverifikasi_pada: sekarang() }, k);
      await auditIkp(k, req, "ikp_tindak_lanjut", lap.uuid, "verifikasi_tindak_lanjut", { status: tl.status }, { tindak_lanjut_uuid: tl.uuid, status: "terverifikasi" });
      return lap.uuid;
    });
    kirim(res, await detailLaporanIkp(req, laporanUuid), "Tindak lanjut terverifikasi");
  }),
);

export default rute;
