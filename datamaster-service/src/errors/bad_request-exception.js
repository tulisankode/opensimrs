export default class BadRequestException extends Error {
  constructor(
    message = "Input yang diberikan tidak valid",
    errorMessage = "Parameter tidak valid",
    statusCode = 400
  ) {
    super(message);
    this.message = message;
    this.errorMessage = errorMessage;
    this.statusCode = statusCode;
  }
}
