<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useToast } from "primevue/usetoast";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { useBpjsVclaimStore, type JenisSuratVclaim } from "@/stores/bpjsVclaim";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";

// Pembuatan/perubahan Rencana Kontrol & SPRI lewat VClaim (STD-0021). Dipakai halaman Admisi › Rencana Kontrol & SPRI
// dan dari resume rawat jalan / discharge rawat inap (Rencana Kontrol) atau keputusan rawat inap RJ/IGD (SPRI).
// Dokter DPJP diambil dari referensi dokter VClaim untuk poli & tanggal rencana, sehingga hanya dokter yang
// berjadwal pada tanggal itu yang dapat dipilih. Kunci idempotensi dibuat sekali per formulir: mengirim ulang
// setelah galat jaringan tidak membuat surat ganda.
const props = defineProps<{
  jenis: JenisSuratVclaim;
  mode?: "buat" | "ubah";
  surat?: any;
  // isian awal dari RME/kunjungan: { noKartu, patientUuid, sumber, sumberUuid }
  awal?: { noKartu?: string | null; patientUuid?: string | null; sumber?: string | null; sumberUuid?: string | null };
}>();
const emit = defineEmits(["selesai", "batal"]);
const store = useBpjsVclaimStore();
const storeUtils = utilsStore();
const toast = useToast();

const spri = computed(() => props.jenis === "spri");
const ubah = computed(() => props.mode === "ubah" && !!props.surat);
const namaSurat = computed(() => (spri.value ? "SPRI" : "Rencana Kontrol"));
const hariIni = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
const kunciBaru = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
const idempotencyKey = ref(kunciBaru());

const OPSI_SUMBER = [
  { value: "rawat_jalan", label: "Rawat Jalan" },
  { value: "rawat_inap", label: "Rawat Inap" },
  { value: "igd", label: "IGD" },
];

const nomor = ref(props.awal?.noKartu ?? "");
const peserta = ref<any>(null);
const pasien = ref<any[]>([]);
const pasienUuid = ref(props.awal?.patientUuid ?? "");
const sumber = ref(props.awal?.sumber ?? "rawat_jalan");
const sumberUuid = ref(props.awal?.sumberUuid ?? "");
const tglRencana = ref(props.surat?.tglRencana ?? hariIni());
const opsiPoli = ref<{ value: string; label: string }[]>([]);
const poliTujuan = ref(props.surat?.poliTujuan ?? "");
const opsiDokter = ref<{ value: string; label: string }[]>([]);
const dpjp = ref(props.surat?.dpjp ?? "");
const opsiSep = ref<{ value: string; label: string }[]>([]);
const noSepAsal = ref("");

const pesertaAktif = computed(() => peserta.value?.statusPeserta?.kode === "0");
const pasienTerpilih = computed(() => pasien.value.find((p) => p.uuid === pasienUuid.value));
const opsiPasien = computed(() => pasien.value.map((p) => ({ value: p.uuid, label: `${p.noRm} – ${p.name}` })));
// Daftar kunjungan dari bpjs-service hanya rawat jalan 30 hari terakhir; kunjungan RME (rawat inap/IGD) dari isian awal.
const opsiKunjungan = computed(() => {
  const daftar =
    sumber.value === "rawat_jalan"
      ? (pasienTerpilih.value?.kunjungan ?? []).map((k: any) => ({
          value: k.uuid,
          label: `${k.noPelayanan ?? k.noReg} · ${k.lokasi ?? "-"} · ${k.tanggalDaftar ? epochToDate(Number(k.tanggalDaftar), "dateTime") : "-"}`,
        }))
      : [];
  const awal = props.awal?.sumberUuid;
  if (awal && props.awal?.sumber === sumber.value && !daftar.some((o: any) => o.value === awal)) daftar.unshift({ value: awal, label: "Kunjungan saat ini" });
  return daftar;
});
watch(sumber, () => {
  if (!opsiKunjungan.value.some((o: any) => o.value === sumberUuid.value)) sumberUuid.value = "";
});

const muatPoli = async () => {
  const hasil = await Promise.all(["A", "I", "O", "U", "E"].map((q) => store.getReferensi("poli", { q })));
  const peta = new Map<string, string>();
  for (const r of hasil) for (const p of r?.payload ?? []) peta.set(p.kode, p.nama);
  if (poliTujuan.value && !peta.has(poliTujuan.value)) peta.set(poliTujuan.value, poliTujuan.value);
  opsiPoli.value = [...peta.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([kode, nama]) => ({ value: kode, label: `${kode} – ${nama}` }));
};

// Dokter berjadwal BPJS untuk poli & tanggal rencana (rawat inap: jenis pelayanan 1)
watch(
  () => [poliTujuan.value, tglRencana.value],
  async () => {
    opsiDokter.value = [];
    if (!poliTujuan.value || !tglRencana.value) return;
    const res = await store.getReferensi("dokter", { spesialis: poliTujuan.value, jnsPelayanan: spri.value ? "1" : "2", tgl: tglRencana.value });
    opsiDokter.value = (res?.payload ?? []).map((d: any) => ({ value: d.kode, label: `${d.kode} – ${d.nama}` }));
    if (dpjp.value && !opsiDokter.value.some((o) => o.value === dpjp.value)) {
      if (ubah.value && dpjp.value === props.surat?.dpjp) opsiDokter.value.unshift({ value: dpjp.value, label: `${dpjp.value} (DPJP saat ini)` });
      else dpjp.value = "";
    }
  },
  { immediate: true }
);

const cariPeserta = async () => {
  const angka = String(nomor.value ?? "").replace(/\D/g, "");
  if (angka.length !== 13) {
    toast.add({ severity: "info", summary: "Peserta BPJS", detail: "Nomor kartu BPJS harus 13 digit", life: 4000 });
    return;
  }
  peserta.value = null;
  pasien.value = [];
  opsiSep.value = [];
  storeUtils.setLoading(true);
  try {
    const res = await store.cekPeserta(angka, tglRencana.value);
    if (res?.gagal) return toast.add({ severity: "warn", summary: "Cek peserta", detail: res.message, life: 6000 });
    peserta.value = res?.payload ?? null;
    const [resPasien, resSep] = await Promise.all([
      store.getPasien(angka),
      spri.value ? Promise.resolve(null) : store.getSep({ q: angka, status: "aktif", limit: 20 }),
    ]);
    pasien.value = resPasien?.payload ?? [];
    if (!pasien.value.some((p) => p.uuid === pasienUuid.value)) pasienUuid.value = pasien.value.length === 1 ? pasien.value[0].uuid : "";
    opsiSep.value = (resSep?.payload ?? []).map((s: any) => ({
      value: s.noSep,
      label: `${s.noSep} · ${s.tglSep} · ${s.jenisPelayanan === "1" ? "Rawat Inap" : `Poli ${s.poliTujuan ?? "-"}`}`,
    }));
    if (opsiSep.value.length === 1) noSepAsal.value = opsiSep.value[0].value;
  } finally {
    storeUtils.setLoading(false);
  }
};

const siap = computed(() =>
  ubah.value
    ? !!(tglRencana.value && dpjp.value && poliTujuan.value)
    : !!(peserta.value && pesertaAktif.value && pasienUuid.value && sumber.value && poliTujuan.value && dpjp.value && tglRencana.value)
);

const kirim = async () => {
  if (!siap.value) return;
  storeUtils.setLoading(true);
  try {
    let res;
    if (ubah.value) {
      const s = props.surat;
      const perubahan: Record<string, string> = {};
      if (tglRencana.value !== s.tglRencana) perubahan.tglRencana = tglRencana.value;
      if (dpjp.value !== s.dpjp) perubahan.dpjp = dpjp.value;
      if (poliTujuan.value !== s.poliTujuan) perubahan.poliTujuan = poliTujuan.value;
      if (!Object.keys(perubahan).length) return toast.add({ severity: "info", summary: namaSurat.value, detail: "Tidak ada perubahan", life: 4000 });
      res = await store.ubahSurat(props.jenis, s.uuid, perubahan);
    } else {
      res = await store.buatSurat(props.jenis, {
        idempotencyKey: idempotencyKey.value,
        noKartu: peserta.value.noKartu,
        patientUuid: pasienUuid.value,
        noRm: pasienTerpilih.value?.noRm ?? null,
        sumber: sumber.value,
        sumberUuid: sumberUuid.value || null,
        dpjp: dpjp.value,
        poliTujuan: poliTujuan.value,
        tglRencana: tglRencana.value,
        ...(spri.value ? {} : { noSepAsal: noSepAsal.value || null }),
      });
    }
    if (res?.gagal) {
      toast.add({ severity: "error", summary: `${namaSurat.value} gagal ${ubah.value ? "diubah" : "dibuat"}`, detail: res.message, life: 9000 });
      return;
    }
    if (res?.payload) {
      toast.add({ severity: "success", summary: res.message, detail: res.payload.noSurat, life: 6000 });
      emit("selesai", res.payload);
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(() => {
  muatPoli();
  if (!ubah.value && String(nomor.value ?? "").replace(/\D/g, "").length === 13) cariPeserta();
});
</script>

<template>
  <div class="flex flex-col gap-4 text-base">
    <div v-if="ubah" class="grid grid-cols-3 gap-3 p-3 text-sm rounded-md bg-opensimrs-50">
      <div><span class="underline">No. {{ namaSurat }}</span><div class="font-semibold">{{ surat.noSurat }}</div></div>
      <div><span class="underline">Pasien</span><div class="font-semibold">{{ surat.namaPasien ?? "-" }} · RM {{ surat.noRm ?? "-" }}</div></div>
      <div><span class="underline">No. Kartu</span><div class="font-semibold">{{ surat.noKartu }}</div></div>
    </div>

    <template v-else>
      <div class="flex items-end gap-3">
        <CustomTextfield v-model="nomor" class="w-1/3" label="No. Kartu BPJS" placeholder="13 digit" required @keyup.enter="cariPeserta" />
        <CustomButton label="Cari Peserta" icon="PhMagnifyingGlass" @click="cariPeserta" />
      </div>
      <div v-if="peserta" class="grid grid-cols-4 gap-3 p-3 text-sm rounded-md bg-opensimrs-50">
        <div><span class="underline">Nama</span><div class="font-semibold">{{ peserta.nama }}</div></div>
        <div><span class="underline">No. Kartu</span><div class="font-semibold">{{ peserta.noKartu }}</div></div>
        <div>
          <span class="underline">Status</span>
          <div class="font-semibold" :class="pesertaAktif ? 'text-[#027A48]' : 'text-[#B42318]'">{{ peserta.statusPeserta?.keterangan ?? "-" }}</div>
        </div>
        <div><span class="underline">Hak Kelas</span><div class="font-semibold">{{ peserta.hakKelas?.keterangan ?? "-" }}</div></div>
      </div>
      <div v-if="peserta && !pasien.length" class="p-3 text-sm rounded-md bg-[#FEF0C7] text-[#B54708]">
        Tidak ada pasien OpenSIMRS dengan nomor kartu ini. Lengkapi penjamin BPJS pasien di Admisi › Data Pasien lebih dulu.
      </div>
    </template>

    <div v-if="ubah || peserta" class="grid grid-cols-3 gap-3">
      <template v-if="!ubah">
        <CustomSelect v-model="pasienUuid" label="Pasien OpenSIMRS" :options="opsiPasien" optionValue="value" optionLabel="label" placeHolder="Pilih pasien" :disabled="!pasien.length" required />
        <CustomSelect v-model="sumber" label="Asal Pelayanan" :options="OPSI_SUMBER" optionValue="value" optionLabel="label" required />
        <CustomSelect v-model="sumberUuid" label="Kunjungan Asal" :options="opsiKunjungan" optionValue="value" optionLabel="label" placeHolder="Opsional" :disabled="!opsiKunjungan.length" clearable />
      </template>
      <CustomTextfield v-model="tglRencana" :label="spri ? 'Tanggal Rencana Rawat Inap' : 'Tanggal Rencana Kontrol'" type="date" required />
      <CustomSelect v-model="poliTujuan" :label="spri ? 'Spesialis/Poli DPJP' : 'Poli Tujuan'" :options="opsiPoli" optionValue="value" optionLabel="label" placeHolder="Pilih poli" showFilter required />
      <CustomSelect
        v-model="dpjp"
        label="Dokter DPJP (jadwal BPJS)"
        :options="opsiDokter"
        optionValue="value"
        optionLabel="label"
        :placeHolder="poliTujuan ? (opsiDokter.length ? 'Pilih dokter' : 'Tidak ada dokter berjadwal') : 'Pilih poli terlebih dahulu'"
        showFilter
        required
      />
      <CustomSelect
        v-if="!spri && !ubah"
        v-model="noSepAsal"
        label="SEP Kunjungan Asal"
        :options="opsiSep"
        optionValue="value"
        optionLabel="label"
        :placeHolder="opsiSep.length ? 'Pilih SEP' : 'Tidak ada SEP aktif'"
        :disabled="!opsiSep.length"
        clearable
      />
    </div>
    <div v-if="tglRencana && tglRencana < hariIni()" class="p-3 text-sm rounded-md bg-[#FDE2E1] text-[#B42318]">Tanggal rencana tidak boleh sebelum hari ini.</div>

    <div class="flex justify-end gap-3">
      <CustomButton label="Batal" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent" borderColor="border-2 border-[#9DA4B1]" @click="emit('batal')" />
      <CustomButton
        :label="ubah ? `Simpan Perubahan` : `Buat ${namaSurat}`"
        icon="PhPaperPlaneTilt"
        :disabled="!siap || tglRencana < hariIni()"
        @click="kirim"
      />
    </div>
  </div>
</template>
