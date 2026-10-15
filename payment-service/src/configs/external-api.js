import dotenv from 'dotenv';
dotenv.config();

export const EXTERNAL_API_CONFIG = {
  // 1. MODUL PELAYANAN (Untuk data Pasien & Kunjungan Rawat Jalan/Inap)
  PATIENT_SERVICE: {
    BASE_URL: process.env.PATIENT_SERVICE_URL || 'http://localhost:8081',
    TIMEOUT: 5000,
  },

  // 2. MODUL FARMASI (Untuk data Pasien OTC/APS)
  PHARMACY_SERVICE: {
    BASE_URL: process.env.PHARMACY_SERVICE_URL || 'http://localhost:3003',
    TIMEOUT: 5000,
  },

  // 3. MODUL SETTING (Untuk PPN & Admin Fee)
  SETTING_SERVICE: {
    BASE_URL: process.env.SETTING_SERVICE_URL || 'http://localhost:8094',
    TIMEOUT: 5000,
  },
};
