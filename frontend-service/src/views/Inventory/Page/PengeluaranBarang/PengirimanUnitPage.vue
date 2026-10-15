<script setup lang="ts">
import { onBeforeRouteLeave, useRoute } from "vue-router";
import HeaderPengeluaranBarang from "../../Layout/HeaderPengeluaranBarang.vue";
import { computed, onMounted, ref } from "vue";
import type { MenuItem } from "primevue/menuitem";
import CustomButton from "@/components/Base/CustomButton.vue";
import Paginator from "primevue/paginator";
import Permintaan from "@/views/Inventory/Page/PengeluaranBarang/Tabel/PengirimanUnit/Permintaan.vue";
import DetailPengirimanUnit from "./VerifikasiPengirimanUnit/DetailPengirimanUnit.vue";
import VerifikasiPengiriman from "./Tabel/PengirimanUnit/VerifikasiPengiriman.vue";
import Dikirim from "./Tabel/PengirimanUnit/Dikirim.vue";
import Ditolak from "./Tabel/PengirimanUnit/Ditolak.vue";

const route = useRoute();
const value = ref("1");

const pageType = ref("");
const dataBreadCrumb = ref<MenuItem[]>([{}]);
const pengirimanUnitData = ref<any | null>(null);

const detailPengirimanUnit = ref();

const updatePageType = (path: string) => {
  dataBreadCrumb.value = [];
  let tempArrPath = path.split("/");
  pageType.value = tempArrPath[3] ?? "";
  dataBreadCrumb.value = [
    {
      label:
        pageType.value == "verifikasi-pengiriman-unit"
          ? "Verifikasi & Pengiriman Unit"
          : "",
    },
  ];
  //   console.log(pageType.value);
};

const changeSection = (label: string, data: any = null) => {
  dataBreadCrumb.value = [{ label }]; // Pastikan ini direset
  if (data) {
    detailPengirimanUnit.value = data; // Simpan data detail
  }
};

onBeforeRouteLeave((to, from) => {
  updatePageType(to.path);
});

onMounted(() => {
  updatePageType(route.path);
  pengirimanUnitData.value = [
    {
      tglPermintaan: "01-01-2024",
      noPengeluaran: "PGL1234",
      kategori: "Medis",
      jenisStok: "Umum",
      jenisItem: "Obat",
      isCito: true,
      tujuanPermintaan: "Gudang Farmasi",
      petugasVerifikasi: "Nama Petugas",
      status: "PENGAJUAN",
      catatan: "-",
      datas: [
        {
          namaItems: "Paracetamol",
          minStok: 1,
          maxStok: 0,
          stokKetikaPermintaan: 3000,
          satuan: "Box/100",
          jumlahPermintaan: 1,
          pengiriman: 1,
        },
        {
          namaItems: "Kasa",
          minStok: 2,
          maxStok: 0,
          stokKetikaPermintaan: 3000,
          satuan: "Box/100",
          jumlahPermintaan: 2,
          pengiriman: 1,
        },
      ],
    },
  ];
});

// Saat sudah dibatalkan dari page DetailPengirimanUnit
const penolakanData = (updatedData: any) => {
  if (pengirimanUnitData.value) {
    // Find the index of the item you want to update
    const index = pengirimanUnitData.value.findIndex(
      (item: any) => item.noPembelian === updatedData.noPembelian
    );
    console.log(index);
    if (index !== -1) {
      // Update the existing item
      pengirimanUnitData.value[index] = updatedData;
      dataBreadCrumb.value[0].label = "Verifikasi & Pengiriman Unit";
    }
  }
};

// Hanya menampilkan pengajuan saat di tabs Pengajuan Pembelian
const pengajuanPengirimanData = computed(() => {
  return (
    pengirimanUnitData.value?.filter(
      (item: any) => item.status === "PENGAJUAN"
    ) || []
  );
});
const diverifikasiPengirimanData = computed(() => {
  return (
    pengirimanUnitData.value?.filter(
      (item: any) => item.status === "DIVERIFIKASI"
    ) || []
  );
});
const dikirimData = computed(() => {
  return (
    pengirimanUnitData.value?.filter(
      (item: any) => item.status === "DIKIRIM"
    ) || []
  );
});
const tolakPengirimanData = computed(() => {
  return (
    pengirimanUnitData.value?.filter(
      (item: any) => item.status === "DITOLAK"
    ) || []
  );
});

const updateStatusVerifikasi = (selectedData: any[]) => {
  selectedData.forEach((item) => {
    const pengiriman = pengirimanUnitData.value.find((pengiriman: any) =>
      pengiriman.datas.some((data: any) => data.namaItems === item.namaItems)
    );

    if (pengiriman) {
      pengiriman.status = "DIVERIFIKASI";
      dataBreadCrumb.value[0].label = "Verifikasi & Pengiriman Unit";
    }
  });
};

// Saat Klik Kirim Barang dari DetailPengirimanUnit
const updateStatusKirim = (detailPengirimanData: any, catatanPengiriman: string) => {

  if (pengirimanUnitData.value) {
    const index = pengirimanUnitData.value.findIndex(
      (item: any) => item.noPengeluaran === detailPengirimanData.noPengeluaran
    );

    if (index !== -1) {
      pengirimanUnitData.value[index].status = "DIKIRIM"
      pengirimanUnitData.value[index].catatanPengiriman = catatanPengiriman;
    } else {
      pengirimanUnitData.value.push({
        ...detailPengirimanData,
        catatanPengiriman, // Add new property
      });
    }
    dataBreadCrumb.value[0].label = "Verifikasi & Pengiriman Unit";
  }
};
</script>

<template>
  <!-- {{ pengirimanUnitData }} -->
  <Card
    v-if="dataBreadCrumb[0].label == 'Verifikasi & Pengiriman Unit'"
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <HeaderPengeluaranBarang
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
      >
        <template #tabs>
          <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Status pengiriman">
            <CustomButton
              label="PERMINTAAN"
              :text-color="value === '1' ? 'text-white' : 'text-opensimrs-300'"
              :border-color="
                value === '1' ? 'border-none' : 'border-opensimrs-300'
              "
              :class="value === '1' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="value = '1'"
              :outlined="value !== '1'"
            />
            <CustomButton
              label="VERIFIKASI"
              :text-color="value === '2' ? 'text-white' : 'text-opensimrs-300'"
              :border-color="
                value === '2' ? 'border-none' : 'border-opensimrs-300'
              "
              :class="value === '2' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="value = '2'"
              :outlined="value !== '2'"
            />
            <CustomButton
              label="DIKIRIM"
              :text-color="value === '3' ? 'text-white' : 'text-opensimrs-300'"
              :border-color="
                value === '3' ? 'border-none' : 'border-opensimrs-300'
              "
              :class="value === '3' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="value = '3'"
              :outlined="value !== '3'"
            />
            <CustomButton
              label="DITOLAK"
              :text-color="value === '4' ? 'text-white' : 'text-opensimrs-300'"
              :border-color="
                value === '4' ? 'border-none' : 'border-opensimrs-300'
              "
              :class="value === '4' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="value = '4'"
              :outlined="value !== '4'"
            />
          </div>
        </template>
      </HeaderPengeluaranBarang>
    </template>
    <template #content>
      <Tabs v-model:value="value">
        <TabPanels>
          <TabPanel value="1">
            <Permintaan
              :permintaan-data="pengajuanPengirimanData"
              @row-clicked="changeSection('Detail Pengiriman', $event)"
            />
          </TabPanel>
          <TabPanel value="2">
            <VerifikasiPengiriman
              :verifikasi-data="diverifikasiPengirimanData"
              @row-clicked="changeSection('Detail Pengiriman', $event)"
            />
          </TabPanel>
          <TabPanel value="3">
            <Dikirim :dikirim-data="dikirimData" @row-clicked="changeSection('Detail Pengiriman', $event)"
            />
          </TabPanel>
          <TabPanel value="4">
            <Ditolak :ditolak-data="tolakPengirimanData" @row-clicked="changeSection('Detail Pengiriman', $event)"
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <Paginator
          :rows="10"
          :totalRecords="120"
          :rowsPerPageOptions="[10, 20, 30]"
          template="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
          currentPageReportTemplate="{currentPage}"
        >
          <template #start="slotProps">Total Data: 0</template>
        </Paginator>
      </div>
    </template>
  </Card>

  <DetailPengirimanUnit
    :data-bread-crumb="dataBreadCrumb"
    :page-type="pageType"
    :detail-pengiriman-data="detailPengirimanUnit"
    v-else-if="dataBreadCrumb[0].label == 'Detail Pengiriman'"
    @kembali="dataBreadCrumb[0].label = 'Verifikasi & Pengiriman Unit'"
    @penolakan="penolakanData"
    @verifikasi-pengiriman="updateStatusVerifikasi"
    @kirim-barang="updateStatusKirim"
  />
</template>
