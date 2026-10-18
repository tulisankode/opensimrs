<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "primevue/usetoast";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  HARI, antreanHarian, batalJadwal, bukaSesi, buatJadwal, daftarJadwal, daftarMesin, daftarRegistrasi, daftarShift, gayaHdis, gayaJadwal, gayaSesi,
  hadirJadwal, hariIniIso, izinHd, pengingatJadwal, tampilTanggal, tanggalIso, ubahJadwal,
} from "@/stores/penunjang/hemodialisa";

// Jadwal HD per mesin × shift (satu kali/rutin) dan antrean harian (KF-2/KF-3). Bentrok ditolak backend; hasil kirim ke
// HDIS (bila Bridging HDIS aktif) ditampilkan per jadwal.
const storeUtils = utilsStore();
const toast = useToast();
const router = useRouter();
const boleh = (aksi: string) => izinHd("Registrasi & Jadwal", aksi);
const bolehSesi = izinHd("Sesi HD", "ASESMEN");

const tampilan = ref<"antrean" | "rentang">("antrean");
const tanggal = ref<Date | null>(new Date());
const sampai = ref<Date | null>(new Date(Date.now() + 6 * 86400000));
const data = ref<any[]>([]);
const pengingat = ref<any[]>([]);
const mesin = ref<any[]>([]);
const shift = ref<any[]>([]);
const registrasi = ref<any[]>([]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    if (tampilan.value === "antrean") {
      const res = await antreanHarian(tanggalIso(tanggal.value));
      data.value = res?.payload?.antrean ?? [];
    } else {
      const res = await daftarJadwal({ tanggal_mulai: tanggalIso(tanggal.value), tanggal_selesai: tanggalIso(sampai.value) });
      data.value = res?.payload ?? [];
    }
    pengingat.value = (await pengingatJadwal(1))?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const muatMaster = async () => {
  const [m, s, r] = await Promise.all([daftarMesin(), daftarShift(), daftarRegistrasi({ status: "aktif", limit: 500 })]);
  mesin.value = m?.payload ?? [];
  shift.value = s?.payload ?? [];
  registrasi.value = (r?.payload?.data ?? []).map((x: any) => ({ ...x, label: `${x.namaPasien} · ${x.noRm} · ${x.noRegHd} (${x.jenis})` }));
};
const mesinAktif = computed(() => mesin.value.filter((m) => m.status === "aktif").map((m) => ({ ...m, label: `${m.kode} — ${m.nama}` })));
const shiftAktif = computed(() => shift.value.filter((s) => s.aktif).map((s) => ({ ...s, label: `${s.nama} (${String(s.jamMulai).slice(0, 5)}–${String(s.jamSelesai).slice(0, 5)})` })));

const ringkasIntegrasi = (integrasi: any[] = []) => {
  const hitung: Record<string, number> = {};
  for (const i of integrasi) hitung[i.status] = (hitung[i.status] ?? 0) + 1;
  const bagian = Object.entries(hitung).map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`);
  if (bagian.length && !(Object.keys(hitung).length === 1 && hitung.tidak_aktif)) {
    const masalah = integrasi.find((i) => ["gagal", "tidak_pasti"].includes(i.status));
    toast.add({ severity: masalah ? "warn" : "info", summary: `Kirim ke HDIS: ${bagian.join(", ")}`, detail: masalah?.pesan, life: 7000 });
  }
};

// ── Buat jadwal ──
const dialogBuat = ref(false);
const form = ref<any>({});
const galat = ref("");
const bukaBuat = async () => {
  await muatMaster();
  galat.value = "";
  form.value = { registrasiUuid: "", mesinUuid: "", shiftUuid: "", pola: "satu_kali", tanggal: tanggal.value ?? new Date(), hari: [] as string[], mulai: new Date(), selesai: new Date(Date.now() + 27 * 86400000), catatan: "" };
  dialogBuat.value = true;
};
const simpanBuat = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.registrasiUuid || !f.mesinUuid || !f.shiftUuid) return (galat.value = "Registrasi, mesin, dan shift wajib dipilih");
  if (f.pola === "rutin" && !f.hari.length) return (galat.value = "Pilih minimal satu hari untuk jadwal rutin");
  const res = await buatJadwal({
    registrasiUuid: f.registrasiUuid,
    mesinUuid: f.mesinUuid,
    shiftUuid: f.shiftUuid,
    pola: f.pola,
    ...(f.pola === "rutin" ? { hari: f.hari.map(Number), tanggalMulai: tanggalIso(f.mulai), tanggalSelesai: tanggalIso(f.selesai) } : { tanggal: tanggalIso(f.tanggal) }),
    catatan: f.catatan || undefined,
  });
  if (!res?.payload) return;
  dialogBuat.value = false;
  ringkasIntegrasi(res.payload.integrasi);
  muat();
};

// ── Hadir / pindah / batal ──
const aktif = ref<any>(null);
const dialogHadir = ref(false);
const noReg = ref("");
const bukaHadir = (j: any) => {
  aktif.value = j;
  noReg.value = j.noReg ?? "";
  dialogHadir.value = true;
};
const simpanHadir = async () => {
  const res = await hadirJadwal(aktif.value.uuid, noReg.value.trim());
  if (res?.payload) {
    dialogHadir.value = false;
    muat();
  }
};
const dialogPindah = ref(false);
const pindah = ref<any>({});
const bukaPindah = async (j: any) => {
  await muatMaster();
  aktif.value = j;
  pindah.value = { mesinUuid: j.mesinUuid, shiftUuid: j.shiftUuid, tanggal: new Date(`${j.tanggal}T00:00:00`) };
  dialogPindah.value = true;
};
const simpanPindah = async () => {
  const res = await ubahJadwal(aktif.value.uuid, { mesinUuid: pindah.value.mesinUuid, shiftUuid: pindah.value.shiftUuid, tanggal: tanggalIso(pindah.value.tanggal) });
  if (res?.payload) {
    dialogPindah.value = false;
    ringkasIntegrasi(res.payload.integrasi);
    muat();
  }
};
const dialogBatal = ref(false);
const alasan = ref("");
const bukaBatal = (j: any) => {
  aktif.value = j;
  alasan.value = "";
  dialogBatal.value = true;
};
const simpanBatal = async () => {
  if (!alasan.value.trim()) return;
  const res = await batalJadwal(aktif.value.uuid, alasan.value.trim());
  if (res?.payload) {
    dialogBatal.value = false;
    ringkasIntegrasi(res.payload.integrasi);
    muat();
  }
};
const keSesi = async (j: any) => {
  const uuid = j.sesiUuid ?? (await bukaSesi(j.uuid))?.payload?.uuid;
  if (uuid) router.push({ path: "/hemodialisa/sesi", query: { sesi: uuid } });
};
const bisaSesi = (j: any) => j.tanggal <= hariIniIso() && ["terjadwal", "hadir", "berjalan", "selesai"].includes(j.status);

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Jadwal & Antrean HD</h1>
          <CustomSelect v-model="tampilan" label="Tampilan" :options="[{ value: 'antrean', label: 'Antrean harian' }, { value: 'rentang', label: 'Rentang tanggal' }]" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" @update:modelValue="muat" />
          <CustomDatePicker v-model="tanggal" :label="tampilan === 'antrean' ? 'Tanggal' : 'Dari'" class="toolbar-field--date" @update:modelValue="muat" />
          <CustomDatePicker v-if="tampilan === 'rentang'" v-model="sampai" label="Sampai" class="toolbar-field--date" @update:modelValue="muat" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Buat Jadwal" @click="bukaBuat" />
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="pengingat.length" class="p-3 mb-3 text-sm rounded-md bg-[#FEF0C7] text-[#B54708]">
          Pengingat: {{ pengingat.length }} jadwal terjadwal hari ini & besok belum hadir —
          {{ pengingat.slice(0, 5).map((p) => `${p.namaPasien} (${tampilTanggal(p.tanggal)}, ${p.namaShift}, ${p.kodeMesin})`).join("; ") }}{{ pengingat.length > 5 ? "…" : "" }}
        </div>
        <NoData v-if="!data.length" title="Belum ada jadwal pada tanggal ini" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 60rem">
          <Column v-if="tampilan === 'antrean'" field="nomorAntrean" header="No." headerClass="bg-opensimrs-50" />
          <Column v-else header="Tanggal" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ tampilTanggal(d.tanggal) }}</template></Column>
          <Column header="Shift" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.namaShift }}<div class="text-grey-400">{{ d.jamMulai }}–{{ d.jamSelesai }}</div></template></Column>
          <Column header="Mesin" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.kodeMesin }}</template></Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><div class="font-semibold">{{ d.namaPasien }}</div><div class="text-grey-400">{{ d.noRm }} · {{ d.noRegHd }} · {{ d.jenis }}{{ d.pola === "rutin" ? " · rutin" : "" }}</div></template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="flex flex-wrap gap-1">
                <span :class="['px-2 py-0.5 rounded', gayaJadwal(d.status).bg, gayaJadwal(d.status).text]">{{ gayaJadwal(d.status).label }}</span>
                <span v-if="d.statusSesi" :class="['px-2 py-0.5 rounded', gayaSesi(d.statusSesi).bg, gayaSesi(d.statusSesi).text]">{{ gayaSesi(d.statusSesi).label }}</span>
                <span v-if="d.statusHdis" :class="['px-2 py-0.5 rounded', gayaHdis(d.statusHdis).bg, gayaHdis(d.statusHdis).text]">{{ gayaHdis(d.statusHdis).label }}</span>
              </div>
            </template>
          </Column>
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="flex flex-wrap gap-2">
                <CustomButton v-if="boleh('UPDATE') && ['terjadwal', 'hadir'].includes(d.status)" label="Hadir" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaHadir(d)" />
                <CustomButton v-if="bolehSesi && bisaSesi(d)" :label="d.sesiUuid ? 'Lihat Sesi' : 'Buka Sesi'" size="small" @click="keSesi(d)" />
                <CustomButton v-if="boleh('UPDATE') && ['terjadwal', 'hadir'].includes(d.status) && !d.sesiUuid" label="Pindah" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaPindah(d)" />
                <CustomButton v-if="boleh('BATAL') && ['terjadwal', 'hadir'].includes(d.status)" label="Batal" size="small" outlined borderColor="border-[#B42318]" textColor="text-[#B42318]" @click="bukaBatal(d)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogBuat" width="680px">
      <template #header>Buat Jadwal HD</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="form.registrasiUuid" class="col-span-2" label="Pasien (registrasi HD aktif)" :options="registrasi" optionValue="uuid" optionLabel="label" required />
          <CustomSelect v-model="form.mesinUuid" label="Mesin" :options="mesinAktif" optionValue="uuid" optionLabel="label" required />
          <CustomSelect v-model="form.shiftUuid" label="Shift" :options="shiftAktif" optionValue="uuid" optionLabel="label" required />
          <CustomSelect v-model="form.pola" label="Pola" :options="[{ value: 'satu_kali', label: 'Satu kali' }, { value: 'rutin', label: 'Rutin mingguan' }]" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          <CustomDatePicker v-if="form.pola === 'satu_kali'" v-model="form.tanggal" label="Tanggal" :minDate="new Date(new Date().setHours(0, 0, 0, 0))" />
          <template v-else>
            <div class="col-span-2">
              <div class="mb-1 text-sm">Hari</div>
              <div class="flex flex-wrap gap-3">
                <label v-for="(nama, kode) in HARI" :key="kode" class="flex items-center gap-1 text-sm"><Checkbox v-model="form.hari" :value="kode" /> {{ nama }}</label>
              </div>
            </div>
            <CustomDatePicker v-model="form.mulai" label="Berlaku mulai" :minDate="new Date(new Date().setHours(0, 0, 0, 0))" />
            <CustomDatePicker v-model="form.selesai" label="Berlaku sampai (maks. 91 hari)" />
          </template>
          <CustomTextfield v-model="form.catatan" class="col-span-2" label="Catatan (opsional)" :maxLength="500" />
          <div class="col-span-2 text-xs text-grey-400">Seluruh rangkaian ditolak bila satu tanggal bentrok (mesin/shift terisi atau pasien sudah dijadwalkan pada shift yang sama).</div>
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBuat = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanBuat" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogHadir" width="480px">
      <template #header>Catat Kehadiran</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4 text-sm">
          <div>{{ aktif?.namaPasien }} — {{ tampilTanggal(aktif?.tanggal) }}, {{ aktif?.namaShift }}, {{ aktif?.kodeMesin }}</div>
          <CustomTextfield v-model="noReg" label="No. Reg kunjungan hari ini (opsional)" placeholder="mis. RJ-…" :maxLength="60" />
          <div class="text-xs text-grey-400">No. Reg dipakai untuk penjamin, tagihan tindakan, dan order BHP ke farmasi. Bila kosong dipakai kunjungan bawaan registrasi.</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogHadir = false" />
          <CustomButton label="Simpan" @click="simpanHadir" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogPindah" width="560px">
      <template #header>Pindah Slot Jadwal</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="pindah.mesinUuid" label="Mesin" :options="mesinAktif" optionValue="uuid" optionLabel="label" />
          <CustomSelect v-model="pindah.shiftUuid" label="Shift" :options="shiftAktif" optionValue="uuid" optionLabel="label" />
          <CustomDatePicker v-model="pindah.tanggal" label="Tanggal" :minDate="new Date(new Date().setHours(0, 0, 0, 0))" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogPindah = false" />
          <CustomButton label="Simpan" @click="simpanPindah" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogBatal" width="480px">
      <template #header>Batalkan Jadwal</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4 text-sm">
          <div>{{ aktif?.namaPasien }} — {{ tampilTanggal(aktif?.tanggal) }}, {{ aktif?.namaShift }}</div>
          <CustomTextfield v-model="alasan" label="Alasan" required :maxLength="500" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBatal = false" />
          <CustomButton label="Batalkan Jadwal" backgroundColor="bg-[#B42318]" :disabled="!alasan.trim()" @click="simpanBatal" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
