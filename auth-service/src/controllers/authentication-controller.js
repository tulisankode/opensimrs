import AuthenticationService from "../services/authentication-service.js";

export default class AuthenticationController {
  static async login(request, response, nextFunction) {
    try {
      const result = await AuthenticationService.login(request.body);
      response.status(200).json(result)
    } catch (error) {
      nextFunction(error);
    }
  }

  static async logout(request, response, nextFunction){
    try{
      const result = await AuthenticationService.logout(request.author, request.get('Authorization'));
      response.status(202).json(result);
    }catch(error){
      nextFunction(error);
    }
  }

  static async updateToken(request, response, nextFunction){
    try{
      const result = await AuthenticationService.updateToken(request.author, request.params.faskes, request.get("Authorization").substring(7));
      response.status(202).json(result);
    }catch(error){
      nextFunction(error);
    }
  }

  /**
   * 
   * @param {Request} request 
   * @param {Response} response 
   * @param {nextFunction} nextFunction 
   */
  static async refreshToken(request, response, nextFunction){
    try{
      const result = await AuthenticationService.refreshToken(request.body);
      response.status(200).json(result);
    }catch(error){
      nextFunction(error);
    }
  }
}
