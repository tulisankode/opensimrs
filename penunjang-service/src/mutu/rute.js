import express from "express";
import config from "../config.js";
import { query } from "../db.js";
import { kirim } from "../umum/respons.js";
import { wajibSalahSatu } from "../umum/izin.js";
import { JENIS_DOKUMEN, JENIS_KREDENSIAL, MASA_BERLAKU, STATUS_DOKUMEN, STATUS_KREDENSIAL, STATUS_VERIFIKASI, TIPE_BERKAS_DOKUMEN, TIPE_BERKAS_KREDENSIAL, pilihan } from "./bersama.js";
import { FITUR_MUTU, fiturMutuAktif, wajibFiturMutu } from "./fitur.js";
import { NAMA_PEGAWAI, tanganiMutu } from "./dasar.js";
import instrumen from "./instrumen.js";
import dokumen from "./dokumen.js";
import kredensial from "./kredensial.js";
import dasbor from "./dasbor.js";
import surveior from "./surveior.js";

// Mutu & Akreditasi — /api/v3/penunjang/mutu/...
// Fitur mutu_dokumen_kredensial (STD-0028):
//   /referensi                          pilihan enum, pegawai & practitioner aktif, batas berkas, status fitur
//   /instrumen, /bab, /standar, /elemen instrumen akreditasi faskes (instrumen.js)
//   /dokumen                            dokumen akreditasi, versi, pemetaan, tinjauan, surveior (dokumen.js)
//   /kredensial                         kredensial staf (kredensial.js)
//   /dasbor                             dasbor kesiapan (dasbor.js)
//   /surveior                           akses baca surveior (surveior.js)
// Seluruh rute fitur ini mensyaratkan fitur mutu_dokumen_kredensial (dan modul mutu) aktif untuk faskes (403 bila
// tidak); izin diperiksa per rute (Setting › Hak Akses, modul "Mutu & Akreditasi"). Fitur mutu berikutnya (indikator
// mutu, IKP, PPI) memasang router & gerbang fiturnya sendiri di sini tanpa mengubah rute fitur ini.
const rute = express.Router();
const MODUL = "Mutu & Akreditasi";
const fiturDokumen = wajibFiturMutu("mutu_dokumen_kredensial");

rute.get(
  "/referensi",
  fiturDokumen,
  wajibSalahSatu(
    [MODUL, "Instrumen Akreditasi", "READ"],
    [MODUL, "Dokumen Akreditasi", "READ"],
    [MODUL, "Kredensial Staf", "READ"],
    [MODUL, "Dasbor Kesiapan", "READ"],
    [MODUL, "Akses Surveior", "READ"],
  ),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const fitur = {};
    for (const kode of FITUR_MUTU) fitur[kode] = await fiturMutuAktif(kode, f);
    kirim(res, {
      jenis_dokumen: pilihan(JENIS_DOKUMEN),
      status_dokumen: pilihan(STATUS_DOKUMEN),
      jenis_kredensial: pilihan(JENIS_KREDENSIAL),
      status_kredensial: pilihan(STATUS_KREDENSIAL),
      status_verifikasi: pilihan(STATUS_VERIFIKASI),
      masa_berlaku: pilihan(MASA_BERLAKU),
      pegawai: await query(`SELECT p.uuid, ${NAMA_PEGAWAI("p")} AS nama FROM pegawai p WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.status = true ORDER BY p.name`, [f]),
      practitioner: await query(
        `SELECT pr.uuid, pr.pegawai_uuid, pr.str, pr.sip FROM practitioner pr WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND pr.status = true AND pr.pegawai_uuid IS NOT NULL`,
        [f],
      ),
      berkas: { maks_mb: config.maxUploadMutuMb, tipe_dokumen: TIPE_BERKAS_DOKUMEN, tipe_kredensial: TIPE_BERKAS_KREDENSIAL },
      fitur,
    });
  }),
);

rute.use("/dokumen", fiturDokumen, dokumen);
rute.use("/kredensial", fiturDokumen, kredensial);
rute.use("/dasbor", fiturDokumen, dasbor);
rute.use("/surveior", fiturDokumen, surveior);
// instrumen.js memasang gerbang fiturnya sendiri pada /instrumen, /bab, /standar, /elemen (rute lain diteruskan).
rute.use(instrumen);

export default rute;
