<script setup lang="ts">
import { computed, ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import { utilsStore } from "@/stores/utils";
import {
  JENIS_INSIDEN,
  STATUS_TL_IKP,
  bacaBerkas,
  bukaBerkas,
  bukaInvestigasiIkp,
  bukaLaporanIkp,
  buatTindakLanjutIkp,
  detailLaporanIkp,
  epochTanggal,
  gayaGrade,
  gayaStatusIkp,
  gayaTenggat,
  gayaTlIkp,
  gradingIkp,
  hapusLampiranIkp,
  hapusTindakLanjutIkp,
  izinIkp,
  jamTeks,
  mintaLengkapiIkp,
  opsi,
  selesaiInvestigasiIkp,
  simpanInvestigasiIkp,
  tanggalMutu,
  tautkanPasienIkp,
  terimaLaporanIkp,
  tutupLaporanIkp,
  ubahTindakLanjutIkp,
  ukuranBerkas,
  unduhLampiranIkp,
  unggahLampiranIkp,
  verifikasiTindakLanjutIkp,
  waktuIkp,
} from "@/stores/penunjang/mutu";

// Detail & proses laporan IKP (STD-0026): penerimaan kepala unit, grading matriks dampak × probabilitas, investigasi
// sederhana / RCA (jenis ditentukan backend dari grade & jenis insiden), rekomendasi & tindak lanjut (PIC, tenggat,
// verifikasi), lampiran, rujukan pasien (izin LIHAT PASIEN), penutupan, dan riwayat. Setiap tombol mengikuti izin aksi;
// backend tetap memeriksa izin & syarat alur.
const props = defineProps<{ uuid: string; referensi: any }>();
const emit = defineEmits<{ (e: "berubah"): void }>();
const storeUtils = utilsStore();
const boleh = izinIkp;

const d = ref<any>(null);
const tab = ref("ringkasan");
const muat = async () => {
  if (!props.uuid) return;
  storeUtils.setLoading(true);
  try {
    const res = await detailLaporanIkp(props.uuid);
    d.value = res?.payload ?? null;
    isiForm();
  } finally {
    storeUtils.setLoading(false);
  }
};
watch(() => props.uuid, () => {
  tab.value = "ringkasan";
  muat();
}, { immediate: true });

// Jalankan aksi: hasil berupa detail terbaru → perbarui tampilan & beri tahu daftar.
const aksi = async (fn: () => Promise<any>) => {
  storeUtils.setLoading(true);
  try {
    const res = await fn();
    if (res?.payload?.uuid) {
      d.value = res.payload;
      isiForm();
    } else if (res) await muat();
    if (res) emit("berubah");
    return res;
  } finally {
    storeUtils.setLoading(false);
  }
};
const ditutup = computed(() => d.value?.status === "ditutup");
const label = (daftar: any[], kode?: string | null) => (daftar ?? []).find((x: any) => String(x.kode) === String(kode))?.nama ?? (kode || "-");
const opsiPegawai = computed(() => (props.referensi?.pegawai ?? []).map((p: any) => ({ value: p.uuid, label: p.nama })));
const matriks = computed<string[][]>(() => props.referensi?.pengaturan?.matriks ?? []);

// ── Penerimaan
const catatanTerima = ref("");
const alasanLengkap = ref("");
const noReg = ref("");
// ── Grading
const gDampak = ref<number | null>(null);
const gProb = ref<number | null>(null);
const gAlasan = ref("");
const pratinjauGrade = computed(() => (gDampak.value && gProb.value ? matriks.value?.[gProb.value - 1]?.[gDampak.value - 1] : null));
// ── Investigasi
const inv = ref<any>({ tim: "", penyebabLangsung: "", akarMasalah: "", analisis: "", rekomendasi: "" });
const alasanBukaInv = ref("");
// ── Tindak lanjut
const tlBaru = ref<any>({ uraian: "", picPegawaiUuid: "", tenggat: null });
const tlUbah = ref<any>(null);
// ── Tutup
const alasanTutup = ref("");
const alasanBuka = ref("");

const isiForm = () => {
  const x = d.value;
  if (!x) return;
  const g = x.grading?.find((y: any) => y.aktif);
  gDampak.value = g?.dampak ?? null;
  gProb.value = g?.probabilitas ?? null;
  gAlasan.value = "";
  const i = x.investigasi ?? {};
  inv.value = { tim: i.tim ?? "", penyebabLangsung: i.penyebabLangsung ?? "", akarMasalah: i.akarMasalah ?? "", analisis: i.analisis ?? "", rekomendasi: i.rekomendasi ?? "" };
  noReg.value = x.noReg ?? "";
  tlBaru.value = { uraian: "", picPegawaiUuid: "", tenggat: null };
  tlUbah.value = null;
};
const perluRca = computed(() => d.value?.jenisInsiden === "sentinel" || ["kuning", "merah"].includes(d.value?.grade));

const terima = () => aksi(() => terimaLaporanIkp(d.value.uuid, catatanTerima.value.trim() || undefined));
const mintaLengkapi = () => {
  if (!alasanLengkap.value.trim()) return;
  return aksi(() => mintaLengkapiIkp(d.value.uuid, alasanLengkap.value.trim()));
};
const tautkan = (lepas = false) => aksi(() => tautkanPasienIkp(d.value.uuid, lepas ? null : noReg.value.trim() || null));
const simpanGrading = () => {
  if (!gDampak.value || !gProb.value) return;
  return aksi(() => gradingIkp(d.value.uuid, { dampak: gDampak.value!, probabilitas: gProb.value!, alasan: gAlasan.value.trim() || undefined }));
};
const simpanInv = () => aksi(() => simpanInvestigasiIkp(d.value.uuid, { ...inv.value }));
const selesaiInv = async () => {
  if (!(await aksi(() => simpanInvestigasiIkp(d.value.uuid, { ...inv.value })))) return;
  return aksi(() => selesaiInvestigasiIkp(d.value.uuid));
};
const bukaInv = () => {
  if (!alasanBukaInv.value.trim()) return;
  return aksi(() => bukaInvestigasiIkp(d.value.uuid, alasanBukaInv.value.trim()));
};
const tambahTl = () => {
  const t = tlBaru.value;
  if (!t.uraian.trim() || !t.picPegawaiUuid || !t.tenggat) return;
  return aksi(() => buatTindakLanjutIkp(d.value.uuid, { uraian: t.uraian.trim(), picPegawaiUuid: t.picPegawaiUuid, tenggat: epochTanggal(t.tenggat) }));
};
const mulaiUbahTl = (t: any) => {
  tlUbah.value = { ...t, progres: t.progres ?? "", hasil: t.hasil ?? "", tenggatTgl: t.tenggat ? new Date(Number(t.tenggat) * 1000) : null };
};
const simpanTl = () => {
  const t = tlUbah.value;
  return aksi(() => ubahTindakLanjutIkp(t.uuid, { uraian: t.uraian, picPegawaiUuid: t.picPegawaiUuid, tenggat: epochTanggal(t.tenggatTgl), status: t.status, progres: t.progres, hasil: t.hasil }));
};
const hapusTl = (t: any) => confirm("Hapus tindak lanjut ini?") && aksi(() => hapusTindakLanjutIkp(t.uuid));
const verifikasiTl = (t: any) => aksi(() => verifikasiTindakLanjutIkp(t.uuid));
const tutup = () => aksi(() => tutupLaporanIkp(d.value.uuid, alasanTutup.value.trim() || undefined));
const bukaKembali = () => {
  if (!alasanBuka.value.trim()) return;
  return aksi(() => bukaLaporanIkp(d.value.uuid, alasanBuka.value.trim()));
};
const pilihLampiran = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = "";
  if (!f) return;
  await aksi(async () => (await unggahLampiranIkp(d.value.uuid, await bacaBerkas(f))) && detailLaporanIkp(d.value.uuid));
};
const unduh = async (l: any) => {
  const res = await unduhLampiranIkp(l.uuid);
  if (res?.payload) bukaBerkas(res.payload);
};
const hapusLampiran = async (l: any) => {
  if (!confirm(`Hapus lampiran ${l.namaBerkas}?`)) return;
  await aksi(async () => (await hapusLampiranIkp(l.uuid)) && detailLaporanIkp(d.value.uuid));
};
const AKSI_RIWAYAT: Record<string, string> = {
  lapor: "Laporan dikirim",
  lengkapi: "Laporan dilengkapi",
  terima: "Diterima unit",
  minta_lengkapi: "Dikembalikan untuk dilengkapi",
  tautkan_pasien: "Rujukan pasien ditautkan",
  lepas_pasien: "Rujukan pasien dilepas",
  grading: "Grading risiko",
  grading_ulang: "Grading ulang",
  catat_investigasi: "Investigasi dicatat",
  ubah_investigasi: "Investigasi diperbarui",
  selesai_investigasi: "Investigasi selesai",
  buka_investigasi: "Investigasi dibuka kembali",
  buat_tindak_lanjut: "Tindak lanjut dibuat",
  ubah_tindak_lanjut: "Tindak lanjut diperbarui",
  hapus_tindak_lanjut: "Tindak lanjut dihapus",
  verifikasi_tindak_lanjut: "Tindak lanjut diverifikasi",
  unggah_lampiran: "Lampiran diunggah",
  hapus_lampiran: "Lampiran dihapus",
  tutup: "Laporan ditutup",
  buka_kembali: "Laporan dibuka kembali",
};
const ringkasRiwayat = (r: any) => {
  const s = r.dataSesudah ?? {};
  return [s.grade ? `grade ${gayaGrade(s.grade).label.toLowerCase()} (skor ${s.skor})` : "", s.alasan ? `alasan: ${s.alasan}` : "", s.status && !s.grade ? `status: ${s.status}` : ""].filter(Boolean).join(" · ");
};
const OPSI_STATUS_TL = opsi(STATUS_TL_IKP).filter((o) => o.value !== "terverifikasi");
</script>

<template>
  <div v-if="d" class="flex flex-col gap-3 pt-2 text-sm">
    <div class="flex flex-wrap items-center gap-2">
      <span class="font-semibold">{{ d.nomor }}</span>
      <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaStatusIkp(d.status).bg, gayaStatusIkp(d.status).text]">{{ gayaStatusIkp(d.status).label }}</span>
      <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaGrade(d.grade).bg, gayaGrade(d.grade).text]">{{ gayaGrade(d.grade).label }}<template v-if="d.skor"> · skor {{ d.skor }}</template></span>
      <span v-if="d.terlambatLapor" class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FDE2E1] text-[#B42318]">Laporan terlambat</span>
      <span v-if="d.statusTenggatInvestigasi" class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaTenggat(d.statusTenggatInvestigasi).bg, gayaTenggat(d.statusTenggatInvestigasi).text]">
        Investigasi: {{ gayaTenggat(d.statusTenggatInvestigasi).label }} ({{ waktuIkp(d.batasInvestigasi) }})
      </span>
    </div>

    <Tabs :value="tab" @update:value="(v: any) => (tab = v)">
      <TabList>
        <Tab value="ringkasan">Laporan</Tab>
        <Tab value="grading">Grading</Tab>
        <Tab value="investigasi">{{ perluRca ? "RCA" : "Investigasi" }}</Tab>
        <Tab value="tindak">Tindak Lanjut ({{ d.tindakLanjut?.length ?? 0 }})</Tab>
        <Tab value="lampiran">Lampiran ({{ d.lampiran?.length ?? 0 }})</Tab>
        <Tab value="riwayat">Riwayat</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="ringkasan">
          <div class="grid grid-cols-2 gap-x-6 gap-y-2">
            <div><span class="text-grey-400">Jenis:</span> {{ JENIS_INSIDEN[d.jenisInsiden] ?? d.jenisInsiden }}</div>
            <div><span class="text-grey-400">Kelompok:</span> {{ label(referensi.kategoriInsiden, d.kategoriInsiden) }}</div>
            <div><span class="text-grey-400">Waktu kejadian:</span> {{ waktuIkp(d.waktuKejadian) }}</div>
            <div><span class="text-grey-400">Diketahui:</span> {{ waktuIkp(d.waktuDiketahui) }}</div>
            <div><span class="text-grey-400">Dilaporkan:</span> {{ waktuIkp(d.waktuLapor) }} ({{ jamTeks(d.jamPelaporan) }} setelah diketahui; batas {{ d.tenggatLaporJam }} jam)</div>
            <div><span class="text-grey-400">Unit / tempat:</span> {{ d.unitNama || "-" }}<template v-if="d.tempatKejadian"> · {{ d.tempatKejadian }}</template></div>
            <div><span class="text-grey-400">Layanan:</span> {{ label(referensi.layanan, d.layanan) }}</div>
            <div><span class="text-grey-400">Akibat:</span> {{ label(referensi.akibat, d.akibat) }}</div>
            <div><span class="text-grey-400">Pelapor:</span> {{ d.anonim ? "Anonim (identitas dirahasiakan)" : d.pelaporNama || d.dibuatOleh || "-" }}</div>
            <div>
              <span class="text-grey-400">Pasien:</span>
              <template v-if="d.pasienNoRm">{{ d.pasienNoRm }} · {{ d.pasienNama }} · {{ d.noReg }}</template>
              <template v-else>{{ d.terkaitPasien ? "Terkait pasien (rujukan hanya untuk petugas berwenang)" : "Tidak ditautkan" }}</template>
            </div>
            <div class="col-span-2"><div class="text-grey-400">Kronologi</div><div class="whitespace-pre-line">{{ d.kronologi }}</div></div>
            <div class="col-span-2"><div class="text-grey-400">Tindakan segera ({{ label(referensi.tindakanOleh, d.tindakanOleh) }})</div><div class="whitespace-pre-line">{{ d.tindakanSegera || "-" }}</div></div>
            <div v-if="d.pernahTerjadi" class="col-span-2"><span class="text-grey-400">Pernah terjadi di unit lain:</span> {{ d.keteranganPernahTerjadi || "Ya" }}</div>
            <div v-if="d.catatanTerima" class="col-span-2"><span class="text-grey-400">Catatan penerimaan:</span> {{ d.catatanTerima }}</div>
            <div v-if="d.alasanTutup" class="col-span-2"><span class="text-grey-400">Alasan penutupan:</span> {{ d.alasanTutup }}</div>
          </div>
          <div v-if="boleh('TERIMA') && ['dilaporkan', 'perlu_dilengkapi'].includes(d.status)" class="grid grid-cols-2 gap-3 p-3 mt-4 border rounded-lg border-grey-75">
            <CustomTextfield v-model="catatanTerima" label="Catatan Penerimaan (opsional)" :maxLength="2000" />
            <div class="flex items-end"><CustomButton label="Terima Laporan" icon="PhCheck" @click="terima" /></div>
            <template v-if="d.status === 'dilaporkan'">
              <CustomTextfield v-model="alasanLengkap" label="Alasan Minta Dilengkapi" :maxLength="2000" />
              <div class="flex items-end">
                <CustomButton label="Kembalikan ke Pelapor" outlined borderColor="border-[#C4320A]" textColor="text-[#C4320A]" :disabled="!alasanLengkap.trim()" @click="mintaLengkapi" />
              </div>
            </template>
          </div>
          <div v-if="boleh('LIHAT PASIEN') && !ditutup" class="grid grid-cols-2 gap-3 p-3 mt-3 border rounded-lg border-grey-75">
            <CustomTextfield v-model="noReg" label="No. Registrasi Kunjungan (rujukan pasien)" :maxLength="100" />
            <div class="flex items-end gap-2">
              <CustomButton label="Tautkan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="!noReg.trim()" @click="tautkan()" />
              <CustomButton v-if="d.terkaitPasien" label="Lepas" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="tautkan(true)" />
            </div>
          </div>
        </TabPanel>

        <TabPanel value="grading">
          <div class="mb-2 text-xs text-grey-400">
            Pilih dampak (kolom) dan probabilitas (baris). Kuning/merah dan sentinel wajib RCA; biru/hijau investigasi sederhana. Matriks versi {{ referensi.pengaturan?.versiMatriks }}.
          </div>
          <table class="text-xs border-collapse">
            <thead>
              <tr>
                <th class="p-1 text-left">Probabilitas \ Dampak</th>
                <th v-for="dp in referensi.levelDampak" :key="dp.kode" class="p-1 w-24">{{ dp.kode }}. {{ dp.nama }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pb in [...(referensi.levelProbabilitas ?? [])].reverse()" :key="pb.kode">
                <td class="p-1 pr-3">{{ pb.kode }}. {{ pb.nama }}</td>
                <td v-for="dp in referensi.levelDampak" :key="dp.kode" class="p-0.5">
                  <button
                    type="button"
                    class="w-full h-8 rounded"
                    :class="[gayaGrade(matriks[Number(pb.kode) - 1]?.[Number(dp.kode) - 1]).sel, gDampak === Number(dp.kode) && gProb === Number(pb.kode) ? 'ring-2 ring-offset-1 ring-[#101828]' : 'opacity-70']"
                    :disabled="!boleh('GRADING') || ditutup"
                    @click="(gDampak = Number(dp.kode)), (gProb = Number(pb.kode))"
                  >
                    {{ Number(dp.kode) * Number(pb.kode) }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="boleh('GRADING') && !ditutup" class="grid grid-cols-2 gap-3 mt-3">
            <div class="text-sm">
              Hasil: <b :class="gayaGrade(pratinjauGrade).text">{{ pratinjauGrade ? gayaGrade(pratinjauGrade).label : "-" }}</b>
              <span v-if="d.jenisInsiden === 'sentinel'" class="text-xs text-grey-400"> · sentinel tetap wajib RCA</span>
            </div>
            <div></div>
            <CustomTextfield v-if="d.grading?.length" v-model="gAlasan" label="Alasan Grading Ulang" :maxLength="2000" required />
            <div class="flex items-end">
              <CustomButton label="Simpan Grading" icon="PhFloppyDisk" :disabled="!pratinjauGrade || (!!d.grading?.length && !gAlasan.trim())" @click="simpanGrading" />
            </div>
          </div>
          <DataTable v-if="d.grading?.length" :value="d.grading" class="mt-3 text-xs">
            <Column header="Waktu"><template #body="{ data: g }">{{ waktuIkp(g.dinilaiPada) }}</template></Column>
            <Column header="Dampak × Prob."><template #body="{ data: g }">{{ g.dampak }} × {{ g.probabilitas }} = {{ g.skor }}</template></Column>
            <Column header="Grade"><template #body="{ data: g }"><span :class="gayaGrade(g.grade).text" class="font-semibold">{{ gayaGrade(g.grade).label }}</span><span v-if="!g.aktif" class="text-grey-400"> (lama)</span></template></Column>
            <Column field="versiMatriks" header="Versi Matriks" />
            <Column field="dinilaiOleh" header="Penilai" />
            <Column field="alasan" header="Alasan" />
          </DataTable>
        </TabPanel>

        <TabPanel value="investigasi">
          <div v-if="!d.grade" class="text-grey-400">Laporan harus digrading terlebih dahulu.</div>
          <template v-else>
            <div class="mb-2 text-xs text-grey-400">
              {{ perluRca ? "RCA (analisis akar masalah) oleh Tim KP: akar masalah, rekomendasi, dan minimal satu tindak lanjut wajib sebelum selesai." : "Investigasi sederhana oleh atasan langsung: penyebab langsung dan rekomendasi/tindakan wajib sebelum selesai." }}
              Batas: {{ waktuIkp(d.batasInvestigasi) }}.
            </div>
            <div class="grid grid-cols-2 gap-3">
              <CustomTextfield v-if="perluRca" v-model="inv.tim" label="Tim Investigasi" class="col-span-2" :maxLength="2000" :disabled="!boleh('INVESTIGASI') || d.investigasi?.status === 'selesai' || ditutup" />
              <CustomTextArea v-model="inv.penyebabLangsung" label="Penyebab Langsung" class="col-span-2" :disabled="!boleh('INVESTIGASI') || d.investigasi?.status === 'selesai' || ditutup" />
              <CustomTextArea v-if="perluRca" v-model="inv.akarMasalah" label="Akar Masalah" class="col-span-2" required :disabled="!boleh('INVESTIGASI') || d.investigasi?.status === 'selesai' || ditutup" />
              <CustomTextArea v-if="perluRca" v-model="inv.analisis" label="Analisis (mis. 5 why, fishbone)" class="col-span-2" :disabled="!boleh('INVESTIGASI') || d.investigasi?.status === 'selesai' || ditutup" />
              <CustomTextArea v-model="inv.rekomendasi" label="Rekomendasi / Tindakan" class="col-span-2" required :disabled="!boleh('INVESTIGASI') || d.investigasi?.status === 'selesai' || ditutup" />
            </div>
            <div v-if="d.investigasi?.status === 'selesai'" class="mt-2 text-xs text-[#027A48]">Selesai oleh {{ d.investigasi.diselesaikanOleh }} · {{ waktuIkp(d.investigasi.diselesaikanPada) }}</div>
            <div v-if="boleh('INVESTIGASI') && !ditutup" class="flex flex-wrap items-end gap-2 mt-3">
              <template v-if="d.investigasi?.status !== 'selesai'">
                <CustomButton label="Simpan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="simpanInv" />
                <CustomButton label="Simpan & Selesaikan" icon="PhCheckCircle" @click="selesaiInv" />
              </template>
              <template v-else>
                <CustomTextfield v-model="alasanBukaInv" label="Alasan Buka Kembali" :maxLength="2000" />
                <CustomButton label="Buka Kembali" outlined borderColor="border-[#C4320A]" textColor="text-[#C4320A]" :disabled="!alasanBukaInv.trim()" @click="bukaInv" />
              </template>
            </div>
          </template>
        </TabPanel>

        <TabPanel value="tindak">
          <div v-if="!d.grade" class="text-grey-400">Laporan harus digrading terlebih dahulu.</div>
          <template v-else>
            <DataTable v-if="d.tindakLanjut?.length" :value="d.tindakLanjut" class="text-xs">
              <Column header="Uraian"><template #body="{ data: t }"><div class="whitespace-pre-line">{{ t.uraian }}</div><div v-if="t.progres" class="text-grey-400">Progres: {{ t.progres }}</div><div v-if="t.hasil" class="text-grey-400">Hasil: {{ t.hasil }}</div></template></Column>
              <Column field="picNama" header="PIC" />
              <Column header="Tenggat"><template #body="{ data: t }"><span :class="t.terlambat ? 'text-danger-300 font-semibold' : ''">{{ tanggalMutu(t.tenggat) }}{{ t.terlambat ? " · terlambat" : "" }}</span></template></Column>
              <Column header="Status">
                <template #body="{ data: t }"><span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaTlIkp(t.status).bg, gayaTlIkp(t.status).text]">{{ gayaTlIkp(t.status).label }}</span></template>
              </Column>
              <Column header="">
                <template #body="{ data: t }">
                  <div v-if="!ditutup" class="flex gap-1">
                    <CustomButton v-if="boleh('TINDAK LANJUT') && t.status !== 'terverifikasi'" icon="PhPencilSimple" @click="mulaiUbahTl(t)" />
                    <CustomButton v-if="boleh('VERIFIKASI') && t.status === 'selesai'" label="Verifikasi" @click="verifikasiTl(t)" />
                    <CustomButton v-if="boleh('TINDAK LANJUT') && t.status !== 'terverifikasi'" icon="PhTrash" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapusTl(t)" />
                  </div>
                </template>
              </Column>
            </DataTable>
            <div v-else class="text-grey-400">Belum ada tindak lanjut.</div>
            <div v-if="tlUbah" class="grid grid-cols-3 gap-3 p-3 mt-3 border rounded-lg border-grey-75">
              <CustomTextArea v-model="tlUbah.uraian" label="Uraian" class="col-span-3" />
              <CustomSelect v-model="tlUbah.picPegawaiUuid" label="PIC" :options="opsiPegawai" optionValue="value" optionLabel="label" :clearable="false" />
              <CustomDatePicker v-model="tlUbah.tenggatTgl" label="Tenggat" />
              <CustomSelect v-model="tlUbah.status" label="Status" :options="OPSI_STATUS_TL" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
              <CustomTextArea v-model="tlUbah.progres" label="Progres" class="col-span-3" />
              <CustomTextArea v-model="tlUbah.hasil" label="Hasil (wajib bila selesai)" class="col-span-3" />
              <div class="flex justify-end col-span-3 gap-2">
                <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="tlUbah = null" />
                <CustomButton label="Simpan" icon="PhFloppyDisk" :disabled="tlUbah.status === 'selesai' && !tlUbah.hasil.trim()" @click="simpanTl" />
              </div>
            </div>
            <div v-if="boleh('TINDAK LANJUT') && !ditutup && !tlUbah" class="grid grid-cols-3 gap-3 p-3 mt-3 border rounded-lg border-grey-75">
              <CustomTextArea v-model="tlBaru.uraian" label="Rekomendasi / Tindak Lanjut Baru" class="col-span-3" required />
              <CustomSelect v-model="tlBaru.picPegawaiUuid" label="PIC" :options="opsiPegawai" optionValue="value" optionLabel="label" required />
              <CustomDatePicker v-model="tlBaru.tenggat" label="Tenggat" required />
              <div class="flex items-end"><CustomButton label="Tambah" icon="PhPlus" :disabled="!tlBaru.uraian.trim() || !tlBaru.picPegawaiUuid || !tlBaru.tenggat" @click="tambahTl" /></div>
            </div>
          </template>
        </TabPanel>

        <TabPanel value="lampiran">
          <div v-for="l in d.lampiran" :key="l.uuid" class="flex items-center gap-3 py-1">
            <a class="cursor-pointer text-opensimrs-300" @click="unduh(l)">{{ l.namaBerkas }}</a>
            <span class="text-xs text-grey-400">{{ ukuranBerkas(l.ukuranBita) }} · {{ waktuIkp(l.createdAt) }}</span>
            <a v-if="boleh('TERIMA') && !ditutup" class="text-xs cursor-pointer text-danger-300" @click="hapusLampiran(l)">hapus</a>
          </div>
          <div v-if="!d.lampiran?.length" class="text-grey-400">Tidak ada lampiran.</div>
          <label v-if="boleh('TERIMA') && !ditutup && (d.lampiran?.length ?? 0) < 5" class="block mt-3 text-sm cursor-pointer text-opensimrs-300">
            + Tambah lampiran (PDF/JPG/PNG)
            <input type="file" class="hidden" accept="application/pdf,image/jpeg,image/png" @change="pilihLampiran" />
          </label>
        </TabPanel>

        <TabPanel value="riwayat">
          <div v-for="(r, i) in d.riwayat" :key="i" class="py-1 border-b border-grey-75">
            <span class="text-xs text-grey-400">{{ waktuIkp(r.createdAt) }}</span> · <b>{{ AKSI_RIWAYAT[r.aksi] ?? r.aksi }}</b> · {{ r.aktor }}
            <span v-if="ringkasRiwayat(r)" class="text-xs text-grey-400"> — {{ ringkasRiwayat(r) }}</span>
          </div>
          <div v-if="!d.riwayat?.length" class="text-grey-400">Belum ada riwayat.</div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <div v-if="boleh('TUTUP')" class="p-3 border rounded-lg border-grey-75">
      <template v-if="!ditutup">
        <div v-if="d.syaratTutup?.length" class="mb-2 text-xs text-[#B54708]">Belum dapat ditutup: {{ d.syaratTutup.join("; ") }}.</div>
        <div class="flex items-end gap-2">
          <CustomTextfield v-model="alasanTutup" label="Alasan Penutupan (wajib bila tanpa tindak lanjut)" class="grow" :maxLength="2000" />
          <CustomButton label="Tutup Laporan" icon="PhLockSimple" @click="tutup" />
        </div>
      </template>
      <div v-else class="flex items-end gap-2">
        <div class="text-xs text-grey-400">Ditutup oleh {{ d.ditutupOleh }} · {{ waktuIkp(d.ditutupPada) }}</div>
        <CustomTextfield v-model="alasanBuka" label="Alasan Buka Kembali" class="grow" :maxLength="2000" />
        <CustomButton label="Buka Kembali" outlined borderColor="border-[#C4320A]" textColor="text-[#C4320A]" :disabled="!alasanBuka.trim()" @click="bukaKembali" />
      </div>
    </div>
  </div>
</template>
