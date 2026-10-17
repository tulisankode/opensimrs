<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  STATUS_TINDAK_LANJUT_REAKSI,
  catatTransfusiBdrs,
  daftarReaksiBdrs,
  daftarTransfusiBdrs,
  dariEpoch,
  gayaReaksiBdrs,
  gayaTransfusiBdrs,
  golonganRh,
  izinBdrs,
  keEpoch,
  laporReaksiBdrs,
  tindakLanjutReaksiBdrs,
  waktuBdrs,
} from "@/stores/penunjang/bankDarah";

// Pemantauan Transfusi per kantong yang sudah diserahkan: catat waktu mulai/selesai & hasil pemantauan, laporkan
// reaksi transfusi (status transfusi otomatis "Reaksi"), dan antrean tindak lanjut reaksi oleh BDRS (hemovigilans).
const storeUtils = utilsStore();
const bolehCatat = izinBdrs("Pemantauan Transfusi", "CATAT TRANSFUSI");
const bolehReaksi = izinBdrs("Pemantauan Transfusi", "LAPOR REAKSI");
const tab = ref("pemantauan");

const OPSI_STATUS_TRANSFUSI = [
  { value: "belum_dicatat", label: "Belum Dicatat" },
  { value: "berlangsung", label: "Berlangsung" },
  { value: "selesai_tanpa_reaksi", label: "Selesai Tanpa Reaksi" },
  { value: "reaksi", label: "Reaksi" },
];
const JENIS_REAKSI = [
  "Reaksi demam non-hemolitik (FNHTR)",
  "Reaksi alergi / urtikaria",
  "Anafilaksis",
  "Reaksi hemolitik akut",
  "Reaksi hemolitik lambat",
  "TACO (kelebihan cairan)",
  "TRALI (cedera paru akut)",
  "Kontaminasi bakteri / sepsis",
  "Hipotensi",
  "Lainnya",
].map((j) => ({ value: j, label: j }));

// ── Daftar kantong untuk dipantau
const items = ref<any[]>([]);
const filterStatus = ref("");
const muatItems = async () => {
  items.value = (await daftarTransfusiBdrs({ status: filterStatus.value }))?.payload ?? [];
};

// ── Daftar reaksi
const reaksi = ref<any[]>([]);
const filterReaksi = ref("");
const muatReaksi = async () => {
  reaksi.value = (await daftarReaksiBdrs({ status: filterReaksi.value }))?.payload ?? [];
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    await Promise.all([muatItems(), muatReaksi()]);
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);

// ── Catat transfusi (mulai / selesai)
const dialogCatat = ref(false);
const itemAktif = ref<any>(null);
const formCatat = ref({ waktuMulai: new Date() as Date | null, waktuSelesai: null as Date | null, status: "berlangsung", hasilPemantauan: "" });
const galatCatat = ref("");
const bukaCatat = (i: any, selesaikan = false) => {
  itemAktif.value = i;
  galatCatat.value = "";
  formCatat.value = {
    waktuMulai: dariEpoch(i.waktuMulai) ?? new Date(),
    waktuSelesai: dariEpoch(i.waktuSelesai) ?? (selesaikan ? new Date() : null),
    status: selesaikan ? "selesai_tanpa_reaksi" : i.statusTransfusi && i.statusTransfusi !== "reaksi" ? i.statusTransfusi : "berlangsung",
    hasilPemantauan: i.hasilPemantauan ?? "",
  };
  dialogCatat.value = true;
};
const simpanCatat = async () => {
  const f = formCatat.value;
  galatCatat.value = "";
  if (!f.waktuMulai) return (galatCatat.value = "Waktu mulai wajib diisi");
  if (f.status === "selesai_tanpa_reaksi" && !f.waktuSelesai) return (galatCatat.value = "Waktu selesai wajib diisi untuk transfusi yang selesai");
  if (f.waktuSelesai && f.waktuSelesai < f.waktuMulai) return (galatCatat.value = "Waktu selesai tidak boleh sebelum waktu mulai");
  storeUtils.setLoading(true);
  try {
    const res = await catatTransfusiBdrs(itemAktif.value.serahTerimaItemUuid, {
      waktuMulai: keEpoch(f.waktuMulai),
      waktuSelesai: f.waktuSelesai ? keEpoch(f.waktuSelesai) : null,
      status: f.status,
      hasilPemantauan: f.hasilPemantauan || undefined,
    });
    if (res) {
      dialogCatat.value = false;
      muatItems();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Lapor reaksi
const dialogReaksi = ref(false);
const formReaksi = ref({ jenisReaksi: "", gejala: "", tindakLanjut: "" });
const galatReaksi = ref("");
const bukaReaksi = (i: any) => {
  itemAktif.value = i;
  formReaksi.value = { jenisReaksi: "", gejala: "", tindakLanjut: "" };
  galatReaksi.value = "";
  dialogReaksi.value = true;
};
const simpanReaksi = async () => {
  const f = formReaksi.value;
  galatReaksi.value = "";
  if (!f.jenisReaksi || !f.gejala.trim()) return (galatReaksi.value = "Jenis reaksi dan gejala wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await laporReaksiBdrs(itemAktif.value.transfusiUuid, { jenisReaksi: f.jenisReaksi, gejala: f.gejala.trim(), tindakLanjut: f.tindakLanjut.trim() || undefined });
    if (res) {
      dialogReaksi.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Tindak lanjut reaksi (BDRS)
const dialogTl = ref(false);
const reaksiAktif = ref<any>(null);
const formTl = ref({ statusTindakLanjut: "ditindaklanjuti", tindakLanjut: "" });
const bukaTl = (r: any) => {
  reaksiAktif.value = r;
  formTl.value = { statusTindakLanjut: r.statusTindakLanjut === "baru" ? "ditindaklanjuti" : r.statusTindakLanjut, tindakLanjut: r.tindakLanjut ?? "" };
  dialogTl.value = true;
};
const simpanTl = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await tindakLanjutReaksiBdrs(reaksiAktif.value.uuid, { statusTindakLanjut: formTl.value.statusTindakLanjut, tindakLanjut: formTl.value.tindakLanjut || undefined });
    if (res) {
      dialogTl.value = false;
      muatReaksi();
    }
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
          <h1 class="toolbar-heading text-opensimrs-300">Pemantauan Transfusi</h1>
        </PageToolbar>
      </template>
      <template #content>
        <Tabs :value="tab" class="flex flex-col h-full" @update:value="(v: any) => (tab = v)">
          <TabList>
            <Tab value="pemantauan">Kantong Diserahkan</Tab>
            <Tab value="reaksi">Reaksi Transfusi (Hemovigilans)</Tab>
          </TabList>
          <TabPanels class="overflow-auto grow">
            <TabPanel value="pemantauan">
              <div class="flex items-end gap-2 mb-3">
                <CustomSelect
                  v-model="filterStatus"
                  label="Status Transfusi"
                  :options="OPSI_STATUS_TRANSFUSI"
                  optionValue="value"
                  optionLabel="label"
                  placeHolder="Semua"
                  :showFilter="false"
                  class="w-[240px]"
                  @update:modelValue="muatItems"
                />
                <CustomButton icon="PhArrowClockwise" @click="muatItems" />
              </div>
              <NoData v-if="!items.length" />
              <DataTable v-else :value="items" stripedRows class="text-xs" tableStyle="min-width: 60rem">
                <Column header="Kantong" headerClass="bg-opensimrs-50">
                  <template #body="{ data: i }">
                    <div class="font-semibold">{{ i.noKantong }}</div>
                    <div class="text-grey-400">{{ i.komponenNama }} · {{ golonganRh(i.golonganAbo, i.rhesus) }}</div>
                  </template>
                </Column>
                <Column header="Pasien" headerClass="bg-opensimrs-50">
                  <template #body="{ data: i }">
                    <div class="font-semibold">{{ i.namaPasien }}</div>
                    <div class="text-grey-400">{{ i.noRm }} · {{ i.noPermintaan }}</div>
                  </template>
                </Column>
                <Column header="Mulai / Selesai" headerClass="bg-opensimrs-50">
                  <template #body="{ data: i }">
                    <div>{{ waktuBdrs(i.waktuMulai) }}</div>
                    <div class="text-grey-400">{{ i.waktuSelesai ? waktuBdrs(i.waktuSelesai) : "-" }}</div>
                  </template>
                </Column>
                <Column header="Status" headerClass="bg-opensimrs-50">
                  <template #body="{ data: i }">
                    <span v-if="i.statusTransfusi" class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaTransfusiBdrs(i.statusTransfusi)?.bg, gayaTransfusiBdrs(i.statusTransfusi)?.text]">
                      {{ gayaTransfusiBdrs(i.statusTransfusi)?.label ?? i.statusTransfusi }}
                    </span>
                    <span v-else class="text-grey-400">Belum dicatat</span>
                    <div v-if="i.hasilPemantauan" class="text-grey-400">{{ i.hasilPemantauan }}</div>
                  </template>
                </Column>
                <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[280px]">
                  <template #body="{ data: i }">
                    <div class="flex flex-wrap gap-2">
                      <CustomButton v-if="bolehCatat && !i.transfusiUuid" label="Catat Mulai" size="small" icon="PhPlay" @click="bukaCatat(i)" />
                      <CustomButton v-if="bolehCatat && i.statusTransfusi === 'berlangsung'" label="Selesai" size="small" icon="PhCheck" @click="bukaCatat(i, true)" />
                      <CustomButton
                        v-if="bolehCatat && i.transfusiUuid && i.statusTransfusi !== 'reaksi'"
                        icon="PhPencilSimple"
                        size="small"
                        outlined
                        borderColor="border-opensimrs-300"
                        textColor="text-opensimrs-300"
                        @click="bukaCatat(i)"
                      />
                      <CustomButton
                        v-if="bolehReaksi && i.transfusiUuid"
                        label="Lapor Reaksi"
                        size="small"
                        icon="PhWarning"
                        outlined
                        borderColor="border-danger-300"
                        textColor="text-danger-300"
                        @click="bukaReaksi(i)"
                      />
                    </div>
                  </template>
                </Column>
              </DataTable>
            </TabPanel>

            <TabPanel value="reaksi">
              <div class="flex items-end gap-2 mb-3">
                <CustomSelect
                  v-model="filterReaksi"
                  label="Status Tindak Lanjut"
                  :options="Object.entries(STATUS_TINDAK_LANJUT_REAKSI).map(([value, g]) => ({ value, label: g.label }))"
                  optionValue="value"
                  optionLabel="label"
                  placeHolder="Semua"
                  :showFilter="false"
                  class="w-[240px]"
                  @update:modelValue="muatReaksi"
                />
                <CustomButton icon="PhArrowClockwise" @click="muatReaksi" />
              </div>
              <NoData v-if="!reaksi.length" />
              <DataTable v-else :value="reaksi" stripedRows class="text-xs" tableStyle="min-width: 60rem">
                <Column header="Dilaporkan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">
                    <div>{{ waktuBdrs(r.createdAt) }}</div>
                    <div class="text-grey-400">{{ r.dilaporkanOleh ?? "-" }}</div>
                  </template>
                </Column>
                <Column header="Pasien / Kantong" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">
                    <div class="font-semibold">{{ r.namaPasien }}</div>
                    <div class="text-grey-400">{{ r.noRm }} · {{ r.noKantong }} · {{ r.noPermintaan }}</div>
                  </template>
                </Column>
                <Column header="Reaksi" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">
                    <div class="font-semibold">{{ r.jenisReaksi }}</div>
                    <div class="text-grey-400">{{ r.gejala }}</div>
                  </template>
                </Column>
                <Column header="Tindak Lanjut" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaReaksiBdrs(r.statusTindakLanjut)?.bg, gayaReaksiBdrs(r.statusTindakLanjut)?.text]">
                      {{ gayaReaksiBdrs(r.statusTindakLanjut)?.label ?? r.statusTindakLanjut }}
                    </span>
                    <div v-if="r.tindakLanjut" class="text-grey-400">{{ r.tindakLanjut }}</div>
                    <div v-if="r.diterimaBdrsOleh" class="text-grey-400">oleh {{ r.diterimaBdrsOleh }}</div>
                  </template>
                </Column>
                <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[140px]">
                  <template #body="{ data: r }">
                    <CustomButton v-if="bolehReaksi && r.statusTindakLanjut !== 'selesai'" label="Tindak Lanjut" size="small" @click="bukaTl(r)" />
                  </template>
                </Column>
              </DataTable>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>

    <!-- Catat transfusi -->
    <CustomDialog v-model:visible="dialogCatat" width="600px">
      <template #header>Catat Transfusi — Kantong {{ itemAktif?.noKantong }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="text-sm text-grey-400">{{ itemAktif?.namaPasien }} · {{ itemAktif?.noRm }} · {{ itemAktif?.komponenNama }} {{ golonganRh(itemAktif?.golonganAbo, itemAktif?.rhesus) }}</div>
          <div class="grid grid-cols-2 gap-3">
            <CustomDatePicker v-model="formCatat.waktuMulai" label="Waktu Mulai" showTime required :maxDate="new Date()" />
            <CustomDatePicker v-model="formCatat.waktuSelesai" label="Waktu Selesai" showTime :minDate="formCatat.waktuMulai ?? undefined" />
          </div>
          <CustomSelect
            v-model="formCatat.status"
            label="Status"
            :options="[{ value: 'berlangsung', label: 'Berlangsung' }, { value: 'selesai_tanpa_reaksi', label: 'Selesai Tanpa Reaksi' }]"
            optionValue="value"
            optionLabel="label"
            :showFilter="false"
            :clearable="false"
          />
          <CustomTextArea v-model="formCatat.hasilPemantauan" label="Hasil Pemantauan" placeholder="mis. TD 120/80, nadi 88, suhu 36,8 °C, tanpa keluhan" />
          <div class="text-xs text-grey-400">Bila terjadi reaksi, simpan catatan ini lalu gunakan tombol "Lapor Reaksi".</div>
          <div v-if="galatCatat" class="text-sm text-danger-300">{{ galatCatat }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogCatat = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanCatat" />
        </div>
      </template>
    </CustomDialog>

    <!-- Lapor reaksi -->
    <CustomDialog v-model:visible="dialogReaksi" width="560px" headerBg="bg-danger-300">
      <template #header>Lapor Reaksi Transfusi — Kantong {{ itemAktif?.noKantong }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="px-3 py-2 text-xs rounded-lg bg-[#FDE2E1] text-[#B42318]">Hentikan transfusi segera, pertahankan akses IV, dan kirim kantong beserta sampel darah pasien ke BDRS.</div>
          <CustomSelect v-model="formReaksi.jenisReaksi" label="Jenis Reaksi" placeHolder="Pilih jenis reaksi" :options="JENIS_REAKSI" optionValue="value" optionLabel="label" required />
          <CustomTextArea v-model="formReaksi.gejala" label="Gejala" placeholder="mis. menggigil, demam 38,9 °C, urtikaria" required />
          <CustomTextArea v-model="formReaksi.tindakLanjut" label="Tindakan Awal di Ruangan" placeholder="Opsional" />
          <div v-if="galatReaksi" class="text-sm text-danger-300">{{ galatReaksi }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogReaksi = false" />
          <CustomButton label="Laporkan" icon="PhWarning" backgroundColor="bg-danger-300" @click="simpanReaksi" />
        </div>
      </template>
    </CustomDialog>

    <!-- Tindak lanjut reaksi -->
    <CustomDialog v-model:visible="dialogTl" width="520px">
      <template #header>Tindak Lanjut Reaksi — {{ reaksiAktif?.noKantong }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="text-sm"><b>{{ reaksiAktif?.jenisReaksi }}</b> · {{ reaksiAktif?.gejala }}</div>
          <CustomSelect
            v-model="formTl.statusTindakLanjut"
            label="Status"
            :options="Object.entries(STATUS_TINDAK_LANJUT_REAKSI).map(([value, g]) => ({ value, label: g.label }))"
            optionValue="value"
            optionLabel="label"
            :showFilter="false"
            :clearable="false"
          />
          <CustomTextArea v-model="formTl.tindakLanjut" label="Tindak Lanjut BDRS" placeholder="mis. uji ulang golongan & crossmatch sampel pasca-transfusi, DAT" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogTl = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanTl" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
