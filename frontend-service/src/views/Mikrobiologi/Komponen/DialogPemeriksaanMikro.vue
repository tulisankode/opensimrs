<script setup lang="ts">
import { computed, ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { utilsStore } from "@/stores/utils";
import {
  BENTUK_MIKRO,
  GRAM_MIKRO,
  JUMLAH_KOLONI,
  KELOMPOK_MIKRO,
  KULTUR_MIKRO,
  PENANDA_MIKRO,
  PEWARNAAN_MIKRO,
  PELAYANAN_MIKRO,
  SKALA_BTA,
  SKALA_SEL,
  SUMBER_MIKRO,
  bukaVerifikasiMikro,
  dariEpoch,
  daftarDokterMikro,
  daftarMasterMikro,
  detailItemMikro,
  detailOrderMikro,
  gayaItemMikro,
  izinMikro,
  keEpoch,
  laporanSementaraMikro,
  namaSpesimen,
  opsi,
  panelOrganismeMikro,
  simpanHasilMikro,
  terimaSpesimenMikro,
  tolakSpesimenMikro,
  umurMikro,
  verifikasiMikro,
  waktuMikro,
} from "@/stores/penunjang/mikrobiologi";
import { createHasilMikroPdf } from "@/utils/pdf/pdfMikrobiologi/cetakMikrobiologi";

// Lembar kerja satu spesimen: Penerimaan → Pewarnaan → Kultur → Isolat & Uji Kepekaan → Laporan (sementara/final).
// Tahap yang tampil mengikuti master pemeriksaan (dengan_pewarnaan / dengan_kultur / dengan_ast). Panel antibiotik
// terisi otomatis sesuai kelompok organisme; interpretasi S/I/R terisi otomatis dari breakpoint bila tersedia
// (tetap dapat diubah manual). Hasil diinput manual (sumber 'manual'); integrasi LIS/alat menyusul.
const visible = defineModel<boolean>("visible", { default: false });
const props = defineProps<{ itemUuid: string }>();
const emit = defineEmits<{ berubah: [] }>();
const storeUtils = utilsStore();

const boleh = (aksi: string) => izinMikro("Pemeriksaan", aksi);
const item = ref<any>(null);
const tab = ref("penerimaan");
const organisme = ref<any[]>([]);
const antibiotik = ref<any[]>([]);
const dokter = ref<any[]>([]);

// ── Form hasil
type BarisKp = {
  antibiotikUuid: string; kode: string; nama: string; golongan?: string | null; mic: string; zona: number | null;
  interpretasi: string | null; dilaporkan: boolean; manual: boolean; bp?: any;
};
type Isolat = { organismeUuid: string; kelompok?: string; jumlahKoloni: string; koloniCfu: number | null; penanda: string[]; catatan: string; kepekaan: BarisKp[] };
const kosongForm = () => ({
  pewarnaanJenis: "" as string,
  gramTemuan: [] as any[],
  selLeukosit: "",
  selEpitel: "",
  hasilPewarnaan: "",
  kulturStatus: "" as string,
  media: "",
  mulaiInkubasi: null as Date | null,
  lamaInkubasiJam: null as number | null,
  keteranganKultur: "",
  hasilTeks: "",
  laporanSementara: "",
  kesimpulan: "",
  catatan: "",
  isolat: [] as Isolat[],
});
const form = ref(kosongForm());
const berubah = ref(false);
watch(form, () => (berubah.value = true), { deep: true });

const final = computed(() => item.value?.status === "selesai");
const belumDiterima = computed(() => ["menunggu", "ditolak"].includes(item.value?.status));
const kunci = computed(() => !item.value || final.value || belumDiterima.value || !boleh("INPUT HASIL"));
const denganPewarnaan = computed(() => !!item.value?.denganPewarnaan || !!form.value.pewarnaanJenis);
const denganKultur = computed(() => !!item.value?.denganKultur);
const denganAst = computed(() => !!item.value?.denganAst);

// Breakpoint baris (panel kelompok > umum antibiotik) & interpretasi lokal (sama dengan backend).
const bpDari = (p: any) =>
  p && (p.bpZonaS != null || p.bpMicS != null)
    ? { zs: p.bpZonaS, zr: p.bpZonaR, ms: p.bpMicS, mr: p.bpMicR }
    : p && (p.abZonaS != null || p.abMicS != null)
      ? { zs: p.abZonaS, zr: p.abZonaR, ms: p.abMicS, mr: p.abMicR }
      : null;
const tafsir = (r: BarisKp) => {
  const bp = r.bp;
  if (!bp) return null;
  if (r.zona != null && bp.zs != null && bp.zr != null) return r.zona >= bp.zs ? "S" : r.zona <= bp.zr ? "R" : "I";
  const m = /^\s*(<=|>=|<|>|≤|≥)?\s*([0-9]+(?:[.,][0-9]+)?)\s*$/.exec(r.mic ?? "");
  if (m && bp.ms != null && bp.mr != null) {
    const op = m[1] ?? "";
    const n = Number(m[2].replace(",", "."));
    if ([">", ">=", "≥"].includes(op)) return n >= bp.mr ? "R" : null;
    if (["<", "<=", "≤"].includes(op)) return n <= bp.ms ? "S" : null;
    return n <= bp.ms ? "S" : n >= bp.mr ? "R" : "I";
  }
  return null;
};
const ubahNilai = (r: BarisKp) => {
  if (!r.manual) r.interpretasi = tafsir(r);
};
const setSir = (r: BarisKp, v: string) => {
  if (kunci.value) return;
  r.interpretasi = r.interpretasi === v ? null : v;
  r.manual = !!r.interpretasi;
};

const cachePanel = new Map<string, any[]>();
const panelUntuk = async (organismeUuid: string) => {
  const o = organisme.value.find((x) => x.uuid === organismeUuid);
  const k = o?.kelompok ?? organismeUuid;
  if (!cachePanel.has(k)) cachePanel.set(k, (await panelOrganismeMikro(organismeUuid))?.payload ?? []);
  return cachePanel.get(k) ?? [];
};
const barisDariPanel = (p: any): BarisKp => ({
  antibiotikUuid: p.antibiotikUuid, kode: p.kode, nama: p.nama, golongan: p.golongan, mic: "", zona: null, interpretasi: null,
  dilaporkan: true, manual: false, bp: bpDari(p),
});

const isiForm = async () => {
  const h = item.value?.hasil ?? {};
  const f = kosongForm();
  Object.assign(f, {
    pewarnaanJenis: h.pewarnaanJenis ?? item.value?.denganPewarnaan ?? "",
    gramTemuan: (h.gramTemuan ?? []).map((g: any) => ({ ...g })),
    selLeukosit: h.selLeukosit ?? "",
    selEpitel: h.selEpitel ?? "",
    hasilPewarnaan: h.hasilPewarnaan ?? "",
    kulturStatus: h.kulturStatus ?? (item.value?.denganKultur ? "dalam_proses" : ""),
    media: h.media ?? "",
    mulaiInkubasi: dariEpoch(h.mulaiInkubasi),
    lamaInkubasiJam: h.lamaInkubasiJam ?? null,
    keteranganKultur: h.keteranganKultur ?? "",
    hasilTeks: h.hasilTeks ?? "",
    laporanSementara: h.laporanSementara ?? "",
    kesimpulan: h.kesimpulan ?? "",
    catatan: h.catatan ?? "",
  });
  f.isolat = [];
  for (const x of h.isolat ?? []) {
    const panel = x.organismeUuid ? await panelUntuk(x.organismeUuid) : [];
    f.isolat.push({
      organismeUuid: x.organismeUuid ?? "",
      kelompok: x.kelompok,
      jumlahKoloni: x.jumlahKoloni ?? "",
      koloniCfu: x.koloniCfu ?? null,
      penanda: [...(x.penanda ?? [])],
      catatan: x.catatan ?? "",
      kepekaan: (x.kepekaan ?? []).map((k: any) => ({
        antibiotikUuid: k.antibiotikUuid, kode: k.kode, nama: k.nama, golongan: k.golongan, mic: k.mic ?? "", zona: k.zona ?? null,
        interpretasi: k.interpretasi ?? null, dilaporkan: k.dilaporkan !== false, manual: !!k.interpretasi,
        bp: bpDari(panel.find((p: any) => p.antibiotikUuid === k.antibiotikUuid)),
      })),
    });
  }
  form.value = f;
  setTimeout(() => (berubah.value = false));
};

const muat = async () => {
  if (!props.itemUuid) return;
  storeUtils.setLoading(true);
  try {
    if (!organisme.value.length) {
      const [o, a, d] = await Promise.all([
        daftarMasterMikro("organisme", { limit: 1000, status: "aktif" }),
        daftarMasterMikro("antibiotik", { limit: 1000, status: "aktif" }),
        daftarDokterMikro(),
      ]);
      organisme.value = o?.payload?.data ?? [];
      antibiotik.value = a?.payload?.data ?? [];
      dokter.value = d?.payload ?? [];
    }
    const res = await detailItemMikro(props.itemUuid);
    if (!res?.payload) return;
    item.value = res.payload;
    await isiForm();
    if (!final.value && !belumDiterima.value && tab.value === "penerimaan") tab.value = denganPewarnaan.value ? "pewarnaan" : denganKultur.value ? "kultur" : "laporan";
    if (belumDiterima.value) tab.value = "penerimaan";
    dokterMikro.value = item.value?.hasil?.dokterMikroUuid ?? dokter.value.find((x) => x.spMk)?.uuid ?? "";
  } finally {
    storeUtils.setLoading(false);
  }
};
watch(visible, (v) => {
  if (v) {
    tab.value = "penerimaan";
    item.value = null;
    resetTerima();
    muat();
  }
});

// ── Penerimaan / penolakan spesimen
const terimaForm = ref<any>({});
const resetTerima = () =>
  (terimaForm.value = { waktuAmbil: null as Date | null, waktuTerima: new Date(), diambilOleh: "", volume: "", wadah: "", kualitas: "", catatan: "", lokasiSpesimen: "" });
const alasanTolak = ref("");
const ALASAN_TOLAK = [
  "Wadah tidak steril / bocor",
  "Volume spesimen tidak mencukupi",
  "Label / identitas tidak sesuai",
  "Transport > 2 jam tanpa media transpor",
  "Spesimen tidak sesuai permintaan",
  "Sputum tidak representatif (saliva)",
];
const terima = async () => {
  const t = terimaForm.value;
  storeUtils.setLoading(true);
  try {
    const res = await terimaSpesimenMikro(props.itemUuid, {
      waktuAmbil: keEpoch(t.waktuAmbil), waktuTerima: keEpoch(t.waktuTerima), diambilOleh: t.diambilOleh, volume: t.volume, wadah: t.wadah,
      kualitas: t.kualitas, catatan: t.catatan, lokasiSpesimen: t.lokasiSpesimen || undefined,
    });
    if (res?.payload) {
      emit("berubah");
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const tolak = async () => {
  if (!alasanTolak.value.trim()) return;
  storeUtils.setLoading(true);
  try {
    const res = await tolakSpesimenMikro(props.itemUuid, alasanTolak.value.trim());
    if (res?.payload) {
      alasanTolak.value = "";
      emit("berubah");
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Pewarnaan
const tambahTemuan = () => form.value.gramTemuan.push({ sifat: "negatif", bentuk: "batang", susunan: "", jumlah: "+1" });
const OPSI_BENTUK_GRAM = ["kokus", "batang", "kokobasil", "diplokokus", "ragi / pseudohifa", "spiral"];
const OPSI_SUSUNAN = ["", "bergerombol", "berantai", "berpasangan", "intrasel", "tunggal"];

// ── Isolat & AST
const opsiOrganisme = computed(() => organisme.value.map((o) => ({ value: o.uuid, label: o.nama, gram: GRAM_MIKRO[o.gram] ?? o.gram })));
const namaOrg = (uuid: string) => organisme.value.find((o) => o.uuid === uuid);
const tambahIsolat = () =>
  form.value.isolat.push({ organismeUuid: "", jumlahKoloni: "", koloniCfu: null, penanda: [], catatan: "", kepekaan: [] });
const pilihOrganisme = async (x: Isolat, uuid: string) => {
  x.organismeUuid = uuid;
  x.kelompok = namaOrg(uuid)?.kelompok;
  if (denganAst.value && uuid && !x.kepekaan.some((k) => k.mic || k.zona != null || k.interpretasi)) {
    x.kepekaan = (await panelUntuk(uuid)).map(barisDariPanel);
  }
};
const isiPanel = async (x: Isolat) => {
  if (!x.organismeUuid) return;
  const ada = new Set(x.kepekaan.map((k) => k.antibiotikUuid));
  x.kepekaan.push(...(await panelUntuk(x.organismeUuid)).filter((p: any) => !ada.has(p.antibiotikUuid)).map(barisDariPanel));
};
const abTambahan = ref<Record<number, string>>({});
const opsiAbTambahan = (x: Isolat) =>
  antibiotik.value.filter((a) => !x.kepekaan.some((k) => k.antibiotikUuid === a.uuid)).map((a) => ({ value: a.uuid, label: `${a.kode} — ${a.nama}` }));
const tambahAb = (x: Isolat, n: number) => {
  const a = antibiotik.value.find((y) => y.uuid === abTambahan.value[n]);
  if (!a) return;
  x.kepekaan.push({
    antibiotikUuid: a.uuid, kode: a.kode, nama: a.nama, golongan: a.golongan, mic: "", zona: null, interpretasi: null, dilaporkan: true, manual: false,
    bp: a.bpZonaS != null || a.bpMicS != null ? { zs: a.bpZonaS, zr: a.bpZonaR, ms: a.bpMicS, mr: a.bpMicR } : null,
  });
  abTambahan.value[n] = "";
};
const WARNA_SIR: Record<string, string> = { S: "bg-[#D1FADF] text-[#027A48] border-[#027A48]", I: "bg-[#FEF0C7] text-[#B54708] border-[#B54708]", R: "bg-[#FEE4E2] text-[#D92D20] border-[#D92D20]" };

// ── Simpan & laporan
const payload = () => {
  const f = form.value;
  return {
    pewarnaanJenis: f.pewarnaanJenis || null,
    gramTemuan: f.pewarnaanJenis === "gram" ? f.gramTemuan.filter((g) => g.sifat || g.bentuk) : [],
    selLeukosit: f.selLeukosit,
    selEpitel: f.selEpitel,
    hasilPewarnaan: f.hasilPewarnaan,
    kulturStatus: denganKultur.value ? f.kulturStatus || null : undefined,
    media: f.media,
    mulaiInkubasi: keEpoch(f.mulaiInkubasi) ?? null,
    lamaInkubasiJam: f.lamaInkubasiJam,
    keteranganKultur: f.keteranganKultur,
    hasilTeks: f.hasilTeks,
    laporanSementara: f.laporanSementara,
    kesimpulan: f.kesimpulan,
    catatan: f.catatan,
    isolat: denganKultur.value
      ? f.isolat
          .filter((x) => x.organismeUuid)
          .map((x) => ({
            organismeUuid: x.organismeUuid,
            jumlahKoloni: x.jumlahKoloni,
            koloniCfu: x.koloniCfu,
            penanda: x.penanda,
            catatan: x.catatan,
            kepekaan: x.kepekaan
              .filter((k) => k.mic || k.zona != null || k.interpretasi)
              .map((k) => ({ antibiotikUuid: k.antibiotikUuid, mic: k.mic, zona: k.zona, interpretasi: k.interpretasi, dilaporkan: k.dilaporkan })),
          }))
      : undefined,
  };
};
const galatSimpan = ref("");
const simpan = async (diam = false) => {
  if (kunci.value) return true;
  galatSimpan.value = "";
  if (form.value.isolat.some((x) => !x.organismeUuid)) {
    tab.value = "isolat";
    galatSimpan.value = "Pilih organisme pada setiap isolat (atau hapus isolat kosong)";
    return false;
  }
  storeUtils.setLoading(true);
  try {
    const res = await simpanHasilMikro(props.itemUuid, payload(), diam);
    if (!res?.payload) return false;
    item.value = res.payload;
    await isiForm();
    emit("berubah");
    return true;
  } finally {
    storeUtils.setLoading(false);
  }
};

// Usulan teks laporan sementara dari isian pewarnaan & kultur.
const susunSementara = () => {
  const f = form.value;
  const bagian: string[] = [];
  if (f.pewarnaanJenis === "gram" && f.gramTemuan.length) {
    bagian.push(`Pewarnaan Gram: ${f.gramTemuan.map((g) => [g.bentuk, g.sifat ? `Gram ${g.sifat}` : "", g.susunan, g.jumlah ? `(${g.jumlah})` : ""].filter(Boolean).join(" ")).join("; ")}`);
  } else if (f.pewarnaanJenis && f.hasilPewarnaan) bagian.push(`${PEWARNAAN_MIKRO[f.pewarnaanJenis]}: ${f.hasilPewarnaan}`);
  if (f.selLeukosit) bagian.push(`Leukosit ${f.selLeukosit}`);
  if (denganKultur.value) {
    const org = f.isolat.map((x) => namaOrg(x.organismeUuid)?.nama).filter(Boolean);
    if (org.length) bagian.push(`Kultur: tumbuh ${org.join(", ")}${denganAst.value ? "; uji kepekaan dalam proses" : ""}`);
    else bagian.push(`Kultur: ${f.kulturStatus ? KULTUR_MIKRO[f.kulturStatus].toLowerCase() : "dalam proses inkubasi"}`);
  }
  f.laporanSementara = `${bagian.join(". ")}.`;
};

const cetak = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await detailOrderMikro(item.value.orderUuid);
    if (res?.payload) createHasilMikroPdf(res.payload, props.itemUuid);
  } finally {
    storeUtils.setLoading(false);
  }
};
const terbitSementara = async () => {
  if (!form.value.laporanSementara.trim()) susunSementara();
  if (!(await simpan(true))) return;
  storeUtils.setLoading(true);
  try {
    const res = await laporanSementaraMikro(props.itemUuid, form.value.laporanSementara);
    if (res?.payload) {
      item.value = res.payload;
      await isiForm();
      emit("berubah");
      await cetak();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const dokterMikro = ref("");
const verifikasi = async () => {
  if (!dokterMikro.value) return;
  if (!(await simpan(true))) return;
  storeUtils.setLoading(true);
  try {
    const res = await verifikasiMikro(props.itemUuid, { dokterMikroUuid: dokterMikro.value, kesimpulan: form.value.kesimpulan });
    if (res?.payload) {
      item.value = res.payload;
      await isiForm();
      emit("berubah");
      await cetak();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const dialogBuka = ref(false);
const alasanBuka = ref("");
const bukaVerifikasi = async () => {
  if (!alasanBuka.value.trim()) return;
  storeUtils.setLoading(true);
  try {
    const res = await bukaVerifikasiMikro(props.itemUuid, alasanBuka.value.trim());
    if (res?.payload) {
      dialogBuka.value = false;
      alasanBuka.value = "";
      item.value = res.payload;
      await isiForm();
      emit("berubah");
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const JK: Record<string, string> = { Male: "Laki-laki", Female: "Perempuan", "Laki-laki": "Laki-laki", Perempuan: "Perempuan" };
const o = computed(() => item.value?.order ?? {});
</script>

<template>
  <CustomDialog v-model:visible="visible" width="1180px">
    <template #header>
      Lembar Kerja Mikrobiologi {{ item?.noMikro ? `· ${item.noMikro}` : "" }}
    </template>
    <template #body>
      <div v-if="item" class="flex flex-col gap-3 pt-4 text-sm">
        <!-- Identitas & order -->
        <div class="grid grid-cols-3 gap-x-6 gap-y-1 p-3 rounded-lg bg-opensimrs-50">
          <div><span class="text-grey-400">Pasien:</span> <b>{{ o.pasien?.name ?? o.namaPasien }}</b> ({{ o.noRm }})</div>
          <div><span class="text-grey-400">Umur / JK:</span> {{ umurMikro(o.pasien?.birthDate) }} / {{ JK[o.pasien?.gender] ?? "-" }}</div>
          <div>
            <span class="px-2 py-0.5 rounded-full text-xs font-semibold" :class="[gayaItemMikro(item.status)?.bg, gayaItemMikro(item.status)?.text]">{{ gayaItemMikro(item.status)?.label }}</span>
            <span v-if="o.cito" class="px-1.5 ml-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
          </div>
          <div><span class="text-grey-400">Pemeriksaan:</span> <b>{{ item.nama }}</b></div>
          <div><span class="text-grey-400">Spesimen:</span> <b>{{ namaSpesimen(item.jenisSpesimen) }}</b> {{ item.lokasiSpesimen ? `· ${item.lokasiSpesimen}` : "" }}</div>
          <div><span class="text-grey-400">Order:</span> {{ o.noOrder }} · {{ SUMBER_MIKRO[o.sumber] }} {{ PELAYANAN_MIKRO[o.pelayanan] }}</div>
          <div class="col-span-2"><span class="text-grey-400">Klinis:</span> {{ o.klinis || "-" }}</div>
          <div><span class="text-grey-400">Dokter pengirim:</span> {{ o.dokterPengirim ?? "-" }}</div>
          <div class="col-span-3"><span class="text-grey-400">Antibiotik yang sedang diberikan:</span> <b>{{ o.antibiotikSedang || "-" }}</b></div>
        </div>

        <Tabs v-model:value="tab">
          <TabList>
            <Tab value="penerimaan">1. Penerimaan</Tab>
            <Tab v-if="denganPewarnaan" value="pewarnaan" :disabled="belumDiterima">2. Pewarnaan</Tab>
            <Tab v-if="denganKultur" value="kultur" :disabled="belumDiterima">3. Kultur</Tab>
            <Tab v-if="denganKultur" value="isolat" :disabled="belumDiterima">4. Isolat &amp; Uji Kepekaan</Tab>
            <Tab value="laporan" :disabled="belumDiterima">5. Laporan</Tab>
          </TabList>
          <TabPanels class="!px-0">
            <!-- 1. Penerimaan -->
            <TabPanel value="penerimaan">
              <div v-if="belumDiterima && boleh('INPUT HASIL')" class="grid grid-cols-2 gap-6">
                <div class="flex flex-col gap-3">
                  <div class="font-semibold">Terima Spesimen</div>
                  <div class="grid grid-cols-2 gap-3">
                    <CustomDatePicker v-model="terimaForm.waktuAmbil" label="Waktu pengambilan" showTime hourFormat="24" :maxDate="new Date()" />
                    <CustomDatePicker v-model="terimaForm.waktuTerima" label="Waktu diterima lab" showTime hourFormat="24" :maxDate="new Date()" />
                    <CustomTextfield v-model="terimaForm.diambilOleh" label="Diambil oleh" placeholder="Nama petugas / perawat" :maxLength="100" />
                    <CustomTextfield v-model="terimaForm.lokasiSpesimen" label="Sumber / lokasi" :placeholder="item.lokasiSpesimen ?? 'mis. vena mediana kanan'" :maxLength="200" />
                    <CustomTextfield v-model="terimaForm.volume" label="Volume / jumlah" placeholder="mis. 10 mL, 2 botol" :maxLength="50" />
                    <CustomTextfield v-model="terimaForm.wadah" label="Wadah" placeholder="mis. pot steril, botol aerob" :maxLength="100" />
                    <CustomTextfield v-model="terimaForm.kualitas" label="Kualitas spesimen" placeholder="mis. baik, purulen" :maxLength="100" class="col-span-2" />
                  </div>
                  <div class="flex justify-end">
                    <CustomButton label="Terima Spesimen" icon="PhCheckCircle" @click="terima" />
                  </div>
                </div>
                <div class="flex flex-col gap-3 p-3 border rounded-lg border-danger-100">
                  <div class="font-semibold text-danger-300">Tolak Spesimen</div>
                  <div class="flex flex-wrap gap-1">
                    <button
                      v-for="a in ALASAN_TOLAK"
                      :key="a"
                      type="button"
                      class="px-2 py-1 text-xs border rounded-full border-grey-100 hover:bg-danger-50"
                      @click="alasanTolak = a"
                    >
                      {{ a }}
                    </button>
                  </div>
                  <CustomTextArea v-model="alasanTolak" label="Alasan penolakan" placeholder="Alasan & tindak lanjut (mis. minta pengambilan ulang)" />
                  <div class="flex justify-end">
                    <CustomButton label="Tolak Spesimen" icon="PhXCircle" backgroundColor="bg-danger-300" :disabled="!alasanTolak.trim()" @click="tolak" />
                  </div>
                </div>
              </div>
              <div v-else-if="belumDiterima" class="text-grey-400">Spesimen belum diterima.</div>
              <div class="mt-3">
                <div class="mb-1 font-semibold">Riwayat Spesimen</div>
                <div v-if="!item.riwayatSpesimen?.length" class="text-grey-400">Belum ada.</div>
                <DataTable v-else :value="item.riwayatSpesimen" class="text-xs" stripedRows>
                  <Column header="No. Mikro" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ s.noMikro ?? "-" }}</template></Column>
                  <Column header="Diambil" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ s.waktuAmbil ? waktuMikro(s.waktuAmbil) : "-" }} {{ s.diambilOleh ? `· ${s.diambilOleh}` : "" }}</template></Column>
                  <Column header="Diterima" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ waktuMikro(s.waktuTerima) }} · {{ s.diterimaOleh ?? "-" }}</template></Column>
                  <Column header="Spesimen" headerClass="bg-opensimrs-50">
                    <template #body="{ data: s }">{{ [s.lokasiSpesimen, s.volume, s.wadah, s.kualitas].filter(Boolean).join(" · ") || "-" }}</template>
                  </Column>
                  <Column header="Status" headerClass="bg-opensimrs-50">
                    <template #body="{ data: s }">
                      <span :class="s.status === 'ditolak' ? 'text-danger-300 font-semibold' : 'text-success-300 font-semibold'">{{ s.status === "ditolak" ? "Ditolak" : "Diterima" }}</span>
                      <div v-if="s.alasanTolak" class="text-danger-300">{{ s.alasanTolak }}</div>
                    </template>
                  </Column>
                </DataTable>
              </div>
            </TabPanel>

            <!-- 2. Pewarnaan -->
            <TabPanel value="pewarnaan">
              <div class="flex flex-col gap-3">
                <div class="grid grid-cols-3 gap-3">
                  <CustomSelect v-model="form.pewarnaanJenis" label="Jenis pewarnaan" :options="opsi(PEWARNAAN_MIKRO)" optionValue="value" optionLabel="label" :showFilter="false" :disabled="kunci" />
                  <CustomSelect v-model="form.selLeukosit" label="Leukosit (PMN)" :options="SKALA_SEL.map((s) => ({ value: s, label: s }))" optionValue="value" optionLabel="label" :showFilter="false" :disabled="kunci" />
                  <CustomSelect v-model="form.selEpitel" label="Sel epitel skuamosa" :options="SKALA_SEL.map((s) => ({ value: s, label: s }))" optionValue="value" optionLabel="label" :showFilter="false" :disabled="kunci" />
                </div>
                <div v-if="form.pewarnaanJenis === 'gram'" class="flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <div class="font-semibold">Temuan Gram (bentuk &amp; sifat)</div>
                    <CustomButton v-if="!kunci" icon="PhPlus" label="Temuan" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="tambahTemuan" />
                  </div>
                  <div v-if="!form.gramTemuan.length" class="text-grey-400">Belum ada temuan (mis. tidak ditemukan bakteri).</div>
                  <div v-for="(g, n) in form.gramTemuan" :key="n" class="grid items-center grid-cols-12 gap-2">
                    <Select v-model="g.jumlah" :options="['Jarang', '+1', '+2', '+3', '+4']" placeholder="Jumlah" class="col-span-2 text-sm" :disabled="kunci" aria-label="Jumlah" />
                    <Select v-model="g.bentuk" :options="OPSI_BENTUK_GRAM" placeholder="Bentuk" class="col-span-3 text-sm" :disabled="kunci" aria-label="Bentuk" />
                    <Select
                      v-model="g.sifat"
                      :options="[{ v: 'positif', l: 'Gram positif' }, { v: 'negatif', l: 'Gram negatif' }]"
                      optionValue="v"
                      optionLabel="l"
                      placeholder="Sifat Gram"
                      class="col-span-3 text-sm"
                      :disabled="kunci"
                      aria-label="Sifat Gram"
                    />
                    <Select v-model="g.susunan" :options="OPSI_SUSUNAN" placeholder="Susunan" class="col-span-3 text-sm" :disabled="kunci" aria-label="Susunan" />
                    <CustomButton v-if="!kunci" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="form.gramTemuan.splice(n, 1)" />
                  </div>
                </div>
                <div v-if="form.pewarnaanJenis === 'bta'" class="flex flex-wrap gap-2">
                  <span class="text-xs text-grey-400">Skala IUATLD:</span>
                  <button
                    v-for="s in SKALA_BTA"
                    :key="s"
                    type="button"
                    :disabled="kunci"
                    class="px-2 py-0.5 text-xs border rounded-full"
                    :class="form.hasilPewarnaan.startsWith(`BTA ${s}`) ? 'bg-opensimrs-300 text-white border-opensimrs-300' : 'border-grey-100'"
                    @click="form.hasilPewarnaan = `BTA ${s}`"
                  >
                    {{ s }}
                  </button>
                </div>
                <CustomTextArea v-model="form.hasilPewarnaan" label="Keterangan / hasil mikroskopis" placeholder="mis. Kokus Gram positif bergerombol, banyak leukosit" :disabled="kunci" />
              </div>
            </TabPanel>

            <!-- 3. Kultur -->
            <TabPanel value="kultur">
              <div class="grid grid-cols-3 gap-3">
                <CustomSelect v-model="form.kulturStatus" label="Hasil kultur" :options="opsi(KULTUR_MIKRO)" optionValue="value" optionLabel="label" :showFilter="false" :disabled="kunci" />
                <CustomDatePicker v-model="form.mulaiInkubasi" label="Mulai inkubasi" showTime hourFormat="24" :disabled="kunci" />
                <label class="flex flex-col gap-1 text-sm font-semibold">
                  Lama inkubasi (jam)
                  <InputNumber v-model="form.lamaInkubasiJam" :min="0" :max="2000" :disabled="kunci" inputClass="w-full" />
                </label>
                <CustomTextfield v-model="form.media" label="Media" placeholder="mis. Agar darah, MacConkey, Sabouraud" :maxLength="200" :disabled="kunci" class="col-span-3" />
                <CustomTextArea v-model="form.keteranganKultur" label="Keterangan kultur" placeholder="mis. Tumbuh >3 jenis koloni — kemungkinan kontaminasi" :disabled="kunci" class="col-span-3" />
              </div>
              <div v-if="form.kulturStatus === 'tumbuh'" class="mt-2 text-xs text-grey-400">Lanjutkan identifikasi organisme di tab Isolat &amp; Uji Kepekaan.</div>
            </TabPanel>

            <!-- 4. Isolat & AST -->
            <TabPanel value="isolat">
              <div class="flex flex-col gap-4">
                <div class="flex items-center justify-between">
                  <div class="text-xs text-grey-400">
                    Satu spesimen dapat berisi lebih dari satu isolat. Panel antibiotik terisi otomatis sesuai kelompok organisme; isi MIC atau zona hambat —
                    interpretasi terisi otomatis bila breakpoint tersedia, atau klik S / I / R.
                  </div>
                  <CustomButton v-if="!kunci" icon="PhPlus" label="Tambah Isolat" @click="tambahIsolat" />
                </div>
                <div v-if="!form.isolat.length" class="text-grey-400">Belum ada isolat.</div>
                <div v-for="(x, n) in form.isolat" :key="n" class="p-3 border rounded-lg border-grey-75">
                  <div class="grid items-end grid-cols-12 gap-2">
                    <div class="col-span-1 pb-2 font-semibold">Isolat {{ n + 1 }}</div>
                    <label class="flex flex-col col-span-4 gap-1 text-xs font-semibold">
                      Organisme
                      <Select
                        :modelValue="x.organismeUuid"
                        :options="opsiOrganisme"
                        optionValue="value"
                        optionLabel="label"
                        filter
                        placeholder="Pilih organisme"
                        class="w-full text-sm font-normal"
                        :disabled="kunci"
                        @update:modelValue="pilihOrganisme(x, $event)"
                      >
                        <template #option="{ option }">
                          <span><i>{{ option.label }}</i> <span class="text-[10px] text-grey-400">· {{ option.gram }}</span></span>
                        </template>
                      </Select>
                    </label>
                    <label class="flex flex-col col-span-3 gap-1 text-xs font-semibold">
                      Jumlah koloni
                      <Select v-model="x.jumlahKoloni" :options="JUMLAH_KOLONI" editable placeholder="mis. ≥10^5 CFU/mL" class="w-full text-sm font-normal" :disabled="kunci" />
                    </label>
                    <label class="flex flex-col col-span-3 gap-1 text-xs font-semibold">
                      Penanda resistensi
                      <MultiSelect
                        v-model="x.penanda"
                        :options="Object.keys(PENANDA_MIKRO).map((k) => ({ value: k, label: `${k} — ${PENANDA_MIKRO[k]}` }))"
                        optionValue="value"
                        optionLabel="label"
                        display="chip"
                        placeholder="ESBL / MRSA / CRE …"
                        class="w-full text-sm font-normal"
                        :disabled="kunci"
                      />
                    </label>
                    <div class="flex justify-end col-span-1 pb-1">
                      <CustomButton v-if="!kunci" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="form.isolat.splice(n, 1)" />
                    </div>
                  </div>
                  <div v-if="x.organismeUuid" class="mt-1 text-xs text-grey-400">
                    {{ GRAM_MIKRO[namaOrg(x.organismeUuid)?.gram] ?? "" }} {{ BENTUK_MIKRO[namaOrg(x.organismeUuid)?.bentuk] ?? "" }} · Panel:
                    {{ KELOMPOK_MIKRO[x.kelompok ?? namaOrg(x.organismeUuid)?.kelompok] ?? "-" }}
                  </div>
                  <InputText v-model="x.catatan" placeholder="Catatan isolat (opsional), mis. konfirmasi ESBL dengan uji sinergi cakram ganda" class="w-full mt-2 text-xs" :disabled="kunci" />

                  <div v-if="denganAst && x.organismeUuid" class="mt-3">
                    <div class="flex items-center justify-between mb-1">
                      <div class="font-semibold">Uji Kepekaan Antibiotik</div>
                      <div v-if="!kunci" class="flex items-center gap-2">
                        <CustomButton label="Isi panel standar" icon="PhListChecks" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="isiPanel(x)" />
                        <Select v-model="abTambahan[n]" :options="opsiAbTambahan(x)" optionValue="value" optionLabel="label" filter placeholder="Antibiotik lain" class="text-xs w-[220px]" />
                        <CustomButton icon="PhPlus" size="small" :disabled="!abTambahan[n]" @click="tambahAb(x, n)" />
                      </div>
                    </div>
                    <DataTable :value="x.kepekaan" class="text-xs" stripedRows size="small">
                      <Column header="Antibiotik" headerClass="bg-opensimrs-50">
                        <template #body="{ data: k }">
                          <b>{{ k.kode }}</b> {{ k.nama }}
                          <div class="text-[10px] text-grey-400">{{ k.golongan ?? "" }}<span v-if="k.bp"> · BP zona S≥{{ k.bp.zs ?? "-" }} R≤{{ k.bp.zr ?? "-" }}</span></div>
                        </template>
                      </Column>
                      <Column header="MIC (µg/mL)" headerClass="bg-opensimrs-50" class="w-[120px]">
                        <template #body="{ data: k }">
                          <InputText v-model="k.mic" placeholder="mis. ≤0,25" maxlength="20" class="w-[100px] text-xs" :disabled="kunci" @update:modelValue="ubahNilai(k)" />
                        </template>
                      </Column>
                      <Column header="Zona (mm)" headerClass="bg-opensimrs-50" class="w-[100px]">
                        <template #body="{ data: k }">
                          <InputNumber v-model="k.zona" :min="0" :max="100" inputClass="w-[70px] text-xs" :disabled="kunci" @update:modelValue="ubahNilai(k)" />
                        </template>
                      </Column>
                      <Column header="Interpretasi" headerClass="bg-opensimrs-50" class="w-[140px]">
                        <template #body="{ data: k }">
                          <div class="flex gap-1">
                            <button
                              v-for="v in ['S', 'I', 'R']"
                              :key="v"
                              type="button"
                              class="w-8 h-7 text-xs font-bold border rounded"
                              :class="k.interpretasi === v ? WARNA_SIR[v] : 'border-grey-100 text-grey-300'"
                              :disabled="kunci"
                              :aria-label="`${k.nama} ${v}`"
                              @click="setSir(k, v)"
                            >
                              {{ v }}
                            </button>
                          </div>
                        </template>
                      </Column>
                      <Column header="Lapor" headerClass="bg-opensimrs-50" class="w-[60px]">
                        <template #body="{ data: k }"><Checkbox v-model="k.dilaporkan" binary :disabled="kunci" /></template>
                      </Column>
                      <Column header="" headerClass="bg-opensimrs-50" class="w-[50px]">
                        <template #body="{ index }">
                          <CustomButton v-if="!kunci" icon="PhX" size="small" outlined borderColor="border-grey-100" textColor="text-grey-400" @click="x.kepekaan.splice(index, 1)" />
                        </template>
                      </Column>
                    </DataTable>
                    <div class="mt-1 text-[11px] text-grey-400">
                      Baris tanpa MIC/zona/interpretasi tidak disimpan. "Lapor" = ditampilkan pada cetakan hasil (pelaporan berjenjang).
                    </div>
                  </div>
                </div>
              </div>
            </TabPanel>

            <!-- 5. Laporan -->
            <TabPanel value="laporan">
              <div class="flex flex-col gap-3">
                <CustomTextArea
                  v-if="!denganKultur && !item.denganPewarnaan"
                  v-model="form.hasilTeks"
                  label="Hasil pemeriksaan"
                  placeholder="mis. MTB terdeteksi (medium), resistensi rifampisin tidak terdeteksi"
                  :disabled="kunci"
                />
                <div class="flex flex-col gap-1">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-semibold">Laporan sementara</span>
                    <CustomButton v-if="!kunci" label="Susun otomatis" icon="PhMagicWand" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="susunSementara" />
                  </div>
                  <TextArea v-model="form.laporanSementara" rows="2" autoResize placeholder="mis. Batang Gram negatif, kultur dalam proses" :disabled="kunci" class="text-sm" />
                  <div v-if="item.hasil?.sementaraPada" class="text-xs text-grey-400">Terakhir diterbitkan {{ waktuMikro(item.hasil.sementaraPada) }} oleh {{ item.hasil.sementaraOleh }}</div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <CustomTextArea v-model="form.kesimpulan" label="Kesimpulan / interpretasi klinis" placeholder="mis. ISK oleh E. coli penghasil ESBL" :disabled="kunci" />
                  <CustomTextArea v-model="form.catatan" label="Catatan / saran" placeholder="mis. disarankan konsultasi PPRA, ulang kultur setelah terapi" :disabled="kunci" />
                </div>
                <div v-if="final" class="p-3 rounded-lg bg-success-50">
                  <b class="text-success-300">FINAL</b> — diverifikasi {{ waktuMikro(item.hasil?.diverifikasiPada) }} oleh <b>{{ item.hasil?.dokterMikro ?? "-" }}</b>
                  <span class="text-grey-400">({{ item.hasil?.diverifikasiOleh }})</span>
                </div>
                <div v-else-if="!belumDiterima && boleh('VERIFIKASI')" class="flex items-end gap-3 p-3 border rounded-lg border-opensimrs-100">
                  <CustomSelect
                    v-model="dokterMikro"
                    label="Dokter pemverifikasi (Sp.MK)"
                    :options="dokter.map((d) => ({ value: d.uuid, label: `${d.nama}${d.spMk ? ' ★' : ''}` }))"
                    optionValue="value"
                    optionLabel="label"
                    class="grow"
                  />
                  <CustomButton label="Verifikasi & Final" icon="PhSealCheck" :disabled="!dokterMikro" @click="verifikasi" />
                </div>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </template>
    <template #footer>
      <div v-if="item" class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs text-grey-400">
          Sumber data: {{ item.hasil?.sumber === "lis" ? "LIS / alat" : "input manual" }}
          <span v-if="berubah && !kunci" class="ml-2 font-semibold text-warning-300">● Ada perubahan belum disimpan</span>
          <span v-if="galatSimpan" class="ml-2 font-semibold text-danger-300">{{ galatSimpan }}</span>
        </span>
        <div class="flex flex-wrap gap-2">
          <CustomButton v-if="final && boleh('VERIFIKASI')" label="Buka Verifikasi" icon="PhLockOpen" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="dialogBuka = true" />
          <CustomButton
            v-if="item.hasil && ['sementara', 'final'].includes(item.hasil.status) && boleh('CETAK HASIL')"
            label="Cetak"
            icon="PhPrinter"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
            @click="cetak"
          />
          <CustomButton
            v-if="!kunci && boleh('LAPORAN SEMENTARA')"
            label="Terbitkan Laporan Sementara"
            icon="PhFileText"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
            @click="terbitSementara"
          />
          <CustomButton v-if="!kunci" label="Simpan" icon="PhFloppyDisk" @click="simpan()" />
        </div>
      </div>
    </template>
  </CustomDialog>

  <CustomDialog v-model:visible="dialogBuka" width="460px" headerBg="bg-danger-300">
    <template #header>Buka Verifikasi (Revisi Hasil)</template>
    <template #body>
      <div class="flex flex-col gap-2 pt-4">
        <div class="text-sm text-grey-400">Hasil kembali ke status sebelumnya dan dapat direvisi; alasan dicatat pada catatan hasil.</div>
        <CustomTextArea v-model="alasanBuka" label="Alasan revisi" required />
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <CustomButton label="Kembali" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBuka = false" />
        <CustomButton label="Buka Verifikasi" backgroundColor="bg-danger-300" :disabled="!alasanBuka.trim()" @click="bukaVerifikasi" />
      </div>
    </template>
  </CustomDialog>
</template>
