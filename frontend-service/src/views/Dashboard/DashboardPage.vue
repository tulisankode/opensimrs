<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import PageToolbar from '@/components/Base/PageToolbar.vue';
import CustomButton from '@/components/Base/CustomButton.vue';
import NoData from '@/components/section/NoData.vue';
import CardDashboard from './CardDashboard.vue'
import CustomDatePicker from '@/components/Base/CustomDatePicker.vue';
import GrafikDashboard from './Grafik/GrafikDashboard.vue';
import DoughnutChart from './Grafik/DoughnutChart.vue';
import ProgressBarDashboard from './Grafik/ProgressBarDashboard.vue';
import IconTotalKunjungan from '../../assets/icons/icon_totalKunjungan.svg'
import IconPasienBaru from '../../assets/icons/icon_pasienBaru.svg'
import IconPenjualanObat from '../../assets/icons/icon_penjualanObat.svg'
import IconPendapatanKlinik from '../../assets/icons/icon_pendapatanKlinik.svg'
import ArrowIcon from '../../assets/icons/icon_circleUp.svg'
import CardGrafik from './Grafik/CardGrafik.vue';
import { useDashboardStore } from '@/stores/dashboard';
import { formatPrice } from '@/utils/Helpers';
import { warnaTema } from '@/utils/tema';

const dashboardStore = useDashboardStore()

// Bawaan: 30 hari terakhir
const endDateFilter = ref<Date>(new Date())
const startDateFilter = ref<Date>(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000))

const toParam = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const toNumber = (value: unknown) => Number(value ?? 0) || 0

const loading = ref(false)
const periodeTidakValid = computed(() => !startDateFilter.value || !endDateFilter.value ||
  !Number.isFinite(startDateFilter.value.getTime()) || !Number.isFinite(endDateFilter.value.getTime()) ||
  toParam(endDateFilter.value) < toParam(startDateFilter.value))
const rekap = ref<any>({})
const rawatJalan = ref<any>({})
const statusRawat = ref<any[]>([])
const gender = ref<any>({})
const pendapatan = ref<any[]>([])
const topPoli = ref<any[]>([])
const topDpjp = ref<any[]>([])
const adaData = ref(false)
let permintaanTerakhir = 0

const fetchDashboard = async () => {
  const permintaan = ++permintaanTerakhir
  adaData.value = false
  if (periodeTidakValid.value) {
    loading.value = false
    return
  }
  const start = toParam(startDateFilter.value)
  const end = toParam(endDateFilter.value)
  loading.value = true
  try {
    const [r, rj, sr, g, p, poli, dpjp] = await Promise.all([
      dashboardStore.getRekap('', start, end),
      dashboardStore.getRekap('rawat-jalan', start, end),
      dashboardStore.getRekap('status-rawat', start, end),
      dashboardStore.getRekap('gender', start, end),
      dashboardStore.getRekap('pendapatan', start, end),
      dashboardStore.getRekap('poli', start, end),
      dashboardStore.getRekap('dpjp', start, end),
    ])
    if (permintaan !== permintaanTerakhir) return
    // Galat pada salah satu permintaan menghasilkan payload kosong (lihat apiLaporanGet) — jangan menampilkan data
    // periode sebelumnya seolah-olah hasil periode terbaru.
    adaData.value = Boolean(r && rj && sr && g && p && poli && dpjp)
    rekap.value = r?.payload ?? {}
    rawatJalan.value = rj?.payload?.[0] ?? {}
    statusRawat.value = sr?.payload ?? []
    gender.value = g?.payload?.[0] ?? {}
    pendapatan.value = p?.payload ?? []
    topPoli.value = poli?.payload ?? []
    topDpjp.value = dpjp?.payload ?? []
  } catch {
    if (permintaan === permintaanTerakhir) adaData.value = false
  } finally {
    if (permintaan === permintaanTerakhir) loading.value = false
  }
}

onMounted(fetchDashboard)
watch([startDateFilter, endDateFilter], fetchDashboard)

// Kartu ringkasan
const totalKunjungan = computed(() => toNumber(rekap.value.totalKunjungan?.[0]?.total).toLocaleString('id-ID'))
const totalPasienBaru = computed(() => toNumber(rekap.value.totalPasienBaru?.[0]?.total).toLocaleString('id-ID'))
const totalTransaksi = computed(() => toNumber(rekap.value.totalTransaksi?.[0]?.total).toLocaleString('id-ID'))
const totalPendapatan = computed(() => formatPrice(Math.round(toNumber(rekap.value.totalPendapatan?.[0]?.total))))

// Status pelayanan rawat jalan
const statusRj = computed(() => {
  const total = toNumber(rawatJalan.value.total)
  const persen = (n: number) => (total ? Math.round((n / total) * 100) : 0)
  const antrian = toNumber(rawatJalan.value.totalAntrian)
  const diperiksa = toNumber(rawatJalan.value.totalDiperiksa)
  const selesai = toNumber(rawatJalan.value.totalDischarge)
  return [
    { label: 'Belum Diperiksa', jumlah: antrian, persen: persen(antrian), warna: '#AFCDF4' },
    { label: 'Diperiksa', jumlah: diperiksa, persen: persen(diperiksa), warna: '#FCE8B8' },
    { label: 'Selesai', jumlah: selesai, persen: persen(selesai), warna: '#9FDDBC' },
  ]
})

// ── Sumbu waktu: semua tanggal dalam rentang ikut tampil (hari tanpa data = 0). Rentang panjang dikelompokkan per minggu
// (> 45 hari) atau per bulan (> 180 hari) agar batang tetap terbaca.
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const jumlahHari = computed(() => Math.round((endDateFilter.value.getTime() - startDateFilter.value.getTime()) / 86400000) + 1)
const satuanWaktu = computed(() => (jumlahHari.value > 180 ? 'bulan' : jumlahHari.value > 45 ? 'minggu' : 'hari'))
const kunciWaktu = (iso: string) => {
  const t = String(iso ?? '').slice(0, 10)
  if (satuanWaktu.value === 'bulan') return t.slice(0, 7)
  if (satuanWaktu.value === 'minggu') {
    const d = new Date(`${t}T00:00:00`)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // Senin
    return toParam(d)
  }
  return t
}
const kunciRentang = computed(() => {
  const hasil: string[] = []
  const d = new Date(startDateFilter.value)
  d.setHours(0, 0, 0, 0)
  for (let i = 0; i < jumlahHari.value && i < 800; i++) {
    const k = kunciWaktu(toParam(d))
    if (hasil[hasil.length - 1] !== k) hasil.push(k)
    d.setDate(d.getDate() + 1)
  }
  return hasil
})
const labelWaktu = computed(() => kunciRentang.value.map((k) => {
  const [y, m, d] = k.split('-')
  if (satuanWaktu.value === 'bulan') return `${BULAN[Number(m) - 1]} ${y}`
  return `${satuanWaktu.value === 'minggu' ? 'Mg ' : ''}${Number(d)} ${BULAN[Number(m) - 1]}`
}))
const perWaktu = (rows: any[], ambilTanggal: (row: any) => string, ambilNilai: (row: any) => number) => {
  const jumlah = new Map<string, number>()
  for (const row of rows) {
    const k = kunciWaktu(ambilTanggal(row))
    jumlah.set(k, (jumlah.get(k) ?? 0) + ambilNilai(row))
  }
  return kunciRentang.value.map((k) => jumlah.get(k) ?? 0)
}

// Kunjungan per waktu, bertumpuk per jenis rawat (seri yang nol semua disembunyikan grafik)
const kunjunganPerJenis = computed(() => [
  { label: 'Rawat Jalan', data: perWaktu(statusRawat.value, (r) => r.tgl, (r) => toNumber(r.rawatJalan)), warna: warnaTema('300') },
  { label: 'Rawat Inap', data: perWaktu(statusRawat.value, (r) => r.tgl, (r) => toNumber(r.rawatInap)), warna: '#12B76A' },
  { label: 'IGD', data: perWaktu(statusRawat.value, (r) => r.tgl, (r) => toNumber(r.igd)), warna: '#F04438' },
])

// Pemasukan (tagihan) & pengeluaran (pembelian barang ke supplier)
const pemasukanPengeluaran = computed(() => [
  { label: 'Pemasukan', data: perWaktu(pendapatan.value.filter((r) => r.type === 'masuk'), (r) => r.tanggal, (r) => toNumber(r.total)), warna: warnaTema('300') },
  { label: 'Pengeluaran', data: perWaktu(pendapatan.value.filter((r) => r.type === 'keluar'), (r) => r.tanggal, (r) => toNumber(r.total)), warna: '#F79009' },
])
const ringkasKeuangan = computed(() => {
  const jumlah = (type: string) => pendapatan.value.filter((r) => r.type === type).reduce((a, r) => a + toNumber(r.total), 0)
  const masuk = jumlah('masuk')
  const keluar = jumlah('keluar')
  return { masuk: formatPrice(Math.round(masuk)), keluar: formatPrice(Math.round(keluar)), selisih: formatPrice(Math.round(masuk - keluar)), positif: masuk >= keluar }
})

const genderData = computed(() => [toNumber(gender.value.totalFemale), toNumber(gender.value.totalMale)])

const top5 = (rows: any[], labelKey: string) =>
  [...rows].sort((a, b) => toNumber(b.total) - toNumber(a.total)).slice(0, 5).map((row) => ({ label: row[labelKey] ?? '-', total: toNumber(row.total) }))
const top5Poli = computed(() => top5(topPoli.value, 'poli'))
const top5Dpjp = computed(() => top5(topDpjp.value, 'name'))
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" aria-label="Muat ulang" :disabled="loading" :loading="loading" @click="fetchDashboard" />
          <h1 class="toolbar-heading text-opensimrs-300">Dashboard</h1>
          <CustomDatePicker v-model="startDateFilter" label="" class="toolbar-field toolbar-field--date" />
          <CustomDatePicker v-model="endDateFilter" :showLabel="false" class="toolbar-field toolbar-field--date" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col h-full gap-5 p-5 overflow-auto">
          <p v-if="periodeTidakValid" class="text-sm font-medium text-danger-400">Periode tidak valid: tanggal akhir tidak boleh sebelum tanggal awal.</p>
          <p v-else-if="loading" role="status" class="text-sm text-grey-400">Memuat data Dashboard…</p>
          <NoData v-else-if="!loading && !adaData" title="Gagal memuat data dashboard, silakan muat ulang" />
          <template v-else>
            <div class="flex gap-5">
              <div class="w-1/4">
                <CardDashboard namaKegiatan="Total Kunjungan" :data="totalKunjungan" satuanData="Kunjungan" :iconKegiatan="IconTotalKunjungan"
                  :arrowIcon="ArrowIcon" />
              </div>
              <div class="w-1/4">
                <CardDashboard namaKegiatan="Pasien Baru" :data="totalPasienBaru" satuanData="Pasien" :iconKegiatan="IconPasienBaru"
                  :arrowIcon="ArrowIcon" />
              </div>
              <div class="w-1/4">
                <CardDashboard namaKegiatan="Total Penjualan Obat" :data="totalTransaksi" satuanData="Transaksi"
                  :iconKegiatan="IconPenjualanObat" :arrowIcon="ArrowIcon" />
              </div>
              <div class="w-1/4">
                <CardDashboard namaKegiatan="Total Pendapatan" :data="totalPendapatan"
                  satuanData="Indonesian Rupiah (IDR)" dataFont="font-bold text-black text-[28px] leading-[48px]"
                  :iconKegiatan="IconPendapatanKlinik" :arrowIcon="ArrowIcon" />
              </div>
            </div>

            <div class="flex gap-5">
              <div class="bg-white rounded-lg shadow-md grow">
                <CardGrafik header-grafik="Kunjungan Pasien" />
                <NoData v-if="!statusRawat.length" title="Belum ada data kunjungan pada periode ini" />
                <GrafikDashboard v-else :labels="labelWaktu" :datasets="kunjunganPerJenis" bertumpuk />
              </div>
              <div class="w-[500px]  bg-white rounded-lg shadow-md">
                <CardGrafik headerGrafik="Status Pelayanan Rawat Jalan" />
                <ProgressBarDashboard v-for="status in statusRj" :key="status.label" :statusPemeriksaan="status.label"
                  :jumlahPasien="`${status.jumlah} Pasien`" :progressColor="status.warna" :value="status.persen"
                  :persenPasien="String(status.persen)" />
              </div>
            </div>

            <div class="w-full bg-white rounded-lg shadow-md">
              <CardGrafik headerGrafik="Pemasukan dan Pengeluaran" />
              <div class="flex flex-wrap gap-6 px-5 pb-2 text-sm">
                <div><span class="text-grey-400">Pemasukan</span> <b class="ml-1 text-black">{{ ringkasKeuangan.masuk }}</b></div>
                <div><span class="text-grey-400">Pengeluaran</span> <b class="ml-1 text-black">{{ ringkasKeuangan.keluar }}</b></div>
                <div><span class="text-grey-400">Selisih</span>
                  <b class="ml-1" :class="ringkasKeuangan.positif ? 'text-success-300' : 'text-danger-300'">{{ ringkasKeuangan.selisih }}</b></div>
              </div>
              <NoData v-if="!pendapatan.length" title="Belum ada data keuangan pada periode ini" />
              <GrafikDashboard v-else :labels="labelWaktu" :datasets="pemasukanPengeluaran" satuan="rupiah" />
            </div>

            <div class="flex gap-5">
              <div class="w-1/3 bg-white rounded-lg shadow-md">
                <CardGrafik headerGrafik="Kunjungan Per-jenis Kelamin" />
                <NoData v-if="!genderData.some((nilai) => nilai > 0)" title="Belum ada data jenis kelamin pada periode ini" />
                <DoughnutChart v-else :labels="['Perempuan', 'Laki-laki']" :data="genderData"
                  :backgroundColor="['#FAB8DC', '#AED6FF']" />
              </div>

              <div class="w-1/3 bg-white rounded-lg shadow-md">
                <CardGrafik headerGrafik="Top 5 Poli" />
                <NoData v-if="!top5Poli.length" title="Belum ada data poli pada periode ini" />
                <GrafikDashboard v-else :labels="top5Poli.map((row) => row.label)" horizontal tinggi="240px"
                  :datasets="[{ label: 'Kunjungan', data: top5Poli.map((row) => row.total), warna: warnaTema('300') }]" />
              </div>

              <div class="w-1/3 bg-white rounded-lg shadow-md">
                <CardGrafik headerGrafik="Top 5 DPJP" />
                <NoData v-if="!top5Dpjp.length" title="Belum ada data DPJP pada periode ini" />
                <GrafikDashboard v-else :labels="top5Dpjp.map((row) => row.label)" horizontal tinggi="240px"
                  :datasets="[{ label: 'Kunjungan', data: top5Dpjp.map((row) => row.total), warna: warnaTema('300') }]" />
              </div>
            </div>
          </template>
        </div>
      </template>
    </Card>
  </div>
</template>
