<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import DialogJadwalRadiologi from "./Komponen/DialogJadwalRadiologi.vue";
import { utilsStore } from "@/stores/utils";
import {
  MODALITAS_RAD,
  PELAYANAN_RAD,
  STATUS_JADWAL_RAD,
  SUMBER_RAD,
  batalJadwalRad,
  hadirJadwalRad,
  keTanggal,
  menungguJadwalRad,
  noAntreanRad,
  papanJadwalRad,
  umurRad,
  waktuRad,
} from "@/stores/penunjang/radiologi";
import { createDaftarJadwalRadPdf, createSlipJadwalRadPdf } from "@/utils/pdf/pdfRadiologi/cetakRadiologi";

// Penjadwalan Pemeriksaan Radiologi: papan slot per ruang/alat pada satu tanggal, daftar order tervalidasi yang
// menunggu jadwal, check-in (hadir → nomor antrean ruang), ubah/batal jadwal, cetak slip & daftar jadwal.
const storeUtils = utilsStore();
const route = useRoute();
const router = useRouter();

const dariIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const tanggal = ref<Date>(route.query.tanggal ? dariIso(String(route.query.tanggal)) : new Date());
const filterModalitas = ref<string[]>([]);
const cari = ref("");
const papan = ref<any[]>([]);
const hari = ref("");
const menunggu = ref<any[]>([]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const [p, m] = await Promise.all([papanJadwalRad(keTanggal(tanggal.value), filterModalitas.value), menungguJadwalRad(cari.value)]);
    papan.value = p?.payload?.ruang ?? [];
    hari.value = p?.payload?.hari ?? "";
    menunggu.value = m?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
const geser = (n: number) => {
  const d = new Date(tanggal.value);
  d.setDate(d.getDate() + n);
  tanggal.value = d;
  muat();
};
const keHariIni = () => {
  tanggal.value = new Date();
  muat();
};
const toggleModalitas = (kode: string) => {
  filterModalitas.value = filterModalitas.value.includes(kode) ? filterModalitas.value.filter((m) => m !== kode) : [...filterModalitas.value, kode];
};

const ringkas = computed(() => ({
  ruang: papan.value.length,
  terisi: papan.value.reduce((n, r) => n + r.terisi, 0),
  tersedia: papan.value.reduce((n, r) => n + r.tersedia, 0),
  hadir: papan.value.reduce((n, r) => n + r.slot.filter((s: any) => s.jadwal?.status === "hadir").length, 0),
}));
const cocokCari = (j: any) => {
  const q = cari.value.trim().toLowerCase();
  return !q || [j.namaPasien, j.noRm, j.noOrder].some((x) => String(x ?? "").toLowerCase().includes(q));
};
// Satu jadwal dapat memenuhi lebih dari satu slot (mis. durasi diubah); tampilkan sekali di slot pertamanya.
const slotTampil = (r: any) =>
  r.slot.map((s: any, n: number) => ({ ...s, lanjutan: !!s.jadwal && n > 0 && r.slot[n - 1].jadwal?.uuid === s.jadwal.uuid }));

// ── Dialog jadwalkan / ubah
const dialogJadwal = ref(false);
const orderDialog = ref<any>(null);
const jadwalDialog = ref<any>(null);
const awalDialog = ref<any>(null);
const jadwalkanOrder = (o: any) => {
  orderDialog.value = o;
  jadwalDialog.value = null;
  awalDialog.value = { tanggal: keTanggal(tanggal.value) };
  dialogJadwal.value = true;
};
const klikSlotKosong = (r: any, s: any) => {
  if (s.lewat) return;
  orderDialog.value = null;
  jadwalDialog.value = null;
  awalDialog.value = { ruangUuid: r.uuid, tanggal: keTanggal(tanggal.value), jamMulai: s.jamMulai };
  dialogJadwal.value = true;
};
const ubahJadwal = (j: any) => {
  dialogDetail.value = false;
  orderDialog.value = null;
  awalDialog.value = null;
  jadwalDialog.value = j;
  dialogJadwal.value = true;
};
const tersimpan = (j: any) => {
  if (j?.tanggal && j.tanggal !== keTanggal(tanggal.value)) tanggal.value = dariIso(j.tanggal);
  muat();
};

// ── Detail jadwal (hadir / ubah / batal / cetak)
const dialogDetail = ref(false);
const detail = ref<any>(null);
const bukaDetail = (j: any) => {
  detail.value = j;
  dialogDetail.value = true;
};
const hadir = async (j: any) => {
  const res = await hadirJadwalRad(j.uuid);
  if (res?.payload) {
    detail.value = res.payload;
    muat();
  }
};
const dialogBatal = ref(false);
const alasan = ref("");
const batal = async () => {
  if (!alasan.value.trim()) return;
  const res = await batalJadwalRad(detail.value.uuid, alasan.value.trim());
  if (res) {
    dialogBatal.value = false;
    dialogDetail.value = false;
    muat();
  }
};
const keWorklist = (j: any) => router.push({ path: "/radiologi/pemeriksaan", query: { ruang: j.ruangUuid, jadwal: "hari_ini" } });
const cetakDaftar = () => createDaftarJadwalRadPdf(keTanggal(tanggal.value), papan.value);
const hariIniIso = computed(() => keTanggal(new Date()));
const JK: Record<string, string> = { Male: "L", Female: "P" };

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-hidden" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Penjadwalan Pemeriksaan</h1>
          <CustomButton icon="PhCaretLeft" @click="geser(-1)" />
          <CustomDatePicker v-model="tanggal" label="Tanggal" class="toolbar-field--date" @date-select="muat" />
          <CustomButton icon="PhCaretRight" @click="geser(1)" />
          <CustomButton label="Hari ini" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="keHariIni" />
          <ToolbarFilterMenu :count="filterModalitas.length">
            <template #label>Modalitas</template>
            <CustomChip
              v-for="(nama, kode) in MODALITAS_RAD"
              :key="kode"
              :label="`${kode} — ${nama}`"
              :value="String(kode)"
              :isSelected="filterModalitas.includes(String(kode))"
              @selected="toggleModalitas"
            />
          </ToolbarFilterMenu>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM / No. Order" :maxLength="100" @keydown.enter="muat" />
          <CustomButton icon="PhPrinter" label="Cetak Jadwal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetakDaftar" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="grid h-full grid-cols-1 gap-3 p-3 overflow-hidden xl:grid-cols-[1fr_320px]">
          <!-- Papan slot per ruang -->
          <section class="flex flex-col overflow-hidden border rounded-lg border-grey-100">
            <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-grey-100">
              <h2 class="text-sm font-semibold">{{ hari }}, {{ waktuRad(tanggal.getTime() / 1000, true) }}</h2>
              <div class="flex flex-wrap gap-3 text-xs text-grey-500">
                <span>{{ ringkas.ruang }} ruang · terisi <b>{{ ringkas.terisi }}</b> · kosong <b>{{ ringkas.tersedia }}</b> · hadir <b>{{ ringkas.hadir }}</b></span>
                <span v-for="(s, k) in STATUS_JADWAL_RAD" v-show="k !== 'batal'" :key="k" class="inline-flex items-center gap-1">
                  <i class="w-3 h-3 border rounded" :class="s.sel" />{{ s.label }}
                </span>
              </div>
            </div>
            <div v-if="!papan.length" class="p-8 text-sm text-center text-grey-400">
              Belum ada ruang radiologi aktif{{ filterModalitas.length ? " untuk modalitas terpilih" : "" }}. Tambahkan di Datamaster › Ruang &amp; Alat.
            </div>
            <div v-else class="flex gap-3 p-3 overflow-auto grow">
              <div v-for="r in papan" :key="r.uuid" class="flex flex-col flex-none w-[210px] border rounded-lg border-grey-75 bg-white">
                <div class="px-2 py-1.5 rounded-t-lg bg-opensimrs-50">
                  <div class="text-sm font-semibold truncate" :title="r.nama">{{ r.nama }}</div>
                  <div class="text-[10px] text-grey-500 truncate" :title="r.namaAlat">{{ r.modalitas.join("/") }} · {{ r.namaAlat || "-" }}</div>
                  <div class="text-[10px] text-grey-500">
                    {{ r.jamBuka }}–{{ r.jamTutup }} · {{ r.durasiSlot }} mnt ·
                    <span :class="r.tersedia ? 'text-success-400' : 'text-danger-300'">{{ r.tersedia }} kosong</span>
                  </div>
                </div>
                <div v-if="!r.buka" class="p-4 text-xs text-center text-grey-400">Tutup pada hari {{ hari }}</div>
                <div v-else class="flex flex-col gap-1 p-1.5 overflow-auto max-h-[calc(100vh-290px)]">
                  <template v-for="s in slotTampil(r)" :key="s.jamMulai">
                    <button
                      v-if="s.jadwal && !s.lanjutan"
                      type="button"
                      class="px-2 py-1 text-left border rounded text-[11px]"
                      :class="[STATUS_JADWAL_RAD[s.jadwal.status as keyof typeof STATUS_JADWAL_RAD]?.sel, cocokCari(s.jadwal) ? '' : 'opacity-30']"
                      @click="bukaDetail(s.jadwal)"
                    >
                      <div class="flex justify-between gap-1">
                        <b>{{ s.jadwal.jamMulai }}</b>
                        <span v-if="s.jadwal.noAntrean" class="font-semibold">#{{ s.jadwal.noAntrean }}</span>
                        <span v-if="s.jadwal.cito" class="px-1 text-[9px] font-bold text-white rounded bg-danger-300">CITO</span>
                      </div>
                      <div class="font-semibold truncate">{{ s.jadwal.namaPasien }}</div>
                      <div class="truncate text-grey-500">{{ s.jadwal.items.map((i: any) => i.nama).join(", ") }}</div>
                    </button>
                    <button
                      v-else-if="!s.jadwal"
                      type="button"
                      class="px-2 py-0.5 text-left border border-dashed rounded text-[11px]"
                      :class="s.lewat ? 'border-grey-75 text-grey-200 cursor-default' : 'border-grey-200 text-grey-400 hover:bg-opensimrs-50'"
                      :title="s.lewat ? 'Sudah lewat' : 'Klik untuk menjadwalkan'"
                      @click="klikSlotKosong(r, s)"
                    >
                      {{ s.jamMulai }} <span class="float-right">{{ s.lewat ? "lewat" : "kosong" }}</span>
                    </button>
                  </template>
                  <button
                    v-for="j in r.diLuarSlot"
                    :key="j.uuid"
                    type="button"
                    class="px-2 py-1 text-left border rounded text-[11px] border-warning-75 bg-warning-50"
                    title="Di luar slot jam operasional saat ini"
                    @click="bukaDetail(j)"
                  >
                    <b>{{ j.jamMulai }}</b> · {{ j.namaPasien }}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- Menunggu jadwal -->
          <section class="flex flex-col overflow-hidden border rounded-lg border-grey-100">
            <h2 class="px-3 py-2 text-sm font-semibold border-b border-grey-100">Menunggu jadwal ({{ menunggu.length }})</h2>
            <div v-if="!menunggu.length" class="p-4 text-xs text-center text-grey-400">
              Semua order tervalidasi sudah dijadwalkan. Order yang belum divalidasi ada di menu Order Radiologi.
            </div>
            <ul v-else class="overflow-auto divide-y grow divide-grey-75">
              <li v-for="o in menunggu" :key="o.uuid" class="flex flex-col gap-1 px-3 py-2 text-xs">
                <div class="flex items-center justify-between gap-2">
                  <div class="font-semibold">
                    <span v-if="o.cito" class="px-1 mr-1 text-[9px] font-bold text-white rounded bg-danger-300">CITO</span>{{ o.namaPasien }}
                  </div>
                  <span class="text-grey-400">{{ JK[o.gender] ?? "-" }} · {{ umurRad(o.birthDate) }}</span>
                </div>
                <div class="text-grey-500">{{ o.noOrder }} · {{ o.noRm }} · {{ o.sumber === o.pelayanan ? SUMBER_RAD[o.sumber] : `${SUMBER_RAD[o.sumber]} ${PELAYANAN_RAD[o.pelayanan] ?? ""}` }}</div>
                <div>{{ o.items.map((i: any) => `${i.nama} (${i.modalitas})`).join(", ") }}</div>
                <div class="flex justify-end">
                  <CustomButton label="Jadwalkan" icon="PhCalendarPlus" size="small" @click="jadwalkanOrder(o)" />
                </div>
              </li>
            </ul>
          </section>
        </div>
      </template>
    </Card>

    <DialogJadwalRadiologi v-model:visible="dialogJadwal" :order="orderDialog" :jadwal="jadwalDialog" :awal="awalDialog" @tersimpan="tersimpan" />

    <!-- Detail jadwal -->
    <CustomDialog v-model:visible="dialogDetail" width="560px">
      <template #header>Jadwal {{ detail?.noOrder }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-3 pt-4 text-sm">
          <div class="grid grid-cols-[110px_1fr] gap-y-1">
            <span class="text-grey-400">Pasien</span><span><b>{{ detail.namaPasien }}</b> ({{ detail.noRm }}) · {{ JK[detail.gender] ?? "-" }} · {{ umurRad(detail.birthDate) }}</span>
            <span class="text-grey-400">Ruang</span><span>{{ detail.ruang }} <span class="text-grey-400">{{ detail.namaAlat }}</span></span>
            <span class="text-grey-400">Waktu</span><span>{{ detail.tanggal }} · {{ detail.jamMulai }}–{{ detail.jamSelesai }}<span v-if="detail.segera" class="ml-1 text-danger-300">(segera)</span></span>
            <span class="text-grey-400">Status</span>
            <span>
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold" :class="[STATUS_JADWAL_RAD[detail.status as keyof typeof STATUS_JADWAL_RAD]?.bg, STATUS_JADWAL_RAD[detail.status as keyof typeof STATUS_JADWAL_RAD]?.text]">
                {{ STATUS_JADWAL_RAD[detail.status as keyof typeof STATUS_JADWAL_RAD]?.label }}
              </span>
              <span v-if="detail.noAntrean" class="ml-2">Antrean <b>{{ noAntreanRad(detail.ruangKode, detail.noAntrean) }}</b> · hadir {{ waktuRad(detail.waktuHadir) }}</span>
            </span>
            <span class="text-grey-400">Pemeriksaan</span><span>{{ detail.items.map((i: any) => i.nama).join(", ") || "-" }}</span>
            <span class="text-grey-400">Klinis</span><span>{{ detail.klinis || "-" }}</span>
            <template v-if="detail.catatan"><span class="text-grey-400">Catatan</span><span>{{ detail.catatan }}</span></template>
          </div>
          <div v-if="detail.status === 'terjadwal' && detail.tanggal !== hariIniIso" class="text-xs text-grey-400">
            Tombol Hadir aktif pada hari pemeriksaan. Bila pasien datang di hari lain, ubah jadwal terlebih dahulu.
          </div>
        </div>
      </template>
      <template #footer>
        <div v-if="detail" class="flex flex-wrap justify-end gap-2">
          <CustomButton
            v-if="['terjadwal', 'hadir'].includes(detail.status)"
            label="Batalkan"
            icon="PhXCircle"
            outlined
            borderColor="border-danger-300"
            textColor="text-danger-300"
            @click="(alasan = ''), (dialogBatal = true)"
          />
          <CustomButton v-if="['terjadwal', 'hadir'].includes(detail.status)" label="Ubah" icon="PhPencilSimple" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="ubahJadwal(detail)" />
          <CustomButton label="Cetak Slip" icon="PhPrinter" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="createSlipJadwalRadPdf(detail)" />
          <CustomButton v-if="detail.status === 'hadir'" label="Ke Worklist" icon="PhScan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="keWorklist(detail)" />
          <CustomButton v-if="detail.status === 'terjadwal' && detail.tanggal === hariIniIso" label="Pasien Hadir" icon="PhUserCheck" @click="hadir(detail)" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogBatal" width="440px" headerBg="bg-danger-300">
      <template #header>Batalkan Jadwal</template>
      <template #body>
        <div class="flex flex-col gap-2 pt-4">
          <div class="text-sm text-grey-400">Slot kembali tersedia dan pemeriksaan kembali ke daftar menunggu jadwal (order tidak dibatalkan).</div>
          <CustomTextArea v-model="alasan" label="Alasan" placeholder="mis. pasien tidak datang / minta dijadwal ulang" required />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Kembali" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBatal = false" />
          <CustomButton label="Batalkan Jadwal" backgroundColor="bg-danger-300" :disabled="!alasan.trim()" @click="batal" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
