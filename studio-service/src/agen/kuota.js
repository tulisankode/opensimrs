// Agen tahan kuota: kenali galat kuota/rate limit dari Claude Code, Codex, dan konektor API, urai jam reset-nya, dan
// susun rantai cadangan konektor. Semua fungsi di sini murni (tanpa DB) agar mudah diuji.

export const ZONA_BAWAAN = "Asia/Jakarta";
// Tanpa jam reset yang bisa dibaca: coba lagi 15 menit kemudian.
export const JEDA_BAWAAN = 15 * 60;

// Awalan prompt coding saat pekerjaan dilanjutkan konektor lain / setelah kuota pulih.
export const CATATAN_LANJUTAN =
  "Pekerjaan sebelumnya terhenti karena kuota; worktree sudah berisi sebagian perubahan — periksa git status/diff dulu dan lanjutkan, jangan mengulang dari nol.";

export const NAMA_BAWAAN = { claude_code: "Claude Code (langganan)", codex: "Codex (langganan ChatGPT)" };

// Contoh nyata: "You've hit your session limit · resets 11:10am (Asia/Jakarta)", "Claude AI usage limit reached|1760000000",
// "You've hit your usage limit ... try again at 3:04 PM", "429 rate_limit_error", "API Error: 529 Overloaded".
const POLA_KUOTA = [
  /\b(?:session|usage|weekly|daily|monthly|5-hour|opus|sonnet)\s+limit\b/i,
  /\bhit your (?:\w+ )?limit\b/i,
  /\brate[_ -]?limit/i,
  /(?:^|api error:?|http|status|kode)\s*(?:429|529)\b/i,
  /\boverloaded/i,
  /\btoo many requests\b/i,
  /\b(?:insufficient_quota|quota exceeded|exceeded your current quota|resource_exhausted)\b/i,
];
// Bukan kuota penyedia: batas biaya Studio sendiri, konteks/prompt terlalu panjang.
const BUKAN_KUOTA = /budget|biaya|context (?:window|length|limit)|prompt is too long|max_tokens/i;

const SINGKATAN_ZONA = { WIB: "Asia/Jakarta", WITA: "Asia/Makassar", WIT: "Asia/Jayapura", UTC: "UTC", GMT: "UTC" };
const BULAN = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, mei: 4, jun: 5, jul: 6, aug: 7, agu: 7, agt: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, des: 11 };

const zonaSah = (tz) => {
  if (!tz) return ZONA_BAWAAN;
  const t = String(tz).trim();
  const z = SINGKATAN_ZONA[t.toUpperCase()] ?? t;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: z });
    return z;
  } catch {
    return ZONA_BAWAAN;
  }
};

const bagianZona = (ms, tz) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(ms))
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  );

// Selisih jam dinding zona terhadap UTC (ms) pada saat tertentu.
const offsetZona = (ms, tz) => {
  const p = bagianZona(ms, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
};

// Jam dinding (tahun, bulan 0-based, tanggal, jam, menit) di zona tz → epoch ms. Tanggal yang meluap (mis. 32) ikut digeser.
export const epochDiZona = (tahun, bulan, tanggal, jam, menit, tz = ZONA_BAWAAN) => {
  const tebak = Date.UTC(tahun, bulan, tanggal, jam, menit);
  const t = tebak - offsetZona(tebak, tz);
  return tebak - offsetZona(t, tz);
};

// "11:10am" / "3:50 PM" / "15:30" / "3pm" → { jam, menit } (24 jam) atau null. Angka tanpa ":" dan tanpa am/pm diabaikan.
const uraiJam = (j, m, ampm) => {
  let jam = Number(j);
  const menit = m != null ? Number(m) : 0;
  if (m == null && !ampm) return null;
  if (ampm) {
    if (jam < 1 || jam > 12) return null;
    jam = (jam % 12) + (ampm.toLowerCase() === "p" ? 12 : 0);
  }
  if (jam > 23 || menit > 59) return null;
  return { jam, menit };
};

const RELATIF = /(?:try again|retry|resets?|available)\s+in\s+((?:\d+\s*(?:days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b[\s,]*(?:and\s+)?)+)/i;
const ABSOLUT = new RegExp(
  String.raw`(?:resets?|reset at|try again at|retry at|available again at|available at)\s*(?:at\s+|on\s+)?` +
    String.raw`(?:(jan|feb|mar|apr|may|mei|jun|jul|aug|agu|agt|sep|oct|okt|nov|dec|des)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(?:(\d{4}),?\s*)?(?:at\s+)?)?` +
    String.raw`(\d{1,2})(?:[:.](\d{2}))?\s*(?:([ap])\.?\s?m\b\.?)?(?:\s*\(([^)]+)\)|\s*\b(WIB|WITA|WIT|UTC|GMT)\b)?`,
  "i",
);

// Waktu reset dari teks galat (epoch detik) atau null bila tidak ada.
export const uraiWaktuReset = (pesan, sekarangMs = Date.now()) => {
  const teks = String(pesan ?? "");
  const epoch = teks.match(/limit reached\|(\d{10})\b/i);
  if (epoch) return Number(epoch[1]);

  const rel = teks.match(RELATIF);
  if (rel) {
    const SATUAN = { d: 86400, h: 3600, m: 60, s: 1 };
    let detik = 0;
    for (const [, n, s] of rel[1].matchAll(/(\d+)\s*(d|h|m|s)/gi)) detik += Number(n) * SATUAN[s.toLowerCase()];
    if (detik > 0) return Math.floor(sekarangMs / 1000) + detik;
  }

  const m = teks.match(ABSOLUT);
  if (!m) return null;
  const [, bln, tgl, thn, j, mnt, ampm, zonaKurung, zonaSingkat] = m;
  const waktu = uraiJam(j, mnt, ampm);
  if (!waktu) return null;
  const tz = zonaSah(zonaKurung ?? zonaSingkat);
  const kini = bagianZona(sekarangMs, tz);
  if (bln) {
    const bulan = BULAN[bln.toLowerCase().slice(0, 3)];
    let tahun = thn ? Number(thn) : kini.year;
    let t = epochDiZona(tahun, bulan, Number(tgl), waktu.jam, waktu.menit, tz);
    // Tanggal tanpa tahun yang sudah lewat jauh → tahun depan (mis. "resets Jan 2" dibaca pada akhir Desember).
    if (!thn && t < sekarangMs - 86400_000) t = epochDiZona(++tahun, bulan, Number(tgl), waktu.jam, waktu.menit, tz);
    return Math.floor(t / 1000);
  }
  // Hanya jam: kejadian berikutnya (sudah lewat hari ini → besok).
  let t = epochDiZona(kini.year, kini.month - 1, kini.day, waktu.jam, waktu.menit, tz);
  if (t <= sekarangMs) t = epochDiZona(kini.year, kini.month - 1, kini.day + 1, waktu.jam, waktu.menit, tz);
  return Math.floor(t / 1000);
};

const tebakPenyedia = (teks) => {
  if (/codex|chatgpt/i.test(teks)) return "codex";
  // Galat HTTP API diperiksa lebih dulu: pesannya bisa menyebut nama model (mis. "model: claude-sonnet-5-5").
  if (/^\s*(?:429|529)\b|rate_limit_error|insufficient_quota|overloaded_error|organization's rate limit/i.test(teks)) return "api";
  if (/claude|session limit|resets\s/i.test(teks)) return "claude_code";
  if (/try again at/i.test(teks)) return "codex";
  return "api";
};

// Saldo kredit/tagihan konektor API habis (mis. Anthropic "Your credit balance is too low to access the Anthropic API",
// HTTP 402). Tidak pulih sendiri seperti rate limit: rantai beralih ke konektor berikutnya, dan bila semua habis tugas
// ditunda lebih lama (admin perlu mengisi saldo).
const POLA_KREDIT = /credit balance is too low|purchase credits|billing[_ ](?:hard[_ ])?limit|payment required|^\s*402\b/i;
export const JEDA_KREDIT = 60 * 60;

// Galat jaringan sementara ke penyedia (mis. "fetch failed" dari konektor API, "API Error: Connection lost mid-response"
// dari Claude Code): diperlakukan seperti kuota — beralih ke konektor berikutnya, atau ditunda singkat bila semua gagal.
const POLA_JARINGAN = /fetch failed|connection lost mid-response|socket hang up|\b(?:ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|UND_ERR_[A-Z_]+)\b/i;
export const JEDA_JARINGAN = 5 * 60;

// Galat kuota? → null atau { penyedia, lanjutPada (epoch detik), diketahui (jam reset terbaca dari teks), kredit, jaringan }.
export const kenaliGalatKuota = (pesan, sekarangMs = Date.now()) => {
  const teks = String(pesan ?? "");
  if (!teks.trim()) return null;
  const kini = Math.floor(sekarangMs / 1000);
  if (POLA_KREDIT.test(teks)) return { penyedia: "api", lanjutPada: kini + JEDA_KREDIT, diketahui: false, kredit: true, jaringan: false };
  if (!BUKAN_KUOTA.test(teks) && POLA_KUOTA.some((p) => p.test(teks))) {
    const reset = uraiWaktuReset(teks, sekarangMs);
    return {
      penyedia: tebakPenyedia(teks),
      lanjutPada: reset && reset > kini ? reset : kini + JEDA_BAWAAN,
      diketahui: Boolean(reset && reset > kini),
      kredit: false,
      jaringan: false,
    };
  }
  if (POLA_JARINGAN.test(teks)) return { penyedia: tebakPenyedia(teks), lanjutPada: kini + JEDA_JARINGAN, diketahui: false, kredit: false, jaringan: true };
  return null;
};

// Rantai konektor tahap: konektor utama lalu cadangan berurutan (tanpa duplikat).
export const susunRantai = (utama, cadangan = []) =>
  [...new Set([utama || "claude_code", ...(Array.isArray(cadangan) ? cadangan : [])].filter((k) => typeof k === "string" && k))];

export const konektorBerikutnya = (rantai, dicoba) => rantai.find((k) => !dicoba.has(k)) ?? null;

// Paling awal di antara jam reset yang diketahui; bila tidak ada yang diketahui, paling awal dari perkiraan.
export const lanjutPalingAwal = (habis) => {
  const diketahui = habis.filter((h) => h.diketahui);
  const sumber = diketahui.length ? diketahui : habis;
  return sumber.length ? Math.min(...sumber.map((h) => Number(h.lanjutPada))) : null;
};

// Semua konektor dalam rantai habis kuota.
export class GalatKuota extends Error {
  constructor(habis) {
    super(`Kuota habis: ${habis.map((h) => h.nama).join(", ")}`);
    this.kuota = true;
    this.habis = habis;
    this.lanjutPada = lanjutPalingAwal(habis);
  }
}

const dua = (n) => String(n).padStart(2, "0");
const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// "pukul 11.10 WIB" / "besok pukul 03.50 WIB" / "20 Okt pukul 14.00 WIB".
export const waktuLanjut = (epoch, sekarangMs = Date.now()) => {
  const p = bagianZona(Number(epoch) * 1000, ZONA_BAWAAN);
  const k = bagianZona(sekarangMs, ZONA_BAWAAN);
  const jam = `pukul ${dua(p.hour % 24)}.${dua(p.minute)} WIB`;
  const hari = (x) => Date.UTC(x.year, x.month - 1, x.day) / 86400_000;
  const selisih = hari(p) - hari(k);
  if (selisih <= 0) return jam;
  if (selisih === 1) return `besok ${jam}`;
  return `${p.day} ${NAMA_BULAN[p.month - 1]} ${jam}`;
};
