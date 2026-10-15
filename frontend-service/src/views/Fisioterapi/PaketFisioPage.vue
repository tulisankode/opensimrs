<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { apiFisio, JENIS_FISIO, labelJenis, rupiah, useFisioterapiStore, type PaketFisio, type TindakanFisio } from "@/stores/penunjang/fisioterapi";

// Datamaster Paket Terapi Fisioterapi: tindakan (qty per sesi) × jumlah sesi dengan satu harga paket.
// Saat diorder, harga paket dialokasikan ke tindakan (tagihan & laporan berjumlah = harga paket).
const store = useFisioterapiStore();
const cari = ref("");
const jenis = ref("");
const halaman = ref({ page: 1, limit: 10 });
const daftar = ref<PaketFisio[]>([]);
const total = ref(0);
const memuat = ref(false);

const muat = async () => {
  memuat.value = true;
  const r = await apiFisio.daftarPaket({ ...halaman.value, cari: cari.value, jenis_fisio: jenis.value });
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
const persenHemat = (harga: number, totalSatuan: number) => (totalSatuan > 0 && totalSatuan > harga ? Math.round(((totalSatuan - harga) / totalSatuan) * 100) : 0);

// ── Form
interface BarisTindakan {
  tindakanUuid: string;
  nama: string;
  harga: number;
  qty: number;
}
interface FormPaket {
  uuid?: string;
  kode: string;
  nama: string;
  jenisFisio: string;
  jumlahSesi: number;
  harga: number;
  deskripsi: string;
  status: boolean;
  tindakan: BarisTindakan[];
}
const dialog = ref(false);
const kosong = (): FormPaket => ({ kode: "", nama: "", jenisFisio: "", jumlahSesi: 6, harga: 0, deskripsi: "", status: true, tindakan: [] });
const form = ref<FormPaket>(kosong());
const galat = ref<Record<string, string>>({});
const semuaTindakan = ref<TindakanFisio[]>([]);
const pilihTindakan = ref("");

const opsiTindakan = computed(() =>
  semuaTindakan.value
    .filter((t) => !t.jenisFisio || !form.value.jenisFisio || t.jenisFisio === form.value.jenisFisio)
    .filter((t) => !form.value.tindakan.some((x) => x.tindakanUuid === t.uuid))
    .map((t) => ({ ...t, label: `${t.nama} — ${rupiah(t.harga)}${t.status ? "" : " (nonaktif)"}` })),
);
const perSesi = computed(() => form.value.tindakan.reduce((n, t) => n + t.harga * (t.qty || 1), 0));
const totalSatuan = computed(() => perSesi.value * (form.value.jumlahSesi || 1));

const bukaForm = async (p?: PaketFisio) => {
  if (!semuaTindakan.value.length) semuaTindakan.value = (await apiFisio.daftarTindakan({ limit: 9999 }))?.payload?.data ?? [];
  form.value = p
    ? {
        uuid: p.uuid, kode: p.kode, nama: p.nama, jenisFisio: p.jenisFisio, jumlahSesi: p.jumlahSesi, harga: p.harga, deskripsi: p.deskripsi ?? "", status: p.status,
        tindakan: p.tindakan.map((t) => ({ tindakanUuid: t.tindakanUuid, nama: t.nama, harga: Number(t.harga), qty: t.qty })),
      }
    : kosong();
  galat.value = {};
  pilihTindakan.value = "";
  dialog.value = true;
};
const tambahTindakan = (uuid: string) => {
  const t = semuaTindakan.value.find((x) => x.uuid === uuid);
  if (t) form.value.tindakan.push({ tindakanUuid: t.uuid, nama: t.nama, harga: Number(t.harga), qty: 1 });
  setTimeout(() => (pilihTindakan.value = ""));
};
// Harga paket cepat: persentase dari total tarif satuan, dibulatkan ke Rp 1.000.
const hargaDiskon = (persen: number) => (form.value.harga = Math.round((totalSatuan.value * (100 - persen)) / 100 / 1000) * 1000);

const simpan = async () => {
  const f = form.value;
  const g: Record<string, string> = {};
  if (!f.kode?.trim()) g.kode = "Kode wajib diisi";
  if (!f.nama?.trim()) g.nama = "Nama paket wajib diisi";
  if (!f.jenisFisio) g.jenisFisio = "Jenis fisioterapi wajib dipilih";
  if (!f.jumlahSesi || f.jumlahSesi < 1 || f.jumlahSesi > 100) g.jumlahSesi = "Jumlah sesi 1 sampai 100";
  if (f.harga == null || Number(f.harga) < 0) g.harga = "Harga paket tidak valid";
  if (!f.tindakan.length) g.tindakan = "Pilih minimal satu tindakan";
  galat.value = g;
  if (Object.keys(g).length) return;
  const r = await apiFisio.simpanPaket(
    {
      kode: f.kode, nama: f.nama, jenisFisio: f.jenisFisio, jumlahSesi: f.jumlahSesi, harga: Number(f.harga), deskripsi: f.deskripsi, status: f.status,
      tindakan: f.tindakan.map((t) => ({ tindakanUuid: t.tindakanUuid, qty: t.qty || 1 })),
    },
    f.uuid,
  );
  if (!r) return;
  dialog.value = false;
  store.muatPaket(true);
  muat();
};

const dialogHapus = ref(false);
const dihapus = ref<PaketFisio | null>(null);
const konfirmasiHapus = (p: PaketFisio) => {
  dihapus.value = p;
  dialogHapus.value = true;
};
const hapus = async () => {
  if (!dihapus.value) return;
  const r = await apiFisio.hapusPaket(dihapus.value.uuid);
  dialogHapus.value = false;
  if (r) {
    store.muatPaket(true);
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
          <h1 class="toolbar-heading text-opensimrs-300">Paket Terapi</h1>
          <CustomTextfield v-model="cari" label="Cari Paket" prependIcon="PhMagnifyingGlass" placeholder="Kode / nama paket" @keydown.enter="cariUlang" />
          <CustomSelect v-model="jenis" label="Jenis Fisioterapi" placeHolder="Semua jenis" :options="JENIS_FISIO" optionLabel="label" optionValue="value" clearable />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariUlang" />
          <CustomButton icon="PhPlus" label="Paket" class="toolbar-action" @click="bukaForm()" />
        </PageToolbar>
      </template>
      <template #content>
        <DataTable :value="daftar" :loading="memuat" stripedRows class="text-xs" scrollable scrollHeight="flex" dataKey="uuid">
          <template #empty><NoData /></template>
          <Column header="No." headerClass="bg-opensimrs-50">
            <template #body="{ index }">{{ (halaman.page - 1) * halaman.limit + index + 1 }}</template>
          </Column>
          <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
          <Column header="Nama Paket" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="font-semibold">{{ data.nama }}</div>
              <div v-if="data.deskripsi" class="text-grey-400">{{ data.deskripsi }}</div>
            </template>
          </Column>
          <Column header="Jenis" headerClass="bg-opensimrs-50">
            <template #body="{ data }">{{ labelJenis(data.jenisFisio) }}</template>
          </Column>
          <Column header="Sesi" headerClass="bg-opensimrs-50">
            <template #body="{ data }"><div class="text-center">{{ data.jumlahSesi }}</div></template>
          </Column>
          <Column header="Tindakan per Sesi" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="t in data.tindakan"
                  :key="t.tindakanUuid"
                  class="px-1.5 py-0.5 rounded"
                  :class="t.aktif ? 'bg-opensimrs-50 text-opensimrs-400' : 'bg-danger-50 text-danger-300 line-through'"
                >
                  {{ t.nama }}{{ t.qty > 1 ? ` ×${t.qty}` : "" }}
                </span>
              </div>
            </template>
          </Column>
          <Column header="Total Satuan" headerClass="bg-opensimrs-50">
            <template #body="{ data }"><div class="text-right text-grey-400 whitespace-nowrap">{{ rupiah(data.totalSatuan) }}</div></template>
          </Column>
          <Column header="Harga Paket" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="text-right whitespace-nowrap">
                <div class="font-semibold">{{ rupiah(data.harga) }}</div>
                <div v-if="persenHemat(data.harga, data.totalSatuan)" class="text-mint-400">hemat {{ persenHemat(data.harga, data.totalSatuan) }}%</div>
              </div>
            </template>
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

    <CustomDialog v-model:visible="dialog" width="min(760px, 94vw)">
      <template #header>{{ form.uuid ? "Ubah" : "Tambah" }} Paket Terapi</template>
      <template #body>
        <div class="grid grid-cols-2 gap-3">
          <CustomTextfield v-model="form.kode" label="Kode" placeholder="mis. PKT-FIS-LBP" :invalid="!!galat.kode" :invalidMessage="galat.kode" required />
          <CustomTextfield v-model="form.nama" label="Nama Paket" placeholder="mis. Paket Low Back Pain" :invalid="!!galat.nama" :invalidMessage="galat.nama" required />
          <CustomSelect
            v-model="form.jenisFisio"
            label="Jenis Fisioterapi"
            placeHolder="Pilih jenis"
            :options="JENIS_FISIO"
            optionLabel="label"
            optionValue="value"
            :invalid="!!galat.jenisFisio"
            :invalidMessage="galat.jenisFisio"
            required
          />
          <CustomInputNumber v-model="form.jumlahSesi" label="Jumlah Sesi" :min="1" :max="100" showButtons :invalid="!!galat.jumlahSesi" :invalidMessage="galat.jumlahSesi" required />
          <CustomTextArea v-model="form.deskripsi" class="col-span-2" label="Deskripsi" placeholder="Indikasi / isi program terapi" />
          <div class="flex flex-col col-span-2 gap-2">
            <CustomSelect
              v-model="pilihTindakan"
              label="Tindakan per Sesi"
              placeHolder="Tambah tindakan terapi"
              :options="opsiTindakan"
              optionLabel="label"
              optionValue="uuid"
              showFilter
              :invalid="!!galat.tindakan"
              :invalidMessage="galat.tindakan"
              @update:modelValue="(v: any) => v && tambahTindakan(v)"
            />
            <table v-if="form.tindakan.length" class="w-full text-xs border rounded border-grey-100">
              <thead class="bg-opensimrs-50">
                <tr>
                  <th class="px-2 py-1.5 text-left">Tindakan</th>
                  <th class="px-2 py-1.5 text-right">Tarif</th>
                  <th class="px-2 py-1.5 w-24">Qty/Sesi</th>
                  <th class="px-2 py-1.5 text-right">Per Sesi</th>
                  <th class="w-8"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(t, i) in form.tindakan" :key="t.tindakanUuid" class="border-t border-grey-75">
                  <td class="px-2 py-1">{{ t.nama }}</td>
                  <td class="px-2 py-1 text-right">{{ rupiah(t.harga) }}</td>
                  <td class="px-2 py-1"><input v-model.number="t.qty" type="number" min="1" class="w-16 px-1 py-0.5 border rounded border-grey-200" aria-label="Qty per sesi" /></td>
                  <td class="px-2 py-1 text-right">{{ rupiah(t.harga * (t.qty || 1)) }}</td>
                  <td class="px-1 text-center">
                    <button type="button" class="text-danger-300" aria-label="Hapus tindakan" @click="form.tindakan.splice(i, 1)"><PhTrash :size="14" /></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="col-span-2 p-3 text-sm rounded-lg bg-opensimrs-50">
            <div class="flex justify-between"><span>Tarif satuan per sesi</span><span>{{ rupiah(perSesi) }}</span></div>
            <div class="flex justify-between"><span>Total tarif satuan ({{ form.jumlahSesi || 1 }} sesi)</span><b>{{ rupiah(totalSatuan) }}</b></div>
            <div class="flex justify-between">
              <span>Harga paket</span>
              <b :class="Number(form.harga) > totalSatuan ? 'text-warning-400' : 'text-opensimrs-400'">{{ rupiah(form.harga) }}</b>
            </div>
            <div class="flex justify-between text-xs text-grey-400">
              <span>Selisih</span><span>{{ rupiah(totalSatuan - Number(form.harga || 0)) }} ({{ persenHemat(Number(form.harga || 0), totalSatuan) }}%)</span>
            </div>
          </div>
          <CustomInputNumber v-model="form.harga" label="Harga Paket (Rp, seluruh sesi)" :min="0" :invalid="!!galat.harga" :invalidMessage="galat.harga" required />
          <div class="flex items-end gap-2 pb-1">
            <span class="text-xs text-grey-400">Diskon cepat:</span>
            <CustomButton v-for="p in [10, 15, 20]" :key="p" :label="`${p}%`" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="hargaDiskon(p)" />
          </div>
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
      <template #header>Hapus Paket</template>
      <template #body>
        <p class="text-sm">Hapus <b>{{ dihapus?.nama }}</b>? Order lama tetap menyimpan tindakan &amp; nilai paketnya.</p>
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
