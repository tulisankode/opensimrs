// Alur item SIMRS Studio: tahap, gerbang persetujuan per peran, tugas agen, cek otomatis, checklist uji, commit, PR, rilis.
// Rancangan: docs/rancangan/STUDIO-PENGEMBANG.md §6–8, §16.
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import config from "./config.js";
import { audit, query, satu, sekarang, sisipkan, transaksi, ubah, uuidv7 } from "./db.js";
import { Galat, permintaanSalah, tidakDitemukan } from "./respons.js";
import { bacaSemua } from "./pengaturan.js";
import { berkasBerubah, branchSekarang, git, patchBerkas, potretKerja, saringBerkasKotor, statusBerkas, urlRepo } from "./git.js";
import { branchDasar, branchLokal, direktoriKerja, folderBranchTerbuka, hapusWorktree, modeLokal, pastikanDiBranch, siapkanKerja } from "./kerja.js";
import { pathDiubahDalamDesain, periksaKebijakan, temukanDataPribadi, zonaTersentuh } from "./kebijakan.js";
import { FOLDER_MIGRASI, awalanLayak, hitungAwalan, rencanaUrutMigrasi, terapkanUrutMigrasi } from "./migrasi.js";
import { batalGabung, dikenal, masihBerpenanda, sedangMenggabung, selesaikanGabung, sinkronkan } from "./gabung.js";
import { FOLDER_LAMPIRAN, estimasiBiaya, jalankanAgen, periksaBatas } from "./agen/index.js";
import { CATATAN_LANJUTAN, susunRantai, waktuLanjut } from "./agen/kuota.js";
import { NAMA_TAHAP, susunPromptCoding, susunPromptDokumen, uraiKeluaran } from "./agen/prompt.js";
import { IZIN_KERJA_TAHAP, PERAN, gerbangTahap, statusGerbang } from "./gerbang.js";
import { isSuperadmin } from "./auth.js";
import { punya, pastikan } from "./izin.js";
import * as gitremote from "./gitremote.js";
import { aktifkan, nonaktifkan } from "./aktivasi.js";

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

// Tugas yang menunggu kuota (tunda_kuota) dianggap masih berjalan agar item tidak dijalankan ganda; batalkan dulu bila perlu.
export const STATUS_BERJALAN = ["antri", "jalan", "tunda_kuota"];
const tugasBerjalan = (itemUuid) =>
  satu(`SELECT * FROM studio_tugas WHERE item_uuid = $1 AND status = ANY($2) ORDER BY id DESC LIMIT 1`, [itemUuid, STATUS_BERJALAN]);

// Repo utama dipakai agen coding/cek item lain (item tanpa worktree) → jangan pindah branch di sana: perubahan agen
// akan tercatat di branch yang salah dan daftar berkas item itu menjadi kosong. Item `kecuali` = item yang sedang diproses.
// Tugas coding yang menunggu kuota juga menghalangi: working tree masih berisi sebagian perubahannya.
export const pastikanRepoUtamaBebas = async (kecuali = null) => {
  const lain = await satu(
    `SELECT i.nomor FROM studio_tugas t JOIN studio_item i ON i.uuid = t.item_uuid
      WHERE t.jenis IN ('coding', 'cek') AND t.status IN ('antri', 'jalan', 'tunda_kuota') AND i.worktree IS NULL AND ($1::uuid IS NULL OR i.uuid <> $1)
      LIMIT 1`,
    [kecuali],
  );
  if (lain) throw new Galat(409, `Working tree sedang dipakai item STD-${String(lain.nomor).padStart(4, "0")}. Tunggu sampai selesai, atau gunakan mode worktree.`);
};

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

// Kembali ke tahap sebelumnya (revisi mundur / buka kembali). tahap_mulai baru → persetujuan lama tahap itu tidak berlaku,
// sehingga tahap ini dan tahap sesudahnya disetujui ulang. Branch & kode item tetap (dipakai agen saat coding diulang).
const mundurKeTahap = async (item, keTahap, catatan, oleh, peran = null, keputusan = "mundur") => {
  let kembali = await pindahTahap(item, keTahap, { tahap_sebelum: null });
  if (keTahap === "coding") kembali = await pesanAwalanMigrasi(kembali);
  await sisipkan("studio_persetujuan", { item_uuid: item.uuid, tahap: keTahap, keputusan, alasan: catatan, pengguna: oleh, peran });
  await pesan(
    kembali, keTahap, "sistem",
    `${catatan}. Tahap ${NAMA_TAHAP[keTahap]} dan tahap sesudahnya perlu disetujui ulang.` +
      (item.branch ? ` Kode di branch ${item.branch} tidak dihapus dan dipakai sebagai bahan saat coding diulang.` : ""),
    oleh,
  );
  return kembali;
};

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

const BATAS_LAMPIRAN = 60_000; // karakter per lampiran teks yang disisipkan ke prompt
const BATAS_LAMPIRAN_TOTAL = 150_000;

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
  const lampiran = await query(`SELECT nama, lokasi, mime FROM studio_lampiran WHERE item_uuid = $1 AND deleted_at IS NULL ORDER BY created_at`, [item.uuid]);
  // Hanya Claude Code yang diberi akses folder lampiran (--add-dir). Codex & konektor API bekerja di sandbox folder kerja,
  // dan folder lampiran diabaikan git sehingga tidak terlihat oleh pencarian berkas: isi lampiran teks disisipkan ke prompt
  // (juga bila Codex/konektor API hanya ada di rantai cadangan).
  const { nilai } = await bacaSemua();
  if (susunRantai(nilai.konektor_tahap?.[tahap], nilai.konektor_cadangan).some((k) => k !== "claude_code")) {
    let sisa = BATAS_LAMPIRAN_TOTAL;
    for (const l of lampiran) {
      if (!MIME_TEKS.test(String(l.mime)) || sisa <= 0) continue;
      try {
        const isi = fs.readFileSync(l.lokasi, "utf8");
        l.isi = isi.length > Math.min(BATAS_LAMPIRAN, sisa) ? `${isi.slice(0, Math.min(BATAS_LAMPIRAN, sisa))}
… (dipotong)` : isi;
        sisa -= l.isi.length;
      } catch {
        /* berkas lampiran hilang: tetap dicantumkan nama & lokasinya */
      }
    }
  }
  return { aturanArea, tambahanTahap, pengetahuan, lampiran };
};

// Prompt efektif (pratinjau, rancangan §9.1).
export const pratinjauPrompt = async (item, tahap) => {
  const { nilai } = await bacaSemua();
  const tambahan = await konteksTambahan(item, tahap);
  if (tahap === "coding") {
    return susunPromptCoding({
      item, artefak: await artefakSebelum(item, "coding"), instruksi: null, aturanInstalasi: nilai.aturan_instalasi, branch: item.branch ?? "(dibuat saat coding dimulai)", revisi: false,
      awalanMigrasi: item.awalan_migrasi ?? null, ...tambahan,
    });
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
                  lanjut_pada, menunggu_slot, lanjutan_dari,
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
    // Tujuan tombol "Sinkronkan": branch lokal (mode lokal/keduanya) atau branch dasar PR.
    branchSinkron: modeLokal(nilai) ? await branchLokal(nilai, item) : await branchDasar(nilai, item),
    aplikasi: await statusAplikasi(await branchLokal(nilai, item)).catch(() => null),
    estimasiCoding: item.tahap === "coding" ? await estimasiBiaya("coding", "coding") : null,
    branchSekarang: item.worktree ? item.branch : await branchSekarang().catch(() => null),
  };
};

// ---------- Slot agen bersamaan & tunda kuota ----------

// Tugas agen yang memakai slot: sedang jalan, atau antri yang sedang disiapkan (bukan yang menunggu slot).
const SQL_SLOT_TERPAKAI = `SELECT COUNT(*)::int AS jumlah FROM studio_tugas
  WHERE jenis IN ('dokumen', 'coding') AND (status = 'jalan' OR (status = 'antri' AND NOT menunggu_slot))`;
// pg_advisory_xact_lock: pembuatan tugas & pengambilan antrean slot tidak balapan antarproses.
const KUNCI_SLOT = 80902026;
// Tugas yang terus tertunda kuota tidak dilanjutkan tanpa akhir.
const MAKS_LANJUTAN = 20;

const maksAgen = (nilai) => Math.max(Number(nilai.maks_agen_bersamaan) || 0, 0);

// Buat tugas agen. Slot penuh (maks_agen_bersamaan) → menunggu_slot; penjadwal memulainya saat ada slot kosong.
const buatTugasAgen = async (item, tahap, jenis, instruksi, oleh, tambahan = {}) => {
  const { nilai } = await bacaSemua();
  const maks = maksAgen(nilai);
  return transaksi(async (k) => {
    await query(`SELECT pg_advisory_xact_lock($1)`, [KUNCI_SLOT], k);
    const terpakai = maks ? (await satu(SQL_SLOT_TERPAKAI, [], k)).jumlah : 0;
    const tugas = await sisipkan("studio_tugas", {
      item_uuid: item.uuid, tahap, jenis, status: "antri", instruksi, dibuat_oleh: oleh, updated_at: sekarang(),
      menunggu_slot: maks > 0 && terpakai >= maks, ...tambahan,
    }, k);
    return { ...tugas, terpakai, maks };
  });
};

// Mulai tugas yang baru dibuat, atau umumkan bahwa ia menunggu slot agen.
const mulaiAtauTunggu = async (tugas, item, jalankan) => {
  if (!tugas.menunggu_slot) return void jalankan();
  await pesan(item, tugas.tahap, "sistem", `Menunggu slot agen (${tugas.terpakai}/${tugas.maks}) — tugas dimulai otomatis saat agen lain selesai.`, null, tugas.uuid);
};

// Galat agen → tunda_kuota (semua konektor dalam rantai habis kuota) atau gagal.
const tutupGagalAtauTunda = async (tugas, item, tahap, e, awalan) => {
  if (e?.kuota) {
    const t = await tutupTugas(tugas.uuid, { status: "tunda_kuota", lanjut_pada: e.lanjutPada, pesan_galat: e.message });
    if (t?.status === "tunda_kuota") {
      await pesan(item, tahap, "sistem",
        `Kuota habis (${e.habis.map((h) => h.nama).join(", ")}); dilanjutkan otomatis ${waktuLanjut(e.lanjutPada)}. Batalkan tugas bila tidak perlu dilanjutkan.`,
        null, tugas.uuid);
      await audit("sistem", `Tugas ${NAMA_TAHAP[tahap] ?? tahap} ditunda karena kuota`, item.uuid, { lanjutPada: e.lanjutPada });
    }
    return;
  }
  await tutupTugas(tugas.uuid, { status: "gagal", pesan_galat: e.message });
  await pesan(item, tahap, "sistem", `${awalan}: ${e.message}`, null, tugas.uuid);
};

// Alasan tugas tersimpan (menunggu slot / tunda kuota) tidak boleh dilanjutkan, atau null.
export const alasanTidakLanjut = (item, tugas, nilai, lingkungan = config.lingkungan) => {
  if (!item) return "item sudah dihapus";
  if (item.tahap === "ditunda") return "item sedang ditunda";
  if (item.tahap === "dibatalkan") return "item sudah dibatalkan";
  if (item.tahap !== tugas.tahap) return `item sudah berada di tahap ${NAMA_TAHAP[item.tahap] ?? item.tahap}`;
  if (tugas.jenis === "coding") {
    if (lingkungan === "production") return "coding tidak dijalankan di instalasi produksi";
    if (nilai.fitur?.coding === false) return "fitur Coding dimatikan";
    if (item.risiko === "kritis") return "item berisiko kritis (kode dikerjakan programmer)";
  }
  return null;
};

const batalkanOtomatis = async (tugas, item, alasan) => {
  await ubah("studio_tugas", tugas.uuid, { status: "dibatalkan", pesan_galat: `Tidak dilanjutkan: ${alasan}`, selesai: sekarang() });
  if (item) await pesan(item, tugas.tahap, "sistem", `Tugas agen yang tertunda tidak dilanjutkan: ${alasan}.`, null, tugas.uuid);
};

// Jalankan tugas tersimpan (keluar dari antrean slot). Item yang berubah sejak tugas dibuat → tugas dibatalkan.
const mulaiTugasTersimpan = async (tugas) => {
  const item = tugas.item_uuid ? await satu(`SELECT * FROM studio_item WHERE uuid = $1 AND deleted_at IS NULL`, [tugas.item_uuid]) : null;
  try {
    const { nilai } = await bacaSemua();
    const alasan = alasanTidakLanjut(item, tugas, nilai);
    if (alasan) return await batalkanOtomatis(tugas, item, alasan);
    if (tugas.jenis === "coding") {
      if (nilai.mode_kerja !== "worktree" && !item.worktree) await pastikanRepoUtamaBebas(item.uuid);
      const siap = await pesanAwalanMigrasi(await siapkanKerja(item));
      kerjakanCoding(tugas, siap, tugas.instruksi);
    } else kerjakanDokumen(tugas, item, tugas.tahap, tugas.instruksi);
  } catch (e) {
    await tutupTugas(tugas.uuid, { status: "gagal", pesan_galat: e.message });
    if (item) await pesan(item, tugas.tahap, "sistem", `Tugas agen gagal dimulai: ${e.message}`, null, tugas.uuid);
  }
};

// Mulai tugas yang menunggu slot (tertua dulu) selama slot masih ada. Dipanggil penjadwal & setiap tugas agen selesai.
export const mulaiAntrianSlot = async () => {
  if (!config.aktifInstalasi) return 0;
  const { nilai } = await bacaSemua();
  if (!nilai.mode_pengembang?.aktif || nilai.kill_switch?.aktif) return 0;
  const maks = maksAgen(nilai);
  let dimulai = 0;
  for (;;) {
    const tugas = await transaksi(async (k) => {
      await query(`SELECT pg_advisory_xact_lock($1)`, [KUNCI_SLOT], k);
      if (maks && (await satu(SQL_SLOT_TERPAKAI, [], k)).jumlah >= maks) return null;
      return satu(
        `UPDATE studio_tugas SET menunggu_slot = false, updated_at = $1
          WHERE id = (SELECT id FROM studio_tugas WHERE status = 'antri' AND menunggu_slot ORDER BY id LIMIT 1) RETURNING *`,
        [sekarang()], k,
      );
    });
    if (!tugas) return dimulai;
    await mulaiTugasTersimpan(tugas);
    dimulai++;
  }
};

const lanjutkanAntrian = () => mulaiAntrianSlot().catch((e) => console.error("[studio] antrean slot agen:", e.message));

// Lanjutkan tugas tunda_kuota yang sudah diklaim penjadwal (status lama sudah 'dilanjutkan'): buat tugas baru dengan
// jenis/tahap/instruksi yang sama. Coding diberi catatan lanjutan agar agen meneruskan perubahan yang sudah ada.
export const lanjutkanTugasTunda = async (lama) => {
  const item = lama.item_uuid ? await satu(`SELECT * FROM studio_item WHERE uuid = $1 AND deleted_at IS NULL`, [lama.item_uuid]) : null;
  const { nilai } = await bacaSemua();
  const ke = Number(lama.lanjutan_ke ?? 0) + 1;
  const alasan = alasanTidakLanjut(item, lama, nilai)
    ?? (ke > MAKS_LANJUTAN ? `sudah ${MAKS_LANJUTAN} kali tertunda kuota — jalankan ulang manual` : null)
    ?? ((await tugasBerjalan(item.uuid)) ? "item sudah punya tugas agen lain yang berjalan" : null);
  if (alasan) return batalkanOtomatis(lama, item, alasan);
  const instruksi = lama.jenis === "coding" && !String(lama.instruksi ?? "").includes(CATATAN_LANJUTAN)
    ? `${CATATAN_LANJUTAN}${lama.instruksi ? `\n\n${lama.instruksi}` : ""}`
    : lama.instruksi;
  const tugas = await buatTugasAgen(item, lama.tahap, lama.jenis, instruksi, lama.dibuat_oleh, { lanjutan_dari: lama.uuid, lanjutan_ke: ke });
  await pesan(item, lama.tahap, "sistem", `Waktu reset kuota tiba — tugas ${NAMA_TAHAP[lama.tahap] ?? lama.tahap} dilanjutkan otomatis.`, null, tugas.uuid);
  await audit("sistem", `Melanjutkan tugas ${NAMA_TAHAP[lama.tahap] ?? lama.tahap} setelah kuota pulih`, item.uuid, { dari: lama.uuid });
  await mulaiAtauTunggu(tugas, item, () => mulaiTugasTersimpan(tugas));
  return tugas;
};

// ---------- Tugas agen: dokumen ----------

export const jalankanDokumen = async (item, tahap, instruksi, oleh) => {
  if (!TAHAP_DOKUMEN.has(tahap)) throw permintaanSalah(`Tahap ${tahap} bukan tahap dokumen`);
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Masih ada tugas agen yang berjalan untuk item ini");
  await periksaBatas(item, oleh);
  const tugas = await buatTugasAgen(item, tahap, "dokumen", instruksi, oleh);
  await mulaiAtauTunggu(tugas, item, () => kerjakanDokumen(tugas, item, tahap, instruksi));
  return tugas;
};

// Badan tugas dokumen (latar): dipakai rute dan penjadwal (antrean slot / lanjut setelah kuota pulih).
const kerjakanDokumen = async (tugas, item, tahap, instruksi) => {
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
    const { hasil } = await jalankanAgen({
      tugasUuid: tugas.uuid, prompt, mode: "dokumen", tahap, base: direktoriKerja(terkini), item: terkini,
      beritahu: (teks) => pesan(terkini, tahap, "sistem", teks, null, tugas.uuid),
    });
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
    await tutupGagalAtauTunda(tugas, item, tahap, e, "Agen gagal").catch((x) => console.error("[studio] menutup tugas:", x.message));
  } finally {
    lanjutkanAntrian();
  }
};

// ---------- Tugas agen: coding ----------

export const jalankanCoding = async (item, instruksi, oleh) => {
  pastikanBukanProduksi();
  const { nilai } = await bacaSemua();
  if (nilai.fitur?.coding === false) throw new Galat(403, "Fitur Coding belum diaktifkan superadmin (Pengaturan & Agen › Fitur Studio)");
  if (item.tahap !== "coding") throw permintaanSalah("Item belum berada di tahap coding");
  if (item.risiko === "kritis") throw new Galat(403, "Item berisiko kritis: agen hanya boleh menulis PRD/desain; kode dikerjakan programmer.");
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Masih ada tugas agen yang berjalan untuk item ini");
  if (nilai.mode_kerja !== "worktree" && !item.worktree) await pastikanRepoUtamaBebas();
  await periksaBatas(item, oleh);

  const siap = await pesanAwalanMigrasi(await siapkanKerja(item));
  const tugas = await buatTugasAgen(siap, "coding", "coding", instruksi, oleh);
  await audit(oleh, "Menjalankan agen coding", item.uuid, { branch: siap.branch, worktree: siap.worktree });
  await mulaiAtauTunggu(tugas, siap, () => kerjakanCoding(tugas, siap, instruksi));
  return tugas;
};

// Badan tugas coding (latar): dipakai rute dan penjadwal. Berkas yang sempat diubah tetap dicatat walau agen gagal/kuota habis.
const kerjakanCoding = async (tugas, siap, instruksi) => {
  const item = siap;
  const base = direktoriKerja(siap);
  let galat = null;
  let hasil = "";
  let sebelum = null;
  try {
    const { nilai } = await bacaSemua();
    sebelum = await potretKerja(base);
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
      awalanMigrasi: siap.awalan_migrasi ?? null,
      ...(await konteksTambahan(siap, "coding")),
    });
    ({ hasil } = await jalankanAgen({
      tugasUuid: tugas.uuid, prompt, mode: "coding", tahap: "coding", base, item: siap, resume: sesiLalu?.session_id ?? null,
      beritahu: (teks) => pesan(siap, "coding", "sistem", teks, null, tugas.uuid),
    }));
  } catch (e) {
    galat = e;
  }
  try {
    if (sebelum) {
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
    }
  } catch (e) {
    galat = galat ?? e;
  }
  try {
    if (galat) await tutupGagalAtauTunda(tugas, item, "coding", galat, "Agen coding gagal");
  } catch (e) {
    console.error("[studio] menutup tugas coding:", e.message);
  } finally {
    lanjutkanAntrian();
  }
};

// ---------- Perubahan & pemeriksa kebijakan ----------

// Helper enkripsi rahasia yang sudah teruji: berkas kriptografi baru buatan agen harus salinan bakunya (kebijakan §4a).
const BERKAS_KRIPTO_BAKU = ["lab-service/src/lis/rahasia.js", "setting-service/src/bantuan/rahasia.js"];
const kriptoBaku = () =>
  BERKAS_KRIPTO_BAKU.map((p) => {
    try {
      return fs.readFileSync(path.join(config.repoDir, p), "utf8");
    } catch {
      return null;
    }
  }).filter(Boolean);

const migrasiTerakhir = async (dasar) => {
  const { keluaran } = await git(["ls-tree", "--name-only", dasar || "main", "database/migrations/"], { izinkanGagal: true });
  const stempel = keluaran.split("\n").map((p) => p.match(/(\d{14})-/)?.[1]).filter(Boolean).sort();
  return stempel.at(-1) ?? null;
};

// ---------- Awalan migrasi per item ----------

// Migrasi terakhir di branch dasar & branch lokal (yang paling baru).
const migrasiTerakhirTarget = async (item) => {
  const { nilai } = await bacaSemua();
  const refs = [...new Set([await branchDasar(nilai, item), await branchLokal(nilai, item)].filter(Boolean))];
  return (await Promise.all(refs.map(migrasiTerakhir))).filter(Boolean).sort().at(-1) ?? null;
};

// Awalan yang dipesan item lain yang masih aktif (belum selesai/dibatalkan).
const awalanItemLain = (itemUuid, k) =>
  query(
    `SELECT nomor, awalan_migrasi FROM studio_item
      WHERE awalan_migrasi IS NOT NULL AND deleted_at IS NULL AND tahap NOT IN ('selesai', 'dibatalkan') AND uuid <> $1`,
    [itemUuid], k,
  );

const adaMigrasiItem = (item) =>
  [...(item.berkas ?? []).map((b) => b.path), ...(item.riwayat_commit ?? []).flatMap((c) => c.berkas ?? [])].some((p) => p.startsWith(`${FOLDER_MIGRASI}/`));

// pg_advisory_xact_lock: dua item yang mulai coding bersamaan tidak mendapat awalan yang sama.
const KUNCI_AWALAN = 80902027;

// Pesan awalan migrasi (blok jam UTC YYYYMMDDHH) untuk item, idempoten. Awalan lama dipertahankan selama masih layak;
// awalan yang tertinggal (item lain sudah diterapkan dengan migrasi lebih baru) diganti hanya bila item belum punya
// migrasi — migrasi yang sudah ditulis diurutkan otomatis saat Terapkan. Gagal memesan tidak menghentikan coding.
export const pesanAwalanMigrasi = async (item) => {
  try {
    const terakhir = await migrasiTerakhirTarget(item);
    return await transaksi(async (k) => {
      await query(`SELECT pg_advisory_xact_lock($1)`, [KUNCI_AWALAN], k);
      const segar = (await satu(`SELECT * FROM studio_item WHERE uuid = $1`, [item.uuid], k)) ?? item;
      const dipesan = (await awalanItemLain(item.uuid, k)).map((r) => r.awalan_migrasi);
      const lama = segar.awalan_migrasi;
      if (lama && (awalanLayak(lama, { terakhir, dipesan }) || (adaMigrasiItem(segar) && !dipesan.includes(lama)))) return { ...item, awalan_migrasi: lama };
      const awalan = hitungAwalan({ terakhir, dipesan, sekarang: new Date() });
      await ubah("studio_item", item.uuid, { awalan_migrasi: awalan }, k);
      if (lama) await pesan(item, item.tahap, "sistem", `Awalan migrasi item diperbarui ${lama} → ${awalan} (awalan lama sudah tertinggal atau dipakai item lain).`);
      return { ...item, awalan_migrasi: awalan };
    });
  } catch (e) {
    console.error("[studio] memesan awalan migrasi:", e.message);
    return item;
  }
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
  const kebijakan = periksaKebijakan(berkas, {
    risiko: item.risiko, migrasiTerakhir: await migrasiTerakhir(await branchDasar(nilai, item)), kriptoBaku: kriptoBaku(),
    awalanMigrasi: item.awalan_migrasi ?? null, awalanLain: await awalanItemLain(item.uuid).catch(() => []), fragmen: `changelog.d/${nomor(item)}.md`,
  });
  berkas = berkas.map((b) => ({ ...b, ...hitungBaris(b.patch), patch: b.patch.length > BATAS ? `${b.patch.slice(0, BATAS)}\n… (dipotong)` : b.patch }));
  return { branch: item.branch, worktree: item.worktree, commitSha: item.commit_sha, berkas, kebijakan };
};

// ---------- Coding manual (programmer; wajib untuk risiko kritis) ----------

// Siapkan branch/worktree item tanpa agen. Potret berkas kotor disimpan agar perubahan lain di working tree tidak ikut tercatat.
export const siapkanManual = async (item, oleh) => {
  pastikanBukanProduksi();
  if (item.tahap !== "coding") throw permintaanSalah("Branch kerja disiapkan pada tahap coding");
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Masih ada tugas agen yang berjalan untuk item ini");
  const { nilai } = await bacaSemua();
  if (nilai.mode_kerja !== "worktree" && !item.worktree) await pastikanRepoUtamaBebas(item.uuid);
  const siap = await pesanAwalanMigrasi(await siapkanKerja(item));
  const potret = siap.snapshot ?? (await potretKerja(direktoriKerja(siap)));
  const baru = await ubah("studio_item", item.uuid, { snapshot: potret });
  await pesan(
    baru, "coding", "sistem",
    `Branch ${baru.branch} siap${baru.worktree ? ` di ${baru.worktree}` : " di working tree repo"}. Kerjakan kode di VS Code, lalu klik "Pindai perubahan manual".` +
      (baru.awalan_migrasi ? ` Migrasi baru item ini wajib bernama ${FOLDER_MIGRASI}/${baru.awalan_migrasi}MMSS-nama.cjs.` : "") +
      ` Catatan perubahan ditulis di changelog.d/${nomor(baru)}.md (bukan CHANGELOG.md).`,
    oleh,
  );
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
  // Hanya berkas yang masih belum di-commit yang dipertahankan; yang sudah di-commit manual tercatat di riwayat commit.
  const masihKotor = saringBerkasKotor([...peta.values()], await statusBerkas(base));
  let baru = await ubah("studio_item", item.uuid, {
    berkas: masihKotor,
    riwayat_commit: riwayat,
    commit_sha: head !== dasarRef && riwayat.length ? head : item.commit_sha,
  });
  const semua = [...new Set([...peta.keys(), ...riwayat.flatMap((c) => c.berkas)])];
  if (zonaTersentuh(semua) === "kuning") baru = await naikkanRisiko(baru, "tinggi", "kode menyentuh layanan klinis/keuangan");
  await pesan(baru, item.tahap, "sistem", `Pindai perubahan manual: ${masihKotor.length} berkas belum di-commit, ${commitBaru.length} commit baru di ${item.branch}.`, oleh);
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

      // Integritas lintas berkas (rute katalog ganda, menu navbar, migrasi kembar, import "@/main"): selalu, karena
      // pelanggarannya baru terlihat setelah diterapkan (modul tetap "Segera", menu tidak muncul, layar putih).
      if (fs.existsSync(path.join(base, "scripts", "cek-integritas.mjs"))) {
        const r = await jalankanPerintah("node", ["scripts/cek-integritas.mjs"], { cwd: base, timeoutMs: 60000 });
        await log(r.ok ? "hasil" : "galat", `${r.ok ? "✔" : "✘"} cek integritas\n${r.keluaran.slice(-1500)}`);
        langkah.push({ nama: "Integritas lintas berkas", lulus: r.ok });
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

export const putuskan = async (item, { keputusan, alasan, peran, ke_tahap: keTahap }, req) => {
  const oleh = req.author.username;
  if (!["setuju", "revisi", "tolak"].includes(keputusan)) throw permintaanSalah("Keputusan harus setuju, revisi, atau tolak");
  pastikanAktif(item);
  if (keputusan !== "setuju" && !alasan?.trim()) throw permintaanSalah("Alasan wajib diisi untuk revisi atau tolak");
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Tunggu tugas agen selesai sebelum memutuskan");
  const tahap = item.tahap;
  // Revisi mundur: kembali ke tahap sebelumnya (mis. dari coding ke PRD). Hanya tahap yang sudah dilewati.
  if (keTahap && keTahap !== tahap) {
    if (keputusan !== "revisi") throw permintaanSalah("Kembali ke tahap sebelumnya hanya untuk revisi");
    if (!TAHAP.includes(keTahap) || TAHAP.indexOf(keTahap) > TAHAP.indexOf(tahap)) throw permintaanSalah("Tahap tujuan revisi harus tahap sebelumnya");
  }
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

  // Tolak = batalkan item (bisa dibuka kembali superadmin; tahap terakhir disimpan di tahap_sebelum).
  if (keputusan === "tolak") return ubah("studio_item", item.uuid, { tahap: "dibatalkan", tahap_sebelum: tahap });

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
    if (keTahap && keTahap !== tahap) {
      const kembali = await mundurKeTahap(item, keTahap, `Dikembalikan dari ${NAMA_TAHAP[tahap]}: ${alasan.trim()}`, oleh, kode);
      if (keTahap === "coding") await revisiKode(kembali, alasan.trim());
      else {
        await jalankanDokumen(kembali, keTahap, `Revisi dari tahap ${NAMA_TAHAP[tahap]}: ${alasan.trim()}`, oleh)
          .catch((e) => pesan(kembali, keTahap, "sistem", `Agen belum dijalankan: ${e.message.replace(/\.$/, "")}. Klik "AI tulis ulang" atau sunting dokumen manual.`));
      }
      return ambilItem(item.uuid);
    }
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
  // Masuk coding → awalan migrasi dipesan sekarang, agar terlihat di pratinjau prompt & panel coding.
  if (ke === "coding") await pesanAwalanMigrasi(lanjut);
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
  await sisipkan("studio_persetujuan", { item_uuid: item.uuid, tahap: item.tahap, keputusan: "batal", alasan: alasan?.trim() || null, pengguna: oleh });
  // Worktree & branch dibiarkan agar item bisa dibuka kembali tanpa kehilangan kode yang belum di-commit.
  return ubah("studio_item", item.uuid, { tahap: "dibatalkan", tahap_sebelum: item.tahap });
};

// Buka kembali item yang dibatalkan/ditolak ke tahap pilihan (bawaan: tahap saat dibatalkan). Superadmin, wajib alasan.
// Bila tahapnya tahap dokumen dan agen diminta, agen menulis ulang dokumen tahap itu dengan alasan sebagai instruksi.
export const bukaKembali = async (item, { ke_tahap: keTahap, alasan, jalankan_agen: jalankanAgenDokumen }, oleh) => {
  if (item.tahap !== "dibatalkan") throw permintaanSalah("Hanya item yang dibatalkan yang bisa dibuka kembali");
  if (!alasan?.trim()) throw permintaanSalah("Alasan wajib diisi");
  // Item lama (sebelum tahap_sebelum dicatat): tahap keputusan terakhir.
  const terakhir = item.tahap_sebelum
    ?? (await satu(`SELECT tahap FROM studio_persetujuan WHERE item_uuid = $1 AND tahap = ANY($2) ORDER BY created_at DESC, id DESC LIMIT 1`, [item.uuid, TAHAP]))?.tahap
    ?? "permintaan";
  const ke = keTahap || terakhir;
  if (!TAHAP.includes(ke)) throw permintaanSalah("Tahap tujuan tidak dikenal");
  const { nilai } = await bacaSemua();
  const kembali = await mundurKeTahap(item, ke, `Dibuka kembali ke ${NAMA_TAHAP[ke]}: ${alasan.trim()}`, oleh, null, "buka");
  await audit(oleh, `Membuka kembali item ke ${NAMA_TAHAP[ke]}`, item.uuid, { alasan, dari: terakhir });
  if (jalankanAgenDokumen && TAHAP_DOKUMEN.has(ke) && nilai.fitur?.[ke] !== false) {
    await jalankanDokumen(kembali, ke, alasan.trim(), oleh)
      .catch((e) => pesan(kembali, ke, "sistem", `Agen belum dijalankan: ${e.message.replace(/\.$/, "")}. Klik "AI tulis ulang" atau sunting dokumen manual.`));
  }
  return ambilItem(item.uuid);
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
  if (!jalur.length) {
    // Semua perubahan sudah di-commit langsung di branch (oleh agen atau programmer): catat commit itu, bukan buntu.
    const baru = await pindaiManual(item, oleh);
    if (baru.commit_sha) return baru;
    throw permintaanSalah("Tidak ada perubahan untuk di-commit");
  }
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
  await pastikanRepoUtamaBebas(item.uuid);
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
  await pastikanRepoUtamaBebas(item.uuid);
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
    await pastikanRepoUtamaBebas(item.uuid);
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
  // Bukan konflik: git menolak karena berkas yang belum di-commit di working tree tujuan akan tertimpa.
  const tertimpa = !bentrok.length && /would be overwritten|akan ditimpa/i.test(r.galat ?? "")
    ? [...(r.galat ?? "").matchAll(/^\s+(\S.*)$/gm)].map((m) => m[1].trim()).filter((p) => !/^(Please|Aborting|Mohon|Membatalkan)/.test(p))
    : null;
  if (tertimpa) {
    throw new Galat(409, `${judul} dibatalkan: berkas berikut di ${cwd} belum di-commit dan akan tertimpa — ${tertimpa.join(", ") || r.galat}. ` +
      "Commit atau simpan sementara (git stash) perubahan itu dulu, lalu ulangi.");
  }
  throw new Galat(409, `${judul} gagal karena konflik${bentrok.length ? ` pada: ${bentrok.join(", ")}` : `: ${r.galat}`}. Lihat "Kesiapan penerapan" di tab Rilis untuk menyelesaikannya.`);
};

// Pra-cek konflik tanpa menyentuh working tree (git merge-tree --write-tree, git ≥ 2.38). Merge yang berkonflik lalu
// dibatalkan membuat berkas di aplikasi yang sedang berjalan muncul lalu hilang lagi, dan Vite/Tailwind tetap mencari
// berkas yang hilang itu (galat ENOENT sampai npm run dev dijalankan ulang). Mengembalikan daftar berkas yang bentrok.
const pracekGabung = async (target, sumber) => {
  const r = await git(["merge-tree", "--write-tree", "--name-only", "--no-messages", target, sumber], { izinkanGagal: true });
  if (r.ok) return [];
  const [oid, ...berkas] = r.keluaran.split("\n");
  // Bukan keluaran konflik (mis. git lama tanpa --write-tree): lanjut ke merge biasa yang tetap dibatalkan bila bentrok.
  if (!/^[0-9a-f]{40,64}$/.test(oid ?? "")) return [];
  return [...new Set(berkas.filter(Boolean))];
};

// Migrasi baru milik item & migrasi di branch tujuan (nama berkas). Aturan repo: migrasi item harus berurutan paling
// akhir saat digabung; yang tertinggal diurutkan otomatis saat Terapkan (urutkanMigrasiItem).
const migrasiItemDanTarget = async (target, sumber) => {
  const { keluaran: baru } = await git(["diff", "--name-only", "--diff-filter=A", `${target}...${sumber}`, "--", FOLDER_MIGRASI], { izinkanGagal: true });
  const milikItem = baru.split("\n").filter((p) => p.endsWith(".cjs")).map((p) => path.basename(p));
  if (!milikItem.length) return { milikItem, diTarget: [] };
  const { keluaran: ada } = await git(["ls-tree", "--name-only", target, `${FOLDER_MIGRASI}/`], { izinkanGagal: true });
  return { milikItem, diTarget: ada.split("\n").filter((p) => p.endsWith(".cjs")).map((p) => path.basename(p)) };
};

// Jalankan fn(cwd) pada working tree yang sedang berada di branch item: worktree item, repo utama (mode workspace,
// item sedang dibuka di sana), worktree lain yang membuka branch itu, atau worktree sementara.
const diBranchItem = async (item, fn) => {
  if (item.worktree && fs.existsSync(item.worktree)) return fn(item.worktree);
  if ((await branchSekarang().catch(() => null)) === item.branch) {
    await pastikanRepoUtamaBebas(item.uuid);
    return fn(config.repoDir);
  }
  const terbuka = folderBranchTerbuka((await git(["worktree", "list", "--porcelain"], { izinkanGagal: true })).keluaran, item.branch);
  if (terbuka) return fn(terbuka);
  const lokasi = path.join(os.tmpdir(), `simrs-studio-item-${item.nomor}-${Date.now()}`);
  try {
    await git(["worktree", "add", lokasi, item.branch]);
  } catch (e) {
    throw new Galat(409, `Branch ${item.branch} tidak dapat dibuka (${e.message})`);
  }
  try {
    return await fn(lokasi);
  } finally {
    await git(["worktree", "remove", "--force", lokasi], { izinkanGagal: true });
  }
};

// Catat commit buatan Studio (urutkan migrasi / sinkronisasi) di riwayat item.
const catatCommitStudio = async (item, sha, pesanCommit, berkas) =>
  ubah("studio_item", item.uuid, {
    commit_sha: sha,
    riwayat_commit: [...(item.riwayat_commit ?? []), { sha, pesan: pesanCommit, berkas, pada: sekarang(), studio: true }],
  });

// Migrasi item tertinggal dari target (item lain diterapkan lebih dulu, atau awalan bentrok) → ganti nama ke awalan
// baru yang lebih baru dari target, perbarui rujukan, commit di branch item. Migrasi yang sudah pernah dijalankan
// (tercatat di SequelizeMeta database bersama) tidak boleh diganti namanya: Terapkan ditolak.
// Mengembalikan { item, peta } (peta kosong bila sudah urut).
// Rencana pengurutan migrasi item terhadap target tanpa mengubah apa pun: { milikItem, terakhir, peta, tercatat }.
// tercatat = migrasi yang perlu diganti nama tetapi sudah pernah dijalankan (SequelizeMeta) → tidak boleh diurutkan otomatis.
const rencanaMigrasiItem = async (item, target) => {
  const { milikItem, diTarget } = await migrasiItemDanTarget(target, item.branch);
  if (!milikItem.length) return { milikItem, terakhir: null, peta: [], tercatat: [] };
  const terakhir = diTarget.filter((n) => !milikItem.includes(n)).sort().at(-1)?.slice(0, 14) ?? null;
  const dipesan = (await awalanItemLain(item.uuid)).map((r) => r.awalan_migrasi);
  let peta;
  try {
    peta = rencanaUrutMigrasi({ milikItem, diTarget, awalanBaru: hitungAwalan({ terakhir, dipesan, sekarang: new Date() }) });
  } catch (e) {
    throw new Galat(409, `Migrasi item tidak dapat diurutkan otomatis: ${e.message}`);
  }
  const tercatat = peta.length
    ? (await query(`SELECT name FROM "SequelizeMeta" WHERE name = ANY($1)`, [peta.map((p) => p.lama)]).catch(() => [])).map((r) => r.name)
    : [];
  return { milikItem, terakhir, peta, tercatat };
};
const PESAN_MIGRASI_TERCATAT = (nama, target) =>
  `Migrasi ${nama.join(", ")} lebih tua dari migrasi terakhir di ${target}, tetapi sudah pernah dijalankan di database ` +
  `(tercatat di SequelizeMeta), sehingga namanya tidak diganti otomatis. Ganti nama manual di branch item beserta baris SequelizeMeta-nya, atau terapkan apa adanya lewat git setelah ditinjau.`;

export const urutkanMigrasiItem = async (item, target, oleh) => {
  const { milikItem, terakhir, peta, tercatat } = await rencanaMigrasiItem(item, target);
  if (!milikItem.length || !peta.length) return { item, peta };
  if (tercatat.length) throw new Galat(409, PESAN_MIGRASI_TERCATAT(tercatat, target));
  const pesanCommit = `chore(studio): urutkan migrasi ${nomor(item)} setelah ${terakhir}`;
  const hasil = await diBranchItem(item, async (cwd) => {
    const kotor = (await git(["status", "--porcelain", "--untracked-files=no"], { cwd })).keluaran;
    if (kotor.trim()) throw new Galat(409, `Migrasi item perlu diurutkan ulang, tetapi masih ada perubahan yang belum di-commit di ${cwd}`);
    return terapkanUrutMigrasi(cwd, peta, `${pesanCommit}\n\n${peta.map((p) => `- ${p.lama} → ${p.baru}`).join("\n")}\n\nSIMRS Studio ${nomor(item)}\n`);
  });
  let baru = await catatCommitStudio(item, hasil.sha, pesanCommit, hasil.berkas);
  baru = await ubah("studio_item", item.uuid, { awalan_migrasi: peta[0].baru.slice(0, 10) });
  await pesan(baru, item.tahap, "sistem", `Migrasi item diurutkan ulang agar paling akhir terhadap ${target}: ${peta.map((p) => `${p.lama} → ${p.baru}`).join(", ")} (commit ${hasil.sha.slice(0, 7)}).`, oleh);
  await audit(oleh, "Mengurutkan ulang migrasi item", item.uuid, { target, peta, sha: hasil.sha });
  return { item: baru, peta };
};

// Ringkasan hasil sinkronisasi untuk diskusi & respons.
const ringkasSinkron = (h, target) => {
  const auto = h.otomatis?.length ? ` Diselesaikan otomatis: ${h.otomatis.map((o) => `${o.path} (${o.cara})`).join("; ")}.` : "";
  if (h.status === "mutakhir") return `Branch item sudah memuat semua perubahan ${target}.`;
  if (h.status === "digabung") return `${target} digabung ke branch item (commit ${h.sha.slice(0, 7)}).${auto}`;
  if (h.status === "gagal_integritas") return `Sinkronisasi dengan ${target} dibatalkan: cek integritas gagal setelah konflik diselesaikan otomatis.${auto}\n${h.integritas ?? ""}`;
  return `Sinkronisasi dengan ${target} dibatalkan (branch item tidak berubah): konflik pada ${h.tersisa.join(", ")} tidak dikenali pola otomatis. Selesaikan manual di worktree item atau minta agen merevisi.`;
};

// Sinkronkan branch item dengan branch lokal/dasar: gabungkan target ke branch item dengan penyelesaian konflik
// otomatis (src/gabung.js). Galat 409 bila tidak berhasil (branch item tetap bersih).
export const sinkronkanItem = async (item, oleh, { target = null } = {}) => {
  pastikanBukanProduksi();
  if (!item.branch) throw permintaanSalah("Item belum punya branch");
  if (!["coding", "qa", "rilis", "selesai"].includes(item.tahap)) throw permintaanSalah("Sinkronisasi dilakukan pada tahap coding sampai rilis");
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Masih ada tugas agen yang berjalan untuk item ini");
  const { nilai } = await bacaSemua();
  const tujuan = target ?? (modeLokal(nilai) ? await branchLokal(nilai, item) : await branchDasar(nilai, item));
  if (tujuan === item.branch) throw permintaanSalah("Branch tujuan sama dengan branch item");
  if (!(await git(["rev-parse", "--verify", "--quiet", tujuan], { izinkanGagal: true })).ok) throw permintaanSalah(`Branch ${tujuan} tidak ditemukan`);
  const pesanCommit = `chore(studio): sinkronkan ${item.branch} dengan ${tujuan}\n\nSIMRS Studio ${nomor(item)}`;
  const hasil = await diBranchItem(item, (cwd) => sinkronkan({ cwd, target: tujuan, pesanCommit }));
  const ringkasan = ringkasSinkron(hasil, tujuan);
  await pesan(item, item.tahap, "sistem", ringkasan, oleh);
  await audit(oleh, `Sinkronisasi branch item dengan ${tujuan}: ${hasil.status}`, item.uuid, { otomatis: hasil.otomatis, tersisa: hasil.tersisa, sha: hasil.sha });
  if (!["digabung", "mutakhir"].includes(hasil.status)) throw new Galat(409, ringkasan);
  const baru = hasil.status === "digabung" ? await catatCommitStudio(item, hasil.sha, pesanCommit.split("\n")[0], hasil.otomatis.map((o) => o.path)) : item;
  return { item: baru, ...hasil, target: tujuan, ringkasan };
};

// ---------- Kesiapan Terapkan & penyelesaian konflik (tanpa VS Code/terminal) ----------

const daftarGit = async (args, cwd) => (await git(args, { cwd, izinkanGagal: true })).keluaran.split("\n").filter(Boolean);

// Folder tempat branch item terbuka (worktree item atau repo utama). Penyelesaian konflik butuh folder tetap, bukan
// worktree sementara.
const folderItemTerbuka = async (item) => {
  if (item.worktree && fs.existsSync(item.worktree)) return item.worktree;
  if ((await branchSekarang().catch(() => null)) === item.branch) return config.repoDir;
  const terbuka = folderBranchTerbuka((await git(["worktree", "list", "--porcelain"], { izinkanGagal: true })).keluaran, item.branch);
  if (terbuka) return terbuka;
  throw new Galat(409, `Branch ${item.branch} tidak sedang terbuka di folder mana pun. Klik "Buka branch item" dulu.`);
};

// Berkas yang masih berpenanda konflik selama penggabungan berjalan.
const penandaTersisa = async (cwd) =>
  masihBerpenanda(cwd, [...new Set([...(await daftarGit(["diff", "--name-only", "--diff-filter=U"], cwd)), ...(await daftarGit(["diff", "--name-only", "HEAD"], cwd))])]);

// Daftar periksa sebelum Terapkan: apa yang menghalangi dan aksi yang bisa diambil langsung dari Studio.
// Setiap langkah: { kode, status: ok|info|blokir, judul, rincian, berkas?, aksi?: [nama aksi], folder? }. Hanya membaca.
export const kesiapanTerapkan = async (item) => {
  const langkah = [];
  const tambah = (kode, status, judul, rincian = "", ekstra = {}) => langkah.push({ kode, status, judul, rincian, ...ekstra });
  const { nilai } = await bacaSemua();
  const target = await branchLokal(nilai, item);
  const hasil = () => ({ target, siap: !langkah.some((l) => l.status === "blokir"), langkah });
  if (!item.branch) {
    tambah("branch", "blokir", "Item belum punya branch kerja", "Kerjakan item di tahap Coding dulu.");
    return hasil();
  }
  if (await tugasBerjalan(item.uuid)) tambah("agen", "blokir", "Agen masih bekerja untuk item ini", "Tunggu sampai selesai, atau batalkan tugasnya di panel tugas.");

  const adaTarget = target !== item.branch && (await git(["rev-parse", "--verify", "--quiet", `refs/heads/${target}`], { izinkanGagal: true })).ok;
  if (target === item.branch) tambah("target", "blokir", "Branch lokal sama dengan branch item", "Atur Branch lokal di Pengaturan & Agen.");
  else if (!adaTarget) tambah("target", "blokir", `Branch lokal ${target} tidak ditemukan`, "Atur Branch lokal di Pengaturan & Agen, atau buat branch itu.");
  else tambah("target", "ok", `Tujuan penerapan: ${target}`);

  // Working tree item: penggabungan yang belum ditutup, atau berkas belum di-commit.
  let base = null;
  try {
    base = await folderItemTerbuka(item);
  } catch {
    tambah("bersih", "info", "Branch item tidak sedang terbuka di folder mana pun", "Pemeriksaan berkas yang belum di-commit dilewati.");
  }
  let menggabung = false;
  if (base) {
    menggabung = await sedangMenggabung(base);
    if (menggabung) {
      const sisa = await penandaTersisa(base);
      tambah("gabung", "blokir",
        sisa.length ? `Penyelesaian konflik berjalan: ${sisa.length} berkas masih berpenanda konflik` : "Penyelesaian konflik berjalan: penanda konflik sudah bersih",
        sisa.length
          ? `Buka folder di VS Code, cari <<<<<<< pada berkas berikut lalu satukan isinya (bagian atas = item ini, bagian bawah = ${target}), atau klik "Minta agen menyelesaikan". Setelah bersih, klik "Tutup penggabungan".`
          : `Klik "Tutup penggabungan": Studio mengecek sintaks, dokumen katalog, dan integritas, lalu meng-commit hasilnya.`,
        { berkas: sisa, folder: base, aksi: sisa.length ? ["konflik/agen", "konflik/selesai", "konflik/batal"] : ["konflik/selesai", "konflik/batal"] });
    } else {
      const kotor = Object.keys(await statusBerkas(base));
      const tercatat = new Set((item.berkas ?? []).map((b) => b.path));
      const belumDikenal = kotor.filter((p) => !tercatat.has(p));
      if (kotor.length) {
        tambah("bersih", "blokir", `${kotor.length} berkas di branch item belum di-commit`,
          belumDikenal.length
            ? `${belumDikenal.length} di antaranya belum dikenal Studio (mis. dibuat agen lalu tertinggal). Klik "Pindai perubahan" agar tercatat, periksa isinya, lalu "Commit perubahan". Berkas yang tidak dipakai hapus saja dari folder item.`
            : `Isi pesan commit di bawah lalu klik "Commit perubahan".`,
          { berkas: kotor, folder: base, aksi: [belumDikenal.length ? "coding/pindai" : "commit"] });
      } else tambah("bersih", "ok", "Tidak ada perubahan yang belum di-commit");
    }
  }

  // Commit: termasuk commit yang dibuat langsung di branch (agen/programmer) tetapi belum tercatat Studio.
  const dasarRef = await titikDasar(base ?? config.repoDir, item.branch, item);
  const shaBranch = await daftarGit(["log", "--format=%H", `${dasarRef}..${item.branch}`], base ?? config.repoDir);
  const tercatatSha = new Set((item.riwayat_commit ?? []).map((c) => c.sha));
  const belumTercatat = shaBranch.filter((s) => !tercatatSha.has(s));
  if (!item.commit_sha && !shaBranch.length) tambah("commit", "blokir", "Belum ada commit di branch item", `Commit perubahan dulu (formulir "Commit perubahan" di bawah).`, { aksi: ["commit"] });
  else if (belumTercatat.length) {
    tambah("commit", "info", `${belumTercatat.length} commit di branch belum tercatat Studio`,
      "Dibuat langsung di branch (oleh agen atau programmer). Dicatat otomatis saat Terapkan, atau klik Pindai perubahan sekarang.", { aksi: ["coding/pindai"] });
  } else tambah("commit", "ok", `Commit tercatat (${item.commit_sha?.slice(0, 7)})`);

  if (adaTarget) {
    // Migrasi: diurutkan otomatis, kecuali yang sudah pernah dijalankan.
    try {
      const m = await rencanaMigrasiItem(item, target);
      if (m.tercatat.length) tambah("migrasi", "blokir", "Migrasi item tertinggal dan sudah pernah dijalankan", PESAN_MIGRASI_TERCATAT(m.tercatat, target), { berkas: m.tercatat });
      else if (m.peta.length) tambah("migrasi", "info", `${m.peta.length} migrasi item akan diurutkan ulang otomatis saat Terapkan`, m.peta.map((p) => `${p.lama} → ${p.baru}`).join(", "));
      else if (m.milikItem.length) tambah("migrasi", "ok", `${m.milikItem.length} migrasi baru, urutannya sudah paling akhir`);
    } catch (e) {
      tambah("migrasi", "blokir", "Migrasi item tidak dapat diurutkan otomatis", e.message);
    }

    // Konflik dengan branch lokal (simulasi, tidak menyentuh berkas).
    if (!menggabung) {
      const bentrok = await pracekGabung(target, item.branch);
      const manual = bentrok.filter((p) => !dikenal(p));
      if (!bentrok.length) tambah("konflik", "ok", `Tidak ada konflik dengan ${target}`);
      else if (!manual.length) {
        tambah("konflik", "info", `Konflik berpola dikenal di ${bentrok.length} berkas: diselesaikan otomatis saat Terapkan`, "Katalog modul, daftar izin/menu/rute, CHANGELOG, dan dokumen katalog.", { berkas: bentrok });
      } else {
        tambah("konflik", "blokir", `Konflik kode dengan ${target} di ${manual.length} berkas`,
          `Biasanya karena item lain yang sudah diterapkan mengubah berkas yang sama (mis. refactor). Klik "Mulai selesaikan konflik": Studio menggabungkan ${target} ke branch item, ` +
          "pola yang dikenal diselesaikan otomatis, sisanya diberi penanda konflik untuk diselesaikan Anda atau agen. Branch lokal tidak tersentuh sampai Anda Terapkan.",
          { berkas: manual, aksi: base ? ["konflik/mulai"] : [] });
      }
    }

    // Working tree aplikasi (repo utama di branch lokal): perubahan belum di-commit yang ikut diubah item akan ditolak git.
    if ((await branchSekarang().catch(() => null)) === target) {
      const kotorUtama = Object.keys(await statusBerkas(config.repoDir));
      const diubahItem = new Set(await daftarGit(["diff", "--name-only", `${target}...${item.branch}`], config.repoDir));
      const tumpang = kotorUtama.filter((p) => diubahItem.has(p));
      if (tumpang.length) {
        tambah("aplikasi", "blokir", `${tumpang.length} berkas di ${target} belum di-commit dan juga diubah item`,
          `Git menolak menimpanya. Di ${config.repoDir}, commit berkas ini atau simpan sementara (git stash), lalu periksa ulang.`, { berkas: tumpang, folder: config.repoDir });
      } else if (kotorUtama.length) {
        tambah("aplikasi", "info", `${kotorUtama.length} berkas belum di-commit di ${target}`, "Tidak bersinggungan dengan item, jadi tidak menghalangi penerapan.");
      }
    }
  }
  return hasil();
};

const targetKonflik = async (item) => {
  const { nilai } = await bacaSemua();
  return modeLokal(nilai) ? branchLokal(nilai, item) : branchDasar(nilai, item);
};

// Mulai penyelesaian konflik: gabungkan branch lokal ke branch item; pola dikenal diselesaikan otomatis, sisanya
// dibiarkan berpenanda di folder item (tidak dibatalkan) untuk diselesaikan manual atau oleh agen.
export const mulaiSelesaikanKonflik = async (item, oleh) => {
  pastikanBukanProduksi();
  if (!item.branch) throw permintaanSalah("Item belum punya branch");
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Masih ada tugas agen yang berjalan untuk item ini");
  const target = await targetKonflik(item);
  const cwd = await folderItemTerbuka(item);
  if (await sedangMenggabung(cwd)) throw new Galat(409, "Penyelesaian konflik sudah berjalan: selesaikan lalu tutup, atau batalkan dulu");
  const pesanCommit = `chore(studio): gabungkan ${target} ke ${item.branch}\n\nSIMRS Studio ${nomor(item)}`;
  const h = await sinkronkan({ cwd, target, pesanCommit, biarkan: true });
  const auto = h.otomatis?.length ? ` Diselesaikan otomatis: ${h.otomatis.map((o) => `${o.path} (${o.cara})`).join("; ")}.` : "";
  if (h.status === "menunggu") {
    await pesan(item, item.tahap, "sistem",
      `Penyelesaian konflik dimulai: ${target} digabung ke branch item di ${cwd}. ${h.tersisa.length} berkas perlu diselesaikan: ${h.tersisa.join(", ")}.${auto} ` +
      `Selesaikan penanda konflik di VS Code atau klik "Minta agen menyelesaikan", lalu "Tutup penggabungan".`, oleh);
    await audit(oleh, `Memulai penyelesaian konflik dengan ${target}`, item.uuid, { tersisa: h.tersisa, otomatis: h.otomatis });
    return { status: h.status, target, folder: cwd, tersisa: h.tersisa, otomatis: h.otomatis, item };
  }
  const baru = h.status === "digabung" ? await catatCommitStudio(item, h.sha, pesanCommit.split("\n")[0], h.otomatis.map((o) => o.path)) : item;
  const ringkasan = ringkasSinkron(h, target);
  await pesan(item, item.tahap, "sistem", ringkasan, oleh);
  await audit(oleh, `Penyelesaian konflik dengan ${target}: ${h.status}`, item.uuid, { otomatis: h.otomatis, sha: h.sha });
  if (!["digabung", "mutakhir"].includes(h.status)) throw new Galat(409, ringkasan);
  return { status: h.status, target, folder: cwd, tersisa: [], otomatis: h.otomatis, item: baru };
};

// Tutup penggabungan: penanda harus bersih; cek sintaks/katalog/integritas, lalu commit (oleh Studio, bukan agen).
export const tutupSelesaikanKonflik = async (item, oleh) => {
  pastikanBukanProduksi();
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Masih ada tugas agen yang berjalan untuk item ini");
  const target = await targetKonflik(item);
  const cwd = await folderItemTerbuka(item);
  const pesanCommit = `chore(studio): selesaikan konflik ${item.branch} dengan ${target}\n\nSIMRS Studio ${nomor(item)}`;
  const h = await selesaikanGabung({ cwd, pesanCommit });
  let baru = await catatCommitStudio(item, h.sha, pesanCommit.split("\n")[0], h.berkas);
  baru = await ubah("studio_item", item.uuid, { berkas: saringBerkasKotor(baru.berkas, await statusBerkas(cwd)) });
  await pesan(baru, item.tahap, "sistem", `Konflik dengan ${target} selesai dan di-commit (${h.sha.slice(0, 7)}): ${h.berkas.join(", ") || "-"}. Klik Terapkan lagi.`, oleh);
  await audit(oleh, `Menutup penyelesaian konflik dengan ${target}`, item.uuid, { sha: h.sha, berkas: h.berkas });
  return baru;
};

export const batalSelesaikanKonflik = async (item, oleh) => {
  pastikanBukanProduksi();
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Masih ada tugas agen yang berjalan untuk item ini");
  const cwd = await folderItemTerbuka(item);
  await batalGabung({ cwd });
  const baru = await ubah("studio_item", item.uuid, { berkas: saringBerkasKotor(item.berkas, await statusBerkas(cwd)) });
  await pesan(baru, item.tahap, "sistem", "Penyelesaian konflik dibatalkan; branch item kembali seperti sebelum penggabungan.", oleh);
  await audit(oleh, "Membatalkan penyelesaian konflik", item.uuid);
  return baru;
};

// Agen menyunting berkas berpenanda konflik (tanpa perintah git); Studio yang menutup penggabungan.
export const agenSelesaikanKonflik = async (item, oleh) => {
  pastikanBukanProduksi();
  const { nilai } = await bacaSemua();
  if (nilai.fitur?.coding === false) throw new Galat(403, "Fitur Coding belum diaktifkan superadmin (Pengaturan & Agen › Fitur Studio)");
  if (item.risiko === "kritis") throw new Galat(403, "Item berisiko kritis: konflik diselesaikan programmer.");
  if (await tugasBerjalan(item.uuid)) throw new Galat(409, "Masih ada tugas agen yang berjalan untuk item ini");
  const cwd = await folderItemTerbuka(item);
  if (!(await sedangMenggabung(cwd))) throw permintaanSalah('Klik "Mulai selesaikan konflik" dulu');
  const sisa = await penandaTersisa(cwd);
  if (!sisa.length) throw permintaanSalah('Penanda konflik sudah bersih: klik "Tutup penggabungan"');
  await periksaBatas(item, oleh);
  const target = await targetKonflik(item);
  const instruksi =
    `Studio sedang menggabungkan branch ${target} ke branch item ini (git merge sudah dimulai oleh Studio). JANGAN menjalankan perintah git apa pun ` +
    `(merge, add, commit, checkout, stash, reset). Berkas berikut masih berisi penanda konflik — bagian antara <<<<<<< dan ======= adalah versi item ini, ` +
    `bagian antara ======= dan >>>>>>> adalah versi ${target} yang sudah dipakai aplikasi:\n${sisa.map((p) => `- ${p}`).join("\n")}\n\n` +
    `Selesaikan setiap blok dengan menyunting berkasnya dan pertahankan maksud kedua sisi. Perubahan di ${target} adalah kode yang sudah berjalan ` +
    "(mis. refactor bersama); sesuaikan kode item agar mengikuti struktur terbaru itu, jangan mengembalikannya ke versi lama. Hapus semua penanda konflik, " +
    "jalankan node --check pada berkas JS yang disunting dan uji layanan terkait bila ada. Jangan mengubah berkas lain di luar keperluan penyelesaian konflik.";
  const tugas = await buatTugasAgen(item, "coding", "coding", instruksi, oleh);
  await audit(oleh, "Meminta agen menyelesaikan konflik", item.uuid, { berkas: sisa });
  await mulaiAtauTunggu(tugas, item, () => kerjakanCoding(tugas, item, instruksi));
  return tugas;
};

// Berkas masuk layanan yang dijalankan nodemon (scripts.dev "nodemon <berkas>", atau main).
const berkasMasuk = (cwd, layanan) => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, layanan, "package.json"), "utf8"));
    const masuk = pkg.scripts?.dev?.match(/nodemon\s+(\S+)/)?.[1] ?? pkg.main;
    return masuk && /nodemon/.test(pkg.scripts?.dev ?? "") ? path.join(cwd, layanan, masuk) : null;
  } catch {
    return null;
  }
};

// Dependensi setelah penerapan (hanya di working tree aplikasi yang berjalan):
// - package.json/lockfile root atau layanan berubah → npm install di folder itu;
// - packages/* (SDK lokal) berubah → npm run sdk:refresh (SDK dipasang sebagai salinan).
// nodemon tidak mengawasi node_modules, jadi layanan terdampak dimuat ulang dengan menyentuh berkas masuknya.
export const pasangDependensi = async (cwd, berkas) => {
  const paket = [...new Set(berkas.filter((p) => /^([^/]+\/)?package(-lock)?\.json$/.test(p)).map((p) => (p.includes("/") ? p.split("/")[0] : ".")))]
    .filter((d) => d !== "packages" && fs.existsSync(path.join(cwd, d, "package.json")));
  const sdk = berkas.some((p) => p.startsWith("packages/"));
  if (!paket.length && !sdk) return [];
  const hasil = [];
  const dimuat = new Set(paket.filter((d) => d !== "."));
  for (const d of paket) {
    const r = await jalankanPerintah("npm", ["install", "--no-audit", "--no-fund"], { cwd: path.join(cwd, d) });
    hasil.push({ langkah: `npm install di ${d === "." ? "root" : d}`, ok: r.ok, keluaran: r.keluaran });
  }
  if (sdk) {
    const r = await jalankanPerintah("npm", ["run", "sdk:refresh"], { cwd });
    hasil.push({ langkah: "npm run sdk:refresh", ok: r.ok, keluaran: r.keluaran });
    for (const l of fs.readdirSync(cwd).filter((n) => n.endsWith("-service"))) {
      try {
        const deps = JSON.parse(fs.readFileSync(path.join(cwd, l, "package.json"), "utf8")).dependencies ?? {};
        if (Object.keys(deps).some((n) => n.startsWith("@opensimrs/"))) dimuat.add(l);
      } catch {
        /* bukan layanan Node */
      }
    }
  }
  const muatUlang = [];
  const manual = [];
  const waktu = new Date();
  for (const l of dimuat) {
    const masuk = berkasMasuk(cwd, l);
    if (masuk && fs.existsSync(masuk)) {
      fs.utimesSync(masuk, waktu, waktu);
      muatUlang.push(l);
    } else manual.push(l);
  }
  hasil.push({ langkah: "muat ulang layanan", ok: true, muatUlang, manual });
  return hasil;
};

const ringkasDependensi = (hasil) => {
  if (!hasil.length) return "";
  const langkah = hasil.filter((h) => h.langkah !== "muat ulang layanan");
  const gagal = langkah.filter((h) => !h.ok);
  const muat = hasil.find((h) => h.langkah === "muat ulang layanan");
  return ` Dependensi: ${langkah.map((h) => `${h.langkah} ${h.ok ? "✔" : "GAGAL"}`).join(", ")}.` +
    (gagal.length ? ` Jalankan manual: ${gagal.map((h) => h.langkah).join("; ")}\n${gagal.map((h) => h.keluaran.slice(-400)).join("\n")}` : "") +
    (muat?.muatUlang.length ? ` Dimuat ulang: ${muat.muatUlang.join(", ")}.` : "") +
    (muat?.manual.length ? ` Jalankan ulang manual: ${muat.manual.join(", ")}${muat.manual.includes("frontend-service") ? " (frontend: jalankan ulang npm run dev bila halaman galat)" : ""}.` : "");
};

const jalankanMigrasi = async (cwd, item, oleh) => {
  const r = await jalankanPerintah("npm", ["run", "db:migrate"], { cwd, timeoutMs: 10 * 60 * 1000 });
  await pesan(item, item.tahap, "sistem", r.ok ? "Migrasi database dijalankan (npm run db:migrate)." : `Migrasi database GAGAL — jalankan manual: npm run db:migrate\n${r.keluaran.slice(-500)}`, oleh);
  return r.ok;
};

// Faskes tujuan aktivasi: faskes yang sedang dipakai penerap (bawaan) atau semua faskes.
const faskesAktivasi = (nilai, faskesUuid) => (nilai.aktivasi_faskes === "semua" ? "semua" : [faskesUuid].filter(Boolean));
// Titik awal item: induk commit pertamanya (pembanding katalog sebelum item dikerjakan).
const awalItem = (item) => (item.riwayat_commit?.[0]?.sha ? `${item.riwayat_commit[0].sha}^1` : null);

const ringkasAktivasi = (a) => {
  if (!a) return "";
  const nama = [...a.modul.map((m) => `modul ${m.nama}`), ...a.fitur.map((f) => `fitur ${f.nama}`)].join(", ");
  const dinyalakan = new Set(a.override.map((o) => o.faskes)).size;
  const izin = a.izin.length;
  const lewati = a.lewati.length ? ` Dilewati: ${a.lewati.map((l) => `${l.kode} (${l.alasan})`).join("; ")}.` : "";
  return ` Aktivasi: ${nama || "-"} ${dinyalakan ? `dinyalakan di ${dinyalakan} faskes` : "sudah aktif bawaan segmen"}` +
    `${izin ? `; izin modul diberikan ke ${izin} peran/pengguna` : ""}. Menu diperbarui tanpa login ulang.${lewati}`;
};

// Aplikasi pengembang = layanan yang dijalankan npm run dev dari repo utama; perubahan hanya terlihat bila repo utama
// berada di branch lokal tujuan penerapan.
export const statusAplikasi = async (target = null) => {
  const { nilai } = await bacaSemua();
  const tujuan = target ?? (await branchLokal(nilai));
  const branch = await branchSekarang().catch(() => null);
  return { branch, branchLokal: tujuan, sama: branch === tujuan, lingkungan: config.lingkungan };
};

// Pindahkan repo utama (aplikasi pengembang) ke branch lokal. Perubahan yang belum di-commit ikut terbawa bila tidak bentrok.
export const pindahkanAplikasi = async (oleh) => {
  pastikanBukanProduksi();
  const s = await statusAplikasi();
  if (s.sama) return s;
  if (/\/STD-\d+/.test(s.branchLokal)) throw permintaanSalah("Branch lokal tidak boleh branch item");
  if (!(await git(["rev-parse", "--verify", "--quiet", `refs/heads/${s.branchLokal}`], { izinkanGagal: true })).ok) throw permintaanSalah(`Branch lokal ${s.branchLokal} tidak ditemukan`);
  // Hanya tugas yang bekerja di repo utama yang menghalangi; agen di worktree item tidak terpengaruh perpindahan ini.
  const diRepoUtama = await satu(
    `SELECT i.nomor FROM studio_tugas t LEFT JOIN studio_item i ON i.uuid = t.item_uuid
      WHERE t.status IN ('antri', 'jalan', 'tunda_kuota') AND i.worktree IS NULL LIMIT 1`,
  );
  if (diRepoUtama) throw new Galat(409, `Masih ada tugas agen yang berjalan/menunggu kuota di repo utama${diRepoUtama.nomor ? ` (STD-${String(diRepoUtama.nomor).padStart(4, "0")})` : ""}`);
  // Branch yang sedang terbuka di worktree lain tidak bisa dibuka di repo utama.
  const { keluaran: daftar } = await git(["worktree", "list", "--porcelain"], { izinkanGagal: true });
  const lain = daftar.split(/\n\n+/).slice(1).find((b) => b.includes(`branch refs/heads/${s.branchLokal}`))?.match(/^worktree (.+)$/m)?.[1];
  if (lain) throw new Galat(409, `Branch ${s.branchLokal} sedang terbuka di worktree ${lain}. Tutup dulu worktree itu (git worktree remove "${lain}"), lalu ulangi.`);
  try {
    await git(["switch", s.branchLokal]);
  } catch (e) {
    throw new Galat(409, `Gagal berpindah ke branch ${s.branchLokal}: ${e.message.replace(/\.$/, "")}. Commit/stash perubahan yang bentrok dulu.`);
  }
  await audit(oleh, `Memindahkan aplikasi pengembang ke branch ${s.branchLokal}`, null, { dari: s.branch });
  return statusAplikasi();
};

// Galat Terapkan juga dicatat di diskusi item (bukan hanya toast) agar penyebabnya bisa dibaca ulang.
export const terapkanLokal = async (item, oleh, faskesUuid = null) => {
  try {
    return await terapkanLokalInti(item, oleh, faskesUuid);
  } catch (e) {
    await pesan(item, item.tahap, "sistem", `Terapkan gagal: ${e.message}\nLangkah perbaikannya ada di panel "Kesiapan penerapan" (tab Rilis).`, oleh).catch(() => {});
    throw e;
  }
};

const terapkanLokalInti = async (item, oleh, faskesUuid) => {
  pastikanBukanProduksi();
  if (!["rilis", "selesai"].includes(item.tahap)) throw permintaanSalah("Penerapan lokal dilakukan pada tahap rilis");
  // Commit yang dibuat agen/programmer langsung di branch item (di luar tombol Commit) dicatat dulu.
  if (!item.commit_sha && item.branch) item = await pindaiManual(item, oleh).catch(() => item);
  if (!item.commit_sha) throw permintaanSalah("Belum ada commit di branch item: commit perubahan dulu sebelum diterapkan");
  const base = direktoriKerja(item);
  if (fs.existsSync(base) && (await sedangMenggabung(base))) {
    throw new Galat(409, "Penyelesaian konflik di branch item belum ditutup: selesaikan penanda konflik lalu klik Tutup penggabungan (atau batalkan).");
  }
  const status = await statusBerkas(base);
  if ((item.berkas ?? []).some((b) => b.path in status)) throw permintaanSalah("Masih ada perubahan item yang belum di-commit");
  const { nilai } = await bacaSemua();
  const target = await branchLokal(nilai, item);
  if (target === item.branch) throw permintaanSalah("Branch lokal sama dengan branch item — atur Branch lokal di Pengaturan & Agen");
  if (!(await git(["rev-parse", "--verify", "--quiet", `refs/heads/${target}`], { izinkanGagal: true })).ok) throw permintaanSalah(`Branch lokal ${target} tidak ditemukan`);
  // Migrasi item yang tertinggal dari target diurutkan dulu (ganti nama + commit di branch item).
  const urut = await urutkanMigrasiItem(item, target, oleh);
  item = urut.item;
  let bentrok = await pracekGabung(target, item.branch);
  let catatanSinkron = "";
  if (bentrok.length) {
    // Konflik berpola dikenal (katalog, daftar sisipan, CHANGELOG, dokumen katalog) → sinkronkan branch item dulu.
    const sinkron = await sinkronkanItem(item, oleh, { target }).catch((e) => {
      throw new Galat(409, `Penerapan dibatalkan sebelum menyentuh ${target}: branch item bentrok dengan ${target} pada ${bentrok.join(", ")}. ` +
        `Sinkronisasi otomatis tidak berhasil — ${e.message} Selesaikan konfliknya di worktree item (atau minta agen merevisi), lalu terapkan lagi.`);
    });
    item = sinkron.item;
    catatanSinkron = ` ${sinkron.ringkasan}`;
    bentrok = await pracekGabung(target, item.branch);
    if (bentrok.length) {
      throw new Galat(409, `Penerapan dibatalkan sebelum menyentuh ${target}: setelah sinkronisasi branch item masih bentrok dengan ${target} pada ${bentrok.join(", ")}.`);
    }
  }
  const adaMigrasi = (item.riwayat_commit ?? []).some((c) => (c.berkas ?? []).some((p) => p.startsWith("database/migrations/")));
  let migrasi = null;
  let aktivasi = item.sha_batal ? null : item.aktivasi ?? null;
  let catatanAktivasi = "";
  let catatanDependensi = "";
  const sha = await diBranchTarget(item, target, async (cwd, utama) => {
    const hasil = await gabung(cwd, ["merge", "--no-ff", "-m", `Terapkan SIMRS Studio ${nomor(item)}: ${item.judul}`, item.branch], "Penerapan");
    const { keluaran: diubah } = await git(["diff", "--name-only", `${hasil}^1`, hasil], { cwd, izinkanGagal: true });
    const berkasDiubah = diubah.split("\n").filter(Boolean);
    if (utama) catatanDependensi = ringkasDependensi(await pasangDependensi(cwd, berkasDiubah));
    else if (berkasDiubah.some((p) => p.startsWith("packages/") || /package(-lock)?\.json$/.test(p))) {
      catatanDependensi = " Ada perubahan dependensi/SDK: jalankan npm install di layanan terkait dan npm run sdk:refresh setelah aplikasi memakai branch itu.";
    }
    if (adaMigrasi && nilai.migrasi_otomatis) migrasi = utama ? await jalankanMigrasi(cwd, item, oleh) : false;
    if (nilai.aktivasi_otomatis && migrasi !== false) {
      if (config.lingkungan !== "development") {
        catatanAktivasi = " Modul/fitur baru belum dinyalakan (bukan lingkungan development): klik Aktifkan di aplikasi.";
      } else {
        try {
          aktivasi = await aktifkan({ sha: hasil, dari: awalItem(item), cwd, faskes: faskesAktivasi(nilai, faskesUuid), oleh, alasan: `SIMRS Studio ${nomor(item)}: ${item.judul}`, sebelumnya: aktivasi });
          catatanAktivasi = ringkasAktivasi(aktivasi);
        } catch (e) {
          catatanAktivasi = ` Aktivasi modul GAGAL (${e.message.replace(/\.$/, "")}): nyalakan manual di Setting › Manajemen Modul.`;
        }
      }
    }
    return hasil;
  });
  const aplikasi = await statusAplikasi(target);
  await audit(oleh, `Menerapkan ke branch lokal ${target}`, item.uuid, { sha, aktivasi: aktivasi ? { modul: aktivasi.modul.map((m) => m.kode), fitur: aktivasi.fitur.map((f) => f.kode) } : null });
  await pesan(
    item, item.tahap, "sistem",
    `Diterapkan ke branch lokal ${target} (${sha.slice(0, 7)}).` +
      (adaMigrasi && migrasi === false && nilai.migrasi_otomatis ? " Ada migrasi baru: jalankan npm run db:migrate setelah aplikasi memakai branch itu." : "") +
      (urut.peta.length ? ` Migrasi diurutkan ulang: ${urut.peta.map((p) => `${p.lama} → ${p.baru}`).join(", ")}.` : "") +
      catatanSinkron +
      catatanDependensi +
      catatanAktivasi +
      (aplikasi.sama
        ? " Aplikasi pengembang memakai branch ini: frontend & layanan (nodemon) memuat ulang otomatis."
        : ` Aplikasi pengembang masih di branch ${aplikasi.branch}: klik "Pindahkan aplikasi ke ${target}" agar perubahan terlihat.`),
    oleh,
  );
  return ubah("studio_item", item.uuid, { branch_lokal: target, sha_lokal: sha, diterapkan_pada: sekarang(), sha_batal: null, aktivasi });
};

// Aktifkan manual (lingkungan staging, atau aktivasi otomatis dimatikan / gagal).
export const aktifkanItem = async (item, oleh, faskesUuid = null) => {
  pastikanBukanProduksi();
  if (!item.sha_lokal || item.sha_batal) throw permintaanSalah("Item belum diterapkan ke lokal");
  const { nilai } = await bacaSemua();
  // Definisi izin dibaca dari working tree yang sedang berada di branch lokal (repo utama atau worktree lain).
  let cwd = config.repoDir;
  if ((await branchSekarang().catch(() => null)) !== item.branch_lokal) {
    const { keluaran: daftar } = await git(["worktree", "list", "--porcelain"], { izinkanGagal: true });
    cwd = daftar.split(/\n\n+/).find((b) => b.includes(`branch refs/heads/${item.branch_lokal}`))?.match(/^worktree (.+)$/m)?.[1] ?? cwd;
  }
  // Migrasi yang tertunda (penerapan saat aplikasi di branch lain) atau gagal dijalankan dulu: tanpa migrasi katalog,
  // modul baru masih "Segera" dan aktivasi hanya melewatinya. Migrasi wajib idempoten, jadi aman diulang.
  if (nilai.migrasi_otomatis && !(await jalankanMigrasi(cwd, item, oleh))) {
    throw new Galat(409, "Migrasi database gagal, jadi modul belum diaktifkan. Baca penyebabnya di diskusi item, perbaiki migrasi/katalognya, lalu klik Aktifkan lagi.");
  }
  const aktivasi = await aktifkan({ sha: item.sha_lokal, dari: awalItem(item), cwd, faskes: faskesAktivasi(nilai, faskesUuid), oleh, alasan: `SIMRS Studio ${nomor(item)}: ${item.judul}`, sebelumnya: item.aktivasi });
  await audit(oleh, "Mengaktifkan modul/fitur hasil penerapan", item.uuid, { modul: aktivasi?.modul.map((m) => m.kode), fitur: aktivasi?.fitur.map((f) => f.kode) });
  await pesan(item, item.tahap, "sistem", aktivasi ? ringkasAktivasi(aktivasi).trim() : "Tidak ada modul/fitur baru di katalog untuk dinyalakan.", oleh);
  return ubah("studio_item", item.uuid, { aktivasi });
};

export const batalkanPenerapan = async (item, alasan, oleh) => {
  pastikanBukanProduksi();
  if (!item.sha_lokal || item.sha_batal) throw permintaanSalah("Item belum diterapkan ke lokal");
  if (!alasan?.trim()) throw permintaanSalah("Alasan wajib diisi");
  const sha = await diBranchTarget(item, item.branch_lokal, (cwd) =>
    gabung(cwd, ["revert", "-m", "1", "--no-edit", item.sha_lokal], "Pembatalan penerapan"),
  );
  let catatan = "";
  if (item.aktivasi) {
    try {
      await nonaktifkan(item.aktivasi, { oleh, alasan: `Batal SIMRS Studio ${nomor(item)}: ${alasan}` });
      catatan = " Modul/fitur dan izin yang dinyalakan saat penerapan dikembalikan.";
    } catch (e) {
      catatan = ` Aktivasi modul GAGAL dibalik (${e.message.replace(/\.$/, "")}): matikan manual di Setting › Manajemen Modul.`;
    }
  }
  await audit(oleh, `Membatalkan penerapan di ${item.branch_lokal}`, item.uuid, { alasan, sha });
  await pesan(item, item.tahap, "sistem", `Penerapan dibatalkan (revert ${sha.slice(0, 7)} di ${item.branch_lokal}): ${alasan}. Migrasi database TIDAK dibalik otomatis.${catatan}`, oleh);
  return ubah("studio_item", item.uuid, { sha_batal: sha, diterapkan_pada: null, aktivasi: null });
};

// Izin aksi kerja per tahap (diskusi, AI tulis ulang, sunting).
export const pastikanIzinKerja = (req, item) => {
  const izin = IZIN_KERJA_TAHAP[item.tahap];
  return izin ? pastikan(req, izin[0], izin[1]) : Promise.resolve();
};
