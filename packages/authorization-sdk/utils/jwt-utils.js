import jwt from "jsonwebtoken";
import "dotenv/config";

const getJwtSecret = () => {
  const secret = process.env.SECRET_KEY;
  if (!secret) {
    throw new Error("SECRET_KEY is required for JWT HS256");
  }
  return secret;
};

export class JwtUtils {
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
    return jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    });
  }
}
