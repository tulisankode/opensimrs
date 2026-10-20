<script setup lang="ts">
import { computed } from "vue";
import { hariBulan, isoWib, type PolaShift, type Penempatan, type Temuan } from "@/stores/penunjang/jadwalDinas";
import { jamMenit, warnaShift } from "./tampilan";

// Grid jadwal bulanan pegawai × tanggal. Header tanggal dan kolom pegawai lengket; sel shift berupa lencana berwarna
// per kode shift. Temuan validasi (pemblokir/peringatan) ditandai pada sel, nama pegawai, atau tanggal terkait.
const props = defineProps<{
  periode: number;
  pegawai: { uuid: string; nama: string }[];
  pola: PolaShift[];
  penempatan: Penempatan[];
  perubahan: Record<string, string>;
  sunting: boolean;
  temuan?: Temuan[];
}>();
const emit = defineEmits<{ ubah: [pegawai: string, tanggal: number, pola: string] }>();

const NAMA_HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const tanggal = computed(() => hariBulan(props.periode));
const hari = (t: number) => new Date((Number(t) + 25200) * 1000).getUTCDay();
const polaAktif = computed(() => props.pola.filter((x) => x.aktif));
const cari = (p: string, t: number) => props.penempatan.find((x) => x.kepegawaianUuid === p && Number(x.tanggalKerja) === t);
const nilai = (p: string, t: number) => props.perubahan[`${p}:${t}`] ?? cari(p, t)?.polaShiftUuid ?? "";
const berubah = (p: string, t: number) => props.perubahan[`${p}:${t}`] !== undefined;

type InfoShift = Pick<PolaShift, "kode" | "libur" | "mulaiMenit" | "selesaiMenit" | "lintasHari">;
const labelPola = (s: InfoShift) => s.libur
  ? `${s.kode} (Libur)`
  : `${s.kode} ${jamMenit(s.mulaiMenit)}–${jamMenit(s.selesaiMenit)}${s.lintasHari ? " (+1 hari)" : ""}`;
// Saat menyunting, warna sel mengikuti pola yang sedang dipilih (termasuk perubahan lokal).
const shiftSel = (p: string, t: number): InfoShift | undefined => {
  if (props.sunting || berubah(p, t)) {
    const uuid = nilai(p, t);
    const s = props.pola.find((x) => x.uuid === uuid);
    if (s) return s;
    if (!uuid) return undefined;
  }
  const x = cari(p, t);
  return x?.potretShift ?? props.pola.find((s) => s.uuid === x?.polaShiftUuid);
};

// Indeks temuan: per sel, per pegawai (tanpa tanggal), dan per tanggal (tanpa pegawai, mis. kekurangan staf).
const kunci = (p?: string, t?: number) => `${p ?? ""}:${t ?? ""}`;
const indeksTemuan = computed(() => {
  const m = new Map<string, Temuan[]>();
  for (const x of props.temuan ?? []) {
    const k = kunci(x.kepegawaianUuid, x.tanggalKerja == null ? undefined : Number(x.tanggalKerja));
    m.set(k, [...(m.get(k) ?? []), x]);
  }
  return m;
});
const temuanDi = (p?: string, t?: number) => indeksTemuan.value.get(kunci(p, t)) ?? [];
const tingkat = (daftar: Temuan[]) => daftar.some((x) => x.tingkat === "pemblokir") ? "pemblokir" : daftar.length ? "peringatan" : "";
const ringkasTemuan = (daftar: Temuan[]) => daftar.map((x) => `${x.tingkat === "pemblokir" ? "Pemblokir" : "Peringatan"}: ${x.message}`).join("\n");
const judulSel = (p: string, t: number) => {
  const s = shiftSel(p, t), daftar = temuanDi(p, t);
  return [s ? labelPola(s) : "Kosong", berubah(p, t) ? "Perubahan lokal belum disimpan" : "", ringkasTemuan(daftar)].filter(Boolean).join("\n");
};
const kelasSel = (p: string, t: number) => {
  const tk = tingkat(temuanDi(p, t));
  if (tk === "pemblokir") return "bg-danger-50 ring-2 ring-inset ring-danger-300";
  if (tk === "peringatan") return "bg-warning-50 ring-2 ring-inset ring-warning-300";
  if (berubah(p, t)) return "bg-warning-50/60";
  return [0, 6].includes(hari(t)) ? "bg-grey-50" : "bg-white";
};
</script>

<template>
  <div class="overflow-auto border rounded-lg max-h-[65vh] border-grey-100">
    <table class="text-xs border-separate border-spacing-0 min-w-full">
      <thead>
        <tr>
          <th class="sticky top-0 left-0 z-30 px-3 py-2 text-left border-b border-r bg-opensimrs-50 border-grey-100 min-w-48">Pegawai</th>
          <th
            v-for="t in tanggal"
            :key="t"
            class="sticky top-0 z-20 px-1 py-1 text-center border-b border-r border-grey-100 min-w-[3.25rem]"
            :class="[
              tingkat(temuanDi(undefined, t)) === 'pemblokir' ? 'bg-danger-50 text-danger-400' : tingkat(temuanDi(undefined, t)) ? 'bg-warning-50 text-warning-400' : [0, 6].includes(hari(t)) ? 'bg-grey-75' : 'bg-opensimrs-50',
            ]"
            :title="ringkasTemuan(temuanDi(undefined, t)) || isoWib(t)"
          >
            <div class="text-sm font-semibold leading-tight">{{ isoWib(t).slice(-2) }}</div>
            <div class="font-normal leading-tight" :class="hari(t) === 0 ? 'text-danger-300' : 'text-grey-400'">{{ NAMA_HARI[hari(t)] }}</div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in pegawai" :key="p.uuid">
          <th
            class="sticky left-0 z-10 px-3 py-1 font-semibold text-left whitespace-nowrap border-b border-r border-grey-100"
            :class="tingkat(temuanDi(p.uuid)) === 'pemblokir' ? 'bg-danger-50 text-danger-400' : tingkat(temuanDi(p.uuid)) ? 'bg-warning-50 text-warning-400' : 'bg-white'"
            :title="ringkasTemuan(temuanDi(p.uuid)) || undefined"
          >
            {{ p.nama }}
          </th>
          <td
            v-for="t in tanggal"
            :id="`sel-${p.uuid}-${t}`"
            :key="t"
            tabindex="-1"
            class="relative p-1 text-center border-b border-r border-grey-100 focus:outline focus:outline-2 focus:outline-opensimrs-300"
            :class="kelasSel(p.uuid, t)"
            :title="judulSel(p.uuid, t)"
          >
            <select
              v-if="sunting"
              :aria-label="`${p.nama}, ${isoWib(t)}`"
              :value="nilai(p.uuid, t)"
              class="h-7 px-1 text-xs font-semibold text-center border rounded-md appearance-none cursor-pointer w-28"
              :class="warnaShift(shiftSel(p.uuid, t)?.kode, shiftSel(p.uuid, t)?.libur)"
              @change="emit('ubah', p.uuid, t, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Kosong</option>
              <option v-for="s in polaAktif" :key="s.uuid" :value="s.uuid">{{ labelPola(s) }}</option>
            </select>
            <span
              v-else-if="shiftSel(p.uuid, t)"
              class="inline-flex items-center justify-center h-6 px-1.5 font-semibold border rounded-md min-w-8"
              :class="warnaShift(shiftSel(p.uuid, t)?.kode, shiftSel(p.uuid, t)?.libur)"
            >{{ shiftSel(p.uuid, t)?.kode }}</span>
            <span v-else class="text-grey-200">—</span>
            <span
              v-if="tingkat(temuanDi(p.uuid, t))"
              class="absolute top-0 right-0 w-2 h-2 rounded-full"
              :class="tingkat(temuanDi(p.uuid, t)) === 'pemblokir' ? 'bg-danger-300' : 'bg-warning-300'"
              aria-hidden="true"
            />
          </td>
        </tr>
        <tr v-if="!pegawai.length">
          <td :colspan="tanggal.length + 1" class="p-4 text-center text-grey-400">Belum ada pegawai pada unit dan periode ini.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
