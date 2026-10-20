<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import {
  apiJadwal,
  bolehJadwal as boleh,
  epochWib,
  isoWib,
  kueriJadwal,
  type VersiJadwal,
  type Penempatan,
  type PolaShift,
  type Temuan,
} from "@/stores/penunjang/jadwalDinas";
import GridJadwal from "./components/jadwal/GridJadwal.vue";
import DaftarTemuan from "./components/jadwal/DaftarTemuan.vue";
import KeluaranJadwal from "./components/jadwal/KeluaranJadwal.vue";
import { KELAS_INPUT, jamMenit, kelasStatus, keBulan, keDate, keTanggal, labelStatus, warnaShift } from "./components/jadwal/tampilan";

// Jadwal Dinas HR / SDM (STD-0038): susun jadwal bulanan per unit dalam versi (draf → diajukan → disetujui → terbit),
// validasi benturan/istirahat/kebutuhan staf, salin bulan lalu atau terapkan rotasi, lalu ekspor/cetak jadwal terbit.
const referensi = ref<any>({ unit: [], kewenangan: [] });
const unit = ref("");
const periode = ref(isoWib(Date.now() / 1000).slice(0, 7));
const versi = ref<VersiJadwal[]>([]);
const terpilih = ref("");
const detail = ref<any>(null);
const pegawai = ref<any[]>([]);
const pola = ref<PolaShift[]>([]);
const perubahan = ref<Record<string, string>>({});
const temuan = ref<Temuan[]>([]);
const pesan = ref("");
const sibuk = ref(false);
const alasan = ref("");
const aksi = ref("");
const keluaran = ref<any>(null);
const jenisKeluaran = ref("");
const sumber = ref<VersiJadwal[]>([]);
const sumberUuid = ref("");
const rotasi = ref<any[]>([]);
const rotasiUuid = ref("");
const jangkar = ref("");
const offset = ref<Record<string, number>>({});
const pratinjau = ref<any>(null);
const dialogDasar = ref(false);

const v = computed<VersiJadwal | undefined>(() => detail.value?.versi);
const periodeEpoch = computed(() => epochWib(`${periode.value}-01`));
const kunciDasar = computed(() => JSON.stringify({
  unit: unit.value, periode: periode.value, versi: v.value?.uuid, kunci: v.value?.versiKunci,
  sumber: sumberUuid.value, rotasi: rotasiUuid.value, jangkar: jangkar.value, offset: offset.value,
}));
const orang = computed(() => [
  ...new Map(
    [
      ...pegawai.value,
      ...(detail.value?.penempatan ?? []).map((p: Penempatan) => ({ uuid: p.kepegawaianUuid, nama: p.nama ?? p.kepegawaianUuid })),
    ].map((p) => [p.uuid, p]),
  ).values(),
]);
const wenang = (jenis: string) => referensi.value.kewenangan.some((x: any) => x.unitUuid === unit.value && x.kewenangan === jenis);
const sunting = computed(() => v.value?.status === "draf" && boleh("Jadwal Dinas", "UPDATE") && wenang("susun"));
const adaPerubahan = computed(() => Object.keys(perubahan.value).length > 0);

// Adaptor tampilan: komponen Base memakai Date/objek opsi, logika muat/simpan tetap memakai string semula.
const bulanPeriode = computed<Date | null>({
  get: () => keDate(periode.value),
  set: (d) => { if (d) periode.value = keBulan(d); },
});
const tanggalJangkar = computed<Date | null>({
  get: () => keDate(jangkar.value),
  set: (d) => { jangkar.value = keTanggal(d); },
});
const opsiVersi = computed(() => versi.value.map((x) => ({
  value: x.uuid,
  label: `Versi ${x.nomorVersi} · ${labelStatus(x.status)}${x.versiAktifUuid === x.uuid ? " · Efektif" : ""}`,
})));
const opsiSumber = computed(() => sumber.value.map((s) => ({ value: s.uuid, label: `Versi ${s.nomorVersi} · ${labelStatus(s.status)}` })));
const opsiRotasi = computed(() => rotasi.value.filter((x) => x.aktif));
const opsiAksi = computed(() => {
  const x = v.value;
  if (!x) return [];
  return [
    { value: "ajukan", label: "Ajukan", tampil: x.status === "draf" && boleh("Jadwal Dinas", "AJUKAN") && wenang("susun") },
    { value: "setujui", label: "Setujui", tampil: x.status === "diajukan" && boleh("Persetujuan Jadwal", "SETUJUI") && wenang("setujui") },
    { value: "tolak", label: "Tolak dan kembalikan ke draf", tampil: ["diajukan", "disetujui"].includes(x.status) && boleh("Persetujuan Jadwal", "TOLAK") && wenang("setujui") },
    { value: "terbitkan", label: "Terbitkan", tampil: x.status === "disetujui" && boleh("Jadwal Dinas", "TERBITKAN") && wenang("terbit") },
    { value: "revisi", label: "Buat revisi", tampil: x.status === "terbit" && x.versiAktifUuid === x.uuid && boleh("Jadwal Dinas", "REVISI") && wenang("susun") },
  ].filter((o) => o.tampil);
});
const terbitEfektif = computed(() => v.value?.status === "terbit" && v.value?.versiAktifUuid === v.value?.uuid);
const namaPegawai = (uuid: string) => orang.value.find((p: any) => p.uuid === uuid)?.nama ?? uuid;

const jalankan = async (fn: () => Promise<void>) => {
  if (sibuk.value) return;
  sibuk.value = true;
  pesan.value = "";
  try {
    await fn();
  } catch (e: any) {
    pesan.value = e.message;
    if (e.payload?.temuan) temuan.value = e.payload.temuan;
  } finally {
    sibuk.value = false;
  }
};
const muatDetail = async () => {
  const x = versi.value.find((x) => x.uuid === terpilih.value);
  if (!x) { detail.value = null; return; }
  detail.value = await apiJadwal(`/jadwal/${x.jadwalUuid}${kueriJadwal({ versiUuid: x.uuid })}`);
  temuan.value = detail.value.validasi?.temuan ?? [];
  perubahan.value = {};
  pratinjau.value = null;
  keluaran.value = null;
};
const muat = async () => {
  detail.value = null; perubahan.value = {}; keluaran.value = null; pratinjau.value = null;
  versi.value = await apiJadwal(`/jadwal${kueriJadwal({ unitUuid: unit.value, periodeMulai: periodeEpoch.value })}`);
  terpilih.value = versi.value.some((x) => x.uuid === terpilih.value) ? terpilih.value : versi.value[0]?.uuid ?? "";
  pegawai.value = []; pola.value = []; sumber.value = []; rotasi.value = [];
  if (boleh("Jadwal Dinas", "READ")) {
    pegawai.value = await apiJadwal(`/pegawai${kueriJadwal({ unitUuid: unit.value, periodeMulai: periodeEpoch.value, limit: 500 })}`);
  }
  if (boleh("Pola Shift", "READ")) {
    pola.value = await apiJadwal(`/pola-shift${kueriJadwal({ unitUuid: unit.value })}`);
    rotasi.value = await apiJadwal(`/rotasi${kueriJadwal({ unitUuid: unit.value })}`);
  }
  const d = new Date(`${periode.value}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  sumber.value = await apiJadwal(`/jadwal${kueriJadwal({ unitUuid: unit.value, periodeMulai: epochWib(d.toISOString().slice(0, 7) + '-01') })}`);
  await muatDetail();
};
const buatDraf = () => jalankan(async () => {
  await apiJadwal("/jadwal", "post", { unitUuid: unit.value, periodeMulai: periodeEpoch.value });
  await muat();
});
const simpan = () => jalankan(async () => {
  if (!v.value) return;
  const penempatan: any[] = [], hapus: string[] = [];
  for (const [key, polaShiftUuid] of Object.entries(perubahan.value)) {
    const [kepegawaianUuid, tanggal] = key.split(":"), tanggalKerja = Number(tanggal);
    if (polaShiftUuid) penempatan.push({ kepegawaianUuid, tanggalKerja, polaShiftUuid });
    else {
      const p = detail.value.penempatan.find((p: Penempatan) => p.kepegawaianUuid === kepegawaianUuid && Number(p.tanggalKerja) === tanggalKerja);
      if (p?.uuid) hapus.push(p.uuid);
    }
  }
  await apiJadwal(`/versi/${v.value.uuid}/penempatan`, "put", { versiKunci: v.value.versiKunci, penempatan, hapus });
  await muat();
});
const validasiTersimpan = () => jalankan(async () => {
  const x = await apiJadwal(`/versi/${v.value!.uuid}/validasi`, "post", { versiKunci: v.value!.versiKunci });
  temuan.value = x.temuan;
});
const proses = () => jalankan(async () => {
  if (!v.value || !aksi.value) return;
  await apiJadwal(`/versi/${v.value.uuid}/${aksi.value}`, "post", { versiKunci: v.value.versiKunci, alasan: alasan.value, catatan: alasan.value });
  alasan.value = ""; aksi.value = "";
  await muat();
});
const dasar = (jenis: string, lihat: boolean) => jalankan(async () => {
  if (!v.value) return;
  const hasil = await apiJadwal(`/versi/${v.value.uuid}/${jenis}`, "post", {
    versiKunci: v.value.versiKunci,
    pratinjau: lihat,
    sumberVersiUuid: sumberUuid.value,
    rotasiUuid: rotasiUuid.value,
    tanggalJangkar: epochWib(jangkar.value),
    pegawai: pegawai.value.map((p) => ({ kepegawaianUuid: p.uuid, offset: offset.value[p.uuid] ?? 0 })),
  });
  if (lihat) {
    pratinjau.value = { ...hasil, operasi: jenis, kunci: kunciDasar.value };
    temuan.value = hasil.temuan;
  } else {
    await muat();
    pratinjau.value = { dilewati: hasil.dilewati };
  }
});
const ekspor = (jenis: string) => jalankan(async () => {
  keluaran.value = await apiJadwal("/keluaran", "post", { unitUuid: unit.value, periodeMulai: periodeEpoch.value, versiUuid: v.value?.uuid, jenis });
  jenisKeluaran.value = jenis;
});
const fokus = (p: string, t?: number) => document.getElementById(`sel-${p}-${t}`)?.focus();
onMounted(() => jalankan(async () => {
  referensi.value = await apiJadwal("/referensi");
  unit.value = referensi.value.unit[0]?.uuid ?? "";
  if (unit.value) await muat();
}));
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" :disabled="!unit || sibuk" @click="jalankan(muat)" />
          <h1 class="toolbar-heading text-opensimrs-300">Jadwal Dinas</h1>
          <CustomSelect
            v-model="unit"
            label="Unit"
            :options="referensi.unit"
            optionValue="uuid"
            optionLabel="nama"
            :clearable="false"
            :disabled="sibuk"
          />
          <CustomDatePicker v-model="bulanPeriode" label="Periode" view="month" dateFormat="MM yy" class="toolbar-field--date" :disabled="sibuk" />
          <CustomSelect
            v-if="versi.length"
            v-model="terpilih"
            label="Versi"
            :options="opsiVersi"
            optionValue="value"
            optionLabel="label"
            :showFilter="false"
            :clearable="false"
            :disabled="sibuk"
            @update:modelValue="jalankan(muatDetail)"
          />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" :disabled="!unit || sibuk" @click="jalankan(muat)" />
          <CustomButton
            v-if="!versi.length && boleh('Jadwal Dinas', 'CREATE') && wenang('susun')"
            icon="PhPlus"
            label="Buat Draf"
            :disabled="!unit || sibuk"
            @click="buatDraf"
          />
          <CustomButton
            v-if="v && sunting && !adaPerubahan"
            icon="PhCopy"
            label="Salin / Rotasi"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
            :disabled="sibuk"
            @click="dialogDasar = true"
          />
          <template v-if="v && terbitEfektif">
            <CustomButton v-if="boleh('Jadwal Dinas', 'EKSPOR')" icon="PhDownloadSimple" label="Siapkan Ekspor" :disabled="sibuk" @click="ekspor('ekspor')" />
            <CustomButton v-if="boleh('Jadwal Dinas', 'CETAK')" icon="PhPrinter" label="Siapkan Cetak" :disabled="sibuk" @click="ekspor('cetak')" />
          </template>
        </PageToolbar>
      </template>

      <template #content>
        <fieldset :disabled="sibuk" class="flex flex-col min-w-0 gap-4 p-4 m-0 border-0">
          <div v-if="pesan" role="alert" class="flex items-start gap-2 px-3 py-2 text-sm rounded-lg bg-danger-50 text-danger-400">
            <PhWarningCircle :size="18" weight="bold" class="shrink-0" /> {{ pesan }}
          </div>

          <template v-if="v">
            <!-- Ringkasan versi -->
            <div class="flex flex-wrap items-center gap-2 p-3 text-sm rounded-lg bg-opensimrs-50">
              <span class="px-2 py-0.5 text-xs font-semibold rounded-full" :class="kelasStatus(v.status)">{{ labelStatus(v.status) }}</span>
              <span class="font-semibold">Versi {{ v.nomorVersi }}</span>
              <span v-if="v.versiAktifUuid === v.uuid" class="px-2 py-0.5 text-xs font-semibold rounded-full bg-success-50 text-success-400">Efektif</span>
              <span class="text-xs text-grey-400">· Zona waktu Asia/Jakarta</span>
              <span v-if="v.alasanRevisi" class="text-xs text-grey-500">· Alasan revisi: {{ v.alasanRevisi }}</span>
            </div>

            <div v-if="adaPerubahan" class="flex items-start gap-2 px-3 py-2 text-sm rounded-lg bg-warning-50 text-warning-400">
              <PhWarning :size="18" weight="bold" class="shrink-0" />
              Ada perubahan lokal yang belum disimpan. Muat ulang atau berpindah versi akan mengganti perubahan lokal.
            </div>

            <!-- Grid jadwal bulanan -->
            <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2 font-semibold text-opensimrs-300"><PhCalendarDots :size="18" /> Jadwal bulanan</div>
                <div class="flex flex-wrap gap-2">
                  <CustomButton
                    v-if="boleh('Jadwal Dinas', 'READ')"
                    icon="PhShieldCheck"
                    label="Validasi Tersimpan"
                    size="small"
                    outlined
                    borderColor="border-opensimrs-300"
                    textColor="text-opensimrs-300"
                    :disabled="sibuk"
                    @click="validasiTersimpan"
                  />
                  <CustomButton v-if="sunting" icon="PhFloppyDisk" label="Simpan Perubahan" size="small" :disabled="!adaPerubahan || sibuk" @click="simpan" />
                </div>
              </div>
              <div v-if="pola.length" class="flex flex-wrap items-center gap-1.5 text-xs">
                <span class="text-grey-400">Keterangan:</span>
                <span
                  v-for="s in pola.filter((x) => x.aktif)"
                  :key="s.uuid"
                  class="px-2 py-0.5 border rounded-md"
                  :class="warnaShift(s.kode, s.libur)"
                  :title="s.nama"
                >
                  <b>{{ s.kode }}</b> {{ s.libur ? "Libur" : `${jamMenit(s.mulaiMenit)}–${jamMenit(s.selesaiMenit)}${s.lintasHari ? " (+1)" : ""}` }}
                </span>
                <span class="flex items-center gap-1 ml-2 text-grey-400"><span class="w-3 h-3 rounded-sm ring-2 ring-inset ring-danger-300 bg-danger-50" /> Pemblokir</span>
                <span class="flex items-center gap-1 text-grey-400"><span class="w-3 h-3 rounded-sm ring-2 ring-inset ring-warning-300 bg-warning-50" /> Peringatan</span>
              </div>
              <GridJadwal
                :periode="v.periodeMulai"
                :pegawai="orang"
                :pola="pola"
                :penempatan="detail.penempatan"
                :perubahan="perubahan"
                :sunting="sunting"
                :temuan="temuan"
                @ubah="(p, t, s) => (perubahan[`${p}:${t}`] = s)"
              />
            </div>

            <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <!-- Hasil validasi -->
              <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
                <div class="flex items-center gap-2 font-semibold text-opensimrs-300"><PhListChecks :size="18" /> Hasil validasi</div>
                <DaftarTemuan :temuan="temuan" :pegawai="orang" @pilih="fokus" />
              </div>

              <!-- Tindakan alur persetujuan -->
              <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
                <div class="flex items-center gap-2 font-semibold text-opensimrs-300"><PhSealCheck :size="18" /> Tindakan versi {{ v.nomorVersi }}</div>
                <template v-if="!adaPerubahan">
                  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <CustomSelect
                      v-model="aksi"
                      label="Tindakan jadwal"
                      placeHolder="Pilih tindakan"
                      :options="opsiAksi"
                      optionValue="value"
                      optionLabel="label"
                      :showFilter="false"
                      :clearable="false"
                      :disabled="sibuk || !opsiAksi.length"
                    />
                    <CustomTextfield
                      v-model="alasan"
                      label="Alasan atau catatan"
                      placeholder="Wajib untuk tolak dan revisi"
                      :required="['tolak', 'revisi'].includes(aksi)"
                      :maxLength="2000"
                    />
                  </div>
                  <span v-if="!opsiAksi.length" class="text-xs text-grey-400">Tidak ada tindakan yang dapat Anda jalankan pada versi ini.</span>
                  <div class="flex justify-end">
                    <CustomButton
                      icon="PhPlay"
                      :label="`Jalankan pada versi ${v.nomorVersi}`"
                      :disabled="sibuk || !aksi || (['tolak', 'revisi'].includes(aksi) && !alasan.trim())"
                      @click="proses"
                    />
                  </div>
                </template>
                <span v-else class="text-xs text-grey-400">Simpan atau muat ulang perubahan lokal sebelum menjalankan tindakan.</span>
              </div>
            </div>

            <KeluaranJadwal v-if="keluaran" :data="keluaran" :jenis="jenisKeluaran" />

            <!-- Riwayat keputusan -->
            <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
              <div class="flex items-center gap-2 font-semibold text-opensimrs-300"><PhClockCounterClockwise :size="18" /> Riwayat keputusan</div>
              <div v-if="!detail.peristiwa?.length" class="text-xs text-grey-400">Belum ada riwayat keputusan.</div>
              <DataTable v-else :value="detail.peristiwa" dataKey="uuid" stripedRows class="text-xs" tableStyle="min-width: 40rem">
                <Column header="Peristiwa" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ p.jenis }}</template></Column>
                <Column header="Pelaku" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ p.pelaku || "-" }}</template></Column>
                <Column header="Status" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }">
                    <span v-if="p.statusSebelum" class="px-2 py-0.5 font-semibold rounded-full" :class="kelasStatus(p.statusSebelum)">{{ labelStatus(p.statusSebelum) }}</span>
                    <span v-if="p.statusSebelum || p.statusSesudah" class="mx-1 text-grey-300">→</span>
                    <span v-if="p.statusSesudah" class="px-2 py-0.5 font-semibold rounded-full" :class="kelasStatus(p.statusSesudah)">{{ labelStatus(p.statusSesudah) }}</span>
                  </template>
                </Column>
                <Column header="Alasan" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ p.alasan || "-" }}</template></Column>
              </DataTable>
            </div>
          </template>
          <NoData v-else class="min-h-60" title="Belum ada versi jadwal untuk unit dan periode yang dipilih." />
        </fieldset>
      </template>
    </Card>

    <!-- Salin bulan lalu / terapkan rotasi -->
    <CustomDialog v-model:visible="dialogDasar" width="1100px">
      <template #header>Salin Bulan Lalu atau Terapkan Rotasi</template>
      <template #body>
        <fieldset v-if="v && sunting && !adaPerubahan" :disabled="sibuk" class="flex flex-col min-w-0 gap-4 p-0 pt-4 m-0 border-0 text-sm">
          <div v-if="pesan" role="alert" class="px-3 py-2 rounded-lg bg-danger-50 text-danger-400">{{ pesan }}</div>
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
              <div class="flex items-center gap-2 font-semibold text-opensimrs-300"><PhCopy :size="18" /> Salin dari bulan lalu</div>
              <CustomSelect
                v-model="sumberUuid"
                label="Versi bulan lalu"
                placeHolder="Pilih sumber"
                :options="opsiSumber"
                optionValue="value"
                optionLabel="label"
                :showFilter="false"
                :clearable="false"
                :disabled="sibuk"
              />
              <div class="flex flex-wrap justify-end gap-2">
                <CustomButton label="Pratinjau Salinan" icon="PhEye" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="!sumberUuid || sibuk" @click="dasar('salin', true)" />
                <CustomButton
                  label="Terapkan Salinan"
                  icon="PhCheck"
                  :disabled="pratinjau?.operasi !== 'salin' || pratinjau?.kunci !== kunciDasar || sibuk"
                  @click="dasar('salin', false)"
                />
              </div>
            </div>
            <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
              <div class="flex items-center gap-2 font-semibold text-opensimrs-300"><PhArrowsClockwise :size="18" /> Terapkan rotasi</div>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <CustomSelect
                  v-model="rotasiUuid"
                  label="Rotasi"
                  placeHolder="Pilih rotasi"
                  :options="opsiRotasi"
                  optionValue="uuid"
                  optionLabel="nama"
                  :clearable="false"
                  :disabled="sibuk"
                />
                <CustomDatePicker v-model="tanggalJangkar" label="Tanggal jangkar" :disabled="sibuk" />
              </div>
              <div class="flex flex-wrap justify-end gap-2">
                <CustomButton label="Pratinjau Rotasi" icon="PhEye" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="!rotasiUuid || !jangkar || sibuk" @click="dasar('rotasi', true)" />
                <CustomButton
                  label="Terapkan Rotasi"
                  icon="PhCheck"
                  :disabled="pratinjau?.operasi !== 'rotasi' || pratinjau?.kunci !== kunciDasar || sibuk"
                  @click="dasar('rotasi', false)"
                />
              </div>
            </div>
          </div>

          <div v-if="pegawai.length" class="flex flex-col gap-2 p-4 border rounded-lg border-grey-75">
            <div class="font-semibold">Offset rotasi per pegawai</div>
            <p class="text-xs text-grey-400">Jumlah langkah pergeseran urutan rotasi untuk tiap pegawai (0–10000).</p>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label v-for="p in pegawai" :key="p.uuid" class="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-grey-50">
                <span class="truncate">{{ p.nama }}</span>
                <input v-model.number="offset[p.uuid]" type="number" min="0" max="10000" :aria-label="`Offset ${p.nama}`" :class="KELAS_INPUT" class="!w-24 !h-8" />
              </label>
            </div>
          </div>

          <div v-if="pratinjau" class="flex flex-col gap-2 p-4 border rounded-lg border-grey-75">
            <div class="flex flex-wrap gap-2 text-xs">
              <span class="px-2 py-0.5 font-semibold rounded-full bg-info-50 text-info-400">Rencana: {{ pratinjau.penempatan?.length ?? 0 }} penempatan</span>
              <span class="px-2 py-0.5 font-semibold rounded-full" :class="pratinjau.dilewati?.length ? 'bg-warning-50 text-warning-400' : 'bg-grey-75 text-grey-500'">
                Dilewati: {{ pratinjau.dilewati?.length ?? 0 }}
              </span>
            </div>
            <ul v-if="pratinjau.dilewati?.length" class="flex flex-col gap-1 text-xs">
              <li v-for="(x, i) in pratinjau.dilewati" :key="i" class="px-3 py-1.5 rounded-lg bg-warning-50 text-warning-400">
                {{ x.message }} · {{ namaPegawai(x.kepegawaianUuid) }} · {{ isoWib(x.tanggalKerja) }}
              </li>
            </ul>
            <GridJadwal
              v-if="pratinjau.penempatan"
              :periode="v.periodeMulai"
              :pegawai="orang"
              :pola="pola"
              :penempatan="pratinjau.penempatan"
              :perubahan="{}"
              :sunting="false"
              :temuan="temuan"
            />
          </div>
        </fieldset>
        <div v-else class="pt-4 text-sm text-grey-400">Salin dan rotasi hanya tersedia untuk versi draf yang dapat Anda sunting, tanpa perubahan lokal.</div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogDasar = false" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
