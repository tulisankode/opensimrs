<script setup lang="ts">
// Setting › Manajemen Modul & Fitur: segmen faskes menentukan modul & fitur bawaan; superadmin dapat
// menambah atau menonaktifkan modul/fitur di luar preset. Selain superadmin hanya dapat melihat.
import { computed, onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import MainHeaderSetting from "../MainHeaderSetting.vue";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { useModulFaskesStore, type BagianKatalog, type FiturKatalog, type ModulKatalog } from "@/stores/modulFaskes";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";

const store = useModulFaskesStore();
const storeUtils = utilsStore();
const toast = useToast();

const konfigurasi = computed(() => store.konfigurasi);
const bolehUbah = computed(() => !!konfigurasi.value?.bolehUbah);
const segmenList = computed(() => [...(konfigurasi.value?.segmenList ?? [])].sort((a, b) => a.urutan - b.urutan));

// Draf perubahan (baru tersimpan setelah klik Simpan).
const segmen = ref<string>("");
const tambahan = ref<string[]>([]);
const nonaktif = ref<string[]>([]);
const fiturTambahan = ref<string[]>([]);
const fiturNonaktif = ref<string[]>([]);
const alasan = ref("");
const riwayat = ref<any[]>([]);

const isiDraf = () => {
  const k = konfigurasi.value;
  segmen.value = k?.segmen ?? "";
  tambahan.value = k?.katalog.filter((m) => m.sumber === "tambahan").map((m) => m.kode) ?? [];
  nonaktif.value = k?.katalog.filter((m) => m.sumber === "nonaktif").map((m) => m.kode) ?? [];
  fiturTambahan.value = [
    ...(k?.katalogFitur?.filter((f) => f.sumber === "tambahan").map((f) => f.kode) ?? []),
    ...(k?.katalogBagian?.filter((b) => b.sumber === "tambahan").map((b) => b.kode) ?? []),
  ];
  fiturNonaktif.value = [
    ...(k?.katalogFitur?.filter((f) => f.sumber === "nonaktif").map((f) => f.kode) ?? []),
    ...(k?.katalogBagian?.filter((b) => b.sumber === "nonaktif").map((b) => b.kode) ?? []),
  ];
  alasan.value = "";
};

const bawaanSegmen = computed(() => new Set(segmenList.value.find((s) => s.kode === segmen.value)?.modul ?? []));

const statusDraf = (m: ModulKatalog) => {
  if (m.inti) return { aktif: true, label: "Inti", kelas: "bg-opensimrs-50 text-opensimrs-300" };
  if (!m.tersedia) return { aktif: false, label: "Segera", kelas: "bg-grey-100 text-grey-400" };
  if (!segmen.value) return { aktif: true, label: "Aktif (segmen belum diatur)", kelas: "bg-grey-100 text-grey-400" };
  if (bawaanSegmen.value.has(m.kode)) {
    return nonaktif.value.includes(m.kode)
      ? { aktif: false, label: "Bawaan segmen — dinonaktifkan", kelas: "bg-[#FDE2E1] text-[#B42318]" }
      : { aktif: true, label: "Bawaan segmen", kelas: "bg-[#D1FADF] text-[#027A48]" };
  }
  return tambahan.value.includes(m.kode)
    ? { aktif: true, label: "Tambahan superadmin", kelas: "bg-[#FEF0C7] text-[#B54708]" }
    : { aktif: false, label: "Tidak termasuk segmen", kelas: "bg-grey-100 text-grey-400" };
};

// ── Fitur ────────────────────────────────────────────────────────────────
const modulAktifDraf = (kode: string) => {
  const m = konfigurasi.value?.katalog.find((x) => x.kode === kode);
  return !!m && statusDraf(m).aktif;
};
const fiturMatiSegmen = computed(() => new Set(segmenList.value.find((s) => s.kode === segmen.value)?.fiturMati ?? []));
// Fitur layak bila modul induk dan modul syaratnya (mis. BPJS FKRTL untuk Obat Kronis) aktif.
const fiturLayak = (f: FiturKatalog) => modulAktifDraf(f.modul) && (!f.modulSyarat || modulAktifDraf(f.modulSyarat));
const namaModul = (kode: string) => konfigurasi.value?.katalog.find((x) => x.kode === kode)?.nama ?? kode;
const presetFitur = (f: FiturKatalog) => fiturLayak(f) && !fiturMatiSegmen.value.has(f.kode);
const fiturModul = (kode: string) => (konfigurasi.value?.katalogFitur ?? []).filter((f) => f.modul === kode);

const statusFitur = (f: FiturKatalog) => {
  if (!f.tersedia) return { aktif: false, label: "Segera", kelas: "bg-grey-100 text-grey-400" };
  if (!modulAktifDraf(f.modul)) return { aktif: false, label: "Modul nonaktif", kelas: "bg-grey-100 text-grey-400" };
  if (f.modulSyarat && !modulAktifDraf(f.modulSyarat)) return { aktif: false, label: `Butuh ${namaModul(f.modulSyarat)}`, kelas: "bg-grey-100 text-grey-400" };
  if (f.wajib) return { aktif: true, label: "Wajib", kelas: "bg-opensimrs-50 text-opensimrs-300" };
  if (!segmen.value) return { aktif: true, label: "Aktif", kelas: "bg-grey-100 text-grey-400" };
  if (presetFitur(f)) {
    return fiturNonaktif.value.includes(f.kode)
      ? { aktif: false, label: "Preset — dinonaktifkan", kelas: "bg-[#FDE2E1] text-[#B42318]" }
      : { aktif: true, label: "Preset segmen", kelas: "bg-[#D1FADF] text-[#027A48]" };
  }
  return fiturTambahan.value.includes(f.kode)
    ? { aktif: true, label: "Tambahan superadmin", kelas: "bg-[#FEF0C7] text-[#B54708]" }
    : { aktif: false, label: "Tidak termasuk preset", kelas: "bg-grey-100 text-grey-400" };
};

const bisaUbahFitur = (f: FiturKatalog) => bolehUbah.value && !!segmen.value && f.tersedia && !f.wajib && fiturLayak(f);

const ubahFitur = (f: FiturKatalog) => {
  if (!bisaUbahFitur(f)) return;
  const k = f.kode;
  if (presetFitur(f)) {
    fiturNonaktif.value = fiturNonaktif.value.includes(k) ? fiturNonaktif.value.filter((x) => x !== k) : [...fiturNonaktif.value, k];
  } else {
    fiturTambahan.value = fiturTambahan.value.includes(k) ? fiturTambahan.value.filter((x) => x !== k) : [...fiturTambahan.value, k];
  }
};

// ── Bagian (tingkat terkecil) ───────────────────────────────────────────
const terbuka = ref<Set<string>>(new Set());
const bukaTutup = (kode: string) => {
  const s2 = new Set(terbuka.value);
  s2.has(kode) ? s2.delete(kode) : s2.add(kode);
  terbuka.value = s2;
};
const bagianFitur = (kode: string) => (konfigurasi.value?.katalogBagian ?? []).filter((b) => b.fitur === kode);
const bagianMatiSegmen = computed(() => new Set(segmenList.value.find((s) => s.kode === segmen.value)?.bagianMati ?? []));
const fiturAktifDraf = (kode: string) => {
  const ft = konfigurasi.value?.katalogFitur?.find((x) => x.kode === kode);
  return !!ft && statusFitur(ft).aktif;
};
const bagianLayak = (b: BagianKatalog) => fiturAktifDraf(b.fitur) && (!b.modul || modulAktifDraf(b.modul));
const presetBagian = (b: BagianKatalog) => bagianLayak(b) && (b.wajib || !bagianMatiSegmen.value.has(b.kode));
const namaJenisPoli = (kode: string) => konfigurasi.value?.jenisPoli?.find((j) => j.kode === kode)?.nama ?? kode;

const statusBagian = (b: BagianKatalog) => {
  if (!bagianLayak(b)) return { aktif: false, label: b.modul && !modulAktifDraf(b.modul) ? "Modul nonaktif" : "Fitur nonaktif", kelas: "bg-grey-100 text-grey-400" };
  if (b.wajib) return { aktif: true, label: "Wajib", kelas: "bg-opensimrs-50 text-opensimrs-300" };
  if (!segmen.value) return { aktif: true, label: "Aktif", kelas: "bg-grey-100 text-grey-400" };
  if (presetBagian(b)) {
    return fiturNonaktif.value.includes(b.kode)
      ? { aktif: false, label: "Preset — dinonaktifkan", kelas: "bg-[#FDE2E1] text-[#B42318]" }
      : { aktif: true, label: "Preset segmen", kelas: "bg-[#D1FADF] text-[#027A48]" };
  }
  return fiturTambahan.value.includes(b.kode)
    ? { aktif: true, label: "Tambahan superadmin", kelas: "bg-[#FEF0C7] text-[#B54708]" }
    : { aktif: false, label: "Tidak termasuk preset", kelas: "bg-grey-100 text-grey-400" };
};
const bisaUbahBagian = (b: BagianKatalog) => bolehUbah.value && !!segmen.value && !b.wajib && bagianLayak(b);
const ubahBagian = (b: BagianKatalog) => {
  if (!bisaUbahBagian(b)) return;
  const k = b.kode;
  if (presetBagian(b)) {
    fiturNonaktif.value = fiturNonaktif.value.includes(k) ? fiturNonaktif.value.filter((x) => x !== k) : [...fiturNonaktif.value, k];
  } else {
    fiturTambahan.value = fiturTambahan.value.includes(k) ? fiturTambahan.value.filter((x) => x !== k) : [...fiturTambahan.value, k];
  }
};
const ringkasBagian = (kode: string) => {
  const daftar = bagianFitur(kode);
  return `${daftar.filter((b) => statusBagian(b).aktif).length}/${daftar.length} bagian aktif`;
};

// ── Jenis poli ────────────────────────────────────────────────────────────
const ubahJenisPoli = async (lokasiUuid: string, jenis: string) => {
  storeUtils.setLoading(true);
  try {
    const hasil = await store.simpanJenisPoli(lokasiUuid, jenis);
    if (hasil) toast.add({ severity: "success", summary: "Jenis poli disimpan", life: 2500 });
  } finally {
    storeUtils.setLoading(false);
  }
};

// Ruang perawatan intensif (ICU, NICU, PICU, CCU, HDU, …) satu bagian tersendiri, bukan tersebar di kelompoknya.
const KELOMPOK_INTENSIF = "Ruang Perawatan Intensif";
const kelompokModul = (m: ModulKatalog) => (m.instalasi === "Instalasi Perawatan Intensif" ? KELOMPOK_INTENSIF : m.kelompok);
const kelompok = computed(() => {
  const peta = new Map<string, ModulKatalog[]>();
  for (const m of konfigurasi.value?.katalog ?? []) {
    const k = kelompokModul(m);
    if (!peta.has(k)) peta.set(k, []);
    peta.get(k)!.push(m);
  }
  return [...peta.entries()];
});

const bisaDiubah = (m: ModulKatalog) => bolehUbah.value && !!segmen.value && !m.inti && m.tersedia;

const ubahModul = (m: ModulKatalog) => {
  if (!bisaDiubah(m)) return;
  const k = m.kode;
  if (bawaanSegmen.value.has(k)) {
    nonaktif.value = nonaktif.value.includes(k) ? nonaktif.value.filter((x) => x !== k) : [...nonaktif.value, k];
  } else {
    tambahan.value = tambahan.value.includes(k) ? tambahan.value.filter((x) => x !== k) : [...tambahan.value, k];
  }
};

const pilihSegmen = (kode: string) => {
  if (!bolehUbah.value) return;
  segmen.value = kode;
  const bawaan = new Set(segmenList.value.find((s) => s.kode === kode)?.modul ?? []);
  // Tambahan yang ternyata sudah bawaan segmen baru tidak perlu dicatat; nonaktif hanya untuk modul bawaan.
  tambahan.value = tambahan.value.filter((k) => !bawaan.has(k));
  nonaktif.value = nonaktif.value.filter((k) => bawaan.has(k));
  // Override fitur dibersihkan agar mengikuti preset segmen baru.
  fiturTambahan.value = [];
  fiturNonaktif.value = [];
};

const berubah = computed(() => {
  const k = konfigurasi.value;
  if (!k) return false;
  const awalTambahan = k.katalog.filter((m) => m.sumber === "tambahan").map((m) => m.kode).sort().join();
  const awalNonaktif = k.katalog.filter((m) => m.sumber === "nonaktif").map((m) => m.kode).sort().join();
  const semuaItem = [...(k.katalogFitur ?? []), ...(k.katalogBagian ?? [])];
  const awalFiturTambahan = semuaItem.filter((f) => f.sumber === "tambahan").map((f) => f.kode).sort().join();
  const awalFiturNonaktif = semuaItem.filter((f) => f.sumber === "nonaktif").map((f) => f.kode).sort().join();
  return segmen.value !== (k.segmen ?? "")
    || [...tambahan.value].sort().join() !== awalTambahan || [...nonaktif.value].sort().join() !== awalNonaktif
    || [...fiturTambahan.value].sort().join() !== awalFiturTambahan || [...fiturNonaktif.value].sort().join() !== awalFiturNonaktif;
});

const jumlahAktifDraf = computed(() => (konfigurasi.value?.katalog ?? []).filter((m) => statusDraf(m).aktif && m.tersedia).length);

const namaSegmen = (kode?: string | null) => segmenList.value.find((s) => s.kode === kode)?.nama ?? "Belum diatur";

const muatRiwayat = async () => {
  riwayat.value = await store.riwayat();
};

const simpan = async () => {
  if (!segmen.value) {
    toast.add({ severity: "warn", summary: "Pilih segmen faskes terlebih dahulu", life: 4000 });
    return;
  }
  storeUtils.setLoading(true);
  try {
    const hasil = await store.simpan({
      segmen: segmen.value,
      modulTambahan: tambahan.value,
      modulNonaktif: nonaktif.value,
      fiturTambahan: fiturTambahan.value,
      fiturNonaktif: fiturNonaktif.value,
      alasan: alasan.value,
    });
    if (!hasil) return;
    toast.add({ severity: "success", summary: "Konfigurasi modul disimpan", detail: "Menu akan dimuat ulang.", life: 3000 });
    isiDraf();
    await muatRiwayat();
    setTimeout(() => window.location.reload(), 1200);
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(async () => {
  storeUtils.setLoading(true);
  try {
    await store.muat();
    isiDraf();
    await muatRiwayat();
  } finally {
    storeUtils.setLoading(false);
  }
});

const ringkasPerubahan = (r: any) => {
  const ses = r.sesudah ?? {};
  const seg = namaSegmen(ses.segmen);
  const tmb = (ses.modulTambahan ?? ses.modul_tambahan ?? []).length;
  const non = (ses.modulNonaktif ?? ses.modul_nonaktif ?? []).length;
  const ftmb = (ses.fiturTambahan ?? ses.fitur_tambahan ?? []).length;
  const fnon = (ses.fiturNonaktif ?? ses.fitur_nonaktif ?? []).length;
  const btmb = (ses.bagianTambahan ?? ses.bagian_tambahan ?? []).length;
  const bnon = (ses.bagianNonaktif ?? ses.bagian_nonaktif ?? []).length;
  return `${seg}${tmb ? ` · +${tmb} modul tambahan` : ""}${non ? ` · ${non} modul dinonaktifkan` : ""}${ftmb ? ` · +${ftmb} fitur` : ""}${fnon ? ` · ${fnon} fitur dinonaktifkan` : ""}${btmb ? ` · +${btmb} bagian` : ""}${bnon ? ` · ${bnon} bagian dinonaktifkan` : ""}`;
};
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto">
    <template #header>
      <MainHeaderSetting heading="Manajemen Modul & Fitur" />
    </template>
    <template #content>
      <div class="flex flex-col gap-4 pb-6">
        <div v-if="konfigurasi && !konfigurasi.diatur" class="rounded-lg bg-[#FEF0C7] px-4 py-3 text-sm text-[#B54708]">
          Segmen faskes belum diatur — semua modul yang tersedia aktif. Pilih segmen agar menu & alur disesuaikan.
        </div>
        <div v-if="!bolehUbah" class="rounded-lg bg-opensimrs-50 px-4 py-3 text-sm text-opensimrs-300">
          Anda dapat melihat konfigurasi modul. Perubahan segmen & modul hanya dapat dilakukan oleh <b>superadmin</b>.
        </div>

        <GreenCard cardHeading="Segmen Faskes" hrEnableCustomClass>
          <div class="grid grid-cols-1 gap-3 pl-2 md:grid-cols-2 xl:grid-cols-4">
            <button
              v-for="s in segmenList"
              :key="s.kode"
              type="button"
              class="rounded-lg border p-3 text-left transition"
              :class="[
                segmen === s.kode ? 'border-opensimrs-300 bg-opensimrs-50 ring-2 ring-opensimrs-300' : 'border-grey-200 bg-white',
                bolehUbah ? 'hover:border-opensimrs-300 cursor-pointer' : 'cursor-default',
              ]"
              @click="pilihSegmen(s.kode)"
            >
              <div class="flex items-center gap-2">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-opensimrs-300 text-xs font-semibold text-white">{{ s.urutan }}</span>
                <span class="font-semibold text-sm">{{ s.nama }}</span>
              </div>
              <p class="mt-2 text-xs text-grey-400">{{ s.ringkas }}</p>
              <p class="mt-1 text-[11px] font-semibold text-opensimrs-300">
                <template v-if="s.jumlah">{{ s.jumlah.modul }} modul · {{ s.jumlah.fitur }} fitur · {{ s.jumlah.bagian }} bagian</template>
                <template v-else>{{ s.modul.length }} modul bawaan</template>
              </p>
              <p v-if="s.jumlah?.modulRencana" class="text-[10px] text-grey-400">+{{ s.jumlah.modulRencana }} modul dalam pengembangan</p>
            </button>
          </div>
        </GreenCard>

        <GreenCard cardHeading="Modul & Fitur" hrEnableCustomClass>
          <div class="flex flex-col gap-5 pl-2">
            <p class="text-sm text-grey-400">
              Segmen: <b class="text-black">{{ namaSegmen(segmen) }}</b> · {{ jumlahAktifDraf }} modul aktif.
              <span v-if="bolehUbah && segmen">Klik sakelar untuk menambah modul di luar segmen atau menonaktifkan modul bawaan.</span>
            </p>
            <div v-for="[nama, daftar] in kelompok" :key="nama">
              <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-400">{{ nama }}</div>
              <div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
                <div v-for="m in daftar" :key="m.kode" class="flex items-start gap-3 rounded-lg border border-grey-200 bg-white p-3"
                  :class="{ 'opacity-60': !m.tersedia }">
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="statusDraf(m).aktif"
                    :disabled="!bisaDiubah(m)"
                    class="relative mt-1 h-5 w-9 shrink-0 rounded-full transition disabled:cursor-not-allowed"
                    :class="statusDraf(m).aktif ? 'bg-opensimrs-300' : 'bg-grey-200'"
                    :title="bisaDiubah(m) ? 'Ubah status modul' : m.inti ? 'Modul inti selalu aktif' : !m.tersedia ? 'Masih dalam pengembangan' : 'Hanya superadmin'"
                    @click="ubahModul(m)"
                  >
                    <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all" :class="statusDraf(m).aktif ? 'left-[18px]' : 'left-0.5'"></span>
                  </button>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-sm font-semibold">{{ m.nama }}</span>
                      <span class="rounded-full px-2 py-[1px] text-[10px] font-semibold" :class="statusDraf(m).kelas">{{ statusDraf(m).label }}</span>
                    </div>
                    <p class="mt-1 text-xs text-grey-400">{{ m.deskripsi }}</p>
                    <div v-if="fiturModul(m.kode).length" class="mt-3 flex flex-col gap-2 border-l-2 border-opensimrs-50 pl-3">
                      <div v-for="ft in fiturModul(m.kode)" :key="ft.kode" class="flex items-start gap-2" :class="{ 'opacity-60': !ft.tersedia }">
                        <button
                          type="button"
                          role="switch"
                          :aria-checked="statusFitur(ft).aktif"
                          :disabled="!bisaUbahFitur(ft)"
                          class="relative mt-[2px] h-4 w-7 shrink-0 rounded-full transition disabled:cursor-not-allowed"
                          :class="statusFitur(ft).aktif ? 'bg-opensimrs-300' : 'bg-grey-200'"
                          :title="bisaUbahFitur(ft) ? 'Ubah status fitur' : !ft.tersedia ? 'Masih dalam pengembangan' : !fiturLayak(ft) ? 'Aktifkan modulnya dulu' : ft.wajib ? 'Fitur wajib' : 'Hanya superadmin'"
                          @click="ubahFitur(ft)"
                        >
                          <span class="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all" :class="statusFitur(ft).aktif ? 'left-[14px]' : 'left-0.5'"></span>
                        </button>
                        <div class="min-w-0">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="text-xs font-semibold">{{ ft.nama }}</span>
                            <span class="rounded-full px-2 py-[1px] text-[10px] font-semibold" :class="statusFitur(ft).kelas">{{ statusFitur(ft).label }}</span>
                          </div>
                          <p class="text-[11px] text-grey-400">{{ ft.deskripsi }}</p>
                          <button v-if="bagianFitur(ft.kode).length" type="button" class="mt-1 text-[11px] font-semibold text-opensimrs-300 underline"
                            @click="bukaTutup(ft.kode)">
                            {{ terbuka.has(ft.kode) ? "Sembunyikan" : "Atur" }} bagian · {{ ringkasBagian(ft.kode) }}
                          </button>
                          <div v-if="terbuka.has(ft.kode)" class="mt-2 grid grid-cols-1 gap-1 border-l-2 border-grey-100 pl-3 xl:grid-cols-2">
                            <div v-for="bg in bagianFitur(ft.kode)" :key="bg.kode" class="flex items-center gap-2">
                              <button
                                type="button"
                                role="switch"
                                :aria-checked="statusBagian(bg).aktif"
                                :disabled="!bisaUbahBagian(bg)"
                                class="relative h-3.5 w-6 shrink-0 rounded-full transition disabled:cursor-not-allowed"
                                :class="statusBagian(bg).aktif ? 'bg-opensimrs-300' : 'bg-grey-200'"
                                :title="bg.wajib ? 'Bagian wajib (isi minimal rekam medis)' : bisaUbahBagian(bg) ? 'Ubah status bagian' : 'Hanya superadmin'"
                                @click="ubahBagian(bg)"
                              >
                                <span class="absolute top-[3px] h-2 w-2 rounded-full bg-white shadow transition-all" :class="statusBagian(bg).aktif ? 'left-[14px]' : 'left-[3px]'"></span>
                              </button>
                              <span class="text-[11px]">{{ bg.nama }}</span>
                              <span class="rounded-full px-1.5 text-[9px] font-semibold" :class="statusBagian(bg).kelas">{{ statusBagian(bg).label }}</span>
                              <span v-if="bg.poli.length" class="rounded-full bg-[#E0EAFF] px-1.5 text-[9px] font-semibold text-[#3538CD]">
                                poli {{ bg.poli.map(namaJenisPoli).join("/") }}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="bolehUbah" class="flex flex-col gap-2 border-t border-grey-200 pt-4">
              <label class="text-sm font-semibold">Alasan perubahan (opsional)</label>
              <textarea v-model="alasan" rows="2" class="rounded-md border border-grey-200 px-3 py-2 text-sm" placeholder="mis. Klinik membuka layanan rawat inap 5 bed"></textarea>
              <div class="flex justify-end gap-2">
                <CustomButton label="Batalkan Perubahan" outlined borderColor="border-grey-300" textColor="text-grey-400" :disabled="!berubah" @click="isiDraf" />
                <CustomButton label="Simpan Konfigurasi" :disabled="!berubah || !segmen" @click="simpan" />
              </div>
            </div>
          </div>
        </GreenCard>

        <GreenCard cardHeading="Jenis Poli" hrEnableCustomClass>
          <div class="flex flex-col gap-2 pl-2 text-sm">
            <p class="text-grey-400">
              Menentukan bagian RME khusus spesialisasi, mis. <b>Pemeriksaan Gigi</b> hanya tampil di poli berjenis Gigi &amp; Mulut
              dan <b>Pemeriksaan Mata</b> di poli Mata.
            </p>
            <div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
              <div v-for="p in konfigurasi?.poli ?? []" :key="p.uuid" class="flex items-center justify-between gap-3 rounded-lg border border-grey-200 bg-white px-3 py-2">
                <span class="font-semibold">{{ p.name }}</span>
                <select
                  :value="p.jenisPoli"
                  :disabled="!bolehUbah"
                  class="rounded-md border border-grey-200 px-2 py-1 text-sm disabled:bg-grey-50"
                  @change="ubahJenisPoli(p.uuid, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="j in konfigurasi?.jenisPoli ?? []" :key="j.kode" :value="j.kode">{{ j.nama }}</option>
                </select>
              </div>
            </div>
          </div>
        </GreenCard>

        <GreenCard cardHeading="Riwayat Perubahan" hrEnableCustomClass>
          <div class="pl-2 text-sm">
            <p v-if="!riwayat.length" class="text-grey-400">Belum ada perubahan.</p>
            <div v-for="(r, i) in riwayat" :key="i" class="flex flex-wrap gap-x-3 border-b border-grey-100 py-2">
              <span class="text-grey-400 w-[150px]">{{ epochToDate(Number(r.createdAt ?? r.created_at), "dateTime") }}</span>
              <span class="font-semibold w-[140px]">{{ r.oleh ?? "-" }}</span>
              <span class="flex-1">{{ ringkasPerubahan(r) }}<span v-if="r.alasan" class="text-grey-400"> — {{ r.alasan }}</span></span>
            </div>
          </div>
        </GreenCard>
      </div>
    </template>
  </Card>
</template>
