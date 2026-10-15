// DatabaseException.js
export default class DatabaseException extends Error {
  constructor(message, errorMessage, statusCode = 500) {
    super(message);
    this.message = message;
    this.errorMessage = errorMessage;
    this.statusCode = statusCode;
  }
}
