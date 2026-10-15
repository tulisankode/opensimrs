<script lang="ts" setup>
import { ref } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";

const itemsMonitoringRiwayatKunjungan = ref([
  {
    noPendaftaran: "00-00-00",
    name: "Nama Pasien Lengkap",
    jenisPelayanan: "Rawat Jalan",
    polyclinic: "POLI ANAK",
    tipeDiagnosa: "Diagnosa",
    BPJSClass: "Kelas 3",
    no_SEP: "1234567891234567",
    tanggalAktivasiBPJS: "01-01-2024 08:00",
    noRujukan: "123456",
    tglDischarge: "01-01-2024",
    jamDischarge: "10:00",
    PpkPelayanan: "-",
  },
  {
    noPendaftaran: "00-00-00",
    name: "Nama Pasien Lengkap",
    jenisPelayanan: "Rawat Inap",
    polyclinic: "POLI UMUM",
    tipeDiagnosa: "Diagnosa",
    BPJSClass: "Kelas 1",
    no_SEP: "1234567891234567",
    tanggalAktivasiBPJS: "01-01-2024 08:00",
    noRujukan: "123456",
    tglDischarge: "02-01-2024",
    jamDischarge: "09:00",
    PpkPelayanan: "-",
  },
]);
</script>
<template>
  <DataTable
    v-if="itemsMonitoringRiwayatKunjungan.length"
    :value="itemsMonitoringRiwayatKunjungan"
    tableStyle="min-width: 50rem"
    scrollable
    stripedRows
    scrollHeight="flex"
    :pt="{ headerRow: 'text-SM' }"
  >
    <Column field="no" headerClass="bg-opensimrs-50" header="No" class="w-[40px]">
      <template #body="slotProps">
        <div class="w-full text-center text-SM">
          {{ slotProps.index + 1 }}
        </div>
      </template>
    </Column>
    <Column
      field="pasien"
      header="Pasien"
      headerClass="bg-opensimrs-50"
      class="w-[300px]"
    >
      <template #body="slotProps">
        <div class="text-SM">
          <div class="font-semibold">{{ slotProps.data.name }}</div>
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.noPendaftaran"
            bgColor="bg-opensimrs-300"
            textColor="text-white"
            customClass="h-5 pr-[6px] border-none mr-[5px]"
          />
        </div>
      </template>
    </Column>
    <Column field="pelayanan" header="Pelayanan" headerClass="bg-opensimrs-50">
      <template #body="slotProps">
        <div class="text-SM">{{ slotProps.data.jenisPelayanan }}</div>
        <CustomChip
          :showCheckedIcon="false"
          :label="slotProps.data.polyclinic"
          bgColor="bg-grey-100"
          textColor="text-grey-300"
          border-color="border-[#858D9D] border-[1px]"
          customClass="h-5 pr-[6px] mr-[5px]"
        />
      </template>
    </Column>
    <Column field="diagnosa" header="Diagnosa" headerClass="bg-opensimrs-50">
      <template #body="slotProps">
        <div class="text-SM">{{ slotProps.data.tipeDiagnosa }}</div>
      </template>
    </Column>
    <Column field="bpjs" header="BPJS" headerClass="bg-opensimrs-50">
      <template #body="slotProps">
        <div class="flex flex-col gap-1.5">
          <div>
            <CustomChip
              :showCheckedIcon="false"
              :label="slotProps.data.BPJSClass"
              bgColor="bg-mediumGrey-300"
              textColor="text-white"
              customClass="h-5 pr-[6px] border-none mr-[5px]"
            />
          </div>
          <div class="text-SM">SEP {{ slotProps.data.no_SEP }}</div>
          <div class="text-SM">
            {{ slotProps.data.tglDischarge }}
            {{ slotProps.data.jamDischarge }}
          </div>
        </div>
      </template>
    </Column>
    <Column
      field="no-rujukan"
      header="No. Rujukan"
      headerClass="bg-opensimrs-50"
      class="w-[120px]"
    >
      <template #body="slotProps">
        <div class="text-SM">RUJ.{{ slotProps.data.noRujukan }}</div>
      </template>
    </Column>
    <Column
      field="tgl-discharge-pelayanan"
      header="Tgl. Discharge Pelayanan"
      headerClass="bg-opensimrs-50"
      class="w-[120px]"
    >
      <template #body="slotProps">
        <div class="text-SM">
          <div>{{ slotProps.data.tglDischarge }}</div>
          <div>{{ slotProps.data.jamDischarge }}</div>
        </div>
      </template>
    </Column>
    <Column
      field="ppk-pelayanan"
      header="PPK Pelayanan"
      headerClass="bg-opensimrs-50"
      class="w-[90px]"
    >
      <template #body="slotProps">
        <div class="text-SM">
          <div>{{ slotProps.data.PpkPelayanan }}</div>
        </div>
      </template>
    </Column>
  </DataTable>
</template>
