<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { daftarInstrumen, hapusInstrumen, hapusSimpul, imporInstrumen, izinMutu, simpanInstrumen, strukturInstrumen, tambahSimpul, ubahSimpul } from "@/stores/penunjang/mutu";

// Instrumen akreditasi milik faskes (KF-2, KT-1..3): instrumen → bab → standar → elemen penilaian. Sistem tidak
// menyediakan isi instrumen; pengguna mengisi manual atau mengimpor CSV (kolom bab_kode, bab_nama, standar_kode,
// standar_nama, elemen_kode, elemen_uraian). Baris impor tanpa bab/standar induk ditolak dengan nomor barisnya.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinMutu("Instrumen Akreditasi", aksi);

const daftar = ref<any[]>([]);
const terpilih = ref<any>(null);
const struktur = ref<any>(null);
const terbuka = ref<string[]>([]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarInstrumen({ limit: 200 });
    daftar.value = res?.payload?.data ?? [];
    if (terpilih.value) {
      const ada = daftar.value.find((x) => x.uuid === terpilih.value.uuid);
      if (ada) await pilih(ada);
      else {
        terpilih.value = null;
        struktur.value = null;
      }
    } else if (daftar.value.length) await pilih(daftar.value[0]);
  } finally {
    storeUtils.setLoading(false);
  }
};
const pilih = async (ins: any) => {
  terpilih.value = ins;
  const res = await strukturInstrumen(ins.uuid);
  struktur.value = res?.payload ?? null;
};
const muatStruktur = async () => {
  if (terpilih.value) await pilih(terpilih.value);
};
const toggle = (uuid: string) => (terbuka.value = terbuka.value.includes(uuid) ? terbuka.value.filter((x) => x !== uuid) : [...terbuka.value, uuid]);

// ── Instrumen
const dialogInstrumen = ref(false);
const formInstrumen = ref<any>({});
const galat = ref("");
const bukaInstrumen = (ins?: any) => {
  galat.value = "";
  formInstrumen.value = ins
    ? { uuid: ins.uuid, kode: ins.kode ?? "", nama: ins.nama, periode: ins.periode ?? "", keterangan: ins.keterangan ?? "", aktif: ins.aktif }
    : { kode: "", nama: "", periode: "", keterangan: "", aktif: true };
  dialogInstrumen.value = true;
};
const simpanFormInstrumen = async () => {
  const f = formInstrumen.value;
  if (!f.nama.trim()) return (galat.value = "Nama instrumen wajib diisi");
  const res = await simpanInstrumen({ kode: f.kode.trim(), nama: f.nama.trim(), periode: f.periode.trim(), keterangan: f.keterangan.trim(), aktif: f.aktif }, f.uuid);
  if (res) {
    dialogInstrumen.value = false;
    if (!f.uuid) terpilih.value = res.payload;
    muat();
  }
};
const hapusIns = async (ins: any) => {
  if (!confirm(`Hapus instrumen "${ins.nama}" beserta seluruh bab, standar, dan elemennya?`)) return;
  if (await hapusInstrumen(ins.uuid)) {
    terpilih.value = null;
    struktur.value = null;
    muat();
  }
};

// ── Bab / standar / elemen
const JUDUL: Record<string, string> = { bab: "Bab", standar: "Standar", elemen: "Elemen Penilaian" };
const dialogSimpul = ref(false);
const formSimpul = ref<any>({});
const bukaSimpul = (tingkat: string, opsi: { indukUuid?: string; data?: any }) => {
  galat.value = "";
  const d = opsi.data;
  formSimpul.value = { tingkat, indukUuid: opsi.indukUuid, uuid: d?.uuid, kode: d?.kode ?? "", isi: (tingkat === "elemen" ? d?.uraian : d?.nama) ?? "", urutan: d?.urutan ?? null };
  dialogSimpul.value = true;
};
const simpanSimpul = async () => {
  const f = formSimpul.value;
  if (!f.kode.trim() || !f.isi.trim()) return (galat.value = `Kode dan ${f.tingkat === "elemen" ? "uraian" : "nama"} wajib diisi`);
  const data = { kode: f.kode.trim(), [f.tingkat === "elemen" ? "uraian" : "nama"]: f.isi.trim(), urutan: f.urutan ?? undefined };
  const res = f.uuid ? await ubahSimpul(f.tingkat, f.uuid, data) : await tambahSimpul(f.tingkat, f.indukUuid, data);
  if (res) {
    dialogSimpul.value = false;
    if (f.indukUuid && !terbuka.value.includes(f.indukUuid)) terbuka.value.push(f.indukUuid);
    muatStruktur();
  }
};
const hapus = async (tingkat: string, d: any) => {
  if (!confirm(`Hapus ${JUDUL[tingkat].toLowerCase()} ${d.kode}${tingkat === "elemen" ? "" : " beserta isinya"}?`)) return;
  if (await hapusSimpul(tingkat, d.uuid)) muatStruktur();
};

// ── Impor CSV
const dialogImpor = ref(false);
const isiCsv = ref("");
const namaBerkasCsv = ref("");
const hasilImpor = ref<any>(null);
const CONTOH = "bab_kode,bab_nama,standar_kode,standar_nama,elemen_kode,elemen_uraian\nBAB-1,Bab Contoh,STD-1.1,Standar Contoh,EP-1.1.1,Uraian elemen contoh";
const bukaImpor = () => {
  isiCsv.value = "";
  namaBerkasCsv.value = "";
  hasilImpor.value = null;
  dialogImpor.value = true;
};
const pilihCsv = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = "";
  if (!f) return;
  if (f.size > 5 * 1024 * 1024) return alert("Berkas CSV maksimal 5 MB");
  namaBerkasCsv.value = f.name;
  isiCsv.value = await f.text();
  hasilImpor.value = null;
};
const jalankanImpor = async (hanyaValidasi: boolean) => {
  if (!isiCsv.value.trim() || !terpilih.value) return;
  storeUtils.setLoading(true);
  try {
    const res = await imporInstrumen(terpilih.value.uuid, isiCsv.value, hanyaValidasi);
    if (res?.payload) {
      hasilImpor.value = res.payload;
      if (res.payload.disimpan) muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-hidden" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Instrumen Akreditasi</h1>
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Tambah Instrumen" @click="bukaInstrumen()" />
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="!daftar.length" class="p-6 text-sm text-grey-400">
          Faskes belum memiliki instrumen akreditasi. Tambahkan instrumen yang dipakai faskes, lalu isi atau impor bab, standar, dan elemen penilaiannya.
          Sistem tidak menyediakan isi instrumen bawaan.
        </div>
        <div v-else class="flex h-full gap-4 overflow-hidden">
          <div class="flex flex-col flex-none gap-2 pr-1 overflow-auto w-72">
            <div
              v-for="ins in daftar"
              :key="ins.uuid"
              class="p-3 border rounded-lg cursor-pointer"
              :class="terpilih?.uuid === ins.uuid ? 'border-opensimrs-300 bg-opensimrs-50' : 'border-grey-100 hover:bg-grey-50'"
              @click="pilih(ins)"
            >
              <div class="text-sm font-semibold">{{ ins.nama }}</div>
              <div class="text-xs text-grey-400">{{ [ins.kode, ins.periode].filter(Boolean).join(" · ") || "Tanpa kode" }}</div>
              <div class="flex items-center justify-between mt-1 text-xs">
                <span>{{ ins.jumlahBab }} bab · {{ ins.jumlahElemen }} elemen</span>
                <span :class="ins.aktif ? 'text-success-300' : 'text-grey-400'">{{ ins.aktif ? "Aktif" : "Nonaktif" }}</span>
              </div>
            </div>
          </div>

          <div v-if="struktur" class="flex flex-col overflow-hidden grow">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-grey-100">
              <div>
                <div class="font-semibold">{{ struktur.instrumen.nama }}</div>
                <div class="text-xs text-grey-400">{{ struktur.instrumen.keterangan || "" }}</div>
              </div>
              <div class="flex gap-2">
                <CustomButton v-if="boleh('UPDATE')" label="Ubah" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaInstrumen(struktur.instrumen)" />
                <CustomButton v-if="boleh('DELETE')" label="Hapus" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapusIns(struktur.instrumen)" />
                <CustomButton v-if="boleh('IMPORT')" label="Impor CSV" icon="PhUploadSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaImpor" />
                <CustomButton v-if="boleh('CREATE')" label="Tambah Bab" icon="PhPlus" size="small" @click="bukaSimpul('bab', { indukUuid: struktur.instrumen.uuid })" />
              </div>
            </div>
            <div class="py-2 overflow-auto grow">
              <div v-if="!struktur.bab.length" class="p-4 text-sm text-grey-400">Instrumen belum memiliki bab. Tambahkan bab atau impor dari CSV.</div>
              <div v-for="bab in struktur.bab" :key="bab.uuid" class="mb-1 border rounded-lg border-grey-100">
                <div class="flex items-center gap-2 px-3 py-2 bg-grey-50">
                  <button class="flex items-center gap-2 text-sm font-semibold text-left grow" @click="toggle(bab.uuid)">
                    <i :class="terbuka.includes(bab.uuid) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" class="text-xs"></i>{{ bab.kode }} — {{ bab.nama }}
                    <span class="text-xs font-normal text-grey-400">({{ bab.standar.length }} standar)</span>
                  </button>
                  <CustomButton v-if="boleh('CREATE')" label="Standar" icon="PhPlus" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaSimpul('standar', { indukUuid: bab.uuid })" />
                  <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaSimpul('bab', { data: bab })" />
                  <CustomButton v-if="boleh('DELETE')" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapus('bab', bab)" />
                </div>
                <div v-if="terbuka.includes(bab.uuid)" class="pl-6 pr-3">
                  <div v-if="!bab.standar.length" class="py-2 text-xs text-grey-400">Belum ada standar.</div>
                  <div v-for="s in bab.standar" :key="s.uuid" class="py-1 border-b border-grey-100 last:border-0">
                    <div class="flex items-center gap-2">
                      <button class="flex items-center gap-2 text-sm text-left grow" @click="toggle(s.uuid)">
                        <i :class="terbuka.includes(s.uuid) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" class="text-xs"></i>{{ s.kode }} — {{ s.nama }}
                        <span class="text-xs text-grey-400">({{ s.elemen.length }} elemen)</span>
                      </button>
                      <CustomButton v-if="boleh('CREATE')" label="Elemen" icon="PhPlus" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaSimpul('elemen', { indukUuid: s.uuid })" />
                      <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaSimpul('standar', { data: s })" />
                      <CustomButton v-if="boleh('DELETE')" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapus('standar', s)" />
                    </div>
                    <div v-if="terbuka.includes(s.uuid)" class="pl-6">
                      <div v-if="!s.elemen.length" class="py-1 text-xs text-grey-400">Belum ada elemen penilaian.</div>
                      <div v-for="e in s.elemen" :key="e.uuid" class="flex items-start gap-2 py-1 text-xs">
                        <span class="font-semibold whitespace-nowrap">{{ e.kode }}</span>
                        <span class="grow">{{ e.uraian }}</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" :class="e.adaBukti ? 'bg-[#D1FADF] text-[#027A48]' : 'bg-[#FDE2E1] text-[#B42318]'">
                          {{ e.adaBukti ? "Ada bukti" : "Tanpa bukti" }}
                        </span>
                        <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaSimpul('elemen', { data: e })" />
                        <CustomButton v-if="boleh('DELETE')" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapus('elemen', e)" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <NoData v-else class="grow" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogInstrumen" width="560px">
      <template #header>{{ formInstrumen.uuid ? "Ubah" : "Tambah" }} Instrumen</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="formInstrumen.nama" label="Nama Instrumen" class="col-span-2" :maxLength="255" required />
          <CustomTextfield v-model="formInstrumen.kode" label="Kode" :maxLength="50" />
          <CustomTextfield v-model="formInstrumen.periode" label="Versi / Periode" :maxLength="50" />
          <CustomTextArea v-model="formInstrumen.keterangan" label="Keterangan" class="col-span-2" />
          <label class="flex items-center col-span-2 gap-2 text-sm"><Checkbox v-model="formInstrumen.aktif" binary /> Instrumen aktif (dihitung di dasbor kesiapan)</label>
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogInstrumen = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanFormInstrumen" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogSimpul" width="560px">
      <template #header>{{ formSimpul.uuid ? "Ubah" : "Tambah" }} {{ JUDUL[formSimpul.tingkat] }}</template>
      <template #body>
        <div class="grid grid-cols-3 gap-4 pt-4">
          <CustomTextfield v-model="formSimpul.kode" label="Kode" class="col-span-2" :maxLength="50" required />
          <CustomInputNumber v-model="formSimpul.urutan" label="Urutan" :min="0" />
          <CustomTextArea v-if="formSimpul.tingkat === 'elemen'" v-model="formSimpul.isi" label="Uraian Elemen Penilaian" class="col-span-3" required />
          <CustomTextfield v-else v-model="formSimpul.isi" label="Nama" class="col-span-3" :maxLength="255" required />
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogSimpul = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanSimpul" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogImpor" width="760px">
      <template #header>Impor Instrumen dari CSV — {{ terpilih?.nama }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4 text-sm">
          <div class="text-xs text-grey-400">
            Kolom wajib (baris pertama): <code>bab_kode, bab_nama, standar_kode, standar_nama, elemen_kode, elemen_uraian</code>. Pemisah koma atau titik koma.
            Bab/standar dengan kode yang sama dipakai ulang; elemen dengan kode yang sama diperbarui uraiannya. Baris tanpa bab atau standar induk ditolak.
          </div>
          <pre class="p-2 overflow-auto text-[11px] rounded bg-grey-50">{{ CONTOH }}</pre>
          <label class="text-sm cursor-pointer text-opensimrs-300">
            + Pilih berkas CSV{{ namaBerkasCsv ? ` (${namaBerkasCsv})` : "" }}
            <input type="file" class="hidden" accept=".csv,text/csv" @change="pilihCsv" />
          </label>
          <CustomTextArea v-model="isiCsv" label="Isi CSV" height="h-[140px]" />
          <div v-if="hasilImpor" class="p-3 border rounded-lg border-grey-100">
            <div class="font-semibold">{{ hasilImpor.disimpan ? "Impor tersimpan" : "Hasil validasi (belum disimpan)" }}</div>
            <div class="text-xs">
              {{ hasilImpor.totalBaris }} baris · {{ hasilImpor.barisValid }} valid · {{ hasilImpor.ditolak.length }} ditolak
              <template v-if="hasilImpor.disimpan"> · bab baru {{ hasilImpor.bab }}, standar baru {{ hasilImpor.standar }}, elemen baru {{ hasilImpor.elemenBaru }}, diperbarui {{ hasilImpor.elemenDiperbarui }}</template>
            </div>
            <div v-if="hasilImpor.ditolak.length" class="mt-2 overflow-auto max-h-40">
              <div v-for="d in hasilImpor.ditolak" :key="d.baris" class="text-xs text-danger-300">Baris {{ d.baris }}: {{ d.alasan }}</div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogImpor = false" />
          <CustomButton label="Validasi" icon="PhCheck" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="!isiCsv.trim()" @click="jalankanImpor(true)" />
          <CustomButton label="Impor" icon="PhUploadSimple" :disabled="!isiCsv.trim()" @click="jalankanImpor(false)" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
