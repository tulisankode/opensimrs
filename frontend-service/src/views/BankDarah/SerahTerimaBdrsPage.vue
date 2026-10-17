<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  JK_BDRS,
  STATUS_SERAH_TERIMA_BDRS,
  batalSerahTerimaBdrs,
  buatSerahTerimaBdrs,
  daftarPermintaanBdrs,
  daftarSerahTerimaBdrs,
  detailPermintaanBdrs,
  detailSerahTerimaBdrs,
  gayaPermintaanBdrs,
  gayaSerahTerimaBdrs,
  gayaTagihanStBdrs,
  golonganRh,
  izinBdrs,
  kirimUlangTagihanSerahTerimaBdrs,
  konfirmasiSerahTerimaBdrs,
  opsi,
  umurBdrs,
  waktuBdrs,
} from "@/stores/penunjang/bankDarah";

// Serah Terima kantong ke ruangan: transaksi dibuat dari permintaan dengan memilih kantong yang kompatibel & berlaku
// (kantong langsung dikunci "dialokasikan"), lalu wajib dikonfirmasi dua akun berbeda — penyerah (BDRS) & penerima
// (ruangan) — setelah memverifikasi identitas pasien & nomor kantong. Stok berkurang saat kedua konfirmasi lengkap;
// biaya pengolahan/crossmatch dikirim ke tagihan kunjungan (dapat dikirim ulang bila gagal).
const storeUtils = utilsStore();
const bolehPenyerah = izinBdrs("Serah Terima", "KONFIRMASI PENYERAH");
const bolehPenerima = izinBdrs("Serah Terima", "KONFIRMASI PENERIMA");
const tab = ref("siap");

// ── Permintaan siap diserahkan
const siap = ref<any[]>([]);
const muatSiap = async () => {
  siap.value = (await daftarPermintaanBdrs({ status: ["diproses", "dipenuhi_sebagian"], limit: 100 }))?.payload?.data ?? [];
};

// ── Daftar transaksi
const transaksi = ref<any[]>([]);
const filterStatus = ref("menunggu");
const muatTransaksi = async () => {
  transaksi.value = (await daftarSerahTerimaBdrs({ status: filterStatus.value }))?.payload ?? [];
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    await Promise.all([muatSiap(), muatTransaksi()]);
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);

// ── Buat serah terima dari permintaan
const dialogBuat = ref(false);
const pm = ref<any>(null);
const pilihan = ref<string[]>([]);
const galatBuat = ref("");
// Kantong boleh diserahkan: crossmatch kompatibel, masih berlaku (tidak perlu ditinjau ulang), kantong masih tersedia.
const kantongSiap = computed(() =>
  (pm.value?.crossmatch ?? []).filter((c: any) => c.kompatibel && c.statusValidasi === "berlaku" && c.statusStok === "tersedia" && Number(c.tanggalKedaluwarsa) > Date.now() / 1000),
);
const kantongTidakLayak = computed(() => (pm.value?.crossmatch ?? []).filter((c: any) => !kantongSiap.value.includes(c)));
const sudahDiserahkan = computed(() =>
  (pm.value?.serahTerima ?? []).filter((s: any) => s.status === "selesai").reduce((n: number, s: any) => n + (s.items?.length ?? 0), 0),
);
const sisa = computed(() => Math.max((Number(pm.value?.jumlahDiminta) || 0) - sudahDiserahkan.value, 0));
const adaMenunggu = computed(() => (pm.value?.serahTerima ?? []).some((s: any) => s.status === "menunggu"));

const bukaBuat = async (baris: any) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailPermintaanBdrs(baris.uuid);
    if (!res?.payload) return;
    pm.value = res.payload;
    pilihan.value = [];
    galatBuat.value = "";
    dialogBuat.value = true;
  } finally {
    storeUtils.setLoading(false);
  }
};
const togglePilih = (stokUuid: string) => {
  if (pilihan.value.includes(stokUuid)) pilihan.value = pilihan.value.filter((x) => x !== stokUuid);
  else if (pilihan.value.length < sisa.value) pilihan.value = [...pilihan.value, stokUuid];
};
const simpanBuat = async () => {
  galatBuat.value = "";
  if (!pilihan.value.length) return (galatBuat.value = "Pilih minimal satu kantong kompatibel");
  if (pilihan.value.length > sisa.value) return (galatBuat.value = `Jumlah kantong melebihi sisa permintaan (sisa ${sisa.value})`);
  storeUtils.setLoading(true);
  try {
    const res = await buatSerahTerimaBdrs(pm.value.uuid, pilihan.value);
    if (res?.payload) {
      dialogBuat.value = false;
      tab.value = "transaksi";
      filterStatus.value = "menunggu";
      await Promise.all([muatSiap(), muatTransaksi()]);
      const baris = transaksi.value.find((t: any) => t.uuid === res.payload.uuid);
      bukaDetail(baris ?? { ...res.payload, noPermintaan: pm.value.noPermintaan, namaPasien: pm.value.namaPasien, noRm: pm.value.noRm });
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Detail, konfirmasi, batal, kirim ulang tagihan
const dialogDetail = ref(false);
const st = ref<any>(null);
const info = ref<any>(null);
const cekPasien = ref(false);
const cekKantong = ref(false);
const bukaDetail = async (baris: any) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailSerahTerimaBdrs(baris.uuid);
    if (!res?.payload) return;
    st.value = res.payload;
    info.value = baris;
    cekPasien.value = false;
    cekKantong.value = false;
    dialogDetail.value = true;
  } finally {
    storeUtils.setLoading(false);
  }
};
const perbaruiDetail = (payload: any) => {
  st.value = payload;
  cekPasien.value = false;
  cekKantong.value = false;
  muat();
};
const konfirmasi = async (peran: "penyerah" | "penerima") => {
  if (!cekPasien.value || !cekKantong.value) return;
  storeUtils.setLoading(true);
  try {
    const res = await konfirmasiSerahTerimaBdrs(st.value.uuid, peran, { pasien: cekPasien.value, nomorKantong: cekKantong.value });
    if (res?.payload) perbaruiDetail(res.payload);
  } finally {
    storeUtils.setLoading(false);
  }
};
const kirimUlang = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await kirimUlangTagihanSerahTerimaBdrs(st.value.uuid);
    if (res?.payload) perbaruiDetail(res.payload);
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialogBatal = ref(false);
const alasanBatal = ref("");
const galatBatal = ref("");
const bukaBatal = () => {
  alasanBatal.value = "";
  galatBatal.value = "";
  dialogBatal.value = true;
};
const batal = async () => {
  if (!alasanBatal.value.trim()) return (galatBatal.value = "Alasan pembatalan wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await batalSerahTerimaBdrs(st.value.uuid, alasanBatal.value.trim());
    if (res) {
      dialogBatal.value = false;
      dialogDetail.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Serah Terima Darah</h1>
        </PageToolbar>
      </template>
      <template #content>
        <Tabs :value="tab" class="flex flex-col h-full" @update:value="(v: any) => (tab = v)">
          <TabList>
            <Tab value="siap">Permintaan Siap Diserahkan</Tab>
            <Tab value="transaksi">Transaksi Serah Terima</Tab>
          </TabList>
          <TabPanels class="overflow-auto grow">
            <TabPanel value="siap">
              <NoData v-if="!siap.length" />
              <DataTable v-else :value="siap" stripedRows class="text-xs" tableStyle="min-width: 56rem">
                <Column header="No. Permintaan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <div class="font-semibold">
                      <span v-if="d.cito" class="px-1.5 mr-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>{{ d.noPermintaan }}
                    </div>
                    <div class="text-grey-400">{{ waktuBdrs(d.createdAt) }}</div>
                  </template>
                </Column>
                <Column header="Pasien" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <div class="font-semibold">{{ d.namaPasien }}</div>
                    <div class="text-grey-400">{{ d.noRm }} · {{ d.lokasiAsal ?? "-" }}</div>
                  </template>
                </Column>
                <Column header="Komponen" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.komponenKode }} · {{ golonganRh(d.golonganDiminta, d.rhesusDiminta) }}</template>
                </Column>
                <Column header="Siap / Diminta" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.jumlahDipenuhi ?? 0 }}/{{ d.jumlahDiminta }}</template>
                </Column>
                <Column header="Status" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaPermintaanBdrs(d.status)?.bg, gayaPermintaanBdrs(d.status)?.text]">
                      {{ gayaPermintaanBdrs(d.status)?.label }}
                    </span>
                  </template>
                </Column>
                <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[170px]">
                  <template #body="{ data: d }">
                    <CustomButton v-if="bolehPenyerah" label="Buat Serah Terima" size="small" icon="PhHandshake" @click="bukaBuat(d)" />
                  </template>
                </Column>
              </DataTable>
            </TabPanel>

            <TabPanel value="transaksi">
              <div class="flex items-end gap-2 mb-3">
                <CustomSelect
                  v-model="filterStatus"
                  label="Status"
                  :options="opsi(Object.fromEntries(Object.entries(STATUS_SERAH_TERIMA_BDRS).map(([k, v]) => [k, v.label])))"
                  optionValue="value"
                  optionLabel="label"
                  placeHolder="Semua status"
                  :showFilter="false"
                  class="w-[240px]"
                  @update:modelValue="muatTransaksi"
                />
                <CustomButton icon="PhArrowClockwise" @click="muatTransaksi" />
              </div>
              <NoData v-if="!transaksi.length" />
              <DataTable v-else :value="transaksi" stripedRows class="text-xs cursor-pointer" tableStyle="min-width: 56rem" @rowClick="bukaDetail($event.data)">
                <Column header="Dibuat" headerClass="bg-opensimrs-50">
                  <template #body="{ data: t }">{{ waktuBdrs(t.createdAt) }}</template>
                </Column>
                <Column header="Permintaan / Pasien" headerClass="bg-opensimrs-50">
                  <template #body="{ data: t }">
                    <div class="font-semibold">{{ t.noPermintaan }}</div>
                    <div class="text-grey-400">{{ t.namaPasien }} · {{ t.noRm }}</div>
                  </template>
                </Column>
                <Column header="Penyerah" headerClass="bg-opensimrs-50">
                  <template #body="{ data: t }">
                    {{ t.petugasPenyerah ?? "-" }}
                    <div v-if="t.waktuKonfirmasiPenyerah" class="text-grey-400">{{ waktuBdrs(t.waktuKonfirmasiPenyerah) }}</div>
                  </template>
                </Column>
                <Column header="Penerima" headerClass="bg-opensimrs-50">
                  <template #body="{ data: t }">
                    {{ t.petugasPenerima ?? "-" }}
                    <div v-if="t.waktuKonfirmasiPenerima" class="text-grey-400">{{ waktuBdrs(t.waktuKonfirmasiPenerima) }}</div>
                  </template>
                </Column>
                <Column header="Status" headerClass="bg-opensimrs-50">
                  <template #body="{ data: t }">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaSerahTerimaBdrs(t.status)?.bg, gayaSerahTerimaBdrs(t.status)?.text]">
                      {{ gayaSerahTerimaBdrs(t.status)?.label ?? t.status }}
                    </span>
                  </template>
                </Column>
                <Column header="Tagihan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: t }">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaTagihanStBdrs(t.statusTagihan)?.bg, gayaTagihanStBdrs(t.statusTagihan)?.text]">
                      {{ gayaTagihanStBdrs(t.statusTagihan)?.label ?? t.statusTagihan }}
                    </span>
                  </template>
                </Column>
              </DataTable>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>

    <!-- Buat serah terima -->
    <CustomDialog v-model:visible="dialogBuat" width="760px">
      <template #header>Buat Serah Terima — {{ pm?.noPermintaan }}</template>
      <template #body>
        <div v-if="pm" class="flex flex-col gap-3 pt-4 text-sm">
          <div class="p-3 rounded-lg bg-opensimrs-50">
            <b>{{ pm.namaPasien }}</b> · {{ pm.noRm }} · {{ JK_BDRS[pm.gender] ?? "-" }} · {{ umurBdrs(pm.birthDate) }} · {{ pm.lokasiAsal ?? "-" }}
            <div class="text-grey-400">
              {{ pm.komponenKode }} — {{ pm.komponenNama }} · gol. pasien
              {{ golonganRh(pm.pemeriksaan?.golonganAbo, pm.pemeriksaan?.rhesus) }} · sudah diserahkan {{ sudahDiserahkan }} dari {{ pm.jumlahDiminta }} kantong
            </div>
          </div>
          <div v-if="adaMenunggu" class="px-3 py-2 text-xs rounded-lg bg-[#FEF0C7] text-[#B54708]">
            Masih ada transaksi serah terima yang menunggu konfirmasi untuk permintaan ini.
          </div>
          <div class="font-semibold">Pilih kantong kompatibel (maks. {{ sisa }})</div>
          <NoData v-if="!kantongSiap.length" />
          <div
            v-for="c in kantongSiap"
            :key="c.stokUuid"
            class="flex items-center gap-3 px-3 py-2 border rounded-lg cursor-pointer"
            :class="pilihan.includes(c.stokUuid) ? 'border-opensimrs-300 bg-opensimrs-50' : 'border-grey-75'"
            @click="togglePilih(c.stokUuid)"
          >
            <Checkbox :modelValue="pilihan.includes(c.stokUuid)" binary :disabled="!pilihan.includes(c.stokUuid) && pilihan.length >= sisa" />
            <div class="grow">
              <b>{{ c.noKantong }}</b> · {{ golonganRh(c.golonganAbo, c.rhesus) }}
              <span class="text-grey-400">· kedaluwarsa {{ waktuBdrs(c.tanggalKedaluwarsa, true) }} · crossmatch {{ c.petugas ?? "-" }} {{ waktuBdrs(c.waktuPeriksa) }}</span>
            </div>
            <span class="text-xs font-semibold text-mint-400">Kompatibel</span>
          </div>
          <div v-if="kantongTidakLayak.length" class="text-xs text-grey-400">
            Tidak dapat dipilih:
            <span v-for="c in kantongTidakLayak" :key="c.uuid" class="mr-2">
              {{ c.noKantong }} ({{ !c.kompatibel ? "inkompatibel" : c.statusValidasi !== "berlaku" ? "perlu crossmatch ulang" : c.statusStok }})
            </span>
          </div>
          <div v-if="galatBuat" class="text-sm text-danger-300">{{ galatBuat }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBuat = false" />
          <CustomButton label="Buat Transaksi" icon="PhHandshake" :disabled="!pilihan.length" @click="simpanBuat" />
        </div>
      </template>
    </CustomDialog>

    <!-- Detail serah terima -->
    <CustomDialog v-model:visible="dialogDetail" width="760px">
      <template #header>Serah Terima — {{ info?.noPermintaan }}</template>
      <template #body>
        <div v-if="st" class="flex flex-col gap-3 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Pasien:</span> <b>{{ info?.namaPasien ?? "-" }}</b> ({{ info?.noRm ?? "-" }})</div>
            <div>
              <span class="text-grey-400">Status:</span>
              <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaSerahTerimaBdrs(st.status)?.bg, gayaSerahTerimaBdrs(st.status)?.text]">
                {{ gayaSerahTerimaBdrs(st.status)?.label ?? st.status }}
              </span>
            </div>
            <div><span class="text-grey-400">Penyerah (BDRS):</span> {{ st.petugasPenyerah ?? "belum" }} {{ st.waktuKonfirmasiPenyerah ? `· ${waktuBdrs(st.waktuKonfirmasiPenyerah)}` : "" }}</div>
            <div><span class="text-grey-400">Penerima (ruangan):</span> {{ st.petugasPenerima ?? "belum" }} {{ st.waktuKonfirmasiPenerima ? `· ${waktuBdrs(st.waktuKonfirmasiPenerima)}` : "" }}</div>
            <div>
              <span class="text-grey-400">Tagihan:</span>
              <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaTagihanStBdrs(st.statusTagihan)?.bg, gayaTagihanStBdrs(st.statusTagihan)?.text]">
                {{ gayaTagihanStBdrs(st.statusTagihan)?.label ?? st.statusTagihan }}
              </span>
            </div>
            <div v-if="st.pesanTagihan" class="col-span-2 text-xs text-danger-300">{{ st.pesanTagihan }}</div>
          </div>
          <DataTable :value="st.items" stripedRows class="text-xs">
            <Column field="noKantong" header="No. Kantong" headerClass="bg-opensimrs-50" />
            <Column header="Golongan" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">{{ golonganRh(i.golonganAbo, i.rhesus) }}</template>
            </Column>
          </DataTable>

          <div v-if="st.status === 'menunggu' && (bolehPenyerah || bolehPenerima)" class="flex flex-col gap-2 p-3 border rounded-lg border-opensimrs-300">
            <div class="font-semibold">Verifikasi sebelum konfirmasi</div>
            <label class="flex items-start gap-2">
              <Checkbox v-model="cekPasien" binary />
              <span>Identitas pasien pada label kantong & formulir sesuai: <b>{{ info?.namaPasien ?? "-" }}</b>, No. RM <b>{{ info?.noRm ?? "-" }}</b>.</span>
            </label>
            <label class="flex items-start gap-2">
              <Checkbox v-model="cekKantong" binary />
              <span>Nomor kantong fisik sesuai daftar: <b>{{ (st.items ?? []).map((i: any) => i.noKantong).join(", ") }}</b>.</span>
            </label>
            <div class="text-xs text-grey-400">Penyerah dan penerima harus akun pengguna yang berbeda.</div>
          </div>
        </div>
      </template>
      <template #footer>
        <div v-if="st" class="flex flex-wrap justify-end gap-2">
          <CustomButton
            v-if="st.status === 'menunggu' && bolehPenyerah"
            label="Batalkan"
            icon="PhXCircle"
            outlined
            borderColor="border-danger-300"
            textColor="text-danger-300"
            @click="bukaBatal"
          />
          <CustomButton
            v-if="st.status === 'selesai' && st.statusTagihan !== 'terkirim' && bolehPenyerah"
            label="Kirim Ulang Tagihan"
            icon="PhPaperPlaneTilt"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
            @click="kirimUlang"
          />
          <CustomButton
            v-if="st.status === 'menunggu' && bolehPenyerah && !st.petugasPenyerah"
            label="Konfirmasi Penyerah"
            icon="PhCheck"
            :disabled="!cekPasien || !cekKantong"
            @click="konfirmasi('penyerah')"
          />
          <CustomButton
            v-if="st.status === 'menunggu' && bolehPenerima && !st.petugasPenerima"
            label="Konfirmasi Penerima"
            icon="PhCheckCircle"
            :disabled="!cekPasien || !cekKantong"
            @click="konfirmasi('penerima')"
          />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogBatal" width="460px" headerBg="bg-danger-300">
      <template #header>Batalkan Serah Terima</template>
      <template #body>
        <div class="flex flex-col gap-2 pt-4">
          <div class="text-sm text-grey-400">Kantong pada transaksi ini akan kembali berstatus tersedia.</div>
          <CustomTextArea v-model="alasanBatal" label="Alasan pembatalan" placeholder="mis. ruangan menunda transfusi" required />
          <div v-if="galatBatal" class="text-sm text-danger-300">{{ galatBatal }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Kembali" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBatal = false" />
          <CustomButton label="Batalkan Transaksi" backgroundColor="bg-danger-300" @click="batal" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
