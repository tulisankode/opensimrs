<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { utilsStore } from "@/stores/utils";
import { bawaanKoneksiHdis, daftarKoneksiHdis, hapusKoneksiHdis, kunciMasukHdis, simpanKoneksiHdis, ujiKoneksiHdis } from "@/stores/penunjang/hemodialisa";

// Koneksi HDIS per faskes untuk Bridging HDIS Unit Hemodialisa (STD-0033, fitur hd_bridging_hdis). API key keluar &
// kunci masuk disimpan terenkripsi oleh penunjang-service; kunci masuk tampil utuh sekali saja — pola Konfigurasi UTD.
// Pemetaan mesin ada di Hemodialisa › Mapping HDIS.
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

// Alamat penerima parameter dari HDIS: host penunjang-service + /adam-hdis/bridging (kunci di header x-api-key).
const alamatPenerima = () => {
  const dasar = String(import.meta.env.VITE_BASE_PENUNJANG || "");
  let origin = window.location.origin;
  try {
    origin = new URL(dasar, window.location.origin).origin;
  } catch {
    /* pakai origin halaman */
  }
  return `${origin}/adam-hdis/bridging`;
};

const muat = async () => {
  const res = await daftarKoneksiHdis();
  layananTersedia.value = !!res;
  koneksi.value = res?.payload ?? [];
};
const bukaForm = (k: any = null) => {
  form.value = k
    ? { uuid: k.uuid, nama: k.nama, urlJadwal: k.urlJadwal, apiKey: "", aktif: k.aktif, bawaan: k.bawaan }
    : { uuid: null, nama: "HDIS", urlJadwal: "http://", apiKey: "", aktif: true, bawaan: !koneksi.value.length };
  dialogForm.value = true;
};
const simpan = async () => {
  storeUtils.setLoading(true);
  try {
    const f = form.value;
    const res = await simpanKoneksiHdis({ nama: f.nama, urlJadwal: f.urlJadwal, apiKey: f.apiKey, aktif: f.aktif, bawaan: f.bawaan }, f.uuid ?? undefined);
    if (!res?.payload) return;
    dialogForm.value = false;
    if (res.payload.kunciMasukBaru) kunciBaru.value = { nama: res.payload.nama, kunci: res.payload.kunciMasukBaru };
    await muat();
    emit("berubah");
  } finally {
    storeUtils.setLoading(false);
  }
};
const jadikanBawaan = async (k: any) => {
  if ((await bawaanKoneksiHdis(k.uuid))?.payload) muat();
};
const kunciMasukBaru = async (k: any) => {
  const res = await kunciMasukHdis(k.uuid);
  if (!res?.payload) return;
  kunciBaru.value = { nama: k.nama, kunci: res.payload.kunciMasukBaru };
  muat();
};
const hapus = async () => {
  const k = konfirmasiHapus.value;
  konfirmasiHapus.value = null;
  if ((await hapusKoneksiHdis(k.uuid))?.payload) {
    muat();
    emit("berubah");
  }
};
const ujiKoneksi = async (k: any) => {
  mengujiUuid.value = k.uuid;
  try {
    const hasil = (await ujiKoneksiHdis(k.uuid))?.payload;
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
  <GreenCard cardHeading="Konfigurasi HDIS (Hemodialisa)" hrEnableCustomClass :showButton="layananTersedia" labelButton="Tambah Koneksi" :buttonClickHandler="() => bukaForm()">
    <div class="flex flex-col gap-3 pl-2 text-base">
      <div v-if="!layananTersedia" class="p-3 text-sm rounded-md bg-[#FDE2E1] text-[#B42318]">Konfigurasi HDIS tidak dapat dimuat (layanan penunjang tidak terjangkau atau tidak ada izin).</div>
      <template v-else>
        <div class="text-sm text-grey-400">
          Jadwal & data pasien minimum (tanpa NIK/alamat/telepon) dikirim ke URL penerima jadwal saat jadwal dibuat, dipindah, atau dibatalkan.
          HDIS mengirim parameter mesin per sesi ke alamat penerima SIMRS memakai kunci masuk. Petakan mesin di Hemodialisa › Mapping HDIS.
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
          <Column header="URL Penerima Jadwal" field="urlJadwal" headerClass="bg-opensimrs-50" />
          <Column header="API Key" field="apiKey" headerClass="bg-opensimrs-50" />
          <Column header="Kunci Masuk" field="kunciMasuk" headerClass="bg-opensimrs-50" />
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
          <template #empty><div class="py-3 text-center text-grey-400">Belum ada koneksi HDIS.</div></template>
        </DataTable>
      </template>
    </div>
  </GreenCard>

  <Dialog v-model:visible="dialogForm" modal :header="form.uuid ? 'Ubah Koneksi HDIS' : 'Tambah Koneksi HDIS'" :style="{ width: '600px' }">
    <div class="grid grid-cols-2 gap-3">
      <CustomTextfield v-model="form.nama" class="col-span-2" label="Nama" placeholder="mis. HDIS Unit HD" />
      <CustomTextfield v-model="form.urlJadwal" class="col-span-2" label="URL Penerima Jadwal (POST)" placeholder="http://alamat-hdis:2416/api/jadwal" />
      <CustomTextfield v-model="form.apiKey" class="col-span-2" label="API Key (x-api-key)" type="password" :placeholder="form.uuid ? 'kosongkan bila tidak diubah' : 'API key dari vendor HDIS'" />
      <CustomSwitch v-model="form.aktif" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
      <CustomSwitch v-model="form.bawaan" label="Koneksi Bawaan" sideLabel="Tidak" sideLabelTrue="Ya" />
      <div class="col-span-2 text-xs text-grey-400">Pengiriman tanpa jawaban pasti (waktu habis/galat server HDIS) ditandai "tidak pasti" dan aman dikirim ulang dari riwayat karena kunci idempoten sama.</div>
    </div>
    <template #footer>
      <CustomButton label="Batal" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent" borderColor="border-2 border-[#9DA4B1]" @click="dialogForm = false" />
      <CustomButton label="Simpan" @click="simpan" />
    </template>
  </Dialog>

  <Dialog :visible="!!kunciBaru" modal header="Alamat Penerima Parameter HDIS" :style="{ width: '640px' }" @update:visible="kunciBaru = null">
    <div v-if="kunciBaru" class="flex flex-col gap-3 text-sm">
      <div>Pasang alamat berikut di <b>{{ kunciBaru.nama }}</b> sebagai URL pengiriman parameter (metode POST, JSON), dengan kunci di header <code>x-api-key</code>.</div>
      <div class="p-3 font-mono break-all rounded-md bg-opensimrs-50">{{ alamatPenerima() }}</div>
      <div class="p-3 rounded-md bg-[#FEF0C7] text-[#B54708]">Kunci masuk ini hanya ditampilkan sekali: <span class="font-mono break-all">{{ kunciBaru.kunci }}</span></div>
    </div>
    <template #footer>
      <CustomButton label="Salin Kunci" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="salin(kunciBaru!.kunci)" />
      <CustomButton label="Selesai" @click="kunciBaru = null" />
    </template>
  </Dialog>

  <Dialog :visible="!!konfirmasiHapus" modal header="Hapus Koneksi HDIS" :style="{ width: '440px' }" @update:visible="konfirmasiHapus = null">
    <div class="text-sm">Koneksi <b>{{ konfirmasiHapus?.nama }}</b> dihapus. HDIS tidak dapat lagi mengirim parameter dengan kunci lamanya.</div>
    <template #footer>
      <CustomButton label="Batal" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent" borderColor="border-2 border-[#9DA4B1]" @click="konfirmasiHapus = null" />
      <CustomButton label="Hapus" backgroundColor="bg-[#B42318]" @click="hapus" />
    </template>
  </Dialog>
</template>
