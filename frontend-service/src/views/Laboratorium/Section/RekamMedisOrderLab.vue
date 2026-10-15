<script setup lang="ts">
import { nextTick, ref } from "vue";
import { useToast } from "primevue/usetoast";
import MedicalRecord from "@/views/MedicalRecord/MedicalRecord.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { useRekamMedisPelayananStore } from "@/stores/rekamMedis/rekamMedisPelayanan";
import { useAdmisiRJStore } from "@/stores/admisi/rawatJalan";

// Rekam medis pasien dari sebuah order lab (Order Lab, Hasil Pemeriksaan, Expertise).
// Kandidat = kunjungan rawat jalan 90 hari terakhir + riwayat kunjungan berdasarkan No. RM; kunjungan dengan
// No. Reg order didahulukan. Rekam medis pertama yang dapat dimuat dibuka dalam mode riwayat (baca saja).
// Membuka MedicalRecord dengan patientData kosong hanya menampilkan backdrop, jadi data disiapkan dulu.
const stores = utilsStore();
const toast = useToast();
const rekamMedisStore = useRekamMedisStore();
const rekamMedisPelayananStore = useRekamMedisPelayananStore();
const admisiRJStore = useAdmisiRJStore();

const medicalRecord = ref<typeof MedicalRecord>();
const rmPatientData = ref<any>(null);
const rmType = ref("rawat-jalan");

type Kandidat = { rekamMedisUuid: string; tanggal: number; noReg: string; tipe: string; data: () => Promise<any> };

const buka = async (order: any) => {
  order = order ?? {};
  const pesan = (detail: string) => toast.add({ severity: "warn", summary: "Rekam Medis", detail, life: 4000 });
  const noRm = order.noRm ?? order.patient?.noRm;
  const noReg = order.noreg ?? order.noReg;
  if (!noRm) return pesan("No. RM pasien tidak ditemukan pada order ini.");

  stores.setLoading(true);
  try {
    const sekarang = Math.floor(Date.now() / 1000);
    const [rjAktif, riwayat] = await Promise.all([
      admisiRJStore
        .getRJ({ q: noRm, limit: 10, startDate: String(sekarang - 90 * 86400), endDate: String(sekarang + 86400) })
        .catch(() => null),
      rekamMedisPelayananStore.getHistory(noRm).catch(() => null),
    ]);

    const kandidat: Kandidat[] = [
      ...(rjAktif?.payload ?? [])
        .filter((v: any) => v.noRm === noRm && v.rekamMedisUuid)
        .map((v: any) => ({
          rekamMedisUuid: v.rekamMedisUuid,
          tanggal: Number(v.tanggalDaftar),
          noReg: v.noReg,
          tipe: "rawat-jalan",
          data: async () => (await admisiRJStore.getDetailRJ(v.uuid))?.payload ?? v,
        })),
      ...(riwayat?.payload ?? [])
        .filter((v: any) => v.rekamMedisUuid)
        .map((v: any) => ({
          rekamMedisUuid: v.rekamMedisUuid,
          tanggal: Number(v.tanggalDaftar),
          noReg: v.noReg,
          tipe: v.statusRi !== undefined ? "rawat-inap" : v.statusIgd !== undefined ? "igd" : "rawat-jalan",
          data: async () => v,
        })),
    ].sort((a, b) => {
      const cocokA = noReg && a.noReg === noReg ? 1 : 0;
      const cocokB = noReg && b.noReg === noReg ? 1 : 0;
      return cocokB - cocokA || b.tanggal - a.tanggal;
    });
    if (!kandidat.length) return pesan("Pasien belum memiliki rekam medis kunjungan (mis. pasien APS/luar).");

    // sebagian kunjungan lama merujuk rekam medis yang sudah tidak ada (404): coba kandidat berikutnya
    let kunjungan: Kandidat | null = null;
    let response: any = null;
    const sudahDicoba = new Set<string>();
    for (const item of kandidat) {
      if (sudahDicoba.has(item.rekamMedisUuid)) continue;
      sudahDicoba.add(item.rekamMedisUuid);
      try {
        response = await rekamMedisStore.getRekamMedis({ rekamMedisUuid: item.rekamMedisUuid });
      } catch {
        response = null;
      }
      if (response?.payload) {
        kunjungan = item;
        break;
      }
    }
    if (!kunjungan) return pesan("Rekam medis kunjungan pasien tidak dapat dimuat.");

    const dataKunjungan = await kunjungan.data();
    rmType.value = kunjungan.tipe;
    rmPatientData.value = {
      ...dataKunjungan,
      patient: dataKunjungan.patient ?? order.patient,
      noRm,
      rekamMedisUuid: response.payload.meta?.rekamMedisUuid ?? kunjungan.rekamMedisUuid,
    };
    // MedicalRecord memilih sesi lewat watch pada data rekam medis di store:
    // pasang komponennya dulu, baru isi data rekam medis, lalu buka dialog
    await nextTick();
    rekamMedisStore.setOpenedRekamMedisData(response.payload);
    await nextTick();
    medicalRecord.value?.showDialogRM();
  } catch (error) {
    console.error("Gagal membuka rekam medis:", error);
    pesan("Terjadi kesalahan saat memuat rekam medis.");
  } finally {
    stores.setLoading(false);
  }
};

defineExpose({ buka });
</script>

<template>
  <MedicalRecord
    v-if="rmPatientData"
    ref="medicalRecord"
    :key="rmPatientData.rekamMedisUuid"
    :patientData="rmPatientData"
    :rmType="rmType"
    viewMode="history"
  />
</template>
