<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { fiturAktif } from "@/stores/modulFaskes";
import { izinGaji } from "@/stores/penunjang/penggajian";
import { computed } from "vue";
import { bolehKehadiran } from "@/stores/penunjang/kehadiranCuti";

// HR / SDM (penunjang-service /hr, STD-0035, STD-0038, STD-0039, STD-0040, dan STD-0041): kepegawaian, kredensial,
// kehadiran & cuti, pelatihan, jadwal dinas, dan penggajian. Menu disaring izin oleh Sidebar dan status fitur katalog.
const sidebarBodyList = computed<SidebarBody[]>(() => [
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      ...(fiturAktif("sdm_kepegawaian") ? [{ name: "Kepegawaian", icon: "PhUsersThree", type: linkType.LINK, url: "/sdm/kepegawaian" }] : []),
      ...(fiturAktif("sdm_kehadiran") && bolehKehadiran("READ") ? [
        { name: "Kehadiran Saya", icon: "PhClock", type: linkType.LINK, url: "/sdm/kehadiran/saya" },
        { name: "Pengajuan Cuti/Izin", icon: "PhCalendar", type: linkType.LINK, url: "/sdm/cuti/pengajuan" },
        ...(bolehKehadiran("IMPOR") ? [{ name: "Impor Absensi", icon: "PhUpload", type: linkType.LINK, url: "/sdm/kehadiran/impor" }] : []),
        ...(bolehKehadiran("TINJAU ATASAN") || bolehKehadiran("SAHKAN SDM") ? [{ name: "Persetujuan Cuti/Izin", icon: "PhCheck", type: linkType.LINK, url: "/sdm/cuti/persetujuan" }] : []),
        ...(bolehKehadiran("ATUR JENIS KEBIJAKAN") || bolehKehadiran("ATUR CAKUPAN") || bolehKehadiran("SESUAIKAN SALDO") ? [{ name: "Pengaturan Cuti", icon: "PhGear", type: linkType.LINK, url: "/sdm/cuti/pengaturan" }] : []),
        ...(bolehKehadiran("LIHAT REKAP") || bolehKehadiran("EKSPOR REKAP") || bolehKehadiran("KOREKSI") ? [{ name: "Rekap Kehadiran", icon: "PhTable", type: linkType.LINK, url: "/sdm/kehadiran/rekap" }] : []),
      ] : []),
      ...(fiturAktif("sdm_kredensial") ? [{ name: "Kredensial", icon: "PhIdentificationCard", type: linkType.LINK, url: "/sdm/kredensial" }] : []),
      ...(fiturAktif("sdm_pelatihan") ? [{ name: "Pelatihan", icon: "PhGraduationCap", type: linkType.LINK, url: "/sdm/pelatihan" }] : []),
      ...(fiturAktif("sdm_jadwal_dinas") ? [
        { name: "Jadwal Dinas", icon: "PhCalendar", type: linkType.LINK, url: "/sdm/jadwal-dinas" },
        { name: "Pola Shift", icon: "PhClock", type: linkType.LINK, url: "/sdm/pola-shift" },
        { name: "Jadwal Saya", icon: "PhCalendar", type: linkType.LINK, url: "/sdm/jadwal-saya" },
        { name: "Tukar Dinas", icon: "PhArrowsLeftRight", type: linkType.LINK, url: "/sdm/tukar-dinas" },
      ] : []),
      ...(fiturAktif("sdm_penggajian") && fiturAktif("akuntansi_jurnal") && fiturAktif("akuntansi_remunerasi") && (izinGaji("komponen")) ? [{ name: "Komponen Penggajian", icon: "PhMoney", type: linkType.LINK, url: "/sdm/penggajian/komponen" }] : []),
      ...(fiturAktif("sdm_penggajian") && fiturAktif("akuntansi_jurnal") && fiturAktif("akuntansi_remunerasi") && (izinGaji("konfigurasi") || izinGaji("rekening")) ? [{ name: "Konfigurasi Penggajian", icon: "PhMoney", type: linkType.LINK, url: "/sdm/penggajian/konfigurasi" }] : []),
      ...(fiturAktif("sdm_penggajian") && fiturAktif("akuntansi_jurnal") && fiturAktif("akuntansi_remunerasi") && (izinGaji("periode") || izinGaji("verifikasi") || izinGaji("persetujuan") || izinGaji("pembayaran") || izinGaji("administratif")) ? [{ name: "Periode Penggajian", icon: "PhMoney", type: linkType.LINK, url: "/sdm/penggajian/periode" }] : []),
      ...(fiturAktif("sdm_penggajian") && fiturAktif("akuntansi_jurnal") && fiturAktif("akuntansi_remunerasi") && (izinGaji("slip")) ? [{ name: "Slip Penggajian", icon: "PhMoney", type: linkType.LINK, url: "/sdm/penggajian/slip" }] : []),
      ...(fiturAktif("sdm_penggajian") && fiturAktif("akuntansi_jurnal") && fiturAktif("akuntansi_remunerasi") && (izinGaji("rekap") || izinGaji("ekspor")) ? [{ name: "Rekap Penggajian", icon: "PhMoney", type: linkType.LINK, url: "/sdm/penggajian/rekap" }] : []),
    ],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="HR / SDM" sidebarTitleUrl="/sdm" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
