export default class ServiceUnavailableException extends Error {
  constructor(message) {
    super(message);
    this.message = message;
    this.status = 503;
    this.errors = [
      {
        type: "Service Unavailable",
        message,
      },
    ];
  }
}
