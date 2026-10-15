<script setup lang="ts">
import CustomChip from '@/components/Base/CustomChip.vue';

const props = defineProps({
	headerGrafik: {
		type: String,
		default: ""
	},
	showDots: {
		type:Boolean,
		default:false
	},
	showDetail: {
		type: Boolean,
		default: false
	}
})

const emit = defineEmits(["dotClick"]);

const handleDotClick = (event: MouseEvent) => {
    emit('dotClick', event); 
};

</script>

<template>
	<div class="flex items-center justify-between p-5">
		<div class="text-lg font-bold">{{ props.headerGrafik }}</div>
		<div class="flex gap-2.5 items-center">
			<CustomChip v-if="props.showDetail" label="Detail" bg-color="bg-opensimrs-300" border-color="border-transparent"
				customClass="h-[30px] font-semibold text-normal pl-3" text-color="text-white" icon-color="text-white"
				:show-checked-icon="false" />
			<div class="w-[24px] h-[24px]" v-if="showDots">
				<PhDotsThreeVertical :size="24" color="#667085" @click="handleDotClick" class="cursor-pointer"/>
			</div>
		</div>
	</div>
	<hr class="border-[#D9DCE1] border-1 mb-2 mx-5" />
</template>
