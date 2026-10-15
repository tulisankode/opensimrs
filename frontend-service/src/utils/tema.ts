// Tema warna & logo faskes (Setting › Profil Faskes › Logo & Warna).
// Warna utama (`bgWarna`) diturunkan menjadi palet `opensimrs-50..500` di variabel CSS (dipakai Tailwind
// `bg-opensimrs-300` dst.) dan palet primary PrimeVue, sehingga layout, tombol, dan menu ikut berubah.
import { ref } from "vue";
import { updatePrimaryPalette } from "@primevue/themes";

export const WARNA_BAWAAN = "#14b8a6";
const KUNCI_PROFIL = "faskes_profile";

const keRgb = (hex: string): [number, number, number] | null => {
  const h = hex.trim().replace("#", "");
  const p = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(p)) return null;
  return [0, 2, 4].map((i) => parseInt(p.slice(i, i + 2), 16)) as [number, number, number];
};
const keHex = (rgb: number[]) => "#" + rgb.map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
// t > 0 dicampur putih, t < 0 dicampur hitam.
const campur = (rgb: [number, number, number], t: number) =>
  rgb.map((c) => (t >= 0 ? c + (255 - c) * t : c * (1 + t))) as [number, number, number];

// Tingkat palet Tailwind `opensimrs` (300 = warna utama), mengikuti jarak palet bawaan.
const TINGKAT: Record<string, number> = { "50": 0.9, "75": 0.56, "100": 0.42, "200": 0.18, "300": 0, "400": -0.3, "500": -0.4 };
// Tingkat palet primary PrimeVue (500 = warna utama).
const TINGKAT_PRIME: Record<string, number> = {
  "50": 0.9, "100": 0.78, "200": 0.6, "300": 0.4, "400": 0.2, "500": 0,
  "600": -0.15, "700": -0.3, "800": -0.45, "900": -0.6, "950": -0.75,
};

let paletAktif: Record<string, string> = {};

const baca = (): any => {
  try {
    return JSON.parse(localStorage.getItem(KUNCI_PROFIL) ?? "null") ?? {};
  } catch {
    return {};
  }
};

// Profil faskes aktif (reaktif) — sumber nama, logo & warna untuk header, footer, login.
export const profilFaskes = ref<any>(baca());

export const terapkanTema = (warna?: string | null) => {
  const dasar = keRgb(warna || "") ?? keRgb(WARNA_BAWAAN)!;
  const root = document.documentElement;
  paletAktif = {};
  for (const [nama, t] of Object.entries(TINGKAT)) {
    const rgb = campur(dasar, t);
    root.style.setProperty(`--opensimrs-${nama}`, rgb.map(Math.round).join(" "));
    paletAktif[nama] = keHex(rgb);
  }
  try {
    updatePrimaryPalette(Object.fromEntries(Object.entries(TINGKAT_PRIME).map(([n, t]) => [n, keHex(campur(dasar, t))])));
  } catch {
    /* PrimeVue belum siap: palet Tailwind tetap berlaku */
  }
};

// Hex warna tema aktif, untuk tempat yang tidak bisa memakai variabel CSS (PDF, grafik canvas).
export const warnaTema = (tingkat: keyof typeof TINGKAT | string = "300") => paletAktif[tingkat] ?? WARNA_BAWAAN;

// Simpan profil faskes (login, pindah faskes, ubah Setting) lalu terapkan tema & logo.
export const segarkanProfil = (data: any) => {
  try {
    localStorage.setItem(KUNCI_PROFIL, JSON.stringify(data ?? {}));
  } catch {
    /* cache tidak wajib */
  }
  profilFaskes.value = data ?? {};
  terapkanTema(data?.bgWarna ?? data?.bg_warna);
};

// Logo faskes (data URL) bila sudah diunggah; null = pakai logo aplikasi bawaan.
export const logoFaskes = () => {
  const logo = profilFaskes.value?.logo;
  return typeof logo === "string" && logo.startsWith("data:image") ? logo : null;
};
