<script setup lang="ts">
// Tombol Bantuan (ikon headset di header) + jendela chat asisten pengguna (Helpdesk AI lewat setting-service → OpenClaw
// Gateway). Jawaban dialirkan (server-sent events). Bila Helpdesk belum aktif, jendela menjelaskan alasannya.
// Rancangan: docs/rancangan/HELPDESK-OPENCLAW.md.
import { computed, nextTick, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import Markdown from "@/views/SimrsStudio/Komponen/Markdown.vue";

type Pesan = { dari: "saya" | "asisten"; isi: string; galat?: boolean; disamarkan?: number };

const route = useRoute();
const status = ref<{ aktif: boolean; alasan?: string } | null>(null);
const aktif = computed(() => Boolean(status.value?.aktif));
const terbuka = ref(false);
// Balasan yang selesai saat jendela tertutup → badge di tombol; dibuka = sudah dibaca.
const belumDibaca = ref(0);
const pesan = ref<Pesan[]>([]);
const masukan = ref("");
const menjawab = ref(false);
const daftar = ref<HTMLElement | null>(null);
let pembatal: AbortController | null = null;

const dasar = () => String(import.meta.env.VITE_URL_SETTING ?? "").replace(/\/$/, "");
const header = () => ({ Authorization: localStorage.getItem("access_token") ?? "", "Content-Type": "application/json" });
const superadmin = () => {
  try {
    return String(JSON.parse(localStorage.getItem("user") ?? "{}")?.role ?? "").trim().toLowerCase() === "super admin";
  } catch {
    return false;
  }
};

const sesiBaru = () => {
  const id = Math.random().toString(36).slice(2, 12);
  try {
    sessionStorage.setItem("bantuan_sesi", id);
  } catch {
    /* tanpa sessionStorage: sesi per muat halaman */
  }
  return id;
};
let sesi = (() => {
  try {
    return sessionStorage.getItem("bantuan_sesi") || sesiBaru();
  } catch {
    return sesiBaru();
  }
})();

// Saran pertanyaan sesuai halaman yang sedang dibuka.
const SARAN: Array<[RegExp, string[]]> = [
  [/^\/admisi/, ["Bagaimana mendaftarkan pasien baru?", "Cara mencari pasien lama?", "Kenapa pasien tidak bisa didaftarkan?"]],
  [/^\/rawat-jalan|^\/rawatjalan/, ["Cara mengisi asesmen pasien?", "Bagaimana membuat resep?", "Cara menyelesaikan kunjungan?"]],
  [/^\/laboratorium/, ["Bagaimana membatalkan order lab?", "Cara mencetak hasil lab?", "Cara memvalidasi hasil?"]],
  [/^\/farmasi/, ["Cara memproses resep masuk?", "Bagaimana penjualan obat bebas?"]],
  [/^\/pembayaran/, ["Cara menerima pembayaran?", "Bagaimana mencetak kuitansi?"]],
  [/^\/setting/, ["Kenapa menu tidak muncul?", "Cara mengaktifkan modul?"]],
];
const saran = computed(() => SARAN.find(([pola]) => pola.test(route.path))?.[1] ?? ["Kenapa sebuah menu tidak muncul?", "Bagaimana mengganti kata sandi?"]);

const muatStatus = async () => {
  try {
    const res = await fetch(`${dasar()}/bantuan/status`, { headers: header() });
    const j = await res.json().catch(() => null);
    status.value = res.ok ? j?.payload ?? { aktif: false } : { aktif: false, alasan: j?.message ?? `Layanan bantuan tidak tersedia (${res.status})` };
  } catch {
    status.value = { aktif: false, alasan: "Layanan bantuan tidak dapat dihubungi" };
  }
};
onMounted(muatStatus);

const buka = () => {
  terbuka.value = !terbuka.value;
  if (terbuka.value) belumDibaca.value = 0;
  // Status diperiksa ulang saat dibuka (mis. Helpdesk baru diaktifkan admin).
  if (terbuka.value && !aktif.value) muatStatus();
};

const gulirBawah = () => nextTick(() => daftar.value?.scrollTo({ top: daftar.value.scrollHeight }));

const kirim = async (teks?: string) => {
  const pertanyaan = (teks ?? masukan.value).trim();
  if (!pertanyaan || menjawab.value || !aktif.value) return;
  masukan.value = "";
  pesan.value.push({ dari: "saya", isi: pertanyaan });
  pesan.value.push({ dari: "asisten", isi: "" });
  const indeks = pesan.value.length - 1;
  menjawab.value = true;
  pembatal = new AbortController();
  gulirBawah();
  try {
    const res = await fetch(`${dasar()}/bantuan/chat`, {
      method: "POST",
      headers: header(),
      body: JSON.stringify({ pertanyaan, halaman: route.path, sesi }),
      signal: pembatal.signal,
    });
    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => null);
      throw new Error(j?.message ?? `Bantuan tidak tersedia (${res.status})`);
    }
    const pembaca = res.body.getReader();
    const dekoder = new TextDecoder();
    let sisa = "";
    for (;;) {
      const { value, done } = await pembaca.read();
      if (done) break;
      sisa += dekoder.decode(value, { stream: true });
      const blok = sisa.split("\n\n");
      sisa = blok.pop() ?? "";
      for (const b of blok) {
        const data = b.replace(/^data:\s*/, "");
        if (!data) continue;
        const e = JSON.parse(data);
        if (e.galat) throw new Error(e.galat);
        if (e.teks) pesan.value[indeks].isi += e.teks;
        if (e.selesai) pesan.value[indeks].disamarkan = e.disamarkan;
      }
      gulirBawah();
    }
  } catch (e: any) {
    if (e?.name !== "AbortError") pesan.value[indeks] = { dari: "asisten", isi: e?.message ?? "Bantuan gagal menjawab.", galat: true };
  } finally {
    menjawab.value = false;
    pembatal = null;
    // Jawaban selesai (atau gagal) saat jendela ditutup → tandai belum dibaca.
    if (!terbuka.value && pesan.value[indeks]?.isi) belumDibaca.value++;
    gulirBawah();
  }
};

const percakapanBaru = () => {
  pembatal?.abort();
  pesan.value = [];
  sesi = sesiBaru();
};
</script>

<template>
  <button type="button" class="relative my-auto flex aspect-square w-8 items-center justify-center rounded-full text-white hover:bg-white/20"
    :class="terbuka ? 'bg-white/25' : ''" :title="belumDibaca ? `Bantuan · ${belumDibaca} balasan baru` : 'Bantuan'"
    :aria-label="belumDibaca ? `Buka Bantuan, ${belumDibaca} balasan baru` : 'Buka Bantuan'" :aria-expanded="terbuka" @click="buka">
    <!-- Asisten masih menyusun jawaban saat jendela tertutup -->
    <span v-if="menjawab && !terbuka" class="absolute inset-0 animate-ping rounded-full bg-white/40" aria-hidden="true" />
    <PhHeadset :size="30" weight="fill" class="relative" aria-hidden="true" />
    <span v-if="belumDibaca" class="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-opensimrs-300 bg-danger-300 px-1 text-[10px] font-bold leading-none text-white" aria-hidden="true">
      {{ belumDibaca > 9 ? "9+" : belumDibaca }}
    </span>
    <span v-if="aktif" class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-opensimrs-300 bg-success-300" aria-hidden="true" />
  </button>

  <Teleport to="body">
    <transition enter-from-class="opacity-0 translate-y-2" enter-active-class="transition duration-150" leave-to-class="opacity-0 translate-y-2" leave-active-class="transition duration-100">
      <aside v-if="terbuka" class="fixed right-4 top-20 z-[1100] flex h-[min(620px,calc(100vh-7rem))] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-grey-200 bg-white shadow-2xl"
        aria-label="Jendela Bantuan">
        <header class="flex items-center gap-3 bg-opensimrs-300 px-4 py-3 text-white">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-white/20"><PhHeadset :size="20" weight="fill" aria-hidden="true" /></div>
          <div class="flex-1">
            <div class="font-semibold">Bantuan OpenSIMRS</div>
            <div class="flex items-center gap-1 text-XS opacity-90">
              <span class="h-2 w-2 rounded-full" :class="aktif ? 'bg-success-300' : 'bg-grey-300'" aria-hidden="true" />
              {{ aktif ? "Asisten siap membantu" : "Belum aktif" }}
            </div>
          </div>
          <button v-if="aktif" type="button" class="rounded p-1 hover:bg-white/20" title="Percakapan baru" aria-label="Percakapan baru" @click="percakapanBaru"><PhArrowCounterClockwise :size="18" aria-hidden="true" /></button>
          <button type="button" class="rounded p-1 hover:bg-white/20" title="Tutup" aria-label="Tutup Bantuan" @click="terbuka = false"><PhX :size="18" aria-hidden="true" /></button>
        </header>

        <!-- Belum aktif: jelaskan alasannya -->
        <div v-if="!aktif" class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-SM text-grey-500">
          <PhHeadset :size="48" weight="duotone" class="text-grey-300" aria-hidden="true" />
          <div class="font-semibold">Asisten Bantuan belum aktif</div>
          <div class="text-XS text-grey-400">{{ status?.alasan ?? "Memeriksa status…" }}</div>
          <div class="text-XS text-grey-400">
            <template v-if="superadmin()">Panduan pemasangan: <code>deploy/helpdesk/README.md</code>.</template>
            <template v-else>Untuk sementara, hubungi tim IT faskes Anda.</template>
          </div>
        </div>

        <template v-else>
          <div ref="daftar" class="flex-1 space-y-3 overflow-y-auto bg-grey-50 p-3 text-SM">
            <!-- Sapaan pembuka -->
            <div class="flex items-end gap-2">
              <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-opensimrs-300 text-white"><PhHeadset :size="15" weight="fill" aria-hidden="true" /></div>
              <div class="max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-grey-500 shadow-sm">
                Halo! Saya asisten Bantuan OpenSIMRS. Tanyakan cara memakai aplikasi, misalnya langkah di halaman ini.
                <div class="mt-1 text-XS text-grey-400">Saya tidak bisa melihat data pasien. <b>Jangan menulis NIK, nama, atau nomor RM pasien</b>; data seperti itu disamarkan otomatis.</div>
              </div>
            </div>
            <div v-if="!pesan.length" class="flex flex-wrap gap-1.5 pl-9">
              <button v-for="s in saran" :key="s" type="button" class="rounded-full border border-opensimrs-100 bg-white px-3 py-1 text-left text-XS text-opensimrs-300 hover:bg-opensimrs-50" @click="kirim(s)">{{ s }}</button>
            </div>
            <div v-for="(p, i) in pesan" :key="i" class="flex items-end gap-2" :class="p.dari === 'saya' ? 'justify-end' : 'justify-start'">
              <div v-if="p.dari === 'asisten'" class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-opensimrs-300 text-white"><PhHeadset :size="15" weight="fill" aria-hidden="true" /></div>
              <div v-if="p.dari === 'saya'" class="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-opensimrs-300 px-3 py-2 text-white">{{ p.isi }}</div>
              <div v-else class="max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm" :class="p.galat ? 'bg-danger-50 text-danger-400' : 'bg-white'">
                <template v-if="p.galat">{{ p.isi }}</template>
                <template v-else-if="p.isi"><Markdown :isi="p.isi" /></template>
                <span v-else class="flex items-center gap-1 py-1" aria-label="Menyusun jawaban">
                  <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-grey-300" />
                  <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-grey-300 [animation-delay:150ms]" />
                  <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-grey-300 [animation-delay:300ms]" />
                </span>
                <div v-if="!p.galat && p.isi && !(menjawab && i === pesan.length - 1)" class="mt-1 text-[10px] text-grey-300">
                  Dijawab AI. Periksa kembali; bila ragu, hubungi tim IT.<template v-if="p.disamarkan"> · {{ p.disamarkan }} data pribadi disamarkan</template>
                </div>
              </div>
            </div>
          </div>

          <form class="flex items-end gap-2 border-t border-grey-100 bg-white p-3" @submit.prevent="kirim()">
            <textarea v-model="masukan" rows="1" maxlength="2000" class="max-h-28 flex-1 resize-none rounded-2xl border border-grey-200 px-3 py-2 text-SM" placeholder="Tulis pertanyaan…"
              aria-label="Pertanyaan" @keydown.enter.exact.prevent="kirim()" />
            <button type="submit" class="flex h-9 w-9 items-center justify-center rounded-full bg-opensimrs-300 text-white disabled:opacity-50" :disabled="menjawab || !masukan.trim()" aria-label="Kirim pertanyaan">
              <PhPaperPlaneRight :size="16" weight="fill" aria-hidden="true" />
            </button>
          </form>
        </template>
      </aside>
    </transition>
  </Teleport>
</template>
