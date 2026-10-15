<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";

const props = defineProps({
	cardHeading: {
		type: String,
		default: "",
	},
	showButton: {
		type: Boolean,
		default: false,
	},
	labelButton: {
		type: String,
		default: "",
	},
	hrCustomClass: {
		type: String,
		default: "my-[10px]",
	},
	hrEnableCustomClass: {
		type: Boolean,
		default: false,
	},
	hrDefaultClass: {
		type: String,
		default: "border-[#D9DCE1] border-1 mr-[87px] my-[10px]",
	},
	buttonClickHandler: {
		type: Function as () => any,
		default: () => { }
	},
	outlined: {  // Tambahkan properti outlined
		type: Boolean,
		default: false,
	},
	borderColor: { // Tambahkan props untuk border color
		type: String,
		default: "",
	},
	textColor: {
		type: String,
		default: "",
	},
	disableLine: { // Properti untuk menonaktifkan <hr>
		type: Boolean,
		default: false,
	},
	
});
</script>

<template>
	<div class="p-5 mt-2 rounded-lg bg-opensimrs-50">
		<div class="flex items-center justify-between">
			<div class="font-bold text-opensimrs-300 font-poppins text-heading">
				{{ props.cardHeading }}
			</div>
			<div class="flex items-center gap-3 font-poppins" v-if="showButton">
				<CustomButton :label="props.labelButton" class="px-5 py-[10px] font-poppins font-semibold text-sm"
					@click="buttonClickHandler" :outlined="props.outlined" :border-color="props.borderColor" :text-color="props.textColor" />
			</div>
			<slot name="switch"></slot>
		</div>
		<hr :class="hrEnableCustomClass ? props.hrCustomClass : props.hrDefaultClass"  v-if="!disableLine">
		<slot></slot>
	</div>
</template>

<script setup lang="ts"></script>
