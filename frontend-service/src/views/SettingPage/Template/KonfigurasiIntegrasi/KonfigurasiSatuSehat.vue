<script setup lang="ts">
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

	<GreenCard cardHeading="Konfigurasi SATUSEHAT" hrEnableCustomClass showButton labelButton="Edit"
		:buttonClickHandler="props.editHandler">
		<div class="pl-2 text-base">
			<div class="grid grid-cols-2 gap-3">
				<!-- 7 kolom di sebelah kiri -->
				<div class="mb-4">
					<div class="text-sm font-normal underline">Organization ID</div>
					<div class="font-semibold text-MD">{{ props.konfigurasiIntegrasiResponse.organizationId }}</div>
				</div>
				<div class="mb-4">
					<div class="text-sm font-normal underline">Client Secret</div>
					<!-- rahasia: tidak ditampilkan utuh -->
					<div class="font-semibold text-MD">{{ props.konfigurasiIntegrasiResponse.clientSecret ? "••••••••" + String(props.konfigurasiIntegrasiResponse.clientSecret).slice(-4) : "-" }}</div>
				</div>
				<div class="mb-4">
					<div class="text-sm font-normal underline">Client ID</div>
					<div class="font-semibold text-MD">{{ props.konfigurasiIntegrasiResponse.clientId }}</div>
				</div>
			</div>
		</div>

	</GreenCard>
</template>
