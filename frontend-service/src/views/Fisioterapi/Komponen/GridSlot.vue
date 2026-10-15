<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { apiFisio, type SlotJam, type JadwalFisio } from "@/stores/penunjang/fisioterapi";

// Grid ketersediaan bed per jam terapi pada satu tanggal. Sel kosong dapat dipilih (v-model:pilihan),
// sel terisi memancarkan `klik-jadwal`. `kecuali` = uuid jadwal yang sedang diubah (dianggap kosong).
const props = defineProps<{ tanggal: string; kecuali?: string | null; bisaPilih?: boolean; ringkas?: boolean }>();
const pilihan = defineModel<{ jamSlot: number; bedUuid: string } | null>("pilihan", { default: null });
const emit = defineEmits<{ (e: "klik-jadwal", j: JadwalFisio): void; (e: "dimuat", jam: SlotJam[]): void }>();

const jam = ref<SlotJam[]>([]);
const memuat = ref(false);

const muat = async () => {
  if (!props.tanggal) return;
  memuat.value = true;
  const r = await apiFisio.slot(props.tanggal);
  jam.value = r?.payload?.jam ?? [];
  memuat.value = false;
  emit("dimuat", jam.value);
};
watch(() => props.tanggal, () => {
  pilihan.value = null;
  muat();
});
onMounted(muat);
defineExpose({ muat });

const terisi = (b: SlotJam["bed"][number]) => b.jadwal && b.jadwal.uuid !== props.kecuali;
const dipilih = (s: number, b: string) => pilihan.value?.jamSlot === s && pilihan.value?.bedUuid === b;
const klik = (s: SlotJam, b: SlotJam["bed"][number]) => {
  if (terisi(b)) return emit("klik-jadwal", b.jadwal as JadwalFisio);
  if (props.bisaPilih) pilihan.value = dipilih(s.slot, b.uuid) ? null : { jamSlot: s.slot, bedUuid: b.uuid };
};
const warnaIsi = (j: JadwalFisio) =>
  ({ booking: "bg-warning-50 border-warning-75", selesai: "bg-success-50 border-success-75", hadir: "bg-opensimrs-50 border-opensimrs-200" })[j.status] ??
  "bg-info-50 border-info-75";
</script>

<template>
  <div class="relative">
    <div v-if="memuat" class="absolute inset-0 z-10 flex items-center justify-center text-xs bg-white/60">Memuat slot…</div>
    <div v-if="!jam.length || !jam[0].totalBed" class="p-6 text-sm text-center text-grey-400">
      Belum ada bed aktif. Tambahkan di Datamaster › Bed Ruangan.
    </div>
    <div v-else class="overflow-auto">
      <table class="w-full text-xs border-separate border-spacing-1">
        <thead>
          <tr>
            <th class="sticky left-0 z-[1] px-2 py-1 text-left bg-white min-w-[110px]">Jam Terapi</th>
            <th v-for="b in jam[0].bed" :key="b.uuid" class="px-2 py-1 font-semibold text-center min-w-[120px] bg-opensimrs-50 rounded">
              {{ b.nama }}<div class="font-normal text-[10px] text-grey-400">{{ b.ruangan }}</div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in jam" :key="s.slot">
            <td class="sticky left-0 z-[1] px-2 py-1 bg-white">
              <div class="font-semibold">{{ s.label }}</div>
              <div class="text-[10px]" :class="s.tersedia ? 'text-success-400' : 'text-danger-300'">{{ s.tersedia }}/{{ s.totalBed }} tersedia</div>
            </td>
            <td v-for="b in s.bed" :key="b.uuid" class="p-0">
              <button
                type="button"
                class="w-full h-full px-2 py-1.5 text-left border rounded min-h-[44px] transition-colors"
                :class="[
                  terisi(b)
                    ? warnaIsi(b.jadwal as JadwalFisio) + ' cursor-pointer'
                    : dipilih(s.slot, b.uuid)
                      ? 'bg-opensimrs-300 border-opensimrs-300 text-white'
                      : bisaPilih
                        ? 'border-dashed border-grey-200 hover:bg-opensimrs-50 text-grey-400'
                        : 'border-dashed border-grey-100 text-grey-300 cursor-default',
                ]"
                :aria-label="terisi(b) ? `Terisi: ${b.jadwal?.namaPasien}` : `Tersedia ${b.nama} ${s.label}`"
                @click="klik(s, b)"
              >
                <template v-if="terisi(b)">
                  <div class="font-semibold truncate">{{ b.jadwal?.namaPasien }}</div>
                  <div v-if="!ringkas" class="text-[10px] truncate text-grey-500">
                    {{ b.jadwal?.noOrder ?? "Booking" }}{{ b.jadwal?.sesiKe ? ` · Sesi ${b.jadwal.sesiKe}` : "" }}
                  </div>
                </template>
                <span v-else>{{ dipilih(s.slot, b.uuid) ? "Dipilih" : "Tersedia" }}</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
