import "dotenv/config";

const angka = (nilai, bawaan) => (Number.isFinite(Number(nilai)) && nilai !== "" && nilai != null ? Number(nilai) : bawaan);

// Alamat SATUSEHAT per lingkungan. Sandbox = staging Kemenkes (api-satusehat-stg).
const ALAMAT = {
  sandbox: "https://api-satusehat-stg.dto.kemkes.go.id",
  produksi: "https://api-satusehat.kemkes.go.id",
};

const lingkungan = process.env.SATUSEHAT_LINGKUNGAN || "sandbox";
const dasar = process.env.SATUSEHAT_BASE_URL || ALAMAT[lingkungan] || ALAMAT.sandbox;

export default {
  port: angka(process.env.APPLICATION_PORT ?? process.env.PORT, 8097),
  host: process.env.APPLICATION_HOST || "0.0.0.0",
  basePath: "/api/v3/satusehat",
  secretKey: process.env.SECRET_KEY,

  // mock = tidak memanggil Kemenkes (untuk pengujian otomatis/pengembangan)
  mode: process.env.SATUSEHAT_MODE || "nyata",
  lingkungan,
  authUrl: process.env.SATUSEHAT_AUTH_URL || `${dasar}/oauth2/v1`,
  fhirUrl: process.env.SATUSEHAT_FHIR_URL || `${dasar}/fhir-r4/v1`,
  timeoutMs: angka(process.env.SATUSEHAT_TIMEOUT_MS, 30000),

  // pekerja sinkronisasi otomatis
  pekerjaAktif: process.env.SATUSEHAT_PEKERJA !== "false",
  pekerjaIntervalMenit: angka(process.env.SATUSEHAT_INTERVAL_MENIT, 15),
  pekerjaRentangHari: angka(process.env.SATUSEHAT_RENTANG_HARI, 7),
  maksPercobaan: angka(process.env.SATUSEHAT_MAKS_PERCOBAAN, 5),

  pg: {
    host: process.env.DB_HOST || "localhost",
    port: angka(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  },
  mongo: {
    host: process.env.MONGO_DB_HOST || "localhost",
    port: angka(process.env.MONGO_DB_PORT, 27017),
    database: process.env.MONGO_DB_NAME || "opensimrs",
    user: process.env.MONGO_DB_USERNAME,
    password: process.env.MONGO_DB_PASSWORD,
    authSource: process.env.MONGO_DB_AUTH_SOURCE || "admin",
  },
};
