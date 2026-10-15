import "dotenv/config";
import { HttpException } from "../errors/http-exception.js";
import { generateErrorResponse } from "../helpers/generate-message.js";
import Criptio from "crypto-js";
/**
 *
 * @param {Request} request
 * @param {Response} response
 * @param {import("express").NextFunction} nextFunction
 */
export function apiKeyMiddleware(request, response, nextFunction) {
  try {
    const apiKey = request.headers["x-api-key"];
    if (!apiKey) {
      throw new HttpException(
        generateErrorResponse(
          "Gagal",
          "Unauthorized",
          "X-API-KEY harus dikirimkan"
        ),
        401
      );
    }
    console.log("Deskripsi API Key:", process.env.API_KEY_SECRET);
    console.log("API Key:", apiKey);
    const descript = Criptio.AES.decrypt(apiKey, process.env.API_KEY_SECRET);
    console.log("Hasil Deskripsi:", descript.toString(Criptio.enc.Utf8));
    if (!descript.toString(Criptio.enc.Utf8)) {
      throw new HttpException(
        generateErrorResponse("Gagal", "Unauthorized", "X-API-KEY tidak valid"),
        401
      );
    }
    nextFunction();
  } catch (error) {
    nextFunction(error);
  }
}
