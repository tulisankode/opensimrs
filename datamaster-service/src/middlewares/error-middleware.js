import { ZodError } from "zod";
import NotFoundException from "../errors/notfound-exception.js";
import ForbiddenException from "../errors/forbidden-exception.js";
import DatabaseException from "../errors/database-exception.js";
import ConflictException from "../errors/conflict-exception.js";
import BadRequestException from "../errors/bad_request-exception.js";
import pkg from "jsonwebtoken";
import { ValidationError, ValidationErrorItem } from "sequelize";
import AuthorizationSdkException from "@opensimrs/authorization-sdk/sdkException";
const { TokenExpiredError } = pkg;
import "dotenv/config";
import { HttpException } from "../errors/http-exception.js";

const APPLICATION_MODE = process.env.APPLICATION_MODE;

/**
 * Error middleware ini akan digunakan untuk menangani berbagai error yang
 * terjadi pada aplikasi
 *
 * @param {Error} error - Error yang ditangkap
 * @param {import('express').Request} request - Express Request object
 * @param {import('express').Response} response - Express Response object
 * @param {import('express').NextFunction} next - Express NextFunction
 */
const errorMiddleware = (error, request, response, next) => {
  console.log(error);
  if (error instanceof AuthorizationSdkException) {
    return response.status(error.code).json(error.message);
  }

  if (error instanceof TokenExpiredError) {
    return response.status(401).json({
      message: "Authorization gagal",
      errors: [{ type: "auth", message: error.message }],
    });
  }

  if (error instanceof ZodError) {
    console.log("ZOD ERROR: -> ", error);
    
    return response.status(400).json({
      message: "Data gagal ditampilkan",
      errors: error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      })),
    });
  }

  if (error instanceof ValidationError) {
    return response.status(409).json({
      message: "Data gagal disimpan",
      errors: error.errors.map((err) => {
        if(err.path !== "faskes_uuid"){
          if(err.path === "lower(code::text)"){
            return {
              field: "code",
              message: "code yang anda gunakan sudah ada"
            }
          }else{
            return {
              field: err.path,
              message: err.message,
            };
          }
        }
      }).filter(d => d !== null ? d : undefined),
    })
  }

  if (error instanceof ForbiddenException) {
    return response.status(error.statusCode).json({
      status: false,
      message: error.message,
    });
  }

  if (error instanceof BadRequestException) {
    return response.status(error.statusCode).json({
      message: error.message,
      errors: [{ type: "bad request", message: error.errorMessage }],
    });
  }

  if (error instanceof ConflictException) {
    return response.status(error.statusCode).json({
      message: error.message,
      errors: [{ type: "conflict", message: error.errorMessage }],
    });
  }

  if (error instanceof NotFoundException) {
    return response.status(404).json({
      message: error.message,
      errors: [{ type: "not found", message: error.errorMessage }],
    });
  }

  if (error instanceof DatabaseException) {
    return response.status(error.statusCode).json({
      status: false,
      message: error.message,
    });
  }

  if(error instanceof HttpException){
    return response.status(error.code).json(error.message);
  }

  console.log({
    message: error.message,
    stack: error.stack,
    cause: error.cause
  })

  if(APPLICATION_MODE === "DEV"){
    response.status(500).json({
      message: error.message,
      stack: error.stack,
      cause: error.cause
    })
  }
  // Default error handler
  return response.status(500).json({
    message: "Internal Server Error",
    errors: [
      {
        type: "server error",
        message: "Terjadi kesalahan diserver. Silahkan coba lagi nanti...",
      },
    ],
  });
};

export { errorMiddleware };
