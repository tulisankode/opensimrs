<script setup lang="ts">
// Panel panggilan antrian poli (ikon megafon di header, di luar halaman Admisi).
// - Disaring ke "antrian saya" (dokter) / poli tugas (perawat) / semua poli; pilihan diingat per komputer.
// - Penghitung per tab, pencarian, "Panggil Berikutnya", dan pasien yang sedang dipanggil dipaku di atas.
import { computed, ref, watch } from "vue";
import CardPanggilanPelayanan from "@/components/Base/CardPanggilanPelayanan.vue";
import AnnouncementIcon from "@/components/icons/AnnouncementIcon.vue";
import { useRJStore } from "@/stores/rawatJalan/laporanrajal";

const props = defineProps<{ terbuka: boolean }>();

const rjStore = useRJStore();
const KUNCI_FILTER = "opensimrs.panggilanPoli.filter";

const konteks = ref<any>(null);
const filter = ref<string>("semua");
const tab = ref<"aktif" | "terlewat" | "selesai">("aktif");
const cari = ref("");
const memuat = ref(false);

const bacaFilterTersimpan = () => {
  try {
    return localStorage.getItem(KUNCI_FILTER);
  } catch {
    return null;
  }
};
const simpanFilter = (nilai: string) => {
  try {
    localStorage.setItem(KUNCI_FILTER, nilai);
  } catch {
    /* tidak wajib */
  }
};

const semua = computed<any[]>(() => rjStore.antrianList ?? []);

// Pilihan filter: antrian saya (dokter), poli tugas, poli lain yang ada antriannya hari ini, semua.
const opsiFilter = computed(() => {
  const opsi: Array<{ nilai: string; label: string }> = [];
  if (konteks.value?.isDoctor && konteks.value?.practitionerUuid) opsi.push({ nilai: "saya", label: "Antrian saya" });
  const poli = new Map<string, string>();
  for (const p of konteks.value?.poli ?? []) if (p.lokasiUuid) poli.set(p.lokasiUuid, p.name ?? "Poli");
  for (const a of semua.value) {
    const jd = a.patientData?.jadwalDokter;
    if (jd?.lokasiUuid && !poli.has(jd.lokasiUuid)) poli.set(jd.lokasiUuid, jd.namaPoli ?? "Poli");
  }
  for (const [uuid, nama] of poli) opsi.push({ nilai: `poli:${uuid}`, label: nama });
  opsi.push({ nilai: "semua", label: "Semua poli" });
  return opsi;
});

const tentukanFilterAwal = () => {
  const tersimpan = bacaFilterTersimpan();
  const tersedia = new Set(opsiFilter.value.map((o) => o.nilai));
  if (tersimpan && tersedia.has(tersimpan)) return tersimpan;
  if (konteks.value?.isDoctor && konteks.value?.practitionerUuid) return "saya";
  const poliTugas = konteks.value?.poli?.[0]?.lokasiUuid;
  if (poliTugas) return `poli:${poliTugas}`;
  return "semua";
};

const sesuaiFilter = (a: any) => {
  const jd = a.patientData?.jadwalDokter ?? {};
  if (filter.value === "saya") return jd.practitionerUuid === konteks.value?.practitionerUuid;
  if (filter.value.startsWith("poli:")) return jd.lokasiUuid === filter.value.slice(5);
  return true;
};

const sesuaiCari = (a: any) => {
  const q = cari.value.trim().toLowerCase();
  if (!q) return true;
  const p = a.patientData ?? {};
  return [p.name, p.noRm, p.antrian?.noAntrianPoli].some((v) => String(v ?? "").toLowerCase().includes(q));
};

const disaring = computed(() => semua.value.filter(sesuaiFilter));
const STATUS_TAB = { aktif: [0, 1, 3], terlewat: [2], selesai: [4] } as const;
const jumlah = computed(() => ({
  aktif: disaring.value.filter((a) => (STATUS_TAB.aktif as readonly number[]).includes(a.statusPanggilan)).length,
  terlewat: disaring.value.filter((a) => a.statusPanggilan === 2).length,
  selesai: disaring.value.filter((a) => a.statusPanggilan === 4).length,
}));

// Urutan tab aktif: sedang diproses, sedang dipanggil, lalu menunggu sesuai nomor antrian.
const BOBOT: Record<number, number> = { 3: 0, 1: 1, 0: 2 };
const nomor = (a: any) => String(a.patientData?.antrian?.noAntrianPoli ?? "");
const daftar = computed(() =>
  disaring.value
    .filter((a) => (STATUS_TAB[tab.value] as readonly number[]).includes(a.statusPanggilan))
    .filter(sesuaiCari)
    .sort((a, b) => (BOBOT[a.statusPanggilan] ?? 9) - (BOBOT[b.statusPanggilan] ?? 9) || nomor(a).localeCompare(nomor(b)))
);

const sedangDipanggil = computed(() => disaring.value.filter((a) => a.statusPanggilan === 1).sort((a, b) => nomor(a).localeCompare(nomor(b))));
const berikutnya = computed(() => disaring.value.filter((a) => a.statusPanggilan === 0).sort((a, b) => nomor(a).localeCompare(nomor(b)))[0]);

const ubahStatus = async (uuid: string, status: number) => {
  memuat.value = true;
  try {
    await rjStore.updateAntrianCall(uuid, status);
  } finally {
    memuat.value = false;
  }
};
const panggilBerikutnya = () => berikutnya.value && ubahStatus(berikutnya.value.uuid, 1);

const muat = async () => {
  memuat.value = true;
  try {
    const [k] = await Promise.all([konteks.value ? Promise.resolve(konteks.value) : rjStore.getKonteksPetugas(), rjStore.getAllAntrianCall()]);
    if (!konteks.value) {
      konteks.value = k;
      filter.value = tentukanFilterAwal();
    }
  } finally {
    memuat.value = false;
  }
};

watch(() => props.terbuka, (buka) => buka && muat(), { immediate: true });
watch(filter, simpanFilter);

const pesanKosong = computed(() => {
  if (cari.value.trim()) return "Tidak ada antrian yang cocok dengan pencarian.";
  if (tab.value === "terlewat") return "Tidak ada antrian yang terlewat hari ini.";
  if (tab.value === "selesai") return "Belum ada antrian yang selesai hari ini. Antrian pindah ke sini setelah diproses lalu diselesaikan, atau setelah pasien pulang.";
  return "Tidak ada antrian yang menunggu hari ini.";
});
</script>

<template>
  <div class="flex flex-col flex-grow min-h-0">
    <div class="flex flex-col gap-2 px-4 pt-3">
      <div class="flex gap-2">
        <select v-model="filter" class="flex-1 rounded-md border border-opensimrs-300 px-2 py-2 text-sm text-opensimrs-300 font-semibold bg-white" title="Tampilkan antrian">
          <option v-for="o in opsiFilter" :key="o.nilai" :value="o.nilai">{{ o.label }}</option>
        </select>
        <input v-model="cari" type="search" placeholder="Cari nama / No. RM / nomor" class="flex-1 rounded-md border px-2 py-2 text-sm" />
      </div>
      <div class="flex gap-1 text-xs font-semibold">
        <button v-for="t in (['aktif', 'terlewat', 'selesai'] as const)" :key="t" type="button"
          class="rounded-t-lg px-3 py-2"
          :class="tab === t ? 'bg-opensimrs-50 text-opensimrs-300 border-b-2 border-opensimrs-300' : 'text-gray-500'"
          @click="tab = t">
          {{ t === 'aktif' ? 'Antrian Aktif' : t === 'terlewat' ? 'Terlewat' : 'Selesai' }} ({{ jumlah[t] }})
        </button>
      </div>
    </div>

    <div v-if="tab === 'aktif'" class="px-4 pt-3 flex flex-col gap-2">
      <div v-for="a in sedangDipanggil" :key="'dp-' + a.uuid" class="flex items-center gap-2 rounded-lg bg-[#FEF0C7] px-3 py-2 text-xs">
        <span class="flex-1"><b>{{ nomor(a) }}</b> {{ a.patientData?.name }} sedang dipanggil — belum datang?</span>
        <button type="button" class="rounded-md bg-[#3D84E5] px-2 py-1 text-white font-semibold" :disabled="memuat" @click="ubahStatus(a.uuid, 1)">Panggil Ulang</button>
        <button type="button" class="rounded-md bg-[#E89F29] px-2 py-1 text-white font-semibold" :disabled="memuat" @click="ubahStatus(a.uuid, 2)">Lewati</button>
      </div>
      <button type="button"
        class="flex items-center justify-center gap-2 rounded-lg bg-[#3D84E5] py-3 text-white font-semibold disabled:opacity-50"
        :disabled="!berikutnya || memuat" @click="panggilBerikutnya">
        <AnnouncementIcon :size="20" class="text-white" />
        <span v-if="berikutnya">Panggil Berikutnya: {{ nomor(berikutnya) }} — {{ berikutnya.patientData?.name }}</span>
        <span v-else>Tidak ada antrian menunggu</span>
      </button>
    </div>

    <div class="flex flex-col gap-y-3 p-4 flex-grow overflow-y-auto">
      <CardPanggilanPelayanan
        v-for="panggilan in daftar"
        :key="panggilan.uuid"
        :panggilan="panggilan"
        @panggil="(uuid: string) => ubahStatus(uuid, 1)"
        @lewati="(uuid: string) => ubahStatus(uuid, 2)"
        @proses="(uuid: string) => ubahStatus(uuid, 3)"
        @selesai="(uuid: string) => ubahStatus(uuid, 4)"
      />
      <p v-if="daftar.length === 0" class="py-6 text-center text-sm text-gray-500">{{ pesanKosong }}</p>
    </div>
  </div>
</template>
