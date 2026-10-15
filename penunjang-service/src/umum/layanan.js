import { Galat } from "./respons.js";

// Panggilan HTTP ke layanan OpenSIMRS lain (lab-service, admisi-service, ...) dengan token pengguna yang sama.
// Galat layanan tujuan diteruskan sebagai 4xx (pesan asli) atau 502 (layanan tidak dapat dihubungi / galat server).
export const panggilLayanan = async (url, { method = "GET", body, token, nama = "layanan" } = {}) => {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new Galat(502, `${nama} tidak dapat dihubungi: ${e.message}`);
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* respons tanpa JSON */
  }
  if (!res.ok) {
    const pesan = json?.errors?.[0]?.message || json?.message || json?.error || `HTTP ${res.status}`;
    // 401 dari layanan tujuan tidak diteruskan apa adanya (frontend akan menganggap sesi berakhir).
    const status = res.status >= 400 && res.status < 500 && res.status !== 401 ? res.status : 502;
    throw new Galat(status, `${nama}: ${pesan}`);
  }
  return json;
};
