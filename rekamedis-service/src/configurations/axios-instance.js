import axios from "axios";
import "dotenv/config";

const BASE_URL_ADMISI =  process.env.BASE_URL_API_ADMISI || "http://localhost:8081/api/v3/admisi";
const BASE_URL_FARMASI = process.env.BASE_URL_API_FARMASI || "http://localhost:8084/api/v3/farmasi";
const BASE_URL_PEMBAYARAN = process.env.BASE_URL_API_PEMBAYARAN || "http://localhost:8089/api/v3/payment/internal";

//! ADMISI

//* Create Rawat Inap melalui Surat Permohonan Rawat Inap
const createRawatInap = axios.create({
    baseURL: `${BASE_URL_ADMISI}/rawat-inap/spri`,
    timeout: 10000,
    method: "POST",
    headers: {
        "Content-Type": "application/json",
    },
});

//* Cek No Identity Pasien
const checkNoIdentity = axios.create({
    baseURL: `${BASE_URL_ADMISI}/patient/internal/identity-check`,
    timeout: 10000,
    method: "GET",
    headers: {
        "Content-Type": "application/json",
    },
});


//! FARMASI

//* Detail Prescription
const prescriptionDetail = axios.create({
    baseURL: `${BASE_URL_FARMASI}/prescriptions`,
    timeout: 10000,
    method: "GET",
    headers: {
        "Content-Type": "application/json",
    },
})


//! PEMBAYARAN

//* Create Billing
const createBilling = axios.create({
    baseURL: `${BASE_URL_PEMBAYARAN}/bills`,
    timeout: 10000,
    method: "POST",
    headers: {
        "Content-Type": "application/json",
    },
})

export { createRawatInap, prescriptionDetail, createBilling, checkNoIdentity };