import { QueryTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

// Hak akses per aksi (Setting › Hak Akses) untuk rute LIS massal. Daftar izin dibaca dari users.permissions (database
// bersama, sumber yang sama dengan login) dan disimpan sementara 60 detik. Super admin tanpa daftar izin selalu boleh.
// Struktur: [{ module, subModules: [{ name, allows: [..], features: [{ name, allows }] }] }]
const SIMPAN_MS = 60 * 1000;
const tembolok = new Map();
const teks = (x) => String(x ?? "").trim().toLowerCase();
const daftar = (x) => (Array.isArray(x) ? x : []);

const izinPengguna = async (username) => {
  if (!username) return [];
  const ada = tembolok.get(username);
  if (ada && Date.now() - ada.pada < SIMPAN_MS) return ada.izin;
  const [baris] = await sequelizeInstance.query(`SELECT permissions FROM users WHERE username = $1 AND deleted_at IS NULL LIMIT 1`, {
    bind: [username],
    type: QueryTypes.SELECT,
  });
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

// fitur (opsional): izin tingkat fitur di dalam submodul, mis. Datamaster › Item Pemeriksaan.
export const punyaIzin = async (author, modul, submodul, aksi, fitur = null) => {
  const izin = await izinPengguna(author?.username);
  if (!izin.length && teks(author?.role) === "super admin") return true;
  const m = izin.find((x) => teks(x?.module) === teks(modul));
  if (!m) return false;
  return daftar(m.subModules ?? m.submodules).some((s) => {
    if (teks(s?.name) !== teks(submodul)) return false;
    const allows = fitur ? daftar(s.features).find((f) => teks(f?.name) === teks(fitur))?.allows : s.allows;
    return daftar(allows).some((a) => teks(typeof a === "string" ? a : a?.name) === teks(aksi));
  });
};

// Middleware: lolos bila pengguna punya SALAH SATU syarat [modul, submodul, aksi, fitur?]; selain itu 403.
export const wajibSalahSatu = (...syarat) => async (req, res, next) => {
  try {
    for (const [modul, submodul, aksi, fitur] of syarat) if (await punyaIzin(req.author, modul, submodul, aksi, fitur)) return next();
    res.status(403).json({ message: `Akses ditolak: butuh hak ${syarat.map((s) => s.filter(Boolean).join(" › ")).join(" atau ")}` });
  } catch (e) {
    next(e);
  }
};
