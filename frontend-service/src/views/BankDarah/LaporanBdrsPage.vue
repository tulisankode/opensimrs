<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  gayaReaksiBdrs,
  gayaStokBdrs,
  golonganRh,
  izinBdrs,
  keTanggal,
  laporanPemakaianBdrs,
  laporanRasioCtBdrs,
  laporanReaksiBdrs,
  laporanStokKeluarBdrs,
  waktuBdrs,
} from "@/stores/penunjang/bankDarah";

// Laporan BDRS: pemakaian darah per golongan/komponen/ruangan/hari, rasio crossmatch-transfusi (C/T), kantong keluar
// (kedaluwarsa/dimusnahkan/dikembalikan), dan rekap reaksi transfusi (hemovigilans). Tiap tab hanya dimuat bila
// pengguna memiliki izin fitur laporan yang bersangkutan (backend memeriksa ulang).
const storeUtils = utilsStore();
const bolehPemakaian = izinBdrs("Laporan BDRS", "READ", "Pemakaian Darah");
const bolehRasio = izinBdrs("Laporan BDRS", "READ", "Rasio Crossmatch-Transfusi");
const bolehHemovigilans = izinBdrs("Laporan BDRS", "READ", "Hemovigilans");

const awalBulan = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const tglMulai = ref<Date | null>(awalBulan());
const tglSelesai = ref<Date | null>(new Date());
const tab = ref(bolehPemakaian ? "pemakaian" : bolehRasio ? "rasio" : "hemovigilans");

const pemakaian = ref<any>(null);
const rasio = ref<any>(null);
const stokKeluar = ref<any[]>([]);
const hemovigilans = ref<any>(null);

const muat = async () => {
  const mulai = keTanggal(tglMulai.value);
  const selesai = keTanggal(tglSelesai.value ?? tglMulai.value);
  storeUtils.setLoading(true);
  try {
    const [p, r, s, h] = await Promise.all([
      bolehPemakaian ? laporanPemakaianBdrs(mulai, selesai) : undefined,
      bolehRasio ? laporanRasioCtBdrs(mulai, selesai) : undefined,
      bolehPemakaian ? laporanStokKeluarBdrs(mulai, selesai) : undefined,
      bolehHemovigilans ? laporanReaksiBdrs(mulai, selesai) : undefined,
    ]);
    pemakaian.value = p?.payload ?? null;
    rasio.value = r?.payload ?? null;
    stokKeluar.value = s?.payload?.items ?? [];
    hemovigilans.value = h?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);

// Respons rasio_c_t → rasioCT (konversi camelCase per huruf setelah garis bawah).
const nilaiRasio = computed(() => rasio.value?.rasioCT ?? rasio.value?.rasioCt ?? null);
const STATUS_KELUAR: Record<string, string> = { kedaluwarsa: "Kedaluwarsa", dimusnahkan: "Dimusnahkan", dikembalikan: "Dikembalikan" };
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Laporan BDRS</h1>
          <CustomDatePicker v-model="tglMulai" label="Tanggal mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Tanggal selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <Tabs :value="tab" class="flex flex-col h-full" @update:value="(v: any) => (tab = v)">
          <TabList>
            <Tab v-if="bolehPemakaian" value="pemakaian">Pemakaian Darah</Tab>
            <Tab v-if="bolehRasio" value="rasio">Rasio Crossmatch-Transfusi</Tab>
            <Tab v-if="bolehPemakaian" value="keluar">Kantong Keluar</Tab>
            <Tab v-if="bolehHemovigilans" value="hemovigilans">Hemovigilans</Tab>
          </TabList>
          <TabPanels class="overflow-auto grow">
            <TabPanel v-if="bolehPemakaian" value="pemakaian">
              <div class="grid grid-cols-3 gap-3 mb-4">
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Kantong Diserahkan</div>
                  <div class="text-lg font-semibold text-opensimrs-300">{{ pemakaian?.ringkasan?.jumlahKantong ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Permintaan Terlayani</div>
                  <div class="text-lg font-semibold">{{ pemakaian?.ringkasan?.jumlahPermintaan ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Pasien</div>
                  <div class="text-lg font-semibold">{{ pemakaian?.ringkasan?.jumlahPasien ?? 0 }}</div>
                </div>
              </div>
              <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <h3 class="mb-2 text-sm font-semibold">Per Golongan</h3>
                  <NoData v-if="!pemakaian?.perGolongan?.length" />
                  <DataTable v-else :value="pemakaian.perGolongan" stripedRows class="text-xs">
                    <Column header="Golongan" headerClass="bg-opensimrs-50">
                      <template #body="{ data: d }">{{ golonganRh(d.golonganAbo, d.rhesus) }}</template>
                    </Column>
                    <Column field="jumlah" header="Kantong" headerClass="bg-opensimrs-50" />
                  </DataTable>
                </div>
                <div>
                  <h3 class="mb-2 text-sm font-semibold">Per Komponen</h3>
                  <NoData v-if="!pemakaian?.perKomponen?.length" />
                  <DataTable v-else :value="pemakaian.perKomponen" stripedRows class="text-xs">
                    <Column field="komponenNama" header="Komponen" headerClass="bg-opensimrs-50" />
                    <Column field="jumlah" header="Kantong" headerClass="bg-opensimrs-50" />
                  </DataTable>
                </div>
                <div>
                  <h3 class="mb-2 text-sm font-semibold">Per Ruangan</h3>
                  <NoData v-if="!pemakaian?.perRuangan?.length" />
                  <DataTable v-else :value="pemakaian.perRuangan" stripedRows class="text-xs">
                    <Column header="Ruangan" headerClass="bg-opensimrs-50">
                      <template #body="{ data: d }">{{ d.lokasiAsal ?? "-" }}</template>
                    </Column>
                    <Column field="jumlah" header="Kantong" headerClass="bg-opensimrs-50" />
                  </DataTable>
                </div>
                <div>
                  <h3 class="mb-2 text-sm font-semibold">Per Hari</h3>
                  <NoData v-if="!pemakaian?.perHari?.length" />
                  <DataTable v-else :value="pemakaian.perHari" stripedRows class="text-xs">
                    <Column field="tanggal" header="Tanggal" headerClass="bg-opensimrs-50" />
                    <Column field="jumlah" header="Kantong" headerClass="bg-opensimrs-50" />
                  </DataTable>
                </div>
              </div>
            </TabPanel>

            <TabPanel v-if="bolehRasio" value="rasio">
              <div class="grid grid-cols-3 gap-3 max-w-[760px]">
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Kantong di-Crossmatch</div>
                  <div class="text-lg font-semibold">{{ rasio?.jumlahCrossmatch ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Kantong Ditransfusikan</div>
                  <div class="text-lg font-semibold">{{ rasio?.jumlahTransfusi ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Rasio C/T</div>
                  <div class="text-lg font-semibold" :class="nilaiRasio !== null && nilaiRasio > 2.5 ? 'text-danger-300' : 'text-opensimrs-300'">
                    {{ nilaiRasio ?? "-" }}
                  </div>
                </div>
              </div>
              <div class="mt-3 text-xs text-grey-400">
                Rasio C/T = jumlah kantong yang di-crossmatch ÷ jumlah kantong yang benar-benar ditransfusikan pada periode. Nilai ≤ 2,5 umumnya dianggap efisien.
              </div>
            </TabPanel>

            <TabPanel v-if="bolehPemakaian" value="keluar">
              <NoData v-if="!stokKeluar.length" />
              <DataTable v-else :value="stokKeluar" stripedRows class="text-xs">
                <Column field="noKantong" header="No. Kantong" headerClass="bg-opensimrs-50" />
                <Column field="komponenNama" header="Komponen" headerClass="bg-opensimrs-50" />
                <Column header="Gol." headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ golonganRh(d.golonganAbo, d.rhesus) }}</template>
                </Column>
                <Column header="Kedaluwarsa" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ waktuBdrs(d.tanggalKedaluwarsa, true) }}</template>
                </Column>
                <Column header="Status" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaStokBdrs(d.status)?.bg, gayaStokBdrs(d.status)?.text]">
                      {{ STATUS_KELUAR[d.status] ?? d.status }}
                    </span>
                  </template>
                </Column>
                <Column field="alasanKeluar" header="Alasan" headerClass="bg-opensimrs-50" />
                <Column header="Waktu" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ waktuBdrs(d.updatedAt) }}</template>
                </Column>
              </DataTable>
            </TabPanel>

            <TabPanel v-if="bolehHemovigilans" value="hemovigilans">
              <div class="grid grid-cols-2 gap-3 mb-4 max-w-[520px]">
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Reaksi Dilaporkan</div>
                  <div class="text-lg font-semibold text-danger-300">{{ hemovigilans?.ringkasan?.jumlahReaksi ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Belum Selesai Ditindaklanjuti</div>
                  <div class="text-lg font-semibold">{{ hemovigilans?.ringkasan?.belumSelesai ?? 0 }}</div>
                </div>
              </div>
              <h3 class="mb-2 text-sm font-semibold">Per Jenis Reaksi</h3>
              <NoData v-if="!hemovigilans?.perJenis?.length" />
              <DataTable v-else :value="hemovigilans.perJenis" stripedRows class="mb-4 text-xs">
                <Column field="jenisReaksi" header="Jenis Reaksi" headerClass="bg-opensimrs-50" />
                <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" />
              </DataTable>
              <h3 class="mb-2 text-sm font-semibold">Daftar Reaksi</h3>
              <NoData v-if="!hemovigilans?.items?.length" />
              <DataTable v-else :value="hemovigilans.items" stripedRows class="text-xs">
                <Column header="Waktu" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ waktuBdrs(d.createdAt) }}</template>
                </Column>
                <Column header="Pasien" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.namaPasien }} · {{ d.noRm }}</template>
                </Column>
                <Column field="noPermintaan" header="No. Permintaan" headerClass="bg-opensimrs-50" />
                <Column field="jenisReaksi" header="Jenis" headerClass="bg-opensimrs-50" />
                <Column field="gejala" header="Gejala" headerClass="bg-opensimrs-50" />
                <Column header="Tindak Lanjut" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaReaksiBdrs(d.statusTindakLanjut)?.bg, gayaReaksiBdrs(d.statusTindakLanjut)?.text]">
                      {{ gayaReaksiBdrs(d.statusTindakLanjut)?.label ?? d.statusTindakLanjut }}
                    </span>
                  </template>
                </Column>
              </DataTable>
            </TabPanel>
          </TabPanels>
        </Tabs>
        <NoData v-if="!bolehPemakaian && !bolehRasio && !bolehHemovigilans" />
      </template>
    </Card>
  </div>
</template>
