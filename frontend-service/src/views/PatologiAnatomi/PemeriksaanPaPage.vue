<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  FIKSASI_PA,
  ICDO_MORFOLOGI_PA,
  ICDO_TOPOGRAFI_PA,
  JENIS_PA,
  JK_PA,
  LATERALITAS_PA,
  STATUS_ARSIP_PA,
  cariIcd10Pa,
  detailKasusPa,
  detailOrderPa,
  gayaKasusPa,
  izinPa,
  pilihanPetugasPa,
  revisiPa,
  simpanDiagnosisPa,
  simpanMakroskopisPa,
  simpanMikroskopisPa,
  sisaHariPa,
  templateUntukPa,
  umurPa,
  verifikasiPa,
  waktuPa,
  worklistPa,
} from "@/stores/penunjang/patologi";
import { createHasilPaPdf, createLabelArsipPaPdf } from "@/utils/pdf/pdfPatologi/cetakPatologi";
import { gambarKePng, gambarPdfValid } from "@/utils/pdf/bukaPdf";

// Pemeriksaan & diagnosis PA per kasus (nomor PA): makroskopis (deskripsi, jumlah blok/kaset & slide, foto),
// mikroskopis, kesimpulan/diagnosis (+ ICD-O topografi/morfologi, ICD-10, komentar) dengan template laporan,
// verifikasi dokter Sp.PA, revisi (addendum), cetak laporan resmi & label kaset/slide. TAT dalam hari.
const storeUtils = utilsStore();
// Hak akses per tahap (Setting › Hak Akses › Patologi Anatomi › Pemeriksaan): MAKROSKOPIS, MIKROSKOPIS, DIAGNOSIS,
// VERIFIKASI (termasuk revisi/addendum), CETAK HASIL. Tanpa izin tahap, bagian laporan tampil hanya-baca.
const boleh = (aksi: string) => izinPa("Pemeriksaan", aksi);
const bolehProses = ["MAKROSKOPIS", "MIKROSKOPIS", "DIAGNOSIS", "VERIFIKASI"].some(boleh);

const TAHAP: Record<string, { label: string; status: string[] }> = {
  proses: { label: "Dalam proses", status: ["diterima", "diproses", "verifikasi"] },
  verifikasi: { label: "Menunggu verifikasi", status: ["verifikasi"] },
  selesai: { label: "Selesai", status: ["selesai"] },
};
const tahap = ref<keyof typeof TAHAP>("proses");
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterJenis = ref<string[]>([]);
const hanyaCito = ref(false);
const hanyaTerlambat = ref(false);

const toggleJenis = (j: string) => {
  filterJenis.value = filterJenis.value.includes(j) ? filterJenis.value.filter((x) => x !== j) : [...filterJenis.value, j];
};
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await worklistPa({
      page: page.value,
      limit: limit.value,
      cari: cari.value,
      status: TAHAP[tahap.value].status,
      jenis: filterJenis.value,
      cito: hanyaCito.value ? 1 : "",
      terlambat: hanyaTerlambat.value ? 1 : "",
    });
    data.value = res?.payload?.data ?? [];
    total.value = res?.payload?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};
const cariData = () => {
  page.value = 1;
  muat();
};
const gantiTahap = (t: string) => {
  tahap.value = t as keyof typeof TAHAP;
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

const target = (d: any) => {
  if (d.status === "selesai") return { teks: `Selesai ${waktuPa(d.waktuSelesai, true)}`, kelas: "text-grey-400" };
  const s = sisaHariPa(d.targetSelesai);
  if (s === null) return { teks: "-", kelas: "text-grey-400" };
  if (s < 0) return { teks: `Terlambat ${-s} hari`, kelas: "text-danger-300 font-semibold" };
  return { teks: s === 0 ? "Target hari ini" : `Sisa ${s} hari`, kelas: s <= 1 ? "text-warning-300 font-semibold" : "text-grey-500" };
};

// ── Dialog laporan
const dialog = ref(false);
const kasus = ref<any>(null);
const template = ref<any[]>([]);
const dokter = ref<any[]>([]);
const teknisi = ref<any[]>([]);
const templateDipilih = ref("");
const kosong = () => ({
  makroskopis: "",
  jumlahBlok: 0,
  jumlahSlide: 0,
  gambarMakro: [] as { nama: string; tipe: string; data: string }[],
  petugasMakroskopis: "",
  mikroskopis: "",
  diagnosis: "",
  icdOTopografi: "",
  icdOMorfologi: "",
  icd10: "",
  komentar: "",
  dokterPaUuid: "",
  templateUuid: "",
});
const form = ref(kosong());
const galat = ref("");
const bisaSunting = computed(() => kasus.value && ["diterima", "diproses", "verifikasi"].includes(kasus.value.status));
const bisaMakro = computed(() => bisaSunting.value && boleh("MAKROSKOPIS"));
const bisaMikro = computed(() => bisaSunting.value && boleh("MIKROSKOPIS"));
const bisaDiagnosis = computed(() => bisaSunting.value && boleh("DIAGNOSIS"));

const isiForm = (k: any) => {
  form.value = {
    makroskopis: k.makroskopis ?? "",
    jumlahBlok: Number(k.jumlahBlok ?? 0),
    jumlahSlide: Number(k.jumlahSlide ?? 0),
    gambarMakro: k.gambarMakro ?? [],
    petugasMakroskopis: k.petugasMakroskopis ?? "",
    mikroskopis: k.mikroskopis ?? "",
    diagnosis: k.diagnosis ?? "",
    icdOTopografi: k.icdOTopografi ?? "",
    icdOMorfologi: k.icdOMorfologi ?? "",
    icd10: k.icd10 ?? "",
    komentar: k.komentar ?? "",
    dokterPaUuid: k.dokterPaUuid ?? (dokter.value.length === 1 ? dokter.value[0].uuid : ""),
    templateUuid: k.templateUuid ?? "",
  };
};
const buka = async (baris: any) => {
  storeUtils.setLoading(true);
  try {
    const [res, tpl, dok, tek] = await Promise.all([
      detailKasusPa(baris.uuid),
      templateUntukPa(baris.pemeriksaanUuid),
      dokter.value.length ? null : pilihanPetugasPa("dokter"),
      teknisi.value.length ? null : pilihanPetugasPa("teknisi"),
    ]);
    if (dok?.payload) dokter.value = dok.payload;
    if (tek?.payload) teknisi.value = tek.payload;
    template.value = tpl?.payload ?? [];
    if (!res?.payload) return;
    kasus.value = res.payload;
    templateDipilih.value = "";
    galat.value = "";
    isiForm(res.payload);
    dialog.value = true;
  } finally {
    storeUtils.setLoading(false);
  }
};
const segarkan = (payload: any) => {
  if (!payload) return;
  kasus.value = payload;
  isiForm(payload);
  muat();
};

// Template: mengisi makroskopis (bila masih kosong), mikroskopis, diagnosis, ICD & komentar — lalu disunting.
const terapkanTemplate = (uuid: string) => {
  templateDipilih.value = uuid;
  const t = template.value.find((x) => x.uuid === uuid);
  if (!t) return;
  const f = form.value;
  if (t.makroskopis && !f.makroskopis.trim()) f.makroskopis = t.makroskopis;
  if (t.mikroskopis) f.mikroskopis = t.mikroskopis;
  f.diagnosis = t.diagnosis;
  f.icdOTopografi = t.icdOTopografi ?? "";
  f.icdOMorfologi = t.icdOMorfologi ?? "";
  f.icd10 = t.icd10 ?? "";
  f.komentar = t.komentar ?? "";
  f.templateUuid = t.uuid;
};

// Foto makroskopis (maks. 4, 1,5 MB; BMP/WebP diubah ke PNG agar bisa dicetak).
const MAKS_BERKAS = 1.5 * 1024 * 1024;
const tambahFoto = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const berkas = Array.from(input.files ?? []);
  input.value = "";
  for (const f of berkas) {
    if (form.value.gambarMakro.length >= 4) return (galat.value = "Maksimal 4 foto makroskopis");
    if (!f.type.startsWith("image/")) {
      galat.value = "Berkas harus berupa gambar";
      continue;
    }
    try {
      const asli = await new Promise<string>((ok, gagal) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result));
        r.onerror = () => gagal(r.error);
        r.readAsDataURL(f);
      });
      const dataUrl = gambarPdfValid(asli) ? asli : await gambarKePng(f);
      if (Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4) > MAKS_BERKAS) {
        galat.value = `${f.name} melebihi 1,5 MB`;
        continue;
      }
      form.value.gambarMakro.push({ nama: f.name, tipe: dataUrl.slice(5, dataUrl.indexOf(";")), data: dataUrl });
    } catch {
      galat.value = `${f.name} bukan gambar yang dapat dibaca`;
    }
  }
};

const jalankan = async (fn: () => Promise<any>) => {
  galat.value = "";
  storeUtils.setLoading(true);
  try {
    const res = await fn();
    if (res?.payload) segarkan(res.payload);
    return res;
  } finally {
    storeUtils.setLoading(false);
  }
};
const simpanMakro = () => {
  const f = form.value;
  if (!f.makroskopis.trim() && kasus.value?.jenis !== "ihk") return (galat.value = "Deskripsi makroskopis wajib diisi");
  return jalankan(() =>
    simpanMakroskopisPa(kasus.value.uuid, {
      makroskopis: f.makroskopis,
      jumlahBlok: f.jumlahBlok ?? 0,
      jumlahSlide: f.jumlahSlide ?? 0,
      gambarMakro: f.gambarMakro,
      petugasMakroskopis: f.petugasMakroskopis || undefined,
    })
  );
};
const simpanMikro = () => {
  if (!form.value.mikroskopis.trim()) return (galat.value = "Deskripsi mikroskopis wajib diisi");
  return jalankan(() => simpanMikroskopisPa(kasus.value.uuid, { mikroskopis: form.value.mikroskopis }));
};
const simpanDiagnosis = () => {
  const f = form.value;
  if (!f.mikroskopis.trim()) return (galat.value = "Isi mikroskopis terlebih dahulu");
  if (!f.diagnosis.trim()) return (galat.value = "Kesimpulan/diagnosis wajib diisi");
  if (!f.dokterPaUuid) return (galat.value = "Pilih dokter Sp.PA");
  return jalankan(() =>
    simpanDiagnosisPa(kasus.value.uuid, {
      mikroskopis: f.mikroskopis,
      diagnosis: f.diagnosis,
      icdOTopografi: f.icdOTopografi,
      icdOMorfologi: f.icdOMorfologi,
      icd10: f.icd10,
      komentar: f.komentar,
      dokterPaUuid: f.dokterPaUuid,
      templateUuid: f.templateUuid || null,
    })
  );
};
const verifikasi = () => jalankan(() => verifikasiPa(kasus.value.uuid, form.value.dokterPaUuid || undefined));

// ICD-10 (tabel diagnosis) — saran saat mengetik.
const saranIcd10 = ref<any[]>([]);
let tundaIcd: ReturnType<typeof setTimeout> | undefined;
const cariIcd10 = () => {
  clearTimeout(tundaIcd);
  const q = form.value.icd10.trim();
  if (q.length < 2) return (saranIcd10.value = []);
  tundaIcd = setTimeout(async () => {
    saranIcd10.value = (await cariIcd10Pa(q))?.payload ?? [];
  }, 300);
};

// Revisi
const dialogRevisi = ref(false);
const alasanRevisi = ref("");
const revisi = async () => {
  if (!alasanRevisi.value.trim()) return;
  const res = await jalankan(() => revisiPa(kasus.value.uuid, alasanRevisi.value.trim()));
  if (res) dialogRevisi.value = false;
};

// Cetak
const cetak = async (itemUuid: string, orderUuid: string, draft = false) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailOrderPa(orderUuid);
    if (res?.payload) createHasilPaPdf(res.payload, itemUuid, draft);
  } finally {
    storeUtils.setLoading(false);
  }
};
const cetakLabel = () => kasus.value && createLabelArsipPaPdf(kasus.value.arsip ?? [], kasus.value.order?.pasien?.name, kasus.value.order?.noRm);

const opsiTopografi = ICDO_TOPOGRAFI_PA;
const opsiMorfologi = ICDO_MORFOLOGI_PA;

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Pemeriksaan &amp; Diagnosis</h1>
          <div class="flex overflow-hidden border rounded-lg shrink-0 border-opensimrs-300">
            <button
              v-for="(t, kode) in TAHAP"
              :key="kode"
              type="button"
              class="px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
              :class="tahap === kode ? 'bg-opensimrs-300 text-white' : 'text-opensimrs-300 bg-white'"
              @click="gantiTahap(String(kode))"
            >
              {{ t.label }}
            </button>
          </div>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="No. PA / nama / No. RM / pemeriksaan" :maxLength="100" @keydown.enter="cariData" />
          <ToolbarFilterMenu :count="filterJenis.length + (hanyaCito ? 1 : 0) + (hanyaTerlambat ? 1 : 0)">
            <template #label>Filter</template>
            <CustomChip v-for="(j, kode) in JENIS_PA" :key="kode" :label="j.label" :value="String(kode)" :isSelected="filterJenis.includes(String(kode))" @selected="toggleJenis" />
            <CustomChip label="Hanya CITO" :isSelected="hanyaCito" @selected="hanyaCito = !hanyaCito" />
            <CustomChip label="Melewati target (TAT)" :isSelected="hanyaTerlambat" @selected="hanyaTerlambat = !hanyaTerlambat" />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 64rem">
          <Column header="No. PA" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">
                <span v-if="d.cito" class="px-1.5 mr-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>{{ d.noPa }}
              </div>
              <div class="text-grey-400">Diterima {{ waktuPa(d.waktuTerima) }}</div>
            </template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaPasien ?? "-" }}</div>
              <div class="text-grey-400">{{ d.noRm }} · {{ JK_PA[d.gender] ?? "-" }} · {{ umurPa(d.birthDate) }}</div>
            </template>
          </Column>
          <Column header="Pemeriksaan / Lokasi" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.nama }}</div>
              <div class="text-grey-400">{{ JENIS_PA[d.jenis as keyof typeof JENIS_PA]?.singkat }} · {{ d.lokasiAnatomi ?? d.lokasiAnatomiOrder ?? "-" }}</div>
            </template>
          </Column>
          <Column header="Tahapan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="flex gap-1">
                <span v-for="[ada, label] in [[d.adaMakroskopis, 'Makro'], [d.adaMikroskopis, 'Mikro'], [d.adaDiagnosis, 'Diagnosis'], [d.status === 'selesai', 'Verif']]" :key="String(label)"
                  class="px-1.5 py-0.5 rounded text-[10px] font-semibold" :class="ada ? 'bg-mint-50 text-mint-400' : 'bg-grey-50 text-grey-300'">{{ label }}</span>
              </div>
              <div v-if="d.jumlahBlok || d.jumlahSlide" class="mt-0.5 text-grey-400">{{ d.jumlahBlok }} blok · {{ d.jumlahSlide }} slide</div>
            </template>
          </Column>
          <Column header="Target (TAT)" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span :class="target(d).kelas">{{ target(d).teks }}</span>
              <div class="text-grey-400">{{ d.tatHari }} hari</div>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" :class="[gayaKasusPa(d.status)?.bg, gayaKasusPa(d.status)?.text]">{{ gayaKasusPa(d.status)?.label }}</span>
              <div v-if="d.revisi" class="text-[10px] text-danger-300">Revisi ke-{{ d.revisi }}</div>
              <div v-if="d.dokterPaNama" class="text-grey-400">{{ d.dokterPaNama }}</div>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[190px]">
            <template #body="{ data: d }">
              <div class="flex flex-wrap gap-2">
                <CustomButton
                  :label="d.status === 'selesai' || !bolehProses ? 'Lihat' : d.status === 'verifikasi' ? 'Verifikasi' : 'Proses'"
                  :icon="d.status === 'selesai' || !bolehProses ? 'PhEye' : 'PhNotePencil'"
                  size="small"
                  :outlined="d.status === 'selesai' || !bolehProses"
                  :borderColor="d.status === 'selesai' || !bolehProses ? 'border-opensimrs-300' : ''"
                  :textColor="d.status === 'selesai' || !bolehProses ? 'text-opensimrs-300' : ''"
                  @click="buka(d)"
                />
                <CustomButton v-if="d.status === 'selesai' && boleh('CETAK HASIL')" label="Cetak" icon="PhPrinter" size="small" @click="cetak(d.uuid, d.orderUuid)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <!-- Laporan PA -->
    <CustomDialog v-model:visible="dialog" width="1040px">
      <template #header>Laporan PA {{ kasus?.noPa }} — {{ kasus?.nama }}</template>
      <template #body>
        <div v-if="kasus" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-3 p-3 rounded-lg gap-x-6 gap-y-1 bg-opensimrs-50">
            <div><span class="text-grey-400">Pasien:</span> <b>{{ kasus.order?.pasien?.name }}</b> ({{ kasus.order?.noRm }})</div>
            <div><span class="text-grey-400">Umur / JK:</span> {{ umurPa(kasus.order?.pasien?.birthDate) }} / {{ JK_PA[kasus.order?.pasien?.gender] ?? "-" }}</div>
            <div>
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold" :class="[gayaKasusPa(kasus.status)?.bg, gayaKasusPa(kasus.status)?.text]">{{ gayaKasusPa(kasus.status)?.label }}</span>
              <span v-if="kasus.order?.cito" class="ml-1 font-bold text-danger-300">CITO</span>
              <span v-if="kasus.revisi" class="ml-1 text-xs text-danger-300">Revisi ke-{{ kasus.revisi }}</span>
            </div>
            <div><span class="text-grey-400">Dokter pengirim:</span> {{ kasus.order?.dokterPengirim ?? "-" }}</div>
            <div><span class="text-grey-400">Spesimen:</span> {{ kasus.jenisSpesimen ?? "-" }} · {{ kasus.jumlahWadah ?? "-" }} wadah</div>
            <div><span class="text-grey-400">Fiksasi:</span> {{ FIKSASI_PA[kasus.fiksasi] ?? "-" }}</div>
            <div><span class="text-grey-400">Lokasi:</span> {{ kasus.lokasiAnatomi ?? "-" }} {{ LATERALITAS_PA[kasus.lateralitas] ? `· ${LATERALITAS_PA[kasus.lateralitas]}` : "" }}</div>
            <div><span class="text-grey-400">Diterima:</span> {{ waktuPa(kasus.waktuTerima) }}</div>
            <div><span class="text-grey-400">Target selesai:</span> {{ waktuPa(kasus.targetSelesai, true) }}</div>
            <div class="col-span-3"><span class="text-grey-400">Data klinis:</span> {{ kasus.order?.klinis || "-" }} <span v-if="kasus.order?.riwayat">· Riwayat: {{ kasus.order.riwayat }}</span></div>
            <div v-if="kasus.induk" class="col-span-3">
              <span class="text-grey-400">Kasus induk {{ kasus.induk.noPa }}:</span> {{ kasus.induk.diagnosis ?? "belum ada diagnosis" }}
            </div>
            <div v-if="kasus.ihk?.length" class="col-span-3">
              <span class="text-grey-400">IHK tambahan:</span> {{ kasus.ihk.map((x: any) => `${x.nama} (${x.noPa ?? "belum diterima"})`).join(", ") }}
            </div>
            <div v-if="kasus.alasanRevisi && kasus.status !== 'selesai'" class="col-span-3 text-danger-300">Alasan revisi: {{ kasus.alasanRevisi }}</div>
          </div>

          <CustomSelect
            v-if="(bisaMikro || bisaDiagnosis) && template.length"
            :modelValue="templateDipilih"
            label="Template laporan (kasus normal/umum)"
            placeHolder="Pilih template untuk mengisi mikroskopis, diagnosis & kode — lalu sunting sesuai temuan"
            :options="template"
            optionValue="uuid"
            optionLabel="nama"
            @update:modelValue="terapkanTemplate"
          />

          <!-- Makroskopis -->
          <div class="flex flex-col gap-3 p-3 border rounded-lg border-grey-75">
            <div class="flex items-center justify-between">
              <div class="font-semibold text-opensimrs-400">1. Makroskopis</div>
              <span class="text-xs text-grey-400">{{ kasus.waktuMakroskopis ? `${waktuPa(kasus.waktuMakroskopis)} · ${kasus.petugasMakroskopis ?? ""}` : "Belum diisi" }}</span>
            </div>
            <CustomTextArea v-model="form.makroskopis" label="Deskripsi makroskopis" placeholder="Jumlah, ukuran, warna, konsistensi, penampang, jumlah kaset" height="h-28" :disabled="!bisaMakro" />
            <div class="grid grid-cols-3 gap-4">
              <CustomInputNumber v-model="form.jumlahBlok" label="Jumlah blok / kaset" :min="0" :max="100" :disabled="!bisaMakro" />
              <CustomInputNumber v-model="form.jumlahSlide" label="Jumlah slide" :min="0" :max="200" :disabled="!bisaMakro" />
              <CustomSelect
                v-model="form.petugasMakroskopis"
                label="Petugas makroskopis"
                placeHolder="Kosong = pengguna login"
                :options="[...teknisi, ...dokter].map((p) => ({ value: p.nama, label: p.nama }))"
                optionValue="value"
                optionLabel="label"
                :showFilter="false"
                :disabled="!bisaMakro"
              />
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <div v-for="(g, n) in form.gambarMakro" :key="n" class="relative">
                <img :src="g.data" :alt="g.nama" class="object-cover w-24 h-24 border rounded-lg border-grey-75" />
                <button v-if="bisaMakro" type="button" class="absolute -top-2 -right-2 text-danger-300" title="Hapus foto" @click="form.gambarMakro.splice(n, 1)">
                  <PhXCircle :size="20" weight="fill" />
                </button>
              </div>
              <label v-if="bisaMakro" class="flex items-center gap-2 px-3 py-2 text-sm border border-dashed rounded-lg cursor-pointer border-opensimrs-300 text-opensimrs-300">
                <PhCamera :size="16" /> Foto makroskopis (opsional, maks. 4)
                <input type="file" accept="image/*" multiple class="hidden" @change="tambahFoto" />
              </label>
            </div>
            <div v-if="bisaMakro" class="flex justify-end">
              <CustomButton label="Simpan Makroskopis" icon="PhFloppyDisk" size="small" @click="simpanMakro" />
            </div>
          </div>

          <!-- Mikroskopis -->
          <div class="flex flex-col gap-3 p-3 border rounded-lg border-grey-75">
            <div class="flex items-center justify-between">
              <div class="font-semibold text-opensimrs-400">2. Mikroskopis</div>
              <span class="text-xs text-grey-400">{{ kasus.waktuMikroskopis ? waktuPa(kasus.waktuMikroskopis) : "Belum diisi" }}</span>
            </div>
            <CustomTextArea v-model="form.mikroskopis" label="Deskripsi mikroskopis" placeholder="Gambaran histologik / sitologik" height="h-32" :disabled="!bisaMikro" />
            <div v-if="bisaMikro" class="flex justify-end">
              <CustomButton label="Simpan Mikroskopis" icon="PhFloppyDisk" size="small" @click="simpanMikro" />
            </div>
          </div>

          <!-- Diagnosis -->
          <div class="flex flex-col gap-3 p-3 border rounded-lg border-grey-75">
            <div class="flex items-center justify-between">
              <div class="font-semibold text-opensimrs-400">3. Kesimpulan / Diagnosis</div>
              <span class="text-xs text-grey-400">{{ kasus.waktuVerifikasi ? `Diverifikasi ${waktuPa(kasus.waktuVerifikasi)} · ${kasus.dokterPaNama}` : kasus.diagnosis ? "Draft — menunggu verifikasi" : "Belum diisi" }}</span>
            </div>
            <CustomTextArea v-model="form.diagnosis" label="Kesimpulan / diagnosis (dicetak tebal)" placeholder="Organ, tindakan: diagnosis" height="h-24" :disabled="!bisaDiagnosis" />
            <div class="grid grid-cols-3 gap-4">
              <label class="flex flex-col gap-1 text-sm font-semibold">
                ICD-O Topografi
                <InputText v-model="form.icdOTopografi" list="pa-icdo-topo" placeholder="mis. C50.9" maxlength="20" class="text-sm font-normal" :disabled="!bisaDiagnosis" />
                <datalist id="pa-icdo-topo"><option v-for="[k, n] in opsiTopografi" :key="k" :value="k">{{ n }}</option></datalist>
              </label>
              <label class="flex flex-col gap-1 text-sm font-semibold">
                ICD-O Morfologi
                <InputText v-model="form.icdOMorfologi" list="pa-icdo-morf" placeholder="mis. 8500/3" maxlength="20" class="text-sm font-normal" :disabled="!bisaDiagnosis" />
                <datalist id="pa-icdo-morf"><option v-for="[k, n] in opsiMorfologi" :key="k" :value="k">{{ n }}</option></datalist>
              </label>
              <label class="flex flex-col gap-1 text-sm font-semibold">
                ICD-10
                <InputText v-model="form.icd10" list="pa-icd10" placeholder="Ketik kode / nama, mis. D24" maxlength="20" class="text-sm font-normal" :disabled="!bisaDiagnosis" @input="cariIcd10" />
                <datalist id="pa-icd10"><option v-for="d in saranIcd10" :key="d.code" :value="d.code">{{ String(d.name).split("~").pop() }}</option></datalist>
                <span v-if="kasus.icd10 && kasus.icd10 === form.icd10" class="text-xs font-normal text-grey-400">{{ String(kasus.icd10Nama ?? "").split("~").pop() }}</span>
              </label>
            </div>
            <CustomTextArea v-model="form.komentar" label="Komentar / saran" placeholder="mis. disarankan pemeriksaan IHK" height="h-16" :disabled="!bisaDiagnosis" />
            <CustomSelect
              v-model="form.dokterPaUuid"
              label="Dokter Spesialis Patologi Anatomi"
              placeHolder="Pilih dokter Sp.PA (Datamaster › Pemeriksaan PA › Petugas)"
              :options="dokter"
              optionValue="uuid"
              optionLabel="nama"
              :showFilter="false"
              :disabled="!bisaDiagnosis"
              required
            />
            <div v-if="bisaDiagnosis" class="flex justify-end">
              <CustomButton label="Simpan Diagnosis (Draft)" icon="PhFloppyDisk" size="small" @click="simpanDiagnosis" />
            </div>
          </div>

          <!-- Arsip -->
          <div v-if="kasus.arsip?.length" class="p-3 border rounded-lg border-grey-75">
            <div class="mb-2 font-semibold text-opensimrs-400">Blok &amp; Slide ({{ kasus.arsip.length }})</div>
            <div class="flex flex-wrap gap-2">
              <span v-for="a in kasus.arsip" :key="a.uuid" class="px-2 py-1 text-xs rounded" :class="[STATUS_ARSIP_PA[a.status]?.bg, STATUS_ARSIP_PA[a.status]?.text]">
                {{ a.kode }}<span v-if="a.pewarnaan"> · {{ a.pewarnaan }}</span><span v-if="a.lokasiRak"> · {{ a.lokasiRak }}</span>
              </span>
            </div>
          </div>
          <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
        </div>
      </template>
      <template #footer>
        <div v-if="kasus" class="flex flex-wrap justify-end gap-2">
          <CustomButton v-if="kasus.arsip?.length" label="Label Kaset/Slide" icon="PhTag" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetakLabel" />
          <CustomButton v-if="kasus.diagnosis && kasus.status !== 'selesai' && (boleh('DIAGNOSIS') || boleh('VERIFIKASI'))" label="Pratinjau Draft" icon="PhFileText" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetak(kasus.uuid, kasus.orderUuid, true)" />
          <CustomButton v-if="kasus.status === 'selesai' && boleh('VERIFIKASI')" label="Revisi / Addendum" icon="PhArrowCounterClockwise" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="(alasanRevisi = ''), (dialogRevisi = true)" />
          <CustomButton v-if="kasus.status === 'selesai' && boleh('CETAK HASIL')" label="Cetak Laporan" icon="PhPrinter" @click="cetak(kasus.uuid, kasus.orderUuid)" />
          <CustomButton v-if="kasus.status === 'verifikasi' && boleh('VERIFIKASI')" label="Verifikasi Sp.PA & Selesai" icon="PhSealCheck" @click="verifikasi" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogRevisi" width="460px" headerBg="bg-danger-300">
      <template #header>Revisi Laporan {{ kasus?.noPa }}</template>
      <template #body>
        <div class="flex flex-col gap-2 pt-4">
          <div class="text-sm text-grey-400">Laporan kembali ke draft dan wajib diverifikasi ulang. Cetakan berikutnya ditandai sebagai revisi.</div>
          <CustomTextArea v-model="alasanRevisi" label="Alasan revisi" placeholder="mis. hasil IHK menambah informasi, koreksi lateralitas" required />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Kembali" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogRevisi = false" />
          <CustomButton label="Buka Revisi" backgroundColor="bg-danger-300" :disabled="!alasanRevisi.trim()" @click="revisi" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
