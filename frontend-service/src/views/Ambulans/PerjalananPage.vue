<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  STATUS_ARMADA,
  catatTahapPerjalanan,
  daftarPenugasanAktif,
  detailPermintaan,
  izinAmbulans,
  mulaiPerjalanan,
  opsi,
  selesaikanPerjalanan,
  waktuAmbulans,
} from "@/stores/penunjang/ambulans";

// Pencatatan tahapan perjalanan: mulai, tahap (berangkat/tiba lokasi/berangkat tujuan/tiba tujuan/kembali), kilometer,
// BBM, catatan pendamping, & penyelesaian (KF-8/KF-9/KF-10). Dibaca dari penugasan aktif (worklist koordinator/kru).
const storeUtils = utilsStore();
const bolehCatat = (aksi: string) => izinAmbulans("Perjalanan", aksi);
const bolehPendamping = izinAmbulans("Catatan Pendamping", "READ");

const TAHAPAN = [
  { key: "berangkat", kolom: "berangkatPada", label: "Berangkat dari Faskes", butuhKm: true },
  { key: "tiba_lokasi", kolom: "tibaLokasiPada", label: "Tiba di Lokasi Jemput" },
  { key: "berangkat_tujuan", kolom: "berangkatTujuanPada", label: "Berangkat ke Tujuan" },
  { key: "tiba_tujuan", kolom: "tibaTujuanPada", label: "Tiba di Tujuan" },
  { key: "kembali", kolom: "kembaliPada", label: "Kembali ke Faskes" },
] as const;

const aktif = ref<any[]>([]);
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarPenugasanAktif();
    aktif.value = res?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);

// ── Detail penugasan terpilih (ambil via detail permintaan agar dapat rincian perjalanan lengkap)
const dialog = ref(false);
const penugasanAktif = ref<any>(null); // baris dari worklist (nomor_polisi, dll.)
const penugasanDetail = ref<any>(null); // dari detailPermintaan().penugasan[].find(...)
const kmAwal = ref<number>(0);

const muatDetail = async (pn: any) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailPermintaan(pn.permintaanUuid);
    const d = res?.payload;
    penugasanAktif.value = pn;
    penugasanDetail.value = d?.penugasan?.find((x: any) => x.uuid === pn.uuid) ?? null;
    kmAwal.value = 0;
    dialog.value = true;
  } finally {
    storeUtils.setLoading(false);
  }
};
const perjalanan = computed(() => penugasanDetail.value?.perjalanan ?? null);

const mulai = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await mulaiPerjalanan(penugasanAktif.value.uuid);
    if (res?.payload) await muatDetail(penugasanAktif.value);
    muat();
  } finally {
    storeUtils.setLoading(false);
  }
};

const catatTahap = async (tahap: string) => {
  if (!perjalanan.value) return;
  storeUtils.setLoading(true);
  try {
    const data: Record<string, any> = { tahap };
    if (tahap === "berangkat") data.km_awal = kmAwal.value;
    const res = await catatTahapPerjalanan(perjalanan.value.uuid, data as any);
    if (res?.payload) await muatDetail(penugasanAktif.value);
  } finally {
    storeUtils.setLoading(false);
  }
};
const tahapSelanjutnya = computed(() => {
  if (!perjalanan.value) return null;
  for (let i = 0; i < TAHAPAN.length; i++) {
    if (!perjalanan.value[TAHAPAN[i].kolom]) return i === 0 || perjalanan.value[TAHAPAN[i - 1].kolom] ? TAHAPAN[i] : null;
  }
  return null;
});

// ── Selesaikan perjalanan
const dialogSelesai = ref(false);
const formSelesai = ref({ kmAkhir: 0, bbmNilai: 0, bbmSatuan: "liter", catatanPendamping: "", statusArmada: "siap", zona: "" });
const galatSelesai = ref("");
const bukaSelesai = () => {
  galatSelesai.value = "";
  formSelesai.value = { kmAkhir: perjalanan.value?.kmAwal ?? 0, bbmNilai: 0, bbmSatuan: "liter", catatanPendamping: "", statusArmada: "siap", zona: "" };
  dialogSelesai.value = true;
};
const simpanSelesai = async () => {
  const f = formSelesai.value;
  galatSelesai.value = "";
  if (f.kmAkhir < (perjalanan.value?.kmAwal ?? 0)) return (galatSelesai.value = "km_akhir tidak boleh lebih kecil dari km_awal");
  storeUtils.setLoading(true);
  try {
    const res = await selesaikanPerjalanan(perjalanan.value.uuid, {
      km_akhir: f.kmAkhir,
      bbm_nilai: f.bbmNilai || undefined,
      bbm_satuan: f.bbmSatuan || undefined,
      catatan_pendamping: f.catatanPendamping.trim() || undefined,
      status_armada: f.statusArmada,
      zona: f.zona.trim() || undefined,
    });
    if (res?.payload) {
      dialogSelesai.value = false;
      dialog.value = false;
      muat();
    } else galatSelesai.value = "Gagal menyelesaikan perjalanan";
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Perjalanan — Penugasan Aktif</h1>
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!aktif.length" />
        <DataTable v-else :value="aktif" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 55rem" @rowClick="muatDetail($event.data)">
          <Column header="No. Permintaan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.nomorPermintaan }}</template>
          </Column>
          <Column header="Tujuan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.tujuan }}</template>
          </Column>
          <Column header="Armada" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.nomorPolisi }}</template>
          </Column>
          <Column header="Kru" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ (d.kru ?? []).map((k: any) => k.namaPegawai).join(", ") || "-" }}</template>
          </Column>
          <Column header="Status Perjalanan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.statusPerjalanan ?? "Belum dimulai" }}</template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="720px">
      <template #header>Perjalanan — {{ penugasanAktif?.nomorPermintaan }} ({{ penugasanAktif?.nomorPolisi }})</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4 text-sm">
          <div v-if="!perjalanan">
            <div class="mb-3 text-grey-400">Perjalanan belum dimulai.</div>
            <CustomButton v-if="bolehCatat('CATAT TAHAP')" label="Mulai Perjalanan" icon="PhPlay" @click="mulai" />
          </div>
          <template v-else>
            <div class="grid grid-cols-2 gap-2">
              <div v-for="t in TAHAPAN" :key="t.key" class="flex items-center justify-between p-2 border rounded border-grey-100">
                <div>
                  <div class="font-medium">{{ t.label }}</div>
                  <div class="text-xs text-grey-400">{{ perjalanan[t.kolom] ? waktuAmbulans(perjalanan[t.kolom]) : "Belum tercatat" }}</div>
                </div>
                <div v-if="!perjalanan[t.kolom] && tahapSelanjutnya?.key === t.key && perjalanan.status === 'berjalan'" class="flex items-center gap-2">
                  <CustomInputNumber v-if="t.butuhKm" v-model="kmAwal" :showLabel="false" placeholder="Km awal" class="w-24" :min="0" />
                  <CustomButton v-if="bolehCatat('CATAT TAHAP')" label="Catat" size="small" @click="catatTahap(t.key)" />
                </div>
              </div>
            </div>
            <div v-if="bolehPendamping && perjalanan.catatanPendamping" class="p-2 text-xs border rounded border-grey-100">
              <span class="text-grey-400">Catatan pendamping:</span> {{ perjalanan.catatanPendamping }}
            </div>
            <div v-if="perjalanan.status === 'selesai'" class="grid grid-cols-2 gap-2 p-2 text-xs border rounded border-grey-100">
              <div>Jarak: {{ perjalanan.jarakKm }} km (km {{ perjalanan.kmAwal }} → {{ perjalanan.kmAkhir }})</div>
              <div>BBM: {{ perjalanan.bbmNilai ?? "-" }} {{ perjalanan.bbmSatuan ?? "" }}</div>
            </div>
          </template>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton
            v-if="perjalanan && perjalanan.status === 'berjalan' && perjalanan.kmAwal != null && bolehCatat('SELESAIKAN')"
            label="Selesaikan Perjalanan"
            icon="PhCheckCircle"
            @click="bukaSelesai"
          />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogSelesai" width="620px">
      <template #header>Selesaikan Perjalanan</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomInputNumber v-model="formSelesai.kmAkhir" label="Km Akhir" :min="perjalanan?.kmAwal ?? 0" required />
          <CustomSelect v-model="formSelesai.statusArmada" label="Status Armada Setelah Selesai" :options="opsi(STATUS_ARMADA).filter((o) => o.value !== 'bertugas')" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomInputNumber v-model="formSelesai.bbmNilai" label="BBM" :min="0" />
          <CustomTextfield v-model="formSelesai.bbmSatuan" label="Satuan BBM" placeholder="mis. liter / rupiah" :maxLength="20" />
          <CustomTextfield v-model="formSelesai.zona" label="Zona Tarif (opsional, bila tarif berbasis zona)" :maxLength="100" class="col-span-2" />
          <CustomTextArea v-model="formSelesai.catatanPendamping" label="Catatan Pendamping (opsional)" class="col-span-2" />
        </div>
        <div v-if="galatSelesai" class="mt-3 text-sm text-danger-300">{{ galatSelesai }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogSelesai = false" />
          <CustomButton label="Selesaikan" icon="PhFloppyDisk" @click="simpanSelesai" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
