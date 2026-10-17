<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { MenuItem } from "primevue/menuitem";
import HeaderFilterTraining from "../Layout/HeaderFilterTraining.vue";
import TabelSlot from "../Komponen/TabelSlot.vue";
import DataPasienBooking from "./DataPasienBooking.vue";
import { apiTraining, izinTraining, keIso, labelSesi, STATUS_ORDER, useTrainingStore, type OrderTraining, type SlotSesi } from "@/stores/penunjang/training";

// Cari jadwal & kelas: pilih kelas + tanggal → ketersediaan slot per sesi (GET /slot) beserta peserta yang sudah
// booking/terdaftar; tombol BOOK membuka form pasien (DataPasienBooking).
const emit = defineEmits(["back", "selesai"]);
const dataBreadCrumb = ref<MenuItem[]>([{ label: "Cari Jadwal & Kelas" }]);
const store = useTrainingStore();

const kelasUuid = ref<string | null>(null);
const tanggal = ref<Date>(new Date());
const tanggalIso = computed(() => keIso(tanggal.value));
const kelas = computed(() => store.kelas.find((k) => k.uuid === kelasUuid.value));
const refSlot = ref<InstanceType<typeof TabelSlot>>();

// Peserta aktif pada kelas + tanggal. Daftar order (booking & terdaftar) butuh izin baca Daftar Kelas;
// tanpa izin itu hanya booking yang ditampilkan.
const peserta = ref<OrderTraining[]>([]);
const muatPeserta = async () => {
  peserta.value = [];
  if (!kelasUuid.value) return;
  const q = { kelas_uuid: kelasUuid.value, tanggal_mulai: tanggalIso.value, tanggal_selesai: tanggalIso.value, limit: 500 };
  const r = izinTraining("Daftar Kelas", "READ") ? await apiTraining.daftarOrder({ ...q, status: "booking,order" }) : await apiTraining.daftarBooking(q);
  peserta.value = r?.payload?.data ?? [];
};
watch([kelasUuid, tanggalIso], muatPeserta);
const muatUlang = () => {
  refSlot.value?.muat();
  muatPeserta();
};

const jadwal = ref<{ kelasUuid: string; kelasNama: string; tanggalKelas: string; sesiUuid: string | null; namaSesi: string; tersedia: number } | null>(null);
const book = (s: SlotSesi) => {
  if (!kelas.value) return;
  jadwal.value = {
    kelasUuid: kelas.value.uuid,
    kelasNama: kelas.value.nama,
    tanggalKelas: tanggalIso.value,
    sesiUuid: s.sesiUuid ?? null,
    namaSesi: s.namaSesi ? labelSesi(s) : "-",
    tersedia: s.tersedia,
  };
};
const bookingTersimpan = () => {
  jadwal.value = null;
  emit("selesai");
};
</script>
<template>
  <Card v-if="!jadwal" pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto">
    <template #header>
      <HeaderFilterTraining
        v-model:kelasUuid="kelasUuid"
        v-model:tanggal="tanggal"
        page-type="booking-kelas"
        :dataBreadCrumb="dataBreadCrumb"
        @reload-data="muatUlang"
        @search="muatUlang"
        @back="emit('back')"
      />
    </template>
    <template #content>
      <div class="flex flex-col gap-4 p-1">
        <section>
          <h2 class="mb-2 text-sm font-semibold">
            Ketersediaan Slot{{ kelas ? ` — ${kelas.nama}` : "" }}{{ kelasUuid ? `, ${tanggalIso}` : "" }}
          </h2>
          <TabelSlot ref="refSlot" :kelasUuid="kelasUuid" :tanggal="tanggalIso" labelPilih="BOOK" @pilih="book" />
        </section>
        <section v-if="kelasUuid">
          <h2 class="mb-2 text-sm font-semibold">Peserta ({{ peserta.length }})</h2>
          <div v-if="!peserta.length" class="p-4 text-xs text-center text-grey-400">Belum ada peserta pada tanggal ini.</div>
          <DataTable v-else :value="peserta" stripedRows class="text-xs" tableStyle="min-width: 40rem">
            <Column header="No." headerClass="bg-opensimrs-50">
              <template #body="{ index }">{{ index + 1 }}</template>
            </Column>
            <Column header="Sesi" headerClass="bg-opensimrs-50">
              <template #body="{ data: o }">{{ o.namaSesi ? labelSesi(o) : "-" }}</template>
            </Column>
            <Column header="Nama Pasien" headerClass="bg-opensimrs-50">
              <template #body="{ data: o }">
                <div class="font-semibold">{{ o.namaPasien }}</div>
                <div class="text-grey-400">{{ o.noRm }} · {{ o.noOrder }}</div>
              </template>
            </Column>
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data: o }">
                <span class="px-2 py-0.5 border rounded-full font-semibold" :class="STATUS_ORDER[o.status]?.kelas">{{ STATUS_ORDER[o.status]?.label ?? o.status }}</span>
              </template>
            </Column>
          </DataTable>
        </section>
      </div>
    </template>
  </Card>
  <DataPasienBooking v-else :jadwal="jadwal" @back="jadwal = null" @tersimpan="bookingTersimpan" />
</template>
