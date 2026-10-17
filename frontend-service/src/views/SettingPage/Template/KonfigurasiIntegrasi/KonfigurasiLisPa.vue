<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { utilsStore } from "@/stores/utils";
import {
  daftarKoneksiLisPa, simpanKoneksiLisPa, jadikanBawaanLisPa, kunciMasukBaruLisPa, ujiKoneksiLisPa, hapusKoneksiLisPa,
} from "@/stores/penunjang/patologi";

// Koneksi LIS Patologi Anatomi (sistem PA internal/rujukan). Satu faskes boleh punya lebih dari satu koneksi;
// satu ditandai bawaan. API key keluar & kunci masuk disimpan terenkripsi oleh penunjang-service; kunci masuk
// tampil utuh sekali saja.
const emit = defineEmits(["berubah"]);
const storeUtils = utilsStore();
const toast = useToast();

const koneksi = ref<any[]>([]);
const layananTersedia = ref(true);
const dialogForm = ref(false);
const form = ref<any>({});
const kunciBaru = ref<{ nama: string; kunci: string } | null>(null);
const konfirmasiHapus = ref<any>(null);
const galatUji = ref<Record<string, string>>({});

// alamat penerima hasil: host API penunjang + /adam-pa-lis/bridging (diteruskan gateway ke penunjang-service)
const alamatPenerima = (kunci: string) => {
  const dasar = String(import.meta.env.VITE_BASE_PENUNJANG || "");
  let origin = window.location.origin;
  try {
    origin = new URL(dasar, window.location.origin).origin;
  } catch {
    /* pakai origin halaman */
  }
  return `${origin}/adam-pa-lis/bridging?key=${kunci}`;
};

const muat = async () => {
  const res = await daftarKoneksiLisPa();
  layananTersedia.value = !!res;
  koneksi.value = res?.payload ?? [];
};

const bukaForm = (k: any = null) => {
  form.value = k
    ? { uuid: k.uuid, nama: k.nama, kodeRs: k.kodeRs ?? "", urlRegistrasi: k.urlRegistrasi, urlHasil: k.urlHasil ?? "", urlLaporan: k.urlLaporan ?? "", apiKey: "", aktif: k.aktif, bawaan: k.bawaan, maksParalel: k.maksParalel ?? 2, jedaMs: k.jedaMs ?? 0 }
    : { uuid: null, nama: "Sistem PA", kodeRs: "", urlRegistrasi: "http://", urlHasil: "", urlLaporan: "", apiKey: "", aktif: true, bawaan: !koneksi.value.length, maksParalel: 2, jedaMs: 0 };
  dialogForm.value = true;
};

// apiPenunjangPost/Put/Delete sudah menampilkan toast sukses otomatis (pesan dari server) & toast galat otomatis
// bila gagal (lihat utils/apiHandler.ts) — di sini cukup periksa `if (!res) return` tanpa toast tambahan.
const simpan = async () => {
  storeUtils.setLoading(true);
  try {
    const f = form.value;
    const res = await simpanKoneksiLisPa(f.uuid, {
      nama: f.nama, kodeRs: f.kodeRs, urlRegistrasi: f.urlRegistrasi, urlHasil: f.urlHasil || null, urlLaporan: f.urlLaporan || null,
      apiKey: f.apiKey, aktif: f.aktif, bawaan: f.bawaan, maksParalel: Number(f.maksParalel) || 2, jedaMs: Number(f.jedaMs) || 0,
    });
    if (!res) return;
    dialogForm.value = false;
    if (res?.payload?.kunciMasukBaru) kunciBaru.value = { nama: res.payload.nama, kunci: res.payload.kunciMasukBaru };
    await muat();
    emit("berubah");
  } finally {
    storeUtils.setLoading(false);
  }
};

const jadikanBawaan = async (k: any) => {
  const res = await jadikanBawaanLisPa(k.uuid);
  if (!res) return;
  await muat();
};

const kunciMasukBaru = async (k: any) => {
  const res = await kunciMasukBaruLisPa(k.uuid);
  if (!res) return;
  kunciBaru.value = { nama: k.nama, kunci: res.payload.kunciMasukBaru };
  await muat();
};

const ujiKoneksi = async (k: any) => {
  const res = await ujiKoneksiLisPa(k.uuid);
  const payload = res?.payload ?? {};
  galatUji.value = { ...galatUji.value, [k.uuid]: payload.terhubung ? "" : payload.pesan };
  toast.add({ severity: payload.terhubung ? "success" : "error", summary: payload.terhubung ? "Koneksi berhasil diuji" : "Uji koneksi gagal", detail: payload.pesan, life: 5000 });
};

const hapus = async () => {
  const k = konfirmasiHapus.value;
  konfirmasiHapus.value = null;
  const res = await hapusKoneksiLisPa(k.uuid);
  if (!res) return;
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
  <GreenCard cardHeading="Konfigurasi LIS PA (Patologi Anatomi)" hrEnableCustomClass :showButton="layananTersedia" labelButton="Tambah Koneksi" :buttonClickHandler="() => bukaForm()">
    <div class="flex flex-col gap-3 pl-2 text-base">
      <div v-if="!layananTersedia" class="p-3 text-sm rounded-md bg-[#FDE2E1] text-[#B42318]">Layanan Patologi Anatomi tidak dapat dihubungi.</div>
      <template v-else>
        <div class="text-sm text-grey-400">
          Kasus PA dikirim ke sistem PA tujuan saat petugas memilih <b>Validasi &amp; Kirim ke LIS PA</b> pada Order PA. Sistem PA mengirim hasil kembali ke alamat penerima masing-masing koneksi.
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
          <Column header="API Key" field="apiKey" headerClass="bg-opensimrs-50" />
          <Column header="Kunci Masuk" field="kunciMasuk" headerClass="bg-opensimrs-50" />
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="flex flex-wrap gap-2">
                <CustomButton label="Edit" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaForm(data)" />
                <CustomButton v-if="!data.bawaan" label="Jadikan Bawaan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="jadikanBawaan(data)" />
                <CustomButton label="Uji Koneksi" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="ujiKoneksi(data)" />
                <CustomButton label="Kunci Masuk Baru" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="kunciMasukBaru(data)" />
                <CustomButton label="Hapus" outlined borderColor="border-[#B42318]" textColor="text-[#B42318]" @click="konfirmasiHapus = data" />
              </div>
              <div v-if="galatUji[data.uuid]" class="mt-1 text-[#B42318]">{{ galatUji[data.uuid] }}</div>
            </template>
          </Column>
          <template #empty><div class="py-3 text-center text-grey-400">Belum ada koneksi LIS PA.</div></template>
        </DataTable>
      </template>
    </div>
  </GreenCard>

  <Dialog v-model:visible="dialogForm" modal :header="form.uuid ? 'Ubah Koneksi LIS PA' : 'Tambah Koneksi LIS PA'" :style="{ width: '620px' }">
    <div class="grid grid-cols-2 gap-3">
      <CustomTextfield v-model="form.nama" label="Nama" placeholder="mis. Sistem PA Internal / Lab PA Rujukan" />
      <CustomTextfield v-model="form.kodeRs" label="Kode RS di sistem PA" placeholder="mis. RSPA01" />
      <CustomTextfield v-model="form.urlRegistrasi" class="col-span-2" label="URL Registrasi" placeholder="http://alamat-lis-pa:2313/adam-pa-lis/registrasi" />
      <CustomTextfield v-model="form.urlHasil" class="col-span-2" label="URL Ambil Hasil (GET)" placeholder="http://alamat-lis-pa:2313/adam-pa-lis/hasil?no_registrasi={no_registrasi}" />
      <div class="col-span-2 -mt-2 text-xs text-grey-400">Opsional. Dipakai tombol "Ambil Hasil LIS PA" & Cek Status; {no_registrasi}/{no_pa} diganti otomatis. Tanpa placeholder, ditambah ?no_registrasi=&lt;nomor&gt;.</div>
      <CustomTextfield v-model="form.urlLaporan" class="col-span-2" label="URL Laporan/Viewer Slide (opsional)" placeholder="http://alamat-lis-pa/laporan/{no_pa}" />
      <CustomTextfield v-model="form.apiKey" class="col-span-2" label="API Key (x-api-key)" type="password" :placeholder="form.uuid ? 'kosongkan bila tidak diubah' : 'API key dari sistem PA'" />
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

  <Dialog :visible="!!kunciBaru" modal header="Alamat Penerima Hasil LIS PA" :style="{ width: '640px' }" @update:visible="kunciBaru = null">
    <div v-if="kunciBaru" class="flex flex-col gap-3 text-sm">
      <div>Pasang alamat berikut di <b>{{ kunciBaru.nama }}</b> sebagai URL pengembalian hasil (metode POST, JSON).</div>
      <div class="p-3 font-mono break-all rounded-md bg-opensimrs-50">{{ alamatPenerima(kunciBaru.kunci) }}</div>
      <div class="p-3 rounded-md bg-[#FEF0C7] text-[#B54708]">
        Kunci ini hanya ditampilkan sekali. Bila sistem PA memakai header, kirim kunci sebagai <code>x-api-key</code>: <span class="font-mono">{{ kunciBaru.kunci }}</span>
      </div>
    </div>
    <template #footer>
      <CustomButton label="Salin Alamat" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="salin(alamatPenerima(kunciBaru!.kunci))" />
      <CustomButton label="Selesai" @click="kunciBaru = null" />
    </template>
  </Dialog>

  <Dialog :visible="!!konfirmasiHapus" modal header="Hapus Koneksi LIS PA" :style="{ width: '440px' }" @update:visible="konfirmasiHapus = null">
    <div class="text-sm">Koneksi <b>{{ konfirmasiHapus?.nama }}</b> dihapus. Sistem PA tidak dapat lagi mengirim hasil dengan kunci lamanya.</div>
    <template #footer>
      <CustomButton label="Batal" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent" borderColor="border-2 border-[#9DA4B1]" @click="konfirmasiHapus = null" />
      <CustomButton label="Hapus" backgroundColor="bg-[#B42318]" @click="hapus" />
    </template>
  </Dialog>
</template>
