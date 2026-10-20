<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import KonfirmasiGaji from "./KonfirmasiGaji.vue";
import { bacaGaji, simpanGaji, izinGaji, nominalGaji, unduhGaji, periodeGaji, statusGaji, kelasLencanaGaji } from "@/stores/penunjang/penggajian";
import { izinSdm, referensiSdm } from "@/stores/penunjang/sdm";

// Rekap penggajian per unit dan ekspor berkas bank (STD-0041). Rekap resmi dan ekspor hanya untuk periode terkunci
// (disetujui/dibayar); backend membalas 404 bila periode tidak dikirim, jadi rekap baru dimuat setelah periode dipilih.
const route = useRoute();
const periode = ref<any[]>([]), periodeUuid = ref(String(route.query.periode ?? "")), unitUuid = ref(""), formatUuid = ref(""), versiManual = ref("");
const data = ref<any[]>([]), unitRekap = ref<any[]>([]), format = ref<any[]>([]), namaUnit = ref<Record<string, string>>({}), memuat = ref(false), sibuk = ref(false), dialogEkspor = ref(false);
const bolehDaftarPeriode = ["periode", "verifikasi", "persetujuan", "pembayaran", "administratif"].some((s) => izinGaji(s));
const periodeTerpilih = computed(() => periode.value.find((p) => p.uuid === periodeUuid.value));
const versi = computed(() => periodeTerpilih.value?.versi ?? (versiManual.value ? Number(versiManual.value) : null));
const opsiPeriode = computed(() => periode.value.map((p) => ({ value: p.uuid, label: `${periodeGaji(p.tahun, p.bulan)} · ${statusGaji[p.status] ?? p.status} · bersih ${nominalGaji(p.bersih)}` })));
const labelUnit = (u?: string | null) => (u ? namaUnit.value[u] ?? "Unit tidak dikenal" : "Tanpa unit");
const opsiUnit = computed(() => unitRekap.value.filter((r) => r.unitUuid).map((r) => ({ value: r.unitUuid, label: labelUnit(r.unitUuid) })));
const jumlah = computed(() => {
  const sen = (k: string) => data.value.reduce((n, r) => n + BigInt(String(r[k] ?? "0").replace(".", "").replace(/^(-?)0+(?=\d)/, "$1") || "0"), 0n);
  const uang = (n: bigint) => { const a = n < 0n ? -n : n; return `${n < 0n ? "-" : ""}${a / 100n}.${String(a % 100n).padStart(2, "0")}`; };
  return { pegawai: data.value.reduce((n, r) => n + Number(r.jumlahPegawai ?? 0), 0), bruto: uang(sen("bruto")), potongan: uang(sen("potongan")), iuran: uang(sen("iuranPemberiKerja")), bersih: uang(sen("bersih")) };
});

const muatPeriode = async () => {
  if (!bolehDaftarPeriode) return;
  periode.value = ((await bacaGaji("/periode", { limit: 200 }))?.payload?.data ?? []).filter((p: any) => p.terkunciPada);
};
const muatNamaUnit = async () => {
  if (izinSdm("Kepegawaian", "READ")) {
    const r = await referensiSdm();
    namaUnit.value = Object.fromEntries((r?.payload?.lokasi ?? []).map((l: any) => [l.uuid, l.nama]));
  } else if (bolehDaftarPeriode && periodeUuid.value) {
    const h = (await bacaGaji(`/periode/${periodeUuid.value}/hasil`, { limit: 200 }))?.payload?.data ?? [];
    namaUnit.value = { ...namaUnit.value, ...Object.fromEntries(h.filter((x: any) => x.unitUuid && x.unit).map((x: any) => [x.unitUuid, x.unit])) };
  }
};
const muat = async () => {
  if (!izinGaji("rekap") || !periodeUuid.value) { data.value = []; return; }
  memuat.value = true;
  try {
    data.value = (await bacaGaji("/rekap", { periodeUuid: periodeUuid.value, unitUuid: unitUuid.value }))?.payload ?? [];
    // Rekap membawa nama unit (unit_nama) langsung dari backend.
    namaUnit.value = { ...namaUnit.value, ...Object.fromEntries(data.value.filter((x: any) => x.unitUuid && x.unitNama).map((x: any) => [x.unitUuid, x.unitNama])) };
    if (!unitUuid.value) unitRekap.value = data.value;
  } finally { memuat.value = false; }
};
const pilihPeriode = async (v: string) => {
  periodeUuid.value = v ?? ""; unitUuid.value = ""; unitRekap.value = []; versiManual.value = "";
  if (!izinSdm("Kepegawaian", "READ")) await muatNamaUnit();
  await muat();
};
const pilihUnit = (v: string) => { unitUuid.value = v ?? ""; muat(); };
const muatUlang = async () => { await muatPeriode(); await muat(); };

const bisaEkspor = computed(() => !!periodeUuid.value && !!formatUuid.value && !!versi.value && (!periodeTerpilih.value || ["disetujui", "dibayar"].includes(periodeTerpilih.value.status)));
const ekspor = async () => {
  if (sibuk.value) return;
  sibuk.value = true;
  try {
    const r = await simpanGaji(`/periode/${periodeUuid.value}/ekspor-bank`, { versi: Number(versi.value), formatUuid: formatUuid.value });
    if (r?.payload) { unduhGaji(r.payload); dialogEkspor.value = false; }
  } finally { sibuk.value = false; }
};
const kelasLabel = "block font-semibold mb-[5px] text-normal";
const kelasInput = "w-full h-10 px-3 bg-white border rounded-lg border-grey-200 text-SM";
onMounted(async () => {
  await muatPeriode();
  await muatNamaUnit();
  if (izinGaji("ekspor")) format.value = (await bacaGaji("/format-bank", { limit: 200 }))?.payload?.data?.filter((r: any) => r.status === "disahkan") ?? [];
  await muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" :disabled="memuat" @click="muatUlang" />
          <h1 class="toolbar-heading text-opensimrs-300">Rekap Penggajian dan Ekspor Bank</h1>
          <CustomSelect :modelValue="periodeUuid" label="Periode terkunci" placeHolder="Pilih periode" class="min-w-[280px]" :options="opsiPeriode" optionValue="value" optionLabel="label" :clearable="false" @update:modelValue="pilihPeriode" />
          <CustomSelect v-if="izinGaji('rekap')" :modelValue="unitUuid" label="Unit" placeHolder="Semua unit" :options="opsiUnit" optionValue="value" optionLabel="label" :disabled="!periodeUuid" @update:modelValue="pilihUnit" />
          <CustomButton v-if="izinGaji('ekspor', 'EKSPOR')" icon="PhDownloadSimple" label="Ekspor Bank" :disabled="!periodeUuid" @click="dialogEkspor = true" />
        </PageToolbar>
      </template>

      <template #content>
        <div class="flex flex-col gap-4 pt-4 text-sm">
          <p v-if="!bolehDaftarPeriode && !periodeUuid" class="px-3 py-2 text-xs rounded-lg bg-warning-50 text-warning-400">
            Daftar periode memerlukan izin baca Periode Penggajian. Buka rekap dari halaman rincian periode, atau minta pengelola menambahkan izin tersebut.
          </p>
          <div v-if="periodeTerpilih" class="flex flex-wrap items-center gap-2">
            <h2 class="text-base font-semibold">{{ periodeGaji(periodeTerpilih.tahun, periodeTerpilih.bulan) }}</h2>
            <span :class="kelasLencanaGaji(periodeTerpilih.status)">{{ statusGaji[periodeTerpilih.status] ?? periodeTerpilih.status }}</span>
            <span class="text-xs text-grey-400">versi {{ periodeTerpilih.versi }}</span>
          </div>
          <template v-if="izinGaji('rekap')">
            <NoData v-if="!periodeUuid" title="Pilih periode yang sudah disetujui atau dibayar" class="min-h-[240px]" />
            <NoData v-else-if="!data.length" :title="memuat ? 'Memuat rekap…' : 'Rekap belum tersedia untuk periode ini'" class="min-h-[240px]" />
            <DataTable v-else :value="data" stripedRows class="text-xs" scrollable tableStyle="min-width: 48rem">
              <Column header="Unit" headerClass="bg-opensimrs-50" footerClass="font-semibold"><template #body="{ data: r }"><span class="font-semibold">{{ labelUnit(r.unitUuid) }}</span></template><template #footer>Jumlah</template></Column>
              <Column header="Pegawai" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ r.jumlahPegawai }}</template><template #footer>{{ jumlah.pegawai }}</template></Column>
              <Column header="Bruto" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ nominalGaji(r.bruto) }}</template><template #footer>{{ nominalGaji(jumlah.bruto) }}</template></Column>
              <Column header="Potongan" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ nominalGaji(r.potongan) }}</template><template #footer>{{ nominalGaji(jumlah.potongan) }}</template></Column>
              <Column header="Iuran pemberi kerja" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ nominalGaji(r.iuranPemberiKerja) }}</template><template #footer>{{ nominalGaji(jumlah.iuran) }}</template></Column>
              <Column header="Bersih" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span class="font-semibold">{{ nominalGaji(r.bersih) }}</span></template><template #footer>{{ nominalGaji(jumlah.bersih) }}</template></Column>
            </DataTable>
          </template>
          <NoData v-else title="Anda dapat membuat ekspor bank; rekap unit memerlukan izin Rekap Penggajian" class="min-h-[200px]" />
        </div>
      </template>
    </Card>

    <KonfirmasiGaji v-model:visible="dialogEkspor" judul="Ekspor Berkas Bank" labelSetuju="Unduh ekspor bank" :sibuk="sibuk" @setuju="bisaEkspor && ekspor()">
      <div class="flex flex-col gap-4 text-sm">
        <p class="px-3 py-2 text-xs rounded-lg bg-warning-50 text-warning-400">Ekspor berisi data rahasia (nomor rekening dan gaji bersih). Unduhan ini tidak mengirim perintah pembayaran ke bank. Simpan hanya pada perangkat yang aman.</p>
        <p v-if="periodeTerpilih">Periode {{ periodeGaji(periodeTerpilih.tahun, periodeTerpilih.bulan) }} · versi {{ periodeTerpilih.versi }} · bersih {{ nominalGaji(periodeTerpilih.bersih) }}</p>
        <p v-if="periodeTerpilih && !['disetujui', 'dibayar'].includes(periodeTerpilih.status)" class="text-danger-400">Ekspor hanya untuk periode disetujui atau dibayar.</p>
        <label v-if="!periodeTerpilih" class="flex flex-col">
          <span :class="kelasLabel">Versi periode<span class="text-danger-300">*</span></span>
          <input v-model="versiManual" :class="kelasInput" type="number" min="1" step="1" placeholder="Lihat versi di rincian periode" />
        </label>
        <CustomSelect v-model="formatUuid" label="Format bank disahkan" placeHolder="Pilih format" :options="format.map((r) => ({ value: r.uuid, label: `${r.kode} · versi ${r.versi}` }))" optionValue="value" optionLabel="label" required />
        <p v-if="!format.length" class="text-xs text-grey-400">Format bank belum tersedia atau belum disahkan.</p>
        <p v-else-if="!bisaEkspor" class="text-xs text-grey-400">Pilih format bank untuk melanjutkan.</p>
      </div>
    </KonfirmasiGaji>
  </div>
</template>
