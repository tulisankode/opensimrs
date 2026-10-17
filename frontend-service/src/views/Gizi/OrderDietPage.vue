<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  BELUM_KONFIRMASI_ALERGI,
  OPSI_RUTE_DIET,
  batalOrderDietGizi,
  buatOrderDietGizi,
  daftarBentukMakananGizi,
  daftarDietGizi,
  gayaOrderDiet,
  izinGizi,
  orderDietGizi,
  pasienAktifGizi,
  waktuGizi,
} from "@/stores/penunjang/gizi";

// Cari pasien rawat inap aktif → tampilkan order diet berlaku + alergi tercatat RME + riwayat → tulis order baru.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinGizi("Order Diet", aksi);

const cari = ref("");
const data = ref<any[]>([]);
const muatPasien = async () => {
  if (!cari.value.trim()) return (data.value = []);
  storeUtils.setLoading(true);
  try {
    const res = await pasienAktifGizi({ cari: cari.value });
    data.value = res?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const dietOpsi = ref<any[]>([]);
const bentukOpsi = ref<any[]>([]);
const muatMaster = async () => {
  const [d, b] = await Promise.all([daftarDietGizi({ status: 1 }), daftarBentukMakananGizi({ status: 1 })]);
  dietOpsi.value = d?.payload ?? [];
  bentukOpsi.value = b?.payload ?? [];
};

const pasienDipilih = ref<any>(null);
const orderAktif = ref<any>(null);
const riwayat = ref<any[]>([]);
const alergi = ref<any>(null);

const pilihPasien = async (p: any) => {
  pasienDipilih.value = p;
  storeUtils.setLoading(true);
  try {
    const res = await orderDietGizi(p.uuid);
    orderAktif.value = res?.payload?.orderAktif ?? null;
    riwayat.value = res?.payload?.riwayat ?? [];
    alergi.value = res?.payload?.alergi ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Form order baru
const dialog = ref(false);
const kosong = () => ({ dietUuid: "", bentukMakananUuid: "", kalori: null as number | null, rute: "oral", pantangan: "" });
const form = ref<any>(kosong());
const galat = ref("");
const buka = () => {
  galat.value = "";
  form.value = kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  if (!f.dietUuid || !f.bentukMakananUuid) return (galat.value = "Jenis diet dan bentuk makanan wajib dipilih");
  storeUtils.setLoading(true);
  try {
    const res = await buatOrderDietGizi(pasienDipilih.value.uuid, {
      dietUuid: f.dietUuid,
      bentukMakananUuid: f.bentukMakananUuid,
      kalori: f.kalori ?? undefined,
      rute: f.rute,
      pantangan: f.pantangan,
    });
    if (res) {
      dialog.value = false;
      pilihPasien(pasienDipilih.value);
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialogBatal = ref(false);
const alasanBatal = ref("");
const batalkan = async () => {
  if (!orderAktif.value) return;
  const res = await batalOrderDietGizi(orderAktif.value.uuid, alasanBatal.value || "Dibatalkan DPJP");
  if (res) {
    dialogBatal.value = false;
    alasanBatal.value = "";
    pilihPasien(pasienDipilih.value);
  }
};

const teksAlergi = computed(() => (alergi.value?.tercatat ? alergi.value.teks : BELUM_KONFIRMASI_ALERGI));

onMounted(muatMaster);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden gap-3">
    <Card pt:body:class="pt-0" class="flex-none">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Cari Pasien Rawat Inap</h1>
          <CustomTextfield v-model="cari" label="Cari pasien" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM" :maxLength="100" @keydown.enter="muatPasien" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="muatPasien" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" :rowClass="() => 'cursor-pointer'" @rowClick="(e: any) => pilihPasien(e.data)">
          <Column field="noRm" header="No. RM" headerClass="bg-opensimrs-50" />
          <Column field="namaPasien" header="Nama Pasien" headerClass="bg-opensimrs-50" />
          <Column header="Ruangan / Kamar" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.namaBangsal ?? "-" }} / {{ d.namaKamar ?? "-" }}</template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Card v-if="pasienDipilih" pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden grow">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">{{ pasienDipilih.namaPasien }} — {{ pasienDipilih.namaBangsal }}</h1>
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Order Diet Baru" @click="buka" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="p-4 space-y-4">
          <div class="p-3 rounded border border-danger-100 bg-danger-50">
            <b>Alergi Tercatat (RME):</b> <span :class="alergi?.tercatat ? 'text-danger-300 font-semibold' : 'text-grey-400'">{{ teksAlergi }}</span>
          </div>

          <div v-if="orderAktif" class="p-3 rounded border border-grey-100">
            <div class="flex justify-between items-start">
              <div>
                <div class="font-semibold">{{ orderAktif.namaDiet }} — {{ orderAktif.namaBentukMakanan }}</div>
                <div class="text-xs text-grey-400">Kalori: {{ orderAktif.kalori ?? "-" }} kkal · Rute: {{ orderAktif.rute }}</div>
                <div v-if="orderAktif.pantangan" class="text-xs">Pantangan: {{ orderAktif.pantangan }}</div>
                <div class="text-xs text-grey-400">Dibuat: {{ waktuGizi(orderAktif.createdAt) }} oleh {{ orderAktif.dibuatOleh }}</div>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-1.5 rounded" :class="[gayaOrderDiet(orderAktif.status).bg, gayaOrderDiet(orderAktif.status).text]">{{ gayaOrderDiet(orderAktif.status).label }}</span>
                <CustomButton v-if="boleh('UPDATE')" label="Batalkan" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="dialogBatal = true" />
              </div>
            </div>
          </div>
          <NoData v-else />

          <div v-if="riwayat.length">
            <div class="font-semibold text-sm mb-2">Riwayat Order Diet</div>
            <DataTable :value="riwayat" stripedRows class="text-xs">
              <Column field="namaDiet" header="Diet" headerClass="bg-opensimrs-50" />
              <Column field="namaBentukMakanan" header="Bentuk" headerClass="bg-opensimrs-50" />
              <Column header="Status" headerClass="bg-opensimrs-50">
                <template #body="{ data: d }"><span :class="[gayaOrderDiet(d.status).bg, gayaOrderDiet(d.status).text]" class="px-1.5 rounded">{{ gayaOrderDiet(d.status).label }}</span></template>
              </Column>
              <Column header="Waktu Mulai" headerClass="bg-opensimrs-50">
                <template #body="{ data: d }">{{ waktuGizi(d.waktuMulai) }}</template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="640px">
      <template #header>Order Diet Baru — {{ pasienDipilih?.namaPasien }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="form.dietUuid" label="Jenis Diet" :options="dietOpsi" optionValue="uuid" optionLabel="namaDiet" required class="col-span-2" />
          <CustomSelect v-model="form.bentukMakananUuid" label="Bentuk Makanan" :options="bentukOpsi" optionValue="uuid" optionLabel="nama" required />
          <CustomTextfield v-model="form.kalori" label="Kalori (kkal)" type="number" />
          <CustomSelect v-model="form.rute" label="Rute" :options="OPSI_RUTE_DIET" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" />
          <CustomTextfield v-model="form.pantangan" label="Pantangan (opsional)" class="col-span-2" :maxLength="500" />
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogBatal" width="420px" headerBg="bg-danger-300">
      <template #header>Batalkan Order Diet</template>
      <template #body>
        <div class="pt-4">
          <CustomTextfield v-model="alasanBatal" label="Alasan pembatalan" placeholder="mis. Diganti order baru" :maxLength="255" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBatal = false" />
          <CustomButton label="Batalkan Order" backgroundColor="bg-danger-300" @click="batalkan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
