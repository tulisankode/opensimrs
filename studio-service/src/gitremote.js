// Integrasi Git hosting untuk Pull Request: GitHub (api.github.com) atau Gitea/Forgejo (git_api_url).
// Token disimpan terenkripsi di pengaturan (git_token); izin minimal: buat branch & PR, baca status/komentar.
import { bacaSemua } from "./pengaturan.js";
import { dekripsi } from "./rahasia.js";
import { slugRepo } from "./git.js";
import { Galat } from "./respons.js";

const konfigurasi = async () => {
  const { nilai } = await bacaSemua();
  if (!nilai.git_penyedia) return null;
  const token = dekripsi(nilai.git_token);
  if (!token) throw new Galat(400, "Token Git hosting belum diisi (Pengaturan & Agen › Integrasi Git)");
  const repo = nilai.git_repo || (await slugRepo());
  if (!repo) throw new Galat(400, "Repo Git hosting tidak diketahui (isi owner/nama di pengaturan)");
  const github = nilai.git_penyedia === "github";
  const dasar = github ? "https://api.github.com" : `${String(nilai.git_api_url || "").replace(/\/$/, "")}/api/v1`;
  if (!github && !nilai.git_api_url) throw new Galat(400, "URL Gitea/Forgejo belum diisi");
  const headers = github
    ? { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "simrs-studio" }
    : { Authorization: `token ${token}`, Accept: "application/json" };
  return { github, dasar, headers, repo, branchDasar: (nilai.branch_dasar || "origin/main").replace(/^origin\//, "") };
};

const api = async (k, metode, url, body) => {
  const r = await fetch(`${k.dasar}${url}`, { method: metode, headers: { ...k.headers, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const teks = await r.text();
  let json = null;
  try {
    json = JSON.parse(teks);
  } catch {
    json = null;
  }
  if (!r.ok) throw new Galat(502, `Git hosting ${r.status}: ${json?.message ?? teks.slice(0, 200)}`);
  return json;
};

export const aktif = async () => Boolean((await bacaSemua()).nilai.git_penyedia);

export const buatPR = async ({ branch, judul, isi, draf = true }) => {
  const k = await konfigurasi();
  if (!k) return null;
  const pr = await api(k, "POST", `/repos/${k.repo}/pulls`, { title: judul, head: branch, base: k.branchDasar, body: isi, ...(k.github ? { draft: draf } : {}) });
  return { nomor: pr.number, url: pr.html_url };
};

// { status: terbuka|merged|ditutup, mergeSha, ci: sukses|gagal|berjalan|tidak_ada, rincianCi[] }
export const statusPR = async (nomor) => {
  const k = await konfigurasi();
  if (!k || !nomor) return null;
  const pr = await api(k, "GET", `/repos/${k.repo}/pulls/${nomor}`);
  const status = pr.merged ? "merged" : pr.state === "open" ? "terbuka" : "ditutup";
  const sha = pr.head?.sha;
  let ci = "tidak_ada";
  let rincianCi = [];
  if (sha) {
    if (k.github) {
      const cek = await api(k, "GET", `/repos/${k.repo}/commits/${sha}/check-runs?per_page=50`);
      rincianCi = (cek.check_runs ?? []).map((c) => ({ nama: c.name, status: c.status, hasil: c.conclusion }));
      if (rincianCi.length) {
        ci = rincianCi.some((c) => c.status !== "completed") ? "berjalan" : rincianCi.every((c) => ["success", "skipped", "neutral"].includes(c.hasil)) ? "sukses" : "gagal";
      }
    } else {
      const st = await api(k, "GET", `/repos/${k.repo}/commits/${sha}/status`);
      rincianCi = (st.statuses ?? []).map((c) => ({ nama: c.context, status: c.status, hasil: c.status }));
      if (rincianCi.length) ci = { success: "sukses", pending: "berjalan" }[st.state] ?? "gagal";
    }
  }
  return { status, mergeSha: pr.merge_commit_sha ?? null, ci, rincianCi, url: pr.html_url };
};

// Komentar review (baris & umum) untuk diteruskan ke agen coding.
export const komentarReview = async (nomor) => {
  const k = await konfigurasi();
  if (!k || !nomor) return [];
  const hasil = [];
  const baris = await api(k, "GET", `/repos/${k.repo}/pulls/${nomor}/${k.github ? "comments" : "reviews"}?per_page=100`);
  for (const c of baris ?? []) if (c.body?.trim()) hasil.push({ oleh: c.user?.login, path: c.path ?? null, baris: c.line ?? c.original_line ?? null, isi: c.body.trim() });
  if (k.github) {
    const ulasan = await api(k, "GET", `/repos/${k.repo}/pulls/${nomor}/reviews?per_page=100`);
    for (const r of ulasan ?? []) if (r.body?.trim()) hasil.push({ oleh: r.user?.login, path: null, baris: null, isi: `[${r.state}] ${r.body.trim()}` });
  }
  const umum = await api(k, "GET", `/repos/${k.repo}/issues/${nomor}/comments?per_page=100`);
  for (const c of umum ?? []) if (c.body?.trim()) hasil.push({ oleh: c.user?.login, path: null, baris: null, isi: c.body.trim() });
  return hasil;
};

export const ujiKoneksi = async () => {
  const k = await konfigurasi();
  if (!k) throw new Galat(400, "Integrasi Git belum diaktifkan");
  const r = await api(k, "GET", `/repos/${k.repo}`);
  return { repo: r.full_name, privat: r.private, branchBawaan: r.default_branch };
};
