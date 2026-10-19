<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import { utilsStore } from "@/stores/utils";
import { URUTAN_GRADE, gayaGrade, izinIkp, pengaturanIkp, referensiIkp, simpanPengaturanIkp, waktuIkp } from "@/stores/penunjang/mutu";

// Pengaturan IKP (STD-0026, izin PENGATURAN): matriks grading dampak × probabilitas (klik sel untuk mengganti warna),
// batas waktu laporan (jam sejak insiden diketahui, bawaan 2 × 24 jam), batas investigasi per grade, serta penerima &
// kanal pengingat. Nilai bawaan mengacu pedoman pelaporan IKP dan wajib disahkan Tim/Komite KP faskes. Matriks yang
// berubah menaikkan versi; grading lama tetap memakai versinya.
const storeUtils = utilsStore();
const boleh = izinIkp("PENGATURAN");
const referensi = ref<any>({ levelDampak: [], levelProbabilitas: [] });
const p = ref<any>(null);
const galat = ref("");

const muat = async () => {
  const res = await pengaturanIkp();
  if (res?.payload) p.value = { ...res.payload, matriks: res.payload.matriks.map((b: string[]) => [...b]), pengingatPenerima: res.payload.pengingatPenerima ?? "", pengingatKanal: res.payload.pengingatKanal ?? "" };
};
const ganti = (pb: number, dp: number) => {
  if (!boleh) return;
  const m = p.value.matriks;
  m[pb - 1][dp - 1] = URUTAN_GRADE[(URUTAN_GRADE.indexOf(m[pb - 1][dp - 1]) + 1) % URUTAN_GRADE.length];
};
const simpan = async () => {
  galat.value = "";
  const x = p.value;
  if (!Number.isInteger(Number(x.tenggatLaporJam)) || x.tenggatLaporJam < 1) return (galat.value = "Batas waktu laporan minimal 1 jam");
  storeUtils.setLoading(true);
  try {
    const res = await simpanPengaturanIkp({
      tenggatLaporJam: Number(x.tenggatLaporJam),
      tenggatInvestigasiHari: x.tenggatInvestigasiHari,
      matriks: x.matriks,
      pengingatPenerima: x.pengingatPenerima.trim(),
      pengingatKanal: x.pengingatKanal.trim(),
    });
    if (res) muat();
  } finally {
    storeUtils.setLoading(false);
  }
};
const LABEL_TENGGAT: Record<string, string> = { biru: "Biru", hijau: "Hijau", kuning: "Kuning", merah: "Merah", sentinel: "Sentinel" };

onMounted(async () => {
  const r = await referensiIkp();
  if (r?.payload) referensi.value = r.payload;
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Pengaturan Insiden Keselamatan Pasien</h1>
          <CustomButton v-if="boleh" icon="PhFloppyDisk" label="Simpan" @click="simpan" />
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="p" class="flex flex-col gap-4 text-sm">
          <div class="text-xs text-grey-400">
            {{ p.bawaan ? "Memakai nilai bawaan (acuan pedoman pelaporan IKP)." : `Diubah oleh ${p.diubahOleh ?? "-"} · ${waktuIkp(p.updatedAt)}.` }}
            Matriks versi {{ p.versiMatriks }}. Nilai bawaan perlu disahkan Tim/Komite Keselamatan Pasien faskes.
          </div>
          <div class="p-3 border rounded-lg border-grey-75">
            <div class="mb-2 font-semibold">Matriks Grading Risiko {{ boleh ? "(klik sel untuk mengganti warna)" : "" }}</div>
            <table class="text-xs border-collapse">
              <thead>
                <tr>
                  <th class="p-1 text-left">Probabilitas \ Dampak</th>
                  <th v-for="dp in referensi.levelDampak" :key="dp.kode" class="p-1 w-28">{{ dp.kode }}. {{ dp.nama }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="pb in [...(referensi.levelProbabilitas ?? [])].reverse()" :key="pb.kode">
                  <td class="p-1 pr-3">{{ pb.kode }}. {{ pb.nama }}</td>
                  <td v-for="dp in referensi.levelDampak" :key="dp.kode" class="p-0.5">
                    <button type="button" class="w-full h-8 rounded" :class="gayaGrade(p.matriks[Number(pb.kode) - 1][Number(dp.kode) - 1]).sel" :disabled="!boleh" @click="ganti(Number(pb.kode), Number(dp.kode))">
                      {{ gayaGrade(p.matriks[Number(pb.kode) - 1][Number(dp.kode) - 1]).label }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="grid grid-cols-6 gap-3 p-3 border rounded-lg border-grey-75">
            <div class="col-span-6 font-semibold">Batas Waktu</div>
            <CustomInputNumber v-model="p.tenggatLaporJam" label="Laporan (jam sejak diketahui)" :min="1" :max="720" :disabled="!boleh" />
            <CustomInputNumber v-for="(nama, k) in LABEL_TENGGAT" :key="k" v-model="p.tenggatInvestigasiHari[k]" :label="`Investigasi ${nama} (hari)`" :min="1" :max="365" :disabled="!boleh" />
          </div>
          <div class="grid grid-cols-2 gap-3 p-3 border rounded-lg border-grey-75">
            <div class="col-span-2 font-semibold">Pengingat & Eskalasi</div>
            <div class="col-span-2 text-xs text-grey-400">
              SIMRS belum mengirim notifikasi otomatis. Isian ini mendokumentasikan penerima & kanal yang disepakati faskes; selama belum lengkap, dasbor menampilkan status "konfigurasi belum lengkap". Batas waktu tetap dipantau di dasbor (Perlu Perhatian).
            </div>
            <CustomTextfield v-model="p.pengingatPenerima" label="Penerima Pengingat (mis. Ketua Tim KP, kepala unit)" :maxLength="2000" :disabled="!boleh" />
            <CustomTextfield v-model="p.pengingatKanal" label="Kanal (mis. rapat harian, telepon)" :maxLength="100" :disabled="!boleh" />
            <div class="col-span-2 text-xs" :class="p.pengingatLengkap ? 'text-[#027A48]' : 'text-[#B54708]'">{{ p.pengingatLengkap ? "Konfigurasi pengingat lengkap." : "Konfigurasi pengingat belum lengkap." }}</div>
          </div>
          <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
        </div>
      </template>
    </Card>
  </div>
</template>
