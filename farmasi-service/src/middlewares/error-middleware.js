import NotfoundException from "../errors/notfound-exception.js";
import BadRequestException from "../errors/bad-request-exception.js";
import errorResponse from "../responses/error-response.js";
import InternalServerException from "../errors/internal-server-exception.js";
import { UniqueConstraintError, ValidationError } from "sequelize";

const errorMiddleware = (error, request, response, nextFunction) => {
    console.error(error);
  if (error instanceof NotfoundException) {
    response.status(error.code).json(
      errorResponse(error.message, [
        {
          message: "data tidak ditemukan",
          type: "not found",
        },
      ])
    );
  } else if (error instanceof BadRequestException) {
    response
      .status(error.status)
      .json(errorResponse(error.message, error.errors));
  } else if (error instanceof InternalServerException) {
    response.status(error.code).json(errorResponse(error.message));
  } else if (
    error instanceof UniqueConstraintError ||
    error instanceof ValidationError
  ) {

    const fieldTranslator = {
      code: "Kode",
      faskes_uuid: "Faskes",
      no_rm: "Nomor Rekam Medis",
      username: "Username",
      email: "Email",
    };

    const errors = error.errors.map((item) => {
      const fieldName = item.path;

      const readableField = fieldTranslator[fieldName] || fieldName;

      let message = item.message;

      if (item.type === "unique violation") {
        message = `${readableField} sudah digunakan.`;
      } else if (item.type === "notNull Violation") {
        message = `${readableField} wajib diisi.`;
      }

      return {
        message: message,
        // field: fieldName,
        // type: "Validation Error",
      };
    });

    response.status(409).json(errorResponse(error.message, errors));
  } else {
    response.status(500).json(errorResponse(error.message));
  }
};

export default errorMiddleware;
