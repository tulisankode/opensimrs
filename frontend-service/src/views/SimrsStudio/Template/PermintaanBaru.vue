<script setup lang="ts">
// Formulir permintaan terpandu (untuk IT yang belum mahir coding): pertanyaan sederhana, lalu AI merangkum.
import { ref } from "vue";
import { useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiStudioPost } from "@/utils/apiHandler";
import { daftarModulKatalog } from "@/stores/modulFaskes";

const router = useRouter();
const mengirim = ref(false);

const form = ref({ jenis: "fitur", prioritas: "P2", judul: "", masalah: "", siapa: "", harapan: "", contoh: "", modulTerdampak: [] as string[] });
// Modul katalog yang disentuh permintaan: ikut ke konteks agen (entri katalog, rute, fitur) di setiap tahap.
const OPSI_MODUL = daftarModulKatalog()
  .map((m) => ({ nama: m.nama, label: `${m.nama} (${m.kode})` }))
  .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
const JENIS = [
  { kode: "fitur", nama: "Fitur", ikon: "PhSparkle", ket: "Kemampuan baru pada modul yang ada" },
  { kode: "modul", nama: "Modul baru", ikon: "PhSquaresFour", ket: "Menu/modul baru di aplikasi" },
  { kode: "perbaikan", nama: "Perbaikan", ikon: "PhWrench", ket: "Ada yang salah atau kurang tepat" },
  { kode: "laporan", nama: "Laporan", ikon: "PhChartBar", ket: "Laporan atau rekap baru" },
];
const PERTANYAAN = [
  { kunci: "masalah", label: "Apa yang sulit atau bermasalah sekarang?", contoh: "Petugas lab harus menggulir semua order untuk mencari order dari IGD…" },
  { kunci: "siapa", label: "Siapa yang terdampak dan seberapa sering?", contoh: "Analis lab, sekitar 40 order per jam saat jam sibuk" },
  { kunci: "harapan", label: "Seperti apa hasil yang Anda harapkan?", contoh: "Bisa memilih satu atau beberapa ruangan, daftar langsung tersaring" },
  { kunci: "contoh", label: "Contoh kasus (opsional, pakai data fiktif)", contoh: "Pasien contoh, NIK 9999…, jangan data pasien asli" },
] as const;

const kirim = async () => {
  mengirim.value = true;
  const res = await apiStudioPost("/item", form.value);
  mengirim.value = false;
  if (res?.payload?.uuid) router.push(`/studio/item/${res.payload.uuid}`);
};
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full" class="h-full">
    <template #header>
      <PageToolbar>
        <h1 class="toolbar-heading text-opensimrs-300">Permintaan Baru</h1>
      </PageToolbar>
    </template>
    <template #content>
      <div class="mx-auto flex max-w-3xl flex-col gap-4">
        <div>
          <div class="mb-2 text-SM font-semibold text-grey-500">Jenis permintaan</div>
          <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
            <button
              v-for="j in JENIS"
              :key="j.kode"
              type="button"
              class="flex flex-col items-start gap-1 rounded-lg border p-3 text-left"
              :class="form.jenis === j.kode ? 'border-opensimrs-300 bg-opensimrs-50' : 'border-grey-200'"
              @click="form.jenis = j.kode"
            >
              <component :is="j.ikon" :size="22" weight="duotone" class="text-opensimrs-300" aria-hidden="true" />
              <div class="text-SM font-semibold text-grey-500">{{ j.nama }}</div>
              <div class="text-[10px] text-grey-400">{{ j.ket }}</div>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px]">
          <div class="flex flex-col gap-1">
            <label class="text-SM font-semibold text-grey-500" for="p-judul">Judul singkat</label>
            <input id="p-judul" v-model="form.judul" maxlength="200" class="rounded-lg border border-grey-200 px-3 py-2 text-SM" placeholder="Filter ruangan di daftar order lab" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-SM font-semibold text-grey-500" for="p-prioritas">Prioritas</label>
            <select id="p-prioritas" v-model="form.prioritas" class="rounded-lg border border-grey-200 px-3 py-2 text-SM">
              <option value="P1">P1 — mendesak</option>
              <option value="P2">P2 — normal</option>
              <option value="P3">P3 — bisa menunggu</option>
            </select>
          </div>
        </div>

        <div v-if="OPSI_MODUL.length" class="flex flex-col gap-1">
          <label class="text-SM font-semibold text-grey-500" for="p-modul">Modul terkait (opsional)</label>
          <MultiSelect
            v-model="form.modulTerdampak"
            input-id="p-modul"
            :options="OPSI_MODUL"
            option-label="label"
            option-value="nama"
            filter
            display="chip"
            :max-selected-labels="4"
            placeholder="Pilih modul yang disentuh permintaan ini"
            class="w-full"
          />
          <div class="text-[10px] text-grey-400">Agen membaca entri katalog modul ini (rute, menu, fitur) agar perubahan tepat sasaran.</div>
        </div>

        <div v-for="(p, idx) in PERTANYAAN" :key="p.kunci" class="flex flex-col gap-1">
          <label class="text-SM font-semibold text-grey-500" :for="`p-${p.kunci}`">{{ idx + 1 }}. {{ p.label }}</label>
          <textarea :id="`p-${p.kunci}`" v-model="form[p.kunci]" rows="3" class="rounded-lg border border-grey-200 px-3 py-2 text-SM" :placeholder="p.contoh" />
        </div>

        <div class="flex items-start gap-2 rounded-lg bg-info-50 p-3 text-XS text-info-400">
          <PhSparkle :size="18" class="shrink-0" aria-hidden="true" />
          Setelah dikirim, AI membaca kode & dokumen aplikasi, merangkum permintaan, mengajukan pertanyaan klarifikasi
          bila perlu, dan mengecek apakah fitur serupa sudah ada. Jangan menuliskan data pasien asli.
        </div>

        <div class="flex justify-end gap-2">
          <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Batal" outlined @click="router.push('/studio/beranda')" />
          <CustomButton label="Kirim permintaan" icon="PhPaperPlaneRight" :disabled="mengirim || !form.judul.trim() || (!form.masalah.trim() && !form.harapan.trim())" @click="kirim" />
        </div>
      </div>
    </template>
  </Card>
</template>
