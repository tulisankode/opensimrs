export function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
  }).format(price);
}

export function formatDate(date: Date, reverse: boolean = false) {
  if (date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    if (reverse) return `${year}-${month}-${day}`;
    else return `${day}-${month}-${year}`;
  } else return "";
}

export function formatTime(date: Date) {
  if (date) {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  } else return "";
}

export function getDateNow(type = "-") {
  let date = formatDate(new Date());
  if (type != "-") {
    date = date.replaceAll("-", type);
  }
  return date;
}

// Helper function to format date to dd-mm-yyyy hh:mm:ss
export function formatDateTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-based
  const year = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

// Nama faskes aktif dari profil yang disimpan saat login / pindah faskes.
export function namaFaskesAktif(cadangan = "Fasilitas Kesehatan"): string {
  try {
    return JSON.parse(localStorage.getItem("faskes_profile") ?? "{}")?.name || cadangan;
  } catch {
    return cadangan;
  }
}

export function dateToEpoch(dateString: Date) {
  const date = new Date(dateString);
  return Math.floor(date.getTime() / 1000);
}

export function epochToDate(
  epochTime: number,
  format: "none" | "dateTime" | "date" | "time" = "none"
) {
  const date = new Date(epochTime * 1000);

  if (format === "dateTime") {
    return formatDateTime(date);
  } else if (format === "date") {
    return formatDate(date);
  } else if (format === "time") {
    return formatTime(date);
  }

  return date;
}

// Function to set the desired time for startDate and endDate
export function setTimeForDate(
  date: Date,
  hours: number,
  minutes: number,
  seconds: number
) {
  const newDate = new Date(date); // Clone the date to avoid mutation
  newDate.setHours(hours, minutes, seconds, 0);
  return newDate;
}

export function setTimeToDate(time: string) {
  let date = new Date();
  const [hours, minutes, seconds] = time.split(":").map(Number);

  date.setHours(hours);
  date.setMinutes(minutes);
  date.setSeconds(seconds);
  return date;
}

export function setDateToTime(date: Date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

export function formatStringDate(
  date: string,
  format: "dateTime" | "date" | "time" = "date"
) {
  const newDate = new Date(date);

  if (format === "dateTime") {
    return formatDateTime(newDate);
  } else if (format === "date") {
    return formatDate(newDate);
  } else if (format === "time") {
    return formatTime(newDate);
  }
}

export function countAge(date: Date) {
  const now = new Date();
  let tahun = now.getFullYear() - date.getFullYear();
  let bulan = now.getMonth() - date.getMonth();
  let hari = now.getDate() - date.getDate();

  // Jika bulan kurang dari 0, kurangi satu tahun
  if (bulan < 0) {
    tahun--;
    bulan += 12;
  }

  // Jika hari kurang dari 0, kurangi satu bulan
  if (hari < 0) {
    bulan--;
    // Ambil jumlah hari dari bulan sebelumnya
    const bulanSebelumnya = new Date(now.getFullYear(), now.getMonth(), 0);
    hari += bulanSebelumnya.getDate();
  }

  return { tahun, bulan, hari };
}

export async function convertImageToBase64(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

export function generateBarcode(barcodeValue: string) {
  var canvas = document.createElement("canvas");

  JsBarcode(canvas, barcodeValue, {
    format: "CODE128",
    displayValue: false,
  });

  return canvas.toDataURL("image/png");
}

export async function generateQRCode(QRCodeValue: string) {
  try {
    const url = await QRCode.toDataURL(QRCodeValue);
    return url;
  } catch (err) {
    throw err;
  }
}

import { hasPermission } from "@/utils/permissions";
export function checkPermission(
  module: string,
  subModule: string,
  feature: string | null = null,
  allows: string | null = null
): boolean {
  return hasPermission(module, subModule, allows ?? "READ", feature);
}

export const numberToWords = (angka: number): string => {
    const bilangan = [
        '', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'
    ];

    const format = (n: number): string => {
        if (n < 12) {
            return bilangan[n];
        }
        if (n < 20) {
            return bilangan[n - 10] + ' belas';
        }
        if (n < 100) {
            return bilangan[Math.floor(n / 10)] + ' puluh ' + bilangan[n % 10];
        }
        if (n < 200) {
            return 'seratus ' + format(n - 100);
        }
        if (n < 1000) {
            return bilangan[Math.floor(n / 100)] + ' ratus ' + format(n % 100);
        }
        if (n < 2000) {
            return 'seribu ' + format(n - 1000);
        }
        if (n < 1000000) {
            return format(Math.floor(n / 1000)) + ' ribu ' + format(n % 1000);
        }
        if (n < 1000000000) {
            return format(Math.floor(n / 1000000)) + ' juta ' + format(n % 1000000);
        }
        if (n < 1000000000000) {
            return format(Math.floor(n / 1000000000)) + ' miliar ' + format(n % 1000000000);
        }
        if (n < 1000000000000000) {
            return format(Math.floor(n / 1000000000000)) + ' triliun ' + format(n % 1000000000000);
        }
        return '';
    };

    const result = format(angka).replace(/\s+/g, ' ').trim();
    return result.charAt(0).toUpperCase() + result.slice(1);
};

// Urutan lokasi tujuan order obat/alkes: depo didahulukan dari gudang, lalu yang pengaturan
// "default tujuan order"-nya paling spesifik (paling sedikit jenis pelayanan), lalu nama.
export function urutkanLokasiTujuan<T extends { jenisLokasi?: string; defaultTujuanOrderPermintaan?: string | null; name?: string }>(daftar: T[]): T[] {
  const bobotJenis = (x: T) => (String(x.jenisLokasi ?? "").toLowerCase() === "depo" ? 0 : 1);
  const cakupan = (x: T) => String(x.defaultTujuanOrderPermintaan ?? "").length || 99;
  return [...daftar].sort((a, b) => bobotJenis(a) - bobotJenis(b) || cakupan(a) - cakupan(b) || String(a.name ?? "").localeCompare(String(b.name ?? "")));
}
