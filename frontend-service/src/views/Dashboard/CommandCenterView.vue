<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue"
import { apiLaporanGet } from "@/utils/apiHandler"

type Indikator = {
  kode: string
  definisi: string
  sumber: string | null
  status_sumber: string
  diperbarui_pada: number | null
  kesegaran: string
  nilai: unknown
}

const indikator = ref<Indikator[]>([])
const diperbaruiPada = ref<number | null>(null)
const memuat = ref(true)
const gagal = ref(false)
const layarBesar = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

const muatRingkasan = async () => {
  try {
    const hasil = await apiLaporanGet("/command-center/ringkasan")
    const payload = hasil?.payload ?? hasil?.data?.payload
    if (!payload) throw new Error("Respons ringkasan tidak tersedia")
    indikator.value = payload.indikator ?? []
    diperbaruiPada.value = payload.diperbarui_pada ?? null
    gagal.value = false
  } catch {
    gagal.value = true
  } finally {
    memuat.value = false
  }
}

const formatWaktu = (waktu: number | null) => waktu
  ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "medium" }).format(waktu * 1000)
  : "Belum tersedia"

onMounted(() => {
  void muatRingkasan()
  timer = setInterval(() => void muatRingkasan(), 30_000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <main class="command-center" :class="{ 'command-center--layar-besar': layarBesar }">
    <header class="command-center__header">
      <div>
        <h1>Command Center</h1>
        <p>Ringkasan operasional agregat. Data pasien perorangan tidak ditampilkan.</p>
      </div>
      <button type="button" @click="layarBesar = !layarBesar">
        {{ layarBesar ? "Keluar dari mode layar besar" : "Mode layar besar" }}
      </button>
    </header>

    <p v-if="memuat" role="status">Memuat indikator…</p>
    <p v-else-if="gagal" role="alert">Pembaruan gagal. Nilai terakhir tetap dipertahankan; coba lagi pada polling berikutnya.</p>
    <p v-if="diperbaruiPada" class="command-center__updated">
      Permintaan terakhir: {{ formatWaktu(diperbaruiPada) }} · Polling setiap 30 detik
    </p>

    <section class="command-center__grid" aria-label="Indikator operasional">
      <article v-for="item in indikator" :key="item.kode" class="command-center__card">
        <h2>{{ item.kode.replaceAll("_", " ") }}</h2>
        <p class="command-center__value">{{ item.status_sumber === "tersedia" ? item.nilai : "Belum tersedia" }}</p>
        <p>{{ item.definisi }}</p>
        <dl>
          <dt>Sumber</dt><dd>{{ item.sumber ?? "Belum tersedia" }}</dd>
          <dt>Diperbarui</dt><dd>{{ formatWaktu(item.diperbarui_pada) }}</dd>
          <dt>Kesegaran</dt><dd>{{ item.kesegaran.replaceAll("_", " ") }}</dd>
        </dl>
      </article>
    </section>
    <p v-if="!memuat" class="command-center__note">
      Sumber bed, IGD, antrean poli, dan admisi belum terhubung ke ringkasan laporan. Angka operasional tidak ditampilkan sampai sumber dan definisinya tersedia.
    </p>
  </main>
</template>

<style scoped>
.command-center { padding: 1.5rem; color: #263238; }
.command-center__header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.command-center__header h1 { margin-bottom: .25rem; }
.command-center__header p, .command-center__note { color: #52616b; }
.command-center__header button { border: 1px solid #78909c; border-radius: .5rem; padding: .65rem 1rem; background: white; cursor: pointer; }
.command-center__updated { margin: 1rem 0; }
.command-center__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
.command-center__card { border: 1px solid #d5dde1; border-radius: .75rem; padding: 1.25rem; background: white; }
.command-center__card h2 { text-transform: capitalize; font-size: 1.1rem; }
.command-center__value { font-size: 1.5rem; font-weight: 700; }
.command-center__card dl { display: grid; grid-template-columns: auto 1fr; gap: .35rem .75rem; }
.command-center__card dt { font-weight: 600; }
.command-center__card dd { margin: 0; }
.command-center__note { margin-top: 1rem; }
.command-center--layar-besar { padding: 3rem; font-size: 1.25rem; }
.command-center--layar-besar .command-center__value { font-size: 2.25rem; }
</style>
