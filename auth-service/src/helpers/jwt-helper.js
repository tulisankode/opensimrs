import jwt from "jsonwebtoken";
import "dotenv/config";
import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { generateErrorMessage } from "./generate-message.js";

const getJwtSecret = () => {
  const secret = process.env.SECRET_KEY;

  if (!secret) {
    throw new Error("SECRET_KEY is required for JWT HS256");
  }

  return secret;
};

export class JwtHelper {
  static sign(payload) {
    return jwt.sign(payload, getJwtSecret(), {
      algorithm: "HS256",
      expiresIn: "3600s",
      issuer: "authentication-service",
    });
  }

  static veryfy(token) {
    return jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: "authentication-service",
    });
  }

  static signRefreshToken(payload) {
    return jwt.sign(payload, getJwtSecret(), {
      expiresIn: "4200s",
      algorithm: "HS256",
      issuer: "authentication-service",
    });
  }

  static verifyRefreshToken(token) {
    try {
      return jwt.verify(token, getJwtSecret(), {
        algorithms: ["HS256"],
        issuer: "authentication-service",
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new HttpException(
          generateErrorMessage(
            "Gagal refresh token",
            "expired",
            "Refresh token telah kadaluarsa"
          ),
          HttpStatus.UNAUTHORIZED
        );
      }

      throw error;
    }
  }
}

export function genereateAuthToken(payload) {
  return {
    token: JwtHelper.sign({
      role: payload.role,
      username: payload.username,
      faskesUuid: payload.faskesUuid,
      user_uuid: payload.user_uuid,
    }),
    refreshToken: JwtHelper.signRefreshToken({
      username: payload.username,
    }),
  };
}