import express from "express";
import { query, satu, sisipkan, ubah, sekarang, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import {
  BENTUK, GRAM, JENIS_PEMERIKSAAN, KELOMPOK, PEWARNAAN, SPESIMEN, angkaOpsional, cekPilihan, daftarNilai, ramah, teks,
} from "./bersama.js";
import { izinMikro } from "../umum/izin.js";

// Datamaster Mikrobiologi: pemeriksaan, organisme, antibiotik & panel antibiotik per kelompok organisme.
// Setiap master memakai pola CRUD yang sama (daftar berpaginasi + cari + status, detail, tambah, ubah, hapus lunak).

const boolOpsional = (v) => (v === undefined ? undefined : Boolean(v));

// Pabrik router CRUD sederhana. `kolom(body)` memetakan & memvalidasi body; `filter(req, p)` menambah syarat WHERE.
// `fitur` = nama fitur Datamaster pada hak akses Mikrobiologi (CREATE/UPDATE/DELETE).
const crud = ({ tabel, nama, pilih, cari, urut, kolom, wajibIsi, filter, fitur }) => {
  const r = express.Router();
  const ambil = (uuid, faskes) => satu(`SELECT ${pilih} FROM ${tabel} WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskes]);

  r.get(
    "/",
    tangani(async (req, res) => {
      const pg = halaman(req.query);
      const p = [req.author.faskesUuid];
      let w = "faskes_uuid = $1 AND deleted_at IS NULL";
      if (req.query.cari) {
        p.push(`%${String(req.query.cari).trim()}%`);
        w += ` AND (${cari.map((c) => `${c} ILIKE $${p.length}`).join(" OR ")})`;
      }
      if (req.query.status !== undefined && req.query.status !== "") {
        p.push(["1", "true", "aktif"].includes(String(req.query.status)));
        w += ` AND status = $${p.length}`;
      }
      if (filter) w += filter(req, p);
      const total = (await satu(`SELECT COUNT(*) n FROM ${tabel} WHERE ${w}`, p)).n;
      const rows = await query(`SELECT ${pilih} FROM ${tabel} WHERE ${w} ORDER BY ${urut} LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
      kirim(res, denganHalaman(rows, total, pg));
    }),
  );

  r.get(
    "/:uuid",
    tangani(async (req, res) => {
      const t = await ambil(req.params.uuid, req.author.faskesUuid);
      if (!t) throw tidakDitemukan(nama);
      kirim(res, t);
    }),
  );

  r.post(
    "/",
    izinMikro("Datamaster", "CREATE", fitur),
    tangani(async (req, res) => {
      wajib(req.body, wajibIsi);
      const data = Object.fromEntries(Object.entries(kolom(req.body ?? {})).filter(([, v]) => v !== undefined));
      const t = await sisipkan(tabel, { faskes_uuid: req.author.faskesUuid, ...data, status: req.body.status ?? true }).catch((e) =>
        ramah(e, `Kode ${req.body.kode} sudah dipakai`),
      );
      kirim(res, await ambil(t.uuid, req.author.faskesUuid), `${nama} berhasil ditambahkan`);
    }),
  );

  r.put(
    "/:uuid",
    izinMikro("Datamaster", "UPDATE", fitur),
    tangani(async (req, res) => {
      const data = kolom(req.body ?? {});
      if (data.kode === "" || data.nama === "") throw permintaanSalah("kode dan nama tidak boleh kosong");
      const t = await ubah(tabel, req.params.uuid, req.author.faskesUuid, data).catch((e) => ramah(e, `Kode ${req.body.kode} sudah dipakai`));
      if (!t) throw tidakDitemukan(nama);
      kirim(res, await ambil(t.uuid, req.author.faskesUuid), `${nama} berhasil diperbarui`);
    }),
  );

  // Hapus lunak: hasil lama tetap menyimpan snapshot nama/kode.
  r.delete(
    "/:uuid",
    izinMikro("Datamaster", "DELETE", fitur),
    tangani(async (req, res) => {
      const t = await ubah(tabel, req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
      if (!t) throw tidakDitemukan(nama);
      kirim(res, { uuid: t.uuid }, `${nama} berhasil dihapus`);
    }),
  );
  return r;
};

const kodeNama = (b) => ({
  kode: b.kode === undefined ? undefined : String(b.kode).trim().toUpperCase(),
  nama: b.nama === undefined ? undefined : String(b.nama).trim(),
  keterangan: teks(b.keterangan),
  status: boolOpsional(b.status),
});

// ── Pemeriksaan ──────────────────────────────────────────────────────────────

export const pemeriksaan = crud({
  tabel: "mikro_pemeriksaan",
  fitur: "Pemeriksaan Mikrobiologi",
  nama: "Pemeriksaan mikrobiologi",
  pilih: `uuid, kode, nama, jenis, spesimen, dengan_pewarnaan, dengan_kultur, dengan_ast, metode, harga::float8 AS harga, tat_hari,
          kode_lis, keterangan, status, created_at, updated_at`,
  cari: ["kode", "nama", "metode"],
  urut: "array_position(ARRAY['kultur','pewarnaan','molekuler','serologi','lain']::varchar[], jenis), nama",
  wajibIsi: ["kode", "nama", "jenis"],
  filter: (req, p) => {
    let w = "";
    const jenis = daftarNilai(req.query.jenis);
    if (jenis.length) {
      p.push(jenis);
      w += ` AND jenis = ANY($${p.length})`;
    }
    if (req.query.spesimen) {
      p.push(String(req.query.spesimen));
      w += ` AND (cardinality(spesimen) = 0 OR $${p.length} = ANY(spesimen))`;
    }
    return w;
  },
  kolom: (b) => {
    const harga = angkaOpsional(b.harga, "harga");
    if (harga !== undefined && harga !== null && harga < 0) throw permintaanSalah("harga tidak valid");
    const tat = angkaOpsional(b.tat_hari, "tat_hari");
    if (tat !== undefined && tat !== null && (tat < 0 || tat > 90)) throw permintaanSalah("tat_hari harus 0–90");
    let spesimen;
    if (b.spesimen !== undefined) {
      if (!Array.isArray(b.spesimen)) throw permintaanSalah("spesimen harus berupa daftar");
      spesimen = [...new Set(b.spesimen.map(String))];
      const salah = spesimen.filter((s) => !SPESIMEN[s]);
      if (salah.length) throw permintaanSalah(`Jenis spesimen tidak dikenal: ${salah.join(", ")}`);
    }
    const ast = boolOpsional(b.dengan_ast);
    return {
      ...kodeNama(b),
      jenis: b.jenis === undefined ? undefined : cekPilihan(b.jenis, JENIS_PEMERIKSAAN, "jenis"),
      spesimen: spesimen === undefined ? undefined : `{${spesimen.join(",")}}`,
      dengan_pewarnaan: b.dengan_pewarnaan === undefined ? undefined : cekPilihan(b.dengan_pewarnaan || null, PEWARNAAN, "dengan_pewarnaan"),
      // Uji kepekaan hanya bermakna bila ada kultur.
      dengan_kultur: ast ? true : boolOpsional(b.dengan_kultur),
      dengan_ast: ast,
      metode: teks(b.metode),
      harga: harga === null ? 0 : harga,
      tat_hari: tat === null ? 1 : tat,
      kode_lis: teks(b.kode_lis),
    };
  },
});

// ── Organisme ────────────────────────────────────────────────────────────────

export const organisme = crud({
  tabel: "mikro_organisme",
  fitur: "Organisme",
  nama: "Organisme",
  pilih: `uuid, kode, nama, gram, bentuk, kelompok, kode_whonet, keterangan, status, created_at, updated_at`,
  cari: ["kode", "nama", "kode_whonet"],
  urut: "nama",
  wajibIsi: ["kode", "nama", "gram"],
  filter: (req, p) => {
    let w = "";
    for (const kol of ["gram", "kelompok"]) {
      const v = daftarNilai(req.query[kol]);
      if (!v.length) continue;
      p.push(v);
      w += ` AND ${kol} = ANY($${p.length})`;
    }
    return w;
  },
  kolom: (b) => ({
    ...kodeNama(b),
    nama: b.nama === undefined ? undefined : String(b.nama).trim(),
    gram: b.gram === undefined ? undefined : cekPilihan(b.gram, GRAM, "gram"),
    bentuk: b.bentuk === undefined ? undefined : cekPilihan(b.bentuk || null, BENTUK, "bentuk"),
    kelompok: b.kelompok === undefined ? undefined : cekPilihan(b.kelompok || "LAIN", KELOMPOK, "kelompok"),
    kode_whonet: teks(b.kode_whonet),
  }),
});

// ── Antibiotik ───────────────────────────────────────────────────────────────

const breakpoint = (b) => {
  const bp = {
    bp_zona_s: angkaOpsional(b.bp_zona_s, "bp_zona_s"),
    bp_zona_r: angkaOpsional(b.bp_zona_r, "bp_zona_r"),
    bp_mic_s: angkaOpsional(b.bp_mic_s, "bp_mic_s"),
    bp_mic_r: angkaOpsional(b.bp_mic_r, "bp_mic_r"),
  };
  if (bp.bp_zona_s != null && bp.bp_zona_r != null && bp.bp_zona_r >= bp.bp_zona_s) throw permintaanSalah("Breakpoint zona: nilai R harus lebih kecil dari S");
  if (bp.bp_mic_s != null && bp.bp_mic_r != null && bp.bp_mic_r <= bp.bp_mic_s) throw permintaanSalah("Breakpoint MIC: nilai R harus lebih besar dari S");
  return bp;
};
const PILIH_BP = `bp_zona_s::float8 AS bp_zona_s, bp_zona_r::float8 AS bp_zona_r, bp_mic_s::float8 AS bp_mic_s, bp_mic_r::float8 AS bp_mic_r`;

export const antibiotik = crud({
  tabel: "mikro_antibiotik",
  fitur: "Antibiotik",
  nama: "Antibiotik",
  pilih: `uuid, kode, nama, golongan, potensi_disk, ${PILIH_BP}, standar_bp, keterangan, status, created_at, updated_at`,
  cari: ["kode", "nama", "golongan"],
  urut: "golongan NULLS LAST, nama",
  wajibIsi: ["kode", "nama"],
  filter: (req, p) => {
    if (!req.query.golongan) return "";
    p.push(String(req.query.golongan));
    return ` AND golongan = $${p.length}`;
  },
  kolom: (b) => ({ ...kodeNama(b), golongan: teks(b.golongan), potensi_disk: teks(b.potensi_disk), standar_bp: teks(b.standar_bp), ...breakpoint(b) }),
});

// ── Panel antibiotik per kelompok organisme ──────────────────────────────────

export const panel = express.Router();

export const daftarPanel = (faskes, kelompok, k) =>
  query(
    `SELECT pa.uuid, pa.kelompok, pa.antibiotik_uuid, pa.urutan,
            pa.bp_zona_s::float8 AS bp_zona_s, pa.bp_zona_r::float8 AS bp_zona_r, pa.bp_mic_s::float8 AS bp_mic_s, pa.bp_mic_r::float8 AS bp_mic_r,
            a.kode, a.nama, a.golongan, a.potensi_disk, a.status,
            a.bp_zona_s::float8 AS ab_zona_s, a.bp_zona_r::float8 AS ab_zona_r, a.bp_mic_s::float8 AS ab_mic_s, a.bp_mic_r::float8 AS ab_mic_r
       FROM mikro_panel_antibiotik pa JOIN mikro_antibiotik a ON a.uuid = pa.antibiotik_uuid AND a.deleted_at IS NULL
      WHERE pa.faskes_uuid = $1 AND pa.deleted_at IS NULL ${kelompok ? "AND pa.kelompok = $2" : ""}
      ORDER BY pa.kelompok, pa.urutan, a.nama`,
    kelompok ? [faskes, kelompok] : [faskes],
    k,
  );

// Ringkasan semua kelompok (jumlah antibiotik per panel).
panel.get(
  "/",
  tangani(async (req, res) => {
    const kelompok = req.query.kelompok ? cekPilihan(String(req.query.kelompok), KELOMPOK, "kelompok") : null;
    if (kelompok) return kirim(res, await daftarPanel(req.author.faskesUuid, kelompok));
    const jumlah = await query(
      `SELECT kelompok, COUNT(*)::int AS jumlah FROM mikro_panel_antibiotik WHERE faskes_uuid = $1 AND deleted_at IS NULL GROUP BY kelompok`,
      [req.author.faskesUuid],
    );
    kirim(res, Object.entries(KELOMPOK).map(([kode, nama]) => ({ kode, nama, jumlah: jumlah.find((j) => j.kelompok === kode)?.jumlah ?? 0 })));
  }),
);

// Panel untuk satu organisme (kelompok organisme) — dipakai form AST.
panel.get(
  "/organisme/:uuid",
  tangani(async (req, res) => {
    const o = await satu(`SELECT kelompok FROM mikro_organisme WHERE uuid = $1 AND faskes_uuid = $2`, [req.params.uuid, req.author.faskesUuid]);
    if (!o) throw tidakDitemukan("Organisme");
    kirim(res, await daftarPanel(req.author.faskesUuid, o.kelompok));
  }),
);

// Ganti isi panel satu kelompok: body { items: [{ antibiotik_uuid, bp_zona_s?, bp_zona_r?, bp_mic_s?, bp_mic_r? }] } (urutan = posisi).
panel.put(
  "/:kelompok",
  izinMikro("Datamaster", "UPDATE", "Antibiotik"),
  tangani(async (req, res) => {
    const kelompok = cekPilihan(req.params.kelompok, KELOMPOK, "kelompok");
    const items = req.body?.items;
    if (!Array.isArray(items)) throw permintaanSalah("items harus berupa daftar");
    const faskes = req.author.faskesUuid;
    const uuids = items.map((i) => i?.antibiotik_uuid).filter(Boolean);
    if (uuids.length !== items.length) throw permintaanSalah("antibiotik_uuid wajib diisi pada setiap baris");
    if (new Set(uuids).size !== uuids.length) throw permintaanSalah("Antibiotik ganda dalam panel");
    const ada = await query(`SELECT uuid FROM mikro_antibiotik WHERE uuid = ANY($1) AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuids, faskes]);
    if (ada.length !== uuids.length) throw permintaanSalah("Sebagian antibiotik tidak ditemukan");
    await transaksi(async (k) => {
      await query(`UPDATE mikro_panel_antibiotik SET deleted_at = $3 WHERE faskes_uuid = $1 AND kelompok = $2 AND deleted_at IS NULL`, [faskes, kelompok, sekarang()], k);
      for (const [n, i] of items.entries()) {
        await sisipkan("mikro_panel_antibiotik", { faskes_uuid: faskes, kelompok, antibiotik_uuid: i.antibiotik_uuid, urutan: n + 1, ...breakpoint(i) }, k);
      }
    });
    kirim(res, await daftarPanel(faskes, kelompok), `Panel ${KELOMPOK[kelompok]} disimpan (${items.length} antibiotik)`);
  }),
);
