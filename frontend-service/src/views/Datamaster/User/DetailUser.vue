<script setup lang="ts">
import { ref, onMounted } from "vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomChip from "@/components/Base/CustomChip.vue";

const props = defineProps({
  payload: {
    type: Object,
    default: () => ({}),
  },
});
const dataBreadHome = ref({ label: "User", home: true });
const dataBreadCrumb = ref([{ label: "Detail User" }]);
const emit = defineEmits(["back"]);

</script>

<template>
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
  >
    <template #header>
      <div class="flex items-center justify-between gap-5 p-5">
        <CustomBreadCrumb
          :home="dataBreadHome"
          :model="dataBreadCrumb"
          class="grow"
        />
        <CustomButton
          label="Kembali"
          icon="PhCaretLeft"
          @click="emit('back')"
          background-color="bg-white"
          border-color="border-opensimrs-300"
          text-color="text-opensimrs-300"
        />
      </div>
    </template>
    <template #content>
      <div>
        <CustomAccordion no-border initial-state="0">
          <template #header> Data User </template>
          <template #content>
            <div class="grid grid-cols-2 gap-5 mt-5">
              <div class="flex flex-col">
                <div class="font-semibold underline text-SM">Nama</div>
                <div class="font-normal text-normal">
                  {{ props.payload.name }}
                </div>
              </div>
              <div class="flex flex-col">
                <div class="font-semibold underline text-SM">NIK</div>
                <div class="font-normal text-normal">{{ props.payload.practitioner.nik }}</div>
              </div>
              <div class="flex flex-col">
                <div class="font-semibold underline text-SM">Tanggal Lahir</div>
                <div class="font-normal text-normal">{{ props.payload.practitioner.tanggalLahir }}</div>
              </div>
              <div class="flex flex-col">
                <div class="font-semibold underline text-SM">Jenis Kelamin</div>
                <div class="font-normal text-normal">{{ props.payload.practitioner.gender }}</div>
              </div>
              <div class="flex flex-col">
                <div class="font-semibold underline text-SM">No. Handphone</div>
                <div class="font-normal text-normal">
                  {{ props.payload.phone }}
                </div>
              </div>
              <div class="flex flex-col">
                <div class="font-semibold underline text-SM">Email</div>
                <div class="font-normal text-normal">
                  {{ props.payload.email }}
                </div>
              </div>
            </div>
          </template>
          <template #collapseIcon>
            <CustomButton
              icon="PhCaretUp"
              backgroundColor="bg-transparent"
              textColor="text-opensimrs-300"
            />
          </template>
          <template #expandIcon>
            <CustomButton
              icon="PhCaretDown"
              backgroundColor="bg-transparent"
              textColor="text-opensimrs-300"
            />
          </template>
        </CustomAccordion>
        <CustomAccordion no-border initial-state="0">
          <template #header> Akun </template>
          <template #content>
            <div class="grid grid-cols-2 gap-5 mt-5">
              <div class="flex flex-col">
                <div class="font-semibold underline text-SM">Username</div>
                <div class="font-normal text-normal">
                  {{ props.payload.username }}
                </div>
              </div>
              <div class="flex flex-col">
                <div class="font-semibold underline text-SM">Password</div>
                <div class="font-normal text-normal">********</div>
              </div>
            </div>
          </template>
          <template #collapseIcon>
            <CustomButton
              icon="PhCaretUp"
              backgroundColor="bg-transparent"
              textColor="text-opensimrs-300"
            />
          </template>
          <template #expandIcon>
            <CustomButton
              icon="PhCaretDown"
              backgroundColor="bg-transparent"
              textColor="text-opensimrs-300"
            />
          </template>
        </CustomAccordion>
        <CustomAccordion no-border initial-state="0">
          <template #header> Modul & Permission </template>
          <template #content>
            <div class="flex flex-col gap-5 mt-5">
              <div class="flex flex-col">
                <div class="font-normal underline text-normal">Role</div>
                <div class="font-semibold text-MD">{{ props.payload.role.name }}</div>
              </div>
              <div
                v-for="(menuItem, menuIndex) in props.payload.permissions"
                :key="menuIndex"
              >
                <CustomAccordion
                  header-class="bg-opensimrs-50"
                  :open-with-header="false"
                >
                  <template #header> {{ menuItem.module }} </template>
                  <template #content>
                    <div
                      v-for="(
                        subMenuItem, subMenuIndex
                      ) in menuItem.subModules"
                      :key="subMenuItem.name"
                    >
                      <CustomAccordion
                        class="pt-5"
                        header-class="bg-opensimrs-50"
                        :open-with-header="false"
                      >
                        <template #header> {{ subMenuItem.name }} </template>
                        <template #content>
                          <div
                            v-if="
                              subMenuItem.features &&
                              subMenuItem.features.length
                            "
                          >
                            <div
                              v-for="(
                                feature, featureIndex
                              ) in subMenuItem.features"
                              :key="feature.name"
                            >
                              <CustomAccordion
                                class="pt-5"
                                header-class="bg-opensimrs-50"
                                :open-with-header="false"
                              >
                                <template #header>
                                  {{ feature.name }}
                                </template>
                                <template #content>
                                  <div
                                    v-for="(
                                      action, actionIndex
                                    ) in feature.allows"
                                    :key="actionIndex"
                                  >
                                    <div
                                      class="bg-opensimrs-50 border-2 border-grey-100 rounded-lg py-2.5 px-5 font-normal text-normal"
                                    >
                                      {{ action }}
                                    </div>
                                  </div>
                                </template>
                              </CustomAccordion>
                            </div>
                          </div>
                          <div v-else>
                            <!-- Render allows directly for submodules without features -->
                            <div class="flex flex-wrap gap-2.5 pt-5">
                              <div
                                v-for="(
                                  action, actionIndex
                                ) in subMenuItem.allows"
                                :key="actionIndex"
                              >
                                <div
                                  class="bg-opensimrs-50 border-2 border-grey-100 rounded-lg py-2.5 px-5 font-normal text-normal"
                                >
                                  {{ action }}
                                </div>
                              </div>
                            </div>
                          </div>
                        </template>
                      </CustomAccordion>
                    </div>
                  </template>
                </CustomAccordion>
              </div>
            </div>
          </template>
          <template #collapseIcon>
            <CustomButton
              icon="PhCaretUp"
              backgroundColor="bg-transparent"
              textColor="text-opensimrs-300"
            />
          </template>
          <template #expandIcon>
            <CustomButton
              icon="PhCaretDown"
              backgroundColor="bg-transparent"
              textColor="text-opensimrs-300"
            />
          </template>
        </CustomAccordion>
      </div>
    </template>
  </Card>
</template>
