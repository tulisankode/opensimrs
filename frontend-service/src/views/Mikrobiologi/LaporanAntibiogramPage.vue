<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import * as XLSX from "xlsx-js-style";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { PELAYANAN_MIKRO, SPESIMEN_MIKRO, izinMikro, keTanggal, laporanAntibiogramMikro, namaSpesimen } from "@/stores/penunjang/mikrobiologi";
import { createAntibiogramMikroPdf } from "@/utils/pdf/pdfMikrobiologi/cetakMikrobiologi";

// Antibiogram kumulatif: persentase sensitif (%S) per organisme × antibiotik dari hasil FINAL dalam periode (tanggal
// pengambilan spesimen), default isolat pertama per pasien per spesies (CLSI M39). Jumlah isolat selalu ditampilkan;
// organisme < 30 isolat ditandai karena persentasenya kurang dapat diandalkan.
const storeUtils = utilsStore();
const bolehCetak = izinMikro("Laporan Mikrobiologi", "CETAK LAPORAN", "Antibiogram");

const awalTahun = () => new Date(new Date().getFullYear(), 0, 1);
const tglMulai = ref<Date | null>(awalTahun());
const tglSelesai = ref<Date | null>(new Date());
const filterSpesimen = ref<string[]>([]);
const filterPelayanan = ref<string[]>([]);
const isolatPertama = ref(true);
const lap = ref<any>(null);
const FILTER = { spesimen: filterSpesimen, pelayanan: filterPelayanan };
const toggle = (jenis: keyof typeof FILTER, nilai: string) => {
  const d = FILTER[jenis];
  d.value = d.value.includes(nilai) ? d.value.filter((x) => x !== nilai) : [...d.value, nilai];
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await laporanAntibiogramMikro({
      tanggal_mulai: keTanggal(tglMulai.value ?? awalTahun()),
      tanggal_selesai: keTanggal(tglSelesai.value ?? new Date()),
      spesimen: filterSpesimen.value,
      pelayanan: filterPelayanan.value,
      isolat_pertama: isolatPertama.value ? 1 : 0,
    });
    lap.value = res?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};
const reset = () => {
  tglMulai.value = awalTahun();
  tglSelesai.value = new Date();
  filterSpesimen.value = [];
  filterPelayanan.value = [];
  isolatPertama.value = true;
  muat();
};

const GRUP = [
  ["negatif", "Gram negatif"],
  ["positif", "Gram positif"],
  ["jamur", "Jamur"],
  ["lain", "Lainnya (BTA, dll.)"],
];
const grup = computed(() => {
  const org: any[] = lap.value?.organisme ?? [];
  const ab: any[] = lap.value?.antibiotik ?? [];
  return GRUP.map(([kode, nama]) => {
    const baris = org.filter((o) => (kode === "lain" ? !["negatif", "positif", "jamur"].includes(o.gram) : o.gram === kode));
    return { kode, nama, baris, kolom: ab.filter((a) => baris.some((o) => o.kepekaan?.[a.uuid])) };
  }).filter((g) => g.baris.length);
});
const warna = (p: number) => (p >= 90 ? "bg-[#D1FADF] text-[#027A48]" : p >= 60 ? "bg-[#FEF0C7] text-[#B54708]" : "bg-[#FEE4E2] text-[#B42318]");

const keteranganFilter = computed(() =>
  [
    `Periode ${lap.value?.tanggalMulai ?? ""} s.d. ${lap.value?.tanggalSelesai ?? ""}`,
    filterSpesimen.value.length ? `Spesimen: ${filterSpesimen.value.map(namaSpesimen).join(", ")}` : "Semua spesimen",
    filterPelayanan.value.length ? `Pelayanan: ${filterPelayanan.value.map((p) => PELAYANAN_MIKRO[p] ?? p).join(", ")}` : "Semua pelayanan",
    isolatPertama.value ? "isolat pertama per pasien" : "semua isolat",
  ].join(" · "),
);
const cetak = () => lap.value && createAntibiogramMikroPdf(lap.value, keteranganFilter.value);
const unduhExcel = () => {
  if (!lap.value) return;
  const wb = XLSX.utils.book_new();
  for (const g of grup.value) {
    const baris = g.baris.map((o: any) => ({
      Organisme: o.nama,
      "Jumlah isolat": o.jumlahIsolat,
      "≥ 30 isolat": o.cukup ? "Ya" : "Tidak",
      ...Object.fromEntries(g.kolom.map((a: any) => [a.kode, o.kepekaan?.[a.uuid] ? `${o.kepekaan[a.uuid].persenS}% (${o.kepekaan[a.uuid].diuji})` : ""])),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(baris), g.nama.slice(0, 30));
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((lap.value.antibiotik ?? []).map((a: any) => ({ Kode: a.kode, Antibiotik: a.nama, Golongan: a.golongan }))), "Kode Antibiotik");
  XLSX.writeFile(wb, `Antibiogram ${lap.value.tanggalMulai} sd ${lap.value.tanggalSelesai}.xlsx`);
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Antibiogram</h1>
          <CustomDatePicker v-model="tglMulai" label="Tanggal mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Tanggal selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <ToolbarFilterMenu :count="filterSpesimen.length">
            <template #label>Spesimen</template>
            <CustomChip
              v-for="(nama, kode) in SPESIMEN_MIKRO"
              :key="kode"
              :label="nama"
              :value="String(kode)"
              :isSelected="filterSpesimen.includes(String(kode))"
              @selected="toggle('spesimen', $event)"
            />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterPelayanan.length + (isolatPertama ? 0 : 1)">
            <template #label>Lainnya</template>
            <CustomChip
              v-for="(nama, kode) in PELAYANAN_MIKRO"
              :key="kode"
              :label="nama"
              :value="String(kode)"
              :isSelected="filterPelayanan.includes(String(kode))"
              @selected="toggle('pelayanan', $event)"
            />
            <CustomChip label="Semua isolat (bukan hanya isolat pertama)" value="semua" :isSelected="!isolatPertama" @selected="isolatPertama = !isolatPertama" />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muat" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton v-if="bolehCetak" icon="PhPrinter" label="Cetak" :disabled="!lap" @click="cetak" />
          <CustomButton v-if="bolehCetak" icon="PhFileXls" label="Excel" :disabled="!lap" @click="unduhExcel" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!lap" />
        <div v-else class="flex flex-col gap-4 p-4">
          <div class="flex flex-wrap items-center gap-3 text-sm">
            <div class="px-3 py-2 border rounded-lg border-grey-75">
              <span class="text-grey-400">Total isolat:</span> <b class="text-opensimrs-400">{{ lap.totalIsolat }}</b>
            </div>
            <div class="px-3 py-2 border rounded-lg border-grey-75">
              <span class="text-grey-400">Organisme:</span> <b class="text-opensimrs-400">{{ lap.organisme.length }}</b>
            </div>
            <div class="text-xs text-grey-400">{{ keteranganFilter }}</div>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-xs">
            <span class="px-2 py-0.5 rounded bg-[#D1FADF] text-[#027A48]">≥ 90% sensitif</span>
            <span class="px-2 py-0.5 rounded bg-[#FEF0C7] text-[#B54708]">60–89%</span>
            <span class="px-2 py-0.5 rounded bg-[#FEE4E2] text-[#B42318]">&lt; 60%</span>
            <span class="text-grey-400">Angka = %S, kecil = jumlah isolat diuji. * = kurang dari {{ lap.minimalIsolat }} isolat (dianjurkan ≥ {{ lap.minimalIsolat }}).</span>
          </div>
          <div v-if="!grup.length" class="p-6 text-center text-grey-400">Belum ada isolat dengan hasil final pada periode/filter ini.</div>
          <div v-for="g in grup" :key="g.kode" class="flex flex-col gap-2">
            <div class="font-semibold">{{ g.nama }}</div>
            <div class="overflow-auto border rounded-lg border-grey-75">
              <table class="text-xs border-collapse">
                <thead>
                  <tr class="bg-opensimrs-50">
                    <th class="sticky left-0 z-10 px-2 py-1 text-left bg-opensimrs-50 min-w-[220px]">Organisme</th>
                    <th class="px-2 py-1">n</th>
                    <th v-for="a in g.kolom" :key="a.uuid" class="px-1 py-1 font-semibold min-w-[42px]" :title="`${a.nama} (${a.golongan ?? '-'})`">{{ a.kode }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="o in g.baris" :key="o.organismeUuid" class="border-t border-grey-75">
                    <td class="sticky left-0 z-10 px-2 py-1 bg-white">
                      <i class="font-semibold">{{ o.nama }}</i><span v-if="!o.cukup" class="font-bold text-danger-300"> *</span>
                      <div v-if="Object.keys(o.penanda ?? {}).length" class="text-[10px] text-danger-300">
                        {{ Object.entries(o.penanda).map(([k, v]) => `${k} ${v}`).join(" · ") }}
                      </div>
                    </td>
                    <td class="px-2 py-1 font-semibold text-center">{{ o.jumlahIsolat }}</td>
                    <td v-for="a in g.kolom" :key="a.uuid" class="px-1 py-1 text-center">
                      <div
                        v-if="o.kepekaan?.[a.uuid]"
                        class="px-1 rounded"
                        :class="warna(o.kepekaan[a.uuid].persenS)"
                        :title="`${a.nama}: S ${o.kepekaan[a.uuid].s} · I ${o.kepekaan[a.uuid].i} · R ${o.kepekaan[a.uuid].r} dari ${o.kepekaan[a.uuid].diuji}`"
                      >
                        <b>{{ o.kepekaan[a.uuid].persenS }}</b>
                        <div class="text-[9px] opacity-75">({{ o.kepekaan[a.uuid].diuji }})</div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-if="lap.antibiotik?.length" class="text-[11px] text-grey-400">
            <b>Kode:</b> {{ lap.antibiotik.map((a: any) => `${a.kode} = ${a.nama}`).join("; ") }}
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
