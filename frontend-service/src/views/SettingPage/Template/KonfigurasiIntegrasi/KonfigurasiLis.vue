<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { useLisStore } from "@/stores/Laboratorium/lis";
import { utilsStore } from "@/stores/utils";

// Koneksi LIS (adamLIS) laboratorium. Satu faskes boleh punya lebih dari satu LIS; satu ditandai bawaan.
// API key keluar & kunci masuk disimpan terenkripsi oleh lab-service; kunci masuk tampil utuh sekali saja.
const emit = defineEmits(["berubah"]);
const store = useLisStore();
const storeUtils = utilsStore();
const toast = useToast();

const koneksi = ref<any[]>([]);
const layananTersedia = ref(true);
const dialogForm = ref(false);
const form = ref<any>({});
const kunciBaru = ref<{ nama: string; kunci: string } | null>(null);
const konfirmasiHapus = ref<any>(null);

// alamat penerima hasil: host API laboratorium + /adam-lis/bridging (diteruskan gateway ke lab-service)
const alamatPenerima = (kunci: string) => {
  const dasar = String(import.meta.env.VITE_BASE_LABORATORIUM || "");
  let origin = window.location.origin;
  try {
    origin = new URL(dasar, window.location.origin).origin;
  } catch {
    /* pakai origin halaman */
  }
  return `${origin}/adam-lis/bridging?key=${kunci}`;
};

const muat = async () => {
  const res = await store.getKoneksi();
  layananTersedia.value = !!res && !res.gagal;
  koneksi.value = res?.payload ?? [];
};

const bukaForm = (k: any = null) => {
  form.value = k
    ? { uuid: k.uuid, nama: k.nama, urlRegistrasi: k.urlRegistrasi, urlHasil: k.urlHasil ?? "", apiKey: "", kodeRs: k.kodeRs ?? "", aktif: k.aktif, bawaan: k.bawaan,
        modeKirim: k.modeKirim ?? "per_order", urlRegistrasiBulk: k.urlRegistrasiBulk ?? "", kodeLab: k.kodeLab ?? "", ukuranBatch: k.ukuranBatch ?? 100,
        jedaMs: k.jedaMs ?? 0, maksParalel: k.maksParalel ?? 2 }
    : { uuid: null, nama: "adamLIS", urlRegistrasi: "http://", urlHasil: "", apiKey: "", kodeRs: "", aktif: true, bawaan: !koneksi.value.length,
        modeKirim: "per_order", urlRegistrasiBulk: "", kodeLab: "", ukuranBatch: 100, jedaMs: 0, maksParalel: 2 };
  dialogForm.value = true;
};

const simpan = async () => {
  storeUtils.setLoading(true);
  try {
    const f = form.value;
    const res = await store.simpanKoneksi(f.uuid, {
      nama: f.nama, url_registrasi: f.urlRegistrasi, url_hasil: f.urlHasil || null, api_key: f.apiKey, kode_rs: f.kodeRs, aktif: f.aktif, bawaan: f.bawaan,
      mode_kirim: f.modeKirim, url_registrasi_bulk: f.urlRegistrasiBulk || null, kode_lab: f.kodeLab || null,
      ukuran_batch: Number(f.ukuranBatch) || 100, jeda_ms: Number(f.jedaMs) || 0, maks_paralel: Number(f.maksParalel) || 2,
    });
    if (res?.gagal) return toast.add({ severity: "error", summary: "Gagal menyimpan koneksi LIS", detail: res.message, life: 6000 });
    dialogForm.value = false;
    toast.add({ severity: "success", summary: res?.message ?? "Koneksi LIS disimpan", life: 3000 });
    if (res?.payload?.kunciMasukBaru) kunciBaru.value = { nama: res.payload.nama, kunci: res.payload.kunciMasukBaru };
    await muat();
    emit("berubah");
  } finally {
    storeUtils.setLoading(false);
  }
};

const jadikanBawaan = async (k: any) => {
  const res = await store.jadikanBawaan(k.uuid);
  if (res?.gagal) return toast.add({ severity: "error", summary: "Gagal", detail: res.message, life: 5000 });
  await muat();
};

const kunciMasukBaru = async (k: any) => {
  const res = await store.buatUlangKunciMasuk(k.uuid);
  if (res?.gagal) return toast.add({ severity: "error", summary: "Gagal", detail: res.message, life: 5000 });
  kunciBaru.value = { nama: k.nama, kunci: res.payload.kunciMasukBaru };
  await muat();
};

const hapus = async () => {
  const k = konfirmasiHapus.value;
  konfirmasiHapus.value = null;
  const res = await store.hapusKoneksi(k.uuid);
  if (res?.gagal) return toast.add({ severity: "error", summary: "Gagal menghapus", detail: res.message, life: 5000 });
  toast.add({ severity: "success", summary: "Koneksi LIS dihapus", life: 3000 });
  await muat();
  emit("berubah");
};

const salin = async (teks: string) => {
  try {
    await navigator.clipboard.writeText(teks);
    toast.add({ severity: "success", summary: "Disalin", life: 2000 });
  } catch {
    toast.add({ severity: "warn", summary: "Salin manual", detail: "Peramban tidak mengizinkan salin otomatis", life: 3000 });
  }
};

onMounted(muat);
</script>

<template>
  <GreenCard cardHeading="Konfigurasi LIS (Laboratorium)" hrEnableCustomClass :showButton="layananTersedia" labelButton="Tambah LIS" :buttonClickHandler="() => bukaForm()">
    <div class="flex flex-col gap-3 pl-2 text-base">
      <div v-if="!layananTersedia" class="p-3 text-sm rounded-md bg-[#FDE2E1] text-[#B42318]">Layanan laboratorium tidak dapat dihubungi.</div>
      <template v-else>
        <div class="text-sm text-grey-400">
          Order lab dikirim ke LIS saat petugas memilih <b>Validasi &amp; Kirim ke LIS</b>, atau massal dari <b>MCU › Peserta</b> (Kirim ke LIS). LIS mengirim hasil kembali ke alamat penerima masing-masing koneksi.
        </div>
        <DataTable :value="koneksi" stripedRows class="text-xs">
          <Column header="Nama" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="font-semibold">{{ data.nama }}</div>
              <div class="flex gap-1 mt-1">
                <CustomChip v-if="data.bawaan" label="Bawaan" :show-checked-icon="false" bg-color="bg-opensimrs-50" border-color="border-transparent" text-color="text-opensimrs-300" />
                <CustomChip :label="data.aktif ? 'Aktif' : 'Nonaktif'" :show-checked-icon="false" :bg-color="data.aktif ? 'bg-[#D1FADF]' : 'bg-[#D4D8DC]'" border-color="border-transparent" :text-color="data.aktif ? 'text-[#027A48]' : 'text-[#687077]'" />
              </div>
            </template>
          </Column>
          <Column header="URL Registrasi" field="urlRegistrasi" headerClass="bg-opensimrs-50" />
          <Column header="Kode RS" field="kodeRs" headerClass="bg-opensimrs-50" />
          <Column header="Kirim Massal (MCU)" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div>{{ data.modeKirim === "bulk" ? `Bulk · ${data.ukuranBatch}/request` : `Per order · ${data.maksParalel} paralel` }}</div>
              <div v-if="data.modeKirim === 'bulk'" class="text-grey-400">Kode Lab {{ data.kodeLab ?? "-" }}</div>
            </template>
          </Column>
          <Column header="API Key" field="apiKey" headerClass="bg-opensimrs-50" />
          <Column header="Kunci Masuk" field="kunciMasuk" headerClass="bg-opensimrs-50" />
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="flex flex-wrap gap-2">
                <CustomButton label="Edit" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaForm(data)" />
                <CustomButton v-if="!data.bawaan" label="Jadikan Bawaan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="jadikanBawaan(data)" />
                <CustomButton label="Kunci Masuk Baru" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="kunciMasukBaru(data)" />
                <CustomButton label="Hapus" outlined borderColor="border-[#B42318]" textColor="text-[#B42318]" @click="konfirmasiHapus = data" />
              </div>
            </template>
          </Column>
          <template #empty><div class="py-3 text-center text-grey-400">Belum ada koneksi LIS.</div></template>
        </DataTable>
      </template>
    </div>
  </GreenCard>

  <Dialog v-model:visible="dialogForm" modal :header="form.uuid ? 'Ubah Koneksi LIS' : 'Tambah Koneksi LIS'" :style="{ width: '620px' }">
    <div class="grid grid-cols-2 gap-3">
      <CustomTextfield v-model="form.nama" label="Nama" placeholder="mis. adamLIS Lab Utama" />
      <CustomTextfield v-model="form.kodeRs" label="Kode RS di LIS" placeholder="mis. RS02" />
      <CustomTextfield v-model="form.urlRegistrasi" class="col-span-2" label="URL Registrasi" placeholder="http://alamat-lis:2311/adam-lis/bridging_sim_rs/registrasi" />
      <CustomTextfield v-model="form.urlHasil" class="col-span-2" label="URL Ambil Hasil (GET)" placeholder="http://alamat-lis:3001/api/v1/arsip/bridging/read?no_reg_rs={no_registrasi}" />
      <div class="col-span-2 -mt-2 text-xs text-grey-400">Opsional. Dipakai tombol "Ambil Hasil LIS"; {no_registrasi} = nomor order SIMRS, {no_lab} = No. Lab LIS. Tanpa placeholder, ditambah ?no_reg_rs=&lt;nomor order&gt;.</div>
      <CustomTextfield v-model="form.apiKey" class="col-span-2" label="API Key (x-api-key)" type="password" :placeholder="form.uuid ? 'kosongkan bila tidak diubah' : 'API key dari LIS'" />
      <div class="col-span-2 pt-2 mt-1 text-sm font-semibold border-t border-grey-100">Kirim massal (peserta MCU)</div>
      <label class="flex flex-col gap-1 text-sm">Mode kirim
        <Select v-model="form.modeKirim" :options="[{ v: 'per_order', l: 'Per order (satu request per peserta)' }, { v: 'bulk', l: 'Bulk (banyak peserta per request)' }]" optionLabel="l" optionValue="v" data-uji="mode-kirim" />
      </label>
      <CustomTextfield v-if="form.modeKirim === 'per_order'" v-model="form.maksParalel" label="Maks. request paralel (1–10)" type="number" />
      <template v-else>
        <CustomTextfield v-model="form.kodeLab" label="Kode Lab di adamLIS (kode_lab)" placeholder="mis. LAB_EP" />
        <CustomTextfield v-model="form.urlRegistrasiBulk" class="col-span-2" label="URL Registrasi Bulk" placeholder="http://alamat-lis/adam-lis/api/v1/registrasi_bulk_mcu/create" />
        <div class="col-span-2 -mt-2 text-xs text-grey-400">?kode_rs=&amp;kode_lab= ditambahkan otomatis dari Kode RS & Kode Lab. Boleh menunjuk gateway bridging MCU atau LIS langsung.</div>
        <CustomTextfield v-model="form.ukuranBatch" label="Peserta per request (maks. 149)" type="number" />
      </template>
      <CustomTextfield v-model="form.jedaMs" label="Jeda antar-request (ms)" type="number" />
      <div class="col-span-2 -mt-2 text-xs text-grey-400">
        Dipakai MCU › Peserta › Kirim ke LIS. Satu order tidak pernah dikirim dua kali; request tanpa respons (waktu habis) ditandai "tidak pasti" dan perlu Cek Status (memakai URL Ambil Hasil) sebelum dikirim ulang.
      </div>
      <CustomSwitch v-model="form.aktif" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
      <CustomSwitch v-model="form.bawaan" label="LIS Bawaan" sideLabel="Tidak" sideLabelTrue="Ya" />
    </div>
    <template #footer>
      <CustomButton label="Batal" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent" borderColor="border-2 border-[#9DA4B1]" @click="dialogForm = false" />
      <CustomButton label="Simpan" @click="simpan" />
    </template>
  </Dialog>

  <Dialog :visible="!!kunciBaru" modal header="Alamat Penerima Hasil LIS" :style="{ width: '640px' }" @update:visible="kunciBaru = null">
    <div v-if="kunciBaru" class="flex flex-col gap-3 text-sm">
      <div>Pasang alamat berikut di <b>{{ kunciBaru.nama }}</b> sebagai URL pengembalian hasil (metode POST, JSON).</div>
      <div class="p-3 font-mono break-all rounded-md bg-opensimrs-50">{{ alamatPenerima(kunciBaru.kunci) }}</div>
      <div class="p-3 rounded-md bg-[#FEF0C7] text-[#B54708]">
        Kunci ini hanya ditampilkan sekali. Bila LIS memakai header, kirim kunci sebagai <code>x-api-key</code>: <span class="font-mono">{{ kunciBaru.kunci }}</span>
      </div>
    </div>
    <template #footer>
      <CustomButton label="Salin Alamat" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="salin(alamatPenerima(kunciBaru!.kunci))" />
      <CustomButton label="Selesai" @click="kunciBaru = null" />
    </template>
  </Dialog>

  <Dialog :visible="!!konfirmasiHapus" modal header="Hapus Koneksi LIS" :style="{ width: '440px' }" @update:visible="konfirmasiHapus = null">
    <div class="text-sm">Koneksi <b>{{ konfirmasiHapus?.nama }}</b> dihapus. LIS tidak dapat lagi mengirim hasil dengan kunci lamanya.</div>
    <template #footer>
      <CustomButton label="Batal" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent" borderColor="border-2 border-[#9DA4B1]" @click="konfirmasiHapus = null" />
      <CustomButton label="Hapus" backgroundColor="bg-[#B42318]" @click="hapus" />
    </template>
  </Dialog>
</template>
