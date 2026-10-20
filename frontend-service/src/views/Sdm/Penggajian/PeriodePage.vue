<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import FormulirData, { type KolomGaji } from "./FormulirData.vue";
import { bacaGaji, izinGaji, nominalGaji, statusGaji, opsiGaji, periodeGaji, kelasLencanaGaji, masaGaji, OPSI_BULAN, bacaSumberJaspel } from "@/stores/penunjang/penggajian";

// Periode penggajian (STD-0041): daftar periode bulanan dan pembukaan periode draf dari konfigurasi disahkan serta
// periode Remunerasi (jasa pelayanan) yang sudah disetujui.
const router = useRouter();
const data = ref<any[]>([]), page = ref(1), total = ref(0), tahun = ref(""), status = ref(""), memuat = ref(false);
const konfigurasi = ref<any[]>([]), remunerasi = ref<any[]>([]);
const OPSI_STATUS = opsiGaji(statusGaji);
const muat = async () => {
  memuat.value = true;
  try {
    const r = await bacaGaji("/periode", { page: page.value, tahun: tahun.value, status: status.value });
    data.value = r?.payload?.data ?? []; total.value = r?.payload?.pagination?.total ?? 0;
  } finally { memuat.value = false; }
};
const cariUlang = () => { page.value = 1; muat(); };
const gantiHalaman = (e: { page: number }) => { page.value = e.page + 1; muat(); };
// Pilihan pembukaan periode dimuat sesuai izin agar tidak memicu galat 403.
const muatPilihan = async () => {
  if (!izinGaji("periode", "CREATE")) return;
  if (izinGaji("konfigurasi")) konfigurasi.value = ((await bacaGaji("/konfigurasi", { limit: 200 }))?.payload?.data ?? []).filter((r: any) => r.status === "disahkan");
  remunerasi.value = ((await bacaSumberJaspel())?.payload ?? []).filter((r: any) => !r.dipakaiPeriodeUuid);
};
const kolomBuka = computed<KolomGaji[]>(() => [
  { nama: "tahun", label: "Tahun", jenis: "angka", min: 2000, max: 2200, contoh: String(new Date().getFullYear()) },
  { nama: "bulan", label: "Bulan", pilihan: OPSI_BULAN.map((b) => ({ value: b.value, label: b.label })) },
  { nama: "konfigurasiUuid", label: "Konfigurasi disahkan", lebar: true, pilihan: konfigurasi.value.map((r) => ({ value: r.uuid, label: `Versi ${r.versi} · ${masaGaji(r)}` })),
    bantuan: konfigurasi.value.length ? "Konfigurasi harus berlaku sepanjang bulan periode." : "Belum ada konfigurasi disahkan, atau Anda tidak memiliki izin membaca Konfigurasi Penggajian." },
  { nama: "remunerasiPeriodeUuid", label: "Periode Remunerasi (jasa pelayanan) disetujui", lebar: true,
    pilihan: remunerasi.value.map((r) => ({ value: r.uuid, label: `${periodeGaji(r.tahun, r.bulan)}${r.nomor ? ` · ${r.nomor}` : ""} · ${nominalGaji(r.total)}` })),
    bantuan: remunerasi.value.length ? "Bulan Remunerasi harus sama dengan bulan periode gaji." : "Belum ada periode Remunerasi yang disetujui, berjurnal, dan belum dipakai periode gaji lain." },
]);
const bukaRincian = (r: any) => router.push(`/sdm/penggajian/periode/${r.uuid}`);
onMounted(() => { muat(); muatPilihan(); });
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" :disabled="memuat" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Periode Penggajian</h1>
          <CustomTextfield v-model="tahun" label="Tahun" type="number" placeholder="Semua tahun" :maxLength="4" @keydown.enter="cariUlang" />
          <CustomSelect v-model="status" label="Status" placeHolder="Semua status" :options="OPSI_STATUS" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariUlang" />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="cariUlang" />
          <FormulirData judul="Buka Periode Bulanan" label-tombol="Buka Periode" path="/periode" :boleh="izinGaji('periode', 'CREATE')" :kolom="kolomBuka"
            keterangan="Periode dibuka sebagai draf. Penghitungan memerlukan kebijakan melewati Kehadiran yang disahkan dan sumber jasa pelayanan final dari Remunerasi." @tersimpan="(p: any) => (p?.uuid ? bukaRincian(p) : muat())" />
        </PageToolbar>
      </template>

      <template #content>
        <div class="flex flex-col gap-4 pt-4">
          <p class="px-3 py-2 text-xs rounded-lg bg-info-50 text-info-400">Kehadiran belum tersedia. Penghitungan memerlukan kebijakan melewati Kehadiran yang disahkan dan sumber jasa pelayanan final dari Remunerasi.</p>
          <NoData v-if="!data.length" title="Belum ada periode yang dapat ditampilkan" class="min-h-[240px]" />
          <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable tableStyle="min-width: 56rem" @rowClick="bukaRincian($event.data)">
            <Column header="Periode" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span class="font-semibold text-opensimrs-300">{{ periodeGaji(r.tahun, r.bulan) }}</span></template></Column>
            <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span :class="kelasLencanaGaji(r.status)">{{ statusGaji[r.status] ?? r.status }}</span></template></Column>
            <Column header="Pegawai" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ r.jumlahPegawai ?? 0 }}</template></Column>
            <Column header="Pengecualian" headerClass="bg-opensimrs-50">
              <template #body="{ data: r }"><span :class="r.jumlahPengecualian > 0 ? 'font-semibold text-danger-400' : ''">{{ r.jumlahPengecualian ?? 0 }}</span></template>
            </Column>
            <Column header="Bruto" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ nominalGaji(r.bruto) }}</template></Column>
            <Column header="Potongan" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ nominalGaji(r.potongan) }}</template></Column>
            <Column header="Bersih" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span class="font-semibold">{{ nominalGaji(r.bersih) }}</span></template></Column>
            <Column header="Versi" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ r.versi }}</template></Column>
          </DataTable>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :totalRecords="total" :rows="20" :rowsPerPageOptions="[20]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>
  </div>
</template>
