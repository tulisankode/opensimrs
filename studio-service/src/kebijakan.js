// Pemeriksa kebijakan otomatis atas perubahan buatan agen (rancangan §9.4). Fungsi murni → mudah diuji.
// Masukan: [{ path, status, patch }] — status porcelain git ("??", "M", "A", "D", ...).

// Zona merah: agen tidak boleh mengubah.
export const ZONA_MERAH = [
  { pola: /(^|\/)\.env(\.|$)/, alasan: "berkas .env/rahasia" },
  { pola: /^packages\/(authorization|permission)-sdk\//, alasan: "SDK autentikasi/izin" },
  { pola: /(^|\/)rahasia\.js$/, alasan: "enkripsi rahasia" },
  { pola: /^\.github\//, alasan: "CI/workflow" },
  { pola: /^deploy\//, alasan: "deploy server" },
  { pola: /^studio-service\//, alasan: "SIMRS Studio sendiri" },
  { pola: /(^|\/)CLAUDE(\.local)?\.md$/, alasan: "aturan agen" },
];
// Zona kuning: alur klinis & keuangan → item wajib berisiko tinggi/kritis.
export const ZONA_KUNING = [
  /^rekamedis-service\//, /^farmasi-service\//, /^stok-farmasi-service\//, /^payment-service\//, /^bpjs-service\//,
  /^satusehat-service\//, /^lab-service\//, /^auth-service\//,
];

const POLA_RAHASIA = [
  { pola: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, nama: "private key" },
  { pola: /\bsk-(ant-)?[A-Za-z0-9_-]{20,}/, nama: "kunci API" },
  { pola: /\bghp_[A-Za-z0-9]{30,}/, nama: "token GitHub" },
  { pola: /\bAKIA[0-9A-Z]{16}\b/, nama: "kunci AWS" },
  { pola: /(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["'][^"'\s]{12,}["']/i, nama: "sandi/kunci tertanam" },
  { pola: /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/, nama: "IP privat/server faskes" },
];

// Baris tambahan saja (awalan "+", bukan header "+++").
const barisTambahan = (patch = "") =>
  patch.split("\n").filter((b) => b.startsWith("+") && !b.startsWith("+++")).map((b) => b.slice(1));

// Data pribadi pada teks bebas (permintaan, diskusi, lampiran teks, baris kode). Data fiktif lolos:
// NIK berawalan 9999, HP 080000000000, email @contoh.id (dan domain contoh/proyek).
export const temukanDataPribadi = (teks = "") => {
  const temuan = [];
  for (const nik of String(teks).match(/\b\d{16}\b/g) ?? []) if (!nik.startsWith("9999")) temuan.push(`NIK ${nik.slice(0, 4)}…`);
  for (const hp of String(teks).match(/\b(\+62|62|0)8\d{8,11}\b/g) ?? []) if (!/^0?80{10}$/.test(hp.replace(/^\+?62/, "0"))) temuan.push(`HP ${hp.slice(0, 5)}…`);
  for (const email of String(teks).match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []) {
    if (!/@(contoh\.id|example\.(com|org)|anthropic\.com|opensimrs\.(id|my\.id)|users\.noreply\.github\.com)$/i.test(email)) temuan.push(`email ${email}`);
  }
  return temuan;
};

// Path yang tersebut di teks (mis. dokumen desain) → zona tertinggi yang tersentuh.
export const zonaTersentuh = (daftarPath) => {
  if (daftarPath.some((p) => ZONA_MERAH.some((z) => z.pola.test(p)))) return "merah";
  if (daftarPath.some((p) => ZONA_KUNING.some((z) => z.test(p)))) return "kuning";
  return "hijau";
};
const POLA_PATH = /\b[\w.-]+-service\/[\w./-]+|\bpackages\/[\w./-]+|\bdatabase\/[\w./-]+|\.github\/[\w./-]+|\bdeploy\/[\w./-]+/g;
export const pathDalamTeks = (teks = "") => [...new Set(String(teks).match(POLA_PATH) ?? [])];

// Path yang benar-benar direncanakan berubah dalam dokumen desain: abaikan baris penyangkalan ("tidak ada perubahan pada …",
// "kosong", "tidak menyentuh") dan pola glob (x/**). Bila ada tabel rencana berkas, hanya baris tabel yang dihitung.
const PENYANGKALAN = /\b(tidak ada|tidak (di)?ubah|tidak (akan )?menyentuh|tidak tersentuh|tanpa perubahan|kosong|tidak boleh|dilarang|zona (merah|terlarang))\b/i;
const LAYANAN = /`?\b([\w-]+-service)\b`?/;
const RELATIF = /`?\b((?:src|test|tests|public)\/[\w./-]+)/g;
export const pathDiubahDalamDesain = (teks = "") => {
  let layanan = null; // dari judul bagian, mis. "### 1.2 `lab-service`"
  const tabel = [];
  const lain = [];
  for (const b of String(teks).split("\n")) {
    if (/^\s*#/.test(b)) layanan = b.match(LAYANAN)?.[1] ?? null;
    if (PENYANGKALAN.test(b)) continue;
    const lengkap = [...b.matchAll(POLA_PATH)].filter((m) => b[m.index + m[0].length] !== "*").map((m) => m[0]);
    if (!b.trim().startsWith("|")) {
      lain.push(...lengkap);
      continue;
    }
    // Baris tabel: path relatif (src/…) digabung dengan nama layanan dari sel tabel atau judul bagian.
    const sel = b.split("|").map((x) => x.trim());
    const svc = sel.map((x) => x.match(new RegExp(`^${LAYANAN.source}$`))?.[1]).find(Boolean) ?? layanan;
    tabel.push(...lengkap);
    if (svc) for (const s of sel) for (const m of s.matchAll(RELATIF)) if (!lengkap.some((p) => p.endsWith(m[1]))) tabel.push(`${svc}/${m[1]}`);
  }
  return [...new Set(tabel.length ? tabel : lain)];
};

const POLA_MIGRASI =/^database\/migrations\/(\d{14})-[a-z0-9_-]+\.cjs$/i;

export const periksaKebijakan = (berkas, { risiko = "sedang", migrasiTerakhir = null } = {}) => {
  const temuan = [];
  const tambah = (cek, lulus, pesan) => temuan.push({ cek, lulus, pesan });

  // 1. Zona berkas
  const merah = berkas.flatMap((b) => ZONA_MERAH.filter((z) => z.pola.test(b.path)).map((z) => ({ teks: `${b.path} (${z.alasan})`, rahasia: z.alasan === "berkas .env/rahasia" })));
  // Risiko kritis dikerjakan programmer (bukan agen) dengan persetujuan core maintainer: zona merah boleh, kecuali .env.
  const blokir = risiko === "kritis" ? merah.filter((m) => m.rahasia) : merah;
  tambah(
    "Zona merah",
    !blokir.length,
    blokir.length
      ? `Mengubah berkas terlarang: ${blokir.map((m) => m.teks).join(", ")}`
      : merah.length
        ? `Risiko kritis (dikerjakan manusia): ${merah.map((m) => m.teks).join(", ")}`
        : "Tidak menyentuh berkas terlarang",
  );
  const kuning = berkas.filter((b) => ZONA_KUNING.some((z) => z.test(b.path))).map((b) => b.path);
  const risikoTinggi = ["tinggi", "kritis"].includes(risiko);
  tambah(
    "Zona kuning (klinis/keuangan)",
    !kuning.length || risikoTinggi,
    !kuning.length ? "Tidak menyentuh layanan klinis/keuangan" : risikoTinggi ? `Menyentuh ${kuning.length} berkas klinis/keuangan (risiko ${risiko})` : `Menyentuh layanan klinis/keuangan tetapi risiko item "${risiko}" — naikkan ke tinggi: ${kuning.join(", ")}`,
  );

  // 2. Rahasia & data pribadi pada baris tambahan
  const rahasia = [];
  const pribadi = [];
  for (const b of berkas) {
    for (const baris of barisTambahan(b.patch)) {
      for (const r of POLA_RAHASIA) if (r.pola.test(baris)) rahasia.push(`${b.path}: ${r.nama}`);
      for (const t of temukanDataPribadi(baris)) pribadi.push(`${b.path}: ${t}`);
    }
  }
  tambah("Rahasia & kunci", !rahasia.length, rahasia.length ? [...new Set(rahasia)].join("; ") : "Tidak ada pola rahasia");
  tambah("Data pribadi", !pribadi.length, pribadi.length ? [...new Set(pribadi)].slice(0, 10).join("; ") : "Hanya data fiktif (NIK 9999…, HP 080000000000, @contoh.id)");

  // 3. Migrasi: tidak mengubah migrasi lama, nama sesuai pola & urutan, idempoten (pola IF NOT EXISTS)
  const migrasi = berkas.filter((b) => b.path.startsWith("database/migrations/"));
  const masalahMigrasi = [];
  for (const m of migrasi) {
    if (!["??", "A"].includes(m.status)) masalahMigrasi.push(`${m.path} adalah migrasi lama yang diubah`);
    const cocok = m.path.match(POLA_MIGRASI);
    if (!cocok) masalahMigrasi.push(`${m.path}: nama harus YYYYMMDDHHMMSS-nama.cjs`);
    else if (migrasiTerakhir && cocok[1] <= migrasiTerakhir) masalahMigrasi.push(`${m.path}: stempel waktu harus setelah ${migrasiTerakhir}`);
    const isi = barisTambahan(m.patch).join("\n");
    if (/CREATE TABLE(?! IF NOT EXISTS)/i.test(isi) || /ADD COLUMN(?! IF NOT EXISTS)/i.test(isi) || /CREATE (UNIQUE )?INDEX(?! IF NOT EXISTS)/i.test(isi)) {
      masalahMigrasi.push(`${m.path}: gunakan IF NOT EXISTS agar idempoten`);
    }
  }
  tambah("Migrasi", !masalahMigrasi.length, migrasi.length ? masalahMigrasi.join("; ") || `${migrasi.length} migrasi baru sesuai aturan` : "Tidak ada migrasi");

  // 4. Katalog modul: perubahan katalog wajib disertai dokumen katalog
  const katalog = berkas.some((b) => b.path === "database/data/katalog-modul.json");
  const dokKatalog = berkas.some((b) => b.path.startsWith("docs/") && /katalog|MANAJEMEN-MODUL/i.test(b.path));
  tambah("Katalog modul", !katalog || dokKatalog, !katalog ? "Katalog tidak diubah" : dokKatalog ? "Katalog & dokumennya diperbarui" : "Katalog diubah tanpa menjalankan npm run docs:katalog");

  // 5. Uji & CHANGELOG
  const logika = berkas.filter((b) => /-service\/src\/.+\.(js|cjs|mjs|ts)$/.test(b.path) && !b.path.startsWith("frontend-service/"));
  const uji = berkas.some((b) => /(^|\/)test\/|\.test\.(js|ts|mjs)$/.test(b.path));
  tambah("Uji", !logika.length || uji, !logika.length ? "Tidak ada logika backend baru" : uji ? "Ada uji untuk perubahan backend" : "Logika backend berubah tanpa berkas uji (peringatan)");
  const changelog = berkas.some((b) => b.path === "CHANGELOG.md");
  tambah("CHANGELOG", changelog, changelog ? "Entri CHANGELOG ada" : "Tambahkan entri di CHANGELOG.md bagian [Belum dirilis]");

  // Peringatan (tidak menggagalkan): uji backend.
  const wajib = temuan.filter((t) => t.cek !== "Uji");
  return { lulus: wajib.every((t) => t.lulus), temuan };
};
