import axios from "axios";
import { Context as Ctx } from "../middlewares/context.js";
import { CTX_TOKEN } from "../constants/context-constant.js";
import "dotenv/config";

const BASE_URL_ANTRIAN = process.env.BASE_URL_API_ANTRIAN || "http://localhost:8082/api/v3/antrian";

const authInterceptor = (config) => {
    const token = Ctx.get(CTX_TOKEN);
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
};

//* Get data Antrian Call (ANTRIAN)
const getAllAntrianCall = axios.create({
    baseURL: `${BASE_URL_ANTRIAN}/admisi-antrian`,
    timeout: 10000,
    method: "GET",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Ctx.get(CTX_TOKEN)}`,
    },
});

getAllAntrianCall.interceptors.request.use(authInterceptor);

//* Buat data Antrian Call (ANTRIAN)
const createAntrianCall = axios.create({
    baseURL: `${BASE_URL_ANTRIAN}/admisi-antrian`,
    timeout: 10000,
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Ctx.get(CTX_TOKEN)}`,
    },
});

createAntrianCall.interceptors.request.use(authInterceptor);

//* Update status Antrian Call (ANTRIAN)
const updateAntrianCall = axios.create({
    baseURL: `${BASE_URL_ANTRIAN}/admisi-antrian`,
    timeout: 10000,
    method: "PUT",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Ctx.get(CTX_TOKEN)}`,
    }
});

updateAntrianCall.interceptors.request.use(authInterceptor);

export { getAllAntrianCall, createAntrianCall, updateAntrianCall };