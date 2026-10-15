<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { JENIS_MIKRO, SPESIMEN_MIKRO, daftarMasterMikro, rupiahMikro, type ItemOrderMikroInput } from "@/stores/penunjang/mikrobiologi";

// Pilih pemeriksaan mikrobiologi + jenis spesimen + lokasi/sumber spesimen per baris (satu baris = satu spesimen).
// Jenis spesimen dibatasi daftar spesimen yang diizinkan master pemeriksaan; bila hanya satu, terisi otomatis.
const model = defineModel<ItemOrderMikroInput[]>({ default: () => [] });

const master = ref<any[]>([]);
onMounted(async () => {
  const res = await daftarMasterMikro("pemeriksaan", { status: "aktif", limit: 500 });
  master.value = res?.payload?.data ?? [];
  if (!model.value.length) tambah();
});

const opsiPemeriksaan = computed(() =>
  master.value.map((m) => ({ value: m.uuid, label: `${m.nama} · ${rupiahMikro(m.harga)}`, grup: JENIS_MIKRO[m.jenis] ?? m.jenis }))
);
const cari = (uuid: string) => master.value.find((m) => m.uuid === uuid);
const opsiSpesimen = (uuid: string) => {
  const m = cari(uuid);
  const kode: string[] = m?.spesimen?.length ? m.spesimen : Object.keys(SPESIMEN_MIKRO);
  return kode.map((k) => ({ value: k, label: SPESIMEN_MIKRO[k] ?? k }));
};

const tambah = () => (model.value = [...model.value, { pemeriksaanUuid: "", jenisSpesimen: "", lokasiSpesimen: "" }]);
const hapus = (n: number) => (model.value = model.value.filter((_, i) => i !== n));
const gantiPemeriksaan = (n: number, uuid: string) => {
  const m = cari(uuid);
  const baris = [...model.value];
  const sp = m?.spesimen ?? [];
  const lama = baris[n].jenisSpesimen;
  baris[n] = { ...baris[n], pemeriksaanUuid: uuid, jenisSpesimen: sp.length === 1 ? sp[0] : sp.includes(lama) || !sp.length ? lama : "" };
  model.value = baris;
};
const ubah = (n: number, kolom: "jenisSpesimen" | "lokasiSpesimen", nilai: string) => {
  const baris = [...model.value];
  baris[n] = { ...baris[n], [kolom]: nilai };
  model.value = baris;
};
const total = computed(() => model.value.reduce((n, b) => n + (Number(cari(b.pemeriksaanUuid)?.harga) || 0), 0));
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-for="(b, n) in model" :key="n" class="grid items-start grid-cols-12 gap-2">
      <div class="col-span-5">
        <Select
          :modelValue="b.pemeriksaanUuid"
          :options="opsiPemeriksaan"
          optionValue="value"
          optionLabel="label"
          filter
          placeholder="Pilih pemeriksaan"
          class="w-full text-sm"
          :aria-label="`Pemeriksaan ${n + 1}`"
          @update:modelValue="gantiPemeriksaan(n, $event)"
        >
          <template #option="{ option }">
            <div class="flex flex-col">
              <span>{{ option.label }}</span>
              <span class="text-[10px] text-grey-400">{{ option.grup }}</span>
            </div>
          </template>
        </Select>
        <div v-if="cari(b.pemeriksaanUuid)" class="mt-0.5 text-[11px] text-grey-400">
          TAT ± {{ cari(b.pemeriksaanUuid).tatHari }} hari{{ cari(b.pemeriksaanUuid).metode ? ` · ${cari(b.pemeriksaanUuid).metode}` : "" }}
        </div>
      </div>
      <Select
        :modelValue="b.jenisSpesimen"
        :options="opsiSpesimen(b.pemeriksaanUuid)"
        optionValue="value"
        optionLabel="label"
        filter
        placeholder="Jenis spesimen"
        class="w-full col-span-3 text-sm"
        :aria-label="`Jenis spesimen ${n + 1}`"
        @update:modelValue="ubah(n, 'jenisSpesimen', $event)"
      />
      <InputText
        :modelValue="b.lokasiSpesimen"
        placeholder="Sumber / lokasi (mis. ulkus pedis kanan)"
        maxlength="200"
        class="col-span-3 text-sm"
        :aria-label="`Lokasi spesimen ${n + 1}`"
        @update:modelValue="ubah(n, 'lokasiSpesimen', String($event ?? ''))"
      />
      <div class="flex justify-end col-span-1">
        <CustomButton icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" :disabled="model.length === 1" @click="hapus(n)" />
      </div>
    </div>
    <div class="flex items-center justify-between">
      <CustomButton icon="PhPlus" label="Tambah Spesimen / Pemeriksaan" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="tambah" />
      <span class="text-sm font-semibold">Total: {{ rupiahMikro(total) }}</span>
    </div>
  </div>
</template>
