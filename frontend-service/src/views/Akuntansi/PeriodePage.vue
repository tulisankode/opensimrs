<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { utilsStore } from "@/stores/utils";
import {
  GAYA_STATUS,
  ambilPengaturan,
  bukaPeriode,
  daftarPeriode,
  izinAkuntansi,
  kesiapanPeriode,
  rupiah,
  simpanPengaturan,
  tanggalAk,
  tutupPeriode,
  waktuAk,
} from "@/stores/penunjang/akuntansi";

// Periode akuntansi bulanan & tutup buku (KF-12/KF-13). Periode tutup menolak jurnal baru, persetujuan, dan proses
// otomatis bertanggal di dalamnya; perbaikan dicatat sebagai jurnal koreksi di periode terbuka. Pembukaan kembali
// adalah kewenangan khusus (izin BUKA KEMBALI), wajib beralasan, dan tercatat di Audit Trail.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinAkuntansi("Periode", aksi);
const kini = new Date();
const tahun = ref(kini.getFullYear());
const OPSI_TAHUN = Array.from({ length: 6 }, (_, i) => ({ value: kini.getFullYear() - i, label: String(kini.getFullYear() - i) }));
const periode = ref<any[]>([]);
const atur = ref<any>({});
const ambang = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const [p, a] = await Promise.all([daftarPeriode(tahun.value), ambilPengaturan()]);
    periode.value = p?.payload ?? [];
    atur.value = a?.payload ?? {};
    ambang.value = atur.value.ambangTingkat_2 ?? atur.value.ambangTingkat2 ?? "";
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialog = ref(false);
const kesiapan = ref<any>(null);
const catatan = ref("");
const alasanBuka = ref("");
const bukaKesiapan = async (p: any) => {
  catatan.value = "";
  alasanBuka.value = "";
  kesiapan.value = { ...p, memuat: true };
  dialog.value = true;
  const r = await kesiapanPeriode(p.tahun, p.bulan);
  kesiapan.value = r?.payload ? { ...p, ...r.payload } : null;
};
const tutup = async () => {
  const k = kesiapan.value;
  if (!confirm(`Tutup buku ${k.nama}? Setelah ditutup, jurnal bertanggal di periode ini tidak dapat ditambah atau diubah.`)) return;
  storeUtils.setLoading(true);
  try {
    if (await tutupPeriode({ tahun: k.tahun, bulan: k.bulan, catatan: catatan.value.trim() })) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const buka = async () => {
  const k = kesiapan.value;
  if (!alasanBuka.value.trim()) return alert("Alasan pembukaan kembali wajib diisi");
  storeUtils.setLoading(true);
  try {
    if (await bukaPeriode({ tahun: k.tahun, bulan: k.bulan, alasan: alasanBuka.value.trim() })) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const simpanAmbang = async () => {
  if (await simpanPengaturan({ ambangTingkat_2: String(ambang.value ?? "").trim() || null })) muat();
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Periode & Tutup Buku</h1>
          <CustomSelect v-model="tahun" label="Tahun" :options="OPSI_TAHUN" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" @update:modelValue="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col gap-4">
          <DataTable :value="periode" stripedRows class="text-xs cursor-pointer" @rowClick="bukaKesiapan($event.data)">
            <Column header="Periode" field="nama" headerClass="bg-opensimrs-50" />
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data: p }"><span :class="['px-2 py-0.5 rounded-full', GAYA_STATUS[p.status]]">{{ p.status === "tutup" ? "Tutup" : "Terbuka" }}</span></template>
            </Column>
            <Column header="Jurnal final" field="jurnalFinal" headerClass="bg-opensimrs-50" />
            <Column header="Menunggu" field="jurnalMenunggu" headerClass="bg-opensimrs-50" />
            <Column header="Tertahan" field="eventTertahan" headerClass="bg-opensimrs-50" />
            <Column header="Konflik" field="eventKonflik" headerClass="bg-opensimrs-50" />
            <Column header="Keterangan" headerClass="bg-opensimrs-50">
              <template #body="{ data: p }">
                <span v-if="p.status === 'tutup'">Ditutup {{ p.ditutupOleh }} · {{ waktuAk(p.ditutupPada) }}</span>
                <span v-else-if="p.dibukaPada" class="text-[#B54708]">Dibuka kembali {{ p.dibukaOleh }} · {{ waktuAk(p.dibukaPada) }}: {{ p.alasanBuka }}</span>
              </template>
            </Column>
          </DataTable>

          <div class="p-4 border rounded-md border-grey-100">
            <h3 class="mb-2 font-semibold">Persetujuan Berjenjang</h3>
            <div class="mb-2 text-xs text-grey-400">
              Semua jurnal manual/penyesuaian/koreksi memerlukan persetujuan tingkat 1 oleh pengguna selain pembuat. Jurnal dengan nominal ≥ ambang berikut memerlukan
              persetujuan tingkat 2 oleh pengguna yang berbeda lagi. Kosongkan untuk satu tingkat saja.
              <span v-if="!atur.diatur"> (Saat ini memakai nilai bawaan — perlu ditetapkan kebijakan faskes.)</span>
            </div>
            <div class="flex items-end gap-3">
              <CustomTextfield v-model="ambang" label="Ambang tingkat 2 (Rp)" placeholder="mis. 50000000" :maxLength="20" :disabled="!boleh('PENGATURAN')" />
              <CustomButton v-if="boleh('PENGATURAN')" label="Simpan" icon="PhFloppyDisk" @click="simpanAmbang" />
              <span class="text-xs text-grey-400">Berlaku: {{ ambang ? `Rp ${rupiah(ambang)}` : "satu tingkat" }}<span v-if="atur.diubahOleh"> · diubah {{ atur.diubahOleh }}</span></span>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="860px">
      <template #header>{{ kesiapan?.nama }} — {{ kesiapan?.status === "tutup" ? "Periode Tutup" : "Kesiapan Tutup Buku" }}</template>
      <template #body>
        <div v-if="kesiapan && !kesiapan.memuat" class="flex flex-col gap-4 pt-4 text-sm">
          <div v-for="c in kesiapan.cek" :key="c.kode" class="flex items-center gap-2">
            <component :is="c.lulus ? 'PhCheckCircle' : 'PhXCircle'" :size="18" :class="c.lulus ? 'text-[#027A48]' : 'text-danger-300'" />
            <span>{{ c.nama }}</span><span class="text-xs text-grey-400">({{ c.nilai }})</span>
          </div>
          <div class="text-xs text-grey-400">Jurnal final {{ kesiapan.ringkasan.jurnalFinal }} · total debit {{ rupiah(kesiapan.ringkasan.totalDebit) }} · total kredit {{ rupiah(kesiapan.ringkasan.totalKredit) }}</div>
          <div v-if="kesiapan.belum?.length">
            <h3 class="mb-1 font-semibold">Dokumen sumber belum dijurnal (jalankan Proses Jurnal Otomatis di menu Jurnal)</h3>
            <DataTable :value="kesiapan.belum" class="text-xs" stripedRows scrollable scrollHeight="240px">
              <Column header="Sumber" field="jenisEvent" headerClass="bg-opensimrs-50" />
              <Column header="Dokumen" field="sumberNomor" headerClass="bg-opensimrs-50" />
              <Column header="Tanggal" headerClass="bg-opensimrs-50"><template #body="{ data: b }">{{ tanggalAk(b.tanggal) }}</template></Column>
              <Column header="Nilai" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: b }">{{ rupiah(b.nilai) }}</template></Column>
              <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: b }">{{ b.statusEvent ?? "belum diproses" }}</template></Column>
            </DataTable>
          </div>
          <CustomTextArea v-if="kesiapan.status !== 'tutup' && boleh('TUTUP BUKU')" v-model="catatan" label="Catatan tutup buku (opsional)" />
          <CustomTextArea v-if="kesiapan.status === 'tutup' && boleh('BUKA KEMBALI')" v-model="alasanBuka" label="Alasan membuka kembali periode (wajib, tercatat di Audit Trail)" />
        </div>
        <div v-else class="pt-4 text-sm text-grey-400">Memeriksa…</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup Dialog" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton v-if="kesiapan?.status === 'tutup' && boleh('BUKA KEMBALI')" label="Buka Kembali" icon="PhLockOpen" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="buka" />
          <CustomButton v-if="kesiapan && kesiapan.status !== 'tutup' && boleh('TUTUP BUKU')" label="Tutup Buku" icon="PhLock" :disabled="!kesiapan.siap" @click="tutup" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
