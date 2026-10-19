<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { NAMA_BULAN, tanggalAk, waktuAk } from "@/stores/penunjang/akuntansi";
import {
  GAYA_STATUS_REMUN,
  daftarPenerima,
  daftarPraktisi,
  daftarSkema,
  izinRemunerasi,
  keSnake,
  referensiRemunerasi,
  sahkanSkema,
  simpanPenerima,
  simpanSkema,
} from "@/stores/penunjang/remunerasi";

// Konfigurasi Remunerasi (STD-0032): skema jaspel BERVERSI per faskes & penerima (dokter/nakes) beserta indeksnya.
// Skema draf dapat diubah; setelah disahkan terkunci (perubahan = versi baru) sehingga periode lama tetap dapat
// dijelaskan dengan versi yang dipakai. Nilai bawaan hanya CONTOH dan wajib ditetapkan/disahkan bagian keuangan.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinRemunerasi("konfigurasi", aksi);
const tab = ref("skema");
const ref_ = ref<any>({ profesi: [], kategori: [], jenisLayanan: [], jenisIndeks: [], skemaContoh: null, peringatanContoh: "" });
const skema = ref<any[]>([]);
const penerima = ref<any[]>([]);
const praktisi = ref<any[]>([]);
const namaOpsi = (daftar: any[], kode: string) => daftar.find((x: any) => x.kode === kode)?.nama ?? kode;
const kini = new Date();
const OPSI_TAHUN = Array.from({ length: 6 }, (_, i) => ({ value: kini.getFullYear() + 1 - i, label: String(kini.getFullYear() + 1 - i) }));
const OPSI_BULAN = NAMA_BULAN.map((n, i) => ({ value: i + 1, label: n }));

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const [s, p] = await Promise.all([daftarSkema(), daftarPenerima()]);
    skema.value = s?.payload ?? [];
    penerima.value = p?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Skema
const dialogSkema = ref(false);
const form = ref<any>({});
const galat = ref("");
const dariKonfigurasi = (k: any) => ({
  porsi: (k?.porsi ?? []).map((p: any) => ({ jenisLayanan: p.jenisLayanan, kategori: p.kategori, persen: p.persen })),
  persenLangsung: k?.persenLangsung ?? "60.00",
  persenKebersamaan: k?.persenKebersamaan ?? "40.00",
  indeksProfesi: keSnake(k?.indeksProfesi ?? {}),
  bobotIndeks: keSnake(k?.bobotIndeks ?? {}),
  kinerjaMin: k?.kinerjaMin ?? "0.00",
  kinerjaMaks: k?.kinerjaMaks ?? "150.00",
});
const bukaSkema = (s?: any, salin = false) => {
  galat.value = "";
  const sumber = s ?? (skema.value[0] ? skema.value[0] : null);
  const dasar = sumber ? dariKonfigurasi(sumber.konfigurasi) : dariKonfigurasi(ref_.value.skemaContoh);
  const berlaku = s && !salin ? new Date((Number(s.berlakuMulai) + 7 * 3600) * 1000) : new Date(kini.getFullYear(), kini.getMonth(), 1);
  form.value = {
    uuid: s && !salin ? s.uuid : null,
    nama: s && !salin ? s.nama : sumber ? `${sumber.nama} (revisi)` : "Skema jaspel (contoh)",
    tahun: s && !salin ? berlaku.getUTCFullYear() : berlaku.getFullYear(),
    bulan: s && !salin ? berlaku.getUTCMonth() + 1 : berlaku.getMonth() + 1,
    contoh: s ? !!s.contoh : true,
    catatan: s && !salin ? (s.catatan ?? "") : "",
    ...dasar,
  };
  dialogSkema.value = true;
};
const tambahPorsi = () => form.value.porsi.push({ jenisLayanan: "*", kategori: "tindakan", persen: "0" });
const simpanSkema_ = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.nama?.trim()) return (galat.value = "Nama skema wajib diisi");
  storeUtils.setLoading(true);
  try {
    const data: any = {
      nama: f.nama.trim(),
      tahun: f.tahun,
      bulan: f.bulan,
      catatan: f.catatan ?? "",
      konfigurasi: {
        porsi: f.porsi,
        persenLangsung: f.persenLangsung,
        persenKebersamaan: f.persenKebersamaan,
        indeksProfesi: f.indeksProfesi,
        bobotIndeks: f.bobotIndeks,
        kinerjaMin: f.kinerjaMin,
        kinerjaMaks: f.kinerjaMaks,
      },
    };
    if (!f.uuid) data.contoh = f.contoh;
    if (await simpanSkema(data, f.uuid ?? undefined)) {
      dialogSkema.value = false;
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const dialogSah = ref(false);
const sah = ref<any>({});
const bukaSah = (s: any) => {
  sah.value = { uuid: s.uuid, versi: s.versi, contoh: s.contoh, dasar: "", konfirmasi: false };
  dialogSah.value = true;
};
const sahkan = async () => {
  const s = sah.value;
  if (!s.dasar.trim()) return alert("Dasar pengesahan (mis. nomor & tanggal SK direksi) wajib diisi");
  if (s.contoh && !s.konfirmasi) return alert("Centang konfirmasi bahwa nilai contoh sudah ditetapkan bagian keuangan/direksi");
  storeUtils.setLoading(true);
  try {
    if (await sahkanSkema(s.uuid, { dasarPengesahan: s.dasar.trim(), konfirmasiContoh: s.contoh ? s.konfirmasi : undefined })) {
      dialogSah.value = false;
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Penerima
const dialogPenerima = ref(false);
const fp = ref<any>({});
const opsiPraktisi = computed(() => {
  const ada = new Set(penerima.value.map((p) => p.practitionerUuid));
  return praktisi.value.filter((p) => !ada.has(p.uuid) || p.uuid === fp.value.practitionerUuid).map((p) => ({ ...p, label: `${p.nama || "(tanpa nama)"}${p.isDoctor ? " — dokter" : ""}` }));
});
const bukaPenerima = async (p?: any) => {
  if (!praktisi.value.length) praktisi.value = (await daftarPraktisi())?.payload ?? [];
  fp.value = p
    ? { ...p, indeks: keSnake(p.indeks), ikutKebersamaan: p.ikutKebersamaan ? "1" : "0", aktif: p.aktif ? "1" : "0" }
    : { practitionerUuid: "", profesi: "dokter_umum", unit: "", indeks: { pendidikan: "0", risiko: "0", jabatan: "0", masa_kerja: "0" }, ikutKebersamaan: "1", aktif: "1", catatan: "" };
  dialogPenerima.value = true;
};
const simpanPenerima_ = async () => {
  const f = fp.value;
  if (!f.uuid && !f.practitionerUuid) return alert("Pilih praktisi");
  storeUtils.setLoading(true);
  try {
    const data = { practitionerUuid: f.practitionerUuid, profesi: f.profesi, unit: f.unit ?? "", indeks: f.indeks, ikutKebersamaan: f.ikutKebersamaan === "1", aktif: f.aktif === "1", catatan: f.catatan ?? "" };
    if (await simpanPenerima(data, f.uuid)) {
      dialogPenerima.value = false;
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const YA_TIDAK = [
  { value: "1", label: "Ya" },
  { value: "0", label: "Tidak" },
];

onMounted(async () => {
  const r = await referensiRemunerasi();
  if (r?.payload) ref_.value = r.payload;
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Konfigurasi Remunerasi</h1>
          <CustomButton v-if="tab === 'skema' && boleh('CREATE')" icon="PhPlus" label="Versi Skema Baru" @click="bukaSkema(skema[0], true)" />
          <CustomButton v-if="tab === 'penerima' && boleh('CREATE')" icon="PhPlus" label="Tambah Penerima" @click="bukaPenerima()" />
        </PageToolbar>
      </template>
      <template #content>
        <Tabs :value="tab" @update:value="(v: any) => (tab = v)">
          <TabList>
            <Tab value="skema">Skema Jaspel</Tab>
            <Tab value="penerima">Penerima & Indeks ({{ penerima.length }})</Tab>
          </TabList>
        </Tabs>
        <div class="px-1 py-2 text-xs text-[#B54708]">{{ ref_.peringatanContoh }}</div>

        <template v-if="tab === 'skema'">
          <NoData v-if="!skema.length" />
          <DataTable v-else :value="skema" stripedRows class="text-xs">
            <Column header="Versi" field="versi" headerClass="bg-opensimrs-50" />
            <Column header="Nama" headerClass="bg-opensimrs-50">
              <template #body="{ data: s }">{{ s.nama }}<div v-if="s.contoh" class="text-[11px] text-[#B54708]">berasal dari nilai contoh</div></template>
            </Column>
            <Column header="Berlaku mulai" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ tanggalAk(s.berlakuMulai) }}</template></Column>
            <Column header="Porsi langsung / kebersamaan" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ s.konfigurasi.persenLangsung }}% / {{ s.konfigurasi.persenKebersamaan }}%</template></Column>
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data: s }">
                <span :class="['px-2 py-0.5 rounded-full', GAYA_STATUS_REMUN[s.status] ?? GAYA_STATUS_REMUN.draf]">{{ s.status === "disahkan" ? "Disahkan" : "Draf" }}</span>
                <div v-if="s.disahkanOleh" class="text-[11px] text-grey-400">{{ s.disahkanOleh }} · {{ waktuAk(s.disahkanPada) }} · {{ s.dasarPengesahan }}</div>
              </template>
            </Column>
            <Column header="" headerClass="bg-opensimrs-50">
              <template #body="{ data: s }">
                <div class="flex gap-2">
                  <CustomButton v-if="s.status === 'draf' && boleh('UPDATE')" label="Ubah" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaSkema(s)" />
                  <CustomButton v-if="s.status !== 'draf'" label="Lihat" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaSkema(s)" />
                  <CustomButton v-if="s.status === 'draf' && boleh('SAHKAN')" label="Sahkan" icon="PhSealCheck" size="small" @click="bukaSah(s)" />
                </div>
              </template>
            </Column>
          </DataTable>
        </template>

        <template v-else>
          <NoData v-if="!penerima.length" />
          <DataTable v-else :value="penerima" stripedRows class="text-xs cursor-pointer" @rowClick="boleh('UPDATE') && bukaPenerima($event.data)">
            <Column header="Nama" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ p.nama || p.practitionerUuid }}</template></Column>
            <Column header="Profesi" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ namaOpsi(ref_.profesi, p.profesi) }}</template></Column>
            <Column header="Unit" field="unit" headerClass="bg-opensimrs-50" />
            <Column header="Indeks (pendidikan · risiko · jabatan · masa kerja)" headerClass="bg-opensimrs-50">
              <template #body="{ data: p }">{{ [p.indeks?.pendidikan, p.indeks?.risiko, p.indeks?.jabatan, p.indeks?.masaKerja].join(" · ") }}</template>
            </Column>
            <Column header="Kebersamaan" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ p.ikutKebersamaan ? "Ikut" : "Tidak" }}</template></Column>
            <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: p }"><span :class="p.aktif ? '' : 'text-danger-300'">{{ p.aktif ? "Aktif" : "Nonaktif" }}</span></template></Column>
          </DataTable>
        </template>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogSkema" width="920px">
      <template #header>{{ form.uuid ? "Ubah Skema (Draf)" : "Versi Skema Baru" }}</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4 text-sm">
          <div v-if="form.contoh" class="p-3 text-xs rounded-md bg-[#FEF0C7] text-[#B54708]">{{ ref_.peringatanContoh }}</div>
          <div class="grid grid-cols-3 gap-4">
            <CustomTextfield v-model="form.nama" label="Nama skema" :maxLength="255" class="col-span-3" required />
            <CustomSelect v-model="form.bulan" label="Berlaku mulai bulan" :options="OPSI_BULAN" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
            <CustomSelect v-model="form.tahun" label="Tahun" :options="OPSI_TAHUN" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
            <div />
            <CustomTextfield v-model="form.persenLangsung" label="Porsi langsung pelaksana (%)" :maxLength="6" />
            <CustomTextfield v-model="form.persenKebersamaan" label="Porsi kebersamaan / pool (%)" :maxLength="6" />
            <div class="self-end text-xs text-grey-400">Jumlah keduanya harus 100%.</div>
            <CustomTextfield v-model="form.kinerjaMin" label="Capaian kinerja minimum (%)" :maxLength="6" />
            <CustomTextfield v-model="form.kinerjaMaks" label="Capaian kinerja maksimum (%)" :maxLength="6" />
          </div>
          <div>
            <h3 class="mb-1 font-semibold">Porsi jaspel dari nilai item tagihan</h3>
            <div class="mb-2 text-xs text-grey-400">Aturan jenis layanan persis didahulukan, lalu "Semua jenis layanan". Kategori tanpa aturan tidak menghasilkan jaspel.</div>
            <div v-for="(p, i) in form.porsi" :key="i" class="grid items-end grid-cols-[1fr_1fr_120px_auto] gap-3 mb-2">
              <CustomSelect v-model="p.jenisLayanan" label="Jenis layanan" :options="ref_.jenisLayanan" optionValue="kode" optionLabel="nama" :showFilter="false" :clearable="false" />
              <CustomSelect v-model="p.kategori" label="Kategori item" :options="ref_.kategori" optionValue="kode" optionLabel="nama" :showFilter="false" :clearable="false" />
              <CustomTextfield v-model="p.persen" label="Porsi (%)" :maxLength="6" />
              <CustomButton icon="PhTrash" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="form.porsi.splice(i, 1)" />
            </div>
            <CustomButton label="Tambah Aturan Porsi" icon="PhPlus" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="tambahPorsi" />
          </div>
          <div>
            <h3 class="mb-1 font-semibold">Indeks profesi</h3>
            <div class="grid grid-cols-5 gap-3">
              <CustomTextfield v-for="p in ref_.profesi" :key="p.kode" v-model="form.indeksProfesi[p.kode]" :label="p.nama" :maxLength="6" />
            </div>
          </div>
          <div>
            <h3 class="mb-1 font-semibold">Bobot indeks penerima</h3>
            <div class="mb-2 text-xs text-grey-400">Poin = indeks profesi + Σ (indeks penerima × bobot); pool kebersamaan dibagi proporsional poin × capaian kinerja.</div>
            <div class="grid grid-cols-4 gap-3">
              <CustomTextfield v-for="j in ref_.jenisIndeks" :key="j.kode" v-model="form.bobotIndeks[j.kode]" :label="`Bobot ${j.nama}`" :maxLength="6" />
            </div>
          </div>
          <CustomTextArea v-model="form.catatan" label="Catatan" />
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogSkema = false" />
          <CustomButton v-if="(form.uuid && boleh('UPDATE') && skema.find((s) => s.uuid === form.uuid)?.status === 'draf') || (!form.uuid && boleh('CREATE'))" label="Simpan" icon="PhFloppyDisk" @click="simpanSkema_" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogSah" width="620px">
      <template #header>Sahkan Skema Versi {{ sah.versi }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4 text-sm">
          <div class="text-xs text-grey-400">Skema yang disahkan tidak dapat diubah; perubahan berikutnya dibuat sebagai versi baru. Tercatat di Audit Trail.</div>
          <CustomTextArea v-model="sah.dasar" label="Dasar pengesahan (mis. nomor & tanggal SK direksi)" />
          <label v-if="sah.contoh" class="flex items-start gap-2 p-3 text-xs rounded-md bg-[#FEF0C7] text-[#B54708]">
            <input v-model="sah.konfirmasi" type="checkbox" class="mt-0.5" />
            <span>Skema ini berasal dari nilai CONTOH. Saya menyatakan porsi, indeks, dan bobot sudah ditetapkan oleh bagian keuangan/direksi faskes.</span>
          </label>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogSah = false" />
          <CustomButton label="Sahkan" icon="PhSealCheck" @click="sahkan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogPenerima" width="720px">
      <template #header>{{ fp.uuid ? `Ubah Penerima — ${fp.nama}` : "Tambah Penerima" }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-if="!fp.uuid" v-model="fp.practitionerUuid" label="Praktisi" :options="opsiPraktisi" optionValue="uuid" optionLabel="label" class="col-span-2" />
          <CustomSelect v-model="fp.profesi" label="Profesi" :options="ref_.profesi" optionValue="kode" optionLabel="nama" :showFilter="false" :clearable="false" />
          <CustomTextfield v-model="fp.unit" label="Unit (untuk rekap)" :maxLength="255" />
          <CustomTextfield v-for="j in ref_.jenisIndeks" :key="j.kode" v-model="fp.indeks[j.kode]" :label="`Indeks ${j.nama} (0–100)`" :maxLength="6" />
          <CustomSelect v-model="fp.ikutKebersamaan" label="Ikut pool kebersamaan" :options="YA_TIDAK" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          <CustomSelect v-model="fp.aktif" label="Aktif" :options="YA_TIDAK" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          <CustomTextArea v-model="fp.catatan" label="Catatan" class="col-span-2" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogPenerima = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanPenerima_" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
