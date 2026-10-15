<script setup lang="ts">
import { computed, ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import {
  MODALITAS_RAD,
  buatJadwalRad,
  keTanggal,
  menungguJadwalRad,
  papanJadwalRad,
  ubahJadwalRad,
} from "@/stores/penunjang/radiologi";

// Dialog jadwalkan / ubah jadwal pemeriksaan radiologi.
// - Jadwal baru: `order` (dari daftar menunggu / detail order; berisi items menunggu jadwal) atau pilih order di dialog
//   (mis. klik slot kosong pada papan: `awal` berisi ruang, tanggal & jam).
// - Ubah: `jadwal` (baris jadwal); item tidak dapat diganti, ruang/tanggal/jam boleh.
// Slot dipilih dari papan ruang pada tanggal tsb; "Segera" = slot kosong terdekat hari ini (CITO/IGD).
const visible = defineModel<boolean>("visible", { default: false });
const props = defineProps<{
  order?: any | null;
  jadwal?: any | null;
  awal?: { ruangUuid?: string; tanggal?: string; jamMulai?: string } | null;
}>();
const emit = defineEmits<{ (e: "tersimpan", jadwal: any): void }>();

const orderAktif = ref<any>(null);
const menunggu = ref<any[]>([]);
const itemDipilih = ref<string[]>([]);
const ruangUuid = ref("");
const tanggal = ref<Date>(new Date());
const jamMulai = ref("");
const catatan = ref("");
const papan = ref<any[]>([]);
const galat = ref("");
const memuat = ref(false);

const modeUbah = computed(() => !!props.jadwal);
const dariIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Modalitas yang perlu dilayani ruang: item terpilih (baru) atau item jadwal (ubah).
const modalitasPerlu = computed<string[]>(() => {
  const items = modeUbah.value ? props.jadwal?.items ?? [] : (orderAktif.value?.items ?? []).filter((i: any) => itemDipilih.value.includes(i.uuid));
  return [...new Set<string>(items.map((i: any) => i.modalitas))];
});
const ruangCocok = computed(() => papan.value.filter((r) => modalitasPerlu.value.every((m) => r.modalitas.includes(m))));
const ruangTerpilih = computed(() => papan.value.find((r) => r.uuid === ruangUuid.value));
const opsiRuang = computed(() =>
  ruangCocok.value.map((r) => ({ value: r.uuid, label: `${r.nama} · ${r.modalitas.join("/")}${r.buka ? ` · ${r.tersedia} slot kosong` : " · tutup"}` }))
);
const opsiOrder = computed(() =>
  menunggu.value.map((o) => ({ value: o.uuid, label: `${o.cito ? "[CITO] " : ""}${o.noOrder} · ${o.namaPasien} · ${o.items.map((i: any) => i.nama).join(", ")}` }))
);

const muatPapan = async () => {
  memuat.value = true;
  try {
    papan.value = (await papanJadwalRad(keTanggal(tanggal.value)))?.payload?.ruang ?? [];
  } finally {
    memuat.value = false;
  }
  if (ruangUuid.value && !ruangCocok.value.some((r) => r.uuid === ruangUuid.value)) ruangUuid.value = "";
  if (!ruangUuid.value && ruangCocok.value.length === 1) ruangUuid.value = ruangCocok.value[0].uuid;
};

const pilihOrder = (uuid: string) => {
  orderAktif.value = menunggu.value.find((o) => o.uuid === uuid) ?? null;
  // Bawaan: item yang dapat dikerjakan di ruang awal (bila ada), selain itu semua item satu modalitas pertama.
  const items = orderAktif.value?.items ?? [];
  const ruangAwal = papan.value.find((r) => r.uuid === ruangUuid.value);
  const cocok = ruangAwal ? items.filter((i: any) => ruangAwal.modalitas.includes(i.modalitas)) : items.filter((i: any) => i.modalitas === items[0]?.modalitas);
  itemDipilih.value = cocok.map((i: any) => i.uuid);
  if (ruangUuid.value && !ruangCocok.value.some((r) => r.uuid === ruangUuid.value)) ruangUuid.value = "";
  if (!ruangUuid.value && ruangCocok.value.length === 1) ruangUuid.value = ruangCocok.value[0].uuid;
};

watch(visible, async (v) => {
  if (!v) return;
  galat.value = "";
  catatan.value = props.jadwal?.catatan ?? "";
  jamMulai.value = props.jadwal?.jamMulai ?? props.awal?.jamMulai ?? "";
  ruangUuid.value = props.jadwal?.ruangUuid ?? props.awal?.ruangUuid ?? "";
  const tgl = props.jadwal?.tanggal ?? props.awal?.tanggal;
  tanggal.value = tgl && tgl >= keTanggal(new Date()) ? dariIso(tgl) : new Date();
  orderAktif.value = null;
  itemDipilih.value = [];
  await muatPapan();
  if (props.order) {
    menunggu.value = [props.order];
    pilihOrder(props.order.uuid);
  } else if (!props.jadwal) {
    const semua = (await menungguJadwalRad())?.payload ?? [];
    const r = papan.value.find((x) => x.uuid === ruangUuid.value);
    menunggu.value = r ? semua.filter((o: any) => o.items.some((i: any) => r.modalitas.includes(i.modalitas))) : semua;
  }
});

const toggleItem = (uuid: string) => {
  itemDipilih.value = itemDipilih.value.includes(uuid) ? itemDipilih.value.filter((x) => x !== uuid) : [...itemDipilih.value, uuid];
  if (ruangUuid.value && !ruangCocok.value.some((r) => r.uuid === ruangUuid.value)) {
    ruangUuid.value = "";
    jamMulai.value = "";
  }
  if (!ruangUuid.value && ruangCocok.value.length === 1) ruangUuid.value = ruangCocok.value[0].uuid;
};
const gantiTanggal = async () => {
  jamMulai.value = "";
  await muatPapan();
};
const slotBisa = (s: any) => !s.lewat && (!s.jadwal || s.jadwal.uuid === props.jadwal?.uuid);

const kirim = async (segera = false) => {
  galat.value = "";
  if (!modeUbah.value && !orderAktif.value) return (galat.value = "Pilih order yang akan dijadwalkan");
  if (!modeUbah.value && !itemDipilih.value.length) return (galat.value = "Pilih minimal satu pemeriksaan");
  if (!ruangUuid.value) return (galat.value = "Pilih ruang pemeriksaan");
  if (!segera && !jamMulai.value) return (galat.value = "Pilih jam (slot) pemeriksaan");
  const data = { ruangUuid: ruangUuid.value, catatan: catatan.value, ...(segera ? { segera: true } : { tanggal: keTanggal(tanggal.value), jamMulai: jamMulai.value }) };
  const res = modeUbah.value
    ? await ubahJadwalRad(props.jadwal.uuid, data)
    : await buatJadwalRad({ ...data, orderUuid: orderAktif.value.uuid, itemUuids: itemDipilih.value });
  if (res?.payload) {
    visible.value = false;
    emit("tersimpan", res.payload);
  }
};
</script>

<template>
  <CustomDialog v-model:visible="visible" width="860px">
    <template #header>{{ modeUbah ? `Ubah Jadwal — ${jadwal?.noOrder}` : "Jadwalkan Pemeriksaan Radiologi" }}</template>
    <template #body>
      <div class="flex flex-col gap-4 pt-4 text-sm">
        <!-- Order & item -->
        <div v-if="modeUbah" class="p-3 rounded-lg bg-opensimrs-50">
          <b>{{ jadwal?.namaPasien }}</b> ({{ jadwal?.noRm }}) · {{ jadwal?.noOrder }}
          <div class="text-grey-500">{{ (jadwal?.items ?? []).map((i: any) => i.nama).join(", ") }}</div>
        </div>
        <template v-else>
          <CustomSelect
            v-if="!order"
            :modelValue="orderAktif?.uuid ?? ''"
            label="Order menunggu jadwal"
            placeHolder="Pilih order tervalidasi"
            :options="opsiOrder"
            optionValue="value"
            optionLabel="label"
            required
            @update:modelValue="pilihOrder"
          />
          <div v-if="orderAktif" class="p-3 rounded-lg bg-opensimrs-50">
            <div>
              <span v-if="orderAktif.cito" class="px-1.5 mr-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
              <b>{{ orderAktif.namaPasien }}</b> ({{ orderAktif.noRm }}) · {{ orderAktif.noOrder }}
            </div>
            <div v-if="orderAktif.klinis" class="text-grey-500">Klinis: {{ orderAktif.klinis }}</div>
            <div class="mt-2 text-xs font-semibold">Pemeriksaan yang dijadwalkan (satu ruang, satu slot):</div>
            <div class="flex flex-wrap gap-3 mt-1">
              <label v-for="i in orderAktif.items" :key="i.uuid" class="flex items-center gap-2 cursor-pointer">
                <Checkbox :modelValue="itemDipilih.includes(i.uuid)" binary @update:modelValue="toggleItem(i.uuid)" />
                {{ i.nama }} <span class="text-grey-400">({{ i.modalitas }})</span>
              </label>
            </div>
          </div>
        </template>

        <!-- Ruang & tanggal -->
        <div class="grid grid-cols-2 gap-4">
          <CustomSelect
            v-model="ruangUuid"
            label="Ruang / Alat"
            :placeHolder="modalitasPerlu.length ? `Ruang yang melayani ${modalitasPerlu.join(', ')}` : 'Pilih ruang'"
            :options="opsiRuang"
            optionValue="value"
            optionLabel="label"
            required
            :showFilter="false"
            @update:modelValue="jamMulai = ''"
          />
          <CustomDatePicker v-model="tanggal" label="Tanggal pemeriksaan" :minDate="new Date()" @date-select="gantiTanggal" />
        </div>
        <div v-if="modalitasPerlu.length && !ruangCocok.length && !memuat" class="text-danger-300">
          Belum ada ruang aktif yang melayani {{ modalitasPerlu.map((m) => MODALITAS_RAD[m] ?? m).join(" + ") }}. Tambahkan di Datamaster › Ruang &amp; Alat,
          atau jadwalkan item per modalitas secara terpisah.
        </div>

        <!-- Slot -->
        <div v-if="ruangTerpilih">
          <div class="flex items-center justify-between mb-1">
            <div class="font-semibold">
              Slot {{ ruangTerpilih.nama }} — {{ ruangTerpilih.jamBuka }}–{{ ruangTerpilih.jamTutup }}, {{ ruangTerpilih.durasiSlot }} menit
            </div>
            <div class="text-xs text-grey-400">{{ ruangTerpilih.tersedia }} slot kosong</div>
          </div>
          <div v-if="!ruangTerpilih.buka" class="p-3 text-center rounded-lg bg-grey-50 text-grey-400">Ruang tidak beroperasi pada hari ini.</div>
          <div v-else class="grid grid-cols-6 gap-1.5 overflow-auto max-h-[220px] pr-1">
            <button
              v-for="s in ruangTerpilih.slot"
              :key="s.jamMulai"
              type="button"
              :disabled="!slotBisa(s)"
              class="px-1 py-1.5 text-xs border rounded"
              :class="
                jamMulai === s.jamMulai
                  ? 'bg-opensimrs-300 border-opensimrs-300 text-white font-semibold'
                  : !slotBisa(s)
                    ? s.jadwal
                      ? 'bg-info-50 border-info-75 text-grey-400 cursor-not-allowed'
                      : 'bg-grey-50 border-grey-75 text-grey-300 cursor-not-allowed'
                    : 'border-dashed border-grey-200 hover:bg-opensimrs-50'
              "
              :title="s.jadwal ? `Terisi: ${s.jadwal.namaPasien}` : s.lewat ? 'Sudah lewat' : 'Tersedia'"
              @click="jamMulai = s.jamMulai"
            >
              {{ s.jamMulai }}
              <div class="text-[10px] truncate">{{ s.jadwal && s.jadwal.uuid !== jadwal?.uuid ? s.jadwal.namaPasien : s.lewat ? "lewat" : "kosong" }}</div>
            </button>
          </div>
        </div>
        <CustomTextfield v-model="catatan" label="Catatan" placeholder="mis. pasien kursi roda, perlu pendamping" :maxLength="200" />
        <div v-if="galat" class="text-danger-300">{{ galat }}</div>
      </div>
    </template>
    <template #footer>
      <div class="flex flex-wrap justify-end gap-2">
        <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="visible = false" />
        <CustomButton
          label="Segera (slot terdekat hari ini)"
          icon="PhLightning"
          outlined
          borderColor="border-danger-300"
          textColor="text-danger-300"
          @click="kirim(true)"
        />
        <CustomButton :label="modeUbah ? 'Simpan Perubahan' : 'Jadwalkan'" icon="PhCalendarCheck" @click="kirim(false)" />
      </div>
    </template>
  </CustomDialog>
</template>
