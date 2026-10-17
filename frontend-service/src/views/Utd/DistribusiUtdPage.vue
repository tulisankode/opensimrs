<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  ALASAN_MUSNAH_UTD,
  GOLONGAN_DARAH_UTD,
  JENIS_KOMPONEN_UTD,
  PENERIMA_TIPE_UTD,
  STATUS_DISTRIBUSI_UTD,
  STATUS_PERMINTAAN_UTD,
  bolehLihatReaktifUtd,
  buatPermintaanUtd,
  daftarDistribusiUtd,
  daftarKomponenUtd,
  daftarPemusnahanUtd,
  daftarPermintaanUtd,
  detailPermintaanUtd,
  distribusikanUtd,
  gayaDistribusiUtd,
  gayaKomponenUtd,
  gayaPermintaanUtd,
  golonganRhUtd,
  izinUtd,
  keEpoch,
  kirimUlangBdrsUtd,
  musnahkanUtd,
  opsi,
  sisaHariUtd,
  tglUtd,
  tindakLanjutPemusnahanUtd,
  waktuUtd,
} from "@/stores/penunjang/utd";

// Penyimpanan & Distribusi: ringkasan stok komponen siap pakai per golongan × jenis, permintaan komponen dari BDRS
// internal / RS lain, distribusi atas permintaan (status komponen divalidasi ulang backend di dalam transaksi), serta
// pemusnahan kantong reaktif / komponen kedaluwarsa. Distribusi ke BDRS internal tercatat "menunggu integrasi" sampai
// integrasi modul Bank Darah tersedia (backend tidak pernah mengklaim terkirim secara palsu).
const storeUtils = utilsStore();
const bolehPermintaan = (aksi: string) => izinUtd("Distribusi", aksi, "Permintaan");
const bolehDistribusi = (aksi: string) => izinUtd("Distribusi", aksi, "Distribusi");
const bolehPemusnahan = (aksi: string) => izinUtd("Distribusi", aksi, "Pemusnahan");
const bolehReaktif = bolehLihatReaktifUtd();

const tab = ref("stok");

// ── Stok siap pakai (diringkas di peramban; backend belum menyediakan endpoint agregat)
const stok = ref<any[]>([]);
const muatStok = async () => {
  stok.value = (await daftarKomponenUtd({ tersedia_saja: 1, limit: 9999 }))?.payload?.data ?? [];
};
const matriksStok = computed(() => {
  const peta: Record<string, { jumlah: number; terdekat: string | null }> = {};
  for (const k of stok.value) {
    const kunci = `${k.jenisKomponen}|${k.golonganDarah ?? "-"}|${k.rhesus ?? "-"}`;
    const sel = (peta[kunci] ??= { jumlah: 0, terdekat: null });
    sel.jumlah++;
    if (!sel.terdekat || String(k.tanggalKedaluwarsa) < sel.terdekat) sel.terdekat = k.tanggalKedaluwarsa;
  }
  return peta;
});
const KOLOM_GOL = Object.keys(GOLONGAN_DARAH_UTD).flatMap((g) => [`${g}|positif`, `${g}|negatif`]);
const sel = (jenis: string, kolom: string) => matriksStok.value[`${jenis}|${kolom}`];

// ── Permintaan
const permintaan = ref<any[]>([]);
const totalPermintaan = ref(0);
const pagePermintaan = ref(1);
const limitPermintaan = ref(20);
const filterStatusPermintaan = ref<string[]>([]);
const filterPenerima = ref("");
const togglePermintaan = (nilai: string) => {
  filterStatusPermintaan.value = filterStatusPermintaan.value.includes(nilai)
    ? filterStatusPermintaan.value.filter((x) => x !== nilai)
    : [...filterStatusPermintaan.value, nilai];
};
const muatPermintaan = async () => {
  const res = await daftarPermintaanUtd({
    page: pagePermintaan.value,
    limit: limitPermintaan.value,
    status: filterStatusPermintaan.value,
    penerima_tipe: filterPenerima.value,
  });
  permintaan.value = res?.payload?.data ?? [];
  totalPermintaan.value = res?.payload?.pagination?.total ?? 0;
};

// ── Distribusi
const distribusi = ref<any[]>([]);
const totalDistribusi = ref(0);
const pageDistribusi = ref(1);
const limitDistribusi = ref(20);
const filterStatusDistribusi = ref<string[]>([]);
const toggleDistribusi = (nilai: string) => {
  filterStatusDistribusi.value = filterStatusDistribusi.value.includes(nilai)
    ? filterStatusDistribusi.value.filter((x) => x !== nilai)
    : [...filterStatusDistribusi.value, nilai];
};
const muatDistribusi = async () => {
  const res = await daftarDistribusiUtd({ page: pageDistribusi.value, limit: limitDistribusi.value, status: filterStatusDistribusi.value });
  distribusi.value = res?.payload?.data ?? [];
  totalDistribusi.value = res?.payload?.pagination?.total ?? 0;
};

// ── Pemusnahan
const pemusnahan = ref<any[]>([]);
const totalPemusnahan = ref(0);
const pagePemusnahan = ref(1);
const limitPemusnahan = ref(20);
const tindakLanjut = ref<{ kantongReaktif: any[]; komponenKedaluwarsa: any[] }>({ kantongReaktif: [], komponenKedaluwarsa: [] });
// Kantong reaktif hanya ditampilkan kepada pemilik izin Lihat Hasil Reaktif atau petugas pemusnahan.
const tampilKantongReaktif = computed(() => bolehReaktif || bolehPemusnahan("CREATE"));
const muatPemusnahan = async () => {
  const [p, t] = await Promise.all([daftarPemusnahanUtd({ page: pagePemusnahan.value, limit: limitPemusnahan.value }), tindakLanjutPemusnahanUtd()]);
  pemusnahan.value = p?.payload?.data ?? [];
  totalPemusnahan.value = p?.payload?.pagination?.total ?? 0;
  tindakLanjut.value = { kantongReaktif: t?.payload?.kantongReaktif ?? [], komponenKedaluwarsa: t?.payload?.komponenKedaluwarsa ?? [] };
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    if (tab.value === "stok") await muatStok();
    else if (tab.value === "permintaan") await muatPermintaan();
    else if (tab.value === "distribusi") await muatDistribusi();
    else await muatPemusnahan();
  } finally {
    storeUtils.setLoading(false);
  }
};
watch(tab, muat);
onMounted(muat);

const gantiHalaman = (jenis: "permintaan" | "distribusi" | "pemusnahan", e: { page: number; rows: number }) => {
  if (jenis === "permintaan") {
    pagePermintaan.value = e.page + 1;
    limitPermintaan.value = e.rows;
  } else if (jenis === "distribusi") {
    pageDistribusi.value = e.page + 1;
    limitDistribusi.value = e.rows;
  } else {
    pagePemusnahan.value = e.page + 1;
    limitPemusnahan.value = e.rows;
  }
  muat();
};
const cariUlang = () => {
  pagePermintaan.value = 1;
  pageDistribusi.value = 1;
  muat();
};

// ── Form permintaan baru
const dialogPermintaan = ref(false);
const kosongPermintaan = () => ({ penerimaTipe: "bdrs_internal", namaPenerima: "", golonganDarah: "", jenisKomponen: "", jumlahDiminta: 1, keteranganKlinis: "" });
const formPermintaan = ref(kosongPermintaan());
const galatPermintaan = ref("");
const bukaPermintaan = () => {
  formPermintaan.value = kosongPermintaan();
  galatPermintaan.value = "";
  dialogPermintaan.value = true;
};
const simpanPermintaan = async () => {
  const f = formPermintaan.value;
  galatPermintaan.value = "";
  if (!f.namaPenerima.trim()) return (galatPermintaan.value = "Nama penerima wajib diisi");
  if (!f.golonganDarah || !f.jenisKomponen) return (galatPermintaan.value = "Golongan darah dan jenis komponen wajib dipilih");
  if (!f.jumlahDiminta || f.jumlahDiminta < 1) return (galatPermintaan.value = "Jumlah diminta minimal 1");
  storeUtils.setLoading(true);
  try {
    const res = await buatPermintaanUtd({ ...f, namaPenerima: f.namaPenerima.trim(), keteranganKlinis: f.keteranganKlinis.trim() || undefined });
    if (res?.payload) {
      dialogPermintaan.value = false;
      muatPermintaan();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Detail permintaan + distribusikan
const detail = ref<any>(null);
const dialogDetail = ref(false);
const bukaDetail = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailPermintaanUtd(uuid);
    if (res?.payload) {
      detail.value = res.payload;
      dialogDetail.value = true;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const sisaPermintaan = computed(() => (detail.value ? Number(detail.value.jumlahDiminta) - (detail.value.distribusi?.length ?? 0) : 0));
const bisaDistribusi = computed(() => bolehDistribusi("CREATE") && ["menunggu", "sebagian"].includes(detail.value?.status) && sisaPermintaan.value > 0);

const dialogKirim = ref(false);
const kandidat = ref<any[]>([]);
const dipilih = ref<string[]>([]);
const waktuSerah = ref<Date | null>(new Date());
const galatKirim = ref("");
// Komponen siap pakai yang cocok golongan & jenis permintaan (rhesus tidak divalidasi backend; ditampilkan untuk dipilih petugas).
const bukaKirim = async () => {
  galatKirim.value = "";
  dipilih.value = [];
  waktuSerah.value = new Date();
  storeUtils.setLoading(true);
  try {
    const res = await daftarKomponenUtd({
      tersedia_saja: 1,
      golongan_darah: detail.value.golonganDarah,
      jenis_komponen: detail.value.jenisKomponen,
      limit: 200,
    });
    kandidat.value = res?.payload?.data ?? [];
    dialogKirim.value = true;
  } finally {
    storeUtils.setLoading(false);
  }
};
const togglePilih = (uuid: string) => {
  if (dipilih.value.includes(uuid)) dipilih.value = dipilih.value.filter((x) => x !== uuid);
  else if (dipilih.value.length < sisaPermintaan.value) dipilih.value = [...dipilih.value, uuid];
};
const simpanKirim = async () => {
  galatKirim.value = "";
  if (!dipilih.value.length) return (galatKirim.value = "Pilih minimal satu komponen");
  storeUtils.setLoading(true);
  try {
    const res = await distribusikanUtd({ permintaanUuid: detail.value.uuid, komponenUuid: dipilih.value, waktuSerahTerima: keEpoch(waktuSerah.value) });
    if (res?.payload) {
      dialogKirim.value = false;
      await bukaDetail(detail.value.uuid);
      muatPermintaan();
    } else {
      // Status komponen bisa berubah oleh petugas lain: muat ulang kandidat.
      bukaKirim();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const kirimUlang = async (d: any) => {
  storeUtils.setLoading(true);
  try {
    await kirimUlangBdrsUtd(d.uuid);
    muatDistribusi();
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Pemusnahan
const dialogMusnah = ref(false);
const target = ref<{ kantongUuid?: string; komponenUuid?: string; label: string } | null>(null);
const formMusnah = ref({ alasan: "", catatan: "" });
const galatMusnah = ref("");
const kataKomponen = ref("");
const hasilKomponen = ref<any[]>([]);
const bukaMusnah = (t: { kantongUuid?: string; komponenUuid?: string; label: string } | null, alasan = "") => {
  target.value = t;
  formMusnah.value = { alasan, catatan: "" };
  galatMusnah.value = "";
  kataKomponen.value = "";
  hasilKomponen.value = [];
  dialogMusnah.value = true;
};
const cariKomponen = async () => {
  if (!kataKomponen.value.trim()) return;
  const res = await daftarKomponenUtd({ cari: kataKomponen.value.trim(), status: ["karantina", "tersedia", "kedaluwarsa"], limit: 20 });
  hasilKomponen.value = res?.payload?.data ?? [];
};
const simpanMusnah = async () => {
  galatMusnah.value = "";
  if (!target.value) return (galatMusnah.value = "Pilih kantong/komponen yang dimusnahkan");
  if (!formMusnah.value.alasan) return (galatMusnah.value = "Alasan wajib dipilih");
  if (formMusnah.value.alasan === "lain" && !formMusnah.value.catatan.trim()) return (galatMusnah.value = "Catatan wajib diisi untuk alasan lainnya");
  storeUtils.setLoading(true);
  try {
    const res = await musnahkanUtd({
      kantongUuid: target.value.kantongUuid,
      komponenUuid: target.value.komponenUuid,
      alasan: formMusnah.value.alasan,
      catatan: formMusnah.value.catatan.trim() || undefined,
    });
    if (res?.payload) {
      dialogMusnah.value = false;
      muatPemusnahan();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
// Tanpa izin Lihat Hasil Reaktif, alasan "reaktif" tidak ditawarkan untuk pemusnahan manual.
const opsiAlasan = computed(() => opsi(ALASAN_MUSNAH_UTD).filter((o) => bolehReaktif || o.value !== "reaktif" || formMusnah.value.alasan === "reaktif"));
const pendek = (uuid?: string | null) => (uuid ? `…${String(uuid).slice(-8)}` : "-");
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Penyimpanan & Distribusi</h1>
          <template v-if="tab === 'permintaan'">
            <ToolbarFilterMenu :count="filterStatusPermintaan.length + (filterPenerima ? 1 : 0)">
              <template #label>Status</template>
              <CustomChip
                v-for="(s, kode) in STATUS_PERMINTAAN_UTD"
                :key="kode"
                :label="s.label"
                :value="String(kode)"
                :isSelected="filterStatusPermintaan.includes(String(kode))"
                @selected="togglePermintaan($event)"
              />
              <CustomChip
                v-for="(label, kode) in PENERIMA_TIPE_UTD"
                :key="kode"
                :label="label"
                :value="String(kode)"
                :isSelected="filterPenerima === String(kode)"
                @selected="filterPenerima = filterPenerima === $event ? '' : $event"
              />
            </ToolbarFilterMenu>
            <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="cariUlang" />
            <CustomButton v-if="bolehPermintaan('CREATE')" icon="PhPlus" label="Permintaan" @click="bukaPermintaan" />
          </template>
          <template v-else-if="tab === 'distribusi'">
            <ToolbarFilterMenu :count="filterStatusDistribusi.length">
              <template #label>Status</template>
              <CustomChip
                v-for="(s, kode) in STATUS_DISTRIBUSI_UTD"
                :key="kode"
                :label="s.label"
                :value="String(kode)"
                :isSelected="filterStatusDistribusi.includes(String(kode))"
                @selected="toggleDistribusi($event)"
              />
            </ToolbarFilterMenu>
            <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="cariUlang" />
          </template>
          <template v-else-if="tab === 'pemusnahan'">
            <CustomButton v-if="bolehPemusnahan('CREATE')" icon="PhPlus" label="Musnahkan Komponen" backgroundColor="bg-danger-300" @click="bukaMusnah(null)" />
          </template>
        </PageToolbar>
      </template>
      <template #content>
        <Tabs :value="tab" class="flex flex-col h-full" @update:value="(v: any) => (tab = v)">
          <TabList>
            <Tab value="stok">Stok Siap Pakai</Tab>
            <Tab v-if="bolehPermintaan('READ')" value="permintaan">Permintaan</Tab>
            <Tab v-if="bolehDistribusi('READ')" value="distribusi">Distribusi</Tab>
            <Tab v-if="bolehPemusnahan('READ')" value="pemusnahan">Pemusnahan</Tab>
          </TabList>
          <TabPanels class="overflow-auto grow">
            <TabPanel value="stok">
              <div class="mb-2 text-xs text-grey-400">
                Jumlah komponen berstatus tersedia & belum kedaluwarsa ({{ stok.length }} kantong). Angka kecil = tanggal kedaluwarsa terdekat.
              </div>
              <div class="overflow-auto">
                <table class="w-full text-xs border-collapse min-w-[760px]">
                  <thead>
                    <tr>
                      <th class="p-2 text-left border bg-opensimrs-50 border-grey-75">Komponen</th>
                      <th v-for="k in KOLOM_GOL" :key="k" class="p-2 text-center border bg-opensimrs-50 border-grey-75">
                        {{ golonganRhUtd(k.split("|")[0], k.split("|")[1]) }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(nama, jenis) in JENIS_KOMPONEN_UTD" :key="jenis">
                      <td class="p-2 font-semibold border border-grey-75">{{ nama }}</td>
                      <td
                        v-for="k in KOLOM_GOL"
                        :key="k"
                        class="p-2 text-center border border-grey-75"
                        :class="sel(String(jenis), k) && (sisaHariUtd(sel(String(jenis), k)?.terdekat) ?? 99) <= 3 ? 'bg-[#FFFAEB]' : ''"
                      >
                        <template v-if="sel(String(jenis), k)">
                          <div class="text-sm font-semibold">{{ sel(String(jenis), k)?.jumlah }}</div>
                          <div class="text-[10px] text-grey-400">{{ tglUtd(sel(String(jenis), k)?.terdekat) }}</div>
                        </template>
                        <span v-else class="text-grey-300">0</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabPanel>

            <TabPanel v-if="bolehPermintaan('READ')" value="permintaan">
              <NoData v-if="!permintaan.length" />
              <DataTable v-else :value="permintaan" stripedRows class="text-xs cursor-pointer" tableStyle="min-width: 56rem" @rowClick="bukaDetail($event.data.uuid)">
                <Column header="Waktu" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }">{{ waktuUtd(p.createdAt) }}</template>
                </Column>
                <Column header="Penerima" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }">
                    <div class="font-semibold">{{ p.namaPenerima }}</div>
                    <div class="text-grey-400">{{ PENERIMA_TIPE_UTD[p.penerimaTipe] ?? p.penerimaTipe }}</div>
                  </template>
                </Column>
                <Column header="Komponen" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }">{{ JENIS_KOMPONEN_UTD[p.jenisKomponen] ?? p.jenisKomponen }} · Gol. {{ p.golonganDarah }}</template>
                </Column>
                <Column field="jumlahDiminta" header="Jumlah" headerClass="bg-opensimrs-50" />
                <Column header="Keterangan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }">{{ p.keteranganKlinis ?? "-" }}</template>
                </Column>
                <Column header="Status" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaPermintaanUtd(p.status)?.bg, gayaPermintaanUtd(p.status)?.text]">
                      {{ gayaPermintaanUtd(p.status)?.label ?? p.status }}
                    </span>
                  </template>
                </Column>
              </DataTable>
              <div class="flex justify-end py-2.5">
                <CustomPaginator :rows="limitPermintaan" :totalRecords="totalPermintaan" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman('permintaan', $event)" />
              </div>
            </TabPanel>

            <TabPanel v-if="bolehDistribusi('READ')" value="distribusi">
              <NoData v-if="!distribusi.length" />
              <DataTable v-else :value="distribusi" stripedRows class="text-xs" tableStyle="min-width: 56rem">
                <Column header="Serah Terima" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ waktuUtd(d.waktuSerahTerima || d.createdAt) }}</template>
                </Column>
                <Column header="Komponen" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <div class="font-semibold">{{ d.labelUnik }}</div>
                    <div class="text-grey-400">{{ d.jenisKomponen }} · Gol. {{ d.golonganDarah }}</div>
                  </template>
                </Column>
                <Column header="Penerima" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <div>{{ d.namaPenerima }}</div>
                    <div class="text-grey-400">{{ PENERIMA_TIPE_UTD[d.penerimaTipe] ?? d.penerimaTipe }}</div>
                  </template>
                </Column>
                <Column header="Status" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaDistribusiUtd(d.status)?.bg, gayaDistribusiUtd(d.status)?.text]">
                      {{ gayaDistribusiUtd(d.status)?.label ?? d.status }}
                    </span>
                    <div v-if="d.catatanIntegrasi" class="text-grey-400">{{ d.catatanIntegrasi }}</div>
                  </template>
                </Column>
                <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[150px]">
                  <template #body="{ data: d }">
                    <CustomButton
                      v-if="bolehDistribusi('CREATE') && d.penerimaTipe === 'bdrs_internal' && d.status !== 'terkirim'"
                      label="Kirim Ulang"
                      size="small"
                      outlined
                      borderColor="border-opensimrs-300"
                      textColor="text-opensimrs-300"
                      @click="kirimUlang(d)"
                    />
                  </template>
                </Column>
              </DataTable>
              <div class="flex justify-end py-2.5">
                <CustomPaginator :rows="limitDistribusi" :totalRecords="totalDistribusi" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman('distribusi', $event)" />
              </div>
            </TabPanel>

            <TabPanel v-if="bolehPemusnahan('READ')" value="pemusnahan">
              <div class="grid grid-cols-1 gap-4 mb-4 xl:grid-cols-2">
                <div v-if="tampilKantongReaktif" class="p-3 border rounded-lg border-grey-75">
                  <h3 class="mb-2 text-sm font-semibold">Kantong Ditahan (Reaktif) Belum Dimusnahkan</h3>
                  <NoData v-if="!tindakLanjut.kantongReaktif.length" />
                  <div v-for="k in tindakLanjut.kantongReaktif" :key="k.kantongUuid" class="flex items-center justify-between py-1 text-xs border-b border-grey-75">
                    <span><b>{{ k.noKantong }}</b>{{ bolehReaktif ? ` · donor ${k.noDonor}` : "" }}</span>
                    <CustomButton
                      v-if="bolehPemusnahan('CREATE')"
                      label="Musnahkan"
                      size="small"
                      outlined
                      borderColor="border-danger-300"
                      textColor="text-danger-300"
                      @click="bukaMusnah({ kantongUuid: k.kantongUuid, label: `Kantong ${k.noKantong}` }, 'reaktif')"
                    />
                  </div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <h3 class="mb-2 text-sm font-semibold">Komponen Kedaluwarsa Belum Dimusnahkan</h3>
                  <NoData v-if="!tindakLanjut.komponenKedaluwarsa.length" />
                  <div v-for="k in tindakLanjut.komponenKedaluwarsa" :key="k.komponenUuid" class="flex items-center justify-between py-1 text-xs border-b border-grey-75">
                    <span><b>{{ k.labelUnik }}</b> · {{ k.jenisKomponen }} · kedaluwarsa {{ tglUtd(k.tanggalKedaluwarsa) }}</span>
                    <CustomButton
                      v-if="bolehPemusnahan('CREATE')"
                      label="Musnahkan"
                      size="small"
                      outlined
                      borderColor="border-danger-300"
                      textColor="text-danger-300"
                      @click="bukaMusnah({ komponenUuid: k.komponenUuid, label: k.labelUnik }, 'kedaluwarsa')"
                    />
                  </div>
                </div>
              </div>
              <h3 class="mb-2 text-sm font-semibold">Riwayat Pemusnahan</h3>
              <NoData v-if="!pemusnahan.length" />
              <DataTable v-else :value="pemusnahan" stripedRows class="text-xs">
                <Column header="Waktu" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }">{{ waktuUtd(p.waktuMusnah || p.createdAt) }}</template>
                </Column>
                <Column header="Target" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }">
                    <div v-if="p.kantongUuid">Kantong {{ pendek(p.kantongUuid) }}</div>
                    <div v-if="p.komponenUuid">Komponen {{ pendek(p.komponenUuid) }}</div>
                  </template>
                </Column>
                <Column header="Alasan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }">{{ p.alasan === "reaktif" && !bolehReaktif ? "Ditahan" : ALASAN_MUSNAH_UTD[p.alasan] ?? p.alasan }}</template>
                </Column>
                <Column header="Catatan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }">{{ p.catatan ?? "-" }}</template>
                </Column>
                <Column header="Petugas" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }">{{ p.dibuatOleh ?? p.petugasUuid ?? "-" }}</template>
                </Column>
              </DataTable>
              <div class="flex justify-end py-2.5">
                <CustomPaginator :rows="limitPemusnahan" :totalRecords="totalPemusnahan" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman('pemusnahan', $event)" />
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>

    <!-- Permintaan baru -->
    <CustomDialog v-model:visible="dialogPermintaan" width="720px">
      <template #header>Permintaan Komponen Darah</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="formPermintaan.penerimaTipe" label="Jenis Penerima" :options="opsi(PENERIMA_TIPE_UTD)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomTextfield v-model="formPermintaan.namaPenerima" label="Nama Penerima" placeholder="mis. BDRS RS Contoh" required :maxLength="200" />
          <CustomSelect v-model="formPermintaan.jenisKomponen" label="Jenis Komponen" placeHolder="Pilih" :options="opsi(JENIS_KOMPONEN_UTD)" optionValue="value" optionLabel="label" :showFilter="false" required />
          <CustomSelect v-model="formPermintaan.golonganDarah" label="Golongan Darah" placeHolder="Pilih" :options="opsi(GOLONGAN_DARAH_UTD)" optionValue="value" optionLabel="label" :showFilter="false" required />
          <CustomInputNumber v-model="formPermintaan.jumlahDiminta" label="Jumlah Kantong" :min="1" :max="100" required />
          <div></div>
          <CustomTextArea v-model="formPermintaan.keteranganKlinis" label="Keterangan Klinis" placeholder="mis. stok rutin mingguan / kebutuhan operasi" class="col-span-2" />
        </div>
        <div class="mt-2 text-xs text-grey-400">Permintaan hanya mencatat golongan ABO; rhesus komponen dipilih petugas saat distribusi.</div>
        <div v-if="galatPermintaan" class="mt-3 text-sm text-danger-300">{{ galatPermintaan }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogPermintaan = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanPermintaan" />
        </div>
      </template>
    </CustomDialog>

    <!-- Detail permintaan -->
    <CustomDialog v-model:visible="dialogDetail" width="820px">
      <template #header>Permintaan — {{ detail?.namaPenerima }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Penerima:</span> <b>{{ detail.namaPenerima }}</b> ({{ PENERIMA_TIPE_UTD[detail.penerimaTipe] }})</div>
            <div>
              <span class="text-grey-400">Status:</span>
              <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaPermintaanUtd(detail.status)?.bg, gayaPermintaanUtd(detail.status)?.text]">
                {{ gayaPermintaanUtd(detail.status)?.label ?? detail.status }}
              </span>
            </div>
            <div><span class="text-grey-400">Komponen:</span> {{ JENIS_KOMPONEN_UTD[detail.jenisKomponen] }} · Gol. {{ detail.golonganDarah }}</div>
            <div><span class="text-grey-400">Jumlah:</span> {{ detail.distribusi?.length ?? 0 }} dari {{ detail.jumlahDiminta }} kantong</div>
            <div><span class="text-grey-400">Diajukan:</span> {{ waktuUtd(detail.createdAt) }} · {{ detail.dibuatOleh ?? "-" }}</div>
            <div class="col-span-2"><span class="text-grey-400">Keterangan:</span> {{ detail.keteranganKlinis ?? "-" }}</div>
          </div>
          <div>
            <h3 class="mb-1 font-semibold">Komponen Didistribusikan</h3>
            <NoData v-if="!detail.distribusi?.length" />
            <DataTable v-else :value="detail.distribusi" stripedRows class="text-xs">
              <Column field="labelUnik" header="Label" headerClass="bg-opensimrs-50" />
              <Column header="Komponen" headerClass="bg-opensimrs-50">
                <template #body="{ data: d }">{{ d.jenisKomponen }} · Gol. {{ d.golonganDarah }}</template>
              </Column>
              <Column header="Serah Terima" headerClass="bg-opensimrs-50">
                <template #body="{ data: d }">{{ waktuUtd(d.waktuSerahTerima) }}</template>
              </Column>
              <Column header="Status" headerClass="bg-opensimrs-50">
                <template #body="{ data: d }">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaDistribusiUtd(d.status)?.bg, gayaDistribusiUtd(d.status)?.text]">
                    {{ gayaDistribusiUtd(d.status)?.label ?? d.status }}
                  </span>
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogDetail = false" />
          <CustomButton v-if="bisaDistribusi" :label="`Distribusikan (sisa ${sisaPermintaan})`" icon="PhTruck" @click="bukaKirim" />
        </div>
      </template>
    </CustomDialog>

    <!-- Pilih komponen untuk distribusi -->
    <CustomDialog v-model:visible="dialogKirim" width="820px">
      <template #header>Distribusi ke {{ detail?.namaPenerima }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="text-sm text-grey-400">
            {{ JENIS_KOMPONEN_UTD[detail?.jenisKomponen] }} · Gol. {{ detail?.golonganDarah }} · pilih maksimal {{ sisaPermintaan }} kantong (urut kedaluwarsa terdekat).
          </div>
          <NoData v-if="!kandidat.length" />
          <DataTable v-else :value="kandidat" stripedRows class="text-xs cursor-pointer" @rowClick="togglePilih($event.data.uuid)">
            <Column header="" headerClass="bg-opensimrs-50" class="w-[40px]">
              <template #body="{ data: k }">
                <Checkbox :modelValue="dipilih.includes(k.uuid)" binary :disabled="!dipilih.includes(k.uuid) && dipilih.length >= sisaPermintaan" @update:modelValue="togglePilih(k.uuid)" />
              </template>
            </Column>
            <Column field="labelUnik" header="Label" headerClass="bg-opensimrs-50" />
            <Column header="Gol." headerClass="bg-opensimrs-50">
              <template #body="{ data: k }"><b>{{ golonganRhUtd(k.golonganDarah, k.rhesus) }}</b></template>
            </Column>
            <Column header="Volume" headerClass="bg-opensimrs-50">
              <template #body="{ data: k }">{{ k.volumeMl }} mL</template>
            </Column>
            <Column header="Kedaluwarsa" headerClass="bg-opensimrs-50">
              <template #body="{ data: k }">{{ tglUtd(k.tanggalKedaluwarsa) }} ({{ sisaHariUtd(k.tanggalKedaluwarsa) }} hari)</template>
            </Column>
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data: k }">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaKomponenUtd(k.status)?.bg, gayaKomponenUtd(k.status)?.text]">
                  {{ gayaKomponenUtd(k.status)?.label }}
                </span>
              </template>
            </Column>
          </DataTable>
          <CustomDatePicker v-model="waktuSerah" label="Waktu Serah Terima" showTime :maxDate="new Date()" class="max-w-[260px]" />
          <div v-if="galatKirim" class="text-sm text-danger-300">{{ galatKirim }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogKirim = false" />
          <CustomButton :label="`Distribusikan ${dipilih.length} Kantong`" icon="PhTruck" @click="simpanKirim" />
        </div>
      </template>
    </CustomDialog>

    <!-- Pemusnahan -->
    <CustomDialog v-model:visible="dialogMusnah" width="560px" headerBg="bg-danger-300">
      <template #header>Pemusnahan {{ target?.label ?? "Komponen" }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div v-if="!target" class="flex flex-col gap-2">
            <div class="flex gap-2">
              <InputText v-model="kataKomponen" placeholder="Cari label komponen / no. kantong" class="text-sm grow" @keydown.enter="cariKomponen" />
              <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariKomponen" />
            </div>
            <div v-if="hasilKomponen.length" class="overflow-auto border rounded-lg max-h-[180px] border-grey-75">
              <div
                v-for="k in hasilKomponen"
                :key="k.uuid"
                class="flex justify-between px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50"
                @click="target = { komponenUuid: k.uuid, label: k.labelUnik }"
              >
                <span><b>{{ k.labelUnik }}</b> · {{ golonganRhUtd(k.golonganDarah, k.rhesus) }}</span>
                <span class="text-grey-400">{{ gayaKomponenUtd(k.status)?.label }} · {{ tglUtd(k.tanggalKedaluwarsa) }}</span>
              </div>
            </div>
          </div>
          <CustomSelect v-model="formMusnah.alasan" label="Alasan" placeHolder="Pilih alasan" :options="opsiAlasan" optionValue="value" optionLabel="label" :showFilter="false" required />
          <CustomTextArea v-model="formMusnah.catatan" label="Catatan" placeholder="mis. kantong bocor / hemolisis" :required="formMusnah.alasan === 'lain'" />
          <div class="text-xs text-grey-400">Barang yang sudah didistribusikan tidak dapat dimusnahkan. Memusnahkan kantong ikut memusnahkan seluruh komponen turunannya.</div>
          <div v-if="galatMusnah" class="text-sm text-danger-300">{{ galatMusnah }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Kembali" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogMusnah = false" />
          <CustomButton label="Musnahkan" backgroundColor="bg-danger-300" @click="simpanMusnah" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
