import "dotenv/config";

const angka = (nilai, bawaan) => (nilai !== undefined && nilai !== "" && Number.isFinite(Number(nilai)) ? Number(nilai) : bawaan);

export default {
  port: angka(process.env.APPLICATION_PORT ?? process.env.PORT, 8099),
  host: process.env.APPLICATION_HOST || "0.0.0.0",
  basePath: "/api/v3/penunjang",
  secretKey: process.env.SECRET_KEY,
  pembayaranUrl: (process.env.BASE_URL_API_PEMBAYARAN || "http://localhost:8089/api/v3/payment/internal").replace(/\/$/, ""),
  // Gudang & Pengadaan (inventory-service) — pengurangan stok suku cadang dari work order Sarana & Prasarana (STD-0022).
  inventoryUrl: (process.env.BASE_URL_API_INVENTORY || "http://localhost:8086/api/v3/inventory").replace(/\/$/, ""),
  // Batas ukuran foto kerusakan & sertifikat kalibrasi Sarana & Prasarana (MB, PDF/JPG/PNG; 1–20, bawaan 5).
  berkasSarprasMaksMb: Math.min(Math.max(angka(process.env.MAX_UPLOAD_BERKAS_SARPRAS_MB, 5), 1), 20),
  // Status fitur (Manajemen Modul) untuk pemeriksaan rad_bridging_pacs, lihat pacs/izin.js.
  // SETTING_SERVICE_URL berisi host saja (http://localhost:8094), sama seperti lab-service/src/helpers/fitur-aktif.js;
  // path /api/v3/setting ditambahkan di sini (nilai yang sudah memuat path tetap diterima).
  settingUrl: (() => {
    const dasar = (process.env.SETTING_SERVICE_URL || "http://localhost:8094").replace(/\/+$/, "");
    return /\/api\/v3\/setting$/.test(dasar) ? dasar : `${dasar}/api/v3/setting`;
  })(),
  // Laboratorium PK (order lab MCU) & Admisi (pendaftaran pasien baru dari impor rombongan MCU).
  labUrl: (process.env.BASE_URL_API_LAB || "http://localhost:8087/api/v3/lab").replace(/\/$/, ""),
  admisiUrl: (process.env.BASE_URL_API_ADMISI || "http://localhost:8081/api/v3/admisi").replace(/\/$/, ""),
  // Rekam Medis Elektronik (resume & diagnosis dokter pembanding untuk modul Koding Rekam Medis).
  rekamedisUrl: (process.env.BASE_URL_API_REKAMEDIS || "http://localhost:8093/api/v3/rekam-medis").replace(/\/$/, ""),
  // Farmasi: pemakaian BHP/obat depo Kamar Operasi memakai alur order alkes (stok otoritatif) yang sudah ada.
  farmasiUrl: (process.env.BASE_URL_API_FARMASI || "http://localhost:8084/api/v3/farmasi").replace(/\/$/, ""),
  // Rekam Medis (RME) — modul Gizi membaca alergi tercatat (read-only, tidak mengubah data/struktur RME).
  rmeUrl: (process.env.BASE_URL_API_RME || "http://localhost:8093/api/v3/rekam-medis").replace(/\/$/, ""),
  // BPJS (bpjs-service) — MCU PCare (STD-0020): satu-satunya jalur pengiriman hasil MCU peserta JKN ke PCare.
  bpjsUrl: (process.env.BASE_URL_API_BPJS || "http://localhost:8098/api/v3/bpjs").replace(/\/$/, ""),
  pg: {
    host: process.env.DB_HOST || "localhost",
    port: angka(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  },
};
