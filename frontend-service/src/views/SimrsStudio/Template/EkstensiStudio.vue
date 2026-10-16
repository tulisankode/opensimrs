<script setup lang="ts">
// Ekstensi tanpa kode (rancangan §7.8): laporan (SELECT tervalidasi), template cetak, formulir tambahan.
// Dirakit agen AI atau disunting manual → pratinjau → pasang. Paket bertanda tangan diekspor untuk instalasi produksi.
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiEkstensi } from "@/utils/apiHandler";
import { useSimrsStudioStore } from "@/stores/simrsStudio";
import PanelTugas from "../Komponen/PanelTugas.vue";
import { formatWaktu } from "../umum";

const studio = useSimrsStudioStore();
const daftar = ref<any[]>([]);
const dipilih = ref<any>(null);
const sibuk = ref(false);

const muat = async () => {
  daftar.value = (await apiEkstensi("studio", "get", "/ekstensi"))?.payload ?? [];
  if (dipilih.value) dipilih.value = daftar.value.find((e) => e.uuid === dipilih.value.uuid) ?? null;
};
onMounted(muat);

const fiturMati = computed(() => studio.status.fitur?.ekstensi === false);

// Rakit dengan AI
const permintaan = ref("");
const tugasRakit = ref<string | null>(null);
const rakit = async (uuid?: string) => {
  sibuk.value = true;
  const res = await apiEkstensi("studio", "post", "/ekstensi/rakit", { permintaan: permintaan.value, uuid });
  sibuk.value = false;
  if (res?.payload?.uuid) tugasRakit.value = res.payload.uuid;
};
const selesaiRakit = async () => {
  await muat();
  permintaan.value = "";
};

// Editor JSON
const dialogEditor = ref(false);
const teksJson = ref("");
const CONTOH = {
  kode: "kunjungan_per_status",
  jenis: "laporan",
  nama: "Kunjungan rawat jalan per status",
  deskripsi: "Jumlah kunjungan RJ per status sejak tanggal tertentu",
  versi: "1.0.0",
  definisi: {
    sql: "SELECT r.status_rj, COUNT(*)::int AS jumlah FROM rawat_jalans r WHERE r.faskes_uuid = :faskes_uuid AND r.created_at >= :mulai GROUP BY r.status_rj ORDER BY r.status_rj",
    parameter: [{ nama: "mulai", label: "Dari tanggal", tipe: "tanggal", wajib: true }],
    kolom: [{ field: "status_rj", label: "Status" }, { field: "jumlah", label: "Jumlah", format: "angka" }],
  },
};
const bukaEditor = (e?: any) => {
  teksJson.value = JSON.stringify(e ? { kode: e.kode, jenis: e.jenis, nama: e.nama, deskripsi: e.deskripsi, versi: e.versi, definisi: e.definisi } : CONTOH, null, 2);
  dialogEditor.value = true;
};
const galatJson = ref("");
const simpanJson = async () => {
  galatJson.value = "";
  let ekstensi;
  try {
    ekstensi = JSON.parse(teksJson.value);
  } catch (e: any) {
    galatJson.value = `JSON tidak valid: ${e.message}`;
    return;
  }
  sibuk.value = true;
  const res = await apiEkstensi("studio", "post", "/ekstensi", { ekstensi });
  sibuk.value = false;
  if (res) {
    dialogEditor.value = false;
    await muat();
    dipilih.value = daftar.value.find((x) => x.kode === ekstensi.kode) ?? null;
  }
};

// Pratinjau
const parameter = ref<Record<string, any>>({});
const hasil = ref<any>(null);
const tanggalKeEpoch = (v: string) => (v ? Math.floor(new Date(`${v}T00:00:00`).getTime() / 1000) : "");
const pratinjau = async () => {
  const nilai = Object.fromEntries(
    (dipilih.value?.definisi?.parameter ?? []).map((p: any) => [p.nama, p.tipe === "tanggal" ? tanggalKeEpoch(parameter.value[p.nama]) : parameter.value[p.nama]]),
  );
  sibuk.value = true;
  hasil.value = (await apiEkstensi("studio", "post", `/ekstensi/${dipilih.value.uuid}/pratinjau`, { parameter: nilai }, true))?.payload ?? null;
  sibuk.value = false;
};

const aksi = async (nama: string, metode: "post" | "delete" = "post") => {
  sibuk.value = true;
  await apiEkstensi("studio", metode, metode === "delete" ? `/ekstensi/${dipilih.value.uuid}` : `/ekstensi/${dipilih.value.uuid}/${nama}`, {});
  sibuk.value = false;
  if (metode === "delete") dipilih.value = null;
  await muat();
};

const ekspor = async () => {
  const res = await apiEkstensi("studio", "get", `/ekstensi/${dipilih.value.uuid}/paket`);
  if (!res?.payload) return;
  const blob = new Blob([JSON.stringify(res.payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ekstensi-${dipilih.value.kode}-${dipilih.value.versi}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

const WARNA: Record<string, string> = { terpasang: "bg-success-50 text-success-400", draf: "bg-warning-50 text-warning-400", dicopot: "bg-grey-75 text-grey-400" };
const JENIS: Record<string, string> = { laporan: "Laporan", cetak: "Template cetak", formulir: "Formulir" };
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full" class="h-full">
    <template #header>
      <PageToolbar>
        <h1 class="toolbar-heading text-opensimrs-300">Ekstensi tanpa kode</h1>
        <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" v-if="studio.boleh('Ekstensi', 'CREATE')" label="Sunting JSON" icon="PhBracketsCurly" outlined :disabled="fiturMati" @click="bukaEditor()" />
      </PageToolbar>
    </template>
    <template #content>
      <div v-if="fiturMati" class="mb-3 rounded-lg bg-warning-50 p-3 text-XS text-warning-400">Fitur Ekstensi belum diaktifkan superadmin (Pengaturan & Agen › Fitur Studio).</div>
      <div class="mb-3 flex items-start gap-2 rounded-lg bg-info-50 p-3 text-XS text-info-400">
        <PhInfo :size="18" class="shrink-0" aria-hidden="true" />
        <span>
          Ekstensi tidak menjalankan kode bebas: laporan & template cetak berupa kueri <b>SELECT</b> yang divalidasi (wajib filter
          <code>:faskes_uuid</code>, tanpa tabel akun/rahasia) dan dijalankan <b>read-only</b> dengan batas waktu. Ekstensi terpasang muncul di menu
          <b>Ekstensi</b>. Untuk produksi: ekspor paket bertanda tangan, lalu impor di Setting › Ekstensi pada instalasi produksi.
        </span>
      </div>

      <div v-if="studio.boleh('Ekstensi', 'CREATE') && !fiturMati" class="mb-4 flex flex-col gap-2 rounded-lg border border-grey-200 p-3">
        <div class="flex items-center gap-2 text-SM font-semibold text-grey-500"><PhSparkle :size="18" class="text-opensimrs-300" aria-hidden="true" /> Rakit dengan AI</div>
        <textarea v-model="permintaan" rows="3" class="rounded-lg border border-grey-200 px-3 py-2 text-SM" placeholder="Mis.: Laporan jumlah kunjungan rawat jalan per penjamin per bulan, bisa difilter rentang tanggal. / Formulir skrining gizi per kunjungan: berat badan, tinggi badan, risiko (rendah/tinggi)." />
        <div class="flex justify-end gap-2">
          <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" v-if="dipilih" :label="`Revisi ${dipilih.kode} dengan AI`" outlined :disabled="sibuk || !permintaan.trim() || !!tugasRakit" @click="rakit(dipilih.uuid)" />
          <CustomButton label="Rakit ekstensi baru" icon="PhSparkle" :disabled="sibuk || !permintaan.trim() || !!tugasRakit" @click="rakit()" />
        </div>
        <PanelTugas v-if="tugasRakit" :tugas-uuid="tugasRakit" judul="Agen merakit ekstensi" @selesai="selesaiRakit" />
        <button v-if="tugasRakit" type="button" class="self-end text-XS text-grey-400 underline" @click="tugasRakit = null">Tutup log</button>
      </div>

      <div class="grid grid-cols-1 gap-3 xl:grid-cols-[360px_1fr]">
        <div class="flex flex-col gap-2">
          <button
            v-for="e in daftar"
            :key="e.uuid"
            type="button"
            class="flex flex-col gap-1 rounded-lg border p-3 text-left"
            :class="dipilih?.uuid === e.uuid ? 'border-opensimrs-300 bg-opensimrs-50' : 'border-grey-200'"
            @click="(dipilih = e), (hasil = null), (parameter = {})"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-SM font-semibold text-grey-500">{{ e.nama }}</span>
              <span class="rounded px-1.5 text-[10px] font-semibold" :class="WARNA[e.status]">{{ e.status }}</span>
            </div>
            <div class="text-[11px] text-grey-400">{{ JENIS[e.jenis] }} · {{ e.kode }} · v{{ e.versi }} · {{ e.sumber }}</div>
          </button>
          <div v-if="!daftar.length" class="rounded-lg border border-dashed border-grey-200 p-6 text-center text-XS text-grey-300">Belum ada ekstensi.</div>
        </div>

        <div v-if="dipilih" class="flex min-w-0 flex-col gap-3 rounded-lg border border-grey-200 p-3">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div class="text-normal font-semibold text-grey-500">{{ dipilih.nama }}</div>
              <div class="text-XS text-grey-400">{{ dipilih.deskripsi }}</div>
              <div v-if="dipilih.dipasang_pada" class="text-[11px] text-grey-300">Dipasang {{ dipilih.dipasang_oleh }} · {{ formatWaktu(dipilih.dipasang_pada) }}</div>
            </div>
            <div class="flex flex-wrap gap-2">
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" v-if="studio.boleh('Ekstensi', 'CREATE')" label="Sunting" icon="PhPencilSimple" outlined @click="bukaEditor(dipilih)" />
              <CustomButton v-if="dipilih.status !== 'terpasang' && studio.boleh('Ekstensi', 'PASANG')" label="Pasang" icon="PhPlugsConnected" :disabled="sibuk || fiturMati" @click="aksi('pasang')" />
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" v-if="dipilih.status === 'terpasang' && studio.boleh('Ekstensi', 'COPOT')" label="Copot" outlined :disabled="sibuk" @click="aksi('copot')" />
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" v-if="studio.boleh('Ekstensi', 'PASANG')" label="Ekspor paket" icon="PhDownloadSimple" outlined :disabled="sibuk" @click="ekspor" />
              <CustomButton v-if="dipilih.status !== 'terpasang' && studio.boleh('Ekstensi', 'COPOT')" label="Hapus" outlined text-color="text-danger-300" border-color="border-danger-300" :disabled="sibuk" @click="aksi('', 'delete')" />
            </div>
          </div>

          <template v-if="dipilih.jenis !== 'formulir'">
            <pre class="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-grey-50 p-2 font-mono text-[11px] text-grey-500">{{ dipilih.definisi?.sql }}</pre>
            <div class="flex flex-wrap items-end gap-2">
              <label v-for="p in dipilih.definisi?.parameter ?? []" :key="p.nama" class="flex flex-col gap-1 text-XS text-grey-500">
                <span class="font-semibold">{{ p.label ?? p.nama }}<span v-if="p.wajib" class="text-danger-300">*</span></span>
                <select v-if="p.tipe === 'pilihan'" v-model="parameter[p.nama]" class="rounded border border-grey-200 px-2 py-1"><option value="">—</option><option v-for="o in p.pilihan" :key="o" :value="o">{{ o }}</option></select>
                <input v-else v-model="parameter[p.nama]" :type="p.tipe === 'tanggal' ? 'date' : p.tipe === 'angka' ? 'number' : 'text'" class="rounded border border-grey-200 px-2 py-1" />
              </label>
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Pratinjau (50 baris)" icon="PhPlay" outlined :disabled="sibuk" @click="pratinjau" />
            </div>
            <div v-if="hasil" class="overflow-auto rounded-lg border border-grey-200">
              <div class="border-b border-grey-200 px-3 py-1 text-[11px] text-grey-400">{{ hasil.total }} baris (faskes Anda saat ini)</div>
              <table class="w-full text-XS">
                <thead class="bg-grey-75 text-left text-grey-500">
                  <tr><th v-for="k in dipilih.definisi?.kolom ?? Object.keys(hasil.data[0] ?? {}).map((f) => ({ field: f, label: f }))" :key="k.field" class="p-2">{{ k.label }}</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(r, i) in hasil.data" :key="i" class="border-t border-grey-100 text-grey-500">
                    <td v-for="k in dipilih.definisi?.kolom ?? Object.keys(r).map((f) => ({ field: f }))" :key="k.field" class="p-2">{{ r[k.field] }}</td>
                  </tr>
                  <tr v-if="!hasil.data.length"><td class="p-3 text-center text-grey-300" :colspan="99">Tidak ada data.</td></tr>
                </tbody>
              </table>
            </div>
          </template>
          <div v-else class="rounded-lg bg-grey-50 p-3 text-XS text-grey-500">
            <div>Kaitan: <b>{{ dipilih.definisi?.kaitan }}</b> · Hak akses: modul <b>{{ dipilih.definisi?.izin_modul }}</b></div>
            <ul class="mt-1 list-disc pl-5">
              <li v-for="f in dipilih.definisi?.field ?? []" :key="f.kode">{{ f.label }} <span class="text-grey-400">({{ f.tipe }}{{ f.wajib ? ", wajib" : "" }})</span></li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </Card>

  <Dialog v-model:visible="dialogEditor" modal header="Definisi ekstensi (JSON)" :style="{ width: '60rem' }">
    <textarea v-model="teksJson" rows="26" class="w-full rounded-lg border border-grey-200 p-2 font-mono text-XS" spellcheck="false" />
    <div v-if="galatJson" class="text-XS text-danger-300">{{ galatJson }}</div>
    <template #footer>
      <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Batal" outlined @click="dialogEditor = false" />
      <CustomButton label="Validasi & simpan draf" :disabled="sibuk" @click="simpanJson" />
    </template>
  </Dialog>
</template>
