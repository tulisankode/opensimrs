<script setup lang="ts">
import CustomButton from '@/components/Base/CustomButton.vue';

import { useRouter } from 'vue-router';


const props = defineProps({
	heading: {
		type: String,
		default: ""
	},
	labelButton: {
		type: String,
		default: ""
	},
	showButton: {
		type: Boolean,
		default: false,
	},
	buttonClickHandler: {
		type: Function as () => any,
		default: () => {}
	},
	iconButton: {
		type:String,
		default:""
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
})

</script>

<template>
	<div class="flex items-center justify-between">
		<div class="mt-5 ml-5 font-semibold font-poppins text-heading text-opensimrs-300">
			{{ props.heading }}
		</div>
		<div class="mt-5 ml-5 mr-5 font-poppins" v-if="showButton">
			<CustomButton :label="props.labelButton" class="px-5 py-[10px] font-poppins font-semibold text-sm"
				@click="buttonClickHandler" :icon="props.iconButton" :outlined="props.outlined" :border-color="props.borderColor" :text-color="props.textColor"/>
		</div>

	</div>
	<hr class="border-[#D9DCE1] border-1 ml-5 mr-7 mt-5" />
</template>
