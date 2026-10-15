import jwt from "jsonwebtoken";
import UsernameException from "../errors/username-exception.js";
import BadRequestException from "../errors/bad-request-exception.js";
import DuplicateException from "../errors/duplicate-exception.js";
import { QueryError, UniqueConstraintError, ValidationError } from "sequelize";
import { ZodError } from "zod";
import zodErrorParser from "../helpers/zod-error-parser.js";
import UnauthorizeException from "../errors/unauthorize-exception.js";
import NotFoundException from "../errors/not-found-exception.js";
import AuthorizationSdkException from "@opensimrs/authorization-sdk/sdkException";
import { HttpException } from "../errors/http-exception.js";
import {NotAllowedException} from "@opensimrs/permission-sdk/exceptions";

const errorMiddleware = (error, request, response, nextFunction) => {
  console.error(error);
  if (error instanceof UsernameException) response.status(error.status).json(error.message)
  else if(error instanceof jwt.TokenExpiredError) response.status(400).json({message: "Authentikasi gagal", errors: [{type: "Invalid token", message: "Token tidak valid atau telah kadaluarsa"}]})
  else if(error instanceof jwt.JsonWebTokenError) response.status(400).json({message: "Authentikasi gagal", errors: [{type: "Invalid signature", message: "Token tidak valid"}]})
  else if(error instanceof BadRequestException) response.status(error.status).json({message: error.message})
  else if(error instanceof DuplicateException) response.status(error.code).json({messages: error.message})
  else if(error instanceof UniqueConstraintError) response.status(400).json({message: error.message, errors: error.errors.map(err => { return {field: err.path, message: err.message }})})
  else if(error instanceof ZodError) response.status(400).json({message: zodErrorParser(error.errors)})
  else if(error instanceof UnauthorizeException) response.status(error.code).json(error.message)
  else if(error instanceof NotFoundException) response.status(error.code).json({message: error.message});
  else if(error instanceof AuthorizationSdkException) response.status(error.code).json(error.message);
  else if(error instanceof QueryError) response.status(400).json({message: error.cause, stack: error.stack})
  else if(error instanceof HttpException) response.status(error.status).json(error.message);
  else if(error instanceof NotAllowedException) response.status(error.code).json(error.message)
  response.status(500).json({message: error.message, stack: error.stack});
};

export default errorMiddleware;