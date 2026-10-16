<script setup lang="ts">
import { onMounted, ref } from "vue";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { apiSettingGet, apiSettingPost, apiSettingPut } from "@/utils/apiHandler";
import { utilsStore } from "@/stores/utils";

// Helpdesk AI (tombol Bantuan) → Gateway OpenClaw di VM terpisah. Satu konfigurasi untuk seluruh instalasi, khusus
// superadmin. Token disimpan terenkripsi oleh setting-service dan tidak pernah dikirim utuh ke peramban.
// Panduan pemasangan Gateway: deploy/helpdesk/README.md.
const storeUtils = utilsStore();
const superadmin = (() => {
  try {
    return String(JSON.parse(localStorage.getItem("user") ?? "{}")?.role ?? "").trim().toLowerCase() === "super admin";
  } catch {
    return false;
  }
})();

const data = ref<any>(null);
const dialog = ref(false);
const form = ref<any>({});
const uji = ref<any>(null);
const menguji = ref(false);

const muat = async () => {
  const res: any = await apiSettingGet("bantuan/konfigurasi", {});
  data.value = res?.payload ?? null;
};
onMounted(() => {
  if (superadmin) muat();
});

const bukaForm = () => {
  const d = data.value ?? {};
  form.value = {
    aktif: d.aktif ?? true,
    gatewayUrl: d.gatewayUrl ?? "",
    token: "",
    agen: d.agen ?? "helpdesk-opensimrs",
    batasPerJam: String(d.batasPerJam ?? 20),
    timeoutDetik: String(d.timeoutDetik ?? 120),
  };
  uji.value = null;
  dialog.value = true;
};

const isiBody = () => ({
  aktif: form.value.aktif,
  gateway_url: form.value.gatewayUrl,
  token: form.value.token,
  agen: form.value.agen,
  batas_per_jam: Number(form.value.batasPerJam),
  timeout_detik: Number(form.value.timeoutDetik),
});

const ujiKoneksi = async (dariForm: boolean) => {
  menguji.value = true;
  try {
    const res: any = await apiSettingPost("bantuan/konfigurasi/uji", dariForm ? isiBody() : {});
    uji.value = res?.data?.payload ?? null;
  } finally {
    menguji.value = false;
  }
};

const simpan = async () => {
  storeUtils.setLoading(true);
  try {
    const res: any = await apiSettingPut("bantuan/konfigurasi", isiBody());
    if (res?.data?.payload) {
      data.value = res.data.payload;
      dialog.value = false;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const formatWaktu = (detik: number | null) => (detik ? new Date(detik * 1000).toLocaleString("id-ID") : "-");
</script>

<template>
  <GreenCard v-if="superadmin" cardHeading="Helpdesk AI (OpenClaw)" hrEnableCustomClass showButton labelButton="Atur" :buttonClickHandler="bukaForm">
    <div class="flex flex-col gap-3 pl-2 text-base">
      <div class="text-sm text-grey-400">
        Tombol <b>Bantuan</b> (ikon headset) meneruskan pertanyaan cara pakai ke agen OpenClaw di Gateway terpisah. Pasang Gateway di VM sendiri
        (lihat <code>deploy/helpdesk/README.md</code>), lalu isi alamat & tokennya di sini. Aktif per faskes diatur di
        <b>Setting › Manajemen Modul › Dashboard › Asisten Bantuan</b>.
      </div>
      <div v-if="!data" class="text-sm text-grey-400">Memuat…</div>
      <template v-else>
        <div class="flex flex-wrap items-center gap-2">
          <CustomChip :label="data.aktif && data.gatewayUrl && data.adaToken ? 'Aktif' : data.aktif ? 'Belum lengkap' : 'Dimatikan'" :show-checked-icon="false"
            :bg-color="data.aktif && data.gatewayUrl && data.adaToken ? 'bg-[#D1FADF]' : 'bg-[#D4D8DC]'" border-color="border-transparent"
            :text-color="data.aktif && data.gatewayUrl && data.adaToken ? 'text-[#027A48]' : 'text-[#687077]'" />
          <CustomChip :label="data.sumber === 'env' ? 'Sumber: .env server' : 'Sumber: pengaturan ini'" :show-checked-icon="false" bg-color="bg-opensimrs-50"
            border-color="border-transparent" text-color="text-opensimrs-300" />
        </div>
        <div class="grid grid-cols-1 gap-x-6 gap-y-1 text-sm md:grid-cols-2">
          <div><span class="text-grey-400">URL Gateway:</span> <span class="font-mono">{{ data.gatewayUrl || "-" }}</span></div>
          <div><span class="text-grey-400">Token:</span> <span class="font-mono">{{ data.token || "-" }}</span></div>
          <div><span class="text-grey-400">Agen:</span> <span class="font-mono">{{ data.agen }}</span></div>
          <div><span class="text-grey-400">Batas:</span> {{ data.batasPerJam }} pertanyaan/pengguna/jam · jawaban maks. {{ data.timeoutDetik }} detik</div>
          <div v-if="data.sumber === 'pengaturan'" class="md:col-span-2 text-grey-400">Diubah {{ data.diubahOleh ?? "-" }} · {{ formatWaktu(data.updatedAt) }}</div>
        </div>
        <div v-if="data.sumber === 'env'" class="p-2 text-xs rounded-md bg-opensimrs-50 text-grey-500">
          {{ data.envTersedia ? "Saat ini memakai HELPDESK_GATEWAY_URL/TOKEN dari .env setting-service." : "Belum dikonfigurasi." }}
          Setelah disimpan di sini, pengaturan ini yang dipakai (.env hanya cadangan).
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <CustomButton label="Uji koneksi" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="menguji || !data.gatewayUrl" @click="ujiKoneksi(false)" />
          <span v-if="uji && !dialog" class="text-sm" :class="uji.ok ? 'text-[#027A48]' : 'text-[#B42318]'">{{ uji.ok ? "✔" : "✘" }} {{ uji.pesan }}</span>
        </div>
      </template>
    </div>
  </GreenCard>

  <Dialog v-model:visible="dialog" modal header="Atur Helpdesk AI (OpenClaw)" :style="{ width: '620px' }">
    <div class="grid grid-cols-2 gap-3">
      <CustomSwitch v-model="form.aktif" class="col-span-2" label="Helpdesk" sideLabel="Dimatikan" sideLabelTrue="Aktif" />
      <CustomTextfield v-model="form.gatewayUrl" class="col-span-2" label="URL Gateway OpenClaw" placeholder="http://10.x.x.x:18789 (alamat privat/VPN, jangan dibuka ke internet)" />
      <CustomTextfield v-model="form.token" class="col-span-2" label="Token Gateway (gateway.auth.token)" type="password"
        :placeholder="data?.adaToken ? `${data.token} — kosongkan bila tidak diubah` : 'token dari konfigurasi OpenClaw'" />
      <div class="col-span-2 -mt-2 text-xs text-grey-400">Token memberi akses operator penuh ke Gateway; disimpan terenkripsi di server dan tidak pernah ditampilkan utuh.</div>
      <CustomTextfield v-model="form.agen" label="ID agen" placeholder="helpdesk-opensimrs" />
      <div></div>
      <CustomTextfield v-model="form.batasPerJam" label="Batas pertanyaan per pengguna per jam" type="number" />
      <CustomTextfield v-model="form.timeoutDetik" label="Batas waktu jawaban (detik)" type="number" />
      <div class="col-span-2 flex flex-wrap items-center gap-2">
        <CustomButton label="Uji koneksi" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="menguji" @click="ujiKoneksi(true)" />
        <span v-if="uji" class="text-sm" :class="uji.ok ? 'text-[#027A48]' : 'text-[#B42318]'">{{ uji.ok ? "✔" : "✘" }} {{ uji.pesan }}</span>
      </div>
    </div>
    <template #footer>
      <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
      <CustomButton label="Simpan" @click="simpan" />
    </template>
  </Dialog>
</template>
