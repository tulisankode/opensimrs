<script setup lang="ts">
import GreenCard from '../GreenCard.vue';


const props = defineProps({
    profilAkunResponse: {
        type: Object,
        required: true,
    },
    editHandler: {
        type: Function,
        required: true,
    },
});
</script>

<template>
    <GreenCard cardHeading="Username & Password" hrEnableCustomClass showButton labelButton="Edit"
        :buttonClickHandler="props.editHandler">
        <div class="grid grid-cols-2 gap-3">
            <div class="mb-4">
                <div class="text-sm underline">Username</div>
                <div class="font-bold text-heading">{{ props.profilAkunResponse.username }}</div>
            </div>
            <div class="mb-4">
                <div class="text-sm underline">Password</div>
                <div class="font-bold text-heading"> {{ props.profilAkunResponse.password ? '********' : '' }}</div>
            </div>
        </div>
    </GreenCard>
</template>
