// ForbiddenException.js
export default class ConflictException extends Error {
  constructor(
    message = "Data gagal disimpan",
    errorMessage = "Data sudah ada",
    statusCode = 409
  ) {
    super(message);
    this.message = message;
    this.errorMessage = errorMessage;
    this.statusCode = statusCode;
  }
}
