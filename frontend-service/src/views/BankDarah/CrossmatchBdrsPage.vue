<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  GOLONGAN_ABO,
  HASIL_UJI,
  JK_BDRS,
  RHESUS,
  SKRINING_ANTIBODI,
  catatCrossmatchBdrs,
  catatPemeriksaanBdrs,
  daftarPermintaanBdrs,
  daftarStokBdrs,
  detailPermintaanBdrs,
  gayaPermintaanBdrs,
  golonganRh,
  izinBdrs,
  opsi,
  sisaHariBdrs,
  umurBdrs,
  waktuBdrs,
} from "@/stores/penunjang/bankDarah";

// Uji Silang Serasi: antrean permintaan yang sedang diproses BDRS → catat golongan ABO/Rh & skrining antibodi pasien,
// lalu crossmatch mayor/minor per kantong kandidat (komponen sama, status tersedia, belum kedaluwarsa). Hanya kantong
// kompatibel & berlaku yang dapat dipilih di Serah Terima; mencatat ulang pemeriksaan menandai crossmatch lama
// "perlu ditinjau ulang" (backend) sehingga kantong tersebut harus di-crossmatch ulang.
const storeUtils = utilsStore();
const bolehPeriksa = izinBdrs("Uji Silang Serasi", "CATAT PEMERIKSAAN");
const bolehCrossmatch = izinBdrs("Uji Silang Serasi", "CATAT CROSSMATCH");
const bolehOverride = izinBdrs("Uji Silang Serasi", "OVERRIDE DARURAT");

// ── Antrean
const antrean = ref<any[]>([]);
const cari = ref("");
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarPermintaanBdrs({ status: ["diproses", "dipenuhi_sebagian"], cari: cari.value, limit: 100 });
    antrean.value = res?.payload?.data ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);

// ── Dialog pemeriksaan & crossmatch
const dialog = ref(false);
const pm = ref<any>(null);
const formPeriksa = ref({ golonganAbo: "", rhesus: "", hasilSkriningAntibodi: "negatif", catatan: "" });
const galatPeriksa = ref("");

const muatDetail = async (uuid: string) => {
  const res = await detailPermintaanBdrs(uuid);
  if (res?.payload) pm.value = res.payload;
  return res?.payload;
};
const buka = async (baris: any) => {
  storeUtils.setLoading(true);
  try {
    const d = await muatDetail(baris.uuid);
    if (!d) return;
    const p = d.pemeriksaan;
    formPeriksa.value = {
      golonganAbo: p?.golonganAbo ?? "",
      rhesus: p?.rhesus ?? "",
      hasilSkriningAntibodi: p?.hasilSkriningAntibodi ?? "negatif",
      catatan: p?.catatan ?? "",
    };
    galatPeriksa.value = "";
    hanyaGolonganSama.value = true;
    peringatanTerakhir.value = [];
    dialog.value = true;
    muatKandidat();
  } finally {
    storeUtils.setLoading(false);
  }
};

const simpanPeriksa = async () => {
  const f = formPeriksa.value;
  galatPeriksa.value = "";
  if (!f.golonganAbo || !f.rhesus || !f.hasilSkriningAntibodi) return (galatPeriksa.value = "Golongan ABO, rhesus, dan hasil skrining antibodi wajib diisi");
  if (pm.value?.crossmatch?.length && !window.confirm("Mencatat ulang pemeriksaan akan menandai crossmatch yang sudah ada untuk ditinjau ulang. Lanjutkan?")) return;
  storeUtils.setLoading(true);
  try {
    const res = await catatPemeriksaanBdrs(pm.value.uuid, { ...f, catatan: f.catatan || undefined });
    if (res?.payload) {
      pm.value = res.payload;
      muatKandidat();
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Kandidat kantong (stok tersedia dengan komponen yang sama)
const kandidat = ref<any[]>([]);
const hanyaGolonganSama = ref(true);
const muatKandidat = async () => {
  if (!pm.value) return;
  const golongan = pm.value.pemeriksaan?.golonganAbo ?? pm.value.golonganDiminta;
  const res = await daftarStokBdrs({
    komponen_uuid: pm.value.komponenUuid,
    status: "tersedia",
    golongan_abo: hanyaGolonganSama.value ? golongan : undefined,
    limit: 100,
  });
  const sekarang = Date.now() / 1000;
  kandidat.value = (res?.payload?.data ?? []).filter((s: any) => Number(s.tanggalKedaluwarsa) > sekarang);
};
const hasilCrossmatch = (stokUuid: string) => (pm.value?.crossmatch ?? []).find((c: any) => c.stokUuid === stokUuid);

// Form crossmatch per kantong (satu dialog kecil)
const dialogCm = ref(false);
const kantongAktif = ref<any>(null);
const formCm = ref({ hasilMayor: "kompatibel", hasilMinor: "kompatibel", catatan: "", overrideDarurat: false, alasanOverride: "" });
const bukaCm = (s: any) => {
  kantongAktif.value = s;
  const ada = hasilCrossmatch(s.uuid);
  formCm.value = { hasilMayor: ada?.hasilMayor ?? "kompatibel", hasilMinor: ada?.hasilMinor ?? "kompatibel", catatan: ada?.catatan ?? "", overrideDarurat: false, alasanOverride: "" };
  dialogCm.value = true;
};
const kompatibelForm = computed(() => formCm.value.hasilMayor === "kompatibel" && formCm.value.hasilMinor === "kompatibel");
const peringatanTerakhir = ref<string[]>([]);
const simpanCm = async () => {
  storeUtils.setLoading(true);
  try {
    const { overrideDarurat, alasanOverride, ...hasil } = formCm.value;
    const res = await catatCrossmatchBdrs(pm.value.uuid, {
      stokUuid: kantongAktif.value.uuid,
      ...hasil,
      catatan: hasil.catatan || undefined,
      ...(overrideDarurat ? { overrideDarurat, alasanOverride } : {}),
    });
    if (res?.payload) {
      peringatanTerakhir.value = res.payload.peringatan ?? [];
      pm.value = res.payload;
      dialogCm.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const siap = computed(() =>
  (pm.value?.crossmatch ?? []).filter((c: any) => c.kompatibel && c.statusValidasi === "berlaku" && c.statusStok === "tersedia").length,
);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Uji Silang Serasi</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM / No. Permintaan" :maxLength="100" @keydown.enter="muat" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="mb-2 text-xs text-grey-400">Antrean permintaan berstatus Diproses BDRS / Dipenuhi Sebagian (CITO di urutan teratas).</div>
        <NoData v-if="!antrean.length" />
        <DataTable v-else :value="antrean" stripedRows class="text-xs cursor-pointer" tableStyle="min-width: 56rem" @rowClick="buka($event.data)">
          <Column header="No. Permintaan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">
                <span v-if="d.cito" class="px-1.5 mr-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>{{ d.noPermintaan }}
              </div>
              <div class="text-grey-400">{{ waktuBdrs(d.createdAt) }}</div>
            </template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaPasien ?? "-" }}</div>
              <div class="text-grey-400">{{ d.noRm }} · {{ JK_BDRS[d.gender] ?? "-" }} · {{ umurBdrs(d.birthDate) }}</div>
            </template>
          </Column>
          <Column header="Ruangan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.lokasiAsal ?? "-" }}</template>
          </Column>
          <Column header="Komponen / Gol. Diminta" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.komponenKode }} · {{ golonganRh(d.golonganDiminta, d.rhesusDiminta) }}</template>
          </Column>
          <Column header="Siap / Diminta" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.jumlahDipenuhi ?? 0 }}/{{ d.jumlahDiminta }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold" :class="[gayaPermintaanBdrs(d.status)?.bg, gayaPermintaanBdrs(d.status)?.text]">
                {{ gayaPermintaanBdrs(d.status)?.label ?? d.status }}
              </span>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <!-- Pemeriksaan golongan & crossmatch -->
    <CustomDialog v-model:visible="dialog" width="980px">
      <template #header>Uji Silang Serasi — {{ pm?.noPermintaan }}</template>
      <template #body>
        <div v-if="pm" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-3 gap-2 p-3 rounded-lg bg-opensimrs-50">
            <div><b>{{ pm.namaPasien }}</b> · {{ pm.noRm }} · {{ JK_BDRS[pm.gender] ?? "-" }} · {{ umurBdrs(pm.birthDate) }}</div>
            <div><span class="text-grey-400">Diminta:</span> {{ pm.komponenKode }} — {{ pm.komponenNama }} · {{ golonganRh(pm.golonganDiminta, pm.rhesusDiminta) }}</div>
            <div><span class="text-grey-400">Kantong siap:</span> <b>{{ siap }}</b> dari {{ pm.jumlahDiminta }}</div>
            <div class="col-span-3"><span class="text-grey-400">Indikasi:</span> {{ pm.indikasi }}</div>
          </div>

          <div>
            <h3 class="mb-2 font-semibold">1. Pemeriksaan Golongan Darah & Skrining Antibodi Pasien</h3>
            <div class="grid grid-cols-4 gap-3">
              <CustomSelect v-model="formPeriksa.golonganAbo" label="Golongan ABO" :options="opsi(GOLONGAN_ABO)" optionValue="value" optionLabel="label" :showFilter="false" required :disabled="!bolehPeriksa" />
              <CustomSelect v-model="formPeriksa.rhesus" label="Rhesus" :options="opsi(RHESUS)" optionValue="value" optionLabel="label" :showFilter="false" required :disabled="!bolehPeriksa" />
              <CustomSelect
                v-model="formPeriksa.hasilSkriningAntibodi"
                label="Skrining Antibodi"
                :options="opsi(SKRINING_ANTIBODI)"
                optionValue="value"
                optionLabel="label"
                :showFilter="false"
                :clearable="false"
                :disabled="!bolehPeriksa"
              />
              <div class="flex items-end">
                <CustomButton v-if="bolehPeriksa" :label="pm.pemeriksaan ? 'Simpan Ulang' : 'Simpan'" icon="PhFloppyDisk" @click="simpanPeriksa" />
              </div>
            </div>
            <CustomTextArea v-model="formPeriksa.catatan" label="Catatan" placeholder="Opsional" class="mt-2" :disabled="!bolehPeriksa" />
            <div v-if="galatPeriksa" class="mt-1 text-sm text-danger-300">{{ galatPeriksa }}</div>
            <div v-if="pm.pemeriksaan" class="mt-1 text-xs text-grey-400">
              Tercatat: {{ golonganRh(pm.pemeriksaan.golonganAbo, pm.pemeriksaan.rhesus) }} · skrining {{ SKRINING_ANTIBODI[pm.pemeriksaan.hasilSkriningAntibodi] }} ·
              {{ pm.pemeriksaan.petugas ?? "-" }} · {{ waktuBdrs(pm.pemeriksaan.waktuPeriksa) }}
            </div>
            <div
              v-if="pm.pemeriksaan && pm.golonganDiminta && pm.pemeriksaan.golonganAbo !== pm.golonganDiminta"
              class="px-3 py-2 mt-2 text-xs rounded-lg bg-[#FEF0C7] text-[#B54708]"
            >
              Golongan hasil pemeriksaan ({{ pm.pemeriksaan.golonganAbo }}) berbeda dengan golongan yang diminta ruangan ({{ pm.golonganDiminta }}). Pastikan identitas sampel.
            </div>
          </div>

          <div v-if="peringatanTerakhir.length" class="px-3 py-2 text-xs rounded-lg bg-[#FEF0C7] text-[#B54708]">
            <div v-for="(p, i) in peringatanTerakhir" :key="i">{{ p }}</div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-semibold">2. Crossmatch per Kantong Kandidat</h3>
              <div class="flex items-center gap-2 text-xs">
                <Checkbox v-model="hanyaGolonganSama" binary inputId="bdrs-gol-sama" @update:modelValue="muatKandidat" />
                <label for="bdrs-gol-sama">Hanya golongan ABO sama dengan pasien</label>
                <CustomButton icon="PhArrowClockwise" size="small" @click="muatKandidat" />
              </div>
            </div>
            <div v-if="!pm.pemeriksaan" class="text-xs text-danger-300">Catat pemeriksaan golongan darah pasien terlebih dahulu.</div>
            <NoData v-else-if="!kandidat.length" />
            <DataTable v-else :value="kandidat" stripedRows class="text-xs">
              <Column field="noKantong" header="No. Kantong" headerClass="bg-opensimrs-50" />
              <Column header="Gol." headerClass="bg-opensimrs-50">
                <template #body="{ data: s }">{{ golonganRh(s.golonganAbo, s.rhesus) }}</template>
              </Column>
              <Column header="Volume" headerClass="bg-opensimrs-50">
                <template #body="{ data: s }">{{ s.volumeMl ? `${s.volumeMl} mL` : "-" }}</template>
              </Column>
              <Column header="Kedaluwarsa" headerClass="bg-opensimrs-50">
                <template #body="{ data: s }">
                  <span :class="s.peringatanKedaluwarsa ? 'text-[#B54708] font-semibold' : ''">{{ waktuBdrs(s.tanggalKedaluwarsa, true) }} ({{ sisaHariBdrs(s.tanggalKedaluwarsa) }} hari)</span>
                </template>
              </Column>
              <Column header="Hasil Crossmatch" headerClass="bg-opensimrs-50">
                <template #body="{ data: s }">
                  <template v-if="hasilCrossmatch(s.uuid)">
                    <span :class="hasilCrossmatch(s.uuid).kompatibel ? 'text-mint-400' : 'text-danger-300'" class="font-semibold">
                      {{ hasilCrossmatch(s.uuid).kompatibel ? "Kompatibel" : "Inkompatibel" }}
                    </span>
                    <span class="text-grey-400">
                      (mayor {{ HASIL_UJI[hasilCrossmatch(s.uuid).hasilMayor] }}, minor {{ HASIL_UJI[hasilCrossmatch(s.uuid).hasilMinor] }})
                    </span>
                    <div v-if="hasilCrossmatch(s.uuid).statusValidasi === 'perlu_tinjau'" class="text-[10px] text-[#B54708]">Perlu ditinjau ulang</div>
                  </template>
                  <span v-else class="text-grey-400">Belum</span>
                </template>
              </Column>
              <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[140px]">
                <template #body="{ data: s }">
                  <CustomButton v-if="bolehCrossmatch" :label="hasilCrossmatch(s.uuid) ? 'Ulangi' : 'Crossmatch'" size="small" icon="PhFlask" @click="bukaCm(s)" />
                </template>
              </Column>
            </DataTable>
          </div>

          <div v-if="pm.crossmatch?.length">
            <h3 class="mb-1 font-semibold">Riwayat Crossmatch Permintaan Ini</h3>
            <DataTable :value="pm.crossmatch" stripedRows class="text-xs">
              <Column field="noKantong" header="No. Kantong" headerClass="bg-opensimrs-50" />
              <Column header="Gol." headerClass="bg-opensimrs-50">
                <template #body="{ data: c }">{{ golonganRh(c.golonganAbo, c.rhesus) }}</template>
              </Column>
              <Column header="Hasil" headerClass="bg-opensimrs-50">
                <template #body="{ data: c }">
                  <span :class="c.kompatibel ? 'text-mint-400' : 'text-danger-300'">{{ c.kompatibel ? "Kompatibel" : "Inkompatibel" }}</span>
                  <span v-if="c.statusValidasi === 'perlu_tinjau'" class="ml-1 text-[10px] text-[#B54708]">(perlu ditinjau ulang)</span>
                </template>
              </Column>
              <Column header="Status Kantong" headerClass="bg-opensimrs-50">
                <template #body="{ data: c }">{{ c.statusStok }}</template>
              </Column>
              <Column header="Petugas" headerClass="bg-opensimrs-50">
                <template #body="{ data: c }">{{ c.petugas ?? "-" }} · {{ waktuBdrs(c.waktuPeriksa) }}</template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
      <template #footer>
        <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogCm" width="480px">
      <template #header>Crossmatch Kantong {{ kantongAktif?.noKantong }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="grid grid-cols-2 gap-3">
            <CustomSelect v-model="formCm.hasilMayor" label="Mayor" :options="opsi(HASIL_UJI)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
            <CustomSelect v-model="formCm.hasilMinor" label="Minor" :options="opsi(HASIL_UJI)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          </div>
          <div class="text-sm" :class="kompatibelForm ? 'text-mint-400' : 'text-danger-300'">
            Kesimpulan: <b>{{ kompatibelForm ? "Kompatibel" : "Inkompatibel" }}</b>
            <span v-if="!kompatibelForm" class="text-xs"> — kantong tidak akan dapat diserahkan untuk permintaan ini.</span>
          </div>
          <CustomTextArea v-model="formCm.catatan" label="Catatan" placeholder="Opsional" />
          <div class="px-3 py-2 text-xs rounded-lg bg-[#FEF0C7] text-[#B54708]">
            Backend menolak kantong yang ABO/Rh-nya tidak cocok dengan pasien (HTTP 409), terlepas dari hasil mayor/minor di atas.
          </div>
          <div v-if="bolehOverride" class="flex flex-col gap-2 p-3 border rounded-lg border-danger-300">
            <label class="flex items-center gap-2 text-sm font-semibold text-danger-300">
              <Checkbox v-model="formCm.overrideDarurat" binary inputId="bdrs-cm-override" />
              Ajukan pengecualian darurat (hanya kantong universal & diaktifkan pengaturan BDRS)
            </label>
            <CustomTextArea v-if="formCm.overrideDarurat" v-model="formCm.alasanOverride" label="Alasan pengecualian (minimal 10 karakter)" required />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogCm = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanCm" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
