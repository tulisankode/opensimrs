import { query, sekarang } from "./db.js";

// Pengaturan Studio tingkat instalasi (studio_pengaturan: kunci → nilai JSON).
export const BAWAAN = {
  mode_pengembang: { aktif: false },
  // L6: hentikan Studio (semua item dibekukan, tugas agen dibatalkan).
  kill_switch: { aktif: false, alasan: null },
  // L4: fitur Studio. Coding & ekstensi mati bawaan (rancangan §5.2) — diaktifkan sadar oleh superadmin.
  fitur: { desain: true, coding: false, qa: true, rilis: true, ekstensi: false },
  // Pembuat item / penyunting dokumen tidak boleh menjadi satu-satunya penyetuju (risiko ≥ sedang). Mati bawaan selama
  // maintainer masih satu orang; nyalakan bila tim sudah berperan terpisah.
  pemisahan_tugas: false,
  // workspace = di working tree repo (npm run dev langsung jadi pratinjau); worktree = salinan terpisah per item.
  mode_kerja: "workspace",
  direktori_worktree: "",
  // Rilis: "lokal" = tanpa push/PR, perubahan digabung ke branch lokal yang dipakai aplikasi RS (bawaan);
  // "pr" = push & Pull Request ke GitHub/Gitea; "keduanya".
  mode_rilis: "lokal",
  // Branch yang dipakai aplikasi RS; kosong = branch yang sedang aktif di repo (bukan branch item).
  branch_lokal: "",
  // Jalankan npm run db:migrate setelah penerapan lokal bila ada migrasi baru.
  migrasi_otomatis: true,
  // Titik awal branch kerja item untuk mode "pr" (git switch -c <branch item> --no-track <branch_dasar>).
  // Pada mode "lokal"/"keduanya", item bercabang dari branch lokal agar kustomisasi saling menumpuk.
  branch_dasar: "origin/main",
  // Konektor per tahap: "claude_code" (CLI langganan) atau uuid studio_konektor.
  konektor_tahap: {},
  // Model per tahap; "" = bawaan konektor. Kunci: permintaan, usecase, prd, desain, coding, qa, rilis, ekstensi.
  model_tahap: {},
  // Aturan prompt lapis instalasi (ditambahkan ke setiap tugas agen).
  aturan_instalasi: "",
  // Baris atribusi commit (kosong = tanpa).
  atribusi_commit: "Co-Authored-By: Claude <noreply@anthropic.com>",
  cek_build_frontend: true,
  // Batas biaya (US$, setara harga API; null = tanpa batas) & kuota langganan (% pemakaian rate limit Claude Code).
  batas_biaya_tugas: null,
  batas_biaya_item: null,
  batas_biaya_bulan: null,
  batas_kuota_persen: 95,
  // Batas jumlah tugas agen yang dimulai per pengguna per jam.
  batas_tugas_per_jam: 30,
  // Integrasi Git hosting untuk Pull Request: github | gitea | "" (tanpa; Studio memberi tautan compare).
  git_penyedia: "",
  git_api_url: "",
  git_repo: "",
  git_token: "", // enc:v1 — tidak pernah dikirim ke frontend
  // Penanda tangan paket ekstensi (Ed25519). Kunci privat terenkripsi; kunci publik dipasang di produksi (EKSTENSI_KUNCI_PUBLIK).
  ekstensi_kunci_privat: "",
  ekstensi_kunci_publik: "",
};

// Kunci rahasia yang tidak boleh keluar dari server.
export const RAHASIA = ["git_token", "ekstensi_kunci_privat"];

export const bacaSemua = async () => {
  const baris = await query(`SELECT kunci, nilai, diubah_oleh, updated_at FROM studio_pengaturan`);
  const hasil = structuredClone(BAWAAN);
  const meta = {};
  for (const b of baris) {
    if (b.kunci in BAWAAN) hasil[b.kunci] = b.nilai && typeof b.nilai === "object" && !Array.isArray(b.nilai) && typeof BAWAAN[b.kunci] === "object" && BAWAAN[b.kunci] ? { ...BAWAAN[b.kunci], ...b.nilai } : b.nilai;
    meta[b.kunci] = { diubahOleh: b.diubah_oleh, diubahPada: Number(b.updated_at) };
  }
  return { nilai: hasil, meta };
};

export const baca = async (kunci) => (await bacaSemua()).nilai[kunci];

// Untuk frontend: rahasia diganti penanda ada/tidak.
export const untukTampilan = (nilai) => {
  const salin = { ...nilai };
  for (const k of RAHASIA) salin[k] = nilai[k] ? "••••••••" : "";
  return salin;
};

export const simpan = async (kunci, nilai, oleh) => {
  if (!(kunci in BAWAAN)) throw new Error(`Pengaturan tidak dikenal: ${kunci}`);
  await query(
    `INSERT INTO studio_pengaturan (kunci, nilai, diubah_oleh, updated_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (kunci) DO UPDATE SET nilai = EXCLUDED.nilai, diubah_oleh = EXCLUDED.diubah_oleh, updated_at = EXCLUDED.updated_at`,
    [kunci, JSON.stringify(nilai), oleh, sekarang()],
  );
};
