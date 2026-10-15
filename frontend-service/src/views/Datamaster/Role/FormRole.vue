<script lang="ts" setup>
import { ref, watch, computed } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import { usePermissionStore } from "@/stores/datamaster/permission";
import { useRoleStore } from "@/stores/datamaster/role";
import * as yup from "yup";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomCheckbox from "@/components/Base/CustomCheckbox.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue";

const permissionsStore = usePermissionStore();
const roleStore = useRoleStore();
// Props definition
const props = defineProps({
  isDialogVisible: {
    default: false,
  },
  title: {
    type: String,
  },
  method: {
    type: String,
  },
  payload: {
    type: Object,
    default: () => ({}),
  },
});

// Form validation schema
const schema = toTypedSchema(
  yup
    .object({
      code: yup.string().required("Kode Role harus diisi"),
      name: yup.string().required("Nama Role harus diisi"),
      status: yup.boolean().default(true),
    })
    .noUnknown()
);
interface Allow {
  name: string;
  checked: boolean;
}

interface Feature {
  name: string;
  checked: boolean;
  allows: Allow[];
}

interface SubModule {
  name: string;
  checked: boolean;
  features: Feature[];
  allows: Allow[];
}

interface Module {
  module: string;
  checked: boolean;
  subModules: SubModule[];
}

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
        const matchingFeature = matchingSubModule.features.find(
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

const onCheckModule = (module: Module) => {
  isSelectedPermission.value = true;
  // Explicitly type 'module'
  const isChecked = module.checked;

  module.checked = isChecked;

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

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

// Emits
const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

// Form fields
const [code] = defineField("code");
const [name] = defineField("name");
const [status] = defineField("status");
const isSelectedPermission = ref(true);

// Submit handler
const onSubmit = handleSubmit(async (values) => {
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

  if (permissions.length) {
    const allData = {
      ...values,
      permissions,
    };

    try {
      if (method.value === "edit") {
        if (!props.payload || !props.payload.uuid) {
          throw new Error("UUID is missing for edit operation");
        }
        const uuid = props.payload.uuid;
        const response = await roleStore.putApi(uuid, allData);
        emit("data-updated");
      } else if (method.value === "add") {
        const response = await roleStore.postApi(allData);
        emit("data-updated");
      }
      closeDialog();
    } catch (error) {
      console.error("Failed to process the data:", error);
    }
  } else isSelectedPermission.value = false;
});

const method = ref(props.method);
const title = ref(props.title);

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

const resetDialogMode = () => {
  method.value = props.method;
  title.value = props.title;
};

const handleEdit = () => {
  method.value = "edit";
  title.value = "Edit Data";
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

// Close dialog
const closeDialog = () => {
  emit("update:isDialogVisible", false);
  resetDialogMode();
  resetForm();
  resetPermissionsState();
};

// Watch for dialog visibility changes
watch(
  () => props.isDialogVisible,
  (newValue) => {
    if (newValue) {
      resetDialogMode();
      if (props.method !== "add" && props.payload) {
        setValues({
          ...props.payload,
        });
        if (
          props.payload.permissions !== null ||
          !permissionsStore.permissionsItem ||
          !permissionsStore.permissionsItem.length
        ) {
          setRolePermissions(props.payload.permissions);
        }
      }
    } else {
      resetForm();
      resetDialogMode();
      resetPermissionsState();
    }
  },
  { immediate: true }
);
</script>

<template>
  <CustomDialog
    width="600px"
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-opensimrs-300"
  >
    <template #header>{{ title }} Role</template>
    <template #body>
      <!-- Form Input -->
      <div v-if="method !== 'detail'" class="grid grid-cols-12 gap-5 mt-5">
        <CustomTextfield
          label="Kode"
          v-model="code"
          placeholder="Kode Role"
          :invalid="!!errors.code"
          :invalidMessage="errors.code"
          :required="errors.code ? true : false"
          class="col-span-5"
        />
        <CustomTextfield
          label="Nama Role"
          v-model="name"
          placeholder="Nama Role"
          class="col-span-7"
          :invalid="!!errors.name"
          :invalidMessage="errors.name"
          :required="errors.name ? true : false"
        />
        <hr class="col-span-12 border-grey-200" />
        <CustomAccordion class="col-span-12" no-border initial-state="0">
          <template #header>
            <div class="-mx-4 text-normal">Modul</div>
          </template>
          <template #content>
            <small v-if="!isSelectedPermission" class="text-red-500">
              * Modul harus dipilih
            </small>
            <div class="flex flex-wrap gap-2.5 pt-5">
              <div
                v-for="menuItem in initialPermissionsState"
                :key="menuItem.module"
              >
                <CustomCheckbox
                  v-model="menuItem.checked"
                  :title="menuItem.module"
                  subTitle=""
                  binary
                  @update:model-value="onCheckModule(menuItem)"
                />
              </div>
            </div>
          </template>
          <template #collapseIcon>
            <CustomButton
              icon="PhCaretUp"
              backgroundColor="bg-transparent"
              textColor="text-opensimrs-300"
              class="-mr-5"
            />
          </template>
          <template #expandIcon>
            <CustomButton
              icon="PhCaretDown"
              backgroundColor="bg-transparent"
              textColor="text-opensimrs-300"
              class="-mr-5"
            />
          </template>
        </CustomAccordion>
        <hr class="col-span-12 border-grey-200" />
        <CustomSwitch
          v-model="status"
          :show-label="true"
          label="Status"
          sideLabel="NON-AKTIF"
          sideLabelTrue="AKTIF"
          class="col-span-12"
        />
      </div>
      <!-- Detail Data -->
      <div v-if="method === 'detail'" class="flex flex-col gap-5 mt-5">
        <CustomInfoRow label="Kode Role" :value="code" />
        <CustomInfoRow label="Nama Role" :value="name" />
        <CustomInfoRow label="Modul">
          <template #value>
            <div
              v-if="payload.permissions !== null && payload.permissions.length"
              class="flex flex-wrap w-full h-full gap-1"
            >
              <CustomChip
                v-for="permission in payload.permissions"
                :label="permission.module"
                textColor="text-white"
                bgColor="bg-opensimrs-300"
                borderColor="border-none"
                :showCheckedIcon="false"
                customClass="text-xs font-semibold h-5 flex w-fit"
              />
            </div>
            <div v-else>-</div>
          </template>
        </CustomInfoRow>
        <hr class="col-span-12 border-grey-200" />
        <CustomInfoRow label="Status">
          <template #value>
            <CustomChip
              :label="status ? 'AKTIF' : 'NON-AKTIF'"
              :textColor="status ? 'text-white' : 'text-[#80868d]'"
              :bgColor="status ? 'bg-opensimrs-300' : 'bg-white'"
              :borderColor="status ? 'border-none' : 'border-[#80868d]'"
              :icon-color="status ? 'white' : '#80868d'"
              customClass="text-xs font-semibold h-5 flex w-fit"
            />
          </template>
        </CustomInfoRow>
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <div class="mt-5 flex justify-end gap-2.5">
          <CustomButton
            v-if="method !== 'detail'"
            label="Batal"
            border-color="border-grey-200"
            background-color="bg-white"
            text-color="text-grey-300"
            @click="closeDialog"
          />
          <CustomButton
            v-if="method !== 'detail'"
            label="Simpan"
            @click="onSubmit"
          />
          <CustomButton
            v-if="method === 'detail'"
            label="Edit"
            @click="handleEdit"
          />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
