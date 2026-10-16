import jwt from "jsonwebtoken";
import config from "./config.js";

// Verifikasi token auth-service (HS256, SECRET_KEY yang sama dengan layanan lain). Format galat 401 sama dengan
// authorization-sdk ({ message: "Authentikasi gagal", errors: [{ type, message }] }) agar frontend mengenali token
// kedaluwarsa dan mengarahkan pengguna ke halaman login seperti di menu lain.
const tolak = (res, type, message) => res.status(401).json({ message: "Authentikasi gagal", errors: [{ type, message }] });

export const wajibLogin = (req, res, next) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token) return tolak(res, "Authorization required", "silakan login terlebih dahulu");
  try {
    const isi = jwt.verify(token, config.secretKey, { algorithms: ["HS256"] });
    req.author = { faskesUuid: isi.faskesUuid, username: isi.username, role: isi.role };
    next();
  } catch {
    tolak(res, "invalid token", "Token tidak valid atau kadaluarsa");
  }
};

export const isSuperadmin = (req) => String(req.author?.role ?? "").trim().toLowerCase() === "super admin";

// Studio (tahap ini) hanya untuk superadmin: mengaktifkan, menulis permintaan, menyetujui, menjalankan agen.
export const wajibSuperadmin = (req, res, next) =>
  isSuperadmin(req) ? next() : res.status(403).json({ message: "SIMRS Studio hanya dapat diakses superadmin" });
