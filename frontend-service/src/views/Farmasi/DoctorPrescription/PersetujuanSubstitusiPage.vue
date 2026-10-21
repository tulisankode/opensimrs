<script setup lang="ts">
// Farmasi › Persetujuan Substitusi (dokter). Substitusi obat oleh apoteker wajib disetujui dokter:
// - Menunggu: pengajuan dari apoteker; Setujui = obat pada resep diganti saat itu, Tolak = obat tetap (alasan wajib).
// - Perlu Verifikasi: substitusi yang sudah diterapkan lewat konfirmasi lisan/telepon (atau data lama) dan belum
//   diverifikasi dokter.
import { computed, onMounted, ref, watch } from "vue";
import { useDoctorPrescriptionStore } from "@/stores/farmasi/DoctorPrescription";
import { utilsStore } from "@/stores/utils";
import { formatDateTime } from "@/utils/Helpers";
import { getStoredPermissions, hasPermission } from "@/utils/permissions";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import NoData from "@/components/section/NoData.vue";

const store = useDoctorPrescriptionStore();
const UseUtilsStore = utilsStore();

const OPSI_STATUS = [
  { label: "Menunggu persetujuan", value: "menunggu" },
  { label: "Perlu verifikasi (konfirmasi lisan)", value: "verifikasi" },
  { label: "Semua riwayat", value: "semua" },
];
const CARA = { telepon: "telepon", lisan: "lisan/tatap muka", langsung: "pesan langsung" } as Record<string, string>;

const status = ref("menunggu");
const milikSaya = ref(false);
const daftar = ref<any[]>([]);
const memproses = ref<string | null>(null);

// akun tanpa daftar izin = super admin (diputuskan backend)
const tanpaDaftarIzin = () => !getStoredPermissions().length;
const bolehSetujui = computed(() => tanpaDaftarIzin() || hasPermission("Farmasi", "Persetujuan Substitusi", "SETUJUI"));
const bolehTolak = computed(() => tanpaDaftarIzin() || hasPermission("Farmasi", "Persetujuan Substitusi", "TOLAK"));

const waktu = (epoch?: number | null) => (epoch ? formatDateTime(new Date(epoch * 1000)) : "-");

const muat = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const res = await store.daftarPersetujuanSubstitusi(status.value, milikSaya.value);
    daftar.value = res?.payload ?? [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const perluVerifikasi = (r: any) => ["disetujui_lisan", "tanpa_persetujuan"].includes(r.status) && !r.diverifikasiAt;

const setujui = async (r: any) => {
  if (memproses.value) return;
  memproses.value = r.uuid;
  try {
    if (await store.setujuiSubstitusi(r.uuid)) await muat();
  } finally {
    memproses.value = null;
  }
};

const dialogTolak = ref(false);
const akanDitolak = ref<any>(null);
const alasanTolak = ref("");
const galatTolak = ref("");
const bukaTolak = (r: any) => {
  akanDitolak.value = r;
  alasanTolak.value = "";
  galatTolak.value = "";
  dialogTolak.value = true;
};
const tolak = async () => {
  if (!alasanTolak.value.trim()) {
    galatTolak.value = "Alasan penolakan wajib diisi";
    return;
  }
  if (!akanDitolak.value || memproses.value) return;
  memproses.value = akanDitolak.value.uuid;
  try {
    if (await store.tolakSubstitusi(akanDitolak.value.uuid, alasanTolak.value.trim())) {
      dialogTolak.value = false;
      await muat();
    }
  } finally {
    memproses.value = null;
  }
};

watch([status, milikSaya], muat);
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card
      pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-hidden"
      class="h-full overflow-hidden"
    >
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <CustomBreadCrumb :home="{ label: 'Farmasi', home: true }" :model="[{ label: 'Persetujuan Substitusi' }]" />
          <CustomSelect
            v-model="status"
            label="Status"
            optionLabel="label"
            optionValue="value"
            :options="OPSI_STATUS"
            :showFilter="false"
          />
          <CustomSwitch
            v-model="milikSaya"
            label="Resep saya saja"
            sideLabel="Tidak"
            sideLabelTrue="Ya"
          />
        </PageToolbar>
      </template>

      <template #content>
        <NoData v-if="!daftar.length" />
        <DataTable v-else :value="daftar" scrollable scrollHeight="flex" class="text-SM">
          <Column header="Pasien / Resep" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <p class="font-semibold">{{ data.namaPasien ?? "-" }}</p>
              <p class="text-xs text-grey-300">
                {{ data.noRm ?? "-" }} · {{ data.noResep ?? "-" }} · {{ (data.jenisPelayanan ?? "").toUpperCase() }}
              </p>
              <p class="text-xs text-grey-300">Dokter resep: {{ data.dokterOrder ?? "-" }}</p>
            </template>
          </Column>
          <Column header="Obat Diresepkan → Pengganti" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <p>
                {{ data.namaObatAsal ?? "-" }} ({{ data.medicationQtyAsal ?? "-" }})
                <span class="font-bold text-opensimrs-300">→</span>
                {{ data.namaObatPengganti ?? "-" }} ({{ data.medicationQty }})
              </p>
              <p class="text-xs text-grey-300">Jenis stok: {{ data.jenisStokPengganti ?? "-" }}</p>
            </template>
          </Column>
          <Column header="Alasan Apoteker" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <p class="font-semibold">{{ data.kategoriAlasanLabel }}</p>
              <p>{{ data.alasan }}</p>
              <p class="text-xs text-grey-300">{{ data.petugas }} · {{ waktu(data.createdAt) }}</p>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <p class="font-semibold">{{ data.statusLabel }}</p>
              <p v-if="data.status === 'disetujui_lisan'" class="text-xs text-grey-300">
                {{ data.dokterPenyetuju }} via {{ CARA[data.caraKonfirmasi] ?? data.caraKonfirmasi ?? "-" }},
                {{ waktu(data.waktuKonfirmasi) }}
              </p>
              <p v-if="data.diputuskanOleh" class="text-xs text-grey-300">
                {{ data.diputuskanOleh }} · {{ waktu(data.diputuskanAt) }}
              </p>
              <p v-if="data.alasanTolak" class="text-xs text-danger-300">Alasan: {{ data.alasanTolak }}</p>
              <p v-if="data.diverifikasiOleh" class="text-xs text-grass-300">
                Diverifikasi {{ data.diverifikasiOleh }} · {{ waktu(data.diverifikasiAt) }}
              </p>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="flex gap-2">
                <template v-if="data.status === 'menunggu'">
                  <CustomButton
                    v-if="bolehSetujui"
                    label="Setujui"
                    icon="PhCheck"
                    class="h-7 text-xs px-2"
                    :disabled="memproses === data.uuid"
                    @click="setujui(data)"
                  />
                  <CustomButton
                    v-if="bolehTolak"
                    label="Tolak"
                    outlined
                    borderColor="border-danger-300"
                    textColor="text-danger-300"
                    class="h-7 text-xs px-2"
                    :disabled="memproses === data.uuid"
                    @click="bukaTolak(data)"
                  />
                </template>
                <CustomButton
                  v-else-if="perluVerifikasi(data) && bolehSetujui"
                  label="Verifikasi"
                  icon="PhSealCheck"
                  class="h-7 text-xs px-2"
                  :disabled="memproses === data.uuid"
                  @click="setujui(data)"
                />
                <span v-else class="text-xs text-grey-300">-</span>
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogTolak" width="520px" @close-dialog="dialogTolak = false">
      <template #header>Tolak Substitusi</template>
      <template #body>
        <div class="grid gap-3 mt-[15px] text-sm">
          <p>
            {{ akanDitolak?.namaObatAsal }} → {{ akanDitolak?.namaObatPengganti }} untuk
            {{ akanDitolak?.namaPasien ?? "-" }}. Obat pada resep tetap obat yang diresepkan.
          </p>
          <CustomTextArea
            v-model="alasanTolak"
            label="Alasan Penolakan"
            placeholder="Mis. pasien alergi zat pengganti, gunakan obat lain"
            :invalid="!!galatTolak"
            :invalidMessage="galatTolak"
            required
          />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton
            label="Batal"
            outlined
            borderColor="border-grey-200"
            textColor="text-grey-300"
            @click="dialogTolak = false"
          />
          <CustomButton label="Tolak" class="ml-[10px]" :disabled="!!memproses" @click="tolak" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
