import express from "express";
import fs from "fs";
import path from "path";
import config from "./config.js";
import { isSuperadmin, wajibLogin } from "./auth.js";
import { audit, query, satu, sekarang, sisipkan, ubah } from "./db.js";
import { Galat, kirim, permintaanSalah, tangani, tidakDitemukan } from "./respons.js";
import { BAWAAN, bacaSemua, simpan, untukTampilan } from "./pengaturan.js";
import { enkripsi, samarkan } from "./rahasia.js";
import { branchSekarang, git, urlRepo } from "./git.js";
import { branchLokal, diDalamRepo } from "./kerja.js";
import { batalkanProses, jalankanClaude, versiClaude } from "./agen/claude.js";
import { jalankanApi } from "./agen/api.js";
import { ATURAN_PLATFORM } from "./agen/prompt.js";
import { ambilKonektor } from "./agen/index.js";
import * as akunClaude from "./agen/akun.js";
import * as codex from "./agen/codex.js";
import { cocokModel, pesanTidakCocok } from "./agen/model.js";
import { pastikan, punyaAksesStudio, ringkasIzin } from "./izin.js";
import { PERAN } from "./gerbang.js";
import * as gitremote from "./gitremote.js";
import * as alur from "./alur.js";
import * as ekstensi from "./ekstensi.js";
import * as deploy from "./deploy.js";

// /api/v3/studio/...
// Lapis aktivasi (rancangan §4): L1 .env STUDIO_PENGEMBANG=aktif → L3 Mode Pengembang (Setting › System, superadmin)
// → L5 izin modul "SIMRS Studio" per peran → L4 fitur → L6 kill switch.
const rute = express.Router();
rute.get("/health", (req, res) => res.json({ message: "OK" }));
rute.use(wajibLogin);

const wajibSuperadmin = (req) => {
  if (!isSuperadmin(req)) throw new Galat(403, "Hanya superadmin");
};
const token = (req) => req.headers.authorization ?? "";

// Status untuk menu & Setting › System.
rute.get("/status", tangani(async (req, res) => {
  const { nilai, meta } = await bacaSemua();
  const superadmin = isSuperadmin(req);
  const modeAktif = config.aktifInstalasi && Boolean(nilai.mode_pengembang?.aktif);
  const akses = modeAktif && (await punyaAksesStudio(req));
  kirim(res, {
    tersedia: config.aktifInstalasi,
    modeAktif: superadmin ? modeAktif : undefined,
    aktif: akses,
    superadmin,
    beku: Boolean(nilai.kill_switch?.aktif),
    lingkungan: config.lingkungan,
    izin: akses ? await ringkasIzin(req) : {},
    fitur: akses ? nilai.fitur : {},
    diubahOleh: superadmin ? meta.mode_pengembang?.diubahOleh ?? null : null,
    diubahPada: superadmin ? meta.mode_pengembang?.diubahPada ?? null : null,
  });
}));

rute.use((req, res, next) =>
  config.aktifInstalasi ? next() : res.status(503).json({ message: "SIMRS Studio belum diaktifkan di instalasi ini (STUDIO_PENGEMBANG=aktif di studio-service/.env)" }),
);

const hentikanSemuaTugas = async () => {
  const berjalan = await query(`SELECT uuid FROM studio_tugas WHERE status IN ('antri', 'jalan')`);
  for (const t of berjalan) batalkanProses(t.uuid);
  await query(`UPDATE studio_tugas SET status = 'dibatalkan', selesai = $1, updated_at = $1 WHERE status IN ('antri', 'jalan')`, [sekarang()]);
  return berjalan.length;
};

rute.put("/status", tangani(async (req, res) => {
  wajibSuperadmin(req);
  const aktif = Boolean(req.body?.aktif);
  await simpan("mode_pengembang", { aktif }, req.author.username);
  if (!aktif) await hentikanSemuaTugas();
  await audit(req.author.username, aktif ? "Mengaktifkan Mode Pengembang" : "Menonaktifkan Mode Pengembang");
  kirim(res, { aktif }, aktif ? "Mode Pengembang diaktifkan" : "Mode Pengembang dinonaktifkan");
}));

// Mode Pengembang aktif & pengguna punya akses Studio.
rute.use((req, res, next) =>
  bacaSemua()
    .then(async ({ nilai }) => {
      if (!nilai.mode_pengembang?.aktif) return res.status(403).json({ message: "Mode Pengembang belum diaktifkan (Setting › System)" });
      if (!(await punyaAksesStudio(req))) return res.status(403).json({ message: "Anda tidak memiliki hak akses SIMRS Studio" });
      req.studio = nilai;
      next();
    })
    .catch(next),
);

// L6 kill switch: Studio beku (hanya-baca) kecuali superadmin mengelola pengaturan.
rute.use((req, res, next) => {
  if (req.method === "GET" || !req.studio.kill_switch?.aktif) return next();
  if (isSuperadmin(req) && req.path.startsWith("/pengaturan")) return next();
  res.status(423).json({ message: `SIMRS Studio sedang dihentikan oleh superadmin${req.studio.kill_switch.alasan ? `: ${req.studio.kill_switch.alasan}` : ""}` });
});

// Membaca item: salah satu hak baca submodul Studio.
const bolehBaca = async (req) => {
  for (const [sub, aksi] of [["Permintaan", ["READ", "CREATE", "UPDATE"]], ["PRD", ["READ"]], ["Review Klinis", ["READ"]], ["Desain", ["READ"]], ["Coding", ["READ", "REVIEW"]], ["QA", ["READ"]], ["Rilis", ["READ"]], ["Audit", ["READ"]]]) {
    if (await pastikan(req, sub, aksi).then(() => true, () => false)) return;
  }
  throw new Galat(403, "Anda tidak memiliki hak membaca item SIMRS Studio");
};

// ---------- Item ----------

rute.get("/item", tangani(async (req, res) => {
  await bolehBaca(req);
  const tahap = req.query.tahap;
  const rows = await query(
    `SELECT i.uuid, i.nomor, i.judul, i.jenis, i.tahap, i.risiko, i.prioritas, i.branch, i.commit_sha, i.pr_url, i.pr_status, i.ci_status,
            i.tag_rilis, i.modul_terdampak, i.dibuat_oleh, i.created_at, i.updated_at, jsonb_array_length(i.berkas) AS jumlah_berkas,
            (SELECT status FROM studio_tugas t WHERE t.item_uuid = i.uuid ORDER BY t.id DESC LIMIT 1) AS status_tugas,
            (SELECT COALESCE(SUM(biaya_usd), 0) FROM studio_tugas t WHERE t.item_uuid = i.uuid) AS biaya_usd
       FROM studio_item i
      WHERE i.deleted_at IS NULL AND ($1::text IS NULL OR i.tahap = $1)
      ORDER BY i.updated_at DESC`,
    [tahap || null],
  );
  kirim(res, rows);
}));

rute.post("/item", tangani(async (req, res) => {
  await pastikan(req, "Permintaan", "CREATE");
  const { judul, jenis, prioritas, masalah, siapa, harapan, contoh, modul_terdampak } = req.body ?? {};
  const item = await alur.buatItem({ judul, jenis, prioritas, permintaan: { masalah, siapa, harapan, contoh }, modul_terdampak }, req.author);
  kirim(res, item, "Permintaan dikirim; AI sedang merangkum");
}));

const item = (req) => alur.ambilItem(req.params.uuid);

rute.get("/item/:uuid", tangani(async (req, res) => {
  await bolehBaca(req);
  kirim(res, await alur.detailItem(req.params.uuid, req));
}));

rute.put("/item/:uuid", tangani(async (req, res) => {
  await pastikan(req, "Permintaan", "TRIASE");
  kirim(res, await alur.ubahItem(await item(req), req.body ?? {}, req.author.username), "Item diperbarui");
}));

rute.post("/item/:uuid/risiko", tangani(async (req, res) => {
  await pastikan(req, "PRD", "TETAPKAN RISIKO");
  kirim(res, await alur.tetapkanRisiko(await item(req), req.body ?? {}, req.author.username, isSuperadmin(req)), "Risiko ditetapkan");
}));

rute.get("/item/:uuid/perubahan", tangani(async (req, res) => {
  await bolehBaca(req);
  kirim(res, await alur.perubahanItem(await item(req)));
}));

rute.get("/item/:uuid/prompt", tangani(async (req, res) => {
  await bolehBaca(req);
  const it = await item(req);
  const tahap = alur.TAHAP.includes(req.query.tahap) ? req.query.tahap : alur.TAHAP.includes(it.tahap) ? it.tahap : "permintaan";
  kirim(res, { tahap, aturanPlatform: ATURAN_PLATFORM, prompt: await alur.pratinjauPrompt(it, tahap) });
}));

rute.post("/item/:uuid/pesan", tangani(async (req, res) => {
  const it = await item(req);
  await alur.pastikanIzinKerja(req, it);
  kirim(res, await alur.kirimPesan(it, req.body?.isi, req.author.username), "Pesan dikirim; agen sedang bekerja");
}));

rute.post("/item/:uuid/artefak", tangani(async (req, res) => {
  const it = await item(req);
  await alur.pastikanIzinKerja(req, it);
  kirim(res, await alur.suntingArtefak(it, req.body?.isi, req.author.username), "Dokumen disimpan sebagai versi baru");
}));

rute.post("/item/:uuid/agen", tangani(async (req, res) => {
  const it = await item(req);
  await alur.pastikanIzinKerja(req, it);
  const tugas = it.tahap === "coding"
    ? await alur.jalankanCoding(it, req.body?.instruksi ?? null, req.author.username)
    : await alur.jalankanDokumen(it, it.tahap, req.body?.instruksi ?? null, req.author.username);
  kirim(res, tugas, "Agen mulai bekerja");
}));

rute.post("/item/:uuid/keputusan", tangani(async (req, res) => {
  kirim(res, await alur.putuskan(await item(req), req.body ?? {}, req), "Keputusan disimpan");
}));

rute.post("/item/:uuid/cek", tangani(async (req, res) => {
  if (!(await pastikan(req, "QA", ["JALANKAN UJI", "UPDATE"]).then(() => true, () => false))) await pastikan(req, "Coding", "JALANKAN AGEN");
  kirim(res, await alur.jalankanCek(await item(req), req.author.username), "Cek otomatis berjalan");
}));

rute.put("/item/:uuid/uji/:ujiUuid", tangani(async (req, res) => {
  await pastikan(req, "QA", ["UPDATE", "LULUS"]);
  kirim(res, await alur.ubahUji(await item(req), req.params.ujiUuid, req.body ?? {}, req.author.username), "Hasil uji disimpan");
}));

rute.post("/item/:uuid/lampiran", express.json({ limit: "8mb" }), tangani(async (req, res) => {
  await pastikan(req, "Permintaan", ["CREATE", "UPDATE"]);
  const l = await alur.tambahLampiran(await item(req), req.body ?? {}, req.author.username);
  kirim(res, { uuid: l.uuid, nama: l.nama }, "Lampiran ditambahkan");
}));
rute.get("/item/:uuid/lampiran/:lampiranUuid", tangani(async (req, res) => {
  await bolehBaca(req);
  const l = await alur.bacaLampiran(await item(req), req.params.lampiranUuid);
  res.setHeader("Content-Type", l.mime || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${l.nama}"`);
  res.send(l.isi);
}));
rute.delete("/item/:uuid/lampiran/:lampiranUuid", tangani(async (req, res) => {
  await pastikan(req, "Permintaan", ["CREATE", "UPDATE"]);
  await alur.hapusLampiran(await item(req), req.params.lampiranUuid, req.author.username);
  kirim(res, null, "Lampiran dihapus");
}));

const bolehCodingManual = async (req) => {
  if (!(await pastikan(req, "Coding", "JALANKAN AGEN").then(() => true, () => false))) await pastikan(req, "Coding", "REVIEW");
};
rute.post("/item/:uuid/coding/siapkan", tangani(async (req, res) => {
  await bolehCodingManual(req);
  kirim(res, await alur.siapkanManual(await item(req), req.author.username), "Branch kerja siap");
}));
rute.post("/item/:uuid/coding/pindai", tangani(async (req, res) => {
  await bolehCodingManual(req);
  kirim(res, await alur.pindaiManual(await item(req), req.author.username), "Perubahan manual dipindai");
}));
rute.post("/item/:uuid/commit", tangani(async (req, res) => {
  await pastikan(req, "Coding", "BUKA PR");
  kirim(res, await alur.commitItem(await item(req), req.body?.pesan, req.author.username), "Perubahan di-commit");
}));
rute.post("/item/:uuid/push", tangani(async (req, res) => {
  await pastikan(req, "Coding", "BUKA PR");
  kirim(res, await alur.pushItem(await item(req), req.author.username), "Branch di-push");
}));
rute.post("/item/:uuid/terapkan", tangani(async (req, res) => {
  await pastikan(req, "Rilis", "SIAPKAN");
  kirim(res, await alur.terapkanLokal(await item(req), req.author.username, req.author.faskesUuid), "Diterapkan ke branch lokal");
}));
rute.post("/item/:uuid/aktifkan", tangani(async (req, res) => {
  await pastikan(req, "Rilis", "SIAPKAN");
  kirim(res, await alur.aktifkanItem(await item(req), req.author.username, req.author.faskesUuid), "Modul/fitur diaktifkan");
}));
rute.post("/item/:uuid/batal-terapkan", tangani(async (req, res) => {
  await pastikan(req, "Rilis", "SIAPKAN");
  kirim(res, await alur.batalkanPenerapan(await item(req), req.body?.alasan, req.author.username), "Penerapan dibatalkan");
}));
rute.post("/item/:uuid/status-rilis", tangani(async (req, res) => {
  await bolehBaca(req);
  kirim(res, await alur.perbaruiStatusRilis(await item(req), req.author.username), "Status rilis diperbarui");
}));
rute.post("/item/:uuid/revisi-review", tangani(async (req, res) => {
  await pastikan(req, "Coding", "JALANKAN AGEN");
  kirim(res, await alur.revisiDariReview(await item(req), req.author.username), "Komentar review dikirim ke agen coding");
}));
rute.post("/item/:uuid/buka-branch", tangani(async (req, res) => {
  await pastikan(req, "Coding", ["JALANKAN AGEN", "REVIEW"]);
  kirim(res, await alur.bukaBranch(await item(req), req.author.username), "Berpindah ke branch item");
}));
rute.post("/item/:uuid/kembali-branch", tangani(async (req, res) => {
  await pastikan(req, "Coding", ["BUKA PR", "JALANKAN AGEN"]);
  kirim(res, await alur.kembaliBranch(await item(req), req.author.username), "Selesai: kembali dari branch item");
}));
rute.post("/item/:uuid/tunda", tangani(async (req, res) => {
  await pastikan(req, "Permintaan", ["BATAL", "TRIASE"]);
  kirim(res, await alur.tundaItem(await item(req), req.body?.alasan, req.author.username), "Item ditunda");
}));
rute.post("/item/:uuid/lanjutkan", tangani(async (req, res) => {
  await pastikan(req, "Permintaan", ["BATAL", "TRIASE"]);
  kirim(res, await alur.lanjutkanItem(await item(req), req.author.username), "Item dilanjutkan");
}));
rute.post("/item/:uuid/batal", tangani(async (req, res) => {
  await pastikan(req, "Permintaan", "BATAL");
  kirim(res, await alur.batalkanItem(await item(req), req.body?.alasan, req.author.username), "Item dibatalkan");
}));
rute.post("/item/:uuid/buka-kembali", tangani(async (req, res) => {
  wajibSuperadmin(req);
  kirim(res, await alur.bukaKembali(await item(req), req.body ?? {}, req.author.username), "Item dibuka kembali");
}));

// ---------- Tugas ----------

rute.get("/tugas/:uuid/log", tangani(async (req, res) => {
  const tugas = await satu(`SELECT uuid, status, jenis, tahap, pesan_galat, biaya_usd, kuota, mulai, selesai, hasil FROM studio_tugas WHERE uuid = $1`, [req.params.uuid]);
  if (!tugas) throw tidakDitemukan("Tugas");
  const log = await query(`SELECT id, jenis, teks, waktu FROM studio_tugas_log WHERE tugas_uuid = $1 AND id > $2 ORDER BY id LIMIT 500`, [req.params.uuid, Number(req.query.sejak) || 0]);
  if (tugas.jenis !== "cek" && tugas.tahap !== "ekstensi") delete tugas.hasil;
  kirim(res, { tugas, log });
}));

rute.post("/tugas/:uuid/batal", tangani(async (req, res) => {
  const tugas = await satu(`SELECT * FROM studio_tugas WHERE uuid = $1`, [req.params.uuid]);
  if (!tugas) throw tidakDitemukan("Tugas");
  if (tugas.dibuat_oleh !== req.author.username) await pastikan(req, "Coding", "JALANKAN AGEN");
  if (!["antri", "jalan"].includes(tugas.status)) throw permintaanSalah("Tugas sudah tidak berjalan");
  await query(`UPDATE studio_tugas SET status = 'dibatalkan', selesai = $2, updated_at = $2 WHERE uuid = $1`, [tugas.uuid, sekarang()]);
  batalkanProses(tugas.uuid);
  await audit(req.author.username, "Menghentikan tugas agen", tugas.item_uuid);
  kirim(res, null, "Tugas dihentikan");
}));

// ---------- Ekstensi tanpa kode ----------

rute.get("/ekstensi", tangani(async (req, res) => {
  await pastikan(req, "Ekstensi", "READ");
  kirim(res, await ekstensi.daftar());
}));
rute.post("/ekstensi/rakit", tangani(async (req, res) => {
  await pastikan(req, "Ekstensi", "CREATE");
  kirim(res, await ekstensi.rakitDenganAgen(req.body ?? {}, token(req), req.author.username), "Agen sedang merakit ekstensi");
}));
rute.post("/ekstensi", tangani(async (req, res) => {
  await pastikan(req, "Ekstensi", "CREATE");
  kirim(res, await ekstensi.simpanManual(req.body?.ekstensi, token(req), req.author.username), "Ekstensi disimpan sebagai draf");
}));
rute.post("/ekstensi/:uuid/pratinjau", tangani(async (req, res) => {
  await pastikan(req, "Ekstensi", ["READ", "CREATE"]);
  kirim(res, await ekstensi.pratinjau(req.params.uuid, req.body?.parameter, token(req)));
}));
rute.post("/ekstensi/:uuid/pasang", tangani(async (req, res) => {
  await pastikan(req, "Ekstensi", "PASANG");
  kirim(res, await ekstensi.pasang(req.params.uuid, req.body?.faskes, token(req), req.author.username), "Ekstensi dipasang");
}));
rute.post("/ekstensi/:uuid/copot", tangani(async (req, res) => {
  await pastikan(req, "Ekstensi", "COPOT");
  kirim(res, await ekstensi.copot(req.params.uuid, token(req), req.author.username), "Ekstensi dicopot");
}));
rute.delete("/ekstensi/:uuid", tangani(async (req, res) => {
  await pastikan(req, "Ekstensi", "COPOT");
  await ekstensi.hapus(req.params.uuid, req.author.username);
  kirim(res, null, "Ekstensi dihapus");
}));
rute.get("/ekstensi/:uuid/paket", tangani(async (req, res) => {
  await pastikan(req, "Ekstensi", "PASANG");
  kirim(res, await ekstensi.eksporPaket(req.params.uuid, req.author.username), "Paket ekstensi ditandatangani");
}));

// ---------- Server tujuan & deploy tanpa GitHub (SSH / git bundle) ----------

const bolehDeploy = async (req) => {
  if (!isSuperadmin(req)) await pastikan(req, "Rilis", "DEPLOY");
};
const KOLOM_SERVER = ["nama", "jenis", "host", "port", "pengguna", "repo_dir", "repo_bare", "branch", "perintah_deploy", "aktif"];

rute.get("/server", tangani(async (req, res) => {
  await bolehDeploy(req);
  kirim(res, (await query(`SELECT * FROM studio_server WHERE deleted_at IS NULL ORDER BY created_at`)).map(deploy.tampilServer));
}));
rute.post("/server", tangani(async (req, res) => {
  wajibSuperadmin(req);
  const b = req.body ?? {};
  deploy.validasiServer(b);
  const data = Object.fromEntries(KOLOM_SERVER.filter((k) => b[k] !== undefined && b[k] !== "").map((k) => [k, k === "port" ? Number(b[k]) : b[k]]));
  const s = await sisipkan("studio_server", { ...data, dibuat_oleh: req.author.username, updated_at: sekarang() });
  await audit(req.author.username, `Menambah server ${s.nama} (${s.host})`);
  kirim(res, deploy.tampilServer(s), "Server ditambahkan");
}));
rute.put("/server/:uuid", tangani(async (req, res) => {
  wajibSuperadmin(req);
  const lama = await deploy.ambilServer(req.params.uuid);
  const b = { ...lama, ...req.body };
  deploy.validasiServer(b);
  const gantiHost = b.host !== lama.host || Number(b.port) !== Number(lama.port);
  const s = await ubah("studio_server", lama.uuid, {
    ...Object.fromEntries(KOLOM_SERVER.map((k) => [k, k === "port" ? Number(b[k]) : b[k] === "" ? null : b[k]])),
    ...(gantiHost ? { sidik_host: null } : {}),
  });
  await audit(req.author.username, `Mengubah server ${s.nama}`);
  kirim(res, deploy.tampilServer(s), "Server diperbarui");
}));
rute.delete("/server/:uuid", tangani(async (req, res) => {
  wajibSuperadmin(req);
  const s = await deploy.ambilServer(req.params.uuid);
  await query(`UPDATE studio_server SET deleted_at = $2, aktif = false, kunci_privat = NULL WHERE uuid = $1`, [s.uuid, sekarang()]);
  await audit(req.author.username, `Menghapus server ${s.nama}`);
  kirim(res, null, "Server dihapus");
}));
rute.post("/server/:uuid/kunci", tangani(async (req, res) => {
  wajibSuperadmin(req);
  kirim(res, { kunciPublik: await deploy.buatKunci(await deploy.ambilServer(req.params.uuid), req.author.username) }, "Kunci SSH dibuat — tempel kunci publik di server");
}));
rute.post("/server/:uuid/lupakan-sidik", tangani(async (req, res) => {
  wajibSuperadmin(req);
  const s = await deploy.ambilServer(req.params.uuid);
  await ubah("studio_server", s.uuid, { sidik_host: null });
  await audit(req.author.username, `Melupakan sidik jari host server ${s.nama}`);
  kirim(res, null, "Sidik jari dilupakan; koneksi berikutnya mencatat ulang");
}));
rute.post("/server/:uuid/uji", tangani(async (req, res) => {
  wajibSuperadmin(req);
  kirim(res, await deploy.ujiKoneksi(await deploy.ambilServer(req.params.uuid)), "Server tersambung");
}));
rute.post("/server/:uuid/siapkan", tangani(async (req, res) => {
  wajibSuperadmin(req);
  kirim(res, { pesan: await deploy.siapkanServer(await deploy.ambilServer(req.params.uuid), req.author.username) }, "Server siap menerima kiriman");
}));
rute.post("/server/:uuid/deploy", tangani(async (req, res) => {
  await bolehDeploy(req);
  kirim(res, await deploy.deploy(await deploy.ambilServer(req.params.uuid), { jalankanDeploy: req.body?.jalankanDeploy !== false }, req.author.username), "Pengiriman ke server dimulai");
}));
rute.get("/deploy/info", tangani(async (req, res) => {
  await bolehDeploy(req);
  const { nilai } = await bacaSemua();
  const branch = await branchLokal(nilai);
  const r = await git(["log", "-1", "--format=%H%x09%s%x09%ct", `refs/heads/${branch}`], { izinkanGagal: true });
  const [sha, subjek, waktu] = r.keluaran.split("\t");
  kirim(res, { branch, sha: sha || null, subjek: subjek ?? null, waktu: waktu ? Number(waktu) : null, modeRilis: nilai.mode_rilis ?? "lokal", branchLokalDiatur: Boolean(nilai.branch_lokal) });
}));
rute.get("/deploy/riwayat", tangani(async (req, res) => {
  await bolehDeploy(req);
  kirim(res, await query(`SELECT uuid, status, instruksi, pesan_galat, hasil, dibuat_oleh, mulai, selesai, created_at FROM studio_tugas WHERE jenis = 'deploy' ORDER BY id DESC LIMIT 50`));
}));
rute.get("/deploy/bundle", tangani(async (req, res) => {
  await bolehDeploy(req);
  const b = await deploy.buatBundle(req.query.branch, req.author.username);
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${b.nama}"`);
  res.setHeader("X-Branch", b.branch);
  res.setHeader("X-Sha", b.sha);
  res.sendFile(b.berkas, (e) => {
    fs.rmSync(b.berkas, { force: true });
    if (e && !res.headersSent) res.status(500).end();
  });
}));

// ---------- Aplikasi pengembang (repo utama yang dijalankan npm run dev) ----------

rute.get("/aplikasi", tangani(async (req, res) => {
  await bolehBaca(req);
  kirim(res, await alur.statusAplikasi());
}));
rute.post("/aplikasi/pindah", tangani(async (req, res) => {
  wajibSuperadmin(req);
  kirim(res, await alur.pindahkanAplikasi(req.author.username), "Aplikasi dipindahkan ke branch lokal");
}));

// ---------- Pengaturan (superadmin) ----------

rute.get("/pengaturan", tangani(async (req, res) => {
  const { nilai, meta } = await bacaSemua();
  if (!isSuperadmin(req)) return kirim(res, { nilai: { fitur: nilai.fitur }, meta: {}, aturanPlatform: ATURAN_PLATFORM, peran: PERAN });
  kirim(res, { nilai: untukTampilan(nilai), meta, aturanPlatform: ATURAN_PLATFORM, peran: PERAN });
}));

rute.put("/pengaturan", tangani(async (req, res) => {
  wajibSuperadmin(req);
  const body = req.body ?? {};
  const BOLEH = ["branch_dasar", "konektor_tahap", "model_tahap", "aturan_instalasi", "atribusi_commit", "cek_build_frontend", "fitur", "pemisahan_tugas", "mode_kerja",
    "direktori_worktree", "batas_biaya_tugas", "batas_biaya_item", "batas_biaya_bulan", "batas_kuota_persen", "batas_tugas_per_jam", "git_penyedia", "git_api_url", "git_repo", "git_token", "mode_rilis", "branch_lokal", "migrasi_otomatis",
    "aktivasi_otomatis", "aktivasi_faskes"];
  // Model per tahap harus cocok dengan agennya. Tahap berkonektor API memakai model konektornya (model tahap dibuang).
  if (body.konektor_tahap || body.model_tahap) {
    const { nilai: lama } = await bacaSemua();
    const konektorBaru = body.konektor_tahap ?? lama.konektor_tahap ?? {};
    const modelBaru = { ...(body.model_tahap ?? lama.model_tahap ?? {}) };
    for (const [tahap, model] of Object.entries(modelBaru)) {
      const pilihan = konektorBaru[tahap];
      if (!model || (pilihan && !["claude_code", "codex"].includes(pilihan))) delete modelBaru[tahap];
      else if (!cocokModel(pilihan, model)) throw permintaanSalah(pesanTidakCocok(tahap, pilihan, model));
      else if (pilihan === "codex") {
        const tersedia = codex.modelCodex();
        if (tersedia.length && !tersedia.some((m) => m.kode === model)) {
          throw permintaanSalah(`Model "${model}" tidak tersedia untuk akun Codex ini (tahap ${tahap}). Pilihan: ${tersedia.map((m) => m.kode).join(", ")}`);
        }
      }
    }
    body.model_tahap = modelBaru;
  }
  for (const [k, v] of Object.entries(body)) {
    if (!BOLEH.includes(k)) continue;
    let nilai = v;
    if (k === "branch_dasar" && !/^[\w./-]+$/.test(String(v))) throw permintaanSalah("Nama branch dasar tidak valid");
    if (k === "mode_kerja" && !["workspace", "worktree"].includes(v)) throw permintaanSalah("Mode kerja harus workspace atau worktree");
    if (k === "mode_rilis" && !["lokal", "pr", "keduanya"].includes(v)) throw permintaanSalah("Mode rilis harus lokal, pr, atau keduanya");
    if (k === "aktivasi_faskes" && !["saya", "semua"].includes(v)) throw permintaanSalah("Faskes aktivasi harus saya atau semua");
    if (k === "branch_lokal" && v && (!/^[\w./-]+$/.test(String(v)) || /\/STD-\d+/.test(String(v)))) throw permintaanSalah("Nama branch lokal tidak valid (tidak boleh branch item STD-…)");
    if (k === "direktori_worktree" && v) {
      if (!path.isAbsolute(String(v))) throw permintaanSalah("Folder worktree harus path lengkap, mis. C:\\simrs-studio");
      if (diDalamRepo(String(v))) throw permintaanSalah("Folder worktree tidak boleh berada di dalam folder repo — pilih folder lain, mis. C:\\simrs-studio");
    }
    if (k === "git_penyedia" && !["", "github", "gitea"].includes(v ?? "")) throw permintaanSalah("Penyedia Git harus github, gitea, atau kosong");
    if (k === "git_repo" && v && !/^[\w.-]+\/[\w.-]+$/.test(v)) throw permintaanSalah("Repo harus berformat owner/nama");
    if (k === "model_tahap" && Object.values(v ?? {}).some((m) => m && !/^[\w.:/-]+$/.test(String(m)))) throw permintaanSalah("Nama model tidak valid");
    if (k === "git_token") {
      if (!v || String(v).startsWith("••")) continue; // tidak diubah
      nilai = enkripsi(String(v));
    }
    if (k.startsWith("batas_")) nilai = v === "" || v === null || v === undefined ? null : Number(v);
    if (typeof BAWAAN[k] === "boolean") nilai = Boolean(v);
    if (["fitur", "konektor_tahap", "model_tahap"].includes(k)) nilai = typeof v === "object" && v ? v : {};
    await simpan(k, nilai, req.author.username);
  }
  await audit(req.author.username, "Mengubah pengaturan Studio", null, Object.keys(body).filter((k) => k !== "git_token"));
  kirim(res, untukTampilan((await bacaSemua()).nilai), "Pengaturan disimpan");
}));

// Akun Claude Code (langganan) agen Studio: login lewat peramban (OAuth claude.ai) tanpa membuka terminal.
rute.get("/pengaturan/akun-claude", tangani(async (req, res) => {
  wajibSuperadmin(req);
  kirim(res, { akun: await akunClaude.statusAkun(), login: akunClaude.statusLogin() });
}));
rute.post("/pengaturan/akun-claude/login", tangani(async (req, res) => {
  wajibSuperadmin(req);
  const login = await akunClaude.mulaiLogin({ email: req.body?.email || undefined });
  await audit(req.author.username, "Memulai login akun Claude Code");
  kirim(res, login, "Buka halaman login Claude, lalu tempel kode yang ditampilkan");
}));
rute.post("/pengaturan/akun-claude/kode", tangani(async (req, res) => {
  wajibSuperadmin(req);
  const akun = await akunClaude.kirimKode(req.body?.kode);
  await audit(req.author.username, "Menghubungkan akun Claude Code", null, { email: akun.email, paket: akun.paket });
  kirim(res, akun, `Akun Claude terhubung${akun.email ? `: ${akun.email}` : ""}`);
}));
rute.post("/pengaturan/akun-claude/batal", tangani(async (req, res) => {
  wajibSuperadmin(req);
  akunClaude.batalLogin();
  kirim(res, { berjalan: false }, "Login dibatalkan");
}));
rute.post("/pengaturan/akun-claude/keluar", tangani(async (req, res) => {
  wajibSuperadmin(req);
  const akun = await akunClaude.keluar();
  await audit(req.author.username, "Memutus akun Claude Code");
  kirim(res, akun, "Akun Claude diputus");
}));

// Akun Codex (langganan ChatGPT): login kode perangkat di auth.openai.com/codex/device.
rute.get("/pengaturan/akun-codex", tangani(async (req, res) => {
  wajibSuperadmin(req);
  kirim(res, { akun: await codex.statusAkunCodex(), login: codex.statusLoginCodex(), model: codex.modelCodex() });
}));
rute.post("/pengaturan/akun-codex/login", tangani(async (req, res) => {
  wajibSuperadmin(req);
  const login = await codex.mulaiLoginCodex();
  await audit(req.author.username, "Memulai login akun Codex (ChatGPT)");
  kirim(res, login, "Buka tautan login ChatGPT dan masukkan kodenya");
}));
rute.post("/pengaturan/akun-codex/batal", tangani(async (req, res) => {
  wajibSuperadmin(req);
  codex.batalLoginCodex();
  kirim(res, { berjalan: false }, "Login dibatalkan");
}));
rute.post("/pengaturan/akun-codex/keluar", tangani(async (req, res) => {
  wajibSuperadmin(req);
  const akun = await codex.keluarCodex();
  await audit(req.author.username, "Memutus akun Codex (ChatGPT)");
  kirim(res, akun, "Akun Codex diputus");
}));

rute.post("/pengaturan/kill-switch", tangani(async (req, res) => {
  wajibSuperadmin(req);
  const aktif = Boolean(req.body?.aktif);
  await simpan("kill_switch", { aktif, alasan: req.body?.alasan ?? null }, req.author.username);
  const dihentikan = aktif ? await hentikanSemuaTugas() : 0;
  await audit(req.author.username, aktif ? "MENGHENTIKAN Studio (kill switch)" : "Mencabut kill switch", null, { alasan: req.body?.alasan, dihentikan });
  kirim(res, { aktif, dihentikan }, aktif ? `Studio dihentikan; ${dihentikan} tugas dibatalkan` : "Studio dibuka kembali");
}));

rute.post("/pengaturan/git/uji", tangani(async (req, res) => {
  wajibSuperadmin(req);
  kirim(res, await gitremote.ujiKoneksi(), "Git hosting tersambung");
}));

rute.post("/pengaturan/kunci-ekstensi", tangani(async (req, res) => {
  wajibSuperadmin(req);
  kirim(res, { kunciPublik: await ekstensi.kunciPenandaTangan(req.author.username, Boolean(req.body?.baru)) }, "Kunci penanda tangan siap");
}));

// ---------- Konektor agen ----------

const tampilKonektor = (k) => ({ ...k, kunci_api: k.kunci_api ? samarkan("rahasia") : null });

rute.get("/konektor", tangani(async (req, res) => {
  wajibSuperadmin(req);
  kirim(res, (await query(`SELECT * FROM studio_konektor WHERE deleted_at IS NULL ORDER BY created_at`)).map(tampilKonektor));
}));

const validasiKonektor = (b) => {
  if (!String(b.nama ?? "").trim()) throw permintaanSalah("Nama konektor wajib diisi");
  if (!["anthropic", "openai", "openai_kompatibel"].includes(b.penyedia)) throw permintaanSalah("Penyedia harus anthropic, openai, atau openai_kompatibel");
  if (b.penyedia === "openai_kompatibel" && !/^https?:\/\//.test(b.endpoint ?? "")) throw permintaanSalah("Endpoint model lokal wajib diisi (mis. http://localhost:11434/v1)");
  if (!String(b.model ?? "").trim()) throw permintaanSalah("Model wajib diisi");
};

rute.post("/konektor", tangani(async (req, res) => {
  wajibSuperadmin(req);
  const b = req.body ?? {};
  validasiKonektor(b);
  const k = await sisipkan("studio_konektor", {
    nama: b.nama.trim(), penyedia: b.penyedia, endpoint: b.endpoint || null, kunci_api: enkripsi(b.kunci_api), model: b.model.trim(),
    harga_masuk: b.harga_masuk || null, harga_keluar: b.harga_keluar || null, aktif: b.aktif !== false, dibuat_oleh: req.author.username, updated_at: sekarang(),
  });
  await audit(req.author.username, `Menambah konektor ${k.nama}`);
  kirim(res, tampilKonektor(k), "Konektor ditambahkan");
}));

rute.put("/konektor/:uuid", tangani(async (req, res) => {
  wajibSuperadmin(req);
  const lama = await satu(`SELECT * FROM studio_konektor WHERE uuid = $1 AND deleted_at IS NULL`, [req.params.uuid]);
  if (!lama) throw tidakDitemukan("Konektor");
  const b = { ...lama, ...req.body };
  validasiKonektor(b);
  const k = await ubah("studio_konektor", lama.uuid, {
    nama: b.nama, penyedia: b.penyedia, endpoint: b.endpoint || null, model: b.model, harga_masuk: b.harga_masuk || null, harga_keluar: b.harga_keluar || null, aktif: b.aktif !== false,
    kunci_api: req.body?.kunci_api && !String(req.body.kunci_api).startsWith("••") ? enkripsi(req.body.kunci_api) : undefined,
  });
  await audit(req.author.username, `Mengubah konektor ${k.nama}`);
  kirim(res, tampilKonektor(k), "Konektor diperbarui");
}));

rute.delete("/konektor/:uuid", tangani(async (req, res) => {
  wajibSuperadmin(req);
  await query(`UPDATE studio_konektor SET deleted_at = $2, aktif = false WHERE uuid = $1`, [req.params.uuid, sekarang()]);
  await audit(req.author.username, "Menghapus konektor");
  kirim(res, null, "Konektor dihapus");
}));

// Uji koneksi: Claude Code CLI (bawaan) atau konektor API.
rute.post("/konektor/uji", tangani(async (req, res) => {
  wajibSuperadmin(req);
  const tugas = await sisipkan("studio_tugas", { tahap: "uji", jenis: "uji", status: "antri", dibuat_oleh: req.author.username, updated_at: sekarang() });
  try {
    const prompt = "Balas persis: SIMRS Studio tersambung.";
    let hasil;
    if (!req.body?.konektor || req.body.konektor === "claude_code") {
      ({ hasil } = await jalankanClaude({ tugasUuid: tugas.uuid, prompt, mode: "dokumen", model: req.body?.model || "", mcp: false }));
    } else if (req.body.konektor === "codex") {
      ({ hasil } = await codex.jalankanCodex({ tugasUuid: tugas.uuid, prompt, mode: "dokumen", model: req.body?.model || "", base: config.repoDir }));
    } else {
      const k = await ambilKonektor({ konektor_tahap: { uji: req.body.konektor } }, "uji");
      ({ hasil } = await jalankanApi({ tugasUuid: tugas.uuid, prompt, mode: "dokumen", konektor: k, model: req.body?.model || "", base: config.repoDir }));
    }
    await query(`UPDATE studio_tugas SET status = 'selesai', hasil = $2, selesai = $3, updated_at = $3 WHERE uuid = $1`, [tugas.uuid, hasil, sekarang()]);
    kirim(res, { hasil, tugas: await satu(`SELECT model, biaya_usd, kuota FROM studio_tugas WHERE uuid = $1`, [tugas.uuid]) }, "Agen tersambung");
  } catch (e) {
    await query(`UPDATE studio_tugas SET status = 'gagal', pesan_galat = $2, selesai = $3, updated_at = $3 WHERE uuid = $1`, [tugas.uuid, e.message, sekarang()]);
    throw new Galat(502, e.message);
  }
}));

// ---------- Aturan prompt (lapis area & tahap) & basis pengetahuan ----------

const crudTeks = (tabel, nama, kolom) => {
  rute.get(`/${nama}`, tangani(async (req, res) => {
    await bolehBaca(req);
    kirim(res, await query(`SELECT * FROM ${tabel} WHERE deleted_at IS NULL ORDER BY ${kolom.includes("lapis") ? "lapis, kunci, " : ""}judul`));
  }));
  rute.post(`/${nama}`, tangani(async (req, res) => {
    wajibSuperadmin(req);
    const b = req.body ?? {};
    if (!String(b.judul ?? "").trim() || !String(b.isi ?? "").trim()) throw permintaanSalah("Judul dan isi wajib diisi");
    if (kolom.includes("lapis") && (!["area", "tahap"].includes(b.lapis) || !String(b.kunci ?? "").trim())) throw permintaanSalah("Lapis (area/tahap) dan kunci wajib diisi");
    const baris = await sisipkan(tabel, { ...Object.fromEntries(kolom.map((k) => [k, b[k] ?? null])), judul: b.judul.trim(), isi: b.isi, aktif: b.aktif !== false, diubah_oleh: req.author.username, updated_at: sekarang() });
    await audit(req.author.username, `Menambah ${nama}: ${b.judul}`);
    kirim(res, baris, "Tersimpan");
  }));
  rute.put(`/${nama}/:uuid`, tangani(async (req, res) => {
    wajibSuperadmin(req);
    const lama = await satu(`SELECT * FROM ${tabel} WHERE uuid = $1 AND deleted_at IS NULL`, [req.params.uuid]);
    if (!lama) throw tidakDitemukan("Data");
    const b = req.body ?? {};
    const baris = await ubah(tabel, lama.uuid, {
      ...Object.fromEntries(kolom.map((k) => [k, b[k] ?? lama[k]])), judul: b.judul ?? lama.judul, isi: b.isi ?? lama.isi, aktif: b.aktif ?? lama.aktif,
      ...(tabel === "studio_aturan" && b.isi && b.isi !== lama.isi ? { versi: Number(lama.versi) + 1 } : {}), diubah_oleh: req.author.username,
    });
    await audit(req.author.username, `Mengubah ${nama}: ${baris.judul}`);
    kirim(res, baris, "Tersimpan");
  }));
  rute.delete(`/${nama}/:uuid`, tangani(async (req, res) => {
    wajibSuperadmin(req);
    await query(`UPDATE ${tabel} SET deleted_at = $2 WHERE uuid = $1`, [req.params.uuid, sekarang()]);
    await audit(req.author.username, `Menghapus ${nama}`);
    kirim(res, null, "Dihapus");
  }));
};
crudTeks("studio_aturan", "aturan", ["lapis", "kunci"]);
crudTeks("studio_pengetahuan", "pengetahuan", []);

// ---------- Sistem, audit, metrik ----------

rute.get("/sistem", tangani(async (req, res) => {
  await bolehBaca(req);
  const [claude, codexCli, branch, repo, kuota, biaya] = await Promise.all([
    versiClaude(),
    codex.versiCodex(),
    branchSekarang().catch((e) => `galat: ${e.message}`),
    urlRepo(),
    satu(`SELECT kuota, updated_at FROM studio_tugas WHERE kuota IS NOT NULL ORDER BY updated_at DESC LIMIT 1`),
    satu(`SELECT COALESCE(SUM(biaya_usd), 0) AS total, COUNT(*) AS jumlah FROM studio_tugas WHERE created_at >= $1`, [sekarang() - 30 * 86400]),
  ]);
  kirim(res, { claude, codex: codexCli, repoDir: config.repoDir, repo, branch, lingkungan: config.lingkungan, kuota: kuota?.kuota ?? null, kuotaPada: kuota ? Number(kuota.updated_at) : null, biaya30Hari: biaya });
}));

rute.get("/audit", tangani(async (req, res) => {
  await pastikan(req, "Audit", "READ");
  const rows = await query(
    `SELECT a.id, a.aksi, a.pelaku, a.rincian, a.waktu, i.nomor, i.judul, i.uuid AS item_uuid
       FROM studio_audit a LEFT JOIN studio_item i ON i.uuid = a.item_uuid
      ORDER BY a.waktu DESC, a.id DESC LIMIT 500`,
  );
  const biaya = await query(
    `SELECT i.uuid, i.nomor, i.judul, COALESCE(SUM(t.biaya_usd), 0) AS biaya_usd, COALESCE(SUM(t.token_masuk), 0) AS token_masuk, COALESCE(SUM(t.token_keluar), 0) AS token_keluar
       FROM studio_item i LEFT JOIN studio_tugas t ON t.item_uuid = i.uuid
      WHERE i.deleted_at IS NULL GROUP BY i.uuid, i.nomor, i.judul ORDER BY i.nomor DESC`,
  );
  kirim(res, { audit: rows, biaya });
}));

// Metrik keberhasilan (rancangan §18).
rute.get("/metrik", tangani(async (req, res) => {
  await pastikan(req, "Audit", "READ");
  const median = (arr) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const prd = await query(
    `SELECT i.uuid, MIN(p.created_at) - i.created_at AS detik FROM studio_item i
       JOIN studio_persetujuan p ON p.item_uuid = i.uuid AND p.tahap = 'prd' AND p.keputusan = 'setuju'
      WHERE i.deleted_at IS NULL GROUP BY i.uuid, i.created_at`,
  );
  const tanpaRevisi = async (tahap) => {
    const r = await satu(
      `SELECT COUNT(*) FILTER (WHERE revisi = 0)::int AS tanpa, COUNT(*)::int AS total FROM (
         SELECT i.uuid, COUNT(p.*) FILTER (WHERE p.keputusan = 'revisi') AS revisi FROM studio_item i
           JOIN studio_persetujuan p ON p.item_uuid = i.uuid AND p.tahap = $1
          WHERE i.deleted_at IS NULL AND EXISTS (SELECT 1 FROM studio_persetujuan s WHERE s.item_uuid = i.uuid AND s.tahap = $1 AND s.keputusan = 'setuju')
          GROUP BY i.uuid) x`,
      [tahap],
    );
    return r.total ? Math.round((r.tanpa / r.total) * 100) : null;
  };
  const selesai = await query(
    `SELECT i.uuid, i.updated_at - i.created_at AS detik, COALESCE((SELECT SUM(biaya_usd) FROM studio_tugas t WHERE t.item_uuid = i.uuid), 0) AS biaya
       FROM studio_item i WHERE i.tahap = 'selesai' AND i.deleted_at IS NULL`,
  );
  const perTahap = await query(`SELECT tahap, COUNT(*)::int AS jumlah FROM studio_item WHERE deleted_at IS NULL GROUP BY tahap`);
  kirim(res, {
    medianJamKePrd: prd.length ? Math.round(median(prd.map((r) => Number(r.detik))) / 360) / 10 : null,
    persenPrdTanpaRevisi: await tanpaRevisi("prd"),
    persenKodeTanpaRevisi: await tanpaRevisi("coding"),
    jumlahSelesai: selesai.length,
    medianHariSelesai: selesai.length ? Math.round(median(selesai.map((r) => Number(r.detik))) / 8640) / 10 : null,
    rataBiayaPerItemSelesai: selesai.length ? Number((selesai.reduce((t, r) => t + Number(r.biaya), 0) / selesai.length).toFixed(2)) : null,
    perTahap,
  });
}));

export default rute;
