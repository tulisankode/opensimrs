<script setup lang="ts">
// Detail item SIMRS Studio: tahap, dokumen buatan AI (berversi), diskusi dengan agen, gerbang persetujuan per peran,
// coding di branch kerja, cek otomatis & checklist uji (QA), commit/PR/status rilis.
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiStudioGet, apiStudioPost, apiStudioPut } from "@/utils/apiHandler";
import { useSimrsStudioStore } from "@/stores/simrsStudio";
import { useModulFaskesStore } from "@/stores/modulFaskes";
import Markdown from "../Komponen/Markdown.vue";
import PanelTugas from "../Komponen/PanelTugas.vue";
import PanelPerubahan from "../Komponen/PanelPerubahan.vue";
import PanelGerbang from "../Komponen/PanelGerbang.vue";
import ChecklistUji from "../Komponen/ChecklistUji.vue";
import PanelLampiran from "../Komponen/PanelLampiran.vue";
import { NAMA_JENIS, NAMA_TAHAP, TAHAP, WARNA_RISIKO, formatUsd, formatWaktu, keteranganTunggu, nomorItem, tugasMasihBerjalan } from "../umum";

const route = useRoute();
const router = useRouter();
const studio = useSimrsStudioStore();
const modulFaskes = useModulFaskesStore();

const data = ref<any>(null);
const tahapDipilih = ref<string>("permintaan");
const versiDipilih = ref<Record<string, number>>({});
const muatUlangPerubahan = ref(0);
const sibuk = ref(false);

const item = computed(() => data.value?.item);
const aktif = computed(() => item.value && !["selesai", "dibatalkan", "ditunda"].includes(item.value.tahap));
const indeksTahap = computed(() => (item.value?.tahap === "selesai" ? TAHAP.length : TAHAP.findIndex((t) => t.kode === (item.value?.tahap === "ditunda" ? item.value?.tahapSebelum : item.value?.tahap))));

const muat = async () => {
  const res = await apiStudioGet(`/item/${route.params.uuid}`);
  if (!res?.payload) return;
  const pertama = !data.value;
  data.value = res.payload;
  if (pertama) tahapDipilih.value = TAHAP.some((t) => t.kode === item.value.tahap) ? item.value.tahap : item.value.tahapSebelum ?? "rilis";
  muatUlangPerubahan.value++;
};
onMounted(muat);
watch(() => route.params.uuid, () => {
  data.value = null;
  muat();
});

// Termasuk tugas yang menunggu slot agen / menunggu kuota (tunda_kuota): tombol agen tetap dikunci sampai selesai/dibatalkan.
const tugasBerjalan = computed(() => data.value?.tugas.find((t: any) => tugasMasihBerjalan(t.status)) ?? null);
const tungguTugas = computed(() => keteranganTunggu(tugasBerjalan.value?.status, tugasBerjalan.value?.lanjutPada, tugasBerjalan.value?.menungguSlot));
const tugasTerakhir = (jenis: string) => data.value?.tugas.find((t: any) => t.jenis === jenis) ?? null;
const hasilCek = computed(() => {
  const t = tugasTerakhir("cek");
  try {
    return t?.hasil ? JSON.parse(t.hasil) : null;
  } catch {
    return null;
  }
});

const versiTahap = (tahap: string) => (data.value?.artefak ?? []).filter((a: any) => a.tahap === tahap);
const artefakTampil = computed(() => {
  const daftar = versiTahap(tahapDipilih.value);
  if (!daftar.length) return null;
  const v = versiDipilih.value[tahapDipilih.value];
  return daftar.find((a: any) => a.versi === v) ?? daftar.at(-1);
});
const pesanTahap = computed(() => (data.value?.pesan ?? []).filter((p: any) => p.tahap === tahapDipilih.value));

const statusTahap = (idx: number) => (idx < indeksTahap.value ? "selesai" : idx === indeksTahap.value ? "berjalan" : "belum");
const diTahapAktif = computed(() => aktif.value && tahapDipilih.value === item.value?.tahap);
const IZIN_KERJA: Record<string, [string, string]> = {
  permintaan: ["Permintaan", "UPDATE"], usecase: ["Permintaan", "UPDATE"], prd: ["PRD", "UPDATE"], desain: ["Desain", "UPDATE"],
  coding: ["Coding", "JALANKAN AGEN"], qa: ["QA", "UPDATE"], rilis: ["Rilis", "SIAPKAN"],
};
const bolehKerja = computed(() => diTahapAktif.value && studio.boleh(...(IZIN_KERJA[item.value?.tahap] ?? ["-", "-"])));
const fiturMati = (f: string) => data.value?.fitur?.[f] === false;

// ---------- Aksi ----------
const jalankan = async (fn: () => Promise<any>) => {
  sibuk.value = true;
  try {
    return await fn();
  } finally {
    sibuk.value = false;
    await muat();
  }
};

const pesanBaru = ref("");
const kirimPesan = () =>
  jalankan(async () => {
    if (!pesanBaru.value.trim()) return;
    if (await apiStudioPost(`/item/${item.value.uuid}/pesan`, { isi: pesanBaru.value })) pesanBaru.value = "";
  });

const mintaAgen = () => jalankan(() => apiStudioPost(`/item/${item.value.uuid}/agen`, {}));

const dialogKeputusan = ref<null | "revisi" | "tolak">(null);
const alasan = ref("");
// Revisi bisa mundur ke tahap yang sudah dilewati (mis. dari Coding ke PRD bila PRD kurang lengkap).
const keTahap = ref("");
const tahapBisaMundur = computed(() => TAHAP.slice(0, Math.max(TAHAP.findIndex((t) => t.kode === item.value?.tahap), 0) + 1).filter((t) => t.kode !== "rilis"));
watch(dialogKeputusan, (d) => {
  if (d) keTahap.value = item.value?.tahap ?? "";
});
const putuskan = (keputusan: "setuju" | "revisi" | "tolak", peran?: string) =>
  jalankan(async () => {
    const mundur = keputusan === "revisi" && keTahap.value && keTahap.value !== item.value.tahap ? keTahap.value : undefined;
    const res = await apiStudioPost(`/item/${item.value.uuid}/keputusan`, { keputusan, alasan: alasan.value, peran, keTahap: mundur });
    if (res) {
      dialogKeputusan.value = null;
      alasan.value = "";
      const ke = keputusan === "setuju" || mundur ? res.payload?.tahap : null;
      if (ke && TAHAP.some((t) => t.kode === ke)) tahapDipilih.value = ke;
    }
  });

const LABEL_KEPUTUSAN: Record<string, string> = {
  setuju: "disetujui", revisi: "minta revisi", tolak: "ditolak (item dibatalkan)", batal: "dibatalkan", mundur: "dikembalikan ke tahap ini", buka: "dibuka kembali",
};

// Buka kembali item yang dibatalkan/ditolak (superadmin).
const dialogBuka = ref(false);
const buka = ref({ keTahap: "", alasan: "", jalankanAgen: true });
const bukaDialogBuka = () => {
  buka.value = { keTahap: item.value.tahapSebelum ?? "", alasan: "", jalankanAgen: true };
  dialogBuka.value = true;
};
const bukaKembali = () =>
  jalankan(async () => {
    const res = await apiStudioPost(`/item/${item.value.uuid}/buka-kembali`, buka.value);
    if (res) {
      dialogBuka.value = false;
      if (res.payload?.tahap && TAHAP.some((t) => t.kode === res.payload.tahap)) tahapDipilih.value = res.payload.tahap;
    }
  });

const dialogSunting = ref(false);
const isiSunting = ref("");
// Template awal bila dokumen tahap belum ada (mis. agen tidak berjalan karena kuota) — bisa ditulis manual.
const TEMPLATE_DOKUMEN: Record<string, string> = {
  permintaan: "# Ringkasan permintaan\n\n**Masalah:**\n\n**Pengguna terdampak:**\n\n**Hasil yang diharapkan:**\n",
  usecase: "# Use case\n\n**Aktor:**\n\n**Prasyarat:**\n\n## Alur utama\n1. \n\n## Alur alternatif\n\n## Alur gagal\n",
  prd: "# PRD\n\n## Tujuan\n\n## Kebutuhan fungsional\n- KF-1 \n\n## Kriteria terima\n- KT-1 Diberikan … Ketika … Maka …\n",
  desain: "# Desain teknis\n\n| Layanan | Berkas | Perubahan |\n|---|---|---|\n|  |  |  |\n",
  qa: "# Rencana uji\n\n| ID | Kriteria | Skenario | Peran & segmen | Langkah | Hasil diharapkan | Hasil |\n|---|---|---|---|---|---|---|\n| UJ-1 | KT-1 |  |  |  |  |  |\n\n## Checklist uji manual\n- [ ] \n",
  rilis: "# Catatan rilis\n\n## Ditambahkan\n- \n\n## Langkah pembaruan\n- Jalankan `npm run db:migrate` bila ada migrasi baru.\n",
};
const bukaSunting = () => {
  isiSunting.value = artefakTampil.value?.isi ?? TEMPLATE_DOKUMEN[tahapDipilih.value] ?? "";
  dialogSunting.value = true;
};
const simpanSunting = () =>
  jalankan(async () => {
    if (await apiStudioPost(`/item/${item.value.uuid}/artefak`, { isi: isiSunting.value })) dialogSunting.value = false;
  });

const pesanCommit = ref("");
watch(item, (i) => {
  if (i && !pesanCommit.value) pesanCommit.value = i.pesanCommit ?? "";
});
// Penerapan/aktivasi/pembatalan bisa menyalakan modul & izin baru → konfigurasi modul dan izin sesi dimuat ulang
// agar menu langsung berubah tanpa login ulang.
const segarkanSesi = () => modulFaskes.segarkanSesi().catch(() => {});
const aksi = (nama: string, body: object = {}) =>
  jalankan(async () => {
    const res = await apiStudioPost(`/item/${item.value.uuid}/${nama}`, body);
    if (res && ["terapkan", "aktifkan"].includes(nama)) await segarkanSesi();
    return res;
  });

const pindahkanAplikasi = () =>
  jalankan(async () => {
    if (await apiStudioPost("/aplikasi/pindah", {})) await segarkanSesi();
  });

// Triase & risiko
const dialogTriase = ref(false);
const triase = ref({ judul: "", prioritas: "P2", jenis: "fitur", modul: "", risiko: "sedang", alasanRisiko: "" });
const bukaTriase = () => {
  triase.value = { judul: item.value.judul, prioritas: item.value.prioritas, jenis: item.value.jenis, modul: (item.value.modulTerdampak ?? []).join(", "), risiko: item.value.risiko, alasanRisiko: "" };
  dialogTriase.value = true;
};
const simpanTriase = () =>
  jalankan(async () => {
    const t = triase.value;
    let ok = true;
    if (studio.boleh("Permintaan", "TRIASE")) {
      ok = Boolean(await apiStudioPut(`/item/${item.value.uuid}`, { judul: t.judul, prioritas: t.prioritas, jenis: t.jenis, modulTerdampak: t.modul.split(",").map((m) => m.trim()).filter(Boolean) }, true));
    }
    if (ok && t.risiko !== item.value.risiko && studio.boleh("PRD", "TETAPKAN RISIKO")) ok = Boolean(await apiStudioPost(`/item/${item.value.uuid}/risiko`, { risiko: t.risiko, alasan: t.alasanRisiko }));
    if (ok) dialogTriase.value = false;
  });

// Pratinjau prompt efektif
const dialogPrompt = ref(false);
const prompt = ref<any>(null);
const bukaPrompt = async () => {
  prompt.value = (await apiStudioGet(`/item/${item.value.uuid}/prompt?tahap=${tahapDipilih.value}`))?.payload ?? null;
  dialogPrompt.value = true;
};

const dialogBatalTerapkan = ref(false);
const alasanBatal = ref("");
const batalTerapkan = () =>
  jalankan(async () => {
    if (await apiStudioPost(`/item/${item.value.uuid}/batal-terapkan`, { alasan: alasanBatal.value })) {
      dialogBatalTerapkan.value = false;
      alasanBatal.value = "";
      await segarkanSesi();
    }
  });

// Tombol Setujui coding baru aktif setelah ada perubahan kode (dari agen atau pindai manual).
const belumSiap = computed(() => {
  const dok = ["permintaan", "usecase", "prd", "desain", "qa", "rilis"];
  if (item.value && dok.includes(item.value.tahap) && !versiTahap(item.value.tahap).length) {
    const nama = item.value.tahap === "qa" ? "Rencana uji" : item.value.tahap === "rilis" ? "Catatan rilis" : NAMA_TAHAP[item.value.tahap];
    return `Belum ada dokumen ${nama}. Klik "AI tulis ulang" agar agen menulisnya, atau "Tulis manual" bila agen tidak bisa dijalankan (mis. kuota langganan).`;
  }
  if (item.value?.tahap !== "coding" || (item.value.berkas ?? []).length || (item.value.riwayatCommit ?? []).length) return null;
  if (!item.value.branch) return "Belum ada kode. Langkah berikutnya: " + (item.value.risiko === "kritis" || fiturMati("coding") ? "klik Siapkan branch di panel Kerjakan manual." : "klik Mulai coding (agen) atau Siapkan branch (manual).");
  return "Belum ada perubahan kode di branch " + item.value.branch + ". Tulis kode " + (item.value.worktree ? "di " + item.value.worktree : "di branch itu") + ", lalu klik Pindai perubahan manual.";
});

// Penghalang menjalankan agen coding + aksi cepat untuk mengatasinya.
const penghalangCoding = computed(() => {
  const daftar: Array<{ kode: string; teks: string; aksi?: { label: string; jalan: () => void } }> = [];
  if (!item.value) return daftar;
  if (fiturMati("coding")) {
    daftar.push({ kode: "fitur", teks: "Fitur Coding agen belum diaktifkan (Pengaturan & Agen › Fitur Studio).",
      aksi: studio.status.superadmin ? { label: "Buka Pengaturan", jalan: () => router.push("/studio/pengaturan") } : undefined });
  }
  if (item.value.risiko === "kritis") {
    daftar.push({ kode: "kritis", teks: "Risiko kritis: agen dilarang menulis kode. Bila penilaian risiko keliru, turunkan lewat Triase (superadmin, dengan alasan).",
      aksi: studio.boleh("PRD", "TETAPKAN RISIKO") ? { label: "Triase risiko", jalan: bukaTriase } : undefined });
  }
  if (!studio.boleh("Coding", "JALANKAN AGEN")) daftar.push({ kode: "izin", teks: "Anda tidak punya hak Coding › JALANKAN AGEN." });
  return daftar;
});

const rincianCi = ref<any[]>([]);
const perbaruiRilis = () =>
  jalankan(async () => {
    const res = await apiStudioPost(`/item/${item.value.uuid}/status-rilis`, {}, true);
    rincianCi.value = res?.payload?.rincianCi ?? [];
  });

const LABEL_SETUJU: Record<string, string> = {
  permintaan: "Setujui → Use case", usecase: "Setujui → PRD", prd: "Setujui PRD", desain: "Setujui desain → Coding",
  coding: "Setujui kode → QA", qa: "QA lulus → Rilis", rilis: "Tandai selesai",
};
const PANDUAN: Record<string, string> = {
  permintaan: "AI merangkum permintaan dan mengajukan pertanyaan. Jawab lewat diskusi bila perlu. Product melakukan triase (prioritas, risiko, modul) lalu menyetujui.",
  usecase: "Pengusul memastikan alur sesuai maksudnya — termasuk alur gagal.",
  prd: "Periksa kriteria terima (KT): semuanya harus dapat diuji. Risiko tinggi/kritis butuh reviewer klinis.",
  desain: "Programmer memeriksa rencana berkas sebelum agen menulis kode. Berkas klinis/keuangan menaikkan risiko otomatis.",
  coding: "Agen menulis kode di branch kerja. Pada mode workspace, aplikasi yang berjalan dengan npm run dev langsung memakai perubahan ini.",
  qa: "Jalankan cek otomatis, isi checklist uji di aplikasi, lalu nyatakan lulus atau minta perbaikan (kembali ke coding).",
  rilis: "Commit perubahan, lalu terapkan ke branch lokal aplikasi RS (mode lokal) dan/atau push & buat Pull Request (mode PR).",
};
const WARNA_PR: Record<string, string> = { terbuka: "bg-info-50 text-info-400", merged: "bg-success-50 text-success-400", ditutup: "bg-grey-75 text-grey-400" };
const WARNA_CI: Record<string, string> = { sukses: "bg-success-50 text-success-400", gagal: "bg-danger-50 text-danger-400", berjalan: "bg-warning-50 text-warning-400", tidak_ada: "bg-grey-75 text-grey-400" };
</script>

<template>
  <Card v-if="item" pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full" class="h-full">
    <template #header>
      <PageToolbar>
        <div class="flex min-w-0 items-center gap-2">
          <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" icon="PhArrowLeft" outlined @click="router.push('/studio/beranda')" />
          <div class="min-w-0">
            <div class="text-XS text-grey-400">
              {{ nomorItem(item.nomor) }} · {{ NAMA_JENIS[item.jenis] ?? item.jenis }} · {{ item.prioritas }} · oleh {{ item.dibuatOleh }}
              <template v-if="(item.modulTerdampak ?? []).length"> · {{ item.modulTerdampak.join(", ") }}</template>
            </div>
            <h1 class="toolbar-heading truncate text-opensimrs-300">{{ item.judul }}</h1>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="rounded px-2 py-0.5 text-XS font-semibold capitalize" :class="WARNA_RISIKO[item.risiko]" :title="`Batas bawah otomatis: ${item.risikoMin}`">Risiko {{ item.risiko }}</span>
          <span class="rounded bg-opensimrs-50 px-2 py-0.5 text-XS font-semibold text-opensimrs-300">{{ NAMA_TAHAP[item.tahap] ?? item.tahap }}</span>
          <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" v-if="aktif && (studio.boleh('Permintaan', 'TRIASE') || studio.boleh('PRD', 'TETAPKAN RISIKO'))" label="Triase" icon="PhSlidersHorizontal" outlined @click="bukaTriase" />
          <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Prompt" icon="PhEye" outlined title="Pratinjau prompt efektif tahap ini" @click="bukaPrompt" />
        </div>
      </PageToolbar>
    </template>
    <template #content>
      <!-- Stepper tahap -->
      <div class="flex items-center gap-1 overflow-x-auto pb-2">
        <template v-for="(t, idx) in TAHAP" :key="t.kode">
          <button
            type="button"
            class="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-XS font-semibold"
            :class="[
              tahapDipilih === t.kode ? 'ring-2 ring-opensimrs-300' : '',
              fiturMati(t.kode) && t.kode !== 'coding' ? 'line-through opacity-60' : '',
              statusTahap(idx) === 'selesai' ? 'bg-success-50 text-success-400'
                : statusTahap(idx) === 'berjalan' ? 'bg-opensimrs-300 text-white' : 'bg-grey-75 text-grey-400',
            ]"
            @click="tahapDipilih = t.kode"
          >
            <PhCheckCircle v-if="statusTahap(idx) === 'selesai'" :size="14" weight="fill" aria-hidden="true" />
            <component v-else :is="t.ikon" :size="14" aria-hidden="true" />
            {{ t.nama }}
          </button>
          <div v-if="idx < TAHAP.length - 1" class="h-[2px] w-4 shrink-0 bg-grey-200"></div>
        </template>
      </div>

      <div v-if="item.tahap === 'dibatalkan'" class="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-danger-50 p-2 text-XS text-danger-400">
        <span>
          Item ini dibatalkan<template v-if="item.tahapSebelum"> di tahap <b>{{ NAMA_TAHAP[item.tahapSebelum] }}</b></template>.
          Branch & kode tidak dihapus; lihat alasannya di <b>Riwayat keputusan</b>.
        </span>
        <CustomButton v-if="studio.status.superadmin" label="Buka kembali" icon="PhArrowUUpLeft" outlined text-color="text-opensimrs-300" border-color="border-opensimrs-300" :disabled="sibuk" @click="bukaDialogBuka" />
      </div>
      <div v-if="item.tahap === 'ditunda'" class="mb-2 flex items-center justify-between gap-2 rounded-lg bg-warning-50 p-2 text-XS text-warning-400">
        <span>Item ditunda di tahap <b>{{ NAMA_TAHAP[item.tahapSebelum] }}</b>.</span>
        <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" v-if="studio.boleh('Permintaan', ['BATAL', 'TRIASE'])" label="Lanjutkan" icon="PhPlay" outlined :disabled="sibuk" @click="aksi('lanjutkan')" />
      </div>
      <div v-if="studio.status.beku" class="mb-2 rounded-lg bg-danger-50 p-2 text-XS text-danger-400">SIMRS Studio sedang dihentikan superadmin — semua item hanya-baca.</div>
      <div v-if="item.branch && !item.worktree && data.branchSekarang && data.branchSekarang !== item.branch && aktif && ['coding', 'qa', 'rilis'].includes(item.tahap)" class="mb-2 flex items-center justify-between gap-2 rounded-lg bg-warning-50 p-2 text-XS text-warning-400">
        <span>Working tree sedang di branch <b>{{ data.branchSekarang }}</b>, bukan branch item <b>{{ item.branch }}</b>.</span>
        <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Buka branch item" outlined :disabled="sibuk" @click="aksi('buka-branch')" />
      </div>

      <div class="mt-1 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_360px]">
        <div class="flex min-w-0 flex-col gap-3">
          <div v-if="diTahapAktif" class="flex items-start gap-2 rounded-lg bg-info-50 p-2.5 text-XS text-info-400">
            <PhInfo :size="16" class="shrink-0" aria-hidden="true" /> {{ PANDUAN[tahapDipilih] }}
          </div>

          <PanelTugas v-if="tugasBerjalan" :tugas-uuid="tugasBerjalan.uuid" :judul="tugasBerjalan.jenis === 'cek' ? 'Cek otomatis' : `Agen: ${NAMA_TAHAP[tugasBerjalan.tahap] ?? ''}`" @selesai="muat" />

          <!-- CODING -->
          <template v-if="tahapDipilih === 'coding'">
            <div v-if="diTahapAktif && !versiTahap('coding').length && !tugasBerjalan" class="flex flex-col items-center gap-2 rounded-lg border border-dashed border-opensimrs-200 p-6 text-center">
              <PhCode :size="36" weight="duotone" class="text-opensimrs-300" aria-hidden="true" />
              <div class="text-SM text-grey-500">
                <b>Coding oleh agen AI</b> — agen membuat/memakai branch kerja
                <template v-if="data.modeKerja === 'worktree'"> di <b>worktree terpisah</b> (working tree Anda tidak diubah)</template>
                lalu menulis kode sesuai desain teknis yang disetujui.
              </div>
              <!-- Penghalang & cara mengatasinya -->
              <div v-if="penghalangCoding.length" class="flex w-full max-w-xl flex-col gap-1.5 rounded-lg bg-warning-50 p-2.5 text-left text-XS text-warning-400">
                <div class="font-semibold">Agen belum bisa dijalankan:</div>
                <div v-for="p in penghalangCoding" :key="p.kode" class="flex flex-wrap items-center justify-between gap-2">
                  <span>• {{ p.teks }}</span>
                  <CustomButton v-if="p.aksi" :label="p.aksi.label" outlined text-color="text-opensimrs-300" border-color="border-opensimrs-300" @click="p.aksi.jalan()" />
                </div>
                <div class="text-grey-400">Atau kerjakan manual lewat panel <b>Kerjakan manual</b> di bawah.</div>
              </div>
              <div v-if="data.estimasiCoding" class="text-XS text-grey-400">
                Estimasi dari {{ data.estimasiCoding.sampel }} tugas sebelumnya: ≈ {{ formatUsd(data.estimasiCoding.biayaUsd) }} (setara API) · ±{{ Math.round(data.estimasiCoding.durasiDetik / 60) }} menit
              </div>
              <CustomButton label="Mulai coding" icon="PhPlay" :disabled="sibuk || penghalangCoding.length > 0" @click="mintaAgen" />
            </div>
            <!-- Coding manual oleh programmer (wajib untuk risiko kritis; juga untuk melengkapi hasil agen) -->
            <div v-if="diTahapAktif && (studio.boleh('Coding', ['JALANKAN AGEN', 'REVIEW']))" class="flex flex-col gap-2 rounded-lg border border-grey-200 p-3 text-XS text-grey-500">
              <div class="flex items-center gap-2 text-SM font-semibold"><PhUserGear :size="18" class="text-opensimrs-300" aria-hidden="true" /> Kerjakan manual (programmer)</div>
              <template v-if="!item.branch">
                <div class="text-grey-400">Studio membuat branch kerja item tanpa menjalankan agen. Setelah itu kerjakan kode di VS Code pada branch tersebut.</div>
                <CustomButton class="self-start" label="Siapkan branch" icon="PhGitBranch" :disabled="sibuk || !!tugasBerjalan" @click="aksi('coding/siapkan')" />
              </template>
              <template v-else>
                <ol class="list-decimal pl-5 text-grey-400">
                  <li v-if="item.worktree">Buka folder <code class="rounded bg-grey-75 px-1">{{ item.worktree }}</code> di VS Code (branch <b>{{ item.branch }}</b>).</li>
                  <li v-else>Di VS Code, pastikan berada di branch <code class="rounded bg-grey-75 px-1">{{ item.branch }}</code> (repo ini). <code>npm run dev</code> langsung memakai perubahan Anda.</li>
                  <li>Ubah kode sesuai desain teknis. Boleh dibiarkan belum di-commit (Studio yang commit) atau di-commit sendiri di branch itu.</li>
                  <li>Klik <b>Pindai perubahan manual</b>, periksa diff &amp; pemeriksa kebijakan, lalu setujui.</li>
                </ol>
                <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" class="self-start" label="Pindai perubahan manual" icon="PhMagnifyingGlass" outlined :disabled="sibuk || !!tugasBerjalan" @click="aksi('coding/pindai')" />
              </template>
            </div>
            <div v-if="item.worktree" class="flex items-center gap-2 rounded-lg bg-grey-75 p-2 font-mono text-[11px] text-grey-500">
              <PhFolderSimple :size="14" aria-hidden="true" /> worktree: {{ item.worktree }}
            </div>
            <div v-if="artefakTampil" class="rounded-lg border border-grey-200 p-3">
              <div class="mb-1 text-SM font-semibold text-grey-500">Ringkasan agen (putaran {{ artefakTampil.versi }})</div>
              <Markdown :isi="artefakTampil.isi" />
            </div>
            <PanelPerubahan :item-uuid="item.uuid" :muat-ulang="muatUlangPerubahan" />
            <PanelTugas v-if="!tugasBerjalan && tugasTerakhir('coding')" :tugas-uuid="tugasTerakhir('coding').uuid" judul="Log agen coding terakhir" />
          </template>

          <!-- QA -->
          <template v-else-if="tahapDipilih === 'qa'">
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-grey-200 p-3">
              <div class="text-SM text-grey-500">
                <div class="font-semibold">Cek otomatis</div>
                <div class="text-XS text-grey-400">Pemeriksa kebijakan, sintaks JS, uji layanan yang berubah, dokumen katalog, dan build frontend.</div>
                <div v-if="hasilCek" class="mt-1 flex flex-wrap gap-1">
                  <span v-for="l in hasilCek.langkah" :key="l.nama" class="rounded px-1.5 text-[10px] font-semibold" :class="l.lulus ? 'bg-success-50 text-success-400' : 'bg-danger-50 text-danger-400'">{{ l.lulus ? "✔" : "✘" }} {{ l.nama }}</span>
                </div>
              </div>
              <CustomButton v-if="diTahapAktif && (studio.boleh('QA', ['JALANKAN UJI', 'UPDATE']) || studio.boleh('Coding', 'JALANKAN AGEN'))" label="Jalankan cek otomatis" icon="PhPlay" :disabled="sibuk || !!tugasBerjalan" @click="aksi('cek')" />
            </div>
            <ChecklistUji :item-uuid="item.uuid" :uji="data.uji" :boleh-ubah="diTahapAktif && studio.boleh('QA', ['UPDATE', 'LULUS'])" @berubah="muat" />
            <PanelTugas v-if="!tugasBerjalan && tugasTerakhir('cek')" :tugas-uuid="tugasTerakhir('cek').uuid" judul="Hasil cek otomatis terakhir" />
          </template>

          <!-- RILIS: commit, push/PR, status -->
          <div v-if="tahapDipilih === 'rilis' && item.branch" class="flex flex-col gap-2 rounded-lg border border-grey-200 p-3">
            <div class="flex flex-wrap items-center gap-2 text-SM font-semibold text-grey-500">
              <PhGitBranch :size="18" class="text-opensimrs-300" aria-hidden="true" /> {{ item.branch }}
              <span v-if="item.prStatus" class="rounded px-1.5 text-[10px] font-semibold" :class="WARNA_PR[item.prStatus]">PR {{ item.prStatus }}</span>
              <span v-if="item.ciStatus" class="rounded px-1.5 text-[10px] font-semibold" :class="WARNA_CI[item.ciStatus]">CI {{ item.ciStatus.replace('_', ' ') }}</span>
              <span v-if="item.tagRilis" class="rounded bg-success-300 px-1.5 text-[10px] font-semibold text-white">Rilis {{ item.tagRilis }}</span>
            </div>
            <div v-for="c in item.riwayatCommit ?? []" :key="c.sha" class="text-XS text-grey-500">
              <code class="rounded bg-grey-75 px-1">{{ c.sha.slice(0, 7) }}</code> {{ c.pesan }} <span class="text-grey-300">({{ c.berkas.length }} berkas)</span>
            </div>
            <template v-if="(item.berkas ?? []).length || !item.commitSha">
              <label class="text-XS font-semibold text-grey-500" for="pesan-commit">Pesan commit (Conventional Commits)</label>
              <textarea id="pesan-commit" v-model="pesanCommit" rows="2" class="rounded-lg border border-grey-200 px-2 py-1.5 font-mono text-XS" placeholder="feat(lab): filter ruangan di daftar order" />
              <div class="flex justify-end">
                <CustomButton label="Commit perubahan" icon="PhGitCommit" :disabled="sibuk || !diTahapAktif || !studio.boleh('Coding', 'BUKA PR')" @click="aksi('commit', { pesan: pesanCommit })" />
              </div>
            </template>
            <!-- Rilis lokal (tanpa push/PR) -->
            <div v-if="data.modeRilis !== 'pr' && item.commitSha" class="flex flex-col gap-1.5 rounded-lg bg-opensimrs-50 p-2.5 text-XS text-grey-500">
              <div v-if="item.diterapkanPada" class="flex items-center gap-2">
                <PhCheckCircle :size="16" weight="fill" class="text-success-300" aria-hidden="true" />
                Diterapkan ke branch lokal <b>{{ item.branchLokal }}</b> ({{ item.shaLokal?.slice(0, 7) }}) · {{ formatWaktu(item.diterapkanPada) }}
              </div>
              <div v-else-if="item.shaBatal" class="text-warning-400">Penerapan sebelumnya dibatalkan (revert {{ item.shaBatal.slice(0, 7) }}).</div>
              <div v-else class="text-grey-400">
                Belum diterapkan. <b>Terapkan ke lokal</b> menggabungkan branch item ke <b>{{ data.branchLokal }}</b> — aplikasi RS yang memakai branch itu
                langsung memakai perubahan ini (tanpa push ke GitHub). Migrasi database baru dijalankan otomatis bila diaktifkan,
                lalu modul/fitur baru dinyalakan dan menu diperbarui tanpa login ulang.
              </div>
              <div v-if="item.diterapkanPada && item.aktivasi" class="flex items-start gap-2 text-grey-500">
                <PhToggleRight :size="16" weight="fill" class="mt-0.5 shrink-0 text-success-300" aria-hidden="true" />
                <span>
                  Dinyalakan: {{ [...(item.aktivasi.modul ?? []).map((m: any) => `modul ${m.nama}`), ...(item.aktivasi.fitur ?? []).map((f: any) => `fitur ${f.nama}`)].join(", ") || "-" }}
                  <template v-if="(item.aktivasi.lewati ?? []).length"> · dilewati: {{ item.aktivasi.lewati.map((l: any) => `${l.kode} (${l.alasan})`).join("; ") }}</template>
                </span>
              </div>
              <div v-if="data.aplikasi && !data.aplikasi.sama" class="flex flex-wrap items-center gap-2 rounded-lg border border-warning-200 bg-white p-2 text-warning-400">
                <PhWarning :size="16" class="shrink-0" aria-hidden="true" />
                <span class="min-w-0 flex-1">
                  Aplikasi pengembang (<code>npm run dev</code>) sedang memakai branch <b>{{ data.aplikasi.branch }}</b>, bukan <b>{{ data.branchLokal }}</b>.
                  Hasil penerapan baru terlihat di aplikasi ini setelah dipindahkan.
                </span>
                <CustomButton v-if="studio.status.superadmin" :label="`Pindahkan aplikasi ke ${data.branchLokal}`" icon="PhArrowsLeftRight" outlined text-color="text-opensimrs-300" border-color="border-opensimrs-300" :disabled="sibuk || !!tugasBerjalan" @click="pindahkanAplikasi" />
              </div>
              <div class="flex flex-wrap gap-2">
                <CustomButton v-if="studio.boleh('Rilis', 'SIAPKAN')" :label="item.diterapkanPada ? 'Terapkan ulang (perbaikan terbaru)' : `Terapkan ke ${data.branchLokal}`" icon="PhArrowSquareIn" :outlined="!!item.diterapkanPada" :text-color="item.diterapkanPada ? 'text-opensimrs-300' : ''" :border-color="item.diterapkanPada ? 'border-opensimrs-300' : ''" :disabled="sibuk || !!(item.berkas ?? []).length" @click="aksi('terapkan')" />
                <CustomButton v-if="item.diterapkanPada && studio.boleh('Rilis', 'SIAPKAN')" label="Aktifkan di aplikasi" icon="PhToggleRight" outlined text-color="text-opensimrs-300" border-color="border-opensimrs-300" :disabled="sibuk" @click="aksi('aktifkan')" />
                <CustomButton v-if="item.diterapkanPada && studio.boleh('Rilis', 'DEPLOY')" label="Kirim ke server" icon="PhRocketLaunch" outlined text-color="text-opensimrs-300" border-color="border-opensimrs-300" @click="router.push('/studio/server')" />
                <CustomButton v-if="item.diterapkanPada && studio.boleh('Rilis', 'SIAPKAN')" label="Batalkan penerapan" icon="PhArrowCounterClockwise" outlined text-color="text-danger-300" border-color="border-danger-300" :disabled="sibuk" @click="dialogBatalTerapkan = true" />
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <CustomButton v-if="item.commitSha && data.modeRilis !== 'lokal' && studio.boleh('Coding', 'BUKA PR')" :label="item.prNomor ? 'Push commit baru' : 'Push & buat PR'" icon="PhCloudArrowUp" :disabled="sibuk" @click="aksi('push')" />
              <a v-if="item.prUrl" :href="item.prUrl" target="_blank" rel="noopener" class="flex items-center gap-1 rounded-lg bg-opensimrs-300 px-3 py-1.5 text-XS font-semibold text-white">
                <PhGitPullRequest :size="16" aria-hidden="true" /> {{ item.prNomor ? `Pull Request #${item.prNomor}` : "Buat Pull Request di GitHub" }}
              </a>
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" v-if="item.commitSha" label="Perbarui status PR/CI/tag" icon="PhArrowsClockwise" outlined :disabled="sibuk" @click="perbaruiRilis" />
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" v-if="item.prNomor && studio.boleh('Coding', 'JALANKAN AGEN')" label="Revisi dari komentar review" icon="PhChatCenteredText" outlined :disabled="sibuk || !!tugasBerjalan" @click="aksi('revisi-review')" />
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300"
                v-if="item.commitSha && (item.worktree || (item.branchAsal && data.branchSekarang === item.branch))"
                :label="item.worktree ? 'Hapus worktree' : `Kembali ke ${item.branchAsal}`"
                outlined
                :disabled="sibuk"
                @click="aksi('kembali-branch')"
              />
            </div>
            <div v-if="rincianCi.length" class="flex flex-wrap gap-1">
              <span v-for="c in rincianCi" :key="c.nama" class="rounded bg-grey-75 px-1.5 text-[10px] text-grey-500">{{ c.nama }}: {{ c.hasil ?? c.status }}</span>
            </div>
          </div>

          <!-- Dokumen tahap -->
          <div v-if="tahapDipilih !== 'coding'" class="rounded-lg border border-grey-200">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-grey-200 px-3 py-2">
              <div class="flex items-center gap-2 text-SM font-semibold text-grey-500">
                <PhFileText :size="18" class="text-opensimrs-300" aria-hidden="true" />
                {{ tahapDipilih === "qa" ? "Rencana uji" : tahapDipilih === "rilis" ? "Catatan rilis" : NAMA_TAHAP[tahapDipilih] }}
                <select
                  v-if="versiTahap(tahapDipilih).length > 1"
                  class="rounded border border-grey-200 px-1 text-XS font-normal"
                  :value="artefakTampil?.versi"
                  @change="versiDipilih[tahapDipilih] = Number(($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="a in versiTahap(tahapDipilih)" :key="a.uuid" :value="a.versi">versi {{ a.versi }} · {{ a.dibuatOleh === "agen" ? "AI" : a.dibuatOleh }}</option>
                </select>
                <span v-else-if="artefakTampil" class="text-XS font-normal text-grey-400">versi {{ artefakTampil.versi }}</span>
              </div>
              <div v-if="bolehKerja" class="flex gap-2">
                <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" :label="artefakTampil ? 'Sunting' : 'Tulis manual'" outlined icon="PhPencilSimple" :disabled="sibuk" @click="bukaSunting" />
                <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="AI tulis ulang" outlined icon="PhSparkle" :disabled="sibuk || !!tugasBerjalan" @click="mintaAgen" />
              </div>
            </div>
            <div v-if="artefakTampil?.dibuatOleh === 'agen-eksternal'" class="bg-info-50 px-3 py-1 text-[11px] text-info-400">Dikirim agen eksternal lewat MCP — periksa sebelum menyetujui.</div>
            <div v-if="artefakTampil?.dibuatOleh === 'agen'" class="flex items-center gap-2 bg-warning-50 px-3 py-1 text-[11px] text-warning-400">
              <PhWarning :size="14" aria-hidden="true" /> Dibuat AI — periksa sebelum menyetujui.
            </div>
            <div class="p-3">
              <Markdown v-if="artefakTampil" :isi="artefakTampil.isi" />
              <div v-else class="py-6 text-center text-SM text-grey-300">{{ tungguTugas ? `${tungguTugas}.` : tugasBerjalan ? "Agen sedang menulis…" : "Belum ada dokumen pada tahap ini." }}</div>
            </div>
          </div>

          <!-- Gerbang persetujuan -->
          <PanelGerbang
            v-if="diTahapAktif && data.gerbang.length"
            :gerbang="data.gerbang"
            :risiko="item.risiko"
            :sibuk="sibuk || !!tugasBerjalan"
            :label-setuju="LABEL_SETUJU[item.tahap]"
            :belum-siap="belumSiap"
            @setuju="(peran) => putuskan('setuju', peran)"
            @revisi="dialogKeputusan = 'revisi'"
            @tolak="dialogKeputusan = 'tolak'"
          />
        </div>

        <!-- Panel kanan -->
        <div class="flex flex-col gap-3">
          <div class="flex flex-col rounded-lg border border-grey-200">
            <div class="flex items-center gap-2 border-b border-grey-200 px-3 py-2 text-SM font-semibold text-grey-500">
              <PhChatsCircle :size="18" class="text-opensimrs-300" aria-hidden="true" /> Diskusi — {{ NAMA_TAHAP[tahapDipilih] }}
            </div>
            <div class="flex max-h-96 min-h-24 flex-col gap-2 overflow-auto p-3">
              <div
                v-for="p in pesanTahap"
                :key="p.uuid"
                class="max-w-[92%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-XS"
                :class="p.dari === 'ai' ? 'self-start bg-grey-75 text-grey-500' : p.dari === 'sistem' ? 'self-center bg-warning-50 text-warning-400' : 'self-end bg-opensimrs-300 text-white'"
              >
                {{ p.isi }}
                <div class="mt-0.5 text-[9px] opacity-70">{{ p.dari === "ai" ? (p.pengguna ? `AI (${p.pengguna})` : "AI") : p.pengguna ?? "Sistem" }} · {{ formatWaktu(p.createdAt) }}</div>
              </div>
              <div v-if="!pesanTahap.length" class="text-center text-XS text-grey-300">Belum ada diskusi.</div>
            </div>
            <div v-if="bolehKerja" class="flex flex-col gap-1.5 border-t border-grey-200 p-2">
              <textarea
                v-model="pesanBaru"
                rows="2"
                class="rounded border border-grey-200 px-2 py-1 text-XS"
                :placeholder="item.tahap === 'coding' ? 'Instruksi perbaikan untuk agen coding…' : 'Jawab pertanyaan AI atau beri arahan… (jangan masukkan data pasien)'"
                @keydown.ctrl.enter="kirimPesan"
              />
              <div class="flex items-center justify-between">
                <span class="text-[10px] text-grey-300">Ctrl+Enter untuk kirim</span>
                <CustomButton label="Kirim" icon="PhPaperPlaneRight" :disabled="sibuk || !!tugasBerjalan || !pesanBaru.trim()" @click="kirimPesan" />
              </div>
            </div>
          </div>

          <PanelLampiran :item-uuid="item.uuid" :lampiran="data.lampiran" :boleh-ubah="aktif && studio.boleh('Permintaan', ['CREATE', 'UPDATE'])" @berubah="muat" />

          <div class="rounded-lg border border-grey-200 p-3">
            <div class="mb-2 text-SM font-semibold text-grey-500">Riwayat keputusan</div>
            <div v-for="p in data.persetujuan" :key="p.uuid" class="flex items-start gap-2 py-1 text-XS">
              <PhSealCheck v-if="p.keputusan === 'setuju'" :size="16" weight="fill" class="mt-[1px] shrink-0 text-success-300" aria-hidden="true" />
              <PhArrowCounterClockwise v-else-if="p.keputusan === 'revisi'" :size="16" class="mt-[1px] shrink-0 text-warning-300" aria-hidden="true" />
              <PhArrowBendUpLeft v-else-if="p.keputusan === 'mundur'" :size="16" class="mt-[1px] shrink-0 text-warning-300" aria-hidden="true" />
              <PhArrowUUpLeft v-else-if="p.keputusan === 'buka'" :size="16" class="mt-[1px] shrink-0 text-opensimrs-300" aria-hidden="true" />
              <PhXCircle v-else :size="16" weight="fill" class="mt-[1px] shrink-0 text-danger-300" aria-hidden="true" />
              <div>
                <div class="font-semibold text-grey-500">{{ NAMA_TAHAP[p.tahap] }} — {{ LABEL_KEPUTUSAN[p.keputusan] ?? p.keputusan }}<span v-if="p.peran" class="font-normal text-grey-400"> ({{ p.peran }})</span></div>
                <div v-if="p.alasan" class="text-grey-400">{{ p.alasan }}</div>
                <div class="text-grey-300">{{ p.pengguna }} · {{ formatWaktu(p.createdAt) }}</div>
              </div>
            </div>
            <div v-if="!data.persetujuan.length" class="text-XS text-grey-300">Belum ada keputusan.</div>
          </div>

          <div class="rounded-lg border border-grey-200 p-3 text-XS text-grey-500">
            <div class="mb-1 text-SM font-semibold">Permintaan awal</div>
            <div v-if="item.permintaan?.masalah"><b>Masalah:</b> {{ item.permintaan.masalah }}</div>
            <div v-if="item.permintaan?.siapa"><b>Terdampak:</b> {{ item.permintaan.siapa }}</div>
            <div v-if="item.permintaan?.harapan"><b>Harapan:</b> {{ item.permintaan.harapan }}</div>
            <div v-if="item.permintaan?.contoh"><b>Contoh:</b> {{ item.permintaan.contoh }}</div>
            <div class="mt-2 text-grey-400">Dibuat {{ formatWaktu(item.createdAt) }}</div>
            <div v-if="aktif && studio.boleh('Permintaan', ['BATAL', 'TRIASE'])" class="mt-2 flex gap-2">
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Tunda" outlined icon="PhPause" :disabled="sibuk || !!tugasBerjalan" @click="aksi('tunda', { alasan: 'Ditunda dari halaman item' })" />
              <CustomButton v-if="studio.boleh('Permintaan', 'BATAL')" label="Batalkan item" outlined text-color="text-danger-300" border-color="border-danger-300" :disabled="sibuk || !!tugasBerjalan" @click="dialogKeputusan = 'tolak'" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </Card>

  <Dialog :visible="!!dialogKeputusan" modal :header="dialogKeputusan === 'revisi' ? 'Minta revisi' : 'Tolak / batalkan item'" :style="{ width: '30rem' }" @update:visible="dialogKeputusan = null">
    <div class="flex flex-col gap-2 text-SM text-grey-500">
      <template v-if="dialogKeputusan === 'revisi'">
        <label class="flex flex-col gap-1 text-XS">
          <span class="font-semibold">Kembali ke tahap</span>
          <select v-model="keTahap" class="rounded border border-grey-200 px-2 py-1.5 text-SM">
            <option v-for="t in tahapBisaMundur" :key="t.kode" :value="t.kode">{{ t.nama }}{{ t.kode === item?.tahap ? " (tahap ini)" : "" }}</option>
          </select>
        </label>
        <p v-if="keTahap && keTahap !== item?.tahap" class="text-XS text-warning-400">
          Item kembali ke <b>{{ NAMA_TAHAP[keTahap] }}</b>; agen menulis ulang dokumen itu sesuai alasan Anda. Tahap itu dan tahap sesudahnya
          perlu disetujui ulang. Kode yang sudah ada di branch item tidak dihapus dan dipakai lagi saat coding diulang.
        </p>
        <p v-else>{{ item?.tahap === "qa" ? "Temuan QA dikirim ke agen coding; item kembali ke tahap Coding." : "Agen akan merevisi dokumen/kode tahap ini sesuai alasan Anda." }}</p>
      </template>
      <div v-else class="rounded-lg bg-danger-50 p-2 text-XS text-danger-400">
        <b>Tolak membatalkan item ini.</b> Bila hanya perlu perbaikan (mis. PRD kurang lengkap), gunakan <b>Minta revisi</b> dan pilih tahap tujuannya.
        Item yang dibatalkan masih bisa dibuka kembali oleh superadmin; branch & berkas yang belum di-commit tidak dihapus.
      </div>
      <textarea v-model="alasan" rows="4" class="rounded-lg border border-grey-200 px-2 py-1.5 text-SM" placeholder="Alasan / apa yang perlu diperbaiki" />
    </div>
    <template #footer>
      <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Batal" outlined @click="dialogKeputusan = null" />
      <CustomButton
        :label="dialogKeputusan === 'revisi' ? 'Kirim revisi' : 'Tolak'"
        :disabled="!alasan.trim() || sibuk"
        @click="dialogKeputusan === 'tolak' && !data.gerbang.some((g: any) => g.bisa) ? aksi('batal', { alasan }).then(() => (dialogKeputusan = null)) : putuskan(dialogKeputusan!)"
      />
    </template>
  </Dialog>

  <Dialog v-model:visible="dialogBuka" modal header="Buka kembali item" :style="{ width: '30rem' }">
    <div class="flex flex-col gap-2 text-SM text-grey-500">
      <label class="flex flex-col gap-1 text-XS">
        <span class="font-semibold">Lanjutkan dari tahap</span>
        <select v-model="buka.keTahap" class="rounded border border-grey-200 px-2 py-1.5 text-SM">
          <option value="">{{ item?.tahapSebelum ? `${NAMA_TAHAP[item.tahapSebelum]} (tahap saat dibatalkan)` : "Tahap keputusan terakhir" }}</option>
          <option v-for="t in TAHAP.filter((x) => x.kode !== 'rilis')" :key="t.kode" :value="t.kode">{{ t.nama }}</option>
        </select>
      </label>
      <textarea v-model="buka.alasan" rows="3" class="rounded-lg border border-grey-200 px-2 py-1.5 text-SM" placeholder="Alasan dibuka kembali / apa yang perlu diperbaiki (dipakai sebagai instruksi agen)" />
      <label class="flex items-start gap-2 text-XS">
        <input v-model="buka.jalankanAgen" type="checkbox" class="mt-0.5" />
        <span>Minta agen menulis ulang dokumen tahap itu sesuai alasan (hanya untuk tahap dokumen; tahap Coding dijalankan dari panel Coding).</span>
      </label>
      <div class="text-XS text-grey-400">Tahap tujuan dan tahap sesudahnya perlu disetujui ulang. Branch & kode item tetap.</div>
    </div>
    <template #footer>
      <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Batal" outlined @click="dialogBuka = false" />
      <CustomButton label="Buka kembali" icon="PhArrowUUpLeft" :disabled="!buka.alasan.trim() || sibuk" @click="bukaKembali" />
    </template>
  </Dialog>

  <Dialog v-model:visible="dialogSunting" modal header="Sunting dokumen (versi baru)" :style="{ width: '60rem' }">
    <textarea v-model="isiSunting" rows="24" class="w-full rounded-lg border border-grey-200 p-2 font-mono text-XS" />
    <template #footer>
      <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Batal" outlined @click="dialogSunting = false" />
      <CustomButton label="Simpan sebagai versi baru" :disabled="!isiSunting.trim() || sibuk" @click="simpanSunting" />
    </template>
  </Dialog>

  <Dialog v-model:visible="dialogBatalTerapkan" modal header="Batalkan penerapan lokal" :style="{ width: '30rem' }">
    <div class="flex flex-col gap-2 text-SM text-grey-500">
      <p>Perubahan item dibalik di branch <b>{{ item?.branchLokal }}</b> dengan commit revert. Migrasi database <b>tidak</b> dibalik otomatis.</p>
      <textarea v-model="alasanBatal" rows="3" class="rounded-lg border border-grey-200 px-2 py-1.5 text-SM" placeholder="Alasan pembatalan" />
    </div>
    <template #footer>
      <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Batal" outlined @click="dialogBatalTerapkan = false" />
      <CustomButton label="Batalkan penerapan" :disabled="!alasanBatal.trim() || sibuk" @click="batalTerapkan" />
    </template>
  </Dialog>

  <Dialog v-model:visible="dialogTriase" modal header="Triase item" :style="{ width: '32rem' }">
    <div class="flex flex-col gap-2 text-SM text-grey-500">
      <template v-if="studio.boleh('Permintaan', 'TRIASE')">
        <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Judul</span><input v-model="triase.judul" class="rounded border border-grey-200 px-2 py-1.5" /></label>
        <div class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Prioritas</span>
            <select v-model="triase.prioritas" class="rounded border border-grey-200 px-2 py-1.5"><option>P1</option><option>P2</option><option>P3</option></select></label>
          <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Jenis</span>
            <select v-model="triase.jenis" class="rounded border border-grey-200 px-2 py-1.5"><option v-for="(n, k) in NAMA_JENIS" :key="k" :value="k">{{ n }}</option></select></label>
        </div>
        <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Modul terdampak (pisahkan koma)</span><input v-model="triase.modul" class="rounded border border-grey-200 px-2 py-1.5" placeholder="Laboratorium, Rawat Jalan" /></label>
      </template>
      <template v-if="studio.boleh('PRD', 'TETAPKAN RISIKO')">
        <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Tingkat risiko (batas bawah otomatis: {{ item?.risikoMin }}<template v-if="studio.status.superadmin"> — superadmin boleh menurunkan bila deteksi keliru</template>)</span>
          <select v-model="triase.risiko" class="rounded border border-grey-200 px-2 py-1.5"><option v-for="r in ['rendah', 'sedang', 'tinggi', 'kritis']" :key="r" :value="r">{{ r }}</option></select></label>
        <label v-if="triase.risiko !== item?.risiko" class="flex flex-col gap-1"><span class="text-XS font-semibold">Alasan perubahan risiko</span><input v-model="triase.alasanRisiko" class="rounded border border-grey-200 px-2 py-1.5" /></label>
      </template>
    </div>
    <template #footer>
      <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Batal" outlined @click="dialogTriase = false" />
      <CustomButton label="Simpan" :disabled="sibuk || (triase.risiko !== item?.risiko && !triase.alasanRisiko.trim())" @click="simpanTriase" />
    </template>
  </Dialog>

  <Dialog v-model:visible="dialogPrompt" modal :header="`Prompt efektif — ${NAMA_TAHAP[prompt?.tahap] ?? ''}`" :style="{ width: '64rem' }">
    <div v-if="prompt" class="flex flex-col gap-2">
      <div class="text-XS font-semibold text-grey-500">1. Aturan platform (tetap)</div>
      <pre class="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-grey-50 p-2 text-[11px] text-grey-500">{{ prompt.aturanPlatform }}</pre>
      <div class="text-XS font-semibold text-grey-500">2. Aturan repo — CLAUDE.md & CONTRIBUTING.md dibaca otomatis oleh agen</div>
      <div class="text-XS font-semibold text-grey-500">3–6. Aturan instalasi, area, template tahap, pengetahuan, konteks item</div>
      <pre class="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded bg-grey-50 p-2 text-[11px] text-grey-500">{{ prompt.prompt }}</pre>
    </div>
  </Dialog>
</template>
