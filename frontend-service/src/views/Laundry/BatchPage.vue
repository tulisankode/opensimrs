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
  TAHAP_BATCH,
  antreanCuciLaundry,
  buatBatchLaundry,
  daftarBatchLaundry,
  gayaKategori,
  gayaStatusLaundry,
  izinLaundry,
  ubahTahapLaundry,
  waktuLaundry,
} from "@/stores/penunjang/laundry";

// Pemrosesan batch (UC-2): batch dibentuk dari antrean linen kotor terkonfirmasi berkategori sama (boleh lintas
// ruangan); berat kg dicatat terpisah dari jumlah unit. Tahapan berurutan; setrika/lipat selesai → stok bersih laundry.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinLaundry("Batch", aksi);
const URUTAN = ["pencucian", "pengeringan", "setrika_lipat"];

const antrean = ref<any[]>([]);
const filterStatus = ref("proses");
const batch = ref<any[]>([]);
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const [a, b] = await Promise.all([antreanCuciLaundry(), daftarBatchLaundry({ status: filterStatus.value })]);
    antrean.value = (a?.payload ?? []).map((x: any) => ({ ...x, dipilih: false, jumlahDiproses: Number(x.sisa) }));
    batch.value = b?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);

// ── Buat batch dari antrean terpilih
const terpilih = computed(() => antrean.value.filter((x) => x.dipilih));
const kategoriTerpilih = computed(() => terpilih.value[0]?.kategori ?? null);
const bisaDipilih = (x: any) => !kategoriTerpilih.value || x.kategori === kategoriTerpilih.value;
const dialog = ref(false);
const form = ref<any>({});
const galat = ref("");
const buka = () => {
  galat.value = "";
  form.value = { beratKg: null, kode: "", catatan: "" };
  dialog.value = true;
};
const simpan = async () => {
  if (!form.value.beratKg || form.value.beratKg <= 0) return (galat.value = "Berat cucian (kg) wajib diisi");
  if (terpilih.value.some((x) => !x.jumlahDiproses || x.jumlahDiproses > Number(x.sisa))) return (galat.value = "Jumlah diproses harus 1 sampai sisa antrean");
  storeUtils.setLoading(true);
  try {
    const res = await buatBatchLaundry({
      beratKg: form.value.beratKg,
      kode: form.value.kode || undefined,
      catatan: form.value.catatan || undefined,
      rincianAsal: terpilih.value.map((x) => ({ rincianPenerimaanUuid: x.rincianPenerimaanUuid, jumlahDiproses: x.jumlahDiproses })),
    });
    if (res) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Tahapan: tombol aksi berikutnya untuk satu batch
const aksiBerikut = (b: any) => {
  for (const tahap of URUTAN) {
    const t = (b.tahapan ?? []).find((x: any) => x.tahap === tahap);
    if (!t || t.status === "selesai") continue;
    return { tahap, status: t.status === "belum" ? "berjalan" : "selesai" } as { tahap: string; status: "berjalan" | "selesai" };
  }
  return null;
};
const ubahTahap = async (b: any) => {
  const a = aksiBerikut(b);
  if (!a) return;
  storeUtils.setLoading(true);
  try {
    if (await ubahTahapLaundry(b.uuid, a.tahap, a.status)) muat();
  } finally {
    storeUtils.setLoading(false);
  }
};
const ringkasAsal = (b: any) => {
  const m = new Map<string, number>();
  for (const a of b.asal ?? []) m.set(`${a.namaLinen} (${a.namaRuangan ?? "-"})`, (m.get(`${a.namaLinen} (${a.namaRuangan ?? "-"})`) ?? 0) + Number(a.jumlahDiproses));
  return [...m.entries()].map(([k, v]) => `${k}: ${v}`).join(", ");
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden gap-3">
    <Card pt:body:class="pt-0" class="flex-none">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Antrean Linen Kotor</h1>
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Buat Batch" :disabled="!terpilih.length" @click="buka" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!antrean.length" />
        <DataTable v-else :value="antrean" stripedRows class="text-xs" scrollable scrollHeight="260px" tableStyle="min-width: 50rem">
          <Column header="" headerClass="bg-opensimrs-50" class="w-[40px]">
            <template #body="{ data: d }"><Checkbox v-model="d.dipilih" binary :disabled="!bisaDipilih(d)" /></template>
          </Column>
          <Column header="Diterima" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuLaundry(d.waktuTerima) }}</template></Column>
          <Column field="namaRuangan" header="Ruangan" headerClass="bg-opensimrs-50" />
          <Column field="namaLinen" header="Jenis Linen" headerClass="bg-opensimrs-50" />
          <Column header="Kategori" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><span class="px-2 rounded" :class="[gayaKategori(d.kategori).bg, gayaKategori(d.kategori).text]">{{ gayaKategori(d.kategori).label }}</span></template>
          </Column>
          <Column header="Sisa" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.sisa) }} {{ d.satuan }}</template></Column>
          <Column header="Diproses" headerClass="bg-opensimrs-50" class="w-[140px]">
            <template #body="{ data: d }"><CustomInputNumber v-if="d.dipilih" v-model="d.jumlahDiproses" :showLabel="false" :min="1" :max="Number(d.sisa)" /></template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="grow overflow-hidden">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Batch Cuci</h1>
          <CustomSelect
            v-model="filterStatus"
            label="Status"
            :options="[{ value: '', label: 'Semua' }, { value: 'proses', label: 'Proses' }, { value: 'selesai', label: 'Selesai' }]"
            optionValue="value"
            optionLabel="label"
            @update:modelValue="muat"
          />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!batch.length" />
        <DataTable v-else :value="batch" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 60rem">
          <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
          <Column header="Mulai" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuLaundry(d.waktuMulai) }}</template></Column>
          <Column header="Kategori" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><span class="px-2 rounded" :class="[gayaKategori(d.kategori).bg, gayaKategori(d.kategori).text]">{{ gayaKategori(d.kategori).label }}</span></template>
          </Column>
          <Column header="Berat" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.beratKg) }} kg</template></Column>
          <Column header="Asal" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ ringkasAsal(d) }}</template></Column>
          <Column header="Tahapan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="flex flex-wrap gap-1">
                <span v-for="t in d.tahapan" :key="t.uuid" class="px-2 rounded" :class="[gayaStatusLaundry(t.status).bg, gayaStatusLaundry(t.status).text]">
                  {{ TAHAP_BATCH[t.tahap] ?? t.tahap }}: {{ gayaStatusLaundry(t.status).label }}
                </span>
              </div>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[200px]">
            <template #body="{ data: d }">
              <CustomButton
                v-if="boleh('UPDATE') && aksiBerikut(d)"
                size="small"
                :icon="aksiBerikut(d)?.status === 'selesai' ? 'PhCheck' : 'PhPlay'"
                :label="`${aksiBerikut(d)?.status === 'selesai' ? 'Selesaikan' : 'Mulai'} ${TAHAP_BATCH[aksiBerikut(d)?.tahap ?? ''] ?? ''}`"
                @click="ubahTahap(d)"
              />
              <span v-else-if="d.status === 'selesai'" class="text-mint-400">Selesai {{ waktuLaundry(d.waktuSelesai) }}</span>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="520px">
      <template #header>Buat Batch Cuci</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="text-sm">
            {{ terpilih.length }} rincian, kategori <b>{{ gayaKategori(kategoriTerpilih ?? "").label }}</b>, total
            {{ terpilih.reduce((s, x) => s + Number(x.jumlahDiproses || 0), 0) }} unit.
          </div>
          <CustomInputNumber v-model="form.beratKg" label="Berat Cucian (kg)" :min="0" :maxFractionDigits="3" />
          <CustomTextfield v-model="form.kode" label="Kode Batch (opsional, otomatis bila kosong)" :maxLength="60" />
          <CustomTextfield v-model="form.catatan" label="Catatan (opsional)" :maxLength="500" />
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
  </div>
</template>
