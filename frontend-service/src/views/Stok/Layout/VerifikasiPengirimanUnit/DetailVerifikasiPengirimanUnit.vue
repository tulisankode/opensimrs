<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomCheckbox from "@/components/Base/CustomCheckbox.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import PlusIcon from "@/components/icons/PlusIcon.vue";
import { PhMinus } from "@phosphor-icons/vue";
import DeleteDialogPengirimanUnit from "./DeleteDialogPengirimanUnit.vue";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  toRaw,
  unref,
  watch,
} from "vue";
import * as yup from "yup";
import { toTypedSchema } from "@vee-validate/yup";
import { useForm, useFieldArray } from "vee-validate";
import { formatDate } from "@/utils/Helpers";
import { useVerifikasiPengirimanBarangStore } from "@/stores/stok/VerifikasiPengirimanBarang";

// Terima data dari list
const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
});

const isSubmitting = ref(false);
const isDeleteDialogVisible = ref(false);
const pengiriman = ref(0);
// Selection state per row (keyed by item.no)

const schema = toTypedSchema(
  yup.object({
    uuid: yup.string().required(),
    noPermintaan: yup.string().optional(),
    tanggalPermintaan: yup.date().optional(),
    kategoriItem: yup.string().optional(),
    jenisStok: yup.string().optional(),
    jenisItem: yup.string().optional(),
    tujuanPermintaan: yup.string().optional(),
    cito: yup.boolean().optional(),
    catatan: yup.string().optional(),
    catatanPengiriman: yup.string().when("status", {
      is: (val: string) => ["verified", "verif_sebagian"].includes(val),
      then: (schema) => schema.required("Catatan pengiriman harus diisi"),
      otherwise: (schema) => schema.optional(),
    }),
    status: yup.string().optional(),
    statusLabel: yup.string().optional(),
    items: yup.array().of(
      yup.object({
        namaItem: yup.string().optional(),
        stokKetikaPermintaan: yup.number().optional(),
        satuan: yup.string().optional(),
        jumlahPermintaan: yup.number().optional(),
        pengiriman: yup.number().optional(),
        action: yup.boolean().optional(),
        permintaanUnitItemUuid: yup.string().required(),
      })
    ),
  })
);

const { errors, handleSubmit, defineField, setValues } = useForm({
  validationSchema: schema,
  initialValues: {
    items: [
      {
        namaItem: "",
        stokKetikaPermintaan: 0,
        satuan: "",
        pengiriman: 0,
        jumlahPermintaan: 0,
        action: false,
        permintaanUnitItemUuid: "",
      },
    ],
  },
});

const {
  remove,
  push,
  fields: fieldsVerifUnit,
  replace,
} = useFieldArray("items");

const [uuid] = defineField("uuid");
const [noPermintaan] = defineField("noPermintaan");
const [tanggalPermintaan] = defineField("tanggalPermintaan");
const [kategoriItem] = defineField("kategoriItem");
const [jenisStok] = defineField("jenisStok");
const [jenisItem] = defineField("jenisItem");
const [tujuanPermintaan] = defineField("tujuanPermintaan");
const [cito] = defineField("cito");
const [catatan] = defineField("catatan");
const [catatanPengiriman] = defineField("catatanPengiriman");
const [status] = defineField("status");
const [statusLabel] = defineField("statusLabel");

// Mapping warna berdasarkan status
const STATUS_COLOR_MAP: Record<string, string> = {
  request: "bg-grey-300",
  request_sebagian: "bg-grey-300",
  verified: "bg-aqua-300",
  verif_sebagian: "bg-aqua-300",
  cancel: "bg-danger-300",
  dikirim: "bg-mint-300",
};

// Kelas background yang aman terhadap nilai undefined/unknown
const statusColorClass = computed(
  () => STATUS_COLOR_MAP[status.value ?? ""] ?? "bg-grey-300"
);

const getLocalJSON = (key: string) => {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const petugasName = computed(
  () => getLocalJSON("user")?.name ?? "Nama Petugas"
);

// Normalisasi payload props.data -> bentuk schema form lalu setValues
const mapDataToFormValues = (data: any) => ({
  uuid: data?.uuid ?? "",
  noPermintaan: data?.noPermintaan ?? "",
  tanggalPermintaan: data?.tanggalPermintaan
    ? new Date(data.tanggalPermintaan)
    : undefined,
  kategoriItem: data?.kategoriItem ?? "",
  jenisStok: data?.jenisStokName ?? data?.jenisStok ?? "",
  jenisItem: data?.jenisItem ?? "",
  tujuanPermintaan: data?.lokasiTujuan?.name ?? "",
  cito: Boolean(data?.cito),
  catatan: data?.catatan ?? "",
  status: data?.status ?? "",
  statusLabel: data?.statusLabel ?? "",
  items: Array.isArray(data?.items)
    ? data.items.map((it: any) => ({
        namaItem: it?.namaItem ?? "",
        stokKetikaPermintaan: it?.sisaStok ?? 0,
        satuan: it?.satuanName ?? "",
        jumlahPermintaan: it?.jumlahPermintaan ?? 0,
        pengiriman: it?.jumlahPermintaan ?? 0,
        action: ["verified", "verif_sebagian"].includes(data?.status ?? "")
          ? true
          : false,
        permintaanUnitItemUuid: it?.permintaanUnitItemUuid ?? "",
      }))
    : [],
});

const allSelected = computed({
  get: () =>
    fieldsVerifUnit.value.length > 0 &&
    fieldsVerifUnit.value.every((f: any) => !!f.value.action),
  set: (val: boolean) => {
    fieldsVerifUnit.value.forEach((f: any) => {
      f.value.action = val;
    });
  },
});

// Watch props.data dan apply ke form saat halaman dibuka/berubah
watch(
  () => props.data,
  (val) => {
    const normalized = mapDataToFormValues(val || {});
    setValues(normalized);
    // Pastikan field array benar-benar sinkron dengan items yang baru
    replace(normalized.items);
    // Pastikan semua item terpilih ketika verified / verif_sebagian
    if (["verified", "verif_sebagian"].includes(normalized.status ?? "")) {
      allSelected.value = true;
    }
  },
  { immediate: true, deep: true }
);

const verifikasiPengirimanBarangStore = useVerifikasiPengirimanBarangStore();

const onSubmit = handleSubmit(async (values: any) => {
  isSubmitting.value = true;
  try {
    // Tentukan status saat ini, ambil dari field atau fallback ke values.status
    const currentStatus = status.value ?? values.status;

    // Map status berdasarkan aturan yang diinginkan
    const nextStatus = ["request", "request_sebagian"].includes(currentStatus)
      ? "verified"
      : ["verified", "verif_sebagian"].includes(currentStatus)
      ? "dikirim"
      : currentStatus;

    const payload: any = {
      status: nextStatus,
      catatan_pengiriman: values.catatanPengiriman,
    };

    if (nextStatus !== "dikirim") {
      payload.items = fieldsVerifUnit.value
        .map((f: any) => f.value)
        .filter((v: any) => !!v.action)
        .map((v: any) => ({
          uuid: v.permintaanUnitItemUuid,
          qty_pengiriman: v.pengiriman,
        }));
    }

    await verifikasiPengirimanBarangStore.verifChangeStatus(
      values.uuid,
      payload
    );
    emit("saved");
    emit("back");
  } catch (error) {
    console.error("Error verifChangeStatus:", error);
  } finally {
    isSubmitting.value = false;
  }
});

// Function to show cancel dialog
const showCancelDialog = () => {
  isDeleteDialogVisible.value = true;
};

// Function to handle cancellation
const handleCancellation = (alasan: string) => {
  console.log("Permintaan dibatalkan dengan alasan:", alasan);
  // Add your cancellation logic here
  // For example: call API to cancel the request
  // Then navigate back or update the status
  emit("back");
};

const emit = defineEmits(["back", "saved"]);

// Kontainer konten untuk mendeteksi overflow
const contentRef = ref<HTMLElement | null>(null);
const isSticky = ref(false);
let resizeObserver: ResizeObserver | null = null;

const updateSticky = () => {
  const el = contentRef.value;
  if (!el) {
    isSticky.value = false;
    return;
  }
  // Sticky aktif jika konten overflow (tinggi konten > tinggi tampilan)
  isSticky.value = el.scrollHeight - el.clientHeight > 2;
};

onMounted(() => {
  nextTick(updateSticky);
  resizeObserver = new ResizeObserver(() => updateSticky());
  if (contentRef.value) resizeObserver.observe(contentRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect?.();
});

// Re-evaluasi saat jumlah baris berubah
watch(fieldsVerifUnit, () => nextTick(updateSticky), { deep: true });

onMounted(() => {
  console.log("DetailPermintaanBarang menerima data:", props.data);
});
</script>

<template>
  <div class="flex flex-col h-full">
    <Card
      pt:body:class="flex overflow-hidden flex-col flex-1 pt-0"
      pt:content:class="flex overflow-hidden flex-col flex-1"
      class="flex overflow-hidden flex-col h-full"
    >
      <template #header>
        <CustomAccordion :openWithHeader="false" noBorder initial-state="0">
          <template #header>
            <div class="flex justify-between w-full align-middle">
              <div class="flex">
                <CustomButton
                  icon="PhArrowClockwise"
                  @click=""
                  class="mr-5"
                  title="Refresh"
                />
                <CustomBreadCrumb
                  :home="{
                    label: 'Pengeluaran Barang',
                    home: true,
                  }"
                />
                <PhCaretRight
                  :size="25"
                  weight="bold"
                  class="ml-[10px] mt-[8px] text-opensimrs-300"
                />
                <div class="">
                  <p
                    class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]"
                  >
                    Permintaan Unit
                  </p>
                </div>
                <PhCaretRight
                  :size="25"
                  weight="bold"
                  class="ml-[10px] mt-[8px] text-opensimrs-300"
                />
                <div class="px-2 space-x-2">
                  <CustomButton :label="noPermintaan" />
                  <CustomButton
                    :backgroundColor="statusColorClass"
                    size="small"
                    :label="statusLabel"
                  />
                </div>
              </div>
              <CustomButton
                @click="emit('back')"
                icon="PhCaretLeft"
                label="Kembali"
                class="mr-[10px]"
              />
            </div>
          </template>
          <template #content>
            <div class="py-3 space-y-3">
              <div class="grid grid-cols-4 gap-2">
                <div class="flex flex-col">
                  <div class="text-sm font-bold underline">Tgl. Permintaan</div>
                  <div>{{ formatDate(tanggalPermintaan) }}</div>
                </div>
                <div class="flex flex-col">
                  <div class="text-sm font-bold underline">Kategori Item</div>
                  <div>{{ kategoriItem }}</div>
                </div>
                <div class="flex flex-col">
                  <div class="text-sm font-bold underline">Jenis Stok</div>
                  <div>{{ jenisStok }}</div>
                </div>
                <div class="flex flex-col">
                  <div class="text-sm font-bold underline">Jenis Item</div>
                  <div>{{ jenisItem }}</div>
                </div>
              </div>
              <div class="grid grid-cols-4 gap-2">
                <div class="flex flex-col col-start-1">
                  <div class="text-sm font-bold underline">
                    Tujuan Permintaan
                  </div>
                  <div>{{ tujuanPermintaan }}</div>
                </div>
                <div class="flex flex-col col-start-2">
                  <div class="text-sm font-bold underline">CITO</div>
                  <div>
                    <CustomButton
                      v-if="cito"
                      size="small"
                      backgroundColor="bg-danger-300"
                      :label="cito ? 'CITO' : '-'"
                    />
                    <template v-else>-</template>
                  </div>
                </div>
                <div class="flex flex-col col-start-3">
                  <div class="text-sm font-bold underline">Catatan</div>
                  <div>{{ catatan }}</div>
                </div>
              </div>
            </div>
          </template>
          <template #collapseIcon>
            <CustomButton
              icon="PhCaretUp"
              backgroundColor="bg-opensimrs-75"
              textColor="text-opensimrs-300"
            />
          </template>
          <template #expandIcon>
            <CustomButton
              icon="PhCaretDown"
              backgroundColor="bg-opensimrs-75"
              textColor="text-opensimrs-300"
            />
          </template>
        </CustomAccordion>
      </template>
      <template #content>
        <div class="flex overflow-auto flex-col flex-1 min-h-0">
          <div class="flex-none">
            <DataTable
              :value="fieldsVerifUnit"
              stripedRows
              scrollable
              class="h-full text-xs"
            >
              <Column header="No" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-center">
                    {{ slotProps.index + 1 }}
                  </div>
                </template>
              </Column>
              <Column
                header="Nama Item"
                headerClass="bg-opensimrs-50"
                field="namaItem"
              >
                <template #body="slotProps">
                  <div class="text-left">
                    {{ slotProps.data.value.namaItem }}
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="font-semibold">Stok Ketika Permintaan</div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center w-full">
                    {{ slotProps.data.value.stokKetikaPermintaan }}
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="flex justify-center w-full font-semibold">
                    Satuan/Isi
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center w-full">
                    {{ slotProps.data.value.satuan }}
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="flex justify-center w-full font-semibold">
                    Jumlah Permintaan
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center w-full">
                    {{ slotProps.data.value.jumlahPermintaan }}
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50  ">
                <template #header>
                  <div class="flex justify-center w-full font-semibold">
                    Pengiriman
                  </div>
                </template>
                <template
                  #body="slotProps"
                  v-if="['request', 'request_sebagian'].includes(status)"
                >
                  <CustomInputNumber
                    prependIcon="PhPlus"
                    appendIcon="PhMinus"
                    :showLabel="false"
                    v-model="slotProps.data.value.pengiriman"
                  />
                </template>
                <template #body="slotProps" v-else>
                  <div class="text-center">
                    {{ slotProps.data.value.pengiriman ?? 0 }}
                  </div>
                </template>
              </Column>
              <Column
                headerClass="bg-opensimrs-50"
                v-if="['request', 'request_sebagian'].includes(status)"
              >
                <template #header>
                  <div class="flex gap-2 justify-center w-full">
                    <div class="font-bold">Action</div>
                    <div>
                      <!-- Checkbox header: pilih semua -->
                      <Checkbox v-model="allSelected" binary />
                    </div>
                  </div>
                </template>
                <!-- Checkbox per baris: bind ke item.action -->
                <template #body="slotProps">
                  <Checkbox
                    class="flex justify-center w-full"
                    v-model="slotProps.data.value.action"
                    binary
                  />
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between py-2 border-t border-grey-200">
          <div class="flex gap-16 justify-between">
            <div class="flex gap-6">
              <div>
                <div class="font-semibold underline">Total Item</div>
                <div>{{ fieldsVerifUnit.length }}</div>
              </div>
              <div>
                <div class="font-semibold underline">Petugas Permintaan</div>
                <div>{{ petugasName }}</div>
              </div>
            </div>

            <CustomTextfield
              v-if="['verified', 'verif_sebagian'].includes(status)"
              v-model="catatanPengiriman"
              placeholder="Catatan Pengiriman"
              :showLabel="false"
              :invalid="!!errors.catatanPengiriman"
              :invalidMessage="errors.catatanPengiriman"
            />
          </div>
          <div class="flex gap-3">
            <CustomButton
              v-if="['request', 'request_sebagian'].includes(status)"
              label="Tolak Permintaan"
              backgroundColor="bg-danger-300"
              textColor="text-white"
              @click="showCancelDialog"
            />
            <CustomButton
              v-if="['request', 'request_sebagian'].includes(status)"
              @click="onSubmit"
              :disabled="isSubmitting"
              label="Verifikasi"
              backgroundColor="bg-opensimrs-300"
              textColor="text-white"
            />
            <CustomButton
              v-if="['verified', 'verif_sebagian'].includes(status)"
              @click="onSubmit"
              :disabled="isSubmitting"
              label="Kirim Barang"
              backgroundColor="bg-opensimrs-300"
              textColor="text-white"
            />
          </div>
        </div>
      </template>
    </Card>
    <DeleteDialogPengirimanUnit
      v-model:isDialogVisible="isDeleteDialogVisible"
      @cancel="handleCancellation"
      :data="uuid"
    />
  </div>
</template>

<style lang="scss" scoped></style>
