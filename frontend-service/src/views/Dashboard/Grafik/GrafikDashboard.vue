<script setup lang="ts">
import { computed } from "vue";
import Chart from "primevue/chart";

// Grafik ringkas Dashboard: batang (bawaan) atau garis, sumbu menyesuaikan data (tidak dikunci), satuan angka atau
// Rupiah (rb/jt/M di sumbu, nilai penuh di tooltip). Seri yang seluruhnya nol disembunyikan agar tidak mengotori legenda.
const props = withDefaults(defineProps<{
  labels: string[];
  datasets: Array<{ label: string; data: number[]; warna: string }>;
  jenis?: "bar" | "line";
  satuan?: "angka" | "rupiah";
  bertumpuk?: boolean;
  horizontal?: boolean;
  tinggi?: string;
  judulSumbu?: string;
}>(), { jenis: "bar", satuan: "angka", bertumpuk: false, horizontal: false, tinggi: "300px", judulSumbu: "" });

const rupiahPendek = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (a >= 1e6) return `${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (a >= 1e3) return `${(v / 1e3).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  return v.toLocaleString("id-ID");
};
const nilaiPenuh = (v: number) => (props.satuan === "rupiah"
  ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v)
  : v.toLocaleString("id-ID"));

const seri = computed(() => props.datasets.filter((d) => d.data.some((n) => Number(n) !== 0)));
const kosong = computed(() => !seri.value.length);

const data = computed(() => ({
  labels: props.labels,
  datasets: seri.value.map((d) => (props.jenis === "line"
    ? { label: d.label, data: d.data, borderColor: d.warna, backgroundColor: d.warna, borderWidth: 2, tension: 0, pointRadius: 3, pointHoverRadius: 5, fill: false }
    : { label: d.label, data: d.data, backgroundColor: d.warna, borderRadius: 4, maxBarThickness: 28, categoryPercentage: 0.8, barPercentage: 0.9 })),
}));

const options = computed(() => {
  const sumbuNilai = {
    beginAtZero: true,
    stacked: props.bertumpuk,
    grid: { color: "#EEF0F3" },
    border: { display: false },
    ticks: {
      color: "#667085",
      precision: 0,
      callback: (v: number) => (props.satuan === "rupiah" ? rupiahPendek(Number(v)) : Number(v).toLocaleString("id-ID")),
    },
    title: props.judulSumbu ? { display: true, text: props.judulSumbu, color: "#667085" } : undefined,
  };
  const sumbuLabel = {
    stacked: props.bertumpuk,
    grid: { display: false },
    border: { display: false },
    ticks: { color: "#667085", autoSkip: true, maxRotation: 0, maxTicksLimit: props.horizontal ? undefined : 12 },
  };
  return {
    maintainAspectRatio: false,
    indexAxis: props.horizontal ? "y" : "x",
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: seri.value.length > 1,
        position: "bottom",
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, color: "#344054", font: { family: "Poppins", size: 12 } },
      },
      tooltip: { callbacks: { label: (c: any) => `${c.dataset.label}: ${nilaiPenuh(Number(c.raw ?? 0))}` } },
    },
    scales: props.horizontal ? { x: sumbuNilai, y: sumbuLabel } : { x: sumbuLabel, y: sumbuNilai },
  };
});
</script>

<template>
  <div class="px-5 pb-5">
    <div v-if="kosong" class="flex items-center justify-center text-sm text-grey-300" :style="{ height: tinggi }">
      Belum ada data pada periode ini
    </div>
    <Chart v-else :type="jenis" :data="data" :options="options" :style="{ height: tinggi }" />
  </div>
</template>
