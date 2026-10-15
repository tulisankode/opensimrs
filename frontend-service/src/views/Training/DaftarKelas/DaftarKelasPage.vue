<script setup lang="tsx">
import { ref } from "vue";
import type { MenuItem } from "primevue/menuitem";

import CustomChip from "@/components/Base/CustomChip.vue";
import HeaderFilterTraining from "../Layout/HeaderFilterTraining.vue";
import FooterPaginationTraining from "../Layout/FooterPaginationTraining.vue";
import FormDaftarKelas from "./FormDaftarKelas.vue";
const itemsPasien = ref([
  {
    noOrder: "TRN1234",
    noreg: "REG2407010049",
    name: "Nama Pasien Lengkap",
    gender: "L",
    phone: "080000000000",
    ageYear: 10,
    ageMonth: 3,
    ageDay: 5,
    address: "Jl. Dipatiukur, Lebak Gede, Bandung City, West Java",
    noRM: "00-00-00",
    paymentMethod: "tunai",
    tanggalKelas: "10-10-2024",
    kelas: "Gym",
    kelasSesi: "Sesi 1",
    orderStatus: "Lunas",
    slot: "02",
    new_patient: true,
  },
  {
    noOrder: "TRN1234",
    noreg: "REG2407010049",
    name: "Nama Pasien Lengkap",
    gender: "L",
    phone: "080000000000",
    ageYear: 10,
    ageMonth: 3,
    ageDay: 5,
    address: "Jl. Dipatiukur, Lebak Gede, Bandung City, West Java",
    noRM: "00-00-00",
    paymentMethod: "tunai",
    tanggalKelas: "10-10-2024",
    kelas: "Gym",
    kelasSesi: "Sesi 1",
    orderStatus: "Lunas",
    slot: "02",
    new_patient: true,
  },
  {
    noOrder: "TRN1234",
    noreg: "REG2407010049",
    name: "Nama Pasien Lengkap",
    gender: "L",
    phone: "080000000000",
    ageYear: 10,
    ageMonth: 3,
    ageDay: 5,
    address: "Jl. Dipatiukur, Lebak Gede, Bandung City, West Java",
    noRM: "00-00-00",
    paymentMethod: "tunai",
    tanggalKelas: "10-10-2024",
    kelas: "Gym",
    kelasSesi: "Sesi 1",
    orderStatus: "Lunas",
    slot: "02",
    new_patient: false,
  },
  {
    noOrder: "TRN1234",
    noreg: "REG2407010049",
    name: "Nama Pasien Lengkap",
    gender: "L",
    phone: "080000000000",
    ageYear: 10,
    ageMonth: 3,
    ageDay: 5,
    address: "Jl. Dipatiukur, Lebak Gede, Bandung City, West Java",
    noRM: "00-00-00",
    paymentMethod: "tunai",
    tanggalKelas: "10-10-2024",
    kelas: "Gym",
    kelasSesi: "Sesi 1",
    orderStatus: "Lunas",
    slot: "02",
    new_patient: true,
  },
]);
const selectedPatient = ref([]);

const showCancelVisit = ref(false);
const cancelReason = ref<string | undefined>();
const toggleCancelVisit = () => {
  showCancelVisit.value = !showCancelVisit.value;
};

const confirmCancel = () => {
  if (!cancelReason.value) {
    return;
  }
  // Logic for confirming cancelation
  showCancelVisit.value = false;
  cancelReason.value = undefined;
};

const dataBreadCrumb = ref<MenuItem[]>([]);

const changeSection = (label: string, data: any = null) => {
  let tempData = { label: label };
  if (data) {
    tempData = { ...tempData, ...data };
  }
  if (dataBreadCrumb.value.length) {
    dataBreadCrumb.value[0] = tempData;
  } else {
    dataBreadCrumb.value.push(tempData);
  }
};
const selectedTab = ref("0");
const handleSelectedTab = (newTab: string) => {
  selectedTab.value = newTab;
};

</script>
<template>
  <Card
    v-if="dataBreadCrumb.length == 0"
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <HeaderFilterTraining
        page-type="daftar"
        @tambah-data="changeSection('Daftar')"
        @selected-tab="handleSelectedTab"
      />
    </template>
    <template #content>
      <DataTable
        :value="itemsPasien"
        tableStyle="min-width: 50rem"
        v-model:selection="selectedPatient"
        scrollable
        scrollHeight="flex"
        :pt="{ headerRow: 'text-SM' }"
        stripedRows
      >
        <Column field="nomor" headerClass="bg-opensimrs-50">
          <template #header>
            <div class="w-full font-semibold text-center">Nomor</div>
          </template>
          <template #body="slotProps">
            <div class="text-center">
              <div class="text-SM">{{ slotProps.data.noRM }}</div>
              <div class="text-SM">{{ slotProps.data.noreg }}</div>
              <div class="text-SM">{{ slotProps.data.noOrder }}</div>
            </div>
          </template>
        </Column>
        <Column field="pasien" header="Pasien" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            <div class="text-SM">
              <span class="font-semibold">{{ slotProps.data.name }}</span>
              <span class="text-grey-300">
                ({{ slotProps.data.ageYear }}Th {{ slotProps.data.ageMonth }}Bln
                {{ slotProps.data.ageDay }}Hr)
              </span>
            </div>
            <div class="text-XS">{{ slotProps.data.address }}</div>
            <div class="flex flex-wrap">
              <PhUserCirclePlus
                v-if="slotProps.data.new_patient"
                :size="22"
                class="text-opensimrs-300 mt-auto mr-[5px]"
                weight="fill"
              />
              <CustomChip
                :showCheckedIcon="false"
                :label="
                  slotProps.data.gender == 'P' ? 'Perempuan' : 'Laki-laki'
                "
                :bgColor="
                  slotProps.data.gender == 'P' ? 'bg-female-75' : 'bg-male-75'
                "
                :textColor="
                  slotProps.data.gender == 'P'
                    ? 'text-female-300'
                    : 'text-male-300'
                "
                customClass="h-5 pr-[6px] border-none mr-[5px]"
              />
              <CustomChip
                :showCheckedIcon="false"
                :label="slotProps.data.phone"
                bgColor="bg-opensimrs-75"
                textColor="text-opensimrs-300"
                customClass="h-5 pr-[6px] border-none mr-[5px]"
              />
            </div>
          </template>
        </Column>
        <Column header="Kelas" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            <div class="flex mb-[5px] text-SM">
              <div>{{ slotProps.data.kelas }}</div>
            </div>
            <div class="flex flex-wrap">
              <CustomChip
                :showCheckedIcon="false"
                :label="
                  slotProps.data.paymentMethod == 'tunai' ? 'TUNAI' : 'ASURANSI'
                "
                :bgColor="
                  slotProps.data.paymentMethod == 'tunai'
                    ? 'bg-opensimrs-50'
                    : 'bg-warning-50'
                "
                :textColor="
                  slotProps.data.paymentMethod == 'tunai'
                    ? 'text-opensimrs-300'
                    : 'text-warning-300'
                "
                :borderColor="
                  slotProps.data.paymentMethod == 'tunai'
                    ? 'border-opensimrs-300'
                    : 'border-warning-300'
                "
                customClass="h-5 pr-[6px] mr-[5px]"
              />
              <CustomChip
                :showCheckedIcon="false"
                :label="
                  slotProps.data.paymentMethod == 'tunai' ? 'TUNAI' : 'ASURANSI'
                "
                :bgColor="
                  slotProps.data.paymentMethod == 'tunai'
                    ? 'bg-opensimrs-50'
                    : 'bg-warning-50'
                "
                :textColor="
                  slotProps.data.paymentMethod == 'tunai'
                    ? 'text-opensimrs-300'
                    : 'text-warning-300'
                "
                :borderColor="
                  slotProps.data.paymentMethod == 'tunai'
                    ? 'border-opensimrs-300'
                    : 'border-warning-300'
                "
                customClass="h-5 pr-[6px] mr-[5px]"
              />
            </div>
          </template>
        </Column>
        <Column field="kelasSesi" header="Sesi" headerClass="bg-opensimrs-50" body-class="text-SM font-normal" >
        </Column>
        <Column
          field="data-kunjungan"
          header="Data Kunjung"
          headerClass="bg-opensimrs-50"
          style="width: 25%"
        >
          <template #body="slotProps">
            <div class="text-SM">
              <div
                class="grid content-center grid-cols-[80px_min-content_150px] auto-cols-min"
              >
                Jadwal
                <ArrowRightBrokenIcon
                  :size="18"
                  class="my-auto mr-5 text-grey-300"
                  weight="bold"
                />
                {{ slotProps.data.tanggalKelas }}
              </div>
              <div
                class="grid content-center grid-cols-[80px_min-content_150px] mt-[5px]"
              >
                Slot
                <ArrowRightBrokenIcon
                  :size="18"
                  class="my-auto mr-5 text-male-300"
                  weight="bold"
                />
                {{ slotProps.data.slot }}
              </div>
            </div>
          </template>
        </Column>

        <Column
          v-if="showCancelVisit"
          selectionMode="multiple"
          headerStyle="width: 3rem"
          headerClass="bg-opensimrs-50"
          class="custom-checkbox"
        ></Column>
      </DataTable>
      <MedicalRecord ref="medicalRecord" />
    </template>
    <template #footer>
      <FooterPaginationTraining
        cancleButton
        :value-cancle="cancelReason"
        :show-cancel-visit="showCancelVisit"
        :cancel-reason="cancelReason"
        @toggle-cancel-visit="toggleCancelVisit"
        @confirm-cancel="confirmCancel"
        @update:valueCancle="cancelReason = $event"
      />
    </template>
  </Card>
  <FormDaftarKelas v-else-if="dataBreadCrumb[0].label == 'Daftar'" @back="dataBreadCrumb.pop()" />
</template>
