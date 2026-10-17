<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  GOLONGAN_ABO,
  RHESUS,
  STATUS_STOK_BDRS,
  SUMBER_STOK,
  daftarKomponenBdrs,
  daftarStokBdrs,
  gayaStokBdrs,
  golonganRh,
  izinBdrs,
  keEpoch,
  opsi,
  pengeluaranStokBdrs,
  sisaHariBdrs,
  terimaStokBdrs,
  waktuBdrs,
} from "@/stores/penunjang/bankDarah";

// Stok & Penerimaan: satu baris per kantong darah. Ringkasan kantong tersedia per komponen/golongan, peringatan
// kedaluwarsa (ambang dari Pengaturan BDRS), penerimaan kantong dari UTD, serta pengembalian/pemusnahan beralasan
// (riwayat kantong tidak dihapus).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinBdrs("Stok & Penerimaan", aksi);

const komponen = ref<any[]>([]);
const opsiKomponen = computed(() => komponen.value.map((k: any) => ({ value: k.uuid, label: `${k.kode} — ${k.nama}` })));

// ── Daftar & filter
const data = ref<any[]>([]);
const ringkasan = ref<any[]>([]);
const ambangHari = ref(3);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterKomponen = ref("");
const filterGolongan = ref<string[]>([]);
const filterStatus = ref<string[]>(["tersedia"]);
const hanyaHampirKedaluwarsa = ref(false);

const toggle = (daftar: typeof filterGolongan, nilai: string) => {
  daftar.value = daftar.value.includes(nilai) ? daftar.value.filter((x) => x !== nilai) : [...daftar.value, nilai];
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarStokBdrs({
      page: page.value,
      limit: limit.value,
      cari: cari.value,
      komponen_uuid: filterKomponen.value,
      golongan_abo: filterGolongan.value,
      status: filterStatus.value,
      kedaluwarsa_dalam_hari: hanyaHampirKedaluwarsa.value ? ambangHari.value : undefined,
    });
    data.value = res?.payload?.data ?? [];
    total.value = res?.payload?.pagination?.total ?? 0;
    ringkasan.value = res?.payload?.ringkasan ?? [];
    ambangHari.value = res?.payload?.ambangKedaluwarsaHari ?? ambangHari.value;
  } finally {
    storeUtils.setLoading(false);
  }
};
const cariData = () => {
  page.value = 1;
  muat();
};
const reset = () => {
  cari.value = "";
  filterKomponen.value = "";
  filterGolongan.value = [];
  filterStatus.value = ["tersedia"];
  hanyaHampirKedaluwarsa.value = false;
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

onMounted(async () => {
  komponen.value = (await daftarKomponenBdrs({ limit: 200 }))?.payload?.data ?? [];
  muat();
});

// Ringkasan dikelompokkan per komponen → golongan.
const ringkasanPerKomponen = computed(() => {
  const peta: Record<string, { nama: string; baris: any[] }> = {};
  for (const r of ringkasan.value) {
    const kunci = r.komponenUuid ?? "-";
    (peta[kunci] ??= { nama: r.komponenNama ?? "-", baris: [] }).baris.push(r);
  }
  return Object.values(peta);
});
const hampirKedaluwarsa = (epoch: any) => {
  const sisa = sisaHariBdrs(epoch);
  return sisa !== null && sisa <= ambangHari.value;
};

// ── Penerimaan kantong
const dialogTerima = ref(false);
const kosong = () => ({
  noKantong: "",
  komponenUuid: "",
  golonganAbo: "",
  rhesus: "positif",
  volumeMl: 0,
  tanggalProduksi: null as Date | null,
  tanggalKedaluwarsa: null as Date | null,
  lokasiPenyimpanan: "",
  sumber: "utd_manual",
  utdReferensiUuid: "",
  lolosImltd: false,
});
const formTerima = ref(kosong());
const galatTerima = ref("");
const bukaTerima = () => {
  formTerima.value = kosong();
  galatTerima.value = "";
  dialogTerima.value = true;
};
const simpanTerima = async (lanjut = false) => {
  const f = formTerima.value;
  galatTerima.value = "";
  if (!f.noKantong.trim()) return (galatTerima.value = "Nomor kantong wajib diisi");
  if (!f.komponenUuid || !f.golonganAbo || !f.rhesus) return (galatTerima.value = "Komponen, golongan, dan rhesus wajib dipilih");
  if (!f.tanggalKedaluwarsa) return (galatTerima.value = "Tanggal kedaluwarsa wajib diisi");
  if (f.tanggalProduksi && f.tanggalKedaluwarsa <= f.tanggalProduksi) return (galatTerima.value = "Tanggal kedaluwarsa harus setelah tanggal aftap/produksi");
  if (!f.lolosImltd) return (galatTerima.value = "Pastikan kantong sudah lolos uji saring IMLTD (non-reaktif) dari UTD");
  storeUtils.setLoading(true);
  try {
    const res = await terimaStokBdrs({
      noKantong: f.noKantong.trim(),
      komponenUuid: f.komponenUuid,
      golonganAbo: f.golonganAbo,
      rhesus: f.rhesus,
      volumeMl: f.volumeMl > 0 ? f.volumeMl : null,
      tanggalProduksi: keEpoch(f.tanggalProduksi),
      tanggalKedaluwarsa: keEpoch(f.tanggalKedaluwarsa) as number,
      lokasiPenyimpanan: f.lokasiPenyimpanan.trim() || undefined,
      sumber: f.sumber,
      utdReferensiUuid: f.utdReferensiUuid.trim() || undefined,
    });
    if (res?.payload) {
      muat();
      if (lanjut) {
        // Kantong berikutnya dari kiriman yang sama: pertahankan komponen, golongan, tanggal & lokasi.
        formTerima.value = { ...f, noKantong: "" };
      } else dialogTerima.value = false;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Pengeluaran (kembalikan ke UTD / musnahkan)
const dialogKeluar = ref(false);
const kantongKeluar = ref<any>(null);
const aksiKeluar = ref<"kembalikan" | "musnahkan">("kembalikan");
const alasanKeluar = ref("");
const galatKeluar = ref("");
const bukaKeluar = (s: any, aksi: "kembalikan" | "musnahkan") => {
  kantongKeluar.value = s;
  aksiKeluar.value = aksi;
  alasanKeluar.value = aksi === "musnahkan" && s.kedaluwarsa ? "Kedaluwarsa" : "";
  galatKeluar.value = "";
  dialogKeluar.value = true;
};
const simpanKeluar = async () => {
  if (!alasanKeluar.value.trim()) return (galatKeluar.value = "Alasan wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await pengeluaranStokBdrs(kantongKeluar.value.uuid, aksiKeluar.value, alasanKeluar.value.trim());
    if (res?.payload) {
      dialogKeluar.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const bisaKeluar = (s: any) => ["tersedia", "kedaluwarsa"].includes(s.status);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Stok & Penerimaan</h1>
          <CustomTextfield v-model="cari" label="No. Kantong" prependIcon="PhMagnifyingGlass" placeholder="Cari nomor kantong" :maxLength="100" @keydown.enter="cariData" />
          <CustomSelect v-model="filterKomponen" label="Komponen" placeHolder="Semua komponen" :options="opsiKomponen" optionValue="value" optionLabel="label" class="w-[220px]" />
          <ToolbarFilterMenu :count="filterGolongan.length">
            <template #label>Golongan</template>
            <CustomChip v-for="g in Object.keys(GOLONGAN_ABO)" :key="g" :label="g" :value="g" :isSelected="filterGolongan.includes(g)" @selected="toggle(filterGolongan, $event)" />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterStatus.length + (hanyaHampirKedaluwarsa ? 1 : 0)">
            <template #label>Status</template>
            <CustomChip
              v-for="(s, kode) in STATUS_STOK_BDRS"
              :key="kode"
              :label="s.label"
              :value="String(kode)"
              :isSelected="filterStatus.includes(String(kode))"
              @selected="toggle(filterStatus, $event)"
            />
            <CustomChip :label="`Kedaluwarsa ≤ ${ambangHari} hari`" value="hampir" :isSelected="hanyaHampirKedaluwarsa" @selected="hanyaHampirKedaluwarsa = !hanyaHampirKedaluwarsa" />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton v-if="boleh('TERIMA KANTONG')" icon="PhPlus" label="Terima Kantong" @click="bukaTerima" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col h-full gap-3 overflow-auto">
          <!-- Ringkasan stok tersedia -->
          <div v-if="ringkasanPerKomponen.length" class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div v-for="k in ringkasanPerKomponen" :key="k.nama" class="p-3 border rounded-lg border-grey-75">
              <div class="mb-2 text-sm font-semibold">{{ k.nama }}</div>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="r in k.baris"
                  :key="`${r.golonganAbo}${r.rhesus}`"
                  class="px-2 py-1 text-xs border rounded-lg"
                  :class="hampirKedaluwarsa(r.kedaluwarsaTerdekat) ? 'border-[#F79009] bg-[#FFFAEB]' : 'border-grey-75'"
                  :title="`Kedaluwarsa terdekat ${waktuBdrs(r.kedaluwarsaTerdekat, true)}`"
                >
                  <b>{{ golonganRh(r.golonganAbo, r.rhesus) }}</b> · {{ r.jumlah }} ktg
                  <PhWarning v-if="hampirKedaluwarsa(r.kedaluwarsaTerdekat)" :size="12" class="inline text-[#B54708]" />
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-xs text-grey-400">Belum ada kantong tersedia.</div>

          <NoData v-if="!data.length" />
          <DataTable v-else :value="data" stripedRows class="text-xs" tableStyle="min-width: 64rem">
            <Column field="noKantong" header="No. Kantong" headerClass="bg-opensimrs-50">
              <template #body="{ data: s }"><span class="font-semibold">{{ s.noKantong }}</span></template>
            </Column>
            <Column header="Komponen" headerClass="bg-opensimrs-50">
              <template #body="{ data: s }">{{ s.komponenKode }} — {{ s.komponenNama }}</template>
            </Column>
            <Column header="Gol." headerClass="bg-opensimrs-50">
              <template #body="{ data: s }"><b>{{ golonganRh(s.golonganAbo, s.rhesus) }}</b></template>
            </Column>
            <Column header="Volume" headerClass="bg-opensimrs-50">
              <template #body="{ data: s }">{{ s.volumeMl ? `${s.volumeMl} mL` : "-" }}</template>
            </Column>
            <Column header="Aftap / Produksi" headerClass="bg-opensimrs-50">
              <template #body="{ data: s }">{{ waktuBdrs(s.tanggalProduksi, true) }}</template>
            </Column>
            <Column header="Kedaluwarsa" headerClass="bg-opensimrs-50">
              <template #body="{ data: s }">
                <div>{{ waktuBdrs(s.tanggalKedaluwarsa, true) }}</div>
                <span v-if="s.kedaluwarsa" class="px-1.5 rounded text-[10px] font-semibold bg-[#FDE2E1] text-[#B42318]">Sudah kedaluwarsa</span>
                <span v-else-if="s.peringatanKedaluwarsa" class="px-1.5 rounded text-[10px] font-semibold bg-[#FEF0C7] text-[#B54708]">
                  {{ sisaHariBdrs(s.tanggalKedaluwarsa) }} hari lagi
                </span>
              </template>
            </Column>
            <Column header="Penyimpanan / Sumber" headerClass="bg-opensimrs-50">
              <template #body="{ data: s }">
                <div>{{ s.lokasiPenyimpanan ?? "-" }}</div>
                <div class="text-grey-400">{{ SUMBER_STOK[s.sumber] ?? s.sumber }}</div>
              </template>
            </Column>
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data: s }">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaStokBdrs(s.status)?.bg, gayaStokBdrs(s.status)?.text]">
                  {{ gayaStokBdrs(s.status)?.label ?? s.status }}
                </span>
                <div v-if="s.alasanKeluar" class="text-grey-400">{{ s.alasanKeluar }}</div>
              </template>
            </Column>
            <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[200px]">
              <template #body="{ data: s }">
                <div v-if="bisaKeluar(s)" class="flex gap-2">
                  <CustomButton
                    v-if="boleh('KEMBALIKAN')"
                    label="Kembalikan"
                    size="small"
                    outlined
                    borderColor="border-opensimrs-300"
                    textColor="text-opensimrs-300"
                    @click="bukaKeluar(s, 'kembalikan')"
                  />
                  <CustomButton
                    v-if="boleh('MUSNAHKAN')"
                    label="Musnahkan"
                    size="small"
                    outlined
                    borderColor="border-danger-300"
                    textColor="text-danger-300"
                    @click="bukaKeluar(s, 'musnahkan')"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <!-- Penerimaan kantong -->
    <CustomDialog v-model:visible="dialogTerima" width="760px">
      <template #header>Penerimaan Kantong Darah</template>
      <template #body>
        <div class="grid grid-cols-3 gap-4 pt-4">
          <CustomTextfield v-model="formTerima.noKantong" label="Nomor Kantong" placeholder="mis. 9999-UTD-000001" required :maxLength="100" />
          <CustomSelect v-model="formTerima.komponenUuid" label="Komponen" placeHolder="Pilih komponen" :options="opsiKomponen.filter((o) => komponen.find((k: any) => k.uuid === o.value)?.status !== false)" optionValue="value" optionLabel="label" required />
          <CustomInputNumber v-model="formTerima.volumeMl" label="Volume (mL)" :min="0" />
          <CustomSelect v-model="formTerima.golonganAbo" label="Golongan ABO" placeHolder="Pilih golongan" :options="opsi(GOLONGAN_ABO)" optionValue="value" optionLabel="label" :showFilter="false" required />
          <CustomSelect v-model="formTerima.rhesus" label="Rhesus" :options="opsi(RHESUS)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomSelect v-model="formTerima.sumber" label="Sumber" :options="opsi(SUMBER_STOK)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          <CustomDatePicker v-model="formTerima.tanggalProduksi" label="Tanggal Aftap / Produksi" :maxDate="new Date()" />
          <CustomDatePicker v-model="formTerima.tanggalKedaluwarsa" label="Tanggal Kedaluwarsa" :minDate="formTerima.tanggalProduksi ?? new Date()" required />
          <CustomTextfield v-model="formTerima.lokasiPenyimpanan" label="Lokasi Penyimpanan" placeholder="mis. Blood bank refrigerator 1" :maxLength="150" />
          <CustomTextfield v-model="formTerima.utdReferensiUuid" label="Referensi UTD (opsional)" placeholder="No. surat/berita acara kiriman" class="col-span-2" :maxLength="100" />
          <div class="flex items-start col-span-3 gap-2 p-3 rounded-lg bg-opensimrs-50">
            <Checkbox v-model="formTerima.lolosImltd" binary inputId="bdrs-imltd" />
            <label for="bdrs-imltd" class="text-sm">Kantong sudah lolos uji saring <b>IMLTD</b> (HIV, Hepatitis B, Hepatitis C, Sifilis) dengan hasil non-reaktif dari UTD, label & segel utuh.</label>
          </div>
        </div>
        <div v-if="galatTerima" class="mt-3 text-sm text-danger-300">{{ galatTerima }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogTerima = false" />
          <CustomButton label="Simpan & Kantong Berikutnya" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="simpanTerima(true)" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanTerima(false)" />
        </div>
      </template>
    </CustomDialog>

    <!-- Pengeluaran -->
    <CustomDialog v-model:visible="dialogKeluar" width="460px" :headerBg="aksiKeluar === 'musnahkan' ? 'bg-danger-300' : 'bg-opensimrs-300'">
      <template #header>{{ aksiKeluar === "musnahkan" ? "Musnahkan" : "Kembalikan ke UTD" }} — {{ kantongKeluar?.noKantong }}</template>
      <template #body>
        <div class="flex flex-col gap-2 pt-4">
          <div class="text-sm text-grey-400">
            {{ kantongKeluar?.komponenNama }} · {{ golonganRh(kantongKeluar?.golonganAbo, kantongKeluar?.rhesus) }} · kedaluwarsa {{ waktuBdrs(kantongKeluar?.tanggalKedaluwarsa, true) }}
          </div>
          <CustomTextArea v-model="alasanKeluar" label="Alasan" :placeholder="aksiKeluar === 'musnahkan' ? 'mis. kedaluwarsa / kantong bocor / hemolisis' : 'mis. permintaan ditarik UTD'" required />
          <div v-if="galatKeluar" class="text-sm text-danger-300">{{ galatKeluar }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Kembali" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogKeluar = false" />
          <CustomButton :label="aksiKeluar === 'musnahkan' ? 'Musnahkan' : 'Kembalikan'" :backgroundColor="aksiKeluar === 'musnahkan' ? 'bg-danger-300' : undefined" @click="simpanKeluar" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
