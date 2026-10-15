import axios from "axios";
import { farmasiApiConfig } from "../configurations/external-apis.js";

export default class FarmasiExternalRepository {
    static async getKonfigurasiHarga(headers) {
        try {
            const requestConfig = {
                baseURL: farmasiApiConfig.baseURL,
                headers: {
                    Authorization: headers.authorization || headers.Authorization,
                    "Content-Type": "application/json",
                }
            };
            const response = await axios.get("/datamaster/konfig-harga", requestConfig);
            return response.data?.payload || null;
        } catch (error) {
            console.error(
                "[FarmasiExternalRepository] Gagal mengambil konfigurasi harga:", error.response?.data || error.message
            );
        }
    }

    static async getLokasiStok(queryParams, headers) {
        try {
            const requestConfig = {
                baseURL: farmasiApiConfig.baseURL,
                headers: {
                    Authorization: headers.authorization || headers.Authorization,
                    "Content-Type": "application/json",
                },
                params: queryParams,
            };
            const response = await axios.get("/datamaster/lokasi-stok", requestConfig);
            return response.data;
        } catch (error) {
            console.error(
                "[FarmasiExternalRepository] Gagal mengambil lokasi stok:", error.response?.data || error.message
            );
            throw error;
        }
    }

    static async getConversionByItem(queryParams, headers) {
        try {
            const requestConfig = {
                baseURL: farmasiApiConfig.baseURL,
                headers: {
                    Authorization: headers.authorization || headers.Authorization,
                    "Content-Type": "application/json",
                },
                params: queryParams,
            };
            const response = await axios.get("/datamaster/item-medis/conversions", requestConfig);
            return response.data?.payload;
        } catch (error) {
            console.error(
                "[FarmasiExternalRepository] Gagal mengambil data konversi:", error.response?.data || error.message
            );
            return [];
        }
    }

    static async getAllSatuan(queryParams, headers) {
        try {
            const requestConfig = {
                baseURL: farmasiApiConfig.baseURL,
                headers: {
                    Authorization: headers.authorization || headers.Authorization,
                    "Content-Type": "application/json",
                },
                params: queryParams,
            };
            const response = await axios.get("datamaster/satuan", requestConfig);
            return response.data?.payload;
        } catch (error) {
            console.error(
                "[FarmasiExternalRepository] Gagal mengambil data satuan:", error.response?.data || error.message
            );
            return [];
        }
    }

    static async getAllItemMedis(queryParams, headers) {
        try {
            const requestConfig = {
                baseURL: farmasiApiConfig.baseURL,
                headers: {
                    Authorization: headers?.authorization || headers?.Authorization || "",
                    "Content-Type": "application/json",
                },
                params: queryParams,
            };
            const response = await axios.get("/datamaster/item-medis/without-pagination", requestConfig);
            return response.data?.payload || [];
        } catch (error) {
            console.error(
                "[FarmasiExternalRepository] Gagal mengambil data item medis:", 
                error.response?.data || error.message,
            );
            return [];
        }
    }

    static async getJenisStok(queryParams, headers) {
        try {
            const requestConfig = {
                baseURL: farmasiApiConfig.baseURL,
                headers: {
                    Authorization: headers?.authorization || headers?.Authorization || "",
                    "Content-Type": "application/json",
                },
                params: queryParams
            };
            const response = await axios.get("/datamaster/jenis-stok", requestConfig);
            return response.data?.payload || [];
        } catch (error) {
            console.error(
                "[FarmasiExternalRepository] Gagal mengambil Jenis Stok:", 
                error.response?.data || error.message
            );
            return [];
        }
    }

    static async getItemMedisJenisStok(queryParams, headers) {
        try {
            const requestConfig = {
                baseURL: farmasiApiConfig.baseURL,
                headers: {
                    Authorization: headers?.authorization || headers?.Authorization || "",
                    "Content-Type": "application/json",
                },
                params: queryParams,
            };
            const response = await axios.get("/datamaster/item-medis/jenis-stok", requestConfig);
            return response.data?.payload || [];
        } catch (error) {
            console.error(
                "[FarmasiExternalRepository] Gagal mengambil Item Medis Jenis Stok:",
                error.response?.data || error.message
            );
            return [];
        }
    }
}