export default function generateRedisKeyByJwtToken(token){
    const [, , signature ] = token.split(".");
    return signature.substring(1, 11);
}