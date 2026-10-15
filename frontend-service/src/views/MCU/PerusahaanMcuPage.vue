<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import {
  daftarPerusahaanMcu, hapusPerusahaanMcu, simpanPerusahaanMcu, daftarPaketMcu, hargaKontrakMcu, simpanHargaKontrakMcu,
  hapusHargaKontrakMcu, izinMcu, rupiah, tglIndo, tglIso,
} from "@/stores/penunjang/mcu";

// Datamaster perusahaan / instansi klien MCU korporasi + harga kontrak paket per perusahaan.
const boleh = (aksi: string) => izinMcu("Datamaster", aksi, "Perusahaan");
const rows = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(10);
const cari = ref("");
const memuat = ref(false);
const paket = ref<any[]>([]);

const muat = async () => {
  memuat.value = true;
  const res = await daftarPerusahaanMcu({ page: page.value, limit: limit.value, cari: cari.value });
  rows.value = res?.payload?.data ?? [];
  total.value = res?.payload?.pagination?.total ?? 0;
  memuat.value = false;
};
const cariUlang = () => {
  page.value = 1;
  muat();
};
const gantiHalaman = (e: any) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

const kosong = () => ({ uuid: "", kode: "", nama: "", alamat: "", pic: "", telepon: "", email: "", status: true });
const form = ref<any>(kosong());
const dialog = ref(false);
const tab = ref<"data" | "kontrak">("data");
const menyimpan = ref(false);
const buka = (r?: any, keTab: "data" | "kontrak" = "data") => {
  form.value = r ? { ...kosong(), ...r } : kosong();
  tab.value = r ? keTab : "data";
  kontrak.value = [];
  formKontrak.value = null;
  if (r) muatKontrak();
  dialog.value = true;
};
const simpan = async () => {
  if (!form.value.kode || !form.value.nama) return;
  menyimpan.value = true;
  const { uuid, kode, nama, alamat, pic, telepon, email, status } = form.value;
  const res = await simpanPerusahaanMcu({ kode, nama, alamat, pic, telepon, email, status }, uuid || undefined);
  menyimpan.value = false;
  if (res) {
    muat();
    if (!uuid && res.payload?.uuid) {
      // Perusahaan baru: lanjut ke tab Harga Kontrak.
      form.value = { ...form.value, uuid: res.payload.uuid };
      tab.value = "kontrak";
      muatKontrak();
    } else dialog.value = false;
  }
};
const hapus = async (r: any) => {
  if (!window.confirm(`Hapus perusahaan ${r.nama}?`)) return;
  if (await hapusPerusahaanMcu(r.uuid)) muat();
};

// ── Harga kontrak ─────────────────────────────────────────
const kontrak = ref<any[]>([]);
const memuatKontrak = ref(false);
const formKontrak = ref<any>(null);
const muatKontrak = async () => {
  if (!form.value.uuid) return;
  memuatKontrak.value = true;
  kontrak.value = (await hargaKontrakMcu(form.value.uuid))?.payload ?? [];
  memuatKontrak.value = false;
};
const paketKorporasi = computed(() => paket.value.filter((p) => p.jenis !== "perorangan"));
const keTanggal = (s?: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
const ubahKontrak = (k?: any) => {
  formKontrak.value = k
    ? { uuid: k.uuid, paketUuid: k.paketUuid, harga: k.harga, mulai: keTanggal(k.berlakuMulai), sampai: keTanggal(k.berlakuSampai), noKontrak: k.noKontrak ?? "", catatan: k.catatan ?? "", status: k.status }
    : { uuid: "", paketUuid: null, harga: null, mulai: null, sampai: null, noKontrak: "", catatan: "", status: true };
};
const pilihPaketKontrak = () => {
  if (!formKontrak.value) return;
  const p = paket.value.find((x) => x.uuid === formKontrak.value.paketUuid);
  if (p && (formKontrak.value.harga === null || formKontrak.value.harga === undefined)) formKontrak.value.harga = p.harga;
};
const simpanKontrak = async () => {
  const k = formKontrak.value;
  const res = await simpanHargaKontrakMcu(
    form.value.uuid,
    {
      paketUuid: k.paketUuid, harga: Number(k.harga) || 0, berlakuMulai: k.mulai ? tglIso(k.mulai) : null, berlakuSampai: k.sampai ? tglIso(k.sampai) : null,
      noKontrak: k.noKontrak, catatan: k.catatan, status: k.status,
    },
    k.uuid || undefined,
  );
  if (res) {
    await tutupKontrak();
    muatKontrak();
  }
};
// Tutup form setelah input aktif melepas fokus (InputNumber memperbarui nilai saat blur).
const tutupKontrak = async () => {
  (document.activeElement as HTMLElement | null)?.blur?.();
  await nextTick();
  formKontrak.value = null;
};
const hapusKontrak = async (k: any) => {
  if (!window.confirm(`Hapus harga kontrak ${k.namaPaket}?`)) return;
  if (await hapusHargaKontrakMcu(form.value.uuid, k.uuid)) muatKontrak();
};
const selisih = (k: any) => (k.hargaPaket ? Math.round(((k.harga - k.hargaPaket) / k.hargaPaket) * 1000) / 10 : 0);

onMounted(async () => {
  muat();
  paket.value = (await daftarPaketMcu({ limit: 500 }))?.payload?.data ?? [];
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-hidden" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <CustomBreadCrumb :home="{ label: 'Datamaster', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Perusahaan</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Kode / nama / PIC" @keydown.enter="cariUlang" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariUlang" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Perusahaan" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <DataTable :value="rows" :loading="memuat" stripedRows class="text-xs" scrollable scrollHeight="flex" dataKey="uuid">
          <template #empty><div class="py-6 text-center text-grey-400">Belum ada data perusahaan</div></template>
          <Column header="No." headerClass="bg-opensimrs-50" class="w-12">
            <template #body="{ index }">{{ (page - 1) * limit + index + 1 }}</template>
          </Column>
          <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
          <Column header="Nama Perusahaan" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="font-semibold">{{ data.nama }}</div>
              <div class="text-grey-400">{{ data.alamat || "-" }}</div>
            </template>
          </Column>
          <Column header="PIC / Kontak" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div>{{ data.pic || "-" }}</div>
              <div class="text-grey-400">{{ [data.telepon, data.email].filter(Boolean).join(" · ") || "-" }}</div>
            </template>
          </Column>
          <Column header="Peserta" headerClass="bg-opensimrs-50">
            <template #body="{ data }">{{ data.jumlahPeserta }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <span class="px-2 py-0.5 rounded-full font-semibold" :class="data.status ? 'bg-[#D1FADF] text-[#027A48]' : 'bg-[#F2F4F7] text-[#667085]'">
                {{ data.status ? "Aktif" : "Nonaktif" }}
              </span>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-32">
            <template #body="{ data }">
              <div class="flex gap-1">
                <Button text rounded size="small" aria-label="Harga kontrak" title="Harga kontrak" @click="buka(data, 'kontrak')"><PhHandshake :size="16" /></Button>
                <Button v-if="boleh('UPDATE')" text rounded size="small" aria-label="Ubah" @click="buka(data)"><PhPencilSimple :size="16" /></Button>
                <Button v-if="boleh('DELETE')" text rounded size="small" severity="danger" aria-label="Hapus" @click="hapus(data)"><PhTrash :size="16" /></Button>
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="px-4 py-2">
          <Paginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[10, 20, 50]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="860px">
      <template #header>{{ form.uuid ? form.nama : "Tambah Perusahaan" }}</template>
      <template #body>
        <div class="flex gap-1 pt-3 border-b border-grey-100">
          <button type="button" class="px-4 py-2 text-sm border-b-2" :class="tab === 'data' ? 'border-opensimrs-300 text-opensimrs-300 font-semibold' : 'border-transparent text-grey-400'" @click="tab = 'data'">Data Perusahaan</button>
          <button type="button" class="px-4 py-2 text-sm border-b-2" :class="tab === 'kontrak' ? 'border-opensimrs-300 text-opensimrs-300 font-semibold' : 'border-transparent text-grey-400'" :disabled="!form.uuid" @click="tab = 'kontrak'">
            Harga Kontrak <span v-if="kontrak.length" class="ml-1 px-1.5 rounded-full bg-opensimrs-50">{{ kontrak.length }}</span>
          </button>
        </div>

        <fieldset v-if="tab === 'data'" :disabled="!!form.uuid && !boleh('UPDATE')" class="grid grid-cols-3 gap-3 pt-4 text-sm">
          <label class="flex flex-col gap-1">Kode *<InputText v-model="form.kode" placeholder="mis. PT-SL" /></label>
          <label class="flex flex-col col-span-2 gap-1">Nama Perusahaan *<InputText v-model="form.nama" /></label>
          <label class="flex flex-col col-span-3 gap-1">Alamat<TextArea v-model="form.alamat" rows="2" autoResize /></label>
          <label class="flex flex-col gap-1">PIC / HRD<InputText v-model="form.pic" /></label>
          <label class="flex flex-col gap-1">Telepon<InputText v-model="form.telepon" /></label>
          <label class="flex flex-col gap-1">Email<InputText v-model="form.email" /></label>
          <label class="flex items-center col-span-3 gap-2"><ToggleSwitch v-model="form.status" /> {{ form.status ? "Aktif" : "Nonaktif" }}</label>
        </fieldset>

        <div v-else class="flex flex-col gap-3 pt-4 text-sm" data-uji="tab-kontrak">
          <div class="text-xs text-grey-400">
            Harga paket khusus perusahaan ini. Pendaftaran korporasi (manual maupun impor Excel) memakai harga kontrak yang berlaku pada tanggal MCU;
            bila tidak ada, dipakai harga paket. Peserta yang sudah terdaftar tidak berubah harganya.
          </div>
          <DataTable :value="kontrak" :loading="memuatKontrak" class="text-xs" dataKey="uuid">
            <template #empty><div class="py-4 text-center text-grey-400">Belum ada harga kontrak — semua paket memakai harga paket.</div></template>
            <Column header="Paket" headerClass="bg-opensimrs-50">
              <template #body="{ data }"><div class="font-semibold">{{ data.namaPaket }}</div><div class="text-grey-400">{{ data.kodePaket }} · harga paket {{ rupiah(data.hargaPaket) }}</div></template>
            </Column>
            <Column header="Harga Kontrak" headerClass="bg-opensimrs-50">
              <template #body="{ data }"><b>{{ rupiah(data.harga) }}</b> <span class="text-grey-400">({{ selisih(data) > 0 ? "+" : "" }}{{ selisih(data) }}%)</span></template>
            </Column>
            <Column header="Berlaku" headerClass="bg-opensimrs-50">
              <template #body="{ data }">{{ data.berlakuMulai ? tglIndo(data.berlakuMulai) : "Sejak awal" }} – {{ data.berlakuSampai ? tglIndo(data.berlakuSampai) : "seterusnya" }}</template>
            </Column>
            <Column header="No. Kontrak" headerClass="bg-opensimrs-50"><template #body="{ data }">{{ data.noKontrak ?? "-" }}</template></Column>
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data }">
                <span class="px-2 py-0.5 rounded-full font-semibold" :class="data.berlakuHariIni ? 'bg-[#D1FADF] text-[#027A48]' : 'bg-[#F2F4F7] text-[#667085]'">
                  {{ !data.status ? "Nonaktif" : data.berlakuHariIni ? "Berlaku" : "Di luar masa berlaku" }}
                </span>
              </template>
            </Column>
            <Column v-if="boleh('UPDATE')" header="" headerClass="bg-opensimrs-50" class="w-20">
              <template #body="{ data }">
                <div class="flex gap-1">
                  <Button text rounded size="small" aria-label="Ubah kontrak" @click="ubahKontrak(data)"><PhPencilSimple :size="14" /></Button>
                  <Button text rounded size="small" severity="danger" aria-label="Hapus kontrak" @click="hapusKontrak(data)"><PhTrash :size="14" /></Button>
                </div>
              </template>
            </Column>
          </DataTable>
          <CustomButton v-if="boleh('UPDATE') && !formKontrak" icon="PhPlus" label="Tambah Harga Kontrak" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" class="self-start" @click="ubahKontrak()" />
          <div v-if="formKontrak" class="grid grid-cols-4 gap-3 p-3 border rounded border-opensimrs-100 bg-opensimrs-50" data-uji="form-kontrak">
            <label class="flex flex-col col-span-2 gap-1">Paket MCU *
              <Select v-model="formKontrak.paketUuid" :options="paketKorporasi" optionLabel="nama" optionValue="uuid" filter placeholder="Pilih paket" @change="pilihPaketKontrak">
                <template #option="{ option }"><div class="flex justify-between w-full gap-3"><span>{{ option.kode }} — {{ option.nama }}</span><span class="text-grey-400">{{ rupiah(option.harga) }}</span></div></template>
              </Select>
            </label>
            <label class="flex flex-col gap-1">Harga kontrak (Rp) *<InputNumber v-model="formKontrak.harga" :min="0" locale="id-ID" /></label>
            <label class="flex flex-col gap-1">No. kontrak / PKS<InputText v-model="formKontrak.noKontrak" /></label>
            <label class="flex flex-col gap-1">Berlaku mulai<DatePicker v-model="formKontrak.mulai" dateFormat="dd-mm-yy" showClear placeholder="Sejak awal" /></label>
            <label class="flex flex-col gap-1">Berlaku sampai<DatePicker v-model="formKontrak.sampai" dateFormat="dd-mm-yy" showClear placeholder="Seterusnya" :minDate="formKontrak.mulai ?? undefined" /></label>
            <label class="flex flex-col col-span-2 gap-1">Catatan<InputText v-model="formKontrak.catatan" /></label>
            <label class="flex items-center col-span-2 gap-2"><ToggleSwitch v-model="formKontrak.status" /> {{ formKontrak.status ? "Aktif" : "Nonaktif" }}</label>
            <div class="flex justify-end col-span-2 gap-2">
              <CustomButton label="Batal" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="tutupKontrak" />
              <CustomButton label="Simpan Kontrak" :disabled="!formKontrak.paketUuid || formKontrak.harga === null" @click="simpanKontrak" />
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="dialog = false" />
          <CustomButton
            v-if="tab === 'data' && (form.uuid ? boleh('UPDATE') : boleh('CREATE'))"
            label="Simpan"
            :loading="menyimpan"
            :disabled="!form.kode || !form.nama"
            @click="simpan"
          />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
