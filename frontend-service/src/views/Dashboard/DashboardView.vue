<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import CardDashboard from './CardDashboard.vue'
import CustomDatePicker from '@/components/Base/CustomDatePicker.vue';
import LineChartDashboard from './Grafik/LineChartDashboard.vue';
import DoughnutChart from './Grafik/DoughnutChart.vue';
import ProgressBarDashboard from './Grafik/ProgressBarDashboard.vue';
import IconTotalKunjungan from '../../assets/icons/icon_totalKunjungan.svg'
import IconPasienBaru from '../../assets/icons/icon_pasienBaru.svg'
import IconPenjualanObat from '../../assets/icons/icon_penjualanObat.svg'
import IconPendapatanKlinik from '../../assets/icons/icon_pendapatanKlinik.svg'
import ArrowIcon from '../../assets/icons/icon_circleUp.svg'
import IconDashboard from '../../assets/icons/icon_returnDashboard.svg'
import CardGrafik from './Grafik/CardGrafik.vue';
import { useDashboardStore } from '@/stores/dashboard';
import { formatPrice } from '@/utils/Helpers';
import { warnaTema } from '@/utils/tema';
import { hasPermission } from '@/utils/permissions';
import { fiturAktif } from '@/stores/modulFaskes';

const dashboardStore = useDashboardStore()

// Tautan Dashboard Eksekutif (STD-0034): hanya bila fitur aktif untuk faskes dan pengguna berizin Dashboard › Eksekutif.
const bolehVirtualOffice = fiturAktif('dashboard_virtual_office') && hasPermission('Dashboard', 'Virtual Office', 'READ')
const bolehEksekutif = fiturAktif('dashboard_eksekutif') && hasPermission('Dashboard', 'Eksekutif', 'READ')

// Default: 30 hari terakhir
const endDateFilter = ref<Date>(new Date())
const startDateFilter = ref<Date>(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000))

const toParam = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const toNumber = (value: unknown) => Number(value ?? 0) || 0

const loading = ref(false)
const rekap = ref<any>({})
const rawatJalan = ref<any>({})
const statusRawat = ref<any[]>([])
const gender = ref<any>({})
const pendapatan = ref<any[]>([])
const topPoli = ref<any[]>([])
const topDpjp = ref<any[]>([])

const fetchDashboard = async () => {
  if (!startDateFilter.value || !endDateFilter.value) return
  if (endDateFilter.value < startDateFilter.value) return
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
    rekap.value = r?.payload ?? {}
    rawatJalan.value = rj?.payload?.[0] ?? {}
    statusRawat.value = sr?.payload ?? []
    gender.value = g?.payload?.[0] ?? {}
    pendapatan.value = p?.payload ?? []
    topPoli.value = poli?.payload ?? []
    topDpjp.value = dpjp?.payload ?? []
  } finally {
    loading.value = false
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

const garis = (label: string, data: number[], warna: string, titik: string) => ({
  label,
  data,
  fill: false,
  borderColor: warna,
  tension: 0.4,
  pointBackgroundColor: titik,
  pointBorderColor: titik,
  pointBorderWidth: 2,
  pointRadius: 5,
  pointHoverRadius: 7,
})

// Kunjungan per tanggal (total & per status rawat)
const tanggalKunjungan = computed(() => statusRawat.value.map((row) => row.tgl))
const kunjunganPasien = computed(() => [
  garis('Kunjungan Pasien', statusRawat.value.map((row) => toNumber(row.rawatJalan) + toNumber(row.rawatInap) + toNumber(row.igd)), warnaTema('100'), warnaTema('400')),
])
const kunjunganStatusRawat = computed(() => [
  garis('Rawat Jalan', statusRawat.value.map((row) => toNumber(row.rawatJalan)), '#8EB8F0', '#2B5CA0'),
  garis('Rawat Inap', statusRawat.value.map((row) => toNumber(row.rawatInap)), '#77CFA0', '#0E7840'),
  garis('IGD', statusRawat.value.map((row) => toNumber(row.igd)), '#F29F97', '#A33E35'),
])

// Pemasukan (tagihan) & pengeluaran (pembelian barang ke supplier) per tanggal
const tanggalPendapatan = computed(() => [...new Set(pendapatan.value.map((row) => row.tanggal))].sort())
const pemasukanPengeluaran = computed(() => {
  const nilai = (type: string) =>
    tanggalPendapatan.value.map((tgl) =>
      pendapatan.value.filter((row) => row.tanggal === tgl && row.type === type).reduce((sum, row) => sum + toNumber(row.total), 0)
    )
  return [
    garis('Pemasukan', nilai('masuk'), warnaTema('100'), warnaTema('400')),
    garis('Pengeluaran', nilai('keluar'), '#F29F97', '#A33E35'),
  ]
})

const genderData = computed(() => [toNumber(gender.value.totalFemale), toNumber(gender.value.totalMale)])

const top5 = (rows: any[], labelKey: string) =>
  [...rows].sort((a, b) => toNumber(b.total) - toNumber(a.total)).slice(0, 5).map((row) => ({ label: row[labelKey] ?? '-', total: toNumber(row.total) }))
const top5Poli = computed(() => top5(topPoli.value, 'poli'))
const top5Dpjp = computed(() => top5(topDpjp.value, 'name'))

const WARNA_DONAT = ['#F28B82', '#C1E1C1', '#A7C7E7', '#AFE1E1', '#FFE0B2']
</script>



<template>
  <div class="flex flex-col max-h-full gap-5 overflow-auto grow">
    <div class="flex items-center gap-2.5 p-5 bg-white rounded-lg">
      <div class="p-2 text-white rounded-lg bg-opensimrs-300">
        <img :src="IconDashboard" alt="Icon Kegiatan" width="20px">
      </div>
      <div class="flex items-center justify-between w-full font-semibold text-opensimrs-300 text-subTitle ">Dashboard
        <div class="flex items-center">
          <RouterLink v-if="bolehVirtualOffice" to="/dashboard/virtual-office" class="px-3 py-2 border rounded">Virtual Office</RouterLink>
          <RouterLink v-if="bolehEksekutif" to="/dashboard/eksekutif"
            class="mr-4 px-3 py-1.5 text-xs font-medium rounded-lg border border-opensimrs-300 text-opensimrs-300 hover:bg-opensimrs-50">
            Dashboard Eksekutif
          </RouterLink>
          <span v-if="loading" class="mr-3 text-xs font-normal text-grey-300">Memuat…</span>
          <CustomDatePicker v-model="startDateFilter" label="" class="w-[150px]" />
          <PhMinus class="mt-auto mb-2 mx-[10px] text-black" />
          <CustomDatePicker v-model="endDateFilter" :showLabel="false" class="mt-auto w-[150px]" />
        </div>
      </div>
    </div>


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
        <CardDashboard namaKegiatan="Total Pendapatan Klinik" :data="totalPendapatan"
          satuanData="Indonesian Rupiah (IDR)" dataFont="font-bold text-black text-[20px]"
          :iconKegiatan="IconPendapatanKlinik" :arrowIcon="ArrowIcon" />
      </div>
    </div>

    <div class="flex gap-5">
      <div class="bg-white rounded-lg shadow-md grow">
        <CardGrafik header-grafik="Kunjungan Pasien" />
        <LineChartDashboard :labels="tanggalKunjungan" :datasets="kunjunganPasien" />
      </div>
      <div class="w-[500px]  bg-white rounded-lg shadow-md">
        <CardGrafik headerGrafik="Status Pelayanan Rawat Jalan" />
        <ProgressBarDashboard v-for="status in statusRj" :key="status.label" :statusPemeriksaan="status.label"
          :jumlahPasien="`${status.jumlah} Pasien`" :progressColor="status.warna" :value="status.persen"
          :persenPasien="String(status.persen)" />
      </div>
    </div>

    <div class="w-full bg-white rounded-lg shadow-md">
      <CardGrafik headerGrafik="Kunjungan Berdasarkan Status Rawat" />
      <LineChartDashboard :labels="tanggalKunjungan" :datasets="kunjunganStatusRawat" showLegend legendPosition="bottom"
        labelsColor="#000000" />
    </div>
    <div class="w-full bg-white rounded-lg shadow-md">
      <CardGrafik headerGrafik="Pemasukan dan Pengeluaran" />
      <LineChartDashboard :labels="tanggalPendapatan" :datasets="pemasukanPengeluaran" showLegend legendPosition="bottom"
        labelsColor="#000000" title="Tanggal" />
    </div>

    <div class="flex gap-5">
      <div class="w-1/3 bg-white rounded-lg shadow-md">
        <CardGrafik headerGrafik="Kunjungan Per-jenis Kelamin" />
        <DoughnutChart :labels="['Perempuan', 'Laki-laki']" :data="genderData"
          :backgroundColor="['#FAB8DC', '#AED6FF']" />
      </div>

      <div class="w-1/3 bg-white rounded-lg shadow-md">
        <CardGrafik headerGrafik="Top 5 Poli" />
        <DoughnutChart :labels="top5Poli.map((row) => row.label)" :data="top5Poli.map((row) => row.total)"
          :backgroundColor="WARNA_DONAT" />
      </div>

      <div class="w-1/3 bg-white rounded-lg shadow-md">
        <CardGrafik headerGrafik="Top 5 DPJP" />
        <DoughnutChart :labels="top5Dpjp.map((row) => row.label)" :data="top5Dpjp.map((row) => row.total)"
          :backgroundColor="WARNA_DONAT" />
      </div>
    </div>

  </div>
</template>
