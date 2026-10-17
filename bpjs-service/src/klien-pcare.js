import crypto from "node:crypto";
import lz from "lz-string";
import config from "./config.js";

// Klien web service BPJS PCare (JKN API Gateway).
// Header: X-cons-id, X-timestamp (epoch detik UTC), X-signature = base64(HMAC-SHA256(consId&timestamp, secretKey)),
//         X-authorization = Basic base64(username:password:kdAplikasi), user_key.
// Respons `response` terenkripsi: AES-256-CBC, kunci = SHA-256(consId + secretKey + timestamp),
//         IV = 16 byte pertama kunci, lalu didekompresi LZ-String (decompressFromEncodedURIComponent).

export class GalatBpjs extends Error {
  constructor(pesan, status, detail) {
    super(pesan);
    this.status = status;
    this.detail = detail;
  }
}

export const tandaTangan = (consId, secretKey, timestamp) =>
  crypto.createHmac("sha256", secretKey).update(`${consId}&${timestamp}`).digest("base64");

export const otorisasi = (username, password, kdAplikasi = "095") =>
  `Basic ${Buffer.from(`${username}:${password}:${kdAplikasi}`).toString("base64")}`;

const kunciDekripsi = (consId, secretKey, timestamp) => {
  const kunci = crypto.createHash("sha256").update(`${consId}${secretKey}${timestamp}`, "utf8").digest();
  return { kunci, iv: kunci.subarray(0, 16) };
};

export const dekripsiRespons = (teks, consId, secretKey, timestamp) => {
  const { kunci, iv } = kunciDekripsi(consId, secretKey, timestamp);
  const decipher = crypto.createDecipheriv("aes-256-cbc", kunci, iv);
  const terbuka = decipher.update(String(teks), "base64", "utf8") + decipher.final("utf8");
  return JSON.parse(lz.decompressFromEncodedURIComponent(terbuka));
};

// Kebalikan dekripsi — dipakai mode simulasi & pengujian
export const enkripsiRespons = (objek, consId, secretKey, timestamp) => {
  const { kunci, iv } = kunciDekripsi(consId, secretKey, timestamp);
  const cipher = crypto.createCipheriv("aes-256-cbc", kunci, iv);
  const terkompresi = lz.compressToEncodedURIComponent(JSON.stringify(objek));
  return cipher.update(terkompresi, "utf8", "base64") + cipher.final("base64");
};

export const header = (kred, timestamp = Math.floor(Date.now() / 1000)) => ({
  "X-cons-id": kred.consId,
  "X-timestamp": String(timestamp),
  "X-signature": tandaTangan(kred.consId, kred.secretKey, timestamp),
  "X-authorization": otorisasi(kred.username, kred.password, kred.kdAplikasi || "095"),
  user_key: kred.userKey,
});

// --- simulasi -------------------------------------------------------------------------------------
const tiruan = (metode, jalur, body) => {
  const s = jalur.replace(/^\//, "");
  const ok = (response, code = 200, message = "OK") => ({ metaData: { code, message }, response });
  if (s.startsWith("poli/fktp")) {
    return ok({ count: 3, list: [
      { kdPoli: "001", nmPoli: "UMUM", poliSakit: true },
      { kdPoli: "002", nmPoli: "GIGI & MULUT", poliSakit: true },
      { kdPoli: "003", nmPoli: "KIA", poliSakit: true },
    ] });
  }
  if (s.startsWith("dokter")) {
    return ok({ count: 2, list: [{ kdDokter: "131491", nmDokter: "dr. Simulasi Satu" }, { kdDokter: "131492", nmDokter: "dr. Simulasi Dua" }] });
  }
  if (s.startsWith("kesadaran")) {
    return ok({ count: 4, list: [{ kdSadar: "01", nmSadar: "Compos mentis" }, { kdSadar: "02", nmSadar: "Somnolence" }, { kdSadar: "03", nmSadar: "Sopor" }, { kdSadar: "04", nmSadar: "Coma" }] });
  }
  if (s.startsWith("diagnosa/")) {
    const kata = decodeURIComponent(s.split("/")[1] ?? "");
    return ok({ count: 1, list: [{ kdDiag: kata.toUpperCase(), nmDiag: `Diagnosa ${kata.toUpperCase()}`, nonSpesialis: true }] });
  }
  if (s.startsWith("peserta/")) {
    const nomor = s.split("/").pop();
    // nomor berakhiran 0 dianggap tidak terdaftar
    if (!nomor || nomor.endsWith("0")) return { metaData: { code: 204, message: "Data peserta tidak ditemukan" }, response: null };
    return ok({
      noKartu: nomor.length === 13 ? nomor : `000${nomor.slice(-10)}`,
      nama: "PESERTA SIMULASI",
      hubunganKeluarga: "Peserta",
      sex: "L",
      tglLahir: "01-01-1990",
      kdProviderPst: { kdProvider: "0114A026", nmProvider: "KLINIK SIMULASI" },
      jnsKelas: { nama: "KELAS III", kode: "3" },
      jnsPeserta: { nama: "PBI (APBN)", kode: "21" },
      aktif: true,
      ketAktif: "AKTIF",
      noKTP: nomor.length === 16 ? nomor : "3201010101900001",
    });
  }
  if (metode === "POST" && s.startsWith("pendaftaran")) {
    if (!body?.noKartu || !body?.kdPoli) return { metaData: { code: 412, message: "noKartu / kdPoli wajib diisi" }, response: null };
    return ok({ field: "noUrut", message: `A${String(Math.floor(Math.random() * 90) + 10)}` }, 201, "CREATED");
  }
  if (metode === "POST" && s.startsWith("kunjungan")) {
    if (!body?.kdDiag1) return { metaData: { code: 412, message: "kdDiag1 wajib diisi" }, response: null };
    return ok({ field: "noKunjungan", message: `0114U${Date.now().toString().slice(-9)}Y000001` }, 201, "CREATED");
  }
  // STD-0020 — MCU PCare (draf, lihat pcare-peta.js#buatMcu): simulasi tambah/ubah selalu sukses selama noKunjungan
  // terisi, kecuali noKunjungan berakhiran '0' (ditolak, meniru pola simulasi peserta/pendaftaran di atas).
  // Simulasi hapus selalu sukses bila noKunjungan terisi.
  if (metode === "POST" && s.startsWith("mcu/insert")) {
    if (!body?.noKunjungan) return { metaData: { code: 412, message: "noKunjungan wajib diisi" }, response: null };
    if (String(body.noKunjungan).endsWith("0")) return { metaData: { code: 400, message: "simulasi: data MCU ditolak PCare" }, response: null };
    return ok({ field: "noMcu", message: `MCU${Date.now().toString().slice(-10)}` }, 201, "CREATED");
  }
  if (metode === "POST" && s.startsWith("mcu/update")) {
    if (!body?.noKunjungan) return { metaData: { code: 412, message: "noKunjungan wajib diisi" }, response: null };
    if (String(body.noKunjungan).endsWith("0")) return { metaData: { code: 400, message: "simulasi: pembaruan data MCU ditolak PCare" }, response: null };
    return ok({ field: "noMcu", message: `MCU${Date.now().toString().slice(-10)}` }, 200, "UPDATED");
  }
  if (metode === "DELETE" && s.startsWith("mcu/delete")) {
    if (!body?.noKunjungan) return { metaData: { code: 412, message: "noKunjungan wajib diisi" }, response: null };
    return ok({ field: "noKunjungan", message: "Laporan MCU dihapus (simulasi)" }, 200, "DELETED");
  }
  return { metaData: { code: 404, message: `simulasi: ${metode} ${s} tidak tersedia` }, response: null };
};

// --- permintaan -----------------------------------------------------------------------------------
export const pcare = async (kred, metode, jalur, body) => {
  for (const f of ["consId", "secretKey", "userKey", "username", "password"]) {
    if (!kred?.[f]) throw new GalatBpjs("Konfigurasi BPJS PCare belum lengkap", 422);
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const h = header(kred, timestamp);
  let json;

  if (config.mode === "mock") {
    json = tiruan(metode, jalur, body);
    if (json.response != null) json.response = enkripsiRespons(json.response, kred.consId, kred.secretKey, timestamp);
  } else {
    const url = `${config.pcareUrl}/${jalur.replace(/^\//, "")}`;
    const init = { method: metode, headers: { ...h, Accept: "application/json" }, signal: AbortSignal.timeout(config.timeoutMs) };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers["Content-Type"] = config.pcareContentType;
    }
    let teks = "";
    try {
      const res = await fetch(url, init);
      teks = await res.text();
      json = JSON.parse(teks);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new GalatBpjs(`Respons BPJS bukan JSON: ${teks.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)}`, 502);
      }
      throw new GalatBpjs(`Gagal menghubungi BPJS PCare: ${error.message}`, 502);
    }
  }

  const meta = json.metaData ?? json.metadata ?? {};
  const kode = Number(meta.code);
  let response = json.response ?? null;
  if (typeof response === "string" && response) {
    try {
      response = dekripsiRespons(response, kred.consId, kred.secretKey, h["X-timestamp"]);
    } catch {
      throw new GalatBpjs("Respons BPJS tidak dapat didekripsi (periksa Cons ID / Secret Key)", 502);
    }
  }
  if (!(kode >= 200 && kode < 300)) {
    // pesan galat PCare kadang berupa daftar { field, message } di response
    const rinci = Array.isArray(response) ? response.map((r) => [r.field, r.message].filter(Boolean).join(": ")).join("; ") : "";
    throw new GalatBpjs([meta.message, rinci].filter(Boolean).join(" — ") || `Galat BPJS (kode ${meta.code})`, kode >= 400 && kode < 600 ? kode : 502, json);
  }
  return { kode, pesan: meta.message, response };
};
