<script setup lang="ts">
import { onMounted, ref } from "vue";
import * as XLSX from "xlsx";
import type { MenuItem } from "primevue/menuitem";
import HeaderFilterTraining from "../Layout/HeaderFilterTraining.vue";
import FooterPaginationTraining from "../Layout/FooterPaginationTraining.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import FormKelas from "./FormKelas.vue";
import { utilsStore } from "@/stores/utils";
import { apiTraining, izinTraining, labelSesi, rupiah, useTrainingStore, type KelasTraining } from "@/stores/penunjang/training";

// Datamaster kelas Training: daftar + cari + filter status + paginasi, tambah/ubah/detail/hapus,
// impor Excel (POST /kelas/impor), ekspor halaman ini, dan unduh template impor.
const dataBreadCrumb = ref<MenuItem[]>([{ label: "Kelas" }]);
const storeUtils = utilsStore();
const store = useTrainingStore();
const boleh = (aksi: string) => izinTraining("Datamaster", aksi, "Kelas");

const data = ref<KelasTraining[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(10);
const cari = ref("");
const status = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const r = await apiTraining.daftarKelas({ page: page.value, limit: limit.value, cari: cari.value.trim(), status: status.value });
    const baris: KelasTraining[] = r?.payload?.data ?? [];
    total.value = r?.payload?.pagination?.total ?? 0;
    // Daftar kelas tidak memuat sesi; ambil detail khusus kelas bersesi pada halaman ini untuk kolom Sesi.
    const sesi = await Promise.all(baris.map((k) => (k.isSesi ? apiTraining.detailKelas(k.uuid).then((d) => d?.payload?.sesi ?? []) : Promise.resolve([]))));
    data.value = baris.map((k, i) => ({ ...k, sesi: sesi[i] }));
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
  status.value = "";
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

// ── Dialog form
const dialogForm = ref(false);
const formMethod = ref("add");
const formUuid = ref("");
const bukaForm = (method: string, k?: KelasTraining) => {
  formMethod.value = method;
  formUuid.value = k?.uuid ?? "";
  dialogForm.value = true;
};

// ── Hapus
const dialogHapus = ref(false);
const dihapus = ref<KelasTraining | null>(null);
const bukaHapus = (k: KelasTraining) => {
  dihapus.value = k;
  dialogHapus.value = true;
};
const hapus = async () => {
  if (!dihapus.value) return;
  storeUtils.setLoading(true);
  try {
    const r = await apiTraining.hapusKelas(dihapus.value.uuid);
    if (!r) return;
    dialogHapus.value = false;
    store.muatKelas(true);
    if (data.value.length === 1 && page.value > 1) page.value--;
    muat();
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Impor / ekspor Excel
// Kolom template: kode, nama, jenis, instruktur, jumlah_slot, harga, status (1/0), sesi ("Sesi 1|07:00|08:00; Sesi 2|...").
const KOLOM = ["kode", "nama", "jenis", "instruktur", "jumlah_slot", "harga", "status", "sesi"];
const teksSesi = (k: KelasTraining) => (k.sesi ?? []).map((s) => [s.namaSesi, s.jamMulai?.slice(0, 5) ?? "", s.jamSelesai?.slice(0, 5) ?? ""].join("|")).join("; ");
const unduhTemplate = () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([KOLOM, ["CTH01", "Contoh Kelas Fiktif", "Olahraga", "Instruktur Contoh", 10, 50000, 1, "Sesi 1|07:00|08:00; Sesi 2|16:00|17:00"]]);
  XLSX.utils.book_append_sheet(wb, ws, "Kelas");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Keterangan"],
      ["kode & nama wajib diisi; kode yang sudah terdaftar ditolak (tidak ditimpa)."],
      ["jumlah_slot: bilangan bulat positif; harga: angka tanpa titik/koma (≥ 0)."],
      ["status: 1 = aktif, 0 = non-aktif (kosong = aktif)."],
      ["sesi: kosongkan bila kelas tanpa sesi; format 'Nama|jam mulai|jam selesai' dipisah titik koma."],
    ]),
    "Keterangan",
  );
  XLSX.writeFile(wb, "Template Impor Kelas Training.xlsx");
};
const ekspor = () => {
  const baris = data.value.map((k) => ({
    kode: k.kode,
    nama: k.nama,
    jenis: k.jenis ?? "",
    instruktur: k.instruktur ?? "",
    jumlah_slot: k.jumlahSlot,
    harga: Number(k.harga) || 0,
    status: k.status ? 1 : 0,
    sesi: k.isSesi ? teksSesi(k) : "",
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(baris.length ? baris : [{ Keterangan: "Tidak ada data" }], { header: baris.length ? KOLOM : undefined }), "Kelas");
  XLSX.writeFile(wb, "Datamaster Kelas Training.xlsx");
};
const parseSesi = (teks: unknown) =>
  String(teks ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [namaSesi, jamMulai, jamSelesai] = s.split("|").map((x) => x.trim());
      return { namaSesi, jamMulai: jamMulai || null, jamSelesai: jamSelesai || null };
    });
const hasilImpor = ref<{ total: number; berhasil: number; gagal: number; rincianGagal: { baris: number; kode: string | null; alasan: string }[] } | null>(null);
const impor = async (berkas: File) => {
  const wb = XLSX.read(await berkas.arrayBuffer());
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const baris = rows
    .filter((r) => String(r.kode ?? "").trim() || String(r.nama ?? "").trim())
    .map((r) => {
      const sesi = parseSesi(r.sesi);
      return {
        kode: String(r.kode ?? "").trim(),
        nama: String(r.nama ?? "").trim(),
        jenis: String(r.jenis ?? "").trim() || null,
        instruktur: String(r.instruktur ?? "").trim() || null,
        jumlahSlot: Number(r.jumlah_slot),
        harga: Number(r.harga || 0),
        status: String(r.status ?? "").trim() === "" ? true : ["1", "true", "aktif", "ya"].includes(String(r.status).trim().toLowerCase()),
        isSesi: sesi.length > 0,
        sesi,
      };
    });
  if (!baris.length) {
    hasilImpor.value = { total: 0, berhasil: 0, gagal: 0, rincianGagal: [{ baris: 0, kode: null, alasan: "Berkas tidak berisi baris data (gunakan template)" }] };
    return;
  }
  storeUtils.setLoading(true);
  try {
    const r = await apiTraining.imporKelas(baris);
    if (!r?.payload) return;
    hasilImpor.value = r.payload;
    store.muatKelas(true);
    cariData();
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(muat);
</script>
<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto">
    <template #header>
      <HeaderFilterTraining
        v-model:cari="cari"
        v-model:status="status"
        page-type="datamaster"
        :dataBreadCrumb="dataBreadCrumb"
        :bisaTambah="boleh('CREATE')"
        @reload-data="muat"
        @search="cariData"
        @reset="reset"
        @tambah-data="bukaForm('add')"
      />
    </template>
    <template #content>
      <NoData v-if="!data.length" />
      <DataTable v-else :value="data" tableStyle="min-width: 50rem" stripedRows scrollable scrollHeight="flex" class="text-xs">
        <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #header><div class="flex items-center">No.</div></template>
          <template #body="{ index }">
            <div class="flex items-center justify-center">{{ (page - 1) * limit + index + 1 }}</div>
          </template>
        </Column>
        <Column field="kode" header="Kode Kelas" headerClass="bg-opensimrs-50" />
        <Column header="Nama Kelas" class="w-3/12" headerClass="bg-opensimrs-50">
          <template #body="{ data: k }">
            <div class="font-semibold">{{ k.nama }}</div>
            <div class="text-grey-400">{{ [k.jenis, k.instruktur].filter(Boolean).join(" · ") || "-" }}</div>
          </template>
        </Column>
        <Column header="Harga" headerClass="bg-opensimrs-50">
          <template #body="{ data: k }">{{ rupiah(k.harga) }}</template>
        </Column>
        <Column field="jumlahSlot" header="Slot" headerClass="bg-opensimrs-50" />
        <Column header="Sesi" class="w-4/12" headerClass="bg-opensimrs-50">
          <template #body="{ data: k }">
            <div v-if="k.isSesi && k.sesi?.length" class="flex flex-wrap w-full h-full gap-1">
              <CustomChip
                v-for="s in k.sesi"
                :key="s.uuid ?? s.namaSesi"
                :label="labelSesi(s)"
                :showCheckedIcon="false"
                border-color="border-none"
                bg-color="bg-opensimrs-300"
                customClass="text-xs font-semibold cursor-auto h-5 bg-opensimrs-300 text-white"
              />
            </div>
            <div v-else>-</div>
          </template>
        </Column>
        <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #header><div class="w-full text-center">Status</div></template>
          <template #body="{ data: k }">
            <div class="flex justify-center items-center min-w-[120px]">
              <CustomChip
                :label="k.status ? 'AKTIF' : 'NON-AKTIF'"
                :textColor="k.status ? 'text-white' : 'text-[#80868d]'"
                :bgColor="k.status ? 'bg-opensimrs-300' : 'bg-white'"
                :borderColor="k.status ? 'border-none' : 'border-[#80868d]'"
                :icon-color="k.status ? 'white' : '#80868d'"
                customClass="text-xs font-semibold h-5 flex"
              />
            </div>
          </template>
        </Column>
        <Column headerClass="bg-opensimrs-50">
          <template #header>
            <div class="flex items-center justify-center w-full font-semibold text-SM">Aksi</div>
          </template>
          <template #body="{ data: k }">
            <div class="flex items-center gap-2.5 justify-center">
              <CustomButton icon="PhEye" background-color="bg-opensimrs-300 rounded-lg" class="h-6 w-[26px] p-0" title="Detail" @click="bukaForm('detail', k)" />
              <CustomButton v-if="boleh('UPDATE')" label="" background-color="bg-[#3D84E5] rounded-lg" class="h-6 w-[26px] p-0" title="Ubah" @click="bukaForm('edit', k)">
                <img src="@/assets/icons/edit.svg" alt="Ubah" />
              </CustomButton>
              <CustomButton v-if="boleh('DELETE')" label="" background-color="bg-danger-300 rounded-lg" class="h-6 w-[26px] p-0" title="Hapus" @click="bukaHapus(k)">
                <img src="@/assets/icons/delete.svg" alt="Hapus" />
              </CustomButton>
            </div>
          </template>
        </Column>
      </DataTable>
      <FormKelas v-model:isDialogVisible="dialogForm" :method="formMethod" :uuid="formUuid" @data-updated="muat" />

      <CustomDialog v-model:visible="dialogHapus" width="440px" headerBg="bg-danger-300">
        <template #header>Hapus Kelas</template>
        <template #body>
          <p class="mt-3 text-sm">
            Hapus kelas <b>{{ dihapus?.nama }}</b> ({{ dihapus?.kode }})? Kelas yang masih memiliki booking/order aktif tidak dapat dihapus.
          </p>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <CustomButton label="Kembali" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="dialogHapus = false" />
            <CustomButton label="Ya, Hapus" backgroundColor="bg-danger-300" @click="hapus" />
          </div>
        </template>
      </CustomDialog>

      <CustomDialog :visible="!!hasilImpor" width="560px" @update:visible="hasilImpor = null">
        <template #header>Hasil Impor Kelas</template>
        <template #body>
          <div v-if="hasilImpor" class="flex flex-col gap-2 mt-3 text-sm">
            <div>Berhasil: <b>{{ hasilImpor.berhasil }}</b> dari {{ hasilImpor.total }} baris · Gagal: <b>{{ hasilImpor.gagal }}</b></div>
            <ul v-if="hasilImpor.rincianGagal?.length" class="overflow-auto border rounded-lg max-h-64 border-grey-100">
              <li v-for="g in hasilImpor.rincianGagal" :key="`${g.baris}-${g.kode}`" class="px-3 py-1.5 text-xs border-b last:border-b-0 border-grey-75">
                Baris {{ g.baris }}{{ g.kode ? ` (${g.kode})` : "" }}: <span class="text-danger-300">{{ g.alasan }}</span>
              </li>
            </ul>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end"><CustomButton label="Tutup" @click="hasilImpor = null" /></div>
        </template>
      </CustomDialog>
    </template>
    <template #footer>
      <FooterPaginationTraining
        exportImport
        :bisaImpor="boleh('IMPORT KELAS')"
        :rows="limit"
        :totalRecords="total"
        @page="gantiHalaman"
        @import="impor"
        @export="ekspor"
        @download="unduhTemplate"
      />
    </template>
  </Card>
</template>
