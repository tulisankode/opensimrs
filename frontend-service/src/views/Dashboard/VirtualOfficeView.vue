<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import CustomButton from '@/components/Base/CustomButton.vue'
import IconDashboard from '../../assets/icons/icon_returnDashboard.svg'
import { useAuthStore } from '@/stores/auth'
import { apiLaporanGet } from '@/utils/apiHandler'
import PetaIsometrik from './VirtualOffice/PetaIsometrik.vue'
import PanelUnit from './VirtualOffice/PanelUnit.vue'
import { type Pilihan, type Snapshot, WARNA_BEBAN, WARNA_TERKUNCI, warnaBeban } from './VirtualOffice/petaIsometrik'
import { type Gerakan, hitungPerpindahan } from './VirtualOffice/gerakan'
import AngkaHalus from './VirtualOffice/AngkaHalus.vue'

// Virtual Office (STD-0042): peta isometrik 2.5D aktivitas unit hari ini untuk faskes pada token. Angka agregat dihitung
// laporan-service dari transaksi nyata (antrean, kunjungan, order, resep, tagihan) — tanpa identitas pasien. Avatar
// mewakili beban kerja (menunggu/dilayani), bukan kehadiran pegawai. Data dimuat ulang otomatis tiap 30–60 detik.
const authStore = useAuthStore()
const snapshot = ref<Snapshot | null>(null)
const pilihan = ref<Pilihan>(null)
const loading = ref(false)
const gagal = ref(false)
const pesanGagal = ref('')
const terakhirBerhasil = ref<number | null>(null)
const sekarang = ref(Date.now())
const daring = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const peta = ref<InstanceType<typeof PetaIsometrik> | null>(null)
const wadah = ref<HTMLElement | null>(null)
const layarPenuh = ref(false)
// Perpindahan nyata = selisih snapshot ini terhadap snapshot sebelumnya (dianimasikan sebagai pasien berjalan).
const gerakan = ref<Gerakan | null>(null)
const berikutnya = ref<number | null>(null)

const interval = computed(() => Math.min(60, Math.max(30, snapshot.value?.intervalPolling ?? 30)) * 1000)
const simulasi = computed(() => snapshot.value?.modeData === 'simulasi')

// live = snapshot terakhir berhasil dan belum melewati 2× interval; tertunda = data lama; offline = gagal/jaringan putus.
const status = computed(() => {
  if (!daring.value) return { kode: 'offline', label: 'Offline — koneksi terputus', warna: '#dc2626' }
  if (gagal.value && !snapshot.value) return { kode: 'offline', label: 'Offline — snapshot tidak tersedia', warna: '#dc2626' }
  if (gagal.value) return { kode: 'tertunda', label: 'Tertunda — gagal memperbarui, menampilkan data terakhir', warna: '#d97706' }
  if (terakhirBerhasil.value && sekarang.value - terakhirBerhasil.value > interval.value * 2) return { kode: 'tertunda', label: 'Tertunda — data belum diperbarui', warna: '#d97706' }
  if (!snapshot.value) return { kode: 'memuat', label: 'Memuat…', warna: '#98A2B3' }
  return { kode: 'live', label: simulasi.value ? 'Simulasi' : 'Live', warna: simulasi.value ? '#d97706' : '#16a34a' }
})
const jam = (epoch?: number | null) =>
  epoch ? new Date(epoch * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
const tanggal = computed(() =>
  snapshot.value ? new Date(`${snapshot.value.tanggal}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
)

let aktif = true
let versi = 0
let pewaktu: ReturnType<typeof setTimeout> | undefined
const jadwalkan = () => {
  clearTimeout(pewaktu)
  berikutnya.value = aktif ? Date.now() + interval.value : null
  if (aktif) pewaktu = setTimeout(muat, interval.value)
}
const muat = async () => {
  if (!aktif) return
  if (document.hidden || !daring.value) return jadwalkan()
  const v = ++versi
  loading.value = true
  try {
    const respons: any = await apiLaporanGet('/virtual-office/snapshot')
    if (!aktif || v !== versi) return
    // Respons laporan-service dikonversi axios ke camelCase (payload.modeData, generatedAt, ...).
    const data = respons?.payload
    if (!data || !Array.isArray(data.unit) || !data.denah) throw new Error(respons?.message ?? 'Snapshot tidak tersedia')
    const lama = snapshot.value
    snapshot.value = data as Snapshot
    gerakan.value = { versi: (gerakan.value?.versi ?? 0) + 1, daftar: hitungPerpindahan(lama, data as Snapshot) }
    terakhirBerhasil.value = Date.now()
    gagal.value = false
    pesanGagal.value = ''
    // Pilihan dipertahankan selama unitnya masih tampil.
    const p = pilihan.value
    if (p?.jenis === 'unit' && !data.unit.some((u: any) => u.kodeUnit === p.kodeUnit)) pilihan.value = null
  } catch (e: any) {
    if (!aktif || v !== versi) return
    gagal.value = true
    pesanGagal.value = e?.message ?? ''
  } finally {
    if (aktif && v === versi) {
      loading.value = false
      jadwalkan()
    }
  }
}
const muatUlang = () => { clearTimeout(pewaktu); muat() }

const keLayarPenuh = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await wadah.value?.requestFullscreen()
  } catch {
    /* peramban menolak layar penuh */
  }
}
const ubahLayar = () => { layarPenuh.value = document.fullscreenElement === wadah.value }
const saatTerlihat = () => { if (!document.hidden) muatUlang() }
const saatDaring = () => { daring.value = true; muatUlang() }
const saatLuring = () => { daring.value = false }
let detak: ReturnType<typeof setInterval> | undefined

// Pindah faskes: snapshot lama dibuang agar angka faskes sebelumnya tidak terlihat.
watch(() => authStore.faskesUuid, () => {
  ++versi
  snapshot.value = null
  pilihan.value = null
  gerakan.value = null
  terakhirBerhasil.value = null
  muatUlang()
})

onMounted(() => {
  muat()
  // Detak 1 dtk untuk jam & hitung mundur pembaruan; tidak memicu permintaan ke server.
  detak = setInterval(() => (sekarang.value = Date.now()), 1000)
  document.addEventListener('visibilitychange', saatTerlihat)
  document.addEventListener('fullscreenchange', ubahLayar)
  window.addEventListener('online', saatDaring)
  window.addEventListener('offline', saatLuring)
})
onUnmounted(() => {
  aktif = false
  ++versi
  clearTimeout(pewaktu)
  clearInterval(detak)
  document.removeEventListener('visibilitychange', saatTerlihat)
  document.removeEventListener('fullscreenchange', ubahLayar)
  window.removeEventListener('online', saatDaring)
  window.removeEventListener('offline', saatLuring)
  snapshot.value = null
})

const ringkasan = computed(() => {
  const u = (snapshot.value?.unit ?? []).filter((x) => !x.terkunci && !x.galat)
  const jumlah = (k: 'menunggu' | 'dilayani' | 'selesai') => u.reduce((a, x) => a + (x[k] ?? 0), 0)
  return { menunggu: jumlah('menunggu'), dilayani: jumlah('dilayani'), selesai: jumlah('selesai'), padat: u.filter((x) => x.beban === 'merah').length }
})
const pilihUnit = (kodeUnit: string) => (pilihan.value = { jenis: 'unit', kodeUnit })
const jamSekarang = computed(() => new Date(sekarang.value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
const sisaDetik = computed(() => (berikutnya.value && !loading.value ? Math.max(0, Math.ceil((berikutnya.value - sekarang.value) / 1000)) : null))
// Sepi = ada unit terbuka, semua angka & jalur 0. Peta tetap tampil apa adanya; tidak ada aktivitas karangan.
const sepi = computed(() => {
  const s = snapshot.value
  const u = (s?.unit ?? []).filter((x) => !x.terkunci && !x.galat)
  return !!u.length && u.every((x) => !x.total) && (s?.jalur ?? []).every((j) => !j.jumlah)
})
</script>

<template>
  <div ref="wadah" class="flex flex-col max-h-full gap-4 overflow-auto grow" :class="{ 'p-4 bg-grey-50 h-screen': layarPenuh }">
    <!-- Header satu baris, gaya sama dengan Dashboard Eksekutif -->
    <div class="flex items-center gap-2.5 px-5 py-3 overflow-x-auto bg-white rounded-lg whitespace-nowrap">
      <div class="p-2 text-white rounded-lg shrink-0 bg-opensimrs-300">
        <img :src="IconDashboard" alt="Ikon Dashboard" width="20px">
      </div>
      <div class="flex items-baseline min-w-0 gap-2 mr-auto">
        <h1 class="font-semibold text-opensimrs-300 text-subTitle">Virtual Office</h1>
        <span class="text-xs truncate text-grey-300" title="Agregat transaksi hari ini tanpa identitas pasien">{{ tanggal }}</span>
      </div>
      <span class="inline-flex items-center gap-1.5 text-xs shrink-0" role="status" aria-live="polite">
        <span class="w-2.5 h-2.5 rounded-full" :class="{ 'animate-pulse': status.kode === 'live' }" :style="{ background: status.warna }"></span>
        <span class="font-medium" :style="{ color: status.warna }">{{ status.label }}</span>
        <span class="text-grey-300">· diperbarui {{ jam(snapshot?.generatedAt) }}</span>
      </span>
      <span class="text-xs tabular-nums shrink-0 text-grey-300" aria-live="off">
        <span class="font-medium text-grey-500">{{ jamSekarang }}</span>
        <template v-if="sisaDetik !== null"> · pembaruan berikutnya dalam {{ sisaDetik }} dtk</template>
        <template v-else-if="loading"> · memperbarui…</template>
      </span>
      <CustomButton icon="PhArrowClockwise" title="Muat ulang" :loading="loading" @click="muatUlang" />
      <CustomButton icon="PhMagnifyingGlassPlus" title="Perbesar" aria-label="Perbesar peta" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="peta?.perbesar()" />
      <CustomButton icon="PhMagnifyingGlassMinus" title="Perkecil" aria-label="Perkecil peta" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="peta?.perkecil()" />
      <CustomButton icon="PhCrosshair" label="Pusatkan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="peta?.pusatkan()" />
      <CustomButton :icon="layarPenuh ? 'PhCornersIn' : 'PhCornersOut'" :label="layarPenuh ? 'Keluar layar penuh' : 'Layar penuh'" outlined
        borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="keLayarPenuh" />
    </div>

    <div v-if="simulasi" class="px-4 py-2 text-sm rounded-lg bg-amber-50 text-amber-800" role="note">
      <strong>Simulasi</strong> — angka bersifat sintetis (flag VIRTUAL_OFFICE_SIMULASI aktif di server), bukan kondisi operasional.
    </div>

    <div v-if="!snapshot && gagal" class="p-5 text-sm bg-white rounded-lg text-grey-300">
      Snapshot Virtual Office tidak dapat dimuat{{ pesanGagal ? ` (${pesanGagal})` : '' }}. Pastikan fitur Virtual Office aktif untuk faskes dan Anda memiliki hak
      Dashboard › Virtual Office › READ.
    </div>

    <template v-if="snapshot">
      <!-- Ringkasan & daftar unit (alternatif papan ketik/pembaca layar untuk peta) -->
      <div class="flex flex-wrap items-center gap-2 px-4 py-3 bg-white rounded-lg">
        <span class="mr-2 text-xs text-grey-300">Hari ini:
          <strong class="text-amber-600"><AngkaHalus :nilai="ringkasan.menunggu" /></strong> menunggu ·
          <strong class="text-opensimrs-400"><AngkaHalus :nilai="ringkasan.dilayani" /></strong> dilayani ·
          <strong class="text-grey-400"><AngkaHalus :nilai="ringkasan.selesai" /></strong> selesai
          <template v-if="ringkasan.padat"> · <strong class="text-red-600">{{ ringkasan.padat }}</strong> unit padat</template>
        </span>
        <button v-for="u in snapshot.unit" :key="u.kodeUnit" type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded-full transition-colors"
          :class="pilihan?.jenis === 'unit' && pilihan.kodeUnit === u.kodeUnit ? 'border-opensimrs-300 bg-opensimrs-50 text-opensimrs-400' : 'border-grey-100 text-grey-500 hover:border-opensimrs-300'"
          :aria-label="u.terkunci ? `${u.nama}: terkunci` : u.galat ? `${u.nama}: sumber gagal dimuat` : `${u.nama}: ${u.menunggu} menunggu, ${u.dilayani} dilayani, beban ${warnaBeban(u.beban).label}`"
          @click="pilihUnit(u.kodeUnit)">
          <span class="w-2 h-2 rounded-full" :style="{ background: warnaBeban(u.beban, u.terkunci, u.galat).garis }"></span>
          {{ u.nama }}
          <span v-if="!u.terkunci && !u.galat" class="text-grey-300">{{ u.menunggu }}/{{ u.dilayani }}</span>
        </button>
        <span v-if="!snapshot.unit.length" class="text-xs text-grey-300">Tidak ada unit dengan modul aktif di faskes ini.</span>
      </div>

      <div class="flex flex-col gap-4 lg:flex-row grow min-h-[480px]">
        <div class="relative overflow-hidden bg-white rounded-lg grow" :class="layarPenuh ? 'min-h-0' : 'min-h-[480px]'">
          <PetaIsometrik ref="peta" :snapshot="snapshot" :pilihan="pilihan" :gerakan="gerakan" class="absolute inset-0" @pilih="pilihan = $event" />
          <div v-if="sepi" class="absolute px-4 py-2 text-sm -translate-x-1/2 border rounded-lg shadow-sm pointer-events-none left-1/2 top-3 bg-white/95 border-grey-100 text-grey-500" role="status">
            Belum ada aktivitas hari ini di faskes ini. Peta bergerak otomatis begitu ada transaksi baru.
          </div>
          <!-- Legenda -->
          <div class="absolute flex flex-col gap-1 px-3 py-2 text-[11px] border rounded-lg left-3 bottom-3 bg-white/90 border-grey-100 text-grey-500 pointer-events-none">
            <div class="flex flex-wrap gap-x-3 gap-y-1">
              <span v-for="(w, k) in WARNA_BEBAN" :key="k" class="inline-flex items-center gap-1"><span class="w-3 h-1.5 rounded-sm" :style="{ background: w.garis }"></span>{{ w.label }}</span>
              <span class="inline-flex items-center gap-1"><span class="w-3 h-1.5 rounded-sm" :style="{ background: WARNA_TERKUNCI.garis }"></span>Terkunci (tanpa izin)</span>
            </div>
            <div class="flex flex-wrap gap-x-3 gap-y-1">
              <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Menunggu</span>
              <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-opensimrs-300"></span>Dilayani</span>
              <span class="inline-flex items-center gap-1"><span class="w-4 border-t-2 border-dashed border-opensimrs-300"></span>Alur transaksi hari ini (bergerak bila ada arus baru)</span>
            </div>
            <span class="text-grey-300">Avatar mewakili beban kerja, bukan kehadiran pegawai. Avatar berjalan = transaksi baru sejak pembaruan sebelumnya. Seret untuk menggeser, roda/cubit untuk zoom.</span>
          </div>
        </div>
        <PanelUnit class="lg:w-80 shrink-0" :snapshot="snapshot" :pilihan="pilihan" @tutup="pilihan = null" @pilih="pilihan = $event" />
      </div>
    </template>
  </div>
</template>
