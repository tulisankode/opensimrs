import express from "express";
import config from "../config.js";
import { query } from "../db.js";
import { kirim } from "../umum/respons.js";
import { wajibSalahSatu } from "../umum/izin.js";
import { pilihan } from "../sarpras/bersama.js";
import { JENIS_KREDENSIAL, MASA_BERLAKU, STATUS_KREDENSIAL, STATUS_VERIFIKASI, TIPE_BERKAS_KREDENSIAL } from "../mutu/bersama.js";
import { NAMA_PEGAWAI, tanganiMutu } from "../mutu/dasar.js";
import { buatRuteKredensial } from "../mutu/kredensial.js";
import { JENJANG_PENDIDIKAN, STATUS_KEPEGAWAIAN } from "./bersama.js";
import { FITUR_SDM, fiturSdmAktif, wajibFiturSdm } from "./fitur.js";
import kepegawaian from "./kepegawaian.js";
import kehadiranCuti from "./kehadiran-cuti/rute.js";
import jadwalDinas from "./jadwal-dinas/rute.js";
import penggajian from "./penggajian/rute.js";
import pelatihan from "./pelatihan/rute.js";

// HR / SDM — /api/v3/penunjang/hr/... (STD-0035 kepegawaian/kredensial, STD-0040 pelatihan, STD-0041 penggajian).
//   /referensi    pilihan enum, unit kerja, pegawai & practitioner aktif, batas berkas, status fitur
//   /kepegawaian  data kepegawaian tertaut pegawai Datamaster + riwayat + pendidikan (kepegawaian.js)
//   /kredensial   kredensial pegawai — SATU sumber dengan Mutu & Akreditasi › Kredensial Staf (tabel mutu_kredensial,
//                 router yang sama dari mutu/kredensial.js) dengan izin "HR / SDM › Kredensial"
//   /pelatihan    katalog, kegiatan, peserta, hasil, sertifikat, kebijakan dan rekap diklat
//   /penggajian   komponen gaji, konfigurasi BPJS/PPh 21, periode, slip, rekap dan ekspor bank (fitur sendiri di penggajian/rute.js)
// Seluruh rute mensyaratkan modul sdm aktif (fitur wajib sdm_kepegawaian); /kredensial juga fitur sdm_kredensial.
// Kehadiran/cuti, jadwal dinas, pelatihan, dan penggajian memakai fitur dan pemeriksaan izin tersendiri.
const rute = express.Router();
const MODUL = "HR / SDM";

const kredensial = buatRuteKredensial({
  modul: MODUL,
  submodul: "Kredensial",
  aksi: { READ: "READ", CREATE: "CREATE", UPDATE: "UPDATE", BERKAS: "UNGGAH DOKUMEN", VERIFIKASI: "VERIFIKASI", CABUT: "CABUT", DELETE: "DELETE" },
  berkasSaatCatat: true,
});

rute.use("/penggajian", penggajian);
rute.use(wajibFiturSdm("sdm_kepegawaian"));

rute.get(
  "/referensi",
  wajibSalahSatu([MODUL, "Kepegawaian", "READ"], [MODUL, "Kredensial", "READ"]),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const fitur = {};
    for (const kode of FITUR_SDM) fitur[kode] = await fiturSdmAktif(kode, f);
    kirim(res, {
      status_kepegawaian: pilihan(STATUS_KEPEGAWAIAN),
      jenjang_pendidikan: pilihan(JENJANG_PENDIDIKAN),
      jenis_kredensial: pilihan(JENIS_KREDENSIAL),
      status_kredensial: pilihan(STATUS_KREDENSIAL),
      status_verifikasi: pilihan(STATUS_VERIFIKASI),
      masa_berlaku: pilihan(MASA_BERLAKU),
      lokasi: await query(`SELECT uuid, name AS nama FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [f]),
      pegawai: await query(`SELECT p.uuid, ${NAMA_PEGAWAI("p")} AS nama FROM pegawai p WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.status = true ORDER BY p.name`, [f]),
      practitioner: await query(
        `SELECT pr.uuid, pr.pegawai_uuid, pr.str, pr.sip FROM practitioner pr WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND pr.status = true AND pr.pegawai_uuid IS NOT NULL`,
        [f],
      ),
      berkas: { maks_mb: config.maxUploadMutuMb, tipe_kredensial: TIPE_BERKAS_KREDENSIAL },
      fitur,
    });
  }),
);

rute.use("/kepegawaian", kepegawaian);
rute.use("/kehadiran-cuti", wajibFiturSdm("sdm_kehadiran"), kehadiranCuti);
rute.use("/jadwal-dinas", wajibFiturSdm("sdm_jadwal_dinas"), jadwalDinas);
rute.use("/kredensial", wajibFiturSdm("sdm_kredensial"), kredensial);
rute.use("/pelatihan", wajibFiturSdm("sdm_pelatihan"), pelatihan);

export default rute;
