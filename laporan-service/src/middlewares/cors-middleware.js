// CORS untuk frontend yang berjalan di origin lain (mis. simrs.contoh.id → api.simrs.contoh.id).
// Harus dipasang sebelum authorizationSdk: preflight OPTIONS tidak membawa token.
// Konfigurasi sama dengan service lain (origin "*").
const corsMiddleware = (request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*")
  response.setHeader("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH")
  if (request.method === "OPTIONS") return response.sendStatus(204)
  next()
}

export default corsMiddleware
