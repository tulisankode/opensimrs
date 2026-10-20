<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import FormulirData from "./FormulirData.vue";
import KonfirmasiGaji from "./KonfirmasiGaji.vue";
import { bacaGaji, izinGaji, nominalGaji, simpanGaji, opsiGaji, epochHariGaji, masaGaji, JENIS_KOMPONEN, KATEGORI_KOMPONEN, PAJAK_KOMPONEN } from "@/stores/penunjang/penggajian";

// Komponen penggajian (STD-0041): master komponen, skala gaji pokok, dan penetapan komponen per pegawai SDM.
// Semua referensi dipilih dari daftar yang dimuat; payload API tidak berubah dari versi awal.
const tab = ref<"komponen" | "skala" | "penetapan">("komponen");
const komponen = ref<any[]>([]), semuaKomponen = ref<any[]>([]), skala = ref<any[]>([]), pegawai = ref<any[]>([]), penetapan = ref<any[]>([]);
const pegawaiUuid = ref(""), page = ref(1), total = ref(0), cari = ref(""), memuat = ref(false);
const masa = [{ nama: "berlakuMulai", label: "Mulai berlaku", jenis: "tanggal" as const }, { nama: "berlakuSampai", label: "Berakhir sebelum tanggal", jenis: "tanggal" as const, opsional: true, bantuan: "Kosongkan bila berlaku seterusnya. Tanggal ini sudah tidak termasuk masa berlaku." }];
const OPSI_JENIS = opsiGaji(JENIS_KOMPONEN);
const OPSI_KATEGORI = opsiGaji({ gaji_pokok: KATEGORI_KOMPONEN.gaji_pokok, tunjangan: KATEGORI_KOMPONEN.tunjangan, potongan_lain: KATEGORI_KOMPONEN.potongan_lain, iuran: KATEGORI_KOMPONEN.iuran });
const OPSI_PAJAK = opsiGaji(PAJAK_KOMPONEN);
const kolomKomponen = [
  { nama: "kode", label: "Kode", contoh: "mis. GP atau TUNJ_JABATAN", maks: 40, bantuan: "Diawali huruf; huruf, angka, atau garis bawah; maksimal 40 karakter." },
  { nama: "nama", label: "Nama", maks: 150 },
  { nama: "jenis", label: "Jenis", pilihan: OPSI_JENIS },
  { nama: "kategori", label: "Kategori", pilihan: OPSI_KATEGORI },
  { nama: "perlakuanPajak", label: "Perlakuan pajak", pilihan: OPSI_PAJAK },
];
const kolomSkala = [
  { nama: "golongan", label: "Golongan", contoh: "mis. III/a", maks: 50 },
  { nama: "nilai", label: "Nominal gaji pokok", jenis: "nominal" as const },
  { nama: "masaKerjaMinBulan", label: "Masa kerja minimum (bulan)", jenis: "angka" as const, min: 0 },
  { nama: "masaKerjaMaksBulan", label: "Masa kerja maksimum (bulan, eksklusif)", jenis: "angka" as const, min: 1, opsional: true },
  ...masa,
];

const labelKomponen = (r: any) => (r ? `${r.kode} — ${r.nama}` : "Komponen tidak ditemukan");
const labelSkala = (r: any) => (r ? `Gol. ${r.golongan} · ${r.masaKerjaMinBulan}–${r.masaKerjaMaksBulan ?? "∞"} bln · ${nominalGaji(r.nilai)}` : "Skala tidak ditemukan");
const petaKomponen = computed(() => new Map(semuaKomponen.value.map((r) => [r.uuid, r])));
const petaSkala = computed(() => new Map(skala.value.map((r) => [r.uuid, r])));
const opsiKomponen = computed(() => semuaKomponen.value.filter((r) => r.aktif !== false).map((r) => ({ value: r.uuid, label: labelKomponen(r) })));
const opsiPegawai = computed(() => pegawai.value.map((r) => ({ value: r.uuid, label: [r.nama, r.golongan && `Gol. ${r.golongan}`].filter(Boolean).join(" · ") })));
const pegawaiTerpilih = computed(() => pegawai.value.find((r) => r.uuid === pegawaiUuid.value));

const muat = async () => {
  if (!izinGaji("komponen")) return;
  memuat.value = true;
  try {
    const r = await bacaGaji("/komponen", { page: page.value });
    komponen.value = r?.payload?.data ?? []; total.value = r?.payload?.pagination?.total ?? 0;
    semuaKomponen.value = (await bacaGaji("/komponen", { limit: 200 }))?.payload?.data ?? [];
    skala.value = (await bacaGaji("/skala", { limit: 200 }))?.payload?.data ?? [];
    if (pegawaiUuid.value) await muatPegawai();
  } finally { memuat.value = false; }
};
const gantiHalaman = (e: { page: number }) => { page.value = e.page + 1; muat(); };
const cariPegawai = async () => { pegawai.value = (await bacaGaji("/pegawai", { cari: cari.value, limit: 200 }))?.payload?.data ?? []; };
const muatPegawai = async () => { penetapan.value = pegawaiUuid.value ? (await bacaGaji(`/pegawai/${pegawaiUuid.value}/komponen`, { limit: 200 }))?.payload?.data ?? [] : []; };
const pilihPegawai = (v: string) => { pegawaiUuid.value = v ?? ""; muatPegawai(); };

// ── Ubah nama komponen yang belum digunakan (PUT seluruh master; kode/jenis/kategori/pajak tetap).
const dialogNama = ref(false), barisNama = ref<any>(null), namaBaru = ref(""), sibuk = ref(false);
const bukaNama = (r: any) => { barisNama.value = r; namaBaru.value = r.nama; dialogNama.value = true; };
const simpanNama = async () => {
  if (sibuk.value) return;
  const r = barisNama.value;
  sibuk.value = true;
  try {
    if (await simpanGaji(`/komponen/${r.uuid}`, { kode: r.kode, nama: namaBaru.value.trim(), jenis: r.jenis, kategori: r.kategori, perlakuanPajak: r.perlakuanPajak }, true)) { dialogNama.value = false; await muat(); }
  } finally { sibuk.value = false; }
};

// ── Penetapan komponen pegawai: nominal tetap ATAU skala (skala hanya untuk komponen kategori gaji pokok).
const dialogTetap = ref(false), formTetap = ref<any>({}), galatTetap = ref("");
const komponenTetap = computed(() => petaKomponen.value.get(formTetap.value.komponenUuid));
const opsiSkala = computed(() => skala.value.map((r) => ({ value: r.uuid, label: labelSkala(r) })));
const bukaTetap = () => { galatTetap.value = ""; formTetap.value = { komponenUuid: "", sumber: "nilai", nilai: "", skalaUuid: "", alasan: "", berlakuMulai: null, berlakuSampai: null }; dialogTetap.value = true; };
const simpanTetap = async () => {
  const f = formTetap.value;
  galatTetap.value = "";
  if (!f.komponenUuid) return (galatTetap.value = "Komponen wajib dipilih");
  if (f.sumber === "skala" && !f.skalaUuid) return (galatTetap.value = "Skala gaji wajib dipilih");
  if (!f.berlakuMulai) return (galatTetap.value = "Mulai berlaku wajib diisi");
  if (sibuk.value) return;
  sibuk.value = true;
  try {
    const data = { komponenUuid: f.komponenUuid, nilai: f.sumber === "nilai" ? f.nilai.trim() : null, skalaUuid: f.sumber === "skala" ? f.skalaUuid : null,
      alasan: f.alasan.trim(), berlakuMulai: epochHariGaji(f.berlakuMulai), berlakuSampai: epochHariGaji(f.berlakuSampai) };
    if (await simpanGaji(`/pegawai/${pegawaiUuid.value}/komponen`, data)) { dialogTetap.value = false; await muatPegawai(); }
  } finally { sibuk.value = false; }
};

// ── Akhiri masa berlaku penetapan.
const dialogAkhiri = ref(false), barisAkhiri = ref<any>(null);
const bukaAkhiri = (r: any) => { barisAkhiri.value = r; dialogAkhiri.value = true; };
const akhiri = async ({ alasan, tanggal }: { alasan: string; tanggal: Date | null }) => {
  if (sibuk.value) return;
  sibuk.value = true;
  try {
    if (await simpanGaji(`/komponen-pegawai/${barisAkhiri.value.uuid}/akhiri`, { berlakuSampai: epochHariGaji(tanggal), alasan })) { dialogAkhiri.value = false; await muatPegawai(); }
  } finally { sibuk.value = false; }
};

const kelasLabel = "block font-semibold mb-[5px] text-normal";
const kelasInput = "w-full h-10 px-3 bg-white border rounded-lg border-grey-200 text-SM";
const kelasArea = "w-full p-3 bg-white border rounded-lg border-grey-200 text-SM";
const kelasTombolSimpan = "h-10 px-4 font-semibold text-white rounded-[10px] bg-opensimrs-300 disabled:bg-grey-200 disabled:text-grey-400";
const kelasTab = (aktif: boolean) => ["px-4 py-2 -mb-px text-sm font-semibold border-b-2", aktif ? "border-opensimrs-300 text-opensimrs-300" : "border-transparent text-grey-400 hover:text-opensimrs-300"];
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" :disabled="memuat" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Komponen Penggajian</h1>
          <FormulirData v-if="tab === 'komponen'" judul="Tambah Komponen Penggajian" label-tombol="Tambah Komponen" path="/komponen" :boleh="izinGaji('komponen', 'CREATE')" :kolom="kolomKomponen" @tersimpan="muat" />
          <FormulirData v-if="tab === 'skala'" judul="Tambah Skala Gaji Pokok" label-tombol="Tambah Skala" path="/skala" :boleh="izinGaji('komponen', 'CREATE')" :kolom="kolomSkala" keterangan="Rentang masa kerja dan masa berlaku untuk golongan yang sama tidak boleh bertumpang tindih." @tersimpan="muat" />
          <CustomButton v-if="tab === 'penetapan' && pegawaiUuid && izinGaji('komponen', 'CREATE')" icon="PhPlus" label="Tetapkan Komponen" @click="bukaTetap" />
        </PageToolbar>
      </template>

      <template #content>
        <div class="flex flex-col gap-4 pt-4">
          <nav class="flex flex-wrap gap-1 border-b border-grey-100" aria-label="Bagian komponen penggajian">
            <button type="button" :class="kelasTab(tab === 'komponen')" @click="tab = 'komponen'">Master komponen</button>
            <button type="button" :class="kelasTab(tab === 'skala')" @click="tab = 'skala'">Skala gaji pokok</button>
            <button type="button" :class="kelasTab(tab === 'penetapan')" @click="tab = 'penetapan'">Penetapan pegawai</button>
          </nav>
          <p class="px-3 py-2 text-xs rounded-lg bg-info-50 text-info-400">Komponen memiliki masa berlaku. Perubahan atas periode terkunci dicatat melalui koreksi pada periode berikutnya.</p>

          <template v-if="tab === 'komponen'">
            <NoData v-if="!komponen.length" title="Belum ada komponen penggajian" class="min-h-[240px]" />
            <DataTable v-else :value="komponen" stripedRows class="text-xs" scrollable tableStyle="min-width: 48rem">
              <Column header="Kode" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span class="font-semibold">{{ r.kode }}</span></template></Column>
              <Column field="nama" header="Nama" headerClass="bg-opensimrs-50" />
              <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ JENIS_KOMPONEN[r.jenis] ?? r.jenis }}</template></Column>
              <Column header="Kategori" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ KATEGORI_KOMPONEN[r.kategori] ?? r.kategori }}</template></Column>
              <Column header="Pajak" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ PAJAK_KOMPONEN[r.perlakuanPajak] ?? r.perlakuanPajak }}</template></Column>
              <Column header="Status" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }"><span class="inline-block px-2 py-0.5 text-xs font-semibold rounded-full" :class="r.aktif === false ? 'bg-grey-75 text-grey-500' : 'bg-success-50 text-success-400'">{{ r.aktif === false ? "Nonaktif" : "Aktif" }}</span></template>
              </Column>
              <Column v-if="izinGaji('komponen', 'UPDATE')" header="Aksi" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }"><CustomButton label="Ubah nama" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaNama(r)" /></template>
              </Column>
            </DataTable>
          </template>

          <template v-else-if="tab === 'skala'">
            <NoData v-if="!skala.length" title="Belum ada skala gaji pokok" class="min-h-[240px]" />
            <DataTable v-else :value="skala" stripedRows class="text-xs" scrollable tableStyle="min-width: 40rem">
              <Column header="Golongan" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span class="font-semibold">{{ r.golongan }}</span></template></Column>
              <Column header="Masa kerja" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ r.masaKerjaMinBulan }} – {{ r.masaKerjaMaksBulan == null ? "seterusnya" : `< ${r.masaKerjaMaksBulan}` }} bulan</template></Column>
              <Column header="Nominal" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ nominalGaji(r.nilai) }}</template></Column>
              <Column header="Masa berlaku" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ masaGaji(r) }}</template></Column>
            </DataTable>
          </template>

          <template v-else>
            <div class="flex flex-wrap items-end gap-2">
              <CustomTextfield v-model="cari" label="Cari pegawai SDM" prependIcon="PhMagnifyingGlass" placeholder="Nama pegawai" :maxLength="150" @keydown.enter="cariPegawai" />
              <CustomButton icon="PhMagnifyingGlass" label="Cari" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cariPegawai" />
              <CustomSelect :modelValue="pegawaiUuid" label="Pegawai SDM" placeHolder="Cari lalu pilih pegawai" class="min-w-[280px]" :options="opsiPegawai" optionValue="value" optionLabel="label" @update:modelValue="pilihPegawai" />
            </div>
            <NoData v-if="!pegawaiUuid" title="Pilih pegawai untuk melihat penetapan komponen" class="min-h-[200px]" />
            <NoData v-else-if="!penetapan.length" title="Belum ada komponen yang ditetapkan untuk pegawai ini" class="min-h-[200px]" />
            <DataTable v-else :value="penetapan" stripedRows class="text-xs" scrollable tableStyle="min-width: 56rem">
              <Column header="Komponen" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span class="font-semibold">{{ labelKomponen(petaKomponen.get(r.komponenUuid)) }}</span></template></Column>
              <Column header="Nominal" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ r.nilai == null ? `Mengikuti skala: ${labelSkala(petaSkala.get(r.skalaUuid))}` : nominalGaji(r.nilai) }}</template>
              </Column>
              <Column header="Masa berlaku" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ masaGaji(r) }}</template></Column>
              <Column field="alasan" header="Dasar penetapan" headerClass="bg-opensimrs-50" />
              <Column v-if="izinGaji('komponen', 'UPDATE')" header="Aksi" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }"><CustomButton label="Akhiri" icon="PhCalendarX" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="bukaAkhiri(r)" /></template>
              </Column>
            </DataTable>
          </template>
        </div>
      </template>

      <template v-if="tab === 'komponen'" #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :totalRecords="total" :rows="20" :rowsPerPageOptions="[20]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogNama" width="520px">
      <template #header>Ubah Nama Komponen</template>
      <template #body>
        <form id="form-nama-komponen" class="flex flex-col gap-3 pt-4 text-sm" @submit.prevent="simpanNama">
          <p class="text-grey-400">{{ barisNama?.kode }} · {{ JENIS_KOMPONEN[barisNama?.jenis] ?? barisNama?.jenis }}. Nama hanya dapat diubah selama komponen belum digunakan.</p>
          <label class="flex flex-col"><span :class="kelasLabel">Nama komponen<span class="text-danger-300">*</span></span><input v-model="namaBaru" :class="kelasInput" required maxlength="150" /></label>
        </form>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogNama = false" />
          <button type="submit" form="form-nama-komponen" :class="kelasTombolSimpan" :disabled="sibuk">Simpan</button>
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogTetap" width="720px">
      <template #header>Tetapkan Komponen · {{ pegawaiTerpilih?.nama }}</template>
      <template #body>
        <form id="form-tetap-komponen" class="flex flex-col gap-4 pt-4 text-sm" @submit.prevent="simpanTetap">
          <CustomSelect v-model="formTetap.komponenUuid" label="Komponen" placeHolder="Pilih komponen" :options="opsiKomponen" optionValue="value" optionLabel="label" required @update:modelValue="formTetap.sumber = 'nilai'; formTetap.skalaUuid = ''" />
          <div class="flex flex-wrap gap-4">
            <label class="flex items-center gap-2"><input v-model="formTetap.sumber" type="radio" value="nilai" class="w-4 h-4 accent-opensimrs-300" />Nominal tetap</label>
            <label class="flex items-center gap-2" :class="{ 'text-grey-300': komponenTetap?.kategori !== 'gaji_pokok' }">
              <input v-model="formTetap.sumber" type="radio" value="skala" class="w-4 h-4 accent-opensimrs-300" :disabled="komponenTetap?.kategori !== 'gaji_pokok'" />Mengikuti skala gaji pokok
            </label>
          </div>
          <label v-if="formTetap.sumber === 'nilai'" class="flex flex-col">
            <span :class="kelasLabel">Nominal tetap<span class="text-danger-300">*</span></span>
            <input v-model="formTetap.nilai" :class="kelasInput" inputmode="decimal" pattern="\d{1,16}(\.\d{1,2})?" title="Angka dengan titik desimal, maksimal dua angka di belakang titik" placeholder="mis. 750000.00" required />
          </label>
          <CustomSelect v-else v-model="formTetap.skalaUuid" label="Skala gaji pokok" placeHolder="Pilih skala" :options="opsiSkala" optionValue="value" optionLabel="label" required />
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CustomDatePicker v-model="formTetap.berlakuMulai" label="Mulai berlaku" required />
            <div class="flex flex-col">
              <CustomDatePicker v-model="formTetap.berlakuSampai" label="Berakhir sebelum tanggal (opsional)" />
              <span class="mt-1 text-xs text-grey-400">Kosongkan bila berlaku seterusnya.</span>
            </div>
          </div>
          <label class="flex flex-col"><span :class="kelasLabel">Dasar penetapan<span class="text-danger-300">*</span></span><textarea v-model="formTetap.alasan" :class="kelasArea" rows="3" required maxlength="1000" placeholder="mis. SK Direktur tentang tunjangan jabatan" /></label>
          <div v-if="galatTetap" role="alert" class="px-3 py-2 rounded-lg bg-danger-50 text-danger-400">{{ galatTetap }}</div>
        </form>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogTetap = false" />
          <button type="submit" form="form-tetap-komponen" :class="kelasTombolSimpan" :disabled="sibuk">Simpan</button>
        </div>
      </template>
    </CustomDialog>

    <KonfirmasiGaji
      v-model:visible="dialogAkhiri"
      judul="Akhiri Masa Berlaku Komponen"
      :pesan="`${labelKomponen(petaKomponen.get(barisAkhiri?.komponenUuid))} untuk ${pegawaiTerpilih?.nama ?? 'pegawai ini'} tidak berlaku lagi mulai tanggal yang dipilih.`"
      labelSetuju="Akhiri masa berlaku"
      berisiko
      :sibuk="sibuk"
      :tanggal="{ label: 'Tidak berlaku mulai tanggal' }"
      :alasan="{ label: 'Alasan pengakhiran', wajib: true }"
      @setuju="akhiri"
    />
  </div>
</template>
