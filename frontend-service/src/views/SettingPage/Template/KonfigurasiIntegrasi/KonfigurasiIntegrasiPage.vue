<script setup lang="ts">
import MainHeaderSetting from '../MainHeaderSetting.vue';
import KonfigurasiLainnya from './KonfigurasiLainnya.vue';
import GreenCard from '../GreenCard.vue';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
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
import KonfigurasiLisPa from './KonfigurasiLisPa.vue';
import PengirimanLisPa from './PengirimanLisPa.vue';
import KonfigurasiLisMikrobiologi from './KonfigurasiLisMikrobiologi.vue';
import PengirimanLisMikrobiologi from './PengirimanLisMikrobiologi.vue';
import KonfigurasiHelpdesk from './KonfigurasiHelpdesk.vue';
import KonfigurasiBdrsUtd from './KonfigurasiBdrsUtd.vue';
import PengirimanBdrs from './PengirimanBdrs.vue';
import KonfigurasiAntreanBpjs from './KonfigurasiAntreanBpjs.vue';
import { useSettingStore } from '@/stores/setting';
import { utilsStore } from "@/stores/utils";
import { fiturAktif } from "@/stores/modulFaskes";

const useUtilsStore = utilsStore();

// Satu bagian per halaman (submenu Setting › Konfigurasi Integrasi); tanpa parameter → bagian pertama.
const BAGIAN: Record<string, string> = {
    'bpjs-pcare': 'BPJS › BPJS PCare',
    'bpjs-vclaim': 'BPJS › BPJS VClaim',
    satusehat: 'SATUSEHAT',
    'lis-pk': 'LIS › Lab PK',
    'lis-pa': 'LIS › Lab PA',
    'lis-mikrobiologi': 'LIS › Mikrobiologi',
    pacs: 'Radiologi › PACS/RIS',
    'bdrs-utd': 'Bank Darah › UTD',
    'antrean-bpjs': 'BPJS › Antrean Online (Mobile JKN)',
    helpdesk: 'Helpdesk AI',
    lainnya: 'Lainnya',
};
const route = useRoute();
const bagian = computed(() => {
    const b = String(route.params.bagian ?? '');
    return b in BAGIAN ? b : 'bpjs-pcare';
});
const judul = computed(() => `Konfigurasi Integrasi › ${BAGIAN[bagian.value]}`);

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
            <MainHeaderSetting :heading="judul" />
        </template>
        <template #content>
            <!-- BPJS VClaim (rumah sakit): konfigurasi terenkripsi & pemetaan poli; SEP dibuat di Admisi › SEP -->
            <template v-if="bagian === 'bpjs-vclaim'">
                <KonfigurasiBpjsVclaim @tersimpan="pemetaanVclaimRef?.muat()" />
                <PemetaanVclaim ref="pemetaanVclaimRef" />
            </template>
            <!-- BPJS PCare (FKTP): konfigurasi, pemetaan kode, sinkronisasi kunjungan -->
            <template v-else-if="bagian === 'bpjs-pcare'">
                <KonfigurasiPcare @tersimpan="pemetaanPcareRef?.muat()" />
                <PemetaanPcare ref="pemetaanPcareRef" />
                <SinkronisasiPcare />
            </template>
            <template v-else-if="bagian === 'satusehat'">
                <template v-if="!isEditKonfigurasiSatuSehat">
                    <KonfigurasiSatuSehat :edit-handler="editKonfigurasiSatuSehat" :konfigurasi-integrasi-response="konfigurasiIntegrasiResponse" />
                </template>
                <template v-else>
                    <FormEditKonfigurasiSatuSehat :is-edit-konfigurasi-satu-sehat="isEditKonfigurasiSatuSehat" :konfigurasi-integrasi-response="konfigurasiIntegrasiResponse" @update:is-edit-konfigurasi-satu-sehat="isEditKonfigurasiSatuSehat = $event" @update:after-edit-konfigurasi-satu-sehat="handleKonfigurasiSatuSehat" />
                </template>
                <!-- dipasang ulang setelah konfigurasi disimpan agar status terbaru tampil -->
                <SinkronisasiSatuSehat v-if="!isEditKonfigurasiSatuSehat" :key="konfigurasiIntegrasiResponse.clientId + konfigurasiIntegrasiResponse.statusSatuSehat" />
            </template>
            <!-- LIS laboratorium (adamLIS): koneksi/endpoint & kredensial + riwayat pengiriman. Mapping kode ada di Laboratorium › Mapping LIS -->
            <template v-else-if="bagian === 'lis-pk'">
                <KonfigurasiLis />
                <PengirimanLis />
            </template>
            <!-- LIS Patologi Anatomi: koneksi/endpoint & kredensial + riwayat pengiriman. Mapping kode ada di Patologi Anatomi › Mapping LIS -->
            <template v-else-if="bagian === 'lis-pa'">
                <template v-if="fiturAktif('pa_bridging_lis')">
                    <KonfigurasiLisPa />
                    <PengirimanLisPa />
                </template>
                <p v-else class="text-sm text-gray-500">Fitur Bridging LIS Patologi Anatomi belum aktif. Aktifkan di Setting › Manajemen Modul.</p>
            </template>
            <!-- LIS Mikrobiologi (fitur mikro_bridging_lis): koneksi & kredensial terpisah dari LIS laboratorium. Mapping kode ada di Mikrobiologi › Mapping LIS -->
            <template v-else-if="bagian === 'lis-mikrobiologi'">
                <KonfigurasiLisMikrobiologi />
                <PengirimanLisMikrobiologi />
            </template>
            <!-- PACS/RIS radiologi: koneksi/endpoint & kredensial + riwayat pengiriman. Mapping kode ada di Radiologi › Mapping PACS -->
            <template v-else-if="bagian === 'pacs'">
                <template v-if="fiturAktif('rad_bridging_pacs')">
                    <KonfigurasiPacs />
                    <PengirimanPacs />
                </template>
                <p v-else class="text-sm text-gray-500">Fitur Bridging PACS/RIS belum aktif. Aktifkan di Setting › Manajemen Modul.</p>
            </template>
            <!-- Bridging Bank Darah ke UTD (fitur bdrs_bridging): koneksi & kredensial + riwayat pengiriman. Mapping kode ada di Bank Darah › Mapping UTD -->
            <template v-else-if="bagian === 'bdrs-utd'">
                <template v-if="fiturAktif('bdrs_bridging')">
                    <KonfigurasiBdrsUtd />
                    <PengirimanBdrs />
                </template>
                <p v-else class="text-sm text-gray-500">Fitur Bridging Bank Darah (UTD) belum aktif. Aktifkan di Setting › Manajemen Modul.</p>
            </template>
            <!-- Antrean Online BPJS (fitur antrian_online_bpjs): sinkron antrean & task id, ambil antrean Mobile JKN -->
            <template v-else-if="bagian === 'antrean-bpjs'">
                <KonfigurasiAntreanBpjs />
            </template>
            <!-- Helpdesk AI: Gateway OpenClaw untuk tombol Bantuan (khusus superadmin; token terenkripsi) -->
            <template v-else-if="bagian === 'helpdesk'">
                <KonfigurasiHelpdesk />
            </template>
            <template v-else-if="bagian === 'lainnya'">
                <template v-if="!isEditKonfigurasiLainnya">
                    <KonfigurasiLainnya :edit-handler="editKonfigurasiLainnya" :konfigurasi-integrasi-response="konfigurasiIntegrasiResponse"/>
                </template>
                <template v-else>
                    <FormEditKonfigurasiLainnya :is-edit-konfigurasi-lainnya="isEditKonfigurasiLainnya" :konfigurasi-integrasi-response="konfigurasiIntegrasiResponse" @update:is-edit-konfigurasi-lainnya="isEditKonfigurasiLainnya = $event" @update:after-edit-konfigurasi-lainnya="handleKonfigurasiLainnya"/>
                </template>
            </template>
        </template>
    </Card>




</template>
