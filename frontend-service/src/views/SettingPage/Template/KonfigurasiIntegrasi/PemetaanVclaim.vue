<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import { useBpjsVclaimStore } from "@/stores/bpjsVclaim";
import { utilsStore } from "@/stores/utils";

// Pemetaan poli OpenSIMRS → kode poli VClaim (dipakai sebagai poli tujuan bawaan saat membuat SEP).
// Kode poli VClaim (INT, ANA, OBG, ...) berbeda dengan kode poli PCare.
const store = useBpjsVclaimStore();
const storeUtils = utilsStore();
const toast = useToast();

const poli = ref<any[]>([]);
const opsiPoli = ref<{ value: string; label: string }[]>([]);
const pesanReferensi = ref("");

// Referensi poli VClaim dicari per kata kunci; kumpulkan dari beberapa huruf awal yang umum
const KATA_KUNCI = ["A", "I", "O", "U", "E"];

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const pemetaan = await store.getPemetaanPoli();
    poli.value = (pemetaan?.payload ?? []).map((p: any) => ({ ...p, pilihan: p.kdPoliVclaim ?? "" }));
    const hasil = await Promise.all(KATA_KUNCI.map((q) => store.getReferensi("poli", { q })));
    const galat = hasil.find((r) => r?.gagal);
    if (galat) {
      pesanReferensi.value = galat.message || "Referensi poli VClaim belum dapat diambil";
    } else {
      pesanReferensi.value = "";
      const peta = new Map<string, string>();
      for (const r of hasil) for (const p of r?.payload ?? []) peta.set(p.kode, p.nama);
      opsiPoli.value = [...peta.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([kode, nama]) => ({ value: kode, label: `${kode} – ${nama}` }));
    }
    for (const p of poli.value) if (p.pilihan && !opsiPoli.value.some((o) => o.value === p.pilihan)) opsiPoli.value.push({ value: p.pilihan, label: `${p.pilihan} (tersimpan)` });
  } finally {
    storeUtils.setLoading(false);
  }
};

const simpan = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await store.simpanPemetaanPoli(poli.value.map((p) => ({ uuid: p.uuid, kdPoliVclaim: p.pilihan || null })));
    if (res?.gagal) toast.add({ severity: "error", summary: "Gagal menyimpan pemetaan", detail: res.message, life: 6000 });
    else if (res) toast.add({ severity: "success", summary: "Pemetaan poli VClaim disimpan", life: 3000 });
  } finally {
    storeUtils.setLoading(false);
  }
};

defineExpose({ muat });
onMounted(muat);
</script>

<template>
  <GreenCard cardHeading="Pemetaan Poli ke BPJS VClaim" hrEnableCustomClass>
    <div class="flex flex-col gap-4 pl-2 text-base">
      <div v-if="pesanReferensi" class="p-3 text-sm rounded-md bg-[#FEF0C7] text-[#B54708]">
        Daftar poli dari VClaim belum tersedia: {{ pesanReferensi }}. Lengkapi konfigurasi VClaim terlebih dahulu.
      </div>
      <DataTable :value="poli" stripedRows class="text-xs" scrollable scrollHeight="360px">
        <Column header="Poli OpenSIMRS" field="name" headerClass="bg-opensimrs-50" />
        <Column header="Kode Poli VClaim" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <CustomSelect v-model="data.pilihan" :options="opsiPoli" optionValue="value" optionLabel="label" placeHolder="Belum dipetakan" showFilter :showLabel="false" />
          </template>
        </Column>
      </DataTable>
      <div class="flex justify-end gap-3">
        <CustomButton label="Muat Ulang" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="muat" />
        <CustomButton label="Simpan Pemetaan" @click="simpan" />
      </div>
    </div>
  </GreenCard>
</template>
