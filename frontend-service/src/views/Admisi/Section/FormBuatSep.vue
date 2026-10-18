<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useToast } from "primevue/usetoast";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { useBpjsVclaimStore, bolehSurat } from "@/stores/bpjsVclaim";
import { fiturAktif } from "@/stores/modulFaskes";
import { tglIndo } from "@/utils/pdf/pdfBpjs/cetakSuratVclaim";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";

// Pembuatan SEP BPJS VClaim: cari peserta → pilih rujukan (rawat jalan) → poli, DPJP, diagnosis awal
// → kaitkan ke kunjungan OpenSIMRS (opsional) → kirim ke BPJS. IGD memakai poli "IGD" tanpa rujukan;
// rawat inap memerlukan SPRI. Bila fitur Rencana Kontrol & SPRI (vclaim_rencana_kontrol) aktif, SPRI/Rencana Kontrol
// dipilih dari surat terdaftar milik pasien (dikirim sebagai suratUuid, divalidasi & dikunci bpjs-service); nomor
// surat hanya diketik bebas bila fitur tidak aktif (surat dibuat di luar OpenSIMRS).
const props = defineProps<{ pageType: string }>();
const emit = defineEmits(["selesai", "batal"]);
const store = useBpjsVclaimStore();
const storeUtils = utilsStore();
const toast = useToast();

const rawatInap = computed(() => props.pageType === "rawat-inap");
const igd = computed(() => props.pageType === "igd");
const sumber = computed(() => (rawatInap.value ? "rawat_inap" : igd.value ? "igd" : "rawat_jalan"));

const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const tglSep = ref(hariIni());
const nomor = ref("");
const peserta = ref<any>(null);
const rujukan = ref<any[]>([]);
const rujukanDipilih = ref<any>(null);
const pasien = ref<any[]>([]);
const pasienUuid = ref("");
const kunjunganUuid = ref("");

const opsiPoli = ref<{ value: string; label: string }[]>([]);
const poliTujuan = ref("");
const opsiDokter = ref<{ value: string; label: string }[]>([]);
const dpjp = ref("");
const kataDiagnosa = ref("");
const opsiDiagnosa = ref<{ value: string; label: string }[]>([]);
const diagAwal = ref("");
const noSurat = ref("");
// Surat terdaftar (STD-0021)
const suratManual = !fiturAktif("vclaim_rencana_kontrol");
const bolehPilihSurat = bolehSurat("PILIH SURAT SEP");
const pakaiPilihanSurat = computed(() => !suratManual && !igd.value);
const daftarSurat = ref<any[]>([]);
const suratUuid = ref("");
const pesanSurat = ref("");
const noTelp = ref("");
const catatan = ref("");

const opsiSurat = computed(() =>
  daftarSurat.value.map((x) => ({
    value: x.uuid,
    label: `${x.noSurat} · ${tglIndo(x.tglRencana)} · Poli ${x.poliTujuan ?? "-"} · DPJP ${x.namaDokter ?? x.dpjp ?? "-"}`,
  }))
);
const pesertaAktif = computed(() => peserta.value?.statusPeserta?.kode === "0");
const pasienTerpilih = computed(() => pasien.value.find((p) => p.uuid === pasienUuid.value));
const opsiPasien = computed(() => pasien.value.map((p) => ({ value: p.uuid, label: `${p.noRm} – ${p.name}` })));
const opsiKunjungan = computed(() =>
  (pasienTerpilih.value?.kunjungan ?? []).map((k: any) => ({
    value: k.uuid,
    label: `${k.noPelayanan ?? k.noReg} · ${k.lokasi ?? "-"} · ${k.tanggalDaftar ? epochToDate(Number(k.tanggalDaftar), "dateTime") : "-"}`,
  }))
);
// rawat inap: poli dipakai sebagai spesialis DPJP saja; IGD: poli tetap "IGD"
const spesialis = computed(() => (igd.value ? "IGD" : poliTujuan.value));

const tambahOpsi = (daftar: { value: string; label: string }[], value: string, label: string) => {
  if (value && !daftar.some((o) => o.value === value)) daftar.unshift({ value, label });
};

const muatPoli = async () => {
  const hasil = await Promise.all(["A", "I", "O", "U", "E"].map((q) => store.getReferensi("poli", { q })));
  const peta = new Map<string, string>();
  for (const r of hasil) for (const p of r?.payload ?? []) peta.set(p.kode, p.nama);
  opsiPoli.value = [...peta.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([kode, nama]) => ({ value: kode, label: `${kode} – ${nama}` }));
};

watch(
  () => [spesialis.value, tglSep.value],
  async () => {
    opsiDokter.value = [];
    if (!spesialis.value) return;
    const res = await store.getReferensi("dokter", { spesialis: spesialis.value, jnsPelayanan: rawatInap.value ? "1" : "2", tgl: tglSep.value });
    opsiDokter.value = (res?.payload ?? []).map((d: any) => ({ value: d.kode, label: `${d.kode} – ${d.nama}` }));
    if (dpjp.value && !opsiDokter.value.some((o) => o.value === dpjp.value)) dpjp.value = "";
  }
);

const reset = () => {
  peserta.value = null;
  rujukan.value = [];
  rujukanDipilih.value = null;
  pasien.value = [];
  pasienUuid.value = "";
  kunjunganUuid.value = "";
  diagAwal.value = "";
  opsiDiagnosa.value = [];
  noTelp.value = "";
};

const cariPeserta = async () => {
  const angka = nomor.value.replace(/\D/g, "");
  if (!angka) return;
  reset();
  storeUtils.setLoading(true);
  try {
    const res = await store.cekPeserta(angka, tglSep.value);
    if (res?.gagal) {
      toast.add({ severity: "warn", summary: "Cek peserta", detail: res.message, life: 6000 });
      return;
    }
    peserta.value = res?.payload ?? null;
    if (!peserta.value) return;
    noTelp.value = peserta.value.mr?.noTelepon ?? "";
    const [resRujukan, resPasien] = await Promise.all([
      rawatInap.value || igd.value ? Promise.resolve(null) : store.getRujukan(peserta.value.noKartu),
      store.getPasien(peserta.value.noKartu),
    ]);
    if (resRujukan?.gagal) toast.add({ severity: "warn", summary: "Rujukan", detail: resRujukan.message, life: 6000 });
    rujukan.value = resRujukan?.payload ?? [];
    pasien.value = resPasien?.payload ?? [];
    if (pasien.value.length === 1) pasienUuid.value = pasien.value[0].uuid;
  } finally {
    storeUtils.setLoading(false);
  }
};

const pilihRujukan = (r: any) => {
  rujukanDipilih.value = r;
  if (r.diagnosa?.kode) {
    tambahOpsi(opsiDiagnosa.value, r.diagnosa.kode, `${r.diagnosa.kode} – ${r.diagnosa.nama}`);
    diagAwal.value = r.diagnosa.kode;
  }
  if (r.poliRujukan?.kode) {
    tambahOpsi(opsiPoli.value, r.poliRujukan.kode, `${r.poliRujukan.kode} – ${r.poliRujukan.nama}`);
    poliTujuan.value = r.poliRujukan.kode;
  }
};

watch(kunjunganUuid, (uuid) => {
  const k = pasienTerpilih.value?.kunjungan?.find((x: any) => x.uuid === uuid);
  if (!k) return;
  if (k.kdPoliVclaim && !rawatInap.value && !igd.value) poliTujuan.value = k.kdPoliVclaim;
  if (k.kdDpjp) dpjp.value = k.kdDpjp;
});
// Surat aktif (belum dipakai, belum jatuh tempo) milik pasien & kartu ini: SPRI untuk rawat inap, Rencana Kontrol untuk rawat jalan
const muatSurat = async () => {
  daftarSurat.value = [];
  suratUuid.value = "";
  pesanSurat.value = "";
  if (!pakaiPilihanSurat.value || !pasienUuid.value || !peserta.value) return;
  const res = await store.getSurat(rawatInap.value ? "spri" : "rencana-kontrol", {
    patientUuid: pasienUuid.value, noKartu: peserta.value.noKartu, status: "aktif", limit: 50,
  });
  if (res?.gagal) {
    pesanSurat.value = res.message;
    return;
  }
  daftarSurat.value = res?.payload ?? [];
  if (rawatInap.value && daftarSurat.value.length === 1 && bolehPilihSurat) suratUuid.value = daftarSurat.value[0].uuid;
};
watch(suratUuid, (uuid) => {
  const x = daftarSurat.value.find((s) => s.uuid === uuid);
  if (!x) return;
  if (x.poliTujuan && !rawatInap.value && !igd.value) {
    tambahOpsi(opsiPoli.value, x.poliTujuan, x.poliTujuan);
    poliTujuan.value = x.poliTujuan;
  }
  if (x.dpjp) dpjp.value = x.dpjp;
});

watch(pasienUuid, () => {
  muatSurat();
  kunjunganUuid.value = "";
  if (!noTelp.value && pasienTerpilih.value?.phone) noTelp.value = pasienTerpilih.value.phone;
});

const cariDiagnosa = async () => {
  if (kataDiagnosa.value.trim().length < 3) {
    toast.add({ severity: "info", summary: "Diagnosis", detail: "Ketik minimal 3 karakter kode atau nama diagnosis", life: 4000 });
    return;
  }
  const res = await store.getReferensi("diagnosa", { q: kataDiagnosa.value.trim() });
  if (res?.gagal) return toast.add({ severity: "warn", summary: "Diagnosis", detail: res.message, life: 5000 });
  opsiDiagnosa.value = (res?.payload ?? []).map((d: any) => ({ value: d.kode, label: d.nama?.startsWith(d.kode) ? d.nama : `${d.kode} – ${d.nama}` }));
  if (opsiDiagnosa.value.length === 1) diagAwal.value = opsiDiagnosa.value[0].value;
};

const kirim = async () => {
  if (!peserta.value) return;
  const kunjungan = pasienTerpilih.value?.kunjungan?.find((x: any) => x.uuid === kunjunganUuid.value);
  const r = rujukanDipilih.value;
  const payload = {
    tglSep: tglSep.value,
    noKartu: peserta.value.noKartu,
    jnsPelayanan: rawatInap.value ? "1" : "2",
    klsRawatHak: peserta.value.hakKelas?.kode,
    noMR: pasienTerpilih.value?.noRm ?? peserta.value.mr?.noMR ?? "",
    rujukan: r ? { asal: r.asalRujukan, tgl: r.tglKunjungan, no: r.noKunjungan, ppk: r.provPerujuk?.kode } : null,
    diagAwal: diagAwal.value,
    poliTujuan: igd.value ? "IGD" : rawatInap.value ? "" : poliTujuan.value,
    dpjp: dpjp.value,
    // nomor surat bebas hanya bila fitur Rencana Kontrol & SPRI tidak aktif; selain itu surat terdaftar (suratUuid)
    ...(suratManual ? { noSurat: noSurat.value } : suratUuid.value ? { suratUuid: suratUuid.value } : {}),
    noTelp: noTelp.value,
    catatan: catatan.value,
    patientUuid: pasienUuid.value || null,
    sumber: sumber.value,
    sumberUuid: kunjungan?.uuid ?? null,
    noReg: kunjungan?.noReg ?? null,
  };
  storeUtils.setLoading(true);
  try {
    const res = await store.buatSep(payload);
    if (res?.gagal) toast.add({ severity: "error", summary: "SEP gagal dibuat", detail: res.message, life: 8000 });
    else if (res?.payload) emit("selesai", res.payload);
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(muatPoli);
</script>

<template>
  <div class="flex flex-col gap-4 text-base">
    <!-- 1. Peserta -->
    <div class="p-4 bg-white rounded-lg">
      <div class="mb-3 font-semibold">1. Peserta BPJS</div>
      <div class="flex items-end gap-3">
        <CustomTextfield v-model="tglSep" class="w-[180px]" label="Tanggal SEP" type="date" />
        <CustomTextfield v-model="nomor" class="w-1/3" label="No. Kartu / NIK" placeholder="13 digit kartu atau 16 digit NIK" @keyup.enter="cariPeserta" />
        <CustomButton label="Cari Peserta" icon="PhMagnifyingGlass" @click="cariPeserta" />
      </div>
      <div v-if="peserta" class="grid grid-cols-4 gap-3 p-3 mt-3 text-sm rounded-md bg-opensimrs-50">
        <div><span class="underline">Nama</span><div class="font-semibold">{{ peserta.nama }}</div></div>
        <div><span class="underline">No. Kartu · NIK</span><div class="font-semibold">{{ peserta.noKartu }} · {{ peserta.nik }}</div></div>
        <div>
          <span class="underline">Status</span>
          <div class="font-semibold" :class="pesertaAktif ? 'text-[#027A48]' : 'text-[#B42318]'">{{ peserta.statusPeserta?.keterangan ?? "-" }}</div>
        </div>
        <div><span class="underline">Hak Kelas</span><div class="font-semibold">{{ peserta.hakKelas?.keterangan ?? "-" }}</div></div>
        <div><span class="underline">Jenis Peserta</span><div class="font-semibold">{{ peserta.jenisPeserta?.keterangan ?? "-" }}</div></div>
        <div><span class="underline">FKTP</span><div class="font-semibold">{{ peserta.provUmum?.nmProvider ?? "-" }}</div></div>
        <div><span class="underline">Tgl. Lahir · Kelamin</span><div class="font-semibold">{{ peserta.tglLahir }} · {{ peserta.sex === "P" ? "Perempuan" : "Laki-laki" }}</div></div>
        <div><span class="underline">Prolanis / PRB</span><div class="font-semibold">{{ peserta.informasi?.prolanisPRB ?? "-" }}</div></div>
      </div>
      <div v-if="peserta && !pesertaAktif" class="p-3 mt-3 text-sm rounded-md bg-[#FDE2E1] text-[#B42318]">
        Peserta tidak aktif. BPJS akan menolak penerbitan SEP.
      </div>
    </div>

    <!-- 2. Rujukan (rawat jalan) -->
    <div v-if="peserta && !rawatInap && !igd" class="p-4 bg-white rounded-lg">
      <div class="mb-3 font-semibold">2. Rujukan</div>
      <DataTable :value="rujukan" stripedRows class="text-xs" dataKey="noKunjungan" :rowClass="() => 'cursor-pointer'" @rowClick="(e: any) => pilihRujukan(e.data)">
        <Column headerClass="bg-opensimrs-50" style="width: 40px">
          <template #body="{ data }">
            <RadioButton :modelValue="rujukanDipilih?.noKunjungan" :value="data.noKunjungan" @update:modelValue="pilihRujukan(data)" />
          </template>
        </Column>
        <Column header="No. Rujukan" field="noKunjungan" headerClass="bg-opensimrs-50" />
        <Column header="Tanggal" field="tglKunjungan" headerClass="bg-opensimrs-50" />
        <Column header="Asal" headerClass="bg-opensimrs-50">
          <template #body="{ data }">{{ data.asalRujukan === "2" ? "Rumah sakit" : "FKTP" }}<br /><span class="text-grey-400">{{ data.provPerujuk?.nama }}</span></template>
        </Column>
        <Column header="Poli" headerClass="bg-opensimrs-50">
          <template #body="{ data }">{{ data.poliRujukan?.kode }} – {{ data.poliRujukan?.nama }}</template>
        </Column>
        <Column header="Diagnosis" headerClass="bg-opensimrs-50">
          <template #body="{ data }">{{ data.diagnosa?.kode }} – {{ data.diagnosa?.nama }}</template>
        </Column>
        <template #empty>
          <div class="py-3 text-center text-grey-400">Tidak ada rujukan aktif untuk peserta ini.</div>
        </template>
      </DataTable>
    </div>

    <!-- 3. Pelayanan -->
    <div v-if="peserta" class="p-4 bg-white rounded-lg">
      <div class="mb-3 font-semibold">{{ rawatInap || igd ? "2" : "3" }}. Data Pelayanan</div>
      <div class="grid grid-cols-3 gap-3">
        <CustomSelect v-model="pasienUuid" label="Pasien OpenSIMRS" :options="opsiPasien" optionValue="value" optionLabel="label" :placeHolder="pasien.length ? 'Pilih pasien' : 'Tidak ada pasien dengan kartu ini'" :disabled="!pasien.length" />
        <CustomSelect v-model="kunjunganUuid" label="Kunjungan (30 hari terakhir)" :options="opsiKunjungan" optionValue="value" optionLabel="label" placeHolder="Opsional" :disabled="!opsiKunjungan.length" clearable />
        <CustomTextfield v-if="rawatInap && suratManual" v-model="noSurat" label="No. SPRI" required />
        <CustomSelect
          v-else-if="pakaiPilihanSurat"
          v-model="suratUuid"
          :label="rawatInap ? 'SPRI' : 'Rencana Kontrol (opsional)'"
          :options="opsiSurat"
          optionValue="value"
          optionLabel="label"
          :placeHolder="!bolehPilihSurat ? 'Tidak berhak memilih surat' : opsiSurat.length ? 'Pilih surat' : 'Tidak ada surat aktif'"
          :disabled="!bolehPilihSurat || !opsiSurat.length"
          :required="rawatInap"
          clearable
        />
        <div v-else />

        <CustomSelect
          v-if="!igd"
          v-model="poliTujuan"
          :label="rawatInap ? 'Spesialis DPJP' : 'Poli Tujuan'"
          :options="opsiPoli"
          optionValue="value"
          optionLabel="label"
          placeHolder="Pilih poli"
          showFilter
          required
        />
        <CustomTextfield v-else modelValue="IGD – Instalasi Gawat Darurat" label="Poli Tujuan" readOnly />
        <CustomSelect v-model="dpjp" label="Dokter DPJP" :options="opsiDokter" optionValue="value" optionLabel="label" :placeHolder="spesialis ? 'Pilih dokter' : 'Pilih poli terlebih dahulu'" showFilter required />
        <div class="flex items-end gap-2">
          <CustomTextfield v-model="kataDiagnosa" class="flex-1" label="Cari Diagnosis (ICD-10)" placeholder="mis. I10 atau hipertensi" @keyup.enter="cariDiagnosa" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariDiagnosa" />
        </div>
        <CustomSelect v-model="diagAwal" class="col-span-2" label="Diagnosis Awal" :options="opsiDiagnosa" optionValue="value" optionLabel="label" placeHolder="Cari lalu pilih diagnosis" required />
        <CustomTextfield v-model="noTelp" label="No. Telepon" />
        <CustomTextfield v-model="catatan" class="col-span-3" label="Catatan" placeholder="Opsional" />
      </div>
      <div v-if="pesanSurat" class="p-3 mt-3 text-sm rounded-md bg-[#FEF0C7] text-[#B54708]">Surat Rencana Kontrol/SPRI tidak dapat dimuat: {{ pesanSurat }}</div>
      <div v-else-if="rawatInap && pakaiPilihanSurat && pasienUuid && !opsiSurat.length" class="p-3 mt-3 text-sm rounded-md bg-[#FEF0C7] text-[#B54708]">
        Belum ada SPRI aktif untuk pasien ini. Buat SPRI di Admisi › Rencana Kontrol & SPRI atau dari rekam medis rawat jalan/IGD.
      </div>
      <div class="flex flex-wrap gap-2 mt-3">
        <CustomChip v-if="suratUuid" :label="`Surat ${daftarSurat.find((x) => x.uuid === suratUuid)?.noSurat ?? '-'}`" :show-checked-icon="false" bg-color="bg-opensimrs-50" border-color="border-transparent" text-color="text-opensimrs-300" />
        <CustomChip v-if="rujukanDipilih" :label="`Rujukan ${rujukanDipilih.noKunjungan}`" :show-checked-icon="false" bg-color="bg-opensimrs-50" border-color="border-transparent" text-color="text-opensimrs-300" />
        <CustomChip :label="`Kelas ${peserta.hakKelas?.kode ?? '-'}`" :show-checked-icon="false" bg-color="bg-opensimrs-50" border-color="border-transparent" text-color="text-opensimrs-300" />
      </div>
    </div>

    <div class="flex justify-end gap-3">
      <CustomButton label="Batal" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent" borderColor="border-2 border-[#9DA4B1]" @click="emit('batal')" />
      <CustomButton label="Buat SEP" icon="PhPaperPlaneTilt" :disabled="!peserta || !pesertaAktif || (rawatInap && !suratManual && !suratUuid)" @click="kirim" />
    </div>
  </div>
</template>
