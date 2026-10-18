<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { JENIS_DOKUMEN, JENIS_KREDENSIAL, dasborMutu, daftarInstrumen, gayaMasaBerlaku, persenTeks, sisaHariTeks, tanggalMutu } from "@/stores/penunjang/mutu";

// Dasbor kesiapan akreditasi (KF-10): persentase elemen penilaian yang sudah punya bukti dokumen disahkan per instrumen
// aktif → bab → standar, dokumen yang perlu ditinjau ulang, dan kredensial staf yang mendekati/melewati masa berlaku.
// Daftar rinci hanya dikirim backend bila pengguna berhak membaca sumbernya.
const storeUtils = utilsStore();
const router = useRouter();
const data = ref<any>(null);
const instrumenUuid = ref("");
const opsiInstrumen = ref<any[]>([]);
const babTerbuka = ref<string[]>([]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await dasborMutu({ limit: 20, instrumenUuid: instrumenUuid.value });
    if (res?.payload) data.value = res.payload;
  } finally {
    storeUtils.setLoading(false);
  }
};
const r = computed(() => data.value?.ringkasan ?? {});
const kartu = computed(() => [
  { label: "Kesiapan elemen", nilai: persenTeks(r.value.persenKesiapan), sub: `${r.value.elemenTerbukti ?? 0} dari ${r.value.totalElemen ?? 0} elemen terbukti`, warna: "text-opensimrs-300" },
  { label: "Elemen tanpa bukti", nilai: r.value.elemenTanpaBukti ?? 0, sub: "belum ada dokumen disahkan", warna: r.value.elemenTanpaBukti ? "text-danger-300" : "text-success-300" },
  { label: "Dokumen perlu ditinjau", nilai: r.value.dokumenPerluTinjau ?? 0, sub: "tanggal tinjau ulang tiba", warna: r.value.dokumenPerluTinjau ? "text-warning-300" : "text-success-300" },
  { label: "Kredensial ≤ 90 hari", nilai: r.value.kredensialPeringatan90 ?? 0, sub: "31–90 hari lagi", warna: "text-warning-300" },
  { label: "Kredensial ≤ 30 hari", nilai: r.value.kredensialPeringatan30 ?? 0, sub: "0–30 hari lagi", warna: "text-warning-300" },
  { label: "Kredensial kedaluwarsa", nilai: r.value.kredensialKedaluwarsa ?? 0, sub: "masa berlaku lewat", warna: r.value.kredensialKedaluwarsa ? "text-danger-300" : "text-success-300" },
]);
const warnaBatang = (p?: number | null) => (p === null || p === undefined ? "bg-grey-200" : p >= 80 ? "bg-[#12B76A]" : p >= 50 ? "bg-[#F79009]" : "bg-[#F04438]");
const toggleBab = (uuid: string) => (babTerbuka.value = babTerbuka.value.includes(uuid) ? babTerbuka.value.filter((x) => x !== uuid) : [...babTerbuka.value, uuid]);
const daftarKredensial = computed(() => [
  { judul: "Kedaluwarsa", data: data.value?.kredensialKedaluwarsa ?? [] },
  { judul: "Berakhir ≤ 30 hari", data: data.value?.kredensialPeringatan30 ?? [] },
  { judul: "Berakhir ≤ 90 hari", data: data.value?.kredensialPeringatan90 ?? [] },
]);

onMounted(async () => {
  const res = await daftarInstrumen({ aktif: true, limit: 200 });
  opsiInstrumen.value = (res?.payload?.data ?? []).map((i: any) => ({ value: i.uuid, label: i.kode ? `${i.kode} — ${i.nama}` : i.nama }));
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Dasbor Kesiapan Akreditasi</h1>
          <CustomSelect v-model="instrumenUuid" label="Instrumen" placeHolder="Semua instrumen aktif" :options="opsiInstrumen" optionValue="value" optionLabel="label" @update:modelValue="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="data" class="flex flex-col gap-5 pb-4">
          <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div v-for="k in kartu" :key="k.label" class="p-3 border rounded-lg border-grey-100">
              <div class="text-xs text-grey-400">{{ k.label }}</div>
              <div class="text-2xl font-bold" :class="k.warna">{{ k.nilai }}</div>
              <div class="text-[11px] text-grey-400">{{ k.sub }}</div>
            </div>
          </div>

          <section>
            <h2 class="mb-2 font-semibold">Kelengkapan per Bab & Standar</h2>
            <div v-if="!data.kesiapan?.length" class="p-4 text-sm border rounded-lg text-grey-400 border-grey-100">
              Belum ada instrumen aktif. Isi atau impor bab, standar, dan elemen penilaian sesuai instrumen yang dipakai faskes di menu
              <button class="underline text-opensimrs-300" @click="router.push('/mutu/instrumen')">Instrumen Akreditasi</button>. Sistem tidak menyediakan isi instrumen bawaan.
            </div>
            <div v-for="ins in data.kesiapan" :key="ins.uuid" class="mb-3 border rounded-lg border-grey-100">
              <div class="flex items-center justify-between gap-3 px-3 py-2 bg-opensimrs-50">
                <div class="font-semibold">{{ ins.kode ? `${ins.kode} — ` : "" }}{{ ins.nama }}</div>
                <div class="text-sm">{{ persenTeks(ins.persen) }} <span class="text-xs text-grey-400">({{ ins.elemenTerbukti }}/{{ ins.totalElemen }} elemen)</span></div>
              </div>
              <div v-if="!ins.bab.length" class="px-3 py-2 text-xs text-grey-400">Instrumen belum memiliki bab.</div>
              <div v-for="bab in ins.bab" :key="bab.uuid" class="border-t border-grey-100">
                <button class="flex items-center w-full gap-3 px-3 py-2 text-left hover:bg-grey-50" @click="toggleBab(bab.uuid)">
                  <i :class="babTerbuka.includes(bab.uuid) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" class="text-xs"></i>
                  <span class="text-sm grow">{{ bab.kode }} — {{ bab.nama }}</span>
                  <span class="w-40 h-2 overflow-hidden rounded-full bg-grey-100"><span class="block h-full" :class="warnaBatang(bab.persen)" :style="{ width: `${bab.persen ?? 0}%` }"></span></span>
                  <span class="w-28 text-sm text-right">{{ persenTeks(bab.persen) }} <span class="text-xs text-grey-400">({{ bab.elemenTerbukti }}/{{ bab.totalElemen }})</span></span>
                </button>
                <div v-if="babTerbuka.includes(bab.uuid)" class="pb-2 pl-9 pr-3">
                  <div v-if="!bab.standar.length" class="text-xs text-grey-400">Bab belum memiliki standar.</div>
                  <div v-for="s in bab.standar" :key="s.uuid" class="flex items-center gap-3 py-1 text-xs">
                    <span class="grow">{{ s.kode }} — {{ s.nama }}</span>
                    <span class="w-32 h-1.5 overflow-hidden rounded-full bg-grey-100"><span class="block h-full" :class="warnaBatang(s.persen)" :style="{ width: `${s.persen ?? 0}%` }"></span></span>
                    <span class="text-right w-28">{{ persenTeks(s.persen) }} ({{ s.elemenTerbukti }}/{{ s.totalElemen }})</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div class="grid gap-5 xl:grid-cols-2">
            <section v-if="data.izin?.elemen">
              <h2 class="mb-2 font-semibold">Elemen Tanpa Bukti <span class="text-xs font-normal text-grey-400">(maks. 20 ditampilkan)</span></h2>
              <NoData v-if="!data.elemenTanpaBukti?.length" />
              <DataTable v-else :value="data.elemenTanpaBukti" stripedRows class="text-xs" tableStyle="min-width: 30rem">
                <Column header="Elemen" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <div class="font-semibold">{{ d.kode }}</div>
                    <div class="text-grey-400 line-clamp-2">{{ d.uraian }}</div>
                  </template>
                </Column>
                <Column header="Bab / Standar" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.babKode }} / {{ d.standarKode }}<div class="text-grey-400">{{ d.instrumenNama }}</div></template>
                </Column>
              </DataTable>
            </section>
            <section v-if="data.izin?.dokumen">
              <h2 class="mb-2 font-semibold">Dokumen Perlu Ditinjau Ulang</h2>
              <NoData v-if="!data.dokumenPerluTinjau?.length" />
              <DataTable v-else :value="data.dokumenPerluTinjau" stripedRows class="text-xs cursor-pointer" tableStyle="min-width: 30rem" @rowClick="router.push({ path: '/mutu/dokumen', query: { buka: $event.data.uuid } })">
                <Column header="Dokumen" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <div class="font-semibold">{{ d.nomor }} v{{ d.versi }}</div>
                    <div class="text-grey-400">{{ d.judul }}</div>
                  </template>
                </Column>
                <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ JENIS_DOKUMEN[d.jenis] ?? d.jenis }}</template></Column>
                <Column header="Tinjau Ulang" headerClass="bg-opensimrs-50"><template #body="{ data: d }"><span class="text-danger-300">{{ tanggalMutu(d.tanggalTinjauUlang) }}</span></template></Column>
              </DataTable>
            </section>
          </div>

          <section v-if="data.izin?.kredensial">
            <h2 class="mb-2 font-semibold">Kredensial Staf yang Perlu Ditindaklanjuti</h2>
            <div class="grid gap-4 xl:grid-cols-3">
              <div v-for="g in daftarKredensial" :key="g.judul">
                <div class="mb-1 text-sm font-semibold">{{ g.judul }} ({{ g.data.length }})</div>
                <div v-if="!g.data.length" class="text-xs text-grey-400">Tidak ada</div>
                <div
                  v-for="k in g.data"
                  :key="k.uuid"
                  class="flex items-center justify-between gap-2 py-1 text-xs border-b cursor-pointer border-grey-100 hover:bg-grey-50"
                  @click="router.push({ path: '/mutu/kredensial', query: { pegawai: k.pegawaiUuid } })"
                >
                  <span>
                    <span class="font-semibold">{{ k.namaPegawai || "-" }}</span> · {{ JENIS_KREDENSIAL[k.jenis] ?? k.jenis }} {{ k.nomor || "" }}
                    <div class="text-grey-400">{{ tanggalMutu(k.tanggalBerakhir) }}</div>
                  </span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" :class="[gayaMasaBerlaku(k.masaBerlaku).bg, gayaMasaBerlaku(k.masaBerlaku).text]">{{ sisaHariTeks(k.sisaHari) }}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </template>
    </Card>
  </div>
</template>
