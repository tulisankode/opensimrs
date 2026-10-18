<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";
import { useAntreanBpjsStore } from "@/stores/antrian/antreanBpjs";

// Monitoring Antrean Online BPJS (Mobile JKN) — STD-0018. Daftar booking yang terjembatani dari Mobile JKN/
// pendaftaran lokal JKN, status sinkronisasi ke BPJS, task id yang sudah tercatat, dan kirim ulang bila gagal.
const store = useAntreanBpjsStore();
const storeUtils = utilsStore();
const toast = useToast();

const OPSI_STATUS = [
  { value: "", label: "Semua" },
  { value: "terkirim", label: "Terkirim" },
  { value: "gagal", label: "Gagal" },
  { value: "menunggu", label: "Menunggu" },
];

const baris = ref<any[]>([]);
const total = ref(0);
const halaman = ref(1);
const perHalaman = ref(10);
const status = ref("");

const detail = ref<any>(null);
const memproses = ref<string | null>(null);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await store.getMonitoring({ page: halaman.value, limit: perHalaman.value, status: status.value });
    baris.value = res?.payload ?? [];
    total.value = res?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};

const bukaDetail = async (row: any) => {
  const res = await store.getDetailBooking(row.kodeBooking);
  detail.value = res?.payload ?? null;
};

const kirimUlangTambahAntrean = async (row: any) => {
  memproses.value = row.kodeBooking;
  try {
    const res = await store.kirimUlang(row.kodeBooking, { jenis: "tambah_antrean" });
    toast.add({ severity: res?.payload?.status === "terkirim" ? "success" : "error", summary: row.kodeBooking, detail: res?.payload?.pesan ?? res?.message, life: 6000 });
  } finally {
    memproses.value = null;
  }
  await muat();
};

const kirimUlangTask = async (taskId: number) => {
  if (!detail.value) return;
  const kodeBooking = detail.value.booking.kodeBooking;
  memproses.value = `${kodeBooking}-${taskId}`;
  try {
    const res = await store.kirimUlang(kodeBooking, { jenis: "task", task_id: taskId });
    toast.add({ severity: res?.payload?.status === "terkirim" ? "success" : "error", summary: `Task ${taskId}`, detail: res?.payload?.pesan ?? res?.message, life: 6000 });
  } finally {
    memproses.value = null;
  }
  await bukaDetail({ kodeBooking });
};

const onPage = (e: { page: number; rows: number }) => {
  halaman.value = e.page + 1;
  perHalaman.value = e.rows;
  muat();
};

const warnaStatus: Record<string, { bg: string; text: string }> = {
  terkirim: { bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  gagal: { bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  menunggu: { bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
};

onMounted(muat);
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto">
    <template #header>
      <div class="px-4 pt-4 text-lg font-semibold">Antrean Online BPJS (Mobile JKN)</div>
    </template>
    <template #content>
      <div class="flex flex-col gap-3 text-base">
        <div class="flex items-end gap-3">
          <CustomSelect v-model="status" class="w-1/4" label="Status Sinkron" :options="OPSI_STATUS" optionValue="value" optionLabel="label" @update:modelValue="(halaman = 1), muat()" />
          <CustomButton label="Muat Ulang" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="muat" />
        </div>
        <DataTable :value="baris" stripedRows class="text-xs">
          <Column header="Kode Booking" field="kodeBooking" headerClass="bg-opensimrs-50" />
          <Column header="Sumber" headerClass="bg-opensimrs-50">
            <template #body="{ data }">{{ data.sumber === "mobile_jkn" ? "Mobile JKN" : "Pendaftaran lokal" }}</template>
          </Column>
          <Column header="Tanggal Periksa" headerClass="bg-opensimrs-50">
            <template #body="{ data }">{{ data.tanggalPeriksa ? epochToDate(Number(data.tanggalPeriksa), "date") : "-" }}</template>
          </Column>
          <Column header="Status Lokal" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <CustomChip :label="data.statusLokal === 'aktif' ? 'Aktif' : 'Batal'" :show-checked-icon="false" :bg-color="data.statusLokal === 'aktif' ? 'bg-[#D1FADF]' : 'bg-[#D4D8DC]'" border-color="border-transparent" :text-color="data.statusLokal === 'aktif' ? 'text-[#027A48]' : 'text-[#687077]'" />
            </template>
          </Column>
          <Column header="Status Sinkron" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <CustomChip :label="data.statusSinkron" :show-checked-icon="false" :bg-color="warnaStatus[data.statusSinkron]?.bg ?? 'bg-opensimrs-50'" border-color="border-transparent" :text-color="warnaStatus[data.statusSinkron]?.text ?? 'text-opensimrs-300'" />
            </template>
          </Column>
          <Column header="Task Tercatat" headerClass="bg-opensimrs-50">
            <template #body="{ data }">{{ data.taskTercatat }} / 7<span v-if="Number(data.kirimGagal) > 0" class="ml-1 text-[#B42318]">({{ data.kirimGagal }} gagal)</span></template>
          </Column>
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="flex flex-wrap gap-2">
                <CustomButton label="Detail" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaDetail(data)" />
                <CustomButton
                  v-if="data.statusSinkron === 'gagal'"
                  :disabled="memproses === data.kodeBooking"
                  label="Kirim Ulang"
                  outlined
                  borderColor="border-opensimrs-300"
                  textColor="text-opensimrs-300"
                  @click="kirimUlangTambahAntrean(data)"
                />
              </div>
            </template>
          </Column>
          <template #empty><div class="py-3 text-center text-grey-400">Belum ada antrean yang tersinkron dengan BPJS.</div></template>
        </DataTable>
        <div class="flex justify-end"><CustomPaginator :rows="perHalaman" :totalRecords="total" @page="onPage" /></div>
      </div>
    </template>
  </Card>

  <Dialog :visible="!!detail" modal header="Detail Booking Antrean BPJS" :style="{ width: '680px' }" @update:visible="detail = null">
    <div v-if="detail" class="flex flex-col gap-4 text-sm">
      <div class="grid grid-cols-2 gap-2">
        <div><span class="text-grey-400">Kode Booking:</span> <b>{{ detail.booking.kodeBooking }}</b></div>
        <div><span class="text-grey-400">Status Lokal:</span> <b>{{ detail.booking.statusLokal }}</b></div>
      </div>
      <div>
        <div class="mb-1 font-semibold">Task id tercatat</div>
        <div class="flex flex-wrap gap-2">
          <span v-for="t in [1, 2, 3, 4, 5, 6, 7]" :key="t" class="px-2 py-1 border rounded" :class="detail.task.some((x: any) => x.taskId === t) ? 'bg-[#D1FADF] border-transparent' : 'border-dashed text-grey-400'">
            Task {{ t }}
          </span>
        </div>
      </div>
      <div>
        <div class="mb-1 font-semibold">Riwayat pengiriman</div>
        <DataTable :value="detail.kirim" class="text-xs">
          <Column header="Jenis" headerClass="bg-opensimrs-50">
            <template #body="{ data }">{{ data.jenis }}<span v-if="data.taskId"> (task {{ data.taskId }})</span></template>
          </Column>
          <Column header="Status" field="status" headerClass="bg-opensimrs-50" />
          <Column header="Percobaan" field="percobaan" headerClass="bg-opensimrs-50" />
          <Column header="Pesan" field="pesan" headerClass="bg-opensimrs-50" />
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <CustomButton
                v-if="data.status === 'gagal' && data.jenis === 'task'"
                :disabled="memproses === `${detail.booking.kodeBooking}-${data.taskId}`"
                label="Kirim Ulang"
                outlined
                borderColor="border-opensimrs-300"
                textColor="text-opensimrs-300"
                @click="kirimUlangTask(data.taskId)"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </div>
    <template #footer>
      <CustomButton label="Tutup" @click="detail = null" />
    </template>
  </Dialog>
</template>
