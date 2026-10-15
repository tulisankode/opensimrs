// ForbiddenException.js
export default class ForbiddenException extends Error {
  constructor(message, statusCode = 403) {
    super(message);
    this.name = "ForbiddenException";
    this.message = message;
    this.statusCode = statusCode;
  }
}
