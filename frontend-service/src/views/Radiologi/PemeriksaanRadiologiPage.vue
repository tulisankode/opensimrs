<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  MODALITAS_RAD,
  PELAYANAN_RAD,
  STATUS_ITEM_RAD,
  STATUS_JADWAL_RAD,
  SUMBER_RAD,
  daftarRuangRad,
  detailItemRad,
  noAntreanRad,
  pilihanPetugasRad,
  templateUntukRad,
  keTanggal,
  periksaItemRad,
  simpanHasilRad,
  umurRad,
  waktuRad,
  worklistRad,
  type LampiranRad,
} from "@/stores/penunjang/radiologi";
import { createHasilRadPdf } from "@/utils/pdf/pdfRadiologi/cetakRadiologi";
import { gambarKePng, gambarPdfValid } from "@/utils/pdf/bukaPdf";

// Worklist pemeriksaan radiologi (per item): radiografer mencatat pemeriksaan di ruang/alat, dokter radiologi mengisi
// expertise (template bacaan normal + hasil/uraian + kesan + lampiran gambar opsional), lalu hasil dicetak.
// Filter ruang & jadwal (hari ini / belum dijadwalkan / terjadwal / hadir). Item tanpa jadwal (mis. order MCU) tetap
// dapat dikerjakan. Order MCU tampil tanpa tagihan.
const storeUtils = utilsStore();
const route = useRoute();

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const tglMulai = ref<Date | null>(null);
const tglSelesai = ref<Date | null>(null);
const filterStatus = ref<string[]>(["menunggu", "diperiksa"]);
const filterModalitas = ref<string[]>([]);
const filterSumber = ref<string[]>([]);
const hanyaCito = ref(false);
const filterRuang = ref<string[]>(route.query.ruang ? [String(route.query.ruang)] : []);
const filterKedatangan = ref<string[]>([]);
const jadwalHariIni = ref(route.query.jadwal === "hari_ini");
const ruang = ref<any[]>([]);
const KEDATANGAN: Record<string, string> = { belum_dijadwalkan: "Belum dijadwalkan", terjadwal: "Terjadwal (belum hadir)", hadir: "Sudah hadir" };

const FILTER = { status: filterStatus, modalitas: filterModalitas, sumber: filterSumber, ruang: filterRuang, kedatangan: filterKedatangan };
const toggle = (jenis: keyof typeof FILTER, nilai: string) => {
  const daftar = FILTER[jenis];
  daftar.value = daftar.value.includes(nilai) ? daftar.value.filter((x) => x !== nilai) : [...daftar.value, nilai];
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await worklistRad({
      page: page.value,
      limit: limit.value,
      cari: cari.value,
      status: filterStatus.value,
      modalitas: filterModalitas.value,
      sumber: filterSumber.value,
      cito: hanyaCito.value ? 1 : "",
      ruang_uuid: filterRuang.value,
      kedatangan: filterKedatangan.value,
      tanggal_jadwal: jadwalHariIni.value ? "hari_ini" : "",
      tanggal_mulai: keTanggal(tglMulai.value),
      tanggal_selesai: keTanggal(tglSelesai.value ?? tglMulai.value),
    });
    data.value = res?.payload?.data ?? [];
    total.value = res?.payload?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};
const cariData = () => {
  page.value = 1;
  muat();
};
const reset = () => {
  cari.value = "";
  tglMulai.value = null;
  tglSelesai.value = null;
  filterStatus.value = ["menunggu", "diperiksa"];
  filterModalitas.value = [];
  filterSumber.value = [];
  hanyaCito.value = false;
  filterRuang.value = [];
  filterKedatangan.value = [];
  jadwalHariIni.value = false;
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

// ── Periksa (radiografer)
const dialogPeriksa = ref(false);
const itemAktif = ref<any>(null);
const radiografer = ref("");
const radiograferUuid = ref("");
const ruangPeriksa = ref("");
const daftarRadiografer = ref<any[]>([]);
const waktuPeriksa = ref<Date | null>(new Date());
const opsiRuangPeriksa = computed(() =>
  ruang.value.filter((r) => r.status && (!itemAktif.value?.modalitas || r.modalitas.includes(itemAktif.value.modalitas))).map((r) => ({ value: r.uuid, label: `${r.nama} · ${r.namaAlat || r.modalitas.join("/")}` }))
);
const bukaPeriksa = async (baris: any) => {
  itemAktif.value = baris;
  radiografer.value = baris.radiografer ?? "";
  radiograferUuid.value = baris.radiograferUuid ?? "";
  waktuPeriksa.value = new Date();
  if (!daftarRadiografer.value.length) daftarRadiografer.value = (await pilihanPetugasRad("radiografer"))?.payload ?? [];
  ruangPeriksa.value = baris.ruangUuid ?? baris.jadwalRuangUuid ?? (opsiRuangPeriksa.value.length === 1 ? opsiRuangPeriksa.value[0].value : "");
  dialogPeriksa.value = true;
};
const simpanPeriksa = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await periksaItemRad(itemAktif.value.uuid, {
      radiografer: radiograferUuid.value ? undefined : radiografer.value.trim() || undefined,
      radiograferUuid: radiograferUuid.value || undefined,
      ruangUuid: ruangPeriksa.value || undefined,
      waktuPeriksa: waktuPeriksa.value ? Math.floor(waktuPeriksa.value.getTime() / 1000) : undefined,
    });
    if (res) {
      dialogPeriksa.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Expertise (dokter Sp.Rad)
const dialogHasil = ref(false);
const detail = ref<any>(null);
const dokter = ref<any[]>([]);
const formHasil = ref({ hasil: "", kesan: "", dokterRadiologiUuid: "", lampiran: [] as LampiranRad[] });
const template = ref<any[]>([]);
const templateDipilih = ref("");
const terapkanTemplate = (uuid: string) => {
  templateDipilih.value = uuid;
  const t = template.value.find((x) => x.uuid === uuid);
  if (!t) return;
  formHasil.value.hasil = t.hasil;
  formHasil.value.kesan = t.kesan;
};
const galatHasil = ref("");
const MAKS_BERKAS = 1024 * 1024;

const bukaHasil = async (baris: any) => {
  storeUtils.setLoading(true);
  try {
    const [res, dok, tpl] = await Promise.all([
      detailItemRad(baris.uuid),
      dokter.value.length ? null : pilihanPetugasRad("dokter"),
      baris.pemeriksaanUuid ? templateUntukRad(baris.pemeriksaanUuid) : null,
    ]);
    if (dok?.payload) dokter.value = dok.payload;
    template.value = tpl?.payload ?? [];
    templateDipilih.value = "";
    if (!res?.payload) return;
    detail.value = res.payload;
    galatHasil.value = "";
    formHasil.value = {
      hasil: res.payload.hasil ?? "",
      kesan: res.payload.kesan ?? "",
      dokterRadiologiUuid: res.payload.dokterRadiologiUuid ?? "",
      lampiran: res.payload.lampiran ?? [],
    };
    dialogHasil.value = true;
  } finally {
    storeUtils.setLoading(false);
  }
};
const tambahLampiran = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const berkas = Array.from(input.files ?? []);
  input.value = "";
  for (const f of berkas) {
    if (formHasil.value.lampiran.length >= 5) return (galatHasil.value = "Maksimal 5 lampiran");
    if (!f.type.startsWith("image/")) {
      galatHasil.value = "Lampiran harus berupa gambar";
      continue;
    }
    // Isi berkas dicek, bukan hanya ekstensinya: BMP/WebP (atau BMP bernama .png) diubah ke PNG agar bisa dicetak.
    try {
      const asli = await new Promise<string>((ok, gagal) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result));
        r.onerror = () => gagal(r.error);
        r.readAsDataURL(f);
      });
      const data = gambarPdfValid(asli) ? asli : await gambarKePng(f);
      if (Math.floor(((data.length - data.indexOf(",") - 1) * 3) / 4) > MAKS_BERKAS) {
        galatHasil.value = `${f.name} melebihi 1 MB`;
        continue;
      }
      formHasil.value.lampiran.push({ nama: f.name, tipe: data.slice(5, data.indexOf(";")), data });
    } catch {
      galatHasil.value = `${f.name} bukan gambar yang dapat dibaca`;
    }
  }
};
const simpanHasil = async () => {
  galatHasil.value = "";
  const f = formHasil.value;
  if (!f.hasil.trim() || !f.kesan.trim()) return (galatHasil.value = "Hasil dan kesan wajib diisi");
  if (!f.dokterRadiologiUuid) return (galatHasil.value = "Dokter radiologi wajib dipilih");
  storeUtils.setLoading(true);
  try {
    const res = await simpanHasilRad(detail.value.uuid, { hasil: f.hasil, kesan: f.kesan, dokterRadiologiUuid: f.dokterRadiologiUuid, lampiran: f.lampiran });
    if (res) {
      dialogHasil.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const cetak = async (baris: any, semua = false) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailItemRad(baris.uuid);
    if (res?.payload?.order) createHasilRadPdf(res.payload.order, semua ? undefined : baris.uuid);
  } finally {
    storeUtils.setLoading(false);
  }
};

const JK: Record<string, string> = { Male: "L", Female: "P" };
const gayaStatus = (s: string) => STATUS_ITEM_RAD[s as keyof typeof STATUS_ITEM_RAD];
const gayaJadwal = (s: string) => STATUS_JADWAL_RAD[s as keyof typeof STATUS_JADWAL_RAD];

onMounted(async () => {
  muat();
  ruang.value = (await daftarRuangRad({ limit: 200 }))?.payload?.data ?? [];
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Pemeriksaan &amp; Hasil</h1>
          <CustomTextfield
            v-model="cari"
            label="Cari"
            prependIcon="PhMagnifyingGlass"
            placeholder="Nama / No. RM / No. Order / pemeriksaan"
            :maxLength="100"
            @keydown.enter="cariData"
          />
          <CustomDatePicker v-model="tglMulai" label="Tgl. order mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Tgl. order selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <ToolbarFilterMenu :count="filterStatus.length">
            <template #label>Status</template>
            <CustomChip
              v-for="(s, kode) in STATUS_ITEM_RAD"
              :key="kode"
              :label="s.label"
              :value="String(kode)"
              :isSelected="filterStatus.includes(String(kode))"
              @selected="toggle('status', $event)"
            />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterModalitas.length">
            <template #label>Modalitas</template>
            <CustomChip
              v-for="(nama, kode) in MODALITAS_RAD"
              :key="kode"
              :label="`${kode} — ${nama}`"
              :value="String(kode)"
              :isSelected="filterModalitas.includes(String(kode))"
              @selected="toggle('modalitas', $event)"
            />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterSumber.length + (hanyaCito ? 1 : 0)">
            <template #label>Sumber</template>
            <CustomChip
              v-for="(s, kode) in SUMBER_RAD"
              :key="kode"
              :label="s"
              :value="String(kode)"
              :isSelected="filterSumber.includes(String(kode))"
              @selected="toggle('sumber', $event)"
            />
            <CustomChip label="Hanya CITO" :isSelected="hanyaCito" @selected="hanyaCito = !hanyaCito" />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterRuang.length">
            <template #label>Ruang</template>
            <CustomChip
              v-for="r in ruang"
              :key="r.uuid"
              :label="`${r.kode} — ${r.nama}`"
              :value="r.uuid"
              :isSelected="filterRuang.includes(r.uuid)"
              @selected="toggle('ruang', $event)"
            />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterKedatangan.length + (jadwalHariIni ? 1 : 0)">
            <template #label>Jadwal</template>
            <CustomChip label="Jadwal hari ini" :isSelected="jadwalHariIni" @selected="jadwalHariIni = !jadwalHariIni" />
            <CustomChip
              v-for="(label, kode) in KEDATANGAN"
              :key="kode"
              :label="label"
              :value="String(kode)"
              :isSelected="filterKedatangan.includes(String(kode))"
              @selected="toggle('kedatangan', $event)"
            />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 64rem">
          <Column header="Order" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">
                <span v-if="d.cito" class="px-1.5 mr-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>{{ d.noOrder }}
              </div>
              <div class="text-grey-400">{{ waktuRad(d.waktuOrder) }}</div>
            </template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaPasien ?? "-" }}</div>
              <div class="text-grey-400">{{ d.noRm }} · {{ JK[d.gender] ?? "-" }} · {{ umurRad(d.birthDate) }}</div>
            </template>
          </Column>
          <Column header="Pemeriksaan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.nama }}</div>
              <div class="text-grey-400">{{ MODALITAS_RAD[d.modalitas] ?? d.modalitas }}</div>
            </template>
          </Column>
          <Column header="Asal / Klinis" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div>{{ SUMBER_RAD[d.sumber] }} · {{ PELAYANAN_RAD[d.pelayanan] ?? d.pelayanan }}<span v-if="d.tanpaTagihan" class="text-grey-400"> (tanpa tagihan)</span></div>
              <div class="max-w-[240px] truncate text-grey-400" :title="d.klinis">{{ d.klinis || "-" }}</div>
            </template>
          </Column>
          <Column header="Jadwal / Ruang" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <template v-if="d.jadwalStatus">
                <div>
                  <b>{{ d.jadwalJam }}</b> <span class="text-grey-400">{{ d.jadwalTanggal }}</span>
                  <span class="px-1.5 ml-1 rounded-full text-[10px] font-semibold" :class="[gayaJadwal(d.jadwalStatus)?.bg, gayaJadwal(d.jadwalStatus)?.text]">
                    {{ gayaJadwal(d.jadwalStatus)?.label }}
                  </span>
                </div>
                <div class="text-grey-400">{{ d.ruang ?? "-" }}<span v-if="d.noAntrean"> · antrean {{ noAntreanRad(d.ruangKode, d.noAntrean) }}</span></div>
              </template>
              <template v-else>
                <div class="text-grey-400">{{ d.status === "menunggu" ? "Belum dijadwalkan" : "-" }}</div>
                <div v-if="d.ruang" class="text-grey-400">{{ d.ruang }}</div>
              </template>
            </template>
          </Column>
          <Column header="Radiografer / Dokter" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div>{{ d.radiografer ?? "-" }} <span v-if="d.waktuPeriksa" class="text-grey-400">· {{ waktuRad(d.waktuPeriksa) }}</span></div>
              <div class="text-grey-400">{{ d.dokterRadiologi ?? "" }}</div>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" :class="[gayaStatus(d.status)?.bg, gayaStatus(d.status)?.text]">
                {{ gayaStatus(d.status)?.label ?? d.status }}
              </span>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[230px]">
            <template #body="{ data: d }">
              <div class="flex flex-wrap gap-2">
                <CustomButton v-if="d.status === 'menunggu'" label="Periksa" icon="PhScan" size="small" @click="bukaPeriksa(d)" />
                <CustomButton
                  v-if="d.status !== 'menunggu'"
                  :label="d.status === 'selesai' ? 'Ubah Hasil' : 'Input Hasil'"
                  icon="PhNotePencil"
                  size="small"
                  :outlined="d.status === 'selesai'"
                  :borderColor="d.status === 'selesai' ? 'border-opensimrs-300' : ''"
                  :textColor="d.status === 'selesai' ? 'text-opensimrs-300' : ''"
                  @click="bukaHasil(d)"
                />
                <CustomButton v-if="d.status === 'selesai'" label="Cetak" icon="PhPrinter" size="small" @click="cetak(d)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <!-- Periksa -->
    <CustomDialog v-model:visible="dialogPeriksa" width="480px">
      <template #header>Catat Pemeriksaan</template>
      <template #body>
        <div v-if="itemAktif" class="flex flex-col gap-4 pt-4">
          <div class="text-sm">
            <b>{{ itemAktif.nama }}</b> · {{ itemAktif.namaPasien }} ({{ itemAktif.noRm }})
            <div v-if="itemAktif.klinis" class="text-grey-400">Klinis: {{ itemAktif.klinis }}</div>
          </div>
          <div v-if="itemAktif.jadwalStatus" class="text-sm text-grey-500">
            Jadwal {{ itemAktif.jadwalTanggal }} {{ itemAktif.jadwalJam }} · {{ itemAktif.ruang }}
            <span v-if="itemAktif.jadwalStatus === 'terjadwal'">(pasien belum check-in; dicatat hadir otomatis)</span>
          </div>
          <CustomSelect
            v-model="ruangPeriksa"
            label="Ruang / Alat"
            placeHolder="Pilih ruang pemeriksaan"
            :options="opsiRuangPeriksa"
            optionValue="value"
            optionLabel="label"
            :showFilter="false"
          />
          <CustomSelect
            v-if="daftarRadiografer.length"
            v-model="radiograferUuid"
            label="Radiografer"
            placeHolder="Pilih radiografer (kosong = pengguna yang login)"
            :options="daftarRadiografer"
            optionValue="uuid"
            optionLabel="nama"
            :showFilter="false"
          />
          <CustomTextfield
            v-if="!radiograferUuid"
            v-model="radiografer"
            :label="daftarRadiografer.length ? 'Atau nama radiografer lain' : 'Radiografer'"
            placeholder="Kosongkan = pengguna yang login"
            :maxLength="150"
          />
          <CustomDatePicker v-model="waktuPeriksa" label="Waktu pemeriksaan" showTime :maxDate="new Date()" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogPeriksa = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanPeriksa" />
        </div>
      </template>
    </CustomDialog>

    <!-- Expertise -->
    <CustomDialog v-model:visible="dialogHasil" width="900px">
      <template #header>Expertise — {{ detail?.nama }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-4 pt-4">
          <div class="grid grid-cols-2 p-3 text-sm rounded-lg gap-x-6 gap-y-1 bg-opensimrs-50">
            <div><span class="text-grey-400">Pasien:</span> <b>{{ detail.order?.pasien?.name }}</b> ({{ detail.order?.noRm }})</div>
            <div><span class="text-grey-400">No. Order:</span> {{ detail.order?.noOrder }} <span v-if="detail.order?.cito" class="font-bold text-danger-300">CITO</span></div>
            <div><span class="text-grey-400">Umur / JK:</span> {{ umurRad(detail.order?.pasien?.birthDate) }} / {{ JK[detail.order?.pasien?.gender] ?? "-" }}</div>
            <div><span class="text-grey-400">Dokter pengirim:</span> {{ detail.order?.dokterPengirim ?? "-" }}</div>
            <div class="col-span-2"><span class="text-grey-400">Klinis:</span> {{ detail.order?.klinis || "-" }}</div>
            <div class="col-span-2"><span class="text-grey-400">Radiografer:</span> {{ detail.radiografer ?? "-" }} · {{ waktuRad(detail.waktuPeriksa) }}</div>
          </div>
          <CustomSelect
            v-if="template.length"
            :modelValue="templateDipilih"
            label="Template expertise (bacaan normal)"
            placeHolder="Pilih template untuk mengisi hasil & kesan, lalu sunting sesuai temuan"
            :options="template"
            optionValue="uuid"
            optionLabel="nama"
            :showFilter="false"
            @update:modelValue="terapkanTemplate"
          />
          <CustomSelect
            v-model="formHasil.dokterRadiologiUuid"
            label="Dokter Radiologi (Sp.Rad)"
            placeHolder="Pilih dokter pembaca"
            :options="dokter"
            optionValue="uuid"
            optionLabel="nama"
            required
          />
          <CustomTextArea v-model="formHasil.hasil" label="Hasil / Uraian" placeholder="Uraian temuan radiologis" height="h-48" required />
          <CustomTextArea v-model="formHasil.kesan" label="Kesan" placeholder="Kesimpulan" height="h-20" required />
          <div>
            <div class="mb-1 text-sm font-semibold">Lampiran gambar (opsional, maks. 1 MB, 5 berkas; disimpan sebagai PNG/JPG)</div>
            <div class="flex flex-wrap items-center gap-3">
              <div v-for="(l, n) in formHasil.lampiran" :key="n" class="relative">
                <img :src="l.data" :alt="l.nama" class="object-cover w-24 h-24 border rounded-lg border-grey-75" />
                <button type="button" class="absolute -top-2 -right-2 text-danger-300" title="Hapus lampiran" @click="formHasil.lampiran.splice(n, 1)">
                  <PhXCircle :size="20" weight="fill" />
                </button>
              </div>
              <label class="flex items-center gap-2 px-3 py-2 text-sm border border-dashed rounded-lg cursor-pointer border-opensimrs-300 text-opensimrs-300">
                <PhPaperclip :size="16" /> Tambah gambar
                <input type="file" accept="image/*" multiple class="hidden" @change="tambahLampiran" />
              </label>
            </div>
          </div>
          <div v-if="galatHasil" class="text-sm text-danger-300">{{ galatHasil }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogHasil = false" />
          <CustomButton label="Simpan Expertise" icon="PhFloppyDisk" @click="simpanHasil" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
