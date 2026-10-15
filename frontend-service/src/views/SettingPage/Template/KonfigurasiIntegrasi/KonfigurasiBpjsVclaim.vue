<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { useBpjsVclaimStore } from "@/stores/bpjsVclaim";
import { utilsStore } from "@/stores/utils";

// Konfigurasi BPJS VClaim (FKRTL). Menggantikan kartu VClaim lama yang menampilkan rahasia tanpa enkripsi;
// rahasia disimpan terenkripsi oleh bpjs-service dan tidak pernah dikirim utuh ke browser.
const emit = defineEmits(["tersimpan"]);
const store = useBpjsVclaimStore();
const storeUtils = utilsStore();
const toast = useToast();

const konfigurasi = ref<any>(null);
const sedangEdit = ref(false);
const layananTersedia = ref(true);
const form = ref({ aktif: false, consId: "", secretKey: "", userKey: "", kdPpk: "" });

const muat = async () => {
  const res = await store.getKonfigurasi();
  layananTersedia.value = !!res && !res.gagal;
  konfigurasi.value = res?.payload ?? null;
};

const mulaiEdit = () => {
  const k = konfigurasi.value ?? {};
  // kolom rahasia dikosongkan: biarkan kosong bila tidak ingin mengubah
  form.value = { aktif: !!k.aktif, consId: k.consId ?? "", secretKey: "", userKey: "", kdPpk: k.kdPpk ?? "" };
  sedangEdit.value = true;
};

const simpan = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await store.simpanKonfigurasi(form.value);
    if (res && !res.gagal) {
      konfigurasi.value = res.payload;
      sedangEdit.value = false;
      toast.add({ severity: "success", summary: "Konfigurasi VClaim disimpan", life: 3000 });
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
    if (res?.gagal) toast.add({ severity: "error", summary: "Uji koneksi VClaim gagal", detail: res.message, life: 7000 });
    else if (res)
      toast.add({
        severity: "success",
        summary: "Koneksi BPJS VClaim berhasil",
        detail: `PPK ${res.payload?.kdPpk} · ${res.payload?.lingkungan}${res.payload?.mode === "mock" ? " · mode simulasi" : ""}`,
        life: 6000,
      });
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(muat);
</script>

<template>
  <GreenCard
    cardHeading="Konfigurasi BPJS VClaim (Rumah Sakit)"
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
            :label="konfigurasi.aktif ? 'VClaim aktif' : 'VClaim nonaktif'"
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
          <CustomButton class="ml-auto" label="Uji Koneksi" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="!konfigurasi.lengkap" @click="ujiKoneksi" />
        </div>
        <div class="grid grid-cols-4 gap-3">
          <div><div class="text-sm underline">Cons ID</div><div class="font-semibold">{{ konfigurasi.consId || "-" }}</div></div>
          <div><div class="text-sm underline">Secret Key</div><div class="font-semibold">{{ konfigurasi.secretKey || "-" }}</div></div>
          <div><div class="text-sm underline">User Key VClaim</div><div class="font-semibold">{{ konfigurasi.userKey || "-" }}</div></div>
          <div><div class="text-sm underline">Kode PPK Rumah Sakit</div><div class="font-semibold">{{ konfigurasi.kdPpk || "-" }}</div></div>
        </div>
      </template>

      <template v-else-if="sedangEdit">
        <div class="grid grid-cols-2 gap-3">
          <CustomTextfield v-model="form.consId" label="Cons ID" />
          <CustomTextfield v-model="form.kdPpk" label="Kode PPK Rumah Sakit" placeholder="mis. 0301R001" />
          <CustomTextfield v-model="form.secretKey" label="Secret Key" type="password" placeholder="kosongkan bila tidak diubah" />
          <CustomTextfield v-model="form.userKey" label="User Key VClaim" type="password" placeholder="kosongkan bila tidak diubah" />
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
