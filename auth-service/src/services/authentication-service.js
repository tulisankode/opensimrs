import generateRedisKeyByJwtToken from "@opensimrs/authorization-sdk/generateKeyRedis";
import redisClient from "../configurations/redis-client-config.js";
import UnauthorizeException from "../errors/unauthorize-exception.js";
import UsernameException from "../errors/username-exception.js";
import AuthenticationRepository from "../repositories/authentication-repository.js";
import AuthenticationValidation from "../validations/authentication-validation.js";
import ZodValidator from "../validations/zod-validator.js";
import bcrypt from "bcryptjs";
import FaskesRepository from "../repositories/faskes-repository.js";
import { genereateAuthToken, JwtHelper } from "../helpers/jwt-helper.js";

export default class AuthenticationService {

  static async login(loginRequest) {
    const { username, password: rawPassword } = loginRequest;
    loginRequest =  ZodValidator.validate(AuthenticationValidation.LOGIN, loginRequest);
    const user = await AuthenticationRepository.login(username);
    if(!user) throw new UsernameException({ message: "Gagal login", errors: [{ field: "username", message: "username", message: `username ${username} belum terdaftar!`}] }, 401);
    const isPasswordValid = await bcrypt.compare(rawPassword, user.password);
    if(!isPasswordValid) throw new UnauthorizeException({message: "Autentikasi gagal", errors: [{field: "password", message: "password anda tidak sesuai"}]});
    const { role, faskesUuid, permissions, name, uuid } = user;
    const { token, refreshToken} = genereateAuthToken({role, username, faskesUuid, user_uuid: uuid});
    const keyRedis = generateRedisKeyByJwtToken(token);
    await redisClient.set(`token-${keyRedis}`, JSON.stringify({permissions}), { EX: 3 * (60 * 60), NX: true });
    return {
      message: "Login berhasil!",
      payload: { 
        token, refreshToken, permissions, 
        user: { 
          faskesUuid,
          role,
          name,
        }
      }
    }
  }
  
  static async updateToken(author, faskesUuid, token){
    const { username, role, name } = author;
    if(role !== "super admin"){
      throw new UnauthorizeException(
        {
          message: "gagal update token",
          errors: [
            {
              message: `${name} tidak memiliki izin untuk melakukn update token`
            }
          ]
        }
      )
    }
    const { permissions } = await AuthenticationRepository.findByUsername(username);
    const { name: faskesName} = await FaskesRepository.findByUuid(faskesUuid);
    const { token: newToken, refreshToken: newRefreshToken } = genereateAuthToken({role, username, faskesUuid, name});
    await redisClient.set(`token-${generateRedisKeyByJwtToken(newToken)}`, JSON.stringify({permissions}), { EX: 3 * (60 * 60), NX: true });
    await redisClient.del(`token-${generateRedisKeyByJwtToken(token)}`);
    return {
      message: "Success update token!",
      payload: { 
        newToken, newRefreshToken, faskesName, faskesUuid
       }
    }
  }

  static async logout(author, token){
    ZodValidator.validate(AuthenticationValidation.LOGOUT, author.username);
    const affected = await redisClient.del(`token-${generateRedisKeyByJwtToken(token.substring(7))}`);
    if(affected ==! 1) throw new Error(`${author.username} gagal logout`)
    return { message: `${author.username} berhasil logout` }
  }



  static async refreshToken(request){
    ZodValidator.validate(AuthenticationValidation.REFRESH_TOKEN, request);
    const decodeToken = JwtHelper.verifyRefreshToken(request.refreshToken);
    const user = await AuthenticationRepository.findByUsername(decodeToken.username);
    const { token, refreshToken } = genereateAuthToken({
      role: user.role,
      username: user.username,
      faskesUuid: user.faskesUuid
    });
    await redisClient.set(`token-${generateRedisKeyByJwtToken(token)}`, JSON.stringify({permissions: user.permissions}), { EX: 3 * (60 * 60), NX: true });
    await redisClient.del(`token-${generateRedisKeyByJwtToken(request.token)}`);
    return {
      message: "Berhasil refresh token",
      payload: {
        token, refreshToken
      }
    }
  }
}
