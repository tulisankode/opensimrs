import crypto from "crypto";

// Enkripsi token Gateway Helpdesk sebelum disimpan. Format sama dengan lab-service/bpjs-service/studio-service:
// "enc:v1:<iv>:<tag>:<data>" (AES-256-GCM, kunci = SHA-256(HELPDESK_KUNCI_RAHASIA | SECRET_KEY)).
const AWALAN = "enc:v1:";

const kunci = () => {
  const sumber = process.env.HELPDESK_KUNCI_RAHASIA || process.env.SECRET_KEY;
  if (!sumber) throw new Error("HELPDESK_KUNCI_RAHASIA / SECRET_KEY belum diatur");
  return crypto.createHash("sha256").update(String(sumber)).digest();
};

export const enkripsi = (teks) => {
  if (teks == null || teks === "") return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", kunci(), iv);
  const data = Buffer.concat([cipher.update(String(teks), "utf8"), cipher.final()]);
  return `${AWALAN}${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`;
};

export const dekripsi = (nilai) => {
  if (!nilai) return null;
  if (!String(nilai).startsWith(AWALAN)) return String(nilai);
  const [ivB64, tagB64, dataB64] = String(nilai).slice(AWALAN.length).split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", kunci(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
};

export const samarkan = (teks) => (teks ? `••••••••${String(teks).slice(-4)}` : "");
