// Sinkronisasi branch item dengan branch target (branch lokal/dasar) + penyelesaian konflik otomatis untuk pola yang
// berulang saat banyak item dikerjakan paralel: setiap modul baru menambah entri di daftar yang sama (katalog modul,
// daftar izin, menu, rute, CHANGELOG). Pola yang tidak dikenal tidak pernah ditebak: penggabungan dibatalkan
// (git merge --abort) dan branch item tetap bersih. Diturunkan dari skrip penyelesai konflik maintainer (2026-10).
import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { Galat } from "./respons.js";
import { git } from "./git.js";

export const KATALOG = "database/data/katalog-modul.json";
export const DOK_KATALOG = "docs/MANAJEMEN-MODUL.md";

// ---------- JSON tiga arah (katalog) ----------

export class KonflikTakDikenal extends Error {}
const konflik = (jalur, alasan = "kedua sisi mengubah nilai yang sama") => new KonflikTakDikenal(`${jalur || "(akar)"}: ${alasan}`);

// Pembanding tanpa memedulikan urutan kunci objek.
const kanonik = (v) => {
  if (Array.isArray(v)) return `[${v.map(kanonik).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${kanonik(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
};
const sama = (a, b) => kanonik(a) === kanonik(b);
const objekPolos = (x) => Boolean(x) && typeof x === "object" && !Array.isArray(x);
const larikKode = (x) => Array.isArray(x) && x.every((e) => objekPolos(e) && typeof e.kode === "string");
const larikPrimitif = (x) => Array.isArray(x) && x.every((e) => e === null || typeof e !== "object");

// Entri berkode (modul/fitur/bagian/segmen): perubahan item terhadap titik cabang diterapkan ke versi target.
const gabungEntri = (b, o, t, jalur) => {
  const pb = new Map(b.map((e) => [e.kode, e]));
  const po = new Map(o.map((e) => [e.kode, e]));
  const hasil = [...t];
  for (const e of b) {
    if (po.has(e.kode)) continue;
    const i = hasil.findIndex((x) => x.kode === e.kode);
    if (i < 0) continue;
    if (!sama(hasil[i], e)) throw konflik(`${jalur}[${e.kode}]`, "dihapus item tetapi diubah di target");
    hasil.splice(i, 1);
  }
  o.forEach((e, idx) => {
    const lama = pb.get(e.kode);
    if (sama(lama, e)) return;
    const i = hasil.findIndex((x) => x.kode === e.kode);
    if (i >= 0) {
      hasil[i] = gabung3(lama, e, hasil[i], `${jalur}[${e.kode}]`);
      return;
    }
    if (lama) throw konflik(`${jalur}[${e.kode}]`, "diubah item tetapi dihapus di target");
    // Entri baru: sesudah pendahulunya (urutan di versi item) yang ada di target; tanpa pendahulu → awal/akhir daftar.
    let pos = -1;
    for (let j = idx - 1; j >= 0 && pos < 0; j--) pos = hasil.findIndex((x) => x.kode === o[j].kode);
    hasil.splice(pos >= 0 ? pos + 1 : idx === 0 ? 0 : hasil.length, 0, e);
  });
  return hasil;
};

// Gabung tiga arah nilai JSON: b = titik cabang, o = item (ours), t = target (theirs).
export const gabung3 = (b, o, t, jalur = "") => {
  if (sama(o, b)) return t;
  if (sama(t, b) || sama(o, t)) return o;
  if (o === undefined || t === undefined) throw konflik(jalur, "dihapus di satu sisi dan diubah di sisi lain");
  if (larikKode(o) && larikKode(t) && (b === undefined || larikKode(b))) return gabungEntri(b ?? [], o, t, jalur);
  // Larik nilai (mis. preset segmen → [kode modul], menu, rute): penambahan/penghapusan item diterapkan ke target.
  if (larikPrimitif(o) && larikPrimitif(t) && (b === undefined || larikPrimitif(b))) {
    const pb = new Set(b ?? []);
    const po = new Set(o);
    const buang = new Set([...pb].filter((x) => !po.has(x)));
    const hasil = t.filter((x) => !buang.has(x));
    for (const x of o) if (!pb.has(x) && !hasil.includes(x)) hasil.push(x);
    return hasil;
  }
  if (objekPolos(o) && objekPolos(t) && (b === undefined || objekPolos(b))) {
    const bb = b ?? {};
    const hasil = {};
    for (const k of new Set([...Object.keys(t), ...Object.keys(o)])) {
      const v = gabung3(bb[k], o[k], t[k], jalur ? `${jalur}.${k}` : k);
      if (v !== undefined) hasil[k] = v;
    }
    return hasil;
  }
  throw konflik(jalur);
};

// Pemindai rentang nilai JSON di teks (agar format asli katalog — campuran satu baris & banyak baris — terjaga).
const spasi = (t, i) => {
  while (i < t.length && /\s/.test(t[i])) i++;
  return i;
};
const ujungNilai = (t, i) => {
  if (t[i] === '"') {
    for (i++; t[i] !== '"'; i++) if (t[i] === "\\") i++;
    return i + 1;
  }
  if (t[i] === "{" || t[i] === "[") {
    let d = 0;
    for (; i < t.length; i++) {
      const c = t[i];
      if (c === '"') i = ujungNilai(t, i) - 1;
      else if (c === "{" || c === "[") d++;
      else if ((c === "}" || c === "]") && --d === 0) return i + 1;
    }
    throw new Error("JSON tidak lengkap");
  }
  while (i < t.length && !/[\s,}\]]/.test(t[i])) i++;
  return i;
};
// Anggota objek/larik yang dimulai di indeks a: [{ kunci, ka, va, vb }] (kunci null untuk larik).
const anggota = (t, a) => {
  const objek = t[a] === "{";
  const hasil = [];
  let i = spasi(t, a + 1);
  while (t[i] !== (objek ? "}" : "]")) {
    const ka = i;
    let kunci = null;
    if (objek) {
      const kb = ujungNilai(t, i);
      kunci = JSON.parse(t.slice(i, kb));
      i = spasi(t, spasi(t, kb) + 1);
    }
    const vb = ujungNilai(t, i);
    hasil.push({ kunci, ka, va: i, vb });
    i = spasi(t, vb);
    if (t[i] === ",") i = spasi(t, i + 1);
  }
  return hasil;
};
const indentDi = (t, i) => t.slice(t.lastIndexOf("\n", i - 1) + 1, i).match(/^[ \t]*/)[0];
const serial = (v, indent) => JSON.stringify(v, null, 2).split("\n").join(`\n${indent}`);
const geserIndent = (teks, dari, ke) => (dari === ke ? teks : teks.split("\n").map((l, i) => (i && l.startsWith(dari) ? ke + l.slice(dari.length) : l)).join("\n"));

// Tulis nilai hasil di posisi nilai target. Sumber: { teks, va, vb, nilai, indent } untuk target (t) & item (o).
const tulis = (hasil, t, o, indent) => {
  if (t && sama(hasil, t.nilai)) return t.teks.slice(t.va, t.vb);
  if (o && sama(hasil, o.nilai)) return geserIndent(o.teks.slice(o.va, o.vb), o.indent, indent);
  if (t && objekPolos(hasil) && objekPolos(t.nilai) && Object.keys(t.nilai).every((k) => k in hasil)) {
    const anakT = anggota(t.teks, t.va);
    const anakO = o && objekPolos(o.nilai) ? new Map(anggota(o.teks, o.va).map((x) => [x.kunci, x])) : new Map();
    const sumber = (teks, x, nilai) => (x ? { teks, va: x.va, vb: x.vb, nilai, indent: indentDi(teks, x.ka) } : null);
    let keluar = "";
    let posisi = t.va;
    for (const x of anakT) {
      const ind = indentDi(t.teks, x.ka);
      keluar += t.teks.slice(posisi, x.va) + tulis(hasil[x.kunci], sumber(t.teks, x, t.nilai[x.kunci]), sumber(o?.teks, anakO.get(x.kunci), o?.nilai?.[x.kunci]), ind);
      posisi = x.vb;
    }
    const baru = Object.keys(hasil).filter((k) => !(k in t.nilai));
    const indAnak = anakT.length ? indentDi(t.teks, anakT[0].ka) : `${indent}  `;
    const tambahan = baru.map((k) => `${JSON.stringify(k)}: ${tulis(hasil[k], null, sumber(o?.teks, anakO.get(k), o?.nilai?.[k]), indAnak)}`);
    if (!tambahan.length) return keluar + t.teks.slice(posisi, t.vb);
    if (!anakT.length) return `{\n${indAnak}${tambahan.join(`,\n${indAnak}`)}\n${indent}}`;
    return `${keluar},\n${indAnak}${tambahan.join(`,\n${indAnak}`)}${t.teks.slice(posisi, t.vb)}`;
  }
  if (larikKode(hasil) && t && larikKode(t.nilai)) {
    const elT = anggota(t.teks, t.va);
    const petaT = new Map(elT.map((x, i) => [t.nilai[i].kode, { teks: t.teks, va: x.va, vb: x.vb, nilai: t.nilai[i], indent: indentDi(t.teks, x.va) }]));
    const petaO = o && larikKode(o.nilai)
      ? new Map(anggota(o.teks, o.va).map((x, i) => [o.nilai[i].kode, { teks: o.teks, va: x.va, vb: x.vb, nilai: o.nilai[i], indent: indentDi(o.teks, x.va) }]))
      : new Map();
    const indEl = elT.length ? indentDi(t.teks, elT[0].va) : `${indent}  `;
    const bagian = hasil.map((e) => tulis(e, petaT.get(e.kode) ?? null, petaO.get(e.kode) ?? null, indEl));
    return bagian.length ? `[\n${indEl}${bagian.join(`,\n${indEl}`)}\n${indent}]` : "[]";
  }
  return serial(hasil, indent);
};

// Gabung tiga arah teks JSON dengan format target dipertahankan. Melempar KonflikTakDikenal bila tidak aman.
export const gabungJson = (teksDasar, teksItem, teksTarget) => {
  const [B, O, T] = [teksDasar, teksItem, teksTarget].map((x) => String(x).replace(/\r\n/g, "\n"));
  const [b, o, t] = [B, O, T].map((x) => JSON.parse(x));
  const hasil = gabung3(b, o, t);
  const va = spasi(T, 0);
  const vb = ujungNilai(T, va);
  const ov = spasi(O, 0);
  const teks = T.slice(0, va) + tulis(hasil, { teks: T, va, vb, nilai: t, indent: "" }, { teks: O, va: ov, vb: ujungNilai(O, ov), nilai: o, indent: "" }, "") + T.slice(vb);
  if (!sama(JSON.parse(teks), hasil)) throw konflik("", "hasil penulisan tidak sama dengan hasil penggabungan");
  return teks;
};

// Modul yang dibuat tersedia oleh item (Segera → tersedia) — dipakai aturan daftar "Segera" Header.vue.
export const modulTersediaItem = (katalogDasar, katalogItem) => {
  const dasar = new Map((katalogDasar?.modul ?? []).map((m) => [m.kode, m]));
  return (katalogItem?.modul ?? []).filter((m) => m.tersedia && dasar.get(m.kode) && !dasar.get(m.kode).tersedia).map((m) => m.kode);
};

// ---------- Berkas teks berpola (daftar sisipan) ----------

const POLA_KONFLIK = /^<<<<<<< [^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> [^\n]*(?:\n|$)/gm;
export const adaPenanda = (teks) => /^(<<<<<<<|=======|>>>>>>>)( |$)/m.test(teks);
const daftarString = (t) => [...t.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const barisUnik = (a, b) => {
  const ada = new Set(b.split("\n").filter((l) => l.trim()));
  return a.split("\n").filter((l, i, arr) => !(l.trim() && ada.has(l)) || (i === arr.length - 1 && l === "")).join("\n");
};

// Aturan per berkas untuk satu blok konflik: a = sisi item (ours), b = sisi target (theirs). Mengembalikan teks
// pengganti blok, atau null bila pola blok tidak dikenal.
export const ATURAN_DAFTAR = {
  // SEMUA_MODUL: nama modul item yang belum ada disisipkan sesudah pendahulunya.
  "auth-service/src/controllers/permission-controller.js": (a, b) => {
    const sa = daftarString(a);
    const sb = daftarString(b);
    if (!sa.length && !sb.length) return null;
    let hasil = b;
    sa.forEach((nama, i) => {
      if (sb.includes(nama)) return;
      let pend = null;
      for (let j = i - 1; j >= 0 && !pend; j--) if (hasil.includes(`"${sa[j]}", `)) pend = sa[j];
      hasil = pend ? hasil.replace(`"${pend}", `, `"${pend}", "${nama}", `) : hasil.replace(/"/, `"${nama}", "`);
    });
    return hasil;
  },
  // Blok `export const xPermission = {…}` baru di kedua sisi: git memisahkan penutup bersama "  ],\n};".
  "auth-service/src/helpers/permission-list.js": (a, b) => (/export const/.test(a) ? `${a}  ],\n};\n\n${b}` : a + b),
  "frontend-service/src/components/section/Header.vue": (a, b, { modulTersedia = [] } = {}) => {
    if (/title:/.test(a)) return `${a}  },\n  {\n${b}`;
    if (/MODUL_PENUNJANG/.test(a)) {
      const ua = daftarString(a);
      const ub = daftarString(b);
      return b.replace(/\];/, `${ua.filter((x) => !ub.includes(x)).map((x) => `, "${x}"`).join("")}];`);
    }
    // Daftar menu "Segera": versi target dikurangi modul yang kini tersedia di item ini.
    if (!/^\s*\w+: "[^"]*",/m.test(b) && !/^\s*\w+: "[^"]*",/m.test(a)) return null;
    const sisa = modulTersedia.reduce((t, k) => t.replace(new RegExp(`\\s?\\b${k}: "[^"]*",`, "g"), ""), b);
    return sisa.split("\n").filter((l, i, arr) => l.trim() || i === arr.length - 1).join("\n");
  },
  "frontend-service/src/router/index.ts": (a, b) => (/SECTION/.test(a) ? `${a}    ]),\n    // !SECTION\n\n${b}` : a + b),
  "frontend-service/src/utils/permissions.ts": (a, b) => a + b,
  "penunjang-service/src/rute.js": (a, b) => (/^import /m.test(a) ? `${a.split("\n").filter((l) => /^import /.test(l) && !b.includes(l)).join("\n")}\n${b}` : b + a),
  "penunjang-service/src/umum/izin.js": (a, b) => b + a,
  "penunjang-service/src/config.js": (a, b) => a + b,
  // CHANGELOG lama (sebelum fragmen changelog.d/): entri kedua sisi dipertahankan.
  "CHANGELOG.md": (a, b) => barisUnik(a, b) + b,
};

// Selesaikan semua blok konflik di teks dengan aturan; null bila ada blok yang tidak dikenal.
export const selesaikanTeks = (teks, aturan, konteks = {}) => {
  const crlf = teks.includes("\r\n");
  let gagal = false;
  const hasil = teks.replace(/\r\n/g, "\n").replace(POLA_KONFLIK, (_, a, b) => {
    const r = gagal ? null : aturan(a, b, konteks);
    if (r == null) gagal = true;
    return r ?? "";
  });
  if (gagal || adaPenanda(hasil)) return null;
  return crlf ? hasil.replace(/\n/g, "\r\n") : hasil;
};

// ---------- Alur git ----------

const jalankanNode = (args, cwd) =>
  new Promise((resolve) => {
    execFile(process.execPath, args, { cwd, maxBuffer: 20 * 1024 * 1024, windowsHide: true, timeout: 5 * 60 * 1000 }, (err, stdout, stderr) =>
      resolve({ ok: !err, keluaran: `${stdout}${stderr}`.trim() }),
    );
  });

// Berkas berkonflik + tahap indeks yang ada (1 = titik cabang, 2 = item, 3 = target).
const berkasKonflik = async (cwd) => {
  const { keluaran } = await git(["ls-files", "-u", "-z"], { cwd, izinkanGagal: true });
  const peta = new Map();
  for (const rec of keluaran.split("\0").filter(Boolean)) {
    const [info, p] = rec.split("\t");
    const tahap = Number(info.split(" ")[2]);
    if (!peta.has(p)) peta.set(p, new Set());
    peta.get(p).add(tahap);
  }
  return [...peta].map(([p, tahap]) => ({ path: p, lengkap: [1, 2, 3].every((x) => tahap.has(x)) }));
};
const tampil = async (cwd, spec) => {
  const r = await git(["show", spec], { cwd, izinkanGagal: true });
  return r.ok ? r.keluaran : null;
};
const bacaJson = (teks) => {
  try {
    return teks == null ? null : JSON.parse(teks);
  } catch {
    return null;
  }
};
export const dikenal = (p) => p === KATALOG || p === DOK_KATALOG || Object.hasOwn(ATURAN_DAFTAR, p);

// Penggabungan yang sedang berjalan (MERGE_HEAD ada) di cwd.
export const sedangMenggabung = async (cwd) => (await git(["rev-parse", "-q", "--verify", "MERGE_HEAD"], { cwd, izinkanGagal: true })).ok;

// Berkas yang masih berpenanda konflik (<<<<<<< / ======= / >>>>>>>) di antara `jalur`.
export const masihBerpenanda = (cwd, jalur) =>
  jalur.filter((rel) => {
    try {
      return adaPenanda(fs.readFileSync(path.join(cwd, rel), "utf8"));
    } catch {
      return false; // berkas dihapus sebagai penyelesaian
    }
  });

// Gabungkan `target` ke branch yang terbuka di `cwd` (branch item) dengan penyelesaian otomatis.
// Hasil: { status: "mutakhir" | "digabung" | "konflik" | "gagal_integritas" | "menunggu", sha?, otomatis: [{ path, cara }], tersisa: [path], integritas? }
// Selain "digabung"/"mutakhir", penggabungan dibatalkan dan working tree kembali seperti semula — kecuali `biarkan`:
// konflik yang tidak dikenali dibiarkan berpenanda (status "menunggu") untuk diselesaikan manual/agen, lalu ditutup
// dengan selesaikanGabung().
export const sinkronkan = async ({ cwd, target, pesanCommit, biarkan = false }) => {
  const { keluaran: kotor } = await git(["status", "--porcelain", "--untracked-files=no"], { cwd });
  if (kotor.trim()) {
    throw new Galat(409, `Masih ada perubahan yang belum di-commit di ${cwd} (${kotor.split("\n").slice(0, 5).map((b) => b.slice(3)).join(", ")}). Commit dulu (tahap Rilis), lalu sinkronkan.`);
  }
  const r = await git(["-c", "merge.conflictStyle=merge", "merge", "--no-ff", "--no-commit", target], { cwd, izinkanGagal: true });
  const sedangMerge = (await git(["rev-parse", "-q", "--verify", "MERGE_HEAD"], { cwd, izinkanGagal: true })).ok;
  if (!sedangMerge) {
    if (r.ok) return { status: "mutakhir", otomatis: [], tersisa: [] };
    throw new Galat(409, `Penggabungan ${target} gagal sebelum dimulai: ${r.galat || r.keluaran}`);
  }
  const batal = () => git(["merge", "--abort"], { cwd, izinkanGagal: true });
  try {
    const konflikAwal = await berkasKonflik(cwd);
    const otomatis = [];
    const tersisa = konflikAwal.filter((k) => !k.lengkap || !dikenal(k.path)).map((k) => k.path);
    if (tersisa.length && !biarkan) {
      await batal();
      return { status: "konflik", otomatis, tersisa, dikenal: konflikAwal.filter((k) => !tersisa.includes(k.path)).map((k) => k.path) };
    }
    const jalur = new Set(konflikAwal.map((k) => k.path).filter((p) => !tersisa.includes(p)));
    const tulisBerkas = (rel, teks) => fs.writeFileSync(path.join(cwd, rel), teks);
    const pakaiCrlf = (rel) => {
      try {
        return fs.readFileSync(path.join(cwd, rel), "utf8").includes("\r\n");
      } catch {
        return false;
      }
    };

    // 1. Katalog: gabung per entri dari tahap indeks (titik cabang, item, target).
    if (jalur.has(KATALOG)) {
      try {
        const teks = gabungJson(await tampil(cwd, `:1:${KATALOG}`), await tampil(cwd, `:2:${KATALOG}`), await tampil(cwd, `:3:${KATALOG}`));
        tulisBerkas(KATALOG, pakaiCrlf(KATALOG) ? teks.replace(/\n/g, "\r\n") : teks);
        otomatis.push({ path: KATALOG, cara: "katalog digabung per entri (modul/fitur/bagian/preset)" });
      } catch (e) {
        tersisa.push(KATALOG);
        otomatis.push({ path: KATALOG, cara: `tidak bisa digabung otomatis: ${e.message}` });
      }
    }

    // 2. Daftar sisipan & CHANGELOG.
    const mb = (await git(["merge-base", "HEAD", "MERGE_HEAD"], { cwd, izinkanGagal: true })).keluaran;
    const konteks = { modulTersedia: modulTersediaItem(bacaJson(await tampil(cwd, `${mb}:${KATALOG}`)), bacaJson(await tampil(cwd, `HEAD:${KATALOG}`))) };
    for (const rel of [...jalur].filter((p) => Object.hasOwn(ATURAN_DAFTAR, p))) {
      const hasil = selesaikanTeks(fs.readFileSync(path.join(cwd, rel), "utf8"), ATURAN_DAFTAR[rel], konteks);
      if (hasil == null) {
        tersisa.push(rel);
        continue;
      }
      tulisBerkas(rel, hasil);
      if (/\.(c|m)?js$/.test(rel) && !(await jalankanNode(["--check", rel], cwd)).ok) {
        tersisa.push(rel);
        continue;
      }
      otomatis.push({ path: rel, cara: rel === "CHANGELOG.md" ? "entri kedua sisi digabung" : "daftar sisipan digabung" });
    }

    if (biarkan && tersisa.length) {
      // Yang dikenal & berhasil diselesaikan ditandai selesai; sisanya menunggu. Dokumen katalog dibuat ulang saat ditutup.
      if (jalur.has(DOK_KATALOG)) {
        tulisBerkas(DOK_KATALOG, (await tampil(cwd, `:3:${DOK_KATALOG}`)) ?? "");
        otomatis.push({ path: DOK_KATALOG, cara: "dibuat ulang dari katalog saat penggabungan ditutup" });
      }
      const selesai = otomatis.filter((o) => !tersisa.includes(o.path)).map((o) => o.path);
      if (selesai.length) await git(["add", "--", ...selesai], { cwd });
      return { status: "menunggu", otomatis: otomatis.filter((o) => !tersisa.includes(o.path)), tersisa: [...new Set(tersisa)] };
    }

    // 3. Dokumen hasil skrip: dibuat ulang dari katalog hasil penggabungan.
    if (!tersisa.length && (jalur.has(DOK_KATALOG) || jalur.has(KATALOG)) && fs.existsSync(path.join(cwd, "scripts", "dokumen-katalog.mjs"))) {
      if (jalur.has(DOK_KATALOG)) tulisBerkas(DOK_KATALOG, (await tampil(cwd, `:3:${DOK_KATALOG}`)) ?? "");
      const g = await jalankanNode(["scripts/dokumen-katalog.mjs"], cwd);
      if (!g.ok) tersisa.push(DOK_KATALOG);
      else {
        await git(["add", "--", DOK_KATALOG], { cwd, izinkanGagal: true });
        if (jalur.has(DOK_KATALOG)) otomatis.push({ path: DOK_KATALOG, cara: "dibuat ulang: node scripts/dokumen-katalog.mjs" });
      }
    } else if (jalur.has(DOK_KATALOG)) tersisa.push(DOK_KATALOG);

    if (tersisa.length) {
      await batal();
      return { status: "konflik", otomatis: otomatis.filter((o) => !tersisa.includes(o.path)), tersisa: [...new Set(tersisa)] };
    }
    await git(["add", "--", ...jalur], { cwd });
    if ((await git(["diff", "--name-only", "--diff-filter=U"], { cwd })).keluaran.trim()) throw new Error("masih ada berkas berkonflik setelah diselesaikan");

    // 4. Integritas lintas berkas (menu, katalog, migrasi kembar, fragmen CHANGELOG) sebelum commit.
    if (fs.existsSync(path.join(cwd, "scripts", "cek-integritas.mjs"))) {
      const cek = await jalankanNode(["scripts/cek-integritas.mjs"], cwd);
      if (!cek.ok) {
        await batal();
        return { status: "gagal_integritas", otomatis, tersisa: [], integritas: cek.keluaran.slice(-2000) };
      }
    }

    const berkasPesan = path.join(os.tmpdir(), `simrs-studio-sinkron-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
    const ringkas = otomatis.length ? `\n\nDiselesaikan otomatis:\n${otomatis.map((o) => `- ${o.path}: ${o.cara}`).join("\n")}` : "";
    fs.writeFileSync(berkasPesan, `${pesanCommit}${ringkas}\n`, "utf8");
    try {
      await git(["commit", "-F", berkasPesan], { cwd });
    } finally {
      fs.rmSync(berkasPesan, { force: true });
    }
    return { status: "digabung", sha: (await git(["rev-parse", "HEAD"], { cwd })).keluaran, otomatis, tersisa: [] };
  } catch (e) {
    await batal();
    throw e;
  }
};

// Tutup penggabungan yang dibiarkan (sinkronkan biarkan): semua penanda konflik harus sudah hilang. Dokumen katalog
// dibuat ulang, berkas JS yang berkonflik dicek sintaksnya, lalu cek integritas sebelum commit. Penggabungan tidak
// dibatalkan bila gagal — perbaiki lalu ulangi, atau batalGabung().
export const selesaikanGabung = async ({ cwd, pesanCommit }) => {
  if (!(await sedangMenggabung(cwd))) throw new Galat(409, "Tidak ada penggabungan yang sedang berjalan di branch item");
  const konflik = (await berkasKonflik(cwd)).map((k) => k.path);
  // Penanda dicari di semua berkas yang berubah terhadap HEAD, bukan hanya yang masih berstatus konflik: berkas yang
  // sudah di-git add tanpa dibersihkan pun tertangkap.
  const berubah = (await git(["diff", "--name-only", "HEAD"], { cwd, izinkanGagal: true })).keluaran.split("\n").filter(Boolean);
  const berpenanda = masihBerpenanda(cwd, [...new Set([...konflik, ...berubah])]);
  if (berpenanda.length) {
    throw new Galat(409, `Masih ada penanda konflik (<<<<<<< ======= >>>>>>>) di: ${berpenanda.join(", ")}. Selesaikan dulu di VS Code atau minta agen, lalu tutup lagi.`);
  }
  for (const rel of konflik) {
    const ada = fs.existsSync(path.join(cwd, rel));
    await git(ada ? ["add", "--", rel] : ["rm", "-q", "--", rel], { cwd });
  }
  // Berkas hasil penyatuan = berbeda dari kedua sisi (item & target), termasuk yang sudah di-git add lebih dulu.
  const bedaTarget = new Set((await git(["diff", "--name-only", "MERGE_HEAD"], { cwd, izinkanGagal: true })).keluaran.split("\n").filter(Boolean));
  const disatukan = [...new Set([...konflik, ...berubah])].filter((p) => bedaTarget.has(p)).sort();
  const masalah = [];
  for (const rel of konflik.filter((p) => /\.(c|m)?js$/.test(p) && fs.existsSync(path.join(cwd, p)))) {
    const r = await jalankanNode(["--check", rel], cwd);
    if (!r.ok) masalah.push(`${rel}: ${r.keluaran.split("\n").slice(0, 4).join(" ")}`);
  }
  if (masalah.length) throw new Galat(409, `Sintaks JavaScript rusak setelah konflik diselesaikan — ${masalah.join("; ")}`);
  if (fs.existsSync(path.join(cwd, "scripts", "dokumen-katalog.mjs"))) {
    const g = await jalankanNode(["scripts/dokumen-katalog.mjs"], cwd);
    if (!g.ok) throw new Galat(409, `Dokumen katalog gagal dibuat ulang (katalog modul mungkin tidak valid): ${g.keluaran.slice(-500)}`);
    await git(["add", "--", DOK_KATALOG], { cwd, izinkanGagal: true });
  }
  if (fs.existsSync(path.join(cwd, "scripts", "cek-integritas.mjs"))) {
    const cek = await jalankanNode(["scripts/cek-integritas.mjs"], cwd);
    if (!cek.ok) throw new Galat(409, `Cek integritas gagal — perbaiki lalu tutup lagi:\n${cek.keluaran.slice(-1500)}`);
  }
  // Hanya berkas yang dilacak git (termasuk hasil penyelesaian); berkas baru yang belum tercatat tidak ikut.
  await git(["add", "-u"], { cwd });
  if ((await git(["diff", "--name-only", "--diff-filter=U"], { cwd })).keluaran.trim()) throw new Galat(409, "Masih ada berkas berstatus konflik");
  const berkasPesan = path.join(os.tmpdir(), `simrs-studio-tutup-gabung-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(berkasPesan, `${pesanCommit}\n\nKonflik diselesaikan: ${disatukan.join(", ") || "-"}\n`, "utf8");
  try {
    await git(["commit", "-F", berkasPesan], { cwd });
  } finally {
    fs.rmSync(berkasPesan, { force: true });
  }
  return { sha: (await git(["rev-parse", "HEAD"], { cwd })).keluaran, berkas: disatukan };
};

export const batalGabung = async ({ cwd }) => {
  if (!(await sedangMenggabung(cwd))) throw new Galat(409, "Tidak ada penggabungan yang sedang berjalan di branch item");
  // merge --abort menolak bila berkas yang sudah di-stage diubah lagi. Penggabungan hanya dimulai dari working tree
  // bersih (sinkronkan), jadi semua perubahan berkas terlacak adalah hasil penggabungan: aman dikembalikan ke HEAD.
  if (!(await git(["merge", "--abort"], { cwd, izinkanGagal: true })).ok) await git(["reset", "--hard", "HEAD"], { cwd });
};
