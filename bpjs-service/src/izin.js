import { satu } from "./db.js";
import { GalatBpjs } from "./klien-pcare.js";

// Hak akses per aksi (Setting › Hak Akses), pola sama dengan penunjang-service/src/umum/izin.js: bpjs-service tidak
// memakai permission-sdk, jadi daftar izin pengguna dibaca dari users.permissions (sumber yang sama dengan login
// auth-service; database bersama) dan disimpan sementara 60 detik per pengguna. Super admin tanpa daftar izin selalu
// boleh (sama dengan aturan frontend & layanan lain). Struktur izin:
//   [{ module, subModules: [{ name, allows: [..], features: [{ name, allows: [..] }] }] }]
const SIMPAN_MS = 60 * 1000;
const tembolok = new Map();

const teks = (x) => String(x ?? "").trim().toLowerCase();
const daftar = (x) => (Array.isArray(x) ? x : []);
const namaAksi = (a) => (typeof a === "string" ? a : a?.name);

// Username tidak dijamin unik lintas faskes, jadi pembacaan dan tembolok WAJIB diikat ke faskes_uuid token —
// tanpa ini pengguna faskes lain dengan username yang sama dapat membaca/memengaruhi izin faskes aktif (STD-0055).
const izinPengguna = async (faskesUuid, username) => {
  if (!username || !faskesUuid) return [];
  const kunci = `${faskesUuid}:${username}`;
  const ada = tembolok.get(kunci);
  if (ada && Date.now() - ada.pada < SIMPAN_MS) return ada.izin;
  const baris = await satu(`SELECT permissions FROM users WHERE username = $1 AND faskes_uuid = $2 AND deleted_at IS NULL LIMIT 1`, [
    username, faskesUuid,
  ]);
  let izin = baris?.permissions ?? [];
  if (typeof izin === "string") {
    try {
      izin = JSON.parse(izin);
    } catch {
      izin = [];
    }
  }
  izin = daftar(izin);
  tembolok.set(kunci, { pada: Date.now(), izin });
  return izin;
};

// Fungsi murni (diuji di test/vclaim-surat.test.js): true bila daftar izin memuat salah satu aksi pada modul/submodul.
export const cocokIzin = (izin, modul, submodul, aksi) => {
  const m = daftar(izin).find((x) => teks(x?.module) === teks(modul));
  if (!m) return false;
  const aksiList = (Array.isArray(aksi) ? aksi : [aksi]).map(teks);
  const sub = daftar(m.subModules ?? m.submodules ?? m.sub_modules).filter((s) => teks(s?.name) === teks(submodul));
  return sub.some((s) => daftar(s.allows).some((a) => aksiList.includes(teks(namaAksi(a)))));
};

// true bila pengguna login memiliki salah satu aksi pada modul/submodul.
export const punyaIzin = async (req, modul, submodul, aksi) => {
  const izin = await izinPengguna(req.author?.faskesUuid, req.author?.username);
  if (!izin.length && teks(req.author?.role) === "super admin") return true;
  return cocokIzin(izin, modul, submodul, aksi);
};

const pesanIzin = (modul, submodul, aksi) => `Akses ditolak: Anda tidak memiliki hak ${modul} › ${submodul} › ${[].concat(aksi).join("/")}`;

export const pastikanIzin = async (req, modul, submodul, aksi) => {
  if (!(await punyaIzin(req, modul, submodul, aksi))) throw new GalatBpjs(pesanIzin(modul, submodul, aksi), 403);
};

// Middleware Express: 403 bila tidak berhak; galat membaca izin (mis. database) juga ditolak, bukan diloloskan.
export const wajibIzin = (modul, submodul, aksi) => (req, res, next) =>
  punyaIzin(req, modul, submodul, aksi)
    .then((boleh) => (boleh ? next() : res.status(403).json({ message: pesanIzin(modul, submodul, aksi) })))
    .catch((error) => {
      console.warn("[izin] Gagal membaca hak akses:", error.message);
      res.status(403).json({ message: "Akses ditolak: hak akses pengguna tidak dapat diperiksa" });
    });

// Izin "Admisi › Rencana Kontrol & SPRI" (auth-service/src/helpers/permission-list.js) — STD-0021.
export const MODUL_SURAT = "Admisi";
export const SUBMODUL_SURAT = "Rencana Kontrol & SPRI";
export const izinSurat = (aksi) => wajibIzin(MODUL_SURAT, SUBMODUL_SURAT, aksi);
