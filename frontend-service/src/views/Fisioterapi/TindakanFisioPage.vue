<script setup lang="ts">
import { onMounted, ref } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { apiFisio, JENIS_FISIO, labelJenis, rupiah, useFisioterapiStore, type TindakanFisio } from "@/stores/penunjang/fisioterapi";

// Datamaster Tindakan Terapi (tarif fisioterapi). Jenis kosong = berlaku untuk semua jenis fisioterapi.
const store = useFisioterapiStore();
const cari = ref("");
const jenis = ref("");
const halaman = ref({ page: 1, limit: 10 });
const daftar = ref<TindakanFisio[]>([]);
const total = ref(0);
const memuat = ref(false);

const muat = async () => {
  memuat.value = true;
  const r = await apiFisio.daftarTindakan({ ...halaman.value, cari: cari.value, jenis_fisio: jenis.value });
  daftar.value = r?.payload?.data ?? [];
  total.value = r?.payload?.pagination?.total ?? 0;
  memuat.value = false;
};
const cariUlang = () => {
  halaman.value.page = 1;
  muat();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  halaman.value = { page: e.page + 1, limit: e.rows };
  muat();
};

const opsiJenis = [{ value: "", label: "Semua jenis" }, ...JENIS_FISIO];
const dialog = ref(false);
const form = ref<Partial<TindakanFisio>>({});
const galat = ref<Record<string, string>>({});
const bukaForm = (t?: TindakanFisio) => {
  form.value = t ? { ...t, jenisFisio: t.jenisFisio ?? "" } : { kode: "", nama: "", harga: 0, jenisFisio: "", status: true };
  galat.value = {};
  dialog.value = true;
};
const simpan = async () => {
  galat.value = {};
  if (!form.value.kode?.trim()) galat.value.kode = "Kode wajib diisi";
  if (!form.value.nama?.trim()) galat.value.nama = "Nama tindakan wajib diisi";
  if (form.value.harga == null || Number(form.value.harga) < 0) galat.value.harga = "Tarif tidak valid";
  if (Object.keys(galat.value).length) return;
  const { uuid, kode, nama, harga, jenisFisio, status } = form.value;
  const r = await apiFisio.simpanTindakan({ kode, nama, harga: Number(harga), jenisFisio: jenisFisio || null, status }, uuid);
  if (!r) return;
  dialog.value = false;
  store.muatTindakan(true);
  muat();
};

const dialogHapus = ref(false);
const dihapus = ref<TindakanFisio | null>(null);
const konfirmasiHapus = (t: TindakanFisio) => {
  dihapus.value = t;
  dialogHapus.value = true;
};
const hapus = async () => {
  if (!dihapus.value) return;
  const r = await apiFisio.hapusTindakan(dihapus.value.uuid);
  dialogHapus.value = false;
  if (r) {
    store.muatTindakan(true);
    muat();
  }
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <CustomBreadCrumb :home="{ label: 'Datamaster', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Tindakan Terapi</h1>
          <CustomTextfield v-model="cari" label="Cari Tindakan" prependIcon="PhMagnifyingGlass" placeholder="Kode / nama tindakan" @keydown.enter="cariUlang" />
          <CustomSelect v-model="jenis" label="Jenis Fisioterapi" placeHolder="Semua jenis" :options="JENIS_FISIO" optionLabel="label" optionValue="value" clearable />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariUlang" />
          <CustomButton icon="PhPlus" label="Tindakan" class="toolbar-action" @click="bukaForm()" />
        </PageToolbar>
      </template>
      <template #content>
        <DataTable :value="daftar" :loading="memuat" stripedRows class="text-xs" scrollable scrollHeight="flex" dataKey="uuid">
          <template #empty><NoData /></template>
          <Column header="No." headerClass="bg-opensimrs-50">
            <template #body="{ index }">{{ (halaman.page - 1) * halaman.limit + index + 1 }}</template>
          </Column>
          <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
          <Column field="nama" header="Nama Tindakan" headerClass="bg-opensimrs-50" />
          <Column header="Jenis Fisioterapi" headerClass="bg-opensimrs-50">
            <template #body="{ data }">{{ data.jenisFisio ? labelJenis(data.jenisFisio) : "Semua jenis" }}</template>
          </Column>
          <Column header="Tarif" headerClass="bg-opensimrs-50">
            <template #body="{ data }"><div class="text-right">{{ rupiah(data.harga) }}</div></template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold" :class="data.status ? 'bg-opensimrs-300 text-white' : 'border border-grey-300 text-grey-400'">
                {{ data.status ? "AKTIF" : "NON-AKTIF" }}
              </span>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50">
            <template #header><div class="w-full text-center">Aksi</div></template>
            <template #body="{ data }">
              <div class="flex items-center justify-center gap-2">
                <button type="button" class="p-1 text-white rounded bg-info-300" aria-label="Ubah" @click="bukaForm(data)"><PhPencilSimple :size="14" /></button>
                <button type="button" class="p-1 text-white rounded bg-danger-300" aria-label="Hapus" @click="konfirmasiHapus(data)"><PhTrash :size="14" /></button>
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="halaman.limit" :totalRecords="total" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="min(520px, 94vw)">
      <template #header>{{ form.uuid ? "Ubah" : "Tambah" }} Tindakan Terapi</template>
      <template #body>
        <div class="grid grid-cols-2 gap-3">
          <CustomTextfield v-model="form.kode" label="Kode" placeholder="mis. FIS-IR" :invalid="!!galat.kode" :invalidMessage="galat.kode" required />
          <CustomInputNumber v-model="form.harga" label="Tarif (Rp)" :min="0" :invalid="!!galat.harga" :invalidMessage="galat.harga" required />
          <CustomTextfield v-model="form.nama" class="col-span-2" label="Nama Tindakan" placeholder="mis. Infra Red" :invalid="!!galat.nama" :invalidMessage="galat.nama" required />
          <CustomSelect v-model="form.jenisFisio" class="col-span-2" label="Jenis Fisioterapi" :options="opsiJenis" optionLabel="label" optionValue="value" />
          <CustomSwitch v-model="form.status" class="col-span-2" showLabel label="Status" sideLabel="NON-AKTIF" sideLabelTrue="AKTIF" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogHapus" width="min(420px, 94vw)" headerBg="bg-danger-300">
      <template #header>Hapus Tindakan</template>
      <template #body>
        <p class="text-sm">Hapus <b>{{ dihapus?.nama }}</b>? Order lama tetap menyimpan nama & tarif tindakan ini.</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="dialogHapus = false" />
          <CustomButton label="Hapus" backgroundColor="bg-danger-300" @click="hapus" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
