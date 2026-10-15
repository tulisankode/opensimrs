import axios from "axios";
import crypto from "node:crypto";
import config from "./config.js";

// Klien API SATUSEHAT: token OAuth2 (client_credentials) per faskes + permintaan FHIR R4.
// Mode "mock" mengembalikan respons tiruan berformat sama tanpa memanggil Kemenkes.

export class GalatSatuSehat extends Error {
  constructor(pesan, status, detail) {
    super(pesan);
    this.status = status;
    this.detail = detail;
  }
}

const cacheToken = new Map(); // client_id → { token, kedaluwarsa }

// Ringkas OperationOutcome FHIR menjadi pesan yang mudah dibaca
export const ringkasGalat = (data) => {
  if (!data) return "";
  if (data.resourceType === "OperationOutcome") {
    return (data.issue ?? []).map((i) => [i.code, i.details?.text ?? i.diagnostics].filter(Boolean).join(": ")).join("; ");
  }
  if (data.resourceType === "Bundle") {
    return (data.entry ?? [])
      .map((e) => e.response?.outcome)
      .filter(Boolean)
      .map(ringkasGalat)
      .join("; ");
  }
  return typeof data === "string" ? data.slice(0, 500) : JSON.stringify(data).slice(0, 500);
};

const idTiruan = (dasar) => crypto.createHash("sha1").update(String(dasar)).digest("hex").slice(0, 12);

// --- respons tiruan (mode mock)
const mock = (metode, jalur, body) => {
  const [resource, sisa] = jalur.replace(/^\//, "").split("?");
  const params = new URLSearchParams(sisa ?? "");
  if (metode === "GET" && (resource === "Patient" || resource === "Practitioner")) {
    const identifier = params.get("identifier") ?? "";
    const nik = identifier.split("|")[1] ?? "";
    // NIK berakhiran 0 dianggap belum terdaftar di SATUSEHAT
    if (!nik || nik.endsWith("0")) return { resourceType: "Bundle", type: "searchset", total: 0, entry: [] };
    const prefix = resource === "Patient" ? "P" : "N";
    return { resourceType: "Bundle", type: "searchset", total: 1, entry: [{ resource: { resourceType: resource, id: `${prefix}${idTiruan(nik)}` } }] };
  }
  if (metode === "GET" && resource.startsWith("Organization/")) {
    return { resourceType: "Organization", id: resource.split("/")[1], name: "Organisasi Simulasi" };
  }
  if (metode === "POST" && resource === "Location") {
    return { resourceType: "Location", id: `L-${idTiruan(JSON.stringify(body?.identifier ?? body?.name))}` };
  }
  if (metode === "POST" && !resource) {
    return {
      resourceType: "Bundle",
      type: "transaction-response",
      entry: (body?.entry ?? []).map((e) => ({
        response: {
          status: "201 Created",
          resourceType: e.resource.resourceType,
          resourceID: `${e.resource.resourceType.slice(0, 3)}-${idTiruan(e.fullUrl)}`,
          location: `${e.resource.resourceType}/${e.resource.resourceType.slice(0, 3)}-${idTiruan(e.fullUrl)}/_history/1`,
        },
      })),
    };
  }
  return { resourceType: "OperationOutcome", issue: [{ code: "not-supported", diagnostics: `mock: ${metode} ${jalur}` }] };
};

export const ambilToken = async (kredensial, { paksa = false } = {}) => {
  const { clientId, clientSecret } = kredensial;
  if (!clientId || !clientSecret) throw new GalatSatuSehat("Client ID / Client Secret SATUSEHAT belum diisi", 400);
  if (config.mode === "mock") return "token-mock";

  const tersimpan = cacheToken.get(clientId);
  if (!paksa && tersimpan && tersimpan.kedaluwarsa > Date.now() + 60_000) return tersimpan.token;

  try {
    const { data } = await axios.post(
      `${config.authUrl}/accesstoken?grant_type=client_credentials`,
      new URLSearchParams({ client_id: clientId, client_secret: clientSecret }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: config.timeoutMs }
    );
    const detik = Number(data.expires_in) || 3600;
    cacheToken.set(clientId, { token: data.access_token, kedaluwarsa: Date.now() + detik * 1000 });
    return data.access_token;
  } catch (error) {
    const status = error.response?.status;
    throw new GalatSatuSehat(
      status === 401 ? "Client ID / Client Secret SATUSEHAT ditolak" : `Gagal mengambil token SATUSEHAT: ${error.message}`,
      status ?? 502,
      error.response?.data
    );
  }
};

export const fhir = async (kredensial, metode, jalur, body) => {
  if (config.mode === "mock") {
    const data = mock(metode, jalur, body);
    if (data.resourceType === "OperationOutcome") throw new GalatSatuSehat(ringkasGalat(data), 400, data);
    return data;
  }

  const kirim = async (token) =>
    axios.request({
      method: metode,
      url: `${config.fhirUrl}${jalur.startsWith("/") ? "" : "/"}${jalur}`,
      data: body,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      timeout: config.timeoutMs,
    });

  try {
    let token = await ambilToken(kredensial);
    try {
      return (await kirim(token)).data;
    } catch (error) {
      if (error.response?.status !== 401) throw error;
      token = await ambilToken(kredensial, { paksa: true }); // token kedaluwarsa lebih awal
      return (await kirim(token)).data;
    }
  } catch (error) {
    if (error instanceof GalatSatuSehat) throw error;
    const data = error.response?.data;
    throw new GalatSatuSehat(ringkasGalat(data) || error.message, error.response?.status ?? 502, data);
  }
};
