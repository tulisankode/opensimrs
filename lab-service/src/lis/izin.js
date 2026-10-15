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

export const punyaIzin = async (author, modul, submodul, aksi) => {
  const izin = await izinPengguna(author?.username);
  if (!izin.length && teks(author?.role) === "super admin") return true;
  const m = izin.find((x) => teks(x?.module) === teks(modul));
  if (!m) return false;
  return daftar(m.subModules ?? m.submodules).some(
    (s) => teks(s?.name) === teks(submodul) && daftar(s.allows).some((a) => teks(typeof a === "string" ? a : a?.name) === teks(aksi)),
  );
};
