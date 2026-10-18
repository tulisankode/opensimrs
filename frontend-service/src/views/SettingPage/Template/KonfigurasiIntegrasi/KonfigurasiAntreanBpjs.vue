<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { useAntreanBpjsStore } from "@/stores/antrian/antreanBpjs";
import { utilsStore } from "@/stores/utils";

// Konfigurasi WS Antrean BPJS (Mobile JKN) — STD-0018. Rahasia (Secret Key, User Key) disimpan terenkripsi oleh
// bpjs-service dan tidak pernah dikirim utuh ke browser; endpoint WS yang dipanggil BPJS ada di luar OpenSIMRS
// (/api/v3/bpjs/antrean/ws/*), diautentikasi dengan Cons ID/Secret Key di bawah ini, terpisah dari JWT internal.
const emit = defineEmits(["tersimpan"]);
const store = useAntreanBpjsStore();
const storeUtils = utilsStore();
const toast = useToast();

const OPSI_MODE = [
  { value: "mock", label: "Simulasi (mock)" },
  { value: "nyata", label: "Nyata" },
];

const konfigurasi = ref<any>(null);
const sedangEdit = ref(false);
const layananTersedia = ref(true);
const form = ref({ aktif: false, mode: "mock", baseUrl: "", consId: "", secretKey: "", userKey: "" });

const muat = async () => {
  const res = await store.getKonfigurasi();
  layananTersedia.value = !!res && !res.gagal;
  konfigurasi.value = res?.payload ?? null;
};

const mulaiEdit = () => {
  const k = konfigurasi.value ?? {};
  form.value = { aktif: !!k.aktif, mode: k.mode ?? "mock", baseUrl: k.baseUrl ?? "", consId: k.consId ?? "", secretKey: "", userKey: "" };
  sedangEdit.value = true;
};

const simpan = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await store.simpanKonfigurasi(form.value);
    if (res && !res.gagal) {
      konfigurasi.value = res.payload;
      sedangEdit.value = false;
      toast.add({ severity: "success", summary: "Konfigurasi Antrean BPJS disimpan", life: 3000 });
      emit("tersimpan");
    } else if (res?.gagal) {
      toast.add({ severity: "error", summary: "Gagal menyimpan", detail: res.message, life: 6000 });
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(muat);
</script>

<template>
  <GreenCard
    cardHeading="Konfigurasi Antrean Online BPJS (Mobile JKN)"
    hrEnableCustomClass
    :showButton="!sedangEdit && layananTersedia"
    labelButton="Edit"
    :buttonClickHandler="mulaiEdit"
  >
    <div class="flex flex-col gap-4 pl-2 text-base">
      <div class="p-3 text-sm rounded-md bg-opensimrs-50 text-opensimrs-300">
        Fitur ini juga perlu diaktifkan di Setting › Manajemen Modul (<code>antrian_online_bpjs</code>, mati bawaan) sebelum antrean dari Mobile JKN dapat diproses.
      </div>
      <div v-if="!layananTersedia" class="p-3 text-sm rounded-md bg-[#FDE2E1] text-[#B42318]">
        Layanan integrasi BPJS tidak dapat dihubungi. Hubungi administrator sistem.
      </div>

      <template v-else-if="!sedangEdit && konfigurasi">
        <div class="flex flex-wrap items-center gap-2.5">
          <CustomChip
            :label="konfigurasi.aktif ? 'Antrean BPJS aktif' : 'Antrean BPJS nonaktif'"
            :show-checked-icon="false"
            :bg-color="konfigurasi.aktif ? 'bg-[#D1FADF]' : 'bg-[#D4D8DC]'"
            border-color="border-transparent"
            :text-color="konfigurasi.aktif ? 'text-[#027A48]' : 'text-[#687077]'"
          />
          <CustomChip
            :label="konfigurasi.mode === 'mock' ? 'Mode simulasi' : 'Mode nyata'"
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
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><div class="text-sm underline">URL WS Antrean</div><div class="font-semibold break-all">{{ konfigurasi.baseUrl || "-" }}</div></div>
          <div><div class="text-sm underline">Cons ID</div><div class="font-semibold">{{ konfigurasi.consId || "-" }}</div></div>
          <div><div class="text-sm underline">Secret Key</div><div class="font-semibold">{{ konfigurasi.secretKey || "-" }}</div></div>
          <div><div class="text-sm underline">User Key</div><div class="font-semibold">{{ konfigurasi.userKey || "-" }}</div></div>
        </div>
      </template>

      <template v-else-if="sedangEdit">
        <div class="grid grid-cols-2 gap-3">
          <CustomTextfield v-model="form.baseUrl" class="col-span-2" label="URL WS Antrean" placeholder="https://apijkn.bpjs-kesehatan.go.id/antreanrs" :disabled="form.mode === 'mock'" />
          <CustomTextfield v-model="form.consId" label="Cons ID" />
          <CustomSelect v-model="form.mode" label="Mode" :options="OPSI_MODE" optionValue="value" optionLabel="label" />
          <CustomTextfield v-model="form.secretKey" label="Secret Key" type="password" placeholder="kosongkan bila tidak diubah" />
          <CustomTextfield v-model="form.userKey" label="User Key" type="password" placeholder="kosongkan bila tidak diubah" />
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
