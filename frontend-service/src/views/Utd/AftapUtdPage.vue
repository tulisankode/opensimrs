<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
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
import JejakKantongUtd from "@/views/Utd/JejakKantongUtd.vue";
import { utilsStore } from "@/stores/utils";
import {
  GOLONGAN_DARAH_UTD,
  REAKSI_DONOR_UTD,
  RHESUS_UTD,
  STATUS_KANTONG_UTD,
  bolehLihatReaktifUtd,
  buatAftapUtd,
  daftarAftapUtd,
  daftarDonorUtd,
  detailAftapUtd,
  gayaKantongUtd,
  gayaReaksiUtd,
  golonganRhUtd,
  izinUtd,
  keEpoch,
  opsi,
  riwayatDonorUtd,
  waktuUtd,
} from "@/stores/penunjang/utd";

// Pengambilan Darah (Aftap): hanya dari kunjungan seleksi berstatus "layak" yang belum memiliki aftap. Nomor kantong
// unik per faskes; status awal kantong selalu karantina sampai uji saring IMLTD & pelepasan. Kegiatan/lokasi donor
// mobile dicatat per aftap. Klik baris untuk jejak vein-to-vein kantong.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinUtd("Aftap", aksi);
const bolehReaktif = bolehLihatReaktifUtd();

// ── Daftar & filter
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterStatus = ref<string[]>([]);
// Tanpa izin Lihat Hasil Reaktif, filter "Karantina/Reaktif" tidak ditawarkan.
const opsiStatus = computed(() => Object.entries(STATUS_KANTONG_UTD).filter(([k]) => bolehReaktif || k !== "karantina_reaktif"));

const toggleStatus = (nilai: string) => {
  filterStatus.value = filterStatus.value.includes(nilai) ? filterStatus.value.filter((x) => x !== nilai) : [...filterStatus.value, nilai];
};
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarAftapUtd({ page: page.value, limit: limit.value, cari: cari.value.trim(), status: filterStatus.value });
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
  filterStatus.value = [];
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};
onMounted(muat);

// ── Jejak kantong
const jejak = ref<any>(null);
const dialogJejak = ref(false);
const bukaJejak = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailAftapUtd(uuid);
    if (res?.payload) {
      jejak.value = res.payload;
      dialogJejak.value = true;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Form aftap: pilih donor → kunjungan seleksi layak → data kantong
const dialogForm = ref(false);
const kataDonor = ref("");
const hasilDonor = ref<any[]>([]);
const donor = ref<any>(null);
const riwayatLayak = ref<any[]>([]);
const kosong = () => ({
  riwayatUuid: "",
  noKantong: "",
  volumeMl: 350,
  golonganDarah: "",
  rhesus: "",
  waktuMulai: new Date() as Date | null,
  waktuSelesai: null as Date | null,
  reaksiDonor: "tidak_ada",
  catatanReaksi: "",
  donorMobile: false,
  kegiatan: "",
  lokasiMobile: "",
});
const form = ref(kosong());
const galatForm = ref("");

const bukaBaru = () => {
  form.value = kosong();
  galatForm.value = "";
  kataDonor.value = "";
  hasilDonor.value = [];
  donor.value = null;
  riwayatLayak.value = [];
  dialogForm.value = true;
};
const cariDonor = async () => {
  if (!kataDonor.value.trim()) return;
  hasilDonor.value = (await daftarDonorUtd({ cari: kataDonor.value.trim(), status_aktif: "aktif", limit: 20 }))?.payload?.data ?? [];
};
// Kunjungan layak yang belum dipakai aftap (dicocokkan dari daftar aftap donor; backend tetap menolak duplikat).
const pilihDonor = async (d: any) => {
  donor.value = d;
  hasilDonor.value = [];
  form.value = { ...form.value, riwayatUuid: "", golonganDarah: d.golonganDarah ?? "", rhesus: d.rhesus ?? "" };
  storeUtils.setLoading(true);
  try {
    const [r, a] = await Promise.all([riwayatDonorUtd(d.uuid, { limit: 20 }), daftarAftapUtd({ cari: d.noDonor, limit: 100 })]);
    const terpakai = new Set((a?.payload?.data ?? []).map((x: any) => x.riwayatUuid));
    riwayatLayak.value = (r?.payload?.data ?? []).filter((x: any) => x.status === "layak" && !terpakai.has(x.uuid));
    if (riwayatLayak.value.length) form.value.riwayatUuid = riwayatLayak.value[0].uuid;
  } finally {
    storeUtils.setLoading(false);
  }
};
const opsiRiwayat = computed(() =>
  riwayatLayak.value.map((r: any) => ({
    value: r.uuid,
    label: `${waktuUtd(r.createdAt)} · Hb ${r.hb ?? "-"} · TD ${r.tekananSistolik ?? "-"}/${r.tekananDiastolik ?? "-"} · BB ${r.beratBadan ?? "-"}`,
  })),
);

const simpan = async () => {
  const f = form.value;
  galatForm.value = "";
  if (!donor.value) return (galatForm.value = "Pilih donor terlebih dahulu");
  if (!f.riwayatUuid) return (galatForm.value = "Tidak ada kunjungan seleksi berstatus layak yang belum diaftap");
  if (!f.noKantong.trim()) return (galatForm.value = "Nomor kantong wajib diisi");
  if (!f.volumeMl || f.volumeMl <= 0) return (galatForm.value = "Volume harus lebih dari 0 mL");
  if (f.waktuMulai && f.waktuSelesai && f.waktuSelesai < f.waktuMulai) return (galatForm.value = "Waktu selesai tidak boleh sebelum waktu mulai");
  if (f.reaksiDonor !== "tidak_ada" && !f.catatanReaksi.trim()) return (galatForm.value = "Catatan reaksi donor wajib diisi");
  if (f.donorMobile && !f.kegiatan.trim()) return (galatForm.value = "Nama kegiatan donor mobile wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await buatAftapUtd({
      riwayatUuid: f.riwayatUuid,
      noKantong: f.noKantong.trim(),
      volumeMl: Number(f.volumeMl),
      golonganDarah: f.golonganDarah || undefined,
      rhesus: f.rhesus || undefined,
      waktuMulai: keEpoch(f.waktuMulai),
      waktuSelesai: keEpoch(f.waktuSelesai),
      reaksiDonor: f.reaksiDonor,
      catatanReaksi: f.catatanReaksi.trim() || undefined,
      kegiatan: f.donorMobile ? f.kegiatan.trim() : undefined,
      lokasiMobile: f.donorMobile ? f.lokasiMobile.trim() || undefined : undefined,
    });
    if (res?.payload) {
      dialogForm.value = false;
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
          <h1 class="toolbar-heading text-opensimrs-300">Aftap</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="No. Kantong / No. Donor / Nama" :maxLength="100" @keydown.enter="cariData" />
          <ToolbarFilterMenu :count="filterStatus.length">
            <template #label>Status Kantong</template>
            <CustomChip
              v-for="[kode, s] in opsiStatus"
              :key="kode"
              :label="s.label"
              :value="kode"
              :isSelected="filterStatus.includes(kode)"
              @selected="toggleStatus($event)"
            />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Aftap" @click="bukaBaru" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable
          v-else
          :value="data"
          stripedRows
          class="text-xs cursor-pointer"
          scrollable
          scrollHeight="flex"
          tableStyle="min-width: 60rem"
          @rowClick="bukaJejak($event.data.uuid)"
        >
          <Column header="No. Kantong" headerClass="bg-opensimrs-50">
            <template #body="{ data: a }">
              <div class="font-semibold">{{ a.noKantong }}</div>
              <div class="text-grey-400">{{ waktuUtd(a.waktuMulai || a.createdAt) }}</div>
            </template>
          </Column>
          <Column header="Donor" headerClass="bg-opensimrs-50">
            <template #body="{ data: a }">
              <div class="font-semibold">{{ a.namaDonor }}</div>
              <div class="text-grey-400">{{ a.noDonor }}</div>
            </template>
          </Column>
          <Column header="Gol." headerClass="bg-opensimrs-50">
            <template #body="{ data: a }"><b>{{ golonganRhUtd(a.golonganDarah, a.rhesus) }}</b></template>
          </Column>
          <Column header="Volume" headerClass="bg-opensimrs-50">
            <template #body="{ data: a }">{{ a.volumeMl }} mL</template>
          </Column>
          <Column header="Reaksi Donor" headerClass="bg-opensimrs-50">
            <template #body="{ data: a }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaReaksiUtd(a.reaksiDonor)?.bg, gayaReaksiUtd(a.reaksiDonor)?.text]">
                {{ gayaReaksiUtd(a.reaksiDonor)?.label ?? a.reaksiDonor }}
              </span>
            </template>
          </Column>
          <Column header="Kegiatan" headerClass="bg-opensimrs-50">
            <template #body="{ data: a }">
              <div>{{ a.kegiatan ?? "Dalam gedung" }}</div>
              <div v-if="a.lokasiMobile" class="text-grey-400">{{ a.lokasiMobile }}</div>
            </template>
          </Column>
          <Column header="Status Kantong" headerClass="bg-opensimrs-50">
            <template #body="{ data: a }">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                :class="[gayaKantongUtd(a.statusKantong, bolehReaktif)?.bg, gayaKantongUtd(a.statusKantong, bolehReaktif)?.text]"
              >
                {{ gayaKantongUtd(a.statusKantong, bolehReaktif)?.label ?? a.statusKantong }}
              </span>
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

    <!-- Jejak kantong -->
    <CustomDialog v-model:visible="dialogJejak" width="900px">
      <template #header>Jejak Kantong {{ jejak?.noKantong }}</template>
      <template #body>
        <JejakKantongUtd v-if="jejak" :jejak="jejak" class="pt-4" />
      </template>
    </CustomDialog>

    <!-- Form aftap -->
    <CustomDialog v-model:visible="dialogForm" width="820px">
      <template #header>Pengambilan Darah (Aftap)</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div>
            <div class="mb-1 text-sm font-semibold">Donor</div>
            <div v-if="donor" class="flex items-center justify-between p-3 rounded-lg bg-opensimrs-50">
              <div class="text-sm">
                <b>{{ donor.nama }}</b> · {{ donor.noDonor }} · Gol. {{ golonganRhUtd(donor.golonganDarah, donor.rhesus) }}
              </div>
              <CustomButton label="Ganti" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="(donor = null), (riwayatLayak = [])" />
            </div>
            <div v-else class="flex flex-col gap-2">
              <div class="flex gap-2">
                <InputText v-model="kataDonor" placeholder="Cari No. Donor / NIK / Nama donor aktif" class="text-sm grow" @keydown.enter="cariDonor" />
                <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariDonor" />
              </div>
              <div v-if="hasilDonor.length" class="overflow-auto border rounded-lg max-h-[160px] border-grey-75">
                <div
                  v-for="d in hasilDonor"
                  :key="d.uuid"
                  class="flex justify-between px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50"
                  @click="pilihDonor(d)"
                >
                  <span><b>{{ d.nama }}</b> · {{ d.noDonor }}</span>
                  <span class="text-grey-400">Gol. {{ golonganRhUtd(d.golonganDarah, d.rhesus) }}</span>
                </div>
              </div>
            </div>
          </div>
          <template v-if="donor">
            <CustomSelect
              v-model="form.riwayatUuid"
              label="Kunjungan Seleksi (Layak)"
              placeHolder="Tidak ada kunjungan layak yang belum diaftap"
              :options="opsiRiwayat"
              optionValue="value"
              optionLabel="label"
              :showFilter="false"
              required
            />
            <div class="grid grid-cols-3 gap-4">
              <CustomTextfield v-model="form.noKantong" label="Nomor Kantong" placeholder="mis. 9999-KTG-000001" required :maxLength="30" />
              <CustomInputNumber v-model="form.volumeMl" label="Volume (mL)" :min="1" :max="600" required />
              <div></div>
              <CustomSelect
                v-model="form.golonganDarah"
                label="Golongan Darah"
                placeHolder="Belum diketahui"
                :options="opsi(GOLONGAN_DARAH_UTD)"
                optionValue="value"
                optionLabel="label"
                :showFilter="false"
                :disabled="!!donor.golonganDarah"
              />
              <CustomSelect
                v-model="form.rhesus"
                label="Rhesus"
                placeHolder="Belum diketahui"
                :options="opsi(RHESUS_UTD)"
                optionValue="value"
                optionLabel="label"
                :showFilter="false"
                :disabled="!!donor.rhesus"
              />
              <div></div>
              <CustomDatePicker v-model="form.waktuMulai" label="Waktu Mulai" showTime :maxDate="new Date()" />
              <CustomDatePicker v-model="form.waktuSelesai" label="Waktu Selesai" showTime :minDate="form.waktuMulai ?? undefined" />
              <CustomSelect v-model="form.reaksiDonor" label="Reaksi Donor" :options="opsi(REAKSI_DONOR_UTD)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
            </div>
            <CustomTextArea
              v-if="form.reaksiDonor !== 'tidak_ada'"
              v-model="form.catatanReaksi"
              label="Catatan Reaksi & Penanganan"
              placeholder="mis. pusing ringan, istirahat 15 menit, diberi minum"
              required
            />
            <div class="flex items-center gap-2">
              <Checkbox v-model="form.donorMobile" binary inputId="utd-mobile" />
              <label for="utd-mobile" class="text-sm">Donor mobile / kegiatan di luar gedung</label>
            </div>
            <div v-if="form.donorMobile" class="grid grid-cols-2 gap-4">
              <CustomTextfield v-model="form.kegiatan" label="Nama Kegiatan" placeholder="mis. Donor Darah Kantor Contoh" required :maxLength="200" />
              <CustomTextfield v-model="form.lokasiMobile" label="Lokasi" placeholder="mis. Aula Kecamatan Contoh" :maxLength="200" />
            </div>
            <div class="text-xs text-grey-400">
              Golongan darah/rhesus yang baru diketahui saat aftap disimpan juga ke profil donor. Kantong tersimpan berstatus karantina.
            </div>
          </template>
          <div v-if="galatForm" class="text-sm text-danger-300">{{ galatForm }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogForm = false" />
          <CustomButton label="Simpan Aftap" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
