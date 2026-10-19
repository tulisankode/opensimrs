<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  SINGKAT_JENIS,
  bacaBerkas,
  cekKunciIkp,
  detailLaporanIkp,
  epochWib,
  gayaStatusIkp,
  izinIkp,
  kunciIdempotensi,
  laporIkp,
  laporanSayaIkp,
  referensiIkp,
  tanggalWib,
  ubahLaporanIkp,
  ukuranBerkas,
  unggahLampiranIkp,
  waktuIkp,
} from "@/stores/penunjang/mutu";

// Lapor Insiden Keselamatan Pasien (STD-0026): semua petugas berizin LAPOR. Waktu kejadian diisi sebagai jam WIB.
// Identitas pelapor dapat dirahasiakan (anonim) — tidak ditampilkan ke peninjau mana pun; pelapor tetap melihat
// laporannya di "Laporan Saya". Rujukan pasien (No. Registrasi) hanya untuk pemegang izin LIHAT PASIEN. Kunci
// idempotensi dibuat saat formulir dibuka agar pengiriman ulang setelah gangguan jaringan tidak membuat laporan ganda.
const storeUtils = utilsStore();
const referensi = ref<any>({ jenisInsiden: [], kategoriInsiden: [], akibat: [], layanan: [], tindakanOleh: [], unit: [], pengaturan: {} });
const opsiUnit = computed(() => (referensi.value.unit ?? []).map((u: any) => ({ value: u.uuid, label: u.nama })));
const opsiDari = (daftar: any[]) => (daftar ?? []).map((x: any) => ({ value: x.kode, label: x.nama }));
const jamTenggat = computed(() => referensi.value.pengaturan?.tenggatLaporJam ?? 48);

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const muat = async () => {
  const res = await laporanSayaIkp({ page: page.value, limit: limit.value });
  data.value = res?.payload?.data ?? [];
  total.value = res?.payload?.pagination?.total ?? 0;
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

const dialog = ref(false);
const form = ref<any>({});
const berkas = ref<File[]>([]);
const galat = ref("");
const belumPasti = ref(false);
const kosong = () => ({
  uuid: null,
  jenisInsiden: "",
  kategoriInsiden: "",
  layanan: "",
  unitUuid: "",
  tempatKejadian: "",
  waktuKejadian: new Date(),
  waktuDiketahui: null,
  kronologi: "",
  tindakanSegera: "",
  tindakanOleh: "",
  akibat: "",
  pernahTerjadi: false,
  keteranganPernahTerjadi: "",
  anonim: false,
  pelaporNama: "",
  noReg: "",
  idempotencyKey: kunciIdempotensi(),
});
const bukaBaru = () => {
  galat.value = "";
  belumPasti.value = false;
  berkas.value = [];
  form.value = kosong();
  dialog.value = true;
};
const bukaUbah = async (d: any) => {
  if (!["dilaporkan", "perlu_dilengkapi"].includes(d.status)) return;
  const res = await detailLaporanIkp(d.uuid);
  const p = res?.payload;
  if (!p) return;
  galat.value = "";
  belumPasti.value = false;
  berkas.value = [];
  form.value = {
    ...kosong(),
    ...p,
    kategoriInsiden: p.kategoriInsiden ?? "",
    layanan: p.layanan ?? "",
    tindakanOleh: p.tindakanOleh ?? "",
    akibat: p.akibat ?? "",
    tempatKejadian: p.tempatKejadian ?? "",
    tindakanSegera: p.tindakanSegera ?? "",
    keteranganPernahTerjadi: p.keteranganPernahTerjadi ?? "",
    pernahTerjadi: !!p.pernahTerjadi,
    waktuKejadian: tanggalWib(p.waktuKejadian),
    waktuDiketahui: tanggalWib(p.waktuDiketahui),
    lampiranAda: p.lampiran?.length ?? 0,
  };
  dialog.value = true;
};
const MAKS_MB = 10;
const pilihBerkas = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const daftar = Array.from(input.files ?? []);
  input.value = "";
  for (const f of daftar) {
    if (!["application/pdf", "image/jpeg", "image/png"].includes(f.type)) return (galat.value = "Lampiran harus PDF/JPG/PNG");
    if (f.size > MAKS_MB * 1024 * 1024) return (galat.value = `Ukuran lampiran maksimal ${MAKS_MB} MB`);
  }
  galat.value = "";
  berkas.value = [...berkas.value, ...daftar].slice(0, 5 - (form.value.lampiranAda ?? 0));
};
const isian = () => {
  const f = form.value;
  return {
    jenisInsiden: f.jenisInsiden,
    kategoriInsiden: f.kategoriInsiden || null,
    layanan: f.layanan || null,
    unitUuid: f.unitUuid,
    tempatKejadian: f.tempatKejadian.trim(),
    waktuKejadian: epochWib(f.waktuKejadian),
    waktuDiketahui: epochWib(f.waktuDiketahui) ?? null,
    kronologi: f.kronologi.trim(),
    tindakanSegera: f.tindakanSegera.trim(),
    tindakanOleh: f.tindakanOleh || null,
    akibat: f.akibat || null,
    pernahTerjadi: f.pernahTerjadi,
    keteranganPernahTerjadi: f.pernahTerjadi ? f.keteranganPernahTerjadi.trim() : null,
  };
};
const unggahSemua = async (uuid: string) => {
  for (const b of berkas.value) await unggahLampiranIkp(uuid, await bacaBerkas(b));
};
const kirim = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.jenisInsiden || !f.unitUuid || !f.waktuKejadian || !f.kronologi.trim()) return (galat.value = "Jenis insiden, unit, waktu kejadian, dan kronologi wajib diisi");
  if (f.waktuDiketahui && f.waktuDiketahui < f.waktuKejadian) return (galat.value = "Waktu diketahui tidak boleh sebelum waktu kejadian");
  storeUtils.setLoading(true);
  try {
    if (f.uuid) {
      const res = await ubahLaporanIkp(f.uuid, isian());
      if (res) {
        await unggahSemua(f.uuid);
        dialog.value = false;
        muat();
      }
      return;
    }
    const isi: Record<string, any> = { ...isian(), anonim: f.anonim, idempotencyKey: f.idempotencyKey };
    if (!f.anonim && f.pelaporNama.trim()) isi.pelaporNama = f.pelaporNama.trim();
    if (izinIkp("LIHAT PASIEN") && f.noReg.trim()) isi.noReg = f.noReg.trim();
    const res = await laporIkp(isi);
    if (!res?.payload?.uuid) {
      // Hasil belum pasti (galat jaringan/server): kunci yang sama dipakai saat kirim ulang → tidak ganda (KT-19).
      belumPasti.value = true;
      return;
    }
    await unggahSemua(res.payload.uuid);
    dialog.value = false;
    muat();
  } finally {
    storeUtils.setLoading(false);
  }
};
const cekStatus = async () => {
  const res = await cekKunciIkp(form.value.idempotencyKey);
  if (res?.payload?.tersimpan) {
    galat.value = "";
    belumPasti.value = false;
    await unggahSemua(res.payload.uuid);
    dialog.value = false;
    muat();
  } else if (res) galat.value = "Laporan belum tersimpan. Silakan kirim ulang (tidak akan tercatat ganda).";
};

onMounted(async () => {
  const r = await referensiIkp();
  if (r?.payload) referensi.value = r.payload;
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Laporan Insiden Saya</h1>
          <CustomButton icon="PhWarningCircle" label="Laporkan Insiden" @click="bukaBaru" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="px-1 pb-3 text-xs text-grey-400">
          Laporkan setiap insiden keselamatan pasien (KTD, KNC, KTC, KPC, sentinel) kepada atasan langsung paling lambat {{ jamTenggat }} jam sejak insiden diketahui.
          Laporan IKP bukan bagian rekam medis dan tidak digunakan untuk menyalahkan individu.
        </div>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 56rem" @rowClick="bukaUbah($event.data)">
          <Column field="nomor" header="Nomor" headerClass="bg-opensimrs-50" />
          <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ SINGKAT_JENIS[d.jenisInsiden] ?? d.jenisInsiden }}</template></Column>
          <Column header="Waktu Kejadian" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuIkp(d.waktuKejadian) }}</template></Column>
          <Column field="unitNama" header="Unit" headerClass="bg-opensimrs-50" />
          <Column header="Pelapor" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.anonim ? "Anonim" : "Tercatat" }}</template></Column>
          <Column header="Ketepatan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><span :class="d.terlambatLapor ? 'text-danger-300' : 'text-[#027A48]'">{{ d.terlambatLapor ? "Terlambat" : "Tepat waktu" }}</span></template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaStatusIkp(d.status).bg, gayaStatusIkp(d.status).text]">{{ gayaStatusIkp(d.status).label }}</span>
              <div v-if="d.status === 'perlu_dilengkapi'" class="mt-1 text-[#C4320A]">{{ d.alasanPerluLengkap }} — klik untuk melengkapi</div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="880px">
      <template #header>{{ form.uuid ? `Lengkapi Laporan ${form.nomor}` : "Laporkan Insiden Keselamatan Pasien" }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="form.jenisInsiden" label="Jenis Insiden" :options="opsiDari(referensi.jenisInsiden)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomSelect v-model="form.kategoriInsiden" label="Kelompok Insiden" :options="opsiDari(referensi.kategoriInsiden)" optionValue="value" optionLabel="label" :showFilter="false" />
          <CustomDatePicker v-model="form.waktuKejadian" label="Waktu Kejadian (WIB)" showTime :maxDate="new Date()" required />
          <CustomDatePicker v-model="form.waktuDiketahui" label="Waktu Insiden Diketahui (WIB, kosong = sama)" showTime :maxDate="new Date()" />
          <CustomSelect v-model="form.unitUuid" label="Unit Terkait" :options="opsiUnit" optionValue="value" optionLabel="label" :clearable="false" required />
          <CustomTextfield v-model="form.tempatKejadian" label="Tempat Kejadian" placeholder="mis. Bed 3, kamar mandi" :maxLength="255" />
          <CustomSelect v-model="form.layanan" label="Layanan" :options="opsiDari(referensi.layanan)" optionValue="value" optionLabel="label" :showFilter="false" />
          <CustomSelect v-model="form.akibat" label="Akibat bagi Pasien" :options="opsiDari(referensi.akibat)" optionValue="value" optionLabel="label" :showFilter="false" />
          <CustomTextArea v-model="form.kronologi" label="Kronologi Insiden" placeholder="Apa yang terjadi, urutan kejadian (tanpa menyalahkan individu)" class="col-span-2" required />
          <CustomTextArea v-model="form.tindakanSegera" label="Tindakan Segera yang Dilakukan" class="col-span-2" />
          <CustomSelect v-model="form.tindakanOleh" label="Tindakan Dilakukan oleh" :options="opsiDari(referensi.tindakanOleh)" optionValue="value" optionLabel="label" :showFilter="false" />
          <label class="flex items-center gap-2 text-sm"><Checkbox v-model="form.pernahTerjadi" binary /> Insiden serupa pernah terjadi di unit lain</label>
          <CustomTextArea v-if="form.pernahTerjadi" v-model="form.keteranganPernahTerjadi" label="Keterangan (kapan, langkah yang diambil)" class="col-span-2" />
          <template v-if="!form.uuid">
            <div class="col-span-2 p-3 border rounded-lg border-grey-75">
              <label class="flex items-center gap-2 text-sm font-semibold"><Checkbox v-model="form.anonim" binary /> Rahasiakan identitas saya (anonim)</label>
              <div class="mt-1 text-xs text-grey-400">
                Identitas pelapor anonim tidak ditampilkan kepada kepala unit, Tim KP, maupun di rekap. Pilihan ini tidak dapat diubah setelah laporan dikirim.
              </div>
              <CustomTextfield v-if="!form.anonim" v-model="form.pelaporNama" label="Nama Pelapor (opsional)" class="mt-2" :maxLength="255" />
            </div>
            <CustomTextfield v-if="izinIkp('LIHAT PASIEN')" v-model="form.noReg" label="No. Registrasi Kunjungan Pasien (opsional)" :maxLength="100" />
          </template>
          <div class="col-span-2">
            <label v-if="(form.lampiranAda ?? 0) + berkas.length < 5" class="text-sm cursor-pointer text-opensimrs-300">
              + Lampiran (opsional) — PDF/JPG/PNG maks. {{ MAKS_MB }} MB, maks. 5 berkas
              <input type="file" class="hidden" multiple accept="application/pdf,image/jpeg,image/png" @change="pilihBerkas" />
            </label>
            <div v-for="(b, i) in berkas" :key="i" class="text-xs">
              {{ b.name }} ({{ ukuranBerkas(b.size) }}) <a class="cursor-pointer text-danger-300" @click="berkas.splice(i, 1)">hapus</a>
            </div>
          </div>
        </div>
        <div v-if="belumPasti" class="p-3 mt-3 text-sm rounded-lg bg-[#FEF0C7] text-[#B54708]">
          Pengiriman belum terkonfirmasi. Periksa status terlebih dahulu; bila belum tersimpan, kirim ulang — laporan tidak akan tercatat ganda.
          <CustomButton label="Cek Status" class="mt-2" outlined borderColor="border-[#B54708]" textColor="text-[#B54708]" @click="cekStatus" />
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton :label="form.uuid ? 'Simpan' : belumPasti ? 'Kirim Ulang' : 'Kirim Laporan'" icon="PhPaperPlaneRight" @click="kirim" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
