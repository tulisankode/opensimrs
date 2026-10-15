<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { ref } from "vue";

const getUserRole = () => {
  const userDataString = localStorage.getItem("user");
  if (userDataString) {
    try {
      const userData = JSON.parse(userDataString);
      return userData.role;
    } catch (error) {
      console.error("Error parsing user data from localStorage:", error);
      return null;
    }
  }
  return null;
};

const isSuperAdmin = getUserRole() === "super admin";


const sidebarBodyList = ref<SidebarBody[]>([
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      {
        name: "User",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/user",
      },
      {
        name: "Role",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/role",
      },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      {
        name: "Pegawai",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/pegawai",
      },
      {
        name: "Praktisi",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/praktisi",
      },
    ],
  },

  {
    name: "3",
    type: linkType.SECTION,
    child: [
      {
        name: "Ruangan",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/ruangan",
      },
      {
        name: "Kategori Ruangan",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/kategori-ruangan",
      },
    ],
  },
  {
    name: "4",
    type: linkType.SECTION,
    child: [
      {
        name: "Diagnosis (ICD 10)",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/diagnosis-icd10",
      },
      {
        name: "ICD 9 CM",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/icd9-cm",
      },
      {
        name: "Snomed CT",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/snomed-ct",
      },
      {
        name: "LOINC",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/loinc",
      },
    ],
  },
  {
    name: "5",
    type: linkType.SECTION,
    child: [
      {
        name: "Tarif",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/tarif",
      },
      {
        name: "Komponen Tarif",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/komponen-tarif",
      },
      {
        name: "Tindakan",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/tindakan",
      },
    ],
  },

  {
    name: "6",
    type: linkType.SECTION,
    child: [
      {
        name: "Faskes",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/faskes",
      },
      {
        name: "Organisasi",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/organisasi",
      },
      {
        name: "Lokasi",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/lokasi",
      },
      {
        name: "Penjamin",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/penjamin",
      },
      {
        name: "Voucher",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/voucher",
      },
      {
        name: "General Consent",
        icon: "DatabaseFill",
        type: linkType.LINK,
        url: "/datamaster/general-consent",
      },
    ],
  },

]);
if (isSuperAdmin) {
  sidebarBodyList.value.push({
    name: "7",
    type: linkType.SECTION,
    child: [
      {
        name: "Super Admin",
        icon: "DatabaseFill",
        type: linkType.DROPDOWN,
        child: [
          {
            name: "Gigi FDI",
            type: linkType.LINK,
            url: "/datamaster/super-admin/gigi-fdi",
          },
          {
            name: "Kategori Gigi",
            type: linkType.LINK,
            url: "/datamaster/super-admin/kategori-gigi",
          },
          {
            name: "Item Gigi",
            type: linkType.LINK,
            url: "/datamaster/super-admin/item-gigi",
          },
          {
            name: "Oklusi",
            type: linkType.LINK,
            url: "/datamaster/super-admin/oklusi",
          },
        ],
      },
    ],
  });
}

const filter = ref("");
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar
      sidebarTitle="Datamaster"
      sidebarTitleUrl="/datamaster"
      class="flex-none"
      :sidebar-body-list="sidebarBodyList"
    />
    <component
      class="max-h-full overflow-auto grow"
      :is="$route.meta.page || 'div'"
      :filter="filter"
    ></component>
  </div>
</template>
