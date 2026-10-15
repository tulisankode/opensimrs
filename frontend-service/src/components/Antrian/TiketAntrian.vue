<script setup lang="ts">
import { computed } from "vue";
import {
  epochToDate,
  formatStringDate,
  formatTime,
  setTimeToDate,
} from "@/utils/Helpers";
import { createTiketAntrianPDF } from "@/utils/pdf/pdfAntrian/TiketAntrian";
import { useRoute } from "vue-router";

const props = defineProps({
  tiketAntrian: {
    default: Object,
  },
  showPrintButton: {
    type: Boolean,
    default: false,
  },
  noAntrianFarmasi: {
    type: Boolean,
    default: false,
  },
});

const route = useRoute();

const isFarmasiPage = computed(() => {
  return (
    route.name === "antrian-apm-aktif-pasien-farmasi-berhasil" ||
    String(route.path || "").includes("/antrian/apm/aktif/pasien/farmasi")
  );
});

const displayNoAntrian = computed(() => {
  const farmasi = props.tiketAntrian?.noAntrianFarmasi;
  const adm = props.tiketAntrian?.noAntrianAdmisi;
  const poli = props.tiketAntrian?.noAntrianPoli;

  const hasValue = (v: any) =>
    !(
      v === null ||
      v === undefined ||
      (typeof v === "string" && v.trim() === "")
    );

  if (isFarmasiPage.value) {
    // Halaman Farmasi: tampilkan Farmasi (fallback ke Poli lalu Admisi)
    return hasValue(farmasi)
      ? farmasi
      : hasValue(poli)
      ? poli
      : hasValue(adm)
      ? adm
      : "";
  }

  // Halaman selain Farmasi (mis. Print): tampilkan Poli jika ada, jika tidak ada tampilkan Admisi
  return hasValue(adm) ? adm : hasValue(poli) ? poli : "";
});

const shouldShowFarmasiLabel = computed(() => {
  const val = props.tiketAntrian?.noAntrianFarmasi;
  return isFarmasiPage.value && typeof val === "string" && val.trim() !== "";
});

// Jika noAntrianFarmasi berisi "NR" => Non-Racikan, jika hanya "R" => Racikan
const isNonRacikan = computed(() => {
  const val = String(props.tiketAntrian?.noAntrianFarmasi || "").toUpperCase();
  if (val.includes("NR")) return true;
  if (val.includes("R")) return false;
  return false;
});

const handlePrint = async () => {
  try {
    // Tentukan sumber klik berdasarkan route
    const isFarmasi =
      route.name === "antrian-apm-aktif-pasien-farmasi-berhasil" ||
      String(route.path || "").includes("/antrian/apm/aktif/pasien/farmasi");

    // Generate PDF menggunakan data tiket antrian, sertakan sumber
    const pdf = await createTiketAntrianPDF({
      ...props.tiketAntrian,
      __printSource: isFarmasi ? "farmasi" : "poli",
      __selectedNoAntrian: displayNoAntrian.value,
    });

    // Download PDF
    pdf.download(
      `tiket-antrian-${props.tiketAntrian?.kodeBooking || "unknown"}.pdf`
    );
  } catch (error) {
    console.error("Error generating PDF:", error);
    // Fallback ke window.print() jika PDF gagal
    window.print();
  }
};

const formatDateShortMonth = (date: Date) => {
  const monthsShort = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = String(date.getDate()).padStart(2, "0");
  const month = monthsShort[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

function epochToDateShortMonth(epochTime: number): string {
  const date = new Date(epochTime * 1000);
  return formatDateShortMonth(date);
}
const mapGenderId = (g?: string) => {
  const val = String(g || "").toLowerCase();
  if (val === "male") return "Laki-laki";
  if (val === "female") return "Perempuan";
  return g || "";
};
</script>
<template>
  <Card class="overflow-hidden w-full h-[350px]">
    <template #content>
      <div class="flex gap-7 justify-between">
        <div class="space-y-3 w-full">
          <div class="font-bold leading-8 text-heading">
            Data Pasien
            <hr class="border-black border-1" />
          </div>
          <div class="grid p-0 grid-cols-[140px_auto_1fr]">
            <div class="font-semibold leading-5 text-normal">No. RM</div>
            <div class="px-3">:</div>
            <div class="font-normal leading-5 text-normal">
              {{ tiketAntrian.patient.noRm }}
            </div>
          </div>
          <div class="grid p-0 grid-cols-[140px_auto_1fr]">
            <div class="font-semibold leading-5 text-normal">No. Booking</div>
            <div class="px-3">:</div>
            <div class="font-normal leading-5 text-normal">
              {{ tiketAntrian.kodeBooking }}
            </div>
          </div>
          <div class="grid p-0 grid-cols-[140px_auto_1fr]">
            <div class="font-semibold leading-5 text-normal">
              No. Registrasi
            </div>
            <div class="px-3">:</div>
            <div class="font-normal leading-5 text-normal">
              {{ tiketAntrian.noReg }}
            </div>
          </div>
          <div class="grid p-0 grid-cols-[140px_auto_1fr]">
            <div class="font-semibold leading-5 text-normal">No. BPJS</div>
            <div class="px-3">:</div>
            <div class="font-normal leading-5 text-normal">
              {{ tiketAntrian?.noBPJS || "-" }}
            </div>
          </div>
          <div
            class="grid p-0 grid-cols-[140px_auto_1fr]"
            v-if="tiketAntrian.noBPJS"
          >
            <div class="font-semibold leading-5 text-normal">No. BPJS</div>
            <div class="px-3">:</div>
            <div class="font-normal leading-5 text-normal">
              {{ tiketAntrian.noBPJS }}
            </div>
          </div>
          <div class="grid p-0 grid-cols-[140px_auto_1fr]">
            <div class="font-semibold leading-5 text-normal">No. Identitas</div>
            <div class="px-3">:</div>
            <div class="font-normal leading-5 text-normal">
              {{ tiketAntrian.patient.noIdentity }}
            </div>
          </div>
          <div class="grid p-0 grid-cols-[140px_auto_1fr]">
            <div class="font-semibold leading-5 text-normal">Nama</div>
            <div class="px-3">:</div>
            <div class="font-normal leading-5 text-normal">
              {{ tiketAntrian.patient.name }}
            </div>
          </div>
          <div class="grid p-0 grid-cols-[140px_auto_1fr]">
            <div class="font-semibold leading-5 text-normal">Tgl. Lahir</div>
            <div class="px-3">:</div>
            <div class="font-normal leading-5 text-normal">
              {{
                formatStringDate(
                  tiketAntrian.patient.birthDetail.birthDate,
                  "date"
                )
              }}
            </div>
          </div>
          <div class="grid p-0 grid-cols-[140px_auto_1fr]">
            <div class="font-semibold leading-5 text-normal">Jenis Kelamin</div>
            <div class="px-3">:</div>
            <div class="font-normal leading-5 text-normal">
              {{ mapGenderId(tiketAntrian.patient.gender) }}
            </div>
          </div>
        </div>

        <div class="w-full">
          <div class="mb-4 font-bold leading-8 text-heading">
            Pelayanan
            <hr class="border-black border-1" />
          </div>
          <div class="flex flex-col gap-3">
            <div class="flex flex-col">
              <div
                class="font-normal leading-7 underline text-normal underline-offset-4"
              >
                Poliklinik
              </div>
              <div class="font-bold leading-8 text-subheading text-opensimrs-300">
                {{ tiketAntrian.lokasi.name }}
              </div>
            </div>
            <div class="flex flex-col">
              <div
                class="font-normal leading-7 underline text-normal underline-offset-4"
              >
                Dokter
              </div>
              <div class="font-bold leading-8 text-subheading text-opensimrs-300">
                <span v-if="tiketAntrian.practitioner.pegawai.firstTitle">{{
                  tiketAntrian.practitioner.pegawai.firstTitle
                }}</span>
                {{ tiketAntrian.practitioner.pegawai.nama }}
                <span v-if="tiketAntrian.practitioner.pegawai.lastTitle">{{
                  tiketAntrian.practitioner.pegawai.lastTitle
                }}</span>
              </div>
            </div>
            <div class="flex flex-col">
              <div
                class="font-normal leading-7 underline text-normal underline-offset-4"
              >
                Jadwal
              </div>
              <div class="font-bold leading-8 text-subheading text-opensimrs-300">
                {{
                  tiketAntrian.jadwalDokter?.startTime
                    ? formatTime(
                        setTimeToDate(tiketAntrian.jadwalDokter.startTime)
                      )
                    : "-"
                }}
                -
                {{
                  tiketAntrian.jadwalDokter?.endTime
                    ? formatTime(
                        setTimeToDate(tiketAntrian.jadwalDokter.endTime)
                      )
                    : "-"
                }}
              </div>
            </div>
          </div>
        </div>
        <div class="flex relative justify-center items-center w-3/4 h-[420px]">
          <div class="absolute right-0 -top-16">
            <img src="../../assets/icons/Rectangle 1023.svg" alt="" />
            <div
              class="flex absolute top-14 flex-col gap-2 justify-center items-center w-full"
            >
              <!-- Tombol Print hanya tampil jika showPrintButton = true -->
              <button
                v-if="showPrintButton"
                type="button"
                @click="handlePrint"
                class="inline-flex gap-2 items-center px-10 py-2 bg-white rounded-xl shadow-md transition text-opensimrs-300 hover:opacity-90"
                aria-label="Print tiket antrian"
              >
                <PhPrinter :size="32" class="text-opensimrs-300" weight="fill" />
                <span class="font-bold">Print</span>
              </button>
              <div
                class="flex justify-center items-center w-48 border-b-2 border-dashed"
              >
                <div
                  :class="[
                    'mx-5 my-1 text-center',
                    { 'my-4': !showPrintButton },
                  ]"
                >
                  <div class="font-bold leading-8 text-white text-subheading">
                    No. Antrian
                    <span v-if="tiketAntrian.noAntrianAdmisi">loket</span>
                  </div>
                  <hr />
                  <div
                    class="mt-1 text-sm font-normal leading-7 text-white opacity-85"
                  >
                    {{ epochToDateShortMonth(tiketAntrian.tanggalCheckin) }}
                  </div>
                </div>
              </div>
              <div
                :class="[
                  'text-[34px] text-center font-bold leading-10 text-white',
                  shouldShowFarmasiLabel
                    ? 'mt-0'
                    : showPrintButton
                    ? 'mt-8'
                    : 'mt-12',
                ]"
              >
                <!-- Kondisional untuk label Farmasi -->
                <div v-if="shouldShowFarmasiLabel" class="text-[20px]">
                  Obat <span v-if="isNonRacikan">Non-</span>Racikan
                </div>
                {{ displayNoAntrian }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
