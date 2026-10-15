<script setup lang="ts">
import { ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";

const emit = defineEmits(["onDelete", "update:dataSurat"]);

const props = defineProps({
  nomorSurat: {
    type: String,
    default: "",
  },
});

const tabs = ref([
  { title: "Pro login quitat", value: "0" },
  { title: "Pro Domo", value: "1" },
  { title: "Pro propin quitat", value: "2" },
]);
const schema = toTypedSchema(
  yup.object({
    noSurat: yup.string().default("No. 12345").notRequired(),
    pemeriksaan: yup.string().required("Pemeriksaan harus dipilih"),
    odData: yup.object({
      proLoginQuitat: yup.object({
        vitrumSpher: yup.number(),
        vitrumCylndr: yup.number(),
        axis: yup.number(),
        prismaBasis: yup.number(),
      }),
      proDomo: yup.object({
        vitrumSpher: yup.number(),
        vitrumCylndr: yup.number(),
        axis: yup.number(),
        prismaBasis: yup.number(),
      }),
      proPropinQuitat: yup.object({
        vitrumSpher: yup.number(),
        vitrumCylndr: yup.number(),
        axis: yup.number(),
        prismaBasis: yup.number(),
      }),
    }),
    osData: yup.object({
      proLoginQuitat: yup.object({
        vitrumSpher: yup.number(),
        vitrumCylndr: yup.number(),
        axis: yup.number(),
        prismaBasis: yup.number(),
      }),
      proDomo: yup.object({
        vitrumSpher: yup.number(),
        vitrumCylndr: yup.number(),
        axis: yup.number(),
        prismaBasis: yup.number(),
      }),
      proPropinQuitat: yup.object({
        vitrumSpher: yup.number(),
        vitrumCylndr: yup.number(),
        axis: yup.number(),
        prismaBasis: yup.number(),
      }),
    }),
    otherData: yup.object({
      proLoginQuitat: yup.object({
        distantVitror: yup.string().notRequired().default(""),
        formaVitror: yup.string().notRequired().default(""),
        colrVitror: yup.string().notRequired().default(""),
      }),
      proDomo: yup.object({
        distantVitror: yup.string().notRequired().default(""),
        formaVitror: yup.string().notRequired().default(""),
        colrVitror: yup.string().notRequired().default(""),
      }),
      proPropinQuitat: yup.object({
        distantVitror: yup.string().notRequired().default(""),
        formaVitror: yup.string().notRequired().default(""),
        colrVitror: yup.string().notRequired().default(""),
      }),
    }),
  }).noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setFieldValue } = useForm({
  validationSchema: schema,
});

const [noSurat] = defineField("noSurat");
const [pemeriksaan] = defineField("pemeriksaan");

// Binding untuk OD proLoginQuitat
const [odLoginSpher] = defineField("odData.proLoginQuitat.vitrumSpher");
const [odLoginCylndr] = defineField("odData.proLoginQuitat.vitrumCylndr");
const [odLoginAxis] = defineField("odData.proLoginQuitat.axis");
const [odLoginPrisma] = defineField("odData.proLoginQuitat.prismaBasis");

// Binding untuk OD proDomo
const [odDomoSpher] = defineField("odData.proDomo.vitrumSpher");
const [odDomoCylndr] = defineField("odData.proDomo.vitrumCylndr");
const [odDomoAxis] = defineField("odData.proDomo.axis");
const [odDomoPrisma] = defineField("odData.proDomo.prismaBasis");

// Binding untuk OD proPropinQuitat
const [odPropinSpher] = defineField("odData.proPropinQuitat.vitrumSpher");
const [odPropinCylndr] = defineField("odData.proPropinQuitat.vitrumCylndr");
const [odPropinAxis] = defineField("odData.proPropinQuitat.axis");
const [odPropinPrisma] = defineField("odData.proPropinQuitat.prismaBasis");

// Binding untuk OS proLoginQuitat
const [osLoginSpher] = defineField("osData.proLoginQuitat.vitrumSpher");
const [osLoginCylndr] = defineField("osData.proLoginQuitat.vitrumCylndr");
const [osLoginAxis] = defineField("osData.proLoginQuitat.axis");
const [osLoginPrisma] = defineField("osData.proLoginQuitat.prismaBasis");

// Binding untuk OS proDomo
const [osDomoSpher] = defineField("osData.proDomo.vitrumSpher");
const [osDomoCylndr] = defineField("osData.proDomo.vitrumCylndr");
const [osDomoAxis] = defineField("osData.proDomo.axis");
const [osDomoPrisma] = defineField("osData.proDomo.prismaBasis");

// Binding untuk OS proPropinQuitat
const [osPropinSpher] = defineField("osData.proPropinQuitat.vitrumSpher");
const [osPropinCylndr] = defineField("osData.proPropinQuitat.vitrumCylndr");
const [osPropinAxis] = defineField("osData.proPropinQuitat.axis");
const [osPropinPrisma] = defineField("osData.proPropinQuitat.prismaBasis");

// Binding untuk Other proLoginQuitat
const [otherLoginDistant] = defineField("otherData.proLoginQuitat.distantVitror");
const [otherLoginForma] = defineField("otherData.proLoginQuitat.formaVitror");
const [otherLoginColr] = defineField("otherData.proLoginQuitat.colrVitror");

// Binding untuk Other proDomo
const [otherDomoDistant] = defineField("otherData.proDomo.distantVitror");
const [otherDomoForma] = defineField("otherData.proDomo.formaVitror");
const [otherDomoColr] = defineField("otherData.proDomo.colrVitror");

// Binding untuk Other proPropinQuitat
const [otherPropinDistant] = defineField("otherData.proPropinQuitat.distantVitror");
const [otherPropinForma] = defineField("otherData.proPropinQuitat.formaVitror");
const [otherPropinColr] = defineField("otherData.proPropinQuitat.colrVitror");

const itemsPoli = ref(["Poli Gigi", "Poli Mata", "Poli Anak"]);
const itemsDokter = ref(["Dokter Aminah", "Dokter Siti", "Dokter Adam"]);

const submitForm = handleSubmit((values) => {
  emit("update:dataSurat", values);
  return values;
});
const accordion = ref<HTMLCanvasElement | null>(null);
const open = () => {
  if (accordion.value) {
    (accordion.value as any).open();
  }
};
const close = () => {
  if (accordion.value) {
    (accordion.value as any).close();
  }
};

watch(
  () => props.nomorSurat,
  (newVal) => {
    if (newVal) {
      setFieldValue("noSurat", newVal);
    }
  },
  { immediate: true }
);

defineExpose({
  submitForm,
  open,
  close,
});

const optionsPemeriksaan = ref(["monofokus", "bifokus", "progressive"]);
</script>

<template>
  <CustomAccordion
    headerClass="bg-opensimrs-50"
    initial-state="0"
    ref="accordion"
  >
    <template #header>
      <div class="flex items-center justify-between w-full pr-2.5">
        Surat Resep Kacamata
        <PhX :size="20" @click="emit('onDelete')" />
      </div>
    </template>
    <template #content>
      <div class="grid grid-cols-12 gap-y-5 pt-5">
        <CustomTextfield
          label="No. Surat"
          v-model="noSurat"
          class="col-span-4"
          :disabled="true"
        />

        <div
          class="w-full border border-opensimrs-300 col-span-12 flex items-center justify-center"
        >
          <img src="@/assets/images/Resep Pemeriksaan Mata.svg" />
        </div>

        <div class="col-span-12 overflow-x-auto">
          <table class="summary-table w-full border-collapse">
            <thead>
              <tr>
                <th rowspan="2"></th>
                <th colspan="4">OD</th>
                <th colspan="4">OS</th>
                <th rowspan="2">Distant Vitror</th>
                <th rowspan="2">Forma Vitror</th>
                <th rowspan="2">Color Vitror</th>
              </tr>
              <tr>
                <th>Vitrum Spher</th>
                <th>Vitrum Cylndr</th>
                <th>Axis</th>
                <th>Prisma Basis</th>
                <th>Vitrum Spher</th>
                <th>Vitrum Cylndr</th>
                <th>Axis</th>
                <th>Prisma Basis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="row-header">Pro login quitat</td>
                <td>{{ odLoginSpher || "-" }}</td>
                <td>{{ odLoginCylndr || "-" }}</td>
                <td>{{ odLoginAxis || "-" }}</td>
                <td>{{ odLoginPrisma || "-" }}</td>
                <td>{{ osLoginSpher || "-" }}</td>
                <td>{{ osLoginCylndr || "-" }}</td>
                <td>{{ osLoginAxis || "-" }}</td>
                <td>{{ osLoginPrisma || "-" }}</td>
                <td>{{ otherLoginDistant || "-" }}</td>
                <td>{{ otherLoginForma || "-" }}</td>
                <td>{{ otherLoginColr || "-" }}</td>
              </tr>
              <tr>
                <td class="row-header">Pro domo</td>
                <td>{{ odDomoSpher || "-" }}</td>
                <td>{{ odDomoCylndr || "-" }}</td>
                <td>{{ odDomoAxis || "-" }}</td>
                <td>{{ odDomoPrisma || "-" }}</td>
                <td>{{ osDomoSpher || "-" }}</td>
                <td>{{ osDomoCylndr || "-" }}</td>
                <td>{{ osDomoAxis || "-" }}</td>
                <td>{{ osDomoPrisma || "-" }}</td>
                <td>{{ otherDomoDistant || "-" }}</td>
                <td>{{ otherDomoForma || "-" }}</td>
                <td>{{ otherDomoColr || "-" }}</td>
              </tr>
              <tr>
                <td class="row-header">Pro propin quitat</td>
                <td>{{ odPropinSpher || "-" }}</td>
                <td>{{ odPropinCylndr || "-" }}</td>
                <td>{{ odPropinAxis || "-" }}</td>
                <td>{{ odPropinPrisma || "-" }}</td>
                <td>{{ osPropinSpher || "-" }}</td>
                <td>{{ osPropinCylndr || "-" }}</td>
                <td>{{ osPropinAxis || "-" }}</td>
                <td>{{ osPropinPrisma || "-" }}</td>
                <td>{{ otherPropinDistant || "-" }}</td>
                <td>{{ otherPropinForma || "-" }}</td>
                <td>{{ otherPropinColr || "-" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <CustomSelect
          label="Pemeriksaan"
          v-model="pemeriksaan"
          :options="optionsPemeriksaan"
          option-label=""
          option-value=""
          place-holder="Pilih Pemeriksaan"
          class="col-span-12"
          :invalid="!!errors.pemeriksaan"
          :invalidMessage="errors.pemeriksaan"
          />
        <div class="col-span-6 border-r pr-5 boder-grey-200">
          <div class="font-semibold text-normal mb-2.5">Resep OD</div>
          <Tabs
            value="0"
            :dt="{
              tabHoverBackground: '#E8F8F6',
              tabActiveBackground: '#E8F8F6',
              tabColor: '#D0D5DD',
              tabHoverColor: '#14B8A6',
              tabActiveColor: '#14B8A6',
              tabpanelFocusRingColor: '#000000',
            }"
          >
            <TabList>
              <Tab
                v-for="tab in tabs"
                :key="tab.title"
                :value="tab.value"
                :pt="{
                  root: {
                    class:
                      'font-semibold text-SM h-[40px] flex items-center border-b-[2px]',
                    },
                }"
                >{{ tab.title }}
              </Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="0">
                <div class="grid grid-cols-2 gap-x-5 gap-y-2.5 pt-4">
                  <CustomInputNumber
                    v-model="odLoginSpher"
                    label="Vitrum Spher"
                    />
                  <CustomInputNumber
                    v-model="odLoginCylndr"
                    label="Vitrum Cylndr"
                    />
                  <CustomInputNumber v-model="odLoginAxis" label="Axis" />
                  <CustomInputNumber
                    v-model="odLoginPrisma"
                    label="Prisma Basis"
                  />
                </div>
              </TabPanel>

              <TabPanel value="1">
                <div class="grid grid-cols-2 gap-x-5 gap-y-2.5 pt-4">
                  <CustomInputNumber
                    v-model="odDomoSpher"
                    label="Vitrum Spher"
                    />
                  <CustomInputNumber
                    v-model="odDomoCylndr"
                    label="Vitrum Cylndr"
                    />
                  <CustomInputNumber v-model="odDomoAxis" label="Axis" />
                  <CustomInputNumber
                    v-model="odDomoPrisma"
                    label="Prisma Basis"
                    />
                </div>
              </TabPanel>

              <TabPanel value="2">
                <div class="grid grid-cols-2 gap-x-5 gap-y-2.5 pt-4">
                  <CustomInputNumber
                    v-model="odPropinSpher"
                    label="Vitrum Spher"
                  />
                  <CustomInputNumber
                    v-model="odPropinCylndr"
                    label="Vitrum Cylndr"
                  />
                  <CustomInputNumber v-model="odPropinAxis" label="Axis" />
                  <CustomInputNumber
                  v-model="odPropinPrisma"
                  label="Prisma Basis"
                  />
                </div>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
        <div class="col-span-6 pl-5">
          <div class="font-semibold text-normal mb-2.5">Resep OS</div>
          <Tabs
            value="0"
            :dt="{
              tabHoverBackground: '#E8F8F6',
              tabActiveBackground: '#E8F8F6',
              tabColor: '#D0D5DD',
              tabHoverColor: '#14B8A6',
              tabActiveColor: '#14B8A6',
              tabpanelFocusRingColor: '#000000',
            }"
          >
            <TabList>
              <Tab
              v-for="tab in tabs"
                :key="tab.title"
                :value="tab.value"
                :pt="{
                  root: {
                    class:
                    'font-semibold text-SM h-[40px] flex items-center border-b-[2px]',
                  },
                }"
                >{{ tab.title }}
              </Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="0">
                <div class="grid grid-cols-2 gap-x-5 gap-y-2.5 pt-4">
                  <CustomInputNumber
                  v-model="osLoginSpher"
                    label="Vitrum Spher"
                    />
                  <CustomInputNumber
                    v-model="osLoginCylndr"
                    label="Vitrum Cylndr"
                    />
                  <CustomInputNumber v-model="osLoginAxis" label="Axis" />
                  <CustomInputNumber
                  v-model="osLoginPrisma"
                  label="Prisma Basis"
                  />
                </div>
              </TabPanel>

              <TabPanel value="1">
                <div class="grid grid-cols-2 gap-x-5 gap-y-2.5 pt-4">
                  <CustomInputNumber
                    v-model="osDomoSpher"
                    label="Vitrum Spher"
                  />
                  <CustomInputNumber
                    v-model="osDomoCylndr"
                    label="Vitrum Cylndr"
                    />
                  <CustomInputNumber v-model="osDomoAxis" label="Axis" />
                  <CustomInputNumber
                    v-model="osDomoPrisma"
                    label="Prisma Basis"
                    />
                </div>
              </TabPanel>

              <TabPanel value="2">
                <div class="grid grid-cols-2 gap-x-5 gap-y-2.5 pt-4">
                  <CustomInputNumber
                    v-model="osPropinSpher"
                    label="Vitrum Spher"
                    />
                  <CustomInputNumber
                    v-model="osPropinCylndr"
                    label="Vitrum Cylndr"
                    />
                  <CustomInputNumber v-model="osPropinAxis" label="Axis" />
                  <CustomInputNumber
                    v-model="osPropinPrisma"
                    label="Prisma Basis"
                  />
                </div>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>

        <div class="col-span-12">
          <Tabs
            value="0"
            :dt="{
              tabHoverBackground: '#E8F8F6',
              tabActiveBackground: '#E8F8F6',
              tabColor: '#D0D5DD',
              tabHoverColor: '#14B8A6',
              tabActiveColor: '#14B8A6',
              tabpanelFocusRingColor: '#000000',
            }"
          >
            <TabList>
              <Tab
                v-for="tab in tabs"
                :key="tab.title"
                :value="tab.value"
                :pt="{
                  root: {
                    class:
                      'font-semibold text-SM h-[40px] flex items-center border-b-[2px]',
                    },
                  }"
                >{{ tab.title }}
              </Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="0">
                <div class="grid grid-cols-12 gap-x-5 gap-y-2.5 pt-4">
                  <CustomTextfield
                    vid="otherData.proLoginQuitat.distantVitror"
                    v-model="otherLoginDistant"
                    label="Distant Vitror"
                    class="col-span-4 pr-5"
                  />
                  <CustomTextfield
                    vid="otherData.proLoginQuitat.formaVitror"
                    v-model="otherLoginForma"
                    label="Forma Vitror"
                    class="col-span-4 pr-5"
                  />
                  <CustomTextfield
                    vid="otherData.proLoginQuitat.colrVitror"
                    v-model="otherLoginColr"
                    label="Colr Vitror"
                    class="col-span-4"
                    />
                </div>
              </TabPanel>
              <TabPanel value="1">
                <div class="grid grid-cols-12 gap-x-5 gap-y-2.5 pt-4">
                  <CustomTextfield
                  vid="otherData.proDomo.distantVitror"
                    v-model="otherDomoDistant"
                    label="Distant Vitror"
                    class="col-span-4 pr-5"
                  />
                  <CustomTextfield
                  vid="otherData.proDomo.formaVitror"
                  v-model="otherDomoForma"
                  label="Forma Vitror"
                  class="col-span-4 pr-5"
                  />
                  <CustomTextfield
                  vid="otherData.proDomo.colrVitror"
                  v-model="otherDomoColr"
                    label="Colr Vitror"
                    class="col-span-4"
                  />
                </div>
              </TabPanel>
              <TabPanel value="2">
                <div class="grid grid-cols-12 gap-x-5 gap-y-2.5 pt-4">
                  <CustomTextfield
                  vid="otherData.proPropinQuitat.distantVitror"
                  v-model="otherPropinDistant"
                  label="Distant Vitror"
                    class="col-span-4 pr-5"
                    />
                  <CustomTextfield
                    vid="otherData.proPropinQuitat.formaVitror"
                    v-model="otherPropinForma"
                    label="Forma Vitror"
                    class="col-span-4 pr-5"
                  />
                  <CustomTextfield
                    vid="otherData.proPropinQuitat.colrVitror"
                    v-model="otherPropinColr"
                    label="Colr Vitror"
                    class="col-span-4"
                    />
                </div>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
        </div>
    </template>
  </CustomAccordion>
</template>
                    
<style scoped>
.summary-table th,
.summary-table td {
  border: 1px solid #e5e7eb; /* tailwind gray-200 */
  padding: 8px;
  text-align: center;
  min-width: 80px;
  height: 36px;
  font-size: 12px;
}
.summary-table th {
  @apply bg-opensimrs-50;
  font-weight: 600;
  vertical-align: middle;
}
.summary-table .row-header {
  text-align: left;
  font-weight: 600;
  @apply bg-opensimrs-50;
}
</style>