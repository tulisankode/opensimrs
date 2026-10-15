export default class NotFoundException extends Error {
  constructor(
    message = "Data gagal ditampilkan",
    errorMessage = "Data tidak ditemukan",
    statusCode = 404
  ) {
    super(message);
    this.message = message;
    this.errorMessage = errorMessage;
    this.statusCode = statusCode;
  }
}
