<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { generateQRCode } from "@/utils/Helpers";
import {
  FREKUENSI,
  KATEGORI_ASET,
  STATUS_ASET,
  daftarAset,
  detailAset,
  gayaStatusAset,
  gayaStatusLaporan,
  izinSarpras,
  opsi,
  pindahLokasiAset,
  referensiSarpras,
  riwayatAset,
  rupiahSarpras,
  simpanAset,
  tanggalSarpras,
  ubahStatusAset,
  waktuSarpras,
} from "@/stores/penunjang/sarpras";

// Register aset (KF-4–KF-7): daftar + filter, tambah/ubah (kode inventaris unik per faskes), pindah lokasi, ubah status,
// label QR (isi = URL halaman ini dengan ?buka=<uuid>; membukanya tetap butuh login & izin), dan riwayat per aset.
const storeUtils = utilsStore();
const route = useRoute();
const router = useRouter();
const boleh = (aksi: string) => izinSarpras("Aset", aksi);

const referensi = ref<any>({ lokasi: [], pegawai: [] });
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterKategori = ref("");
const filterStatus = ref("");
const filterLokasi = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarAset({ page: page.value, limit: limit.value, cari: cari.value.trim(), kategori: filterKategori.value, status: filterStatus.value, lokasiUuid: filterLokasi.value });
    data.value = res?.payload?.data ?? [];
    total.value = res?.payload?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};
const cariData = () => {
  page.value = 1;
  muat();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

// ── Form aset (baru / ubah)
const dialog = ref(false);
const kosong = () => ({
  uuid: "",
  kodeInventaris: "",
  kategori: "alat_medis",
  nama: "",
  lokasiUuid: "",
  merek: "",
  tipe: "",
  nomorSeri: "",
  tahunPerolehan: "",
  nilaiPerolehan: "",
  penanggungJawabUuid: "",
  wajibKalibrasi: false,
  keterangan: "",
});
const form = ref<any>(kosong());
const galat = ref("");
const buka = (baris?: any) => {
  galat.value = "";
  form.value = baris
    ? {
        ...kosong(),
        ...Object.fromEntries(Object.entries(baris).map(([k, v]) => [k, v ?? ""])),
        tahunPerolehan: baris.tahunPerolehan ? String(baris.tahunPerolehan) : "",
        nilaiPerolehan: baris.nilaiPerolehan !== null && baris.nilaiPerolehan !== undefined ? String(Number(baris.nilaiPerolehan)) : "",
        wajibKalibrasi: !!baris.wajibKalibrasi,
      }
    : kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.kodeInventaris.trim() || !f.nama.trim() || !f.kategori || (!f.uuid && !f.lokasiUuid)) return (galat.value = "Kode inventaris, nama, kategori, dan lokasi wajib diisi");
  storeUtils.setLoading(true);
  try {
    const isi: Record<string, any> = {
      kodeInventaris: f.kodeInventaris.trim(),
      kategori: f.kategori,
      nama: f.nama.trim(),
      merek: f.merek,
      tipe: f.tipe,
      nomorSeri: f.nomorSeri,
      tahunPerolehan: f.tahunPerolehan || null,
      nilaiPerolehan: f.nilaiPerolehan === "" ? null : f.nilaiPerolehan,
      penanggungJawabUuid: f.penanggungJawabUuid || null,
      wajibKalibrasi: f.wajibKalibrasi,
      keterangan: f.keterangan,
    };
    if (!f.uuid) isi.lokasiUuid = f.lokasiUuid;
    const res = await simpanAset(isi, f.uuid || undefined);
    if (res) {
      dialog.value = false;
      muat();
      if (detail.value?.uuid === f.uuid) bukaDetail(f.uuid);
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Detail, riwayat, pindah lokasi, ubah status
const dialogDetail = ref(false);
const detail = ref<any>(null);
const tabDetail = ref("info");
const riwayat = ref<any[]>([]);
const bukaDetail = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const [d, r] = await Promise.all([detailAset(uuid), riwayatAset(uuid, { limit: 100 })]);
    if (d?.payload) {
      detail.value = d.payload;
      riwayat.value = r?.payload?.data ?? [];
      dialogDetail.value = true;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const JENIS_PERISTIWA: Record<string, string> = {
  dibuat: "Aset dicatat",
  diubah: "Data diubah",
  dipindah: "Pindah lokasi",
  status_diubah: "Status diubah",
  kerusakan_dilaporkan: "Kerusakan dilaporkan",
  kerusakan_ditugaskan: "Teknisi ditugaskan",
  status_kerusakan_diubah: "Status perbaikan diubah",
  kerusakan_selesai: "Laporan kerusakan ditutup",
  jadwal_pemeliharaan_dibuat: "Jadwal pemeliharaan dibuat",
  jadwal_pemeliharaan_diubah: "Jadwal pemeliharaan diubah",
  jadwal_pemeliharaan_dinonaktifkan: "Jadwal pemeliharaan dinonaktifkan",
  pemeliharaan_dilaksanakan: "Pemeliharaan dilaksanakan",
  kalibrasi_dijadwalkan: "Kalibrasi dijadwalkan",
  jadwal_kalibrasi_diubah: "Jadwal kalibrasi diubah",
  kalibrasi_dicatat: "Kalibrasi dicatat",
};
const ringkasPerubahan = (d: any) => {
  if (!d) return "";
  return Object.entries(d)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join("; ");
};
const namaLokasi = (uuid?: string) => referensi.value.lokasi.find((l: any) => l.uuid === uuid)?.nama ?? uuid ?? "-";

const lokasiBaru = ref("");
const catatanPindah = ref("");
const pindah = async () => {
  if (!detail.value || !lokasiBaru.value) return;
  const res = await pindahLokasiAset(detail.value.uuid, lokasiBaru.value, catatanPindah.value.trim() || undefined);
  if (res) {
    lokasiBaru.value = "";
    catatanPindah.value = "";
    await bukaDetail(detail.value.uuid);
    muat();
  }
};
const statusBaru = ref("");
const alasanStatus = ref("");
const galatStatus = ref("");
const ubahStatus = async () => {
  galatStatus.value = "";
  if (!detail.value || !statusBaru.value) return;
  if (statusBaru.value === "dihapuskan" && !alasanStatus.value.trim()) return (galatStatus.value = "Alasan wajib diisi untuk penghapusan aset");
  const res = await ubahStatusAset(detail.value.uuid, statusBaru.value, alasanStatus.value.trim() || undefined);
  if (res) {
    statusBaru.value = "";
    alasanStatus.value = "";
    await bukaDetail(detail.value.uuid);
    muat();
  }
};

// ── Label QR (KF-7/KT-6)
const cetakQr = async (aset: any) => {
  const url = `${window.location.origin}/sarpras/aset?buka=${aset.uuid}`;
  const gambar = await generateQRCode(url);
  const w = window.open("", "_blank", "width=420,height=520");
  if (!w) return;
  const aman = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
  w.document.write(`<!doctype html><html><head><title>Label ${aman(aset.kodeInventaris)}</title>
    <style>body{font-family:sans-serif;text-align:center;margin:16px}img{width:220px;height:220px}.k{font-size:18px;font-weight:bold}.n{font-size:13px}</style></head>
    <body><img src="${gambar}" alt="QR"/><div class="k">${aman(aset.kodeInventaris)}</div><div class="n">${aman(aset.nama)}</div>
    <div class="n">${aman(aset.namaLokasi)}</div><script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
};

// Pemindaian QR: /sarpras/aset?buka=<uuid> membuka detail aset (tetap lewat izin & faskes di backend).
const bukaDariQuery = () => {
  const uuid = route.query.buka;
  if (typeof uuid === "string" && uuid) {
    bukaDetail(uuid);
    router.replace({ query: {} });
  }
};
watch(() => route.query.buka, bukaDariQuery);

onMounted(async () => {
  const r = await referensiSarpras();
  if (r?.payload) referensi.value = r.payload;
  muat();
  bukaDariQuery();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Register Aset</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Kode / nama / no. seri" :maxLength="100" @keydown.enter="cariData" />
          <CustomSelect v-model="filterKategori" label="Kategori" placeHolder="Semua" :options="opsi(KATEGORI_ASET)" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="filterStatus" label="Status" placeHolder="Semua" :options="opsi(STATUS_ASET)" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="filterLokasi" label="Lokasi" placeHolder="Semua" :options="referensi.lokasi" optionValue="uuid" optionLabel="nama" @update:modelValue="cariData" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Aset" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 60rem" @rowClick="bukaDetail($event.data.uuid)">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ (page - 1) * limit + index + 1 }}</template>
          </Column>
          <Column field="kodeInventaris" header="Kode Inventaris" headerClass="bg-opensimrs-50" />
          <Column field="nama" header="Nama Aset" headerClass="bg-opensimrs-50" />
          <Column header="Kategori" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ KATEGORI_ASET[d.kategori] ?? d.kategori }}</template>
          </Column>
          <Column field="namaLokasi" header="Lokasi" headerClass="bg-opensimrs-50" />
          <Column header="Merek / Tipe" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ [d.merek, d.tipe].filter(Boolean).join(" / ") || "-" }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaStatusAset(d.status).bg, gayaStatusAset(d.status).text]">{{ gayaStatusAset(d.status).label }}</span>
              <span v-if="d.wajibKalibrasi" class="ml-1 text-[10px] text-grey-400">wajib kalibrasi</span>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[100px]">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton v-if="boleh('UPDATE') && d.status !== 'dihapuskan'" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click.stop="buka(d)" />
                <CustomButton v-if="boleh('CETAK QR')" icon="PhQrCode" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click.stop="cetakQr(d)" />
              </div>
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

    <CustomDialog v-model:visible="dialog" width="760px">
      <template #header>{{ form.uuid ? "Ubah" : "Tambah" }} Aset</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.kodeInventaris" label="Kode Inventaris" placeholder="mis. ALM-2026-001" required :maxLength="50" />
          <CustomSelect v-model="form.kategori" label="Kategori" :options="opsi(KATEGORI_ASET)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomTextfield v-model="form.nama" label="Nama Aset" placeholder="mis. Syringe Pump" class="col-span-2" required :maxLength="255" />
          <CustomSelect v-if="!form.uuid" v-model="form.lokasiUuid" label="Lokasi" :options="referensi.lokasi" optionValue="uuid" optionLabel="nama" required />
          <div v-else class="text-sm">
            <div class="text-grey-400">Lokasi</div>
            <div>{{ form.namaLokasi || namaLokasi(form.lokasiUuid) }} <span class="text-xs text-grey-400">(ubah lewat Pindah Lokasi)</span></div>
          </div>
          <CustomSelect v-model="form.penanggungJawabUuid" label="Penanggung Jawab (opsional)" :options="referensi.pegawai" optionValue="uuid" optionLabel="nama" />
          <CustomTextfield v-model="form.merek" label="Merek" :maxLength="100" />
          <CustomTextfield v-model="form.tipe" label="Tipe" :maxLength="100" />
          <CustomTextfield v-model="form.nomorSeri" label="Nomor Seri" :maxLength="100" />
          <CustomTextfield v-model="form.tahunPerolehan" label="Tahun Perolehan" type="number" :maxLength="4" />
          <CustomTextfield v-model="form.nilaiPerolehan" label="Nilai Perolehan (Rp)" type="number" :maxLength="16" />
          <CustomSwitch v-model="form.wajibKalibrasi" label="Wajib Kalibrasi" sideLabel="Tidak" sideLabelTrue="Ya" />
          <CustomTextArea v-model="form.keterangan" label="Keterangan (opsional)" class="col-span-2" />
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogDetail" width="900px">
      <template #header>{{ detail?.kodeInventaris }} — {{ detail?.nama }}</template>
      <template #body>
        <div v-if="detail" class="pt-2 text-sm">
          <Tabs v-model:value="tabDetail">
            <TabList>
              <Tab value="info">Informasi</Tab>
              <Tab value="riwayat">Riwayat ({{ riwayat.length }})</Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="info">
                <div class="grid grid-cols-2 gap-x-6 gap-y-1">
                  <div><span class="text-grey-400">Kategori:</span> {{ KATEGORI_ASET[detail.kategori] ?? detail.kategori }}</div>
                  <div>
                    <span class="text-grey-400">Status:</span>
                    <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaStatusAset(detail.status).bg, gayaStatusAset(detail.status).text]">{{ gayaStatusAset(detail.status).label }}</span>
                  </div>
                  <div><span class="text-grey-400">Lokasi:</span> {{ detail.namaLokasi ?? "-" }}</div>
                  <div><span class="text-grey-400">Penanggung jawab:</span> {{ detail.namaPenanggungJawab || "-" }}</div>
                  <div><span class="text-grey-400">Merek / tipe:</span> {{ [detail.merek, detail.tipe].filter(Boolean).join(" / ") || "-" }}</div>
                  <div><span class="text-grey-400">Nomor seri:</span> {{ detail.nomorSeri ?? "-" }}</div>
                  <div><span class="text-grey-400">Tahun perolehan:</span> {{ detail.tahunPerolehan ?? "-" }}</div>
                  <div><span class="text-grey-400">Nilai perolehan:</span> {{ detail.nilaiPerolehan !== null ? rupiahSarpras(detail.nilaiPerolehan) : "-" }}</div>
                  <div><span class="text-grey-400">Wajib kalibrasi:</span> {{ detail.wajibKalibrasi ? "Ya" : "Tidak" }}</div>
                  <div v-if="detail.alasanDihapuskan" class="col-span-2"><span class="text-grey-400">Alasan dihapuskan:</span> {{ detail.alasanDihapuskan }}</div>
                  <div v-if="detail.keterangan" class="col-span-2"><span class="text-grey-400">Keterangan:</span> {{ detail.keterangan }}</div>
                </div>

                <div class="grid grid-cols-2 gap-3 mt-4">
                  <div class="p-3 border rounded-lg border-grey-100">
                    <div class="mb-1 font-semibold">Jadwal Pemeliharaan Aktif</div>
                    <div v-if="!detail.jadwalPemeliharaan?.length" class="text-grey-400">Belum ada</div>
                    <div v-for="j in detail.jadwalPemeliharaan" :key="j.uuid">{{ FREKUENSI[j.frekuensi] ?? j.frekuensi }} — berikutnya {{ tanggalSarpras(j.tanggalBerikutnya) }}</div>
                  </div>
                  <div class="p-3 border rounded-lg border-grey-100">
                    <div class="mb-1 font-semibold">Kalibrasi Terakhir</div>
                    <div v-if="!detail.kalibrasiTerakhir" class="text-grey-400">Belum ada</div>
                    <div v-else>
                      {{ tanggalSarpras(detail.kalibrasiTerakhir.tanggalKalibrasi) }} · {{ detail.kalibrasiTerakhir.lembagaPenguji ?? "-" }} · berlaku s.d.
                      {{ tanggalSarpras(detail.kalibrasiTerakhir.tanggalBerlaku) }}
                    </div>
                  </div>
                </div>

                <div class="mt-3">
                  <div class="mb-1 font-semibold">Laporan Kerusakan Terakhir</div>
                  <NoData v-if="!detail.laporanKerusakan?.length" />
                  <DataTable v-else :value="detail.laporanKerusakan" class="text-xs" stripedRows>
                    <Column field="nomorLaporan" header="Nomor" headerClass="bg-opensimrs-50" />
                    <Column field="uraian" header="Uraian" headerClass="bg-opensimrs-50" />
                    <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data: w }">{{ waktuSarpras(w.waktuLaporan) }}</template></Column>
                    <Column header="Status" headerClass="bg-opensimrs-50">
                      <template #body="{ data: w }">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaStatusLaporan(w.status).bg, gayaStatusLaporan(w.status).text]">{{ gayaStatusLaporan(w.status).label }}</span>
                      </template>
                    </Column>
                  </DataTable>
                </div>

                <div v-if="detail.status !== 'dihapuskan'" class="grid grid-cols-2 gap-3 mt-4">
                  <div v-if="boleh('PINDAH LOKASI')" class="p-3 border rounded-lg border-grey-100">
                    <div class="mb-2 font-semibold">Pindah Lokasi</div>
                    <CustomSelect v-model="lokasiBaru" label="Lokasi Tujuan" :options="referensi.lokasi.filter((l: any) => l.uuid !== detail.lokasiUuid)" optionValue="uuid" optionLabel="nama" />
                    <CustomTextfield v-model="catatanPindah" label="Catatan (opsional)" class="mt-2" :maxLength="255" />
                    <div class="flex justify-end mt-2"><CustomButton label="Pindahkan" size="small" @click="pindah" /></div>
                  </div>
                  <div v-if="boleh('UBAH STATUS')" class="p-3 border rounded-lg border-grey-100">
                    <div class="mb-2 font-semibold">Ubah Status</div>
                    <CustomSelect
                      v-model="statusBaru"
                      label="Status Baru"
                      :options="opsi(STATUS_ASET).filter((s) => s.value !== detail.status)"
                      optionValue="value"
                      optionLabel="label"
                      :showFilter="false"
                    />
                    <CustomTextfield v-model="alasanStatus" :label="statusBaru === 'dihapuskan' ? 'Alasan penghapusan (wajib)' : 'Alasan (opsional)'" class="mt-2" :maxLength="500" />
                    <div v-if="galatStatus" class="mt-1 text-xs text-danger-300">{{ galatStatus }}</div>
                    <div class="flex justify-end mt-2"><CustomButton label="Simpan Status" size="small" @click="ubahStatus" /></div>
                  </div>
                </div>
              </TabPanel>
              <TabPanel value="riwayat">
                <NoData v-if="!riwayat.length" />
                <DataTable v-else :value="riwayat" class="text-xs" stripedRows scrollable scrollHeight="420px">
                  <Column header="Waktu" headerClass="bg-opensimrs-50" class="w-[150px]"><template #body="{ data: r }">{{ waktuSarpras(r.waktuPeristiwa) }}</template></Column>
                  <Column header="Peristiwa" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ JENIS_PERISTIWA[r.jenisPeristiwa] ?? r.jenisPeristiwa }}</template></Column>
                  <Column header="Rincian" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ ringkasPerubahan(r.dataPerubahan) }}</template></Column>
                  <Column field="pengguna" header="Oleh" headerClass="bg-opensimrs-50" />
                </DataTable>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between w-full">
          <div class="flex gap-2">
            <CustomButton v-if="detail && boleh('CETAK QR')" icon="PhQrCode" label="Cetak Label QR" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetakQr(detail)" />
            <CustomButton v-if="detail && boleh('UPDATE') && detail.status !== 'dihapuskan'" icon="PhPencilSimple" label="Ubah Data" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(detail)" />
          </div>
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogDetail = false" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
