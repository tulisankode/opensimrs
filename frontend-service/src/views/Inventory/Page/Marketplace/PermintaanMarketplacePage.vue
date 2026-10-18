<script setup lang="ts">
// STD-0019 — Daftar & detail permintaan/pesanan marketplace: persetujuan, checkout idempoten, sinkron status,
// dan penghubung ke Penerimaan Pembelian (alur gudang yang sama dengan PO — lihat MarketplaceService.checkout
// yang membuat pembelian_barang_supplier berstatus "verifikasi" saat checkout berhasil).
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "primevue/usetoast";
import { useMarketplaceStore, gayaPersetujuanMarketplace, gayaPesananMarketplace } from "@/stores/inventory/marketplace";
import { utilsStore } from "@/stores/utils";
import { formatPrice, epochToDate } from "@/utils/Helpers";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import NoData from "@/components/section/NoData.vue";

const toast = useToast();
const router = useRouter();
const marketplaceStore = useMarketplaceStore();
const utils = utilsStore();

const daftarPesanan = ref<any[]>([]);
const search = ref("");
const statusPesanan = ref("");
const opsiStatusPesanan = [
  { name: "Semua", value: "" },
  { name: "Draft", value: "draft" },
  { name: "Menunggu Konfirmasi", value: "menunggu_konfirmasi" },
  { name: "Dibayar", value: "dibayar" },
  { name: "Dikemas", value: "dikemas" },
  { name: "Dikirim", value: "dikirim" },
  { name: "Diterima Sebagian", value: "diterima_sebagian" },
  { name: "Diterima", value: "diterima" },
  { name: "Dibatalkan", value: "dibatalkan" },
];

const fetchList = async () => {
  utils.setLoading(true);
  try {
    const res = await marketplaceStore.getListPesanan({ search: search.value, status_pesanan: statusPesanan.value, limit: 50 });
    daftarPesanan.value = res?.payload || [];
  } finally {
    utils.setLoading(false);
  }
};

// --- Detail pesanan ---
const dialogDetailTampil = ref(false);
const detail = ref<any>(null);
const penerimaanInfo = ref<any>(null);
const alasanTolak = ref("");

const bukaDetail = async (uuid: string) => {
  utils.setLoading(true);
  try {
    const res = await marketplaceStore.getDetailPesanan(uuid);
    detail.value = res?.payload;
    penerimaanInfo.value = detail.value?.pesanan?.pembelianBarangSupplierUuid ? (await marketplaceStore.getPenerimaan(uuid))?.payload : null;
    alasanTolak.value = "";
    dialogDetailTampil.value = true;
  } finally {
    utils.setLoading(false);
  }
};

const muatUlangDetail = async () => {
  if (!detail.value?.pesanan?.uuid) return;
  await bukaDetail(detail.value.pesanan.uuid);
  fetchList();
};

const setujui = async () => {
  utils.setLoading(true);
  try {
    await marketplaceStore.persetujuan(detail.value.pesanan.uuid, { keputusan: "setujui" });
    toast.add({ severity: "success", summary: "Permintaan disetujui", life: 3000 });
    await muatUlangDetail();
  } finally {
    utils.setLoading(false);
  }
};

const tolak = async () => {
  if (!alasanTolak.value) {
    toast.add({ severity: "warn", summary: "Alasan penolakan wajib diisi", life: 3000 });
    return;
  }
  utils.setLoading(true);
  try {
    await marketplaceStore.persetujuan(detail.value.pesanan.uuid, { keputusan: "tolak", alasan: alasanTolak.value });
    toast.add({ severity: "success", summary: "Permintaan ditolak", life: 3000 });
    await muatUlangDetail();
  } finally {
    utils.setLoading(false);
  }
};

const checkout = async () => {
  utils.setLoading(true);
  try {
    const res = await marketplaceStore.checkout(detail.value.pesanan.uuid);
    toast.add({ severity: "success", summary: "Checkout diproses", detail: `No. Pesanan Mitra: ${res?.payload?.pesanan?.nomorPesananMitra || "-"}`, life: 4000 });
    await muatUlangDetail();
  } finally {
    utils.setLoading(false);
  }
};

const sinkronStatus = async () => {
  utils.setLoading(true);
  try {
    await marketplaceStore.sinkronStatus(detail.value.pesanan.uuid);
    toast.add({ severity: "success", summary: "Status pesanan disinkronkan", life: 3000 });
    await muatUlangDetail();
  } finally {
    utils.setLoading(false);
  }
};

const bukaPenerimaan = () => {
  toast.add({
    severity: "info",
    summary: "Buka Penerimaan Pembelian",
    detail: `Cari No. PO ${penerimaanInfo.value?.noPo} pada daftar Penerimaan Pembelian untuk mencatat barang diterima.`,
    life: 6000,
  });
  router.push("/inventory/penerimaan-barang/penerimaan-pembelian");
};

const bisaSetujui = computed(() => detail.value?.pesanan?.statusPersetujuan === "menunggu");
const bisaCheckout = computed(
  () => detail.value?.pesanan?.statusPersetujuan === "disetujui" && !detail.value?.pesanan?.nomorPesananMitra,
);
const bisaSinkron = computed(() => !!detail.value?.pesanan?.nomorPesananMitra);

const hasData = computed(() => daftarPesanan.value.length > 0);

onMounted(fetchList);
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
    <template #header>
      <PageToolbar>
        <CustomButton icon="PhArrowClockwise" @click="fetchList" />
        <CustomBreadCrumb :home="{ label: 'Permintaan & Pesanan Marketplace', home: true }" />
        <CustomTextfield v-model="search" label="Cari No. Internal/Mitra" prependIcon="PhMagnifyingGlass" @keydown.enter="fetchList" />
        <CustomSelect label="Status Pesanan" v-model="statusPesanan" :options="opsiStatusPesanan" optionLabel="name" optionValue="value" />
        <CustomButton label="Tampilkan" icon="PhMagnifyingGlass" @click="fetchList" />
      </PageToolbar>
    </template>
    <template #content>
      <NoData v-if="!hasData" title="Belum ada permintaan pembelian marketplace." />
      <DataTable v-else :value="daftarPesanan" stripedRows class="text-xs" scrollable scrollHeight="flex" @row-click="(e: any) => bukaDetail(e.data.uuid)">
        <Column header="No. Internal / Mitra" headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #body="slotProps">
            <div>{{ slotProps.data.nomorInternal }}</div>
            <div class="text-grey-300">{{ slotProps.data.nomorPesananMitra || "-" }} &middot; {{ slotProps.data.mitraKode }}</div>
          </template>
        </Column>
        <Column header="Diajukan" headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #body="slotProps">{{ epochToDate(slotProps.data.diajukanPada, "date") }}</template>
        </Column>
        <Column header="Nilai Perkiraan" headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #body="slotProps">{{ formatPrice(slotProps.data.nilaiPerkiraan) }}</template>
        </Column>
        <Column header="Persetujuan" headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #body="slotProps">
            <CustomChip
              :label="gayaPersetujuanMarketplace(slotProps.data.statusPersetujuan)?.label"
              :showCheckedIcon="false"
              :bgColor="gayaPersetujuanMarketplace(slotProps.data.statusPersetujuan)?.bg"
              :textColor="gayaPersetujuanMarketplace(slotProps.data.statusPersetujuan)?.text"
            />
          </template>
        </Column>
        <Column header="Status Pesanan" headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #body="slotProps">
            <CustomChip
              :label="gayaPesananMarketplace(slotProps.data.statusPesanan)?.label"
              :showCheckedIcon="false"
              :bgColor="gayaPesananMarketplace(slotProps.data.statusPesanan)?.bg"
              :textColor="gayaPesananMarketplace(slotProps.data.statusPesanan)?.text"
            />
          </template>
        </Column>
      </DataTable>
    </template>
  </Card>

  <CustomDialog :visible="dialogDetailTampil" @update:visible="(v: boolean) => (dialogDetailTampil = v)" width="750px" v-if="detail">
    <template #header>Detail Permintaan {{ detail.pesanan.nomorInternal }}</template>
    <template #body>
      <div class="flex flex-col gap-3">
        <div class="flex gap-2">
          <CustomChip :label="gayaPersetujuanMarketplace(detail.pesanan.statusPersetujuan)?.label" :showCheckedIcon="false"
            :bgColor="gayaPersetujuanMarketplace(detail.pesanan.statusPersetujuan)?.bg" :textColor="gayaPersetujuanMarketplace(detail.pesanan.statusPersetujuan)?.text" />
          <CustomChip :label="gayaPesananMarketplace(detail.pesanan.statusPesanan)?.label" :showCheckedIcon="false"
            :bgColor="gayaPesananMarketplace(detail.pesanan.statusPesanan)?.bg" :textColor="gayaPesananMarketplace(detail.pesanan.statusPesanan)?.text" />
        </div>
        <DataTable :value="detail.items" stripedRows class="text-xs">
          <Column header="Produk">
            <template #body="slotProps">{{ slotProps.data.namaProdukMitra }}</template>
          </Column>
          <Column field="jumlah" header="Jumlah" />
          <Column header="Harga Satuan">
            <template #body="slotProps">{{ formatPrice(slotProps.data.hargaSatuan) }}</template>
          </Column>
          <Column header="Total">
            <template #body="slotProps">{{ formatPrice(slotProps.data.totalHarga) }}</template>
          </Column>
        </DataTable>

        <div v-if="detail.tagihan?.length" class="rounded border border-grey-100 p-3">
          <div class="font-semibold mb-2">Informasi Tagihan</div>
          <div v-for="t in detail.tagihan" :key="t.uuid" class="text-xs flex justify-between">
            <span>{{ t.referensiTagihan }} &middot; {{ formatPrice(t.nilai) }}</span>
            <span>{{ t.statusDikonfirmasi === "lunas" ? "Lunas" : "Belum dikonfirmasi lunas" }}</span>
          </div>
        </div>

        <div v-if="penerimaanInfo" class="rounded border border-grey-100 p-3 flex justify-between items-center">
          <div>
            <div class="font-semibold">No. PO: {{ penerimaanInfo.noPo || "-" }}</div>
            <div class="text-xs text-grey-300">Status PO: {{ penerimaanInfo.statusPo || "-" }}</div>
          </div>
          <CustomButton label="Buka Penerimaan Pembelian" size="small" @click="bukaPenerimaan" />
        </div>

        <CustomTextfield v-if="bisaSetujui" label="Alasan (wajib bila menolak)" v-model="alasanTolak" placeholder="Alasan penolakan" />
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <CustomButton v-if="bisaSetujui" label="Tolak" text-color="text-danger-300" border-color="border-danger-300" outlined @click="tolak" />
        <CustomButton v-if="bisaSetujui" label="Setujui" @click="setujui" />
        <CustomButton v-if="bisaCheckout" label="Checkout" @click="checkout" />
        <CustomButton v-if="bisaSinkron" label="Sinkron Status" text-color="text-opensimrs-300" border-color="border-opensimrs-300" outlined @click="sinkronStatus" />
      </div>
    </template>
  </CustomDialog>
</template>
