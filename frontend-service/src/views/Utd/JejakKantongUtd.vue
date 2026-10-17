<script setup lang="ts">
import { computed } from "vue";
import NoData from "@/components/section/NoData.vue";
import {
  HASIL_IMLTD,
  JENIS_KOMPONEN_UTD,
  PARAMETER_IMLTD,
  REAKSI_DONOR_UTD,
  bolehLihatReaktifUtd,
  gayaImltdUtd,
  gayaKantongUtd,
  gayaKomponenUtd,
  gayaSeleksiUtd,
  golonganRhUtd,
  tglUtd,
  waktuUtd,
} from "@/stores/penunjang/utd";

// Jejak vein-to-vein satu kantong (respons GET /utd/aftap/:uuid atau /utd/komponen/:uuid/jejak): donor → seleksi →
// aftap → uji saring IMLTD → komponen turunan. Bila backend menyamarkan hasil IMLTD (tanpa izin Lihat Hasil Reaktif),
// nilai per parameter & identitas donor tidak ditampilkan.
const props = defineProps<{ jejak: any }>();
const bolehReaktif = bolehLihatReaktifUtd();

const imltd = computed(() => props.jejak?.imltd ?? null);
const disamarkan = computed(() => !!imltd.value?.disamarkan);
const komponenDipilih = computed(() => props.jejak?.komponenDipilih ?? null);
const parameter = computed(() =>
  Object.entries(PARAMETER_IMLTD).map(([kode, nama]) => ({
    kode,
    nama,
    hasil: imltd.value?.[`${kode}Hasil`] ?? null,
    metode: imltd.value?.[`${kode}Metode`] ?? null,
    waktu: imltd.value?.[`${kode}Waktu`] ?? null,
  })),
);
const r = computed(() => props.jejak?.riwayat ?? null);
</script>

<template>
  <div class="flex flex-col gap-4 text-sm">
    <div class="grid grid-cols-2 gap-x-6 gap-y-1">
      <div><span class="text-grey-400">No. kantong:</span> <b>{{ jejak.noKantong }}</b></div>
      <div>
        <span class="text-grey-400">Status kantong:</span>
        <span
          class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold"
          :class="[gayaKantongUtd(jejak.statusKantong, bolehReaktif)?.bg, gayaKantongUtd(jejak.statusKantong, bolehReaktif)?.text]"
        >
          {{ gayaKantongUtd(jejak.statusKantong, bolehReaktif)?.label ?? jejak.statusKantong }}
        </span>
      </div>
      <div v-if="disamarkan"><span class="text-grey-400">Donor:</span> <i class="text-grey-400">disembunyikan (memerlukan izin Lihat Hasil Reaktif)</i></div>
      <div v-else><span class="text-grey-400">Donor:</span> <b>{{ jejak.namaDonor }}</b> ({{ jejak.noDonor }})</div>
      <div><span class="text-grey-400">Golongan:</span> <b>{{ golonganRhUtd(jejak.golonganDarah, jejak.rhesus) }}</b> · {{ jejak.volumeMl }} mL</div>
      <div><span class="text-grey-400">Aftap:</span> {{ waktuUtd(jejak.waktuMulai || jejak.createdAt) }}{{ jejak.waktuSelesai ? ` – ${waktuUtd(jejak.waktuSelesai)}` : "" }}</div>
      <div><span class="text-grey-400">Reaksi donor:</span> {{ REAKSI_DONOR_UTD[jejak.reaksiDonor] ?? jejak.reaksiDonor }}{{ jejak.catatanReaksi ? ` — ${jejak.catatanReaksi}` : "" }}</div>
      <div v-if="jejak.kegiatan" class="col-span-2"><span class="text-grey-400">Kegiatan:</span> {{ jejak.kegiatan }}{{ jejak.lokasiMobile ? ` · ${jejak.lokasiMobile}` : "" }}</div>
    </div>

    <div v-if="r">
      <h3 class="mb-1 font-semibold">Seleksi Donor</h3>
      <div class="grid grid-cols-4 gap-2 p-3 rounded-lg bg-opensimrs-50">
        <div><span class="text-grey-400">Hb:</span> {{ r.hb ?? "-" }} g/dL</div>
        <div><span class="text-grey-400">TD:</span> {{ r.tekananSistolik ?? "-" }}/{{ r.tekananDiastolik ?? "-" }}</div>
        <div><span class="text-grey-400">BB:</span> {{ r.beratBadan ?? "-" }} kg</div>
        <div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaSeleksiUtd(r.status)?.bg, gayaSeleksiUtd(r.status)?.text]">
            {{ gayaSeleksiUtd(r.status)?.label ?? r.status }}
          </span>
          <span class="ml-1 text-grey-400">{{ waktuUtd(r.waktuKeputusan || r.createdAt) }}</span>
        </div>
      </div>
    </div>

    <div>
      <h3 class="mb-1 font-semibold">Uji Saring IMLTD</h3>
      <div v-if="!imltd" class="text-grey-400">Belum ada hasil uji saring.</div>
      <div v-else-if="disamarkan" class="px-3 py-2 rounded-lg bg-grey-50 text-grey-400">
        Hasil uji saring disembunyikan. Akses ini dicatat; hubungi petugas dengan izin Lihat Hasil Reaktif.
      </div>
      <template v-else>
        <div class="mb-2">
          <span class="text-grey-400">Status akhir:</span>
          <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaImltdUtd(imltd.statusAkhir, bolehReaktif)?.bg, gayaImltdUtd(imltd.statusAkhir, bolehReaktif)?.text]">
            {{ gayaImltdUtd(imltd.statusAkhir, bolehReaktif)?.label }}
          </span>
          <span v-if="imltd.dilepasPada" class="ml-2 text-grey-400">Dilepas {{ waktuUtd(imltd.dilepasPada) }} · {{ imltd.dilepasOleh ?? "-" }}</span>
        </div>
        <DataTable :value="parameter" stripedRows class="text-xs">
          <Column field="nama" header="Parameter" headerClass="bg-opensimrs-50" />
          <Column header="Hasil Awal" headerClass="bg-opensimrs-50">
            <template #body="{ data: p }">
              <span :class="p.hasil === 'reaktif' ? 'text-danger-300 font-semibold' : ''">{{ HASIL_IMLTD[p.hasil] ?? "-" }}</span>
            </template>
          </Column>
          <Column header="Metode" headerClass="bg-opensimrs-50">
            <template #body="{ data: p }">{{ p.metode ?? "-" }}</template>
          </Column>
          <Column header="Waktu" headerClass="bg-opensimrs-50">
            <template #body="{ data: p }">{{ waktuUtd(p.waktu) }}</template>
          </Column>
        </DataTable>
        <div v-if="imltd.hasilKonfirmasi?.length" class="mt-2">
          <div class="mb-1 text-xs font-semibold">Konfirmasi</div>
          <div v-for="(k, i) in imltd.hasilKonfirmasi" :key="i" class="text-xs">
            {{ PARAMETER_IMLTD[k.parameter] ?? k.parameter }}:
            <b :class="k.hasil === 'reaktif' ? 'text-danger-300' : ''">{{ HASIL_IMLTD[k.hasil] ?? k.hasil }}</b>
            · {{ k.metode ?? "-" }} · {{ waktuUtd(k.waktu) }}
          </div>
        </div>
      </template>
    </div>

    <div>
      <h3 class="mb-1 font-semibold">Komponen Turunan</h3>
      <NoData v-if="!jejak.komponen?.length" />
      <DataTable v-else :value="jejak.komponen" stripedRows class="text-xs" :rowClass="(k: any) => (k.uuid === komponenDipilih ? 'font-semibold' : '')">
        <Column field="labelUnik" header="Label" headerClass="bg-opensimrs-50">
          <template #body="{ data: k }">
            {{ k.labelUnik }}
            <span v-if="k.uuid === komponenDipilih" class="px-1.5 ml-1 rounded text-[10px] bg-opensimrs-50 text-opensimrs-400">dipilih</span>
          </template>
        </Column>
        <Column header="Jenis" headerClass="bg-opensimrs-50">
          <template #body="{ data: k }">{{ JENIS_KOMPONEN_UTD[k.jenisKomponen] ?? k.jenisKomponen }}</template>
        </Column>
        <Column header="Gol. / Volume" headerClass="bg-opensimrs-50">
          <template #body="{ data: k }">{{ golonganRhUtd(k.golonganDarah, k.rhesus) }} · {{ k.volumeMl }} mL</template>
        </Column>
        <Column header="Kedaluwarsa" headerClass="bg-opensimrs-50">
          <template #body="{ data: k }">{{ tglUtd(k.tanggalKedaluwarsa) }}</template>
        </Column>
        <Column header="Status" headerClass="bg-opensimrs-50">
          <template #body="{ data: k }">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaKomponenUtd(k.status)?.bg, gayaKomponenUtd(k.status)?.text]">
              {{ gayaKomponenUtd(k.status)?.label ?? k.status }}
            </span>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>
