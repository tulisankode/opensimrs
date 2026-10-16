<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";
import { computed, ref, watch, type PropType } from "vue";
import { useLisStore } from "@/stores/Laboratorium/lis";
import { useToast } from "primevue/usetoast";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { cetakHasilLabOrder } from "@/utils/pdf/pdfLaboratorium/cetakHasilLabOrder";
import DataPasien from "../Section/HasilPemeriksaan/DataPasien.vue";
import AsesmenMedis from "../Section/HasilPemeriksaan/AsesmenMedis.vue";
import ListOrder from "../Section/HasilPemeriksaan/ListOrder.vue";
import Catatan from "../Section/HasilPemeriksaan/Catatan.vue";
import CatatanExpertise from "../Section/HasilPemeriksaan/CatatanExpertise.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { epochToDate, dateToEpoch, formatPrice } from "@/utils/Helpers";
import { useHasilPemeriksaanLab } from "@/stores/Laboratorium/hasilPemeriksaan";
import { utilsStore } from "@/stores/utils";

// No. Lab dari LIS (hasil registrasi bridging) — kunci pencocokan saat LIS mengirim hasil.
const lisStore = useLisStore();
const noLabLis = ref("");
const muatNoLab = async (uuid?: string) => {
  noLabLis.value = "";
  if (!uuid) return;
  const res = await lisStore.statusKirimOrder(uuid).catch(() => null);
  noLabLis.value = (res?.payload ?? []).find((k: any) => k.status === "terkirim" && k.lisNoLab)?.lisNoLab ?? "";
};

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  formType: {
    type: String,
    default: "",
  },
  isDetail: {
    type: Boolean,
    required: false,
  },
  openedPatientData: {
    type: Object as PropType<any>,
    required: true,
  },
});
const storeUtils = utilsStore();
const hasilPemeriksaanStore = useHasilPemeriksaanLab();

const listOrderForm = ref<InstanceType<typeof ListOrder> | null>(null);
const listCatatanForm = ref<InstanceType<typeof Catatan> | null>(null);

const isOrderStatus = computed(() => {
  return props.openedPatientData?.orderStatus === 3;
});

const isDataSaved = ref(false);
const isAllStatusPeriksaTrue = computed(() => {
  return (
    isDataSaved.value ||
    (props.openedPatientData?.hasilPemeriksaan?.length &&
      props.openedPatientData.hasilPemeriksaan.every(
        (item: any) => item.statusPeriksa === true
      ))
  );
});

const postSimpanHasil = async () => {
  storeUtils.setLoading(true);
  try {
    if (!listOrderForm.value) {
      throw new Error("Form reference is missing");
    }
    let tempCatatanData: any;
    let tempListOrderData: any;

    tempCatatanData = listCatatanForm.value
      ? await listCatatanForm.value.onSubmit()
      : null;
    tempListOrderData = await listOrderForm.value.onSubmit();
    let payload: any = {
      ...tempCatatanData,
      ...tempListOrderData,
    };

    console.log("RESULT:", payload);
    const response = await hasilPemeriksaanStore.postApi(payload as {});
    if (response && response.data) {
      isDataSaved.value = true;
      emit("fetchHasil");
    }
  } catch (error) {
    console.error("Save error:", error);
    isDataSaved.value = false;
  } finally {
    storeUtils.setLoading(false);
  }
};

const selesaiPeriksa = async () => {
  storeUtils.setLoading(true);
  try {
    const patientData = { ...props.openedPatientData };
    if (patientData.spesimenUuids === null) {
      patientData.spesimenUuids = [];
    }
    patientData.orderStatus = 3;
    const response = await hasilPemeriksaanStore.putSelesaiPeriksa(
      props.openedPatientData.uuid,
      patientData
    );
    if (response && response.data) {
      popupDialog.value = false;
      emit("back");
      emit("fetchHasil");
    }
  } catch (error) {
    console.error("Failed to Selesai Periksa:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const emit = defineEmits(["back", "goToDetail", "goToEdit", "fetchHasil", "muatUlang"]);

// Ambil hasil dari LIS (GET endpoint hasil koneksi LIS) → hasil tersimpan, detail dimuat ulang.
const toast = useToast();
const ambilHasilLis = async () => {
  const uuid = props.openedPatientData?.uuid;
  if (!uuid) return;
  storeUtils.setLoading(true);
  try {
    const res: any = await lisStore.tarikHasil(uuid);
    if (!res) return;
    if (res.gagal) return toast.add({ severity: "warn", summary: "Ambil hasil LIS gagal", detail: res.message, life: 7000 });
    const p = res.payload ?? {};
    const tidak = (p.tidakTerpetakan ?? []).map((t: any) => `${t.kode ?? "-"} (${t.nama ?? "-"})`).join(", ");
    toast.add({
      severity: tidak ? "warn" : "success",
      summary: res.message ?? "Hasil LIS diambil",
      detail: tidak ? `Tidak cocok dengan item: ${tidak} — atur di Laboratorium › Mapping LIS › Hasil Pemeriksaan.` : undefined,
      life: tidak ? 9000 : 4000,
    });
    emit("muatUlang");
  } finally {
    storeUtils.setLoading(false);
  }
};
const popupDialog = ref(false);
watch(() => props.openedPatientData?.uuid, (u) => muatNoLab(u), { immediate: true });
</script>

<template>
  <div class="relative w-full h-full overflow-hidden">
    <Card class="h-min mb-[10px] absolute top-0 right-0 left-0">
      <template #content>
        <div class="flex justify-between">
          <CustomBreadCrumb
            :home="{
              label: 'Hasil Pemeriksaan',
              home: true,
            }"
          />
          <div class="flex">
            <div v-if="noLabLis" class="flex items-center mr-[30px] mt-2 gap-3">
              <div class="bg-opensimrs-300 w-[1px] h-[30px]"></div>
              <p class="text-sm">No. Lab LIS : <b>{{ noLabLis }}</b></p>
              <CustomButton
                v-if="!isOrderStatus"
                label="Ambil Hasil LIS"
                icon="PhDownloadSimple"
                size="small"
                @click="ambilHasilLis"
              />
            </div>
            <div class="flex mr-[30px] mt-2">
              <div class="bg-opensimrs-300 w-[1px] h-[30px]"></div>
              <p class="text-sm ml-[10px] mt-[3px]">
                Tgl. Order :
                {{
                  epochToDate(
                    parseInt(openedPatientData.tglOrder) / 1000,
                    "date"
                  )
                }}
              </p>
            </div>
            <CustomButton
              @click="emit('back')"
              icon="PhCaretLeft"
              label="Kembali"
              outlined
              borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300"
            />
          </div>
        </div>
      </template>
    </Card>
    <div class="relative h-full overflow-auto top-[90px] pb-[180px]">
      <DataPasien
        class="mt-2"
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
        :openedPatientData="openedPatientData"
        @back="dataBreadCrumb.pop()"
      />
      <AsesmenMedis
        class=""
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
        :openedPatientData="openedPatientData"
        @back="dataBreadCrumb.pop()"
      />

      <ListOrder
        ref="listOrderForm"
        class=""
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
        :openedPatientData="openedPatientData"
        @back="dataBreadCrumb.pop()"
        @muat-ulang="emit('muatUlang')"
      />
      <Catatan
        ref="listCatatanForm"
        class=""
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
        :openedPatientData="openedPatientData"
        @back="dataBreadCrumb.pop()"
      />
      <CatatanExpertise
        class=""
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
        :openedPatientData="openedPatientData"
        @back="dataBreadCrumb.pop()"
      />
    </div>

    <Card class="absolute inset-x-0 bottom-0">
      <template #footer>
        <div class="flex justify-between">
          <CustomButton
            @click="() => {}"
            icon="PhPrinter"
            label="Cetak Label"
            class="mr-[10px]"
            backgroundColor="bg-opensimrs-300"
          />
          <CustomButton
            v-if="isOrderStatus"
            icon="PhFileText"
            label="Cetak Hasil"
            backgroundColor="bg-opensimrs-300"
            @click="cetakHasilLabOrder(props.openedPatientData?.uuid)"
          />
          <div class="flex gap-3" v-if="!isOrderStatus">
            <CustomButton
              label="Simpan Hasil"
              outlined
              borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300"
              @click="postSimpanHasil()"
            />
            <CustomButton
              label="Selesai"
              class=""
              backgroundColor="bg-opensimrs-300"
              :disabled="!isAllStatusPeriksaTrue"
              @click="popupDialog = true"
            />
          </div>
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="popupDialog" width="700px">
      <template #header>
        <div class="flex text-heading">Selesai Pemeriksaan</div>
      </template>
      <template #body>
        <div>
          <div class="pt-5 mb-20">
            <p class="mb-5 text-warning-300">
              Pastikan sudah melakukan pengecekan (verifikasi) pada hasil
              Laboratorium.
            </p>
            <p>
              Setelah
              <span class="font-bold">Selesai</span>, hasil pemeriksaan lab
              <span class="font-bold">tidak dapat</span> diubah / update
              kembali.
            </p>
            <!-- <hr class="mt-3 border-[0.2px] border-grey-200" /> -->
          </div>
        </div>

        <Card class="absolute inset-x-0 bottom-0">
          <template #footer>
            <hr class="mb-3 border-gray-300" />
            <div class="flex justify-end">
              <CustomButton
                label="Tidak"
                class="mr-[10px]"
                outlined
                borderColor="border-grey-200"
                textColor="text-grey-300"
                @click="popupDialog = false"
              />

              <CustomButton
                label="Iya, Selesai"
                class=""
                backgroundColor="bg-opensimrs-300"
                @click="selesaiPeriksa"
              />
            </div>
          </template>
        </Card>
      </template>
    </CustomDialog>
  </div>
</template>
