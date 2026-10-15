<script setup lang="ts">
import { onUpdated, ref, type PropType } from "vue";
import SessionTab from "./SessionTab.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { fiturAktif } from "@/stores/modulFaskes"; // Setting › Manajemen Modul & Fitur

// NOTE Store
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();

const emit = defineEmits([]);

const props = defineProps({
  rmType: {
    type: String,
    default: "rawat-jalan",
  },
  selectedRecord: {
    type: Object as PropType<any>,
  },
  sessions: {
    type: Array as PropType<any>,
    required: true,
  },
  rmUuid: {
    type: String,
    default: "",
  },
  viewMode: {
    type: String,
    default: "current",
  },
  // Diatur MedicalRecord saat SOAP Ringkas aktif (menghindari input ganda).
  sembunyikanSoap: { type: Boolean, default: false },
  sembunyikanAsesmen: { type: Boolean, default: false },
});

const listMedicalRecordTab = [
  {
    value: "rekam-medis",
    icon: "PhListPlus",
    text: "Rekam Medis",
  },
  {
    value: "asesmen",
    icon: "PhListChecks",
    text: "Asesmen",
  },
  {
    value: "soapier",
    icon: "PhStethoscope",
    text: "S.O.A.P.I.E.R",
  },
];

const selectedTab = defineModel<string>("selectedTab", {
  default: "rekam-medis",
});
const selectedSessionTab = defineModel<string>("selectedSessionTab", {
  default: "non-sesi",
});

const createNewSession = async (dataSession: any) => {
  try {
    storeUtils.setLoading(true);
    const response = await rekamMedisStore.createNewSession({
      rekamMedisUuid: props.rmUuid,
      dateOrder: props.selectedRecord.dateOrder,
    });
    if (response && response.payload) {
      if (response && response.payload) {
        let responseGetRM = await rekamMedisStore.getRekamMedis({
          rekamMedisUuid: props.rmUuid,
          dateOrder: props.selectedRecord.dateOrder,
          sessionOrder: props.sessions[props.sessions.length - 1].order + 1,
        });
        if (responseGetRM && responseGetRM.payload) {
          rekamMedisStore.setOpenedRekamMedisData(responseGetRM.payload);
        }
      }
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const deleteSessionDialog = ref(false);
const deleteSessionReason = ref<string>("");
const deleteSession = async () => {
  try {
    storeUtils.setLoading(true);
    const deletedSessionData = props.sessions.find(
      (session: any) => session.order == selectedSessionTab.value
    );

    const response = await rekamMedisStore.deleteSession({
      sessionUuid: deletedSessionData.id,
      alasan: deleteSessionReason.value,
    });
    if (response && response.payload) {
      const responseGetNewRM = await rekamMedisStore.getRekamMedis({
        rekamMedisUuid: props.rmUuid,
      });
      if (responseGetNewRM && responseGetNewRM.payload) {
        rekamMedisStore.setOpenedRekamMedisData(responseGetNewRM.payload);
        deleteSessionReason.value = "";
        deleteSessionDialog.value = false;
      }
    }
  } catch (error) {
    console.error("Failed to post data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div>
    <Tabs
      v-model:value="selectedTab"
      :dt="{
        tabActiveBackground: 'rgb(var(--opensimrs-50))',
        tabActiveColor: 'rgb(var(--opensimrs-300))',
        tabActiveBorderColor: 'rgb(var(--opensimrs-300))',
      }"
    >
      <TabList :pt="{ tabList: 'h-10 text-SM' }">
        <!-- SOAP Ringkas (1 layar): fitur rme_soap_ringkas, rawat jalan yang sedang berjalan -->
        <Tab
          v-if="rmType == 'rawat-jalan' && viewMode != 'history' && fiturAktif('rme_soap_ringkas')"
          class="py-0 px-[10px]"
          value="soap-ringkas"
          :pt="{ root: 'rounded-t-lg' }"
        >
          <div class="flex">
            <PhLightning
              v-if="selectedTab == 'soap-ringkas'"
              :size="18"
              weight="fill"
              class="mr-[10px]"
            />
            SOAP Ringkas
          </div>
        </Tab>
        <Tab
          class="py-0 px-[10px]"
          value="rekam-medis"
          :pt="{ root: 'rounded-t-lg' }"
        >
          <div class="flex">
            <PhListPlus
              v-if="selectedTab == 'rekam-medis'"
              :size="18"
              weight="fill"
              class="mr-[10px]"
            />
            Rekam Medis
          </div>
        </Tab>
        <Tab
          v-if="viewMode != 'history' && fiturAktif('rme_asesmen') && !sembunyikanAsesmen"
          class="py-0 px-[10px]"
          value="asesmen"
          :pt="{ root: 'rounded-t-lg' }"
        >
          <div class="flex">
            <PhListChecks
              v-if="selectedTab == 'asesmen'"
              :size="18"
              weight="fill"
              class="mr-[10px]"
            />
            Asesmen
          </div>
        </Tab>
        <Tab
          v-if="rmType != 'fisioterapi' && viewMode != 'history' && !sembunyikanSoap"
          class="py-0 px-[10px]"
          value="soap"
          :pt="{ root: 'rounded-t-lg' }"
        >
          <div class="flex">
            <PhStethoscope
              v-if="selectedTab == 'soap'"
              :size="18"
              weight="fill"
              class="mr-[10px]"
            />
            S.O.A.P
          </div>
        </Tab>
        <Tab
          v-else-if="rmType == 'fisioterapi' && viewMode != 'history'"
          class="py-0 px-[10px]"
          value="soapier"
          :pt="{ root: 'rounded-t-lg' }"
        >
          <div class="flex">
            <PhStethoscope
              v-if="selectedTab == 'soapier'"
              :size="18"
              weight="fill"
              class="mr-[10px]"
            />
            S.O.A.P.I.E.R
          </div>
        </Tab>
        <Tab
          v-if="viewMode != 'history' && fiturAktif('rme_penunjang')"
          class="py-0 px-[10px]"
          value="penunjang"
          :pt="{ root: 'rounded-t-lg' }"
        >
          <div class="flex">
            <PhFirstAidKit
              v-if="selectedTab == 'penunjang'"
              :size="18"
              weight="fill"
              class="mr-[10px]"
            />
            Penunjang
          </div>
        </Tab>
        <Tab
          v-if="viewMode != 'history' && fiturAktif('rme_alkes')"
          class="py-0 px-[10px]"
          value="alkes"
          :pt="{ root: 'rounded-t-lg' }"
        >
          <div class="flex">
            <PhFirstAidKit
              v-if="selectedTab == 'alkes'"
              :size="18"
              weight="fill"
              class="mr-[10px]"
            />
            Alkes
          </div>
        </Tab>
        <Tab
          v-if="viewMode != 'history' && fiturAktif('rme_inform_consent')"
          class="py-0 px-[10px]"
          value="inform-consent"
          :pt="{ root: 'rounded-t-lg' }"
        >
          <div class="flex">
            <PhFileText
              v-if="selectedTab == 'inform-consent'"
              :size="18"
              weight="fill"
              class="mr-[10px]"
            />
            Inform Consent
          </div>
        </Tab>
        <Tab
          class="px-0 py-0"
          value="-"
          :pt="{ root: 'rounded-t-lg' }"
          disabled
        >
          <PhLineVertical :size="26" weight="bold" class="text-opensimrs-300" />
        </Tab>
        <Tab
          v-if="(rmType == 'rawat-inap' || rmType == 'igd') && viewMode != 'history' && fiturAktif('rme_fpo')"
          class="py-0 px-[10px]"
          value="fpo"
          :pt="{ root: 'rounded-t-lg' }"
        >
          <div class="flex">
            <PhPill
              v-if="selectedTab == 'fpo'"
              :size="18"
              weight="fill"
              class="mr-[10px]"
            />
            FPO
          </div>
        </Tab>
        <Tab
          v-if="rmType == 'rawat-inap' && viewMode != 'history' && fiturAktif('ri_perpindahan')"
          class="py-0 px-[10px]"
          value="perpindahan"
          :pt="{ root: 'rounded-t-lg' }"
        >
          <div class="flex">
            <PhArrowsClockwise
              v-if="selectedTab == 'perpindahan'"
              :size="18"
              weight="bold"
              class="mr-[10px]"
            />
            Perpindahan
          </div>
        </Tab>
        <Tab
          v-if="viewMode != 'history' && fiturAktif('rme_unggah_berkas')"
          class="py-0 px-[10px]"
          value="unggah-berkas"
          :pt="{ root: 'rounded-t-lg' }"
        >
          <div class="flex">
            <UploadPictureIcon
              v-if="selectedTab == 'unggah-berkas'"
              :size="18"
              class="mr-[10px]"
            />
            Unggah Berkas
          </div>
        </Tab>
        <Tab
          v-if="viewMode != 'history'"
          class="py-0 px-[10px]"
          value="resume-discharge"
          :pt="{ root: 'rounded-t-lg' }"
        >
          <div class="flex">
            <PhListStar
              v-if="selectedTab == 'resume-discharge'"
              :size="18"
              weight="fill"
              class="mr-[10px]"
            />
            Resume & Discharge
          </div>
        </Tab>
        <Tab
          v-if="fiturAktif('rme_cetak_surat')"
          class="py-0 px-[10px]"
          value="cetak-hasil-surat"
          :pt="{ root: 'rounded-t-lg' }"
        >
          <div class="flex">
            <PhEnvelopeSimple
              v-if="selectedTab == 'cetak-hasil-surat'"
              :size="18"
              weight="fill"
              class="mr-[10px]"
            />
            Cetak Hasil & Surat
          </div>
        </Tab>
      </TabList>
    </Tabs>
    <div
      v-if="
        (selectedTab == 'rekam-medis' ||
          selectedTab == 'asesmen' ||
          selectedTab == 'soap') &&
        (rmType == 'rawat-inap' || rmType == 'igd')
      "
      class="flex"
    >
      <SessionTab
        :key="selectedTab"
        v-model="selectedSessionTab"
        :selectedTab="selectedTab"
        :dataSession="sessions"
        class="mt-[10px] grow"
        @addSession="createNewSession"
      />
      <div class="flex border-b border-grey-100">
        <CustomButton
          v-if="sessions.length > 1"
          @click="deleteSessionDialog = true"
          class="my-auto bg-danger-300 !rounded-md"
          label="Hapus Sesi"
          size="small"
          icon="PhTrash"
          iconType="fill"
        />
      </div>
    </div>

    <!-- Dialog konfirmasi hapus sesi -->
    <CustomDialog
      class=""
      v-model:visible="deleteSessionDialog"
      headerBg="bg-danger-300"
      width="600px"
      @closeDialog="deleteSessionReason = ''"
    >
      <template #header>Hapus Sesi</template>
      <template #body>
        <div class="pt-5">
          <CustomTextfield
            v-model="deleteSessionReason"
            label="Alasan Menghapus Sesi"
            class="w-full mr-[30px]"
            placeholder="Alasan Menghapus Sesi"
          />
          <div class="mt-5 text-normal">
            <div>Seluruh data pemeriksaan pasien pada sesi akan terhapus.</div>
            <div class="mt-1">
              Anda yakin akan menghapus
              <span class="font-bold">Sesi {{ selectedSessionTab }}</span> ?
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton
            @click="(deleteSessionDialog = false), (deleteSessionReason = '')"
            label="Tidak"
            outlined
            class="mr-[10px]"
            borderColor="border-grey-200"
            textColor="text-grey-300"
          />
          <CustomButton
            @click="deleteSession"
            :disabled="!deleteSessionReason"
            class="my-auto bg-danger-300"
            label="Iya, Hapus"
            iconType="fill"
          />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
