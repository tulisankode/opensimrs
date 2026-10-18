<script setup lang="ts">
// STD-0019 — Pemetaan produk marketplace mitra ke master barang gudang & satuan pembelian. Produk hanya bisa
// dipesan setelah dipetakan dan konversi satuannya tervalidasi (KT-5).
import { computed, onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import { useMarketplaceStore } from "@/stores/inventory/marketplace";
import { useMedicalItemStore } from "@/stores/datamasterFarmasi/MedicalItem";
import { utilsStore } from "@/stores/utils";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import NoData from "@/components/section/NoData.vue";

const toast = useToast();
const marketplaceStore = useMarketplaceStore();
const utils = utilsStore();

const daftarKoneksi = ref<any[]>([]);
const daftarPemetaan = ref<any[]>([]);
const daftarItemMedis = ref<any[]>([]);
const search = ref("");

const namaItem = (itemUuid: string) => daftarItemMedis.value.find((i: any) => i.uuid === itemUuid)?.nama || itemUuid;

const fetchData = async () => {
  utils.setLoading(true);
  try {
    const [konfigurasi, pemetaan, item] = await Promise.all([
      marketplaceStore.getKonfigurasi(),
      marketplaceStore.getPemetaan({ search: search.value, limit: 100 }),
      useMedicalItemStore().getApi(1, 9999),
    ]);
    daftarKoneksi.value = (konfigurasi?.payload || []).filter((k: any) => k.aktif);
    daftarPemetaan.value = pemetaan?.payload || [];
    daftarItemMedis.value = item?.payload || [];
  } finally {
    utils.setLoading(false);
  }
};

// --- Form pemetaan baru/ubah ---
const dialogTampil = ref(false);
const satuanOptions = ref<any[]>([]);
const form = ref({
  mitraKode: "",
  produkMitraId: "",
  namaProdukMitra: "",
  kemasanMitra: "",
  itemUuid: "",
  satuanUuid: "",
});

const bukaDialog = (data?: any) => {
  satuanOptions.value = [];
  form.value = data
    ? { mitraKode: data.mitraKode, produkMitraId: data.produkMitraId, namaProdukMitra: data.namaProdukMitra, kemasanMitra: data.kemasanMitra, itemUuid: data.itemUuid, satuanUuid: data.satuanUuid }
    : { mitraKode: daftarKoneksi.value[0]?.mitraKode || "", produkMitraId: "", namaProdukMitra: "", kemasanMitra: "", itemUuid: "", satuanUuid: "" };
  if (form.value.itemUuid) muatSatuan(form.value.itemUuid, data?.satuanUuid);
  dialogTampil.value = true;
};

// pertahankan: satuan tersimpan yang tetap dipilih saat membuka pemetaan yang sudah ada.
const muatSatuan = async (itemUuid: string, pertahankan = "") => {
  form.value.satuanUuid = pertahankan;
  satuanOptions.value = [];
  if (!itemUuid) return;
  const res = await marketplaceStore.getKonversiItem(itemUuid);
  satuanOptions.value = (res?.payload || []).map((c: any) => ({
    label: `${c.satuanPembelian} (1 : ${c.konversi} ${c.satuanPenggunaan})`,
    value: c.satuanPembelianUuid,
  }));
};

const simpanPemetaan = async () => {
  if (!form.value.mitraKode || !form.value.produkMitraId || !form.value.itemUuid || !form.value.satuanUuid) {
    toast.add({ severity: "warn", summary: "Mitra, ID produk mitra, item, dan satuan wajib diisi", life: 3000 });
    return;
  }
  utils.setLoading(true);
  try {
    await marketplaceStore.putPemetaan(form.value.produkMitraId, {
      mitraKode: form.value.mitraKode,
      namaProdukMitra: form.value.namaProdukMitra || undefined,
      kemasanMitra: form.value.kemasanMitra || undefined,
      itemUuid: form.value.itemUuid,
      satuanUuid: form.value.satuanUuid,
    });
    toast.add({ severity: "success", summary: "Pemetaan produk berhasil disimpan", life: 3000 });
    dialogTampil.value = false;
    fetchData();
  } finally {
    utils.setLoading(false);
  }
};

const hasData = computed(() => daftarPemetaan.value.length > 0);

onMounted(fetchData);
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
    <template #header>
      <PageToolbar>
        <CustomButton icon="PhArrowClockwise" @click="fetchData" />
        <CustomBreadCrumb :home="{ label: 'Pemetaan Produk Marketplace', home: true }" />
        <CustomTextfield v-model="search" label="Cari Produk Mitra" placeholder="Nama produk mitra" prependIcon="PhMagnifyingGlass" @keydown.enter="fetchData" />
        <CustomButton label="Cari" icon="PhMagnifyingGlass" @click="fetchData" />
        <CustomButton label="Petakan Produk" icon="PhPlus" @click="bukaDialog()" />
      </PageToolbar>
    </template>
    <template #content>
      <NoData v-if="!hasData" title="Belum ada pemetaan produk marketplace." />
      <DataTable v-else :value="daftarPemetaan" stripedRows class="text-xs" scrollable scrollHeight="flex" @row-click="(e: any) => bukaDialog(e.data)">
        <Column field="mitraKode" header="Mitra" headerClass="bg-opensimrs-50 font-semibold text-SM" />
        <Column header="Produk Mitra" headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #body="slotProps">
            <div>{{ slotProps.data.namaProdukMitra || slotProps.data.produkMitraId }}</div>
            <div class="text-grey-300">ID: {{ slotProps.data.produkMitraId }} &middot; {{ slotProps.data.kemasanMitra || "-" }}</div>
          </template>
        </Column>
        <Column header="Master Barang" headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #body="slotProps">{{ namaItem(slotProps.data.itemUuid) }}</template>
        </Column>
        <Column header="Status" headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #body="slotProps">
            <CustomChip
              :label="slotProps.data.aktif ? 'Aktif' : 'Nonaktif'"
              :showCheckedIcon="false"
              :bgColor="slotProps.data.aktif ? 'bg-[#D1FADF]' : 'bg-grey-50'"
              :textColor="slotProps.data.aktif ? 'text-[#027A48]' : 'text-grey-400'"
            />
          </template>
        </Column>
      </DataTable>
    </template>
  </Card>

  <CustomDialog :visible="dialogTampil" @update:visible="(v: boolean) => (dialogTampil = v)" width="550px">
    <template #header>Petakan Produk Marketplace</template>
    <template #body>
      <div class="flex flex-col gap-3">
        <CustomSelect label="Koneksi Marketplace" placeHolder="Pilih Koneksi" v-model="form.mitraKode" :options="daftarKoneksi" optionLabel="namaMitra" optionValue="mitraKode" required />
        <CustomTextfield label="ID Produk Mitra" v-model="form.produkMitraId" placeholder="produk_mitra_id dari hasil pencarian" required />
        <CustomTextfield label="Nama Produk Mitra" v-model="form.namaProdukMitra" placeholder="opsional, untuk memudahkan pencarian" />
        <CustomTextfield label="Kemasan Mitra" v-model="form.kemasanMitra" placeholder="mis. Box isi 100" />
        <CustomSelect
          label="Master Barang"
          placeHolder="Cari Item"
          prependIcon="PhMagnifyingGlass"
          v-model="form.itemUuid"
          :options="daftarItemMedis"
          optionLabel="nama"
          optionValue="uuid"
          @update:model-value="(v: string) => muatSatuan(v)"
          required
        />
        <CustomSelect label="Satuan Pembelian" placeHolder="Pilih Satuan" v-model="form.satuanUuid" :options="satuanOptions" optionLabel="label" optionValue="value" required />
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <CustomButton label="Batal" text-color="text-opensimrs-300" border-color="border-opensimrs-300" outlined @click="dialogTampil = false" />
        <CustomButton label="Simpan" @click="simpanPemetaan" />
      </div>
    </template>
  </CustomDialog>
</template>
