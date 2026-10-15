<script lang="ts" setup>
import { ref } from "vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CardPasien from "@/components/Antrian/CardPasien.vue";
import CardAktivitas from "@/components/Antrian/CardAktivitas.vue";
import { useRouter } from "vue-router";
import NavbarAntrian from "@/components/Antrian/NavbarAntrian.vue";
import OrnamentAntrian from "@/components/Antrian/OrnamentAntrian.vue";
import { Swiper, SwiperSlide } from "swiper/vue";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";

const router = useRouter();

const handleBackAntrian = () => {
  router.push("/antrian/apm");
};

const handleFarmasi = () => {
  router.push("/antrian/apm/aktif/pasien/farmasi/daftar");
};
const handlePasienNonJKN = () => {
  router.push("/antrian/apm/aktif/pasien/non-jkn");
};
const handleCheckin = () => {
  router.push("/antrian/apm/aktif/checkin");
};
const handlePrint = () => {
  router.push("/antrian/apm/aktif/print");
};

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
});

const emit = defineEmits(["update:isDialogVisible", "close"]);

function updateVisibility(value: any) {
  emit("update:isDialogVisible", value);
}

function closeDialog() {
  emit("close");
}

const cardPasienJKN = ref({
  keterangan: "Antrian Obat",
});
const cardPasienNonJKN = ref({
  keterangan: "Pasien Non-JKN",
});
const cardAktivitasCheckIn = ref({
  keterangan: "Checkin",
});
const cardAktivitasPrint = ref({
  keterangan: "Print",
});

const device = ref(["Carousel 1", "Carousel 2", "Carousel 3"]);
</script>

<template>
  <div class="py-5 w-full min-h-screen">
    <div
      class="flex relative z-10 gap-5 justify-between py-0 pr-5 mx-3 rounded-xl shadow-md bg-opensimrs-300 max-md:flex-wrap"
      @click="handleBackAntrian"
    >
      <NavbarAntrian />
    </div>
    <!-- Carousel Section -->
    <Swiper
      :modules="[Autoplay, Pagination]"
      :slides-per-view="1"
      :loop="true"
      :allow-touch-move="true"
      :autoplay="{
        delay: 3000,
        disableOnInteraction: false,
        pauseOnMouseEnter: true,
      }"
      :pagination="{ clickable: true }"
      grab-cursor
      class="relative z-10"
    >
      <SwiperSlide v-for="(item, idx) in device" :key="idx">
        <div class="flex relative justify-center items-center mx-36 mt-16 mb-4">
          <div class="overflow-hidden w-full rounded-xl">
            <div class="flex transition-transform duration-300">
              <div
                class="bg-opensimrs-300 w-full h-[330px] flex items-center justify-center"
              >
                <div class="text-center text-white">
                  <div class="mb-2 text-5xl">#Improving</div>
                  <div class="text-5xl font-extrabold">Healthcare</div>
                </div>
              </div>

              <div class="relative w-2/5">
                <img
                  loading="lazy"
                  src="@/assets/images/APM/image-pharmacy.svg"
                  class="h-[330px] object-cover w-full"
                />
                <div
                  class="absolute w-full inset-y-0 left-0 h-[330px] bg-gradient-to-r from-opensimrs-300 to-transparent to-70%"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </SwiperSlide>
    </Swiper>

    <div class="flex relative z-10 justify-center">
      <div class="w-[350px] my-10">
        <CardPasien
          :cardPasien="cardPasienJKN"
          :showPillIcon="true"
          @click="handleFarmasi"
          class="transition-transform duration-300 hover:scale-95"
        />
      </div>
    </div>
    <OrnamentAntrian />
  </div>
</template>

<style lang="postcss">
.swiper-pagination-horizontal {
  @apply pb-5;
}
.swiper-pagination-bullet {
  @apply border-white bg-white p-2;
}
</style>
