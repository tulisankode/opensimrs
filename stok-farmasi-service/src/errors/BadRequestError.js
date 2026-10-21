import ResponseError from "./ResponseError.js";


class BadRequestError extends ResponseError {
 
  constructor(message) {
    super(message, 400);
  }
}

export default BadRequestError;
