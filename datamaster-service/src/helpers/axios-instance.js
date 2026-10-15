import axios from "axios";
import "dotenv/config";
import NotFoundException from "../errors/notfound-exception.js";
import DatabaseException from "../errors/database-exception.js";

export default class SatuSehatId {
  static tokenCache = {};

  static createAxiosInstance = (token) => {
    const headers = {
      "X-API-TOKEN": token,
    };
    return axios.create({ headers });
  };

  static async getSatuSehatIdByNik(nik) {
    const BASE_URL_SATU_SEHAT = process.env.BASE_URL_SATU_SEHAT;

    let token = this.getTokenFromCache();
    if (!token) {
      token = await this.fetchNewToken();
      this.saveTokenToCache(token);
    }

    let axiosInstance = this.createAxiosInstance(token);

    try {
      const response = await axiosInstance.get(
        `${BASE_URL_SATU_SEHAT}practitioner/${nik}/nik`
      );
      // console.log("RESPONSE API", response);

      if (response.data.total == 0) {
        return null;
      } else {
        return response.data.entry[0].resource.id;
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        // Token failed, remove from cache and retry
        this.removeTokenFromCache();
        return await this.getSatuSehatIdByNik(nik);
      } else {
        return null;
        // throw new NotFoundException("NIK Tidak Terdaftar Satu Sehat..", 404);
      }
    }
  }

  static async fetchNewToken() {
    console.log("FETCH TOKEN");
    const BASE_URL_SATU_SEHAT = process.env.BASE_URL_SATU_SEHAT;

    // Implement logic to fetch a new token from the API
    // For example, you can make a request to the token endpoint
    const CLIENT_ID = process.env.CLIENT_ID;
    const CLIENT_SECRET = process.env.CLIENT_SECRET;

    const response = await axios.post(
      `${BASE_URL_SATU_SEHAT}auth`,
      `clientId=${CLIENT_ID}&clientSecret=${CLIENT_SECRET}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    // console.log("RESPONSE FETCH TOKEN", response);

    return response.data.access_token;
  }

  static getTokenFromCache() {
    console.log("getTokenFromCache");
    const cachedToken = this.tokenCache;
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
      console.log("success getTokenFromCache");
      return cachedToken.token;
    }

    console.log("eND getTokenFromCache");
    return null;
  }

  static saveTokenToCache(token) {
    const expiresAt = Date.now() + 3600000; // 1 hour TTL
    this.tokenCache = { token, expiresAt };
  }

  static removeTokenFromCache() {
    this.tokenCache = {};
  }
}
