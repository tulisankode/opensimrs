import "dotenv/config";

const angka = (nilai, bawaan) => (nilai !== undefined && nilai !== "" && Number.isFinite(Number(nilai)) ? Number(nilai) : bawaan);

// Alamat web service BPJS (JKN API Gateway)
const PCARE = {
  development: "https://apijkn-dev.bpjs-kesehatan.go.id/pcare-rest-dev",
  production: "https://apijkn.bpjs-kesehatan.go.id/pcare-rest",
};

const VCLAIM = {
  development: "https://apijkn-dev.bpjs-kesehatan.go.id/vclaim-rest-dev",
  production: "https://apijkn.bpjs-kesehatan.go.id/vclaim-rest",
};

const lingkungan = process.env.BPJS_LINGKUNGAN === "production" ? "production" : "development";

export default {
  port: angka(process.env.APPLICATION_PORT ?? process.env.PORT, 8098),
  host: process.env.APPLICATION_HOST || "0.0.0.0",
  basePath: "/api/v3/bpjs",
  secretKey: process.env.SECRET_KEY,
  // kunci enkripsi rahasia BPJS di database; bawaan diturunkan dari SECRET_KEY
  kunciRahasia: process.env.BPJS_KUNCI_RAHASIA || process.env.SECRET_KEY,

  // mock = respons tiruan terenkripsi seperti BPJS (pengujian), tidak menulis kode BPJS ke database
  mode: process.env.BPJS_MODE || "nyata",
  lingkungan,
  pcareUrl: process.env.BPJS_PCARE_URL || PCARE[lingkungan],
  // Katalog PCare: POST/PUT memakai Content-Type text/plain berisi JSON
  pcareContentType: process.env.BPJS_PCARE_CONTENT_TYPE || "text/plain",
  vclaimUrl: process.env.BPJS_VCLAIM_URL || VCLAIM[lingkungan],
  timeoutMs: angka(process.env.BPJS_TIMEOUT_MS, 30000),

  pekerjaAktif: process.env.BPJS_PEKERJA !== "false",
  pekerjaIntervalMenit: angka(process.env.BPJS_INTERVAL_MENIT, 10),
  pekerjaRentangHari: angka(process.env.BPJS_RENTANG_HARI, 3),
  maksPercobaan: angka(process.env.BPJS_MAKS_PERCOBAAN, 5),

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
