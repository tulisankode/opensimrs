<script setup lang="ts">
import { type PropType } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { epochToDate, formatPrice } from "@/utils/Helpers";

const props = defineProps({
  serviceBills: {
    type: Array as PropType<any[]>,
    default: () => [],
  }
});
</script>

<template>
  <CustomAccordion :openWithHeader="false">
    <template #header>
      <div class="flex justify-between w-full align-middle">
        <div class="flex">
          <span class="leading-10 text-opensimrs-300 text-heading">
            Riwayat Transaksi
          </span>
        </div>
      </div>
    </template>
    <template #content>
      <div v-if="!serviceBills || serviceBills.length === 0" class="pt-5">
        <p>Tidak ada riwayat transaksi.</p>
      </div>

      <div v-else v-for="(service, index) in serviceBills" :key="service.uuid">
        <div class="pt-5">
          <div class="flex">
            <p class="font-bold">{{ service.type }}</p>
            <CustomChip
              class="ml-2"
              :showCheckedIcon="false"
              :label="service.withInsurance ? 'ASURANSI' : 'TUNAI'"
              :bgColor="service.withInsurance ? 'bg-warning-50' : 'bg-opensimrs-50'"
              :textColor="service.withInsurance ? 'text-warning-300' : 'text-opensimrs-300'"
              :borderColor="service.withInsurance ? 'border-warning-300' : 'border-opensimrs-300'"
            />
          </div>
          <div class="flex">
            <UserDoctorIcon class="mt-2" />
            <p class="mt-2 text-sm text-grey-400">{{ service.practitionerName }}</p>
          </div>
          <div class="flex">
            <p class="text-sm">Tanggal</p>
            <PhArrowRight :size="18" class="my-auto ml-2 text-success-300" weight="bold" />
            <p class="ml-2 text-sm">{{ epochToDate(service.date, "dateTime") }}</p>
          </div>
        </div>

        <div v-if="service.items?.item?.ruangan?.list?.length > 0" class="pt-1 mt-4 shadow-md rounded-xl">
          <DataTable :value="service.items.item.ruangan.list" class="overflow-hidden rounded-t-[10px]" :pt="{ headerRow: 'text-SM' }">
            <Column header="Tanggal" headerClass="bg-opensimrs-50" style="width: 15%"><template #body="slotProps">{{ epochToDate(slotProps.data.dateUsed, "date") }}</template></Column>
            <Column field="itemName" header="Kamar" headerClass="bg-opensimrs-50"></Column>
            <Column field="qty" header="Waktu (Hari)" headerClass="bg-opensimrs-50 text-center" bodyClass="text-left"></Column>
            <Column header="Tarif" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width:15%"><template #body="slotProps">{{ slotProps.data.price?.toLocaleString ('id-ID') || 0}}</template></Column>
            <Column header="Total" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 10%"><template #body="slotProps">{{ (slotProps.data.qty * slotProps.data.price)?.toLocaleString ('id-ID') || 0 }}</template></Column>
          </DataTable>
          <div class="flex justify-between p-3 font-bold bg-white rounded-b-[10px]">
            <p class="text-base font-bold">Total Ruangan</p>
            <p class="text-base font-bold"> Rp {{ Number(service.items.item.ruangan.total) .toLocaleString ('id-ID') || 0}}</p>
          </div>
        </div>

        <div v-if="service.items?.item?.tindakan?.list?.length > 0" class="pt-1 mt-4 shadow-md rounded-xl">
          <DataTable :value="service.items.item.tindakan.list" class="overflow-hidden rounded-t-[10px]" :pt="{ headerRow: 'text-SM' }">
            <Column header="Tanggal" headerClass="bg-opensimrs-50" style="width: 15%"><template #body="slotProps">{{ epochToDate(slotProps.data.dateUsed, "date") }}</template></Column>
            <Column field="itemName" header="Tindakan, Pemeriksaan, dan Administrasi" headerClass="bg-opensimrs-50" style="width: 45%"></Column>
            <Column field="qty" header="Jumlah" headerClass="bg-opensimrs-50 text-center" bodyClass="text-left" ></Column>
            <Column header="Tarif" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 15%"><template #body="slotProps">{{ slotProps.data.price?.toLocaleString ('id-ID') || 0 }}</template></Column>
            <Column header="Total" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 10%"><template #body="slotProps">{{ (slotProps.data.qty * slotProps.data.price)?.toLocaleString ('id-ID') || 0 }}</template></Column>
          </DataTable>
          <div class="flex justify-between p-3 font-bold bg-white rounded-b-[10px]">
            <p class="text-base font-bold">Total Tindakan</p>
            <p class="text-base font-bold"> Rp {{ Number(service.items.item.tindakan.total) .toLocaleString ('id-ID') || 0}}</p>
          </div>
        </div>

        <div v-if="service.items?.item?.penunjang?.list?.length > 0" class="pt-1 mt-4 shadow-md rounded-xl">
          <DataTable :value="service.items.item.penunjang.list" class="overflow-hidden rounded-t-[10px]" :pt="{ headerRow: 'text-SM' }">
            <Column header="Tanggal" headerClass="bg-opensimrs-50" style="width: 15%"><template #body="slotProps">{{ epochToDate(slotProps.data.dateUsed, "date") }}</template></Column>
            <Column field="itemName" header="Penunjang" headerClass="bg-opensimrs-50" style="width: 45%"></Column>
            <Column field="qty" header="Jumlah" headerClass="bg-opensimrs-50 text-center" bodyClass="text-center" style="width: 10%"></Column>
            <Column header="Tarif" headerClass="bg-opensimrs-50 text-right" bodyClass="text-right" style="width: 15%"><template #body="slotProps">{{ slotProps.data.price?.toLocaleString ('id-ID') || 0 }}</template></Column>
            <Column header="Total" headerClass="bg-opensimrs-50 text-right" bodyClass="text-right" style="width: 10%"><template #body="slotProps">{{ (slotProps.data.qty * slotProps.data.price)?.toLocaleString ('id-ID') || 0 }}</template></Column>
          </DataTable>
          <div class="flex justify-between p-3 font-bold bg-white rounded-b-[10px]">
            <p class="text-base font-bold">Total Penunjang</p>
            <p class="text-base font-bold"> Rp {{ Number(service.items.item.penunjang.total) .toLocaleString ('id-ID') || 0}}</p>
          </div>
        </div>

        <div v-if="service.items?.item?.obat?.list?.length > 0" class="pt-1 mt-4 shadow-md rounded-xl">
          <DataTable :value="service.items.item.obat.list" class="overflow-hidden rounded-t-[10px]" :pt="{ headerRow: 'text-SM' }">
            <Column header="Tanggal" headerClass="bg-opensimrs-50"><template #body="slotProps">{{ epochToDate(slotProps.data.dateUsed, "date") }}</template></Column>
            <Column field="itemName" header="Obat" headerClass="bg-opensimrs-50"></Column>
            <Column field="additionalField" header="Golongan" headerClass="bg-opensimrs-50"></Column>
            <Column field="qty" header="Jumlah" headerClass="bg-opensimrs-50 text-center" bodyClass="text-left"></Column>
            <Column header="Tarif" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left"><template #body="slotProps">{{ slotProps.data.price?.toLocaleString ('id-ID') || 0 }}</template></Column>
            <Column header="Jasa" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 15%"><template #body="slotProps">{{ slotProps.data.serviceFee?.toLocaleString ('id-ID') || 0 }}</template></Column>
            <Column header="Total" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 10%"><template #body="slotProps">{{ (slotProps.data.qty * slotProps.data.price + (slotProps.data.serviceFee || 0))?.toLocaleString('id-ID') || 0 }}</template></Column>
          </DataTable>
          <div class="flex justify-between p-3 font-bold bg-white rounded-b-[10px]">
            <p class="text-base font-bold">Total Obat</p>
            <p class="text-base font-bold"> Rp {{ Number(service.items.item.obat.total) .toLocaleString ('id-ID') || 0}}</p>
          </div>
        </div>
        
        <div v-if="service.items?.item?.alkes?.list?.length > 0" class="pt-1 mt-4 shadow-md rounded-xl">
          <DataTable :value="service.items.item.alkes.list" class="overflow-hidden rounded-t-[10px]" :pt="{ headerRow: 'text-SM' }">
            <Column header="Tanggal" headerClass="bg-opensimrs-50" style="width: 15%"><template #body="slotProps">{{ epochToDate(slotProps.data.dateUsed, "date") }}</template></Column>
            <Column field="itemName" header="Alkes" headerClass="bg-opensimrs-50" style="width: 45%"></Column>
            <Column field="qty" header="Jumlah" headerClass="bg-opensimrs-50 text-center" bodyClass="text-left" ></Column>
            <Column header="Tarif" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 15%"><template #body="slotProps">{{ slotProps.data.price?.toLocaleString ('id-ID') || 0}}</template></Column>
            <Column header="Total" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 10%"><template #body="slotProps">{{ (slotProps.data.qty * slotProps.data.price)?.toLocaleString ('id-ID') || 0 }}</template></Column>
          </DataTable>
          <div class="flex justify-between p-3 font-bold bg-white rounded-b-[10px]">
            <p class="text-base font-bold">Total Alkes</p>
            <p class="text-base font-bold"> Rp {{ Number(service.items.item.alkes.total) .toLocaleString ('id-ID') || 0}}</p>
          </div>
        </div>

        <div class="mt-4">
          <Card class="bg-opensimrs-50">
            <template #content>
              <div class="flex justify-between">
                <p class="text-base font-bold">Total Keseluruhan</p>
                <p class="text-base font-bold">
                Rp {{ Number(service.items.item.totalKeseluruhan) .toLocaleString('id-ID') || 0 }}
                </p>
              </div>
            </template>
          </Card>
        </div>

        <hr v-if="index < serviceBills.length - 1" class="mt-10 mb-3 border-2 border-grey-200" />
      </div>
    </template>
    <template #collapseIcon>
      <CustomButton icon="PhCaretUp" backgroundColor="bg-opensimrs-75" textColor="text-opensimrs-300" />
    </template>
    <template #expandIcon>
      <CustomButton icon="PhCaretDown" backgroundColor="bg-opensimrs-75" textColor="text-opensimrs-300" />
    </template>
  </CustomAccordion>
</template>