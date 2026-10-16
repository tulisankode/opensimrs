// Modul aktif faskes (Setting › Manajemen Modul): menentukan menu atas & rute yang boleh dibuka.
// Disimpan juga di localStorage agar guard router bisa memeriksa secara sinkron sejak halaman pertama.
import { defineStore } from "pinia";
import { apiAuthPost, apiSettingGet, apiSettingPut } from "@/utils/apiHandler";

const KUNCI = "modul_faskes";

export interface ModulKatalog {
  kode: string;
  nama: string;
  kelompok: string;
  deskripsi: string;
  inti?: boolean;
  tersedia: boolean;
  menu: string[];
  rute: string[];
  aktif: boolean;
  sumber: "inti" | "segmen" | "tambahan" | "nonaktif" | "tidak" | "semua";
}

export interface FiturKatalog {
  kode: string;
  modul: string;
  nama: string;
  deskripsi: string;
  tersedia: boolean;
  wajib?: boolean;
  // Modul lain yang harus aktif agar fitur berlaku (mis. Obat Kronis BPJS → bpjs_fkrtl).
  modulSyarat?: string | null;
  rute: string[];
  aktif: boolean;
  sumber: "segmen" | "tambahan" | "nonaktif" | "tidak" | "semua" | "modul_nonaktif" | "wajib";
}

export interface BagianKatalog {
  kode: string;
  fitur: string;
  label: string;
  nama: string;
  wajib?: boolean;
  modul?: string;
  poli: string[];
  aktif: boolean;
  sumber: "wajib" | "segmen" | "tambahan" | "nonaktif" | "tidak" | "semua" | "fitur_nonaktif";
}

export interface KonfigurasiModul {
  segmen: string | null;
  diatur: boolean;
  diubahOleh: string | null;
  diubahPada: number | null;
  bolehUbah: boolean;
  modulAktif: string[];
  fiturAktif: string[];
  bagianAktif: string[];
  segmenList: Array<{ kode: string; nama: string; urutan: number; ringkas: string; modul: string[]; fiturMati: string[]; bagianMati: string[];
    jumlah?: { modul: number; fitur: number; bagian: number; modulRencana: number } }>;
  katalog: ModulKatalog[];
  katalogFitur: FiturKatalog[];
  katalogBagian: BagianKatalog[];
  jenisPoli: Array<{ kode: string; nama: string }>;
  poli: Array<{ uuid: string; name: string; jenisPoli: string }>;
}

const bacaCache = (): KonfigurasiModul | null => {
  try {
    const s = localStorage.getItem(KUNCI);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

// Modul pemilik suatu path: awalan rute terpanjang yang cocok.
export const modulUntukPath = (path: string, katalog: ModulKatalog[] = bacaCache()?.katalog ?? []) => {
  let cocok: { modul: ModulKatalog; panjang: number } | null = null;
  for (const m of katalog) {
    for (const r of m.rute ?? []) {
      if ((path === r || path.startsWith(r + "/")) && (!cocok || r.length > cocok.panjang)) cocok = { modul: m, panjang: r.length };
    }
  }
  return cocok?.modul ?? null;
};

const fiturUntukPath = (path: string, katalogFitur: FiturKatalog[] = []) =>
  katalogFitur.find((f) => (f.rute ?? []).some((r) => path === r || path.startsWith(r + "/"))) ?? null;

// Dipakai guard router & sidebar (sinkron): false bila path milik modul/fitur yang tidak aktif.
export const ruteDiizinkanModul = (path: string) => {
  const konfigurasi = bacaCache();
  if (!konfigurasi) return { boleh: true, modul: null as { nama: string } | null };
  const modul = modulUntukPath(path, konfigurasi.katalog);
  if (modul && !konfigurasi.modulAktif.includes(modul.kode)) return { boleh: false, modul };
  const fitur = fiturUntukPath(path, konfigurasi.katalogFitur ?? []);
  if (fitur && !(konfigurasi.fiturAktif ?? []).includes(fitur.kode)) return { boleh: false, modul: fitur };
  return { boleh: true, modul: null };
};

// Cek modul sinkron (tanpa konfigurasi = aktif).
export const modulAktif = (kode: string) => {
  const k = bacaCache();
  return !k || k.modulAktif.includes(kode);
};

// Modul yang termasuk segmen/tambahan faskes ini tetapi masih "Segera" (belum tersedia):
// ditampilkan di menu dengan badge Soon dan membuka halaman pratinjau /segera/:kode.
export const modulSegera = (): ModulKatalog[] => {
  const k = bacaCache();
  if (!k) return [];
  return k.katalog.filter((m) => !m.tersedia && ["segmen", "tambahan", "semua"].includes(m.sumber));
};

// Cek fitur sinkron untuk komponen di luar Pinia (tanpa konfigurasi = aktif).
export const fiturAktif = (kode: string) => {
  const k = bacaCache();
  return !k || !k.fiturAktif || k.fiturAktif.includes(kode);
};

// Bagian RME (form Asesmen/Resume) ditampilkan? Dicocokkan dari label form.
// - Label yang tidak ada di katalog tetap tampil.
// - Bagian khusus poli (gigi/mata) hanya tampil bila jenis poli pasien cocok.
export const bagianTampil = (fitur: string, label: string, lokasiUuid?: string | null) => {
  const k = bacaCache();
  if (!k?.katalogBagian) return true;
  const bagian = k.katalogBagian.find((b) => b.fitur === fitur && b.label === label);
  if (!bagian) return true;
  if (!(k.bagianAktif ?? []).includes(bagian.kode)) return false;
  if (bagian.poli?.length) {
    const jenis = k.poli?.find((p) => p.uuid === lokasiUuid)?.jenisPoli;
    return !!jenis && bagian.poli.includes(jenis);
  }
  return true;
};

export const useModulFaskesStore = defineStore("modulFaskes", {
  state: () => ({ konfigurasi: bacaCache() as KonfigurasiModul | null }),
  getters: {
    aktif: (state) => (kode: string) => !state.konfigurasi || state.konfigurasi.modulAktif.includes(kode),
    fitur: (state) => (kode: string) => !state.konfigurasi?.fiturAktif || state.konfigurasi.fiturAktif.includes(kode),
    // Menu atas tampil bila tidak dikendalikan modul mana pun, atau modulnya aktif.
    menuAktif: (state) => (judul: string) => {
      const k = state.konfigurasi;
      if (!k) return true;
      const pemilik = k.katalog.filter((m) => m.menu?.includes(judul));
      return pemilik.length === 0 || pemilik.some((m) => k.modulAktif.includes(m.kode));
    },
  },
  actions: {
    simpanCache(k: KonfigurasiModul | null) {
      this.konfigurasi = k;
      try {
        if (k) localStorage.setItem(KUNCI, JSON.stringify(k));
        else localStorage.removeItem(KUNCI);
      } catch {
        /* cache tidak wajib */
      }
    },
    async muat() {
      const res: any = await apiSettingGet("modul", {});
      if (res?.payload) this.simpanCache(res.payload);
      return this.konfigurasi;
    },
    async simpan(data: {
      segmen: string;
      modulTambahan: string[];
      modulNonaktif: string[];
      fiturTambahan: string[];
      fiturNonaktif: string[];
      alasan?: string;
    }) {
      const res: any = await apiSettingPut("modul", {
        segmen: data.segmen,
        modul_tambahan: data.modulTambahan,
        modul_nonaktif: data.modulNonaktif,
        fitur_tambahan: data.fiturTambahan,
        fitur_nonaktif: data.fiturNonaktif,
        alasan: data.alasan ?? "",
      });
      const payload = res?.data?.payload;
      if (payload) {
        this.simpanCache(payload);
        await this.sinkronIzin(payload);
      }
      return payload;
    },
    // Modul yang aktif → izinnya ditambahkan ke peran admin faskes (auth-service), lalu izin sesi ini diperbarui
    // agar menu langsung tampil tanpa login ulang. Peran lain tetap diatur di Datamaster › Role.
    async sinkronIzin(k: KonfigurasiModul) {
      const modul = [...new Set(k.katalog.filter((m) => k.modulAktif.includes(m.kode)).flatMap((m) => m.menu ?? []))];
      if (!modul.length) return;
      await apiAuthPost("/permission/sinkron-modul", { modul });
      await this.muatUlangIzin();
    },
    // Izin sesi dibaca ulang dari server (localStorage + cache token di Redis) lalu menu disusun ulang, tanpa login ulang.
    async muatUlangIzin() {
      const res: any = await apiAuthPost("/permission/muat-ulang", {});
      const izin = res?.payload?.permissions;
      if (Array.isArray(izin) && izin.length) {
        try {
          localStorage.setItem("permission", JSON.stringify(izin));
        } catch {
          /* abaikan */
        }
        window.dispatchEvent(new CustomEvent("izin-berubah"));
      }
    },
    // Setelah modul/fitur berubah di luar halaman ini (mis. rilis SIMRS Studio): muat konfigurasi modul & izin terbaru.
    async segarkanSesi() {
      await this.muat();
      await this.muatUlangIzin();
    },
    async simpanJenisPoli(lokasiUuid: string, jenisPoli: string) {
      const res: any = await apiSettingPut("modul/jenis-poli", { lokasi_uuid: lokasiUuid, jenis_poli: jenisPoli });
      const payload = res?.data?.payload;
      if (payload) this.simpanCache(payload);
      return payload;
    },
    async riwayat() {
      const res: any = await apiSettingGet("modul/riwayat", {});
      return res?.payload ?? [];
    },
    bersihkan() {
      this.simpanCache(null);
    },
  },
});
