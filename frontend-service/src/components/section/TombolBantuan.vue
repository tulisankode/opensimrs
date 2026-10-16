<script setup lang="ts">
// Tombol Bantuan + panel chat asisten pengguna (Helpdesk AI lewat setting-service → OpenClaw Gateway).
// Tampil hanya bila setting-service melaporkan Helpdesk aktif untuk faskes ini. Jawaban dialirkan (server-sent events).
// Rancangan: docs/rancangan/HELPDESK-OPENCLAW.md.
import { computed, nextTick, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import Markdown from "@/views/SimrsStudio/Komponen/Markdown.vue";

type Pesan = { dari: "saya" | "asisten"; isi: string; galat?: boolean; disamarkan?: number };

const route = useRoute();
const aktif = ref(false);
const terbuka = ref(false);
const pesan = ref<Pesan[]>([]);
const masukan = ref("");
const menjawab = ref(false);
const daftar = ref<HTMLElement | null>(null);
let pembatal: AbortController | null = null;

const dasar = () => String(import.meta.env.VITE_URL_SETTING ?? "").replace(/\/$/, "");
const header = () => ({ Authorization: localStorage.getItem("access_token") ?? "", "Content-Type": "application/json" });

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

onMounted(async () => {
  try {
    const res = await fetch(`${dasar()}/bantuan/status`, { headers: header() });
    aktif.value = res.ok && Boolean((await res.json())?.payload?.aktif);
  } catch {
    aktif.value = false;
  }
});

const gulirBawah = () => nextTick(() => daftar.value?.scrollTo({ top: daftar.value.scrollHeight }));

const kirim = async (teks?: string) => {
  const pertanyaan = (teks ?? masukan.value).trim();
  if (!pertanyaan || menjawab.value) return;
  masukan.value = "";
  pesan.value.push({ dari: "saya", isi: pertanyaan });
  const jawaban: Pesan = { dari: "asisten", isi: "" };
  pesan.value.push(jawaban);
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
  <button v-if="aktif" type="button" class="my-auto flex aspect-square w-8 items-center justify-center rounded-full border-2 border-white text-white hover:bg-white/20"
    title="Bantuan" aria-label="Buka Bantuan" @click="terbuka = !terbuka">
    <PhQuestion :size="22" weight="bold" aria-hidden="true" />
  </button>

  <Teleport to="body">
    <aside v-if="aktif && terbuka" class="fixed bottom-4 right-4 top-20 z-[1100] flex w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-grey-200 bg-white shadow-2xl"
      aria-label="Panel Bantuan">
      <header class="flex items-center gap-2 bg-opensimrs-300 px-4 py-3 text-white">
        <PhChatCircleDots :size="22" weight="fill" aria-hidden="true" />
        <div class="flex-1">
          <div class="font-semibold">Bantuan</div>
          <div class="text-XS opacity-80">Asisten cara pakai OpenSIMRS</div>
        </div>
        <button type="button" class="rounded p-1 hover:bg-white/20" title="Percakapan baru" aria-label="Percakapan baru" @click="percakapanBaru"><PhArrowCounterClockwise :size="18" aria-hidden="true" /></button>
        <button type="button" class="rounded p-1 hover:bg-white/20" title="Tutup" aria-label="Tutup Bantuan" @click="terbuka = false"><PhX :size="18" aria-hidden="true" /></button>
      </header>

      <div ref="daftar" class="flex-1 space-y-3 overflow-y-auto p-3 text-SM">
        <div class="rounded-lg bg-opensimrs-50 p-3 text-XS text-grey-500">
          Tanyakan cara memakai aplikasi, misalnya langkah di halaman ini. Asisten <b>tidak bisa melihat data pasien</b>, jadi
          <b>jangan menulis NIK, nama, atau nomor RM pasien</b>. Data seperti itu disamarkan otomatis.
        </div>
        <div v-if="!pesan.length" class="flex flex-col gap-1.5">
          <button v-for="s in saran" :key="s" type="button" class="rounded-lg border border-opensimrs-100 px-3 py-1.5 text-left text-XS text-opensimrs-300 hover:bg-opensimrs-50" @click="kirim(s)">{{ s }}</button>
        </div>
        <div v-for="(p, i) in pesan" :key="i" class="flex" :class="p.dari === 'saya' ? 'justify-end' : 'justify-start'">
          <div v-if="p.dari === 'saya'" class="max-w-[85%] whitespace-pre-wrap rounded-lg bg-opensimrs-300 px-3 py-2 text-white">{{ p.isi }}</div>
          <div v-else class="max-w-[92%] rounded-lg px-3 py-2" :class="p.galat ? 'bg-danger-50 text-danger-400' : 'bg-grey-50'">
            <template v-if="p.galat">{{ p.isi }}</template>
            <template v-else-if="p.isi"><Markdown :isi="p.isi" /></template>
            <span v-else class="flex items-center gap-1 text-XS text-grey-400"><PhCircleNotch :size="14" class="animate-spin" aria-hidden="true" /> Menyusun jawaban…</span>
            <div v-if="!p.galat && p.isi && !(menjawab && i === pesan.length - 1)" class="mt-1 text-[10px] text-grey-300">
              Dijawab AI. Periksa kembali; bila ragu, hubungi tim IT.<template v-if="p.disamarkan"> · {{ p.disamarkan }} data pribadi disamarkan</template>
            </div>
          </div>
        </div>
      </div>

      <form class="flex items-end gap-2 border-t border-grey-100 p-3" @submit.prevent="kirim()">
        <textarea v-model="masukan" rows="2" maxlength="2000" class="flex-1 resize-none rounded-lg border border-grey-200 px-2 py-1.5 text-SM" placeholder="Tulis pertanyaan…"
          aria-label="Pertanyaan" @keydown.enter.exact.prevent="kirim()" />
        <button type="submit" class="rounded-lg bg-opensimrs-300 p-2 text-white disabled:opacity-50" :disabled="menjawab || !masukan.trim()" aria-label="Kirim pertanyaan">
          <PhPaperPlaneRight :size="18" weight="fill" aria-hidden="true" />
        </button>
      </form>
    </aside>
  </Teleport>
</template>
