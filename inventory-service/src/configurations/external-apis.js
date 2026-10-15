import "dotenv/config";
export const farmasiApiConfig = {
  baseURL: process.env.FARMASI_API_URL || "http://localhost:8084/api/v3/farmasi",
};