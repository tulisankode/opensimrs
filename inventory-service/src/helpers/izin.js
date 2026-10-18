import { UserModel } from "@opensimrs/model-sdk/datamaster";

// Hak akses per aksi (Setting › Hak Akses), pola sama dengan penunjang-service/src/umum/izin.js tapi memakai
// Sequelize (model-sdk) karena inventory-service tidak memakai `pg` langsung. Daftar izin dibaca dari
// users.permissions (sumber yang sama dengan login auth-service; database bersama) & disimpan sementara 60 detik.
// Super admin tanpa daftar izin selalu boleh (sama dengan aturan frontend & layanan lain). Struktur izin:
//   [{ module, subModules: [{ name, allows: [..], features: [{ name, allows: [..] }] }] }]
const SIMPAN_MS = 60 * 1000;
const tembolok = new Map();

const teks = (x) => String(x ?? "").trim().toLowerCase();
const daftar = (x) => (Array.isArray(x) ? x : []);
const namaAksi = (a) => (typeof a === "string" ? a : a?.name);

const izinPengguna = async (uuid) => {
  if (!uuid) return [];
  const ada = tembolok.get(uuid);
  if (ada && Date.now() - ada.pada < SIMPAN_MS) return ada.izin;
  const user = await UserModel.findOne({ where: { uuid }, attributes: ["permissions"] });
  let izin = user?.permissions ?? [];
  if (typeof izin === "string") {
    try {
      izin = JSON.parse(izin);
    } catch {
      izin = [];
    }
  }
  izin = daftar(izin);
  tembolok.set(uuid, { pada: Date.now(), izin });
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
  const izin = await izinPengguna(req.author?.user_uuid);
  if (!izin.length && teks(req.author?.role) === "super admin") return true;
  return cocok(izin, modul, submodul, aksi, fitur);
};

// Middleware Express: 403 bila tidak berhak pada modul "Inventory" › submodul "Pembelian Marketplace".
export const izinMarketplace = (aksi) => (req, res, next) =>
  punyaIzin(req, "Inventory", "Pembelian Marketplace", aksi)
    .then((boleh) =>
      boleh
        ? next()
        : res.status(403).json({
            message: `Akses ditolak: Anda tidak memiliki hak Inventory › Pembelian Marketplace › ${aksi}`,
          })
    )
    .catch(next);
