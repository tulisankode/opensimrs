import { faskesDariConsId, kredensial } from "./antrean.js";
import { signatureValid, terbitkanToken, faskesDariToken } from "./klien-antrean.js";

// Endpoint /ws/token: BPJS mengirim X-cons-id/X-timestamp/X-signature (pola sama dengan PCare/VClaim, dibalik —
// lihat klien-antrean.js). Konteks faskes ditentukan dari Cons ID yang cocok di database, bukan dari isi permintaan.
export const terbitkanTokenWs = async (req, res) => {
  const consId = req.header("X-cons-id");
  const timestamp = req.header("X-timestamp");
  const signature = req.header("X-signature");
  const faskesUuid = await faskesDariConsId(consId);
  if (!faskesUuid) return res.status(401).json({ message: "Cons ID tidak dikenal" });
  const kred = await kredensial(faskesUuid);
  if (!kred.aktif || !signatureValid(consId, kred.secretKey, timestamp, signature)) {
    return res.status(401).json({ message: "Tanda tangan tidak valid" });
  }
  res.json({ message: "Token diterbitkan", payload: { token: terbitkanToken(faskesUuid), expires_in: 3600 } });
};

// Middleware untuk seluruh endpoint /ws/* lain: wajib "Authorization: Bearer <token>" hasil /ws/token. faskesUuid
// HANYA berasal dari token ini (KF-15/KT-11), tidak pernah dari body/query permintaan.
export const wajibTokenWs = (req, res, next) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  const faskesUuid = token ? faskesDariToken(token) : null;
  if (!faskesUuid) return res.status(401).json({ message: "Token WS Antrean tidak valid atau kedaluwarsa" });
  req.faskesUuidWs = faskesUuid;
  next();
};
