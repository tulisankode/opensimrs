<script setup lang="ts">
import { computed, ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import { utilsStore } from "@/stores/utils";
import { getLoginUsername } from "@/utils/permissions";
import BarisJurnalEditor from "./BarisJurnalEditor.vue";
import {
  GAYA_STATUS,
  JENIS_JURNAL,
  STATUS_JURNAL,
  batalkanJurnal,
  detailJurnal,
  epochHari,
  izinAkuntansi,
  koreksiJurnal,
  rupiah,
  setujuiJurnal,
  tanggalAk,
  tolakJurnal,
  waktuAk,
} from "@/stores/penunjang/akuntansi";

// Detail jurnal (dipakai Jurnal, Persetujuan, Buku Besar): baris, jejak persetujuan, event & dokumen sumber, koreksi.
// Aksi mengikuti izin & status; pembuat tidak melihat tombol Setujui/Tolak (backend juga menolak, KF-8).
const props = defineProps<{ uuid: string | null; referensi?: any; akun?: any[]; modePersetujuan?: boolean }>();
const visible = defineModel<boolean>("visible", { default: false });
const emit = defineEmits(["berubah"]);
const storeUtils = utilsStore();
const j = ref<any>(null);
const pengguna = computed(() => getLoginUsername().toLowerCase());
const pembuat = computed(() => String(j.value?.dibuatOleh ?? "").toLowerCase() === pengguna.value && !!pengguna.value);

const muat = async () => {
  if (!props.uuid) return;
  const r = await detailJurnal(props.uuid);
  j.value = r?.payload ?? null;
};
watch(() => [props.uuid, visible.value], () => visible.value && muat(), { immediate: true });

const aksi = async (fn: () => Promise<any>) => {
  storeUtils.setLoading(true);
  try {
    const r = await fn();
    if (r) {
      await muat();
      emit("berubah");
    }
    return r;
  } finally {
    storeUtils.setLoading(false);
  }
};
const catatan = ref("");
const alasanTolak = ref("");
const setujui = () => aksi(() => setujuiJurnal(j.value.uuid, catatan.value.trim()));
const tolak = () => {
  if (!alasanTolak.value.trim()) return alert("Alasan penolakan wajib diisi");
  return aksi(() => tolakJurnal(j.value.uuid, alasanTolak.value.trim()));
};
const batalkan = () => confirm(`Batalkan jurnal ${j.value.nomor}?`) && aksi(() => batalkanJurnal(j.value.uuid));
const tingkatBerikut = computed(() => Number(j.value?.tingkatDisetujui ?? 0) + 1);
const bolehSetujui = computed(() => j.value?.status === "menunggu" && !pembuat.value && izinAkuntansi("Persetujuan Jurnal", tingkatBerikut.value === 1 ? "SETUJUI" : "SETUJUI TINGKAT 2"));

// Koreksi: pembalik otomatis + baris pengganti opsional.
const dialogKoreksi = ref(false);
const formKoreksi = ref<any>({ tanggal: new Date(), alasan: "", baris: [] });
const editor = ref<any>();
const galatKoreksi = ref("");
const bukaKoreksi = () => {
  galatKoreksi.value = "";
  formKoreksi.value = { tanggal: new Date(), alasan: "", baris: [] };
  dialogKoreksi.value = true;
};
const tambahPengganti = () => (formKoreksi.value.baris = [{ akunUuid: "", debit: "", kredit: "", uraian: "" }, { akunUuid: "", debit: "", kredit: "", uraian: "" }]);
const simpanKoreksi = async () => {
  const f = formKoreksi.value;
  galatKoreksi.value = "";
  if (!f.alasan.trim() || !f.tanggal) return (galatKoreksi.value = "Tanggal dan alasan koreksi wajib diisi");
  if (f.baris.length && !editor.value?.seimbang()) return (galatKoreksi.value = "Baris pengganti harus seimbang");
  const r = await aksi(() =>
    koreksiJurnal(j.value.uuid, {
      tanggal: epochHari(f.tanggal),
      alasan: f.alasan.trim(),
      barisPengganti: f.baris.map((b: any) => ({ akunUuid: b.akunUuid, debit: b.debit || 0, kredit: b.kredit || 0, uraian: b.uraian, penjaminUuid: b.penjaminUuid || null, supplierUuid: b.supplierUuid || null })),
    }),
  );
  if (r) dialogKoreksi.value = false;
};
</script>

<template>
  <CustomDialog v-model:visible="visible" width="980px">
    <template #header>Jurnal {{ j?.nomor }}</template>
    <template #body>
      <div v-if="j" class="flex flex-col gap-4 pt-4 text-sm">
        <div class="grid grid-cols-3 gap-x-6 gap-y-1">
          <div><span class="text-grey-400">Tanggal:</span> {{ tanggalAk(j.tanggal) }}</div>
          <div><span class="text-grey-400">Jenis:</span> {{ JENIS_JURNAL[j.jenis] ?? j.jenis }}<span v-if="j.namaEvent"> · {{ j.namaEvent }}</span></div>
          <div>
            <span class="text-grey-400">Status:</span>
            <span :class="['ml-1 px-2 py-0.5 rounded-full text-xs', GAYA_STATUS[j.status]]">{{ STATUS_JURNAL[j.status] ?? j.status }}</span>
          </div>
          <div class="col-span-3"><span class="text-grey-400">Uraian:</span> {{ j.uraian || "-" }}</div>
          <div v-if="j.alasan" class="col-span-3"><span class="text-grey-400">Alasan:</span> {{ j.alasan }}</div>
          <div v-if="j.sumberTabel" class="col-span-3">
            <span class="text-grey-400">Dokumen sumber:</span> {{ j.sumberTabel }} · {{ j.sumberNomor || "-" }}
            <span class="text-xs text-grey-400">({{ j.sumberUuid }})</span>
            <span v-if="j.event" :class="['ml-2 px-2 py-0.5 rounded-full text-xs', GAYA_STATUS[j.event.status]]">event {{ j.event.status }}</span>
          </div>
          <div v-if="j.event?.status === 'konflik'" class="col-span-3 text-danger-300">{{ j.event.alasan }}</div>
          <div v-if="j.referensi" class="col-span-3"><span class="text-grey-400">Referensi:</span> {{ j.referensi }}</div>
          <div v-if="j.jurnalAsal" class="col-span-3"><span class="text-grey-400">Mengoreksi:</span> {{ j.jurnalAsal.nomor }} ({{ tanggalAk(j.jurnalAsal.tanggal) }})</div>
          <div v-for="k in j.koreksi" :key="k.uuid" class="col-span-3 text-[#B54708]">Dikoreksi oleh {{ k.nomor }} ({{ STATUS_JURNAL[k.status] }}) — {{ k.alasan }}</div>
          <div><span class="text-grey-400">Dibuat:</span> {{ j.dibuatOleh || "sistem" }} · {{ waktuAk(j.createdAt) }}</div>
          <div v-if="j.jenis !== 'otomatis'"><span class="text-grey-400">Persetujuan:</span> {{ j.tingkatDisetujui }} / {{ j.tingkatWajib }} tingkat</div>
          <div v-if="j.status === 'ditolak'" class="text-danger-300">Ditolak {{ j.ditolakOleh }}: {{ j.alasanTolak }}</div>
        </div>
        <DataTable :value="j.baris" class="text-xs" stripedRows>
          <Column header="Akun" headerClass="bg-opensimrs-50"><template #body="{ data: b }">{{ b.kodeAkun }} — {{ b.namaAkun }}</template></Column>
          <Column header="Uraian / Dimensi" headerClass="bg-opensimrs-50">
            <template #body="{ data: b }">{{ [b.uraian, b.komponen, b.namaPenjamin, b.namaSupplier].filter(Boolean).join(" · ") || "-" }}</template>
          </Column>
          <Column header="Debit" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: b }">{{ Number(b.debit) ? rupiah(b.debit) : "" }}</template></Column>
          <Column header="Kredit" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: b }">{{ Number(b.kredit) ? rupiah(b.kredit) : "" }}</template></Column>
        </DataTable>
        <div class="flex justify-end gap-6 font-semibold">
          <span>Total debit {{ rupiah(j.totalDebit) }}</span><span>Total kredit {{ rupiah(j.totalKredit) }}</span>
        </div>
        <div v-if="j.persetujuan?.length">
          <h3 class="mb-1 font-semibold">Jejak Persetujuan</h3>
          <div v-for="(p, i) in j.persetujuan" :key="i" class="text-xs">
            Tingkat {{ p.tingkat }} · <b>{{ p.keputusan === "setuju" ? "Disetujui" : "Ditolak" }}</b> oleh {{ p.oleh }} · {{ waktuAk(p.createdAt) }}<span v-if="p.alasan"> — {{ p.alasan }}</span>
          </div>
        </div>
        <div v-if="bolehSetujui || (j.status === 'menunggu' && !pembuat && izinAkuntansi('Persetujuan Jurnal', 'TOLAK'))" class="grid grid-cols-2 gap-4 p-3 rounded-md bg-opensimrs-50">
          <div v-if="bolehSetujui" class="flex flex-col gap-2">
            <CustomTextArea v-model="catatan" label="Catatan persetujuan (opsional)" />
            <CustomButton :label="`Setujui (tingkat ${tingkatBerikut})`" icon="PhCheck" @click="setujui" />
          </div>
          <div v-if="izinAkuntansi('Persetujuan Jurnal', 'TOLAK')" class="flex flex-col gap-2">
            <CustomTextArea v-model="alasanTolak" label="Alasan penolakan" />
            <CustomButton label="Tolak" icon="PhX" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="tolak" />
          </div>
        </div>
        <div v-else-if="j.status === 'menunggu' && pembuat" class="text-xs text-grey-400">Anda pembuat jurnal ini; persetujuan harus diberikan pengguna lain.</div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <CustomButton v-if="j?.status === 'menunggu' && pembuat" label="Batalkan Jurnal" icon="PhProhibit" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="batalkan" />
        <CustomButton v-if="j?.status === 'final' && !modePersetujuan && izinAkuntansi('Jurnal', 'KOREKSI')" label="Koreksi" icon="PhArrowCounterClockwise" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaKoreksi" />
        <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="visible = false" />
      </div>
    </template>
  </CustomDialog>

  <CustomDialog v-model:visible="dialogKoreksi" width="980px">
    <template #header>Koreksi Jurnal {{ j?.nomor }}</template>
    <template #body>
      <div class="flex flex-col gap-4 pt-4 text-sm">
        <div class="text-xs text-grey-400">
          Jurnal asal tidak diubah. Sistem membuat jurnal koreksi berisi baris pembalik seluruh jurnal asal, ditambah baris pengganti (opsional), pada tanggal di
          periode yang masih terbuka. Jurnal koreksi melalui persetujuan seperti jurnal manual.
        </div>
        <div class="grid grid-cols-3 gap-4">
          <CustomDatePicker v-model="formKoreksi.tanggal" label="Tanggal koreksi" />
          <CustomTextArea v-model="formKoreksi.alasan" label="Alasan koreksi" class="col-span-2" required />
        </div>
        <BarisJurnalEditor v-if="formKoreksi.baris.length" ref="editor" v-model="formKoreksi.baris" :akun="akun ?? []" :penjamin="referensi?.penjamin ?? []" :supplier="referensi?.supplier ?? []" />
        <CustomButton v-else label="Tambah Baris Pengganti" icon="PhPlus" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" class="self-start" @click="tambahPengganti" />
        <div v-if="galatKoreksi" class="text-sm text-danger-300">{{ galatKoreksi }}</div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogKoreksi = false" />
        <CustomButton label="Ajukan Koreksi" icon="PhFloppyDisk" @click="simpanKoreksi" />
      </div>
    </template>
  </CustomDialog>
</template>
