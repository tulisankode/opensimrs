<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { bacaGaji, nominalGaji, periodeGaji, tanggalGaji, JENIS_KOMPONEN, KATEGORI_KOMPONEN } from "@/stores/penunjang/penggajian";

// Slip gaji milik akun sendiri (STD-0041). Backend hanya menerbitkan slip setelah pembayaran dan jurnal tercatat.
const data = ref<any[]>([]), slip = ref<any>(null), terpilih = ref(""), page = ref(1), total = ref(0), memuat = ref(false);
const muat = async () => {
  memuat.value = true;
  try {
    const r = await bacaGaji("/slip/saya", { page: page.value });
    data.value = r?.payload?.data ?? []; total.value = r?.payload?.pagination?.total ?? 0;
  } finally { memuat.value = false; }
};
const gantiHalaman = (e: { page: number }) => { page.value = e.page + 1; muat(); };
const buka = async (uuid: string) => { terpilih.value = uuid; slip.value = (await bacaGaji(`/slip/saya/${uuid}`))?.payload ?? null; };
const cetak = () => window.print();
const rincianJenis = (jenis: string) => (slip.value?.rincian ?? []).filter((r: any) => r.jenis === jenis);
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" class="h-full overflow-hidden print:shadow-none">
      <template #header>
        <div class="print:hidden">
          <PageToolbar>
            <CustomButton icon="PhArrowClockwise" :disabled="memuat" @click="muat" />
            <h1 class="toolbar-heading text-opensimrs-300">Slip Gaji Saya</h1>
            <CustomButton v-if="slip" icon="PhPrinter" label="Cetak slip" @click="cetak" />
          </PageToolbar>
        </div>
      </template>

      <template #content>
        <div class="grid grid-cols-1 gap-4 pt-4 lg:grid-cols-[280px_1fr]">
          <aside class="flex flex-col gap-2 print:hidden">
            <p class="text-xs text-grey-400">Slip tersedia setelah pembayaran dan jurnal berhasil dicatat.</p>
            <NoData v-if="!data.length" title="Belum ada slip gaji terbit untuk akun Anda" class="min-h-[200px]" />
            <button
              v-for="r in data"
              :key="r.uuid"
              type="button"
              class="flex items-center justify-between px-3 py-2 text-sm text-left border rounded-lg"
              :class="slip && terpilih === r.uuid ? 'border-opensimrs-300 bg-opensimrs-50' : 'border-grey-75 hover:bg-grey-50'"
              @click="buka(r.uuid)"
            >
              <span class="font-semibold">{{ periodeGaji(r.tahun, r.bulan) }}</span>
              <span class="text-xs text-grey-400">dibayar {{ tanggalGaji(r.tanggalBayar) }}</span>
            </button>
          </aside>

          <NoData v-if="!slip" title="Pilih periode untuk melihat slip" class="min-h-[240px] print:hidden" />
          <article v-else class="flex flex-col gap-4 p-5 text-sm border rounded-lg border-grey-75 print:border-0">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 class="text-base font-semibold">Slip Gaji {{ periodeGaji(slip.tahun, slip.bulan) }}</h2>
                <p>{{ slip.nama || "Pegawai" }} · {{ slip.unit || "Tanpa unit" }}</p>
              </div>
              <p class="text-xs text-grey-400">Tanggal bayar {{ tanggalGaji(slip.tanggalBayar) }}</p>
            </div>
            <div v-for="jenis in ['penghasilan', 'potongan', 'iuran_pemberi_kerja']" :key="jenis">
              <template v-if="rincianJenis(jenis).length">
                <h3 class="mb-1 font-semibold">{{ JENIS_KOMPONEN[jenis] }}</h3>
                <div v-for="(r, i) in rincianJenis(jenis)" :key="i" class="flex justify-between py-1 border-b border-grey-75">
                  <span>{{ r.kode }}<span class="text-xs text-grey-400"> · {{ KATEGORI_KOMPONEN[r.kategori] ?? r.kategori }}</span></span>
                  <span>{{ nominalGaji(r.nilai) }}</span>
                </div>
              </template>
            </div>
            <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
              <div class="p-3 rounded-lg bg-grey-50"><div class="text-xs text-grey-400">Bruto</div><div class="font-semibold">{{ nominalGaji(slip.bruto) }}</div></div>
              <div class="p-3 rounded-lg bg-grey-50"><div class="text-xs text-grey-400">Potongan</div><div class="font-semibold">{{ nominalGaji(slip.potongan) }}</div></div>
              <div class="p-3 rounded-lg bg-opensimrs-50"><div class="text-xs text-grey-400">Diterima bersih</div><div class="font-semibold text-opensimrs-300">{{ nominalGaji(slip.bersih) }}</div></div>
            </div>
            <p class="text-xs text-grey-400">Rahasia. Simpan atau cetak hanya pada perangkat yang aman.</p>
          </article>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end px-5 py-2.5 print:hidden">
          <CustomPaginator :totalRecords="total" :rows="20" :rowsPerPageOptions="[20]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>
  </div>
</template>
