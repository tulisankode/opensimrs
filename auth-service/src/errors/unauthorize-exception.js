export default class UnauthorizeException extends Error {
  constructor(message) {
    super(message);
    this.message = message;
    this.code = 401;
  }
}
