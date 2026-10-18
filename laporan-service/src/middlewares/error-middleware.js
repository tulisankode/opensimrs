import { ZodError } from "zod"
import BadRequestException from "../exceptions/bad-request-exception.js"

// Setiap cabang mengakhiri respons (sebelumnya 400 diikuti 500 → "headers already sent").
const errorMiddleware = (error, request, response, nextFunction) => {
  if (response.headersSent) return nextFunction(error)
  if (error instanceof ZodError) return response.status(400).json({ message: error.errors })
  if (error instanceof BadRequestException) return response.status(error.code).json({ message: error.message })
  // Token rusak/kedaluwarsa (jwt.verify di authorization-sdk) → 401 dengan bentuk pesan yang dikenali frontend.
  if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error?.name)) {
    return response.status(401).json({ message: "Authentikasi gagal", errors: [{ type: "invalid token", message: error.message }] })
  }
  const kode = Number(error?.code)
  if (Number.isInteger(kode) && kode >= 400 && kode < 500) return response.status(kode).json({ message: error.message })
  console.error("ERR: ", error)
  return response.status(500).json({ message: error.message })
}

export default errorMiddleware
