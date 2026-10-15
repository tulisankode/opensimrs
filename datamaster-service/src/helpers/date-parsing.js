import BadRequestException from "../errors/bad_request-exception.js";
import { messageErrorSave } from "../validations/message-validation-error.js";

function parseDateString(dateString) {
  if (typeof dateString !== "string") {
    dateString = String(dateString);
  }

  const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = dateString.match(dateRegex);
  if (!match) {
    throw new BadRequestException(
      messageErrorSave,
      "Format tanggal harus DD-MM-YYYY"
    );
  }

  const [, day, month, year] = match;
  const dayInt = parseInt(day, 10);
  const monthInt = parseInt(month, 10);
  const yearInt = parseInt(year, 10);

  const date = new Date(yearInt, monthInt - 1, dayInt);
  if (
    isNaN(date.getTime()) ||
    date.getDate() !== dayInt ||
    date.getMonth() !== monthInt - 1 ||
    date.getFullYear() !== yearInt
  ) {
    throw new BadRequestException(messageErrorSave, "Tanggal tidak valid");
  }

  return date;
}

function convertDateFormat(dateString) {
  // Memastikan input adalah string
  if (typeof dateString !== "string") {
    return dateString; // Mengembalikan input asli jika bukan string
  }

  // Memeriksa apakah format sesuai dengan YYYY-MM-DD
  const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = dateString.match(dateRegex);

  if (!match) {
    return dateString; // Mengembalikan input asli jika format tidak sesuai
  }

  // Mengekstrak tahun, bulan, dan hari
  const [, year, month, day] = match;

  // Mengembalikan format DD-MM-YYYY
  return `${day}-${month}-${year}`;
}

function parseData(data) {
  return {
    ...data,
    tanggal_lahir: parseDateString(data.tanggal_lahir),
  };
}

export { parseData, parseDateString, convertDateFormat };
