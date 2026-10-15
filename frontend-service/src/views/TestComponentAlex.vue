<script setup lang="ts">

import AnamnesisIGD from "@/components/RekamMedis/AnamnesisIGD/AnamnesisIGD.vue";
import Triase from "@/components/RekamMedis/Triase/Triase.vue";
import riwayatPerpindahanBed from "@/components/RekamMedis/Perpindahan/riwayatPerpindahanBed.vue";
import FormPerpindahan from "@/components/RekamMedis/Perpindahan/FormPerpindahan.vue";

import FormEvaluation from "@/components/Fisioterapi/Evaluation/FormEvaluation.vue";
import FormImplementation from "@/components/Fisioterapi/Implementation/FormImplementation.vue";
import FormReassesment from "@/components/Fisioterapi/Reassesment/FormReassesment.vue";
</script>

<template>
  <div class="flex flex-col h-screen gap-4 m-4 overflow-scroll">
    <h1 class="font-bold">component Alex</h1>
    <AnamnesisIGD />
    <Triase />
    <riwayatPerpindahanBed />
    <FormPerpindahan />

    <h1 class="font-bold">component Alex - Fisioterapi</h1>
    <FormImplementation />
    <FormEvaluation />
    <FormReassesment />
  </div>
</template>
