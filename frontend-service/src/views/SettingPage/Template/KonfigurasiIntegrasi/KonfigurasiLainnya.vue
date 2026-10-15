d<script setup lang="ts">
import GreenCard from '../GreenCard.vue';

const props = defineProps({
	konfigurasiIntegrasiResponse: {
		type: Object,
		required: true,
	},
	editHandler: {
		type: Function,
		required: true,
	},

});
</script>

<template>
	<GreenCard cardHeading="Konfigurasi Lainnya" hrEnableCustomClass showButton labelButton="Edit"
		:button-click-handler="props.editHandler">
		<div class="pl-2 text-base">
			<div class="grid grid-cols-2 gap-3">
				<!-- 7 kolom di sebelah kiri -->
				<div class="mb-4">
					<div class="text-sm font-normal underline">API Key Post</div>
					<div class="font-semibold text-MD">{{ props.konfigurasiIntegrasiResponse.apiKeyPost }}</div>
				</div>
				<div class="mb-4">
					<div class="text-sm font-normal underline">Metode</div>
					<div class="font-semibold text-MD">{{ props.konfigurasiIntegrasiResponse.method }}</div>
				</div>
				<div class="mb-4">
					<div class="text-sm font-normal underline">URL End Point</div>
					<div class="font-semibold text-MD">{{ props.konfigurasiIntegrasiResponse.endpoint }}</div>
				</div>
				<div class="mb-4">
					<div class="text-sm font-normal underline">Header</div>
					<div class="font-semibold text-MD">{{ props.konfigurasiIntegrasiResponse.header }}</div>
				</div>
				<div class="mb-4">
					<div class="text-sm font-normal underline">Request </div>
					<div class="font-semibold text-MD">{{ props.konfigurasiIntegrasiResponse.request }}</div>
				</div>
				<div class="mb-4">
					<div class="text-sm font-normal underline">Response </div>
					<div class="font-semibold text-MD">{{props.konfigurasiIntegrasiResponse.response}}</div>
				</div>
			</div>
		</div>
	</GreenCard>
</template>
