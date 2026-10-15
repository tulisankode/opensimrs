<script setup lang="ts">
import { computed, ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import {
  pratinjauImporMcu, simpanImporMcu, referensiImporMcu, OPSI_JENIS_MCU, tglIso, tglIndo, rupiah, jenisKelamin,
} from "@/stores/penunjang/mcu";
import { bacaFileImporMcu, unduhBarisGagal, unduhTemplatImporMcu, type FileImpor } from "@/utils/excel/imporMcu";

// Impor Excel rombongan MCU korporasi (jalur utama): pilih perusahaan & tanggal → unggah file HRD (templat OpenSIMRS /
// format unggah massal adamLIS) → pratinjau validasi per baris → simpan baris valid → unduh laporan baris gagal.
const props = defineProps<{ perusahaan: any[]; paket: any[] }>();
const visible = defineModel<boolean>("visible", { default: false });
// selesai: peserta hasil impor sudah terdaftar → halaman Peserta menampilkan rentang tanggal & perusahaan impor.
const emit = defineEmits<{ (e: "selesai", info?: { mulai: Date; selesai: Date; perusahaanUuid: string | null }): void }>();

const form = ref<any>({ perusahaanUuid: null, paketUuid: null, tanggal: new Date(), jenisMcu: "berkala" });
const file = ref<FileImpor | null>(null);
const pratinjau = ref<any>(null);
const hasil = ref<any>(null);
const memuat = ref(false);
const menyimpan = ref(false);
const galatBaca = ref("");
const filter = ref<"semua" | "galat" | "peringatan" | "baru" | "lama">("semua");
const inputFile = ref<HTMLInputElement | null>(null);
const mengunduh = ref(false);

watch(visible, (v) => {
  if (!v) return;
  form.value = { perusahaanUuid: null, paketUuid: null, tanggal: new Date(), jenisMcu: "berkala" };
  file.value = null;
  pratinjau.value = null;
  hasil.value = null;
  galatBaca.value = "";
  filter.value = "semua";
});

const perusahaanAktif = computed(() => props.perusahaan.filter((p) => p.status));
const paketKorporasi = computed(() => props.paket.filter((p) => p.status && p.jenis !== "perorangan"));
const namaPerusahaan = computed(() => props.perusahaan.find((p) => p.uuid === form.value.perusahaanUuid)?.nama ?? "");

const unduhTemplat = async () => {
  mengunduh.value = true;
  const res = await referensiImporMcu(true);
  if (res?.payload) {
    const p = res.payload;
    let profil: any = {};
    try {
      profil = JSON.parse(localStorage.getItem("faskes_profile") ?? "{}");
    } catch {
      profil = {};
    }
    unduhTemplatImporMcu(
      { paket: p.paket, unitAsal: p.unitAsal, dokter: p.dokter, penjamin: p.penjamin, tambahan: p.tambahan, wilayah: p.wilayah, icd: p.icd },
      profil?.name ?? "",
    );
  }
  mengunduh.value = false;
};

const dataKirim = () => ({
  perusahaanUuid: form.value.perusahaanUuid,
  paketUuid: form.value.paketUuid || null,
  tanggal: tglIso(form.value.tanggal),
  jenisMcu: form.value.jenisMcu,
  header: file.value!.header,
  baris: file.value!.baris,
  nomorBaris: file.value!.nomorBaris,
});

const jalankanPratinjau = async () => {
  if (!file.value || !form.value.perusahaanUuid) return;
  memuat.value = true;
  pratinjau.value = null;
  hasil.value = null;
  const res = await pratinjauImporMcu(dataKirim());
  pratinjau.value = res?.payload ?? null;
  memuat.value = false;
};

const pilihFile = async (e: Event) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = "";
  if (!f) return;
  galatBaca.value = "";
  try {
    file.value = await bacaFileImporMcu(f);
  } catch (err: any) {
    file.value = null;
    galatBaca.value = err?.message ?? String(err);
    return;
  }
  await jalankanPratinjau();
};
watch(() => [form.value.perusahaanUuid, form.value.paketUuid, form.value.tanggal?.getTime?.()], () => {
  if (file.value && !hasil.value) jalankanPratinjau();
});

const baris = computed(() => {
  const semua = pratinjau.value?.baris ?? [];
  if (filter.value === "semua") return semua;
  if (filter.value === "peringatan") return semua.filter((b: any) => b.peringatan?.length);
  return semua.filter((b: any) => b.status === filter.value);
});
const jumlahValid = computed(() => (pratinjau.value?.ringkasan?.lama ?? 0) + (pratinjau.value?.ringkasan?.baru ?? 0));

const simpan = async () => {
  if (!jumlahValid.value) return;
  menyimpan.value = true;
  const res = await simpanImporMcu(dataKirim());
  menyimpan.value = false;
  if (res?.payload) {
    hasil.value = res.payload;
    const tgl = (res.payload.berhasil ?? [])
      .map((p: any) => new Date(`${String(p.tanggal).slice(0, 10)}T00:00:00`))
      .filter((d: Date) => !Number.isNaN(d.getTime()))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());
    emit(
      "selesai",
      tgl.length ? { mulai: tgl[0], selesai: tgl[tgl.length - 1], perusahaanUuid: form.value.perusahaanUuid ?? null } : undefined
    );
  }
};

const unduhGalatPratinjau = () =>
  file.value && unduhBarisGagal(file.value, (pratinjau.value?.baris ?? []).filter((b: any) => b.status === "galat"), namaPerusahaan.value);
const unduhGagalSimpan = () => file.value && unduhBarisGagal(file.value, hasil.value?.gagal ?? [], namaPerusahaan.value);

const LENCANA: Record<string, string> = {
  lama: "bg-[#D1E9FF] text-[#175CD3]",
  baru: "bg-[#D1FADF] text-[#027A48]",
  galat: "bg-[#FDE2E1] text-[#B42318]",
};
const LABEL: Record<string, string> = { lama: "Pasien lama", baru: "Pasien baru", galat: "Galat" };
</script>

<template>
  <CustomDialog v-model:visible="visible" width="1180px">
    <template #header>Impor Peserta MCU dari Excel</template>
    <template #body>
      <div class="flex flex-col gap-3 pt-4 text-sm">
        <div class="grid grid-cols-[1.4fr,1.2fr,0.8fr,1fr] gap-3">
          <label class="flex flex-col gap-1">Perusahaan *
            <Select v-model="form.perusahaanUuid" :options="perusahaanAktif" optionLabel="nama" optionValue="uuid" filter placeholder="Pilih perusahaan" :disabled="!!hasil" />
          </label>
          <label class="flex flex-col gap-1">Paket bawaan (bila kolom paket kosong)
            <Select v-model="form.paketUuid" :options="paketKorporasi" optionLabel="nama" optionValue="uuid" showClear placeholder="Dari kolom paket di file" :disabled="!!hasil">
              <template #option="{ option }">
                <div class="flex justify-between w-full gap-3"><span>{{ option.kode }} — {{ option.nama }}</span><span class="text-grey-400">{{ rupiah(option.harga) }}</span></div>
              </template>
            </Select>
          </label>
          <label class="flex flex-col gap-1">Tanggal MCU<DatePicker v-model="form.tanggal" dateFormat="dd-mm-yy" :disabled="!!hasil" /></label>
          <label class="flex flex-col gap-1">Jenis MCU
            <Select v-model="form.jenisMcu" :options="OPSI_JENIS_MCU" optionLabel="label" optionValue="value" :disabled="!!hasil" />
          </label>
        </div>

        <div class="flex flex-wrap items-center gap-2 p-3 rounded bg-opensimrs-50">
          <CustomButton icon="PhDownloadSimple" label="Unduh Templat Excel" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :loading="mengunduh" @click="unduhTemplat" />
          <input ref="inputFile" type="file" accept=".xlsx,.xls,.xlsm,.csv" class="hidden" data-uji="file-impor" @change="pilihFile" />
          <CustomButton icon="PhUploadSimple" label="Pilih File Excel" :disabled="!form.perusahaanUuid || !!hasil" @click="inputFile?.click()" />
          <span v-if="!form.perusahaanUuid" class="text-xs text-grey-400">Pilih perusahaan terlebih dahulu.</span>
          <span v-if="file" class="text-xs">
            <b>{{ file.namaFile }}</b> · sheet {{ file.sheet }} · {{ file.baris.length }} baris berisi
          </span>
          <span v-if="galatBaca" class="text-xs font-semibold text-danger-300">{{ galatBaca }}</span>
          <span class="ml-auto text-xs text-grey-400">Format: templat OpenSIMRS atau unggah massal adamLIS (sheet Pasien). Maks. 1.000 baris.</span>
        </div>

        <div v-if="memuat" class="p-6 text-center text-grey-400">Memvalidasi baris…</div>

        <!-- Pratinjau -->
        <template v-if="pratinjau && !hasil">
          <div class="flex flex-wrap items-center gap-2 text-xs" data-uji="ringkasan-impor">
            <button v-for="[k, l, n] in [['semua', 'Semua', pratinjau.ringkasan.total], ['lama', 'Pasien lama', pratinjau.ringkasan.lama], ['baru', 'Pasien baru', pratinjau.ringkasan.baru], ['galat', 'Galat', pratinjau.ringkasan.galat], ['peringatan', 'Dengan peringatan', pratinjau.ringkasan.peringatan]]"
              :key="k" type="button" class="px-3 py-1 border rounded-full" :class="filter === k ? 'bg-opensimrs-300 text-white border-opensimrs-300' : 'border-grey-200'" @click="filter = k as any">
              {{ l }} <b>{{ n }}</b>
            </button>
            <span v-if="pratinjau.kolom?.diabaikan?.length" class="text-grey-400">Kolom diabaikan: {{ pratinjau.kolom.diabaikan.join(", ") }}</span>
          </div>
          <DataTable :value="baris" class="text-xs" scrollable scrollHeight="380px" dataKey="no" stripedRows>
            <Column header="Baris" field="no" headerClass="bg-opensimrs-50" class="w-14" />
            <Column header="Status" headerClass="bg-opensimrs-50" class="w-28">
              <template #body="{ data }">
                <span class="px-2 py-0.5 rounded-full font-semibold whitespace-nowrap" :class="LENCANA[data.status]">{{ LABEL[data.status] }}</span>
                <div v-if="data.noRm" class="text-grey-400 whitespace-nowrap">No. RM {{ data.noRm }}</div>
                <div v-else-if="data.status === 'baru'" class="text-grey-400">No. RM dibuat saat simpan</div>
              </template>
            </Column>
            <Column header="Nama / Identitas" headerClass="bg-opensimrs-50">
              <template #body="{ data }">
                <div class="font-semibold">{{ data.nama || "-" }} <span v-if="data.cito" class="px-1 text-[10px] rounded bg-danger-300 text-white">CITO</span></div>
                <div class="text-grey-400">{{ data.noIdentitas ?? "-" }} · {{ jenisKelamin(data.jenisKelamin) }} · {{ tglIndo(data.tglLahir) }}</div>
              </template>
            </Column>
            <Column header="Karyawan" headerClass="bg-opensimrs-50">
              <template #body="{ data }">
                <div>{{ data.nikKaryawan ?? "-" }}</div>
                <div class="text-grey-400">{{ [data.jabatan, data.bagian].filter(Boolean).join(" · ") || "-" }}</div>
              </template>
            </Column>
            <Column header="Paket / Tanggal" headerClass="bg-opensimrs-50">
              <template #body="{ data }">
                <div>{{ data.kodePaket ?? "-" }}</div>
                <div class="text-grey-400">{{ tglIndo(data.tanggal) }}</div>
                <div v-if="data.tambahan?.length" class="text-[11px] text-opensimrs-400">+ {{ data.tambahan.map((t: any) => t.nama).join(", ") }}</div>
              </template>
            </Column>
            <Column header="Keterangan" headerClass="bg-opensimrs-50" class="w-[38%]">
              <template #body="{ data }">
                <div v-for="(g, i) in data.galat" :key="'g' + i" class="text-[#B42318]">• {{ g }}</div>
                <div v-for="(p, i) in data.peringatan" :key="'p' + i" class="text-[#B54708]">• {{ p }}</div>
                <span v-if="!data.galat.length && !data.peringatan.length" class="text-grey-400">OK</span>
              </template>
            </Column>
          </DataTable>
        </template>

        <!-- Hasil simpan -->
        <div v-if="hasil" class="flex flex-col gap-2" data-uji="hasil-impor">
          <div class="grid grid-cols-4 gap-3">
            <div class="p-3 border rounded border-grey-100"><div class="text-xs text-grey-400">Berhasil didaftarkan</div><div class="text-2xl font-semibold text-[#027A48]">{{ hasil.ringkasan.berhasil }}</div></div>
            <div class="p-3 border rounded border-grey-100"><div class="text-xs text-grey-400">Pasien baru (Admisi)</div><div class="text-2xl font-semibold">{{ hasil.ringkasan.pasienBaru }}</div></div>
            <div class="p-3 border rounded border-grey-100"><div class="text-xs text-grey-400">Baris gagal</div><div class="text-2xl font-semibold text-[#B42318]">{{ hasil.ringkasan.gagal }}</div></div>
            <div class="p-3 border rounded border-grey-100"><div class="text-xs text-grey-400">Waktu proses</div><div class="text-2xl font-semibold">{{ (hasil.waktuMs / 1000).toFixed(1) }} dtk</div></div>
          </div>
          <DataTable v-if="hasil.gagal.length" :value="hasil.gagal" class="text-xs" scrollable scrollHeight="240px">
            <Column header="Baris" field="no" headerClass="bg-opensimrs-50" class="w-14" />
            <Column header="Nama" field="nama" headerClass="bg-opensimrs-50" />
            <Column header="No. Identitas" field="noIdentitas" headerClass="bg-opensimrs-50" />
            <Column header="Alasan" field="alasan" headerClass="bg-opensimrs-50" />
          </DataTable>
          <div v-else class="p-3 text-xs rounded bg-[#ECFDF3] text-[#027A48]">Semua baris valid berhasil didaftarkan. Order laboratorium & radiologi dibuat otomatis.</div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-between gap-2">
        <div>
          <CustomButton v-if="pratinjau && !hasil && pratinjau.ringkasan.galat" icon="PhFileXls" label="Unduh Baris Galat" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="unduhGalatPratinjau" />
          <CustomButton v-if="hasil?.gagal?.length" icon="PhFileXls" label="Unduh Baris Gagal" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="unduhGagalSimpan" />
        </div>
        <div class="flex gap-2">
          <CustomButton :label="hasil ? 'Tutup' : 'Batal'" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="visible = false" />
          <CustomButton v-if="!hasil" :label="`Daftarkan ${jumlahValid} Baris Valid`" :loading="menyimpan" :disabled="!jumlahValid || memuat" @click="simpan" />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
