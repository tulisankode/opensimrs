<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import {
  buatUlangKunciMasukLisMikro,
  daftarKoneksiLisMikro,
  hapusKoneksiLisMikro,
  izinMikro,
  jadikanBawaanLisMikro,
  simpanKoneksiLisMikro,
  ujiKoneksiLisMikro,
} from "@/stores/penunjang/mikrobiologi";
import { utilsStore } from "@/stores/utils";

// Koneksi LIS Mikrobiologi (fitur mikro_bridging_lis), terpisah dari koneksi LIS laboratorium klinik (lab_bridging_lis):
// konteks, kunci masuk, dan mapping tidak boleh tercampur. Satu faskes boleh punya lebih dari satu koneksi; satu bawaan.
const emit = defineEmits(["berubah"]);
const storeUtils = utilsStore();
const toast = useToast();
const boleh = (aksi: string) => izinMikro("Konfigurasi LIS Mikrobiologi", aksi);

const koneksi = ref<any[]>([]);
const dialogForm = ref(false);
const form = ref<any>({});
const kunciBaru = ref<{ nama: string; kunci: string } | null>(null);
const konfirmasiHapus = ref<any>(null);

// alamat penerima hasil push: host API penunjang + /adam-lis/mikrobiologi/bridging (dipasang sebelum basePath di server.js)
const alamatPenerima = (kunci: string) => {
  const dasar = String(import.meta.env.VITE_BASE_PENUNJANG || "");
  let origin = window.location.origin;
  try {
    origin = new URL(dasar, window.location.origin).origin;
  } catch {
    /* pakai origin halaman */
  }
  return `${origin}/adam-lis/mikrobiologi/bridging?key=${kunci}`;
};

const muat = async () => {
  const res = await daftarKoneksiLisMikro();
  koneksi.value = res?.payload ?? [];
};

const bukaForm = (k: any = null) => {
  form.value = k
    ? { uuid: k.uuid, nama: k.nama, kodeRs: k.kodeRs ?? "", urlRegistrasi: k.urlRegistrasi, urlHasil: k.urlHasil ?? "", apiKey: "", aktif: k.aktif, bawaan: k.bawaan, maksParalel: k.maksParalel ?? 2, jedaMs: k.jedaMs ?? 0 }
    : { uuid: null, nama: "LIS Mikrobiologi", kodeRs: "", urlRegistrasi: "http://", urlHasil: "", apiKey: "", aktif: true, bawaan: !koneksi.value.length, maksParalel: 2, jedaMs: 0 };
  dialogForm.value = true;
};

const simpan = async () => {
  storeUtils.setLoading(true);
  try {
    const f = form.value;
    const res = await simpanKoneksiLisMikro(f.uuid, {
      nama: f.nama, kode_rs: f.kodeRs || null, url_registrasi: f.urlRegistrasi, url_hasil: f.urlHasil || null, api_key: f.apiKey,
      aktif: f.aktif, bawaan: f.bawaan, maks_paralel: Number(f.maksParalel) || 2, jeda_ms: Number(f.jedaMs) || 0,
    });
    if (res?.gagal) return toast.add({ severity: "error", summary: "Gagal menyimpan koneksi LIS Mikrobiologi", detail: res.message, life: 6000 });
    dialogForm.value = false;
    toast.add({ severity: "success", summary: res?.message ?? "Koneksi LIS Mikrobiologi disimpan", life: 3000 });
    if (res?.payload?.kunciMasukBaru) kunciBaru.value = { nama: res.payload.nama, kunci: res.payload.kunciMasukBaru };
    await muat();
    emit("berubah");
  } finally {
    storeUtils.setLoading(false);
  }
};

const jadikanBawaan = async (k: any) => {
  const res = await jadikanBawaanLisMikro(k.uuid);
  if (res?.gagal) return toast.add({ severity: "error", summary: "Gagal", detail: res.message, life: 5000 });
  await muat();
};

const kunciMasukBaru = async (k: any) => {
  const res = await buatUlangKunciMasukLisMikro(k.uuid);
  if (res?.gagal) return toast.add({ severity: "error", summary: "Gagal", detail: res.message, life: 5000 });
  kunciBaru.value = { nama: k.nama, kunci: res.payload.kunciMasukBaru };
  await muat();
};

const hapus = async () => {
  const k = konfirmasiHapus.value;
  konfirmasiHapus.value = null;
  const res = await hapusKoneksiLisMikro(k.uuid);
  if (res?.gagal) return toast.add({ severity: "error", summary: "Gagal menghapus", detail: res.message, life: 5000 });
  toast.add({ severity: "success", summary: "Koneksi LIS Mikrobiologi dihapus", life: 3000 });
  await muat();
  emit("berubah");
};

const uji = async (k: any) => {
  storeUtils.setLoading(true);
  try {
    const res = await ujiKoneksiLisMikro(k.uuid);
    const hasil = res?.payload;
    toast.add({ severity: hasil?.berhasil ? "success" : "error", summary: `Uji koneksi ${k.nama}`, detail: hasil?.pesan, life: 6000 });
  } finally {
    storeUtils.setLoading(false);
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
</script>

<template>
  <GreenCard cardHeading="Konfigurasi LIS Mikrobiologi" hrEnableCustomClass :showButton="boleh('KELOLA')" labelButton="Tambah Koneksi" :buttonClickHandler="() => bukaForm()">
    <div class="flex flex-col gap-3 pl-2 text-base">
      <div class="text-sm text-grey-400">
        Order mikrobiologi dikirim saat petugas memilih <b>Validasi &amp; Kirim ke LIS Mikrobiologi</b>. LIS mengirim hasil (laporan sementara, isolat, kepekaan antibiotik)
        kembali ke alamat penerima masing-masing koneksi. Konteks dan kunci masuk terpisah dari LIS laboratorium klinik.
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
        <Column header="Paralel / Jeda" headerClass="bg-opensimrs-50">
          <template #body="{ data }">{{ data.maksParalel }} paralel · {{ data.jedaMs }} ms</template>
        </Column>
        <Column header="API Key" field="apiKey" headerClass="bg-opensimrs-50" />
        <Column header="Kunci Masuk" field="kunciMasuk" headerClass="bg-opensimrs-50" />
        <Column header="" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <div v-if="boleh('KELOLA')" class="flex flex-wrap gap-2">
              <CustomButton label="Edit" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaForm(data)" />
              <CustomButton label="Uji Koneksi" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="uji(data)" />
              <CustomButton v-if="!data.bawaan" label="Jadikan Bawaan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="jadikanBawaan(data)" />
              <CustomButton label="Kunci Masuk Baru" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="kunciMasukBaru(data)" />
              <CustomButton label="Hapus" outlined borderColor="border-[#B42318]" textColor="text-[#B42318]" @click="konfirmasiHapus = data" />
            </div>
          </template>
        </Column>
        <template #empty><div class="py-3 text-center text-grey-400">Belum ada koneksi LIS Mikrobiologi.</div></template>
      </DataTable>
    </div>
  </GreenCard>

  <Dialog v-model:visible="dialogForm" modal :header="form.uuid ? 'Ubah Koneksi LIS Mikrobiologi' : 'Tambah Koneksi LIS Mikrobiologi'" :style="{ width: '620px' }">
    <div class="grid grid-cols-2 gap-3">
      <CustomTextfield v-model="form.nama" label="Nama" placeholder="mis. LIS Mikro Tiruan" />
      <CustomTextfield v-model="form.kodeRs" label="Kode RS di LIS" placeholder="mis. RS02" />
      <CustomTextfield v-model="form.urlRegistrasi" class="col-span-2" label="URL Registrasi" placeholder="http://alamat-lis-mikro:2612/registrasi" />
      <CustomTextfield v-model="form.urlHasil" class="col-span-2" label="URL Ambil Hasil (GET)" placeholder="http://alamat-lis-mikro:2612/hasil?no_registrasi={no_registrasi}" />
      <div class="col-span-2 -mt-2 text-xs text-grey-400">Opsional. Dipakai tombol "Ambil Hasil LIS". {no_registrasi} diganti nomor order mikrobiologi; tanpa placeholder, ditambah ?no_registrasi=&lt;nomor order&gt;.</div>
      <CustomTextfield v-model="form.apiKey" class="col-span-2" label="API Key (x-api-key)" type="password" :placeholder="form.uuid ? 'kosongkan bila tidak diubah' : 'API key dari LIS'" />
      <CustomTextfield v-model="form.maksParalel" label="Maks. request paralel (1–10)" type="number" />
      <CustomTextfield v-model="form.jedaMs" label="Jeda antar-request (ms)" type="number" />
      <CustomSwitch v-model="form.aktif" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
      <CustomSwitch v-model="form.bawaan" label="Koneksi Bawaan" sideLabel="Tidak" sideLabelTrue="Ya" />
    </div>
    <template #footer>
      <CustomButton label="Batal" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent" borderColor="border-2 border-[#9DA4B1]" @click="dialogForm = false" />
      <CustomButton label="Simpan" @click="simpan" />
    </template>
  </Dialog>

  <Dialog :visible="!!kunciBaru" modal header="Alamat Penerima Hasil LIS Mikrobiologi" :style="{ width: '640px' }" @update:visible="kunciBaru = null">
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

  <Dialog :visible="!!konfirmasiHapus" modal header="Hapus Koneksi LIS Mikrobiologi" :style="{ width: '440px' }" @update:visible="konfirmasiHapus = null">
    <div class="text-sm">Koneksi <b>{{ konfirmasiHapus?.nama }}</b> dihapus. LIS tidak dapat lagi mengirim hasil dengan kunci lamanya.</div>
    <template #footer>
      <CustomButton label="Batal" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent" borderColor="border-2 border-[#9DA4B1]" @click="konfirmasiHapus = null" />
      <CustomButton label="Hapus" backgroundColor="bg-[#B42318]" @click="hapus" />
    </template>
  </Dialog>
</template>
