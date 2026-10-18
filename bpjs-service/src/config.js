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
  // STD-0020 — pemetaan field MCU PCare (bpjs-service/src/pcare-peta.js#buatMcu) masih berupa draf yang belum
  // dikonfirmasi ke spesifikasi resmi PCare (field, satuan, nilai kosong). Di luar mode mock, pengiriman MCU PCare
  // ditolak (DataBelumLengkap) sampai flag ini diaktifkan secara eksplisit setelah pemetaan dipastikan — lihat
  // bpjs-service/src/pcare.js#operasiMcu dan Rancangan Teknis STD-0020 §"Keputusan desain".
  mcuPcareDikonfirmasi: process.env.BPJS_MCU_PCARE_DIKONFIRMASI === "true",
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

  // Antrean Online BPJS (Mobile JKN): layanan antrian-service dipanggil lewat endpoint "mobile" (x-api-key,
  // tanpa JWT) yang sudah ada untuk membuat pendaftaran & membatalkan booking — lihat antrean-service.js.
  antrianApiUrl:
    process.env.BASE_URL_API_ANTRIAN || process.env.BASE_URL_ANTRIAN || process.env.ANTRIAN_SERVICE_URL || "http://localhost:8082/api/v3/antrian",
  antrianApiKey: process.env.ANTRIAN_KEY_SECRET,
  antreanPekerjaAktif: process.env.BPJS_ANTREAN_PEKERJA !== "false",
  antreanPekerjaIntervalMenit: angka(process.env.BPJS_ANTREAN_INTERVAL_MENIT, 2),
  antreanMaksPercobaan: angka(process.env.BPJS_ANTREAN_MAKS_PERCOBAAN, 5),
  antreanTokenKedaluwarsaDetik: angka(process.env.BPJS_ANTREAN_TOKEN_TTL, 3600),

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
