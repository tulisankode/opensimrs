import redisClient from "../configurations/redis-client-config.js";
import UnauthorizeException from "../errors/unauthorize-exception.js";
import JwtHelper from "../helpers/jwt-helper.js";
import AuthenticationService from "../services/authentication-service.js";

const authorizationMiddleware = async (request, response, nextFunction) => {
  try {
    const ignoreUrl = ["/v1/login", "/v1/register"]; // url yang 
    if (ignoreUrl.includes(request.originalUrl)) nextFunction();
    const BEARER_TOKEN = request.get("Authorization");
    if (!BEARER_TOKEN) throw new UnauthorizeException({message: "Authentikasi gagal", errors: [{type: "Authorization required", message: "silakan login terlebih dahulu"}]});
    const token = BEARER_TOKEN.substring(7);
    const author = await JwtHelper.veryfy(token);
    request.author = author;
    request.body.faskesUuid = author.faskesUuid;
    console.log(author);
    const user = await redisClient.exists(`token-${AuthenticationService.generateRedisKeyByJwtToken(token)}`);
    if(user == 0) throw new UnauthorizeException({message: "Authentikasi gagal", errors: [{type: "Invalid token", message: "Token tidak valid atau telah kadaluarsa"}]});
      else nextFunction();
  } catch (error) {
    nextFunction(error);
  }
};
export default authorizationMiddleware;
