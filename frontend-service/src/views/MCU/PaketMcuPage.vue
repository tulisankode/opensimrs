<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import {
  daftarPaketMcu, detailPaketMcu, hapusPaketMcu, simpanPaketMcu, referensiMcu, izinMcu,
  STASIUN_MCU, JENIS_PAKET, JENIS_ITEM, namaStasiun, rupiah,
} from "@/stores/penunjang/mcu";

// Datamaster Paket MCU: harga, stasiun pemeriksaan, isi paket (lab / radiologi / tindakan). Item lab menunjuk
// pemeriksaan/tarif lab (mis. Darah Rutin) atau parameter lab; saat peserta didaftarkan dibuat order di Laboratorium.
const boleh = (aksi: string) => izinMcu("Datamaster", aksi, "Paket MCU");
const rows = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(10);
const cari = ref("");
const memuat = ref(false);
const ref_ = ref<any>({ radiologi: [], lab: [], labTarif: [] });
const rencanaLab = ref<any>(null);
// Opsi item lab: pemeriksaan (tarif lab, bisa berupa panel) atau parameter tunggal.
const opsiLab = computed(() => [
  {
    label: "Pemeriksaan lab (tarif / panel)",
    items: (ref_.value.labTarif ?? []).map((t: any) => ({ value: `t:${t.uuid}`, label: `${t.kode} — ${t.nama}${t.jumlahParameter > 1 ? ` (${t.jumlahParameter} parameter)` : ""}` })),
  },
  { label: "Parameter lab", items: (ref_.value.lab ?? []).map((i: any) => ({ value: `i:${i.uuid}`, label: `${i.nama}${i.satuan ? ` (${i.satuan})` : ""}` })) },
]);
const pilihanLab = (it: any) => (it.tarifLabUuid ? `t:${it.tarifLabUuid}` : it.refUuid ? `i:${it.refUuid}` : null);

const muat = async () => {
  memuat.value = true;
  const res = await daftarPaketMcu({ page: page.value, limit: limit.value, cari: cari.value });
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

const OPSI_JENIS = Object.entries(JENIS_PAKET).map(([value, label]) => ({ value, label }));
// Stasiun yang dipilih manual; laboratorium & radiologi otomatis mengikuti item, kesimpulan selalu ada.
const STASIUN_PILIHAN = STASIUN_MCU.filter((s) => !["laboratorium", "radiologi", "kesimpulan"].includes(s.kode));

const kosong = () => ({
  uuid: "", kode: "", nama: "", deskripsi: "", harga: 0, jenis: "semua", status: true,
  stasiun: ["anamnesis", "tanda_vital", "fisik"] as string[], items: [] as any[],
});
const form = ref<any>(kosong());
const dialog = ref(false);
const menyimpan = ref(false);

const stasiunAkhir = computed(() => {
  const set = new Set<string>([...form.value.stasiun, "kesimpulan"]);
  if (form.value.items.some((i: any) => i.jenis === "lab")) set.add("laboratorium");
  if (form.value.items.some((i: any) => i.jenis === "radiologi")) set.add("radiologi");
  return STASIUN_MCU.filter((s) => set.has(s.kode));
});

const buka = async (r?: any) => {
  if (r) {
    const res = await detailPaketMcu(r.uuid);
    if (!res) return;
    const p = res.payload;
    form.value = {
      ...kosong(), ...p,
      stasiun: (p.stasiun ?? []).filter((s: string) => !["laboratorium", "radiologi", "kesimpulan"].includes(s)),
      items: (p.items ?? []).map((i: any) => ({ jenis: i.jenis, refUuid: i.refUuid, tarifLabUuid: i.tarifLabUuid, nama: i.nama, satuan: i.satuan, nilaiRujukan: i.nilaiRujukan })),
    };
    rencanaLab.value = p.rencanaLab ?? null;
  } else {
    form.value = kosong();
    rencanaLab.value = null;
  }
  dialog.value = true;
};

const tambahItem = (jenis: string) => form.value.items.push({ jenis, refUuid: null, tarifLabUuid: null, nama: "", satuan: "", nilaiRujukan: "" });
const gantiLab = (it: any, v: string | null) => {
  it.refUuid = null;
  it.tarifLabUuid = null;
  if (v?.startsWith("t:")) {
    it.tarifLabUuid = v.slice(2);
    const t = ref_.value.labTarif.find((x: any) => x.uuid === it.tarifLabUuid);
    if (t) {
      it.nama = t.nama;
      it.satuan = "";
    }
  } else if (v?.startsWith("i:")) {
    it.refUuid = v.slice(2);
    pilihRef(it);
  }
};
const pilihRef = (it: any) => {
  const sumber = it.jenis === "radiologi" ? ref_.value.radiologi : ref_.value.lab;
  const m = sumber.find((x: any) => x.uuid === it.refUuid);
  if (m) {
    it.nama = m.nama;
    if (it.jenis === "lab") it.satuan = m.satuan ?? it.satuan;
  }
};

const simpan = async () => {
  menyimpan.value = true;
  const f = form.value;
  const res = await simpanPaketMcu(
    {
      kode: f.kode, nama: f.nama, deskripsi: f.deskripsi, harga: Number(f.harga) || 0, jenis: f.jenis, status: f.status,
      stasiun: f.stasiun,
      items: f.items.map((i: any) => ({ jenis: i.jenis, refUuid: i.refUuid || null, tarifLabUuid: i.tarifLabUuid || null, nama: i.nama, satuan: i.satuan, nilaiRujukan: i.nilaiRujukan })),
    },
    f.uuid || undefined,
  );
  menyimpan.value = false;
  if (res) {
    rencanaLab.value = res.payload?.rencanaLab ?? null;
    form.value.uuid = res.payload?.uuid ?? form.value.uuid;
    muat();
    if (!rencanaLab.value?.tarif?.length && !rencanaLab.value?.manual?.length) dialog.value = false;
  }
};
const hapus = async (r: any) => {
  if (!window.confirm(`Hapus paket ${r.nama}?`)) return;
  if (await hapusPaketMcu(r.uuid)) muat();
};

onMounted(async () => {
  muat();
  ref_.value = (await referensiMcu())?.payload ?? ref_.value;
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
          <h1 class="toolbar-heading text-opensimrs-300">Paket MCU</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Kode / nama paket" @keydown.enter="cariUlang" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariUlang" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Paket" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <DataTable :value="rows" :loading="memuat" stripedRows class="text-xs" scrollable scrollHeight="flex" dataKey="uuid">
          <template #empty><div class="py-6 text-center text-grey-400">Belum ada paket MCU</div></template>
          <Column header="Kode" field="kode" headerClass="bg-opensimrs-50" />
          <Column header="Nama Paket" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="font-semibold">{{ data.nama }}</div>
              <div class="text-grey-400 max-w-[320px] whitespace-normal">{{ data.deskripsi || "-" }}</div>
            </template>
          </Column>
          <Column header="Untuk" headerClass="bg-opensimrs-50">
            <template #body="{ data }">{{ JENIS_PAKET[data.jenis] ?? data.jenis }}</template>
          </Column>
          <Column header="Stasiun" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="flex flex-wrap gap-1 max-w-[360px]">
                <span v-for="s in data.stasiun" :key="s" class="px-1.5 py-0.5 rounded bg-opensimrs-50 text-opensimrs-400">{{ namaStasiun(s) }}</span>
              </div>
            </template>
          </Column>
          <Column header="Item" headerClass="bg-opensimrs-50">
            <template #body="{ data }">{{ data.jumlahItem }}</template>
          </Column>
          <Column header="Harga" headerClass="bg-opensimrs-50">
            <template #body="{ data }"><span class="font-semibold">{{ rupiah(data.harga) }}</span></template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <span class="px-2 py-0.5 rounded-full font-semibold" :class="data.status ? 'bg-[#D1FADF] text-[#027A48]' : 'bg-[#F2F4F7] text-[#667085]'">
                {{ data.status ? "Aktif" : "Nonaktif" }}
              </span>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-24">
            <template #body="{ data }">
              <div class="flex gap-1">
                <Button text rounded size="small" :aria-label="boleh('UPDATE') ? 'Ubah' : 'Lihat'" @click="buka(data)"><PhPencilSimple v-if="boleh('UPDATE')" :size="16" /><PhEye v-else :size="16" /></Button>
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

    <CustomDialog v-model:visible="dialog" width="880px">
      <template #header>{{ form.uuid ? "Ubah" : "Tambah" }} Paket MCU</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-4 gap-3">
            <label class="flex flex-col gap-1">Kode *<InputText v-model="form.kode" placeholder="mis. MCU-STD" /></label>
            <label class="flex flex-col col-span-2 gap-1">Nama Paket *<InputText v-model="form.nama" /></label>
            <label class="flex flex-col gap-1">Harga (Rp)<InputNumber v-model="form.harga" :min="0" locale="id-ID" /></label>
            <label class="flex flex-col col-span-2 gap-1">Berlaku untuk
              <Select v-model="form.jenis" :options="OPSI_JENIS" optionLabel="label" optionValue="value" />
            </label>
            <label class="flex items-end col-span-2 gap-2 pb-2"><ToggleSwitch v-model="form.status" /> {{ form.status ? "Aktif" : "Nonaktif" }}</label>
            <label class="flex flex-col col-span-4 gap-1">Deskripsi<TextArea v-model="form.deskripsi" rows="2" autoResize /></label>
          </div>

          <div>
            <div class="mb-2 font-semibold">Stasiun Pemeriksaan</div>
            <div class="flex flex-wrap gap-3">
              <label v-for="s in STASIUN_PILIHAN" :key="s.kode" class="flex items-center gap-1.5">
                <Checkbox v-model="form.stasiun" :value="s.kode" /> {{ s.nama }}
              </label>
            </div>
            <div class="mt-2 text-xs text-grey-400">
              Alur peserta: {{ stasiunAkhir.map((s) => s.nama).join(" → ") }}
              <br />Laboratorium & Radiologi otomatis ditambahkan bila paket berisi item tersebut; Kesimpulan Dokter selalu ada.
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="font-semibold">Isi Paket</span>
              <div class="flex gap-2">
                <Button size="small" outlined label="+ Lab" @click="tambahItem('lab')" />
                <Button size="small" outlined label="+ Radiologi" @click="tambahItem('radiologi')" />
                <Button size="small" outlined label="+ Tindakan" @click="tambahItem('tindakan')" />
              </div>
            </div>
            <table class="w-full text-xs border border-grey-100">
              <thead class="bg-opensimrs-50">
                <tr>
                  <th class="p-2 text-left w-24">Jenis</th>
                  <th class="p-2 text-left">Master / Nama Pemeriksaan</th>
                  <th class="p-2 text-left w-28">Satuan</th>
                  <th class="p-2 text-left w-36">Nilai Rujukan</th>
                  <th class="w-10"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!form.items.length"><td colspan="5" class="p-3 text-center text-grey-400">Belum ada item</td></tr>
                <tr v-for="(it, i) in form.items" :key="i" class="border-t border-grey-100">
                  <td class="p-2">{{ JENIS_ITEM[it.jenis] }}</td>
                  <td class="p-2">
                    <div class="flex flex-col gap-1">
                      <Select
                        v-if="it.jenis === 'lab'"
                        :modelValue="pilihanLab(it)"
                        :options="opsiLab"
                        optionLabel="label"
                        optionValue="value"
                        optionGroupLabel="label"
                        optionGroupChildren="items"
                        filter
                        showClear
                        placeholder="Pilih pemeriksaan / parameter lab (kosong = teks bebas, diisi manual di stasiun)"
                        class="w-full"
                        size="small"
                        @update:modelValue="gantiLab(it, $event)"
                      />
                      <Select
                        v-if="it.jenis === 'radiologi'"
                        v-model="it.refUuid"
                        :options="ref_.radiologi"
                        optionLabel="nama"
                        optionValue="uuid"
                        filter
                        :showClear="it.jenis === 'lab'"
                        :placeholder="it.jenis === 'radiologi' ? 'Pilih master radiologi' : 'Pilih master lab (opsional)'"
                        class="w-full"
                        size="small"
                        @change="pilihRef(it)"
                      />
                      <InputText v-if="it.jenis !== 'radiologi'" v-model="it.nama" size="small" placeholder="Nama pemeriksaan" />
                      <small v-if="it.jenis === 'radiologi' && !ref_.radiologi.length" class="text-danger-300">
                        Master radiologi kosong — isi di modul Radiologi.
                      </small>
                    </div>
                  </td>
                  <td class="p-2"><InputText v-if="it.jenis === 'lab'" v-model="it.satuan" size="small" class="w-full" /></td>
                  <td class="p-2"><InputText v-if="it.jenis === 'lab'" v-model="it.nilaiRujukan" size="small" class="w-full" /></td>
                  <td class="p-2">
                    <Button text rounded size="small" severity="danger" aria-label="Hapus item" @click="form.items.splice(i, 1)"><PhTrash :size="14" /></Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="rencanaLab && (rencanaLab.tarif?.length || rencanaLab.manual?.length)" class="p-3 text-xs rounded bg-opensimrs-50" data-uji="rencana-lab">
            <div class="mb-1 font-semibold">Order laboratorium otomatis saat peserta didaftarkan (tanpa tagihan lab terpisah):</div>
            <div v-if="rencanaLab.tarif?.length">{{ rencanaLab.tarif.map((t: any) => `${t.kode} ${t.nama}`).join(" · ") }}</div>
            <div v-if="rencanaLab.manual?.length" class="mt-1 text-[#B54708]">Diisi manual di stasiun Laboratorium MCU (tidak ada di master tarif lab): {{ rencanaLab.manual.join(", ") }}</div>
            <div v-if="rencanaLab.konflik?.length" class="mt-1 text-danger-300">{{ rencanaLab.konflik.join("; ") }}</div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="dialog = false" />
          <CustomButton v-if="form.uuid ? boleh('UPDATE') : boleh('CREATE')" label="Simpan" :loading="menyimpan" :disabled="!form.kode || !form.nama" @click="simpan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
