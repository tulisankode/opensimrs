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
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { catatPeristiwaAudit } from "@opensimrs/model-sdk/audit-sequelize";

export default class AuthenticationService {

  static async login(loginRequest) {
    const { username, password: rawPassword } = loginRequest;
    loginRequest =  ZodValidator.validate(AuthenticationValidation.LOGIN, loginRequest);
    const user = await AuthenticationRepository.login(username);
    // Username tidak ditemukan: faskes_uuid tidak diketahui, jadi tidak dicatat (STD-0029 G7 — jangan menebak cakupan
    // faskes). Hanya percobaan dengan faskes yang diketahui (password salah) yang dicatat sebagai login_gagal.
    if(!user) throw new UsernameException({ message: "Gagal login", errors: [{ field: "username", message: "username", message: `username ${username} belum terdaftar!`}] }, 401);
    const isPasswordValid = await bcrypt.compare(rawPassword, user.password);
    if(!isPasswordValid) {
      await catatPeristiwaAudit(sequelizeInstance, {
        faskes_uuid: user.faskesUuid,
        layanan: "auth",
        aksi: "login_gagal",
        identitas_akun: username,
        pengguna_uuid: user.uuid,
      });
      throw new UnauthorizeException({message: "Autentikasi gagal", errors: [{field: "password", message: "password anda tidak sesuai"}]});
    }
    const { role, faskesUuid, permissions, name, uuid } = user;
    const { token, refreshToken} = genereateAuthToken({role, username, faskesUuid, user_uuid: uuid});
    const keyRedis = generateRedisKeyByJwtToken(token);
    await redisClient.set(`token-${keyRedis}`, JSON.stringify({permissions}), { EX: 3 * (60 * 60), NX: true });
    await catatPeristiwaAudit(sequelizeInstance, {
      faskes_uuid: faskesUuid,
      layanan: "auth",
      aksi: "login",
      identitas_akun: username,
      pengguna_uuid: uuid,
      peran: role,
    });
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
    // login() mengembalikan permissions sebagai larik (findByUsername mengembalikan teks mentah kolom permissions,
    // sehingga cache sesi Redis berisi teks dan permission-sdk gagal: "permissions.find is not a function").
    const { permissions, uuid } = await AuthenticationRepository.login(username);
    const { name: faskesName} = await FaskesRepository.findByUuid(faskesUuid);
    const { token: newToken, refreshToken: newRefreshToken } = genereateAuthToken({role, username, faskesUuid, name, user_uuid: uuid});
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
    await catatPeristiwaAudit(sequelizeInstance, {
      faskes_uuid: author.faskesUuid,
      layanan: "auth",
      aksi: "logout",
      identitas_akun: author.username,
      pengguna_uuid: author.user_uuid,
      peran: author.role,
    });
    return { message: `${author.username} berhasil logout` }
  }



  static async refreshToken(request){
    ZodValidator.validate(AuthenticationValidation.REFRESH_TOKEN, request);
    const decodeToken = JwtHelper.verifyRefreshToken(request.refreshToken);
    // login() menyertakan nama peran & permissions berbentuk larik (findByUsername tidak memuat peran, sehingga token
    // hasil refresh kehilangan role/user_uuid dan izin sesi tersimpan sebagai teks).
    const user = await AuthenticationRepository.login(decodeToken.username);
    if (!user) throw new UnauthorizeException({ message: "Gagal refresh token", errors: [{ message: "pengguna tidak ditemukan" }] });
    const { token, refreshToken } = genereateAuthToken({
      role: user.role,
      username: user.username,
      faskesUuid: user.faskesUuid,
      user_uuid: user.uuid,
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
