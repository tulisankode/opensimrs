<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import ChipStatus from "./Komponen/ChipStatus.vue";
import {
  apiFisio, FASE_REHAB, STATUS_JADWAL, labelJam, labelJenis, labelGender, umur, tglIndo, keIso,
  type JadwalFisio, type EvaluasiFisio, type Persetujuan, type OrderFisio,
} from "@/stores/penunjang/fisioterapi";
import { cetakAsuhanTerapi } from "@/utils/pdf/pdfFisioterapi/cetakFisioterapi";

// Evaluasi Rehab Medik per sesi: SOAP + edukasi, Fase Rehabilitasi, Inform Consent (persetujuan / penolakan
// tindakan), dan riwayat evaluasi pasien pada kunjungan sebelumnya.
const route = useRoute();
// Nama pengguna login sebagai bawaan isian Fisioterapis.
const pengguna = (() => {
  try {
    const u = JSON.parse(localStorage.getItem("user") ?? "{}") ?? {};
    return String(u.pegawai?.name ?? u.name ?? u.username ?? "");
  } catch {
    return "";
  }
})();

const mulai = ref<Date>(new Date());
const selesai = ref<Date>(new Date());
const cari = ref("");
const status = ref<string[]>(["terjadwal", "hadir"]);
const daftar = ref<JadwalFisio[]>([]);
const memuat = ref(false);

const muat = async () => {
  memuat.value = true;
  const r = await apiFisio.daftarJadwal({
    tanggal_mulai: keIso(mulai.value),
    tanggal_selesai: keIso(selesai.value),
    status: status.value.length ? status.value : ["terjadwal", "hadir", "selesai"],
    cari: cari.value,
    limit: 500,
  });
  daftar.value = (r?.payload?.data ?? []).filter((j: JadwalFisio) => j.orderUuid);
  memuat.value = false;
};
const toggleStatus = (s: string) => {
  status.value = status.value.includes(s) ? status.value.filter((x) => x !== s) : [...status.value, s];
};

// ── Sesi terpilih ──
const sesi = ref<JadwalFisio | null>(null);
const riwayat = ref<(OrderFisio & { evaluasi: EvaluasiFisio[] })[]>([]);
const evaluasiUuid = ref<string | null>(null);
type Isian = {
  subjektif: string; objektif: string; asesmen: string; intervensi: string; evaluasi: string; edukasi: string;
  faseRehabilitasi: string; terapis: string; persetujuan: Persetujuan;
};
const kosong = (): Isian => ({
  subjektif: "", objektif: "", asesmen: "", intervensi: "", evaluasi: "", edukasi: "", faseRehabilitasi: "",
  terapis: pengguna,
  persetujuan: { jenis: "persetujuan", nama: "", hubungan: "Diri sendiri", tindakan: "", risiko: "", saksi: "", alasan: "" },
});
const isian = ref<Isian>(kosong());
const galat = ref("");

const pilih = async (j: JadwalFisio) => {
  sesi.value = j;
  galat.value = "";
  evaluasiUuid.value = j.evaluasiUuid ?? null;
  isian.value = kosong();
  isian.value.persetujuan.nama = j.namaPasien ?? "";
  if (j.evaluasiUuid) {
    const e = (await apiFisio.detailEvaluasi(j.evaluasiUuid))?.payload as EvaluasiFisio | undefined;
    if (e) {
      isian.value = {
        subjektif: e.subjektif ?? "", objektif: e.objektif ?? "", asesmen: e.asesmen ?? "", intervensi: e.intervensi ?? "",
        evaluasi: e.evaluasi ?? "", edukasi: e.edukasi ?? "", faseRehabilitasi: e.faseRehabilitasi ?? "", terapis: e.terapis ?? "",
        persetujuan: { ...kosong().persetujuan, ...(e.persetujuan ?? {}) },
      };
    }
  }
  const pid = j.patientUuid;
  riwayat.value = pid ? (await apiFisio.riwayat(pid))?.payload ?? [] : [];
};
const riwayatLain = computed(() =>
  riwayat.value.flatMap((o) => o.evaluasi.map((e) => ({ ...e, noOrder: o.noOrder, jenisFisio: o.jenisFisio }))).filter((e) => e.jadwalUuid !== sesi.value?.uuid),
);
// Salin S/O/A/P dari evaluasi terakhir sebagai titik awal.
const salinTerakhir = () => {
  const e = riwayatLain.value[0];
  if (!e) return;
  Object.assign(isian.value, {
    subjektif: e.subjektif ?? "", objektif: e.objektif ?? "", asesmen: e.asesmen ?? "", intervensi: e.intervensi ?? "",
    faseRehabilitasi: e.faseRehabilitasi ?? "",
  });
};

const simpan = async () => {
  if (!sesi.value) return;
  if (!isian.value.asesmen.trim() && !isian.value.subjektif.trim()) {
    galat.value = "Isi minimal Subjektif atau Asesmen.";
    return;
  }
  if (!isian.value.faseRehabilitasi) {
    galat.value = "Pilih Fase Rehabilitasi.";
    return;
  }
  galat.value = "";
  const p = isian.value.persetujuan;
  const data = {
    ...isian.value,
    persetujuan: p.jenis ? { ...p, alasan: p.jenis === "penolakan" ? p.alasan : "" } : null,
  };
  const r = evaluasiUuid.value
    ? await apiFisio.ubahEvaluasi(evaluasiUuid.value, data)
    : await apiFisio.simpanEvaluasi({ jadwalUuid: sesi.value.uuid, ...data });
  if (!r) return;
  evaluasiUuid.value = r.payload?.uuid ?? evaluasiUuid.value;
  await muat();
  const baru = daftar.value.find((x) => x.uuid === sesi.value?.uuid);
  if (baru) sesi.value = baru;
  else sesi.value = { ...sesi.value, status: "selesai", evaluasiUuid: evaluasiUuid.value };
};

const cetak = async () => {
  if (!sesi.value?.orderUuid) return;
  const o = (await apiFisio.detailOrder(sesi.value.orderUuid))?.payload;
  if (o) cetakAsuhanTerapi(o, evaluasiUuid.value ?? undefined);
};

onMounted(async () => {
  const j = route.query.jadwal ? String(route.query.jadwal) : null;
  if (j) {
    const r = (await apiFisio.detailJadwal(j))?.payload as JadwalFisio | undefined;
    if (r) {
      mulai.value = selesai.value = new Date(`${r.tanggal}T00:00:00`);
      status.value = [];
      await muat();
      await pilih(daftar.value.find((x) => x.uuid === r.uuid) ?? r);
      return;
    }
  }
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-hidden" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Evaluasi Terapi</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM / No. Order" @keydown.enter="muat" />
          <CustomDatePicker v-model="mulai" label="Tanggal mulai" class="toolbar-field--date" :max-date="selesai" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="selesai" label="Tanggal selesai" class="toolbar-field--date" :min-date="mulai" />
          <ToolbarFilterMenu :count="status.length">
            <template #label>Status Sesi</template>
            <CustomChip
              v-for="s in ['terjadwal', 'hadir', 'selesai']"
              :key="s"
              :label="STATUS_JADWAL[s].label"
              :value="s"
              :isSelected="status.includes(s)"
              @selected="toggleStatus(s)"
            />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="grid h-full grid-cols-1 lg:grid-cols-[320px_1fr] min-h-0">
          <!-- Daftar sesi -->
          <aside class="overflow-auto border-r border-grey-100 max-h-[40vh] lg:max-h-none">
            <div v-if="memuat" class="p-4 text-xs text-grey-400">Memuat…</div>
            <div v-else-if="!daftar.length" class="p-4 text-xs text-center text-grey-400">Tidak ada sesi pada rentang ini.</div>
            <button
              v-for="j in daftar"
              :key="j.uuid"
              type="button"
              class="w-full px-3 py-2 text-left border-b border-grey-75 hover:bg-opensimrs-50"
              :class="{ 'bg-opensimrs-50 border-l-4 border-l-opensimrs-300': sesi?.uuid === j.uuid }"
              @click="pilih(j)"
            >
              <div class="flex items-center justify-between gap-2 text-xs">
                <span class="font-semibold">{{ j.namaPasien }}</span>
                <ChipStatus jenis="jadwal" :status="j.status" />
              </div>
              <div class="text-[11px] text-grey-500">{{ tglIndo(j.tanggal) }} · {{ labelJam(j.jamSlot) }} · {{ j.bed }}</div>
              <div class="text-[11px] text-grey-400">{{ j.noOrder }} · {{ labelJenis(j.jenisFisio) }} · Sesi {{ j.sesiKe }}/{{ j.jumlahSesi }}</div>
            </button>
          </aside>

          <!-- Form evaluasi -->
          <section class="overflow-auto">
            <div v-if="!sesi" class="flex flex-col items-center justify-center h-full gap-2 p-10 text-sm text-grey-400">
              <PhClipboardText :size="40" />Pilih sesi terapi di sebelah kiri untuk mengisi evaluasi.
            </div>
            <div v-else class="flex flex-col gap-4 p-4">
              <div class="flex flex-wrap items-start justify-between gap-3 p-3 border rounded-lg border-grey-100 bg-opensimrs-50">
                <div>
                  <div class="text-base font-semibold">{{ sesi.namaPasien }}</div>
                  <div class="text-xs text-grey-500">{{ sesi.noRm }} · {{ labelGender(sesi.gender) }} · {{ umur(sesi.tanggalLahir) }}</div>
                  <div class="text-xs">
                    {{ sesi.noOrder }} · {{ labelJenis(sesi.jenisFisio) }} · Sesi {{ sesi.sesiKe }}/{{ sesi.jumlahSesi }} ·
                    {{ tglIndo(sesi.tanggal, true) }} {{ labelJam(sesi.jamSlot) }} · {{ sesi.bed }}
                  </div>
                  <div v-if="sesi.diagnosis" class="text-xs">Diagnosis: {{ sesi.diagnosis }}</div>
                </div>
                <div class="flex gap-2">
                  <CustomButton v-if="riwayatLain.length && !evaluasiUuid" label="Salin evaluasi terakhir" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="salinTerakhir" />
                  <CustomButton icon="PhPrinter" label="Asuhan Terapi" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetak" />
                </div>
              </div>

              <div v-if="sesi.statusOrder === 'order'" class="p-3 text-xs rounded bg-warning-50 text-warning-400">
                Order belum divalidasi; evaluasi dapat diisi setelah order divalidasi di menu Order Fisioterapi.
              </div>

              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <CustomTextArea v-model="isian.subjektif" label="Subjektif (S)" placeholder="Keluhan, riwayat, skala nyeri menurut pasien" />
                <CustomTextArea v-model="isian.objektif" label="Objektif (O)" placeholder="Inspeksi, palpasi, ROM, MMT, tes khusus" />
                <CustomTextArea v-model="isian.asesmen" label="Asesmen (A)" placeholder="Diagnosis fisioterapi / problem fungsional" />
                <CustomTextArea v-model="isian.intervensi" label="Intervensi / Plan (P)" placeholder="Modalitas & latihan yang diberikan" />
                <CustomTextArea v-model="isian.evaluasi" label="Evaluasi" placeholder="Respons pasien setelah terapi" />
                <CustomTextArea v-model="isian.edukasi" label="Edukasi" placeholder="Home program, posisi, aktivitas" />
                <CustomSelect
                  v-model="isian.faseRehabilitasi"
                  label="Fase Rehabilitasi"
                  placeHolder="Pilih fase"
                  :options="FASE_REHAB"
                  optionLabel="label"
                  optionValue="value"
                  required
                />
                <CustomTextfield v-model="isian.terapis" label="Fisioterapis" placeholder="Nama terapis" />
              </div>

              <!-- Inform consent -->
              <fieldset class="p-3 border rounded-lg border-grey-100">
                <legend class="px-1 text-sm font-semibold">Inform Consent</legend>
                <div class="flex flex-wrap gap-4 mb-3 text-sm">
                  <label class="inline-flex items-center gap-2"><input v-model="isian.persetujuan.jenis" type="radio" value="persetujuan" />Persetujuan tindakan</label>
                  <label class="inline-flex items-center gap-2"><input v-model="isian.persetujuan.jenis" type="radio" value="penolakan" />Penolakan tindakan</label>
                </div>
                <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <CustomTextfield v-model="isian.persetujuan.nama" label="Nama yang menyatakan" />
                  <CustomTextfield v-model="isian.persetujuan.hubungan" label="Hubungan dengan pasien" placeholder="Diri sendiri / Suami / Istri / Anak / Orang tua" />
                  <CustomTextfield v-model="isian.persetujuan.tindakan" label="Tindakan yang dijelaskan" placeholder="mis. TENS, Ultrasound, Exercise" />
                  <CustomTextfield v-model="isian.persetujuan.saksi" label="Saksi" />
                  <CustomTextArea v-model="isian.persetujuan.risiko" class="md:col-span-2" label="Penjelasan risiko & alternatif" />
                  <CustomTextArea v-if="isian.persetujuan.jenis === 'penolakan'" v-model="isian.persetujuan.alasan" class="md:col-span-2" label="Alasan penolakan" />
                </div>
              </fieldset>

              <p v-if="galat" class="text-xs text-danger-300">{{ galat }}</p>
              <div class="flex justify-end gap-2">
                <CustomButton
                  :label="evaluasiUuid ? 'Perbarui Evaluasi' : 'Simpan Evaluasi & Selesaikan Sesi'"
                  icon="PhFloppyDisk"
                  :disabled="sesi.statusOrder === 'order' || sesi.status === 'batal'"
                  @click="simpan"
                />
              </div>

              <!-- Riwayat -->
              <section>
                <h3 class="mb-2 text-sm font-semibold">Riwayat Terapi Pasien ({{ riwayatLain.length }} evaluasi)</h3>
                <div v-if="!riwayatLain.length" class="p-3 text-xs text-center border border-dashed rounded text-grey-400 border-grey-100">Belum ada evaluasi sebelumnya.</div>
                <details v-for="e in riwayatLain" :key="e.uuid" class="mb-2 text-xs border rounded border-grey-100">
                  <summary class="flex flex-wrap justify-between gap-2 px-3 py-2 cursor-pointer bg-grey-50">
                    <span class="font-semibold">{{ tglIndo(e.tanggal) }} · {{ e.noOrder }} · Sesi {{ e.sesiKe ?? "-" }} · {{ labelJenis(e.jenisFisio) }}</span>
                    <span>{{ e.faseRehabilitasi ? `Fase ${e.faseRehabilitasi}` : "Fase -" }} · {{ e.terapis ?? "-" }}</span>
                  </summary>
                  <div class="grid grid-cols-1 gap-2 p-3 md:grid-cols-2">
                    <div><b>S:</b> {{ e.subjektif || "-" }}</div>
                    <div><b>O:</b> {{ e.objektif || "-" }}</div>
                    <div><b>A:</b> {{ e.asesmen || "-" }}</div>
                    <div><b>P:</b> {{ e.intervensi || "-" }}</div>
                    <div><b>Evaluasi:</b> {{ e.evaluasi || "-" }}</div>
                    <div><b>Edukasi:</b> {{ e.edukasi || "-" }}</div>
                    <div v-if="e.persetujuan?.jenis" class="md:col-span-2">
                      <b>Inform consent:</b> {{ e.persetujuan.jenis === "penolakan" ? "Penolakan" : "Persetujuan" }} oleh {{ e.persetujuan.nama || "-" }}
                    </div>
                  </div>
                </details>
              </section>
            </div>
          </section>
        </div>
      </template>
    </Card>
  </div>
</template>
