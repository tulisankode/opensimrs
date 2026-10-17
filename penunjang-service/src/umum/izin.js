import { satu } from "../db.js";
import { Galat } from "./respons.js";

// Hak akses per aksi (Setting › Hak Akses). Daftar izin pengguna dibaca dari users.permissions (sumber yang sama
// dengan login auth-service; database bersama) dan disimpan sementara 60 detik per pengguna. Super admin tanpa daftar
// izin selalu boleh (sama dengan aturan frontend & layanan lain). Struktur izin:
//   [{ module, subModules: [{ name, allows: [..], features: [{ name, allows: [..] }] }] }]
const SIMPAN_MS = 60 * 1000;
const tembolok = new Map();

const teks = (x) => String(x ?? "").trim().toLowerCase();
const daftar = (x) => (Array.isArray(x) ? x : []);
const namaAksi = (a) => (typeof a === "string" ? a : a?.name);

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

const cocok = (izin, modul, submodul, aksi, fitur) => {
  const m = izin.find((x) => teks(x?.module) === teks(modul));
  if (!m) return false;
  const aksiList = (Array.isArray(aksi) ? aksi : [aksi]).map(teks);
  const sub = daftar(m.subModules ?? m.submodules ?? m.sub_modules).filter((s) => teks(s?.name) === teks(submodul));
  return sub.some((s) => {
    const sumber = fitur ? daftar(s.features).find((f) => teks(f?.name) === teks(fitur))?.allows : s.allows;
    return daftar(sumber).some((a) => aksiList.includes(teks(namaAksi(a))));
  });
};

// true bila pengguna login memiliki salah satu aksi pada modul/submodul(/fitur).
export const punyaIzin = async (req, modul, submodul, aksi, fitur = null) => {
  const izin = await izinPengguna(req.author?.username);
  if (!izin.length && teks(req.author?.role) === "super admin") return true;
  return cocok(izin, modul, submodul, aksi, fitur);
};

export const galatIzin = (modul, submodul, aksi, fitur = null) =>
  new Galat(403, `Akses ditolak: Anda tidak memiliki hak ${[modul, submodul, fitur].filter(Boolean).join(" › ")} › ${[].concat(aksi).join("/")}`);

export const pastikanIzin = async (req, modul, submodul, aksi, fitur = null) => {
  if (!(await punyaIzin(req, modul, submodul, aksi, fitur))) throw galatIzin(modul, submodul, aksi, fitur);
};

// Middleware Express: 403 bila tidak berhak.
export const wajibIzin = (modul, submodul, aksi, fitur = null) => (req, res, next) =>
  punyaIzin(req, modul, submodul, aksi, fitur)
    .then((boleh) => (boleh ? next() : res.status(403).json({ message: galatIzin(modul, submodul, aksi, fitur).message })))
    .catch(next);

// Middleware: lolos bila pengguna punya SALAH SATU syarat [modul, submodul, aksi, fitur?]; selain itu 403.
export const wajibSalahSatu = (...syarat) => async (req, res, next) => {
  try {
    for (const [modul, submodul, aksi, fitur] of syarat) if (await punyaIzin(req, modul, submodul, aksi, fitur)) return next();
    res.status(403).json({ message: `Akses ditolak: butuh hak ${syarat.map((s) => s.filter(Boolean).join(" › ")).join(" atau ")}` });
  } catch (e) {
    next(e);
  }
};

// Pintasan per modul.
export const izinPa = (submodul, aksi, fitur = null) => wajibIzin("Patologi Anatomi", submodul, aksi, fitur);
export const izinMikro = (submodul, aksi, fitur = null) => wajibIzin("Mikrobiologi", submodul, aksi, fitur);
export const izinMcu = (submodul, aksi, fitur = null) => wajibIzin("MCU", submodul, aksi, fitur);
export const izinCssd = (submodul, aksi, fitur = null) => wajibIzin("CSSD", submodul, aksi, fitur);
