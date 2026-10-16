import { satu } from "./db.js";
import { Galat } from "./respons.js";
import { isSuperadmin } from "./auth.js";

// Hak akses modul izin "SIMRS Studio" (Setting › Hak Akses / Datamaster › Role). Daftar izin pengguna dibaca dari
// users.permissions (sumber yang sama dengan login) dan disimpan sementara 60 detik. Superadmin selalu boleh.
export const MODUL = "SIMRS Studio";
const SIMPAN_MS = 60 * 1000;
const tembolok = new Map();
const teks = (x) => String(x ?? "").trim().toLowerCase();
const daftar = (x) => (Array.isArray(x) ? x : []);

const izinPengguna = async (username) => {
  if (!username) return [];
  const ada = tembolok.get(username);
  if (ada && Date.now() - ada.pada < SIMPAN_MS) return ada.izin;
  const baris = await satu(`SELECT permissions FROM users WHERE username = $1 AND deleted_at IS NULL LIMIT 1`, [username]);
  let izin = baris?.permissions ?? [];
  if (typeof izin === "string") {
    try {
      izin = JSON.parse(izin);
    } catch {
      izin = [];
    }
  }
  izin = daftar(izin);
  tembolok.set(username, { pada: Date.now(), izin });
  return izin;
};

// Submodul Studio yang dimiliki pengguna → { submodul: Set(aksi) }
export const izinStudio = async (req) => {
  const izin = await izinPengguna(req.author?.username);
  const m = izin.find((x) => teks(x?.module) === teks(MODUL));
  const hasil = {};
  for (const s of daftar(m?.subModules ?? m?.submodules ?? m?.sub_modules)) {
    hasil[s.name] = new Set(daftar(s.allows).map((a) => teks(typeof a === "string" ? a : a?.name)));
  }
  return hasil;
};

export const punyaAksesStudio = async (req) => isSuperadmin(req) || Object.keys(await izinStudio(req)).length > 0;

export const punya = async (req, submodul, aksi) => {
  if (isSuperadmin(req)) return true;
  const izin = await izinStudio(req);
  const aksiList = [].concat(aksi).map(teks);
  return aksiList.some((a) => izin[submodul]?.has(a));
};

export const pastikan = async (req, submodul, aksi) => {
  if (!(await punya(req, submodul, aksi))) throw new Galat(403, `Akses ditolak: perlu hak ${MODUL} › ${submodul} › ${[].concat(aksi).join("/")}`);
};

// Ringkas untuk frontend: { "PRD": ["READ","SETUJUI"], ... } ; superadmin → "*"
export const ringkasIzin = async (req) => {
  if (isSuperadmin(req)) return "*";
  return Object.fromEntries(Object.entries(await izinStudio(req)).map(([k, v]) => [k, [...v].map((a) => a.toUpperCase())]));
};
