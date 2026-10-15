<script setup lang="ts">
import { ref } from 'vue';
import GreenCard from "../GreenCard.vue";

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

const profileImage = ref(ProfilePhoto);
import ProfilePhoto from '../../../../assets/icons/profil.svg';
</script>

<template>
    <GreenCard cardHeading="Foto Profile dan Nama Lengkap" hrEnableCustomClass showButton labelButton="Edit"
        :button-click-handler="props.editHandler">
        <div class="flex gap-10">
            <!-- Image -->
            <div class="w-[200px] h-[200px] flex justify-center items-center relative">
                <img :src="props.profilAkunResponse.photo ? props.profilAkunResponse.photo : profileImage" alt="HALO" />
            </div>
            <div class="flex flex-col justify-evenly">
                <div>
                    <div class="col-span-2 text-sm underline">Nama Lengkap</div>
                    <div class="font-bold text-heading">{{ props.profilAkunResponse.awalanGelar }} {{ props.profilAkunResponse.name }}  {{ props.profilAkunResponse.akhiranGelar }}</div>
                </div>

                <div class="grid grid-cols-3">
                    <div class="w-80">
                        <div class="text-sm underline">Role</div>
                        <div class="font-bold text-heading">
                            {{ props.profilAkunResponse.role.name }}
                        </div>
                    </div>
                    <div class="grow">
                        <div class="text-sm underline">Email</div>
                        <div class="font-bold text-heading">
                            {{ props.profilAkunResponse.email }}
                        </div>
                    </div>
                    <div class="w-[180px]">
                        <div class="text-sm underline">No. Handphone</div>
                        <div class="font-bold text-heading">
                            {{ props.profilAkunResponse.phone }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </GreenCard>
</template>
