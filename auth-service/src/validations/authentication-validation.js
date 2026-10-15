import { z } from "zod";
import { passwordRequired, usernameRequired } from "./message-validation-error.js";

export default class AuthenticationValidation {
  static LOGIN = z.object({
    faskesUuid: z.string().optional(),
    username: z.string().min(1, usernameRequired),
    password: z.string().min(1, passwordRequired),
  });

  static UPDATE_TOKEN_ADMIN = z.object({
    faskesUuid: z.string().optional(),
    username: z.string().min(1, usernameRequired),
    password: z.string().min(1, passwordRequired),
  });

  static LOGOUT = z.string();

  static REFRESH_TOKEN = z.object({
    refreshToken: z.string().min(1, "refresh_token tidak boleh kosong"),
    token: z.string().min(1, "token tidak boleh kosong")
  });
}
