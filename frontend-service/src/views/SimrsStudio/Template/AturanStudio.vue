<script setup lang="ts">
// Aturan prompt berlapis (rancangan §9): platform (tetap) → repo (CLAUDE.md) → instalasi → area → template tahap,
// plus basis pengetahuan instalasi yang ikut ke setiap prompt. Superadmin mengubah; peran lain membaca.
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiStudioGet, apiStudioPost, apiStudioPut, apiEkstensi } from "@/utils/apiHandler";
import { useSimrsStudioStore } from "@/stores/simrsStudio";
import { TAHAP } from "../umum";

const studio = useSimrsStudioStore();
const superadmin = computed(() => studio.status.superadmin);
const aturan = ref<any[]>([]);
const pengetahuan = ref<any[]>([]);
const aturanPlatform = ref("");

const muat = async () => {
  const [a, p, s] = await Promise.all([apiStudioGet("/aturan"), apiStudioGet("/pengetahuan"), apiStudioGet("/pengaturan")]);
  aturan.value = a?.payload ?? [];
  pengetahuan.value = p?.payload ?? [];
  aturanPlatform.value = s?.payload?.aturanPlatform ?? "";
};
onMounted(muat);

const dialog = ref<null | "aturan" | "pengetahuan">(null);
const form = ref<any>({});
const buka = (jenis: "aturan" | "pengetahuan", data?: any) => {
  form.value = data ? { ...data } : jenis === "aturan" ? { lapis: "area", kunci: "", judul: "", isi: "", aktif: true } : { judul: "", isi: "", aktif: true };
  dialog.value = jenis;
};
const simpan = async () => {
  const jenis = dialog.value!;
  const res = form.value.uuid ? await apiStudioPut(`/${jenis}/${form.value.uuid}`, form.value) : await apiStudioPost(`/${jenis}`, form.value);
  if (res) {
    dialog.value = null;
    muat();
  }
};
const hapus = async (jenis: string, uuid: string) => {
  if (await apiEkstensi("studio", "delete", `/${jenis}/${uuid}`)) muat();
};

const ZONA = [
  { zona: "Merah", warna: "bg-danger-300", pola: ".env*, studio-service/**, packages/authorization-sdk & permission-sdk, **/rahasia.js, .github/**, deploy/**, CLAUDE.md, migrasi lama", aturan: "Agen dilarang mengubah (diblokir di alat agen & pemeriksa kebijakan); desain yang menyentuh → risiko kritis" },
  { zona: "Kuning", warna: "bg-warning-300", pola: "rekamedis, farmasi, stok-farmasi, payment, bpjs, satusehat, lab, auth", aturan: "Risiko otomatis naik ke tinggi; perlu reviewer klinis" },
  { zona: "Hijau", warna: "bg-success-300", pola: "laporan, tampilan, dokumen, uji, layanan lain", aturan: "Sesuai aturan umum" },
];
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full" class="h-full">
    <template #header>
      <PageToolbar>
        <h1 class="toolbar-heading text-opensimrs-300">Aturan & Pengetahuan</h1>
        <div v-if="superadmin" class="flex gap-2">
          <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Tambah aturan" icon="PhPlus" outlined @click="buka('aturan')" />
          <CustomButton label="Tambah pengetahuan" icon="PhPlus" @click="buka('pengetahuan')" />
        </div>
      </PageToolbar>
    </template>
    <template #content>
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div class="rounded-lg border border-grey-200 p-3">
          <div class="mb-1 flex items-center gap-2 text-SM font-semibold text-grey-500"><PhLockSimple :size="16" class="text-grey-300" aria-hidden="true" /> 1. Aturan platform (tetap)</div>
          <pre class="max-h-72 overflow-auto whitespace-pre-wrap font-sans text-XS text-grey-400">{{ aturanPlatform }}</pre>
          <div class="mt-2 text-XS text-grey-400">2. Aturan repo: <code>CLAUDE.md</code> & <code>CONTRIBUTING.md</code> dibaca otomatis agen. 3. Aturan instalasi: Pengaturan & Agen.</div>
        </div>
        <div class="rounded-lg border border-grey-200 p-3">
          <div class="mb-2 text-SM font-semibold text-grey-500">4–5. Aturan area & tambahan template tahap</div>
          <div v-for="a in aturan" :key="a.uuid" class="mb-2 flex items-start gap-2 rounded bg-grey-50 p-2">
            <div class="min-w-0 grow text-XS text-grey-500">
              <div class="font-semibold">
                {{ a.judul }}
                <span class="rounded bg-white px-1 font-mono text-[10px] text-grey-400">{{ a.lapis === "area" ? `area: ${a.kunci}` : `tahap: ${a.kunci}` }}</span>
                <span class="text-[10px] font-normal text-grey-300">v{{ a.versi }}{{ a.aktif ? "" : " · nonaktif" }}</span>
              </div>
              <div class="whitespace-pre-wrap text-grey-400">{{ a.isi }}</div>
            </div>
            <template v-if="superadmin">
              <button type="button" aria-label="Ubah aturan" @click="buka('aturan', a)"><PhPencilSimple :size="14" class="text-opensimrs-300" aria-hidden="true" /></button>
              <button type="button" aria-label="Hapus aturan" @click="hapus('aturan', a.uuid)"><PhTrash :size="14" class="text-danger-300" aria-hidden="true" /></button>
            </template>
          </div>
          <div v-if="!aturan.length" class="text-XS text-grey-300">Belum ada. Contoh area: <code>farmasi-service/</code> — "perhitungan dosis = risiko kritis".</div>
        </div>
      </div>

      <div class="mt-4 rounded-lg border border-grey-200 p-3">
        <div class="mb-2 text-SM font-semibold text-grey-500">Basis pengetahuan instalasi</div>
        <div class="mb-2 text-XS text-grey-400">Catatan yang ikut ke setiap tugas agen: kebiasaan RS, istilah lokal, keputusan arsitektur. Dokumen repo (katalog modul, skema DB tanpa data) dibaca agen lewat alat MCP OpenSIMRS.</div>
        <div v-for="p in pengetahuan" :key="p.uuid" class="mb-2 flex items-start gap-2 rounded bg-grey-50 p-2">
          <div class="min-w-0 grow text-XS text-grey-500">
            <div class="font-semibold">{{ p.judul }}<span v-if="!p.aktif" class="text-grey-300"> · nonaktif</span></div>
            <div class="whitespace-pre-wrap text-grey-400">{{ p.isi }}</div>
          </div>
          <template v-if="superadmin">
            <button type="button" aria-label="Ubah pengetahuan" @click="buka('pengetahuan', p)"><PhPencilSimple :size="14" class="text-opensimrs-300" aria-hidden="true" /></button>
            <button type="button" aria-label="Hapus pengetahuan" @click="hapus('pengetahuan', p.uuid)"><PhTrash :size="14" class="text-danger-300" aria-hidden="true" /></button>
          </template>
        </div>
        <div v-if="!pengetahuan.length" class="text-XS text-grey-300">Belum ada catatan.</div>
      </div>

      <div class="mt-4 mb-2 font-semibold text-opensimrs-300">Zona berkas</div>
      <div class="overflow-auto rounded-lg border border-grey-200">
        <table class="w-full text-XS">
          <thead class="bg-grey-75 text-left text-grey-500"><tr><th class="p-2">Zona</th><th class="p-2">Pola</th><th class="p-2">Perlakuan</th></tr></thead>
          <tbody>
            <tr v-for="z in ZONA" :key="z.zona" class="border-t border-grey-100 text-grey-500">
              <td class="p-2"><span class="inline-flex items-center gap-1.5 font-semibold"><span class="h-2.5 w-2.5 rounded-full" :class="z.warna"></span>{{ z.zona }}</span></td>
              <td class="p-2 font-mono">{{ z.pola }}</td>
              <td class="p-2">{{ z.aturan }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </Card>

  <Dialog :visible="!!dialog" modal :header="dialog === 'aturan' ? 'Aturan prompt' : 'Basis pengetahuan'" :style="{ width: '40rem' }" @update:visible="dialog = null">
    <div class="flex flex-col gap-2 text-SM text-grey-500">
      <div v-if="dialog === 'aturan'" class="grid grid-cols-2 gap-2">
        <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Lapis</span>
          <select v-model="form.lapis" class="rounded border border-grey-200 px-2 py-1.5"><option value="area">Area (awalan path / nama modul)</option><option value="tahap">Tambahan template tahap</option></select></label>
        <label class="flex flex-col gap-1"><span class="text-XS font-semibold">{{ form.lapis === "area" ? "Kunci area" : "Tahap" }}</span>
          <select v-if="form.lapis === 'tahap'" v-model="form.kunci" class="rounded border border-grey-200 px-2 py-1.5"><option v-for="t in TAHAP" :key="t.kode" :value="t.kode">{{ t.nama }}</option><option value="ekstensi">Ekstensi</option></select>
          <input v-else v-model="form.kunci" class="rounded border border-grey-200 px-2 py-1.5 font-mono" placeholder="farmasi-service/ atau Farmasi" /></label>
      </div>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Judul</span><input v-model="form.judul" class="rounded border border-grey-200 px-2 py-1.5" /></label>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Isi</span><textarea v-model="form.isi" rows="8" class="rounded border border-grey-200 px-2 py-1.5 text-XS" /></label>
      <label class="flex items-center gap-2 text-XS"><input v-model="form.aktif" type="checkbox" /> Aktif</label>
    </div>
    <template #footer>
      <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Batal" outlined @click="dialog = null" />
      <CustomButton label="Simpan" :disabled="!form.judul || !form.isi" @click="simpan" />
    </template>
  </Dialog>
</template>
