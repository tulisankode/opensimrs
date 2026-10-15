import redisClient from "./configs/redis-configuraton.js";
import generateRedisKeyByJwtToken from "./utils/generate-redis-key.js";
import { JwtUtils } from "./utils/jwt-utils.js";

/**
 * list url that doest not need to authenticate
 * @param { array } ignoreUrl
 * @returns express middleware
 */
export default function authorizationSdk(ignoreUrl) {
  /**
   * @param { import("express").Request } request
   * @param { import("express").Response } response
   * @param { import("express").NextFunction } nextFunction
   */
  return async function (request, response, nextFunction) {
    try {
      if (!redisClient.isOpen) await redisClient.connect();
      if (ignoreUrl) {
        if (ignoreUrl.includes(request.originalUrl)) {
          nextFunction();
        }
        else {
          const BEARER_TOKEN = request.get("Authorization");
          if (!BEARER_TOKEN)
            return response.status(401).json({
              message: "Authentikasi gagal",
              errors: [
                {
                  type: "Authorization required",
                  message: "silakan login terlebih dahulu",
                },
              ],
            });
          const token = BEARER_TOKEN.substring(7);
          const author = JwtUtils.veryfy(token);
          request.author = author;
          const user = await redisClient.exists(`token-${generateRedisKeyByJwtToken(token)}`);
          if (user == 0) {
            return response.status(401).json({
              message: "Authentikasi gagal",
              errors: [
                {
                  type: "invalid token",
                  message: "Token tidak valid atau kadaluarsa",
                },
              ],
            });
          } else {
            nextFunction();
          }
        }
      }
    } catch (error) {
      nextFunction(error);
    }
  };
}
