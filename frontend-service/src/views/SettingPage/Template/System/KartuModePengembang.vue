<script setup lang="ts">
// Setting › System › Mode Pengembang: hanya superadmin yang dapat melihat & mengubah.
// Bila aktif, menu "SIMRS Studio" muncul di menu atas. Status disimpan di studio-service.
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { useSimrsStudioStore } from "@/stores/simrsStudio";
import { epochToDate } from "@/utils/Helpers";

const store = useSimrsStudioStore();
const router = useRouter();
const aktif = computed(() => Boolean(store.status.modeAktif));
const memuat = ref(true);

const dialogTerbuka = ref(false);
const setuju = ref(false);
const menyimpan = ref(false);

onMounted(async () => {
  await store.muat();
  memuat.value = false;
});

const bukaKonfirmasi = () => {
  setuju.value = false;
  dialogTerbuka.value = true;
};
const simpan = async () => {
  menyimpan.value = true;
  if (await store.setAktif(!aktif.value)) dialogTerbuka.value = false;
  menyimpan.value = false;
};

const lapisKunci = [
  { ikon: "PhShieldCheck", judul: "Hanya superadmin", isi: "Pengaturan ini dan menu SIMRS Studio tidak tampil bagi peran lain." },
  { ikon: "PhTerminalWindow", judul: "Memakai langganan Claude Anda", isi: "Agen berjalan lewat Claude Code CLI yang sudah login di mesin pengembang — sama seperti di VS Code." },
  { ikon: "PhLock", judul: "Tanpa data pasien", isi: "Agen hanya membaca kode & dokumen repo; tidak menyambung ke database dan tidak membaca .env." },
  { ikon: "PhGitPullRequest", judul: "Rilis lewat review", isi: "Setiap tahap disetujui manusia; kode berakhir sebagai branch + Pull Request, bukan langsung ke produksi." },
];
</script>

<template>
  <GreenCard cardHeading="Mode Pengembang" :disableLine="!aktif" :hrEnableCustomClass="aktif">
    <template #switch>
      <div class="flex items-center gap-3">
        <span
          class="rounded-full px-2.5 py-0.5 text-XS font-semibold"
          :class="aktif ? 'bg-success-300 text-white' : 'bg-grey-200 text-grey-500'"
        >
          {{ aktif ? "Aktif" : "Non-Aktif" }}
        </span>
        <CustomButton
          v-if="store.status.tersedia"
          :label="aktif ? 'Nonaktifkan' : 'Aktifkan'"
          :outlined="aktif"
          :text-color="aktif ? 'text-danger-300' : ''"
          :border-color="aktif ? 'border-danger-300' : ''"
          @click="bukaKonfirmasi"
        />
      </div>
    </template>

    <div class="flex flex-col gap-1 pt-2.5">
      <div class="flex items-center gap-2 text-normal font-semibold">
        <PhFlask :size="18" weight="duotone" class="text-opensimrs-300" aria-hidden="true" />
        SIMRS Studio
      </div>
      <div class="text-SM text-grey-400">
        Ruang kerja pengembangan berbasis AI untuk tim IT: tulis permintaan, susun use case & PRD, coding oleh agen AI,
        QA, sampai rilis. Setiap tahap tetap disetujui manusia.
      </div>
    </div>

    <div v-if="!memuat && !store.status.terjangkau" class="mt-3 flex items-start gap-2 rounded-lg bg-warning-50 p-3 text-XS text-warning-400">
      <PhWarning :size="18" class="shrink-0" aria-hidden="true" />
      <span>
        Layanan <b>studio-service</b> (port 8090) belum berjalan. Jalankan <code>npm run dev:studio</code> di mesin pengembang
        yang sudah login Claude Code.
      </span>
    </div>
    <div v-else-if="!memuat && !store.status.tersedia" class="mt-3 flex items-start gap-2 rounded-lg bg-warning-50 p-3 text-XS text-warning-400">
      <PhWarning :size="18" class="shrink-0" aria-hidden="true" />
      <span>Studio belum dibuka di instalasi ini. Isi <code>STUDIO_PENGEMBANG=aktif</code> di <code>studio-service/.env</code> lalu jalankan ulang layanan.</span>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      <div v-for="l in lapisKunci" :key="l.judul" class="flex gap-3 rounded-lg bg-white p-3">
        <component :is="l.ikon" :size="22" weight="duotone" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
        <div>
          <div class="text-SM font-semibold text-grey-500">{{ l.judul }}</div>
          <div class="text-XS text-grey-400">{{ l.isi }}</div>
        </div>
      </div>
    </div>

    <div v-if="aktif" class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3">
      <div class="text-XS text-grey-400">
        Diaktifkan oleh <b class="text-grey-500">{{ store.status.diubahOleh ?? "-" }}</b>
        <template v-if="store.status.diubahPada"> pada {{ epochToDate(store.status.diubahPada, "dateTime") }}</template>.
        Menu <b>SIMRS Studio</b> tampil di menu atas.
      </div>
      <CustomButton label="Buka SIMRS Studio" icon="PhArrowRight" iconPos="right" @click="router.push('/studio')" />
    </div>
  </GreenCard>

  <Dialog
    v-model:visible="dialogTerbuka"
    modal
    :header="aktif ? 'Nonaktifkan Mode Pengembang?' : 'Aktifkan Mode Pengembang?'"
    :style="{ width: '32rem' }"
  >
    <div v-if="!aktif" class="flex flex-col gap-3 text-SM text-grey-500">
      <p>Setelah diaktifkan:</p>
      <ul class="list-disc pl-5">
        <li>menu <b>SIMRS Studio</b> tampil untuk superadmin;</li>
        <li>agen AI dapat membaca kode repo dan, pada tahap coding, mengubah berkas di branch kerja per item;</li>
        <li>coding, QA, dan rilis ditolak bila layanan berjalan dengan <code>LINGKUNGAN=production</code>.</li>
      </ul>
      <label class="flex items-start gap-2 rounded-lg bg-opensimrs-50 p-3">
        <input v-model="setuju" type="checkbox" class="mt-0.5" />
        <span>Saya memahami bahwa data pasien tidak boleh dikirim ke AI dan semua perubahan wajib melalui review.</span>
      </label>
    </div>
    <div v-else class="text-SM text-grey-500">
      Menu SIMRS Studio disembunyikan dan tugas agen yang sedang berjalan dihentikan. Item dan riwayat tetap tersimpan
      dan kembali saat mode diaktifkan lagi.
    </div>
    <template #footer>
      <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Batal" outlined @click="dialogTerbuka = false" />
      <CustomButton
        :label="aktif ? 'Nonaktifkan' : 'Aktifkan'"
        :disabled="(!aktif && !setuju) || menyimpan"
        @click="simpan"
      />
    </template>
  </Dialog>
</template>
