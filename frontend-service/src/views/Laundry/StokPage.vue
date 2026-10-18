<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { SUMBER_TRANSAKSI, izinLaundry, referensiLaundry, riwayatStokLaundry, saldoAwalLaundry, simpanStokRuanganLaundry, stokLaundry, waktuLaundry } from "@/stores/penunjang/laundry";

// Stok linen per ruangan (saldo dari buku transaksi) terhadap par level, serta stok bersih & antrean di laundry.
const storeUtils = utilsStore();
const bolehUbah = izinLaundry("Stok & Par Level", "UPDATE");
const tab = ref("ruangan");
const ruangan = ref<any[]>([]);
const jenis = ref<any[]>([]);
const opsiRuangan = computed(() => ruangan.value.map((r) => ({ value: r.uuid, label: r.nama })));
const opsiJenis = computed(() => jenis.value.filter((j) => j.aktif).map((j) => ({ value: j.uuid, label: `${j.nama} (${j.satuan})` })));

const filterRuangan = ref("");
const diBawahPar = ref(false);
const stokRuangan = ref<any[]>([]);
const stokBersih = ref<any[]>([]);
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const [r, l] = await Promise.all([
      stokLaundry({ lokasi_tipe: "ruangan", lokasi_uuid: filterRuangan.value, di_bawah_par: diBawahPar.value ? 1 : "" }),
      stokLaundry({ lokasi_tipe: "laundry" }),
    ]);
    stokRuangan.value = r?.payload ?? [];
    stokBersih.value = l?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(async () => {
  const ref_ = (await referensiLaundry())?.payload;
  ruangan.value = ref_?.ruangan ?? [];
  jenis.value = ref_?.jenisLinen ?? [];
  muat();
});

// ── Par level & saldo awal ruangan
const dialog = ref(false);
const form = ref<any>({});
const galat = ref("");
const buka = (baris?: any) => {
  galat.value = "";
  form.value = baris
    ? { lokasiUuid: baris.lokasiUuid, jenisLinenUuid: baris.jenisLinenUuid, parLevel: baris.parLevel, saldoAwal: null, adaSaldoAwal: baris.adaSaldoAwal, ubah: true }
    : { lokasiUuid: filterRuangan.value, jenisLinenUuid: "", parLevel: 0, saldoAwal: null, adaSaldoAwal: false, ubah: false };
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  if (!f.lokasiUuid || !f.jenisLinenUuid) return (galat.value = "Ruangan dan jenis linen wajib dipilih");
  storeUtils.setLoading(true);
  try {
    const res = await simpanStokRuanganLaundry(f.lokasiUuid, f.jenisLinenUuid, { parLevel: f.parLevel ?? 0, saldoAwal: f.adaSaldoAwal ? null : f.saldoAwal });
    if (res) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Saldo awal stok bersih laundry
const dialogBersih = ref(false);
const formBersih = ref<any>({});
const bukaBersih = (baris: any) => {
  formBersih.value = { jenisLinenUuid: baris.jenisLinenUuid, nama: baris.nama, saldoAwal: null };
  dialogBersih.value = true;
};
const simpanBersih = async () => {
  if (!formBersih.value.saldoAwal) return;
  const res = await saldoAwalLaundry(formBersih.value.jenisLinenUuid, formBersih.value.saldoAwal);
  if (res) {
    dialogBersih.value = false;
    muat();
  }
};

// ── Riwayat transaksi
const dialogRiwayat = ref(false);
const riwayat = ref<any[]>([]);
const judulRiwayat = ref("");
const bukaRiwayat = async (baris: any, lokasiTipe: string) => {
  judulRiwayat.value = `${baris.nama}${lokasiTipe === "ruangan" ? ` — ${baris.namaLokasi}` : " — stok bersih laundry"}`;
  riwayat.value = (await riwayatStokLaundry({ lokasi_tipe: lokasiTipe, lokasi_uuid: baris.lokasiUuid, jenis_linen_uuid: baris.jenisLinenUuid }))?.payload ?? [];
  dialogRiwayat.value = true;
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Stok & Par Level Linen</h1>
          <CustomSelect v-model="filterRuangan" label="Ruangan" :options="[{ value: '', label: 'Semua ruangan' }, ...opsiRuangan]" optionValue="value" optionLabel="label" @update:modelValue="muat" />
          <label class="flex items-center gap-2 text-sm"><Checkbox v-model="diBawahPar" binary @update:modelValue="muat" /> Di bawah par level</label>
          <CustomButton v-if="bolehUbah" icon="PhPlus" label="Par Level / Saldo Awal" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <Tabs v-model:value="tab">
          <TabList>
            <Tab value="ruangan">Stok Ruangan</Tab>
            <Tab value="laundry">Stok Bersih Laundry</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="ruangan">
              <NoData v-if="!stokRuangan.length" />
              <DataTable v-else :value="stokRuangan" stripedRows class="text-xs" scrollable tableStyle="min-width: 50rem">
                <Column field="namaLokasi" header="Ruangan" headerClass="bg-opensimrs-50" />
                <Column header="Jenis Linen" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.nama }} <span class="text-grey-300">({{ d.kode }})</span></template>
                </Column>
                <Column header="Saldo" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.saldo }} {{ d.satuan }}</template>
                </Column>
                <Column header="Unit Berlabel" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.caraPencatatan === "per_unit" ? `${d.unitTerlacak} unit · ${d.saldoTanpaUnit} tanpa label` : "-" }}</template>
                </Column>
                <Column field="parLevel" header="Par Level" headerClass="bg-opensimrs-50" />
                <Column header="Selisih Par" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <span :class="d.selisihPar < 0 ? 'text-danger-300 font-semibold' : 'text-mint-400'">{{ d.selisihPar > 0 ? "+" : "" }}{{ d.selisihPar }}</span>
                  </template>
                </Column>
                <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[110px]">
                  <template #body="{ data: d }">
                    <div class="flex gap-2">
                      <CustomButton v-if="bolehUbah" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
                      <CustomButton icon="PhClockCounterClockwise" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaRiwayat(d, 'ruangan')" />
                    </div>
                  </template>
                </Column>
              </DataTable>
            </TabPanel>
            <TabPanel value="laundry">
              <NoData v-if="!stokBersih.length" />
              <DataTable v-else :value="stokBersih" stripedRows class="text-xs" scrollable tableStyle="min-width: 50rem">
                <Column header="Jenis Linen" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.nama }} <span class="text-grey-300">({{ d.kode }})</span></template>
                </Column>
                <Column header="Stok Bersih" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.saldo }} {{ d.satuan }}</template>
                </Column>
                <Column header="Unit Berlabel" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.caraPencatatan === "per_unit" ? `${d.unitTerlacak} unit · ${d.saldoTanpaUnit} tanpa label` : "-" }}</template>
                </Column>
                <Column field="kotorMenunggu" header="Kotor Belum Dicuci" headerClass="bg-opensimrs-50" />
                <Column field="dalamProses" header="Dalam Proses Batch" headerClass="bg-opensimrs-50" />
                <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[110px]">
                  <template #body="{ data: d }">
                    <div class="flex gap-2">
                      <CustomButton v-if="bolehUbah" icon="PhPlus" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaBersih(d)" />
                      <CustomButton icon="PhClockCounterClockwise" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaRiwayat(d, 'laundry')" />
                    </div>
                  </template>
                </Column>
              </DataTable>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="520px">
      <template #header>Par Level & Saldo Awal Ruangan</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <CustomSelect v-model="form.lokasiUuid" label="Ruangan" :options="opsiRuangan" optionValue="value" optionLabel="label" placeHolder="Pilih ruangan" :disabled="form.ubah" />
          <CustomSelect v-model="form.jenisLinenUuid" label="Jenis Linen" :options="opsiJenis" optionValue="value" optionLabel="label" placeHolder="Pilih jenis linen" :disabled="form.ubah" />
          <CustomInputNumber v-model="form.parLevel" label="Par Level" :min="0" />
          <CustomInputNumber v-if="!form.adaSaldoAwal" v-model="form.saldoAwal" label="Saldo Awal (sekali saja, opsional)" :min="0" />
          <div v-else class="text-xs text-grey-400">Saldo awal sudah dicatat; perubahan saldo berikutnya lewat siklus linen atau koreksi stok.</div>
          <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogBersih" width="420px">
      <template #header>Saldo Awal Stok Bersih — {{ formBersih.nama }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <CustomInputNumber v-model="formBersih.saldoAwal" label="Saldo Awal" :min="1" />
          <div class="text-xs text-grey-400">Hanya dapat dicatat satu kali per jenis linen.</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBersih = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanBersih" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogRiwayat" width="760px">
      <template #header>Riwayat Transaksi — {{ judulRiwayat }}</template>
      <template #body>
        <NoData v-if="!riwayat.length" />
        <DataTable v-else :value="riwayat" stripedRows class="text-xs pt-4" scrollable scrollHeight="400px">
          <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuLaundry(d.waktuTransaksi) }}</template></Column>
          <Column header="Sumber" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ SUMBER_TRANSAKSI[d.sumberTipe] ?? d.sumberTipe }}</template></Column>
          <Column header="Jumlah" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><span :class="d.arah === 'masuk' ? 'text-mint-400' : 'text-danger-300'">{{ d.arah === "masuk" ? "+" : "−" }}{{ Number(d.jumlah) }}</span></template>
          </Column>
          <Column field="alasan" header="Keterangan" headerClass="bg-opensimrs-50" />
          <Column field="petugasUuid" header="Petugas" headerClass="bg-opensimrs-50" />
        </DataTable>
      </template>
    </CustomDialog>
  </div>
</template>
