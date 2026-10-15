<script setup lang="ts">
import FormAlergi from '@/components/RekamMedis/Alergi/FormAlergi.vue';
import FormAsesmenNyeri from '@/components/RekamMedis/AsesmenNyeri/FormAsesmenNyeri.vue';
import FormTandaVital from '@/components/RekamMedis/TandaVital/FormTandaVital.vue';
import FormCatatanPerawat from '@/components/RekamMedis/CatatanPerawat/FormCatatanPerawat.vue';
import FormDiagnosaDokterICD10 from '@/components/RekamMedis/DiagnosaDokter/FormDiagnosaDokterICD10.vue';
import AccordionOrderObat from '@/components/RekamMedis/OrderObat/AccordionOrderObat.vue';
import FormOrderFisio from '@/components/RekamMedis/OrderFisio/FormOrderFisio.vue';
import FormOrderAlkes from '@/components/RekamMedis/OrderAlkes/AccordionOrderAlkes.vue';
import FormPersetujuanPasien from '@/components/RekamMedis/PersetujuanPasien/FormPersetujuanPasien.vue';
import FormUnggahBerkas from '@/components/RekamMedis/UnggahBerkas/FormUnggahBerkas.vue';
import PermissionMenuPage from './SettingPage/Template/PermissionMenu/PermissionMenuPage.vue';


</script>

<template>
    <div class="flex flex-col h-screen gap-4 m-4 overflow-scroll">
        <FormAlergi/>
         <FormTandaVital/>
         <FormAsesmenNyeri/>
         <FormCatatanPerawat/>
         <FormDiagnosaDokterICD10/>
         <AccordionOrderObat/>
         <FormOrderFisio/>
         <FormOrderAlkes/>
         <FormPersetujuanPasien/>
         <FormUnggahBerkas/>
         <!-- <CustomUpload/> -->

         <PermissionMenuPage/>
    </div>
</template>