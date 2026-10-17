import { MongoClient, ObjectId } from "mongodb";
import config from "../config.js";

// Koneksi MongoDB (rekam medis) khusus untuk menyusun LB1: diagnosis kunjungan tersimpan di `rekam_medises`
// (koleksi rekamedis-service), bukan di PostgreSQL. Dipakai hanya-baca oleh Laporan Dinkes.
let klien = null;

const ambilKlien = async () => {
  if (!klien) {
    klien = new MongoClient(config.mongo.uri);
    await klien.connect();
  }
  return klien;
};

export const koleksiRekamMedis = async () => {
  const c = await ambilKlien();
  return c.db(config.mongo.database).collection("rekam_medises");
};

export const idValid = (v) => typeof v === "string" && /^[0-9a-f]{24}$/i.test(v);
export const keObjectId = (v) => new ObjectId(v);

process.on("SIGINT", async () => {
  if (klien) await klien.close();
  process.exit(0);
});
