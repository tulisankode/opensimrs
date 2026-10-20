<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { utilsStore } from "@/stores/utils";
import { daftarAkun, daftarPemetaan, epochHari, izinAkuntansi, nonaktifPemetaan, simpanPemetaan, tanggalAk } from "@/stores/penunjang/akuntansi";

// Aturan pemetaan event transaksi → akun (KF-2/KF-3). Komponen berakhiran ":KODE" (mis. pendapatan:RJ, kas:CASH) lebih
// spesifik daripada komponen dasarnya (fallback). Mengubah akun dengan tanggal berlaku baru menambah riwayat; jurnal
// lama tetap memakai aturan yang berlaku saat transaksi. Komponen tanpa aturan membuat transaksi DITAHAN.
const storeUtils = utilsStore();
const boleh = izinAkuntansi("Pemetaan Akun", "UPDATE");
const jenis = ref<any[]>([]);
const akun = ref<any[]>([]);
const terbuka = ref<string>("tagihan_final");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const [p, a] = await Promise.all([daftarPemetaan(), daftarAkun({ aktif: "1" })]);
    jenis.value = p?.payload ?? [];
    akun.value = (a?.payload ?? []).filter((x: any) => x.jenis === "rinci").map((x: any) => ({ ...x, label: `${x.kode} — ${x.nama}` }));
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialog = ref(false);
const form = ref<any>({});
const galat = ref("");
const jenisAktif = computed(() => jenis.value.find((j) => j.kode === form.value.jenisEvent));
const buka = (j: any, k?: any) => {
  galat.value = "";
  form.value = { jenisEvent: j.kode, komponen: k?.komponen ?? "", akunUuid: k?.berlaku?.akunUuid ?? "", berlakuMulai: new Date(), keterangan: "", baru: !k };
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.komponen?.trim() || !f.akunUuid) return (galat.value = "Komponen dan akun wajib diisi");
  storeUtils.setLoading(true);
  try {
    const r = await simpanPemetaan({ jenisEvent: f.jenisEvent, komponen: f.komponen.trim(), akunUuid: f.akunUuid, berlakuMulai: epochHari(f.berlakuMulai), keterangan: f.keterangan });
    if (r) {
      dialog.value = false;
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const nonaktif = async (r: any) => {
  if (!confirm(`Nonaktifkan aturan ${r.komponen} → ${r.kodeAkun} (berlaku ${tanggalAk(r.berlakuMulai)})? Transaksi yang membutuhkannya akan ditahan.`)) return;
  if (await nonaktifPemetaan(r.uuid)) muat();
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Pemetaan Akun</h1>
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col gap-3">
          <div v-for="j in jenis" :key="j.kode" class="border rounded-md border-grey-100">
            <button class="flex items-center justify-between w-full px-4 py-3 text-left" @click="terbuka = terbuka === j.kode ? '' : j.kode">
              <span>
                <span class="font-semibold">{{ j.nama }}</span>
                <span class="ml-2 text-xs text-grey-400">{{ j.sumber }}</span>
                <span v-if="!j.tersedia" class="ml-2 px-2 py-0.5 rounded-full text-xs bg-[#F2F4F7] text-[#344054]">belum ada sumber data</span>
                <span v-else-if="j.komponen.some((k: any) => !k.berlaku && !k.komponen.includes(':'))" class="ml-2 px-2 py-0.5 rounded-full text-xs bg-[#FEF0C7] text-[#B54708]">ada komponen belum dipetakan</span>
              </span>
              <component :is="terbuka === j.kode ? 'PhCaretUp' : 'PhCaretDown'" :size="16" />
            </button>
            <div v-if="terbuka === j.kode" class="px-4 pb-4">
              <div v-if="j.alasan" class="mb-2 text-xs text-[#B54708]">{{ j.alasan }}</div>
              <DataTable :value="j.komponen" class="text-xs" stripedRows>
                <Column header="Komponen" headerClass="bg-opensimrs-50">
                  <template #body="{ data: k }">
                    <span class="font-mono">{{ k.komponen }}</span>
                    <div class="text-[11px] text-grey-400">{{ j.komponenDasar[k.komponen.split(":")[0].replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())] ?? "" }}</div>
                  </template>
                </Column>
                <Column header="Akun berlaku hari ini" headerClass="bg-opensimrs-50">
                  <template #body="{ data: k }">
                    <span v-if="k.berlaku">{{ k.berlaku.kodeAkun }} — {{ k.berlaku.namaAkun }} <span class="text-grey-400">(sejak {{ tanggalAk(k.berlaku.berlakuMulai) }})</span></span>
                    <span v-else-if="k.komponen.includes(':')" class="text-grey-400">memakai aturan komponen dasar</span>
                    <span v-else class="text-[#B54708]">Belum dipetakan</span>
                    <span v-if="k.berlaku && (!k.berlaku.akunAktif || k.berlaku.jenisAkun !== 'rinci')" class="ml-1 text-danger-300">(akun tidak dapat dijurnal)</span>
                  </template>
                </Column>
                <Column header="Riwayat" headerClass="bg-opensimrs-50">
                  <template #body="{ data: k }">
                    <div v-for="r in k.riwayat" :key="r.uuid" class="flex items-center gap-2">
                      <span :class="r.aktif ? '' : 'line-through text-grey-400'">{{ tanggalAk(r.berlakuMulai) }}: {{ r.kodeAkun }}</span>
                      <button v-if="boleh && r.aktif" class="text-danger-300 underline text-[11px]" @click="nonaktif(r)">nonaktifkan</button>
                    </div>
                  </template>
                </Column>
                <Column v-if="boleh" header="" headerClass="bg-opensimrs-50">
                  <template #body="{ data: k }"><CustomButton label="Ubah" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(j, k)" /></template>
                </Column>
              </DataTable>
              <CustomButton v-if="boleh && j.tersedia" label="Tambah Komponen Spesifik" icon="PhPlus" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" class="mt-2" @click="buka(j)" />
            </div>
          </div>
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="640px">
      <template #header>Pemetaan {{ jenisAktif?.nama }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.komponen" label="Komponen" placeholder="mis. pendapatan:RAD atau kas:TRANSFER" :maxLength="80" class="col-span-2" :disabled="!form.baru" />
          <div v-if="form.baru" class="col-span-2 text-xs text-grey-400">
            Komponen dasar: {{ Object.keys(jenisAktif?.komponenDasar ?? {}).map((x) => x.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)).join(", ") }}. Tambahkan akhiran ":KODE" untuk aturan
            spesifik (jenis layanan tagihan RJ/RI/IGD/LAB/FISIO/OTC, metode bayar CASH/DEBIT/DEBIT_KREDIT/TRANSFER/CREDIT, persediaan obat/alkes/non_medis).
          </div>
          <CustomSelect v-model="form.akunUuid" label="Akun (rinci, aktif)" :options="akun" optionValue="uuid" optionLabel="label" class="col-span-2" />
          <CustomDatePicker v-model="form.berlakuMulai" label="Berlaku mulai" />
          <CustomTextfield v-model="form.keterangan" label="Keterangan" :maxLength="500" />
          <div class="col-span-2 text-xs text-grey-400">Aturan dengan tanggal berlaku yang sama diganti; tanggal berbeda menambah riwayat. Jurnal yang sudah terbentuk tidak berubah.</div>
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
