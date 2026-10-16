import "dotenv/config";

const angka = (nilai, bawaan) => (nilai !== undefined && nilai !== "" && Number.isFinite(Number(nilai)) ? Number(nilai) : bawaan);

export default {
  port: angka(process.env.APPLICATION_PORT ?? process.env.PORT, 8099),
  host: process.env.APPLICATION_HOST || "0.0.0.0",
  basePath: "/api/v3/penunjang",
  secretKey: process.env.SECRET_KEY,
  pembayaranUrl: (process.env.BASE_URL_API_PEMBAYARAN || "http://localhost:8089/api/v3/payment/internal").replace(/\/$/, ""),
  // Status fitur (Manajemen Modul) untuk pemeriksaan rad_bridging_pacs, lihat pacs/izin.js.
  settingUrl: (process.env.SETTING_SERVICE_URL || "http://localhost:8094/api/v3/setting").replace(/\/$/, ""),
  // Laboratorium PK (order lab MCU) & Admisi (pendaftaran pasien baru dari impor rombongan MCU).
  labUrl: (process.env.BASE_URL_API_LAB || "http://localhost:8087/api/v3/lab").replace(/\/$/, ""),
  admisiUrl: (process.env.BASE_URL_API_ADMISI || "http://localhost:8081/api/v3/admisi").replace(/\/$/, ""),
  pg: {
    host: process.env.DB_HOST || "localhost",
    port: angka(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  },
};
