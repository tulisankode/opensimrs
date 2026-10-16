<script setup lang="ts">
import MainHeaderSetting from '../MainHeaderSetting.vue';
import KonfigurasiLainnya from './KonfigurasiLainnya.vue';
import GreenCard from '../GreenCard.vue';
import { onMounted, ref } from 'vue';
import FormEditKonfigurasiLainnya from './FormEditKonfigurasiLainnya.vue';
import CustomButton from '@/components/Base/CustomButton.vue';
import KonfigurasiSatuSehat from './KonfigurasiSatuSehat.vue';
import FormEditKonfigurasiSatuSehat from './FormEditKonfigurasiSatuSehat.vue';
import SinkronisasiSatuSehat from './SinkronisasiSatuSehat.vue';
import KonfigurasiPcare from './KonfigurasiPcare.vue';
import PemetaanPcare from './PemetaanPcare.vue';
import SinkronisasiPcare from './SinkronisasiPcare.vue';
import KonfigurasiBpjsVclaim from './KonfigurasiBpjsVclaim.vue';
import PemetaanVclaim from './PemetaanVclaim.vue';
import KonfigurasiLis from './KonfigurasiLis.vue';
import PengirimanLis from './PengirimanLis.vue';
import KonfigurasiPacs from './KonfigurasiPacs.vue';
import PengirimanPacs from './PengirimanPacs.vue';
import KonfigurasiHelpdesk from './KonfigurasiHelpdesk.vue';
import { useSettingStore } from '@/stores/setting';
import { utilsStore } from "@/stores/utils";
import { fiturAktif } from "@/stores/modulFaskes";

const useUtilsStore = utilsStore();

const konfigurasiIntegrasiResponse = ref({
    baseUrl: "",
    userKey: "",
    consId: "",
    secretKey: "",
    PPK: "",
    apiKeyPost: "",
    method: "",
    endpoint: "",
    header: "",
    request: "",
    response: "",
    status: "",
    clientSecret: "",
    organizationId: "",
    clientId: "",
    statusSatuSehat: ""
})

const settingStore = useSettingStore();
const fetchKonfigurasiIntegrasiData = async () => {
    useUtilsStore.setLoading(true);
    try {
        const response = await settingStore.getKonfigurasiIntegrasiApi();
        if (response && response.payload) {
            konfigurasiIntegrasiResponse.value = response.payload
            useUtilsStore.setLoading(false)
            // console.log(konfigurasiIntegrasiResponse.value)
        } else {
            console.error("Unexpected response Structure", response);
        }
    } catch (error) {
        console.error("Failed to fetch data", error);
    }

}

onMounted(() => {
    fetchKonfigurasiIntegrasiData();
    console.log(konfigurasiIntegrasiResponse.value)
})

const isEditKonfigurasiLainnya = ref(false);
const isEditKonfigurasiSatuSehat = ref(false);
const pemetaanPcareRef = ref<InstanceType<typeof PemetaanPcare> | null>(null);
const pemetaanVclaimRef = ref<InstanceType<typeof PemetaanVclaim> | null>(null);


const editKonfigurasiLainnya = () => {
    console.log("NININI")
    isEditKonfigurasiLainnya.value = !isEditKonfigurasiLainnya.value;
};

const editKonfigurasiSatuSehat = () => {
    console.log("NININI")
    isEditKonfigurasiSatuSehat.value = !isEditKonfigurasiSatuSehat.value
}


// Setelah Edit 
const handleKonfigurasiLainnya = (updatedKonfigurasiLainnya: any) => {
    konfigurasiIntegrasiResponse.value = updatedKonfigurasiLainnya;
    fetchKonfigurasiIntegrasiData();
};
const handleKonfigurasiSatuSehat = (updatedKonfigurasiSatuSehat: any) => {
    konfigurasiIntegrasiResponse.value = updatedKonfigurasiSatuSehat;
    fetchKonfigurasiIntegrasiData()
}
</script>

<template>

    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto">
        <template #header>
            <MainHeaderSetting heading="Konfigurasi Integrasi" />
        </template>
        <template #content>
            <!-- BPJS VClaim (rumah sakit): konfigurasi terenkripsi & pemetaan poli; SEP dibuat di Admisi › SEP -->
            <KonfigurasiBpjsVclaim @tersimpan="pemetaanVclaimRef?.muat()" />
            <PemetaanVclaim ref="pemetaanVclaimRef" />

            <template v-if="!isEditKonfigurasiSatuSehat">
                    <KonfigurasiSatuSehat :edit-handler="editKonfigurasiSatuSehat" :konfigurasi-integrasi-response="konfigurasiIntegrasiResponse" />
            </template>
            <template v-else>
                    <FormEditKonfigurasiSatuSehat :is-edit-konfigurasi-satu-sehat="isEditKonfigurasiSatuSehat" :konfigurasi-integrasi-response="konfigurasiIntegrasiResponse" @update:is-edit-konfigurasi-satu-sehat="isEditKonfigurasiSatuSehat = $event" @update:after-edit-konfigurasi-satu-sehat="handleKonfigurasiSatuSehat" />
            </template>
            <!-- dipasang ulang setelah konfigurasi disimpan agar status terbaru tampil -->
            <SinkronisasiSatuSehat v-if="!isEditKonfigurasiSatuSehat" :key="konfigurasiIntegrasiResponse.clientId + konfigurasiIntegrasiResponse.statusSatuSehat" />
            <!-- BPJS PCare (FKTP): konfigurasi, pemetaan kode, sinkronisasi kunjungan -->
            <KonfigurasiPcare @tersimpan="pemetaanPcareRef?.muat()" />
            <PemetaanPcare ref="pemetaanPcareRef" />
            <SinkronisasiPcare />
            <!-- LIS laboratorium (adamLIS): koneksi/endpoint & kredensial + riwayat pengiriman. Mapping kode ada di Laboratorium › Mapping LIS -->
            <KonfigurasiLis />
            <PengirimanLis />
            <!-- PACS/RIS radiologi: koneksi/endpoint & kredensial + riwayat pengiriman. Mapping kode ada di Radiologi › Mapping PACS -->
            <template v-if="fiturAktif('rad_bridging_pacs')">
                <KonfigurasiPacs />
                <PengirimanPacs />
            </template>
            <!-- Helpdesk AI: Gateway OpenClaw untuk tombol Bantuan (khusus superadmin; token terenkripsi) -->
            <KonfigurasiHelpdesk />

            <!--  -->
            <template v-if="!isEditKonfigurasiLainnya">
                    <KonfigurasiLainnya :edit-handler="editKonfigurasiLainnya" :konfigurasi-integrasi-response="konfigurasiIntegrasiResponse"/>
            </template>
            <template v-else>
                    <FormEditKonfigurasiLainnya :is-edit-konfigurasi-lainnya="isEditKonfigurasiLainnya" :konfigurasi-integrasi-response="konfigurasiIntegrasiResponse" @update:is-edit-konfigurasi-lainnya="isEditKonfigurasiLainnya = $event" @update:after-edit-konfigurasi-lainnya="handleKonfigurasiLainnya"/>
            </template>
        </template>
    </Card>




</template>
