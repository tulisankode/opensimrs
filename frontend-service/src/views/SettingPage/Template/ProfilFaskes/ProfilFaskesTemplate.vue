<script setup lang="ts">
import GreenCard from "../GreenCard.vue";
import NoData from "@/assets/icons/no-data-icon.svg";
import { ref } from "vue";

const props = defineProps({
  profilFaskesResponse: {
    type: Object,
    required: true,
  },
  editHandler: {
    type: Function,
    required: true,
  },
});

const noData = ref(NoData);
</script>

<template>
  <GreenCard
    cardHeading="Profile"
    showButton
    labelButton="Edit"
    hrEnableCustomClass
    class="font-bold"
    :button-click-handler="props.editHandler"
  >
    <div class="pl-2">
      <div class="grid grid-cols-2 gap-3">
        <!-- 7 kolom di sebelah kiri -->
        <div class="mb-4">
          <div class="text-sm font-normal underline">Kode Faskes</div>
          <div class="font-semibold text-MD">
            {{ props.profilFaskesResponse.code || "-" }}
          </div>
        </div>
        <div class="mb-4">
          <div class="text-sm font-normal underline">Nama Faskes</div>
          <div class="font-semibold text-MD">
            {{ props.profilFaskesResponse.name || "-" }}
          </div>
        </div>
        <div class="col-span-2 mb-4">
          <div class="text-sm font-normal underline">Alamat</div>
          <div class="font-semibold text-MD">
            {{ props.profilFaskesResponse.address.fullAddress || "-" }}
          </div>
        </div>
        <div class="mb-4">
          <div class="text-sm font-normal underline">Provinsi</div>
          <div class="font-semibold text-MD">
            {{ props.profilFaskesResponse.address.prov || "-" }}
          </div>
        </div>
        <div class="mb-4">
          <div class="text-sm font-normal underline">Kabupaten/Kota</div>
          <div class="font-semibold text-MD">
            {{ props.profilFaskesResponse.address.city || "-" }}
          </div>
        </div>
        <div class="mb-4">
          <div class="text-sm font-normal underline">Kecamatan</div>
          <div class="font-semibold text-MD">
            {{ props.profilFaskesResponse.address.district || "-" }}
          </div>
        </div>
        <div class="mb-4">
          <div class="text-sm font-normal underline">Kelurahan</div>
          <div class="font-semibold text-MD">
            {{ props.profilFaskesResponse.address.village || "-" }}
          </div>
        </div>
        <div class="mb-4">
          <div class="text-sm font-normal underline">Kode Pos</div>
          <div class="font-semibold text-MD">
            {{ props.profilFaskesResponse.address.postalCode || "-" }}
          </div>
        </div>

        <div class="mb-4">
          <div class="text-sm font-normal underline">No. Telpon</div>
          <div class="font-semibold text-MD">
            {{ props.profilFaskesResponse.phone || "-" }}
          </div>
        </div>
        <div class="mb-4">
          <div class="text-sm font-normal underline">Email</div>
          <div class="font-semibold text-MD">
            {{ props.profilFaskesResponse.email || "-" }}
          </div>
        </div>
        <div class="mb-4">
          <div class="text-sm font-normal underline">Website</div>
          <div class="font-semibold text-MD">
            <a :href="props.profilFaskesResponse.website" target="_blank">{{
              props.profilFaskesResponse.website || "-"
            }}</a>
          </div>
        </div>
        <div class="mb-4">
          <div class="text-sm font-normal underline">Latitude</div>
          <div class="font-semibold text-MD">
            {{ props.profilFaskesResponse.lat || "-" }}
          </div>
        </div>
        <div class="mb-4">
          <div class="text-sm font-normal underline">Longitude</div>
          <div class="font-semibold text-MD">
            {{ props.profilFaskesResponse.long || "-" }}
          </div>
        </div>
        <div class="mb-4">
          <div class="text-sm font-normal underline">Link Google Map</div>
          <div class="font-semibold text-MD">
            <a :href="props.profilFaskesResponse.url_gmaps" target="_blank">{{
              props.profilFaskesResponse.urlGmaps || "-"
            }}</a>
          </div>
        </div>
        <div class="flex flex-col gap-2.5">
          <div class="text-sm font-normal underline">Cover</div>

          <div
            class="flex flex-col items-center justify-center bg-white border-2 border-dashed rounded-md min-h-44 pt-"
          >
            <img
              :src="
                props.profilFaskesResponse.cover
                  ? props.profilFaskesResponse.cover
                  : noData
              "
              alt="Logo Preview"
              class="h-auto"
            />
            <!-- <div class="font-normal text-center text-SM text-grey-300">Upload file untuk menampilkan preview</div> -->
          </div>

          <!-- <div class="font-semibold text-MD">
						<a :href="props.profilFaskesResponse.url_gmaps"
							target="_blank">{{ props.profilFaskesResponse.urlGmaps || '-'}}</a>
					</div> -->
        </div>
      </div>
    </div>
  </GreenCard>
</template>

<style lang="scss" scoped></style>
