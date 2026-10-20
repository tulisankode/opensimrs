<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { useIcuStore } from "@/stores/rawatInap/icu";
import { hasPermission } from "@/utils/permissions";

const store = useIcuStore();
const storeUtils = utilsStore();
const toast = useToast();
const bolehKelola = computed(() => hasPermission("ICU", "Konfigurasi Layanan", "KELOLA"));

const konfigurasi = ref<any>(null);
const riwayat = ref<any[]>([]);
const halaman = ref(1);
const total = ref(0);
const batas = ref(50);
const alasan = ref("");
const menyimpan = ref(false);

const menitBerikutnya = () => new Date(Math.ceil((Date.now() + 60000) / 60000) * 60000);
const bed = ref("");
const layananKode = ref("umum");
const mulai = ref<Date | null>(menitBerikutnya());
const role = ref("");
const unit = ref("");
const aktif = ref(true);

const alasanValid = computed(() => alasan.value.trim().length >= 3);
const referensi = computed(() => konfigurasi.value?.referensi ?? { bed: [], peran: [], unit: [] });
const daftarLayanan = computed<any[]>(() => konfigurasi.value?.layanan ?? []);
const penempatanBed = computed<any[]>(() => konfigurasi.value?.penempatanBed ?? []);
const aksesUnit = computed<any[]>(() => konfigurasi.value?.aksesUnit ?? []);
const opsiBed = computed(() => referensi.value.bed.map((b: any) => ({ ...b, label: `${b.ruanganNama} · Bed ${b.noBed}` })));
const opsiUnit = computed<any[]>(() => referensi.value.unit);

const namaBed = (uuid: string) => opsiBed.value.find((b: any) => b.uuid === uuid)?.label ?? uuid;
const namaLayanan = (kode: string) => daftarLayanan.value.find((l: any) => l.kode === kode)?.nama ?? kode;
const namaPeran = (uuid: string) => referensi.value.peran.find((p: any) => p.uuid === uuid)?.nama ?? uuid;
const namaUnit = (uuid: string) => opsiUnit.value.find((u: any) => u.uuid === uuid)?.nama ?? uuid;
const tampilWaktu = (detik: any) => (detik ? new Date(Number(detik) * 1000).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-");

const sekarang = () => Math.floor(Date.now() / 1000);
const statusPenempatan = (b: any) => {
  if (Number(b.berlakuMulai) > sekarang()) return { teks: "Terjadwal", kelas: "bg-warning-50 text-warning-400" };
  if (b.berlakuSampai && Number(b.berlakuSampai) <= sekarang()) return { teks: "Berakhir", kelas: "bg-grey-50 text-grey-400" };
  return { teks: "Berlaku", kelas: "bg-success-50 text-success-400" };
};

// Ringkasan syarat aktivasi layanan khusus (template hanya bisa diperiksa di menu Template ICU).
const syaratLayanan = (kode: string) => {
  const beds = penempatanBed.value.filter((b: any) => b.layananKode === kode && statusPenempatan(b).teks === "Berlaku");
  const ruangan = new Set(beds.map((b: any) => b.ruanganUuid));
  return { jumlahBed: beds.length, adaAkses: aksesUnit.value.some((a: any) => ruangan.has(a.ruanganUuid)) };
};

const aksesTerpilih = computed(() => aksesUnit.value.find((a: any) => a.roleUuid === role.value && a.ruanganUuid === unit.value));
const penempatanTerakhir = computed(() => penempatanBed.value.find((b: any) => b.roomMonitoringUuid === bed.value));

const JENIS_ENTITAS: Record<string, string> = {
  icu_layanans: "Layanan",
  icu_layanan_beds: "Pemetaan bed",
  icu_akses_units: "Akses unit",
};
const ringkasRiwayat = (r: any) => {
  const n = r.nilaiSesudah ?? r.nilaiSebelum ?? {};
  if (r.jenisEntitas === "icu_layanans") return `${n.nama ?? namaLayanan(n.kode)} → ${n.aktif ? "Aktif" : "Nonaktif"}`;
  if (r.jenisEntitas === "icu_layanan_beds") return `${namaBed(n.roomMonitoringUuid)} mulai ${tampilWaktu(n.berlakuMulai)}`;
  if (r.jenisEntitas === "icu_akses_units") return `${namaPeran(n.roleUuid)} · ${namaUnit(n.ruanganUuid)}${n.deletedAt ? " (dicabut)" : ""}`;
  return r.entitasUuid;
};
const jumlahHalaman = computed(() => Math.max(1, Math.ceil(total.value / batas.value)));

const muatRiwayat = async () => {
  const r = await store.getRiwayatKonfigurasi(halaman.value);
  riwayat.value = r?.payload?.data ?? [];
  total.value = r?.payload?.total ?? 0;
  batas.value = r?.payload?.batas ?? 50;
};
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    konfigurasi.value = (await store.getKonfigurasi())?.payload ?? null;
    await muatRiwayat();
  } finally {
    storeUtils.setLoading(false);
  }
};
const gantiHalaman = (langkah: number) => {
  halaman.value += langkah;
  muatRiwayat();
};

const jalankan = async (aksi: () => Promise<any>, pesan: string) => {
  if (!alasanValid.value || menyimpan.value) return;
  menyimpan.value = true;
  try {
    if ((await aksi())?.payload) {
      toast.add({ severity: "success", summary: pesan, life: 3000 });
      alasan.value = "";
      await muat();
    }
  } finally {
    menyimpan.value = false;
  }
};

const ubahLayanan = (l: any) =>
  jalankan(() => store.ubahLayanan(l.kode, { aktif: !l.aktif, revisi: l.revisi, alasan: alasan.value }), `${l.nama} ${l.aktif ? "dinonaktifkan" : "diaktifkan"}`);
const simpanBed = () =>
  jalankan(async () => {
    const hasil = await store.ubahBed(bed.value, {
      layananKode: layananKode.value,
      berlakuMulai: Math.floor((mulai.value as Date).getTime() / 1000),
      revisi: penempatanTerakhir.value?.revisi ?? 0,
      alasan: alasan.value,
    });
    if (hasil?.payload) mulai.value = menitBerikutnya();
    return hasil;
  }, "Pemetaan bed disimpan");
const simpanAkses = (roleUuid = role.value, ruanganUuid = unit.value, aktifkan = aktif.value) => {
  const lama = aksesUnit.value.find((a: any) => a.roleUuid === roleUuid && a.ruanganUuid === ruanganUuid);
  return jalankan(
    () => store.ubahAkses({ roleUuid, ruanganUuid, aktif: aktifkan, revisi: lama?.revisi ?? 0, alasan: alasan.value }),
    aktifkan ? "Akses unit disimpan" : "Akses unit dicabut",
  );
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Konfigurasi Layanan ICU</h1>
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!konfigurasi" title="Konfigurasi ICU belum dapat dimuat" />
        <div v-else class="flex flex-col gap-4 p-4">
          <p class="text-sm text-grey-500">
            Atur layanan ICU Umum, Burn ICU, dan Neuro ICU: petakan bed ke layanan, tetapkan akses peran per unit, lalu aktifkan layanan khusus.
          </p>

          <div v-if="bolehKelola" class="flex flex-col gap-2 p-4 rounded-lg bg-opensimrs-50">
            <CustomTextArea v-model="alasan" label="Alasan perubahan" placeholder="Contoh: penambahan bed Burn ICU di Ruang Merak" required />
            <span class="text-xs" :class="alasanValid ? 'text-grey-400' : 'text-danger-400'">
              Wajib diisi minimal 3 karakter sebelum menyimpan atau mengubah status layanan. Alasan dicatat di riwayat perubahan.
            </span>
          </div>

          <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
            <div class="flex items-center gap-2 font-semibold text-opensimrs-300"><PhGearSix :size="18" /> Layanan</div>
            <p class="text-xs text-grey-400">
              ICU Umum dapat langsung digunakan. Burn ICU dan Neuro ICU baru bisa diaktifkan bila sudah ada bed yang terpetakan dan sedang berlaku,
              akses unit untuk ruangan bed tersebut, serta template layanan yang sudah ditetapkan di menu Template ICU. Bila syarat belum terpenuhi,
              pesan galat dari server akan ditampilkan.
            </p>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div v-for="l in daftarLayanan" :key="l.kode" class="flex flex-col gap-2 p-3 border rounded-lg border-grey-75">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-semibold">{{ l.nama }}</span>
                  <span
                    class="px-2 py-0.5 text-xs font-semibold rounded-full"
                    :class="l.aktif ? 'bg-success-50 text-success-400' : 'bg-grey-50 text-grey-400'"
                  >{{ l.aktif ? "Aktif" : "Nonaktif" }}</span>
                </div>
                <div v-if="l.kode !== 'umum'" class="flex flex-col text-xs text-grey-500">
                  <span>Bed terpetakan & berlaku: {{ syaratLayanan(l.kode).jumlahBed }}</span>
                  <span>Akses unit ruangan bed: {{ syaratLayanan(l.kode).adaAkses ? "Ada" : "Belum ada" }}</span>
                  <span>Template ditetapkan: periksa di menu Template ICU</span>
                </div>
                <CustomButton
                  v-if="bolehKelola"
                  size="small"
                  :outlined="l.aktif"
                  :label="l.aktif ? 'Nonaktifkan' : 'Aktifkan'"
                  :disabled="!alasanValid || menyimpan"
                  :loading="menyimpan"
                  @click="ubahLayanan(l)"
                />
              </div>
            </div>
          </div>

          <div v-if="bolehKelola" class="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
              <div class="flex items-center gap-2 font-semibold text-opensimrs-300"><PhBed :size="18" /> Pemetaan bed</div>
              <CustomSelect
                v-model="bed"
                :options="opsiBed"
                optionLabel="label"
                optionValue="uuid"
                :filterFields="['ruanganNama', 'noBed', 'label']"
                label="Bed"
                placeHolder="Pilih ruangan dan bed"
              />
              <span v-if="penempatanTerakhir" class="text-xs text-grey-400">
                Saat ini: {{ namaLayanan(penempatanTerakhir.layananKode) }} sejak {{ tampilWaktu(penempatanTerakhir.berlakuMulai) }}
              </span>
              <CustomSelect v-model="layananKode" :options="daftarLayanan" optionLabel="nama" optionValue="kode" label="Layanan" :showFilter="false" />
              <CustomDatePicker v-model="mulai" label="Berlaku mulai" showTime :minDate="new Date()" />
              <span class="text-xs text-grey-400">Penempatan tidak boleh berlaku surut dan bed tidak boleh memiliki episode ICU aktif.</span>
              <div class="flex justify-end">
                <CustomButton label="Simpan Pemetaan Bed" :disabled="!alasanValid || !bed || !mulai || menyimpan" :loading="menyimpan" @click="simpanBed" />
              </div>
            </div>

            <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
              <div class="flex items-center gap-2 font-semibold text-opensimrs-300"><PhUsersThree :size="18" /> Akses unit</div>
              <CustomSelect v-model="role" :options="referensi.peran" optionLabel="nama" optionValue="uuid" label="Peran" placeHolder="Pilih peran" />
              <CustomSelect v-model="unit" :options="opsiUnit" optionLabel="nama" optionValue="uuid" label="Unit" placeHolder="Pilih unit" />
              <span v-if="role && unit" class="text-xs text-grey-400">
                {{ aksesTerpilih ? "Peran ini sudah memiliki akses ke unit tersebut." : "Peran ini belum memiliki akses ke unit tersebut." }}
              </span>
              <CustomSwitch v-model="aktif" label="Status akses" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
              <div class="flex justify-end">
                <CustomButton label="Simpan Akses Unit" :disabled="!alasanValid || !role || !unit || menyimpan" :loading="menyimpan" @click="simpanAkses()" />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
              <div class="font-semibold text-opensimrs-300">Penempatan bed</div>
              <div v-if="!penempatanBed.length" class="py-4 text-sm text-center text-grey-400">Belum ada bed yang dipetakan.</div>
              <div v-else class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left border-b border-grey-75 text-grey-400">
                      <th class="py-2 pr-3 font-semibold">Ruangan / Bed</th>
                      <th class="py-2 pr-3 font-semibold">Layanan</th>
                      <th class="py-2 pr-3 font-semibold">Berlaku</th>
                      <th class="py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="b in penempatanBed" :key="b.uuid" class="border-b border-grey-50">
                      <td class="py-2 pr-3">{{ namaBed(b.roomMonitoringUuid) }}</td>
                      <td class="py-2 pr-3">{{ namaLayanan(b.layananKode) }}</td>
                      <td class="py-2 pr-3 text-xs">{{ tampilWaktu(b.berlakuMulai) }} – {{ b.berlakuSampai ? tampilWaktu(b.berlakuSampai) : "berlanjut" }}</td>
                      <td class="py-2">
                        <span class="px-2 py-0.5 text-xs font-semibold rounded-full" :class="statusPenempatan(b).kelas">{{ statusPenempatan(b).teks }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
              <div class="font-semibold text-opensimrs-300">Akses unit aktif</div>
              <div v-if="!aksesUnit.length" class="py-4 text-sm text-center text-grey-400">Belum ada akses unit yang aktif.</div>
              <div v-else class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left border-b border-grey-75 text-grey-400">
                      <th class="py-2 pr-3 font-semibold">Peran</th>
                      <th class="py-2 pr-3 font-semibold">Unit</th>
                      <th v-if="bolehKelola" class="py-2 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="a in aksesUnit" :key="a.uuid" class="border-b border-grey-50">
                      <td class="py-2 pr-3">{{ namaPeran(a.roleUuid) }}</td>
                      <td class="py-2 pr-3">{{ namaUnit(a.ruanganUuid) }}</td>
                      <td v-if="bolehKelola" class="py-2 text-right">
                        <CustomButton
                          size="small"
                          outlined
                          label="Cabut"
                          :disabled="!alasanValid || menyimpan"
                          @click="simpanAkses(a.roleUuid, a.ruanganUuid, false)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
            <div class="flex items-center gap-2 font-semibold text-opensimrs-300"><PhClockCounterClockwise :size="18" /> Riwayat perubahan</div>
            <div v-if="!riwayat.length" class="py-4 text-sm text-center text-grey-400">Belum ada riwayat perubahan konfigurasi.</div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left border-b border-grey-75 text-grey-400">
                    <th class="py-2 pr-3 font-semibold">Waktu</th>
                    <th class="py-2 pr-3 font-semibold">Pelaku</th>
                    <th class="py-2 pr-3 font-semibold">Jenis</th>
                    <th class="py-2 pr-3 font-semibold">Perubahan</th>
                    <th class="py-2 font-semibold">Alasan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in riwayat" :key="r.uuid" class="align-top border-b border-grey-50">
                    <td class="py-2 pr-3 text-xs whitespace-nowrap">{{ tampilWaktu(r.createdAt) }}</td>
                    <td class="py-2 pr-3">{{ r.pelaku ?? "-" }}</td>
                    <td class="py-2 pr-3">{{ JENIS_ENTITAS[r.jenisEntitas] ?? r.jenisEntitas }}</td>
                    <td class="py-2 pr-3">{{ ringkasRiwayat(r) }}</td>
                    <td class="py-2">{{ r.alasan }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="total > batas" class="flex items-center justify-end gap-3 text-sm">
              <span class="text-grey-400">Halaman {{ halaman }} dari {{ jumlahHalaman }} · {{ total }} entri</span>
              <CustomButton size="small" outlined label="Sebelumnya" :disabled="halaman <= 1" @click="gantiHalaman(-1)" />
              <CustomButton size="small" outlined label="Berikutnya" :disabled="halaman >= jumlahHalaman" @click="gantiHalaman(1)" />
            </div>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
