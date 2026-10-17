<script setup lang="ts">
import { ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import {
  checklistOk,
  detailJadwalOk,
  finalisasiLaporanOperasiOk,
  izinOk,
  laporanAnestesiOk,
  laporanOperasiOk,
  pemakaianOk,
  praOperasiOk,
  referensiChecklistOk,
  selesaiJadwalOk,
  simpanChecklistOk,
  simpanLaporanAnestesiOk,
  simpanLaporanOperasiOk,
  simpanPraOperasiOk,
  tambahPemakaianOk,
  waktuOk,
} from "@/stores/penunjang/kamarOperasi";
import { utilsStore } from "@/stores/utils";

// Detail jadwal operasi: pra-operasi, checklist keselamatan bedah WHO (sign in → time out → sign out, berurutan),
// pemakaian BHP/obat depo OK, serta laporan operasi & anestesi. Laporan operasi hanya dapat difinalkan bila
// checklist lengkap (KF-11); backend tetap jadi penentu akhir (pesan galat ditampilkan apa adanya).
const storeUtils = utilsStore();
const visible = defineModel<boolean>("visible", { default: false });
const props = defineProps<{ jadwalUuid: string }>();
const emit = defineEmits<{ (e: "tersimpan"): void }>();

const boleh = (submodul: string, aksi: string) => izinOk(submodul, aksi);

const jadwal = ref<any>(null);
const praoperasi = ref<any>({});
const kelengkapanPra = ref<{ lengkap: boolean; kekurangan: string[] }>({ lengkap: false, kekurangan: [] });
const checklist = ref<any>({ signIn: null, timeOut: null, signOut: null, lengkap: false });
const referensiChecklist = ref<any>({});
const pemakaian = ref<any[]>([]);
const laporan = ref<any>(null);
const tagihanMenunggu = ref<string[]>([]);
const anestesi = ref<any>({});

const muatSemua = async () => {
  if (!props.jadwalUuid) return;
  storeUtils.setLoading(true);
  try {
    const [j, pra, cek, ref_, pem, lap, anes] = await Promise.all([
      detailJadwalOk(props.jadwalUuid),
      praOperasiOk(props.jadwalUuid),
      checklistOk(props.jadwalUuid),
      referensiChecklistOk(),
      pemakaianOk(props.jadwalUuid),
      laporanOperasiOk(props.jadwalUuid),
      laporanAnestesiOk(props.jadwalUuid),
    ]);
    jadwal.value = j?.payload ?? null;
    praoperasi.value = pra?.payload?.praoperasi ?? {};
    kelengkapanPra.value = { lengkap: !!pra?.payload?.kelengkapan?.lengkap, kekurangan: pra?.payload?.kelengkapan?.kekurangan ?? [] };
    checklist.value = cek?.payload ?? { signIn: null, timeOut: null, signOut: null, lengkap: false };
    referensiChecklist.value = ref_?.payload ?? {};
    pemakaian.value = pem?.payload ?? [];
    laporan.value = lap?.payload?.laporan ?? {};
    tagihanMenunggu.value = laporan.value?.tagihanMenunggu ?? [];
    anestesi.value = anes?.payload ?? {};
  } finally {
    storeUtils.setLoading(false);
  }
};
watch(visible, (v) => v && muatSemua());

// ── Pra-operasi
const simpanPra = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await simpanPraOperasiOk(props.jadwalUuid, praoperasi.value);
    if (res?.payload) {
      praoperasi.value = res.payload.praoperasi ?? {};
      kelengkapanPra.value = { lengkap: !!res.payload.kelengkapan?.lengkap, kekurangan: res.payload.kelengkapan?.kekurangan ?? [] };
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Checklist
// Kunci respons camelCase (interceptor apiHandler mengonversi sign_in/time_out/sign_out → signIn/timeOut/signOut).
const KUNCI_TAHAP: Record<"sign-in" | "time-out" | "sign-out", "signIn" | "timeOut" | "signOut"> = {
  "sign-in": "signIn",
  "time-out": "timeOut",
  "sign-out": "signOut",
};
const dialogChecklist = ref(false);
const tahapAktif = ref<"sign-in" | "time-out" | "sign-out">("sign-in");
const itemChecklist = ref<any[]>([]);
const bukaChecklist = (tahap: "sign-in" | "time-out" | "sign-out") => {
  tahapAktif.value = tahap;
  const kunci = KUNCI_TAHAP[tahap];
  const sudah = checklist.value[kunci];
  itemChecklist.value = sudah?.item ?? (referensiChecklist.value[kunci] ?? []).map((i: any) => ({ ...i, jawaban: false, catatan: "" }));
  dialogChecklist.value = true;
};
const simpanChecklist = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await simpanChecklistOk(props.jadwalUuid, tahapAktif.value, itemChecklist.value);
    if (res?.payload) {
      checklist.value = res.payload;
      dialogChecklist.value = false;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Pemakaian
const formPemakaian = ref({ itemMedisUuid: "", qty: 1, lokasiStokUuid: "" });
const tambahPemakaianBaris = async () => {
  if (!formPemakaian.value.itemMedisUuid || !formPemakaian.value.lokasiStokUuid) return;
  storeUtils.setLoading(true);
  try {
    const res = await tambahPemakaianOk(props.jadwalUuid, formPemakaian.value);
    if (res?.payload) {
      formPemakaian.value = { itemMedisUuid: "", qty: 1, lokasiStokUuid: "" };
      const pem = await pemakaianOk(props.jadwalUuid);
      pemakaian.value = pem?.payload ?? [];
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Laporan operasi
const simpanLaporan = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await simpanLaporanOperasiOk(props.jadwalUuid, laporan.value);
    if (res?.payload?.laporan) laporan.value = res.payload.laporan;
  } finally {
    storeUtils.setLoading(false);
  }
};
const finalisasi = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await finalisasiLaporanOperasiOk(props.jadwalUuid);
    if (res?.payload) {
      laporan.value = res.payload.laporan;
      tagihanMenunggu.value = res.payload.tagihanMenunggu ?? [];
      emit("tersimpan");
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Laporan anestesi
const obatTeks = ref("");
const monitoringTeks = ref("");
watch(anestesi, (a) => {
  obatTeks.value = (a?.obat ?? []).map((o: any) => o.catatan ?? o).join("\n");
  monitoringTeks.value = (a?.monitoring ?? []).map((m: any) => m.catatan ?? m).join("\n");
});
const simpanAnestesi = async () => {
  storeUtils.setLoading(true);
  try {
    const data = {
      ...anestesi.value,
      obat: obatTeks.value.split("\n").map((s) => s.trim()).filter(Boolean).map((catatan) => ({ catatan })),
      monitoring: monitoringTeks.value.split("\n").map((s) => s.trim()).filter(Boolean).map((catatan) => ({ catatan })),
    };
    const res = await simpanLaporanAnestesiOk(props.jadwalUuid, data);
    if (res?.payload) anestesi.value = res.payload;
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Selesaikan operasi
const selesaikan = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await selesaiJadwalOk(props.jadwalUuid, anestesi.value?.serahTerima);
    if (res?.payload) {
      jadwal.value = res.payload;
      emit("tersimpan");
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <CustomDialog v-model:visible="visible" width="980px">
    <template #header>Detail Operasi — {{ jadwal?.noOrder }}</template>
    <template #body>
      <div v-if="jadwal" class="flex flex-col gap-5 pt-4 text-sm">
        <div class="grid grid-cols-3 gap-x-6 gap-y-1 p-3 rounded-lg bg-opensimrs-50">
          <div><b>{{ jadwal.namaPasien }}</b> ({{ jadwal.noRm }})</div>
          <div>{{ jadwal.ruangKode }} — {{ jadwal.ruangNama }}</div>
          <div>{{ waktuOk(jadwal.waktuMulai) }} – {{ waktuOk(jadwal.waktuSelesai, true) }}</div>
          <div class="col-span-3">{{ jadwal.diagnosisNama }}</div>
        </div>

        <!-- Pra-Operasi -->
        <section>
          <h3 class="mb-2 font-semibold">Pra-Operasi</h3>
          <div class="grid grid-cols-2 gap-4">
            <CustomTextArea v-model="praoperasi.asesmenPraBedah" label="Asesmen Pra-Bedah" />
            <CustomTextArea v-model="praoperasi.asesmenPraAnestesi" label="Asesmen Pra-Anestesi" />
            <CustomTextArea v-model="praoperasi.penandaanLokasi" label="Penandaan Lokasi Operasi" />
            <CustomTextArea v-model="praoperasi.kebutuhanDarah" label="Kebutuhan Darah (opsional)" />
            <CustomTextfield v-model="praoperasi.consentTindakanUuid" label="UUID Persetujuan Tindakan" />
            <CustomTextfield v-model="praoperasi.consentAnestesiUuid" label="UUID Persetujuan Anestesi" />
          </div>
          <div class="flex items-center justify-between mt-2">
            <div v-if="!kelengkapanPra.lengkap" class="text-xs text-warning-400">Belum lengkap: {{ kelengkapanPra.kekurangan.join("; ") }}</div>
            <div v-else class="text-xs text-success-400">Pra-operasi lengkap.</div>
            <CustomButton v-if="boleh('Pra-Operasi', 'UPDATE')" size="small" label="Simpan Pra-Operasi" @click="simpanPra" />
          </div>
        </section>

        <!-- Checklist -->
        <section>
          <h3 class="mb-2 font-semibold">Checklist Keselamatan Bedah (WHO)</h3>
          <div class="grid grid-cols-3 gap-3">
            <div v-for="t in [['signIn', 'sign-in', 'Sign In'], ['timeOut', 'time-out', 'Time Out'], ['signOut', 'sign-out', 'Sign Out']]" :key="t[0]" class="p-3 text-center border rounded-lg border-grey-75">
              <div class="font-semibold">{{ t[2] }}</div>
              <div class="my-1 text-xs" :class="checklist[t[0]] ? 'text-success-400' : 'text-grey-400'">{{ checklist[t[0]] ? `Diisi · ${waktuOk(checklist[t[0]].waktuDiisi)}` : "Belum diisi" }}</div>
              <CustomButton v-if="boleh('Checklist Keselamatan', 'UPDATE')" size="small" :label="checklist[t[0]] ? 'Lihat' : 'Isi'" :disabled="!!checklist[t[0]]" @click="bukaChecklist(t[1] as any)" />
            </div>
          </div>
        </section>

        <!-- Pemakaian BHP -->
        <section>
          <h3 class="mb-2 font-semibold">Pemakaian BHP / Obat Depo OK</h3>
          <DataTable :value="pemakaian" class="mb-2 text-xs" stripedRows>
            <Column header="Item" field="namaItem" headerClass="bg-opensimrs-50" />
            <Column header="Qty" field="qty" headerClass="bg-opensimrs-50" />
            <Column header="Harga Satuan" headerClass="bg-opensimrs-50">
              <template #body="{ data: p }">{{ p.hargaSatuan }}</template>
            </Column>
          </DataTable>
          <div v-if="boleh('Pemakaian BHP', 'CREATE')" class="grid grid-cols-[1fr_100px_1fr_120px] gap-2">
            <CustomTextfield v-model="formPemakaian.itemMedisUuid" placeholder="UUID Item Medis" />
            <CustomTextfield v-model.number="formPemakaian.qty" type="number" placeholder="Qty" />
            <CustomTextfield v-model="formPemakaian.lokasiStokUuid" placeholder="UUID Lokasi Stok (Depo OK)" />
            <CustomButton label="Tambah" @click="tambahPemakaianBaris" />
          </div>
        </section>

        <!-- Laporan Operasi -->
        <section>
          <h3 class="mb-2 font-semibold">Laporan Operasi ({{ laporan?.status ?? "draft" }})</h3>
          <div class="grid grid-cols-2 gap-4">
            <CustomTextArea v-model="laporan.diagnosisPra" label="Diagnosis Pra-Operasi" :disabled="laporan?.status === 'final'" />
            <CustomTextArea v-model="laporan.diagnosisPasca" label="Diagnosis Pasca-Operasi" :disabled="laporan?.status === 'final'" />
            <CustomTextArea v-model="laporan.tindakanDilakukan" label="Tindakan yang Dilakukan" :disabled="laporan?.status === 'final'" />
            <CustomTextArea v-model="laporan.temuan" label="Temuan Operasi" :disabled="laporan?.status === 'final'" />
            <CustomTextArea v-model="laporan.komplikasi" label="Komplikasi" :disabled="laporan?.status === 'final'" />
            <CustomTextfield v-model.number="laporan.jumlahPerdarahanMl" type="number" label="Jumlah Perdarahan (mL)" :disabled="laporan?.status === 'final'" />
          </div>
          <div v-if="tagihanMenunggu.length" class="p-2 mt-2 text-xs rounded-lg text-warning-500 bg-warning-50">
            Menunggu tarif: {{ tagihanMenunggu.join("; ") }}
          </div>
          <div class="flex justify-end gap-2 mt-2">
            <CustomButton v-if="laporan?.status !== 'final' && boleh('Laporan Operasi', 'UPDATE')" size="small" label="Simpan Draf" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="simpanLaporan" />
            <CustomButton v-if="laporan?.status !== 'final' && boleh('Laporan Operasi', 'FINALISASI')" size="small" label="Finalisasi" @click="finalisasi" />
          </div>
        </section>

        <!-- Laporan Anestesi -->
        <section>
          <h3 class="mb-2 font-semibold">Laporan Anestesi</h3>
          <div class="grid grid-cols-2 gap-4">
            <CustomTextfield v-model="anestesi.jenisAnestesi" label="Jenis Anestesi" />
            <CustomTextArea v-model="obatTeks" label="Obat Anestesi (satu baris per catatan)" />
            <CustomTextArea v-model="monitoringTeks" label="Monitoring Intra-Anestesi (satu baris per catatan)" />
            <CustomTextfield v-model.number="anestesi.aldreteMasuk" type="number" label="Skor Aldrete Masuk (0–10)" />
            <CustomTextfield v-model.number="anestesi.aldreteKeluar" type="number" label="Skor Aldrete Keluar (0–10)" />
            <CustomTextArea v-model="anestesi.serahTerima" label="Catatan Serah Terima ke Ruangan" />
          </div>
          <div class="flex justify-end gap-2 mt-2">
            <CustomButton v-if="boleh('Laporan Anestesi', 'UPDATE')" size="small" label="Simpan Laporan Anestesi" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="simpanAnestesi" />
            <CustomButton v-if="jadwal.status === 'terjadwal' && boleh('Jadwal OK', 'VALIDASI')" size="small" label="Selesai / Kembali ke Ruangan" @click="selesaikan" />
          </div>
        </section>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="visible = false" />
      </div>
    </template>
  </CustomDialog>

  <!-- Isi checklist -->
  <CustomDialog v-model:visible="dialogChecklist" width="560px">
    <template #header>Checklist {{ tahapAktif }}</template>
    <template #body>
      <div class="flex flex-col gap-3 pt-4 text-sm">
        <div v-for="(it, i) in itemChecklist" :key="it.kode" class="flex items-start gap-2">
          <Checkbox v-model="itemChecklist[i].jawaban" binary />
          <div class="flex-1">
            <div>{{ it.label }}</div>
            <CustomTextfield v-model="itemChecklist[i].catatan" placeholder="Catatan (opsional)" />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogChecklist = false" />
        <CustomButton label="Simpan" @click="simpanChecklist" />
      </div>
    </template>
  </CustomDialog>
</template>
