<script setup lang="ts">
import CustomChip from "@/components/Base/CustomChip.vue";
import NoData from "@/components/section/NoData.vue";
import { labelCaraBayar, labelGender, labelSesi, rupiah, STATUS_ORDER, tglIndo, type OrderTraining } from "@/stores/penunjang/training";

// Tabel baris training_order (booking / order) bersama halaman Booking Kelas & Daftar Kelas. Klik baris → detail;
// `pilih` menampilkan kolom centang untuk batal massal (v-model:selection).
defineProps<{ data: OrderTraining[]; pilih?: boolean }>();
const emit = defineEmits<{ (e: "detail", o: OrderTraining): void }>();
const selection = defineModel<OrderTraining[]>("selection", { default: () => [] });
</script>
<template>
  <NoData v-if="!data.length" />
  <DataTable
    v-else
    v-model:selection="selection"
    :value="data"
    dataKey="uuid"
    tableStyle="min-width: 50rem"
    scrollable
    scrollHeight="flex"
    :pt="{ headerRow: 'text-SM' }"
    stripedRows
    :rowClass="() => (pilih ? '' : 'cursor-pointer')"
    @rowClick="emit('detail', $event.data)"
  >
    <Column headerClass="bg-opensimrs-50">
      <template #header><div class="w-full font-semibold text-center">Nomor</div></template>
      <template #body="{ data: o }">
        <div class="text-center">
          <div class="text-SM">{{ o.noRm ?? "-" }}</div>
          <div class="text-SM">{{ o.noOrder }}</div>
        </div>
      </template>
    </Column>
    <Column header="Pasien" headerClass="bg-opensimrs-50">
      <template #body="{ data: o }">
        <div class="font-semibold text-SM">{{ o.namaPasien ?? "-" }}</div>
        <div class="flex flex-wrap mt-1">
          <CustomChip
            :showCheckedIcon="false"
            :label="labelGender(o.gender)"
            :bgColor="o.gender === 'Female' ? 'bg-female-75' : 'bg-male-75'"
            :textColor="o.gender === 'Female' ? 'text-female-300' : 'text-male-300'"
            customClass="h-5 pr-[6px] border-none mr-[5px]"
          />
          <CustomChip v-if="o.noHp" :showCheckedIcon="false" :label="o.noHp" bgColor="bg-opensimrs-75" textColor="text-opensimrs-300" customClass="h-5 pr-[6px] border-none mr-[5px]" />
        </div>
      </template>
    </Column>
    <Column header="Kelas" headerClass="bg-opensimrs-50">
      <template #body="{ data: o }">
        <div class="mb-[5px] text-SM">{{ o.kelasNama }}</div>
        <div class="flex flex-wrap gap-1">
          <CustomChip
            v-if="o.paymentMethod"
            :showCheckedIcon="false"
            :label="labelCaraBayar(o.paymentMethod).toUpperCase()"
            :bgColor="o.paymentMethod === 1 ? 'bg-opensimrs-50' : 'bg-warning-50'"
            :textColor="o.paymentMethod === 1 ? 'text-opensimrs-300' : 'text-warning-300'"
            :borderColor="o.paymentMethod === 1 ? 'border-opensimrs-300' : 'border-warning-300'"
            customClass="h-5 pr-[6px]"
          />
          <span class="px-2 py-0.5 border rounded-full text-XS font-semibold" :class="STATUS_ORDER[o.status]?.kelas">{{ STATUS_ORDER[o.status]?.label ?? o.status }}</span>
        </div>
      </template>
    </Column>
    <Column header="Sesi" headerClass="bg-opensimrs-50" bodyClass="text-SM">
      <template #body="{ data: o }">{{ o.namaSesi ? labelSesi(o) : "-" }}</template>
    </Column>
    <Column header="Data Kunjungan" headerClass="bg-opensimrs-50" style="width: 25%">
      <template #body="{ data: o }">
        <div class="text-SM">
          <div class="grid content-center grid-cols-[80px_min-content_150px]">
            Jadwal
            <ArrowRightBrokenIcon :size="18" class="my-auto mr-5 text-grey-300" weight="bold" />
            {{ tglIndo(o.tanggalKelas) }}
          </div>
          <div class="grid content-center grid-cols-[80px_min-content_150px] mt-[5px]">
            Tarif
            <ArrowRightBrokenIcon :size="18" class="my-auto mr-5 text-male-300" weight="bold" />
            {{ rupiah(o.harga) }}
          </div>
          <div v-if="o.status === 'batal' && o.alasanBatal" class="mt-[5px] text-XS text-danger-300">Alasan batal: {{ o.alasanBatal }}</div>
        </div>
      </template>
    </Column>
    <Column v-if="pilih" selectionMode="multiple" headerStyle="width: 3rem" headerClass="bg-opensimrs-50" class="custom-checkbox" />
  </DataTable>
</template>
