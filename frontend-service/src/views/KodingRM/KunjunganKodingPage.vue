<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { useDiagnosisStore } from "@/stores/datamaster/diagnosis";
import { useIcd9Store } from "@/stores/datamaster/icd9";
import {
  JENIS_KUNJUNGAN,
  OPSI_STATUS_CHECKLIST,
  STATUS_KLARIFIKASI,
  detailKunjunganKoding,
  finalisasiKoding,
  gayaKoding,
  izinKoding,
  jawabKlarifikasi,
  kirimKlarifikasi,
  labelPenjamin,
  riwayatKoding,
  simpanChecklistKunjungan,
  simpanKoding,
  tutupKlarifikasi,
  umurKoding,
  waktuKoding,
} from "@/stores/penunjang/koding";

// Detail kunjungan: diagnosis dokter (RME) sebagai pembanding, formulir koding ICD-10/ICD-9-CM, checklist
// kelengkapan, klarifikasi ke DPJP, dan finalisasi "siap klaim" bila seluruh prasyarat terpenuhi.
const route = useRoute();
const router = useRouter();
const storeUtils = utilsStore();
const diagnosisStore = useDiagnosisStore();
const icd9Store = useIcd9Store();

const boleh = (sub: string, aksi: string) => izinKoding(sub, aksi);
const tipe = computed(() => String(route.params.tipe));
const uuid = computed(() => String(route.params.uuid));

const detail = ref<any>(null);
const listDiagnosis = ref<any[]>([]);
const listIcd9 = ref<any[]>([]);

const diagnosisUtama = ref<any>(null);
const alasanUtama = ref("");
const diagnosisSekunder = ref<any[]>([]);
const alasanSekunder = ref<string[]>([]);
const tindakanList = ref<{ opsi: any; alasan: string }[]>([]);

const kodeDokterSet = computed(() => new Set((detail.value?.diagnosaDokter ?? []).map((d: any) => d.diagnosisUuid)));
const bedaDariDokter = (dxUuid?: string) => !!dxUuid && kodeDokterSet.value.size > 0 && !kodeDokterSet.value.has(dxUuid);
const cariDiagnosis = (dxUuid?: string) => listDiagnosis.value.find((x) => x.uuid === dxUuid) ?? null;

const muatMaster = async () => {
  if (!listDiagnosis.value.length) listDiagnosis.value = ((await diagnosisStore.exportApi())?.payload ?? []).map((x: any) => ({ ...x, label: x.code ? `${x.code} — ${x.name}` : x.name }));
  if (!listIcd9.value.length) listIcd9.value = ((await icd9Store.exportApi())?.payload ?? []).map((x: any) => ({ ...x, label: x.code ? `${x.code} — ${x.name}` : x.name }));
};

const isiFormDariDetail = () => {
  const diag = detail.value?.diagnosis ?? [];
  const utama = diag.find((d: any) => d.peran === "utama");
  diagnosisUtama.value = utama ? cariDiagnosis(utama.diagnosisUuid) ?? { uuid: utama.diagnosisUuid, code: utama.kode, name: utama.nama, label: `${utama.kode} — ${utama.nama}` } : null;
  alasanUtama.value = utama?.alasan ?? "";
  const sekunder = diag.filter((d: any) => d.peran === "sekunder");
  diagnosisSekunder.value = sekunder.map((d: any) => cariDiagnosis(d.diagnosisUuid) ?? { uuid: d.diagnosisUuid, code: d.kode, name: d.nama, label: `${d.kode} — ${d.nama}` });
  alasanSekunder.value = sekunder.map((d: any) => d.alasan ?? "");
  tindakanList.value = (detail.value?.tindakan ?? []).map((t: any) => ({
    opsi: listIcd9.value.find((x) => x.uuid === t.icd9Uuid) ?? { uuid: t.icd9Uuid, code: t.kode, name: t.nama, label: `${t.kode} — ${t.nama}` },
    alasan: t.alasan ?? "",
  }));
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    await muatMaster();
    const res = await detailKunjunganKoding(tipe.value, uuid.value);
    detail.value = res?.payload ?? null;
    if (detail.value) isiFormDariDetail();
  } finally {
    storeUtils.setLoading(false);
  }
};
watch(() => [tipe.value, uuid.value], muat);
onMounted(muat);

// ── Formulir koding
const galatKoding = ref("");
const tambahSekunder = () => {
  diagnosisSekunder.value.push(null);
  alasanSekunder.value.push("");
};
const hapusSekunder = (i: number) => {
  diagnosisSekunder.value.splice(i, 1);
  alasanSekunder.value.splice(i, 1);
};
const tambahTindakan = () => tindakanList.value.push({ opsi: null, alasan: "" });
const hapusTindakan = (i: number) => tindakanList.value.splice(i, 1);

const simpan = async () => {
  galatKoding.value = "";
  if (!diagnosisUtama.value) return (galatKoding.value = "Pilih diagnosis utama terlebih dahulu");
  if (bedaDariDokter(diagnosisUtama.value.uuid) && !alasanUtama.value.trim()) return (galatKoding.value = "Diagnosis utama berbeda dari diagnosis dokter, alasan perubahan wajib diisi");
  for (let i = 0; i < diagnosisSekunder.value.length; i++) {
    const d = diagnosisSekunder.value[i];
    if (d && bedaDariDokter(d.uuid) && !(alasanSekunder.value[i] ?? "").trim()) return (galatKoding.value = `Diagnosis sekunder ${i + 1} berbeda dari diagnosis dokter, alasan wajib diisi`);
  }
  const diagnosis = [
    { diagnosisUuid: diagnosisUtama.value.uuid, peran: "utama", sumberDokterUuid: bedaDariDokter(diagnosisUtama.value.uuid) ? null : diagnosisUtama.value.uuid, alasan: alasanUtama.value || undefined },
    ...diagnosisSekunder.value
      .map((d: any, i: number) => (d ? { diagnosisUuid: d.uuid, peran: "sekunder", sumberDokterUuid: bedaDariDokter(d.uuid) ? null : d.uuid, alasan: alasanSekunder.value[i] || undefined } : null))
      .filter(Boolean),
  ];
  const tindakan = tindakanList.value.filter((t) => t.opsi).map((t) => ({ icd9Uuid: t.opsi.uuid, alasan: t.alasan || undefined }));
  storeUtils.setLoading(true);
  try {
    const res = await simpanKoding(tipe.value, uuid.value, { diagnosis, tindakan } as any);
    if (res?.payload) await muat();
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Riwayat koding (semua versi)
const dialogRiwayat = ref(false);
const riwayat = ref<{ diagnosis: any[]; tindakan: any[] }>({ diagnosis: [], tindakan: [] });
const versiRiwayat = computed(() => [...new Set([...riwayat.value.diagnosis, ...riwayat.value.tindakan].map((r) => r.versi))].sort((a, b) => b - a));
const bukaRiwayat = async () => {
  const res = await riwayatKoding(tipe.value, uuid.value);
  riwayat.value = res?.payload ?? { diagnosis: [], tindakan: [] };
  dialogRiwayat.value = true;
};

// ── Checklist kelengkapan
const simpanChecklist = async () => {
  if (!detail.value?.checklist?.length) return;
  storeUtils.setLoading(true);
  try {
    const items = detail.value.checklist.map((c: any) => ({ checklistItemUuid: c.checklistItemUuid, status: c.status, alasan: c.alasan }));
    const res = await simpanChecklistKunjungan(tipe.value, uuid.value, items as any);
    if (res?.payload) await muat();
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Klarifikasi DPJP
const dialogKlarifikasi = ref(false);
const pertanyaanBaru = ref("");
const menghalangiBaru = ref(true);
const kirimPertanyaan = async () => {
  if (!pertanyaanBaru.value.trim()) return;
  storeUtils.setLoading(true);
  try {
    const res = await kirimKlarifikasi(tipe.value, uuid.value, { pertanyaan: pertanyaanBaru.value.trim(), menghalangi: menghalangiBaru.value });
    if (res?.payload) {
      dialogKlarifikasi.value = false;
      pertanyaanBaru.value = "";
      menghalangiBaru.value = true;
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const dialogJawab = ref(false);
const klarifikasiDipilih = ref<any>(null);
const jawabanBaru = ref("");
const bukaJawab = (k: any) => {
  klarifikasiDipilih.value = k;
  jawabanBaru.value = "";
  dialogJawab.value = true;
};
const kirimJawaban = async () => {
  if (!jawabanBaru.value.trim()) return;
  storeUtils.setLoading(true);
  try {
    const res = await jawabKlarifikasi(klarifikasiDipilih.value.uuid, jawabanBaru.value.trim());
    if (res?.payload) {
      dialogJawab.value = false;
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const tutup = async (k: any) => {
  storeUtils.setLoading(true);
  try {
    const res = await tutupKlarifikasi(k.uuid);
    if (res?.payload) await muat();
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Finalisasi
const finalisasi = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await finalisasiKoding(tipe.value, uuid.value);
    if (res?.payload) await muat();
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="flex flex-col h-full overflow-auto p-4 gap-4">
    <NoData v-if="!detail" />
    <template v-else>
      <Card>
        <template #content>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CustomButton icon="PhArrowLeft" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="router.push('/koding-rm/worklist')" />
              <span class="ml-3 text-lg font-semibold text-opensimrs-400">{{ detail.pasien?.name ?? "-" }}</span>
              <span class="ml-2 text-grey-400">{{ detail.pasien?.noRm }} · {{ detail.pasien?.gender === "Female" ? "P" : "L" }} · {{ umurKoding(detail.pasien?.birthDate) }}</span>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-semibold" :class="[gayaKoding(detail.koding?.status)?.bg, gayaKoding(detail.koding?.status)?.text]">
              {{ gayaKoding(detail.koding?.status)?.label }}
            </span>
          </div>
          <div class="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm md:grid-cols-4">
            <div><span class="text-grey-400">Kunjungan:</span> {{ JENIS_KUNJUNGAN[detail.kunjungan?.kunjunganTipe ?? tipe] ?? tipe }} · {{ detail.kunjungan?.noReg }}</div>
            <div><span class="text-grey-400">Penjamin:</span> {{ labelPenjamin(detail.kunjungan?.paymentMethod) }}</div>
            <div><span class="text-grey-400">Ruangan:</span> {{ detail.kunjungan?.lokasiNama ?? "-" }}</div>
            <div><span class="text-grey-400">Tgl. Pulang:</span> {{ waktuKoding(detail.kunjungan?.dischargeDate) }}</div>
            <div><span class="text-grey-400">DPJP:</span> {{ detail.kunjungan?.dpjpNama ?? "-" }}</div>
            <div v-if="detail.koding?.finalisasiAt"><span class="text-grey-400">Finalisasi:</span> {{ waktuKoding(detail.koding.finalisasiAt) }} · {{ detail.koding.koderUuid }}</div>
          </div>
        </template>
      </Card>

      <div class="grid gap-4 lg:grid-cols-2">
        <!-- Diagnosis dokter pembanding -->
        <Card>
          <template #title>Diagnosis Dokter (Pembanding dari RME)</template>
          <template #content>
            <div v-if="!detail.rmeTersedia" class="text-sm text-grey-400">Resume RME belum tersedia untuk kunjungan ini.</div>
            <div v-else-if="!detail.diagnosaDokter?.length" class="text-sm text-grey-400">Belum ada diagnosis dokter tercatat.</div>
            <ul v-else class="text-sm list-disc list-inside">
              <li v-for="(d, i) in detail.diagnosaDokter" :key="i">
                <span class="font-medium">{{ d.diagnosis }}</span>
                <span class="text-grey-400"> ({{ d.tipe === "sekunder" ? "sekunder" : "primer" }}, oleh {{ d.petugas }})</span>
              </li>
            </ul>
          </template>
        </Card>

        <!-- Klarifikasi DPJP -->
        <Card>
          <template #title>
            <div class="flex items-center justify-between">
              Klarifikasi ke DPJP
              <CustomButton v-if="boleh('Klarifikasi', 'CREATE')" icon="PhPlus" label="Kirim" @click="dialogKlarifikasi = true" />
            </div>
          </template>
          <template #content>
            <div v-if="!detail.klarifikasi?.length" class="text-sm text-grey-400">Belum ada klarifikasi.</div>
            <div v-else class="flex flex-col gap-3">
              <div v-for="k in detail.klarifikasi" :key="k.uuid" class="p-3 border rounded-lg border-grey-75">
                <div class="flex items-center justify-between">
                  <span class="px-2 py-0.5 rounded-full text-xs font-semibold" :class="[STATUS_KLARIFIKASI[k.status]?.bg, STATUS_KLARIFIKASI[k.status]?.text]">{{ STATUS_KLARIFIKASI[k.status]?.label }}</span>
                  <span v-if="k.menghalangi" class="text-xs font-semibold text-danger-300">Menghalangi siap klaim</span>
                </div>
                <div class="mt-1 text-sm">{{ k.pertanyaan }}</div>
                <div v-if="k.jawaban" class="mt-1 text-sm text-grey-500"><span class="text-grey-400">Jawaban:</span> {{ k.jawaban }}</div>
                <div class="flex justify-end gap-2 mt-2">
                  <CustomButton v-if="k.status === 'menunggu' && boleh('Klarifikasi', 'UPDATE')" label="Jawab" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaJawab(k)" />
                  <CustomButton v-if="k.status !== 'ditutup' && boleh('Klarifikasi', 'UPDATE')" label="Tutup" outlined borderColor="border-grey-300" textColor="text-grey-500" @click="tutup(k)" />
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Koding diagnosis & tindakan -->
      <Card>
        <template #title>
          <div class="flex items-center justify-between">
            Koding Diagnosis & Tindakan
            <CustomButton label="Riwayat" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaRiwayat" />
          </div>
        </template>
        <template #content>
          <div class="flex flex-col gap-4">
            <div>
              <CustomSelect
                v-model="diagnosisUtama"
                label="Diagnosis Utama (ICD-10)"
                :options="listDiagnosis"
                :filterFields="['code', 'name']"
                optionLabel="label"
                optionValue=""
                dataKey="uuid"
                placeHolder="Cari kode atau nama diagnosis"
                :required="true"
                :disabled="!boleh('Koding', 'UPDATE')"
              />
              <CustomTextArea v-if="diagnosisUtama && bedaDariDokter(diagnosisUtama.uuid)" v-model="alasanUtama" class="mt-2" label="Alasan berbeda dari diagnosis dokter" placeholder="Wajib diisi" />
            </div>
            <div v-for="(d, i) in diagnosisSekunder" :key="i" class="flex flex-col gap-2 pl-3 border-l-2 border-grey-100">
              <div class="flex items-end gap-2">
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
                  :disabled="!boleh('Koding', 'UPDATE')"
                />
                <CustomButton icon="PhTrash" backgroundColor="bg-danger-300" @click="hapusSekunder(i)" />
              </div>
              <CustomTextArea v-if="d && bedaDariDokter(d.uuid)" v-model="alasanSekunder[i]" label="Alasan berbeda dari diagnosis dokter" placeholder="Wajib diisi" />
            </div>
            <CustomButton v-if="boleh('Koding', 'UPDATE')" icon="PhPlus" label="Diagnosis Sekunder" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" class="self-start" @click="tambahSekunder" />

            <div class="pt-3 mt-1 border-t border-grey-100">
              <div v-for="(t, i) in tindakanList" :key="i" class="flex flex-col gap-2 mb-2">
                <div class="flex items-end gap-2">
                  <CustomSelect
                    v-model="t.opsi"
                    class="grow"
                    :label="`Tindakan ${i + 1} (ICD-9-CM)`"
                    :options="listIcd9"
                    :filterFields="['code', 'name']"
                    optionLabel="label"
                    optionValue=""
                    dataKey="uuid"
                    placeHolder="Cari kode atau nama tindakan"
                    :disabled="!boleh('Koding', 'UPDATE')"
                  />
                  <CustomButton icon="PhTrash" backgroundColor="bg-danger-300" @click="hapusTindakan(i)" />
                </div>
                <CustomTextArea v-model="t.alasan" label="Catatan/alasan (opsional)" />
              </div>
              <CustomButton v-if="boleh('Koding', 'UPDATE')" icon="PhPlus" label="Tindakan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="tambahTindakan" />
            </div>

            <div v-if="galatKoding" class="text-sm text-danger-300">{{ galatKoding }}</div>
            <div v-if="boleh('Koding', 'UPDATE')" class="flex justify-end">
              <CustomButton label="Simpan Koding" @click="simpan" />
            </div>
          </div>
        </template>
      </Card>

      <!-- Checklist kelengkapan -->
      <Card>
        <template #title>Checklist Kelengkapan Rekam Medis</template>
        <template #content>
          <div v-if="!detail.checklist?.length" class="text-sm text-grey-400">Belum ada item checklist untuk faskes ini.</div>
          <div v-else class="flex flex-col gap-3">
            <div v-for="c in detail.checklist" :key="c.checklistItemUuid" class="flex flex-wrap items-end gap-3">
              <div class="min-w-[220px] font-medium">{{ c.nama }} <span v-if="c.wajib" class="text-danger-300">*</span></div>
              <CustomSelect v-model="c.status" :options="OPSI_STATUS_CHECKLIST" optionLabel="label" optionValue="value" showLabel class="w-[220px]" :disabled="!boleh('Checklist', 'UPDATE')" />
              <CustomTextArea v-if="c.status === 'tidak_berlaku'" v-model="c.alasan" label="Alasan tidak berlaku" class="grow min-w-[220px]" />
            </div>
            <div v-if="boleh('Checklist', 'UPDATE')" class="flex justify-end">
              <CustomButton label="Simpan Checklist" @click="simpanChecklist" />
            </div>
          </div>
        </template>
      </Card>

      <!-- Siap klaim -->
      <Card>
        <template #title>Status Siap Klaim</template>
        <template #content>
          <ul class="text-sm">
            <li :class="detail.siapKlaim?.diagnosisUtama ? 'text-success-300' : 'text-danger-300'">{{ detail.siapKlaim?.diagnosisUtama ? "✓" : "✗" }} Diagnosis utama terisi</li>
            <li :class="detail.siapKlaim?.checklistLengkap ? 'text-success-300' : 'text-danger-300'">{{ detail.siapKlaim?.checklistLengkap ? "✓" : "✗" }} Checklist wajib lengkap</li>
            <li :class="!detail.siapKlaim?.klarifikasiTerbuka ? 'text-success-300' : 'text-danger-300'">{{ !detail.siapKlaim?.klarifikasiTerbuka ? "✓" : "✗" }} Tidak ada klarifikasi menghalangi yang terbuka</li>
          </ul>
          <div v-if="detail.koding?.status !== 'siap_klaim' && boleh('Koding', 'UPDATE')" class="flex justify-end mt-3">
            <CustomButton label="Tandai Siap Klaim" :disabled="!detail.siapKlaim?.boleh" @click="finalisasi" />
          </div>
        </template>
      </Card>
    </template>

    <!-- Dialog riwayat koding -->
    <CustomDialog v-model:visible="dialogRiwayat" width="720px">
      <template #header>Riwayat Koding (Append-Only)</template>
      <template #body>
        <div v-if="!versiRiwayat.length" class="py-4 text-sm text-grey-400">Belum ada riwayat.</div>
        <div v-for="v in versiRiwayat" :key="v" class="py-3 border-b border-grey-100 last:border-0">
          <div class="mb-1 text-sm font-semibold text-opensimrs-300">Versi {{ v }}</div>
          <ul class="text-xs list-disc list-inside">
            <li v-for="d in riwayat.diagnosis.filter((x) => x.versi === v)" :key="d.uuid">
              [{{ d.peran }}] {{ d.kode }} — {{ d.nama }} <span v-if="d.alasan" class="text-grey-400">({{ d.alasan }})</span>
            </li>
            <li v-for="t in riwayat.tindakan.filter((x) => x.versi === v)" :key="t.uuid">
              [tindakan] {{ t.kode }} — {{ t.nama }} <span v-if="t.alasan" class="text-grey-400">({{ t.alasan }})</span>
            </li>
          </ul>
        </div>
      </template>
    </CustomDialog>

    <!-- Dialog kirim klarifikasi -->
    <CustomDialog v-model:visible="dialogKlarifikasi" width="520px">
      <template #header>Kirim Klarifikasi ke DPJP</template>
      <template #body>
        <CustomTextArea v-model="pertanyaanBaru" label="Pertanyaan" placeholder="Tulis pertanyaan untuk DPJP" class="mt-3" />
        <div class="flex items-center gap-2 mt-3">
          <Checkbox v-model="menghalangiBaru" binary inputId="menghalangi" />
          <label for="menghalangi" class="text-sm">Menghalangi penyelesaian koding sampai dijawab</label>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogKlarifikasi = false" />
          <CustomButton label="Kirim" @click="kirimPertanyaan" />
        </div>
      </template>
    </CustomDialog>

    <!-- Dialog jawab klarifikasi -->
    <CustomDialog v-model:visible="dialogJawab" width="520px">
      <template #header>Jawab Klarifikasi</template>
      <template #body>
        <div class="mt-3 text-sm text-grey-500">{{ klarifikasiDipilih?.pertanyaan }}</div>
        <CustomTextArea v-model="jawabanBaru" label="Jawaban" placeholder="Tulis jawaban Anda" class="mt-3" />
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogJawab = false" />
          <CustomButton label="Kirim Jawaban" @click="kirimJawaban" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
