<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { ref } from "vue";

const sidebarBodyList = ref<SidebarBody[]>([
  { name: "1", type: linkType.SECTION, child: [
    { name: "Kepegawaian", icon: "PhUsersThree", type: linkType.LINK, url: "/sdm/kepegawaian" },
    { name: "Kredensial", icon: "PhIdentificationCard", type: linkType.LINK, url: "/sdm/kredensial" },
  ] },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="HR / SDM" sidebarTitleUrl="/sdm" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
