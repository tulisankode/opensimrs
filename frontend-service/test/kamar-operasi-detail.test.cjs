const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const vue = require("vue");
const ts = require("typescript");
const { parse, compileScript, compileTemplate } = require("@vue/compiler-sfc");

const filename = path.resolve(__dirname, "../src/views/KamarOperasi/Komponen/DialogDetailOperasi.vue");
const { descriptor, errors } = parse(fs.readFileSync(filename, "utf8"), { filename });
const skrip = compileScript(descriptor, { id: "detail-operasi-uji" });
const templat = compileTemplate({ source: descriptor.template.content, filename, id: "detail-operasi-uji", compilerOptions: { bindingMetadata: skrip.bindings } });
const hasil = ts.transpileModule(skrip.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });

function dialog(pengganti = {}) {
  const visible = vue.ref(false);
  const props = vue.reactive({ jadwalUuid: "jadwal-fiktif-a" });
  const api = new Proxy({
    izinOk: () => true,
    waktuOk: () => "21 Okt 2026",
    detailJadwalOk: async (uuid) => ({ payload: { uuid } }),
    ...pengganti,
  }, { get: (obj, nama) => obj[nama] ?? (async () => ({ payload: [] })) });
  const pembersih = [];
  const konteks = vm.createContext({ exports: {}, require: (nama) => {
    if (nama === "vue") return { ...vue, useModel: () => visible, onBeforeUnmount: (fn) => pembersih.push(fn) };
    if (nama === "@/stores/penunjang/kamarOperasi") return api;
    if (nama === "@/stores/utils") return { utilsStore: () => ({ setLoading() {} }) };
    if (nama.endsWith(".vue")) return {};
    throw new Error(`Impor uji tidak diizinkan: ${nama}`);
  } });
  vm.runInContext(hasil.outputText, konteks);
  const scope = vue.effectScope();
  const state = scope.run(() => konteks.exports.default.setup(props, { expose() {}, emit() {} }));
  return { state, visible, props, tutup() { pembersih.forEach((fn) => fn()); scope.stop(); } };
}
const tunggu = async () => { await vue.nextTick(); for (let i = 0; i < 10; i++) await Promise.resolve(); };
const tunda = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

test("skrip dan templat empat pilihan berlabel dapat dikompilasi", () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(templat.errors, []);
});

test("gagal memuat dibedakan dari kosong dan muat ulang tidak menghapus asesmen", async () => {
  let gagal = true;
  const d = dialog({ referensiPersetujuanOk: async () => gagal ? undefined : { payload: [] } });
  d.visible.value = true;
  await tunggu();
  d.state.praoperasi.value.asesmenPraBedah = "Asesmen fiktif";
  assert.match(d.state.statusPersetujuan.value.galat, /gagal dimuat/);
  assert.equal(d.state.statusPersetujuan.value.termuat, false);
  gagal = false;
  await d.state.muatPersetujuan();
  assert.equal(d.state.statusPersetujuan.value.galat, "");
  assert.equal(d.state.statusPersetujuan.value.termuat, true);
  assert.equal(d.state.praoperasi.value.asesmenPraBedah, "Asesmen fiktif");
  d.tutup();
});

test("respons lama diabaikan ketika berganti jadwal atau menutup dialog", async () => {
  const lama = tunda();
  const d = dialog({ referensiPersetujuanOk: (uuid) => uuid.endsWith("a") ? lama.promise : Promise.resolve({ payload: [{ uuid: "persetujuan-b" }] }) });
  d.visible.value = true;
  await tunggu();
  d.props.jadwalUuid = "jadwal-fiktif-b";
  await tunggu();
  lama.resolve({ payload: [{ uuid: "persetujuan-a" }] });
  await tunggu();
  assert.equal(d.state.daftarPersetujuan.value[0].uuid, "persetujuan-b");
  d.visible.value = false;
  await tunggu();
  assert.equal(d.state.daftarPersetujuan.value.length, 0);
  assert.equal(d.state.formPemakaian.value.itemMedisUuid, "");
  d.tutup();
});

test("pencarian item mengabaikan respons terlambat dan mempertahankan label pilihan", async () => {
  const lama = tunda();
  const d = dialog({ cariItemMedisOk: (cari) => cari === "lama" ? lama.promise : Promise.resolve({ payload: cari === "baru" ? [{ uuid: "item-c", code: "C", name: "Item fiktif C" }] : [{ uuid: "item-b", code: "B", name: "Item fiktif B" }] }) });
  d.visible.value = true;
  await tunggu();
  d.state.formPemakaian.value.itemMedisUuid = "item-b";
  const pencarian = d.state.cariItemMedis("lama");
  await d.state.cariItemMedis("baru");
  lama.resolve({ payload: [{ uuid: "item-a" }] });
  await pencarian;
  assert.equal(d.state.opsiItemMedis.value[0].uuid, "item-b");
  assert.equal(d.state.opsiItemMedis.value[1].uuid, "item-c");
  assert.match(d.state.opsiItemMedisTampil()[0].label, /Item fiktif B/);
  d.tutup();
});

test("simpan gagal mempertahankan isian dan klik ganda hanya mengirim sekali", async () => {
  const simpan = tunda();
  let jumlah = 0;
  const d = dialog({ simpanPraOperasiOk: () => { jumlah++; return simpan.promise; } });
  d.visible.value = true;
  await tunggu();
  d.state.praoperasi.value.asesmenPraBedah = "Asesmen fiktif";
  const pertama = d.state.simpanPra();
  await d.state.simpanPra();
  assert.equal(jumlah, 1);
  simpan.resolve(undefined);
  await pertama;
  assert.equal(d.state.praoperasi.value.asesmenPraBedah, "Asesmen fiktif");
  assert.equal(d.state.sedangSimpanPra.value, false);
  d.tutup();
});

test("tanpa izin baca sumber, pilihan tidak diminta", async () => {
  let jumlah = 0;
  const d = dialog({ izinOk: () => false, referensiPersetujuanOk: () => { jumlah++; }, daftarLokasiStokOk: () => { jumlah++; }, cariItemMedisOk: () => { jumlah++; } });
  d.visible.value = true;
  await tunggu();
  assert.equal(jumlah, 0);
  d.tutup();
});
