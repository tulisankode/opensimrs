<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import NoData from "@/components/section/NoData.vue";
import StatusPicu from "./components/StatusPicu.vue";
import LencanaStatusPicu from "./components/LencanaStatusPicu.vue";
import { usePicu } from "./usePicu";

// Detail episode PICU: identitas, dokumentasi berversi (draf → final → revisi), transaksi modul sumber,
// perpindahan/penutupan episode, dan riwayat episode.
const router = useRouter();
const {
  boleh, fiturAktif, namaJenis, formatWaktu, nilaiDokumen,
  sibuk, pesan, gagal, detail, konfigurasi, halamanDokumentasi, formulirUuid, formulir, isi, waktuCatatan, koreksiUuid, alasanKoreksi,
  referensiPindah, calonPerpindahan, alasanPindah, jenisKeluar, sumberTransaksi, transaksi, tinjauTransisi, usiaSaatMasuk,
  muat, simpan, catat, koreksi, batalKoreksi, pindah, muatTransaksi, gantiHalamanDokumentasi,
} = usePicu("detail");
const formCatat = ref<HTMLFormElement>();
const fiturJenis = (jenis: string) => (jenis === "antropometri" ? "picu_antropometri" : jenis === "observasi" ? "picu_observasi" : "picu_dokumentasi");
const tombolGaris = { size: "small" as const, outlined: true, textColor: "text-opensimrs-300", borderColor: "border-opensimrs-300" };
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden picu-form">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowLeft" @click="router.push('/picu/episode')" />
          <CustomButton icon="PhArrowClockwise" :disabled="sibuk" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Detail Episode PICU</h1>
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col gap-4 p-4">
          <StatusPicu :gagal="gagal" :pesan="pesan" :sibuk="sibuk" />
          <NoData v-if="!detail && !sibuk" title="Episode PICU belum dapat dimuat" class="min-h-[16rem]" />
          <template v-if="detail">
            <!-- Identitas episode -->
            <div class="flex flex-col gap-3 p-4 rounded-lg bg-opensimrs-50">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 class="text-lg font-semibold">{{ detail.pasien.namaPasien }}</h2>
                  <div class="text-sm text-grey-500">Nomor rekam medis {{ detail.pasien.noRm }} · Kunjungan {{ detail.pasien.noReg }}</div>
                </div>
                <LencanaStatusPicu :status="detail.episode.status" />
              </div>
              <div class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div><div class="text-xs text-grey-400">Masuk</div>{{ formatWaktu(detail.episode.waktuMasuk) }}</div>
                <div><div class="text-xs text-grey-400">Usia</div>{{ usiaSaatMasuk }}</div>
                <div><div class="text-xs text-grey-400">Versi</div>{{ detail.episode.versi }}</div>
                <div><div class="text-xs text-grey-400">Episode</div><span class="break-all">{{ detail.episode.uuid }}</span></div>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <!-- Formulir dokumentasi / revisi -->
              <form v-if="boleh('Konfigurasi') && (detail.episode.status === 'aktif' || koreksiUuid)" ref="formCatat" class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75" @submit.prevent="catat">
                <h3 class="font-semibold">{{ koreksiUuid ? 'Revisi dokumentasi' : 'Catat dokumentasi' }}</h3>
                <label class="label-picu">Formulir <select v-model="formulirUuid" :disabled="!!koreksiUuid" required><option value="">Pilih formulir yang berlaku</option>
                  <template v-for="k in konfigurasi" :key="k.uuid"><option v-if="k.status === 'berlaku' && boleh(namaJenis[k.jenis], koreksiUuid ? 'KOREKSI' : 'CREATE') && fiturAktif(fiturJenis(k.jenis))" :value="k.uuid">{{ k.nama }} · {{ namaJenis[k.jenis] }}</option></template>
                </select></label>
                <p v-if="!konfigurasi.some(k => k.status === 'berlaku')" class="text-sm text-warning-400">Konfigurasi dokumentasi perlu dilengkapi oleh pihak berwenang.</p>
                <template v-if="formulir">
                  <label class="label-picu">Waktu catatan <input v-model="waktuCatatan" type="datetime-local" required /></label>
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label v-for="k in formulir.definisi" :key="k.kode" class="label-picu">
                      <span>{{ k.nama }} {{ k.satuan ? `(${k.satuan})` : '' }}<span v-if="k.wajib" class="text-danger-300">*</span></span>
                      <input v-if="k.tipe === 'angka'" v-model.number="isi[k.kode]" type="number" step="any" :required="k.wajib" />
                      <textarea v-else v-model="isi[k.kode]" :required="k.wajib" maxlength="10000"></textarea>
                    </label>
                  </div>
                  <label v-if="koreksiUuid" class="label-picu">Alasan koreksi <textarea v-model="alasanKoreksi" required maxlength="2000"></textarea></label>
                  <div class="flex flex-wrap gap-2">
                    <CustomButton label="Simpan draf" icon="PhFloppyDisk" :disabled="sibuk" @click="formCatat?.requestSubmit()" />
                    <CustomButton v-if="koreksiUuid" label="Batalkan koreksi" v-bind="tombolGaris" size="large" @click="batalKoreksi" />
                  </div>
                </template>
              </form>

              <!-- Transaksi modul sumber -->
              <div v-if="boleh('Transaksi Sumber') && fiturAktif('picu_transaksi')" class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
                <div>
                  <h3 class="font-semibold">Order dan hasil pada modul sumber</h3>
                  <p class="text-sm text-grey-400">Transaksi ditautkan melalui pasien dan kunjungan yang sama. Hasil pemeriksaan dibuka di modul sumber sesuai izin.</p>
                </div>
                <div class="flex flex-wrap items-end gap-2">
                  <label class="label-picu grow">Modul sumber <select v-model="sumberTransaksi"><option value="laboratorium">Laboratorium</option><option value="radiologi">Radiologi</option><option value="farmasi">Farmasi</option></select></label>
                  <CustomButton label="Muat referensi transaksi" icon="PhMagnifyingGlass" :disabled="sibuk" @click="muatTransaksi" />
                </div>
                <template v-if="transaksi">
                  <p v-if="!transaksi.items.length" class="text-sm text-grey-400">Belum ada transaksi terkait pada sumber ini.</p>
                  <div v-for="tr in transaksi.items" :key="tr.transaksiUuid" class="flex items-center justify-between gap-2 text-sm">
                    <span class="break-all">{{ tr.transaksiUuid }}</span><LencanaStatusPicu :status="tr.status" />
                  </div>
                  <RouterLink :to="{ path: transaksi.rute, query: { noReg: detail.pasien.noReg } }" class="self-start text-sm font-semibold text-opensimrs-300 hover:underline">Buka modul sumber →</RouterLink>
                </template>
              </div>

              <!-- Perpindahan / penutupan -->
              <form v-if="detail.episode.status === 'aktif' && fiturAktif('picu_tempat_tidur') && (boleh('Episode', 'PINDAH') || boleh('Episode', 'TUTUP'))" class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75" @submit.prevent>
                <div>
                  <h3 class="font-semibold">Perpindahan atau penutupan</h3>
                  <p class="text-sm text-grey-400">Selesaikan perpindahan atau pemulangan melalui modul sumber, kemudian tautkan hasilnya di sini.</p>
                </div>
                <label class="label-picu">Perpindahan sumber <select v-model="referensiPindah"><option value="">Pilih perpindahan atau lanjutkan pemulangan</option><option v-for="p in calonPerpindahan" :key="p.uuid" :value="p.uuid">{{ p.lokasi }} · {{ p.tujuan }} · {{ formatWaktu(p.waktuPindah) }}</option></select></label>
                <label class="label-picu">Jenis keluar <select v-model="jenisKeluar"><option value="transfer">Transfer keluar PICU</option><option value="pulang">Pulang</option></select></label>
                <label class="label-picu">Alasan <textarea v-model="alasanPindah" required maxlength="2000"></textarea></label>
                <label class="flex items-center gap-2 text-sm"><input v-model="tinjauTransisi" type="checkbox" /> Identitas episode dan hasil workflow sumber telah saya periksa.</label>
                <div class="flex flex-wrap gap-2">
                  <CustomButton v-if="boleh('Episode', 'PINDAH')" label="Tautkan perpindahan antartempat tidur PICU" icon="PhArrowsLeftRight" :disabled="sibuk || !tinjauTransisi || !alasanPindah" @click="pindah(false)" />
                  <CustomButton v-if="boleh('Episode', 'TUTUP')" label="Tutup episode" icon="PhSignOut" backgroundColor="bg-danger-300" :disabled="sibuk || !tinjauTransisi || !alasanPindah" @click="pindah(true)" />
                </div>
              </form>
            </div>

            <!-- Dokumentasi dan revisi -->
            <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="font-semibold">Dokumentasi dan revisi</h3>
                <div class="flex items-center gap-2 text-sm">
                  <CustomButton label="Catatan sebelumnya" icon="PhCaretLeft" v-bind="tombolGaris" :disabled="halamanDokumentasi <= 1 || sibuk" @click="gantiHalamanDokumentasi(-1)" />
                  <span>Halaman {{ halamanDokumentasi }}</span>
                  <CustomButton label="Catatan berikutnya" icon="PhCaretRight" iconPos="right" v-bind="tombolGaris" :disabled="!detail.dokumentasiBerikutnya || sibuk" @click="gantiHalamanDokumentasi(1)" />
                </div>
              </div>
              <p v-if="!detail.dokumentasi?.length" class="text-sm text-grey-400">Belum ada dokumentasi pada halaman ini.</p>
              <article v-for="d in detail.dokumentasi" :key="d.uuid" class="flex flex-col gap-2 p-3 border rounded-lg border-grey-75">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <h4 class="font-semibold">{{ d.namaFormulir }} <span class="font-normal text-grey-400">· {{ formatWaktu(d.waktuCatatan) }}</span></h4>
                  <LencanaStatusPicu :status="d.status" />
                </div>
                <p class="text-xs text-grey-400">Pencatat {{ d.dibuatOleh }} · {{ formatWaktu(d.createdAt) }}</p>
                <p v-if="d.koreksiUuid" class="px-2 py-1 text-xs rounded bg-warning-50 text-warning-400">Revisi dari {{ d.koreksiUuid }} · {{ d.alasan }}</p>
                <dl class="grid grid-cols-1 text-sm gap-x-4 gap-y-1 sm:grid-cols-2">
                  <div v-for="k in d.definisi" :key="k.kode"><dt class="inline font-semibold">{{ k.nama }}: </dt><dd class="inline whitespace-pre-wrap">{{ nilaiDokumen(d, k.kode) }} {{ k.satuan }}</dd></div>
                </dl>
                <div class="flex flex-wrap gap-2">
                  <CustomButton v-if="d.status === 'draf' && boleh(namaJenis[d.jenis], 'FINALISASI')" label="Finalisasi sesuai kewenangan" icon="PhSealCheck" size="small" :disabled="sibuk" @click="simpan(`episode/${detail.episode.uuid}/dokumentasi/${d.uuid}/finalisasi`, {})" />
                  <CustomButton v-if="d.status === 'final' && boleh(namaJenis[d.jenis], 'KOREKSI') && !detail.dokumentasi.some((r: any) => r.koreksiUuid === d.uuid)" label="Buat revisi" icon="PhPencilSimple" v-bind="tombolGaris" :disabled="sibuk" @click="koreksi(d)" />
                </div>
              </article>
            </div>

            <!-- Riwayat episode -->
            <div class="flex flex-col gap-2 p-4 border rounded-lg border-grey-75">
              <h3 class="font-semibold">Riwayat episode</h3>
              <p v-if="!detail.riwayat?.length" class="text-sm text-grey-400">Belum ada riwayat.</p>
              <ol class="flex flex-col gap-2 text-sm">
                <li v-for="r in detail.riwayat" :key="r.uuid" class="pl-3 border-l-2 border-opensimrs-300">
                  <div class="font-semibold capitalize">{{ r.jenis }} <span class="font-normal text-grey-400">· {{ formatWaktu(r.createdAt) }} · {{ r.dibuatOleh }}</span></div>
                  <div>{{ r.alasan }}</div>
                  <div class="text-xs text-grey-400 break-all">Asal {{ r.asalUuid || '-' }} → Tujuan {{ r.tujuanUuid || '-' }}</div>
                </li>
              </ol>
            </div>
          </template>
        </div>
      </template>
    </Card>
  </div>
</template>
