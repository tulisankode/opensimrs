<script setup lang="ts">
// STD-0019 — Pencarian & perbandingan penawaran marketplace mitra, lalu susun keranjang menjadi permintaan
// pembelian internal. Produk yang belum dipetakan ke master barang (lihat PemetaanProdukPage) tidak bisa
// ditambahkan ke keranjang (KT-5).
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "primevue/usetoast";
import { useMarketplaceStore } from "@/stores/inventory/marketplace";
import { useStockTypeStore } from "@/stores/datamasterFarmasi/StockType";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";
import { useSupplierStore } from "@/stores/inventory/supplier";
import { utilsStore } from "@/stores/utils";
import { formatPrice } from "@/utils/Helpers";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";

const toast = useToast();
const router = useRouter();
const marketplaceStore = useMarketplaceStore();
const utils = utilsStore();

type Penawaran = {
  produkMitraId: string;
  nama: string;
  kemasan: string | null;
  harga: number;
  stok: number;
  estimasiKirim: string | null;
  mitra: string;
  terpetakan: boolean;
};
type ItemKeranjang = Penawaran & { jumlah: number };

// --- Koneksi aktif (dipakai sebagai pilihan mitra) ---
const semuaKoneksi = ref<any[]>([]);
const daftarKoneksi = ref<any[]>([]);
const mitraKode = ref<string>("");
const fetchKoneksi = async () => {
  const res = await marketplaceStore.getKonfigurasi();
  semuaKoneksi.value = res?.payload || [];
  daftarKoneksi.value = semuaKoneksi.value.filter((k: any) => k.aktif);
  if (!mitraKode.value && daftarKoneksi.value.length) mitraKode.value = daftarKoneksi.value[0].mitraKode;
};

// --- Pencarian penawaran ---
const q = ref("");
const hasilPenawaran = ref<Penawaran[]>([]);
const cariPenawaran = async () => {
  if (!mitraKode.value) {
    toast.add({ severity: "warn", summary: "Pilih koneksi marketplace terlebih dahulu", life: 3000 });
    return;
  }
  utils.setLoading(true);
  try {
    const res = await marketplaceStore.cariPenawaran({ mitra_kode: mitraKode.value, q: q.value, limit: 50 });
    hasilPenawaran.value = res?.payload?.items || [];
  } finally {
    utils.setLoading(false);
  }
};

// --- Keranjang ---
const keranjang = ref<ItemKeranjang[]>([]);
const tambahKeKeranjang = (p: Penawaran) => {
  if (!p.terpetakan) {
    toast.add({ severity: "warn", summary: "Produk belum dipetakan ke master barang", detail: "Petakan produk ini terlebih dahulu di menu Pemetaan Produk.", life: 4000 });
    return;
  }
  const ada = keranjang.value.find((i) => i.produkMitraId === p.produkMitraId);
  if (ada) ada.jumlah += 1;
  else keranjang.value.push({ ...p, jumlah: 1 });
};
const hapusDariKeranjang = (produkMitraId: string) => {
  keranjang.value = keranjang.value.filter((i) => i.produkMitraId !== produkMitraId);
};
const totalKeranjang = computed(() => keranjang.value.reduce((acc, i) => acc + i.jumlah * i.harga, 0));

// --- Ajukan permintaan ---
const dialogAjukanTampil = ref(false);
const StockTypeStore = useStockTypeStore();
const StockLocationStore = useStockLocationStore();
const stockTypeOptions = ref<any[]>([]);
const stockLocationOptions = ref<any[]>([]);
const form = ref({
  jenisStokUuid: "",
  lokasiStokUuid: "",
  kategoriItem: "medis",
  jenisItem: "alkes",
  metodePembelian: "tunai",
  catatan: "",
});
const opsiKategoriItem = [
  { name: "Medis", value: "medis" },
  { name: "Non-Medis", value: "non-medis" },
];
const opsiJenisItem = [
  { name: "Obat", value: "obat" },
  { name: "Alkes", value: "alkes" },
];
const opsiMetodePembelian = [
  { name: "Tunai", value: "tunai" },
  { name: "Kredit", value: "kredit" },
];

const bukaDialogAjukan = async () => {
  if (!keranjang.value.length) {
    toast.add({ severity: "warn", summary: "Keranjang masih kosong", life: 3000 });
    return;
  }
  const [stockTypeRes, stockLocationRes] = await Promise.all([StockTypeStore.getApi(1, 9999), StockLocationStore.getApi(1, 9999)]);
  stockTypeOptions.value = stockTypeRes?.payload || [];
  stockLocationOptions.value = stockLocationRes?.payload || [];
  dialogAjukanTampil.value = true;
};

const ajukanPermintaan = async () => {
  if (!form.value.jenisStokUuid || !form.value.lokasiStokUuid) {
    toast.add({ severity: "warn", summary: "Jenis stok & lokasi stok wajib dipilih", life: 3000 });
    return;
  }
  utils.setLoading(true);
  try {
    const res = await marketplaceStore.createPermintaan({
      mitraKode: mitraKode.value,
      jenisStokUuid: form.value.jenisStokUuid,
      lokasiStokUuid: form.value.lokasiStokUuid,
      kategoriItem: form.value.kategoriItem as "medis" | "non-medis",
      jenisItem: form.value.jenisItem as "obat" | "alkes",
      metodePembelian: form.value.metodePembelian as "tunai" | "kredit",
      catatan: form.value.catatan || undefined,
      items: keranjang.value.map((i) => ({
        produkMitraId: i.produkMitraId,
        namaProdukMitra: i.nama,
        jumlah: i.jumlah,
        hargaSatuan: i.harga,
        stokPenawaran: i.stok,
        estimasiKirim: i.estimasiKirim || undefined,
      })),
    });
    if (res?.payload) {
      toast.add({ severity: "success", summary: "Permintaan berhasil diajukan", detail: `No. ${res.payload.pesanan?.nomorInternal}`, life: 4000 });
      keranjang.value = [];
      dialogAjukanTampil.value = false;
      router.push("/inventory/marketplace/permintaan");
    }
  } finally {
    utils.setLoading(false);
  }
};

// --- Konfigurasi koneksi (Admin/IT) ---
const dialogKonfigurasiTampil = ref(false);
const daftarSupplierAktif = ref<any[]>([]);
const konfigurasiForm = ref({
  mitraKode: "",
  namaMitra: "",
  baseUrl: "",
  akunAfiliasi: "",
  supplierUuid: "",
  modeMock: true,
  aktif: false,
  apiKey: "",
});

const apiKeySamaran = ref("");

const bukaDialogKonfigurasi = async () => {
  const res = await useSupplierStore().getApiAktif();
  daftarSupplierAktif.value = res?.payload || [];
  // Ubah koneksi yang sedang dipilih (atau koneksi pertama, termasuk yang belum aktif); kosong bila belum ada koneksi.
  const ada = semuaKoneksi.value.find((k: any) => k.mitraKode === mitraKode.value) || semuaKoneksi.value[0];
  konfigurasiForm.value = ada
    ? { mitraKode: ada.mitraKode, namaMitra: ada.namaMitra, baseUrl: ada.baseUrl, akunAfiliasi: ada.akunAfiliasi || "", supplierUuid: ada.supplierUuid, modeMock: ada.modeMock, aktif: ada.aktif, apiKey: "" }
    : { mitraKode: "", namaMitra: "", baseUrl: "", akunAfiliasi: "", supplierUuid: "", modeMock: true, aktif: false, apiKey: "" };
  apiKeySamaran.value = ada?.apiKeySamaran || "";
  dialogKonfigurasiTampil.value = true;
};

const simpanKonfigurasi = async () => {
  if (!konfigurasiForm.value.mitraKode || !konfigurasiForm.value.namaMitra || !konfigurasiForm.value.baseUrl || !konfigurasiForm.value.supplierUuid) {
    toast.add({ severity: "warn", summary: "Kode mitra, nama mitra, URL, dan supplier wajib diisi", life: 3000 });
    return;
  }
  utils.setLoading(true);
  try {
    const res = await marketplaceStore.putKonfigurasi({
      mitraKode: konfigurasiForm.value.mitraKode,
      namaMitra: konfigurasiForm.value.namaMitra,
      baseUrl: konfigurasiForm.value.baseUrl,
      akunAfiliasi: konfigurasiForm.value.akunAfiliasi || undefined,
      supplierUuid: konfigurasiForm.value.supplierUuid,
      modeMock: konfigurasiForm.value.modeMock,
      aktif: konfigurasiForm.value.aktif,
      apiKey: konfigurasiForm.value.apiKey || undefined,
    });
    if (res?.payload?.kunciMasukBaru) {
      toast.add({ severity: "success", summary: "Koneksi tersimpan", detail: `Kunci masuk (simpan sekarang, tidak ditampilkan lagi): ${res.payload.kunciMasukBaru}`, life: 15000 });
    } else {
      toast.add({ severity: "success", summary: "Koneksi marketplace berhasil disimpan", life: 3000 });
    }
    dialogKonfigurasiTampil.value = false;
    fetchKoneksi();
  } finally {
    utils.setLoading(false);
  }
};

onMounted(() => {
  fetchKoneksi();
});
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
    <template #header>
      <PageToolbar>
        <CustomButton icon="PhArrowClockwise" @click="fetchKoneksi" />
        <CustomBreadCrumb :home="{ label: 'Pencarian Penawaran', home: true }" />
        <CustomSelect
          label="Koneksi Marketplace"
          placeHolder="Pilih Koneksi"
          v-model="mitraKode"
          :options="daftarKoneksi"
          optionLabel="namaMitra"
          optionValue="mitraKode"
        />
        <CustomTextfield v-model="q" label="Cari Produk" placeholder="mis. Spuit 3 ml" prependIcon="PhMagnifyingGlass" @keydown.enter="cariPenawaran" />
        <CustomButton label="Cari" icon="PhMagnifyingGlass" @click="cariPenawaran" />
        <CustomButton :label="`Keranjang (${keranjang.length})`" icon="PhShoppingCart" @click="bukaDialogAjukan" />
        <CustomButton label="Konfigurasi Koneksi" icon="PhGear" text-color="text-opensimrs-300" border-color="border-opensimrs-300" outlined @click="bukaDialogKonfigurasi" />
      </PageToolbar>
    </template>
    <template #content>
      <div v-if="!semuaKoneksi.length" class="flex flex-col items-center gap-3 py-16 text-center">
        <NoData title="Belum ada koneksi marketplace mitra." />
        <div class="max-w-xl text-SM text-grey-400">Tambahkan koneksi mitra (URL, API key, supplier) lewat <b>Konfigurasi Koneksi</b>. Untuk uji coba, jalankan <code>node scripts/marketplace-tiruan.mjs</code> lalu isi URL <code>http://localhost:2414</code> dan API key <code>kunci-uji-marketplace</code>.</div>
        <CustomButton label="Konfigurasi Koneksi" icon="PhGear" @click="bukaDialogKonfigurasi" />
      </div>
      <NoData v-else-if="!hasilPenawaran.length" title="Belum ada hasil pencarian. Pilih koneksi lalu cari produk." />
      <DataTable v-else :value="hasilPenawaran" stripedRows class="text-xs" scrollable scrollHeight="flex">
        <Column header="Produk" headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #body="slotProps">
            <div>{{ slotProps.data.nama }}</div>
            <div class="text-grey-300">{{ slotProps.data.kemasan || "-" }} &middot; {{ slotProps.data.mitra }}</div>
          </template>
        </Column>
        <Column header="Harga" headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #body="slotProps">{{ formatPrice(slotProps.data.harga) }}</template>
        </Column>
        <Column field="stok" header="Stok" headerClass="bg-opensimrs-50 font-semibold text-SM" />
        <Column header="Estimasi Kirim" headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #body="slotProps">{{ slotProps.data.estimasiKirim || "-" }}</template>
        </Column>
        <Column header="Pemetaan" headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #body="slotProps">
            <CustomChip
              :label="slotProps.data.terpetakan ? 'Sudah Dipetakan' : 'Belum Dipetakan'"
              :showCheckedIcon="false"
              :bgColor="slotProps.data.terpetakan ? 'bg-[#D1FADF]' : 'bg-[#FDE2E1]'"
              :textColor="slotProps.data.terpetakan ? 'text-[#027A48]' : 'text-[#B42318]'"
              :borderColor="slotProps.data.terpetakan ? 'border-[#D1FADF]' : 'border-[#FDE2E1]'"
            />
          </template>
        </Column>
        <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #body="slotProps">
            <CustomButton icon="PhPlus" size="small" :disabled="!slotProps.data.terpetakan" @click="tambahKeKeranjang(slotProps.data)" />
          </template>
        </Column>
      </DataTable>
    </template>
  </Card>

  <CustomDialog :visible="dialogAjukanTampil" @update:visible="(v: boolean) => (dialogAjukanTampil = v)" width="650px">
    <template #header>Ajukan Permintaan Pembelian Marketplace</template>
    <template #body>
      <div class="flex flex-col gap-3">
        <DataTable :value="keranjang" stripedRows class="text-xs">
          <Column header="Produk">
            <template #body="slotProps">{{ slotProps.data.nama }}</template>
          </Column>
          <Column header="Jumlah" style="width: 120px">
            <template #body="slotProps">
              <CustomInputNumber :showLabel="false" :show-buttons="true" v-model="slotProps.data.jumlah" :min="1" />
            </template>
          </Column>
          <Column header="Harga Satuan">
            <template #body="slotProps">{{ formatPrice(slotProps.data.harga) }}</template>
          </Column>
          <Column header="">
            <template #body="slotProps">
              <CustomButton icon="PhTrash" size="small" text-color="text-danger-300" border-color="border-danger-300" outlined @click="hapusDariKeranjang(slotProps.data.produkMitraId)" />
            </template>
          </Column>
        </DataTable>
        <div class="text-right font-semibold">Total Perkiraan: {{ formatPrice(totalKeranjang) }}</div>
        <div class="grid grid-cols-2 gap-3">
          <CustomSelect label="Jenis Stok" placeHolder="Pilih Jenis Stok" v-model="form.jenisStokUuid" :options="stockTypeOptions" optionLabel="name" optionValue="uuid" required />
          <CustomSelect label="Lokasi Stok" placeHolder="Pilih Lokasi Stok" v-model="form.lokasiStokUuid" :options="stockLocationOptions" optionLabel="name" optionValue="uuid" required />
          <CustomSelect label="Kategori Item" v-model="form.kategoriItem" :options="opsiKategoriItem" optionLabel="name" optionValue="value" />
          <CustomSelect label="Jenis Item" v-model="form.jenisItem" :options="opsiJenisItem" optionLabel="name" optionValue="value" />
          <CustomSelect label="Metode Pembelian" v-model="form.metodePembelian" :options="opsiMetodePembelian" optionLabel="name" optionValue="value" />
        </div>
        <CustomTextfield label="Catatan" v-model="form.catatan" placeholder="Catatan untuk pejabat berwenang (opsional)" />
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <CustomButton label="Batal" text-color="text-opensimrs-300" border-color="border-opensimrs-300" outlined @click="dialogAjukanTampil = false" />
        <CustomButton label="Ajukan Permintaan" @click="ajukanPermintaan" />
      </div>
    </template>
  </CustomDialog>

  <CustomDialog :visible="dialogKonfigurasiTampil" @update:visible="(v: boolean) => (dialogKonfigurasiTampil = v)" width="550px">
    <template #header>Konfigurasi Koneksi Marketplace</template>
    <template #body>
      <div class="flex flex-col gap-3">
        <CustomTextfield label="Kode Mitra" v-model="konfigurasiForm.mitraKode" placeholder="mis. MITRA-DEMO" required />
        <CustomTextfield label="Nama Mitra" v-model="konfigurasiForm.namaMitra" placeholder="mis. Marketplace Tiruan" required />
        <CustomTextfield label="URL Mitra" v-model="konfigurasiForm.baseUrl" placeholder="http://localhost:2414" required />
        <CustomTextfield label="Akun/Afiliasi" v-model="konfigurasiForm.akunAfiliasi" placeholder="opsional" />
        <CustomSelect label="Supplier (Datamaster)" placeHolder="Pilih Supplier" v-model="konfigurasiForm.supplierUuid" :options="daftarSupplierAktif" optionLabel="name" optionValue="uuid" required />
        <CustomTextfield label="API Key" v-model="konfigurasiForm.apiKey" :placeholder="apiKeySamaran ? `Tersimpan (${apiKeySamaran}) — kosongkan bila tidak diubah` : 'API key dari mitra'" />
        <div class="flex gap-6">
          <CustomSwitch label="Mode Mock" v-model="konfigurasiForm.modeMock" />
          <CustomSwitch label="Aktif" v-model="konfigurasiForm.aktif" />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <CustomButton label="Batal" text-color="text-opensimrs-300" border-color="border-opensimrs-300" outlined @click="dialogKonfigurasiTampil = false" />
        <CustomButton label="Simpan" @click="simpanKonfigurasi" />
      </div>
    </template>
  </CustomDialog>
</template>
