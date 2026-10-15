import { ZodError } from "zod"
import BadRequestException from "../exceptions/bad-request-exception.js"

const errorMiddleware = (error, request, response, nextFunction) => {
  console.error("ERR: ", error)
  if (error instanceof ZodError) response.status(400).json({ message: error.errors })
  if (error instanceof BadRequestException) response.status(error.code).json({ message: error.message })
  response.status(500).json({ message: error.message })
}

export default errorMiddleware
