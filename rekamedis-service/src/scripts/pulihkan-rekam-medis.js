// Pemulihan rekam medis yang hilang.
//
// Kunjungan (rawat jalan, rawat inap, IGD) di PostgreSQL menyimpan rekam_medis_uuid yang menunjuk dokumen
// MongoDB. Bila dokumennya tidak ada (mis. data PostgreSQL dipulihkan dari schema.sql tanpa data MongoDB),
// RME pasien tidak bisa dibuka dari modul mana pun (404 "Rekam Medis tidak ditemukan"), sedangkan alur
// pembuatan rekam medis hanya berjalan bila rekam_medis_uuid kosong.
//
// Skrip ini membuat dokumen rekam medis KOSONG dengan _id yang sama seperti rujukan di PostgreSQL,
// sehingga rujukan tetap konsisten dan RME dapat dibuka. Isi klinis lama TIDAK dapat dipulihkan.
//
// Pemakaian (dari folder rekamedis-service, memakai .env layanan ini):
//   node src/scripts/pulihkan-rekam-medis.js             → uji coba, hanya laporan
//   node src/scripts/pulihkan-rekam-medis.js --terapkan  → buat dokumen yang hilang
import mongoose from "mongoose";
import { QueryTypes } from "sequelize";
import mongooseInstance from "../configurations/mongoose-instance.js";
import sequelizeInstance from "../configurations/sequelize-instance.js";
import RekamMedisModel from "../models/mongos/rekam-medis-model.js";
import SessionModel from "../models/mongos/session-model.js";

const TERAPKAN = process.argv.includes("--terapkan");
const TZ_OFFSET_DETIK = 7 * 3600; // tanggal kunjungan dibaca sebagai WIB

const TABEL = [
  { tabel: "rawat_jalans", pelayanan: "rj" },
  { tabel: "rawat_inaps", pelayanan: "ri" },
  { tabel: "instalasi_gawat_darurats", pelayanan: "igd" },
];

const keTanggal = (epoch) => {
  const n = Number(epoch);
  const detik = n > 1e12 ? Math.floor(n / 1000) : n;
  const d = new Date(((detik || Math.floor(Date.now() / 1000)) + TZ_OFFSET_DETIK) * 1000);
  return d.toISOString().slice(0, 10);
};

const main = async () => {
  await mongooseInstance();
  const laporan = { diperiksa: 0, sudahAda: 0, dibuat: 0, idTidakValid: [], gagal: [] };

  for (const { tabel, pelayanan } of TABEL) {
    const kunjungan = await sequelizeInstance.query(
      `SELECT uuid, rekam_medis_uuid, no_pelayanan, lokasi_uuid, tanggal_daftar, no_reg, no_rm, faskes_uuid, payment_method
       FROM ${tabel} WHERE rekam_medis_uuid IS NOT NULL AND deleted_at IS NULL`,
      { type: QueryTypes.SELECT }
    );

    for (const k of kunjungan) {
      laporan.diperiksa++;
      if (!mongoose.Types.ObjectId.isValid(k.rekam_medis_uuid) || String(k.rekam_medis_uuid).length !== 24) {
        laporan.idTidakValid.push(`${tabel}:${k.no_pelayanan} (${k.rekam_medis_uuid})`);
        continue;
      }
      const ada = await RekamMedisModel.exists({ _id: k.rekam_medis_uuid });
      if (ada) {
        laporan.sudahAda++;
        continue;
      }
      if (!k.no_pelayanan || !k.no_reg || !k.no_rm || !k.faskes_uuid) {
        laporan.gagal.push(`${tabel}:${k.uuid} data kunjungan tidak lengkap`);
        continue;
      }

      console.log(`${TERAPKAN ? "buat" : "akan dibuat"}: ${pelayanan} ${k.no_pelayanan} RM ${k.no_rm} → ${k.rekam_medis_uuid}`);
      if (!TERAPKAN) {
        laporan.dibuat++;
        continue;
      }

      try {
        const sesi = await new SessionModel().save();
        await new RekamMedisModel({
          _id: new mongoose.Types.ObjectId(k.rekam_medis_uuid),
          daily_records: [{ sessions: [sesi._id], date: keTanggal(k.tanggal_daftar) }],
          faskes_uuid: k.faskes_uuid,
          no_reg: k.no_reg,
          no_rm: k.no_rm,
          no_pelayanan: k.no_pelayanan,
          pelayanan,
          lokasi_uuid: k.lokasi_uuid,
          payment_method: k.payment_method,
        }).save();
        laporan.dibuat++;
      } catch (error) {
        laporan.gagal.push(`${tabel}:${k.no_pelayanan} ${error.message}`);
      }
    }
  }

  console.log("\n=== Ringkasan pemulihan rekam medis", TERAPKAN ? "(DITERAPKAN)" : "(UJI COBA)", "===");
  console.log(`kunjungan diperiksa : ${laporan.diperiksa}`);
  console.log(`rekam medis sudah ada: ${laporan.sudahAda}`);
  console.log(`${TERAPKAN ? "dibuat" : "akan dibuat"}          : ${laporan.dibuat}`);
  if (laporan.idTidakValid.length) console.log("ID tidak valid       :", laporan.idTidakValid.join(", "));
  if (laporan.gagal.length) console.log("gagal                :", laporan.gagal.join("; "));

  await mongoose.disconnect();
  await sequelizeInstance.close();
};

main().catch((error) => {
  console.error("Pemulihan gagal:", error);
  process.exit(1);
});
