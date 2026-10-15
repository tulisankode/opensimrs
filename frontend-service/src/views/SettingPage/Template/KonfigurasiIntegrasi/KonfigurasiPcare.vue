<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { useBpjsPcareStore } from "@/stores/bpjsPcare";
import { utilsStore } from "@/stores/utils";

// Konfigurasi BPJS PCare (FKTP). Rahasia disimpan terenkripsi oleh bpjs-service dan tidak pernah dikirim utuh.
const emit = defineEmits(["tersimpan"]);
const store = useBpjsPcareStore();
const storeUtils = utilsStore();
const toast = useToast();

const konfigurasi = ref<any>(null);
const sedangEdit = ref(false);
const layananTersedia = ref(true);
const form = ref({ aktif: false, consId: "", secretKey: "", userKey: "", username: "", password: "", kdAplikasi: "095", kdProvider: "" });
const nomorPeserta = ref("");
const peserta = ref<any>(null);

const muat = async () => {
  const res = await store.getKonfigurasi();
  layananTersedia.value = !!res && !res.gagal;
  konfigurasi.value = res?.payload ?? null;
};

const mulaiEdit = () => {
  const k = konfigurasi.value ?? {};
  // kolom rahasia dikosongkan: biarkan kosong bila tidak ingin mengubah
  form.value = { aktif: !!k.aktif, consId: k.consId ?? "", secretKey: "", userKey: "", username: k.username ?? "", password: "", kdAplikasi: k.kdAplikasi || "095", kdProvider: k.kdProvider ?? "" };
  sedangEdit.value = true;
};

const simpan = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await store.simpanKonfigurasi(form.value);
    if (res && !res.gagal) {
      konfigurasi.value = res.payload;
      sedangEdit.value = false;
      toast.add({ severity: "success", summary: "Konfigurasi PCare disimpan", life: 3000 });
      emit("tersimpan");
    } else if (res?.gagal) {
      toast.add({ severity: "error", summary: "Gagal menyimpan", detail: res.message, life: 6000 });
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const ujiKoneksi = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await store.ujiKoneksi();
    if (res?.gagal) toast.add({ severity: "error", summary: "Uji koneksi PCare gagal", detail: res.message, life: 7000 });
    else if (res)
      toast.add({
        severity: "success",
        summary: "Koneksi BPJS PCare berhasil",
        detail: `${res.payload?.jumlahPoli ?? 0} poli FKTP terbaca · ${res.payload?.lingkungan}${res.payload?.mode === "mock" ? " · mode simulasi" : ""}`,
        life: 6000,
      });
  } finally {
    storeUtils.setLoading(false);
  }
};

const cekPeserta = async () => {
  peserta.value = null;
  if (!nomorPeserta.value.trim()) return;
  storeUtils.setLoading(true);
  try {
    const res = await store.cekPeserta(nomorPeserta.value.trim());
    if (res?.gagal) toast.add({ severity: "warn", summary: "Cek peserta", detail: res.message, life: 6000 });
    else peserta.value = res?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(muat);
</script>

<template>
  <GreenCard
    cardHeading="Konfigurasi BPJS PCare (FKTP)"
    hrEnableCustomClass
    :showButton="!sedangEdit && layananTersedia"
    labelButton="Edit"
    :buttonClickHandler="mulaiEdit"
  >
    <div class="flex flex-col gap-4 pl-2 text-base">
      <div v-if="!layananTersedia" class="p-3 text-sm rounded-md bg-[#FDE2E1] text-[#B42318]">
        Layanan integrasi BPJS tidak dapat dihubungi. Hubungi administrator sistem.
      </div>

      <template v-else-if="!sedangEdit && konfigurasi">
        <div class="flex flex-wrap items-center gap-2.5">
          <CustomChip
            :label="konfigurasi.aktif ? 'PCare aktif' : 'PCare nonaktif'"
            :show-checked-icon="false"
            :bg-color="konfigurasi.aktif ? 'bg-[#D1FADF]' : 'bg-[#D4D8DC]'"
            border-color="border-transparent"
            :text-color="konfigurasi.aktif ? 'text-[#027A48]' : 'text-[#687077]'"
          />
          <CustomChip
            :label="`Lingkungan: ${konfigurasi.lingkungan === 'production' ? 'produksi' : 'development'}${konfigurasi.mode === 'mock' ? ' (simulasi)' : ''}`"
            :show-checked-icon="false"
            bg-color="bg-opensimrs-50"
            border-color="border-transparent"
            text-color="text-opensimrs-300"
          />
          <CustomChip
            v-if="!konfigurasi.lengkap"
            label="Konfigurasi belum lengkap"
            :show-checked-icon="false"
            bg-color="bg-[#FEF0C7]"
            border-color="border-transparent"
            text-color="text-[#B54708]"
          />
          <CustomButton class="ml-auto" label="Uji Koneksi" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="ujiKoneksi" />
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div><div class="text-sm underline">Cons ID</div><div class="font-semibold">{{ konfigurasi.consId || "-" }}</div></div>
          <div><div class="text-sm underline">Secret Key</div><div class="font-semibold">{{ konfigurasi.secretKey || "-" }}</div></div>
          <div><div class="text-sm underline">User Key PCare</div><div class="font-semibold">{{ konfigurasi.userKey || "-" }}</div></div>
          <div><div class="text-sm underline">Username PCare</div><div class="font-semibold">{{ konfigurasi.username || "-" }}</div></div>
          <div><div class="text-sm underline">Password PCare</div><div class="font-semibold">{{ konfigurasi.password || "-" }}</div></div>
          <div><div class="text-sm underline">Kode Provider (PPK) · Kode Aplikasi</div><div class="font-semibold">{{ konfigurasi.kdProvider || "-" }} · {{ konfigurasi.kdAplikasi }}</div></div>
        </div>

        <div class="flex items-end gap-3 pt-2 border-t border-[#D9DCE1]">
          <CustomTextfield v-model="nomorPeserta" class="w-1/3" label="Cek Peserta JKN" placeholder="No. kartu (13 digit) / NIK (16 digit)" @keyup.enter="cekPeserta" />
          <CustomButton label="Cek" icon="PhMagnifyingGlass" :disabled="!konfigurasi.lengkap" @click="cekPeserta" />
        </div>
        <div v-if="peserta" class="grid grid-cols-3 gap-3 p-3 text-sm rounded-md bg-white">
          <div><span class="underline">Nama</span><div class="font-semibold">{{ peserta.nama }}</div></div>
          <div><span class="underline">No. Kartu</span><div class="font-semibold">{{ peserta.noKartu }}</div></div>
          <div>
            <span class="underline">Status</span>
            <div class="font-semibold" :class="peserta.aktif ? 'text-[#027A48]' : 'text-[#B42318]'">{{ peserta.ketAktif ?? (peserta.aktif ? "AKTIF" : "TIDAK AKTIF") }}</div>
          </div>
          <div><span class="underline">Jenis Peserta</span><div class="font-semibold">{{ peserta.jnsPeserta?.nama ?? "-" }}</div></div>
          <div><span class="underline">Kelas</span><div class="font-semibold">{{ peserta.jnsKelas?.nama ?? "-" }}</div></div>
          <div><span class="underline">FKTP Terdaftar</span><div class="font-semibold">{{ peserta.kdProviderPst?.nmProvider ?? "-" }} ({{ peserta.kdProviderPst?.kdProvider ?? "-" }})</div></div>
        </div>
      </template>

      <template v-else-if="sedangEdit">
        <div class="grid grid-cols-2 gap-3">
          <CustomTextfield v-model="form.consId" label="Cons ID" />
          <CustomTextfield v-model="form.kdProvider" label="Kode Provider (PPK)" placeholder="mis. 0114A026" />
          <CustomTextfield v-model="form.secretKey" label="Secret Key" type="password" placeholder="kosongkan bila tidak diubah" />
          <CustomTextfield v-model="form.userKey" label="User Key PCare" type="password" placeholder="kosongkan bila tidak diubah" />
          <CustomTextfield v-model="form.username" label="Username PCare" />
          <CustomTextfield v-model="form.password" label="Password PCare" type="password" placeholder="kosongkan bila tidak diubah" />
          <CustomTextfield v-model="form.kdAplikasi" label="Kode Aplikasi" placeholder="095" />
          <CustomSwitch v-model="form.aktif" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
        </div>
        <div class="flex justify-end gap-3">
          <CustomButton label="Batal" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent" borderColor="border-2 border-[#9DA4B1]" @click="sedangEdit = false" />
          <CustomButton label="Simpan" @click="simpan" />
        </div>
      </template>
    </div>
  </GreenCard>
</template>
