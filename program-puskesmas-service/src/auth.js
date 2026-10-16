import jwt from "jsonwebtoken";
import config from "./config.js";

// Verifikasi token yang diterbitkan auth-service (HS256, SECRET_KEY yang sama dengan layanan lain).
// Header: "Authorization: Bearer <token>" atau token mentah.
export const wajibLogin = (req, res, next) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token) return res.status(401).json({ message: "Token tidak ditemukan" });
  try {
    const isi = jwt.verify(token, config.secretKey, { algorithms: ["HS256"] });
    if (!isi.faskesUuid) return res.status(401).json({ message: "Token tidak memuat faskes" });
    req.author = { faskesUuid: isi.faskesUuid, username: isi.username, role: isi.role, token: `Bearer ${token}` };
    next();
  } catch {
    res.status(401).json({ message: "Token tidak valid" });
  }
};
