<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount, type Ref } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import {
  cariItemMedisOk,
  checklistOk,
  daftarLokasiStokOk,
  detailJadwalOk,
  finalisasiLaporanOperasiOk,
  izinOk,
  laporanAnestesiOk,
  laporanOperasiOk,
  pemakaianOk,
  praOperasiOk,
  referensiChecklistOk,
  referensiPersetujuanOk,
  selesaiJadwalOk,
  simpanChecklistOk,
  simpanLaporanAnestesiOk,
  simpanLaporanOperasiOk,
  simpanPraOperasiOk,
  tambahPemakaianOk,
  waktuOk,
} from "@/stores/penunjang/kamarOperasi";
import { utilsStore } from "@/stores/utils";

// Detail jadwal operasi: pra-operasi, checklist keselamatan bedah WHO (sign in → time out → sign out, berurutan),
// pemakaian BHP/obat depo OK, serta laporan operasi & anestesi. Laporan operasi hanya dapat difinalkan bila
// checklist lengkap (KF-11); backend tetap jadi penentu akhir (pesan galat ditampilkan apa adanya).
const storeUtils = utilsStore();
const visible = defineModel<boolean>("visible", { default: false });
const props = defineProps<{ jadwalUuid: string }>();
const emit = defineEmits<{ (e: "tersimpan"): void }>();

const boleh = (submodul: string, aksi: string) => izinOk(submodul, aksi);

const jadwal = ref<any>(null);
const praoperasi = ref<any>({});
const kelengkapanPra = ref<{ lengkap: boolean; kekurangan: string[] }>({ lengkap: false, kekurangan: [] });
const checklist = ref<any>({ signIn: null, timeOut: null, signOut: null, lengkap: false });
const referensiChecklist = ref<any>({});
const pemakaian = ref<any[]>([]);
const laporan = ref<any>(null);
const tagihanMenunggu = ref<string[]>([]);
const anestesi = ref<any>({});
const formPemakaian = ref({ itemMedisUuid: "", qty: 1, lokasiStokUuid: "" });
const praTermuat = ref(false);

// Model persetujuan belum membedakan jenis tindakan/anestesi; kedua pilihan memakai rekam medis order.
const daftarPersetujuan = ref<any[]>([]);
const daftarLokasiStok = ref<any[]>([]);
const opsiItemMedis = ref<any[]>([]);
const statusPersetujuan = ref({ memuat: false, galat: "", termuat: false });
const statusLokasi = ref({ memuat: false, galat: "", termuat: false });
const statusItem = ref({ memuat: false, galat: "", termuat: false });
const pencarianItem = ref("");
const sedangSimpanPra = ref(false);
const sedangTambahPemakaian = ref(false);
let versiDialog = 0;
let versiItem = 0;
const opsiPersetujuan = () =>
  daftarPersetujuan.value.map((c) => ({
    value: c.uuid,
    label: `${c.tindakanKedokteran || "Persetujuan tindakan"} — ${waktuOk(c.tglPersetujuan)}${
      c.persetujuan === true ? " (Disetujui)" : c.persetujuan === false ? " (Ditolak)" : " (Menunggu)"
    }`,
  }));
// Persetujuan tindakan & anestesi wajib dokumen berbeda: sembunyikan consent yang sudah dipilih di isian lain
// (nilai isian sendiri tetap ditampilkan agar data lama yang terlanjur sama tetap terbaca dan dapat diganti).
const opsiPersetujuanKecuali = (dipakaiLain?: string | null, sendiri?: string | null) =>
  opsiPersetujuan().filter((o) => !dipakaiLain || o.value !== dipakaiLain || o.value === sendiri);
const consentSama = computed(
  () => !!praoperasi.value.consentTindakanUuid && praoperasi.value.consentTindakanUuid === praoperasi.value.consentAnestesiUuid,
);
const opsiLokasiStok = () => daftarLokasiStok.value.map((l) => ({ value: l.uuid, label: `${l.code} — ${l.name}` }));
const opsiItemMedisTampil = () => opsiItemMedis.value.map((i) => ({ value: i.uuid, label: `${i.code} — ${i.name}` }));
const muatPilihan = async (ambil: () => Promise<any>, daftar: Ref<any[]>, status: typeof statusPersetujuan) => {
  const versi = versiDialog;
  status.value = { memuat: true, galat: "", termuat: false };
  try {
    const res = await ambil();
    if (versi !== versiDialog || !visible.value) return;
    if (!Array.isArray(res?.payload)) throw new Error("Pilihan gagal dimuat. Silakan muat ulang.");
    daftar.value = res.payload;
    status.value.termuat = true;
  } catch {
    if (versi === versiDialog) status.value.galat = "Pilihan gagal dimuat. Silakan muat ulang.";
  } finally {
    if (versi === versiDialog) status.value.memuat = false;
  }
};
const muatPersetujuan = () => muatPilihan(() => referensiPersetujuanOk(props.jadwalUuid), daftarPersetujuan, statusPersetujuan);
const muatLokasi = () => muatPilihan(daftarLokasiStokOk, daftarLokasiStok, statusLokasi);
const cariItemMedis = async (cari = "") => {
  const versi = versiDialog;
  const permintaan = ++versiItem;
  pencarianItem.value = cari;
  statusItem.value = { memuat: true, galat: "", termuat: false };
  try {
    const res = await cariItemMedisOk(cari);
    if (versi !== versiDialog || permintaan !== versiItem || !visible.value) return;
    if (!Array.isArray(res?.payload)) throw new Error("Pilihan gagal dimuat");
    const dipilih = opsiItemMedis.value.find((i) => i.uuid === formPemakaian.value.itemMedisUuid);
    opsiItemMedis.value = dipilih && !res.payload.some((i: any) => i.uuid === dipilih.uuid) ? [dipilih, ...res.payload] : res.payload;
    statusItem.value.termuat = true;
  } catch {
    if (versi === versiDialog && permintaan === versiItem) statusItem.value.galat = "Item medis gagal dimuat. Silakan muat ulang.";
  } finally {
    if (versi === versiDialog && permintaan === versiItem) statusItem.value.memuat = false;
  }
};

const muatSemua = async () => {
  if (!props.jadwalUuid) return;
  const versi = versiDialog;
  storeUtils.setLoading(true);
  try {
    const [j, pra, cek, ref_, pem, lap, anes] = await Promise.all([
      detailJadwalOk(props.jadwalUuid),
      boleh('Pra-Operasi', 'READ') ? praOperasiOk(props.jadwalUuid) : undefined,
      boleh('Checklist Keselamatan', 'READ') ? checklistOk(props.jadwalUuid) : undefined,
      boleh('Checklist Keselamatan', 'READ') ? referensiChecklistOk() : undefined,
      boleh('Pemakaian BHP', 'READ') ? pemakaianOk(props.jadwalUuid) : undefined,
      boleh('Laporan Operasi', 'READ') ? laporanOperasiOk(props.jadwalUuid) : undefined,
      boleh('Laporan Anestesi', 'READ') ? laporanAnestesiOk(props.jadwalUuid) : undefined,
    ]);
    if (versi !== versiDialog || !visible.value) return;
    jadwal.value = j?.payload ?? null;
    praoperasi.value = pra?.payload?.praoperasi ?? {};
    praTermuat.value = !!pra?.payload;
    kelengkapanPra.value = { lengkap: !!pra?.payload?.kelengkapan?.lengkap, kekurangan: pra?.payload?.kelengkapan?.kekurangan ?? [] };
    checklist.value = cek?.payload ?? { signIn: null, timeOut: null, signOut: null, lengkap: false };
    referensiChecklist.value = ref_?.payload ?? {};
    pemakaian.value = pem?.payload ?? [];
    laporan.value = lap?.payload?.laporan ?? {};
    tagihanMenunggu.value = laporan.value?.tagihanMenunggu ?? [];
    anestesi.value = anes?.payload ?? {};
  } finally {
    if (versi === versiDialog) storeUtils.setLoading(false);
  }
};
watch([visible, () => props.jadwalUuid], ([terbuka]) => {
  versiDialog++;
  versiItem++;
  jadwal.value = null;
  praoperasi.value = {};
  praTermuat.value = false;
  formPemakaian.value = { itemMedisUuid: "", qty: 1, lokasiStokUuid: "" };
  daftarPersetujuan.value = [];
  daftarLokasiStok.value = [];
  opsiItemMedis.value = [];
  pencarianItem.value = "";
  for (const status of [statusPersetujuan, statusLokasi, statusItem]) status.value = { memuat: false, galat: "", termuat: false };
  storeUtils.setLoading(false);
  if (!terbuka || !props.jadwalUuid) return;
  void muatSemua();
  if (boleh('Pra-Operasi', 'READ')) void muatPersetujuan();
  if (boleh('Pemakaian BHP', 'READ')) {
    void muatLokasi();
    void cariItemMedis();
  }
}, { immediate: true });
onBeforeUnmount(() => { versiDialog++; versiItem++; storeUtils.setLoading(false); });

// ── Pra-operasi
const simpanPra = async () => {
  if (sedangSimpanPra.value || !praTermuat.value || !statusPersetujuan.value.termuat || consentSama.value) return;
  const versi = versiDialog;
  sedangSimpanPra.value = true;
  storeUtils.setLoading(true);
  try {
    const res = await simpanPraOperasiOk(props.jadwalUuid, praoperasi.value);
    if (res?.payload && versi === versiDialog && visible.value) {
      praoperasi.value = res.payload.praoperasi ?? {};
      kelengkapanPra.value = { lengkap: !!res.payload.kelengkapan?.lengkap, kekurangan: res.payload.kelengkapan?.kekurangan ?? [] };
    }
  } finally {
    sedangSimpanPra.value = false;
    storeUtils.setLoading(false);
  }
};

// ── Checklist
// Kunci respons camelCase (interceptor apiHandler mengonversi sign_in/time_out/sign_out → signIn/timeOut/signOut).
const KUNCI_TAHAP: Record<"sign-in" | "time-out" | "sign-out", "signIn" | "timeOut" | "signOut"> = {
  "sign-in": "signIn",
  "time-out": "timeOut",
  "sign-out": "signOut",
};
const dialogChecklist = ref(false);
const tahapAktif = ref<"sign-in" | "time-out" | "sign-out">("sign-in");
const itemChecklist = ref<any[]>([]);
const bukaChecklist = (tahap: "sign-in" | "time-out" | "sign-out") => {
  tahapAktif.value = tahap;
  const kunci = KUNCI_TAHAP[tahap];
  const sudah = checklist.value[kunci];
  itemChecklist.value = sudah?.item ?? (referensiChecklist.value[kunci] ?? []).map((i: any) => ({ ...i, jawaban: false, catatan: "" }));
  dialogChecklist.value = true;
};
const simpanChecklist = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await simpanChecklistOk(props.jadwalUuid, tahapAktif.value, itemChecklist.value);
    if (res?.payload) {
      checklist.value = res.payload;
      dialogChecklist.value = false;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Pemakaian
const tambahPemakaianBaris = async () => {
  if (sedangTambahPemakaian.value || !formPemakaian.value.itemMedisUuid || !formPemakaian.value.lokasiStokUuid) return;
  const versi = versiDialog;
  const uuid = props.jadwalUuid;
  sedangTambahPemakaian.value = true;
  storeUtils.setLoading(true);
  try {
    const res = await tambahPemakaianOk(uuid, formPemakaian.value);
    if (res?.payload && versi === versiDialog && visible.value) {
      formPemakaian.value = { itemMedisUuid: "", qty: 1, lokasiStokUuid: "" };
      const pem = await pemakaianOk(uuid);
      if (pem?.payload && versi === versiDialog && visible.value) pemakaian.value = pem.payload;
    }
  } finally {
    sedangTambahPemakaian.value = false;
    storeUtils.setLoading(false);
  }
};

// ── Laporan operasi
const simpanLaporan = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await simpanLaporanOperasiOk(props.jadwalUuid, laporan.value);
    if (res?.payload?.laporan) laporan.value = res.payload.laporan;
  } finally {
    storeUtils.setLoading(false);
  }
};
const finalisasi = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await finalisasiLaporanOperasiOk(props.jadwalUuid);
    if (res?.payload) {
      laporan.value = res.payload.laporan;
      tagihanMenunggu.value = res.payload.tagihanMenunggu ?? [];
      emit("tersimpan");
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Laporan anestesi
const obatTeks = ref("");
const monitoringTeks = ref("");
watch(anestesi, (a) => {
  obatTeks.value = (a?.obat ?? []).map((o: any) => o.catatan ?? o).join("\n");
  monitoringTeks.value = (a?.monitoring ?? []).map((m: any) => m.catatan ?? m).join("\n");
});
const simpanAnestesi = async () => {
  storeUtils.setLoading(true);
  try {
    const data = {
      ...anestesi.value,
      obat: obatTeks.value.split("\n").map((s) => s.trim()).filter(Boolean).map((catatan) => ({ catatan })),
      monitoring: monitoringTeks.value.split("\n").map((s) => s.trim()).filter(Boolean).map((catatan) => ({ catatan })),
    };
    const res = await simpanLaporanAnestesiOk(props.jadwalUuid, data);
    if (res?.payload) anestesi.value = res.payload;
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Selesaikan operasi
const selesaikan = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await selesaiJadwalOk(props.jadwalUuid, anestesi.value?.serahTerima);
    if (res?.payload) {
      jadwal.value = res.payload;
      emit("tersimpan");
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <CustomDialog v-model:visible="visible" width="980px">
    <template #header>Detail Operasi — {{ jadwal?.noOrder }}</template>
    <template #body>
      <div v-if="jadwal" class="flex flex-col gap-5 pt-4 text-sm">
        <div class="grid grid-cols-3 gap-x-6 gap-y-1 p-3 rounded-lg bg-opensimrs-50">
          <div><b>{{ jadwal.namaPasien }}</b> ({{ jadwal.noRm }})</div>
          <div>{{ jadwal.ruangKode }} — {{ jadwal.ruangNama }}</div>
          <div>{{ waktuOk(jadwal.waktuMulai) }} – {{ waktuOk(jadwal.waktuSelesai, true) }}</div>
          <div class="col-span-3">{{ jadwal.diagnosisNama }}</div>
        </div>

        <!-- Pra-Operasi -->
        <section v-if="boleh('Pra-Operasi', 'READ')">
          <h3 class="mb-2 font-semibold">Pra-Operasi</h3>
          <CustomButton size="small" label="Muat ulang persetujuan" :disabled="statusPersetujuan.memuat" @click="muatPersetujuan" />
          <p v-if="statusPersetujuan.galat" class="text-danger-300" role="alert">{{ statusPersetujuan.galat }}</p>
          <div class="grid grid-cols-2 gap-4">
            <CustomTextArea v-model="praoperasi.asesmenPraBedah" label="Asesmen Pra-Bedah" />
            <CustomTextArea v-model="praoperasi.asesmenPraAnestesi" label="Asesmen Pra-Anestesi" />
            <CustomTextArea v-model="praoperasi.penandaanLokasi" label="Penandaan Lokasi Operasi" />
            <CustomTextArea v-model="praoperasi.kebutuhanDarah" label="Kebutuhan Darah (opsional)" />
            <CustomSelect
              v-model="praoperasi.consentTindakanUuid"
              label="Persetujuan Tindakan"
              placeHolder="Pilih persetujuan tindakan"
              :options="opsiPersetujuanKecuali(praoperasi.consentAnestesiUuid, praoperasi.consentTindakanUuid)"
              :isLoading="statusPersetujuan.memuat"
              :disabled="!boleh('Pra-Operasi', 'UPDATE') || !statusPersetujuan.termuat || sedangSimpanPra"
              optionValue="value"
              optionLabel="label"
            >
              <template #customValue="{ value, placeholder }">{{ value ? opsiPersetujuan().find((o) => o.value === value)?.label ?? 'Persetujuan tersimpan tidak tersedia; pilih kembali' : placeholder }}</template>
            </CustomSelect>
            <CustomSelect
              v-model="praoperasi.consentAnestesiUuid"
              label="Persetujuan Anestesi"
              placeHolder="Pilih persetujuan anestesi"
              :options="opsiPersetujuanKecuali(praoperasi.consentTindakanUuid, praoperasi.consentAnestesiUuid)"
              :isLoading="statusPersetujuan.memuat"
              :disabled="!boleh('Pra-Operasi', 'UPDATE') || !statusPersetujuan.termuat || sedangSimpanPra"
              optionValue="value"
              optionLabel="label"
            >
              <template #customValue="{ value, placeholder }">{{ value ? opsiPersetujuan().find((o) => o.value === value)?.label ?? 'Persetujuan tersimpan tidak tersedia; pilih kembali' : placeholder }}</template>
            </CustomSelect>
          </div>
          <p v-if="consentSama" class="text-danger-300 text-sm" role="alert">Persetujuan tindakan dan persetujuan anestesi harus dokumen inform consent yang berbeda.</p>
          <NoData v-if="statusPersetujuan.termuat && !daftarPersetujuan.length" title="Belum ada persetujuan pada rekam medis operasi ini." />
          <div class="flex items-center justify-between mt-2">
            <div v-if="!kelengkapanPra.lengkap" class="text-xs text-warning-400">Belum lengkap: {{ kelengkapanPra.kekurangan.join("; ") }}</div>
            <div v-else class="text-xs text-success-400">Pra-operasi lengkap.</div>
            <CustomButton v-if="boleh('Pra-Operasi', 'UPDATE')" size="small" label="Simpan Pra-Operasi" :loading="sedangSimpanPra" :disabled="!praTermuat || !statusPersetujuan.termuat || sedangSimpanPra || consentSama" @click="simpanPra" />
          </div>
        </section>

        <!-- Checklist -->
        <section>
          <h3 class="mb-2 font-semibold">Checklist Keselamatan Bedah (WHO)</h3>
          <div class="grid grid-cols-3 gap-3">
            <div v-for="t in [['signIn', 'sign-in', 'Sign In'], ['timeOut', 'time-out', 'Time Out'], ['signOut', 'sign-out', 'Sign Out']]" :key="t[0]" class="p-3 text-center border rounded-lg border-grey-75">
              <div class="font-semibold">{{ t[2] }}</div>
              <div class="my-1 text-xs" :class="checklist[t[0]] ? 'text-success-400' : 'text-grey-400'">{{ checklist[t[0]] ? `Diisi · ${waktuOk(checklist[t[0]].waktuDiisi)}` : "Belum diisi" }}</div>
              <CustomButton v-if="boleh('Checklist Keselamatan', 'UPDATE')" size="small" :label="checklist[t[0]] ? 'Lihat' : 'Isi'" :disabled="!!checklist[t[0]]" @click="bukaChecklist(t[1] as any)" />
            </div>
          </div>
        </section>

        <!-- Pemakaian BHP -->
        <section v-if="boleh('Pemakaian BHP', 'READ')">
          <h3 class="mb-2 font-semibold">Pemakaian BHP / Obat Depo OK</h3>
          <DataTable :value="pemakaian" class="mb-2 text-xs" stripedRows>
            <template #empty><NoData title="Belum ada pemakaian BHP atau obat." /></template>
            <Column header="Item" field="namaItem" headerClass="bg-opensimrs-50" />
            <Column header="Qty" field="qty" headerClass="bg-opensimrs-50" />
            <Column header="Harga Satuan" headerClass="bg-opensimrs-50">
              <template #body="{ data: p }">{{ p.hargaSatuan }}</template>
            </Column>
          </DataTable>
          <div v-if="boleh('Pemakaian BHP', 'CREATE')" class="grid grid-cols-[1fr_100px_1fr_120px] gap-2">
            <CustomSelect
              v-model="formPemakaian.itemMedisUuid"
              :showLabel="false"
              placeHolder="Cari item medis"
              :options="opsiItemMedisTampil()"
              :isLoading="statusItem.memuat"
              :disabled="sedangTambahPemakaian"
              optionValue="value"
              optionLabel="label"
              @filter="cariItemMedis"
            />
            <CustomTextfield v-model.number="formPemakaian.qty" type="number" placeholder="Qty" />
            <CustomSelect
              v-model="formPemakaian.lokasiStokUuid"
              :showLabel="false"
              placeHolder="Pilih lokasi stok (Depo OK)"
              :options="opsiLokasiStok()"
              :isLoading="statusLokasi.memuat"
              :disabled="!statusLokasi.termuat || sedangTambahPemakaian"
              optionValue="value"
              optionLabel="label"
            />
            <CustomButton label="Tambah" :loading="sedangTambahPemakaian" :disabled="sedangTambahPemakaian || !statusItem.termuat || !statusLokasi.termuat || !formPemakaian.itemMedisUuid || !formPemakaian.lokasiStokUuid" @click="tambahPemakaianBaris" />
          </div>
          <div v-if="boleh('Pemakaian BHP', 'CREATE')" class="flex flex-col gap-2 mt-2">
            <div class="flex gap-2">
              <CustomButton size="small" label="Muat ulang item medis" :disabled="statusItem.memuat" @click="cariItemMedis(pencarianItem)" />
              <CustomButton size="small" label="Muat ulang lokasi stok" :disabled="statusLokasi.memuat" @click="muatLokasi" />
            </div>
            <p v-if="statusItem.galat" class="text-danger-300" role="alert">{{ statusItem.galat }}</p>
            <p v-if="statusLokasi.galat" class="text-danger-300" role="alert">{{ statusLokasi.galat }}</p>
            <NoData v-if="statusItem.termuat && !opsiItemMedis.length" title="Tidak ada item medis yang sesuai. Coba nama atau kode lain." />
            <NoData v-if="statusLokasi.termuat && !daftarLokasiStok.length" title="Belum ada lokasi stok berjenis depo yang aktif di fasilitas ini." />
          </div>
        </section>

        <!-- Laporan Operasi -->
        <section>
          <h3 class="mb-2 font-semibold">Laporan Operasi ({{ laporan?.status ?? "draft" }})</h3>
          <div class="grid grid-cols-2 gap-4">
            <CustomTextArea v-model="laporan.diagnosisPra" label="Diagnosis Pra-Operasi" :disabled="laporan?.status === 'final'" />
            <CustomTextArea v-model="laporan.diagnosisPasca" label="Diagnosis Pasca-Operasi" :disabled="laporan?.status === 'final'" />
            <CustomTextArea v-model="laporan.tindakanDilakukan" label="Tindakan yang Dilakukan" :disabled="laporan?.status === 'final'" />
            <CustomTextArea v-model="laporan.temuan" label="Temuan Operasi" :disabled="laporan?.status === 'final'" />
            <CustomTextArea v-model="laporan.komplikasi" label="Komplikasi" :disabled="laporan?.status === 'final'" />
            <CustomTextfield v-model.number="laporan.jumlahPerdarahanMl" type="number" label="Jumlah Perdarahan (mL)" :disabled="laporan?.status === 'final'" />
          </div>
          <div v-if="tagihanMenunggu.length" class="p-2 mt-2 text-xs rounded-lg text-warning-500 bg-warning-50">
            Menunggu tarif: {{ tagihanMenunggu.join("; ") }}
          </div>
          <div class="flex justify-end gap-2 mt-2">
            <CustomButton v-if="laporan?.status !== 'final' && boleh('Laporan Operasi', 'UPDATE')" size="small" label="Simpan Draf" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="simpanLaporan" />
            <CustomButton v-if="laporan?.status !== 'final' && boleh('Laporan Operasi', 'FINALISASI')" size="small" label="Finalisasi" @click="finalisasi" />
          </div>
        </section>

        <!-- Laporan Anestesi -->
        <section>
          <h3 class="mb-2 font-semibold">Laporan Anestesi</h3>
          <div class="grid grid-cols-2 gap-4">
            <CustomTextfield v-model="anestesi.jenisAnestesi" label="Jenis Anestesi" />
            <CustomTextArea v-model="obatTeks" label="Obat Anestesi (satu baris per catatan)" />
            <CustomTextArea v-model="monitoringTeks" label="Monitoring Intra-Anestesi (satu baris per catatan)" />
            <CustomTextfield v-model.number="anestesi.aldreteMasuk" type="number" label="Skor Aldrete Masuk (0–10)" />
            <CustomTextfield v-model.number="anestesi.aldreteKeluar" type="number" label="Skor Aldrete Keluar (0–10)" />
            <CustomTextArea v-model="anestesi.serahTerima" label="Catatan Serah Terima ke Ruangan" />
          </div>
          <div class="flex justify-end gap-2 mt-2">
            <CustomButton v-if="boleh('Laporan Anestesi', 'UPDATE')" size="small" label="Simpan Laporan Anestesi" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="simpanAnestesi" />
            <CustomButton v-if="jadwal.status === 'terjadwal' && boleh('Jadwal OK', 'VALIDASI')" size="small" label="Selesai / Kembali ke Ruangan" @click="selesaikan" />
          </div>
        </section>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="visible = false" />
      </div>
    </template>
  </CustomDialog>

  <!-- Isi checklist -->
  <CustomDialog v-model:visible="dialogChecklist" width="560px">
    <template #header>Checklist {{ tahapAktif }}</template>
    <template #body>
      <div class="flex flex-col gap-3 pt-4 text-sm">
        <div v-for="(it, i) in itemChecklist" :key="it.kode" class="flex items-start gap-2">
          <Checkbox v-model="itemChecklist[i].jawaban" binary />
          <div class="flex-1">
            <div>{{ it.label }}</div>
            <CustomTextfield v-model="itemChecklist[i].catatan" placeholder="Catatan (opsional)" />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogChecklist = false" />
        <CustomButton label="Simpan" @click="simpanChecklist" />
      </div>
    </template>
  </CustomDialog>
</template>
