<script setup lang="ts">
import { computed } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import { rupiah } from "@/stores/penunjang/akuntansi";

// Editor baris jurnal manual/penyesuaian/koreksi: akun rinci aktif, debit ATAU kredit, uraian, dan dimensi penjamin
// (akun piutang) / supplier (akun utang) agar aging benar. Total & selisih dihitung dalam sen (bilangan bulat) supaya
// tombol simpan tidak tertipu galat floating point; backend tetap memvalidasi ulang.
const props = defineProps<{ modelValue: any[]; akun: any[]; penjamin: any[]; supplier: any[] }>();
const emit = defineEmits(["update:modelValue"]);
const baris = computed({ get: () => props.modelValue, set: (v) => emit("update:modelValue", v) });
const akunRinci = computed(() => props.akun.filter((a) => a.jenis === "rinci" && a.aktif).map((a) => ({ ...a, label: `${a.kode} — ${a.nama}` })));
const akunDari = (uuid: string) => props.akun.find((a) => a.uuid === uuid);
const sen = (v: any) => {
  const t = String(v ?? "").trim().replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : 0;
};
const total = computed(() => baris.value.reduce((t, b) => ({ d: t.d + sen(b.debit), k: t.k + sen(b.kredit) }), { d: 0, k: 0 }));
defineExpose({ seimbang: () => total.value.d > 0 && total.value.d === total.value.k });
const tambah = () => (baris.value = [...baris.value, { akunUuid: "", debit: "", kredit: "", uraian: "", penjaminUuid: "", supplierUuid: "" }]);
const hapus = (i: number) => (baris.value = baris.value.filter((_, j) => j !== i));
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-for="(b, i) in baris" :key="i" class="grid items-end grid-cols-12 gap-2 pb-2 border-b border-grey-100">
      <CustomSelect v-model="b.akunUuid" label="Akun" :options="akunRinci" optionValue="uuid" optionLabel="label" class="col-span-4" />
      <label class="flex flex-col col-span-2 text-xs">Debit<input v-model="b.debit" inputmode="decimal" class="px-2 py-2 text-sm border rounded-md border-grey-200" placeholder="0" @input="b.debit && (b.kredit = '')" /></label>
      <label class="flex flex-col col-span-2 text-xs">Kredit<input v-model="b.kredit" inputmode="decimal" class="px-2 py-2 text-sm border rounded-md border-grey-200" placeholder="0" @input="b.kredit && (b.debit = '')" /></label>
      <label class="flex flex-col col-span-3 text-xs">Uraian baris<input v-model="b.uraian" maxlength="500" class="px-2 py-2 text-sm border rounded-md border-grey-200" /></label>
      <CustomButton icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" class="col-span-1" :disabled="baris.length <= 2" @click="hapus(i)" />
      <CustomSelect v-if="akunDari(b.akunUuid)?.bukuPembantu === 'piutang'" v-model="b.penjaminUuid" label="Penjamin (kosong = pasien umum)" placeHolder="Pasien umum" :options="penjamin" optionValue="uuid" optionLabel="nama" class="col-span-6" />
      <CustomSelect v-if="akunDari(b.akunUuid)?.bukuPembantu === 'utang'" v-model="b.supplierUuid" label="Supplier" :options="supplier" optionValue="uuid" optionLabel="nama" class="col-span-6" />
    </div>
    <div class="flex items-center justify-between text-sm">
      <CustomButton label="Tambah Baris" icon="PhPlus" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="tambah" />
      <div class="flex gap-4">
        <span>Debit <b>{{ rupiah(total.d / 100) }}</b></span>
        <span>Kredit <b>{{ rupiah(total.k / 100) }}</b></span>
        <span :class="total.d === total.k && total.d > 0 ? 'text-[#027A48]' : 'text-danger-300'">
          {{ total.d === total.k && total.d > 0 ? "Seimbang" : `Selisih ${rupiah((total.d - total.k) / 100, false)}` }}
        </span>
      </div>
    </div>
  </div>
</template>
