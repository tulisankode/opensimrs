import config from "../../config.js";
import { satu } from "../../db.js";

// Status fitur bdrs_bridging dari Setting › Manajemen Modul & Fitur. null = tidak diketahui (setting-service tidak
// terjangkau) — fail-closed (sama dengan pacs/izin.js) karena bridging ini berisiko tinggi terhadap keselamatan
// transfusi (golongan darah & IMLTD) — lihat Rancangan Teknis STD-0017 §10.
export const fiturBdrsBridgingAktif = async (token) => {
  try {
    const res = await fetch(`${config.settingUrl}/modul`, {
      signal: AbortSignal.timeout(5000),
      headers: token ? { Authorization: token } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const aktif = data?.payload?.fitur_aktif;
    return Array.isArray(aktif) && aktif.includes("bdrs_bridging");
  } catch (error) {
    console.warn("[bdrs-utd] Gagal membaca status fitur bdrs_bridging:", error.message);
    return false;
  }
};

// Middleware: tolak rute bridging UTD terautentikasi bila fitur nonaktif untuk faskes pengguna. Untuk router yang
// menempel di /permintaan/:uuid (utd-permintaan-rute.js) middleware ini dipasang PER RUTE bridging, bukan router.use,
// agar rute permintaan biasa (detail, status, kunjungan, dst.) tidak ikut tertolak dan tidak memanggil setting-service.
export const wajibFiturBdrsBridgingAktif = async (req, res, next) => {
  if (!(await fiturBdrsBridgingAktif(req.author?.token))) {
    return res.status(403).json({ message: "Fitur Bridging Bank Darah (UTD) belum diaktifkan untuk faskes ini (Setting › Manajemen Modul)" });
  }
  next();
};

// Varian per faskes TANPA token untuk titik masuk push UTD (tidak membawa JWT; token pengguna terdaftar di Redis
// sehingga tidak dapat dibuat sendiri). Membaca katalog & override Manajemen Modul langsung dari database dengan aturan
// yang sama dengan setting-service/src/modul/katalog-modul.js (hitungModulAktif, fiturLayak, hitungFiturAktif) untuk
// satu fitur. Fail-closed: galat membaca database → dianggap nonaktif.
export const fiturAktifFaskes = async (faskesUuid, kodeFitur = "bdrs_bridging") => {
  try {
    const fitur = await satu(`SELECT modul_kode, modul_syarat, wajib, tersedia FROM ref_fitur WHERE kode = $1`, [kodeFitur]);
    if (!fitur?.tersedia) return false;
    // Segmen yang tidak dikenal katalog diperlakukan seperti tanpa segmen (cariSegmen → null): semua modul/fitur bawaan.
    const segmen = (
      await satu(`SELECT fs.segmen_kode FROM faskes_segmen fs JOIN ref_segmen s ON s.kode = fs.segmen_kode WHERE fs.faskes_uuid = $1`, [faskesUuid])
    )?.segmen_kode ?? null;
    // Modul aktif = (bawaan segmen ∪ tambahan) − nonaktif, ditambah modul inti; hanya modul yang tersedia.
    const modulAktif = async (kode) => {
      const modul = await satu(`SELECT inti, tersedia FROM ref_modul WHERE kode = $1`, [kode]);
      if (!modul?.tersedia) return false;
      if (modul.inti) return true;
      const override = await satu(`SELECT aktif FROM faskes_modul_override WHERE faskes_uuid = $1 AND modul_kode = $2`, [faskesUuid, kode]);
      if (override) return !!override.aktif;
      if (!segmen) return true;
      return !!(await satu(`SELECT 1 FROM preset_segmen_modul WHERE segmen_kode = $1 AND modul_kode = $2`, [segmen, kode]));
    };
    // Fitur layak: modul induk (dan modul syarat bila ada) aktif; fitur wajib selalu aktif selama layak.
    if (!(await modulAktif(fitur.modul_kode))) return false;
    if (fitur.modul_syarat && !(await modulAktif(fitur.modul_syarat))) return false;
    if (fitur.wajib) return true;
    // Fitur aktif = (bawaan segmen ∪ tambahan) − nonaktif; bawaan segmen = layak & tidak dimatikan preset segmen.
    const override = await satu(`SELECT aktif FROM faskes_fitur_override WHERE faskes_uuid = $1 AND fitur_kode = $2`, [faskesUuid, kodeFitur]);
    if (override) return !!override.aktif;
    if (!segmen) return true;
    return !(await satu(`SELECT 1 FROM preset_segmen_fitur_mati WHERE segmen_kode = $1 AND fitur_kode = $2`, [segmen, kodeFitur]));
  } catch (error) {
    console.warn(`[bdrs-utd] Gagal membaca status fitur ${kodeFitur} dari database:`, error.message);
    return false;
  }
};
