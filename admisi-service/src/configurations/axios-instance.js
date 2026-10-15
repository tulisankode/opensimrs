import axios from "axios";
import { Context as Ctx } from "../middlewares/context.js";
import { CTX_TOKEN } from "../constant/context-constant.js";
import "dotenv/config";

const DEFAULT_BASE_URL_ANTRIAN = "http://localhost:8082/api/v3/antrian";

const normalizeBaseUrl = (value) => value?.trim().replace(/\/+$/, "");

const resolveAntrianBaseUrl = () => {
  const configuredBaseUrl =
    process.env.BASE_URL_API_ANTRIAN ||
    process.env.BASE_URL_ANTRIAN ||
    process.env.ANTRIAN_SERVICE_URL ||
    process.env.VITE_BASE_ANTRIAN;
  const baseUrl = normalizeBaseUrl(configuredBaseUrl || DEFAULT_BASE_URL_ANTRIAN);

  try {
    new URL(baseUrl);
    if (!configuredBaseUrl) {
      console.warn(
        `[ADMISI] BASE_URL_API_ANTRIAN is not set. Using local fallback ${DEFAULT_BASE_URL_ANTRIAN}.`
      );
    }
    return baseUrl;
  } catch {
    throw new Error(
      `[ADMISI] Invalid Antrian service base URL "${baseUrl}". Set BASE_URL_API_ANTRIAN to an absolute URL.`
    );
  }
};

const joinUrl = (baseUrl, path) =>
  `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

const BASE_URL_ANTRIAN = resolveAntrianBaseUrl();
const API_KEY_ANTRIAN = process.env.API_KEY_ANTRIAN || process.env.ANTRIAN_KEY_SECRET;

const authInterceptor = (config) => {
  const token = Ctx.get(CTX_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

//* Buat No antrian admisi (ANTRIAN)
const generateNoAntrian = axios.create({
  baseURL: joinUrl(BASE_URL_ANTRIAN, "/data-antrian/admisi-registration"),
  timeout: 10000,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
});

generateNoAntrian.interceptors.request.use(authInterceptor);

//* Buat data Antrian Call (ANTRIAN)
const createAntrianCall = axios.create({
  baseURL: joinUrl(BASE_URL_ANTRIAN, "/admisi-antrian"),
  timeout: 10000,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
});

createAntrianCall.interceptors.request.use(authInterceptor);

//* Buat data Antrian Call (ANTRIAN)
const createAntrianCallMobile = axios.create({
  baseURL: joinUrl(BASE_URL_ANTRIAN, "/mobile/admisi-antrian"),
  timeout: 10000,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": API_KEY_ANTRIAN,
  },
});

//* Get data Antrian Call (ANTRIAN)
const getAllAntrianCall = axios.create({
  baseURL: joinUrl(BASE_URL_ANTRIAN, "/admisi-antrian"),
  timeout: 10000,
  method: "GET",
  headers: {
    "Content-Type": "application/json",
  }
});

getAllAntrianCall.interceptors.request.use(authInterceptor);

//* Update status Antrian Call (ANTRIAN)
const updateAntrianCall = axios.create({
  baseURL: joinUrl(BASE_URL_ANTRIAN, "/admisi-antrian"),
  timeout: 10000,
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
  }
});

updateAntrianCall.interceptors.request.use(authInterceptor);

//* Jadwal Dokter (ANTRIAN)
const jadwalDokter = axios.create({
  baseURL: joinUrl(BASE_URL_ANTRIAN, "/jadwal-dokter/all"),
  timeout: 10000,
  method: "GET",
  headers: {
    "Content-Type": "application/json",
  },
});

jadwalDokter.interceptors.request.use(authInterceptor);

//* Jadwal Dokter Mobile (ANTRIAN)
const jadwalDokterMobile = axios.create({
  baseURL: joinUrl(BASE_URL_ANTRIAN, "/mobile/jadwal-dokter/all"),
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": API_KEY_ANTRIAN,
  },
});

export { 
  generateNoAntrian, 
  jadwalDokter, 
  jadwalDokterMobile, 
  createAntrianCall,
  createAntrianCallMobile,
  getAllAntrianCall,
  updateAntrianCall,
};
