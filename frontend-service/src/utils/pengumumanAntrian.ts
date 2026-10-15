// Pengumuman suara panggilan antrian untuk layar TV: bunyi "ting-tong" lalu suara bahasa Indonesia
// (Web Speech API bawaan browser). Panggilan diputar berurutan agar tidak saling menimpa.
// Browser hanya mengizinkan suara setelah ada interaksi pengguna (mis. klik "Lihat layar").

type Pengumuman = { teks: string };

const antre: Pengumuman[] = [];
let sedangBicara = false;
let audioCtx: AudioContext | null = null;

const ambilAudioCtx = () => {
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
};

// Bunyi dua nada (ting-tong) sebelum pengumuman.
const bunyiTingTong = () =>
  new Promise<void>((selesai) => {
    const ctx = ambilAudioCtx();
    if (!ctx) return selesai();
    const nada = (frekuensi: number, mulai: number, durasi: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frekuensi;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + mulai);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + mulai + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + mulai + durasi);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + mulai);
      osc.stop(ctx.currentTime + mulai + durasi + 0.05);
    };
    nada(880, 0, 0.6);
    nada(660, 0.55, 0.9);
    setTimeout(selesai, 1500);
  });

const suaraIndonesia = () => {
  if (!("speechSynthesis" in window)) return null;
  const daftar = window.speechSynthesis.getVoices();
  return daftar.find((v) => /^id(-|_|$)/i.test(v.lang)) ?? null;
};

export const adaSuaraIndonesia = () => !!suaraIndonesia();

const ucapkan = (teks: string) =>
  new Promise<void>((selesai) => {
    if (!("speechSynthesis" in window)) return selesai();
    const ucapan = new SpeechSynthesisUtterance(teks);
    ucapan.lang = "id-ID";
    const suara = suaraIndonesia();
    if (suara) ucapan.voice = suara;
    ucapan.rate = 0.9;
    ucapan.onend = () => selesai();
    ucapan.onerror = () => selesai();
    window.speechSynthesis.speak(ucapan);
    // Pengaman bila event onend tidak pernah datang (terjadi di sebagian browser).
    setTimeout(selesai, 15000);
  });

const putar = async () => {
  if (sedangBicara) return;
  sedangBicara = true;
  try {
    while (antre.length > 0) {
      const { teks } = antre.shift()!;
      await bunyiTingTong();
      await ucapkan(teks);
      await new Promise((r) => setTimeout(r, 600));
    }
  } finally {
    sedangBicara = false;
  }
};

export const umumkan = (teks: string) => {
  antre.push({ teks });
  putar();
};

// true bila browser sudah mengizinkan audio tanpa interaksi (mis. Chrome kiosk dengan
// --autoplay-policy=no-user-gesture-required) atau setelah layar diketuk.
export const suaraDiizinkan = () => {
  const ctx = ambilAudioCtx();
  return !ctx || ctx.state === "running";
};

// Dipanggil dari aksi klik pengguna agar browser mengizinkan audio & memuat daftar suara.
export const siapkanSuara = () => {
  ambilAudioCtx();
  if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
};

// "PU-02-002" → "P U, nol dua, nol nol dua" agar dibaca per huruf/angka dengan jeda.
const ANGKA = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];
export const ejaNomorAntrian = (nomor: string) =>
  String(nomor ?? "")
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((bagian) => bagian.split("").map((c) => (/\d/.test(c) ? ANGKA[Number(c)] : c.toUpperCase())).join(" "))
    .join(", ");

export const teksPanggilanPoli = (nomor: string, poli?: string, dokter?: string) =>
  `Nomor antrian, ${ejaNomorAntrian(nomor)}. Silakan menuju ${poli || "poli"}${dokter ? `, dokter ${dokter}` : ""}.`;

export const teksPanggilanAdmisi = (nomor: string) =>
  `Nomor antrian, ${ejaNomorAntrian(nomor)}. Silakan menuju loket pendaftaran.`;
