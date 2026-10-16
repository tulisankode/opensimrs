<script setup lang="ts">
// Server & Deploy: kirim branch lokal (kustomisasi RS) ke server lain tanpa GitHub — lewat SSH (git push ke repo penampung
// di server, lalu deploy.sh) atau berkas bundle untuk dibawa lewat USB.
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiEkstensi } from "@/utils/apiHandler";
import { useSimrsStudioStore } from "@/stores/simrsStudio";
import PanelTugas from "../Komponen/PanelTugas.vue";
import { formatWaktu } from "../umum";

const studio = useSimrsStudioStore();
const superadmin = computed(() => studio.status.superadmin);
const info = ref<any>(null);
const server = ref<any[]>([]);
const riwayat = ref<any[]>([]);
const sibuk = ref<string | null>(null);
const hasilUji = ref<Record<string, any>>({});
const tugasAktif = ref<string | null>(null);

const api = (metode: "get" | "post" | "put" | "delete", url: string, data: object = {}, diam = false) => apiEkstensi("studio", metode, url, data, diam);
const muat = async () => {
  const [a, b, c] = await Promise.all([api("get", "/deploy/info"), api("get", "/server"), api("get", "/deploy/riwayat")]);
  info.value = a?.payload ?? null;
  server.value = b?.payload ?? [];
  riwayat.value = c?.payload ?? [];
  tugasAktif.value = riwayat.value.find((r) => ["antri", "jalan"].includes(r.status))?.uuid ?? tugasAktif.value;
};
onMounted(muat);

const jalankan = async (kunci: string, fn: () => Promise<any>) => {
  sibuk.value = kunci;
  try {
    return await fn();
  } finally {
    sibuk.value = null;
  }
};

// Form server
const dialogForm = ref(false);
const form = ref<any>({});
const bukaForm = (s?: any) => {
  form.value = s
    ? { ...s }
    : { nama: "", jenis: "produksi", host: "", port: 22, pengguna: "", repo_dir: "~/opensimrs", repo_bare: "~/opensimrs-rs.git", branch: "", perintah_deploy: "./deploy/server/deploy.sh", aktif: true };
  dialogForm.value = true;
};
const simpanForm = () =>
  jalankan("form", async () => {
    const res = form.value.uuid ? await api("put", `/server/${form.value.uuid}`, form.value) : await api("post", "/server", form.value);
    if (res) {
      dialogForm.value = false;
      muat();
    }
  });
const hapus = (s: any) => jalankan(`hapus-${s.uuid}`, async () => (await api("delete", `/server/${s.uuid}`)) && muat());

// Kunci SSH
const dialogKunci = ref<any>(null);
const buatKunci = (s: any) =>
  jalankan(`kunci-${s.uuid}`, async () => {
    const res = await api("post", `/server/${s.uuid}/kunci`);
    if (res) {
      await muat();
      dialogKunci.value = server.value.find((x) => x.uuid === s.uuid);
    }
  });
const salin = (teks: string) => navigator.clipboard?.writeText(teks);

const uji = (s: any) =>
  jalankan(`uji-${s.uuid}`, async () => {
    // Langsung (bukan lewat apiEkstensi) agar pesan galat SSH bisa ditampilkan di kartu server.
    const r = await fetch(`${import.meta.env.VITE_BASE_STUDIO || "http://localhost:8090/api/v3/studio"}/server/${s.uuid}/uji`, {
      method: "POST", headers: { Authorization: localStorage.getItem("access_token") ?? "" },
    });
    const j = await r.json().catch(() => ({}));
    hasilUji.value[s.uuid] = r.ok ? j.payload : { galat: j.message ?? "Gagal" };
    muat();
  });
const siapkan = (s: any) => jalankan(`siapkan-${s.uuid}`, async () => (await api("post", `/server/${s.uuid}/siapkan`)) && muat());
const lupakanSidik = (s: any) => jalankan(`sidik-${s.uuid}`, async () => (await api("post", `/server/${s.uuid}/lupakan-sidik`)) && muat());

// Kirim & deploy
const dialogDeploy = ref<any>(null);
const jalankanDeploy = ref(true);
const konfirmasi = ref("");
const bukaDeploy = (s: any) => {
  dialogDeploy.value = s;
  jalankanDeploy.value = true;
  konfirmasi.value = "";
};
const kirim = () =>
  jalankan("deploy", async () => {
    const res = await api("post", `/server/${dialogDeploy.value.uuid}/deploy`, { jalankanDeploy: jalankanDeploy.value });
    if (res?.payload?.uuid) {
      tugasAktif.value = res.payload.uuid;
      dialogDeploy.value = null;
      muat();
    }
  });

// Bundle (tanpa jaringan)
const unduhBundle = () =>
  jalankan("bundle", async () => {
    const dasar = import.meta.env.VITE_BASE_STUDIO || "http://localhost:8090/api/v3/studio";
    const r = await fetch(`${dasar}/deploy/bundle`, { headers: { Authorization: localStorage.getItem("access_token") ?? "" } });
    if (!r.ok) return;
    const nama = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? "opensimrs.bundle";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await r.blob());
    a.download = nama;
    a.click();
    URL.revokeObjectURL(a.href);
  });

const ringkasRiwayat = (r: any) => {
  try {
    return JSON.parse(r.instruksi ?? "{}");
  } catch {
    return {};
  }
};
const WARNA: Record<string, string> = { selesai: "bg-success-50 text-success-400", gagal: "bg-danger-50 text-danger-400", jalan: "bg-warning-50 text-warning-400", antri: "bg-grey-75 text-grey-400", dibatalkan: "bg-grey-75 text-grey-400" };
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full" class="h-full">
    <template #header>
      <PageToolbar>
        <h1 class="toolbar-heading text-opensimrs-300">Server & Deploy</h1>
        <CustomButton v-if="superadmin" label="Tambah server" icon="PhPlus" @click="bukaForm()" />
      </PageToolbar>
    </template>
    <template #content>
      <!-- Yang akan dikirim -->
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-opensimrs-50 p-3 text-SM text-grey-500">
        <div>
          <div class="font-semibold text-opensimrs-300">Yang dikirim ke server: branch lokal <code class="rounded bg-white px-1">{{ info?.branch ?? "…" }}</code></div>
          <div v-if="info?.sha" class="text-XS text-grey-400">Terakhir: {{ info.sha.slice(0, 7) }} — {{ info.subjek }} · {{ formatWaktu(info.waktu) }}</div>
          <div v-if="info && !info.branchLokalDiatur" class="mt-1 text-XS text-warning-400">
            Branch lokal belum diatur, jadi Studio memakai branch yang sedang aktif. Isi <b>Branch lokal aplikasi RS</b> di Pengaturan & Agen (mis. <code>rs-lokal</code>).
          </div>
        </div>
        <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Unduh paket rilis (.bundle)" icon="PhDownloadSimple" outlined :disabled="sibuk === 'bundle'" @click="unduhBundle" />
      </div>

      <PanelTugas v-if="tugasAktif" class="mt-3" :tugas-uuid="tugasAktif" judul="Pengiriman ke server" @selesai="muat" />

      <!-- Daftar server -->
      <div class="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div v-for="s in server" :key="s.uuid" class="flex flex-col gap-2 rounded-lg border border-grey-200 p-3 text-XS text-grey-500">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-2 text-normal font-semibold text-grey-500">
                <PhHardDrives :size="20" class="text-opensimrs-300" aria-hidden="true" /> {{ s.nama }}
                <span class="rounded px-1.5 text-[10px] font-bold uppercase" :class="s.jenis === 'produksi' ? 'bg-danger-50 text-danger-400' : 'bg-info-50 text-info-400'">{{ s.jenis }}</span>
                <span v-if="!s.aktif" class="text-[10px] text-grey-300">(nonaktif)</span>
              </div>
              <div class="font-mono text-grey-400">{{ s.pengguna }}@{{ s.host }}:{{ s.port }} · {{ s.repo_dir }}</div>
            </div>
            <div v-if="superadmin" class="flex gap-1">
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" icon="PhPencilSimple" outlined @click="bukaForm(s)" />
              <CustomButton icon="PhTrash" outlined text-color="text-danger-300" border-color="border-danger-300" :disabled="sibuk === `hapus-${s.uuid}`" @click="hapus(s)" />
            </div>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1">
            <span>Kunci SSH: <b :class="s.kunci_publik ? 'text-success-400' : 'text-warning-400'">{{ s.kunci_publik ? "ada" : "belum dibuat" }}</b></span>
            <span>Sidik jari host: <b>{{ s.sidik_host ? "tercatat" : "belum" }}</b></span>
            <span v-if="s.terakhir_deploy">Deploy terakhir: <b>{{ s.sha_terakhir?.slice(0, 7) }}</b> · {{ formatWaktu(s.terakhir_deploy) }}</span>
          </div>
          <div v-if="hasilUji[s.uuid]" class="rounded bg-grey-50 p-2">
            <template v-if="hasilUji[s.uuid].galat"><span class="text-danger-300">✘ {{ hasilUji[s.uuid].galat }}</span></template>
            <template v-else>
              <div class="text-success-400">✔ Tersambung — {{ hasilUji[s.uuid].sistem }}</div>
              <div>{{ hasilUji[s.uuid].git }} · {{ hasilUji[s.uuid].kontainer || "kontainer tidak ditemukan" }}</div>
              <div>Repo aplikasi: {{ hasilUji[s.uuid].repo ? `ada (branch ${hasilUji[s.uuid].repo})` : "belum ada — dibuat otomatis saat pengiriman pertama" }}</div>
            </template>
          </div>
          <div class="flex flex-wrap gap-2">
            <template v-if="superadmin">
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" :label="s.kunci_publik ? 'Lihat kunci publik' : 'Buat kunci SSH'" icon="PhKey" outlined :disabled="sibuk === `kunci-${s.uuid}`" @click="s.kunci_publik ? (dialogKunci = s) : buatKunci(s)" />
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Uji koneksi" icon="PhPulse" outlined :disabled="!s.kunci_publik || sibuk === `uji-${s.uuid}`" @click="uji(s)" />
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Siapkan server" icon="PhWrench" outlined :disabled="!s.kunci_publik || sibuk === `siapkan-${s.uuid}`" @click="siapkan(s)" />
            </template>
            <CustomButton label="Kirim & deploy" icon="PhRocketLaunch" :disabled="!s.kunci_publik || !s.aktif || sibuk === 'deploy'" @click="bukaDeploy(s)" />
          </div>
        </div>
        <div v-if="!server.length" class="rounded-lg border border-dashed border-grey-200 p-6 text-center text-XS text-grey-300 xl:col-span-2">
          Belum ada server. {{ superadmin ? "Klik Tambah server." : "Minta superadmin menambahkan server tujuan." }}
        </div>
      </div>

      <!-- Riwayat -->
      <div class="mt-4 mb-2 font-semibold text-opensimrs-300">Riwayat pengiriman</div>
      <div class="overflow-auto rounded-lg border border-grey-200">
        <table class="w-full text-XS">
          <thead class="bg-grey-75 text-left text-grey-500"><tr><th class="p-2">Waktu</th><th class="p-2">Server</th><th class="p-2">Branch</th><th class="p-2">Commit</th><th class="p-2">Oleh</th><th class="p-2">Status</th></tr></thead>
          <tbody>
            <tr v-for="r in riwayat" :key="r.uuid" class="cursor-pointer border-t border-grey-100 text-grey-500 hover:bg-grey-50" @click="tugasAktif = r.uuid">
              <td class="p-2">{{ formatWaktu(r.created_at) }}</td>
              <td class="p-2">{{ ringkasRiwayat(r).nama }} <span class="text-grey-300">({{ ringkasRiwayat(r).host }})</span></td>
              <td class="p-2 font-mono">{{ ringkasRiwayat(r).branch }}</td>
              <td class="p-2 font-mono">{{ ringkasRiwayat(r).sha?.slice(0, 7) }}{{ ringkasRiwayat(r).jalankanDeploy ? "" : " (tanpa deploy)" }}</td>
              <td class="p-2">{{ r.dibuat_oleh }}</td>
              <td class="p-2"><span class="rounded px-1.5 font-semibold" :class="WARNA[r.status]">{{ r.status }}</span><span v-if="r.pesan_galat" class="ml-1 text-danger-300">{{ r.pesan_galat.slice(0, 80) }}</span></td>
            </tr>
            <tr v-if="!riwayat.length"><td colspan="6" class="p-4 text-center text-grey-300">Belum ada pengiriman.</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Tanpa jaringan -->
      <div class="mt-4 rounded-lg border border-grey-200 p-3 text-XS text-grey-500">
        <div class="mb-1 text-SM font-semibold">Server tanpa jaringan (USB)</div>
        <div class="mb-1 text-grey-400">Unduh paket rilis (.bundle) di atas, salin ke server, lalu jalankan di folder aplikasi server:</div>
        <pre class="overflow-auto rounded bg-grey-50 p-2 font-mono">cd ~/opensimrs
git pull /path/ke/{{ "<berkas>" }}.bundle {{ info?.branch ?? "rs-lokal" }}
./deploy/server/deploy.sh</pre>
      </div>
    </template>
  </Card>

  <!-- Form server -->
  <Dialog v-model:visible="dialogForm" modal header="Server tujuan" :style="{ width: '36rem' }">
    <div class="grid grid-cols-2 gap-2 text-SM text-grey-500">
      <label class="col-span-2 flex flex-col gap-1"><span class="text-XS font-semibold">Nama</span><input v-model="form.nama" class="rounded border border-grey-200 px-2 py-1.5" placeholder="Server produksi RS" /></label>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Jenis</span>
        <select v-model="form.jenis" class="rounded border border-grey-200 px-2 py-1.5"><option value="produksi">Produksi</option><option value="staging">Staging</option></select></label>
      <label class="flex items-end gap-2 pb-2 text-XS"><input v-model="form.aktif" type="checkbox" /> Aktif</label>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">IP / host</span><input v-model="form.host" class="rounded border border-grey-200 px-2 py-1.5 font-mono" placeholder="192.168.1.10" /></label>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Port SSH</span><input v-model.number="form.port" type="number" class="rounded border border-grey-200 px-2 py-1.5" /></label>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Pengguna SSH</span><input v-model="form.pengguna" class="rounded border border-grey-200 px-2 py-1.5 font-mono" placeholder="deploy" /></label>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Branch di server (kosong = branch lokal)</span><input v-model="form.branch" class="rounded border border-grey-200 px-2 py-1.5 font-mono" /></label>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Folder aplikasi di server</span><input v-model="form.repo_dir" class="rounded border border-grey-200 px-2 py-1.5 font-mono" /></label>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Repo penampung (bare)</span><input v-model="form.repo_bare" class="rounded border border-grey-200 px-2 py-1.5 font-mono" /></label>
      <label class="col-span-2 flex flex-col gap-1"><span class="text-XS font-semibold">Perintah deploy (dijalankan di folder aplikasi)</span>
        <input v-model="form.perintah_deploy" class="rounded border border-grey-200 px-2 py-1.5 font-mono text-XS" />
        <span class="text-[11px] text-grey-400">Podman: <code>CONTAINER_CLI=podman ./deploy/server/deploy.sh</code>. Tanpa kontainer: mis. <code>npm run db:migrate &amp;&amp; pm2 restart all</code>.</span></label>
      <div class="col-span-2 rounded bg-info-50 p-2 text-XS text-info-400">
        Autentikasi memakai <b>kunci SSH</b> yang dibuat Studio (bukan sandi). Setelah menyimpan, klik <b>Buat kunci SSH</b> lalu tempel kunci publiknya di server.
      </div>
    </div>
    <template #footer>
      <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Batal" outlined @click="dialogForm = false" />
      <CustomButton label="Simpan" :disabled="sibuk === 'form'" @click="simpanForm" />
    </template>
  </Dialog>

  <!-- Kunci publik -->
  <Dialog :visible="!!dialogKunci" modal header="Kunci publik SSH Studio" :style="{ width: '44rem' }" @update:visible="dialogKunci = null">
    <div v-if="dialogKunci" class="flex flex-col gap-2 text-SM text-grey-500">
      <p>Tempel kunci ini <b>satu kali</b> di server <b>{{ dialogKunci.host }}</b> untuk pengguna <b>{{ dialogKunci.pengguna }}</b>:</p>
      <div class="flex items-start gap-2">
        <code class="min-w-0 grow break-all rounded bg-grey-75 p-2 text-XS">{{ dialogKunci.kunci_publik }}</code>
        <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" icon="PhCopy" outlined @click="salin(dialogKunci.kunci_publik)" />
      </div>
      <p class="text-XS">Di server (login sebagai {{ dialogKunci.pengguna }}), jalankan:</p>
      <pre class="overflow-auto rounded bg-grey-50 p-2 font-mono text-XS">mkdir -p ~/.ssh &amp;&amp; chmod 700 ~/.ssh
echo '{{ dialogKunci.kunci_publik }}' &gt;&gt; ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys</pre>
      <p class="text-XS text-grey-400">Lalu kembali ke sini: <b>Uji koneksi</b> → <b>Siapkan server</b>. Kunci privat disimpan terenkripsi di Studio dan tidak pernah ditampilkan.</p>
      <div class="flex justify-between">
        <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Lupakan sidik jari host" outlined :disabled="!dialogKunci.sidik_host" @click="lupakanSidik(dialogKunci)" />
        <CustomButton label="Buat kunci baru" outlined text-color="text-danger-300" border-color="border-danger-300" @click="buatKunci(dialogKunci)" />
      </div>
    </div>
  </Dialog>

  <!-- Konfirmasi deploy -->
  <Dialog :visible="!!dialogDeploy" modal :header="`Kirim ke ${dialogDeploy?.nama ?? ''}`" :style="{ width: '34rem' }" @update:visible="dialogDeploy = null">
    <div v-if="dialogDeploy" class="flex flex-col gap-2 text-SM text-grey-500">
      <p>Branch <b>{{ dialogDeploy.branch || info?.branch }}</b> ({{ info?.sha?.slice(0, 7) }}) dikirim ke <b>{{ dialogDeploy.pengguna }}@{{ dialogDeploy.host }}</b>, lalu folder <code>{{ dialogDeploy.repo_dir }}</code> diperbarui (fast-forward).</p>
      <label class="flex items-center gap-2"><input v-model="jalankanDeploy" type="checkbox" /> Jalankan juga <code class="text-XS">{{ dialogDeploy.perintah_deploy }}</code> (build, migrasi, health check, rollback otomatis)</label>
      <template v-if="dialogDeploy.jenis === 'produksi'">
        <div class="rounded bg-danger-50 p-2 text-XS text-danger-400">Ini server <b>PRODUKSI</b>. Pastikan item sudah lulus QA. Ketik nama server untuk melanjutkan.</div>
        <input v-model="konfirmasi" class="rounded border border-grey-200 px-2 py-1.5" :placeholder="dialogDeploy.nama" />
      </template>
    </div>
    <template #footer>
      <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Batal" outlined @click="dialogDeploy = null" />
      <CustomButton label="Kirim sekarang" icon="PhRocketLaunch" :disabled="sibuk === 'deploy' || (dialogDeploy?.jenis === 'produksi' && konfirmasi !== dialogDeploy?.nama)" @click="kirim" />
    </template>
  </Dialog>
</template>
