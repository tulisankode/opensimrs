<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { KELOMPOK_AKUN, daftarAkun, izinAkuntansi, pasangCoaBawaan, referensiAkuntansi, simpanAkun } from "@/stores/penunjang/akuntansi";

// Bagan akun (COA) per faskes (KF-1): hierarki induk/rinci, kelompok, saldo normal, klasifikasi laporan, penanda kas,
// kelompok arus kas, dan buku pembantu (aging). COA bawaan RS dapat dipasang lalu disesuaikan; akun tidak dihapus,
// cukup dinonaktifkan. Kelompok/saldo normal/jenis terkunci setelah akun dipakai jurnal.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinAkuntansi("Bagan Akun", aksi);
const ref_ = ref<any>({ kelompok: [], klasifikasi: [], klasifikasiKelompok: {}, saldoNormal: [], jenisAkun: [], arusKas: [], bukuPembantu: [] });
const akun = ref<any[]>([]);
const cari = ref("");
const hanyaAktif = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const r = await daftarAkun({ q: cari.value.trim(), aktif: hanyaAktif.value });
    akun.value = r?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
// Kedalaman hierarki untuk indentasi (akun urut kode).
const kedalaman = computed(() => {
  const peta = new Map(akun.value.map((a) => [a.uuid, a]));
  const d = (a: any, n = 0): number => (a?.indukUuid && peta.has(a.indukUuid) && n < 10 ? d(peta.get(a.indukUuid), n + 1) : n);
  return new Map(akun.value.map((a) => [a.uuid, d(a)]));
});
const namaKlasifikasi = (k: string) => ref_.value.klasifikasi.find((x: any) => x.kode === k)?.nama ?? k;

const pasang = async () => {
  if (!confirm("Pasang COA & pemetaan bawaan RS? Hanya kode akun/komponen yang belum ada yang ditambahkan; akun yang sudah ada tidak diubah.")) return;
  storeUtils.setLoading(true);
  try {
    if (await pasangCoaBawaan()) await muat();
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialog = ref(false);
const form = ref<any>({});
const galat = ref("");
const opsiInduk = computed(() => akun.value.filter((a) => a.jenis === "induk" && a.kelompok === form.value.kelompok && a.uuid !== form.value.uuid).map((a) => ({ ...a, label: `${a.kode} — ${a.nama}` })));
const opsiKlasifikasi = computed(() => (ref_.value.klasifikasiKelompok?.[form.value.kelompok] ?? []).map((k: string) => ({ kode: k, nama: namaKlasifikasi(k) })));
const buka = (a?: any) => {
  galat.value = "";
  form.value = a
    ? { ...a, aktif: a.aktif ? "1" : "0", kasSetaraKas: a.kasSetaraKas ? "1" : "0" }
    : { kode: "", nama: "", kelompok: "aset", klasifikasi: "aset_lancar", saldoNormal: "debit", jenis: "rinci", indukUuid: "", kasSetaraKas: "0", arusKas: "", bukuPembantu: "", aktif: "1", keterangan: "" };
  dialog.value = true;
};
const gantiKelompok = () => {
  const f = form.value;
  f.klasifikasi = ref_.value.klasifikasiKelompok?.[f.kelompok]?.[0] ?? "";
  f.saldoNormal = f.kelompok === "aset" || f.kelompok === "beban" ? "debit" : "kredit";
  f.indukUuid = "";
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.kode?.trim() || !f.nama?.trim()) return (galat.value = "Kode dan nama akun wajib diisi");
  storeUtils.setLoading(true);
  try {
    const r = await simpanAkun(
      {
        kode: f.kode.trim(),
        nama: f.nama.trim(),
        kelompok: f.kelompok,
        klasifikasi: f.klasifikasi,
        saldoNormal: f.saldoNormal,
        jenis: f.jenis,
        indukUuid: f.indukUuid || null,
        kasSetaraKas: f.kasSetaraKas === "1",
        arusKas: f.arusKas || null,
        bukuPembantu: f.bukuPembantu || null,
        aktif: f.aktif === "1",
        keterangan: f.keterangan ?? "",
      },
      f.uuid,
    );
    if (r) {
      dialog.value = false;
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
  const r = await referensiAkuntansi();
  if (r?.payload) ref_.value = r.payload;
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Bagan Akun (COA)</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Kode / nama akun" :maxLength="100" @keydown.enter="muat" />
          <CustomSelect v-model="hanyaAktif" label="Status" placeHolder="Semua" :options="[{ value: '1', label: 'Hanya aktif' }]" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="muat" />
          <CustomButton v-if="boleh('CREATE')" label="Pasang COA Bawaan" icon="PhDownloadSimple" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="pasang" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Tambah Akun" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="px-1 pb-2 text-xs text-grey-400">
          COA bawaan mengacu struktur umum SAK/PSAK & pola BLUD/RS swasta dan harus ditinjau serta disahkan bagian keuangan sebelum dipakai untuk laporan resmi.
        </div>
        <NoData v-if="!akun.length" />
        <DataTable v-else :value="akun" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 64rem" @rowClick="boleh('UPDATE') && buka($event.data)">
          <Column header="Kode" headerClass="bg-opensimrs-50"><template #body="{ data: a }"><span :style="{ paddingLeft: `${(kedalaman.get(a.uuid) ?? 0) * 14}px` }" :class="a.jenis === 'induk' ? 'font-semibold' : ''">{{ a.kode }}</span></template></Column>
          <Column header="Nama" headerClass="bg-opensimrs-50"><template #body="{ data: a }"><span :class="a.jenis === 'induk' ? 'font-semibold' : ''">{{ a.nama }}</span></template></Column>
          <Column header="Kelompok" headerClass="bg-opensimrs-50"><template #body="{ data: a }">{{ KELOMPOK_AKUN[a.kelompok] ?? a.kelompok }}</template></Column>
          <Column header="Normal" headerClass="bg-opensimrs-50"><template #body="{ data: a }">{{ a.saldoNormal === "debit" ? "D" : "K" }}</template></Column>
          <Column header="Klasifikasi" headerClass="bg-opensimrs-50"><template #body="{ data: a }">{{ namaKlasifikasi(a.klasifikasi) }}</template></Column>
          <Column header="Penanda" headerClass="bg-opensimrs-50">
            <template #body="{ data: a }">{{ [a.kasSetaraKas ? "Kas" : null, a.arusKas ? `Arus ${a.arusKas}` : null, a.bukuPembantu ? `Pembantu ${a.bukuPembantu}` : null].filter(Boolean).join(" · ") || "-" }}</template>
          </Column>
          <Column header="Dipakai" headerClass="bg-opensimrs-50"><template #body="{ data: a }">{{ a.jumlahBaris || "-" }}</template></Column>
          <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: a }"><span :class="a.aktif ? '' : 'text-danger-300'">{{ a.aktif ? "Aktif" : "Nonaktif" }}</span></template></Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="720px">
      <template #header>{{ form.uuid ? `Ubah Akun ${form.kode}` : "Tambah Akun" }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.kode" label="Kode" :maxLength="30" required />
          <CustomTextfield v-model="form.nama" label="Nama Akun" :maxLength="255" required />
          <CustomSelect v-model="form.kelompok" label="Kelompok" :options="ref_.kelompok" optionValue="kode" optionLabel="nama" :showFilter="false" :clearable="false" :disabled="!!form.jumlahBaris" @update:modelValue="gantiKelompok" />
          <CustomSelect v-model="form.klasifikasi" label="Klasifikasi Laporan" :options="opsiKlasifikasi" optionValue="kode" optionLabel="nama" :showFilter="false" :clearable="false" />
          <CustomSelect v-model="form.saldoNormal" label="Saldo Normal" :options="ref_.saldoNormal" optionValue="kode" optionLabel="nama" :showFilter="false" :clearable="false" :disabled="!!form.jumlahBaris" />
          <CustomSelect v-model="form.jenis" label="Jenis" :options="ref_.jenisAkun" optionValue="kode" optionLabel="nama" :showFilter="false" :clearable="false" :disabled="!!form.jumlahBaris" />
          <CustomSelect v-model="form.indukUuid" label="Akun Induk" placeHolder="Tanpa induk (akun puncak)" :options="opsiInduk" optionValue="uuid" optionLabel="label" class="col-span-2" />
          <CustomSelect v-if="form.kelompok === 'aset'" v-model="form.kasSetaraKas" label="Kas & Setara Kas" :options="YA_TIDAK" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          <CustomSelect v-model="form.arusKas" label="Kelompok Arus Kas (metode tidak langsung)" placeHolder="Operasi (bawaan)" :options="ref_.arusKas" optionValue="kode" optionLabel="nama" :showFilter="false" />
          <CustomSelect
            v-if="form.kelompok === 'aset' || form.kelompok === 'kewajiban'"
            v-model="form.bukuPembantu"
            label="Buku Pembantu (aging)"
            placeHolder="Tidak ada"
            :options="ref_.bukuPembantu.filter((b: any) => (form.kelompok === 'aset' ? b.kode === 'piutang' : b.kode === 'utang'))"
            optionValue="kode"
            optionLabel="nama"
            :showFilter="false"
          />
          <CustomSelect v-model="form.aktif" label="Aktif" :options="YA_TIDAK" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          <CustomTextArea v-model="form.keterangan" label="Keterangan" class="col-span-2" />
          <div v-if="form.jumlahBaris" class="col-span-2 text-xs text-grey-400">Akun sudah dipakai {{ form.jumlahBaris }} baris jurnal: kelompok, saldo normal, dan jenis tidak dapat diubah.</div>
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
