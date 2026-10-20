<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { ambilKehadiran, kirimKehadiran, simpanKehadiran, koreksiKehadiran, ubahJenisCuti, bolehKehadiran as boleh, bacaBerkas, unduhKehadiran } from "@/stores/penunjang/kehadiranCuti";

const route = useRoute();
const auth = useAuthStore();
const mode = computed(() => route.path.split("/").at(-1) ?? "saya");
const judul: Record<string, string> = { saya: "Kehadiran Saya", impor: "Impor Absensi", pengajuan: "Pengajuan Cuti/Izin", persetujuan: "Persetujuan Cuti/Izin", pengaturan: "Pengaturan Cuti", rekap: "Rekap Kehadiran" };
// Tanggal/periode operasional mengikuti kalender Asia/Jakarta (WIB); setelah dipilih di kalender, dibaca memakai komponen lokal seperti helper epoch lain di repo (mis. epochTanggal pada stores/penunjang/sarpras.ts).
const wibHariIni = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(new Date());
const keTanggal = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const tglStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const bulanStr = (d: Date) => tglStr(d).slice(0, 7);
const hariIniTanggal = () => keTanggal(wibHariIni());
const OPSI_FORMAT_WAKTU = [{ value: "wib", label: "YYYY-MM-DD HH:mm:ss WIB" }, { value: "epoch", label: "Epoch detik" }];
const OPSI_JENIS_ABSEN = [{ value: "masuk", label: "Masuk" }, { value: "pulang", label: "Pulang" }];
const sibuk = ref(false), pesan = ref(""), hasil = ref<any>(null), saldo = ref<any>(null), detail = ref<any>(null);
const jenis = ref<any[]>([]), pegawai = ref<any[]>([]), kebijakan = ref<any[]>([]), cakupan = ref<any>({ pegawai: [], lokasi: [], atasan: [], unit: [], aksi: [] });
const halaman = ref(1), total = ref(0);
const lokasi = ref(""), bulan = ref(hariIniTanggal()), pegawaiUuid = ref(""), unitUuid = ref("");
const unitRekap = computed(() => [...new Map(pegawai.value.filter((p) => p.unitUuid).map((p) => [p.unitUuid, { uuid: p.unitUuid, nama: p.namaUnit }])).values()]);
const pengajuan = ref({ jenisUuid: "", tanggalMulai: hariIniTanggal(), tanggalSelesai: hariIniTanggal(), alasan: "" });
const lampiran = ref<File | null>(null), berkasImpor = ref<File | null>(null), imporUuid = ref("");
const pemetaan = ref({ pegawai: "pegawai_uuid", waktu: "waktu", jenis: "jenis", kejadian: "" }), kodeMesin = ref(""), formatWaktu = ref("wib");
const catatan = ref(""), alasanBatal = ref("");
const jenisBaru = ref({ kode: "tahunan", nama: "Cuti tahunan", memotongSaldo: false, lampiranWajib: false, aktif: true });
const jenisDipilih = ref<any>(null);
const manualWaktuAwal = () => { const d = hariIniTanggal(); d.setHours(8, 0, 0, 0); return d; };
const manual = ref({ waktu: manualWaktuAwal(), jenis: "masuk", alasan: "" });
const jenisAwal = [{ kode: "tahunan", nama: "Cuti tahunan" }, { kode: "sakit", nama: "Izin sakit" }, { kode: "melahirkan", nama: "Cuti melahirkan" }, { kode: "alasan_penting", nama: "Izin alasan penting" }, { kode: "dinas_luar", nama: "Dinas luar" }];
const kebijakanBaru = ref({ tahun: Number(wibHariIni().slice(0, 4)), hakTahunan: 0, dasarHari: "kalender", batasCarryOver: 0, bulanKedaluwarsa: 12, batalSebelumSah: false, batalSetelahSah: false, batalSaatBerjalan: false, maksSesiJam: 24 });
const atasanBaru = ref({ kepegawaianUuid: "", atasanUuid: "", alasan: "" });
const unitBaru = ref({ username: "", unitUuid: "", aksi: "lihat_rekap", aktif: true, alasan: "" });
const koreksi = ref<any>(null), waktuKoreksi = ref<Date | null>(null), alasanKoreksi = ref("");
const penyesuaian = ref({ tahun: Number(wibHariIni().slice(0, 4)), jumlahHari: 0, alasan: "" });
let kunciAbsen = crypto.randomUUID(), kunciPengajuan = crypto.randomUUID();
let generasi = 0;
const inputLampiran = ref<HTMLInputElement | null>(null), inputImpor = ref<HTMLInputElement | null>(null);
const pilihBerkas = (event: Event, tujuan: "lampiran" | "impor") => {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  (event.target as HTMLInputElement).value = "";
  if (tujuan === "lampiran") lampiran.value = file; else berkasImpor.value = file;
};
const jalankan = async (fn: () => Promise<void>) => {
  if (sibuk.value) return;
  const putaran = generasi;
  sibuk.value = true; pesan.value = "";
  try { await fn(); } catch (e) { pesan.value = e instanceof Error ? e.message : "Proses gagal; muat ulang dan coba kembali"; }
  finally { if (putaran !== generasi) bersihkan(); sibuk.value = false; }
};
const muat = async () => {
  const putaran = generasi, m = mode.value;
  let r: any;
  if (m === "saya") r = await ambilKehadiran("/saya");
  if (["pengajuan", "persetujuan"].includes(m)) r = await ambilKehadiran("/pengajuan", { page: halaman.value });
  if (m === "rekap") {
    if (boleh("LIHAT REKAP")) r = await ambilKehadiran("/rekap", { bulan: bulanStr(bulan.value), pegawaiUuid: pegawaiUuid.value, unitUuid: unitUuid.value, page: halaman.value });
    const p = await ambilKehadiran("/pegawai", { aksi: boleh("LIHAT REKAP") ? "lihat_rekap" : boleh("KOREKSI") ? "koreksi" : "ekspor_rekap" });
    if (putaran === generasi) pegawai.value = p?.payload ?? [];
  }
  if (putaran !== generasi) return;
  hasil.value = r?.payload ?? null; total.value = r?.payload?.pagination?.total ?? 0;
  if (["pengajuan", "pengaturan"].includes(m)) {
    const j = await ambilKehadiran("/jenis-cuti");
    if (putaran !== generasi) return;
    jenis.value = j?.payload ?? [];
  }
  if (m === "pengaturan") {
    if (boleh("ATUR JENIS KEBIJAKAN")) {
      const p = await ambilKehadiran("/kebijakan");
      if (putaran !== generasi) return;
      kebijakan.value = p?.payload ?? [];
    }
    if (boleh("ATUR CAKUPAN")) {
      const c = await ambilKehadiran("/cakupan");
      if (putaran !== generasi) return;
      cakupan.value = c?.payload ?? cakupan.value;
    }
    if (boleh("SESUAIKAN SALDO")) {
      const p = await ambilKehadiran("/pegawai", { aksi: "sesuaikan_saldo" });
      if (putaran !== generasi) return;
      pegawai.value = p?.payload ?? [];
    }
  }
};
const absen = (jenis: string) => jalankan(async () => {
  const r = await kirimKehadiran("/absen", { jenis, catatanLokasi: lokasi.value, kunciIdempotensi: kunciAbsen });
  if (r) { kunciAbsen = crypto.randomUUID(); lokasi.value = ""; await muat(); }
});
const lihatSaldo = () => jalankan(async () => { saldo.value = (await ambilKehadiran("/saldo"))?.payload ?? null; });
const ajukan = () => jalankan(async () => {
  const lampiranUuid: string[] = [];
  if (lampiran.value) {
    const r = await kirimKehadiran("/lampiran", { tipe: lampiran.value.type, base64: await bacaBerkas(lampiran.value) });
    if (!r) return;
    lampiranUuid.push(r.payload.uuid);
  }
  const r = await kirimKehadiran("/pengajuan", { jenisUuid: pengajuan.value.jenisUuid, tanggalMulai: tglStr(pengajuan.value.tanggalMulai), tanggalSelesai: tglStr(pengajuan.value.tanggalSelesai), alasan: pengajuan.value.alasan, lampiranUuid, kunciIdempotensi: kunciPengajuan });
  if (r) { kunciPengajuan = crypto.randomUUID(); lampiran.value = null; pengajuan.value.alasan = ""; await muat(); }
});
const lihatDetail = (p: any) => jalankan(async () => { detail.value = (await ambilKehadiran(`/pengajuan/${p.uuid}`))?.payload ?? null; catatan.value = ""; alasanBatal.value = ""; });
const tutupDetail = () => { detail.value = null; };
const putuskan = (aksi: string, pembatalan = false) => jalankan(async () => {
  const p = detail.value;
  const r = await kirimKehadiran(`/pengajuan/${p.uuid}/${pembatalan ? "keputusan-pembatalan" : "keputusan"}`, { versi: p.versi, aksi, catatan: catatan.value });
  if (r) { detail.value = null; await muat(); }
});
const batalkan = () => jalankan(async () => {
  const p = detail.value;
  const r = await kirimKehadiran(`/pengajuan/${p.uuid}/pembatalan`, { versi: p.versi, alasan: alasanBatal.value, kunciIdempotensi: crypto.randomUUID() });
  if (r) { detail.value = null; await muat(); }
});
const pratinjau = () => jalankan(async () => {
  if (!berkasImpor.value) throw new Error("Pilih berkas terlebih dahulu");
  const r = await kirimKehadiran("/impor/pratinjau", { nama: berkasImpor.value.name, base64: await bacaBerkas(berkasImpor.value), kodeMesin: kodeMesin.value, formatWaktu: formatWaktu.value, pemetaan: pemetaan.value });
  if (r) { hasil.value = r.payload; imporUuid.value = r.payload.uuid; }
});
const prosesImpor = () => jalankan(async () => {
  const r = await kirimKehadiran(`/impor/${imporUuid.value}/proses`, { kunciIdempotensi: imporUuid.value });
  if (r) hasil.value = (await ambilKehadiran(`/impor/${imporUuid.value}`))?.payload;
});
const simpanJenis = () => jalankan(async () => {
  const r = jenisDipilih.value ? await ubahJenisCuti(jenisDipilih.value.uuid, { ...jenisBaru.value, versi: jenisDipilih.value.versi }) : await kirimKehadiran("/jenis-cuti", jenisBaru.value);
  if (r) { jenisDipilih.value = null; await muat(); }
});
const pilihJenis = (j: any) => { jenisDipilih.value = j; jenisBaru.value = { kode: j.kode, nama: j.nama, memotongSaldo: j.memotongSaldo, lampiranWajib: j.lampiranWajib, aktif: j.aktif }; };
const nonaktifkanJenis = (j: any) => jalankan(async () => { if (await ubahJenisCuti(j.uuid, { versi: j.versi, aktif: !j.aktif })) await muat(); });
const simpanKebijakan = () => jalankan(async () => { if (await simpanKehadiran("/kebijakan", kebijakanBaru.value)) await muat(); });
const simpanAtasan = () => jalankan(async () => { if (await simpanKehadiran("/cakupan", atasanBaru.value)) await muat(); });
const simpanUnit = () => jalankan(async () => { if (await simpanKehadiran("/cakupan", unitBaru.value)) await muat(); });
const sesuaikan = () => jalankan(async () => { if (await kirimKehadiran("/saldo/penyesuaian", { ...penyesuaian.value, pegawaiUuid: pegawaiUuid.value, kunciIdempotensi: crypto.randomUUID() })) pesan.value = "Penyesuaian saldo berhasil dicatat"; });
const ekspor = () => jalankan(async () => {
  const r = await kirimKehadiran("/rekap/ekspor", { bulan: bulanStr(bulan.value), pegawaiUuid: pegawaiUuid.value, unitUuid: unitUuid.value, format: "csv" });
  if (r) await unduhKehadiran(`/rekap/ekspor/${r.payload.uuid}`, `rekap-kehadiran-${bulanStr(bulan.value)}.csv`);
});
const lihatCatatan = (h: any) => jalankan(async () => {
  pegawaiUuid.value = h.pegawaiUuid;
  const b = bulanStr(bulan.value);
  const tanggalSelesai = new Date(Number(b.slice(0, 4)), Number(b.slice(5)), 0).getDate();
  koreksi.value = { items: (await ambilKehadiran("/kehadiran", { pegawaiUuid: h.pegawaiUuid, tanggalMulai: `${b}-01`, tanggalSelesai: `${b}-${tanggalSelesai}` }))?.payload ?? [], dipilih: null };
});
const pilihKoreksi = (c: any) => { koreksi.value.dipilih = c; waktuKoreksi.value = new Date(Number(c.waktu) * 1000); alasanKoreksi.value = ""; };
const simpanKoreksi = () => jalankan(async () => {
  const c = koreksi.value.dipilih;
  const r = await koreksiKehadiran(c.uuid, { versi: c.versi, perubahan: { waktu: Math.floor((waktuKoreksi.value as Date).getTime() / 1000), jenis: c.jenis }, alasan: alasanKoreksi.value });
  if (r) { koreksi.value = null; await muat(); }
});
const catatManual = () => jalankan(async () => {
  const r = await kirimKehadiran("/kehadiran/manual", { pegawaiUuid: pegawaiUuid.value, waktu: Math.floor(manual.value.waktu.getTime() / 1000), jenis: manual.value.jenis, alasan: manual.value.alasan });
  if (r) { manual.value.alasan = ""; await muat(); }
});
const waktu = (v: any) => new Date(Number(v) * 1000).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
const unduhLampiran = (l: any) => jalankan(() => unduhKehadiran(`/lampiran/${l.uuid}`, `lampiran.${l.tipe === "application/pdf" ? "pdf" : l.tipe === "image/png" ? "png" : "jpg"}`));
const bersihkan = () => { generasi++; hasil.value = null; saldo.value = null; detail.value = null; lampiran.value = null; berkasImpor.value = null; koreksi.value = null; lokasi.value = ""; jenis.value = []; pegawai.value = []; kebijakan.value = []; halaman.value = 1; imporUuid.value = ""; cakupan.value = { pegawai: [], lokasi: [], atasan: [], unit: [], aksi: [] }; pengajuan.value.alasan = ""; catatan.value = ""; alasanBatal.value = ""; };
watch(() => route.path, () => { bersihkan(); void jalankan(muat); }, { immediate: true });
watch(() => auth.faskesUuid, bersihkan);
onBeforeUnmount(bersihkan);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden" :aria-busy="sibuk">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="jalankan(muat)" />
          <h1 class="toolbar-heading text-opensimrs-300">{{ judul[mode] }}</h1>
          <template v-if="mode === 'rekap'">
            <CustomDatePicker v-model="bulan" label="Bulan" view="month" dateFormat="MM yy" />
            <CustomSelect v-model="unitUuid" label="Unit" placeHolder="Semua dalam cakupan" :options="unitRekap" optionValue="uuid" optionLabel="nama" />
            <CustomSelect v-model="pegawaiUuid" label="Pegawai" placeHolder="Semua dalam cakupan" :options="pegawai" optionValue="uuid" optionLabel="nama" />
            <CustomButton v-if="boleh('LIHAT REKAP')" icon="PhMagnifyingGlass" label="Tampilkan" @click="halaman = 1; jalankan(muat)" />
            <CustomButton v-if="boleh('EKSPOR REKAP')" icon="PhDownloadSimple" label="Ekspor CSV" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="ekspor" />
          </template>
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col gap-4 p-5 overflow-auto">
          <p v-if="pesan" role="status" class="p-3 text-sm rounded bg-warning-50 text-warning-300">{{ pesan }}</p>

          <template v-if="mode === 'saya'">
            <p class="text-sm text-grey-400">{{ hasil?.pegawai?.nama }} · Waktu mengikuti zona Asia/Jakarta (WIB).</p>
            <div v-if="boleh('ABSEN')" class="flex flex-wrap items-end gap-3 p-4 border rounded-lg border-grey-100">
              <CustomTextfield v-model="lokasi" label="Catatan lokasi (opsional)" :maxLength="500" class="grow" />
              <CustomButton label="Masuk" icon="PhSignIn" :loading="sibuk" @click="absen('masuk')" />
              <CustomButton label="Pulang" icon="PhSignOut" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :loading="sibuk" @click="absen('pulang')" />
            </div>
            <p class="text-xs text-grey-400">Klasifikasi jadwal belum tersedia karena Jadwal Dinas belum aktif.</p>
            <NoData v-if="!hasil?.catatan?.length" />
            <DataTable v-else :value="hasil.catatan" stripedRows class="text-xs" scrollable scrollHeight="flex">
              <Column header="Waktu WIB" headerClass="bg-opensimrs-50"><template #body="{ data: c }">{{ waktu(c.waktu) }}</template></Column>
              <Column field="jenis" header="Jenis" headerClass="bg-opensimrs-50" />
              <Column field="sumber" header="Sumber" headerClass="bg-opensimrs-50" />
            </DataTable>
          </template>

          <template v-if="mode === 'impor' && boleh('IMPOR')">
            <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-100">
              <p class="text-xs text-grey-400">Gunakan UUID pegawai Data Master yang tertaut ke SDM. Waktu Excel harus berupa teks WIB atau epoch detik; simpan formula sebagai nilai sebelum impor.</p>
              <div class="flex flex-wrap items-end gap-3">
                <input ref="inputImpor" type="file" accept=".csv,.xlsx" class="hidden" @change="pilihBerkas($event, 'impor')" />
                <CustomButton icon="PhUploadSimple" label="Pilih Berkas CSV/XLSX" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="inputImpor?.click()" />
                <span class="text-xs">{{ berkasImpor ? berkasImpor.name : "Maksimal 5 MB, 5.000 baris" }}</span>
                <CustomTextfield v-model="kodeMesin" label="Kode mesin" required :maxLength="100" />
                <CustomSelect v-model="formatWaktu" label="Format waktu" :options="OPSI_FORMAT_WAKTU" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
              </div>
              <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
                <CustomTextfield v-for="kolom in (['pegawai', 'waktu', 'jenis', 'kejadian'] as const)" :key="kolom" v-model="pemetaan[kolom]" :label="`Nama kolom ${kolom}${kolom === 'kejadian' ? ' (opsional)' : ''}`" :required="kolom !== 'kejadian'" :maxLength="100" />
              </div>
              <p class="text-xs text-grey-400">Jenis catatan harus "masuk" atau "pulang".</p>
              <div><CustomButton label="Buat pratinjau" :disabled="!berkasImpor" :loading="sibuk" @click="pratinjau" /></div>
            </div>
            <div v-if="hasil" class="flex flex-col gap-3 p-4 border rounded-lg border-grey-100">
              <p class="text-sm">Identitas impor: {{ imporUuid }}</p>
              <p class="text-sm">{{ hasil.ringkasan }}</p>
              <p class="text-xs text-grey-400">{{ hasil.zonaWaktu }}</p>
              <div v-if="imporUuid"><CustomButton label="Proses / lanjutkan impor" :loading="sibuk" @click="prosesImpor" /></div>
              <NoData v-if="!hasil.kesalahan?.length" title="Tidak ada baris gagal" />
              <DataTable v-else :value="hasil.kesalahan" stripedRows class="text-xs" scrollable scrollHeight="300px">
                <Column field="nomorBaris" header="Baris" headerClass="bg-opensimrs-50" class="w-20" />
                <Column field="pesan" header="Alasan gagal" headerClass="bg-opensimrs-50" />
              </DataTable>
            </div>
          </template>

          <template v-if="['pengajuan', 'persetujuan'].includes(mode)">
            <template v-if="mode === 'pengajuan'">
              <div class="flex items-center gap-3">
                <CustomButton label="Lihat saldo saya" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" size="small" :loading="sibuk" @click="lihatSaldo" />
                <p v-if="saldo" class="text-xs text-grey-400">Hak tahunan {{ saldo.hakTahunan }} · Carry-over berlaku {{ saldo.carryOverBerlaku }} · Pemakaian {{ saldo.pemakaian }} · Sisa {{ saldo.sisa }} · Reservasi {{ saldo.reservasi }} · Tersedia {{ saldo.tersedia }}</p>
              </div>
              <div v-if="boleh('AJUKAN')" class="flex flex-col gap-3 p-4 border rounded-lg border-grey-100">
                <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <CustomSelect v-model="pengajuan.jenisUuid" label="Jenis" placeHolder="Pilih jenis" :options="jenis.filter((j) => j.aktif)" optionValue="uuid" optionLabel="nama" required class="col-span-2" />
                  <CustomDatePicker v-model="pengajuan.tanggalMulai" label="Mulai" required />
                  <CustomDatePicker v-model="pengajuan.tanggalSelesai" label="Selesai" required />
                </div>
                <CustomTextArea v-model="pengajuan.alasan" label="Alasan" required />
                <div class="flex flex-wrap items-end gap-3">
                  <input ref="inputLampiran" type="file" accept="application/pdf,image/png,image/jpeg" class="hidden" @change="pilihBerkas($event, 'lampiran')" />
                  <CustomButton icon="PhPaperclip" label="Lampiran PDF/PNG/JPEG" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="inputLampiran?.click()" />
                  <span v-if="lampiran" class="text-xs">{{ lampiran.name }}</span>
                  <CustomButton label="Ajukan" icon="PhPaperPlaneTilt" :loading="sibuk" @click="ajukan" />
                </div>
              </div>
            </template>
            <p class="text-xs text-grey-400">Pengajuan yang tampil mengikuti kepemilikan, penugasan atasan, dan cakupan SDM.</p>
            <NoData v-if="!hasil?.items?.length" />
            <DataTable v-else :value="hasil.items" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" @rowClick="lihatDetail($event.data)">
              <Column field="nama" header="Pegawai" headerClass="bg-opensimrs-50" />
              <Column header="Periode" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ p.tanggalMulai }} — {{ p.tanggalSelesai }}</template></Column>
              <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ p.status }}{{ p.pembatalan ? " · pembatalan menunggu SDM" : "" }}</template></Column>
            </DataTable>
            <div v-if="total > 25" class="flex items-center justify-end gap-3">
              <CustomButton label="Sebelumnya" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="sibuk || halaman <= 1" @click="halaman--; jalankan(muat)" />
              <span class="text-xs text-grey-400">Halaman {{ halaman }} · {{ total }} data</span>
              <CustomButton label="Berikutnya" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="sibuk || halaman * 25 >= total" @click="halaman++; jalankan(muat)" />
            </div>

            <CustomDialog :visible="!!detail" width="700px" @update:visible="tutupDetail">
              <template #header>Detail pengajuan</template>
              <template #body>
                <div v-if="detail" class="flex flex-col gap-3 pt-2 text-sm">
                  <p>{{ detail.tanggalMulai }} — {{ detail.tanggalSelesai }} · {{ detail.status }}</p>
                  <p>{{ detail.alasan }}</p>
                  <div v-if="detail.lampiran?.length" class="flex flex-wrap gap-2">
                    <CustomButton v-for="l in detail.lampiran" :key="l.uuid" label="Unduh lampiran" icon="PhDownloadSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="sibuk" @click="unduhLampiran(l)" />
                  </div>
                  <ul class="flex flex-col gap-1 text-xs text-grey-400">
                    <li v-for="k in detail.keputusan" :key="k.uuid">{{ waktu(k.createdAt) }} · {{ k.aksi }} · {{ k.catatan }}</li>
                  </ul>
                  <template v-if="mode === 'persetujuan'">
                    <CustomTextArea v-model="catatan" label="Catatan (wajib untuk penolakan)" />
                    <div class="flex flex-wrap gap-2">
                      <CustomButton v-if="detail.status === 'menunggu_atasan' && boleh('TINJAU ATASAN')" label="Setujui sebagai atasan" size="small" :disabled="sibuk" @click="putuskan('setujui')" />
                      <CustomButton v-if="detail.status === 'menunggu_sdm' && boleh('SAHKAN SDM')" label="Sahkan sebagai SDM" size="small" :disabled="sibuk" @click="putuskan('sahkan')" />
                      <CustomButton v-if="['menunggu_atasan', 'menunggu_sdm'].includes(detail.status)" label="Tolak" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" :disabled="sibuk || !catatan.trim()" @click="putuskan('tolak')" />
                    </div>
                    <div v-if="detail.pembatalan && boleh('SAHKAN SDM')" class="flex flex-wrap gap-2">
                      <CustomButton label="Sahkan pembatalan" size="small" :disabled="sibuk" @click="putuskan('setujui', true)" />
                      <CustomButton label="Tolak pembatalan" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" :disabled="sibuk || !catatan.trim()" @click="putuskan('tolak', true)" />
                    </div>
                  </template>
                  <div v-if="mode === 'pengajuan' && boleh('BATALKAN') && ['menunggu_atasan', 'menunggu_sdm', 'sah'].includes(detail.status) && !detail.pembatalan" class="flex flex-col gap-2">
                    <CustomTextArea v-model="alasanBatal" label="Alasan pembatalan" required />
                    <div><CustomButton label="Minta pembatalan" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" :disabled="sibuk || !alasanBatal.trim()" @click="batalkan" /></div>
                  </div>
                </div>
              </template>
              <template #footer>
                <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="tutupDetail" />
              </template>
            </CustomDialog>
          </template>

          <template v-if="mode === 'pengaturan'">
            <template v-if="boleh('ATUR JENIS KEBIJAKAN')">
              <h2 class="font-semibold">Jenis cuti/izin</h2>
              <div class="flex flex-wrap gap-2">
                <CustomButton v-for="j in jenisAwal" :key="j.kode" :label="j.nama" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="jenisDipilih = null; jenisBaru.kode = j.kode; jenisBaru.nama = j.nama" />
              </div>
              <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-100">
                <div class="grid grid-cols-2 gap-3">
                  <CustomTextfield v-model="jenisBaru.kode" label="Kode" required :maxLength="50" />
                  <CustomTextfield v-model="jenisBaru.nama" label="Nama" required :maxLength="150" />
                </div>
                <div class="flex flex-wrap gap-6">
                  <CustomSwitch v-model="jenisBaru.memotongSaldo" label="Memotong saldo" />
                  <CustomSwitch v-model="jenisBaru.lampiranWajib" label="Lampiran wajib" />
                </div>
                <div><CustomButton :label="jenisDipilih ? 'Simpan perubahan jenis' : 'Tambah jenis'" :loading="sibuk" @click="simpanJenis" /></div>
              </div>
              <NoData v-if="!jenis.length" />
              <DataTable v-else :value="jenis" stripedRows class="text-xs cursor-pointer" @rowClick="pilihJenis($event.data)">
                <Column field="nama" header="Jenis" headerClass="bg-opensimrs-50" />
                <Column header="Potong saldo" headerClass="bg-opensimrs-50"><template #body="{ data: j }">{{ j.memotongSaldo ? "Ya" : "Tidak" }}</template></Column>
                <Column header="Lampiran wajib" headerClass="bg-opensimrs-50"><template #body="{ data: j }">{{ j.lampiranWajib ? "Ya" : "Tidak" }}</template></Column>
                <Column header="Status" headerClass="bg-opensimrs-50">
                  <template #body="{ data: j }"><CustomButton :label="j.aktif ? 'Nonaktifkan' : 'Aktifkan'" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="sibuk" @click.stop="nonaktifkanJenis(j)" /></template>
                </Column>
              </DataTable>

              <h2 class="font-semibold">Kebijakan tahunan</h2>
              <p class="text-xs text-grey-400">Hitungan memakai hari kalender, tanpa prorata. Nilai di bawah harus ditetapkan faskes. Versi baru tidak mengubah saldo dan pengajuan historis.</p>
              <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-100">
                <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <CustomInputNumber v-model="kebijakanBaru.tahun" label="Tahun" :min="2000" :max="2100" required />
                  <CustomInputNumber v-model="kebijakanBaru.hakTahunan" label="Hak tahunan (hari)" :min="0" :max="366" required />
                  <CustomInputNumber v-model="kebijakanBaru.batasCarryOver" label="Batas carry-over (hari)" :min="0" :max="366" required />
                  <CustomInputNumber v-model="kebijakanBaru.bulanKedaluwarsa" label="Bulan terakhir carry-over berlaku" :min="1" :max="12" required />
                  <CustomInputNumber v-model="kebijakanBaru.maksSesiJam" label="Batas sesi absen (jam)" :min="1" :max="48" required />
                </div>
                <div class="flex flex-wrap gap-6">
                  <CustomSwitch v-model="kebijakanBaru.batalSebelumSah" label="Boleh batal sebelum sah" />
                  <CustomSwitch v-model="kebijakanBaru.batalSetelahSah" label="Boleh minta pembatalan setelah sah (ditinjau SDM)" />
                  <CustomSwitch v-model="kebijakanBaru.batalSaatBerjalan" label="Boleh batal saat cuti berjalan" />
                </div>
                <div><CustomButton label="Simpan versi kebijakan" :loading="sibuk" @click="simpanKebijakan" /></div>
              </div>
              <NoData v-if="!kebijakan.length" title="Belum ada kebijakan" />
              <DataTable v-else :value="kebijakan" stripedRows class="text-xs">
                <Column field="tahun" header="Tahun" headerClass="bg-opensimrs-50" />
                <Column field="versi" header="Versi" headerClass="bg-opensimrs-50" />
                <Column header="Hak tahunan" headerClass="bg-opensimrs-50"><template #body="{ data: k }">{{ k.data.hakTahunan }} hari</template></Column>
                <Column header="Carry-over maksimal" headerClass="bg-opensimrs-50"><template #body="{ data: k }">{{ k.data.batasCarryOver }} hari</template></Column>
              </DataTable>
            </template>

            <template v-if="boleh('ATUR CAKUPAN')">
              <h2 class="font-semibold">Atasan dan cakupan unit</h2>
              <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-100">
                <div class="grid grid-cols-2 gap-3">
                  <CustomSelect v-model="atasanBaru.kepegawaianUuid" label="Pegawai" placeHolder="Pilih pegawai" :options="cakupan.pegawai" optionValue="uuid" optionLabel="nama" required />
                  <CustomSelect v-model="atasanBaru.atasanUuid" label="Atasan / pengganti" placeHolder="Pilih atasan" :options="cakupan.pegawai" optionValue="uuid" optionLabel="nama" required />
                </div>
                <CustomTextArea v-model="atasanBaru.alasan" label="Alasan" required />
                <div><CustomButton label="Tetapkan atasan" :loading="sibuk" @click="simpanAtasan" /></div>
              </div>
              <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-100">
                <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <CustomTextfield v-model="unitBaru.username" label="Nama akun" required :maxLength="120" />
                  <CustomSelect v-model="unitBaru.unitUuid" label="Unit" placeHolder="Pilih unit" :options="cakupan.lokasi" optionValue="uuid" optionLabel="nama" required />
                  <CustomSelect v-model="unitBaru.aksi" label="Aksi" :options="cakupan.aksi.map((a: string) => ({ value: a, label: a }))" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
                </div>
                <CustomSwitch v-model="unitBaru.aktif" label="Status" sideLabel="Dicabut" sideLabelTrue="Aktif" />
                <CustomTextArea v-model="unitBaru.alasan" label="Alasan" required />
                <div><CustomButton label="Simpan cakupan" :loading="sibuk" @click="simpanUnit" /></div>
              </div>
              <NoData v-if="!cakupan.unit.length" title="Belum ada cakupan unit" />
              <DataTable v-else :value="cakupan.unit" stripedRows class="text-xs">
                <Column field="username" header="Akun" headerClass="bg-opensimrs-50" />
                <Column header="Unit" headerClass="bg-opensimrs-50"><template #body="{ data: c }">{{ cakupan.lokasi.find((l: any) => l.uuid === c.unitUuid)?.nama }}</template></Column>
                <Column field="aksi" header="Aksi" headerClass="bg-opensimrs-50" />
              </DataTable>
            </template>

            <template v-if="boleh('SESUAIKAN SALDO')">
              <h2 class="font-semibold">Penyesuaian saldo</h2>
              <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-100">
                <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <CustomSelect v-model="pegawaiUuid" label="Pegawai" placeHolder="Pilih pegawai" :options="pegawai" optionValue="uuid" optionLabel="nama" required />
                  <CustomInputNumber v-model="penyesuaian.tahun" label="Tahun" :min="2000" :max="2100" required />
                  <CustomInputNumber v-model="penyesuaian.jumlahHari" label="Jumlah hari (negatif untuk pengurangan)" :min="-366" :max="366" required />
                </div>
                <CustomTextArea v-model="penyesuaian.alasan" label="Alasan" required />
                <div><CustomButton label="Catat penyesuaian" :loading="sibuk" @click="sesuaikan" /></div>
              </div>
            </template>
          </template>

          <template v-if="mode === 'rekap'">
            <p class="text-xs text-grey-400">Keterlambatan, pulang cepat, ketidakhadiran, dan lembur: tidak tersedia tanpa Jadwal Dinas.</p>
            <div v-if="boleh('KOREKSI')" class="flex flex-col gap-3 p-4 border rounded-lg border-grey-100">
              <h2 class="font-semibold">Catatan manual untuk pegawai terpilih</h2>
              <p class="text-xs text-grey-400">Pilih pegawai pada filter di atas sebelum menambah catatan.</p>
              <div><CustomButton label="Lihat catatan untuk koreksi" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="sibuk || !pegawaiUuid" @click="lihatCatatan({ pegawaiUuid })" /></div>
              <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
                <CustomDatePicker v-model="manual.waktu" label="Waktu WIB" showTime hourFormat="24" required />
                <CustomSelect v-model="manual.jenis" label="Jenis" :options="OPSI_JENIS_ABSEN" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
              </div>
              <CustomTextArea v-model="manual.alasan" label="Alasan" required />
              <div><CustomButton label="Tambah catatan manual" :disabled="sibuk || !pegawaiUuid" :loading="sibuk" @click="catatManual" /></div>
            </div>
            <NoData v-if="!hasil?.items?.length" />
            <DataTable v-else :value="hasil.items" stripedRows class="text-xs" scrollable scrollHeight="flex">
              <Column field="nama" header="Pegawai" headerClass="bg-opensimrs-50" />
              <Column field="hariKehadiran" header="Hari kehadiran" headerClass="bg-opensimrs-50" />
              <Column field="pasanganTidakLengkap" header="Pasangan tidak lengkap" headerClass="bg-opensimrs-50" />
              <Column field="cutiSah" header="Cuti/izin sah" headerClass="bg-opensimrs-50" />
              <Column v-if="boleh('KOREKSI')" header="" headerClass="bg-opensimrs-50">
                <template #body="{ data: h }"><CustomButton label="Koreksi" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="sibuk" @click="lihatCatatan(h)" /></template>
              </Column>
            </DataTable>
            <div class="flex items-center justify-end gap-3">
              <CustomButton label="Sebelumnya" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="sibuk || halaman <= 1" @click="halaman--; jalankan(muat)" />
              <span class="text-xs text-grey-400">Halaman {{ halaman }} · {{ total }} data</span>
              <CustomButton label="Berikutnya" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="sibuk || halaman * 25 >= total" @click="halaman++; jalankan(muat)" />
            </div>

            <CustomDialog :visible="!!koreksi" width="640px" @update:visible="koreksi = null">
              <template #header>Koreksi kehadiran</template>
              <template #body>
                <div v-if="koreksi" class="flex flex-col gap-3 pt-2">
                  <div class="flex flex-wrap gap-2">
                    <CustomButton v-for="c in koreksi.items" :key="c.uuid" :label="`${waktu(c.waktu)} · ${c.jenis}`" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="pilihKoreksi(c)" />
                  </div>
                  <div v-if="koreksi.dipilih" class="flex flex-col gap-3">
                    <div class="grid grid-cols-2 gap-3">
                      <CustomDatePicker v-model="waktuKoreksi" label="Waktu WIB" showTime hourFormat="24" required />
                      <CustomSelect v-model="koreksi.dipilih.jenis" label="Jenis" :options="OPSI_JENIS_ABSEN" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
                    </div>
                    <CustomTextArea v-model="alasanKoreksi" label="Alasan" required />
                    <div><CustomButton label="Simpan koreksi" :loading="sibuk" @click="simpanKoreksi" /></div>
                  </div>
                </div>
              </template>
              <template #footer>
                <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="koreksi = null" />
              </template>
            </CustomDialog>
          </template>
        </div>
      </template>
    </Card>
  </div>
</template>
