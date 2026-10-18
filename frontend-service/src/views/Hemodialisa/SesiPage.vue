<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  batalSesi, catatObservasi, catatPemakaian, cariItemMedis, daftarDializer, daftarLokasiStok, daftarSesi, detailSesi, epoch, gayaSesi, gayaTagihan,
  hitungAdekuasi, izinHd, jam, koreksiObservasi, kirimUlangTagihanPemakaian, kirimUlangTagihanSesi, kunciCamel, mulaiSesi, referensiHd, rupiah,
  simpanAsesmen, tampilTanggal, tampilWaktu, tanggalIso, tinjauObservasi, tutupSesi,
} from "@/stores/penunjang/hemodialisa";

// Sesi HD: asesmen pra-HD → mulai → lembar intradialitik (manual & HDIS, kronologis, sumber dibedakan, koreksi beraudit)
// → catatan pasca-HD & tutup → adekuasi (formula bawaan perlu disahkan tenaga klinis) → pemakaian dializer/BHP & tagihan.
// SIMRS tidak menilai normal/abnormal nilai klinis; batas input hanya kewajaran.
const storeUtils = utilsStore();
const route = useRoute();
const router = useRouter();
const boleh = (aksi: string) => izinHd("Sesi HD", aksi);
const bolehBhp = (aksi: string) => izinHd("Pemakaian BHP", aksi);

const referensi = ref<any>({ parameter: [], komplikasi: [] });
const tanggal = ref<Date | null>(new Date());
const daftar = ref<any[]>([]);
const sesi = ref<any>(null);

const labelKomplikasi = (k: string) => referensi.value.komplikasi.find((x: any) => x.kode === k)?.label ?? k;
const muatDaftar = async () => {
  daftar.value = (await daftarSesi({ tanggal: tanggalIso(tanggal.value) }))?.payload ?? [];
};
const muatSesi = async (uuid?: string) => {
  const id = uuid ?? sesi.value?.uuid;
  if (!id) return;
  storeUtils.setLoading(true);
  try {
    const res = await detailSesi(id);
    if (res?.payload) sesi.value = res.payload;
  } finally {
    storeUtils.setLoading(false);
  }
};
const pilih = (s: any) => router.replace({ path: "/hemodialisa/sesi", query: { sesi: s.uuid } });
watch(() => route.query.sesi, (v) => v && muatSesi(String(v)));

// Kolom parameter yang terisi pada sesi ini (urutan mengikuti skema referensi).
const observasi = computed(() => sesi.value?.observasi ?? []);
const kolomParameter = computed(() => referensi.value.parameter.filter((p: any) => observasi.value.some((o: any) => o.parameter?.[kunciCamel(p.kode)])));
const nilai = (o: any, kode: string) => {
  const v = o.parameter?.[kunciCamel(kode)];
  return v ? v.nilai : "";
};
const dataGrafik = computed(() => {
  const baris = observasi.value.filter((o: any) => o.parameter && Object.keys(o.parameter).length);
  const seri = (kode: string, label: string, warna: string) => ({ label, data: baris.map((o: any) => o.parameter?.[kunciCamel(kode)]?.nilai ?? null), borderColor: warna, spanGaps: true, tension: 0.2 });
  return {
    labels: baris.map((o: any) => jam(o.waktuPengukuran)),
    datasets: [seri("td_sistolik", "TD sistolik (mmHg)", "#175CD3"), seri("td_diastolik", "TD diastolik (mmHg)", "#53B1FD"), seri("nadi", "Nadi (x/menit)", "#B42318"), seri("uf_volume_ml", "Volume UF (mL)", "#027A48")],
  };
});
const opsiGrafik = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } };

// ── Asesmen pra-HD ──
const asesmen = ref<any>({});
const isiAsesmen = () => {
  const a = sesi.value?.asesmenPra ?? {};
  asesmen.value = {
    identitasTerkonfirmasi: !!a.identitasTerkonfirmasi, resepTerkonfirmasi: !!a.resepTerkonfirmasi,
    beratPraKg: String(a.beratPraKg ?? ""), beratKeringKg: String(a.beratKeringKg ?? ""), tdSistolik: String(a.tdSistolik ?? ""), tdDiastolik: String(a.tdDiastolik ?? ""),
    nadi: String(a.nadi ?? ""), suhu: String(a.suhu ?? ""), keluhan: a.keluhan ?? "", kondisiAksesVaskular: a.kondisiAksesVaskular ?? "", catatan: a.catatan ?? "",
  };
};
watch(sesi, isiAsesmen);
const angkaAtau = (v: any) => (String(v ?? "").trim() === "" ? undefined : Number(v));
const simpanAsesmenPra = async () => {
  const a = asesmen.value;
  const res = await simpanAsesmen(sesi.value.uuid, {
    identitasTerkonfirmasi: a.identitasTerkonfirmasi, resepTerkonfirmasi: a.resepTerkonfirmasi, beratPraKg: angkaAtau(a.beratPraKg), beratKeringKg: angkaAtau(a.beratKeringKg),
    tdSistolik: angkaAtau(a.tdSistolik), tdDiastolik: angkaAtau(a.tdDiastolik), nadi: angkaAtau(a.nadi), suhu: angkaAtau(a.suhu),
    keluhan: a.keluhan, kondisiAksesVaskular: a.kondisiAksesVaskular, catatan: a.catatan,
  });
  if (res?.payload) sesi.value = res.payload;
};
const mulai = async () => {
  const res = await mulaiSesi(sesi.value.uuid);
  if (res?.payload) sesi.value = res.payload;
};

// ── Observasi (catat & koreksi) ──
const dialogObs = ref(false);
const obs = ref<any>({});
const galatObs = ref("");
const bukaObs = (o: any = null) => {
  galatObs.value = "";
  const parameter: Record<string, string> = {};
  for (const p of referensi.value.parameter) parameter[p.kode] = o ? String(nilai(o, p.kode)) : "";
  obs.value = { koreksiDari: o?.uuid ?? null, waktu: o ? new Date(Number(o.waktuPengukuran) * 1000) : new Date(), parameter, komplikasi: o?.komplikasi ?? [], keluhan: o?.keluhan ?? "", tindakan: o?.tindakan ?? "", alasan: "" };
  dialogObs.value = true;
};
const simpanObs = async () => {
  const o = obs.value;
  galatObs.value = "";
  const parameter = Object.fromEntries(Object.entries(o.parameter).filter(([, v]) => String(v ?? "").trim() !== "").map(([k, v]) => [k, Number(v)]));
  if (o.koreksiDari && !o.alasan.trim()) return (galatObs.value = "Alasan koreksi wajib diisi");
  const isi = { waktuPengukuran: epoch(o.waktu), parameter, komplikasi: o.komplikasi, keluhan: o.keluhan || undefined, tindakan: o.tindakan || undefined };
  const res = o.koreksiDari ? await koreksiObservasi(sesi.value.uuid, o.koreksiDari, { ...isi, alasan: o.alasan.trim() }) : await catatObservasi(sesi.value.uuid, isi);
  if (res?.payload) {
    dialogObs.value = false;
    muatSesi();
  }
};
const tinjau = async (o: any) => {
  if ((await tinjauObservasi(sesi.value.uuid, o.uuid))?.payload) muatSesi();
};

// ── Tutup sesi & adekuasi ──
const dialogTutup = ref(false);
const pasca = ref<any>({});
const bukaTutup = () => {
  pasca.value = { beratPascaKg: "", ufAktualMl: "", tdSistolik: "", tdDiastolik: "", nadi: "", keluhan: "", kondisiPulang: "", catatan: "", bunPre: "", bunPost: "" };
  dialogTutup.value = true;
};
const simpanTutup = async () => {
  const p = pasca.value;
  const res = await tutupSesi(sesi.value.uuid, {
    catatanPasca: { beratPascaKg: angkaAtau(p.beratPascaKg), ufAktualMl: angkaAtau(p.ufAktualMl), tdSistolik: angkaAtau(p.tdSistolik), tdDiastolik: angkaAtau(p.tdDiastolik), nadi: angkaAtau(p.nadi), keluhan: p.keluhan, kondisiPulang: p.kondisiPulang, catatan: p.catatan },
    ...(String(p.bunPre).trim() || String(p.bunPost).trim() ? { bunPre: angkaAtau(p.bunPre), bunPost: angkaAtau(p.bunPost) } : {}),
  });
  if (res?.payload) {
    dialogTutup.value = false;
    sesi.value = res.payload;
    muatDaftar();
  }
};
const dialogAdekuasi = ref(false);
const bun = ref<any>({ bunPre: "", bunPost: "" });
const simpanAdekuasi = async () => {
  const res = await hitungAdekuasi(sesi.value.uuid, { bunPre: angkaAtau(bun.value.bunPre), bunPost: angkaAtau(bun.value.bunPost) });
  if (res?.payload) {
    dialogAdekuasi.value = false;
    muatSesi();
  }
};
const kirimUlangTagihan = async () => {
  if ((await kirimUlangTagihanSesi(sesi.value.uuid))?.payload) muatSesi();
};
const dialogBatal = ref(false);
const alasanBatal = ref("");
const simpanBatal = async () => {
  if ((await batalSesi(sesi.value.uuid, alasanBatal.value.trim()))?.payload) {
    dialogBatal.value = false;
    muatSesi();
    muatDaftar();
  }
};

// ── Pemakaian dializer/BHP ──
const dialogPakai = ref(false);
const pakai = ref<any>({});
const dializer = ref<any[]>([]);
const lokasiStok = ref<any[]>([]);
const itemBhp = ref<any[]>([]);
const kataItem = ref("");
const bukaPakai = async () => {
  const [d, l] = await Promise.all([daftarDializer({ registrasi_uuid: sesi.value.jadwal.registrasiUuid, status: "aktif" }), daftarLokasiStok()]);
  dializer.value = (d?.payload ?? []).map((x: any) => ({ ...x, label: `${x.serial} — ${x.namaItem} (dipakai ${x.jumlahPakai}/${x.pemakaianMaksimal})` }));
  lokasiStok.value = (l?.payload ?? []).map((x: any) => ({ ...x, label: `${x.nama} (${x.jenisLokasi})` }));
  pakai.value = { jenis: "dializer", dializerUuid: "", itemMedisUuid: "", qty: "1", lokasiStokUuid: "" };
  dialogPakai.value = true;
};
const dializerTerpilih = computed(() => dializer.value.find((d) => d.uuid === pakai.value.dializerUuid));
const perluStok = computed(() => pakai.value.jenis === "bhp" || (dializerTerpilih.value && Number(dializerTerpilih.value.jumlahPakai) === 0));
const cariItem = async () => {
  itemBhp.value = ((await cariItemMedis(kataItem.value.trim()))?.payload ?? []).map((x: any) => ({ ...x, label: `${x.nama} (${x.kode})` }));
};
const simpanPakai = async () => {
  const p = pakai.value;
  const res = await catatPemakaian(
    sesi.value.uuid,
    p.jenis === "dializer"
      ? { jenis: "dializer", dializerUuid: p.dializerUuid, lokasiStokUuid: perluStok.value ? p.lokasiStokUuid : undefined }
      : { jenis: "bhp", itemMedisUuid: p.itemMedisUuid, qty: Number(p.qty), lokasiStokUuid: p.lokasiStokUuid },
  );
  if (res?.payload) {
    dialogPakai.value = false;
    muatSesi();
  }
};
const ulangTagihanBhp = async (pm: any) => {
  if ((await kirimUlangTagihanPemakaian(pm.uuid))?.payload) muatSesi();
};

onMounted(async () => {
  referensi.value = (await referensiHd())?.payload ?? referensi.value;
  await muatDaftar();
  if (route.query.sesi) muatSesi(String(route.query.sesi));
});
</script>

<template>
  <div class="flex h-full gap-3 overflow-hidden">
    <Card class="w-[320px] flex-none h-full overflow-hidden" pt:body:class="h-full pt-0 overflow-auto">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muatDaftar" />
          <CustomDatePicker v-model="tanggal" label="Tanggal" class="toolbar-field--date" @update:modelValue="muatDaftar" />
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="!daftar.length" class="p-3 text-sm text-grey-400">Belum ada sesi. Buka sesi dari Jadwal & Antrean.</div>
        <button
          v-for="s in daftar"
          :key="s.uuid"
          type="button"
          :class="['w-full p-3 mb-2 text-left border rounded-md text-xs', sesi?.uuid === s.uuid ? 'border-opensimrs-300 bg-opensimrs-50' : 'border-grey-100']"
          @click="pilih(s)"
        >
          <div class="font-semibold">{{ s.namaPasien }}</div>
          <div class="text-grey-400">{{ s.namaShift }} · {{ s.kodeMesin }} · {{ s.noRm }}</div>
          <div class="flex flex-wrap gap-1 mt-1">
            <span :class="['px-2 py-0.5 rounded', gayaSesi(s.status).bg, gayaSesi(s.status).text]">{{ gayaSesi(s.status).label }}</span>
            <span v-if="s.perluTinjau" class="px-2 py-0.5 rounded bg-[#FEF0C7] text-[#B54708]">Data HDIS perlu ditinjau</span>
          </div>
        </button>
      </template>
    </Card>

    <Card class="h-full overflow-hidden grow" pt:body:class="h-full pt-0 overflow-auto">
      <template #content>
        <NoData v-if="!sesi" title="Pilih sesi HD" />
        <div v-else class="flex flex-col gap-5 pt-4 text-sm">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="text-lg font-semibold">{{ sesi.jadwal?.namaPasien }}</div>
              <div class="text-grey-400">{{ sesi.jadwal?.noRm }} · {{ sesi.jadwal?.noRegHd }} ({{ sesi.jadwal?.jenis }}) · {{ tampilTanggal(sesi.jadwal?.tanggal) }} · {{ sesi.jadwal?.namaShift }} · Mesin {{ sesi.jadwal?.kodeMesin }}</div>
              <div class="flex flex-wrap gap-1 mt-1 text-xs">
                <span :class="['px-2 py-0.5 rounded', gayaSesi(sesi.status).bg, gayaSesi(sesi.status).text]">{{ gayaSesi(sesi.status).label }}</span>
                <span v-if="sesi.status === 'selesai'" :class="['px-2 py-0.5 rounded', gayaTagihan(sesi.statusTagihan).bg, gayaTagihan(sesi.statusTagihan).text]">Tagihan: {{ gayaTagihan(sesi.statusTagihan).label }}</span>
                <span v-if="sesi.pesanTagihan" class="text-grey-400">{{ sesi.pesanTagihan }}</span>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <CustomButton v-if="sesi.status === 'asesmen' && sesi.asesmenPra && boleh('MULAI')" label="Mulai Sesi" icon="PhPlay" @click="mulai" />
              <CustomButton v-if="sesi.status === 'berjalan' && boleh('OBSERVASI')" label="Catat Observasi" icon="PhPlus" @click="bukaObs()" />
              <CustomButton v-if="sesi.status === 'berjalan' && boleh('TUTUP')" label="Tutup Sesi" icon="PhCheck" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaTutup" />
              <CustomButton v-if="sesi.status === 'selesai' && ['gagal', 'tertunda', 'belum'].includes(sesi.statusTagihan) && boleh('TUTUP')" label="Kirim Ulang Tagihan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="kirimUlangTagihan" />
              <CustomButton v-if="sesi.status === 'asesmen' && boleh('BATAL')" label="Batalkan Sesi" outlined borderColor="border-[#B42318]" textColor="text-[#B42318]" @click="(alasanBatal = ''), (dialogBatal = true)" />
            </div>
          </div>

          <section v-if="sesi.resep" class="p-3 border rounded-md border-grey-100">
            <div class="mb-1 font-semibold">Resep HD (disahkan {{ sesi.resep.disahkanOleh }})</div>
            Durasi {{ sesi.resep.durasiMenit }} menit · QB {{ Number(sesi.resep.qbMlMenit) }} · QD {{ Number(sesi.resep.qdMlMenit) }} mL/menit · Sasaran UF {{ Number(sesi.resep.ufGoalMl) }} mL ·
            Antikoagulan: {{ sesi.resep.antikoagulan }} · Dialisat: {{ sesi.resep.dialisat }} · Akses: {{ sesi.resep.aksesVaskular }}
          </section>

          <section class="p-3 border rounded-md border-grey-100">
            <div class="mb-2 font-semibold">Asesmen Pra-HD</div>
            <template v-if="sesi.status === 'asesmen' && boleh('ASESMEN')">
              <div class="grid grid-cols-4 gap-3">
                <label class="flex items-center col-span-2 gap-2"><Checkbox v-model="asesmen.identitasTerkonfirmasi" binary /> Identitas pasien dikonfirmasi</label>
                <label class="flex items-center col-span-2 gap-2"><Checkbox v-model="asesmen.resepTerkonfirmasi" binary /> Resep HD dikonfirmasi</label>
                <CustomTextfield v-model="asesmen.beratPraKg" label="Berat pra-HD (kg)" type="number" required />
                <CustomTextfield v-model="asesmen.beratKeringKg" label="Berat kering (kg)" type="number" />
                <CustomTextfield v-model="asesmen.tdSistolik" label="TD sistolik (mmHg)" type="number" required />
                <CustomTextfield v-model="asesmen.tdDiastolik" label="TD diastolik (mmHg)" type="number" required />
                <CustomTextfield v-model="asesmen.nadi" label="Nadi (x/menit)" type="number" required />
                <CustomTextfield v-model="asesmen.suhu" label="Suhu (°C)" type="number" />
                <CustomTextfield v-model="asesmen.kondisiAksesVaskular" class="col-span-2" label="Kondisi akses vaskular" :maxLength="500" />
                <CustomTextfield v-model="asesmen.keluhan" class="col-span-2" label="Keluhan" :maxLength="1000" />
                <CustomTextfield v-model="asesmen.catatan" class="col-span-2" label="Catatan" :maxLength="1000" />
              </div>
              <div class="flex justify-end mt-3"><CustomButton label="Simpan Asesmen" icon="PhFloppyDisk" @click="simpanAsesmenPra" /></div>
            </template>
            <div v-else-if="sesi.asesmenPra" class="grid grid-cols-4 gap-2 text-xs">
              <div>Berat pra: <b>{{ sesi.asesmenPra.beratPraKg }} kg</b></div>
              <div>TD: <b>{{ sesi.asesmenPra.tdSistolik }}/{{ sesi.asesmenPra.tdDiastolik }} mmHg</b></div>
              <div>Nadi: <b>{{ sesi.asesmenPra.nadi }} x/menit</b></div>
              <div>Suhu: <b>{{ sesi.asesmenPra.suhu ?? "-" }}</b></div>
              <div class="col-span-4">Keluhan: {{ sesi.asesmenPra.keluhan || "-" }} · Akses: {{ sesi.asesmenPra.kondisiAksesVaskular || "-" }} · Oleh {{ sesi.asesmenOleh }}, {{ tampilWaktu(sesi.asesmenPada) }}</div>
            </div>
            <div v-else class="text-grey-400">Belum diisi.</div>
          </section>

          <section class="p-3 border rounded-md border-grey-100">
            <div class="mb-2 font-semibold">Lembar Intradialitik <span class="font-normal text-grey-400">— mulai {{ tampilWaktu(sesi.mulaiPada) }}{{ sesi.selesaiPada ? `, selesai ${tampilWaktu(sesi.selesaiPada)}` : "" }}</span></div>
            <div v-if="dataGrafik.labels.length > 1" class="h-[220px] mb-3"><Chart type="line" :data="dataGrafik" :options="opsiGrafik" class="h-full" /></div>
            <div v-if="!observasi.length" class="text-grey-400">Belum ada observasi.</div>
            <DataTable v-else :value="observasi" stripedRows class="text-xs" scrollable tableStyle="min-width: 50rem">
              <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data: o }">{{ jam(o.waktuPengukuran) }}</template></Column>
              <Column header="Sumber" headerClass="bg-opensimrs-50">
                <template #body="{ data: o }">
                  <span :class="['px-2 py-0.5 rounded', o.sumber === 'hdis' ? 'bg-[#D1E9FF] text-[#175CD3]' : 'bg-[#F2F4F7] text-[#344054]']">{{ o.sumber === "hdis" ? "HDIS" : "Manual" }}</span>
                  <div v-if="o.revisiDari" class="mt-1 text-grey-400">Koreksi: {{ o.alasanKoreksi }}</div>
                </template>
              </Column>
              <Column v-for="p in kolomParameter" :key="p.kode" :header="`${p.label} (${p.satuan})`" headerClass="bg-opensimrs-50"><template #body="{ data: o }">{{ nilai(o, p.kode) }}</template></Column>
              <Column header="Keluhan / Komplikasi / Tindakan" headerClass="bg-opensimrs-50">
                <template #body="{ data: o }">{{ [o.keluhan, (o.komplikasi ?? []).map(labelKomplikasi).join(", "), o.tindakan].filter(Boolean).join(" · ") || "-" }}</template>
              </Column>
              <Column field="dicatatOleh" header="Petugas" headerClass="bg-opensimrs-50" />
              <Column header="" headerClass="bg-opensimrs-50">
                <template #body="{ data: o }">
                  <div class="flex gap-2">
                    <CustomButton v-if="o.perluTinjau && boleh('KOREKSI')" label="Tinjau" size="small" backgroundColor="bg-[#B54708]" @click="tinjau(o)" />
                    <CustomButton v-if="boleh('KOREKSI') && sesi.status !== 'batal'" label="Koreksi" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaObs(o)" />
                  </div>
                </template>
              </Column>
            </DataTable>
          </section>

          <section v-if="sesi.status === 'selesai'" class="p-3 border rounded-md border-grey-100">
            <div class="flex items-center justify-between mb-2">
              <div class="font-semibold">Pasca-HD & Adekuasi</div>
              <CustomButton v-if="boleh('KOREKSI')" label="Hitung Adekuasi" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="(bun = { bunPre: '', bunPost: '' }), (dialogAdekuasi = true)" />
            </div>
            <div class="grid grid-cols-4 gap-2 text-xs">
              <div>Berat pasca: <b>{{ sesi.catatanPasca?.beratPascaKg }} kg</b></div>
              <div>UF aktual: <b>{{ sesi.catatanPasca?.ufAktualMl }} mL</b></div>
              <div>TD: <b>{{ sesi.catatanPasca?.tdSistolik }}/{{ sesi.catatanPasca?.tdDiastolik }} mmHg</b></div>
              <div>Nadi: <b>{{ sesi.catatanPasca?.nadi }}</b></div>
              <div class="col-span-4">Kondisi pulang: {{ sesi.catatanPasca?.kondisiPulang || "-" }} · Ditutup {{ sesi.ditutupOleh }}</div>
            </div>
            <div v-if="sesi.adekuasi" class="p-2 mt-2 text-xs rounded-md bg-opensimrs-50">
              <template v-if="sesi.adekuasi.status === 'tersedia'">Kt/V <b>{{ Number(sesi.adekuasi.ktV) }}</b> · URR <b>{{ Number(sesi.adekuasi.urr) }}%</b></template>
              <template v-else>Adekuasi belum tersedia: {{ sesi.adekuasi.alasan }}</template>
              <div class="text-grey-400">Metode: {{ sesi.adekuasi.metode ?? referensi.metodeAdekuasi }} — hasil perlu ditinjau tenaga klinis berwenang.</div>
            </div>
          </section>

          <section class="p-3 border rounded-md border-grey-100">
            <div class="flex items-center justify-between mb-2">
              <div class="font-semibold">Pemakaian Dializer & BHP</div>
              <CustomButton v-if="bolehBhp('CREATE') && ['asesmen', 'berjalan', 'selesai'].includes(sesi.status)" label="Catat Pemakaian" size="small" icon="PhPlus" @click="bukaPakai" />
            </div>
            <div v-if="!sesi.pemakaian?.length" class="text-grey-400">Belum ada pemakaian.</div>
            <DataTable v-else :value="sesi.pemakaian" stripedRows class="text-xs">
              <Column header="Item" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ p.namaItem }}<div v-if="p.serial" class="text-grey-400">Serial {{ p.serial }} · pemakaian ke-{{ p.pemakaianKe }}/{{ p.pemakaianMaksimal }}</div></template></Column>
              <Column field="qty" header="Qty" headerClass="bg-opensimrs-50" />
              <Column header="Stok" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ p.statusStok === "reuse" ? "Reuse (tanpa stok baru)" : "Order farmasi" }}</template></Column>
              <Column header="Harga" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ rupiah(p.hargaSatuan) }}</template></Column>
              <Column header="Tagihan" headerClass="bg-opensimrs-50">
                <template #body="{ data: p }">
                  <span :class="['px-2 py-0.5 rounded', gayaTagihan(p.statusTagihan).bg, gayaTagihan(p.statusTagihan).text]">{{ gayaTagihan(p.statusTagihan).label }}</span>
                  <CustomButton v-if="p.statusTagihan === 'gagal' && bolehBhp('CREATE')" class="ml-2" label="Kirim Ulang" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="ulangTagihanBhp(p)" />
                </template>
              </Column>
              <Column field="petugas" header="Petugas" headerClass="bg-opensimrs-50" />
            </DataTable>
          </section>
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogObs" width="760px">
      <template #header>{{ obs.koreksiDari ? "Koreksi Observasi" : "Catat Observasi Intradialitik" }}</template>
      <template #body>
        <div class="grid grid-cols-4 gap-3 pt-4">
          <CustomDatePicker v-model="obs.waktu" class="col-span-2" label="Waktu pengukuran" showTime :maxDate="new Date()" />
          <div class="col-span-2"></div>
          <CustomTextfield v-for="p in referensi.parameter" :key="p.kode" v-model="obs.parameter[p.kode]" :label="`${p.label} (${p.satuan})`" type="number" />
          <div class="col-span-4">
            <div class="mb-1 text-sm">Komplikasi</div>
            <div class="flex flex-wrap gap-3">
              <label v-for="k in referensi.komplikasi" :key="k.kode" class="flex items-center gap-1 text-sm"><Checkbox v-model="obs.komplikasi" :value="k.kode" /> {{ k.label }}</label>
            </div>
          </div>
          <CustomTextfield v-model="obs.keluhan" class="col-span-2" label="Keluhan" :maxLength="1000" />
          <CustomTextfield v-model="obs.tindakan" class="col-span-2" label="Tindakan" :maxLength="1000" />
          <CustomTextfield v-if="obs.koreksiDari" v-model="obs.alasan" class="col-span-4" label="Alasan koreksi" required :maxLength="500" />
          <div class="col-span-4 text-xs text-grey-400">Isi hanya parameter yang diukur. Batas input hanya kewajaran; penilaian klinis tetap oleh petugas.</div>
        </div>
        <div v-if="galatObs" class="mt-3 text-sm text-danger-300">{{ galatObs }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogObs = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanObs" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogTutup" width="640px">
      <template #header>Catatan Pasca-HD & Tutup Sesi</template>
      <template #body>
        <div class="grid grid-cols-3 gap-3 pt-4">
          <CustomTextfield v-model="pasca.beratPascaKg" label="Berat pasca-HD (kg)" type="number" required />
          <CustomTextfield v-model="pasca.ufAktualMl" label="UF aktual (mL)" type="number" required />
          <CustomTextfield v-model="pasca.nadi" label="Nadi (x/menit)" type="number" required />
          <CustomTextfield v-model="pasca.tdSistolik" label="TD sistolik (mmHg)" type="number" required />
          <CustomTextfield v-model="pasca.tdDiastolik" label="TD diastolik (mmHg)" type="number" required />
          <div></div>
          <CustomTextfield v-model="pasca.keluhan" label="Keluhan" :maxLength="1000" />
          <CustomTextfield v-model="pasca.kondisiPulang" label="Kondisi pulang" :maxLength="500" />
          <CustomTextfield v-model="pasca.catatan" label="Catatan" :maxLength="1000" />
          <CustomTextfield v-model="pasca.bunPre" label="BUN pra-HD (opsional)" type="number" />
          <CustomTextfield v-model="pasca.bunPost" label="BUN pasca-HD (opsional)" type="number" />
          <div class="col-span-3 text-xs text-grey-400">Bila BUN diisi, Kt/V & URR dihitung dengan formula bawaan (perlu disahkan tenaga klinis). Tagihan tindakan dikirim sekali per sesi.</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogTutup = false" />
          <CustomButton label="Tutup Sesi" icon="PhCheck" @click="simpanTutup" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogAdekuasi" width="440px">
      <template #header>Hitung Adekuasi</template>
      <template #body>
        <div class="grid grid-cols-2 gap-3 pt-4">
          <CustomTextfield v-model="bun.bunPre" label="BUN pra-HD" type="number" />
          <CustomTextfield v-model="bun.bunPost" label="BUN pasca-HD" type="number" />
          <div class="col-span-2 text-xs text-grey-400">Durasi, UF, dan berat pasca diambil dari sesi. Hasil sebelumnya disimpan sebagai riwayat.</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogAdekuasi = false" />
          <CustomButton label="Hitung" @click="simpanAdekuasi" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogPakai" width="600px">
      <template #header>Catat Pemakaian</template>
      <template #body>
        <div class="grid grid-cols-2 gap-3 pt-4">
          <CustomSelect v-model="pakai.jenis" label="Jenis" :options="[{ value: 'dializer', label: 'Dializer' }, { value: 'bhp', label: 'BHP lain' }]" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          <div></div>
          <template v-if="pakai.jenis === 'dializer'">
            <CustomSelect v-model="pakai.dializerUuid" class="col-span-2" label="Dializer pasien (aktif)" :options="dializer" optionValue="uuid" optionLabel="label" />
            <div v-if="!dializer.length" class="col-span-2 text-xs text-grey-400">Belum ada dializer aktif; daftarkan di menu Dializer.</div>
          </template>
          <template v-else>
            <CustomTextfield v-model="kataItem" label="Cari item BHP" @keyup.enter="cariItem" />
            <CustomButton label="Cari" icon="PhMagnifyingGlass" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cariItem" />
            <CustomSelect v-model="pakai.itemMedisUuid" label="Item" :options="itemBhp" optionValue="uuid" optionLabel="label" />
            <CustomTextfield v-model="pakai.qty" label="Qty" type="number" />
          </template>
          <CustomSelect v-if="perluStok" v-model="pakai.lokasiStokUuid" class="col-span-2" label="Lokasi stok (depo)" :options="lokasiStok" optionValue="uuid" optionLabel="label" />
          <div class="col-span-2 text-xs text-grey-400">Pemakaian baru dibuat sebagai order alkes ke farmasi (stok berkurang saat diverifikasi farmasi). Reuse dializer tidak mengambil stok baru; batas pemakaian ditolak sistem.</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogPakai = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanPakai" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogBatal" width="440px">
      <template #header>Batalkan Sesi</template>
      <template #body>
        <div class="pt-4"><CustomTextfield v-model="alasanBatal" label="Alasan" required :maxLength="500" /></div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBatal = false" />
          <CustomButton label="Batalkan Sesi" backgroundColor="bg-[#B42318]" :disabled="!alasanBatal.trim()" @click="simpanBatal" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
