import { JwtUtils } from "@opensimrs/authorization-sdk/jwt-utils"
const authorizationMiddleware = async (request, response, nextFunction) => {
    try {
        const BEARER_TOKEN = request.get("Authorization");
        if (!BEARER_TOKEN) return response.status(401).json({message: `silakan login terlebih dahulu!`});
        const token = BEARER_TOKEN.split(" ")[1]; 
        const isValid = JwtUtils.veryfy(token);
        if (!isValid) return response.status(401).json({message: `token tidak valid!`});
        response.locals.jwtData = isValid;
        console.log("isValid", isValid);
        console.log("faskesUuid", request.author);
        request.author = isValid;
        // request.author.faskesUuid = isValid.faskesUuid;
        // request.author.userUuid = isValid.userUuid;
        nextFunction();
    }catch (error) {
        console.error("Authorization Middleware Error:", error);
        return response.status(401).json({message: `token tidak valid!`});
    }
}

export default authorizationMiddleware;