export class NotAllowedException extends Error {

  constructor(error, type, message) {
    super(message);
    this.message = {
      message: error,
      errors: [
        {
          type, message
        }
      ]
    };
    this.code = 403;
  }
}
