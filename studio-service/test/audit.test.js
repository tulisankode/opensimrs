import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { endpointDalamKode, imporRelatif, pembungkusDalamKode, periksaBerkas, pernyataanSql, skemaDariTeks, skorBerkasRute, tabelDalamSql, tujuanEndpoint } from "../src/audit.js";

const temuanDari = (berkas, skema = null) => periksaBerkas(berkas, skema).hasil();
const judul = (temuan) => temuan.map((t) => `${t.aspek}:${t.judul}`);

test("skemaDariTeks: schema.sql, migrasi biasa, dan tabel dinamis berawalan + konstanta kolom", () => {
  const skema = skemaDariTeks({
    schemaSql: "CREATE TABLE public.pasien (\n    uuid character varying(255),\n    faskes_uuid character varying(255),\n    deleted_at integer\n);\n",
    migrasi: [
      "await q(`CREATE TABLE IF NOT EXISTS lab_order (uuid VARCHAR(255), faskes_uuid VARCHAR(255), created_at BIGINT)`);",
      "const WAKTU = 'created_at BIGINT, deleted_at BIGINT';\nconst tabel = {\n  periode: `tahun INTEGER`,\n};\nawait q(`CREATE TABLE IF NOT EXISTS hr_gaji_${nama} (uuid VARCHAR(255), faskes_uuid VARCHAR(255), ${kolom}, ${WAKTU})`);",
    ],
  });
  assert.deepEqual(skema.get("pasien"), { faskes: true, deletedAt: true });
  assert.deepEqual(skema.get("lab_order"), { faskes: true, deletedAt: false });
  assert.deepEqual(skema.get("hr_gaji_periode"), { faskes: true, deletedAt: true });
});

test("tabelDalamSql: alias, LEFT JOIN, CTE, fungsi, dan EXTRACT tidak dianggap tabel", () => {
  const t = tabelDalamSql(`WITH ringkas AS (SELECT 1) SELECT p.nama, EXTRACT(EPOCH FROM now()) FROM pasien p
    LEFT JOIN kunjungan k ON k.pasien_uuid = p.uuid JOIN ringkas r ON true, generate_series(1, 3) g`);
  assert.deepEqual(t.map((x) => [x.nama, x.alias, x.peran]), [["pasien", "p", "from"], ["kunjungan", "k", "leftjoin"]]);
  assert.deepEqual(tabelDalamSql("INSERT INTO hd_jadwal (uuid) VALUES ($1)").map((x) => x.nama), ["hd_jadwal"]);
});

test("periksaBerkas backend: query, relasi, logika, dan keamanan", () => {
  const skema = new Map([["pasien", { faskes: true, deletedAt: true }], ["kunjungan", { faskes: true, deletedAt: true }]]);
  const isi = [
    "rute.get(\"/pasien\", async (req, res) => {",
    "  const f = req.body.faskes_uuid;",
    "  const rows = await query(`SELECT * FROM pasien p JOIN kunjungan k ON k.pasien_uuid = p.uuid WHERE p.nama = '${req.query.nama}' ORDER BY p.nama`);",
    "  const lama = await query(`SELECT p.uuid FROM pasien p WHERE p.faskes_uuid = :f AND p.deleted_at IS NULL AND p.created_at<:sampai`);",
    "  items.forEach(async (x) => { await simpan(x); });",
    "  try { await query(`UPDATE pasien SET nama = :n`); } catch {}",
    "});",
  ].join("\n");
  const temuan = temuanDari({ path: "x-service/src/pasien/rute.js", isi, jenis: "backend" }, skema);
  const j = judul(temuan);
  for (const harap of [
    "keamanan:faskes_uuid dari masukan pengguna", "keamanan:Masukan pengguna disisipkan ke SQL", "keamanan:Query tanpa isolasi faskes",
    "query:SELECT *", "query:Daftar tanpa batas baris", "query:Data terhapus ikut terbaca", "query:Parameter menempel pada \"<\"",
    "relasi:JOIN ke baris yang sudah dihapus", "logika:forEach dengan fungsi async", "logika:Galat ditelan diam-diam", "logika:UPDATE/DELETE tanpa WHERE",
  ]) assert.ok(j.includes(harap), `harus ada ${harap}; dapat: ${j.join(" | ")}`);
  const sisipan = temuan.find((t) => t.judul === "Masukan pengguna disisipkan ke SQL");
  assert.equal(sisipan.tingkat, "tinggi");
  assert.equal(sisipan.bukti[0].baris, 3);
});

test("periksaBerkas backend: pola aman tidak ditandai", () => {
  const skema = new Map([["pasien", { faskes: true, deletedAt: true }]]);
  const isi = [
    "const where = `faskes_uuid = $1 AND deleted_at IS NULL`;",
    "const rows = await query(`SELECT uuid, ${NAMA(\"p\")} FROM pasien p WHERE ${where} ${filter.unit ? \"AND unit_uuid = :unit\" : \"\"} ORDER BY nama LIMIT $${params.length + 1}`);",
    "const nomor = await satu(`SELECT COALESCE(MAX(nomor),0)+1 AS n FROM pasien WHERE faskes_uuid = $1`);",
    "const t = Math.floor(Date.now() / 1000);",
  ].join("\n");
  const temuan = temuanDari({ path: "x-service/src/pasien/data.js", isi, jenis: "backend" }, skema);
  const kecuali = temuan.filter((t) => !(t.judul === "Data terhapus ikut terbaca" && t.tingkat === "rendah"));
  assert.deepEqual(judul(kecuali), []);
});

test("periksaBerkas frontend: dialog peramban, isian UUID, v-html, import main; label dinamis aman", () => {
  const isi = [
    "<template><Card><PageToolbar /><label>UUID permintaan <input /></label><div v-html=\"isi\" /></Card></template>",
    "<script setup>import x from \"@/main\";",
    "if (confirm(\"Hapus?\")) hapus();",
    "const opsi = { label: `Versi ${x.nomor}${x.versiAktifUuid === x.uuid ? \" · Efektif\" : \"\"}` };",
    "</script>",
  ].join("\n");
  const j = judul(temuanDari({ path: "frontend-service/src/views/X/XPage.vue", isi, jenis: "frontend" }));
  assert.deepEqual(j.sort(), ["fungsional:Dialog bawaan peramban", "fungsional:Import @/main melingkar", "fungsional:Pengguna diminta mengetik UUID", "keamanan:v-html"].sort());
});

test("endpoint frontend: helper apiXxx, instance axios, pembungkus berkonstanta & method store", () => {
  const store = [
    "const basis = \"/hr/penggajian\";",
    "export const bacaGaji = (path: string, params = {}) => apiPenunjangGet(`${basis}${path}${s ? `?${s}` : \"\"}`);",
    "export const useHdu = defineStore(\"hdu\", { actions: {",
    "  async baca(path: string) { const r = await baseInstanceRawatInap.get(`/hdu${path}`); return r.data; },",
    "} });",
  ].join("\n");
  const pembungkus = pembungkusDalamKode(store);
  assert.deepEqual(pembungkus.get("bacaGaji"), { helper: "Penunjang", awalan: "/hr/penggajian" });
  assert.deepEqual(pembungkus.get("baca"), { helper: "RawatInap", awalan: "/hdu" });
  const halaman = "await bacaGaji(`/periode/${uuid}/hasil`); await hdu.baca(\"/episode\"); await apiLaboratoriumGet(`/order${kueri({ a: 1 })}`);";
  const ep = endpointDalamKode(halaman, pembungkus);
  assert.deepEqual(ep.map((e) => `${e.helper} ${e.metode} ${e.path}`), ["Laboratorium GET /order", "Penunjang GET /hr/penggajian/periode/:p/hasil", "RawatInap GET /hdu/episode"]);
  assert.deepEqual(tujuanEndpoint({ path: "/api/v3/ranap/hdu/episode/01a13e12-9884-75d6-b632-e1b62d63c975" }), { layanan: "rawat-inap-service", segmen: ["hdu", "episode"] });
  assert.deepEqual(tujuanEndpoint({ path: "/hr/penggajian/periode/:p/hasil", helper: "Penunjang" }), { layanan: "penunjang-service", segmen: ["hr", "penggajian", "periode", "hasil"] });
});

test("skorBerkasRute: folder & nama berkas yang cocok menang atas berkas lain bersegmen sama", () => {
  const berkas = [
    { path: "penunjang-service/src/fisioterapi/jadwal.js", isi: "rute.get(\"/jadwal\", f)" },
    { path: "penunjang-service/src/hr/jadwal-dinas/rute.js", isi: "const rute = express.Router();\ndaftar(\"get\", \"/jadwal\", f);\nfor (const j of [\"pola-shift\"]) daftar(\"get\", `/${j}`, g);" },
    { path: "rawat-inap-service/src/routes/nicu-routes.js", isi: "router.get(\"/episode\", f)" },
    { path: "rawat-inap-service/src/routes/hdu-routes.js", isi: "router.get(\"/episode\", f)" },
  ];
  assert.deepEqual(skorBerkasRute(["hr", "jadwal-dinas", "jadwal"], berkas).map((b) => b.path), ["penunjang-service/src/hr/jadwal-dinas/rute.js"]);
  assert.deepEqual(skorBerkasRute(["hr", "jadwal-dinas", "pola-shift"], berkas).map((b) => b.path), ["penunjang-service/src/hr/jadwal-dinas/rute.js"]);
  assert.deepEqual(skorBerkasRute(["hdu", "episode"], berkas).map((b) => b.path), ["rawat-inap-service/src/routes/hdu-routes.js"]);
  assert.deepEqual(skorBerkasRute(["tidak-ada"], berkas), []);
});

test("pernyataanSql: hanya string berisi SQL huruf besar, dengan nomor baris", () => {
  const s = pernyataanSql("const a = \"select dari menu\";\nconst b = `SELECT uuid FROM pasien`;\nconst c = 'DELETE FROM x WHERE uuid = $1';");
  assert.deepEqual(s.map((x) => x.baris), [2, 3]);
});

test("regresi audit 2026-10-21: pola aman di BPJS, datamaster, dan fragmen SQL tidak lagi ditandai", () => {
  const skema = new Map([["mcu_pcare_kirim", { faskes: true, deletedAt: true }], ["integrations", { faskes: true, deletedAt: false }],
    ["bpjs_vclaim_surat", { faskes: true, deletedAt: true }]]);
  const isi = [
    "// Template bersarang: WHERE ada setelah ${kolom.map(...)} — dulu terbaca separuh (\"UPDATE tanpa WHERE\").",
    "await query(`UPDATE mcu_pcare_kirim SET ${kolom.map((c, i) => `${c} = $${i + 1}`).join(\", \")} WHERE uuid = $${kolom.length + 1}`, [...nilai, uuid]);",
    "await query(`UPDATE integrations SET pcare_aktif = $2, updated_at = $3 WHERE id = $1`, [baris.id, aktif, t]);",
    "const PILIH_SURAT = `SELECT *, to_char(tgl_rencana, 'YYYY-MM-DD') AS teks FROM bpjs_vclaim_surat`;",
    "const s = await satu(`${PILIH_SURAT} WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [f]);",
    "req.body.faskes_uuid = req.author.faskesUuid;",
    "const pola = /[`'\"]/g;",
  ].join("\n");
  const temuan = temuanDari({ path: "bpjs-service/src/pcare.js", isi, jenis: "backend" }, skema);
  const j = judul(temuan);
  assert.ok(!j.includes("logika:UPDATE/DELETE tanpa WHERE"), j.join(" | "));
  assert.ok(!j.includes("keamanan:faskes_uuid dari masukan pengguna"), j.join(" | "));
  assert.ok(!j.includes("keamanan:Query tanpa isolasi faskes"), j.join(" | "));
  assert.ok(temuan.filter((t) => t.judul === "Akses per kunci tanpa faskes_uuid").every((t) => t.tingkat === "rendah"));
  // Baris 5 (`${PILIH_SURAT} WHERE …`) bukan pernyataan utuh; baris 7 (regex berisi kutip) tidak merusak pemindaian.
  assert.deepEqual(pernyataanSql(isi).map((s) => s.baris), [2, 3, 4]);
  assert.equal(pernyataanSql(isi)[2].konstanta, true);
});

test("skorBerkasRute: nama berkas yang tidak cocok tidak mengurangi skor (surat-router.js melayani /general-consent)", () => {
  const berkas = [
    { path: "datamaster-service/src/routers/surat-router.js", isi: "suratRouter.get(\"/general-consent\", f);" },
    { path: "datamaster-service/src/routers/kategori_ruangan-router.js", isi: "router.get(\n  \"/kategori_ruangan\",\n  f);" },
  ];
  assert.deepEqual(skorBerkasRute(["datamaster", "general-consent"], berkas).map((b) => b.path), ["datamaster-service/src/routers/surat-router.js"]);
  assert.deepEqual(skorBerkasRute(["datamaster", "kategori_ruangan", "aktif"], berkas.map((b) => ({ ...b, isi: `${b.isi}\nrouter.get("/kategori_ruangan/aktif", g);` })))
    .map((b) => b.path), ["datamaster-service/src/routers/kategori_ruangan-router.js"]);
});

test("imporRelatif: router pusat hanya membawa controller endpoint halaman (bukan semua datamaster Farmasi)", () => {
  const berkas = "farmasi-service/src/routes/routes.js";
  const isi = readFileSync(new URL(`../../${berkas}`, import.meta.url), "utf8");
  const abs = fileURLToPath(new URL(`../../${berkas}`, import.meta.url));
  const semua = imporRelatif(abs, isi);
  const satuan = imporRelatif(abs, isi, new Set(["/datamaster/satuan", "/datamaster/:"]));
  assert.ok(semua.length > 5);
  assert.deepEqual(satuan.map((p) => path.basename(p)), ["datamaster-satuan-controller.js"]);
});
