<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import { useBpjsPcareStore } from "@/stores/bpjsPcare";
import { utilsStore } from "@/stores/utils";

// Pemetaan poli & dokter OpenSIMRS → kode poli/dokter BPJS PCare (wajib sebelum pendaftaran & kunjungan dikirim)
const store = useBpjsPcareStore();
const storeUtils = utilsStore();
const toast = useToast();

const poli = ref<any[]>([]);
const dokter = ref<any[]>([]);
const opsiPoli = ref<{ value: string; label: string }[]>([]);
const opsiDokter = ref<{ value: string; label: string }[]>([]);
const pesanReferensi = ref("");

const namaDokter = (d: any) => [d.firstTitle, d.name, d.lastTitle].filter(Boolean).join(" ");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const [pemetaan, refPoli, refDokter] = await Promise.all([store.getPemetaan(), store.getReferensi("poli"), store.getReferensi("dokter")]);
    poli.value = (pemetaan?.payload?.poli ?? []).map((p: any) => ({ ...p, pilihan: p.kdPoliBpjs ?? "" }));
    dokter.value = (pemetaan?.payload?.dokter ?? []).map((d: any) => ({ ...d, pilihan: d.codeBpjs ?? "" }));
    if (refPoli?.gagal || refDokter?.gagal) {
      pesanReferensi.value = refPoli?.message || refDokter?.message || "Referensi PCare belum dapat diambil";
    } else {
      pesanReferensi.value = "";
      opsiPoli.value = (refPoli?.payload ?? []).map((p: any) => ({ value: p.kdPoli, label: `${p.kdPoli} – ${p.nmPoli}` }));
      opsiDokter.value = (refDokter?.payload ?? []).map((d: any) => ({ value: d.kdDokter, label: `${d.kdDokter} – ${d.nmDokter}` }));
    }
    // nilai yang sudah tersimpan tetap tampil walau tidak ada di referensi (mis. kode lama)
    for (const p of poli.value) if (p.pilihan && !opsiPoli.value.some((o) => o.value === p.pilihan)) opsiPoli.value.push({ value: p.pilihan, label: `${p.pilihan} (tersimpan)` });
    for (const d of dokter.value) if (d.pilihan && !opsiDokter.value.some((o) => o.value === d.pilihan)) opsiDokter.value.push({ value: d.pilihan, label: `${d.pilihan} (tersimpan)` });
  } finally {
    storeUtils.setLoading(false);
  }
};

const simpan = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await store.simpanPemetaan({
      poli: poli.value.map((p) => ({ uuid: p.uuid, kdPoliBpjs: p.pilihan || null })),
      dokter: dokter.value.map((d) => ({ uuid: d.uuid, codeBpjs: d.pilihan || null })),
    });
    if (res?.gagal) toast.add({ severity: "error", summary: "Gagal menyimpan pemetaan", detail: res.message, life: 6000 });
    else if (res) toast.add({ severity: "success", summary: "Pemetaan PCare disimpan", life: 3000 });
  } finally {
    storeUtils.setLoading(false);
  }
};

defineExpose({ muat });
onMounted(muat);
</script>

<template>
  <GreenCard cardHeading="Pemetaan Poli & Dokter ke BPJS PCare" hrEnableCustomClass>
    <div class="flex flex-col gap-4 pl-2 text-base">
      <div v-if="pesanReferensi" class="p-3 text-sm rounded-md bg-[#FEF0C7] text-[#B54708]">
        Daftar kode dari PCare belum tersedia: {{ pesanReferensi }}. Lengkapi dan aktifkan konfigurasi PCare terlebih dahulu.
      </div>
      <div class="grid grid-cols-2 gap-6">
        <div>
          <div class="mb-2 font-semibold">Poli</div>
          <DataTable :value="poli" stripedRows class="text-xs" scrollable scrollHeight="360px">
            <Column header="Poli OpenSIMRS" field="name" headerClass="bg-opensimrs-50" />
            <Column header="Kode Poli BPJS" headerClass="bg-opensimrs-50">
              <template #body="{ data }">
                <CustomSelect v-model="data.pilihan" :options="opsiPoli" optionValue="value" optionLabel="label" placeHolder="Belum dipetakan" showFilter :showLabel="false" />
              </template>
            </Column>
          </DataTable>
        </div>
        <div>
          <div class="mb-2 font-semibold">Dokter</div>
          <DataTable :value="dokter" stripedRows class="text-xs" scrollable scrollHeight="360px">
            <Column header="Dokter OpenSIMRS" headerClass="bg-opensimrs-50">
              <template #body="{ data }">{{ namaDokter(data) }}</template>
            </Column>
            <Column header="Kode Dokter BPJS" headerClass="bg-opensimrs-50">
              <template #body="{ data }">
                <CustomSelect v-model="data.pilihan" :options="opsiDokter" optionValue="value" optionLabel="label" placeHolder="Belum dipetakan" showFilter :showLabel="false" />
              </template>
            </Column>
          </DataTable>
        </div>
      </div>
      <div class="flex justify-end gap-3">
        <CustomButton label="Muat Ulang" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="muat" />
        <CustomButton label="Simpan Pemetaan" @click="simpan" />
      </div>
    </div>
  </GreenCard>
</template>
