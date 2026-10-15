// Katalog Manajemen Modul & Fitur — dibaca dari tabel relasional (ref_segmen, ref_modul, ref_fitur,
// ref_bagian, ref_rute, preset_segmen_*), diisi lewat migrasi dari database/data/katalog-modul.json.
// Fungsi hitung di bawah murni (tanpa DB) dan menerima objek katalog hasil muatKatalog().
import { QueryTypes } from "sequelize";
import sequelizeInstance from "../configurations/sequelize-instance.js";

const CACHE_MS = 30_000;
let cache = null;

const pilih = (sql) => sequelizeInstance.query(sql, { type: QueryTypes.SELECT });
const kelompokkan = (baris, kunci, nilai) => baris.reduce((acc, r) => {
  (acc[r[kunci]] ??= []).push(r[nilai]);
  return acc;
}, {});

export const muatKatalog = async ({ segar = false } = {}) => {
  if (!segar && cache && Date.now() - cache.waktu < CACHE_MS) return cache.data;
  const [jenisPoli, segmen, modul, menu, fitur, bagian, bagianPoli, rute, presetModul, fiturMati, bagianMati] = await Promise.all([
    pilih(`SELECT kode, nama FROM ref_jenis_poli ORDER BY urutan, kode`),
    pilih(`SELECT kode, nama, urutan, ringkas FROM ref_segmen ORDER BY urutan`),
    pilih(`SELECT kode, nama, kelompok, deskripsi, inti, tersedia FROM ref_modul ORDER BY urutan, kode`),
    pilih(`SELECT modul_kode, judul FROM ref_modul_menu`),
    pilih(`SELECT kode, modul_kode, nama, deskripsi, wajib, tersedia, modul_syarat FROM ref_fitur ORDER BY urutan, kode`),
    pilih(`SELECT kode, fitur_kode, label, nama, wajib, modul_syarat FROM ref_bagian ORDER BY urutan, kode`),
    pilih(`SELECT bagian_kode, jenis_poli FROM ref_bagian_poli`),
    pilih(`SELECT modul_kode, fitur_kode, rute FROM ref_rute ORDER BY id`),
    pilih(`SELECT segmen_kode, modul_kode FROM preset_segmen_modul`),
    pilih(`SELECT segmen_kode, fitur_kode FROM preset_segmen_fitur_mati`),
    pilih(`SELECT segmen_kode, bagian_kode FROM preset_segmen_bagian_mati`),
  ]);
  const menuModul = kelompokkan(menu, "modul_kode", "judul");
  const ruteModul = kelompokkan(rute.filter((r) => r.modul_kode), "modul_kode", "rute");
  const ruteFitur = kelompokkan(rute.filter((r) => r.fitur_kode), "fitur_kode", "rute");
  const poliBagian = kelompokkan(bagianPoli, "bagian_kode", "jenis_poli");
  const modulSegmen = kelompokkan(presetModul, "segmen_kode", "modul_kode");

  const data = {
    JENIS_POLI: jenisPoli,
    KATALOG_MODUL: modul.map((m) => ({ ...m, menu: menuModul[m.kode] ?? [], rute: ruteModul[m.kode] ?? [] })),
    KATALOG_FITUR: fitur.map(({ modul_kode, ...f }) => ({ ...f, modul: modul_kode, rute: ruteFitur[f.kode] ?? [] })),
    KATALOG_BAGIAN: bagian.map(({ fitur_kode, modul_syarat, ...b }) => ({
      ...b, fitur: fitur_kode, ...(modul_syarat ? { modul: modul_syarat } : {}), poli: poliBagian[b.kode] ?? [],
    })),
    SEGMEN: segmen.map((s) => ({ ...s, modul: modulSegmen[s.kode] ?? [] })),
    FITUR_MATI_SEGMEN: kelompokkan(fiturMati, "segmen_kode", "fitur_kode"),
    BAGIAN_MATI_SEGMEN: kelompokkan(bagianMati, "segmen_kode", "bagian_kode"),
  };
  cache = { waktu: Date.now(), data };
  return data;
};

export const cariSegmen = (K, kode) => K.SEGMEN.find((s) => s.kode === kode) ?? null;

// Modul aktif = (bawaan segmen ∪ tambahan) − nonaktif, + inti; hanya yang tersedia. Tanpa segmen → semua.
export const hitungModulAktif = (K, { segmen, tambahan = [], nonaktif = [] }) => {
  const tersedia = (k) => K.KATALOG_MODUL.find((m) => m.kode === k)?.tersedia;
  const s = cariSegmen(K, segmen);
  const dasar = s ? s.modul : K.KATALOG_MODUL.map((m) => m.kode);
  const aktif = new Set([...dasar, ...tambahan].filter((k) => !nonaktif.includes(k)));
  K.KATALOG_MODUL.filter((m) => m.inti).forEach((m) => aktif.add(m.kode));
  return [...aktif].filter(tersedia);
};

// Fitur layak: modul induknya aktif dan modul syaratnya (bila ada, mis. BPJS FKRTL) juga aktif.
export const fiturLayak = (f, modulAktif) => modulAktif.includes(f.modul) && (!f.modul_syarat || modulAktif.includes(f.modul_syarat));

// Fitur bawaan segmen: fitur layak kecuali yang dimatikan preset.
export const fiturBawaan = (K, segmen, modulAktif) => {
  const mati = K.FITUR_MATI_SEGMEN[segmen] ?? [];
  return K.KATALOG_FITUR.filter((f) => fiturLayak(f, modulAktif) && !mati.includes(f.kode)).map((f) => f.kode);
};

// Fitur aktif = (bawaan ∪ tambahan) − nonaktif; fitur wajib selalu aktif selama layak.
export const hitungFiturAktif = (K, { segmen, modulAktif, tambahan = [], nonaktif = [] }) => {
  const dasar = cariSegmen(K, segmen) ? fiturBawaan(K, segmen, modulAktif) : K.KATALOG_FITUR.map((f) => f.kode);
  const aktif = new Set([...dasar, ...tambahan].filter((k) => !nonaktif.includes(k)));
  return K.KATALOG_FITUR.filter((f) => f.tersedia && (f.wajib || aktif.has(f.kode)) && fiturLayak(f, modulAktif)).map((f) => f.kode);
};

// Bagian bawaan segmen: fitur induk aktif, modul syarat aktif, tidak dimatikan preset (wajib selalu ikut).
export const bagianBawaan = (K, segmen, fiturAktif, modulAktif) => {
  const mati = K.BAGIAN_MATI_SEGMEN[segmen] ?? [];
  return K.KATALOG_BAGIAN.filter((b) => fiturAktif.includes(b.fitur) && (!b.modul || modulAktif.includes(b.modul))
    && (b.wajib || !mati.includes(b.kode))).map((b) => b.kode);
};

export const hitungBagianAktif = (K, { segmen, fiturAktif, modulAktif, tambahan = [], nonaktif = [] }) => {
  const layak = (b) => fiturAktif.includes(b.fitur) && (!b.modul || modulAktif.includes(b.modul));
  const dasar = cariSegmen(K, segmen) ? bagianBawaan(K, segmen, fiturAktif, modulAktif) : K.KATALOG_BAGIAN.map((b) => b.kode);
  const aktif = new Set([...dasar, ...tambahan].filter((k) => !nonaktif.includes(k)));
  return K.KATALOG_BAGIAN.filter((b) => layak(b) && (b.wajib || aktif.has(b.kode))).map((b) => b.kode);
};

// Hitung seluruh status (modul → fitur → bagian) dari segmen & override per tingkat.
export const hitungKonfigurasi = (K, { segmen, override }) => {
  const modulAktif = hitungModulAktif(K, { segmen, tambahan: override.modul.tambahan, nonaktif: override.modul.nonaktif });
  const fiturAktif = hitungFiturAktif(K, { segmen, modulAktif, tambahan: override.fitur.tambahan, nonaktif: override.fitur.nonaktif });
  const bagianAktif = hitungBagianAktif(K, { segmen, fiturAktif, modulAktif, tambahan: override.bagian.tambahan, nonaktif: override.bagian.nonaktif });
  return { modulAktif, fiturAktif, bagianAktif };
};
