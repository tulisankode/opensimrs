<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import CustomDatePicker from '@/components/Base/CustomDatePicker.vue'
import CustomButton from '@/components/Base/CustomButton.vue'
import CustomDialog from '@/components/Base/CustomDialog.vue'
import LineChartDashboard from './Grafik/LineChartDashboard.vue'
import CardGrafik from './Grafik/CardGrafik.vue'
import IconDashboard from '../../assets/icons/icon_returnDashboard.svg'
import { useDashboardStore } from '@/stores/dashboard'
import { useFaskesStore } from '@/stores/datamaster/faskes'
import { isSuperadmin } from '@/stores/simrsStudio'
import { getStoredPermissions, hasPermission } from '@/utils/permissions'
import { warnaTema } from '@/utils/tema'
import { KELOMPOK_EKSEKUTIF, cetakDashboardEksekutif, formatNilaiIndikator, formatTarget } from '@/utils/pdf/pdfDashboardEksekutif'

// Dashboard Eksekutif (STD-0034): indikator agregat layanan, keuangan, mutu & SDM untuk pimpinan. Semua angka dihitung
// laporan-service dari faskes pada token (super admin boleh memilih beberapa faskes); tidak ada identitas pasien.
// Indikator yang sumbernya gagal/belum ada tidak pernah ditampilkan sebagai nol.
const dashboardStore = useDashboardStore()
const faskesStore = useFaskesStore()

// Aksi terpisah: READ (lihat), RINCIAN (drill-down), EKSPOR PDF, ATUR TARGET. Super admin tanpa daftar izin: server memutuskan.
const boleh = (aksi: string) => !getStoredPermissions().length || hasPermission('Dashboard', 'Eksekutif', aksi)
const superadmin = isSuperadmin()

const hariIni = new Date()
const awalBulan = new Date(hariIni.getFullYear(), hariIni.getMonth(), 1)
const mulai = ref<Date>(awalBulan)
const selesai = ref<Date>(hariIni)
const faskesDipilih = ref<string[]>([])
const opsiFaskes = ref<any[]>([])

const toParam = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const loading = ref(false)
const ditolak = ref(false)
const data = ref<any>(null)

const muat = async () => {
  if (!mulai.value || !selesai.value || selesai.value < mulai.value) return
  loading.value = true
  try {
    const res = await dashboardStore.getEksekutif(toParam(mulai.value), toParam(selesai.value), faskesDipilih.value)
    ditolak.value = !res
    data.value = res?.payload ?? null
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (superadmin) {
    const res = await faskesStore.getAktifApi()
    opsiFaskes.value = (res?.payload ?? []).map((f: any) => ({ value: f.uuid, label: f.name }))
  }
  muat()
})
watch([mulai, selesai, faskesDipilih], muat)

const kelompok = computed(() =>
  Object.entries(KELOMPOK_EKSEKUTIF).map(([kode, judul]) => ({
    kode,
    judul,
    indikator: (data.value?.indikator ?? []).filter((i: any) => i.kelompok === kode),
    belumTersedia: (data.value?.belumTersedia ?? []).filter((b: any) => b.kelompok === kode),
  }))
)

const GAYA_STATUS: Record<string, { garis: string; teks: string; label: string }> = {
  hijau: { garis: 'border-l-[#12B76A]', teks: 'text-[#0E7840]', label: 'Sesuai target' },
  kuning: { garis: 'border-l-[#F79009]', teks: 'text-[#B7791F]', label: 'Perlu perhatian' },
  merah: { garis: 'border-l-[#F04438]', teks: 'text-[#A33E35]', label: 'Di luar target' },
}
const gayaKartu = (i: any) => GAYA_STATUS[i.statusTarget]?.garis ?? 'border-l-grey-100'
const teksStatusData = (i: any) =>
  i.statusData === 'gagal' ? 'Gagal dimuat' : i.statusData === 'belum_dapat_dihitung' ? 'Belum dapat dihitung' : 'Belum tersedia'
const teksPerubahan = (p: number | null | undefined) => (p === null || p === undefined ? null : `${p > 0 ? '▲ +' : p < 0 ? '▼ ' : ''}${p.toLocaleString('id-ID')}%`)
const waktu = (epoch?: number | null) => (epoch ? new Date(epoch * 1000).toLocaleString('id-ID') : '-')

// Tren kunjungan & pendapatan
const tren = computed(() => data.value?.tren?.data ?? [])
const labelTren = computed(() => [...new Set(tren.value.map((r: any) => r.periode))].sort())
const garis = (label: string, kode: string, warna: string, titik: string) => ({
  label,
  data: labelTren.value.map((p) => tren.value.filter((r: any) => r.periode === p && r.kode === kode).reduce((a: number, r: any) => a + Number(r.nilai || 0), 0)),
  fill: false,
  borderColor: warna,
  tension: 0.4,
  pointBackgroundColor: titik,
  pointBorderColor: titik,
  pointRadius: 4,
})
const trenKunjungan = computed(() => [
  garis('Rawat Jalan', 'kunjungan_rj', '#8EB8F0', '#2B5CA0'),
  garis('Rawat Inap (masuk)', 'kunjungan_ri', '#77CFA0', '#0E7840'),
  garis('IGD', 'kunjungan_igd', '#F29F97', '#A33E35'),
])
const trenPendapatan = computed(() => [garis('Pendapatan (tagihan)', 'pendapatan', warnaTema('100'), warnaTema('400'))])
const judulTren = computed(() => (data.value?.tren?.satuan === 'bulan' ? 'Bulan' : 'Tanggal'))

// Rincian agregat (drill-down)
const NAMA_DIMENSI: Record<string, string> = {
  poli: 'Poli', dokter: 'Dokter', penjamin: 'Penjamin', bulan: 'Bulan', ruang: 'Ruang', unit: 'Unit', metode: 'Metode bayar',
  jenis_pelayanan: 'Jenis pelayanan', tipe: 'Tipe pegawai',
}
const dialogRincian = ref(false)
const rincian = ref<any>(null)
const indikatorRincian = ref<any>(null)
const muatRincian = async (indikator: any, dimensi: string) => {
  indikatorRincian.value = indikator
  dialogRincian.value = true
  rincian.value = { dimensi, baris: null }
  const res = await dashboardStore.getRincianEksekutif(indikator.kode, dimensi, toParam(mulai.value), toParam(selesai.value), faskesDipilih.value)
  rincian.value = res?.payload ?? { dimensi, baris: [], gagal: true }
}
const totalRincian = computed(() => (rincian.value?.baris ?? []).reduce((a: number, r: any) => a + Number(r.nilai || 0), 0))

// Ekspor PDF ringkasan rapat (data diambil ulang dari endpoint ekspor yang memeriksa izin EKSPOR PDF)
const mengekspor = ref(false)
const ekspor = async () => {
  mengekspor.value = true
  try {
    const res = await dashboardStore.eksporEksekutif(toParam(mulai.value), toParam(selesai.value), faskesDipilih.value)
    if (res?.payload) await cetakDashboardEksekutif(res.payload)
  } finally {
    mengekspor.value = false
  }
}

// Target KPI per faskes aktif
const dialogTarget = ref(false)
const formTarget = ref<any[]>([])
const galatTarget = ref('')
const angkaAtauNull = (v: any) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v))
const bukaTarget = async () => {
  galatTarget.value = ''
  const res = await dashboardStore.getTargetEksekutif()
  if (!res?.payload) return
  const ada = new Map((res.payload.target ?? []).map((t: any) => [t.kode, t]))
  formTarget.value = (res.payload.katalog ?? []).map((k: any) => {
    const t: any = ada.get(k.kode)
    return {
      ...k,
      targetMin: t?.targetMin ?? null,
      targetMaks: t?.targetMaks ?? null,
      toleransiPersen: t?.toleransiPersen ?? 10,
    }
  })
  dialogTarget.value = true
}
const pakaiAcuan = (t: any) => {
  t.targetMin = t.acuan?.min ?? null
  t.targetMaks = t.acuan?.maks ?? null
}
const simpanTarget = async () => {
  const target = formTarget.value.map((t) => ({
    kode: t.kode,
    target_min: angkaAtauNull(t.targetMin),
    target_maks: angkaAtauNull(t.targetMaks),
    toleransi_persen: angkaAtauNull(t.toleransiPersen) ?? 10,
  }))
  const salah = target.find((t) => t.target_min !== null && t.target_maks !== null && t.target_min > t.target_maks)
  if (salah) {
    galatTarget.value = `Target minimum ${salah.kode} lebih besar dari maksimum`
    return
  }
  const res = await dashboardStore.simpanTargetEksekutif(target)
  if (res?.payload) {
    dialogTarget.value = false
    muat()
  }
}
</script>

<template>
  <div class="flex flex-col max-h-full gap-5 overflow-auto grow">
    <div class="flex flex-wrap items-center gap-2.5 p-5 bg-white rounded-lg">
      <div class="p-2 text-white rounded-lg bg-opensimrs-300">
        <img :src="IconDashboard" alt="Ikon Dashboard" width="20px">
      </div>
      <div class="flex flex-wrap items-center justify-between w-full gap-3 font-semibold text-opensimrs-300 text-subTitle">
        <div>
          Dashboard Eksekutif
          <p class="text-xs font-normal text-grey-300">
            Agregat tanpa identitas pasien · zona waktu {{ data?.periode?.zonaWaktu ?? 'Asia/Jakarta' }}
            <template v-if="data"> · data diambil {{ waktu(data.diperbaruiPada) }}</template>
          </p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <span v-if="loading" class="mb-2 mr-1 text-xs font-normal text-grey-300">Memuat…</span>
          <MultiSelect v-if="superadmin" v-model="faskesDipilih" :options="opsiFaskes" optionLabel="label" optionValue="value"
            placeholder="Faskes aktif" filter display="chip" :maxSelectedLabels="2" class="w-[260px] text-sm font-normal" />
          <CustomDatePicker v-model="mulai" label="" class="w-[150px]" />
          <PhMinus class="mt-auto mb-2 mx-[6px] text-black" />
          <CustomDatePicker v-model="selesai" :showLabel="false" class="mt-auto w-[150px]" />
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <CustomButton v-if="boleh('ATUR TARGET') && !faskesDipilih.length" icon="PhTarget" label="Target KPI" outlined
            borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaTarget" />
          <CustomButton v-if="boleh('EKSPOR PDF')" icon="PhFilePdf" label="Ekspor PDF" :disabled="!data || mengekspor" @click="ekspor" />
        </div>
      </div>
    </div>

    <div v-if="ditolak && !loading" class="p-5 text-sm bg-white rounded-lg text-grey-300">
      Data dashboard eksekutif tidak dapat dimuat. Pastikan Anda memiliki hak Dashboard › Eksekutif dan periode yang dipilih valid.
    </div>

    <template v-if="data">
      <p v-if="!data.targetBerlaku" class="px-1 text-xs text-grey-300">
        Target KPI hanya dibandingkan bila satu faskes dipilih (target diatur per faskes).
      </p>

      <section v-for="k in kelompok" :key="k.kode" class="p-5 bg-white rounded-lg shadow-sm">
        <h2 class="mb-3 font-semibold text-opensimrs-300">{{ k.judul }}</h2>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article v-for="i in k.indikator" :key="i.kode" class="flex flex-col gap-1 p-4 border border-l-4 rounded-lg border-grey-100"
            :class="gayaKartu(i)">
            <div class="flex items-start justify-between gap-2">
              <h3 class="text-sm font-medium" :title="i.rumus">{{ i.nama }}</h3>
              <span v-if="i.statusTarget" class="text-[11px] font-semibold" :class="GAYA_STATUS[i.statusTarget].teks">
                {{ GAYA_STATUS[i.statusTarget].label }}
              </span>
            </div>
            <p v-if="i.statusData === 'tersedia'" class="text-xl font-semibold">{{ formatNilaiIndikator(i.nilai, i.satuan) }}</p>
            <p v-else class="text-sm" :class="i.statusData === 'gagal' ? 'text-danger-300' : 'text-grey-300'">
              {{ teksStatusData(i) }}<span v-if="i.keterangan" class="block text-xs">{{ i.keterangan }}</span>
            </p>
            <p class="text-xs text-grey-300">
              <template v-if="data.targetBerlaku">Target: {{ formatTarget(i.target, i.satuan) }}</template>
              <template v-if="i.periode?.posisiSaatIni"> · posisi saat ini</template>
              <template v-else-if="teksPerubahan(i.perubahanPersen)"> · {{ teksPerubahan(i.perubahanPersen) }} vs periode lalu</template>
            </p>
            <p v-if="i.kode === 'waktu_tunggu_rj' && i.komponen" class="text-xs text-grey-300">
              Median {{ i.komponen.median ?? '-' }} menit · ≤ 60 menit {{ i.komponen.persenDalam60Menit ?? '-' }}% · {{ i.komponen.sampel }} kunjungan
            </p>
            <p v-if="['bor', 'alos', 'toi', 'bto', 'gdr', 'ndr'].includes(i.kode) && i.komponen" class="text-xs text-grey-300">
              TT {{ i.komponen.tempatTidur }} · HP {{ i.komponen.hariPerawatan }} · keluar {{ i.komponen.keluar }} (mati {{ i.komponen.mati }})
            </p>
            <div v-if="boleh('RINCIAN') && i.statusData === 'tersedia' && i.dimensiRincian?.length" class="flex flex-wrap gap-1 mt-1">
              <button v-for="d in i.dimensiRincian" :key="d" type="button"
                class="px-2 py-0.5 text-[11px] rounded border border-grey-100 text-opensimrs-300 hover:bg-opensimrs-50"
                @click="muatRincian(i, d)">
                per {{ NAMA_DIMENSI[d] ?? d }}
              </button>
            </div>
            <p class="mt-auto text-[10px] text-grey-200">Diperbarui {{ waktu(i.diperbaruiPada) }}</p>
          </article>
          <article v-for="b in k.belumTersedia" :key="b.kode" class="p-4 border border-dashed rounded-lg border-grey-100">
            <h3 class="text-sm font-medium">{{ b.nama }}</h3>
            <p class="text-sm text-grey-300">Belum tersedia</p>
            <p class="text-xs text-grey-300">{{ b.alasan }}</p>
          </article>
        </div>
      </section>

      <div class="w-full bg-white rounded-lg shadow-md">
        <CardGrafik headerGrafik="Tren Kunjungan" />
        <p v-if="data.tren?.statusData !== 'tersedia'" class="p-5 text-sm text-danger-300">Data tren gagal dimuat.</p>
        <LineChartDashboard v-else :labels="labelTren" :datasets="trenKunjungan" showLegend legendPosition="bottom" :title="judulTren" />
      </div>
      <div class="w-full bg-white rounded-lg shadow-md">
        <CardGrafik headerGrafik="Tren Pendapatan (tagihan)" />
        <LineChartDashboard v-if="data.tren?.statusData === 'tersedia'" :labels="labelTren" :datasets="trenPendapatan" showLegend legendPosition="bottom" :title="judulTren" />
      </div>
    </template>

    <CustomDialog v-model:visible="dialogRincian" width="640px">
      <template #header>Rincian {{ indikatorRincian?.nama }} per {{ NAMA_DIMENSI[rincian?.dimensi] ?? rincian?.dimensi }}</template>
      <template #body>
        <div class="pt-4">
          <p v-if="rincian?.baris === null" class="text-sm text-grey-300">Memuat…</p>
          <p v-else-if="rincian?.gagal" class="text-sm text-danger-300">Rincian tidak dapat dimuat (periksa hak RINCIAN).</p>
          <p v-else-if="!rincian?.baris?.length" class="text-sm text-grey-300">Tidak ada data pada periode ini.</p>
          <table v-else class="w-full text-sm">
            <thead>
              <tr class="text-left border-b border-grey-100">
                <th class="py-1">{{ NAMA_DIMENSI[rincian.dimensi] ?? rincian.dimensi }}</th>
                <th class="py-1 text-right">Nilai</th>
                <th v-if="rincian.baris.some((r: any) => r.jumlah !== null)" class="py-1 text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rincian.baris" :key="r.label" class="border-b border-grey-50">
                <td class="py-1">{{ r.label }}</td>
                <td class="py-1 text-right">{{ formatNilaiIndikator(r.nilai, rincian.satuan) }}</td>
                <td v-if="rincian.baris.some((x: any) => x.jumlah !== null)" class="py-1 text-right">{{ r.jumlah ?? '-' }}</td>
              </tr>
            </tbody>
            <tfoot v-if="rincian.satuan !== 'menit'">
              <tr class="font-semibold">
                <td class="py-1">Total</td>
                <td class="py-1 text-right">{{ formatNilaiIndikator(totalRincian, rincian.satuan) }}</td>
              </tr>
            </tfoot>
          </table>
          <p class="mt-3 text-xs text-grey-300">Rincian agregat tanpa identitas pasien.</p>
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogTarget" width="900px">
      <template #header>Target KPI Faskes</template>
      <template #body>
        <div class="pt-4 text-sm">
          <p class="mb-3 text-xs text-grey-300">
            Kosongkan minimum & maksimum untuk menghapus target. Indikator volume (bertanda /30 hari) dinyatakan per 30 hari dan
            disesuaikan dengan panjang periode. Toleransi = pita kuning di luar rentang (persen dari batas). Acuan hanya rujukan
            (Depkes 2005 untuk indikator rawat inap) dan tidak berlaku sebelum disimpan.
          </p>
          <table class="w-full">
            <thead>
              <tr class="text-left border-b border-grey-100">
                <th class="py-1">Indikator</th>
                <th class="py-1">Minimum</th>
                <th class="py-1">Maksimum</th>
                <th class="py-1">Toleransi %</th>
                <th class="py-1"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in formTarget" :key="t.kode" class="border-b border-grey-50">
                <td class="py-1 pr-2">
                  {{ t.nama }} <span class="text-xs text-grey-300">({{ t.satuan }}{{ t.skala === 'per_30_hari' ? ' /30 hari' : '' }})</span>
                </td>
                <td class="py-1 pr-2"><input v-model="t.targetMin" type="number" step="any" class="w-28 px-2 py-1 border rounded border-grey-100"></td>
                <td class="py-1 pr-2"><input v-model="t.targetMaks" type="number" step="any" class="w-28 px-2 py-1 border rounded border-grey-100"></td>
                <td class="py-1 pr-2"><input v-model="t.toleransiPersen" type="number" min="0" max="100" class="w-20 px-2 py-1 border rounded border-grey-100"></td>
                <td class="py-1">
                  <button v-if="t.acuan" type="button" class="text-xs text-opensimrs-300 hover:underline" @click="pakaiAcuan(t)">
                    Pakai acuan ({{ formatTarget(t.acuan, t.satuan) }})
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="galatTarget" class="mt-3 text-danger-300">{{ galatTarget }}</p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogTarget = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanTarget" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
