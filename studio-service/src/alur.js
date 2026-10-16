// Alur item SIMRS Studio: tahap, gerbang persetujuan per peran, tugas agen, cek otomatis, checklist uji, commit, PR, rilis.
// Rancangan: docs/rancangan/STUDIO-PENGEMBANG.md §6–8, §16.
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import config from "./config.js";
import { audit, query, satu, sekarang, sisipkan, ubah, uuidv7 } from "./db.js";
import { Galat, permintaanSalah, tidakDitemukan } from "./respons.js";
import { bacaSemua } from "./pengaturan.js";
import { berkasBerubah, branchSekarang, git, patchBerkas, potretKerja, statusBerkas, urlRepo } from "./git.js";
import { branchDasar, branchLokal, direktoriKerja, hapusWorktree, modeLokal, pastikanDiBranch, siapkanKerja } from "./kerja.js";
import { pathDiubahDalamDesain, periksaKebijakan, temukanDataPribadi, zonaTersentuh } from "./kebijakan.js";
import { FOLDER_LAMPIRAN, estimasiBiaya, jalankanAgen, periksaBatas } from "./agen/index.js";
import { NAMA_TAHAP, susunPromptCoding, susunPromptDokumen, uraiKeluaran } from "./agen/prompt.js";
import { IZIN_KERJA_TAHAP, PERAN, gerbangTahap, statusGerbang } from "./gerbang.js";
import { isSuperadmin } from "./auth.js";
import { punya, pastikan } from "./izin.js";
import * as gitremote from "./gitremote.js";

export const TAHAP = ["permintaan", "usecase", "prd", "desain", "coding", "qa", "rilis"];
const TAHAP_DOKUMEN = new Set(["permintaan", "usecase", "prd", "desain", "qa", "rilis"]);
export const URUTAN_RISIKO = ["rendah", "sedang", "tinggi", "kritis"];
const FITUR_TAHAP = { desain: "desain", coding: "coding", qa: "qa", rilis: "rilis" };
const nomor = (item) => `STD-${String(item.nomor).padStart(4, "0")}`;
const lebihTinggi = (a, b) => URUTAN_RISIKO.indexOf(a) > URUTAN_RISIKO.indexOf(b);

// Tahap berikutnya yang fiturnya aktif (desain/QA/rilis yang dimatikan dilewati).
export const tahapBerikut = (tahap, fitur = {}) => {
  let i = TAHAP.indexOf(tahap) + 1;
  while (i < TAHAP.length && FITUR_TAHAP[TAHAP[i]] && TAHAP[i] !== "coding" && fitur[FITUR_TAHAP[TAHAP[i]]] === false) i++;
  return TAHAP[i] ?? "selesai";
};

export const ambilItem = async (uuid) => {
  const item = await satu(`SELECT * FROM studio_item WHERE uuid = $1 AND deleted_at IS NULL`, [uuid]);
  if (!item) throw tidakDitemukan("Item");
  return item;
};

const artefakTerbaru = (itemUuid, tahap) =>
  satu(`SELECT * FROM studio_artefak WHERE item_uuid = $1 AND tahap = $2 ORDER BY versi DESC LIMIT 1`, [itemUuid, tahap]);

const artefakSebelum = async (item, sampai) => {
  const hasil = [];
  for (const t of TAHAP.slice(0, TAHAP.indexOf(sampai))) {
    if (!TAHAP_DOKUMEN.has(t)) continue;
    const a = await artefakTerbaru(item.uuid, t);
    if (a) hasil.push(a);
  }
  return hasil;
};

export const simpanArtefak = async (item, tahap, isi, oleh, tugasUuid = null) => {
  const { versi } = await satu(`SELECT COALESCE(MAX(versi), 0) + 1 AS versi FROM studio_artefak WHERE item_uuid = $1 AND tahap = $2`, [item.uuid, tahap]);
  return sisipkan("studio_artefak", { item_uuid: item.uuid, tahap, versi, isi, dibuat_oleh: oleh, tugas_uuid: tugasUuid });
};

const pesan = (item, tahap, dari, isi, pengguna = null, tugasUuid = null) =>
  sisipkan("studio_pesan", { item_uuid: item.uuid, tahap, dari, isi, pengguna, tugas_uuid: tugasUuid });

const tugasBerjalan = (itemUuid) =>
  satu(`SELECT * FROM studio_tugas WHERE item_uuid = $1 AND status IN ('antri', 'jalan') ORDER BY id DESC LIMIT 1`, [itemUuid]);

const buatTugas = (item, tahap, jenis, instruksi, oleh) =>
  sisipkan("studio_tugas", { item_uuid: item?.uuid ?? null, tahap, jenis, status: "antri", instruksi, dibuat_oleh: oleh, updated_at: sekarang() });

// Selesaikan tugas tanpa menimpa status "dibatalkan".
const tutupTugas = async (tugasUuid, perubahan) => {
  const t = await satu(`SELECT status FROM studio_tugas WHERE uuid = $1`, [tugasUuid]);
  if (t?.status === "dibatalkan") return ubah("studio_tugas", tugasUuid, { ...perubahan, status: "dibatalkan", selesai: sekarang() });
  const bersih = perubahan.status === "selesai" ? { pesan_galat: null } : {};
  return ubah("studio_tugas", tugasUuid, { ...bersih, ...perubahan, selesai: sekarang() });
};

const pastikanBukanProduksi = () => {
  if (config.lingkungan === "production") throw new Galat(403, "Coding, QA, dan rilis tidak dijalankan di instalasi produksi. Gunakan instalasi pengembangan/staging.");
};

const pastikanAktif = (item) => {
  if (item.tahap === "ditunda") throw permintaanSalah("Item sedang ditunda — lanjutkan dulu");
  if (!TAHAP.includes(item.tahap)) throw permintaanSalah(`Item sudah ${item.tahap}`);
};

const pastikanBebasDataPribadi = (...teks) => {
  const temuan = teks.flatMap((t) => temukanDataPribadi(t ?? ""));
  if (temuan.length) throw permintaanSalah(`Teks memuat data yang tampak data pribadi asli (${temuan.slice(0, 3).join(", ")}). Gunakan data fiktif: NIK berawalan 9999, HP 080000000000, email @contoh.id.`);
};

const pindahTahap = (item, tahap, tambahan = {}) => ubah("studio_item", item.uuid, { tahap, tahap_mulai: sekarang(), ...tambahan });

// ---------- Risiko ----------

// Naikkan risiko (tidak pernah turun otomatis) & kunci batas bawah.
const naikkanRisiko = async (item, risiko, alasan) => {
  if (!lebihTinggi(risiko, item.risiko)) return item;
  const baru = await ubah("studio_item", item.uuid, { risiko, risiko_min: lebihTinggi(risiko, item.risiko_min) ? risiko : item.risiko_min });
  await pesan(item, item.tahap, "sistem", `Risiko dinaikkan otomatis menjadi "${risiko}": ${alasan}`);
  await audit("sistem", `Menaikkan risiko ke ${risiko}`, item.uuid, { alasan });
  return baru;
};

// Batas bawah risiko (dari area yang tersentuh) hanya boleh diturunkan superadmin, mis. deteksi positif palsu — tercatat di audit.
export const tetapkanRisiko = async (item, { risiko, alasan }, oleh, superadmin = false) => {
  if (!URUTAN_RISIKO.includes(risiko)) throw permintaanSalah("Risiko harus rendah/sedang/tinggi/kritis");
  if (!alasan?.trim()) throw permintaanSalah("Alasan wajib diisi");
  const turunkanBatas = lebihTinggi(item.risiko_min, risiko);
  if (turunkanBatas && !superadmin) {
    throw permintaanSalah(`Risiko tidak boleh di bawah "${item.risiko_min}" (ditemukan dari area yang tersentuh); hanya superadmin yang dapat menurunkannya`);
  }
  await audit(oleh, `Menetapkan risiko ${item.risiko} → ${risiko}${turunkanBatas ? ` (menurunkan batas bawah ${item.risiko_min})` : ""}`, item.uuid, { alasan });
  await pesan(item, item.tahap, "sistem", `Risiko ditetapkan "${risiko}" oleh ${oleh}: ${alasan}`, oleh);
  return ubah("studio_item", item.uuid, { risiko, ...(turunkanBatas ? { risiko_min: risiko } : {}) });
};

// ---------- Konteks tambahan prompt (aturan area, tambahan tahap, pengetahuan, lampiran) ----------

const konteksTambahan = async (item, tahap) => {
  const aturan = await query(`SELECT lapis, kunci, judul, isi FROM studio_aturan WHERE deleted_at IS NULL AND aktif ORDER BY lapis, kunci`);
  const berkas = (item.berkas ?? []).map((b) => b.path);
  const desain = (await artefakTerbaru(item.uuid, "desain"))?.isi ?? "";
  const pathDesain = pathDiubahDalamDesain(desain);
  const modul = (item.modul_terdampak ?? []).map((m) => String(m).toLowerCase());
  const cocokArea = (k) => {
    const kunci = String(k).toLowerCase();
    return [...berkas, ...pathDesain].some((p) => p.toLowerCase().startsWith(kunci)) || modul.includes(kunci);
  };
  const aturanArea = aturan.filter((a) => a.lapis === "area" && cocokArea(a.kunci)).map((a) => `### ${a.judul} (${a.kunci})\n${a.isi}`).join("\n\n");
  const tambahanTahap = aturan.filter((a) => a.lapis === "tahap" && a.kunci === tahap).map((a) => a.isi).join("\n\n");
  const pengetahuan = (await query(`SELECT judul, isi FROM studio_pengetahuan WHERE deleted_at IS NULL AND aktif ORDER BY judul`)).map((p) => `### ${p.judul}\n${p.isi}`).join("\n\n");
  const lampiran = (await query(`SELECT nama, lokasi FROM studio_lampiran WHERE item_uuid = $1 AND deleted_at IS NULL ORDER BY created_at`, [item.uuid]));
  return { aturanArea, tambahanTahap, pengetahuan, lampiran };
};

// Prompt efektif (pratinjau, rancangan §9.1).
export const pratinjauPrompt = async (item, tahap) => {
  const { nilai } = await bacaSemua();
  const tambahan = await konteksTambahan(item, tahap);
  if (tahap === "coding") {
    return susunPromptCoding({ item, artefak: await artefakSebelum(item, "coding"), instruksi: null, aturanInstalasi: nilai.aturan_instalasi, branch: item.branch ?? "(dibuat saat coding dimulai)", revisi: false, ...tambahan });
  }
  return susunPromptDokumen({
    item, tahap, artefakSebelumnya: await artefakSebelum(item, tahap), artefakTahapIni: await artefakTerbaru(item.uuid, tahap),
    diskusi: [], instruksi: null, aturanInstalasi: nilai.aturan_instalasi, perubahan: null, ...tambahan,
  });
};

// ---------- Item ----------

export const buatItem = async ({ judul, jenis = "fitur", prioritas = "P2", permintaan = {}, modul_terdampak = [] }, author) => {
  if (!judul?.trim()) throw permintaanSalah("Judul wajib diisi");
  if (!permintaan.masalah?.trim() && !permintaan.harapan?.trim()) throw permintaanSalah("Isi minimal masalah atau hasil yang diharapkan");
  pastikanBebasDataPribadi(judul, permintaan.masalah, permintaan.siapa, permintaan.harapan, permintaan.contoh);
  await periksaBatas(null, author.username);
  const item = await sisipkan("studio_item", {
    judul: judul.trim().slice(0, 255),
    jenis: ["fitur", "perbaikan", "laporan", "modul"].includes(jenis) ? jenis : "fitur",
    prioritas: ["P1", "P2", "P3"].includes(prioritas) ? prioritas : "P2",
    permintaan,
    modul_terdampak: Array.isArray(modul_terdampak) ? modul_terdampak.slice(0, 20) : [],
    faskes_uuid: author.faskesUuid ?? null,
    dibuat_oleh: author.username,
    tahap_mulai: sekarang(),
    updated_at: sekarang(),
  });
  await audit(author.username, "Mengajukan permintaan", item.uuid, { judul: item.judul });
  await jalankanDokumen(item, "permintaan", null, author.username).catch((e) =>
    pesan(item, "permintaan", "sistem", `Agen belum dijalankan otomatis: ${e.message.replace(/\.$/, "")}. Klik "AI tulis ulang" setelah kendala teratasi.`),
  );
  return item;
};

export const ubahItem = async (item, { judul, prioritas, jenis, modul_terdampak }, oleh) => {
  if (judul !== undefined) pastikanBebasDataPribadi(judul);
  const perubahan = {
    judul: judul?.trim() ? judul.trim().slice(0, 255) : undefined,
    prioritas: ["P1", "P2", "P3"].includes(prioritas) ? prioritas : undefined,
    jenis: ["fitur", "perbaikan", "laporan", "modul"].includes(jenis) ? jenis : undefined,
    modul_terdampak: Array.isArray(modul_terdampak) ? modul_terdampak.slice(0, 20) : undefined,
  };
  await audit(oleh, "Triase item", item.uuid, perubahan);
  return ubah("studio_item", item.uuid, perubahan);
};

// Status gerbang tahap aktif: persetujuan sah = setelah tahap dimulai & setelah artefak terbaru tahap itu.
const sejakGerbang = async (item) => {
  const a = await artefakTerbaru(item.uuid, item.tahap);
  return Math.max(Number(item.tahap_mulai ?? 0), Number(a?.created_at ?? 0));
};

export const detailItem = async (uuid, req) => {
  const item = await ambilItem(uuid);
  const [artefak, pesanList, persetujuan, tugas, uji, lampiran] = await Promise.all([
    query(`SELECT uuid, tahap, versi, isi, dibuat_oleh, created_at FROM studio_artefak WHERE item_uuid = $1 ORDER BY tahap, versi`, [uuid]),
    query(`SELECT * FROM studio_pesan WHERE item_uuid = $1 ORDER BY created_at, id`, [uuid]),
    query(`SELECT * FROM studio_persetujuan WHERE item_uuid = $1 ORDER BY created_at, id`, [uuid]),
    query(`SELECT uuid, tahap, jenis, status, model, biaya_usd, token_masuk, token_keluar, kuota, pesan_galat, mulai, selesai, created_at,
                  CASE WHEN jenis = 'cek' THEN hasil END AS hasil
             FROM studio_tugas WHERE item_uuid = $1 ORDER BY created_at DESC, id DESC LIMIT 50`, [uuid]),
    query(`SELECT * FROM studio_uji WHERE item_uuid = $1 AND deleted_at IS NULL ORDER BY id`, [uuid]),
    query(`SELECT uuid, nama, mime, ukuran, disamarkan, dibuat_oleh, created_at FROM studio_lampiran WHERE item_uuid = $1 AND deleted_at IS NULL ORDER BY created_at`, [uuid]),
  ]);
  const gerbang = TAHAP.includes(item.tahap) ? statusGerbang(item.tahap, item.risiko, persetujuan, await sejakGerbang(item)) : [];
  const bisaSetuju = {};
  for (const g of gerbang) bisaSetuju[g.kode] = req ? await bolehPeran(req, g.kode) : false;
  const { nilai } = await bacaSemua();
  return {
    item,
    artefak,
    pesan: pesanList,
    persetujuan,
    tugas,
    uji,
    lampiran,
    gerbang: gerbang.map((g) => ({ ...g, bisa: bisaSetuju[g.kode] })),
    fitur: nilai.fitur,
    modeKerja: item.worktree ? "worktree" : nilai.mode_kerja,
    modeRilis: nilai.mode_rilis ?? "lokal",
    branchLokal: await branchLokal(nilai, item),
    estimasiCoding: item.tahap === "coding" ? await estimasiBiaya("coding", "coding") : null,
    branchSekarang: item.worktree ? item.branch : await branchSekarang().catch(() => null),
  };
};

// ---------- Tugas agen: dokumen ----------

export const jalankanDokumen = async (item, tahap, instruksi, oleh) => {
  if (!TAHAP_DOKUMEN.has(tahap)) throw permintaanSalah(`Tahap ${tahap} bukan tahap dokumen`);
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Masih ada tugas agen yang berjalan untuk item ini");
  await periksaBatas(item, oleh);
  const tugas = await buatTugas(item, tahap, "dokumen", instruksi, oleh);

  (async () => {
    try {
      const { nilai } = await bacaSemua();
      const terkini = await ambilItem(item.uuid);
      const perubahan = ["qa", "rilis"].includes(tahap) ? (terkini.berkas ?? []).map((b) => `- ${b.status} ${b.path}`).join("\n") : null;
      const prompt = susunPromptDokumen({
        item: terkini,
        tahap,
        artefakSebelumnya: await artefakSebelum(terkini, tahap),
        artefakTahapIni: await artefakTerbaru(item.uuid, tahap),
        diskusi: await query(`SELECT dari, isi, pengguna FROM studio_pesan WHERE item_uuid = $1 AND tahap = $2 AND dari <> 'sistem' ORDER BY created_at, id`, [item.uuid, tahap]),
        instruksi,
        aturanInstalasi: nilai.aturan_instalasi,
        perubahan,
        ...(await konteksTambahan(terkini, tahap)),
      });
      const { hasil } = await jalankanAgen({ tugasUuid: tugas.uuid, prompt, mode: "dokumen", tahap, base: direktoriKerja(terkini), item: terkini });
      const k = uraiKeluaran(hasil);
      const artefak = await simpanArtefak(terkini, tahap, k.artefak, "agen", tugas.uuid);
      const ubahItem = {};
      const risikoBaru = String(k.meta?.risiko ?? "").toLowerCase();
      if (URUTAN_RISIKO.includes(risikoBaru) && lebihTinggi(risikoBaru, terkini.risiko)) ubahItem.risiko = risikoBaru;
      if (Array.isArray(k.meta?.modul) && !(terkini.modul_terdampak ?? []).length) ubahItem.modul_terdampak = k.meta.modul.slice(0, 20);
      if (k.commit) ubahItem.pesan_commit = k.commit;
      let setelah = Object.keys(ubahItem).length ? await ubah("studio_item", item.uuid, ubahItem) : terkini;
      // Desain menyebut berkas zona kuning/merah → risiko naik otomatis (rancangan §8, F3-8).
      if (tahap === "desain") {
        const zona = zonaTersentuh(pathDiubahDalamDesain(k.artefak));
        if (zona === "merah") setelah = await naikkanRisiko(setelah, "kritis", "desain teknis menyentuh berkas zona merah");
        else if (zona === "kuning") setelah = await naikkanRisiko(setelah, "tinggi", "desain teknis menyentuh layanan klinis/keuangan");
      }
      // Rencana uji → checklist QA (versi lama diganti).
      if (tahap === "qa" && k.uji?.length) {
        await query(`UPDATE studio_uji SET deleted_at = $2, updated_at = $2 WHERE item_uuid = $1 AND deleted_at IS NULL`, [item.uuid, sekarang()]);
        for (const [i, u] of k.uji.slice(0, 100).entries()) {
          await sisipkan("studio_uji", {
            item_uuid: item.uuid, artefak_uuid: artefak.uuid, kode: String(u.kode ?? `UJ-${i + 1}`).slice(0, 20), kt: u.kt ? String(u.kt).slice(0, 50) : null,
            skenario: String(u.skenario ?? "-"), peran: u.peran ? String(u.peran).slice(0, 255) : null, langkah: u.langkah ?? null, harapan: u.harapan ?? null,
            otomatis: Boolean(u.otomatis), updated_at: sekarang(),
          });
        }
      }
      await pesan(terkini, tahap, "ai", k.catatan || `${NAMA_TAHAP[tahap]} versi ${artefak.versi} sudah dibuat. Periksa lalu setujui atau minta revisi.`, null, tugas.uuid);
      await tutupTugas(tugas.uuid, { status: "selesai", hasil });
      await audit("agen", `Menulis ${NAMA_TAHAP[tahap]} v${artefak.versi}`, item.uuid);
    } catch (e) {
      await tutupTugas(tugas.uuid, { status: "gagal", pesan_galat: e.message });
      await pesan(item, tahap, "sistem", `Agen gagal: ${e.message}`, null, tugas.uuid);
    }
  })();
  return tugas;
};

// ---------- Tugas agen: coding ----------

export const jalankanCoding = async (item, instruksi, oleh) => {
  pastikanBukanProduksi();
  const { nilai } = await bacaSemua();
  if (nilai.fitur?.coding === false) throw new Galat(403, "Fitur Coding belum diaktifkan superadmin (Pengaturan & Agen › Fitur Studio)");
  if (item.tahap !== "coding") throw permintaanSalah("Item belum berada di tahap coding");
  if (item.risiko === "kritis") throw new Galat(403, "Item berisiko kritis: agen hanya boleh menulis PRD/desain; kode dikerjakan programmer.");
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Masih ada tugas agen yang berjalan untuk item ini");
  if (nilai.mode_kerja !== "worktree" && !item.worktree) {
    const lain = await satu(`SELECT t.uuid, i.nomor FROM studio_tugas t JOIN studio_item i ON i.uuid = t.item_uuid
                              WHERE t.jenis IN ('coding', 'cek') AND t.status IN ('antri', 'jalan') AND i.worktree IS NULL LIMIT 1`);
    if (lain) throw new Galat(409, `Working tree sedang dipakai item STD-${String(lain.nomor).padStart(4, "0")}. Tunggu sampai selesai, atau gunakan mode worktree.`);
  }
  await periksaBatas(item, oleh);

  const siap = await siapkanKerja(item);
  const base = direktoriKerja(siap);
  const tugas = await buatTugas(siap, "coding", "coding", instruksi, oleh);
  await audit(oleh, "Menjalankan agen coding", item.uuid, { branch: siap.branch, worktree: siap.worktree });

  (async () => {
    const sebelum = await potretKerja(base);
    let galat = null;
    let hasil = "";
    try {
      const sesiLalu = await satu(
        `SELECT session_id FROM studio_tugas WHERE item_uuid = $1 AND jenis = 'coding' AND status = 'selesai' AND session_id IS NOT NULL ORDER BY id DESC LIMIT 1`,
        [item.uuid],
      );
      const prompt = susunPromptCoding({
        item: siap,
        artefak: await artefakSebelum(siap, "coding"),
        instruksi,
        aturanInstalasi: nilai.aturan_instalasi,
        branch: siap.branch,
        revisi: Boolean(sesiLalu),
        ...(await konteksTambahan(siap, "coding")),
      });
      ({ hasil } = await jalankanAgen({ tugasUuid: tugas.uuid, prompt, mode: "coding", tahap: "coding", base, item: siap, resume: sesiLalu?.session_id ?? null }));
    } catch (e) {
      galat = e;
    }
    try {
      const sesudah = await potretKerja(base);
      const berubah = berkasBerubah(sebelum, sesudah);
      let terkini = await ambilItem(item.uuid);
      const peta = new Map((terkini.berkas ?? []).map((b) => [b.path, b]));
      for (const b of berubah) peta.set(b.path, b);
      const k = uraiKeluaran(hasil);
      terkini = await ubah("studio_item", item.uuid, { berkas: [...peta.values()], pesan_commit: k.commit ?? undefined });
      // Berkas klinis/keuangan tersentuh → risiko naik otomatis.
      const zona = zonaTersentuh([...peta.keys()]);
      if (zona === "kuning") terkini = await naikkanRisiko(terkini, "tinggi", "kode menyentuh layanan klinis/keuangan");
      if (!galat) {
        const ringkasan = `${k.artefak}\n\n### Berkas berubah pada putaran ini\n${berubah.map((b) => `- \`${b.status}\` ${b.path}`).join("\n") || "- (tidak ada)"}`;
        await simpanArtefak(terkini, "coding", ringkasan, "agen", tugas.uuid);
        await pesan(terkini, "coding", "ai", `Coding selesai: ${berubah.length} berkas berubah pada putaran ini. Periksa perubahan & hasil pemeriksa kebijakan, lalu setujui atau minta revisi.`, null, tugas.uuid);
        await tutupTugas(tugas.uuid, { status: "selesai", hasil });
        await audit("agen", `Coding selesai (${berubah.length} berkas)`, item.uuid);
      }
    } catch (e) {
      galat = galat ?? e;
    }
    if (galat) {
      await tutupTugas(tugas.uuid, { status: "gagal", pesan_galat: galat.message });
      await pesan(item, "coding", "sistem", `Agen coding gagal: ${galat.message}`, null, tugas.uuid);
    }
  })();
  return tugas;
};

// ---------- Perubahan & pemeriksa kebijakan ----------

const migrasiTerakhir = async (dasar) => {
  const { keluaran } = await git(["ls-tree", "--name-only", dasar || "main", "database/migrations/"], { izinkanGagal: true });
  const stempel = keluaran.split("\n").map((p) => p.match(/(\d{14})-/)?.[1]).filter(Boolean).sort();
  return stempel.at(-1) ?? null;
};

const hitungBaris = (patch) => {
  let tambah = 0;
  let hapus = 0;
  for (const b of patch.split("\n")) {
    if (b.startsWith("+") && !b.startsWith("+++")) tambah++;
    else if (b.startsWith("-") && !b.startsWith("---")) hapus++;
  }
  return { tambah, hapus };
};

// Titik cabang branch item dari branch dasar (merge-base). Diff dihitung dari sini, sehingga commit manual di branch item
// ikut terlihat.
const titikDasar = async (base, ref = "HEAD", item = null) => {
  const { nilai } = await bacaSemua();
  // Sudah diterapkan ke branch lokal: pakai keadaan branch lokal sebelum penggabungan (induk pertama commit merge).
  const dasar = item?.sha_lokal ? `${item.sha_lokal}^1` : await branchDasar(nilai, item);
  const r = await git(["merge-base", ref, dasar], { cwd: base, izinkanGagal: true });
  return r.ok && r.keluaran ? r.keluaran : dasar;
};

// Perubahan item = berkas kotor yang tercatat + semua berkas yang berubah di branch item sejak titik cabangnya
// (commit agen, commit Studio, maupun commit manual programmer).
export const perubahanItem = async (item) => {
  const BATAS = 200 * 1024;
  const base = direktoriKerja(item);
  let berkas = [];
  if (item.branch) {
    const dasarRef = await titikDasar(base, item.branch, item);
    const diBranch = Boolean(item.worktree) || (await branchSekarang().catch(() => null)) === item.branch;
    const status = diBranch ? await statusBerkas(base) : {};
    const { keluaran } = await git(["diff", "--name-status", dasarRef, item.branch], { cwd: base, izinkanGagal: true });
    const komit = new Map(keluaran.split("\n").filter(Boolean).map((b) => {
      const [st, ...p] = b.split("\t");
      return [p.at(-1), st[0]];
    }));
    const jalur = [...new Set([...(diBranch ? (item.berkas ?? []).map((b) => b.path) : []), ...komit.keys()])];
    for (const p of jalur) {
      const st = status[p];
      const patch = !diBranch
        ? (await git(["diff", dasarRef, item.branch, "--", p], { cwd: base, izinkanGagal: true })).keluaran
        : st === "??"
          ? await patchBerkas(p, st, base)
          : (await git(["diff", dasarRef, "--", p], { cwd: base, izinkanGagal: true })).keluaran;
      if (!patch.trim()) continue; // sudah sama lagi dengan dasar
      const tercatat = (item.berkas ?? []).find((b) => b.path === p);
      berkas.push({ path: p, status: st ?? komit.get(p) ?? tercatat?.status ?? "M", patch, sumber: tercatat?.sumber, dikomit: komit.has(p) && !st });
    }
  }
  const { nilai } = await bacaSemua();
  const kebijakan = periksaKebijakan(berkas, { risiko: item.risiko, migrasiTerakhir: await migrasiTerakhir(await branchDasar(nilai, item)) });
  berkas = berkas.map((b) => ({ ...b, ...hitungBaris(b.patch), patch: b.patch.length > BATAS ? `${b.patch.slice(0, BATAS)}\n… (dipotong)` : b.patch }));
  return { branch: item.branch, worktree: item.worktree, commitSha: item.commit_sha, berkas, kebijakan };
};

// ---------- Coding manual (programmer; wajib untuk risiko kritis) ----------

// Siapkan branch/worktree item tanpa agen. Potret berkas kotor disimpan agar perubahan lain di working tree tidak ikut tercatat.
export const siapkanManual = async (item, oleh) => {
  pastikanBukanProduksi();
  if (item.tahap !== "coding") throw permintaanSalah("Branch kerja disiapkan pada tahap coding");
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Masih ada tugas agen yang berjalan untuk item ini");
  const siap = await siapkanKerja(item);
  const potret = siap.snapshot ?? (await potretKerja(direktoriKerja(siap)));
  const baru = await ubah("studio_item", item.uuid, { snapshot: potret });
  await pesan(baru, "coding", "sistem", `Branch ${baru.branch} siap${baru.worktree ? ` di ${baru.worktree}` : " di working tree repo"}. Kerjakan kode di VS Code, lalu klik "Pindai perubahan manual".`, oleh);
  await audit(oleh, `Menyiapkan branch kerja manual ${baru.branch}`, item.uuid);
  return baru;
};

// Catat berkas yang diubah programmer: perubahan belum di-commit (dibanding potret) + commit di branch item.
export const pindaiManual = async (item, oleh) => {
  pastikanBukanProduksi();
  if (!["coding", "rilis"].includes(item.tahap)) throw permintaanSalah("Pindai perubahan dilakukan pada tahap coding atau rilis");
  if (!item.branch) throw permintaanSalah("Siapkan branch kerja dulu");
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Masih ada tugas agen yang berjalan untuk item ini");
  await pastikanDiBranch(item);
  const base = direktoriKerja(item);
  const dasarRef = await titikDasar(base, item.branch, item);
  const kotor = berkasBerubah(item.snapshot ?? { status: {}, sidik: {} }, await potretKerja(base));
  const peta = new Map((item.berkas ?? []).map((b) => [b.path, b]));
  for (const b of kotor) peta.set(b.path, { ...b, sumber: "manual" });
  // Commit manual di branch item yang belum tercatat.
  const tercatat = new Set((item.riwayat_commit ?? []).map((c) => c.sha));
  const { keluaran: log } = await git(["log", "--format=%H%x09%s", `${dasarRef}..HEAD`], { cwd: base, izinkanGagal: true });
  const commitBaru = log.split("\n").filter(Boolean).map((b) => b.split("\t")).filter(([sha]) => !tercatat.has(sha)).reverse();
  const riwayat = [...(item.riwayat_commit ?? [])];
  for (const [sha, subjek] of commitBaru) {
    const { keluaran } = await git(["show", "--name-only", "--format=", sha], { cwd: base, izinkanGagal: true });
    riwayat.push({ sha, pesan: subjek, berkas: keluaran.split("\n").filter(Boolean), pada: sekarang(), manual: true });
  }
  const head = (await git(["rev-parse", "HEAD"], { cwd: base })).keluaran;
  let baru = await ubah("studio_item", item.uuid, {
    berkas: [...peta.values()],
    riwayat_commit: riwayat,
    commit_sha: head !== dasarRef && riwayat.length ? head : item.commit_sha,
  });
  const semua = [...new Set([...peta.keys(), ...riwayat.flatMap((c) => c.berkas)])];
  if (zonaTersentuh(semua) === "kuning") baru = await naikkanRisiko(baru, "tinggi", "kode menyentuh layanan klinis/keuangan");
  await pesan(baru, item.tahap, "sistem", `Pindai perubahan manual: ${kotor.length} berkas belum di-commit, ${commitBaru.length} commit baru di ${item.branch}.`, oleh);
  await audit(oleh, "Memindai perubahan manual", item.uuid, { berkas: kotor.length, commit: commitBaru.length });
  return baru;
};

// ---------- Cek otomatis (QA) ----------

const jalankanPerintah = (perintah, args, { cwd, timeoutMs = 10 * 60 * 1000 } = {}) =>
  new Promise((resolve) => {
    const anak = spawn(perintah, args, { cwd, shell: process.platform === "win32", windowsHide: true });
    let keluaran = "";
    const simpan = (d) => (keluaran = (keluaran + d.toString("utf8")).slice(-6000));
    anak.stdout.on("data", simpan);
    anak.stderr.on("data", simpan);
    const batas = setTimeout(() => anak.kill(), timeoutMs);
    anak.on("error", (e) => resolve({ ok: false, keluaran: e.message }));
    anak.on("close", (kode) => {
      clearTimeout(batas);
      resolve({ ok: kode === 0, keluaran });
    });
  });

export const jalankanCek = async (item, oleh) => {
  pastikanBukanProduksi();
  if (!["coding", "qa"].includes(item.tahap)) throw permintaanSalah("Cek otomatis dijalankan pada tahap coding atau QA");
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Masih ada tugas yang berjalan untuk item ini");
  await pastikanDiBranch(item);
  const base = direktoriKerja(item);
  const tugas = await buatTugas(item, item.tahap, "cek", null, oleh);

  (async () => {
    const log = (jenis, teks) => query(`INSERT INTO studio_tugas_log (tugas_uuid, jenis, teks, waktu) VALUES ($1, $2, $3, $4)`, [tugas.uuid, jenis, String(teks).slice(0, 8000), sekarang()]);
    const langkah = [];
    try {
      await ubah("studio_tugas", tugas.uuid, { status: "jalan", mulai: sekarang() });
      const { nilai } = await bacaSemua();
      const per = await perubahanItem(await ambilItem(item.uuid));
      for (const t of per.kebijakan.temuan) await log(t.lulus ? "hasil" : "galat", `${t.lulus ? "✔" : "✘"} Kebijakan · ${t.cek}: ${t.pesan}`);
      langkah.push({ nama: "Pemeriksa kebijakan", lulus: per.kebijakan.lulus });

      const ada = per.berkas.filter((b) => b.status !== "D");
      const js = ada.filter((b) => /\.(js|cjs|mjs)$/.test(b.path) && !b.path.startsWith("frontend-service/"));
      let sintaksLulus = true;
      for (const b of js) {
        const r = await jalankanPerintah("node", ["--check", b.path], { cwd: base, timeoutMs: 60000 });
        if (!r.ok) sintaksLulus = false;
        await log(r.ok ? "hasil" : "galat", `${r.ok ? "✔" : "✘"} node --check ${b.path}${r.ok ? "" : `\n${r.keluaran}`}`);
      }
      if (js.length) langkah.push({ nama: `Sintaks JS (${js.length} berkas)`, lulus: sintaksLulus });

      const layanan = [...new Set(ada.map((b) => b.path.split("/")[0]).filter((l) => /-service$/.test(l) && l !== "frontend-service"))];
      for (const l of layanan) {
        let pkg = null;
        try {
          pkg = JSON.parse(fs.readFileSync(path.join(base, l, "package.json"), "utf8"));
        } catch {
          continue;
        }
        if (!pkg.scripts?.test || /no test specified/.test(pkg.scripts.test) || !fs.existsSync(path.join(base, l, "test"))) continue;
        await log("info", `Menjalankan uji ${l}…`);
        const r = await jalankanPerintah("npm", ["--prefix", l, "test"], { cwd: base });
        await log(r.ok ? "hasil" : "galat", `${r.ok ? "✔" : "✘"} npm --prefix ${l} test\n${r.keluaran.split("\n").slice(-15).join("\n")}`);
        langkah.push({ nama: `Uji ${l}`, lulus: r.ok });
      }

      if (ada.some((b) => b.path === "database/data/katalog-modul.json")) {
        const r = await jalankanPerintah("node", ["scripts/dokumen-katalog.mjs", "--cek"], { cwd: base, timeoutMs: 60000 });
        await log(r.ok ? "hasil" : "galat", `${r.ok ? "✔" : "✘"} dokumen katalog\n${r.keluaran.slice(-800)}`);
        langkah.push({ nama: "Dokumen katalog", lulus: r.ok });
      }

      if (nilai.cek_build_frontend && ada.some((b) => b.path.startsWith("frontend-service/"))) {
        await log("info", "Build frontend (build-only)… beberapa menit");
        const r = await jalankanPerintah("npm", ["--prefix", "frontend-service", "run", "build-only"], { cwd: base, timeoutMs: 20 * 60 * 1000 });
        await log(r.ok ? "hasil" : "galat", `${r.ok ? "✔" : "✘"} build frontend\n${r.keluaran.split("\n").slice(-12).join("\n")}`);
        langkah.push({ nama: "Build frontend", lulus: r.ok });
      }

      const lulus = langkah.every((l) => l.lulus);
      await log(lulus ? "hasil" : "galat", lulus ? "Semua cek otomatis lulus." : "Ada cek yang gagal — minta agen memperbaiki lewat diskusi/revisi.");
      await tutupTugas(tugas.uuid, { status: "selesai", hasil: JSON.stringify({ lulus, langkah }) });
      await audit(oleh, `Cek otomatis ${lulus ? "lulus" : "gagal"}`, item.uuid, { langkah });
    } catch (e) {
      await tutupTugas(tugas.uuid, { status: "gagal", pesan_galat: e.message, hasil: JSON.stringify({ lulus: false, langkah }) });
    }
  })();
  return tugas;
};

const cekTerakhirLulus = async (itemUuid) => {
  const t = await satu(`SELECT hasil FROM studio_tugas WHERE item_uuid = $1 AND jenis = 'cek' AND status = 'selesai' ORDER BY id DESC LIMIT 1`, [itemUuid]);
  try {
    return Boolean(JSON.parse(t?.hasil ?? "null")?.lulus);
  } catch {
    return false;
  }
};

// ---------- Checklist uji (QA) ----------

export const ubahUji = async (item, ujiUuid, { status, catatan }, oleh) => {
  if (!["belum", "lulus", "gagal", "na"].includes(status)) throw permintaanSalah("Status uji tidak dikenal");
  pastikanBebasDataPribadi(catatan);
  const u = await satu(`SELECT * FROM studio_uji WHERE uuid = $1 AND item_uuid = $2 AND deleted_at IS NULL`, [ujiUuid, item.uuid]);
  if (!u) throw tidakDitemukan("Kasus uji");
  await audit(oleh, `Uji ${u.kode}: ${status}`, item.uuid, { catatan });
  return ubah("studio_uji", ujiUuid, { status, catatan: catatan ?? null, diuji_oleh: oleh });
};

// ---------- Lampiran ----------

const MIME_TEKS = /^(text\/|application\/(json|csv|xml))/;
export const tambahLampiran = async (item, { nama, mime, data, disamarkan }, oleh) => {
  if (!disamarkan) throw permintaanSalah("Centang pernyataan bahwa lampiran sudah disamarkan (tanpa data pasien asli)");
  const isi = Buffer.from(String(data ?? ""), "base64");
  if (!isi.length) throw permintaanSalah("Lampiran kosong");
  if (isi.length > 5 * 1024 * 1024) throw permintaanSalah("Lampiran maksimal 5 MB");
  if (!/^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/|application\/(json|csv))/.test(String(mime))) throw permintaanSalah("Jenis lampiran tidak didukung (gambar, PDF, teks/CSV/JSON)");
  if (MIME_TEKS.test(String(mime))) pastikanBebasDataPribadi(isi.toString("utf8"));
  const aman = String(nama ?? "lampiran").replace(/[^\w.-]+/g, "_").slice(-100);
  const folder = path.join(FOLDER_LAMPIRAN, item.uuid);
  fs.mkdirSync(folder, { recursive: true });
  const lokasi = path.join(folder, `${uuidv7().slice(0, 8)}-${aman}`);
  fs.writeFileSync(lokasi, isi);
  await audit(oleh, `Menambah lampiran ${aman}`, item.uuid);
  return sisipkan("studio_lampiran", { item_uuid: item.uuid, nama: aman, mime, ukuran: isi.length, lokasi, disamarkan: true, dibuat_oleh: oleh });
};

export const hapusLampiran = async (item, lampiranUuid, oleh) => {
  const l = await satu(`SELECT * FROM studio_lampiran WHERE uuid = $1 AND item_uuid = $2 AND deleted_at IS NULL`, [lampiranUuid, item.uuid]);
  if (!l) throw tidakDitemukan("Lampiran");
  fs.rmSync(l.lokasi, { force: true });
  await query(`UPDATE studio_lampiran SET deleted_at = $2 WHERE uuid = $1`, [lampiranUuid, sekarang()]);
  await audit(oleh, `Menghapus lampiran ${l.nama}`, item.uuid);
};

export const bacaLampiran = async (item, lampiranUuid) => {
  const l = await satu(`SELECT * FROM studio_lampiran WHERE uuid = $1 AND item_uuid = $2 AND deleted_at IS NULL`, [lampiranUuid, item.uuid]);
  if (!l || !fs.existsSync(l.lokasi)) throw tidakDitemukan("Lampiran");
  return { ...l, isi: fs.readFileSync(l.lokasi) };
};

// ---------- Keputusan (gerbang manusia) ----------

const bolehPeran = async (req, kode) => {
  const peran = PERAN[kode];
  if (!peran) return false;
  if (!peran.izin) return isSuperadmin(req);
  return punya(req, peran.izin[0], peran.izin[1]);
};

const pemeriksaanSetuju = async (item) => {
  const tahap = item.tahap;
  if (TAHAP_DOKUMEN.has(tahap) && !(await artefakTerbaru(item.uuid, tahap))) throw permintaanSalah("Belum ada dokumen pada tahap ini");
  if (tahap === "coding") {
    const per = await perubahanItem(item);
    if (!per.berkas.length) throw permintaanSalah(item.risiko === "kritis" ? "Belum ada perubahan kode. Risiko kritis dikerjakan programmer: siapkan branch, kerjakan di VS Code, lalu pindai perubahan manual." : "Belum ada perubahan kode");
    if (!per.kebijakan.lulus) throw permintaanSalah("Pemeriksa kebijakan belum lulus — minta agen memperbaiki dulu");
  }
  if (tahap === "qa") {
    if (!(await cekTerakhirLulus(item.uuid))) throw permintaanSalah("Jalankan cek otomatis sampai lulus sebelum menyatakan QA lulus");
    const sisa = await satu(`SELECT COUNT(*)::int AS n FROM studio_uji WHERE item_uuid = $1 AND deleted_at IS NULL AND status IN ('belum', 'gagal')`, [item.uuid]);
    if (sisa.n) throw permintaanSalah(`${sisa.n} kasus uji belum lulus — isi checklist uji dulu (lulus/tidak berlaku)`);
  }
  if (tahap === "rilis") {
    if (!item.commit_sha) throw permintaanSalah("Commit perubahan dulu (di Studio, atau commit manual lalu pindai) sebelum menandai rilis selesai");
    const { nilai } = await bacaSemua();
    if (modeLokal(nilai) && !item.diterapkan_pada) throw permintaanSalah("Terapkan ke lokal dulu sebelum menandai rilis selesai");
    if (nilai.mode_rilis === "pr" && !item.pr_url) throw permintaanSalah("Push & buat Pull Request dulu sebelum menandai rilis selesai");
  }
};

export const putuskan = async (item, { keputusan, alasan, peran }, req) => {
  const oleh = req.author.username;
  if (!["setuju", "revisi", "tolak"].includes(keputusan)) throw permintaanSalah("Keputusan harus setuju, revisi, atau tolak");
  pastikanAktif(item);
  if (keputusan !== "setuju" && !alasan?.trim()) throw permintaanSalah("Alasan wajib diisi untuk revisi atau tolak");
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Tunggu tugas agen selesai sebelum memutuskan");
  const tahap = item.tahap;
  const gerbang = gerbangTahap(tahap, item.risiko);
  const { nilai } = await bacaSemua();

  // Peran yang dipakai: diminta eksplisit, atau gerbang pertama yang belum disetujui & boleh bagi pengguna ini.
  const persetujuan = await query(`SELECT * FROM studio_persetujuan WHERE item_uuid = $1 AND tahap = $2 ORDER BY created_at, id`, [item.uuid, tahap]);
  const sejak = await sejakGerbang(item);
  const status = statusGerbang(tahap, item.risiko, persetujuan, sejak);
  let kode = peran;
  if (!kode) {
    for (const g of status) if (!g.disetujui && (await bolehPeran(req, g.kode))) {
      kode = g.kode;
      break;
    }
    kode ??= (await Promise.all(gerbang.map(async (g) => ((await bolehPeran(req, g)) ? g : null)))).find(Boolean);
  }
  if (!kode || !gerbang.includes(kode)) throw new Galat(403, "Anda tidak memegang peran penyetuju untuk tahap ini");
  if (!(await bolehPeran(req, kode))) throw new Galat(403, `Perlu hak ${PERAN[kode].label} untuk memutuskan tahap ini`);

  if (keputusan === "setuju") {
    await pemeriksaanSetuju(item);
    if (nilai.pemisahan_tugas && item.risiko !== "rendah") {
      const disunting = await artefakTerbaru(item.uuid, tahap);
      if (oleh === item.dibuat_oleh && tahap !== "usecase") throw new Galat(403, "Pemisahan tugas: pengusul tidak boleh menyetujui tahap ini");
      if (disunting && disunting.dibuat_oleh === oleh) throw new Galat(403, "Pemisahan tugas: penyunting dokumen tidak boleh menyetujuinya");
      if (status.some((g) => g.disetujui && g.oleh === oleh && g.kode !== kode)) throw new Galat(403, "Pemisahan tugas: satu orang hanya boleh mengisi satu gerbang per tahap");
    }
  }

  const artefak = await artefakTerbaru(item.uuid, tahap);
  await sisipkan("studio_persetujuan", { item_uuid: item.uuid, tahap, keputusan, alasan: alasan?.trim() || null, pengguna: oleh, peran: kode, artefak_uuid: artefak?.uuid ?? null });
  await audit(oleh, `${keputusan === "setuju" ? "Menyetujui" : keputusan === "revisi" ? "Meminta revisi" : "Menolak"} ${NAMA_TAHAP[tahap]} sebagai ${PERAN[kode].label}`, item.uuid, { alasan });

  if (keputusan === "tolak") return ubah("studio_item", item.uuid, { tahap: "dibatalkan" });

  if (keputusan === "revisi") {
    await pesan(item, tahap, "pengguna", `Revisi (${PERAN[kode].label}): ${alasan.trim()}`, oleh);
    // Revisi kode: agen coding bila diizinkan; risiko kritis / fitur coding mati → instruksi untuk programmer saja.
    const revisiKode = async (it, instruksi) => {
      if (it.risiko === "kritis" || nilai.fitur?.coding === false) {
        await pesan(it, "coding", "sistem", `Revisi untuk programmer: ${instruksi}. Perbaiki di VS Code lalu klik "Pindai perubahan manual".`, oleh);
        return;
      }
      await jalankanCoding(it, instruksi, oleh).catch((e) => pesan(it, "coding", "sistem", `Agen coding belum dijalankan: ${e.message}`));
    };
    if (tahap === "coding") await revisiKode(item, alasan.trim());
    else if (tahap === "qa") {
      const kembali = await pindahTahap(item, "coding");
      await revisiKode(kembali, `Temuan QA: ${alasan.trim()}`);
      return kembali;
    } else await jalankanDokumen(item, tahap, alasan.trim(), oleh).catch((e) => pesan(item, tahap, "sistem", `Agen belum dijalankan: ${e.message}`));
    return ambilItem(item.uuid);
  }

  // Setuju: pindah tahap bila semua gerbang sudah menyetujui.
  const sesudah = statusGerbang(tahap, item.risiko, [...persetujuan, { tahap, keputusan: "setuju", peran: kode, pengguna: oleh, created_at: sekarang() }], sejak);
  if (!sesudah.every((g) => g.disetujui)) {
    const sisa = sesudah.filter((g) => !g.disetujui).map((g) => g.label).join(", ");
    await pesan(item, tahap, "sistem", `Disetujui ${PERAN[kode].label} (${oleh}). Menunggu: ${sisa}.`, oleh);
    return ambilItem(item.uuid);
  }
  const ke = tahapBerikut(tahap, nilai.fitur);
  const lanjut = await pindahTahap(item, ke);
  if (ke === "selesai" && lanjut.worktree) await hapusWorktree(lanjut).catch((e) => pesan(lanjut, tahap, "sistem", `Worktree tidak terhapus: ${e.message}`));
  // Keputusan sudah tersimpan; agen tahap berikutnya yang gagal dimulai (mis. kuota/batas biaya) cukup dicatat.
  if (TAHAP_DOKUMEN.has(lanjut.tahap)) {
    await jalankanDokumen(lanjut, lanjut.tahap, null, oleh).catch((e) =>
      pesan(lanjut, lanjut.tahap, "sistem", `Agen belum dijalankan otomatis: ${e.message.replace(/\.$/, "")}. Klik "AI tulis ulang" setelah kendala teratasi, atau sunting dokumen manual.`),
    );
  }
  return lanjut;
};

// Pesan diskusi → agen mengerjakan instruksi pada tahap aktif.
export const kirimPesan = async (item, isi, oleh) => {
  if (!isi?.trim()) throw permintaanSalah("Pesan kosong");
  pastikanAktif(item);
  pastikanBebasDataPribadi(isi);
  await pesan(item, item.tahap, "pengguna", isi.trim(), oleh);
  if (item.tahap === "coding") return jalankanCoding(item, isi.trim(), oleh);
  return jalankanDokumen(item, item.tahap, isi.trim(), oleh);
};

export const suntingArtefak = async (item, isi, oleh) => {
  pastikanAktif(item);
  if (!isi?.trim()) throw permintaanSalah("Isi dokumen kosong");
  if (!TAHAP_DOKUMEN.has(item.tahap)) throw permintaanSalah("Dokumen tahap ini tidak dapat disunting manual");
  pastikanBebasDataPribadi(isi);
  const a = await simpanArtefak(item, item.tahap, isi, oleh);
  await audit(oleh, `Menyunting dokumen ${item.tahap} v${a.versi}`, item.uuid);
  return a;
};

// ---------- Tunda / lanjutkan / batal ----------

export const tundaItem = async (item, alasan, oleh) => {
  pastikanAktif(item);
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Hentikan tugas agen yang berjalan dulu");
  await audit(oleh, "Menunda item", item.uuid, { alasan });
  return ubah("studio_item", item.uuid, { tahap: "ditunda", tahap_sebelum: item.tahap });
};

export const lanjutkanItem = async (item, oleh) => {
  if (item.tahap !== "ditunda") throw permintaanSalah("Item tidak sedang ditunda");
  await audit(oleh, "Melanjutkan item", item.uuid);
  return ubah("studio_item", item.uuid, { tahap: item.tahap_sebelum || "permintaan", tahap_sebelum: null });
};

export const batalkanItem = async (item, alasan, oleh) => {
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Hentikan tugas agen yang berjalan dulu");
  await audit(oleh, "Membatalkan item", item.uuid, { alasan });
  if (item.worktree) await hapusWorktree(item);
  return ubah("studio_item", item.uuid, { tahap: "dibatalkan" });
};

// ---------- Rilis: commit, push/PR, status, revisi dari review ----------

export const commitItem = async (item, pesanCommit, oleh) => {
  pastikanBukanProduksi();
  if (item.tahap !== "rilis") throw permintaanSalah("Commit dilakukan pada tahap rilis");
  if (item.commit_sha && !(item.berkas ?? []).length) throw permintaanSalah("Item sudah di-commit");
  await pastikanDiBranch(item);
  const base = direktoriKerja(item);
  const status = await statusBerkas(base);
  const jalur = (item.berkas ?? []).map((b) => b.path).filter((p) => p in status);
  if (!jalur.length) throw permintaanSalah("Tidak ada perubahan untuk di-commit");
  const { nilai } = await bacaSemua();
  const isiPesan = `${(pesanCommit || item.pesan_commit || `feat: ${item.judul}`).trim()}\n\nSIMRS Studio ${nomor(item)}${nilai.atribusi_commit ? `\n\n${nilai.atribusi_commit}` : ""}\n`;
  const berkasPesan = path.join(os.tmpdir(), `simrs-studio-commit-${item.uuid}.txt`);
  fs.writeFileSync(berkasPesan, isiPesan, "utf8");
  try {
    await git(["add", "-A", "--", ...jalur], { cwd: base });
    await git(["commit", "-F", berkasPesan, "--", ...jalur], { cwd: base });
  } finally {
    fs.rmSync(berkasPesan, { force: true });
  }
  const sha = (await git(["rev-parse", "HEAD"], { cwd: base })).keluaran;
  await audit(oleh, "Commit perubahan", item.uuid, { sha, berkas: jalur.length });
  const riwayat = [...(item.riwayat_commit ?? []), { sha, pesan: (pesanCommit || item.pesan_commit || "").split("\n")[0], berkas: jalur, pada: sekarang() }];
  return ubah("studio_item", item.uuid, { commit_sha: sha, berkas: [], riwayat_commit: riwayat, pesan_commit: pesanCommit || item.pesan_commit });
};

export const pushItem = async (item, oleh) => {
  pastikanBukanProduksi();
  if (((await bacaSemua()).nilai.mode_rilis ?? "lokal") === "lokal") {
    throw permintaanSalah("Mode rilis lokal: push & Pull Request tidak dipakai. Ubah mode rilis di Pengaturan & Agen bila perlu.");
  }
  if (!item.commit_sha) throw permintaanSalah("Commit dulu sebelum push");
  const base = direktoriKerja(item);
  await git(["push", "-u", "origin", item.branch], { cwd: base }).catch((e) => {
    throw new Galat(502, `Push gagal: ${e.message}`);
  });
  await audit(oleh, "Push branch", item.uuid, { branch: item.branch });
  if (item.pr_nomor) return ambilItem(item.uuid); // PR yang sudah ada otomatis memuat commit baru
  const { nilai } = await bacaSemua();
  if (await gitremote.aktif()) {
    const catatan = (await artefakTerbaru(item.uuid, "rilis"))?.isi ?? "";
    const prd = (await artefakTerbaru(item.uuid, "prd"))?.isi ?? "";
    const isi = `${catatan || prd.slice(0, 4000)}\n\n---\nDibuat lewat SIMRS Studio (${nomor(item)}). Risiko: **${item.risiko}**.\n\n🤖 Generated with SIMRS Studio + Claude Code`;
    const pr = await gitremote.buatPR({ branch: item.branch, judul: (item.pesan_commit || item.judul).split("\n")[0], isi });
    await audit(oleh, `Membuat Pull Request #${pr.nomor}`, item.uuid);
    return ubah("studio_item", item.uuid, { pr_url: pr.url, pr_nomor: pr.nomor, pr_status: "terbuka" });
  }
  const repo = await urlRepo(base);
  const dasar = (nilai.branch_dasar || "origin/main").replace(/^origin\//, "");
  return ubah("studio_item", item.uuid, { pr_url: repo ? `${repo}/compare/${dasar}...${item.branch}?expand=1` : null });
};

// Status PR, CI, merge, dan tag rilis (rancangan F4-5).
export const perbaruiStatusRilis = async (item, oleh) => {
  const perubahan = {};
  let rincianCi = [];
  if (item.pr_nomor && (await gitremote.aktif())) {
    const s = await gitremote.statusPR(item.pr_nomor);
    Object.assign(perubahan, { pr_status: s.status, ci_status: s.ci, merge_sha: s.mergeSha ?? item.merge_sha });
    rincianCi = s.rincianCi;
  }
  const sha = perubahan.merge_sha || item.merge_sha || item.commit_sha;
  if (sha && (perubahan.pr_status === "merged" || item.pr_status === "merged" || !item.pr_nomor)) {
    await git(["fetch", "--tags", "origin"], { izinkanGagal: true });
    const { keluaran } = await git(["tag", "--contains", sha, "--sort=creatordate"], { izinkanGagal: true });
    const tag = keluaran.split("\n").filter(Boolean)[0];
    if (tag) perubahan.tag_rilis = tag;
  }
  const baru = Object.keys(perubahan).length ? await ubah("studio_item", item.uuid, perubahan) : item;
  if (perubahan.tag_rilis && !item.tag_rilis) {
    await audit(oleh, `Dirilis dalam ${perubahan.tag_rilis}`, item.uuid);
    await pesan(item, item.tahap, "sistem", `Perubahan item ini sudah masuk rilis ${perubahan.tag_rilis}.`);
  }
  return { item: baru, rincianCi };
};

export const revisiDariReview = async (item, oleh) => {
  pastikanBukanProduksi();
  if (!item.pr_nomor) throw permintaanSalah("Item belum punya Pull Request");
  if (!["rilis", "selesai"].includes(item.tahap)) throw permintaanSalah("Revisi dari review dilakukan setelah PR dibuat (tahap rilis)");
  const komentar = await gitremote.komentarReview(item.pr_nomor);
  if (!komentar.length) throw permintaanSalah("Belum ada komentar review di Pull Request");
  const instruksi = `Tindak lanjuti komentar review Pull Request #${item.pr_nomor}:\n${komentar.map((k) => `- ${k.oleh ?? "reviewer"}${k.path ? ` (${k.path}${k.baris ? `:${k.baris}` : ""})` : ""}: ${k.isi}`).join("\n")}`;
  const kembali = await pindahTahap(item, "coding", { commit_sha: null, berkas: [] });
  await pesan(kembali, "coding", "sistem", `Item kembali ke Coding untuk menindaklanjuti ${komentar.length} komentar review.`);
  await audit(oleh, "Revisi dari komentar review", item.uuid, { jumlah: komentar.length });
  return jalankanCoding(kembali, instruksi, oleh);
};

export const bukaBranch = async (item, oleh) => {
  pastikanBukanProduksi();
  if (!item.branch) throw permintaanSalah("Item belum punya branch");
  if (item.worktree) return { branch: item.branch, worktree: item.worktree };
  try {
    await git(["switch", item.branch]);
  } catch (e) {
    throw new Galat(409, `Gagal berpindah ke ${item.branch}: ${e.message}`);
  }
  await audit(oleh, `Pindah ke branch ${item.branch}`, item.uuid);
  return { branch: item.branch };
};

export const kembaliBranch = async (item, oleh) => {
  pastikanBukanProduksi();
  if (item.worktree) {
    await hapusWorktree(item);
    await audit(oleh, "Menghapus worktree item", item.uuid);
    return { branch: null };
  }
  if (!item.branch_asal) throw permintaanSalah("Branch asal tidak diketahui");
  const status = await statusBerkas();
  if ((item.berkas ?? []).some((b) => b.path in status)) throw permintaanSalah("Perubahan item belum di-commit; commit dulu agar tidak terbawa ke branch lain");
  try {
    await git(["switch", item.branch_asal]);
  } catch (e) {
    throw new Galat(409, `Gagal kembali ke ${item.branch_asal}: ${e.message}`);
  }
  await audit(oleh, `Kembali ke branch ${item.branch_asal}`, item.uuid);
  return { branch: item.branch_asal };
};

// ---------- Rilis lokal (tanpa push/PR): gabungkan branch item ke branch yang dipakai aplikasi RS ----------

// Jalankan fn(cwd) pada working tree yang sedang berada di branch `target`:
// - repo utama bila target sedang aktif di sana (aplikasi yang berjalan langsung memakai hasilnya);
// - repo utama setelah berpindah dari branch item ke target (mode workspace);
// - worktree sementara bila target tidak aktif di mana pun.
const diBranchTarget = async (item, target, fn) => {
  const aktif = await branchSekarang();
  if (aktif === target) return fn(config.repoDir, true);
  if (!item.worktree && aktif === item.branch) {
    try {
      await git(["switch", target]);
    } catch (e) {
      throw new Galat(409, `Gagal berpindah ke branch ${target}: ${e.message}`);
    }
    return fn(config.repoDir, true);
  }
  // Target sedang terbuka di worktree lain (mis. salinan uji aplikasi RS) → gabungkan langsung di sana.
  const { keluaran: daftar } = await git(["worktree", "list", "--porcelain"], { izinkanGagal: true });
  for (const blok of daftar.split(/\n\n+/)) {
    const lokasiAda = blok.match(/^worktree (.+)$/m)?.[1];
    if (lokasiAda && blok.includes(`branch refs/heads/${target}`)) return fn(lokasiAda, true);
  }
  const lokasi = path.join(os.tmpdir(), `simrs-studio-terapkan-${item.nomor}-${Date.now()}`);
  try {
    await git(["worktree", "add", lokasi, target]);
  } catch (e) {
    throw new Galat(409, `Branch ${target} tidak dapat dibuka (${e.message}). Pastikan branch itu ada dan tidak sedang dipakai worktree lain.`);
  }
  try {
    return await fn(lokasi, false);
  } finally {
    await git(["worktree", "remove", "--force", lokasi], { izinkanGagal: true });
  }
};

// Gabungkan; konflik → batalkan penggabungan dan laporkan berkasnya.
const gabung = async (cwd, args, judul) => {
  const r = await git(args, { cwd, izinkanGagal: true });
  if (r.ok) return (await git(["rev-parse", "HEAD"], { cwd })).keluaran;
  const { keluaran } = await git(["diff", "--name-only", "--diff-filter=U"], { cwd, izinkanGagal: true });
  await git([args[0] === "revert" ? "revert" : "merge", "--abort"], { cwd, izinkanGagal: true });
  const bentrok = keluaran.split("\n").filter(Boolean);
  throw new Galat(409, `${judul} gagal karena konflik${bentrok.length ? ` pada: ${bentrok.join(", ")}` : `: ${r.galat}`}. Selesaikan manual di VS Code, atau minta agen merevisi item.`);
};

const jalankanMigrasi = async (cwd, item, oleh) => {
  const r = await jalankanPerintah("npm", ["run", "db:migrate"], { cwd, timeoutMs: 10 * 60 * 1000 });
  await pesan(item, item.tahap, "sistem", r.ok ? "Migrasi database dijalankan (npm run db:migrate)." : `Migrasi database GAGAL — jalankan manual: npm run db:migrate\n${r.keluaran.slice(-500)}`, oleh);
  return r.ok;
};

export const terapkanLokal = async (item, oleh) => {
  pastikanBukanProduksi();
  if (!["rilis", "selesai"].includes(item.tahap)) throw permintaanSalah("Penerapan lokal dilakukan pada tahap rilis");
  if (!item.commit_sha) throw permintaanSalah("Commit perubahan dulu sebelum diterapkan");
  const base = direktoriKerja(item);
  const status = await statusBerkas(base);
  if ((item.berkas ?? []).some((b) => b.path in status)) throw permintaanSalah("Masih ada perubahan item yang belum di-commit");
  const { nilai } = await bacaSemua();
  const target = await branchLokal(nilai, item);
  if (target === item.branch) throw permintaanSalah("Branch lokal sama dengan branch item — atur Branch lokal di Pengaturan & Agen");
  if (!(await git(["rev-parse", "--verify", "--quiet", `refs/heads/${target}`], { izinkanGagal: true })).ok) throw permintaanSalah(`Branch lokal ${target} tidak ditemukan`);
  const adaMigrasi = (item.riwayat_commit ?? []).some((c) => (c.berkas ?? []).some((p) => p.startsWith("database/migrations/")));
  let migrasi = null;
  const sha = await diBranchTarget(item, target, async (cwd, utama) => {
    const hasil = await gabung(cwd, ["merge", "--no-ff", "-m", `Terapkan SIMRS Studio ${nomor(item)}: ${item.judul}`, item.branch], "Penerapan");
    if (adaMigrasi && nilai.migrasi_otomatis) migrasi = utama ? await jalankanMigrasi(cwd, item, oleh) : false;
    return hasil;
  });
  await audit(oleh, `Menerapkan ke branch lokal ${target}`, item.uuid, { sha });
  await pesan(
    item, item.tahap, "sistem",
    `Diterapkan ke branch lokal ${target} (${sha.slice(0, 7)}).` +
      (adaMigrasi && migrasi === false && nilai.migrasi_otomatis ? " Ada migrasi baru: jalankan npm run db:migrate setelah aplikasi memakai branch itu." : "") +
      " Layanan dengan mode dev memuat ulang otomatis; di server, jalankan ulang layanan yang berubah.",
    oleh,
  );
  return ubah("studio_item", item.uuid, { branch_lokal: target, sha_lokal: sha, diterapkan_pada: sekarang(), sha_batal: null });
};

export const batalkanPenerapan = async (item, alasan, oleh) => {
  pastikanBukanProduksi();
  if (!item.sha_lokal || item.sha_batal) throw permintaanSalah("Item belum diterapkan ke lokal");
  if (!alasan?.trim()) throw permintaanSalah("Alasan wajib diisi");
  const sha = await diBranchTarget(item, item.branch_lokal, (cwd) =>
    gabung(cwd, ["revert", "-m", "1", "--no-edit", item.sha_lokal], "Pembatalan penerapan"),
  );
  await audit(oleh, `Membatalkan penerapan di ${item.branch_lokal}`, item.uuid, { alasan, sha });
  await pesan(item, item.tahap, "sistem", `Penerapan dibatalkan (revert ${sha.slice(0, 7)} di ${item.branch_lokal}): ${alasan}. Migrasi database TIDAK dibalik otomatis.`, oleh);
  return ubah("studio_item", item.uuid, { sha_batal: sha, diterapkan_pada: null });
};

// Izin aksi kerja per tahap (diskusi, AI tulis ulang, sunting).
export const pastikanIzinKerja = (req, item) => {
  const izin = IZIN_KERJA_TAHAP[item.tahap];
  return izin ? pastikan(req, izin[0], izin[1]) : Promise.resolve();
};
