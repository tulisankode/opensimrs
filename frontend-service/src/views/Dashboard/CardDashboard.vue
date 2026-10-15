<script setup lang="ts">

const props = defineProps({
	iconKegiatan: {
		type: String,
		default:""
	},
	namaKegiatan: {
		type: String,
		default:"Tidak Tau"
	},
	data: {
		type: String,
		default:"HALO"
	},
	satuanData: {
		type: String,
		default:"KM"
	},
	percentage: {
		type: String,
		default:""
	},
	arrowIcon: {
		type: String,
		default:""
	},
	dataFont: {
		type: String,
		default:"font-bold text-black text-[40px]"
	}
})
</script>

<template>
	<div class="flex flex-col justify-between w-auto p-5 bg-white shadow-md rounded-2xl min-h-44">
		<!-- Header Section -->
		<div class="flex items-center gap-2.5 mb-4">
			<div class="flex justify-center w-10 h-10 text-white rounded-full bg-opensimrs-300">
				<img :src="props.iconKegiatan" alt="Icon Kegiatan" width="20px">
			</div>
			<div class="font-semibold text-black text-SM">{{ props.namaKegiatan }}</div>
		</div>

		<!-- Main Content -->
		<div class="">
			<div class="flex flex-col justify-end">
				<div :class=props.dataFont>{{ props.data }}</div>
				<div class="text-gray-400 text-normal">{{props.satuanData}}</div>
			</div>
			<div v-if="props.percentage" class="flex justify-end gap-1 -mt-6">
				<div>
					<img :src="props.arrowIcon" alt="Icon Kegiatan" class="w-full h-full rounded-full">
				</div>
				<div class="text-normal text-success-300">{{props.percentage}}</div>
			</div>

		</div>
	</div>
</template>
