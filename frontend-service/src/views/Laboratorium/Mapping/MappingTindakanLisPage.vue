<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import NoData from "@/components/section/NoData.vue";
import { useLisStore } from "@/stores/Laboratorium/lis";
import { utilsStore } from "@/stores/utils";
import { formatPrice } from "@/utils/Helpers";

// Mapping registrasi ke LIS: kode tindakan LIS per tarif lab OpenSIMRS (mis. Darah Lengkap → JAS3048).
// Dikirim sebagai tindakan[].kode_tindakan saat "Validasi & Kirim ke LIS"; kosong = kode tarif OpenSIMRS.
const store = useLisStore();
const storeUtils = utilsStore();
const toast = useToast();

const tarif = ref<any[]>([]);
const cari = ref("");
const hanyaKosong = ref(false);
const tersaring = computed(() => {
  const k = cari.value.trim().toLowerCase();
  return tarif.value.filter(
    (t) =>
      (!hanyaKosong.value || !t.pilihan) &&
      (!k || [t.code, t.name, t.pilihan].some((v) => String(v ?? "").toLowerCase().includes(k)))
  );
});
const jumlahKosong = computed(() => tarif.value.filter((t) => !t.pilihan).length);
const jumlahBerubah = computed(() => tarif.value.filter((t) => (t.pilihan ?? "") !== (t.awal ?? "")).length);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await store.getPemetaanTarif();
    tarif.value = (res?.payload ?? []).map((t: any) => ({ ...t, pilihan: t.kodeLis ?? "", awal: t.kodeLis ?? "" }));
  } finally {
    storeUtils.setLoading(false);
  }
};

const simpan = async () => {
  const berubah = tarif.value.filter((t) => (t.pilihan ?? "") !== (t.awal ?? ""));
  if (!berubah.length) return toast.add({ severity: "info", summary: "Tidak ada perubahan", life: 2500 });
  storeUtils.setLoading(true);
  try {
    const res = await store.simpanPemetaanTarif(berubah.map((t) => ({ uuid: t.uuid, kode_lis: t.pilihan?.trim() || null })));
    if (res?.gagal) return toast.add({ severity: "error", summary: "Gagal menyimpan", detail: res.message, life: 5000 });
    toast.add({ severity: "success", summary: `${berubah.length} kode tindakan LIS disimpan`, life: 3000 });
    await muat();
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Mapping Tindakan LIS</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / kode tarif / kode LIS" :maxLength="100" />
          <label class="flex items-center gap-2 text-sm toolbar-item">
            <Checkbox v-model="hanyaKosong" binary />
            Belum dipetakan ({{ jumlahKosong }})
          </label>
          <CustomButton
            class="toolbar-action"
            icon="PhFloppyDisk"
            :label="jumlahBerubah ? `Simpan (${jumlahBerubah})` : 'Simpan'"
            @click="simpan"
          />
        </PageToolbar>
      </template>
      <template #content>
        <div class="px-4 pt-3 pb-2 text-xs text-grey-400">
          Kode tindakan LIS dikirim sebagai <code>kode_tindakan</code> saat order divalidasi & dikirim ke LIS. Bila kosong,
          yang dikirim kode tarif OpenSIMRS — LIS akan menolak bila kode itu tidak dikenalnya.
        </div>
        <NoData v-if="!tersaring.length" />
        <DataTable v-else :value="tersaring" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column header="Kode Tarif" field="code" headerClass="bg-opensimrs-50" class="w-[140px]" />
          <Column header="Tarif Lab OpenSIMRS" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              {{ data.name }}
              <span v-if="data.jumlahItem > 1" class="ml-1 px-1.5 rounded bg-opensimrs-50 text-opensimrs-300 text-[10px] font-semibold">Paket</span>
            </template>
          </Column>
          <Column header="Tarif" headerClass="bg-opensimrs-50" class="w-[130px]">
            <template #body="{ data }">{{ formatPrice(Number(data.grandTotal ?? 0)) }}</template>
          </Column>
          <Column header="Kode Tindakan LIS" headerClass="bg-opensimrs-50" class="w-[260px]">
            <template #body="{ data }">
              <CustomTextfield v-model="data.pilihan" :showLabel="false" placeholder="mis. JAS3048" :maxLength="50" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
