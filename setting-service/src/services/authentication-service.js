import AuthenticationRepository from "../repositories/authentication-repository.js";

export default class AuthenticationService {

  static async isTokenExist(username) {
    return await AuthenticationRepository.isTokenExist(username);
  }
}
