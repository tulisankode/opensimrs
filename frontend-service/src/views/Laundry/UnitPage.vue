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
import { createLabelLinenPdf } from "@/utils/pdf/pdfLaundry/cetakLabelLinen";
import {
  PERISTIWA_UNIT,
  POSISI_UNIT,
  STATUS_UNIT,
  aturJenisUnitLaundry,
  bedUnitLaundry,
  daftarUnitLaundry,
  detailUnitLaundry,
  gayaSiklusUnit,
  gayaStatusUnit,
  izinLaundry,
  jenisUnitLaundry,
  koreksiLokasiUnitLaundry,
  labelUnitLaundry,
  posisiUnit,
  referensiUnitLaundry,
  registrasiUnitLaundry,
  tautkanBedUnitLaundry,
  ubahStatusUnitLaundry,
  waktuLaundry,
} from "@/stores/penunjang/laundry";

// Unit linen & label (STD-0030): cara pencatatan per jenis (per jumlah / per unit) + batas umur pakai, registrasi unit
// berkode unik, cetak/cetak ulang label QR/barcode, detail riwayat, koreksi status/lokasi beralasan, tautan bed/kamar.
// Unit per unit tetap dihitung di buku stok yang sama (Stok & Par Level); perpindahan alur lewat menu Pemindaian Unit.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinLaundry("Unit Linen", aksi);
const bolehKoreksi = izinLaundry("Koreksi Unit", "UPDATE");
const bolehAturJenis = izinLaundry("Datamaster", "UPDATE", "Jenis Linen");
const opsi = (obj: Record<string, any>) => Object.entries(obj).map(([value, v]) => ({ value, label: typeof v === "string" ? v : v.label }));

const jenis = ref<any[]>([]);
const ruangan = ref<any[]>([]);
const opsiRuangan = computed(() => ruangan.value.map((r) => ({ value: r.uuid, label: r.nama })));
const opsiJenisUnit = computed(() => jenis.value.filter((j) => j.caraPencatatan === "per_unit" && j.aktif).map((j) => ({ value: j.uuid, label: `${j.nama} (${j.kode})` })));
const opsiLokasiTipe = [
  { value: "ruangan", label: "Ruangan" },
  { value: "laundry", label: "Stok bersih laundry" },
];

const filter = ref({ q: "", jenisLinenUuid: "", status: "", lokasiTipe: "", siklus: "" });
const data = ref<any[]>([]);
const pilihan = ref<any[]>([]);
const muat = async () => {
  if (!boleh("READ")) return;
  storeUtils.setLoading(true);
  try {
    const f = filter.value;
    data.value = (await daftarUnitLaundry({ q: f.q, jenis_linen_uuid: f.jenisLinenUuid, status: f.status, lokasi_tipe: f.lokasiTipe, siklus: f.siklus }))?.payload ?? [];
    pilihan.value = [];
  } finally {
    storeUtils.setLoading(false);
  }
};
const muatReferensi = async () => {
  const r = (await referensiUnitLaundry())?.payload;
  ruangan.value = r?.ruangan ?? [];
  jenis.value = (await jenisUnitLaundry())?.payload ?? r?.jenisLinen ?? [];
};
onMounted(async () => {
  await muatReferensi();
  muat();
});

// ── Konfigurasi cara pencatatan & umur pakai per jenis
const dialogJenis = ref(false);
const barisJenis = ref<any[]>([]);
const bukaJenis = () => {
  barisJenis.value = jenis.value.map((j) => ({ ...j, batasSiklus: j.batasSiklus ?? null, peringatanSiklus: j.peringatanSiklus ?? null }));
  dialogJenis.value = true;
};
const simpanJenis = async (j: any) => {
  storeUtils.setLoading(true);
  try {
    if (await aturJenisUnitLaundry(j.uuid, { caraPencatatan: j.caraPencatatan, batasSiklus: j.batasSiklus || null, peringatanSiklus: j.peringatanSiklus || null })) {
      await muatReferensi();
      bukaJenis();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Registrasi unit
const dialogDaftar = ref(false);
const form = ref<any>({});
const galat = ref("");
const hasilDaftar = ref<any[]>([]);
const bukaDaftar = () => {
  galat.value = "";
  hasilDaftar.value = [];
  form.value = { jenisLinenUuid: opsiJenisUnit.value[0]?.value ?? "", jumlah: 1, sumber: "stok_ada", lokasiTipe: "laundry", lokasiUuid: "", kodeAwal: "", kodeUnit: "" };
  dialogDaftar.value = true;
};
const simpanDaftar = async () => {
  const f = form.value;
  if (!f.jenisLinenUuid) return (galat.value = "Pilih jenis linen yang dilacak per unit");
  if (f.lokasiTipe === "ruangan" && !f.lokasiUuid) return (galat.value = "Ruangan wajib dipilih");
  storeUtils.setLoading(true);
  try {
    const res = await registrasiUnitLaundry({
      jenisLinenUuid: f.jenisLinenUuid,
      jumlah: f.kodeUnit ? 1 : f.jumlah,
      sumber: f.sumber,
      lokasiTipe: f.lokasiTipe,
      lokasiUuid: f.lokasiTipe === "ruangan" ? f.lokasiUuid : undefined,
      kodeAwal: f.kodeAwal || undefined,
      kodeUnit: f.kodeUnit || undefined,
    });
    if (res) {
      hasilDaftar.value = res.payload?.unit ?? [];
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Label (cetak & cetak ulang tanpa membuat unit baru)
const cetak = async (daftar: any[], format: "qr" | "barcode") => {
  if (!daftar.length) return;
  const res = await labelUnitLaundry(daftar.map((u) => u.uuid));
  const label = (res?.payload?.label ?? []).map((l: any) => ({ kodeUnit: l.kodeUnit, nilai: l.nilai, namaJenis: l.namaJenis, namaFaskes: l.namaFaskes }));
  if (label.length) createLabelLinenPdf(label, format, `Label Unit Linen ${label.length > 1 ? `(${label.length})` : label[0].kodeUnit}`);
};

// ── Detail & riwayat
const dialogDetail = ref(false);
const detail = ref<any>(null);
const bukaDetail = async (u: any) => {
  detail.value = (await detailUnitLaundry(u.uuid))?.payload ?? null;
  dialogDetail.value = !!detail.value;
};
const lokasiRiwayat = (tipe: string, nama?: string) => (tipe === "laundry" ? POSISI_UNIT.laundry : tipe ? `${POSISI_UNIT[tipe] ?? tipe}${nama ? ` · ${nama}` : ""}` : "-");

// ── Koreksi status / lokasi
const dialogStatus = ref(false);
const formStatus = ref<any>({});
const galatStatus = ref("");
const opsiStatusBaru = computed(() => opsi(STATUS_UNIT).filter((s) => s.value !== formStatus.value.unit?.status));
const bukaStatus = (u: any) => {
  galatStatus.value = "";
  formStatus.value = { unit: u, status: u.status === "aktif" ? "rusak" : "aktif", alasan: "", lokasiTipe: "laundry", lokasiUuid: "" };
  dialogStatus.value = true;
};
const simpanStatus = async () => {
  const f = formStatus.value;
  if (!f.alasan?.trim()) return (galatStatus.value = "Alasan wajib diisi");
  if (f.status === "aktif" && f.lokasiTipe === "ruangan" && !f.lokasiUuid) return (galatStatus.value = "Ruangan wajib dipilih");
  storeUtils.setLoading(true);
  try {
    const kirim = f.status === "aktif" ? { status: f.status, alasan: f.alasan, lokasiTipe: f.lokasiTipe, lokasiUuid: f.lokasiTipe === "ruangan" ? f.lokasiUuid : undefined } : { status: f.status, alasan: f.alasan };
    if (await ubahStatusUnitLaundry(f.unit.uuid, kirim)) {
      dialogStatus.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialogLokasi = ref(false);
const formLokasi = ref<any>({});
const galatLokasi = ref("");
const bukaLokasi = (u: any) => {
  galatLokasi.value = "";
  formLokasi.value = { unit: u, lokasiTipe: "ruangan", lokasiUuid: "", alasan: "" };
  dialogLokasi.value = true;
};
const simpanLokasi = async () => {
  const f = formLokasi.value;
  if (f.lokasiTipe === "ruangan" && !f.lokasiUuid) return (galatLokasi.value = "Ruangan wajib dipilih");
  if (!f.alasan?.trim()) return (galatLokasi.value = "Alasan wajib diisi");
  storeUtils.setLoading(true);
  try {
    if (await koreksiLokasiUnitLaundry(f.unit.uuid, { lokasiTipe: f.lokasiTipe, lokasiUuid: f.lokasiTipe === "ruangan" ? f.lokasiUuid : undefined, alasan: f.alasan })) {
      dialogLokasi.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Tautan bed/kamar (opsional, tanpa data pasien)
const dialogBed = ref(false);
const formBed = ref<any>({});
const bed = ref<any[]>([]);
const opsiBed = computed(() => bed.value.map((b) => ({ value: b.uuid, label: `${b.namaKamar ? `${b.namaKamar} · ` : ""}Bed ${b.noBed}` })));
const bukaBed = async (u: any) => {
  formBed.value = { unit: u, bedUuid: u.bedUuid ?? "", alasan: "" };
  bed.value = (await bedUnitLaundry(u.lokasiUuid))?.payload ?? [];
  dialogBed.value = true;
};
const simpanBed = async (lepas = false) => {
  const f = formBed.value;
  storeUtils.setLoading(true);
  try {
    if (await tautkanBedUnitLaundry(f.unit.uuid, { bedUuid: lepas ? null : f.bedUuid || null, alasan: f.alasan || undefined })) {
      dialogBed.value = false;
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
          <h1 class="toolbar-heading text-opensimrs-300">Unit Linen & Label</h1>
          <CustomTextfield v-model="filter.q" label="Cari kode / jenis" prependIcon="PhMagnifyingGlass" :maxLength="60" @keydown.enter="muat" />
          <CustomSelect v-model="filter.jenisLinenUuid" label="Jenis" :options="[{ value: '', label: 'Semua jenis' }, ...opsiJenisUnit]" optionValue="value" optionLabel="label" @update:modelValue="muat" />
          <CustomSelect v-model="filter.status" label="Status" :options="[{ value: '', label: 'Semua status' }, ...opsi(STATUS_UNIT)]" optionValue="value" optionLabel="label" @update:modelValue="muat" />
          <CustomSelect v-model="filter.lokasiTipe" label="Posisi" :options="[{ value: '', label: 'Semua posisi' }, ...opsi(POSISI_UNIT)]" optionValue="value" optionLabel="label" @update:modelValue="muat" />
          <CustomSelect
            v-model="filter.siklus"
            label="Umur pakai"
            :options="[{ value: '', label: 'Semua' }, { value: 'mendekati', label: 'Mendekati batas' }, { value: 'tercapai', label: 'Mencapai batas' }]"
            optionValue="value"
            optionLabel="label"
            @update:modelValue="muat"
          />
          <CustomButton v-if="bolehAturJenis || boleh('READ')" icon="PhGear" label="Cara Pencatatan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaJenis" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Registrasi" @click="bukaDaftar" />
          <template v-if="boleh('CETAK LABEL') && pilihan.length">
            <CustomButton icon="PhQrCode" :label="`Label QR (${pilihan.length})`" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetak(pilihan, 'qr')" />
            <CustomButton icon="PhBarcode" :label="`Barcode (${pilihan.length})`" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetak(pilihan, 'barcode')" />
          </template>
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else v-model:selection="pilihan" :value="data" dataKey="uuid" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 60rem">
          <Column selectionMode="multiple" headerClass="bg-opensimrs-50" class="w-[40px]" />
          <Column field="kodeUnit" header="Kode Unit" headerClass="bg-opensimrs-50"><template #body="{ data: d }"><span class="font-semibold">{{ d.kodeUnit }}</span></template></Column>
          <Column field="namaJenis" header="Jenis" headerClass="bg-opensimrs-50" />
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaStatusUnit(d.status).bg, gayaStatusUnit(d.status).text]">{{ gayaStatusUnit(d.status).label }}</span>
            </template>
          </Column>
          <Column header="Posisi" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ posisiUnit(d) }}</template></Column>
          <Column header="Bed" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.noBed ? `${d.namaKamar ?? ""} · Bed ${d.noBed}` : "-" }}</template></Column>
          <Column header="Siklus Cuci" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaSiklusUnit(d.statusSiklus).bg, gayaSiklusUnit(d.statusSiklus).text]">
                {{ d.siklusCuci }}{{ d.batasSiklus ? ` / ${d.batasSiklus}` : "" }}
              </span>
            </template>
          </Column>
          <Column header="Terakhir Dicuci" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.waktuCuciTerakhir ? waktuLaundry(d.waktuCuciTerakhir) : "-" }}</template></Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[200px]">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton icon="PhClockCounterClockwise" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaDetail(d)" />
                <CustomButton v-if="boleh('CETAK LABEL')" icon="PhQrCode" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetak([d], 'qr')" />
                <CustomButton v-if="boleh('UPDATE') && d.status === 'aktif' && d.lokasiTipe === 'ruangan'" icon="PhBed" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaBed(d)" />
                <CustomButton v-if="bolehKoreksi && d.status !== 'dimusnahkan'" icon="PhWarningCircle" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaStatus(d)" />
                <CustomButton v-if="bolehKoreksi && d.status === 'aktif' && ['ruangan', 'laundry'].includes(d.lokasiTipe)" icon="PhMapPin" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaLokasi(d)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <!-- Cara pencatatan per jenis -->
    <CustomDialog v-model:visible="dialogJenis" width="860px">
      <template #header>Cara Pencatatan & Umur Pakai Jenis Linen</template>
      <template #body>
        <div class="pt-4 text-xs text-grey-400">
          Jenis <b>per unit</b> wajib dipindai di setiap titik alur dan tetap dihitung di buku stok yang sama. Stok lama jenis tersebut perlu diberi label (registrasi sumber "stok yang sudah tercatat") sebelum dapat beredar. Ambang peringatan = siklus ke-n mulai ditandai mendekati batas.
        </div>
        <DataTable :value="barisJenis" class="text-xs mt-3" stripedRows>
          <Column header="Jenis Linen" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.nama }} <span class="text-grey-300">({{ d.kode }})</span></template></Column>
          <Column header="Cara Pencatatan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <CustomSelect v-model="d.caraPencatatan" :showLabel="false" :options="[{ value: 'per_jumlah', label: 'Per jumlah' }, { value: 'per_unit', label: 'Per unit (QR/barcode)' }]" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" :disabled="!bolehAturJenis" />
            </template>
          </Column>
          <Column header="Batas Siklus" headerClass="bg-opensimrs-50"><template #body="{ data: d }"><CustomInputNumber v-model="d.batasSiklus" :showLabel="false" :min="1" :disabled="!bolehAturJenis" /></template></Column>
          <Column header="Ambang Peringatan" headerClass="bg-opensimrs-50"><template #body="{ data: d }"><CustomInputNumber v-model="d.peringatanSiklus" :showLabel="false" :min="1" :disabled="!bolehAturJenis" /></template></Column>
          <Column header="Unit Aktif" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.unitAktif ?? 0 }}</template></Column>
          <Column v-if="bolehAturJenis" header="" headerClass="bg-opensimrs-50"><template #body="{ data: d }"><CustomButton icon="PhFloppyDisk" size="small" @click="simpanJenis(d)" /></template></Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end"><CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogJenis = false" /></div>
      </template>
    </CustomDialog>

    <!-- Registrasi -->
    <CustomDialog v-model:visible="dialogDaftar" width="560px">
      <template #header>Registrasi Unit Linen</template>
      <template #body>
        <div v-if="!hasilDaftar.length" class="flex flex-col gap-3 pt-4">
          <div v-if="!opsiJenisUnit.length" class="text-sm text-danger-300">Belum ada jenis linen yang dilacak per unit. Atur lewat tombol Cara Pencatatan.</div>
          <CustomSelect v-model="form.jenisLinenUuid" label="Jenis Linen (per unit)" :options="opsiJenisUnit" optionValue="value" optionLabel="label" placeHolder="Pilih jenis" />
          <CustomSelect
            v-model="form.sumber"
            label="Sumber"
            :options="[{ value: 'stok_ada', label: 'Memberi label stok yang sudah tercatat (saldo tetap)' }, { value: 'baru', label: 'Linen baru (saldo bertambah)' }]"
            optionValue="value"
            optionLabel="label"
            :clearable="false"
            :showFilter="false"
          />
          <CustomSelect v-model="form.lokasiTipe" label="Lokasi Saat Ini" :options="opsiLokasiTipe" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" />
          <CustomSelect v-if="form.lokasiTipe === 'ruangan'" v-model="form.lokasiUuid" label="Ruangan" :options="opsiRuangan" optionValue="value" optionLabel="label" placeHolder="Pilih ruangan" />
          <CustomTextfield v-model="form.kodeUnit" label="Kode Unit Manual (opsional, satu unit)" placeholder="mis. kode label yang sudah terjahit" :maxLength="60" />
          <template v-if="!form.kodeUnit">
            <CustomInputNumber v-model="form.jumlah" label="Jumlah Unit" :min="1" :max="200" />
            <CustomTextfield v-model="form.kodeAwal" label="Awalan Kode (opsional, bawaan kode jenis)" placeholder="mis. SLM → SLM-000001" :maxLength="20" />
          </template>
          <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
        </div>
        <div v-else class="flex flex-col gap-3 pt-4">
          <div class="text-sm">{{ hasilDaftar.length }} unit terdaftar: <b>{{ hasilDaftar[0].kodeUnit }}</b><span v-if="hasilDaftar.length > 1"> s.d. <b>{{ hasilDaftar[hasilDaftar.length - 1].kodeUnit }}</b></span></div>
          <div v-if="boleh('CETAK LABEL')" class="flex gap-2">
            <CustomButton icon="PhQrCode" label="Cetak Label QR" @click="cetak(hasilDaftar, 'qr')" />
            <CustomButton icon="PhBarcode" label="Cetak Barcode" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetak(hasilDaftar, 'barcode')" />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton :label="hasilDaftar.length ? 'Tutup' : 'Batal'" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogDaftar = false" />
          <CustomButton v-if="!hasilDaftar.length" label="Daftarkan" icon="PhFloppyDisk" @click="simpanDaftar" />
        </div>
      </template>
    </CustomDialog>

    <!-- Detail & riwayat -->
    <CustomDialog v-model:visible="dialogDetail" width="900px">
      <template #header>Riwayat Unit {{ detail?.kodeUnit }}</template>
      <template #body>
        <div v-if="detail" class="pt-4 flex flex-col gap-3">
          <div class="grid grid-cols-4 gap-2 text-xs">
            <div><div class="text-grey-300">Jenis</div>{{ detail.namaJenis }}</div>
            <div><div class="text-grey-300">Status</div>{{ gayaStatusUnit(detail.status).label }}{{ detail.alasanStatus ? ` — ${detail.alasanStatus}` : "" }}</div>
            <div><div class="text-grey-300">Posisi</div>{{ posisiUnit(detail) }}</div>
            <div><div class="text-grey-300">Siklus Cuci</div>{{ detail.siklusCuci }}{{ detail.batasSiklus ? ` / ${detail.batasSiklus}` : "" }} ({{ gayaSiklusUnit(detail.statusSiklus).label }})</div>
          </div>
          <DataTable :value="detail.riwayat" class="text-xs" stripedRows scrollable scrollHeight="320px">
            <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuLaundry(d.waktu) }}</template></Column>
            <Column header="Peristiwa" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ PERISTIWA_UNIT[d.peristiwa] ?? d.peristiwa }}</template></Column>
            <Column header="Dari" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ lokasiRiwayat(d.lokasiTipeSebelum, d.namaLokasiSebelum) }}</template></Column>
            <Column header="Ke" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ lokasiRiwayat(d.lokasiTipeSesudah, d.namaLokasiSesudah) }}{{ d.noBed ? ` · Bed ${d.noBed}` : "" }}</template></Column>
            <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.statusSebelum && d.statusSebelum !== d.statusSesudah ? `${gayaStatusUnit(d.statusSebelum).label} → ` : "" }}{{ gayaStatusUnit(d.statusSesudah).label }}</template></Column>
            <Column field="siklusSesudah" header="Siklus" headerClass="bg-opensimrs-50" />
            <Column field="alasan" header="Keterangan" headerClass="bg-opensimrs-50" />
            <Column field="pelakuUuid" header="Petugas" headerClass="bg-opensimrs-50" />
          </DataTable>
          <div v-if="detail.tautanBed?.length" class="text-xs">
            <div class="font-semibold mb-1">Riwayat tautan bed/kamar</div>
            <div v-for="t in detail.tautanBed" :key="t.uuid">{{ t.namaLokasi }} · {{ t.namaKamar ?? "-" }} · Bed {{ t.noBed ?? "-" }} — {{ waktuLaundry(t.waktuMulai) }} s.d. {{ t.waktuSelesai ? waktuLaundry(t.waktuSelesai) : "sekarang" }}</div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end"><CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogDetail = false" /></div>
      </template>
    </CustomDialog>

    <!-- Ubah status -->
    <CustomDialog v-model:visible="dialogStatus" width="520px">
      <template #header>Ubah Status {{ formStatus.unit?.kodeUnit }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="text-xs text-grey-400">Status saat ini: {{ gayaStatusUnit(formStatus.unit?.status).label }}. Unit aktif yang dinonaktifkan keluar dari stok lokasinya; unit yang diaktifkan kembali masuk ke lokasi yang dipilih.</div>
          <CustomSelect v-model="formStatus.status" label="Status Baru" :options="opsiStatusBaru" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" />
          <template v-if="formStatus.status === 'aktif'">
            <CustomSelect v-model="formStatus.lokasiTipe" label="Lokasi" :options="opsiLokasiTipe" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" />
            <CustomSelect v-if="formStatus.lokasiTipe === 'ruangan'" v-model="formStatus.lokasiUuid" label="Ruangan" :options="opsiRuangan" optionValue="value" optionLabel="label" placeHolder="Pilih ruangan" />
          </template>
          <CustomTextfield v-model="formStatus.alasan" label="Alasan" required :maxLength="500" />
          <div v-if="galatStatus" class="text-sm text-danger-300">{{ galatStatus }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogStatus = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanStatus" />
        </div>
      </template>
    </CustomDialog>

    <!-- Koreksi lokasi -->
    <CustomDialog v-model:visible="dialogLokasi" width="520px">
      <template #header>Koreksi Lokasi {{ formLokasi.unit?.kodeUnit }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="text-xs text-grey-400">Posisi tercatat: {{ posisiUnit(formLokasi.unit) }}. Stok lokasi lama berkurang satu dan lokasi baru bertambah satu.</div>
          <CustomSelect v-model="formLokasi.lokasiTipe" label="Lokasi Sebenarnya" :options="opsiLokasiTipe" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" />
          <CustomSelect v-if="formLokasi.lokasiTipe === 'ruangan'" v-model="formLokasi.lokasiUuid" label="Ruangan" :options="opsiRuangan" optionValue="value" optionLabel="label" placeHolder="Pilih ruangan" />
          <CustomTextfield v-model="formLokasi.alasan" label="Alasan" required :maxLength="500" />
          <div v-if="galatLokasi" class="text-sm text-danger-300">{{ galatLokasi }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogLokasi = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanLokasi" />
        </div>
      </template>
    </CustomDialog>

    <!-- Tautan bed -->
    <CustomDialog v-model:visible="dialogBed" width="480px">
      <template #header>Tautan Bed {{ formBed.unit?.kodeUnit }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="text-xs text-grey-400">Opsional, untuk melihat linen mana di bed mana dan kapan terakhir diganti. Tautan berakhir otomatis saat unit diserahkan sebagai linen kotor.</div>
          <div v-if="!opsiBed.length" class="text-sm text-grey-400">Ruangan {{ formBed.unit?.namaLokasi }} belum memiliki data bed.</div>
          <CustomSelect v-else v-model="formBed.bedUuid" label="Bed" :options="opsiBed" optionValue="value" optionLabel="label" placeHolder="Pilih bed" />
          <CustomTextfield v-model="formBed.alasan" label="Keterangan (opsional)" :maxLength="300" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton v-if="formBed.unit?.bedUuid" label="Lepas Tautan" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="simpanBed(true)" />
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBed = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" :disabled="!formBed.bedUuid" @click="simpanBed()" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
