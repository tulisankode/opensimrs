<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import FormulirData, { type KolomGaji } from "./FormulirData.vue";
import KonfirmasiGaji from "./KonfirmasiGaji.vue";
import { bacaGaji, izinGaji, simpanGaji, nominalGaji, masaGaji, labelGaji, kelasLencanaGaji, jsonGaji, kunciSnake, kunciBesar } from "@/stores/penunjang/penggajian";

// Konfigurasi penggajian (STD-0041): versi aturan & kebijakan keuangan, profil penghitungan dan rekening pegawai, serta
// format ekspor bank. Pengesah/pemeriksa harus berbeda dari pembuat versi (diperiksa backend).
const bolehKonfigurasi = izinGaji("konfigurasi"), bolehRekening = izinGaji("rekening");
const tab = ref<"konfigurasi" | "pegawai" | "format">(bolehKonfigurasi ? "konfigurasi" : "pegawai");
const konfigurasi = ref<any[]>([]), format = ref<any[]>([]), profil = ref<any[]>([]), rekening = ref<any[]>([]), pegawai = ref<any[]>([]);
const pegawaiUuid = ref(""), cari = ref(""), page = ref(1), total = ref(0), memuat = ref(false), sibuk = ref(false);
const masa: KolomGaji[] = [{ nama: "berlakuMulai", label: "Mulai berlaku", jenis: "tanggal" }, { nama: "berlakuSampai", label: "Berakhir sebelum tanggal", jenis: "tanggal", opsional: true, bantuan: "Kosongkan bila berlaku seterusnya." }];
const CONTOH_KEBIJAKAN = '{\n  "tanggal_acuan": "awal_bulan | akhir_bulan",\n  "kehadiran_tidak_digunakan": true,\n  "perlakuan_pajak_jaspel": "kena_pajak | bukan_objek",\n  "penyaluran_jaspel": "utuh",\n  "waktu_jurnal": "pembayaran",\n  "penerbitan_slip": "pembayaran_dan_jurnal",\n  "pemisahan_tugas": "wajib",\n  "perubahan_tengah_bulan": "tanggal_acuan"\n}';
const CONTOH_ATURAN = '{\n  "metode": "periodik",\n  "rekonsiliasi": "tidak_diperlukan",\n  "parameter_wajib": ["…"],\n  "pembulatan": { "metode": "setengah_ke_atas", "satuan": "1.00" },\n  "potongan": [{ "kode": "bpjs_kesehatan", "kategori": "bpjs", "dasar_aturan": "…", "rumus": { … } }, …],\n  "iuran_pemberi_kerja": [ … ]\n}';
const kolomKonfigurasi: KolomGaji[] = [
  ...masa,
  { nama: "dasarAturan", label: "Sumber ketentuan", jenis: "area", maks: 4000, contoh: "mis. PMK tarif PPh 21, Perpres iuran BPJS, SK Direktur" },
  { nama: "aturan", label: "Aturan penghitungan (JSON)", jenis: "json", contoh: CONTOH_ATURAN, bantuan: "Wajib memuat aturan bpjs_kesehatan, bpjs_ketenagakerjaan, dan pph21. Tidak ada tarif bawaan." },
  { nama: "kebijakan", label: "Kebijakan keuangan (JSON)", jenis: "json", contoh: CONTOH_KEBIJAKAN },
  { nama: "kasusUji", label: "Kasus uji dan ekspektasi keuangan (JSON)", jenis: "json", contoh: '[{ "parameter": { … }, "ekspektasi": { "bpjs_kesehatan": "…", "pph21": "…" } }]' },
];
const kolomProfil: KolomGaji[] = [...masa,
  { nama: "parameter", label: "Parameter desimal (JSON)", jenis: "json", contoh: '{ "ptkp": "54000000.00" }', bantuan: "Nilai berupa teks desimal. Nama bruto, kena_pajak, gaji_pokok, dan jaspel dihitung sistem dan tidak boleh dipakai." },
  { nama: "bukti", label: "Dasar parameter", jenis: "area", maks: 4000 }];
const kolomRekening: KolomGaji[] = [...masa,
  { nama: "kodeBank", label: "Kode bank", maks: 40, contoh: "mis. 008" },
  { nama: "nomorRekening", label: "Nomor rekening", pola: "\\d{4,50}", polaPesan: "Hanya angka, 4–50 digit", maks: 50 },
  { nama: "namaPemilik", label: "Nama pemilik rekening", maks: 150 }];
const kolomFormat: KolomGaji[] = [
  { nama: "kode", label: "Kode format", maks: 40, contoh: "mis. BANK_A_CSV" },
  { nama: "spesifikasi", label: "Spesifikasi CSV bank (JSON)", jenis: "json", contoh: '{\n  "jenis": "csv",\n  "pemisah": ";",\n  "header": true,\n  "desimal": "titik",\n  "kolom": ["nomor_rekening", "nama_pemilik", "bersih", "referensi"]\n}',
    bantuan: "Pemisah , ; atau tab; desimal titik/koma; kolom dari kode_bank, nomor_rekening, nama_pemilik, bersih, referensi (nomor_rekening dan bersih wajib)." },
  { nama: "buktiSpesifikasi", label: "Sumber spesifikasi bank", jenis: "area", maks: 4000 }];

const opsiPegawai = computed(() => pegawai.value.map((r) => ({ value: r.uuid, label: [r.nama, r.golongan && `Gol. ${r.golongan}`].filter(Boolean).join(" · ") })));
const pegawaiTerpilih = computed(() => pegawai.value.find((r) => r.uuid === pegawaiUuid.value));

const muat = async () => {
  memuat.value = true;
  try {
    if (bolehKonfigurasi) {
      const r = await bacaGaji("/konfigurasi", { page: page.value }); konfigurasi.value = r?.payload?.data ?? []; total.value = r?.payload?.pagination?.total ?? 0;
      format.value = (await bacaGaji("/format-bank", { limit: 200 }))?.payload?.data ?? [];
    }
    await muatPegawai();
  } finally { memuat.value = false; }
};
const gantiHalaman = (e: { page: number }) => { page.value = e.page + 1; muat(); };
const cariPegawai = async () => { pegawai.value = (await bacaGaji("/pegawai", { cari: cari.value, limit: 200 }))?.payload?.data ?? []; };
const muatPegawai = async () => {
  if (!pegawaiUuid.value) { profil.value = []; rekening.value = []; return; }
  if (bolehKonfigurasi) profil.value = (await bacaGaji(`/pegawai/${pegawaiUuid.value}/profil`, { limit: 200 }))?.payload?.data ?? [];
  if (bolehRekening) rekening.value = (await bacaGaji(`/pegawai/${pegawaiUuid.value}/rekening`, { limit: 200 }))?.payload?.data ?? [];
};
const pilihPegawai = (v: string) => { pegawaiUuid.value = v ?? ""; muatPegawai(); };

// ── Pengesahan konfigurasi/profil/format dan verifikasi rekening (payload sama seperti versi awal).
const JUDUL_SAHKAN: Record<string, string> = { konfigurasi: "Sahkan Versi Konfigurasi", profil: "Sahkan Profil Penghitungan", rekening: "Verifikasi Rekening Pembayaran", "format-bank": "Sahkan Format Bank" };
const sahkanJenis = ref(""), sahkanBaris = ref<any>(null), dialogSahkan = ref(false);
const bukaSahkan = (jenis: string, r: any) => { sahkanJenis.value = jenis; sahkanBaris.value = r; dialogSahkan.value = true; };
const sahkan = async ({ alasan: bukti }: { alasan: string }) => {
  if (sibuk.value) return;
  const jenis = sahkanJenis.value, r = sahkanBaris.value;
  const aksi = jenis === "rekening" ? "verifikasi" : "sahkan";
  sibuk.value = true;
  try {
    if (await simpanGaji(`/${jenis}/${r.uuid}/${aksi}`, { hashKonfigurasi: r.hashKonfigurasi, buktiPengesahan: bukti, catatan: bukti })) { dialogSahkan.value = false; await muat(); }
  } finally { sibuk.value = false; }
};

// ── Rincian & uji kasus fiktif.
const rincian = ref<any>(null);
const dialogUji = ref(false), ujiBaris = ref<any>(null), ujiIsi = ref(""), hasilUji = ref<any>(null), galatUji = ref("");
const bukaUji = (r: any) => { ujiBaris.value = r; ujiIsi.value = ""; hasilUji.value = null; galatUji.value = ""; dialogUji.value = true; };
const uji = async () => {
  galatUji.value = ""; hasilUji.value = null;
  let parameter;
  try { parameter = JSON.parse(ujiIsi.value); } catch { galatUji.value = "Parameter JSON tidak sah"; return; }
  if (kunciBesar(parameter)) { galatUji.value = "Nama parameter wajib huruf kecil dengan garis bawah (snake_case)"; return; }
  sibuk.value = true;
  try { hasilUji.value = (await simpanGaji(`/konfigurasi/${ujiBaris.value.uuid}/uji`, { parameter }))?.payload ?? null; }
  finally { sibuk.value = false; }
};
const baris = (o: any) => Object.entries(kunciSnake(o ?? {}));
const awalDraf = (r: any) => ({ berlakuMulai: Number(r.berlakuMulai), berlakuSampai: r.berlakuSampai == null ? null : Number(r.berlakuSampai),
  aturan: jsonGaji(r.aturan), kebijakan: jsonGaji(r.kebijakan), kasusUji: jsonGaji(r.kasusUji), dasarAturan: r.dasarAturan });

const kelasLabel = "block font-semibold mb-[5px] text-normal";
const kelasArea = "w-full p-3 bg-white border rounded-lg border-grey-200 text-SM font-mono";
const kelasTombolSimpan = "h-10 px-4 font-semibold text-white rounded-[10px] bg-opensimrs-300 disabled:bg-grey-200 disabled:text-grey-400";
const kelasTab = (aktif: boolean) => ["px-4 py-2 -mb-px text-sm font-semibold border-b-2", aktif ? "border-opensimrs-300 text-opensimrs-300" : "border-transparent text-grey-400 hover:text-opensimrs-300"];
const kelasKode = "p-3 overflow-auto text-xs whitespace-pre-wrap rounded-lg bg-grey-50 max-h-80";
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" :disabled="memuat" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Konfigurasi Penggajian</h1>
          <FormulirData v-if="tab === 'konfigurasi'" judul="Versi Aturan dan Kebijakan Baru" label-tombol="Versi Konfigurasi Baru" path="/konfigurasi" lebar="860px" :boleh="izinGaji('konfigurasi', 'CREATE')" :kolom="kolomKonfigurasi"
            keterangan="Kasus uji harus menghasilkan ekspektasi yang sama persis sebelum versi dapat disimpan. Versi baru berstatus draf dan disahkan oleh pengguna lain." @tersimpan="muat" />
          <FormulirData v-if="tab === 'format'" judul="Format Bank Baru" label-tombol="Format Bank Baru" path="/format-bank" lebar="760px" :boleh="izinGaji('konfigurasi', 'CREATE')" :kolom="kolomFormat" @tersimpan="muat" />
        </PageToolbar>
      </template>

      <template #content>
        <div class="flex flex-col gap-4 pt-4">
          <nav class="flex flex-wrap gap-1 border-b border-grey-100" aria-label="Bagian konfigurasi penggajian">
            <button v-if="bolehKonfigurasi" type="button" :class="kelasTab(tab === 'konfigurasi')" @click="tab = 'konfigurasi'">Aturan dan kebijakan</button>
            <button type="button" :class="kelasTab(tab === 'pegawai')" @click="tab = 'pegawai'">Profil dan rekening pegawai</button>
            <button v-if="bolehKonfigurasi" type="button" :class="kelasTab(tab === 'format')" @click="tab = 'format'">Format bank</button>
          </nav>

          <template v-if="tab === 'konfigurasi'">
            <p class="px-3 py-2 text-xs rounded-lg bg-info-50 text-info-400">Bagian keuangan menetapkan rumus, tarif, pembulatan, tanggal acuan, dan kasus uji. Pengesah harus berbeda dari pembuat versi. Tidak ada tarif bawaan. Rekonsiliasi tahunan dan prorata belum didukung.</p>
            <NoData v-if="!konfigurasi.length" title="Belum ada versi konfigurasi" class="min-h-[240px]" />
            <DataTable v-else :value="konfigurasi" stripedRows class="text-xs" scrollable tableStyle="min-width: 56rem">
              <Column header="Versi" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span class="font-semibold">Versi {{ r.versi }}</span></template></Column>
              <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span :class="kelasLencanaGaji(r.status)">{{ labelGaji(r.status) }}</span></template></Column>
              <Column header="Masa berlaku" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ masaGaji(r) }}</template></Column>
              <Column header="Sumber ketentuan" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span class="line-clamp-2">{{ r.dasarAturan }}</span></template></Column>
              <Column header="Dibuat / disahkan" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ r.dibuatOleh || "-" }}<span v-if="r.disahkanOleh" class="text-grey-400"> / {{ r.disahkanOleh }}</span></template></Column>
              <Column header="Aksi" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">
                  <div class="flex flex-wrap gap-2">
                    <CustomButton label="Rincian" icon="PhEye" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="rincian = r" />
                    <CustomButton label="Uji kasus" icon="PhFlask" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaUji(r)" />
                    <FormulirData v-if="r.status === 'draf'" judul="Ubah Draf Konfigurasi" label-tombol="Ubah draf" ikon="PhPencilSimple" kecil garis ubah lebar="860px" :path="`/konfigurasi/${r.uuid}`" :boleh="izinGaji('konfigurasi', 'UPDATE')" :kolom="kolomKonfigurasi" :awal="awalDraf(r)" @tersimpan="muat" />
                    <CustomButton v-if="r.status === 'draf' && izinGaji('konfigurasi', 'SAHKAN')" label="Sahkan" icon="PhSealCheck" size="small" @click="bukaSahkan('konfigurasi', r)" />
                  </div>
                </template>
              </Column>
            </DataTable>
          </template>

          <template v-else-if="tab === 'pegawai'">
            <div class="flex flex-wrap items-end gap-2">
              <CustomTextfield v-model="cari" label="Cari pegawai SDM" prependIcon="PhMagnifyingGlass" placeholder="Nama pegawai" :maxLength="150" @keydown.enter="cariPegawai" />
              <CustomButton icon="PhMagnifyingGlass" label="Cari" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cariPegawai" />
              <CustomSelect :modelValue="pegawaiUuid" label="Pegawai SDM" placeHolder="Cari lalu pilih pegawai" class="min-w-[280px]" :options="opsiPegawai" optionValue="value" optionLabel="label" @update:modelValue="pilihPegawai" />
            </div>
            <NoData v-if="!pegawaiUuid" title="Pilih pegawai untuk melihat profil dan rekening" class="min-h-[200px]" />
            <template v-else>
              <section v-if="bolehKonfigurasi" class="p-4 border rounded-lg border-grey-75">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h2 class="font-semibold">Profil penghitungan · {{ pegawaiTerpilih?.nama }}</h2>
                  <FormulirData :key="`profil-${pegawaiUuid}`" judul="Profil Penghitungan Pegawai" label-tombol="Profil Baru" kecil :path="`/pegawai/${pegawaiUuid}/profil`" :boleh="izinGaji('konfigurasi', 'CREATE')" :kolom="kolomProfil" :tambahan="{ saldoAwalTahun: {} }"
                    keterangan="Saldo awal tahun dikirim kosong karena rekonsiliasi tahunan belum didukung." @tersimpan="muatPegawai" />
                </div>
                <NoData v-if="!profil.length" title="Belum ada profil penghitungan" class="min-h-[120px]" />
                <DataTable v-else :value="profil" stripedRows class="text-xs" scrollable tableStyle="min-width: 48rem">
                  <Column header="Masa berlaku" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ masaGaji(r) }}</template></Column>
                  <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span :class="kelasLencanaGaji(r.status)">{{ labelGaji(r.status) }}</span></template></Column>
                  <Column header="Parameter" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><div v-for="[k, v] in baris(r.parameter)" :key="k">{{ k }}: {{ v }}</div></template></Column>
                  <Column field="bukti" header="Dasar parameter" headerClass="bg-opensimrs-50" />
                  <Column header="Aksi" headerClass="bg-opensimrs-50">
                    <template #body="{ data: r }"><CustomButton v-if="r.status === 'draf' && izinGaji('konfigurasi', 'SAHKAN')" label="Sahkan" icon="PhSealCheck" size="small" @click="bukaSahkan('profil', r)" /></template>
                  </Column>
                </DataTable>
              </section>
              <section v-if="bolehRekening" class="p-4 border rounded-lg border-grey-75">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h2 class="font-semibold">Rekening pembayaran · {{ pegawaiTerpilih?.nama }}</h2>
                  <FormulirData :key="`rekening-${pegawaiUuid}`" judul="Rekening Pembayaran Pegawai" label-tombol="Rekening Baru" kecil :path="`/pegawai/${pegawaiUuid}/rekening`" :boleh="izinGaji('rekening', 'CREATE')" :kolom="kolomRekening" @tersimpan="muatPegawai" />
                </div>
                <NoData v-if="!rekening.length" title="Belum ada rekening pembayaran" class="min-h-[120px]" />
                <DataTable v-else :value="rekening" stripedRows class="text-xs" scrollable tableStyle="min-width: 48rem">
                  <Column field="kodeBank" header="Kode bank" headerClass="bg-opensimrs-50" />
                  <Column field="nomorRekening" header="Nomor rekening" headerClass="bg-opensimrs-50" />
                  <Column field="namaPemilik" header="Nama pemilik" headerClass="bg-opensimrs-50" />
                  <Column header="Masa berlaku" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ masaGaji(r) }}</template></Column>
                  <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span :class="kelasLencanaGaji(r.status)">{{ labelGaji(r.status) }}</span></template></Column>
                  <Column header="Aksi" headerClass="bg-opensimrs-50">
                    <template #body="{ data: r }"><CustomButton v-if="r.status === 'draf' && izinGaji('rekening', 'VERIFIKASI')" label="Verifikasi" icon="PhSealCheck" size="small" @click="bukaSahkan('rekening', r)" /></template>
                  </Column>
                </DataTable>
              </section>
            </template>
          </template>

          <template v-else>
            <NoData v-if="!format.length" title="Belum ada format bank" class="min-h-[240px]" />
            <DataTable v-else :value="format" stripedRows class="text-xs" scrollable tableStyle="min-width: 48rem">
              <Column header="Format" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span class="font-semibold">{{ r.kode }}</span> · versi {{ r.versi }}</template></Column>
              <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span :class="kelasLencanaGaji(r.status)">{{ labelGaji(r.status) }}</span></template></Column>
              <Column header="Spesifikasi" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">CSV · pemisah "{{ r.spesifikasi?.pemisah === '\t' ? 'tab' : r.spesifikasi?.pemisah }}" · desimal {{ r.spesifikasi?.desimal }} · {{ (r.spesifikasi?.kolom ?? []).join(", ") }}</template>
              </Column>
              <Column field="buktiSpesifikasi" header="Sumber" headerClass="bg-opensimrs-50" />
              <Column header="Aksi" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }"><CustomButton v-if="r.status === 'draf' && izinGaji('konfigurasi', 'SAHKAN')" label="Sahkan" icon="PhSealCheck" size="small" @click="bukaSahkan('format-bank', r)" /></template>
              </Column>
            </DataTable>
          </template>
        </div>
      </template>

      <template v-if="tab === 'konfigurasi'" #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :totalRecords="total" :rows="20" :rowsPerPageOptions="[20]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <KonfirmasiGaji
      v-model:visible="dialogSahkan"
      :judul="JUDUL_SAHKAN[sahkanJenis] ?? 'Pengesahan'"
      :pesan="sahkanJenis === 'rekening' ? 'Pastikan nomor dan nama pemilik rekening sudah dicocokkan dengan dokumen bank.' : 'Pengesahan dicatat atas nama Anda dan tidak dapat dibatalkan. Pengesah harus berbeda dari pembuat draf.'"
      :labelSetuju="sahkanJenis === 'rekening' ? 'Verifikasi' : 'Sahkan'"
      :sibuk="sibuk"
      :alasan="['konfigurasi', 'profil'].includes(sahkanJenis) ? { label: 'Bukti pengesahan keuangan', wajib: true } : { label: 'Catatan pemeriksaan (disimpan bersama hasil pemeriksaan)' }"
      @setuju="sahkan"
    />

    <CustomDialog :visible="!!rincian" width="860px" @update:visible="(v: boolean) => { if (!v) rincian = null; }">
      <template #header>Rincian Konfigurasi Versi {{ rincian?.versi }}</template>
      <template #body>
        <div v-if="rincian" class="flex flex-col gap-3 pt-4 text-sm">
          <div class="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
            <div><span class="text-grey-400">Status:</span> {{ labelGaji(rincian.status) }}</div>
            <div><span class="text-grey-400">Masa berlaku:</span> {{ masaGaji(rincian) }}</div>
            <div class="md:col-span-2"><span class="text-grey-400">Sumber ketentuan:</span> {{ rincian.dasarAturan }}</div>
            <div class="break-all md:col-span-2"><span class="text-grey-400">Sidik konfigurasi:</span> <code class="text-xs">{{ rincian.hashKonfigurasi }}</code></div>
            <div v-if="rincian.buktiPengesahan" class="md:col-span-2"><span class="text-grey-400">Bukti pengesahan:</span> {{ rincian.buktiPengesahan }}</div>
            <div v-if="rincian.catatanVerifikasi" class="md:col-span-2"><span class="text-grey-400">Catatan verifikasi:</span> {{ rincian.catatanVerifikasi }}</div>
            <div v-if="rincian.catatanPengesahan" class="md:col-span-2"><span class="text-grey-400">Catatan pengesahan:</span> {{ rincian.catatanPengesahan }}</div>
          </div>
          <details open><summary class="font-semibold cursor-pointer">Kebijakan</summary><pre :class="kelasKode">{{ jsonGaji(rincian.kebijakan) }}</pre></details>
          <details><summary class="font-semibold cursor-pointer">Aturan penghitungan</summary><pre :class="kelasKode">{{ jsonGaji(rincian.aturan) }}</pre></details>
          <details><summary class="font-semibold cursor-pointer">Kasus uji</summary><pre :class="kelasKode">{{ jsonGaji(rincian.kasusUji) }}</pre></details>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end"><CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="rincian = null" /></div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogUji" width="720px">
      <template #header>Uji Kasus Fiktif · Versi {{ ujiBaris?.versi }}</template>
      <template #body>
        <form id="form-uji-konfigurasi" class="flex flex-col gap-3 pt-4 text-sm" @submit.prevent="uji">
          <label class="flex flex-col">
            <span :class="kelasLabel">Parameter kasus fiktif (JSON)<span class="text-danger-300">*</span></span>
            <textarea v-model="ujiIsi" :class="kelasArea" rows="6" required spellcheck="false" placeholder='{ "bruto": "10000000.00", "kena_pajak": "10000000.00", "gaji_pokok": "6000000.00", "jaspel": "0.00", "ptkp": "54000000.00" }' />
          </label>
          <div v-if="galatUji" role="alert" class="px-3 py-2 rounded-lg bg-danger-50 text-danger-400">{{ galatUji }}</div>
          <div v-if="hasilUji" class="p-3 rounded-lg bg-success-50">
            <div class="mb-2 font-semibold text-success-400">Hasil penghitungan</div>
            <div v-for="[k, v] in baris(hasilUji.hasil)" :key="k" class="flex justify-between py-0.5 border-b border-grey-75"><span>{{ k }}</span><span class="font-semibold">{{ nominalGaji(v as string) }}</span></div>
          </div>
        </form>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogUji = false" />
          <button type="submit" form="form-uji-konfigurasi" :class="kelasTombolSimpan" :disabled="sibuk">Hitung</button>
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
