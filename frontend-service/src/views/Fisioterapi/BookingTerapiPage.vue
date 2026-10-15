<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import IsianOrderFisio from "@/components/RekamMedis/OrderFisio/IsianOrderFisio.vue";
import ChipStatus from "./Komponen/ChipStatus.vue";
import GridSlot from "./Komponen/GridSlot.vue";
import PilihPasien from "./Komponen/PilihPasien.vue";
import {
  apiFisio, JAM_SLOT, labelJam, tglIndo, keIso, dariIso, isianKosong, useFisioterapiStore,
  type JadwalFisio, type PasienRingkas, type IsianOrder,
} from "@/stores/penunjang/fisioterapi";

// Booking Terapi: cek ketersediaan bed, booking pasien lama / baru (nama + no. HP), batal booking
// (slot kembali tersedia), dan lanjutkan booking menjadi order tanpa pendaftaran ulang.
const route = useRoute();
const router = useRouter();
const store = useFisioterapiStore();

const tanggal = ref<Date>(new Date());
const refGrid = ref<InstanceType<typeof GridSlot>>();
const pilihan = ref<{ jamSlot: number; bedUuid: string } | null>(null);

// Ketersediaan 7 hari ke depan (jumlah bed kosong per jam).
const ketersediaan = ref<{ tanggal: string; jamSlot: number; tersedia: number; totalBed: number }[]>([]);
const hariKetersediaan = computed(() => [...new Set(ketersediaan.value.map((k) => k.tanggal))]);
const sel = (t: string, s: number) => ketersediaan.value.find((k) => k.tanggal === t && k.jamSlot === s);
const muatKetersediaan = async () => {
  const awal = new Date();
  const akhir = new Date();
  akhir.setDate(akhir.getDate() + 6);
  ketersediaan.value = (await apiFisio.ketersediaan(keIso(awal), keIso(akhir)))?.payload ?? [];
};
const pilihHari = (t: string) => {
  tanggal.value = dariIso(t);
};

// ── Form booking ──
const jenisPasien = ref<"lama" | "baru">("lama");
const pasien = ref<PasienRingkas | null>(null);
const namaBaru = ref("");
const hpBaru = ref("");
const catatan = ref("");
const galat = ref("");
const bedTerpilih = computed(() => store.bed.find((b) => b.uuid === pilihan.value?.bedUuid));

const buatBooking = async () => {
  galat.value = "";
  if (!pilihan.value) return (galat.value = "Pilih slot jam & bed yang tersedia pada grid.");
  if (jenisPasien.value === "lama" && !pasien.value) return (galat.value = "Pilih pasien terdaftar.");
  if (jenisPasien.value === "baru" && (!namaBaru.value.trim() || !hpBaru.value.trim())) return (galat.value = "Nama dan No. HP pasien baru wajib diisi.");
  const r = await apiFisio.buatBooking({
    tanggal: keIso(tanggal.value),
    ...pilihan.value,
    ...(jenisPasien.value === "lama" ? { patientUuid: pasien.value?.uuid } : { namaPasien: namaBaru.value.trim(), noHp: hpBaru.value.trim() }),
    catatan: catatan.value || null,
  });
  if (!r) return;
  pilihan.value = null;
  pasien.value = null;
  namaBaru.value = hpBaru.value = catatan.value = "";
  muatSemua();
};

// ── Daftar booking ──
const cari = ref("");
const daftar = ref<JadwalFisio[]>([]);
const memuat = ref(false);
const muatBooking = async () => {
  memuat.value = true;
  const r = await apiFisio.daftarBooking({ status: "booking", tanggal_mulai: keIso(new Date(Date.now() - 30 * 864e5)), cari: cari.value, limit: 500 });
  daftar.value = r?.payload?.data ?? [];
  memuat.value = false;
};
const lewat = (j: JadwalFisio) => j.tanggal < keIso(new Date());
const muatSemua = () => {
  refGrid.value?.muat();
  muatKetersediaan();
  muatBooking();
};

// Batal booking
const dialogBatal = ref(false);
const dibatal = ref<JadwalFisio | null>(null);
const alasan = ref("");
const bukaBatal = (j: JadwalFisio) => {
  dibatal.value = j;
  alasan.value = lewat(j) ? "Pasien tidak datang (lewat jadwal)" : "";
  dialogBatal.value = true;
};
const batal = async () => {
  if (!dibatal.value) return;
  const r = await apiFisio.batalBooking(dibatal.value.uuid, alasan.value || undefined);
  dialogBatal.value = false;
  if (r) muatSemua();
};

// Lanjutkan ke order
const dialogLanjut = ref(false);
const dilanjut = ref<JadwalFisio | null>(null);
const pasienLanjut = ref<PasienRingkas | null>(null);
const isian = ref<IsianOrder>(isianKosong());
const caraBayar = ref(1);
const galatLanjut = ref("");
const refIsian = ref<InstanceType<typeof IsianOrderFisio>>();
const bukaLanjut = (j: JadwalFisio) => {
  dilanjut.value = j;
  pasienLanjut.value = j.patientUuid ? { uuid: j.patientUuid, name: j.namaPasien ?? "", noRm: j.noRm ?? "", gender: j.gender, phone: j.noHp, birthDate: j.tanggalLahir } : null;
  isian.value = isianKosong();
  caraBayar.value = 1;
  galatLanjut.value = "";
  dialogLanjut.value = true;
};
const lanjut = async () => {
  galatLanjut.value = pasienLanjut.value ? "" : "Pasien baru harus didaftarkan di Admisi lalu dipilih di sini";
  const ok = refIsian.value?.validasi();
  if (!dilanjut.value || !pasienLanjut.value || !ok || !refIsian.value) return;
  const r = await apiFisio.lanjutBooking(dilanjut.value.uuid, { patientUuid: pasienLanjut.value.uuid, paymentMethod: caraBayar.value, ...refIsian.value.payload() });
  if (!r) return;
  dialogLanjut.value = false;
  router.push({ path: "/fisioterapi/order-fisioterapi", query: { order: r.payload.uuid } });
};

onMounted(() => {
  if (route.query.tanggal) tanggal.value = dariIso(String(route.query.tanggal));
  store.muatBed();
  muatKetersediaan();
  muatBooking();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-hidden" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muatSemua" />
          <h1 class="toolbar-heading text-opensimrs-300">Booking Terapi</h1>
          <CustomDatePicker v-model="tanggal" label="Tanggal terapi" class="toolbar-field--date" :min-date="new Date()" />
          <CustomTextfield v-model="cari" label="Cari booking" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. HP" @keydown.enter="muatBooking" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="muatBooking" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[3fr_2fr]">
          <div class="flex flex-col gap-4">
            <!-- Ketersediaan 7 hari -->
            <section class="overflow-auto border rounded-lg border-grey-100">
              <h2 class="px-3 py-2 text-sm font-semibold border-b border-grey-100">Cek Ketersediaan Bed (7 hari)</h2>
              <table class="w-full text-xs">
                <thead>
                  <tr class="bg-opensimrs-50">
                    <th class="px-2 py-1 text-left">Jam</th>
                    <th v-for="t in hariKetersediaan" :key="t" class="px-2 py-1">
                      <button type="button" class="underline-offset-2 hover:underline" :class="{ 'text-opensimrs-400 font-bold': t === keIso(tanggal) }" @click="pilihHari(t)">
                        {{ tglIndo(t) }}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="j in JAM_SLOT" :key="j.slot" class="border-t border-grey-75">
                    <td class="px-2 py-1 whitespace-nowrap">{{ j.label }}</td>
                    <td v-for="t in hariKetersediaan" :key="t" class="px-2 py-1 text-center">
                      <button
                        type="button"
                        class="px-2 rounded"
                        :class="sel(t, j.slot)?.tersedia ? 'bg-success-50 text-success-400' : 'bg-danger-50 text-danger-300'"
                        @click="pilihHari(t)"
                      >
                        {{ sel(t, j.slot)?.tersedia ?? 0 }}/{{ sel(t, j.slot)?.totalBed ?? 0 }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section>
              <h2 class="mb-2 text-sm font-semibold">Pilih Slot — {{ tglIndo(keIso(tanggal), true) }}</h2>
              <GridSlot ref="refGrid" v-model:pilihan="pilihan" :tanggal="keIso(tanggal)" bisaPilih ringkas />
            </section>

            <section class="flex flex-col gap-3 p-3 border rounded-lg border-grey-100">
              <h2 class="text-sm font-semibold">Data Booking</h2>
              <div class="text-xs">
                Slot: <b>{{ pilihan ? `${tglIndo(keIso(tanggal))} · ${labelJam(pilihan.jamSlot)} · ${bedTerpilih?.nama ?? "-"}` : "belum dipilih" }}</b>
              </div>
              <div class="flex gap-4 text-sm">
                <label class="inline-flex items-center gap-2"><input v-model="jenisPasien" type="radio" value="lama" />Pasien lama (terdaftar)</label>
                <label class="inline-flex items-center gap-2"><input v-model="jenisPasien" type="radio" value="baru" />Pasien baru</label>
              </div>
              <PilihPasien v-if="jenisPasien === 'lama'" v-model="pasien" />
              <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <CustomTextfield v-model="namaBaru" label="Nama Pasien" placeholder="Nama lengkap" required />
                <CustomTextfield v-model="hpBaru" label="No. HP" placeholder="08xxxxxxxxxx" required />
              </div>
              <CustomTextArea v-model="catatan" label="Catatan" placeholder="Keluhan singkat / permintaan khusus (opsional)" />
              <p v-if="galat" class="text-xs text-danger-300">{{ galat }}</p>
              <div class="flex justify-end">
                <CustomButton icon="PhCalendarCheck" label="Buat Booking" @click="buatBooking" />
              </div>
            </section>
          </div>

          <!-- Daftar booking -->
          <section class="border rounded-lg border-grey-100 h-fit">
            <h2 class="px-3 py-2 text-sm font-semibold border-b border-grey-100">Daftar Booking Aktif ({{ daftar.length }})</h2>
            <div v-if="memuat" class="p-4 text-xs text-grey-400">Memuat…</div>
            <div v-else-if="!daftar.length" class="p-4 text-xs text-center text-grey-400">Belum ada booking aktif.</div>
            <ul v-else class="divide-y divide-grey-75">
              <li v-for="j in daftar" :key="j.uuid" class="px-3 py-2 text-xs">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <div class="font-semibold">{{ j.namaPasien }} <span v-if="!j.patientUuid" class="px-1 font-normal rounded bg-warning-50 text-warning-400">baru</span></div>
                    <div class="text-grey-500">{{ j.noRm ?? "" }} {{ j.noHp ? `· ${j.noHp}` : "" }}</div>
                    <div :class="lewat(j) ? 'text-danger-300' : ''">{{ tglIndo(j.tanggal, true) }} · {{ labelJam(j.jamSlot) }} · {{ j.bed }}{{ lewat(j) ? " (lewat)" : "" }}</div>
                    <div v-if="j.catatan" class="text-grey-400">{{ j.catatan }}</div>
                  </div>
                  <ChipStatus jenis="jadwal" :status="j.status" />
                </div>
                <div class="flex justify-end gap-2 mt-1">
                  <button class="px-2 py-0.5 rounded border border-danger-200 text-danger-300" @click="bukaBatal(j)">Batal</button>
                  <button class="px-2 py-0.5 rounded bg-opensimrs-300 text-white" @click="bukaLanjut(j)">Lanjutkan ke Order</button>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogBatal" width="min(440px, 94vw)" headerBg="bg-danger-300">
      <template #header>Batalkan Booking</template>
      <template #body>
        <p class="mb-3 text-sm">Booking <b>{{ dibatal?.namaPasien }}</b> ({{ tglIndo(dibatal?.tanggal) }} {{ labelJam(dibatal?.jamSlot) }}) dibatalkan dan slot kembali tersedia.</p>
        <CustomTextArea v-model="alasan" label="Alasan (opsional)" />
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Kembali" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="dialogBatal = false" />
          <CustomButton label="Ya, Batalkan" backgroundColor="bg-danger-300" @click="batal" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogLanjut" width="min(860px, 96vw)">
      <template #header>Lanjutkan Booking ke Order Terapi</template>
      <template #body>
        <div class="flex flex-col gap-4">
          <div class="p-2 text-xs rounded bg-opensimrs-50">
            Jadwal booking ({{ tglIndo(dilanjut?.tanggal, true) }} · {{ labelJam(dilanjut?.jamSlot) }} · {{ dilanjut?.bed }}) menjadi sesi ke-1 order ini.
          </div>
          <div v-if="dilanjut && !dilanjut.patientUuid" class="text-xs text-warning-400">
            Booking pasien baru ({{ dilanjut.namaPasien }}, {{ dilanjut.noHp }}): cari pasien yang sudah didaftarkan di Admisi.
          </div>
          <PilihPasien v-model="pasienLanjut" label="Pasien" :invalidMessage="galatLanjut" />
          <CustomSelect
            v-model="caraBayar"
            label="Cara Bayar"
            :options="[{ value: 1, label: 'Tunai / Umum' }, { value: 2, label: 'Asuransi / Penjamin' }]"
            optionLabel="label"
            optionValue="value"
            class="md:w-1/2"
          />
          <IsianOrderFisio ref="refIsian" v-model="isian" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="dialogLanjut = false" />
          <CustomButton label="Buat Order" icon="PhFloppyDisk" @click="lanjut" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
