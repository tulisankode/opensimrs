<script setup lang="ts">
// Lampiran permintaan (gambar/PDF/teks, maks. 5 MB). Wajib dinyatakan sudah disamarkan; teks dipindai data pribadi di server.
import { ref } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiStudioPost, apiEkstensi } from "@/utils/apiHandler";

const props = defineProps<{ itemUuid: string; lampiran: any[]; bolehUbah: boolean }>();
const emit = defineEmits<{ (e: "berubah"): void }>();
const disamarkan = ref(false);
const mengunggah = ref(false);
const masukan = ref<HTMLInputElement>();

const keBase64 = (berkas: File) =>
  new Promise<string>((ok, gagal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = gagal;
    r.readAsDataURL(berkas);
  });

const unggah = async (e: Event) => {
  const berkas = (e.target as HTMLInputElement).files?.[0];
  if (!berkas) return;
  mengunggah.value = true;
  const res = await apiStudioPost(`/item/${props.itemUuid}/lampiran`, { nama: berkas.name, mime: berkas.type || "application/octet-stream", data: await keBase64(berkas), disamarkan: disamarkan.value });
  mengunggah.value = false;
  if (masukan.value) masukan.value.value = "";
  if (res) emit("berubah");
};

const buka = async (l: any) => {
  const token = localStorage.getItem("access_token") ?? "";
  const dasar = import.meta.env.VITE_BASE_STUDIO || "http://localhost:8090/api/v3/studio";
  const r = await fetch(`${dasar}/item/${props.itemUuid}/lampiran/${l.uuid}`, { headers: { Authorization: token } });
  if (!r.ok) return;
  window.open(URL.createObjectURL(await r.blob()), "_blank");
};

const hapus = async (l: any) => {
  if (await apiEkstensi("studio", "delete", `/item/${props.itemUuid}/lampiran/${l.uuid}`)) emit("berubah");
};
</script>

<template>
  <div class="rounded-lg border border-grey-200 p-3 text-XS text-grey-500">
    <div class="mb-1 flex items-center gap-2 text-SM font-semibold"><PhPaperclip :size="16" class="text-opensimrs-300" aria-hidden="true" /> Lampiran</div>
    <div v-for="l in lampiran" :key="l.uuid" class="flex items-center justify-between gap-2 py-0.5">
      <button type="button" class="truncate text-left text-opensimrs-300 underline" @click="buka(l)">{{ l.nama }}</button>
      <span class="shrink-0 text-grey-300">{{ Math.ceil(l.ukuran / 1024) }} KB</span>
      <button v-if="bolehUbah" type="button" class="shrink-0 text-danger-300" aria-label="Hapus lampiran" @click="hapus(l)"><PhTrash :size="14" aria-hidden="true" /></button>
    </div>
    <div v-if="!lampiran.length" class="text-grey-300">Belum ada lampiran.</div>
    <template v-if="bolehUbah">
      <label class="mt-2 flex items-start gap-1.5">
        <input v-model="disamarkan" type="checkbox" class="mt-0.5" />
        <span>Lampiran sudah disamarkan (tanpa nama/NIK/foto pasien asli).</span>
      </label>
      <input ref="masukan" type="file" class="hidden" accept="image/*,application/pdf,text/*,.csv,.json" @change="unggah" />
      <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" class="mt-1" label="Tambah lampiran" icon="PhUploadSimple" outlined :disabled="!disamarkan || mengunggah" @click="masukan?.click()" />
    </template>
  </div>
</template>
