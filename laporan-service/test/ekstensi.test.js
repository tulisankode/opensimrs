import { test } from "node:test";
import assert from "node:assert/strict";
import { bersihkanIsian, parameterDalamSql, siapkanParameter, validasiEkstensi, validasiSql } from "../src/ekstensi/validasi.js";

const laporan = (sql, parameter = []) => ({
  kode: "kunjungan_penjamin",
  jenis: "laporan",
  nama: "Kunjungan per penjamin",
  versi: "1.0.0",
  definisi: { sql, parameter, kolom: [{ field: "penjamin", label: "Penjamin" }, { field: "jumlah", label: "Jumlah", format: "angka" }] },
});

test("laporan SELECT dengan filter faskes & parameter terdeklarasi lulus", () => {
  const e = laporan(
    "SELECT p.name AS penjamin, COUNT(*)::int AS jumlah FROM rawat_jalans r JOIN penjamin p ON p.uuid = r.penjamin_uuid WHERE r.faskes_uuid = :faskes_uuid AND r.created_at >= :mulai GROUP BY p.name",
    [{ nama: "mulai", label: "Dari", tipe: "tanggal", wajib: true }],
  );
  assert.deepEqual(validasiEkstensi(e), []);
});

test("perintah tulis, multi-pernyataan, komentar ditolak", () => {
  assert.ok(validasiSql("DELETE FROM patients WHERE faskes_uuid = :faskes_uuid").some((g) => /SELECT atau WITH/.test(g)));
  assert.ok(validasiSql("SELECT 1 WHERE :faskes_uuid IS NOT NULL; DROP TABLE x").some((g) => /titik koma/.test(g)));
  assert.ok(validasiSql("WITH x AS (UPDATE patients SET name = 'a' RETURNING *) SELECT * FROM x WHERE :faskes_uuid = :faskes_uuid").some((g) => /UPDATE/.test(g)));
  assert.ok(validasiSql("SELECT * FROM patients -- komentar\nWHERE faskes_uuid = :faskes_uuid").some((g) => /Komentar/.test(g)));
  assert.ok(validasiSql("SELECT * INTO salinan FROM patients WHERE faskes_uuid = :faskes_uuid").some((g) => /INTO/.test(g)));
});

test("tabel/kolom sensitif & fungsi sistem ditolak", () => {
  assert.ok(validasiSql("SELECT username FROM users WHERE faskes_uuid = :faskes_uuid").some((g) => /akun/.test(g)));
  assert.ok(validasiSql("SELECT pg_sleep(10) WHERE :faskes_uuid IS NOT NULL").some((g) => /pg_/.test(g)));
  assert.ok(validasiSql("SELECT client_secret FROM faskes WHERE uuid = :faskes_uuid").some((g) => /rahasia/.test(g)));
  assert.ok(validasiSql("SELECT * FROM studio_item WHERE faskes_uuid = :faskes_uuid").some((g) => /Studio/.test(g)));
});

test("wajib :faskes_uuid; parameter asing ditolak; cast :: bukan parameter", () => {
  assert.ok(validasiSql("SELECT COUNT(*) FROM patients").some((g) => /faskes_uuid/.test(g)));
  assert.ok(validasiSql("SELECT * FROM patients WHERE faskes_uuid = :faskes_uuid AND name = :nama").some((g) => /:nama/.test(g)));
  assert.deepEqual(parameterDalamSql("SELECT x::int, y::text FROM t WHERE a = :faskes_uuid AND b > :mulai"), ["faskes_uuid", "mulai"]);
});

test("parameter: faskes dari token, wajib, tipe", () => {
  const def = { parameter: [{ nama: "mulai", tipe: "tanggal", wajib: true }, { nama: "status", tipe: "pilihan", pilihan: ["aktif", "selesai"] }] };
  const r = siapkanParameter(def, { mulai: "1790000000", status: "aktif", faskes_uuid: "PALSU" }, "FASKES-TOKEN");
  assert.deepEqual(r.galat, []);
  assert.equal(r.nilai.faskes_uuid, "FASKES-TOKEN");
  assert.equal(r.nilai.mulai, 1790000000);
  assert.ok(siapkanParameter(def, { status: "lain" }, "F").galat.length === 2);
});

test("formulir: validasi definisi & isian", () => {
  const f = {
    kode: "skrining_gizi",
    jenis: "formulir",
    nama: "Skrining gizi",
    definisi: { izin_modul: "Rekam Medis", kaitan: "kunjungan", field: [{ kode: "bb", label: "Berat badan", tipe: "angka", wajib: true }, { kode: "risiko", label: "Risiko", tipe: "pilihan", pilihan: ["rendah", "tinggi"] }] },
  };
  assert.deepEqual(validasiEkstensi(f), []);
  assert.deepEqual(bersihkanIsian(f.definisi, { bb: "61.5", risiko: "tinggi", asing: "x" }), { galat: [], isian: { bb: 61.5, risiko: "tinggi" } });
  assert.equal(bersihkanIsian(f.definisi, { risiko: "sedang" }).galat.length, 2);
});
