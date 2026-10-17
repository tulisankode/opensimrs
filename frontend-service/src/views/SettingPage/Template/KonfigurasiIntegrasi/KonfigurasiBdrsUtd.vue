<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { utilsStore } from "@/stores/utils";
import { daftarKoneksiUtd, hapusKoneksiUtd, jadikanBawaanKoneksiUtd, buatKunciMasukUtd, simpanKoneksiUtd, ujiKoneksiUtd } from "@/stores/penunjang/bankDarah";

// Koneksi UTD eksternal untuk Bridging Bank Darah (STD-0017, fitur bdrs_bridging). Satu faskes boleh punya lebih
// dari satu koneksi; satu ditandai bawaan. API key keluar & kunci masuk disimpan terenkripsi oleh penunjang-service;
// kunci masuk tampil utuh sekali saja — pola sama dengan Konfigurasi PACS.
const emit = defineEmits(["berubah"]);
const storeUtils = utilsStore();
const toast = useToast();

const koneksi = ref<any[]>([]);
const layananTersedia = ref(true);
const dialogForm = ref(false);
const form = ref<any>({});
const kunciBaru = ref<{ nama: string; kunci: string } | null>(null);
const konfirmasiHapus = ref<any>(null);
const mengujiUuid = ref<string | null>(null);

// Alamat penerima hasil push dari UTD: host penunjang-service + /adam-utd/bridging?key=...
const alamatPenerima = (kunci: string) => {
  const dasar = String(import.meta.env.VITE_BASE_PENUNJANG || "");
  let origin = window.location.origin;
  try {
    origin = new URL(dasar, window.location.origin).origin;
  } catch {
    /* pakai origin halaman */
  }
  return `${origin}/adam-utd/bridging?key=${kunci}`;
};

const muat = async () => {
  const res = await daftarKoneksiUtd();
  layananTersedia.value = !!res && !res.gagal;
  koneksi.value = res?.payload ?? [];
};

const bukaForm = (k: any = null) => {
  form.value = k
    ? { uuid: k.uuid, nama: k.nama, kodeRs: k.kodeRs ?? "", urlRegistrasi: k.urlRegistrasi, urlStatus: k.urlStatus ?? "", urlStok: k.urlStok ?? "", apiKey: "", aktif: k.aktif, bawaan: k.bawaan, maksParalel: k.maksParalel ?? 2, jedaMs: k.jedaMs ?? 0 }
    : { uuid: null, nama: "UTD", kodeRs: "", urlRegistrasi: "http://", urlStatus: "", urlStok: "", apiKey: "", aktif: true, bawaan: !koneksi.value.length, maksParalel: 2, jedaMs: 0 };
  dialogForm.value = true;
};

const simpan = async () => {
  storeUtils.setLoading(true);
  try {
    const f = form.value;
    const res = await simpanKoneksiUtd(
      {
        nama: f.nama, kodeRs: f.kodeRs, urlRegistrasi: f.urlRegistrasi, urlStatus: f.urlStatus || undefined, urlStok: f.urlStok || undefined,
        apiKey: f.apiKey, aktif: f.aktif, bawaan: f.bawaan, maksParalel: Number(f.maksParalel) || 2, jedaMs: Number(f.jedaMs) || 0,
      },
      f.uuid,
    );
    if (!res?.payload) return;
    dialogForm.value = false;
    toast.add({ severity: "success", summary: res?.message ?? "Koneksi UTD disimpan", life: 3000 });
    if (res.payload.kunciMasukBaru) kunciBaru.value = { nama: res.payload.nama, kunci: res.payload.kunciMasukBaru };
    await muat();
    emit("berubah");
  } finally {
    storeUtils.setLoading(false);
  }
};

const jadikanBawaan = async (k: any) => {
  const res = await jadikanBawaanKoneksiUtd(k.uuid);
  if (!res?.payload) return;
  await muat();
};

const kunciMasukBaru = async (k: any) => {
  const res = await buatKunciMasukUtd(k.uuid);
  if (!res?.payload) return;
  kunciBaru.value = { nama: k.nama, kunci: res.payload.kunciMasukBaru };
  await muat();
};

const hapus = async () => {
  const k = konfirmasiHapus.value;
  konfirmasiHapus.value = null;
  const res = await hapusKoneksiUtd(k.uuid);
  if (!res?.payload) return;
  toast.add({ severity: "success", summary: "Koneksi UTD dihapus", life: 3000 });
  await muat();
  emit("berubah");
};

const ujiKoneksi = async (k: any) => {
  mengujiUuid.value = k.uuid;
  try {
    const res = await ujiKoneksiUtd(k.uuid);
    const hasil = res?.payload;
    toast.add({ severity: hasil?.berhasil ? "success" : "error", summary: `Uji koneksi ${k.nama}`, detail: hasil?.pesan, life: 6000 });
  } finally {
    mengujiUuid.value = null;
  }
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
defineExpose({ muat });
</script>

<template>
  <GreenCard cardHeading="Konfigurasi Bank Darah/UTD" hrEnableCustomClass :showButton="layananTersedia" labelButton="Tambah UTD" :buttonClickHandler="() => bukaForm()">
    <div class="flex flex-col gap-3 pl-2 text-base">
      <div v-if="!layananTersedia" class="p-3 text-sm rounded-md bg-[#FDE2E1] text-[#B42318]">Layanan penunjang (Bank Darah RS) tidak dapat dihubungi.</div>
      <template v-else>
        <div class="text-sm text-grey-400">
          Permintaan darah dikirim ke UTD saat petugas memilih <b>Proses & Kirim ke UTD</b> di halaman Permintaan Darah. UTD mengirim status, data kantong, dan hasil IMLTD kembali ke alamat penerima masing-masing koneksi.
          Kantong tetap melalui penerimaan berizin sebelum masuk stok (tidak ada penerimaan otomatis).
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
          <Column header="URL Kirim Permintaan" field="urlRegistrasi" headerClass="bg-opensimrs-50" />
          <Column header="Kode RS" field="kodeRs" headerClass="bg-opensimrs-50" />
          <Column header="API Key" field="apiKey" headerClass="bg-opensimrs-50" />
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="flex flex-wrap gap-2">
                <CustomButton label="Edit" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaForm(data)" />
                <CustomButton :label="mengujiUuid === data.uuid ? 'Menguji…' : 'Uji Koneksi'" :disabled="mengujiUuid === data.uuid" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="ujiKoneksi(data)" />
                <CustomButton v-if="!data.bawaan" label="Jadikan Bawaan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="jadikanBawaan(data)" />
                <CustomButton label="Kunci Masuk Baru" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="kunciMasukBaru(data)" />
                <CustomButton label="Hapus" outlined borderColor="border-[#B42318]" textColor="text-[#B42318]" @click="konfirmasiHapus = data" />
              </div>
            </template>
          </Column>
          <template #empty><div class="py-3 text-center text-grey-400">Belum ada koneksi UTD.</div></template>
        </DataTable>
      </template>
    </div>
  </GreenCard>

  <Dialog v-model:visible="dialogForm" modal :header="form.uuid ? 'Ubah Koneksi UTD' : 'Tambah Koneksi UTD'" :style="{ width: '620px' }">
    <div class="grid grid-cols-2 gap-3">
      <CustomTextfield v-model="form.nama" label="Nama" placeholder="mis. UTD PMI Provinsi" />
      <CustomTextfield v-model="form.kodeRs" label="Kode RS di UTD" placeholder="mis. RS02" />
      <CustomTextfield v-model="form.urlRegistrasi" class="col-span-2" label="URL Kirim Permintaan" placeholder="http://alamat-utd:2413/adam-utd/permintaan" />
      <CustomTextfield v-model="form.urlStatus" class="col-span-2" label="URL Status (GET, templat {no_registrasi})" placeholder="http://alamat-utd:2413/adam-utd/status/{no_registrasi}" />
      <div class="col-span-2 -mt-2 text-xs text-grey-400">Dipakai "Ambil Status UTD" & "Cek Status". Tanpa placeholder, ditambah ?no_registrasi=&lt;nomor&gt;.</div>
      <CustomTextfield v-model="form.urlStok" class="col-span-2" label="URL Cek Stok (opsional)" placeholder="http://alamat-utd:2413/adam-utd/stok" />
      <CustomTextfield v-model="form.apiKey" class="col-span-2" label="API Key (x-api-key)" type="password" :placeholder="form.uuid ? 'kosongkan bila tidak diubah' : 'API key dari UTD'" />
      <CustomTextfield v-model="form.maksParalel" label="Maks. request paralel (1–10)" type="number" />
      <CustomTextfield v-model="form.jedaMs" label="Jeda antar-request (ms)" type="number" />
      <div class="col-span-2 -mt-2 text-xs text-grey-400">
        Satu permintaan tidak pernah dikirim dua kali dengan nomor registrasi baru; pengiriman tanpa respons pasti (waktu habis) ditandai "tidak pasti" dan perlu Cek Status sebelum dikirim ulang.
      </div>
      <CustomSwitch v-model="form.aktif" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
      <CustomSwitch v-model="form.bawaan" label="UTD Bawaan" sideLabel="Tidak" sideLabelTrue="Ya" />
    </div>
    <template #footer>
      <CustomButton label="Batal" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent" borderColor="border-2 border-[#9DA4B1]" @click="dialogForm = false" />
      <CustomButton label="Simpan" @click="simpan" />
    </template>
  </Dialog>

  <Dialog :visible="!!kunciBaru" modal header="Alamat Penerima Hasil UTD" :style="{ width: '640px' }" @update:visible="kunciBaru = null">
    <div v-if="kunciBaru" class="flex flex-col gap-3 text-sm">
      <div>Pasang alamat berikut di <b>{{ kunciBaru.nama }}</b> sebagai URL pengembalian hasil (metode POST, JSON).</div>
      <div class="p-3 font-mono break-all rounded-md bg-opensimrs-50">{{ alamatPenerima(kunciBaru.kunci) }}</div>
      <div class="p-3 rounded-md bg-[#FEF0C7] text-[#B54708]">
        Kunci ini hanya ditampilkan sekali. Bila UTD memakai header, kirim kunci sebagai <code>x-api-key</code>: <span class="font-mono">{{ kunciBaru.kunci }}</span>
      </div>
    </div>
    <template #footer>
      <CustomButton label="Salin Alamat" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="salin(alamatPenerima(kunciBaru!.kunci))" />
      <CustomButton label="Selesai" @click="kunciBaru = null" />
    </template>
  </Dialog>

  <Dialog :visible="!!konfirmasiHapus" modal header="Hapus Koneksi UTD" :style="{ width: '440px' }" @update:visible="konfirmasiHapus = null">
    <div class="text-sm">Koneksi <b>{{ konfirmasiHapus?.nama }}</b> dihapus. UTD tidak dapat lagi mengirim hasil dengan kunci lamanya.</div>
    <template #footer>
      <CustomButton label="Batal" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent" borderColor="border-2 border-[#9DA4B1]" @click="konfirmasiHapus = null" />
      <CustomButton label="Hapus" backgroundColor="bg-[#B42318]" @click="hapus" />
    </template>
  </Dialog>
</template>
