// Kecocokan model dengan agen per tahap: Claude Code hanya model Claude, Codex hanya model OpenAI, konektor API memakai
// model yang diatur di konektornya sendiri (tidak ditimpa per tahap).
const MODEL_CLAUDE = /^(opus|sonnet|haiku|claude-[\w.-]+)$/i;
const BUKAN_OPENAI = /^(opus|sonnet|haiku|claude)/i;

export const cocokModel = (pilihan, model) => {
  if (!model) return true;
  if (!pilihan || pilihan === "claude_code") return MODEL_CLAUDE.test(model);
  if (pilihan === "codex") return /^[\w.:-]+$/.test(model) && !BUKAN_OPENAI.test(model);
  return false;
};

export const pesanTidakCocok = (tahap, pilihan, model) =>
  `Model "${model}" tidak cocok untuk tahap ${tahap}: ` +
  (!pilihan || pilihan === "claude_code" ? "Claude Code hanya memakai model Claude (opus, sonnet, haiku, claude-…)"
    : pilihan === "codex" ? "Codex hanya memakai model OpenAI"
    : "konektor API memakai model yang diatur di konektornya");
