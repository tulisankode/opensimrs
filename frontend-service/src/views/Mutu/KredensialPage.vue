<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
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
  JENIS_KREDENSIAL,
  MASA_BERLAKU,
  STATUS_KREDENSIAL,
  bacaBerkas,
  bukaBerkas,
  cabutKredensial,
  daftarKredensial,
  detailKredensial,
  epochTanggal,
  gayaMasaBerlaku,
  gayaStatusKredensial,
  hapusKredensial,
  izinMutu,
  opsi,
  referensiMutu,
  simpanKredensial,
  sisaHariTeks,
  tanggalDariEpoch,
  tanggalMutu,
  ukuranBerkas,
  unduhBerkasKredensial,
  unggahBerkasKredensial,
} from "@/stores/penunjang/mutu";

// Kredensial staf (KF-8/KF-9): STR, SIP, sertifikat pelatihan, RKK, SPK milik pegawai aktif Datamaster (tanpa membuat
// data induk baru). Masa berlaku dihitung backend per hari Asia/Jakarta: peringatan 90 & 30 hari sebelum tanggal
// berakhir, kedaluwarsa setelah hari terakhir berlaku lewat. Berkas pendukung PDF/JPG/PNG.
const storeUtils = utilsStore();
const route = useRoute();
const boleh = (aksi: string) => izinMutu("Kredensial Staf", aksi);

const referensi = ref<any>({ pegawai: [], practitioner: [], berkas: { maksMb: 10 } });
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterPegawai = ref("");
const filterJenis = ref("");
const filterMasa = ref("");
const filterStatus = ref("aktif");
const OPSI_JENIS = opsi(JENIS_KREDENSIAL);
const OPSI_MASA = opsi(MASA_BERLAKU);
const OPSI_STATUS = opsi(STATUS_KREDENSIAL);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarKredensial({
      page: page.value,
      limit: limit.value,
      cari: cari.value.trim(),
      pegawaiUuid: filterPegawai.value,
      jenis: filterJenis.value,
      masaBerlaku: filterMasa.value,
      status: filterStatus.value,
    });
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

// ── Form catat / ubah
const dialog = ref(false);
const form = ref<any>({});
const berkas = ref<File | null>(null);
const galat = ref("");
const opsiPractitioner = (pegawaiUuid: string) =>
  referensi.value.practitioner
    .filter((p: any) => p.pegawaiUuid === pegawaiUuid)
    .map((p: any) => ({ value: p.uuid, label: [p.str && `STR ${p.str}`, p.sip && `SIP ${p.sip}`].filter(Boolean).join(" · ") || p.uuid }));
const buka = (d?: any) => {
  galat.value = "";
  berkas.value = null;
  form.value = d
    ? {
        uuid: d.uuid,
        pegawaiUuid: d.pegawaiUuid,
        namaPegawai: d.namaPegawai,
        practitionerUuid: d.practitionerUuid ?? "",
        jenis: d.jenis,
        nomor: d.nomor ?? "",
        uraian: d.uraian ?? "",
        tanggalMulai: tanggalDariEpoch(d.tanggalMulai),
        tanggalBerakhir: tanggalDariEpoch(d.tanggalBerakhir),
      }
    : { pegawaiUuid: filterPegawai.value, practitionerUuid: "", jenis: "", nomor: "", uraian: "", tanggalMulai: null, tanggalBerakhir: null };
  dialog.value = true;
};
const validasiFile = (f: File) => {
  if (!["application/pdf", "image/jpeg", "image/png"].includes(f.type)) return "Berkas harus PDF, JPG, atau PNG";
  if (f.size > referensi.value.berkas.maksMb * 1024 * 1024) return `Ukuran berkas maksimal ${referensi.value.berkas.maksMb} MB`;
  return "";
};
const pilihBerkas = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0] ?? null;
  input.value = "";
  if (!f) return;
  galat.value = validasiFile(f);
  berkas.value = galat.value ? null : f;
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.pegawaiUuid || !f.jenis) return (galat.value = "Pegawai dan jenis kredensial wajib dipilih");
  if (f.tanggalMulai && f.tanggalBerakhir && f.tanggalBerakhir < f.tanggalMulai) return (galat.value = "Tanggal berakhir tidak boleh sebelum tanggal mulai");
  storeUtils.setLoading(true);
  try {
    const isi: Record<string, any> = {
      practitionerUuid: f.practitionerUuid || null,
      jenis: f.jenis,
      nomor: f.nomor.trim(),
      uraian: f.uraian.trim(),
      tanggalMulai: epochTanggal(f.tanggalMulai) ?? null,
      tanggalBerakhir: epochTanggal(f.tanggalBerakhir) ?? null,
    };
    if (!f.uuid) {
      isi.pegawaiUuid = f.pegawaiUuid;
      if (berkas.value) isi.berkas = await bacaBerkas(berkas.value);
    }
    const res = await simpanKredensial(isi, f.uuid);
    if (res && f.uuid && berkas.value) await unggahBerkasKredensial(f.uuid, await bacaBerkas(berkas.value));
    if (res) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Detail & aksi
const dialogDetail = ref(false);
const detail = ref<any>(null);
const alasanCabut = ref("");
const bukaDetail = async (uuid: string) => {
  const res = await detailKredensial(uuid);
  if (res?.payload) {
    detail.value = res.payload;
    alasanCabut.value = "";
    dialogDetail.value = true;
  }
};
const lihatBerkas = async (uuid: string) => bukaBerkas((await unduhBerkasKredensial(uuid))?.payload);
const cabut = async () => {
  if (!alasanCabut.value.trim()) return alert("Alasan pencabutan wajib diisi");
  if (await cabutKredensial(detail.value.uuid, alasanCabut.value.trim())) {
    await bukaDetail(detail.value.uuid);
    muat();
  }
};
const hapus = async () => {
  if (!confirm("Hapus catatan kredensial ini (koreksi salah input)?")) return;
  if (await hapusKredensial(detail.value.uuid)) {
    dialogDetail.value = false;
    muat();
  }
};
const ubahDariDetail = () => {
  dialogDetail.value = false;
  buka(detail.value);
};
const LABEL_AKSI: Record<string, string> = { buat: "Dicatat", ubah: "Diubah", ganti_berkas: "Berkas diganti", cabut: "Dicabut", hapus: "Dihapus" };

onMounted(async () => {
  const r = await referensiMutu();
  if (r?.payload) referensi.value = r.payload;
  if (route.query.pegawai) {
    filterPegawai.value = String(route.query.pegawai);
    filterStatus.value = "";
  }
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Kredensial Staf</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / nomor" :maxLength="100" @keydown.enter="cariData" />
          <CustomSelect v-model="filterPegawai" label="Pegawai" placeHolder="Semua" :options="referensi.pegawai" optionValue="uuid" optionLabel="nama" @update:modelValue="cariData" />
          <CustomSelect v-model="filterJenis" label="Jenis" placeHolder="Semua" :options="OPSI_JENIS" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="filterMasa" label="Masa Berlaku" placeHolder="Semua" :options="OPSI_MASA" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="filterStatus" label="Status" placeHolder="Semua" :options="OPSI_STATUS" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Catat Kredensial" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 60rem" @rowClick="bukaDetail($event.data.uuid)">
          <Column header="Pegawai" headerClass="bg-opensimrs-50"><template #body="{ data: d }"><span class="font-semibold">{{ d.namaPegawai || "-" }}</span></template></Column>
          <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ JENIS_KREDENSIAL[d.jenis] ?? d.jenis }}</template></Column>
          <Column header="Nomor" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.nomor || "-" }}</template></Column>
          <Column header="Berlaku" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ tanggalMutu(d.tanggalMulai) }} – {{ d.tanggalBerakhir ? tanggalMutu(d.tanggalBerakhir) : "tanpa batas" }}</template></Column>
          <Column header="Masa Berlaku" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span v-if="d.status === 'aktif'" class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaMasaBerlaku(d.masaBerlaku).bg, gayaMasaBerlaku(d.masaBerlaku).text]">{{ gayaMasaBerlaku(d.masaBerlaku).label }}</span>
              <div v-if="d.status === 'aktif'" class="text-[10px] text-grey-400">{{ sisaHariTeks(d.sisaHari) }}</div>
              <span v-else class="text-grey-400">-</span>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaStatusKredensial(d.status).bg, gayaStatusKredensial(d.status).text]">{{ gayaStatusKredensial(d.status).label }}</span></template>
          </Column>
          <Column header="Berkas" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.berkasInfo ? "Ada" : "-" }}</template></Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="680px">
      <template #header>{{ form.uuid ? "Ubah" : "Catat" }} Kredensial Staf</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-if="!form.uuid" v-model="form.pegawaiUuid" label="Pegawai (Datamaster, aktif)" :options="referensi.pegawai" optionValue="uuid" optionLabel="nama" class="col-span-2" required />
          <div v-else class="col-span-2 text-sm"><span class="text-grey-400">Pegawai:</span> {{ form.namaPegawai }}</div>
          <CustomSelect v-model="form.jenis" label="Jenis Kredensial" :options="OPSI_JENIS" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomSelect v-model="form.practitionerUuid" label="Practitioner (opsional)" placeHolder="Tidak ditautkan" :options="opsiPractitioner(form.pegawaiUuid)" optionValue="value" optionLabel="label" :showFilter="false" />
          <CustomTextfield v-model="form.nomor" label="Nomor" :maxLength="100" class="col-span-2" />
          <CustomDatePicker v-model="form.tanggalMulai" label="Berlaku Mulai" />
          <CustomDatePicker v-model="form.tanggalBerakhir" label="Berlaku Sampai (kosong = tanpa batas)" :minDate="form.tanggalMulai ?? undefined" />
          <CustomTextArea v-model="form.uraian" label="Uraian / Rincian Kewenangan" class="col-span-2" />
          <div class="col-span-2">
            <label class="text-sm cursor-pointer text-opensimrs-300">
              + {{ form.uuid ? "Ganti berkas (opsional)" : "Unggah berkas pendukung (opsional)" }} — PDF/JPG/PNG maks. {{ referensi.berkas?.maksMb }} MB
              <input type="file" class="hidden" accept="application/pdf,image/jpeg,image/png" @change="pilihBerkas" />
            </label>
            <div v-if="berkas" class="text-xs">{{ berkas.name }} ({{ ukuranBerkas(berkas.size) }})</div>
          </div>
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

    <CustomDialog v-model:visible="dialogDetail" width="720px">
      <template #header>{{ JENIS_KREDENSIAL[detail?.jenis] }} — {{ detail?.namaPegawai }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Nomor:</span> {{ detail.nomor || "-" }}</div>
            <div>
              <span class="text-grey-400">Status:</span> {{ STATUS_KREDENSIAL[detail.status]?.label }}
              <span v-if="detail.status === 'aktif'" class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaMasaBerlaku(detail.masaBerlaku).bg, gayaMasaBerlaku(detail.masaBerlaku).text]">
                {{ gayaMasaBerlaku(detail.masaBerlaku).label }} · {{ sisaHariTeks(detail.sisaHari) }}
              </span>
            </div>
            <div><span class="text-grey-400">Berlaku mulai:</span> {{ tanggalMutu(detail.tanggalMulai) }}</div>
            <div><span class="text-grey-400">Berlaku sampai:</span> {{ detail.tanggalBerakhir ? tanggalMutu(detail.tanggalBerakhir) : "Tanpa batas" }}</div>
            <div v-if="detail.uraian" class="col-span-2"><span class="text-grey-400">Uraian:</span> {{ detail.uraian }}</div>
            <div v-if="detail.status === 'dicabut'" class="col-span-2 text-danger-300">Dicabut {{ tanggalMutu(detail.dicabutPada) }} oleh {{ detail.dicabutOleh }}: {{ detail.alasanCabut }}</div>
            <div class="flex items-center col-span-2 gap-2">
              <span class="text-grey-400">Berkas:</span>
              <template v-if="detail.berkasInfo">
                {{ detail.berkasInfo.namaBerkas }} ({{ ukuranBerkas(detail.berkasInfo.ukuranBita) }})
                <CustomButton label="Lihat" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="lihatBerkas(detail.uuid)" />
              </template>
              <span v-else>-</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <CustomButton v-if="boleh('UPDATE') && detail.status === 'aktif'" label="Ubah" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="ubahDariDetail" />
            <CustomButton v-if="boleh('DELETE')" label="Hapus" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapus" />
          </div>
          <div v-if="boleh('CABUT') && detail.status === 'aktif'" class="flex items-end gap-2">
            <CustomTextfield v-model="alasanCabut" label="Alasan pencabutan" class="grow" :maxLength="2000" />
            <CustomButton label="Cabut" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="cabut" />
          </div>
          <div>
            <h3 class="mb-1 font-semibold">Jejak Audit</h3>
            <div v-for="a in detail.audit" :key="a.uuid" class="py-0.5 text-xs border-b border-grey-100">
              <span class="text-grey-400">{{ new Date(a.createdAt * 1000).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) }}</span> · {{ a.aktor }} · {{ LABEL_AKSI[a.aksi] ?? a.aksi }}
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogDetail = false" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
