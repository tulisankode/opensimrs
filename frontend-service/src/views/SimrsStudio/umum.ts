// Konstanta & helper bersama halaman SIMRS Studio.
import { marked } from "marked";
import DOMPurify from "dompurify";

export const TAHAP = [
  { kode: "permintaan", nama: "Permintaan", ikon: "PhChatText" },
  { kode: "usecase", nama: "Use case", ikon: "PhFlowArrow" },
  { kode: "prd", nama: "PRD", ikon: "PhFileText" },
  { kode: "desain", nama: "Desain teknis", ikon: "PhTreeStructure" },
  { kode: "coding", nama: "Coding", ikon: "PhCode" },
  { kode: "qa", nama: "QA", ikon: "PhCheckSquare" },
  { kode: "rilis", nama: "Rilis", ikon: "PhRocketLaunch" },
] as const;

export const NAMA_TAHAP: Record<string, string> = {
  ...Object.fromEntries(TAHAP.map((t) => [t.kode, t.nama])),
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};

export const NAMA_JENIS: Record<string, string> = { fitur: "Fitur", perbaikan: "Perbaikan", laporan: "Laporan", modul: "Modul baru" };

export const WARNA_RISIKO: Record<string, string> = {
  rendah: "bg-success-50 text-success-400",
  sedang: "bg-warning-50 text-warning-400",
  tinggi: "bg-danger-50 text-danger-400",
  kritis: "bg-danger-300 text-white",
};

export const nomorItem = (n: number | string) => `STD-${String(n).padStart(4, "0")}`;

export const formatWaktu = (epoch?: number | string | null) =>
  epoch
    ? new Date(Number(epoch) * 1000).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "-";

export const formatUsd = (n?: number | string | null) => `US$ ${Number(n ?? 0).toFixed(2)}`;

// Markdown buatan AI → HTML yang sudah dibersihkan (tanpa skrip/atribut berbahaya).
export const keHtml = (md?: string | null) => DOMPurify.sanitize(marked.parse(md ?? "", { async: false, gfm: true }) as string);

// Info kuota langganan dari rate_limit_event Claude Code.
export const ringkasKuota = (k: any) => {
  if (!k) return null;
  const jenis: Record<string, string> = { five_hour: "5 jam", seven_day: "7 hari", seven_day_opus: "7 hari (Opus)" };
  return {
    jenis: jenis[k.rateLimitType] ?? k.rateLimitType ?? "-",
    persen: k.utilization != null ? Math.round(Number(k.utilization) * 100) : null,
    reset: k.resetsAt ? formatWaktu(k.resetsAt) : null,
    status: k.status,
  };
};
