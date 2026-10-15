<script setup lang="ts">
// SOAP Ringkas (1 layar) — fitur Manajemen Modul `rme_soap_ringkas`, untuk praktik mandiri.
// Menyimpan lewat endpoint yang sama dengan RME lengkap (anamnesis, tanda_vital, antropometri,
// pemeriksaan_fisik, diagnosis_dokter, order obat, tindakan, resume & discharge) sehingga resume,
// SATUSEHAT, tagihan kasir & antrean farmasi tetap berjalan.
import { computed, onBeforeMount, ref, watch } from "vue";
import { useToast } from "primevue/usetoast";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import FormOrderObat from "@/components/RekamMedis/OrderObat/AccordionOrderObat.vue";
import PemeriksaanTindakan from "@/components/RekamMedis/PemeriksaanTindakan/PemeriksaanTindakan.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { useRekamMedisPelayananStore } from "@/stores/rekamMedis/rekamMedisPelayanan";
import { useDiagnosisStore } from "@/stores/datamaster/diagnosis";

const props = defineProps({
  rmUuid: { type: String, default: "" },
  sessionUuid: { type: String, default: "" },
  patientData: { type: Object as () => any, default: () => ({}) },
  lokasiUuid: { type: String, default: "" },
});
const emit = defineEmits(["refreshPatientData", "selesai"]);

const toast = useToast();
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();
const pelayananStore = useRekamMedisPelayananStore();
const diagnosisStore = useDiagnosisStore();

// ── Form ─────────────────────────────────────────────────────────────────
const keluhanUtama = ref("");
const riwayatPenyakit = ref("");
// Alergi: "" = belum ditanyakan (tidak disimpan), "tidak" / "ya".
const alergi = ref<"" | "tidak" | "ya">("");
const pemicuAlergi = ref("");
const namaAlergi = ref("");
const reaksiAlergi = ref("");
const sistole = ref<number | null>(null);
const diastole = ref<number | null>(null);
const nadi = ref<number | null>(null);
const suhu = ref<number | null>(null);
const nafas = ref<number | null>(null);
const spo2 = ref<number | null>(null);
const beratBadan = ref<number | null>(null);
const tinggiBadan = ref<number | null>(null);
const keadaanUmum = ref("baik");
const pemeriksaanFisik = ref("");
const diagnosisPrimer = ref<any>(null);
const diagnosisSekunder = ref<any[]>([]);
const statusPulang = ref("home");
const tujuanRujuk = ref("HOSP");
const instruksiTindakLanjut = ref("");

const listDiagnosis = ref<any[]>([]);
const percobaanSelesai = ref(false);
const konfirmasiSelesai = ref(false);

const opsiAlergi = [
  { label: "Belum ditanyakan", value: "" },
  { label: "Tidak ada alergi", value: "tidak" },
  { label: "Ada alergi", value: "ya" },
];
const opsiPemicuAlergi = ["Obat", "Makanan", "Lingkungan", "Airbone", "Sengatan Serangga", "Lateks / Zat lain yang disentuh"]
  .map((x) => ({ label: x, value: x }));
const opsiKeadaanUmum = [
  { label: "Baik", value: "baik" },
  { label: "Ringan", value: "ringan" },
  { label: "Sedang", value: "sedang" },
  { label: "Buruk", value: "buruk" },
];
const opsiStatusPulang = [
  { label: "Pulang (atas persetujuan dokter)", value: "home" },
  { label: "Pulang atas permintaan sendiri", value: "aadvice" },
  { label: "Dirujuk", value: "other-hfc" },
];
const opsiTujuanRujuk = [
  { label: "Rumah Sakit", value: "HOSP" },
  { label: "Klinik / Puskesmas", value: "PC" },
  { label: "Poli lain", value: "OF" },
];

const data = computed(() => rekamMedisStore.openedRekamMedis?.data ?? {});
const angka = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));
const tanpaMeta = (o: any) => {
  const { updatedAt, createdAt, petugas, _id, id, ...sisa } = o ?? {};
  return sisa;
};

const isiDariRekamMedis = () => {
  const d = data.value;
  keluhanUtama.value = d.anamnesis?.keluhanUtama ?? "";
  riwayatPenyakit.value = d.anamnesis?.riwayatPenyakit ?? "";
  alergi.value = d.alergi ? (d.alergi.isAlergi ? "ya" : "tidak") : "";
  pemicuAlergi.value = d.alergi?.pemicuAlergi ?? "";
  namaAlergi.value = d.alergi?.namaAlergi ?? "";
  reaksiAlergi.value = d.alergi?.reaksiAlergi ?? "";
  sistole.value = angka(d.tandaVital?.tekananDarahSistole);
  diastole.value = angka(d.tandaVital?.tekananDarahDiastole);
  nadi.value = angka(d.tandaVital?.frekuensiNadi);
  suhu.value = angka(d.tandaVital?.suhu);
  nafas.value = angka(d.tandaVital?.frekuensiNafas);
  spo2.value = angka(d.tandaVital?.bloodOxygen);
  beratBadan.value = angka(d.antropometri?.beratBadan);
  tinggiBadan.value = angka(d.antropometri?.tinggiBadan);
  keadaanUmum.value = d.pemeriksaanFisik?.keadaanUmum || "baik";
  pemeriksaanFisik.value = d.pemeriksaanFisik?.ketPemeriksaanLainnya ?? "";
  const dx: any[] = Array.isArray(d.diagnosisDokter) ? d.diagnosisDokter : [];
  const cari = (uuid: string, nama: string) =>
    listDiagnosis.value.find((x) => x.uuid === uuid) ?? (uuid ? { uuid, name: nama, label: nama } : null);
  const primer = dx.find((x) => x.tipe === "primer");
  diagnosisPrimer.value = primer ? cari(primer.diagnosisUuid, primer.diagnosis) : null;
  diagnosisSekunder.value = dx.filter((x) => x.tipe === "sekunder").map((x) => cari(x.diagnosisUuid, x.diagnosis)).filter(Boolean);
};

onBeforeMount(async () => {
  try {
    const res: any = await diagnosisStore.exportApi();
    // Label "kode — nama" agar dokter bisa mengenali & mencari kode ICD-10.
    listDiagnosis.value = (res?.payload ?? []).map((x: any) => ({ ...x, label: x.code ? `${x.code} — ${x.name}` : x.name }));
  } catch (error) {
    console.error("Gagal memuat daftar diagnosis", error);
  }
  isiDariRekamMedis();
});
watch(() => rekamMedisStore.openedRekamMedis, isiDariRekamMedis);

const imt = computed(() =>
  beratBadan.value && tinggiBadan.value ? +(beratBadan.value / (tinggiBadan.value / 100) ** 2).toFixed(1) : null
);

// ── Simpan ───────────────────────────────────────────────────────────────
const simpanBagian = async (key: string, isi: any) => {
  const res: any = await rekamMedisStore.insertAssesment({
    sessionUuid: props.sessionUuid,
    rekamMedisUuid: props.rmUuid,
    isLatest: !!rekamMedisStore.openedRekamMedis.isLatest,
    key,
    data: isi,
  }, { diam: true });
  if (res?.payload) rekamMedisStore.setAsesmentSummaryRekamMedisData(res.payload);
  return res;
};

const adaTandaVital = () => [sistole, diastole, nadi, suhu, nafas, spo2].some((r) => r.value !== null);

const simpanSoap = async () => {
  const d = data.value;
  const langkah: Array<() => Promise<any>> = [];
  if (keluhanUtama.value || riwayatPenyakit.value) {
    langkah.push(() => simpanBagian("anamnesis", {
      anamnesis: "Auto Anamnesa",
      riwayatKeluarga: "",
      pernahDirawat: false,
      ...tanpaMeta(d.anamnesis),
      keluhanUtama: keluhanUtama.value,
      riwayatPenyakit: riwayatPenyakit.value,
    }));
  }
  if (alergi.value) {
    const ada = alergi.value === "ya";
    langkah.push(() => simpanBagian("alergi", {
      tingkatKeparahanAlergi: "",
      efekSampingAlergi: "",
      ...tanpaMeta(d.alergi),
      tanggalKejadianAlergi: d.alergi?.tanggalKejadianAlergi ?? Math.floor(Date.now() / 1000),
      isAlergi: ada,
      pemicuAlergi: ada ? pemicuAlergi.value : "",
      namaAlergi: ada ? namaAlergi.value : "",
      reaksiAlergi: ada ? reaksiAlergi.value : "",
    }));
  }
  if (adaTandaVital()) {
    langkah.push(() => simpanBagian("tanda_vital", {
      kriteriaPemantauan: "Checkup",
      crt: false,
      oksigenTambahan: false,
      ...tanpaMeta(d.tandaVital),
      waktuAsesmen: d.tandaVital?.waktuAsesmen ?? Math.floor(Date.now() / 1000),
      tekananDarahSistole: sistole.value,
      tekananDarahDiastole: diastole.value,
      frekuensiNadi: nadi.value,
      suhu: suhu.value,
      frekuensiNafas: nafas.value,
      bloodOxygen: spo2.value,
    }));
  }
  if (beratBadan.value !== null || tinggiBadan.value !== null) {
    langkah.push(() => simpanBagian("antropometri", {
      ...tanpaMeta(d.antropometri),
      beratBadan: beratBadan.value,
      tinggiBadan: tinggiBadan.value,
      imt: imt.value,
    }));
  }
  if (pemeriksaanFisik.value || d.pemeriksaanFisik || keadaanUmum.value !== "baik") {
    langkah.push(() => simpanBagian("pemeriksaan_fisik", {
      ...tanpaMeta(d.pemeriksaanFisik),
      keadaanUmum: keadaanUmum.value,
      pemeriksaanLainnya: !!pemeriksaanFisik.value,
      ketPemeriksaanLainnya: pemeriksaanFisik.value,
      gambarPemeriksaanLainnya: d.pemeriksaanFisik?.gambarPemeriksaanLainnya ?? "",
    }));
  }
  if (diagnosisPrimer.value) {
    const baris = (dx: any, tipe: string) => ({
      diagnosisUuid: dx.uuid, diagnosis: dx.name, diferensialUuid: "", diferensial: "", tipe,
    });
    langkah.push(() => simpanBagian("diagnosis_dokter", [
      baris(diagnosisPrimer.value, "primer"),
      ...diagnosisSekunder.value.filter((x) => x?.uuid !== diagnosisPrimer.value.uuid).map((x) => baris(x, "sekunder")),
    ]));
  }
  // Berurutan: setiap simpan memperbarui ringkasan sesi yang sama.
  for (const jalan of langkah) {
    const res = await jalan();
    if (!res?.payload) throw new Error("Gagal menyimpan rekam medis");
  }
  return langkah.length;
};

const onSimpan = async () => {
  try {
    storeUtils.setLoading(true);
    const n = await simpanSoap();
    toast.add({ severity: "success", summary: "Tersimpan", detail: n ? "SOAP disimpan." : "Belum ada isian.", life: 2500 });
  } catch (error) {
    console.error(error);
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Selesai: simpan SOAP → resume (status pulang) → discharge ─────────────
const kurang = computed(() => {
  const k: string[] = [];
  if (!keluhanUtama.value.trim()) k.push("Keluhan utama");
  if (!diagnosisPrimer.value) k.push("Diagnosis primer");
  return k;
});

const mintaSelesai = () => {
  percobaanSelesai.value = true;
  if (kurang.value.length) {
    toast.add({ severity: "warn", summary: "Belum lengkap", detail: `${kurang.value.join(" dan ")} wajib diisi.`, life: 4000 });
    return;
  }
  konfirmasiSelesai.value = true;
};

const onSelesai = async () => {
  konfirmasiSelesai.value = false;
  const sekarang = Math.floor(Date.now() / 1000);
  const dirujuk = statusPulang.value === "other-hfc";
  try {
    storeUtils.setLoading(true);
    await simpanSoap();
    const resume: any = await pelayananStore.putResumeMedis({
      rekamMedisUuid: props.rmUuid,
      pelayanan: "rj",
      edukasi: "",
      edukasiText: "",
      kondisiPasienPulang: "",
      statusPulang: statusPulang.value,
      statusPulangKeterangan: "",
      dischargeDate: sekarang,
      isInternal: false,
      rujukInternal: "",
      rujukEksternal: dirujuk ? "Rawat Jalan" : "",
      instruksiTindakLanjut: dirujuk ? instruksiTindakLanjut.value : "",
      tujuanRujuk: dirujuk ? tujuanRujuk.value : "",
      tujuanRujukLainnya: "",
      transportRujuk: "",
      transportRujukLainnya: "",
      instruksiNoDarurat: "",
    });
    if (!resume) return;
    const res: any = await pelayananStore.discharge({
      pelayanan: "rj",
      rekamMedisUuid: props.rmUuid,
      lokasiUuid: rekamMedisStore.openedRekamMedis?.meta?.lokasiUuid ?? props.lokasiUuid,
      dischargeDate: sekarang,
    });
    if (!res) return;
    toast.add({ severity: "success", summary: "Pelayanan selesai", detail: "Tagihan diteruskan ke kasir; resep (bila ada) masuk antrean farmasi.", life: 4000 });
    emit("refreshPatientData");
    emit("selesai");
  } catch (error) {
    console.error(error);
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="overflow-auto grow pr-2 pb-6">
    <div class="grid gap-4 xl:grid-cols-2">
      <!-- S -->
      <section class="rounded-lg border border-grey-200 p-4">
        <h3 class="mb-3 font-semibold text-opensimrs-300">S — Subjektif</h3>
        <CustomTextArea
          v-model="keluhanUtama"
          label="Keluhan Utama"
          placeholder="Mis. demam 3 hari, batuk berdahak"
          :required="true"
          :invalid="percobaanSelesai && !keluhanUtama.trim()"
          invalidMessage="Keluhan utama wajib diisi"
        />
        <CustomTextArea v-model="riwayatPenyakit" class="mt-3" label="Riwayat Penyakit Sekarang" placeholder="Opsional" />
        <CustomSelect
          v-model="alergi"
          class="mt-3"
          label="Alergi"
          :options="opsiAlergi"
          optionLabel="label"
          optionValue="value"
          :showFilter="false"
        />
        <div v-if="alergi === 'ya'" class="mt-3 grid gap-3 md:grid-cols-3">
          <CustomSelect
            v-model="pemicuAlergi"
            label="Pemicu"
            :options="opsiPemicuAlergi"
            optionLabel="label"
            optionValue="value"
            :showFilter="false"
          />
          <CustomTextArea v-model="namaAlergi" label="Nama Alergen" placeholder="Mis. amoksisilin" />
          <CustomTextArea v-model="reaksiAlergi" label="Reaksi" placeholder="Mis. gatal, sesak" />
        </div>
      </section>

      <!-- O -->
      <section class="rounded-lg border border-grey-200 p-4">
        <h3 class="mb-3 font-semibold text-opensimrs-300">O — Objektif</h3>
        <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
          <CustomInputNumber v-model="sistole" label="TD Sistole (mmHg)" :min="0" :max="300" />
          <CustomInputNumber v-model="diastole" label="TD Diastole (mmHg)" :min="0" :max="200" />
          <CustomInputNumber v-model="nadi" label="Nadi (x/mnt)" :min="0" :max="300" />
          <CustomInputNumber v-model="suhu" label="Suhu (°C)" :min="30" :max="45" :maxFractionDigits="1" />
          <CustomInputNumber v-model="nafas" label="Napas (x/mnt)" :min="0" :max="100" />
          <CustomInputNumber v-model="spo2" label="SpO2 (%)" :min="0" :max="100" />
          <CustomInputNumber v-model="beratBadan" label="BB (kg)" :min="0" :max="400" :maxFractionDigits="1" />
          <CustomInputNumber v-model="tinggiBadan" label="TB (cm)" :min="0" :max="250" :maxFractionDigits="1" />
        </div>
        <p v-if="imt" class="mt-2 text-xs text-grey-400">IMT: {{ imt }}</p>
        <CustomSelect
          v-model="keadaanUmum"
          class="mt-3"
          label="Keadaan Umum"
          :options="opsiKeadaanUmum"
          optionLabel="label"
          optionValue="value"
          :showFilter="false"
        />
        <CustomTextArea v-model="pemeriksaanFisik" class="mt-3" label="Pemeriksaan Fisik" placeholder="Temuan pemeriksaan fisik (opsional)" />
      </section>

      <!-- A -->
      <section class="rounded-lg border border-grey-200 p-4">
        <h3 class="mb-3 font-semibold text-opensimrs-300">A — Asesmen</h3>
        <CustomSelect
          v-model="diagnosisPrimer"
          label="Diagnosis Primer (ICD-10)"
          :options="listDiagnosis"
          :filterFields="['code', 'name']"
          optionLabel="label"
          optionValue=""
          dataKey="uuid"
          placeHolder="Cari kode atau nama diagnosis"
          :required="true"
          :invalid="percobaanSelesai && !diagnosisPrimer"
          invalidMessage="Diagnosis primer wajib diisi"
        />
        <div v-for="(dx, i) in diagnosisSekunder" :key="i" class="mt-3 flex items-end gap-2">
          <CustomSelect
            v-model="diagnosisSekunder[i]"
            class="grow"
            :label="`Diagnosis Sekunder ${i + 1}`"
            :options="listDiagnosis"
            :filterFields="['code', 'name']"
            optionLabel="label"
            optionValue=""
            dataKey="uuid"
            placeHolder="Cari kode atau nama diagnosis"
          />
          <CustomButton icon="PhTrash" backgroundColor="bg-danger-300" @click="diagnosisSekunder.splice(i, 1)" />
        </div>
        <CustomButton class="mt-3" icon="PhPlus" label="Diagnosis Sekunder" outlined
          borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="diagnosisSekunder.push(null)" />
      </section>

      <!-- Selesai -->
      <section class="rounded-lg border border-grey-200 p-4">
        <h3 class="mb-3 font-semibold text-opensimrs-300">Tindak Lanjut</h3>
        <CustomSelect
          v-model="statusPulang"
          label="Status Pulang"
          :options="opsiStatusPulang"
          optionLabel="label"
          optionValue="value"
          :showFilter="false"
        />
        <template v-if="statusPulang === 'other-hfc'">
          <CustomSelect
            v-model="tujuanRujuk"
            class="mt-3"
            label="Tujuan Rujukan"
            :options="opsiTujuanRujuk"
            optionLabel="label"
            optionValue="value"
            :showFilter="false"
          />
          <CustomTextArea v-model="instruksiTindakLanjut" class="mt-3" label="Instruksi / Alasan Rujuk" />
        </template>
        <p class="mt-3 text-xs text-grey-400">
          Selesai = simpan SOAP, isi resume (status pulang), lalu tutup kunjungan. Tagihan tindakan diteruskan ke kasir
          dan resep masuk antrean farmasi.
        </p>
      </section>
    </div>

    <!-- P -->
    <section class="mt-4 rounded-lg border border-grey-200 p-4">
      <h3 class="mb-3 font-semibold text-opensimrs-300">P — Rencana: Resep &amp; Tindakan</h3>
      <FormOrderObat
        rmType="rawat-jalan"
        :patientData="patientData"
        :rmUuid="rmUuid"
        :sessionUuid="sessionUuid"
        method="form"
        class="mb-[10px]"
      />
      <PemeriksaanTindakan
        :rmUuid="rmUuid"
        :sessionUuid="sessionUuid"
        :patientData="patientData"
        method="form"
        @refreshPatientData="emit('refreshPatientData')"
      />
    </section>

    <div class="sticky bottom-0 mt-4 flex justify-end gap-2 border-t border-grey-200 bg-white py-3">
      <CustomButton label="Simpan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="onSimpan" />
      <CustomButton icon="PhCheckCircle" label="Simpan & Selesai" @click="mintaSelesai" />
    </div>

    <CustomDialog v-model:visible="konfirmasiSelesai" width="480px">
      <template #header>Selesaikan pelayanan?</template>
      <template #body>
        <p class="mt-4 text-sm">
          Kunjungan <b>{{ patientData.patient?.name }}</b> akan ditutup dengan status
          <b>{{ opsiStatusPulang.find((o) => o.value === statusPulang)?.label }}</b>. Setelah selesai, rekam medis tidak
          bisa diubah dari layar ini.
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-grey-200" textColor="text-grey-300" @click="konfirmasiSelesai = false" />
          <CustomButton label="Ya, Selesai" @click="onSelesai" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
