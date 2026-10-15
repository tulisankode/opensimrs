<script lang="ts" setup>
import { ref, watch, computed, onMounted, onBeforeMount } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { useRoleStore } from "@/stores/datamaster/role";
import { useUserStore } from "@/stores/user";
import { usePermissionStore } from "@/stores/datamaster/permission";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomCheckbox from "@/components/Base/CustomCheckbox.vue";
import NoData from "@/components/section/NoData.vue";
import type { Module, SubModule, Feature, Allow } from "@/utils/Interface";

const props = defineProps({
  method: {
    type: String,
  },
  payload: {
    type: Object,
    default: () => ({}),
  },
});

const permissionsStore = usePermissionStore();
const userStore = useUserStore();
const praktisiStore = usePraktisiStore();
const roleStore = useRoleStore();
const praktisiPayload = ref<any[]>([]);
const selectedPraktisi = ref<any>();
const selectedRole = ref<any>();
const rolePayload = ref<any[]>([]);

const emit = defineEmits(["back", "data-updated"]);

const phoneRegExp =
  /^((\\+[1-9]{1,4}[ \\-])|(\\([0-9]{2,3}\\)[ \\-])|([0-9]{2,4})[ \\-])?[0-9]{3,4}?[ \\-]*[0-9]{3,4}?$/;
const schema = computed(() =>
  toTypedSchema(
    yup
      .object({
        practitionerUuid: yup.string().required("Praktisi harus dipilih"),
        phone: yup
          .string()
          .required("No. Handphone harus diisi")
          .matches(/^(\+62|62|0)8[1-9][0-9]{6,9}$/, "Format tidak sesuai"),
        email: yup
          .string()
          .required("Email harus diisi")
          .email("Format email tidak sesuai"),
        username: yup.string().required("Username harus diisi"),
        password: yup.string().notRequired(),
        confirmPassword: yup
          .string()
          .oneOf([yup.ref("password")], "Password tidak sama")
          .notRequired(),
        status: yup.bool().default(true),
        roleUuid: yup.string().notRequired(),
      })
      .noUnknown()
  )
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const [practitionerUuid] = defineField("practitionerUuid");
const [phone] = defineField("phone");
const [email] = defineField("email");
const [username] = defineField("username");
const [password] = defineField("password");
const [confirmPassword] = defineField("confirmPassword");
const [roleUuid] = defineField("roleUuid");
const [status] = defineField("status");
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const dataBreadHome = ref({ label: "User", home: true });
const dataBreadCrumb = ref([
  { label: props.method === "edit" ? "Edit Data" : "Tambah Data" },
]);

const fetchPraktisi = async () => {
  try {
    const response = await praktisiStore.getAktifApi();
    if (response && response.payload) {
      praktisiPayload.value = response.payload;
    } else {
      praktisiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch praktisi", error);
    praktisiPayload.value = [];
  }
};

const fetchRole = async () => {
  try {
    const response = await roleStore.getAktifApi();
    if (response && response.payload) {
      rolePayload.value = response.payload;
    } else {
      rolePayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch role", error);
    rolePayload.value = [];
  }
};

onMounted(async () => {
  await fetchPraktisi();
  // await fetchRole();
  // handleChangeRole();
});

const initialPermissionsState = ref(
  permissionsStore.permissionsItem.map((item) => ({
    module: item.module,
    checked: false,
    subModules: item.subModules.map((subItem) => ({
      name: subItem.name,
      checked: false,
      features: subItem.features
        ? subItem.features.map((featureItem) => ({
            name: featureItem.name,
            checked: false,
            allows: featureItem.allows.map((allow) => ({
              name: allow,
              checked: false,
            })),
          }))
        : [],
      allows: subItem.allows
        ? subItem.allows.map((allow) => ({
            name: allow,
            checked: false,
          }))
        : [],
    })),
  }))
);

const setRolePermissions = (rolePermissions: Module[]) => {
  resetPermissionsState();
  initialPermissionsState.value.forEach((module) => {
    const matchingModule = rolePermissions.find(
      (roleMod) => roleMod.module === module.module
    );
    if (!matchingModule) return;

    // Set module checked status
    module.checked = true;

    module.subModules.forEach((subModule) => {
      const matchingSubModule = matchingModule.subModules.find(
        (roleSub) => roleSub.name === subModule.name
      );

      if (!matchingSubModule) return;
      subModule.checked = true;

      subModule.features.forEach((feature) => {
        const matchingFeature = matchingSubModule.features?.find(
          (roleFeat) => roleFeat.name === feature.name
        );

        if (!matchingFeature) return;

        // Set feature checked status
        feature.checked = true;

        feature.allows.forEach((allow) => {
          const isAllowChecked = matchingFeature.allows.some((roleAllow) =>
            typeof roleAllow === "string"
              ? roleAllow === allow.name
              : roleAllow.name === allow.name
          );

          if (isAllowChecked) {
            allow.checked = true;
          }
        });
      });

      subModule.allows.forEach((allow) => {
        const isAllowChecked = matchingSubModule.allows.some((roleAllow) =>
          typeof roleAllow === "string"
            ? roleAllow === allow.name
            : roleAllow.name === allow.name
        );

        if (isAllowChecked) {
          allow.checked = true;
        }
      });
    });
  });
};

const searchPraktisi = () => {
  // Cari pegawai berdasarkan pegawaiUuid yang telah dipilih
  selectedPraktisi.value = praktisiPayload.value.find(
    (praktisi) => praktisi.uuid === practitionerUuid.value
  );
};

const handleChangeRole = () => {
  selectedRole.value = rolePayload.value.find(
    (role) => role.uuid === roleUuid.value
  );

  if (selectedRole.value && selectedRole.value.permissions) {
    setRolePermissions(selectedRole.value.permissions);
  }
};

const resetSearch = () => {
  practitionerUuid.value = "";
  selectedPraktisi.value = null;
};

const onCheckModule = (module: Module) => {
  // Explicitly type 'module'
  console.log("module", module);

  console.log(module.checked);
  const isChecked = module.checked;
  console.log(isChecked);

  // module.checked = isChecked;

  module.subModules.forEach((subModule) => {
    subModule.checked = isChecked;

    // Check all features
    subModule.features.forEach((feature) => {
      feature.checked = isChecked;

      // Check all allows within the feature
      feature.allows.forEach((allow) => {
        allow.checked = isChecked;
      });
    });

    // Check all allows for the subModule directly
    subModule.allows.forEach((allow) => {
      allow.checked = isChecked;
    });
  });
};

const onCheckSubModule = (module: Module, subModule: SubModule) => {
  console.log("SubModule", subModule);

  const isChecked = subModule.checked;

  // Update features and their allows
  subModule.features.forEach((feature) => {
    feature.checked = isChecked;

    // Update all allows within each feature
    feature.allows.forEach((allow) => {
      allow.checked = isChecked;
    });
  });

  // Update allows directly under the subModule
  subModule.allows.forEach((allow) => {
    allow.checked = isChecked;
  });

  // Ensure module checked state aligns if any submodule is checked
  module.checked = module.subModules.some((sub) => sub.checked);
};

const onCheckFeature = (
  module: Module,
  subModule: SubModule,
  feature: Feature
) => {
  console.log("Feature", feature);

  const isChecked = feature.checked;

  // Update all allows within the feature
  feature.allows.forEach((allow) => {
    allow.checked = isChecked;
  });

  // Ensure subModule checked state aligns if any feature is checked
  subModule.checked =
    subModule.features.some((feat) => feat.checked) ||
    subModule.allows.some((allow) => allow.checked);

  // Ensure module checked state aligns if any subModule is checked
  module.checked = module.subModules.some((sub) => sub.checked);
};

const onCheckAllow = (
  module: Module,
  subModule: SubModule,
  feature: Feature | null,
  allow: Allow
) => {
  console.log("Allow", allow);

  const isChecked = allow.checked;

  if (feature) {
    feature.checked = feature.allows.some((alw) => alw.checked);
  }
  subModule.checked =
    subModule.features.some((feat) => feat.checked) ||
    subModule.allows.some((alw) => alw.checked);

  module.checked = module.subModules.some((sub) => sub.checked);
};

const resetPermissionsState = () => {
  initialPermissionsState.value.forEach((module) => {
    module.checked = false;
    module.subModules.forEach((subModule) => {
      subModule.checked = false;
      subModule.features.forEach((feature) => {
        feature.checked = false;
        feature.allows.forEach((allow) => {
          allow.checked = false;
        });
      });
      subModule.allows.forEach((allow) => {
        allow.checked = false;
      });
    });
  });
};

const onSubmit = handleSubmit(async (values: any) => {
  const permissions = initialPermissionsState.value
    .filter((module) => module.checked)
    .map((module) => ({
      module: module.module,
      subModules: module.subModules
        .filter((subModule) => subModule.checked)
        .map((subModule) => ({
          name: subModule.name,
          features: subModule.features
            ? subModule.features
                .filter((feature) => feature.checked)
                .map((feature) => ({
                  name: feature.name,
                  allows: feature.allows
                    .filter((allow) => allow.checked)
                    .map((allow) => allow.name),
                }))
            : [],
          allows: subModule.allows
            ? subModule.allows
                .filter((allow) => allow.checked)
                .map((allow) => allow.name)
            : [],
        })),
    }));
  console.log(permissions);
  try {
    const allData = {
      ...values,
      permissions,
    };
    if (props.method === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      console.log("Eddit new data with edit:", allData);
      const response = await userStore.putApi(uuid, allData);
      emit("data-updated");
    } else if (props.method === "add") {
      console.log("Adding new data with values:", allData);
      const response = await userStore.postApi(allData);
      emit("data-updated");
    }
    emit("back");
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
});

onBeforeMount(async () => {
  await fetchRole();
  if (props.method === "edit" && props.payload) {
    setValues({
      ...props.payload,
      practitionerUuid: props.payload.practitioner.uuid,
      roleUuid: props.payload.role.uuid,
    });
    selectedRole.value = rolePayload.value.find(
      (role) => role.uuid === roleUuid.value
    );
    setRolePermissions(props.payload.permissions);
  }
});
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
      <CustomAccordion no-border initial-state="0">
        <template #header> Data User </template>
        <template #content>
          <div class="grid grid-cols-12 gap-5 mt-4">
            <div class="flex items-end col-span-12 gap-y-5">
              <CustomSelect
                label="Praktisi"
                v-model="practitionerUuid"
                place-holder="Cari & Pilih Praktisi"
                :options="praktisiPayload"
                option-label="pegawai.name"
                option-value="uuid"
                @update:modelValue="searchPraktisi"
                class="grow"
                :invalid="!!errors.practitionerUuid"
                :invalidMessage="errors.practitionerUuid"
              />
            </div>
            <div v-if="selectedPraktisi" class="col-span-12">
              <div
                class="grid grid-flow-col grid-cols-12 grid-rows-2 gap-5 border rounded-[10px] border-opensimrs-300 col-span-12 p-5"
              >
                <div class="flex flex-col col-span-4">
                  <div class="font-semibold underline text-SM">
                    Nama Pegawai
                  </div>
                  <div class="font-normal text-normal">
                    {{ selectedPraktisi.pegawai.name }}
                  </div>
                </div>
                <div class="flex flex-col col-span-4">
                  <div class="font-semibold underline text-SM">NIK</div>
                  <div class="font-normal text-normal">
                    {{ selectedPraktisi.pegawai.nik }}
                  </div>
                </div>
                <div class="flex flex-col col-span-4">
                  <div class="font-semibold underline text-SM">
                    Tanggal Lahir
                  </div>
                  <div class="font-normal text-normal">
                    {{ selectedPraktisi.pegawai.tanggalLahir }}
                  </div>
                </div>
                <div class="flex flex-col col-span-4">
                  <div class="font-semibold underline text-SM">
                    Jenis Kelamin
                  </div>
                  <div class="font-normal text-normal">
                    {{ selectedPraktisi.pegawai.gender }}
                  </div>
                </div>
              </div>
            </div>
            <CustomTextfield
              label="No. Handphone"
              v-model="phone"
              placeholder="08xx-xxxx-xxxx"
              class="col-span-6"
              :invalid="!!errors.phone"
              :invalidMessage="errors.phone"
            />
            <CustomTextfield
              label="Email"
              v-model="email"
              placeholder="Email"
              class="col-span-6"
              :invalid="!!errors.email"
              :invalidMessage="errors.email"
            />
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
          <div class="grid grid-cols-12 gap-5 mt-5">
            <CustomTextfield
              v-model="username"
              label="Username"
              placeholder="Username"
              :invalid="!!errors.username"
              :invalidMessage="errors.username"
              class="col-span-4"
              autocomplete="off"
            />

            <CustomTextfield
              v-model="password"
              label="Password"
              placeholder="********"
              :type="showPassword ? 'text' : 'password'"
              :invalid="errors.password ? true : false"
              :invalidMessage="errors.password"
              :appendIcon="showPassword ? 'PhEyeSlash' : 'PhEye'"
              @clickAppend="showPassword = !showPassword"
              class="col-span-4"
            />
            <CustomTextfield
              v-model="confirmPassword"
              label="Verify Password"
              placeholder="********"
              :type="showConfirmPassword ? 'text' : 'password'"
              :invalid="errors.confirmPassword ? true : false"
              :invalidMessage="errors.confirmPassword"
              :appendIcon="showConfirmPassword ? 'PhEyeSlash' : 'PhEye'"
              @clickAppend="showConfirmPassword = !showConfirmPassword"
              class="col-span-4"
            />
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
      <!-- Modul & Permission -->
      <CustomAccordion no-border initial-state="0">
        <template #header> Modul & Permission </template>
        <template #content>
          <div class="grid grid-cols-12 gap-5 pt-5">
            <!-- Role Selection -->
            <CustomSelect
              label="Role"
              v-model="roleUuid"
              place-holder="Pilih Role"
              class="col-span-12"
              :options="rolePayload"
              option-label="name"
              option-value="uuid"
              :invalid="errors.roleUuid ? true : false"
              :invalidMessage="errors.roleUuid"
              @update:modelValue="handleChangeRole"
            />
            <!-- Loop through all modules -->
            <div
              v-if="selectedRole"
              v-for="(menuItem, menuIndex) in initialPermissionsState"
              :key="menuItem.module"
              class="col-span-12"
            >
              <!-- Module level -->
              <CustomAccordion
                header-class="bg-opensimrs-50"
                :open-with-header="false"
              >
                <template #header>
                  <div class="flex items-center gap-2.5">
                    <Checkbox
                      v-model="menuItem.checked"
                      :inputId="menuItem.module"
                      name="menuItem"
                      @update:model-value="onCheckModule(menuItem)"
                      :dt="{
                        checkedBackground: 'rgb(var(--opensimrs-300))',
                        checkedHoverBackground: 'rgb(var(--opensimrs-300))',
                        borderColor: '#98A2B3',
                      }"
                      binary
                    />
                    <label :for="menuItem.module">{{ menuItem.module }}</label>
                  </div>
                </template>

                <template #content>
                  <!-- Loop through all sub-modules -->
                  <div
                    v-for="(subMenuItem, subMenuIndex) in menuItem.subModules"
                    :key="subMenuItem.name"
                  >
                    <!-- Submodule level -->
                    <CustomAccordion
                      class="col-span-12 pt-5"
                      header-class="bg-opensimrs-50"
                      :open-with-header="false"
                    >
                      <template #header>
                        <div class="flex items-center gap-2.5">
                          <Checkbox
                            v-model="subMenuItem.checked"
                            :inputId="subMenuItem.name"
                            name="subMenuItem"
                            :dt="{
                              checkedBackground: 'rgb(var(--opensimrs-300))',
                              checkedHoverBackground: 'rgb(var(--opensimrs-300))',
                              borderColor: '#98A2B3',
                            }"
                            binary
                            @update:model-value="
                              onCheckSubModule(menuItem, subMenuItem)
                            "
                          />
                          <label
                            :for="subMenuItem.name"
                            class="font-normal text-SM text-grey-400"
                          >
                            {{ subMenuItem.name }}
                          </label>
                        </div>
                      </template>

                      <template #content>
                        <!-- Check if the submodule has features -->
                        <div
                          v-if="
                            subMenuItem.features && subMenuItem.features.length
                          "
                        >
                          <!-- Loop through features -->
                          <div
                            v-for="(
                              feature, featureIndex
                            ) in subMenuItem.features"
                            :key="feature.name"
                          >
                            <CustomAccordion
                              class="col-span-12 pt-5"
                              header-class="bg-opensimrs-50"
                              :open-with-header="false"
                            >
                              <template #header>
                                <div class="flex items-center gap-2.5">
                                  <Checkbox
                                    v-model="feature.checked"
                                    :inputId="feature.name"
                                    binary
                                    name="featureItem"
                                    @update:model-value="
                                      onCheckFeature(
                                        menuItem,
                                        subMenuItem,
                                        feature
                                      )
                                    "
                                    :dt="{
                                      checkedBackground: 'rgb(var(--opensimrs-300))',
                                      checkedHoverBackground: 'rgb(var(--opensimrs-300))',
                                      borderColor: '#98A2B3',
                                    }"
                                  />
                                  <label
                                    :for="feature.name"
                                    class="font-normal text-SM text-grey-400"
                                  >
                                    {{ feature.name }}
                                  </label>
                                </div>
                              </template>

                              <template #content>
                                <!-- Actions level for each feature -->
                                <div class="flex flex-wrap gap-2.5 pt-5">
                                  <div
                                    v-for="(
                                      action, actionIndex
                                    ) in feature.allows"
                                    :key="action.name"
                                  >
                                    <CustomCheckbox
                                      v-model="action.checked"
                                      :title="action.name"
                                      subTitle=""
                                      binary
                                      @update:model-value="
                                        onCheckAllow(
                                          menuItem,
                                          subMenuItem,
                                          feature,
                                          action
                                        )
                                      "
                                    />
                                  </div>
                                </div>
                              </template>
                            </CustomAccordion>
                          </div>
                        </div>

                        <!-- If no features, show actions for submodule directly -->
                        <div v-else>
                          <!-- Render allows directly for submodules without features -->
                          <div class="flex flex-wrap gap-2.5 pt-5">
                            <div
                              v-for="(
                                action, actionIndex
                              ) in subMenuItem.allows"
                              :key="action.name"
                            >
                              <CustomCheckbox
                                v-model="action.checked"
                                :title="action.name"
                                subTitle=""
                                binary
                                @update:model-value="
                                  onCheckAllow(
                                    menuItem,
                                    subMenuItem,
                                    null,
                                    action
                                  )
                                "
                              />
                            </div>
                          </div>
                        </div>
                      </template>
                    </CustomAccordion>
                  </div>
                </template>
              </CustomAccordion>
            </div>
            <div v-else class="col-span-12">
              <NoData />
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
      <hr class="border-grey-200" />
      <CustomSwitch
        v-model="status"
        :show-label="true"
        label="Status"
        sideLabel="NON-AKTIF"
        sideLabelTrue="AKTIF"
        class="mt-5"
      />
    </template>
    <template #footer>
      <div class="flex justify-end gap-2.5 px-5 py-2.5">
        <CustomButton label="Batal" @click="emit('back')" />
        <CustomButton label="Simpan" @click="onSubmit" />
      </div>
    </template>
  </Card>
</template>
