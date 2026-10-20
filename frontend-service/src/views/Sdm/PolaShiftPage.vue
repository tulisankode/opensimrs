<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { apiJadwal, bolehJadwal as boleh, epochWib, isoWib, kueriJadwal, type PolaShift } from "@/stores/penunjang/jadwalDinas";
import { KELAS_INPUT, KELAS_LABEL, jamMenit, warnaShift } from "./components/jadwal/tampilan";

// Pola Shift dan Aturan Jadwal HR / SDM (STD-0038): master pola shift, aturan unit (istirahat minimum, batas jam
// mingguan, kebutuhan staf), rotasi, dan kewenangan unit. Formulir yang butuh validasi bawaan (required/min/max)
// memakai elemen native bergaya input OpenSIMRS.
const referensi = ref<any>({ unit: [] });
const unit = ref("");
const pola = ref<PolaShift[]>([]);
const rotasi = ref<any[]>([]);
const kebutuhan = ref<any[]>([]);
const anggota = ref<any[]>([]);
const pesan = ref("");
const sibuk = ref(false);
const polaUuid = ref("");
const rotasiUuid = ref("");
const kosong = () => ({ kode: "", nama: "", mulaiMenit: 0, selesaiMenit: 0, lintasHari: false, libur: false, aktif: true, versiKunci: 1, unitUuid: null as string | null });
const form = ref(kosong());
const seluruhFaskes = ref(false);
const alasan = ref("");
const aturan = ref<any>({ versiKunci: 0, istirahatMinimumMenit: null, batasKerjaMingguanMenit: null, jenisMinggu: "kalender", tingkatIstirahat: "pemblokir", tingkatJamMingguan: "pemblokir", tingkatStaf: "peringatan" });
const jangkar = ref("");
const rotasiForm = ref<any>({ nama: "", urutanPola: [], aktif: true, versiKunci: 1 });
const dialogPola = ref(false);
const dialogRotasi = ref(false);

const TINGKAT = [["tingkatIstirahat", "Istirahat"], ["tingkatJamMingguan", "Jam mingguan"], ["tingkatStaf", "Kebutuhan staf"]];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const KEWENANGAN = [["lihat", "Lihat"], ["susun", "Susun"], ["setujui", "Setujui"], ["terbit", "Terbitkan"], ["putus_tukar", "Putuskan tukar"]];

const jalankan = async (fn: () => Promise<void>) => {
  if (sibuk.value) return;
  sibuk.value = true;
  pesan.value = "";
  try {
    await fn();
  } catch (e: any) {
    pesan.value = e.message;
  } finally {
    sibuk.value = false;
  }
};
const muat = async () => {
  pola.value = await apiJadwal(`/pola-shift${kueriJadwal({ unitUuid: unit.value })}`);
  const x = await apiJadwal(`/aturan${kueriJadwal({ unitUuid: unit.value })}`);
  aturan.value = x.aturan ?? { versiKunci: 0, istirahatMinimumMenit: null, batasKerjaMingguanMenit: null, jenisMinggu: "kalender", tingkatIstirahat: "pemblokir", tingkatJamMingguan: "pemblokir", tingkatStaf: "peringatan" };
  jangkar.value = x.aturan?.jangkarMinggu ? isoWib(x.aturan.jangkarMinggu) : "";
  kebutuhan.value = x.kebutuhan.map((k: any) => ({ ...k, tanggal: k.tanggalKerja == null ? "" : isoWib(k.tanggalKerja) }));
  rotasi.value = await apiJadwal(`/rotasi${kueriJadwal({ unitUuid: unit.value })}`);
  if (referensi.value.superAdmin) {
    anggota.value = (await apiJadwal(`/kewenangan${kueriJadwal({ unitUuid: unit.value })}`))
      .map((k: any) => ({ ...k, mulai: isoWib(k.berlakuMulai), sampai: k.berlakuSampai == null ? "" : isoWib(k.berlakuSampai) }));
  }
  polaUuid.value = ""; form.value = kosong(); rotasiUuid.value = ""; rotasiForm.value = { nama: "", urutanPola: [], aktif: true, versiKunci: 1 };
};
const wenang = () => referensi.value.kewenangan?.some((k: any) => k.unitUuid === unit.value && k.kewenangan === "susun");
const cakupanPola = () => wenang() || referensi.value.superAdmin && (polaUuid.value ? !form.value.unitUuid : seluruhFaskes.value);
const simpanPola = () => jalankan(async () => {
  await apiJadwal(`/pola-shift${polaUuid.value ? '/' + polaUuid.value : ''}`, polaUuid.value ? "put" : "post", {
    ...form.value,
    unitUuid: polaUuid.value ? form.value.unitUuid : seluruhFaskes.value ? null : unit.value,
    ...(form.value.libur ? { mulaiMenit: 0, selesaiMenit: 0, lintasHari: false } : {}),
  });
  await muat();
});
const hapus = () => jalankan(async () => {
  await apiJadwal(`/pola-shift/${polaUuid.value}`, "delete", { versiKunci: form.value.versiKunci, alasan: alasan.value });
  await muat();
});
const simpanAturan = () => jalankan(async () => {
  await apiJadwal(`/aturan/${unit.value}`, "put", {
    ...aturan.value,
    jangkarMinggu: aturan.value.jenisMinggu === "tetap" ? epochWib(jangkar.value) : null,
    kebutuhan: kebutuhan.value.map((x) => ({ polaShiftUuid: x.polaShiftUuid, minimumStaf: x.minimumStaf, hariMinggu: x.hariMinggu, tanggalKerja: x.tanggal ? epochWib(x.tanggal) : null })),
  });
  await muat();
});
const simpanRotasi = () => jalankan(async () => {
  await apiJadwal(`/rotasi${rotasiUuid.value ? '/' + rotasiUuid.value : ''}`, rotasiUuid.value ? "put" : "post", { ...rotasiForm.value, unitUuid: unit.value });
  await muat();
});
const simpanAnggota = () => jalankan(async () => {
  await apiJadwal(`/kewenangan/${unit.value}`, "put", {
    anggota: anggota.value.map((x) => ({ username: x.username, kewenangan: x.kewenangan, berlakuMulai: epochWib(x.mulai), berlakuSampai: x.sampai ? epochWib(x.sampai) : null })),
  });
  referensi.value = await apiJadwal('/referensi');
  await muat();
});

// Dialog formulir: membuka mengisi state yang sama seperti tombol "Sunting"/"Rotasi baru" semula; menutup dialog sama
// dengan "Batal sunting"/"Rotasi baru". Dialog tertutup otomatis bila simpan/hapus berhasil.
const bukaPolaBaru = () => { polaUuid.value = ""; form.value = kosong(); dialogPola.value = true; };
const suntingPola = (p: PolaShift) => { polaUuid.value = p.uuid; form.value = { ...p, unitUuid: p.unitUuid ?? null }; dialogPola.value = true; };
const tutupPola = () => { polaUuid.value = ""; form.value = kosong(); };
const kirimPola = async () => { await simpanPola(); if (!pesan.value) dialogPola.value = false; };
const kirimHapus = async () => { await hapus(); if (!pesan.value) dialogPola.value = false; };
const bukaRotasiBaru = () => { rotasiUuid.value = ""; rotasiForm.value = { nama: "", urutanPola: [], aktif: true, versiKunci: 1 }; dialogRotasi.value = true; };
const suntingRotasi = (x: any) => { rotasiUuid.value = x.uuid; rotasiForm.value = { ...x, urutanPola: [...x.urutanPola] }; dialogRotasi.value = true; };
const tutupRotasi = () => { rotasiUuid.value = ""; rotasiForm.value = { nama: "", urutanPola: [], aktif: true, versiKunci: 1 }; };
const kirimRotasi = async () => { await simpanRotasi(); if (!pesan.value) dialogRotasi.value = false; };
const polaDari = (uuid: string) => pola.value.find((p) => p.uuid === uuid);

onMounted(() => jalankan(async () => {
  referensi.value = await apiJadwal("/referensi");
  seluruhFaskes.value = referensi.value.superAdmin;
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
          <h1 class="toolbar-heading text-opensimrs-300">Pola Shift dan Aturan Jadwal</h1>
          <CustomSelect
            v-model="unit"
            label="Unit"
            :options="referensi.unit"
            optionValue="uuid"
            optionLabel="nama"
            :clearable="false"
            :disabled="sibuk"
            @update:modelValue="jalankan(muat)"
          />
          <CustomButton
            v-if="unit && (wenang() || (referensi.superAdmin && seluruhFaskes)) && boleh('Pola Shift', 'CREATE')"
            icon="PhPlus"
            label="Tambah Pola Shift"
            :disabled="sibuk"
            @click="bukaPolaBaru"
          />
        </PageToolbar>
      </template>

      <template #content>
        <NoData v-if="!unit" class="min-h-60" title="Belum ada unit yang dapat diakses" />
        <fieldset v-else :disabled="sibuk" class="flex flex-col min-w-0 gap-4 p-4 m-0 border-0">
          <div v-if="pesan" role="alert" class="flex items-start gap-2 px-3 py-2 text-sm rounded-lg bg-danger-50 text-danger-400">
            <PhWarningCircle :size="18" weight="bold" class="shrink-0" /> {{ pesan }}
          </div>

          <!-- Pola shift -->
          <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
            <div class="flex items-center gap-2 font-semibold text-opensimrs-300"><PhClock :size="18" /> Pola shift</div>
            <p class="text-xs text-grey-400">
              Jam berulang menggunakan menit sejak 00.00 Asia/Jakarta (contoh: 07.00 = 420 menit). Shift kerja berdurasi kurang dari 24 jam.
            </p>
            <NoData v-if="!pola.length" class="min-h-40" title="Belum ada pola shift" />
            <DataTable v-else :value="pola" dataKey="uuid" stripedRows class="text-xs" tableStyle="min-width: 48rem">
              <Column header="Kode" headerClass="bg-opensimrs-50">
                <template #body="{ data: p }">
                  <span class="px-2 py-0.5 font-semibold border rounded-md" :class="warnaShift(p.kode, p.libur)">{{ p.kode }}</span>
                </template>
              </Column>
              <Column header="Nama" headerClass="bg-opensimrs-50">
                <template #body="{ data: p }">
                  <span class="font-semibold">{{ p.nama }}</span>
                  <span v-if="p.libur" class="ml-1 px-2 py-0.5 rounded-full bg-grey-75 text-grey-500">Libur</span>
                  <span v-if="p.lintasHari" class="ml-1 px-2 py-0.5 rounded-full bg-info-50 text-info-400">Lintas hari</span>
                </template>
              </Column>
              <Column header="Jam" headerClass="bg-opensimrs-50">
                <template #body="{ data: p }">
                  <template v-if="p.libur">—</template>
                  <template v-else>
                    {{ jamMenit(p.mulaiMenit) }}–{{ jamMenit(p.selesaiMenit) }}
                    <span class="text-grey-400">({{ p.mulaiMenit }}–{{ p.selesaiMenit }} menit)</span>
                  </template>
                </template>
              </Column>
              <Column header="Cakupan" headerClass="bg-opensimrs-50">
                <template #body="{ data: p }">{{ p.unitUuid ? "Unit ini" : "Seluruh faskes" }}</template>
              </Column>
              <Column header="Status" headerClass="bg-opensimrs-50">
                <template #body="{ data: p }">
                  <span class="px-2 py-0.5 font-semibold rounded-full" :class="p.aktif ? 'bg-success-50 text-success-400' : 'bg-grey-75 text-grey-400'">
                    {{ p.aktif ? "Aktif" : "Nonaktif" }}
                  </span>
                </template>
              </Column>
              <Column header="" headerClass="bg-opensimrs-50" class="w-24">
                <template #body="{ data: p }">
                  <CustomButton
                    v-if="boleh('Pola Shift', 'UPDATE') && (p.unitUuid ? wenang() : referensi.superAdmin)"
                    label="Sunting"
                    icon="PhPencilSimple"
                    size="small"
                    outlined
                    borderColor="border-opensimrs-300"
                    textColor="text-opensimrs-300"
                    :disabled="sibuk"
                    @click="suntingPola(p)"
                  />
                </template>
              </Column>
            </DataTable>
          </div>

          <!-- Aturan unit dan kebutuhan staf -->
          <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
            <div class="flex items-center gap-2 font-semibold text-opensimrs-300"><PhSliders :size="18" /> Aturan unit dan kebutuhan staf</div>
            <p class="text-xs text-grey-400">
              Nilai jam kerja dan pejabat penyetuju wajib ditetapkan sebelum pengajuan. Pilihan awal tingkat temuan belum menjadi kebijakan tersimpan.
            </p>
            <form @submit.prevent="simpanAturan">
              <fieldset :disabled="!wenang() || !boleh('Pola Shift', 'PENGATURAN')" class="flex flex-col min-w-0 gap-4 p-0 m-0 border-0">
                <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label class="flex flex-col">
                    <span :class="KELAS_LABEL">Istirahat minimum (menit)<span class="text-danger-300">*</span></span>
                    <input v-model.number="aturan.istirahatMinimumMenit" required type="number" min="0" max="10080" :class="KELAS_INPUT" />
                  </label>
                  <label class="flex flex-col">
                    <span :class="KELAS_LABEL">Batas kerja mingguan (menit)<span class="text-danger-300">*</span></span>
                    <input v-model.number="aturan.batasKerjaMingguanMenit" required type="number" min="1" max="10080" :class="KELAS_INPUT" />
                  </label>
                  <label class="flex flex-col">
                    <span :class="KELAS_LABEL">Perhitungan minggu</span>
                    <select v-model="aturan.jenisMinggu" :class="KELAS_INPUT">
                      <option value="kalender">Senin–Senin WIB</option>
                      <option value="tetap">Tujuh hari dari jangkar</option>
                    </select>
                  </label>
                  <label v-if="aturan.jenisMinggu === 'tetap'" class="flex flex-col">
                    <span :class="KELAS_LABEL">Jangkar<span class="text-danger-300">*</span></span>
                    <input v-model="jangkar" required type="date" :class="KELAS_INPUT" />
                  </label>
                </div>

                <div>
                  <div class="mb-2 text-sm font-semibold">Tingkat temuan</div>
                  <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <label v-for="[k, label] in TINGKAT" :key="k" class="flex flex-col">
                      <span :class="KELAS_LABEL">{{ label }}</span>
                      <select v-model="aturan[k]" :class="KELAS_INPUT">
                        <option value="pemblokir">Pemblokir</option>
                        <option value="peringatan">Peringatan</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div class="flex flex-col gap-2">
                  <div class="text-sm font-semibold">Kebutuhan staf minimum</div>
                  <div v-if="!kebutuhan.length" class="text-xs text-grey-400">Belum ada kebutuhan staf.</div>
                  <div
                    v-for="(k, i) in kebutuhan"
                    :key="i"
                    class="grid items-end grid-cols-1 gap-3 p-3 rounded-lg md:grid-cols-[2fr_1fr_1fr_1fr_auto] bg-grey-50"
                  >
                    <label class="flex flex-col">
                      <span :class="KELAS_LABEL">Shift<span class="text-danger-300">*</span></span>
                      <select v-model="k.polaShiftUuid" required :class="KELAS_INPUT">
                        <option v-for="p in pola.filter((p) => p.aktif && !p.libur)" :key="p.uuid" :value="p.uuid">{{ p.nama }}</option>
                      </select>
                    </label>
                    <label class="flex flex-col">
                      <span :class="KELAS_LABEL">Hari</span>
                      <select v-model.number="k.hariMinggu" :class="KELAS_INPUT">
                        <option v-for="(h, n) in HARI" :key="n" :value="n">{{ h }}</option>
                      </select>
                    </label>
                    <label class="flex flex-col">
                      <span :class="KELAS_LABEL">Tanggal khusus</span>
                      <input v-model="k.tanggal" type="date" :class="KELAS_INPUT" />
                    </label>
                    <label class="flex flex-col">
                      <span :class="KELAS_LABEL">Minimum staf<span class="text-danger-300">*</span></span>
                      <input v-model.number="k.minimumStaf" type="number" min="0" required :class="KELAS_INPUT" />
                    </label>
                    <CustomButton
                      type="button"
                      icon="PhTrash"
                      label="Hapus"
                      outlined
                      borderColor="border-danger-300"
                      textColor="text-danger-300"
                      @click="kebutuhan.splice(i, 1)"
                    />
                  </div>
                </div>

                <div class="flex flex-wrap justify-end gap-2">
                  <CustomButton
                    type="button"
                    icon="PhPlus"
                    label="Tambah Kebutuhan Staf"
                    outlined
                    borderColor="border-opensimrs-300"
                    textColor="text-opensimrs-300"
                    @click="kebutuhan.push({ polaShiftUuid: '', hariMinggu: 1, tanggal: '', minimumStaf: 1 })"
                  />
                  <CustomButton type="submit" icon="PhFloppyDisk" label="Simpan Aturan" />
                </div>
              </fieldset>
            </form>
          </div>

          <!-- Rotasi -->
          <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 font-semibold text-opensimrs-300"><PhArrowsClockwise :size="18" /> Rotasi</div>
              <CustomButton
                v-if="wenang() && boleh('Pola Shift', 'CREATE')"
                icon="PhPlus"
                label="Rotasi Baru"
                size="small"
                outlined
                borderColor="border-opensimrs-300"
                textColor="text-opensimrs-300"
                :disabled="sibuk"
                @click="bukaRotasiBaru"
              />
            </div>
            <NoData v-if="!rotasi.length" class="min-h-40" title="Belum ada rotasi" />
            <DataTable v-else :value="rotasi" dataKey="uuid" stripedRows class="text-xs" tableStyle="min-width: 40rem">
              <Column header="Nama" headerClass="bg-opensimrs-50"><template #body="{ data: x }"><span class="font-semibold">{{ x.nama }}</span></template></Column>
              <Column header="Urutan pola" headerClass="bg-opensimrs-50">
                <template #body="{ data: x }">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="(u, i) in x.urutanPola"
                      :key="i"
                      class="px-1.5 py-0.5 font-semibold border rounded-md"
                      :class="warnaShift(polaDari(u)?.kode, polaDari(u)?.libur)"
                      :title="polaDari(u)?.nama"
                    >{{ polaDari(u)?.kode ?? "?" }}</span>
                  </div>
                </template>
              </Column>
              <Column header="Status" headerClass="bg-opensimrs-50">
                <template #body="{ data: x }">
                  <span class="px-2 py-0.5 font-semibold rounded-full" :class="x.aktif ? 'bg-success-50 text-success-400' : 'bg-grey-75 text-grey-400'">
                    {{ x.aktif ? "Aktif" : "Nonaktif" }}
                  </span>
                </template>
              </Column>
              <Column header="" headerClass="bg-opensimrs-50" class="w-24">
                <template #body="{ data: x }">
                  <CustomButton
                    v-if="wenang() && boleh('Pola Shift', 'UPDATE')"
                    label="Sunting"
                    icon="PhPencilSimple"
                    size="small"
                    outlined
                    borderColor="border-opensimrs-300"
                    textColor="text-opensimrs-300"
                    :disabled="sibuk"
                    @click="suntingRotasi(x)"
                  />
                </template>
              </Column>
            </DataTable>
          </div>

          <!-- Kewenangan unit -->
          <div v-if="referensi.superAdmin && boleh('Pola Shift', 'PENGATURAN')" class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
            <div class="flex items-center gap-2 font-semibold text-opensimrs-300"><PhUsers :size="18" /> Kewenangan unit</div>
            <p class="text-xs text-grey-400">
              Akun harus berada pada faskes aktif. Berakhir pada awal tanggal batas. Pengaju dan penyetuju jadwal harus berbeda.
            </p>
            <form class="flex flex-col gap-3" @submit.prevent="simpanAnggota">
              <div v-if="!anggota.length" class="text-xs text-grey-400">Belum ada kewenangan untuk unit ini.</div>
              <div
                v-for="(x, i) in anggota"
                :key="i"
                class="grid items-end grid-cols-1 gap-3 p-3 rounded-lg md:grid-cols-[2fr_1fr_1fr_1fr_auto] bg-grey-50"
              >
                <label class="flex flex-col">
                  <span :class="KELAS_LABEL">Akun<span class="text-danger-300">*</span></span>
                  <input v-model="x.username" required :class="KELAS_INPUT" />
                </label>
                <label class="flex flex-col">
                  <span :class="KELAS_LABEL">Kewenangan</span>
                  <select v-model="x.kewenangan" :class="KELAS_INPUT">
                    <option v-for="[nilai, label] in KEWENANGAN" :key="nilai" :value="nilai">{{ label }}</option>
                  </select>
                </label>
                <label class="flex flex-col">
                  <span :class="KELAS_LABEL">Mulai<span class="text-danger-300">*</span></span>
                  <input v-model="x.mulai" required type="date" :class="KELAS_INPUT" />
                </label>
                <label class="flex flex-col">
                  <span :class="KELAS_LABEL">Sampai</span>
                  <input v-model="x.sampai" type="date" :class="KELAS_INPUT" />
                </label>
                <CustomButton type="button" icon="PhTrash" label="Lepas" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="anggota.splice(i, 1)" />
              </div>
              <div class="flex flex-wrap justify-end gap-2">
                <CustomButton
                  type="button"
                  icon="PhPlus"
                  label="Tambah Kewenangan"
                  outlined
                  borderColor="border-opensimrs-300"
                  textColor="text-opensimrs-300"
                  @click="anggota.push({ username: '', kewenangan: 'lihat', mulai: '', sampai: '' })"
                />
                <CustomButton type="submit" icon="PhFloppyDisk" label="Simpan Kewenangan Unit" />
              </div>
            </form>
          </div>
        </fieldset>
      </template>
    </Card>

    <!-- Formulir pola shift -->
    <CustomDialog v-model:visible="dialogPola" width="640px" @closeDialog="tutupPola">
      <template #header>{{ polaUuid ? "Sunting Pola Shift" : "Pola Shift Baru" }}</template>
      <template #body>
        <fieldset :disabled="sibuk" class="flex flex-col min-w-0 gap-4 p-0 pt-4 m-0 border-0 text-sm">
          <div v-if="pesan" role="alert" class="px-3 py-2 rounded-lg bg-danger-50 text-danger-400">{{ pesan }}</div>
          <CustomSwitch v-if="referensi.superAdmin && !polaUuid" v-model="seluruhFaskes" label="Pola seluruh faskes" sideLabelTrue="Ya" />
          <form v-if="cakupanPola() && boleh('Pola Shift', polaUuid ? 'UPDATE' : 'CREATE')" class="flex flex-col gap-4" @submit.prevent="kirimPola">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label class="flex flex-col">
                <span :class="KELAS_LABEL">Kode<span class="text-danger-300">*</span></span>
                <input v-model="form.kode" required maxlength="30" :class="KELAS_INPUT" />
              </label>
              <label class="flex flex-col">
                <span :class="KELAS_LABEL">Nama<span class="text-danger-300">*</span></span>
                <input v-model="form.nama" required maxlength="150" :class="KELAS_INPUT" />
              </label>
              <label class="flex flex-col">
                <span :class="KELAS_LABEL">Mulai (menit)<span class="text-danger-300">*</span></span>
                <input v-model.number="form.mulaiMenit" type="number" min="0" max="1439" required :class="KELAS_INPUT" />
                <span class="mt-1 text-xs text-grey-400">= pukul {{ jamMenit(form.mulaiMenit) }}</span>
              </label>
              <label class="flex flex-col">
                <span :class="KELAS_LABEL">Selesai (menit)<span class="text-danger-300">*</span></span>
                <input v-model.number="form.selesaiMenit" type="number" min="0" max="1439" required :class="KELAS_INPUT" />
                <span class="mt-1 text-xs text-grey-400">= pukul {{ jamMenit(form.selesaiMenit) }}</span>
              </label>
              <CustomSwitch v-model="form.lintasHari" label="Lintas tengah malam" sideLabelTrue="Ya" />
              <CustomSwitch v-model="form.libur" label="Libur" sideLabelTrue="Ya" />
              <CustomSwitch v-model="form.aktif" label="Aktif" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
            </div>
            <div class="flex justify-end gap-2">
              <CustomButton type="button" label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogPola = false" />
              <CustomButton type="submit" icon="PhFloppyDisk" label="Simpan Pola" />
            </div>
          </form>
          <div v-else class="text-grey-400">Anda tidak berwenang menyimpan pola ini untuk cakupan yang dipilih.</div>

          <div v-if="polaUuid && boleh('Pola Shift', 'DELETE') && cakupanPola()" class="flex flex-col gap-3 p-4 border rounded-lg border-danger-75 bg-danger-50">
            <div class="font-semibold text-danger-400">Nonaktifkan pola</div>
            <CustomTextfield v-model="alasan" label="Alasan penonaktifan" :maxLength="2000" />
            <div class="flex justify-end">
              <CustomButton
                icon="PhTrash"
                label="Hapus Lunak Pola Terpilih"
                backgroundColor="bg-danger-300"
                :disabled="!alasan.trim() || sibuk"
                @click="kirimHapus"
              />
            </div>
          </div>
        </fieldset>
      </template>
    </CustomDialog>

    <!-- Formulir rotasi -->
    <CustomDialog v-model:visible="dialogRotasi" width="560px" @closeDialog="tutupRotasi">
      <template #header>{{ rotasiUuid ? "Sunting Rotasi" : "Rotasi Baru" }}</template>
      <template #body>
        <fieldset :disabled="sibuk" class="flex flex-col min-w-0 gap-4 p-0 pt-4 m-0 border-0 text-sm">
          <div v-if="pesan" role="alert" class="px-3 py-2 rounded-lg bg-danger-50 text-danger-400">{{ pesan }}</div>
          <form v-if="wenang() && boleh('Pola Shift', rotasiUuid ? 'UPDATE' : 'CREATE')" class="flex flex-col gap-4" @submit.prevent="kirimRotasi">
            <div class="grid items-end grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
              <label class="flex flex-col">
                <span :class="KELAS_LABEL">Nama<span class="text-danger-300">*</span></span>
                <input v-model="rotasiForm.nama" required maxlength="150" :class="KELAS_INPUT" />
              </label>
              <CustomSwitch v-model="rotasiForm.aktif" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
            </div>
            <div class="flex flex-col gap-2">
              <div class="font-semibold">Urutan pola</div>
              <div v-if="!rotasiForm.urutanPola.length" class="text-xs text-grey-400">Belum ada urutan. Tambahkan pola sesuai urutan hari rotasi.</div>
              <div v-for="(_, i) in rotasiForm.urutanPola" :key="i" class="flex items-end gap-2">
                <label class="flex flex-col grow">
                  <span :class="KELAS_LABEL">Urutan {{ i + 1 }}<span class="text-danger-300">*</span></span>
                  <select v-model="rotasiForm.urutanPola[i]" required :class="KELAS_INPUT">
                    <option v-for="p in pola.filter((p) => p.aktif)" :key="p.uuid" :value="p.uuid">{{ p.nama }}</option>
                  </select>
                </label>
                <CustomButton type="button" icon="PhTrash" outlined borderColor="border-danger-300" textColor="text-danger-300" aria-label="Hapus urutan" @click="rotasiForm.urutanPola.splice(i, 1)" />
              </div>
              <div>
                <CustomButton
                  type="button"
                  icon="PhPlus"
                  label="Tambah Urutan"
                  size="small"
                  outlined
                  borderColor="border-opensimrs-300"
                  textColor="text-opensimrs-300"
                  @click="rotasiForm.urutanPola.push('')"
                />
              </div>
            </div>
            <div class="flex justify-end gap-2">
              <CustomButton type="button" label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogRotasi = false" />
              <CustomButton type="submit" icon="PhFloppyDisk" label="Simpan Rotasi" />
            </div>
          </form>
          <div v-else class="text-grey-400">Anda tidak berwenang menyimpan rotasi pada unit ini.</div>
        </fieldset>
      </template>
    </CustomDialog>
  </div>
</template>
