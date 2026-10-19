<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Chart from 'primevue/chart'
import CustomButton from '@/components/Base/CustomButton.vue'
import CustomDialog from '@/components/Base/CustomDialog.vue'
import IconDashboard from '../../assets/icons/icon_returnDashboard.svg'
import { useAuthStore } from '@/stores/auth'
import { useDashboardStore } from '@/stores/dashboard'
import { warnaTema } from '@/utils/tema'

// Command Center (STD-0037): dasbor operasional agregat faskes aktif (tempat tidur, IGD, antrean poli & admisi) dengan
// peringatan ambang. Semua angka dihitung laporan-service dari faskes pada token; tidak ada identitas pasien. Data
// dipolling otomatis; bila pembaruan gagal, nilai terakhir tetap tampil dengan penanda terlambat/kedaluwarsa (KT-12).
const dashboardStore = useDashboardStore()
const authStore = useAuthStore()

const data = ref<any>(null)
const memuat = ref(false)
const gagal = ref(false)
const ditolak = ref('')
const jam = ref(Math.floor(Date.now() / 1000))
let timerPolling: ReturnType<typeof setInterval> | undefined
let timerJam: ReturnType<typeof setInterval> | undefined
let versi = 0

const muat = async () => {
  if (memuat.value) return
  const v = ++versi
  memuat.value = true
  try {
    const res = await dashboardStore.getRingkasanCommandCenter()
    if (v !== versi) return
    if (!res?.payload) throw new Error('Respons ringkasan tidak tersedia')
    data.value = res.payload
    gagal.value = false
    ditolak.value = ''
    aturPolling(res.payload.intervalPollingDetik)
  } catch (error: any) {
    if (v !== versi) return
    gagal.value = true
    const status = error?.response?.status
    if (status === 403 || status === 400) ditolak.value = error.response.data?.message ?? 'Akses Command Center ditolak'
  } finally {
    if (v === versi) memuat.value = false
  }
}

const intervalDetik = ref(30)
const aturPolling = (detik?: number) => {
  const d = Math.min(60, Math.max(30, Number(detik) || 30))
  if (timerPolling && d === intervalDetik.value) return
  intervalDetik.value = d
  if (timerPolling) clearInterval(timerPolling)
  timerPolling = setInterval(() => void muat(), d * 1000)
}

onMounted(() => {
  void muat()
  aturPolling(30)
  timerJam = setInterval(() => { jam.value = Math.floor(Date.now() / 1000) }, 5000)
  document.addEventListener('fullscreenchange', sinkronLayarPenuh)
})
onUnmounted(() => {
  versi++
  if (timerPolling) clearInterval(timerPolling)
  if (timerJam) clearInterval(timerJam)
  document.removeEventListener('fullscreenchange', sinkronLayarPenuh)
})
// Ganti faskes: data faskes lama tidak boleh tetap tampil.
watch(() => authStore.faskesUuid, () => {
  versi++
  memuat.value = false
  data.value = null
  void muat()
})

// Kesegaran dihitung dari waktu server terakhir yang berhasil (bukan dari jam permintaan yang gagal).
const kesegaran = computed(() => {
  if (!data.value?.diperbaruiPada) return { label: gagal.value ? 'Gagal memuat' : 'Memuat…', kelas: 'bg-grey-50 text-grey-400' }
  const umur = jam.value - data.value.diperbaruiPada
  if (umur <= intervalDetik.value * 2 && !gagal.value) return { label: 'Segar', kelas: 'bg-[#ECFDF3] text-[#0E7840]' }
  if (umur <= 300) return { label: 'Terlambat', kelas: 'bg-[#FFFAEB] text-[#B54708]' }
  return { label: 'Kedaluwarsa', kelas: 'bg-[#FEF3F2] text-[#B42318]' }
})
const pukul = (epoch?: number | null) => (epoch ? new Date(epoch * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-')
const waktu = (epoch?: number | null) => (epoch ? new Date(epoch * 1000).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-')
const angka = (v: any) => (v === null || v === undefined ? '–' : Number(v).toLocaleString('id-ID'))
const durasi = (menit: number | null | undefined) => {
  if (menit === null || menit === undefined) return '–'
  const m = Math.round(Number(menit))
  if (m < 60) return `${m} mnt`
  return `${Math.floor(m / 60)} j ${m % 60} mnt`
}
const nilaiSatuan = (nilai: number | null, satuan: string) => {
  if (nilai === null || nilai === undefined) return '–'
  if (satuan === '%') return `${Number(nilai).toLocaleString('id-ID')}%`
  if (satuan === 'menit') return durasi(nilai)
  if (satuan === 'jam') return `${Number(nilai).toLocaleString('id-ID')} jam`
  return `${Number(nilai).toLocaleString('id-ID')} ${satuan}`
}

const tt = computed(() => data.value?.tempatTidur)
const igd = computed(() => data.value?.igd)
const poli = computed(() => data.value?.antreanPoli)
const admisi = computed(() => data.value?.antreanAdmisi)
const izin = computed(() => data.value?.izin ?? {})
const peringatan = computed(() => data.value?.peringatan ?? [])
const tersedia = (b: any) => b?.statusData === 'tersedia'

// Tingkat peringatan terberat per kelompok kartu (ditampilkan dengan teks, bukan warna saja).
const KELOMPOK: Record<string, string[]> = {
  bed: ['bor_total', 'bor_ruangan'],
  igd: ['igd_dirawat', 'igd_lama_jam'],
  kamar: ['igd_menunggu_kamar', 'igd_menunggu_kamar_jam'],
  poli: ['poli_menunggu', 'poli_tunggu_menit'],
  admisi: ['admisi_menunggu', 'admisi_tunggu_menit'],
}
const tingkatKelompok = (k: string) => {
  const p = peringatan.value.filter((x: any) => KELOMPOK[k].includes(x.kode))
  return p.some((x: any) => x.tingkat === 'kritis') ? 'kritis' : p.length ? 'peringatan' : null
}
const GAYA_TINGKAT: Record<string, { garis: string; teks: string; latar: string; label: string; ikon: string }> = {
  kritis: { garis: 'border-t-[#F04438]', teks: 'text-[#B42318]', latar: 'bg-[#FEF3F2]', label: 'KRITIS', ikon: 'PhWarningOctagon' },
  peringatan: { garis: 'border-t-[#F79009]', teks: 'text-[#B54708]', latar: 'bg-[#FFFAEB]', label: 'PERINGATAN', ikon: 'PhWarning' },
}
const garisKartu = (k: string) => GAYA_TINGKAT[tingkatKelompok(k) ?? '']?.garis ?? 'border-t-grey-100'

const kartu = computed(() => [
  {
    kode: 'bed', judul: 'BOR saat ini', bagian: tt.value,
    nilai: tt.value?.ringkasan?.bor === null || tt.value?.ringkasan?.bor === undefined ? '–' : `${angka(tt.value.ringkasan.bor)}%`,
    keterangan: tt.value?.ringkasan ? `${angka(tt.value.ringkasan.terisi)} terisi dari ${angka(tt.value.ringkasan.total)} bed` : '',
  },
  {
    kode: 'bed', judul: 'Bed kosong', bagian: tt.value, nilai: angka(tt.value?.ringkasan?.kosong),
    keterangan: tt.value?.ringkasan ? `${angka(tt.value.ringkasan.lainnya)} status lain · ${angka(tt.value.ringkasan.ruangan)} ruangan` : '',
  },
  {
    kode: 'igd', judul: 'Pasien di IGD', bagian: igd.value, nilai: angka(igd.value?.ringkasan?.dirawat),
    keterangan: igd.value?.ringkasan ? `terlama ${durasi(igd.value.ringkasan.terlamaDirawatMenit)} · ${angka(igd.value.ringkasan.kedatanganHariIni)} datang hari ini` : '',
  },
  {
    kode: 'kamar', judul: 'IGD menunggu kamar', bagian: igd.value, nilai: angka(igd.value?.ringkasan?.menungguKamar),
    keterangan: igd.value?.ringkasan ? `tunggu terlama ${durasi(igd.value.ringkasan.menungguKamarTerlamaMenit)}` : '',
  },
  {
    kode: 'poli', judul: 'Menunggu di poli', bagian: poli.value, nilai: angka(poli.value?.ringkasan?.menunggu),
    keterangan: poli.value?.ringkasan ? `terlama ${durasi(poli.value.ringkasan.terlamaMenungguMenit)} · rata-rata ${durasi(poli.value.ringkasan.rataTungguMenit)}` : '',
  },
  {
    kode: 'admisi', judul: 'Antrean admisi', bagian: admisi.value, nilai: angka(admisi.value?.ringkasan?.menunggu),
    keterangan: admisi.value?.ringkasan ? `terlama ${durasi(admisi.value.ringkasan.terlamaMenungguMenit)} · ${angka(admisi.value.ringkasan.selesai)} selesai` : '',
  },
])

const teksStatus = (b: any) => (b?.statusData === 'gagal' ? 'Gagal dimuat' : b?.statusData === 'belum_tersedia' ? 'Belum tersedia' : 'Memuat…')

// ── Grafik ──
const WARNA = { terisi: '#F04438', kosong: '#12B76A', lainnya: '#98A2B3', menunggu: '#F79009', dilayani: '#2E90FA', selesai: '#12B76A', booking: '#D0D5DD' }
const opsiBatang = (horizontal = false) => ({
  indexAxis: horizontal ? 'y' : 'x',
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
  scales: { x: { stacked: true, ticks: { precision: 0 } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
})
const grafikBed = computed(() => {
  const r = tt.value?.perRuangan ?? []
  return {
    labels: r.map((x: any) => x.ruangan),
    datasets: [
      { label: 'Terisi', data: r.map((x: any) => x.terisi), backgroundColor: WARNA.terisi, borderRadius: 3 },
      { label: 'Kosong', data: r.map((x: any) => x.kosong), backgroundColor: WARNA.kosong, borderRadius: 3 },
      { label: 'Status lain', data: r.map((x: any) => x.lainnya), backgroundColor: WARNA.lainnya, borderRadius: 3 },
    ],
  }
})
const grafikIgd = computed(() => ({
  labels: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')),
  datasets: [{ label: 'Kedatangan', data: igd.value?.kedatanganPerJam ?? [], backgroundColor: warnaTema('300'), borderRadius: 3 }],
}))
const opsiIgd = { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
const grafikPoli = computed(() => {
  const r = poli.value?.perPoli ?? []
  return {
    labels: r.map((x: any) => x.poli),
    datasets: [
      { label: 'Menunggu', data: r.map((x: any) => x.menunggu), backgroundColor: WARNA.menunggu, borderRadius: 3 },
      { label: 'Dilayani', data: r.map((x: any) => x.dilayani), backgroundColor: WARNA.dilayani, borderRadius: 3 },
      { label: 'Selesai', data: r.map((x: any) => x.selesai), backgroundColor: WARNA.selesai, borderRadius: 3 },
      { label: 'Booking', data: r.map((x: any) => x.booking), backgroundColor: WARNA.booking, borderRadius: 3 },
    ],
  }
})
const grafikAdmisi = computed(() => {
  const r = admisi.value?.ringkasan ?? {}
  return {
    labels: ['Menunggu', 'Dilayani', 'Terlewat', 'Selesai'],
    datasets: [{ data: [r.menunggu ?? 0, r.dilayani ?? 0, r.terlewat ?? 0, r.selesai ?? 0], backgroundColor: [WARNA.menunggu, WARNA.dilayani, WARNA.lainnya, WARNA.selesai], borderWidth: 0 }],
  }
})
const opsiDonat = { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } } }
const tinggiBed = computed(() => `${Math.max(180, (tt.value?.perRuangan?.length ?? 0) * 18 + 90)}px`)

// ── Mode layar besar (TV dinding) ──
const akar = ref<HTMLElement | null>(null)
const layarBesar = ref(false)
const sinkronLayarPenuh = () => { if (!document.fullscreenElement && layarBesar.value) layarBesar.value = false }
const alihLayarBesar = async () => {
  layarBesar.value = !layarBesar.value
  try {
    if (layarBesar.value && akar.value?.requestFullscreen) await akar.value.requestFullscreen()
    else if (!layarBesar.value && document.fullscreenElement) await document.exitFullscreen()
  } catch {
    // Peramban menolak layar penuh: tetap pakai tata letak layar besar di dalam jendela.
  }
}

// ── Tindakan peringatan (tinjau / eskalasi) ──
const dialogTindakan = ref(false)
const formTindakan = ref<{ peringatan: any; jenis: 'tinjau' | 'eskalasi'; catatan: string; tujuan: string }>({ peringatan: null, jenis: 'tinjau', catatan: '', tujuan: '' })
const galatTindakan = ref('')
const menyimpanTindakan = ref(false)
const bukaTindakan = (p: any, jenis: 'tinjau' | 'eskalasi') => {
  formTindakan.value = { peringatan: p, jenis, catatan: '', tujuan: '' }
  galatTindakan.value = ''
  dialogTindakan.value = true
}
const simpanTindakan = async () => {
  const f = formTindakan.value
  if (f.catatan.trim().length < 3) { galatTindakan.value = 'Catatan tindak lanjut minimal 3 karakter'; return }
  if (f.jenis === 'eskalasi' && !f.tujuan.trim()) { galatTindakan.value = 'Tujuan eskalasi wajib diisi'; return }
  menyimpanTindakan.value = true
  try {
    const res = await dashboardStore.tindakanPeringatanCommandCenter(f.peringatan.uuid, {
      jenis: f.jenis, catatan: f.catatan.trim(), tujuan: f.jenis === 'eskalasi' ? f.tujuan.trim() : null,
    })
    // Status hanya berubah setelah server mengonfirmasi (KT-19).
    if (res?.payload) {
      dialogTindakan.value = false
      await muat()
    } else {
      galatTindakan.value = 'Tindakan belum tercatat. Periksa hak akses atau coba lagi.'
    }
  } finally {
    menyimpanTindakan.value = false
  }
}
const LABEL_STATUS: Record<string, string> = { aktif: 'Belum ditinjau', ditinjau: 'Ditinjau', dieskalasi: 'Dieskalasi' }

// ── Riwayat peringatan ──
const dialogRiwayat = ref(false)
const riwayat = ref<any[] | null>(null)
const bukaRiwayat = async () => {
  dialogRiwayat.value = true
  riwayat.value = null
  const res = await dashboardStore.getPeringatanCommandCenter('riwayat')
  riwayat.value = res?.payload?.peringatan ?? []
}

// ── Ambang per faskes ──
const dialogAmbang = ref(false)
const formAmbang = ref<any[]>([])
const galatAmbang = ref('')
const angkaAtauNull = (v: any) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v))
const bukaAmbang = async () => {
  galatAmbang.value = ''
  const res = await dashboardStore.getAmbangCommandCenter()
  if (!res?.payload) return
  const ada = new Map((res.payload.ambang ?? []).map((a: any) => [a.kode, a]))
  formAmbang.value = (res.payload.katalog ?? []).map((k: any) => {
    const a: any = ada.get(k.kode)
    return { ...k, operator: a?.operator ?? '>', batasPeringatan: a?.batasPeringatan ?? null, batasKritis: a?.batasKritis ?? null, aktif: a?.aktif ?? true }
  })
  dialogAmbang.value = true
}
const simpanAmbang = async () => {
  const ambang = formAmbang.value.map((a) => ({
    kode: a.kode, operator: a.operator, batas_peringatan: angkaAtauNull(a.batasPeringatan), batas_kritis: angkaAtauNull(a.batasKritis), aktif: !!a.aktif,
  }))
  const salah = ambang.find((a) => a.batas_peringatan !== null && a.batas_kritis !== null && a.batas_peringatan > a.batas_kritis)
  if (salah) { galatAmbang.value = `Batas peringatan ${salah.kode} lebih besar dari batas kritis`; return }
  if (ambang.some((a) => (a.batas_peringatan ?? 0) < 0 || (a.batas_kritis ?? 0) < 0)) { galatAmbang.value = 'Batas tidak boleh negatif'; return }
  const res = await dashboardStore.simpanAmbangCommandCenter(ambang)
  if (res?.payload) {
    dialogAmbang.value = false
    await muat()
  }
}
const CAKUPAN: Record<string, string> = { faskes: 'faskes', ruangan: 'per ruangan', poli: 'per poli' }
</script>

<template>
  <div ref="akar" class="flex flex-col gap-4 overflow-auto grow"
    :class="layarBesar ? 'fixed inset-0 z-[1100] p-6 bg-grey-50 text-base' : 'max-h-full'">
    <!-- Header: judul, kesegaran data, aksi -->
    <div class="flex items-center gap-2.5 px-5 py-3 overflow-x-auto bg-white rounded-lg whitespace-nowrap">
      <div class="p-2 text-white rounded-lg shrink-0 bg-opensimrs-300">
        <img :src="IconDashboard" alt="Ikon Dashboard" width="20px">
      </div>
      <div class="flex items-baseline min-w-0 gap-2 mr-auto">
        <h1 class="font-semibold text-opensimrs-300" :class="layarBesar ? 'text-2xl' : 'text-subTitle'">Command Center</h1>
        <span class="text-xs truncate text-grey-300" title="Data agregat tanpa identitas pasien">
          diperbarui pukul {{ pukul(data?.diperbaruiPada) }} · otomatis tiap {{ intervalDetik }} detik
        </span>
        <span class="px-2 py-0.5 text-[11px] font-semibold rounded" :class="kesegaran.kelas" role="status">{{ kesegaran.label }}</span>
        <span v-if="gagal && data" class="text-[11px] text-danger-300">Pembaruan terakhir gagal; menampilkan data pukul {{ pukul(data.diperbaruiPada) }}</span>
      </div>
      <CustomButton icon="PhArrowClockwise" title="Muat ulang" :disabled="memuat" @click="muat" />
      <CustomButton v-if="izin.aturAmbang && !layarBesar" icon="PhSlidersHorizontal" label="Ambang" outlined
        borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaAmbang" />
      <CustomButton v-if="data && !layarBesar" icon="PhClockCounterClockwise" label="Riwayat peringatan" outlined
        borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaRiwayat" />
      <CustomButton :icon="layarBesar ? 'PhCornersIn' : 'PhCornersOut'" :label="layarBesar ? 'Keluar layar besar' : 'Layar besar'" outlined
        borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="alihLayarBesar" />
    </div>

    <div v-if="ditolak" class="p-5 text-sm bg-white rounded-lg text-grey-300">{{ ditolak }}</div>
    <div v-else-if="!data && memuat" class="p-5 text-sm bg-white rounded-lg text-grey-300">Memuat indikator…</div>
    <div v-else-if="!data && gagal" class="p-5 text-sm bg-white rounded-lg text-danger-300">
      Command Center tidak dapat dimuat. Sistem mencoba lagi otomatis pada pembaruan berikutnya.
    </div>

    <template v-if="data">
      <!-- Kartu ringkas -->
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <article v-for="(k, i) in kartu" :key="i" class="flex flex-col gap-1 p-4 bg-white border-t-4 rounded-lg shadow-sm" :class="garisKartu(k.kode)">
          <div class="flex items-start justify-between gap-2">
            <h3 class="text-sm font-medium text-grey-500">{{ k.judul }}</h3>
            <span v-if="tingkatKelompok(k.kode)" class="text-[10px] font-bold shrink-0" :class="GAYA_TINGKAT[tingkatKelompok(k.kode)!].teks">
              {{ GAYA_TINGKAT[tingkatKelompok(k.kode)!].label }}
            </span>
          </div>
          <template v-if="tersedia(k.bagian)">
            <p class="font-semibold text-opensimrs-300" :class="layarBesar ? 'text-5xl' : 'text-3xl'">{{ k.nilai }}</p>
            <p class="text-xs text-grey-300" :class="{ 'text-sm': layarBesar }">{{ k.keterangan }}</p>
          </template>
          <p v-else class="text-sm" :class="k.bagian?.statusData === 'gagal' ? 'text-danger-300' : 'text-grey-300'">
            {{ teksStatus(k.bagian) }}<span v-if="k.bagian?.keterangan" class="block text-xs">{{ k.bagian.keterangan }}</span>
          </p>
        </article>
      </div>

      <!-- Peringatan aktif -->
      <section class="p-4 bg-white rounded-lg" aria-label="Peringatan aktif">
        <div class="flex items-center gap-2 mb-3">
          <h2 class="font-semibold">Peringatan aktif</h2>
          <span class="text-xs text-grey-300">{{ peringatan.length }} peringatan · {{ data.ambangAktif ?? 0 }} ambang aktif</span>
        </div>
        <p v-if="data.statusPeringatan === 'gagal'" class="text-sm text-danger-300">Peringatan gagal dievaluasi pada pembaruan ini.</p>
        <p v-else-if="!data.ambangAktif" class="text-sm text-grey-300">
          Belum ada ambang yang diatur untuk faskes ini, sehingga peringatan tidak dibuat.
          <template v-if="izin.aturAmbang">Atur lewat tombol <b>Ambang</b>.</template>
        </p>
        <p v-else-if="!peringatan.length" class="text-sm text-[#0E7840]">Semua indikator di bawah ambang.</p>
        <ul v-else class="flex flex-col gap-2">
          <li v-for="p in peringatan" :key="p.uuid" class="flex flex-wrap items-center gap-3 px-3 py-2 rounded-lg" :class="GAYA_TINGKAT[p.tingkat].latar">
            <component :is="GAYA_TINGKAT[p.tingkat].ikon" :size="layarBesar ? 28 : 20" :class="GAYA_TINGKAT[p.tingkat].teks" />
            <span class="text-xs font-bold" :class="GAYA_TINGKAT[p.tingkat].teks">{{ GAYA_TINGKAT[p.tingkat].label }}</span>
            <div class="min-w-0 mr-auto">
              <p class="font-medium" :class="{ 'text-lg': layarBesar }">
                {{ p.nama }}<template v-if="p.sasaranLabel"> — {{ p.sasaranLabel }}</template>:
                {{ nilaiSatuan(p.nilaiTerakhir, p.satuan) }} <span class="font-normal text-grey-400">(ambang {{ p.operator }} {{ nilaiSatuan(p.batas, p.satuan) }})</span>
              </p>
              <p class="text-xs text-grey-400">
                sejak {{ waktu(p.mulaiPada) }} · {{ LABEL_STATUS[p.status] ?? p.status }}
                <template v-if="p.status === 'dieskalasi'"> oleh {{ p.dieskalasiOleh }} {{ pukul(p.dieskalasiPada) }}</template>
                <template v-else-if="p.status === 'ditinjau'"> oleh {{ p.ditinjauOleh }} {{ pukul(p.ditinjauPada) }}</template>
                <template v-if="p.tindakan?.[0]"> · "{{ p.tindakan[0].catatan }}"<template v-if="p.tindakan[0].tujuan"> → {{ p.tindakan[0].tujuan }}</template></template>
              </p>
            </div>
            <template v-if="!layarBesar">
              <CustomButton v-if="izin.tinjau && p.status === 'aktif'" label="Tinjau" icon="PhCheck" outlined size="small"
                borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaTindakan(p, 'tinjau')" />
              <CustomButton v-if="izin.eskalasi && p.status !== 'dieskalasi'" label="Eskalasi" icon="PhArrowFatLinesUp" outlined size="small"
                borderColor="border-danger-300" textColor="text-danger-300" @click="bukaTindakan(p, 'eskalasi')" />
            </template>
          </li>
        </ul>
      </section>

      <!-- Tempat tidur -->
      <section class="p-4 bg-white rounded-lg" aria-label="Tempat tidur">
        <div class="flex flex-wrap items-baseline gap-2 mb-3">
          <h2 class="font-semibold">Tempat tidur per ruangan</h2>
          <span class="text-xs text-grey-300">{{ tt?.sumber }}</span>
        </div>
        <p v-if="!tersedia(tt)" class="text-sm" :class="tt?.statusData === 'gagal' ? 'text-danger-300' : 'text-grey-300'">
          {{ teksStatus(tt) }} <span v-if="tt?.keterangan">— {{ tt.keterangan }}</span>
        </p>
        <div v-else class="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div :style="{ height: tinggiBed }"><Chart type="bar" :data="grafikBed" :options="opsiBatang(true)" class="h-full" /></div>
          <div class="overflow-auto">
            <table class="w-full text-sm" :class="{ 'text-base': layarBesar }">
              <thead>
                <tr class="text-left border-b border-grey-100">
                  <th class="py-1">Ruangan</th><th class="py-1">Kelas</th><th class="py-1 text-right">Total</th><th class="py-1 text-right">Terisi</th>
                  <th class="py-1 text-right">Kosong</th><th class="py-1 text-right">Lain</th><th class="py-1 text-right">BOR</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in tt.perRuangan" :key="r.ruanganUuid ?? r.ruangan" class="border-b border-grey-50">
                  <td class="py-1">{{ r.ruangan }}</td><td class="py-1">{{ r.kelas }}</td>
                  <td class="py-1 text-right">{{ r.total }}</td><td class="py-1 text-right">{{ r.terisi }}</td>
                  <td class="py-1 text-right font-semibold" :class="r.kosong === 0 ? 'text-danger-300' : 'text-[#0E7840]'">{{ r.kosong }}</td>
                  <td class="py-1 text-right">{{ r.lainnya }}</td>
                  <td class="py-1 text-right">{{ r.bor === null ? '–' : `${angka(r.bor)}%` }}</td>
                </tr>
              </tbody>
            </table>
            <table class="w-full mt-4 text-sm">
              <thead>
                <tr class="text-left border-b border-grey-100">
                  <th class="py-1">Kelas</th><th class="py-1 text-right">Ruangan</th><th class="py-1 text-right">Total</th>
                  <th class="py-1 text-right">Terisi</th><th class="py-1 text-right">Kosong</th><th class="py-1 text-right">BOR</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="k in tt.perKelas" :key="k.kelas" class="border-b border-grey-50">
                  <td class="py-1">{{ k.kelas }}</td><td class="py-1 text-right">{{ k.ruangan }}</td><td class="py-1 text-right">{{ k.total }}</td>
                  <td class="py-1 text-right">{{ k.terisi }}</td><td class="py-1 text-right">{{ k.kosong }}</td>
                  <td class="py-1 text-right">{{ k.bor === null ? '–' : `${angka(k.bor)}%` }}</td>
                </tr>
              </tbody>
            </table>
            <p class="mt-2 text-xs text-grey-300">
              Bed cadangan/box bayi: {{ tt.ringkasan.cadanganTerisi }} terisi dari {{ tt.ringkasan.cadanganTotal }} ·
              pasien rawat inap dirawat {{ angka(tt.ringkasan.riDirawat) }} · menunggu kamar (semua asal) {{ angka(tt.ringkasan.riMenungguKamar) }}
            </p>
          </div>
        </div>
        <p v-if="!layarBesar" class="mt-2 text-[11px] text-grey-300">{{ tt?.definisi }}</p>
      </section>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <!-- IGD -->
        <section class="p-4 bg-white rounded-lg" aria-label="IGD">
          <div class="flex flex-wrap items-baseline gap-2 mb-3">
            <h2 class="font-semibold">IGD hari ini</h2>
            <span class="text-xs text-grey-300">{{ igd?.sumber }}</span>
          </div>
          <p v-if="!tersedia(igd)" class="text-sm text-danger-300">{{ teksStatus(igd) }}</p>
          <template v-else>
            <dl class="grid grid-cols-2 gap-2 mb-3 text-sm md:grid-cols-3">
              <div><dt class="text-xs text-grey-300">Sedang dirawat</dt><dd class="text-lg font-semibold">{{ angka(igd.ringkasan.dirawat) }}</dd></div>
              <div><dt class="text-xs text-grey-300">Kedatangan hari ini</dt><dd class="text-lg font-semibold">{{ angka(igd.ringkasan.kedatanganHariIni) }}</dd></div>
              <div><dt class="text-xs text-grey-300">Keluar hari ini</dt><dd class="text-lg font-semibold">{{ angka(igd.ringkasan.keluarHariIni) }}</dd></div>
              <div><dt class="text-xs text-grey-300">Rata-rata lama (dirawat)</dt><dd class="text-lg font-semibold">{{ durasi(igd.ringkasan.rataLamaDirawatMenit) }}</dd></div>
              <div><dt class="text-xs text-grey-300">Rata-rata lama (keluar hari ini)</dt><dd class="text-lg font-semibold">{{ durasi(igd.ringkasan.rataLamaKeluarMenit) }}</dd></div>
              <div><dt class="text-xs text-grey-300">Menunggu pindah RI</dt><dd class="text-lg font-semibold">{{ angka(igd.ringkasan.menungguKamar) }} <span class="text-xs font-normal text-grey-300">rata {{ durasi(igd.ringkasan.menungguKamarRataMenit) }}</span></dd></div>
            </dl>
            <div v-if="igd.kedatanganPerJam" class="h-[180px]"><Chart type="bar" :data="grafikIgd" :options="opsiIgd" class="h-full" /></div>
          </template>
          <p v-if="!layarBesar" class="mt-2 text-[11px] text-grey-300">{{ igd?.definisi }}</p>
        </section>

        <!-- Antrean admisi -->
        <section class="p-4 bg-white rounded-lg" aria-label="Antrean admisi">
          <div class="flex flex-wrap items-baseline gap-2 mb-3">
            <h2 class="font-semibold">Antrean admisi hari ini</h2>
            <span class="text-xs text-grey-300">{{ admisi?.sumber }}</span>
          </div>
          <p v-if="!tersedia(admisi)" class="text-sm text-danger-300">{{ teksStatus(admisi) }}</p>
          <template v-else>
            <dl class="grid grid-cols-2 gap-2 mb-3 text-sm md:grid-cols-3">
              <div><dt class="text-xs text-grey-300">Menunggu</dt><dd class="text-lg font-semibold">{{ angka(admisi.ringkasan.menunggu) }}</dd></div>
              <div><dt class="text-xs text-grey-300">Rata-rata menunggu</dt><dd class="text-lg font-semibold">{{ durasi(admisi.ringkasan.rataMenungguMenit) }}</dd></div>
              <div><dt class="text-xs text-grey-300">Terlama menunggu</dt><dd class="text-lg font-semibold">{{ durasi(admisi.ringkasan.terlamaMenungguMenit) }}</dd></div>
            </dl>
            <div class="h-[180px]"><Chart type="doughnut" :data="grafikAdmisi" :options="opsiDonat" class="h-full" /></div>
          </template>
          <p v-if="!layarBesar" class="mt-2 text-[11px] text-grey-300">{{ admisi?.definisi }}</p>
        </section>
      </div>

      <!-- Antrean poli -->
      <section class="p-4 bg-white rounded-lg" aria-label="Antrean poli">
        <div class="flex flex-wrap items-baseline gap-2 mb-3">
          <h2 class="font-semibold">Antrean poli hari ini</h2>
          <span class="text-xs text-grey-300">{{ poli?.sumber }}</span>
        </div>
        <p v-if="!tersedia(poli)" class="text-sm text-danger-300">{{ teksStatus(poli) }}</p>
        <p v-else-if="!poli.perPoli.length" class="text-sm text-grey-300">Belum ada kunjungan rawat jalan hari ini.</p>
        <div v-else class="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div :style="{ height: `${Math.max(180, poli.perPoli.length * 22 + 90)}px` }"><Chart type="bar" :data="grafikPoli" :options="opsiBatang(true)" class="h-full" /></div>
          <div class="overflow-auto">
            <table class="w-full text-sm" :class="{ 'text-base': layarBesar }">
              <thead>
                <tr class="text-left border-b border-grey-100">
                  <th class="py-1">Poli</th><th class="py-1 text-right">Menunggu</th><th class="py-1 text-right">Dilayani</th>
                  <th class="py-1 text-right">Selesai</th><th class="py-1 text-right">Rata-rata tunggu</th><th class="py-1 text-right">Tunggu terlama</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in poli.perPoli" :key="p.poliUuid ?? p.poli" class="border-b border-grey-50">
                  <td class="py-1">{{ p.poli }}</td><td class="py-1 text-right font-semibold">{{ p.menunggu }}</td>
                  <td class="py-1 text-right">{{ p.dilayani }}</td><td class="py-1 text-right">{{ p.selesai }}</td>
                  <td class="py-1 text-right">{{ durasi(p.rataTungguMenit) }}</td><td class="py-1 text-right">{{ durasi(p.terlamaMenungguMenit) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p v-if="!layarBesar" class="mt-2 text-[11px] text-grey-300">{{ poli?.definisi }}</p>
      </section>

      <p class="text-xs text-center text-grey-300">Data agregat tanpa identitas pasien · zona waktu {{ data.zonaWaktu }}</p>
    </template>

    <!-- Dialog tinjau/eskalasi -->
    <CustomDialog v-model:visible="dialogTindakan" width="520px">
      <template #header>{{ formTindakan.jenis === 'eskalasi' ? 'Eskalasi peringatan' : 'Tinjau peringatan' }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4 text-sm">
          <p v-if="formTindakan.peringatan">
            <b>{{ formTindakan.peringatan.nama }}</b><template v-if="formTindakan.peringatan.sasaranLabel"> — {{ formTindakan.peringatan.sasaranLabel }}</template>:
            {{ nilaiSatuan(formTindakan.peringatan.nilaiTerakhir, formTindakan.peringatan.satuan) }}
          </p>
          <label v-if="formTindakan.jenis === 'eskalasi'" class="flex flex-col gap-1">
            Tujuan eskalasi
            <input v-model="formTindakan.tujuan" type="text" maxlength="255" placeholder="mis. Manajer pelayanan medis"
              class="px-2 py-1.5 border rounded border-grey-100">
          </label>
          <label class="flex flex-col gap-1">
            Catatan tindak lanjut
            <textarea v-model="formTindakan.catatan" rows="3" maxlength="1000" placeholder="Tindak lanjut operasional, tanpa identitas pasien"
              class="px-2 py-1.5 border rounded border-grey-100" />
          </label>
          <p class="text-xs text-grey-300">Petugas dan waktu dicatat otomatis untuk audit.</p>
          <p v-if="galatTindakan" class="text-danger-300">{{ galatTindakan }}</p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogTindakan = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" :loading="menyimpanTindakan" @click="simpanTindakan" />
        </div>
      </template>
    </CustomDialog>

    <!-- Dialog riwayat -->
    <CustomDialog v-model:visible="dialogRiwayat" width="860px">
      <template #header>Riwayat peringatan (50 terakhir)</template>
      <template #body>
        <div class="pt-4 text-sm">
          <p v-if="riwayat === null" class="text-grey-300">Memuat…</p>
          <p v-else-if="!riwayat.length" class="text-grey-300">Belum ada peringatan yang selesai.</p>
          <table v-else class="w-full">
            <thead>
              <tr class="text-left border-b border-grey-100">
                <th class="py-1">Indikator</th><th class="py-1">Tingkat</th><th class="py-1">Mulai</th><th class="py-1">Selesai</th><th class="py-1">Tindak lanjut</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in riwayat" :key="p.uuid" class="align-top border-b border-grey-50">
                <td class="py-1">{{ p.nama }}<span v-if="p.sasaranLabel" class="text-grey-400"> — {{ p.sasaranLabel }}</span></td>
                <td class="py-1">{{ p.tingkat }}</td>
                <td class="py-1">{{ waktu(p.mulaiPada) }}</td>
                <td class="py-1">{{ waktu(p.selesaiPada) }}</td>
                <td class="py-1">
                  <span v-if="!p.tindakan?.length" class="text-grey-300">–</span>
                  <span v-for="t in p.tindakan" :key="t.uuid" class="block text-xs">
                    {{ t.jenis }} oleh {{ t.petugas }} {{ waktu(t.createdAt) }}: {{ t.catatan }}<template v-if="t.tujuan"> → {{ t.tujuan }}</template>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </CustomDialog>

    <!-- Dialog ambang -->
    <CustomDialog v-model:visible="dialogAmbang" width="960px">
      <template #header>Ambang peringatan faskes</template>
      <template #body>
        <div class="pt-4 text-sm">
          <p class="mb-3 text-xs text-grey-300">
            Kosongkan batas peringatan & kritis untuk menghapus ambang. Peringatan muncul bila nilai melewati batas, dan selesai
            otomatis saat nilai kembali di bawah batas. Nilai saran hanya contoh dan tidak berlaku sebelum disimpan.
          </p>
          <table class="w-full">
            <thead>
              <tr class="text-left border-b border-grey-100">
                <th class="py-1">Indikator</th><th class="py-1">Operator</th><th class="py-1">Batas peringatan</th>
                <th class="py-1">Batas kritis</th><th class="py-1">Aktif</th><th class="py-1"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in formAmbang" :key="a.kode" class="border-b border-grey-50">
                <td class="py-1 pr-2">{{ a.nama }} <span class="text-xs text-grey-300">({{ a.satuan }}, {{ CAKUPAN[a.cakupan] }})</span></td>
                <td class="py-1 pr-2">
                  <select v-model="a.operator" class="px-2 py-1 border rounded border-grey-100">
                    <option value=">">&gt;</option><option value=">=">&ge;</option>
                  </select>
                </td>
                <td class="py-1 pr-2"><input v-model="a.batasPeringatan" type="number" min="0" step="any" class="w-24 px-2 py-1 border rounded border-grey-100"></td>
                <td class="py-1 pr-2"><input v-model="a.batasKritis" type="number" min="0" step="any" class="w-24 px-2 py-1 border rounded border-grey-100"></td>
                <td class="py-1 pr-2"><input v-model="a.aktif" type="checkbox" :aria-label="`Aktifkan ambang ${a.nama}`"></td>
                <td class="py-1">
                  <button type="button" class="text-xs text-opensimrs-300 hover:underline" @click="a.batasPeringatan = a.saran">Saran {{ a.saran }}</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="galatAmbang" class="mt-3 text-danger-300">{{ galatAmbang }}</p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogAmbang = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanAmbang" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
