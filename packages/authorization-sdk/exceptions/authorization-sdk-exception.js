export default class AuthorizationSdkException extends Error {
    constructor(message) {
      super(message);
      this.message = message;
      this.code = 401;
    }
  }
  