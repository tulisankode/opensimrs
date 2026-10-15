export default class UsernameException extends Error {
  constructor(message, status) {
    super(message);
    this.message = message;
    this.status = status;
  }
}