<script setup lang="ts">
import { ref, computed, watch } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import FPOEditDialog from "./FPOEditDialog.vue";

const props = defineProps({
  fpoData: {
    type: Array as () => any[],
    default: () => [],
  },
  recordDate: {
    type: String,
    default: "",
  },
});

const pemberianObat = computed(() => props.fpoData);

const isEditDataDialogVisible = ref(false);
const getSessionCounts = (obat: any) => {
  const sessions = [
    { code: 'PA', key: 'pagi' },
    { code: 'SI', key: 'siang' },
    { code: 'SO', key: 'sore' },
    { code: 'MA', key: 'malam' },
    { code: 'KH', key: 'khusus' },
  ];

  return sessions.map(session => {
    const count = obat.jadwal?.[session.key]?.jumlahPemberian || 0;
    return {
      code: session.code,
      count: count
    };
  });
};
const emit = defineEmits(['refresh-data']);

const dialogConfig = ref<any>({
  method: "add",
  title: "Tambah Data",
  date: "",
  noResep: "",
});

const openDialog = (data: any = null, noResep: string = "") => {
  dialogConfig.value = { data, date: props.recordDate, noResep: noResep, };
  isEditDataDialogVisible.value = true;
};
const closeDialog = () => {
  isEditDataDialogVisible.value = false;
};

const accordion = ref<any[]>([]); 

const handleDataUpdated = () => {
  emit('refresh-data');
};


defineExpose({
});

watch(
  () => props.fpoData,
  (newData) => {
    if (isEditDataDialogVisible.value && dialogConfig.value.data?.uuid) {
      const currentUuid = dialogConfig.value.data.uuid;
      for (const item of newData) {
        if (item.obat && Array.isArray(item.obat)) {
          const updatedObat = item.obat.find((o: any) => o.uuid === currentUuid);
          if (updatedObat) {
            dialogConfig.value.data = updatedObat;
            break;
          }
        }
      }
    }
  },
  { deep: true }
);
</script>

<template>
  <div>
    <CustomAccordion
      v-for="(item, itemIndex) in pemberianObat"
      :key="itemIndex"
      header-class="bg-opensimrs-50"
      initial-state="0"
      ref="accordion"
      class="mb-4"
    >
      <template #header>
        {{ item.noResep }}
      </template>
      <template #content>
        <div class="grid grid-cols-2 gap-5 pt-5">
          <div v-for="(obat, obatIndex) in item.obat" :key="obatIndex">
            <Card
              pt:root:class="border rounded-lg border-opensimrs-300"
              pt:body:class="h-full p-5"
              @click="openDialog(obat, item.noResep)"
              class="cursor-pointer"
            >
              <template #content>
                <div class="flex justify-between">
                  <div class="flex gap-2.5">
                    <CustomButton
                      :label="(obatIndex + 1).toString()"
                      class="h-6 p-3 rounded"
                    />
                    <div class="flex flex-col gap-2.5">
                      <div class="font-bold text-MD">
                        {{ obat.itemMedis?.name }}
                      </div>
                      <div class="flex items-center gap-2.5 text-SM">
                        {{ obat.aturanPakai?.name }}
                        <span
                          ><img src="@/assets/icons/Vector-arows.svg"
                        /></span>
                        {{ obat.medicationDoseQty }}
                        {{ obat.satuanDosis?.name }}
                      </div>
                      <div class="flex items-center gap-2.5 text-SM">
                        Jml. Order
                        <span
                          ><img src="@/assets/icons/Vector-arows.svg"
                        /></span>
                        {{ obat.medicationQty }}
                        {{ obat.itemMedis?.satuanPenggunaan?.name }}
                      </div>
                      <CustomChip
                        :label="obat.caraPakai?.caraPakai"
                        :showCheckedIcon="false"
                        border-color="border-opensimrs-300"
                        bg-color="bg-opensimrs-50"
                        text-color="text-opensimrs-300"
                        customClass="text-xs font-semibold cursor-auto h-5 max-w-fit"
                      />
                    </div>
                  </div>
                  <div class="flex flex-col items-end justify-between">
                    <div class="font-semibold underline text-SM">
                      Dokter Pemberi Resep
                    </div>
                    <div class="text-SM text-grey-400">
                      {{ item.dokterOrder }}
                    </div>
                    <div class="text-SM flex gap-2.5">
                      <div
                        v-for="session in getSessionCounts(obat)"
                        :key="session.code"
                        class="flex max-w-fit h-[20px] items-center border border-opensimrs-300 rounded-[4px] overflow-hidden"
                      >
                        <div
                          class="w-full h-full px-2 font-semibold text-white bg-opensimrs-300"
                        >
                          {{ session.code }}
                        </div>
                        <div class="px-2 text-opensimrs-300">
                          {{ session.count }}
                        </div>
                      </div>
                    </div>
                    <div class="text-SM">
                      Sisa Obat
                      <span class="font-bold"
                        >({{ obat.sisaQtyOrder }}
                        {{ obat.itemMedis?.satuanPenggunaan?.name }})</span
                      >
                    </div>
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </div>
      </template>
    </CustomAccordion>

    <FPOEditDialog
      v-model:isDialogVisible="isEditDataDialogVisible"
      :payload="dialogConfig.data"
      :recordDate="dialogConfig.date"
      :noResep="dialogConfig.noResep"
      @data-updated="handleDataUpdated"
      @close="closeDialog"
    />
  </div>
</template>