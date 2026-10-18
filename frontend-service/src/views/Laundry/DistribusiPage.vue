<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  batalPermintaanLaundry,
  buatPermintaanLaundry,
  daftarDistribusiLaundry,
  daftarPermintaanLaundry,
  gayaStatusLaundry,
  izinLaundry,
  kirimDistribusiLaundry,
  konfirmasiDistribusiLaundry,
  referensiLaundry,
  stokLaundry,
  waktuLaundry,
} from "@/stores/penunjang/laundry";

// Permintaan & distribusi linen bersih (UC-3): ruangan meminta; laundry mengirim dari stok bersih (ditolak bila saldo
// kurang); ruangan (petugas berbeda) mengonfirmasi jumlah diterima → stok ruangan bertambah. Distribusi sebagian
// membuat permintaan tetap "Sebagian Terpenuhi".
const storeUtils = utilsStore();
const bolehMinta = (aksi: string) => izinLaundry("Permintaan Linen", aksi);
const bolehDistribusi = (aksi: string) => izinLaundry("Distribusi", aksi);
const tab = ref(bolehMinta("READ") ? "permintaan" : "distribusi");
const ruangan = ref<any[]>([]);
const jenis = ref<any[]>([]);
const stokBersih = ref<any[]>([]);
const opsiRuangan = computed(() => ruangan.value.map((r) => ({ value: r.uuid, label: r.nama })));
const opsiJenis = computed(() =>
  jenis.value
    .filter((j) => j.aktif)
    .map((j) => {
      const s = stokBersih.value.find((x) => x.jenisLinenUuid === j.uuid);
      return { value: j.uuid, label: s ? `${j.nama} (stok bersih ${s.saldo})` : j.nama };
    }),
);

const filterPermintaan = ref("");
const permintaan = ref<any[]>([]);
const filterDistribusi = ref("menunggu_konfirmasi");
const distribusi = ref<any[]>([]);
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const [p, d] = await Promise.all([
      bolehMinta("READ") ? daftarPermintaanLaundry({ status: filterPermintaan.value }) : undefined,
      bolehDistribusi("READ") ? daftarDistribusiLaundry({ status: filterDistribusi.value }) : undefined,
    ]);
    permintaan.value = p?.payload ?? [];
    distribusi.value = d?.payload ?? [];
    if (bolehDistribusi("CREATE") && izinLaundry("Stok & Par Level", "READ")) stokBersih.value = (await stokLaundry({ lokasi_tipe: "laundry" }))?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(async () => {
  const r = (await referensiLaundry())?.payload;
  ruangan.value = r?.ruangan ?? [];
  jenis.value = r?.jenisLinen ?? [];
  muat();
});

// ── Permintaan baru
const dialogMinta = ref(false);
const formMinta = ref<any>({});
const galatMinta = ref("");
const bukaMinta = () => {
  galatMinta.value = "";
  formMinta.value = { lokasiUuid: "", catatan: "", rincian: [{ jenisLinenUuid: "", jumlahDiminta: 1 }] };
  dialogMinta.value = true;
};
const simpanMinta = async () => {
  const f = formMinta.value;
  if (!f.lokasiUuid) return (galatMinta.value = "Ruangan wajib dipilih");
  if (f.rincian.some((x: any) => !x.jenisLinenUuid || !x.jumlahDiminta)) return (galatMinta.value = "Lengkapi jenis linen dan jumlah setiap baris");
  storeUtils.setLoading(true);
  try {
    if (await buatPermintaanLaundry(f)) {
      dialogMinta.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Batal permintaan
const dialogBatal = ref(false);
const akanDibatalkan = ref<any>(null);
const alasanBatal = ref("");
const bukaBatal = (p: any) => {
  akanDibatalkan.value = p;
  alasanBatal.value = "";
  dialogBatal.value = true;
};
const batal = async () => {
  if (!alasanBatal.value.trim()) return;
  if (await batalPermintaanLaundry(akanDibatalkan.value.uuid, alasanBatal.value)) {
    dialogBatal.value = false;
    muat();
  }
};

// ── Kirim distribusi (bebas atau memenuhi permintaan)
const dialogKirim = ref(false);
const formKirim = ref<any>({});
const galatKirim = ref("");
const bukaKirim = (p?: any) => {
  galatKirim.value = "";
  formKirim.value = p
    ? {
        lokasiTujuanUuid: p.lokasiUuid,
        permintaanUuid: p.uuid,
        catatan: "",
        rincian: (p.rincian ?? [])
          .filter((x: any) => Number(x.jumlahDiminta) > Number(x.jumlahTerpenuhi))
          .map((x: any) => ({ jenisLinenUuid: x.jenisLinenUuid, jumlahDikirim: Number(x.jumlahDiminta) - Number(x.jumlahTerpenuhi) })),
      }
    : { lokasiTujuanUuid: "", permintaanUuid: undefined, catatan: "", rincian: [{ jenisLinenUuid: "", jumlahDikirim: 1 }] };
  dialogKirim.value = true;
};
const kirim = async () => {
  const f = formKirim.value;
  if (!f.lokasiTujuanUuid) return (galatKirim.value = "Ruangan tujuan wajib dipilih");
  if (!f.rincian.length || f.rincian.some((x: any) => !x.jenisLinenUuid || !x.jumlahDikirim)) return (galatKirim.value = "Lengkapi jenis linen dan jumlah setiap baris");
  storeUtils.setLoading(true);
  try {
    if (await kirimDistribusiLaundry(f)) {
      dialogKirim.value = false;
      tab.value = "distribusi";
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Konfirmasi penerimaan ruangan
const dialogKonfirmasi = ref(false);
const terpilih = ref<any>(null);
const formKonfirmasi = ref<any[]>([]);
const galatKonfirmasi = ref("");
const bukaKonfirmasi = (d: any) => {
  terpilih.value = d;
  galatKonfirmasi.value = "";
  formKonfirmasi.value = (d.rincian ?? []).map((x: any) => ({ ...x, jumlahDiterima: Number(x.jumlahDikirim), alasanSelisih: "" }));
  dialogKonfirmasi.value = true;
};
const konfirmasi = async () => {
  if (formKonfirmasi.value.some((x) => Number(x.jumlahDiterima) > Number(x.jumlahDikirim))) return (galatKonfirmasi.value = "Jumlah diterima tidak boleh melebihi jumlah dikirim");
  if (formKonfirmasi.value.some((x) => Number(x.jumlahDiterima) !== Number(x.jumlahDikirim) && !x.alasanSelisih?.trim()))
    return (galatKonfirmasi.value = "Alasan selisih wajib diisi untuk jumlah yang berbeda");
  storeUtils.setLoading(true);
  try {
    const res = await konfirmasiDistribusiLaundry(
      terpilih.value.uuid,
      formKonfirmasi.value.map((x) => ({ uuid: x.uuid, jumlahDiterima: Number(x.jumlahDiterima ?? 0), alasanSelisih: x.alasanSelisih || undefined })),
    );
    if (res) {
      dialogKonfirmasi.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Permintaan & Distribusi Linen Bersih</h1>
          <CustomButton v-if="bolehMinta('CREATE')" icon="PhPlus" label="Permintaan" @click="bukaMinta" />
          <CustomButton v-if="bolehDistribusi('CREATE')" icon="PhTruck" label="Kirim Distribusi" @click="bukaKirim()" />
        </PageToolbar>
      </template>
      <template #content>
        <Tabs v-model:value="tab">
          <TabList>
            <Tab v-if="bolehMinta('READ')" value="permintaan">Permintaan Ruangan</Tab>
            <Tab v-if="bolehDistribusi('READ')" value="distribusi">Distribusi</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="permintaan">
              <div class="flex gap-2 mb-3">
                <CustomSelect
                  v-model="filterPermintaan"
                  label="Status"
                  :options="[{ value: '', label: 'Semua' }, { value: 'menunggu', label: 'Menunggu' }, { value: 'sebagian', label: 'Sebagian Terpenuhi' }, { value: 'selesai', label: 'Selesai' }, { value: 'dibatalkan', label: 'Dibatalkan' }]"
                  optionValue="value"
                  optionLabel="label"
                  @update:modelValue="muat"
                />
              </div>
              <NoData v-if="!permintaan.length" />
              <DataTable v-else :value="permintaan" stripedRows class="text-xs" scrollable tableStyle="min-width: 50rem">
                <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuLaundry(d.waktuPermintaan) }}</template></Column>
                <Column field="namaRuangan" header="Ruangan" headerClass="bg-opensimrs-50" />
                <Column header="Rincian (terpenuhi/diminta)" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <div v-for="x in d.rincian" :key="x.uuid">{{ x.namaLinen }}: {{ Number(x.jumlahTerpenuhi) }}/{{ Number(x.jumlahDiminta) }}</div>
                  </template>
                </Column>
                <Column field="petugasPeminta" header="Peminta" headerClass="bg-opensimrs-50" />
                <Column header="Status" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <span class="px-2 py-1 rounded" :class="[gayaStatusLaundry(d.status).bg, gayaStatusLaundry(d.status).text]">{{ gayaStatusLaundry(d.status).label }}</span>
                    <div v-if="d.alasanBatal" class="text-grey-400">{{ d.alasanBatal }}</div>
                  </template>
                </Column>
                <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[180px]">
                  <template #body="{ data: d }">
                    <div v-if="['menunggu', 'sebagian'].includes(d.status)" class="flex gap-2">
                      <CustomButton v-if="bolehDistribusi('CREATE')" label="Kirim" icon="PhTruck" size="small" @click="bukaKirim(d)" />
                      <CustomButton v-if="bolehMinta('BATAL')" icon="PhX" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="bukaBatal(d)" />
                    </div>
                  </template>
                </Column>
              </DataTable>
            </TabPanel>
            <TabPanel value="distribusi">
              <div class="flex gap-2 mb-3">
                <CustomSelect
                  v-model="filterDistribusi"
                  label="Status"
                  :options="[{ value: '', label: 'Semua' }, { value: 'menunggu_konfirmasi', label: 'Menunggu Konfirmasi' }, { value: 'selesai', label: 'Selesai' }]"
                  optionValue="value"
                  optionLabel="label"
                  @update:modelValue="muat"
                />
              </div>
              <NoData v-if="!distribusi.length" />
              <DataTable v-else :value="distribusi" stripedRows class="text-xs" scrollable tableStyle="min-width: 50rem">
                <Column header="Dikirim" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuLaundry(d.waktuKirim) }}</template></Column>
                <Column field="namaRuangan" header="Ruangan Tujuan" headerClass="bg-opensimrs-50" />
                <Column header="Rincian" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <div v-for="x in d.rincian" :key="x.uuid">
                      {{ x.namaLinen }}: {{ Number(x.jumlahDikirim) }}<template v-if="x.jumlahDiterima !== null && x.jumlahDiterima !== undefined"> → {{ Number(x.jumlahDiterima) }}</template>
                      <span v-if="x.alasanSelisih" class="text-grey-400">({{ x.alasanSelisih }})</span>
                    </div>
                  </template>
                </Column>
                <Column header="Petugas" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.petugasPengirim }}<template v-if="d.petugasPenerima"> → {{ d.petugasPenerima }}</template></template>
                </Column>
                <Column header="Status" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }"><span class="px-2 py-1 rounded" :class="[gayaStatusLaundry(d.status).bg, gayaStatusLaundry(d.status).text]">{{ gayaStatusLaundry(d.status).label }}</span></template>
                </Column>
                <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[160px]">
                  <template #body="{ data: d }">
                    <CustomButton v-if="d.status === 'menunggu_konfirmasi' && bolehDistribusi('KONFIRMASI')" label="Konfirmasi" icon="PhCheck" size="small" @click="bukaKonfirmasi(d)" />
                  </template>
                </Column>
              </DataTable>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogMinta" width="620px">
      <template #header>Permintaan Linen Bersih</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <CustomSelect v-model="formMinta.lokasiUuid" label="Ruangan Peminta" :options="opsiRuangan" optionValue="value" optionLabel="label" placeHolder="Pilih ruangan" />
          <div v-for="(x, i) in formMinta.rincian" :key="i" class="grid grid-cols-[2fr_1fr_auto] items-end gap-2">
            <CustomSelect v-model="x.jenisLinenUuid" label="Jenis Linen" :options="opsiJenis" optionValue="value" optionLabel="label" placeHolder="Pilih" />
            <CustomInputNumber v-model="x.jumlahDiminta" label="Jumlah" :min="1" />
            <CustomButton icon="PhTrash" outlined borderColor="border-danger-300" textColor="text-danger-300" :disabled="formMinta.rincian.length === 1" @click="formMinta.rincian.splice(i, 1)" />
          </div>
          <CustomButton icon="PhPlus" label="Tambah baris" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" class="self-start" @click="formMinta.rincian.push({ jenisLinenUuid: '', jumlahDiminta: 1 })" />
          <CustomTextfield v-model="formMinta.catatan" label="Catatan (opsional)" :maxLength="500" />
          <div v-if="galatMinta" class="text-sm text-danger-300">{{ galatMinta }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogMinta = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanMinta" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogKirim" width="620px">
      <template #header>Kirim Distribusi Linen Bersih</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <CustomSelect v-model="formKirim.lokasiTujuanUuid" label="Ruangan Tujuan" :options="opsiRuangan" optionValue="value" optionLabel="label" placeHolder="Pilih ruangan" :disabled="!!formKirim.permintaanUuid" />
          <div v-for="(x, i) in formKirim.rincian" :key="i" class="grid grid-cols-[2fr_1fr_auto] items-end gap-2">
            <CustomSelect v-model="x.jenisLinenUuid" label="Jenis Linen" :options="opsiJenis" optionValue="value" optionLabel="label" placeHolder="Pilih" />
            <CustomInputNumber v-model="x.jumlahDikirim" label="Jumlah" :min="1" />
            <CustomButton icon="PhTrash" outlined borderColor="border-danger-300" textColor="text-danger-300" :disabled="formKirim.rincian.length === 1" @click="formKirim.rincian.splice(i, 1)" />
          </div>
          <CustomButton icon="PhPlus" label="Tambah baris" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" class="self-start" @click="formKirim.rincian.push({ jenisLinenUuid: '', jumlahDikirim: 1 })" />
          <CustomTextfield v-model="formKirim.catatan" label="Catatan (opsional)" :maxLength="500" />
          <div v-if="galatKirim" class="text-sm text-danger-300">{{ galatKirim }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogKirim = false" />
          <CustomButton label="Kirim" icon="PhTruck" @click="kirim" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogKonfirmasi" width="680px">
      <template #header>Konfirmasi Penerimaan — {{ terpilih?.namaRuangan }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="text-xs text-grey-400">Dikirim oleh {{ terpilih?.petugasPengirim }}. Konfirmasi dilakukan petugas ruangan yang berbeda.</div>
          <div v-for="x in formKonfirmasi" :key="x.uuid" class="grid grid-cols-[2fr_1fr_2fr] items-end gap-2">
            <div class="text-sm pb-2">{{ x.namaLinen }}<div class="text-xs text-grey-400">Dikirim: {{ Number(x.jumlahDikirim) }}</div></div>
            <CustomInputNumber v-model="x.jumlahDiterima" label="Diterima" :min="0" :max="Number(x.jumlahDikirim)" />
            <CustomTextfield v-model="x.alasanSelisih" label="Alasan selisih" :maxLength="300" :disabled="Number(x.jumlahDiterima) === Number(x.jumlahDikirim)" />
          </div>
          <div v-if="galatKonfirmasi" class="text-sm text-danger-300">{{ galatKonfirmasi }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogKonfirmasi = false" />
          <CustomButton label="Konfirmasi" icon="PhCheck" @click="konfirmasi" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogBatal" width="420px" headerBg="bg-danger-300">
      <template #header>Batalkan Permintaan</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="text-sm">Batalkan permintaan {{ akanDibatalkan?.namaRuangan }}?</div>
          <CustomTextfield v-model="alasanBatal" label="Alasan" required :maxLength="300" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBatal = false" />
          <CustomButton label="Batalkan" icon="PhX" backgroundColor="bg-danger-300" @click="batal" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
