<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import {
  AKSI_LIS, koneksiLisMcu, prosesLisMcu, detailBatchLisMcu, daftarBatchLisMcu, ulangBatchLisMcu, hentikanBatchLisMcu, petunjukGalatLis,
  type AksiLis,
} from "@/stores/penunjang/mcu";

// Kirim / kirim ulang / ambil hasil / cek status LIS untuk peserta MCU terpilih (atau semua sesuai filter).
// Batch diproses di server (lab-service) — dialog hanya memantau progres; menutup dialog/peramban tidak menghentikan proses.
const props = defineProps<{
  aksi: AksiLis | null;
  pesertaUuids?: string[];
  filter?: Record<string, any> | null;
  jumlah: number;
  batchAwal?: string | null; // buka langsung progres batch (dari riwayat)
}>();
const visible = defineModel<boolean>("visible", { default: false });
const emit = defineEmits<{ (e: "selesai"): void }>();
const router = useRouter();

const tahap = ref<"konfirmasi" | "progres" | "riwayat">("konfirmasi");
const koneksi = ref<any[]>([]);
const koneksiUuid = ref<string | null>(null);
const periksaNow = ref(true);
const mengirim = ref(false);
const batch = ref<any>(null);
const ringkasMulai = ref<string>("");
const riwayat = ref<any[]>([]);
let timer: ReturnType<typeof setTimeout> | null = null;

const koneksiDipilih = computed(() => koneksi.value.find((k) => k.uuid === koneksiUuid.value));
const berjalan = computed(() => ["antri", "proses"].includes(batch.value?.status));
const persen = computed(() => (batch.value?.jumlah ? Math.round((batch.value.diproses / batch.value.jumlah) * 100) : 0));
const itemMasalah = computed(() => (batch.value?.items ?? []).filter((i: any) => ["gagal", "tidak_pasti"].includes(i.status)));
const LABEL_ITEM: Record<string, string> = {
  antri: "Antri", proses: "Diproses", terkirim: "Terkirim", gagal: "Gagal", dilewati: "Dilewati", tidak_pasti: "Tidak pasti", diterima: "Hasil diterima", sebagian: "Hasil sebagian",
};
const LABEL_JENIS: Record<string, string> = { kirim: "Kirim", hasil: "Ambil hasil", cek: "Cek status" };

const henti = () => {
  if (timer) clearTimeout(timer);
  timer = null;
};
const pantau = async (uuid: string) => {
  henti();
  const res = await detailBatchLisMcu(uuid);
  if (res?.payload) batch.value = res.payload;
  if (berjalan.value && visible.value) timer = setTimeout(() => pantau(uuid), 1500);
  else emit("selesai");
};

const buka = async () => {
  henti();
  batch.value = null;
  ringkasMulai.value = "";
  if (props.batchAwal) {
    tahap.value = "progres";
    return pantau(props.batchAwal);
  }
  if (!props.aksi) {
    tahap.value = "riwayat";
    return muatRiwayat();
  }
  tahap.value = "konfirmasi";
  periksaNow.value = true;
  koneksi.value = (await koneksiLisMcu())?.payload ?? [];
  koneksiUuid.value = (koneksi.value.find((k) => k.bawaan) ?? koneksi.value[0])?.uuid ?? null;
};
watch(visible, (v) => (v ? buka() : henti()));
onBeforeUnmount(henti);

const mulai = async () => {
  if (!props.aksi) return;
  mengirim.value = true;
  const res = await prosesLisMcu({
    aksi: props.aksi,
    ...(props.pesertaUuids?.length ? { pesertaUuids: props.pesertaUuids } : { filter: props.filter ?? {} }),
    koneksiUuid: koneksiUuid.value,
    periksaNow: periksaNow.value,
  });
  mengirim.value = false;
  if (!res) return;
  ringkasMulai.value = res.message ?? "";
  if (!res.payload?.batch) {
    // aksi tanpa batch (tandai belum terdaftar)
    emit("selesai");
    visible.value = false;
    return;
  }
  tahap.value = "progres";
  pantau(res.payload.batch.uuid);
};

const ulangBatch = async () => {
  const res = await ulangBatchLisMcu(batch.value.uuid);
  if (res?.payload?.uuid) {
    ringkasMulai.value = res.message ?? "";
    pantau(res.payload.uuid);
  }
};
const hentikan = async () => {
  if (!window.confirm("Hentikan batch? Order yang sedang dikirim tetap diselesaikan; sisanya tidak dikirim.")) return;
  await hentikanBatchLisMcu(batch.value.uuid);
  pantau(batch.value.uuid);
};
const muatRiwayat = async () => {
  riwayat.value = (await daftarBatchLisMcu({ limit: 20 }))?.payload ?? [];
};
const bukaBatch = (b: any) => {
  tahap.value = "progres";
  pantau(b.uuid);
};
const keMapping = (rute: string) => {
  visible.value = false;
  router.push(rute);
};
const waktu = (t?: number | string | null) => (t ? new Date(Number(t) * 1000).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "-");
</script>

<template>
  <CustomDialog v-model:visible="visible" width="860px">
    <template #header>
      {{ tahap === "riwayat" ? "Riwayat Kirim LIS" : tahap === "konfirmasi" && aksi ? AKSI_LIS[aksi].label : batch?.judul ?? "Proses LIS" }}
    </template>
    <template #body>
      <div class="flex flex-col gap-3 pt-4 text-sm" data-uji="dialog-lis">
        <!-- Konfirmasi -->
        <template v-if="tahap === 'konfirmasi' && aksi">
          <div class="p-3 rounded bg-opensimrs-50">
            <b>{{ jumlah }} peserta</b> {{ pesertaUuids?.length ? "terpilih" : "sesuai filter daftar saat ini" }}. {{ AKSI_LIS[aksi].ket }}
          </div>
          <div v-if="aksi === 'kirim' || aksi === 'ulang'" class="grid grid-cols-2 gap-3">
            <label class="flex flex-col gap-1">LIS tujuan
              <Select v-model="koneksiUuid" :options="koneksi" optionLabel="nama" optionValue="uuid" placeholder="Belum ada koneksi LIS aktif" />
            </label>
            <div v-if="koneksiDipilih" class="flex flex-col justify-end text-xs text-grey-400">
              Mode {{ koneksiDipilih.modeKirim === "bulk" ? `bulk (maks. ${koneksiDipilih.ukuranBatch} peserta per request, dikelompokkan per perusahaan)` : `per order (${koneksiDipilih.maksParalel} request bersamaan)` }}
            </div>
            <label v-if="koneksiDipilih?.modeKirim === 'bulk'" class="flex items-center col-span-2 gap-2">
              <Checkbox v-model="periksaNow" binary data-uji="periksa-now" /> Periksa sekarang (periksa_now) — order langsung masuk antrean pemeriksaan di LIS
            </label>
            <div v-if="!koneksi.length" class="col-span-2 p-2 rounded bg-[#FDE2E1] text-[#B42318]">Belum ada koneksi LIS aktif. Atur di Setting › Konfigurasi Integrasi › LIS.</div>
          </div>
          <div v-if="aksi === 'tandai'" class="p-2 rounded bg-[#FEF0C7] text-[#B54708] text-xs">
            Pastikan di aplikasi LIS bahwa order peserta ini memang tidak ada. Bila ternyata sudah ada, mengirim ulang akan membuat registrasi ganda di LIS.
          </div>
          <div class="text-xs text-grey-400">
            Proses berjalan di server: Anda boleh menutup dialog atau peramban. Satu order tidak pernah dikirim dua kali walau tombol ditekan berulang atau
            petugas lain mengirim bersamaan.
          </div>
        </template>

        <!-- Progres batch -->
        <template v-else-if="tahap === 'progres'">
          <div v-if="ringkasMulai" class="text-xs text-grey-400">{{ ringkasMulai }}</div>
          <div v-if="!batch" class="py-6 text-center text-grey-400">Memuat…</div>
          <template v-else>
            <div class="flex items-center justify-between">
              <div>
                <b>{{ batch.diproses }}/{{ batch.jumlah }}</b> diproses ·
                <span class="text-[#027A48]">{{ batch.berhasil }} berhasil</span> ·
                <span class="text-[#B42318]">{{ batch.gagal }} gagal</span> ·
                <span>{{ batch.dilewati }} dilewati</span>
                <span v-if="batch.tidakPasti" class="text-[#B54708]"> · {{ batch.tidakPasti }} tidak pasti</span>
              </div>
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold" :class="berjalan ? 'bg-[#D1E9FF] text-[#175CD3]' : batch.status === 'selesai' ? 'bg-[#D1FADF] text-[#027A48]' : 'bg-[#EAECF0] text-[#475467]'">
                {{ berjalan ? "Berjalan" : batch.status === "selesai" ? "Selesai" : "Dihentikan" }}
              </span>
            </div>
            <div class="w-full h-2.5 overflow-hidden rounded-full bg-grey-100" role="progressbar" :aria-valuenow="persen" aria-valuemin="0" aria-valuemax="100">
              <div class="h-full transition-all duration-500 rounded-full bg-opensimrs-300" :style="{ width: `${persen}%` }" />
            </div>
            <div class="text-xs text-grey-400">
              {{ LABEL_JENIS[batch.jenis] }}{{ batch.lis ? ` · ${batch.lis}` : "" }}{{ batch.modeKirim ? ` · mode ${batch.modeKirim === "bulk" ? "bulk" : "per order"}` : "" }} · oleh {{ batch.dibuatOleh }} · {{ waktu(batch.createdAt) }}
            </div>
            <div v-if="batch.pesan" class="text-xs text-[#B42318]">{{ batch.pesan }}</div>
            <div v-if="itemMasalah.length" class="overflow-auto border rounded max-h-[340px] border-grey-100">
              <table class="w-full text-xs">
                <thead class="sticky top-0 bg-opensimrs-50">
                  <tr><th class="p-2 text-left">Peserta</th><th class="p-2 text-left">Status</th><th class="p-2 text-left">Alasan &amp; perbaikan</th></tr>
                </thead>
                <tbody>
                  <tr v-for="i in itemMasalah" :key="i.orderLabUuid" class="border-t border-grey-100 align-top">
                    <td class="p-2">
                      <div class="font-semibold">{{ i.namaPasien }}</div>
                      <div class="text-grey-400">{{ i.noMcu ?? "-" }} · {{ i.noOrder }}</div>
                    </td>
                    <td class="p-2" :class="i.status === 'gagal' ? 'text-[#B42318]' : 'text-[#B54708]'">{{ LABEL_ITEM[i.status] ?? i.status }}</td>
                    <td class="p-2">
                      <div>{{ i.pesan }}</div>
                      <div v-if="petunjukGalatLis(i.pesan)" class="mt-1 text-grey-400">
                        {{ petunjukGalatLis(i.pesan)!.teks }}
                        <a v-if="petunjukGalatLis(i.pesan)!.rute" class="underline cursor-pointer text-opensimrs-300" @click="keMapping(petunjukGalatLis(i.pesan)!.rute!)">
                          Buka {{ petunjukGalatLis(i.pesan)!.label }}
                        </a>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else-if="!berjalan" class="p-2 text-xs rounded bg-[#D1FADF] text-[#027A48]">Tidak ada peserta yang gagal pada batch ini.</div>
          </template>
        </template>

        <!-- Riwayat -->
        <template v-else-if="tahap === 'riwayat'">
          <div class="overflow-auto border rounded max-h-[420px] border-grey-100">
            <table class="w-full text-xs">
              <thead class="sticky top-0 bg-opensimrs-50">
                <tr><th class="p-2 text-left">Waktu</th><th class="p-2 text-left">Batch</th><th class="p-2 text-left">Hasil</th><th class="p-2"></th></tr>
              </thead>
              <tbody>
                <tr v-for="b in riwayat" :key="b.uuid" class="border-t border-grey-100">
                  <td class="p-2 whitespace-nowrap">{{ waktu(b.createdAt) }}<div class="text-grey-400">{{ b.dibuatOleh }}</div></td>
                  <td class="p-2">{{ b.judul ?? LABEL_JENIS[b.jenis] }}<div class="text-grey-400">{{ LABEL_JENIS[b.jenis] }}{{ b.lis ? ` · ${b.lis}` : "" }}{{ b.modeKirim ? ` · ${b.modeKirim === "bulk" ? "bulk" : "per order"}` : "" }}</div></td>
                  <td class="p-2">
                    {{ b.berhasil }} berhasil · {{ b.gagal }} gagal · {{ b.dilewati }} dilewati<span v-if="b.tidakPasti"> · {{ b.tidakPasti }} tidak pasti</span>
                    <div class="text-grey-400">{{ ["antri", "proses"].includes(b.status) ? `Berjalan ${b.diproses}/${b.jumlah}` : b.status === "selesai" ? "Selesai" : "Dihentikan" }}</div>
                  </td>
                  <td class="p-2 text-right"><Button size="small" text label="Lihat" @click="bukaBatch(b)" /></td>
                </tr>
                <tr v-if="!riwayat.length"><td colspan="4" class="p-4 text-center text-grey-400">Belum ada riwayat kirim LIS</td></tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-between w-full gap-2">
        <CustomButton v-if="tahap === 'progres'" label="Riwayat" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="tahap = 'riwayat'; muatRiwayat()" />
        <span v-else />
        <div class="flex gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="visible = false" />
          <CustomButton v-if="tahap === 'konfirmasi' && aksi" :label="AKSI_LIS[aksi].label" :loading="mengirim"
            :disabled="mengirim || ((aksi === 'kirim' || aksi === 'ulang') && !koneksiUuid)" data-uji="mulai-lis" @click="mulai" />
          <template v-if="tahap === 'progres' && batch">
            <CustomButton v-if="berjalan" label="Hentikan" outlined borderColor="border-[#B42318]" textColor="text-[#B42318]" @click="hentikan" />
            <CustomButton v-else-if="batch.jenis === 'kirim' && batch.gagal" label="Kirim Ulang yang Gagal" icon="PhArrowClockwise" data-uji="ulang-batch" @click="ulangBatch" />
            <CustomButton v-else-if="batch.jenis === 'hasil' && batch.gagal" label="Ambil Ulang yang Gagal" icon="PhArrowClockwise" @click="ulangBatch" />
          </template>
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
