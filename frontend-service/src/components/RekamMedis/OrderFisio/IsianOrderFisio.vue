<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import { JENIS_FISIO, labelJenis, rupiah, useFisioterapiStore, type IsianOrder } from "@/stores/penunjang/fisioterapi";

// Isian order terapi (dipakai Order dari RME, Order APS, Lanjut Booking, Ubah Order).
// Segmen "Tindakan | Paket": paket mengisi jenis, jumlah sesi & tindakan dari master paket; tagihan memakai
// harga paket (dialokasikan ke tindakan di backend).

const model = defineModel<IsianOrder>({ required: true });
const props = defineProps<{ disabled?: boolean }>();

const store = useFisioterapiStore();
const galat = ref<Record<string, string>>({});
const pilihTindakan = ref<string>("");
const segmen = ref<"tindakan" | "paket">(model.value.paketUuid ? "paket" : "tindakan");

onMounted(() => Promise.all([store.muatTindakan(), store.muatPaket()]));

// Tindakan sesuai jenis (tindakan tanpa jenis berlaku untuk semua), belum dipilih.
const opsiTindakan = computed(() =>
  store.tindakan
    .filter((t) => !t.jenisFisio || !model.value.jenisFisio || t.jenisFisio === model.value.jenisFisio)
    .filter((t) => !model.value.tindakan.some((x) => x.tindakanUuid === t.uuid))
    .map((t) => ({ ...t, label: `${t.nama} — ${rupiah(t.harga)}` })),
);
const tambah = (uuid: string) => {
  const t = store.tindakan.find((x) => x.uuid === uuid);
  if (t) model.value.tindakan.push({ tindakanUuid: t.uuid, nama: t.nama, harga: Number(t.harga), qty: 1 });
  setTimeout(() => (pilihTindakan.value = ""));
};
const hapus = (i: number) => model.value.tindakan.splice(i, 1);
const perSesi = computed(() => model.value.tindakan.reduce((n, t) => n + t.harga * (t.qty || 1), 0));

// ── Paket
const opsiPaket = computed(() =>
  store.paket.map((p) => ({ ...p, label: `${p.nama} — ${labelJenis(p.jenisFisio)}, ${p.jumlahSesi} sesi — ${rupiah(p.harga)}` })),
);
const paket = computed(() => store.paket.find((p) => p.uuid === model.value.paketUuid) ?? null);
const pakaiPaket = computed(() => !!model.value.paketUuid);
const kunci = computed(() => props.disabled || pakaiPaket.value);

const pilihPaket = (uuid: string | null) => {
  model.value.paketUuid = uuid || null;
  const p = store.paket.find((x) => x.uuid === uuid);
  if (!p) return;
  model.value.jenisFisio = p.jenisFisio;
  model.value.jumlahSesi = p.jumlahSesi;
  model.value.tindakan = p.tindakan.map((t) => ({ tindakanUuid: t.tindakanUuid, nama: t.nama, harga: Number(t.harga), qty: t.qty }));
};
const gantiSegmen = (s: "tindakan" | "paket") => {
  if (props.disabled || segmen.value === s) return;
  segmen.value = s;
  // Kembali ke tindakan satuan: lepas paket, tindakan tetap bisa diubah.
  if (s === "tindakan") model.value.paketUuid = null;
};

const validasi = () => {
  const g: Record<string, string> = {};
  if (segmen.value === "paket" && !model.value.paketUuid) g.paket = "Pilih paket terapi";
  if (!model.value.jenisFisio) g.jenisFisio = "Jenis fisioterapi wajib dipilih";
  if (!model.value.tindakan.length) g.tindakan = "Pilih minimal satu tindakan terapi";
  if (!model.value.jumlahSesi || model.value.jumlahSesi < 1) g.jumlahSesi = "Jumlah sesi minimal 1";
  galat.value = g;
  return Object.keys(g).length === 0;
};
// Body API (camelCase → snake_case otomatis). paketUuid null = tarif satuan.
const payload = () => ({
  paketUuid: model.value.paketUuid || null,
  jenisFisio: model.value.jenisFisio,
  tindakan: model.value.tindakan.map((t) => ({ tindakanUuid: t.tindakanUuid, qty: t.qty || 1 })),
  jumlahSesi: model.value.jumlahSesi,
  diagnosis: model.value.diagnosis || null,
  keluhan: model.value.keluhan || null,
  catatan: model.value.catatan || null,
});
defineExpose({ validasi, payload });
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div class="flex flex-wrap items-center gap-3 md:col-span-2">
      <div class="flex overflow-hidden border rounded-lg border-opensimrs-300" role="tablist" aria-label="Sumber tindakan">
        <button
          v-for="s in (['tindakan', 'paket'] as const)"
          :key="s"
          type="button"
          role="tab"
          :aria-selected="segmen === s"
          class="px-3 py-1.5 text-xs font-semibold"
          :class="[segmen === s ? 'bg-opensimrs-300 text-white' : 'text-opensimrs-300 bg-white', { 'cursor-not-allowed': disabled }]"
          @click="gantiSegmen(s)"
        >
          {{ s === "tindakan" ? "Tindakan Satuan" : `Paket Terapi (${store.paket.length})` }}
        </button>
      </div>
      <span v-if="segmen === 'paket'" class="text-xs text-grey-400">Jenis, jumlah sesi &amp; tindakan mengikuti paket; tagihan memakai harga paket.</span>
    </div>
    <CustomSelect
      v-if="segmen === 'paket'"
      class="md:col-span-2"
      :modelValue="model.paketUuid"
      label="Paket Terapi"
      placeHolder="Pilih paket terapi"
      :options="opsiPaket"
      optionLabel="label"
      optionValue="uuid"
      showFilter
      :disabled="disabled"
      :invalid="!!galat.paket"
      :invalidMessage="galat.paket"
      required
      @update:modelValue="(v: any) => pilihPaket(v)"
    />
    <CustomSelect
      v-model="model.jenisFisio"
      label="Jenis Fisioterapi"
      placeHolder="Pilih jenis fisioterapi"
      :options="JENIS_FISIO"
      optionLabel="label"
      optionValue="value"
      :disabled="kunci"
      :invalid="!!galat.jenisFisio"
      :invalidMessage="galat.jenisFisio"
      required
    />
    <CustomInputNumber
      v-model="model.jumlahSesi"
      label="Jumlah Sesi"
      :min="1"
      :max="100"
      showButtons
      :disabled="kunci"
      :invalid="!!galat.jumlahSesi"
      :invalidMessage="galat.jumlahSesi"
      required
    />
    <div class="flex flex-col gap-2 md:col-span-2">
      <CustomSelect
        v-if="!pakaiPaket"
        v-model="pilihTindakan"
        label="Tindakan Terapi"
        placeHolder="Tambah tindakan terapi"
        :options="opsiTindakan"
        optionLabel="label"
        optionValue="uuid"
        showFilter
        :disabled="disabled"
        :invalid="!!galat.tindakan"
        :invalidMessage="galat.tindakan"
        @update:modelValue="(v: any) => v && tambah(v)"
      />
      <div v-else-if="paket?.deskripsi" class="text-xs text-grey-400">{{ paket.deskripsi }}</div>
      <table v-if="model.tindakan.length" class="w-full text-xs border rounded border-grey-100">
        <thead class="bg-opensimrs-50">
          <tr>
            <th class="px-2 py-1.5 text-left">Tindakan</th>
            <th class="px-2 py-1.5 text-right">Harga</th>
            <th class="px-2 py-1.5 w-24">Qty/Sesi</th>
            <th class="px-2 py-1.5 text-right">Subtotal</th>
            <th class="w-8"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(t, i) in model.tindakan" :key="t.tindakanUuid" class="border-t border-grey-75">
            <td class="px-2 py-1">{{ t.nama }}</td>
            <td class="px-2 py-1 text-right">{{ rupiah(t.harga) }}</td>
            <td class="px-2 py-1">
              <input v-model.number="t.qty" type="number" min="1" :disabled="kunci" class="w-16 px-1 py-0.5 border rounded border-grey-200" aria-label="Qty per sesi" />
            </td>
            <td class="px-2 py-1 text-right">{{ rupiah(t.harga * (t.qty || 1)) }}</td>
            <td class="px-1 text-center">
              <button v-if="!kunci" type="button" class="text-danger-300" aria-label="Hapus tindakan" @click="hapus(i)"><PhTrash :size="14" /></button>
            </td>
          </tr>
        </tbody>
        <tfoot class="font-semibold border-t border-grey-100">
          <tr>
            <td colspan="3" class="px-2 py-1 text-right">Per sesi</td>
            <td class="px-2 py-1 text-right">{{ rupiah(perSesi) }}</td>
            <td></td>
          </tr>
          <tr>
            <td colspan="3" class="px-2 py-1 text-right">Total tarif satuan ({{ model.jumlahSesi || 1 }} sesi)</td>
            <td class="px-2 py-1 text-right" :class="pakaiPaket ? 'line-through text-grey-300' : 'text-opensimrs-400'">{{ rupiah(perSesi * (model.jumlahSesi || 1)) }}</td>
            <td></td>
          </tr>
          <tr v-if="pakaiPaket && paket">
            <td colspan="3" class="px-2 py-1 text-right">Harga paket {{ paket.nama }}</td>
            <td class="px-2 py-1 text-right text-opensimrs-400">{{ rupiah(paket.harga) }}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <CustomTextArea v-model="model.diagnosis" label="Diagnosis" placeholder="Diagnosis kerja / medis" :disabled="disabled" />
    <CustomTextArea v-model="model.keluhan" label="Keluhan" placeholder="Keluhan utama pasien" :disabled="disabled" />
    <CustomTextArea v-model="model.catatan" class="md:col-span-2" label="Catatan" placeholder="Catatan untuk fisioterapis (opsional)" :disabled="disabled" />
  </div>
</template>
