<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import {
  daftarInvoiceMcu, kandidatInvoiceMcu, buatInvoiceMcu, detailInvoiceMcu, ubahStatusInvoiceMcu, daftarPerusahaanMcu,
  catatPembayaranMcu, batalPembayaranMcu, rekapHrdMcu, izinMcu, METODE_BAYAR_MCU,
  STATUS_INVOICE, KESIMPULAN_MCU, tglIso, tglIndo, rupiah, type StatusInvoice, type Kesimpulan,
} from "@/stores/penunjang/mcu";
import { cetakInvoiceMcu } from "@/utils/pdf/pdfMcu/cetakMcu";

// Tagihan (invoice) MCU korporasi: kumpulkan peserta perusahaan per periode → draft → terbit → pembayaran dicatat
// (sebagian / lunas) dengan riwayat & sisa tagihan. Invoice dapat dicetak dengan lampiran rekap hasil untuk HRD.
const boleh = (aksi: string) => izinMcu("Tagihan Korporasi", aksi);
const rows = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const memuat = ref(false);
const cari = ref("");
const perusahaanFilter = ref("");
const statusFilter = ref("");
const perusahaan = ref<any[]>([]);
const OPSI_STATUS = [{ v: "", l: "Semua status" }, ...Object.entries(STATUS_INVOICE).map(([v, s]) => ({ v, l: s.label }))];

const muat = async () => {
  memuat.value = true;
  const res = await daftarInvoiceMcu({ page: page.value, limit: limit.value, cari: cari.value, perusahaan_uuid: perusahaanFilter.value, status: statusFilter.value });
  rows.value = res?.payload?.data ?? [];
  total.value = res?.payload?.pagination?.total ?? 0;
  memuat.value = false;
};
const cariUlang = () => {
  page.value = 1;
  muat();
};
const gantiHalaman = (e: any) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

// ── Buat invoice ──────────────────────────────────────────
const dialogBuat = ref(false);
const form = ref<any>({});
const kandidat = ref<any[]>([]);
const terpilih = ref<any[]>([]);
const memuatKandidat = ref(false);
const menyimpan = ref(false);
const bukaBuat = () => {
  const n = new Date();
  form.value = { perusahaanUuid: null, mulai: new Date(n.getFullYear(), n.getMonth(), 1), selesai: new Date(n.getFullYear(), n.getMonth() + 1, 0), jatuhTempo: null, catatan: "" };
  kandidat.value = [];
  terpilih.value = [];
  dialogBuat.value = true;
};
const muatKandidat = async () => {
  if (!form.value.perusahaanUuid) return;
  memuatKandidat.value = true;
  const res = await kandidatInvoiceMcu({ perusahaan_uuid: form.value.perusahaanUuid, periode_mulai: tglIso(form.value.mulai), periode_selesai: tglIso(form.value.selesai) });
  kandidat.value = res?.payload?.peserta ?? [];
  terpilih.value = [...kandidat.value];
  memuatKandidat.value = false;
};
const totalTerpilih = computed(() => terpilih.value.reduce((n, r) => n + Number(r.harga), 0));
const buat = async () => {
  menyimpan.value = true;
  const res = await buatInvoiceMcu({
    perusahaanUuid: form.value.perusahaanUuid, periodeMulai: tglIso(form.value.mulai), periodeSelesai: tglIso(form.value.selesai),
    jatuhTempo: form.value.jatuhTempo ? tglIso(form.value.jatuhTempo) : null, catatan: form.value.catatan, pesertaUuids: terpilih.value.map((r) => r.uuid),
  });
  menyimpan.value = false;
  if (res) {
    dialogBuat.value = false;
    muat();
    bukaDetail(res.payload);
  }
};

// ── Detail & status ───────────────────────────────────────
const dialogDetail = ref(false);
const detail = ref<any>(null);
const bukaDetail = async (r: any) => {
  const res = await detailInvoiceMcu(r.uuid);
  if (!res) return;
  detail.value = res.payload;
  dialogDetail.value = true;
};
const ubahStatus = async (aksi: "terbit" | "batal") => {
  let data: Record<string, any> = {};
  if (aksi === "batal") {
    const alasan = window.prompt("Alasan pembatalan invoice (peserta akan dilepas dan dapat ditagihkan ulang):");
    if (!alasan?.trim()) return;
    data = { alasan: alasan.trim() };
  } else if (!window.confirm("Terbitkan invoice ini?")) return;
  const res = await ubahStatusInvoiceMcu(detail.value.uuid, aksi, data);
  if (res) {
    detail.value = res.payload;
    muat();
  }
};

// ── Pembayaran ────────────────────────────────────────────
const dialogBayar = ref(false);
const formBayar = ref<any>({});
const menyimpanBayar = ref(false);
const OPSI_METODE = Object.entries(METODE_BAYAR_MCU).map(([v, l]) => ({ v, l }));
const bukaBayar = () => {
  formBayar.value = { tanggal: new Date(), jumlah: Number(detail.value.sisa) || 0, metode: "transfer", noReferensi: "", catatan: "" };
  dialogBayar.value = true;
};
const simpanBayar = async () => {
  const f = formBayar.value;
  menyimpanBayar.value = true;
  const res = await catatPembayaranMcu(detail.value.uuid, {
    tanggal: tglIso(f.tanggal), jumlah: Number(f.jumlah) || 0, metode: f.metode, noReferensi: f.noReferensi, catatan: f.catatan,
  });
  menyimpanBayar.value = false;
  if (res) {
    detail.value = res.payload;
    dialogBayar.value = false;
    muat();
  }
};
const batalBayar = async (b: any) => {
  const alasan = window.prompt(`Alasan membatalkan pembayaran ${b.noBayar} (${rupiah(b.jumlah)}):`);
  if (!alasan?.trim()) return;
  const res = await batalPembayaranMcu(detail.value.uuid, b.uuid, alasan.trim());
  if (res) {
    detail.value = res.payload;
    muat();
  }
};
const bayarAktif = computed(() => (detail.value?.pembayaran ?? []).filter((b: any) => !b.deletedAt));
const persenBayar = computed(() => (detail.value?.total ? Math.min(100, Math.round((Number(detail.value.totalBayar) / Number(detail.value.total)) * 100)) : 0));

// Cetak invoice (+ lampiran rekap hasil MCU untuk HRD).
const mencetak = ref(false);
const cetak = async (denganRekap: boolean) => {
  mencetak.value = true;
  let rekap = null;
  if (denganRekap) rekap = (await rekapHrdMcu({ perusahaan_uuid: detail.value.perusahaanUuid, invoice_uuid: detail.value.uuid }))?.payload ?? null;
  await cetakInvoiceMcu(detail.value, rekap);
  mencetak.value = false;
};

onMounted(async () => {
  muat();
  perusahaan.value = (await daftarPerusahaanMcu({ limit: 500 }))?.payload?.data ?? [];
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-hidden" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Tagihan Korporasi</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="No. invoice / perusahaan" @keydown.enter="cariUlang" />
          <CustomSelect
            v-model="perusahaanFilter"
            label="Perusahaan"
            optionLabel="nama"
            optionValue="uuid"
            :options="[{ uuid: '', nama: 'Semua perusahaan' }, ...perusahaan]"
          />
          <CustomSelect v-model="statusFilter" label="Status" optionLabel="l" optionValue="v" :options="OPSI_STATUS" :showFilter="false" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariUlang" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Buat Invoice" @click="bukaBuat" />
        </PageToolbar>
      </template>
      <template #content>
        <DataTable :value="rows" :loading="memuat" stripedRows class="text-xs" scrollable scrollHeight="flex" dataKey="uuid">
          <template #empty><div class="py-6 text-center text-grey-400">Belum ada invoice MCU</div></template>
          <Column header="No. Invoice" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="font-semibold">{{ data.noInvoice }}</div>
              <div class="text-grey-400">{{ tglIndo(data.tanggal) }}</div>
            </template>
          </Column>
          <Column header="Perusahaan" field="namaPerusahaan" headerClass="bg-opensimrs-50" />
          <Column header="Periode" headerClass="bg-opensimrs-50">
            <template #body="{ data }">{{ tglIndo(data.periodeMulai) }} – {{ tglIndo(data.periodeSelesai) }}</template>
          </Column>
          <Column header="Peserta" field="jumlahPeserta" headerClass="bg-opensimrs-50" />
          <Column header="Total" headerClass="bg-opensimrs-50">
            <template #body="{ data }"><b>{{ rupiah(data.total) }}</b></template>
          </Column>
          <Column header="Dibayar / Sisa" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div>{{ rupiah(data.totalBayar) }}</div>
              <div :class="data.sisa > 0 && ['terbit', 'sebagian'].includes(data.status) ? 'text-[#B42318]' : 'text-grey-400'">sisa {{ rupiah(data.status === 'batal' ? 0 : data.sisa) }}</div>
            </template>
          </Column>
          <Column header="Jatuh Tempo" headerClass="bg-opensimrs-50">
            <template #body="{ data }">{{ tglIndo(data.jatuhTempo) }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <span class="px-2 py-0.5 rounded-full font-semibold" :class="[STATUS_INVOICE[data.status as StatusInvoice]?.bg, STATUS_INVOICE[data.status as StatusInvoice]?.text]">
                {{ STATUS_INVOICE[data.status as StatusInvoice]?.label }}
              </span>
            </template>
          </Column>
          <Column header="" headerClass="bg-opensimrs-50" class="w-20">
            <template #body="{ data }"><Button size="small" outlined label="Detail" @click="bukaDetail(data)" /></template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="px-4 py-2"><Paginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50]" @page="gantiHalaman" /></div>
      </template>
    </Card>

    <!-- Buat invoice -->
    <CustomDialog v-model:visible="dialogBuat" width="860px">
      <template #header>Buat Invoice MCU Korporasi</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4 text-sm">
          <div class="grid grid-cols-4 gap-3">
            <label class="flex flex-col col-span-2 gap-1">Perusahaan *
              <Select v-model="form.perusahaanUuid" :options="perusahaan" optionLabel="nama" optionValue="uuid" filter placeholder="Pilih perusahaan" @change="muatKandidat" />
            </label>
            <label class="flex flex-col gap-1">Periode mulai<DatePicker v-model="form.mulai" dateFormat="dd-mm-yy" @update:modelValue="muatKandidat" /></label>
            <label class="flex flex-col gap-1">Periode selesai<DatePicker v-model="form.selesai" dateFormat="dd-mm-yy" @update:modelValue="muatKandidat" /></label>
            <label class="flex flex-col gap-1">Jatuh tempo<DatePicker v-model="form.jatuhTempo" dateFormat="dd-mm-yy" showClear /></label>
            <label class="flex flex-col col-span-3 gap-1">Catatan<InputText v-model="form.catatan" placeholder="mis. Sesuai PKS No. ..." /></label>
          </div>
          <div class="text-xs text-grey-400">Peserta korporasi berstatus proses/selesai pada periode tsb. yang belum masuk invoice lain.</div>
          <DataTable v-model:selection="terpilih" :value="kandidat" :loading="memuatKandidat" dataKey="uuid" class="text-xs" scrollable scrollHeight="300px">
            <template #empty><div class="py-4 text-center text-grey-400">{{ form.perusahaanUuid ? "Tidak ada peserta yang dapat ditagihkan" : "Pilih perusahaan" }}</div></template>
            <Column selectionMode="multiple" headerClass="bg-opensimrs-50" class="w-10" />
            <Column header="No. MCU" field="noMcu" headerClass="bg-opensimrs-50" />
            <Column header="Tanggal" headerClass="bg-opensimrs-50"><template #body="{ data }">{{ tglIndo(data.tanggal) }}</template></Column>
            <Column header="Nama" field="namaPasien" headerClass="bg-opensimrs-50" />
            <Column header="NIK Kary." field="nikKaryawan" headerClass="bg-opensimrs-50" />
            <Column header="Paket" field="namaPaket" headerClass="bg-opensimrs-50" />
            <Column header="Status" field="status" headerClass="bg-opensimrs-50" />
            <Column header="Harga" headerClass="bg-opensimrs-50"><template #body="{ data }">{{ rupiah(data.harga) }}</template></Column>
          </DataTable>
          <div class="text-right">{{ terpilih.length }} peserta · Total <b>{{ rupiah(totalTerpilih) }}</b></div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="dialogBuat = false" />
          <CustomButton label="Buat Invoice (Draft)" :loading="menyimpan" :disabled="!form.perusahaanUuid || !terpilih.length" @click="buat" />
        </div>
      </template>
    </CustomDialog>

    <!-- Detail -->
    <CustomDialog v-model:visible="dialogDetail" width="860px">
      <template #header>Invoice {{ detail?.noInvoice }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-3 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Perusahaan:</span> <b>{{ detail.namaPerusahaan }}</b></div>
            <div>
              <span class="text-grey-400">Status:</span>
              <span class="px-2 py-0.5 ml-1 rounded-full font-semibold" :class="[STATUS_INVOICE[detail.status as StatusInvoice]?.bg, STATUS_INVOICE[detail.status as StatusInvoice]?.text]">
                {{ STATUS_INVOICE[detail.status as StatusInvoice]?.label }}
              </span>
            </div>
            <div><span class="text-grey-400">Periode:</span> {{ tglIndo(detail.periodeMulai) }} – {{ tglIndo(detail.periodeSelesai) }}</div>
            <div><span class="text-grey-400">Jatuh tempo:</span> {{ tglIndo(detail.jatuhTempo) }}</div>
            <div><span class="text-grey-400">Total:</span> <b>{{ rupiah(detail.total) }}</b> ({{ detail.jumlahPeserta }} peserta)</div>
            <div v-if="detail.status !== 'draft' && detail.status !== 'batal'" class="col-span-2 mt-1" data-uji="ringkas-bayar">
              <div class="flex justify-between text-xs"><span>Dibayar <b>{{ rupiah(detail.totalBayar) }}</b></span><span>Sisa <b :class="detail.sisa > 0 ? 'text-[#B42318]' : 'text-[#027A48]'">{{ rupiah(detail.sisa) }}</b></span></div>
              <ProgressBar :value="persenBayar" :showValue="false" style="height: 6px" />
            </div>
            <div v-if="detail.alasanBatal" class="text-danger-300">Alasan batal: {{ detail.alasanBatal }}</div>
          </div>
          <table class="w-full text-xs border border-grey-100">
            <thead class="bg-opensimrs-50"><tr><th class="p-2 text-left">Paket</th><th class="p-2">Jumlah</th><th class="p-2 text-right">Harga</th><th class="p-2 text-right">Subtotal</th></tr></thead>
            <tbody>
              <tr v-for="r in detail.rincian" :key="r.kodePaket" class="border-t border-grey-100">
                <td class="p-2">{{ r.namaPaket }}</td><td class="p-2 text-center">{{ r.jumlah }}</td>
                <td class="p-2 text-right">{{ rupiah(r.harga) }}</td><td class="p-2 text-right">{{ rupiah(r.subtotal) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="(detail.pembayaran ?? []).length" class="border rounded border-grey-100">
            <div class="px-2 py-1 text-xs font-semibold bg-opensimrs-50">Riwayat Pembayaran</div>
            <table class="w-full text-xs">
              <thead><tr class="text-grey-400"><th class="p-2 text-left">No.</th><th class="p-2 text-left">Tanggal</th><th class="p-2 text-left">Metode / Referensi</th><th class="p-2 text-right">Jumlah</th><th class="p-2 text-left">Dicatat</th><th></th></tr></thead>
              <tbody>
                <tr v-for="b in detail.pembayaran" :key="b.uuid" class="border-t border-grey-100" :class="{ 'line-through text-grey-300': b.deletedAt }">
                  <td class="p-2">{{ b.noBayar }}</td>
                  <td class="p-2">{{ tglIndo(b.tanggal) }}</td>
                  <td class="p-2">{{ METODE_BAYAR_MCU[b.metode] ?? b.metode }}{{ b.noReferensi ? ` · ${b.noReferensi}` : "" }}<div v-if="b.catatan" class="text-grey-400">{{ b.catatan }}</div><div v-if="b.deletedAt" class="no-underline text-danger-300">Dibatalkan: {{ b.alasanBatal }}</div></td>
                  <td class="p-2 text-right">{{ rupiah(b.jumlah) }}</td>
                  <td class="p-2">{{ b.dibuatOleh }}</td>
                  <td class="p-2"><Button v-if="!b.deletedAt && boleh('PEMBAYARAN')" text size="small" severity="danger" label="Batalkan" @click="batalBayar(b)" /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="overflow-auto max-h-64">
            <table class="w-full text-xs border border-grey-100">
              <thead class="sticky top-0 bg-opensimrs-50"><tr><th class="p-2 text-left">No. MCU</th><th class="p-2 text-left">Nama</th><th class="p-2 text-left">NIK Kary.</th><th class="p-2 text-left">Kesimpulan</th><th class="p-2 text-right">Harga</th></tr></thead>
              <tbody>
                <tr v-if="!detail.peserta.length"><td colspan="5" class="p-3 text-center text-grey-400">Tidak ada peserta (invoice batal melepas peserta)</td></tr>
                <tr v-for="s in detail.peserta" :key="s.uuid" class="border-t border-grey-100">
                  <td class="p-2">{{ s.noMcu }}</td><td class="p-2">{{ s.namaPasien }}</td><td class="p-2">{{ s.nikKaryawan ?? "-" }}</td>
                  <td class="p-2">{{ s.kesimpulan ? KESIMPULAN_MCU[s.kesimpulan as Kesimpulan].label : "Belum" }}</td>
                  <td class="p-2 text-right">{{ rupiah(s.harga) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
      <template #footer>
        <div v-if="detail" class="flex justify-between gap-2">
          <div class="flex gap-2">
            <template v-if="boleh('CETAK')">
              <CustomButton icon="PhPrinter" label="Cetak Invoice" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="detail.status === 'batal'" :loading="mencetak" @click="cetak(false)" />
              <CustomButton icon="PhFiles" label="Invoice + Rekap HRD" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="detail.status === 'batal'" :loading="mencetak" @click="cetak(true)" />
            </template>
          </div>
          <div class="flex gap-2">
            <CustomButton v-if="['draft', 'terbit'].includes(detail.status) && !bayarAktif.length && boleh('UPDATE')" label="Batalkan" backgroundColor="bg-danger-300" @click="ubahStatus('batal')" />
            <CustomButton v-if="detail.status === 'draft' && boleh('UPDATE')" label="Terbitkan" @click="ubahStatus('terbit')" />
            <CustomButton v-if="['terbit', 'sebagian'].includes(detail.status) && boleh('PEMBAYARAN')" icon="PhMoney" label="Catat Pembayaran" @click="bukaBayar" />
          </div>
        </div>
      </template>
    </CustomDialog>

    <!-- Catat pembayaran -->
    <CustomDialog v-model:visible="dialogBayar" width="520px">
      <template #header>Catat Pembayaran {{ detail?.noInvoice }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-3 pt-4 text-sm" data-uji="form-bayar">
          <div class="col-span-2 p-2 text-xs rounded bg-opensimrs-50">
            Total {{ rupiah(detail?.total) }} · sudah dibayar {{ rupiah(detail?.totalBayar) }} · <b>sisa {{ rupiah(detail?.sisa) }}</b>
          </div>
          <label class="flex flex-col gap-1">Tanggal bayar *<DatePicker v-model="formBayar.tanggal" dateFormat="dd-mm-yy" :maxDate="new Date()" /></label>
          <label class="flex flex-col gap-1">Jumlah (Rp) *<InputNumber v-model="formBayar.jumlah" :min="0" :max="Number(detail?.sisa) || 0" locale="id-ID" /></label>
          <label class="flex flex-col gap-1">Metode *<Select v-model="formBayar.metode" :options="OPSI_METODE" optionLabel="l" optionValue="v" /></label>
          <label class="flex flex-col gap-1">No. referensi / bukti<InputText v-model="formBayar.noReferensi" placeholder="No. transfer / giro" /></label>
          <label class="flex flex-col col-span-2 gap-1">Catatan<InputText v-model="formBayar.catatan" /></label>
          <div class="col-span-2 text-xs text-grey-400">
            {{ Number(formBayar.jumlah) >= Number(detail?.sisa) ? "Pembayaran ini melunasi invoice." : `Setelah pembayaran ini sisa ${rupiah(Number(detail?.sisa) - Number(formBayar.jumlah || 0))}.` }}
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="dialogBayar = false" />
          <CustomButton label="Simpan Pembayaran" :loading="menyimpanBayar" :disabled="!formBayar.jumlah || !formBayar.metode || !formBayar.tanggal" @click="simpanBayar" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
