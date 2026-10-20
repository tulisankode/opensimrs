const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { randomUUID } = require("node:crypto");
const vue = require("vue");
const ts = require("typescript");
const { parse, compileScript, compileTemplate } = require("@vue/compiler-sfc");

const akar = path.resolve(__dirname, "..");
const filename = path.join(akar, "src/views/Picu/PicuPage.vue");
const { descriptor, errors } = parse(fs.readFileSync(filename, "utf8"), { filename });
assert.deepEqual(errors, []);
const skrip = compileScript(descriptor, { id: "picu-uji" });
const templat = compileTemplate({ source: descriptor.template.content, filename, id: "picu-uji", compilerOptions: { bindingMetadata: skrip.bindings } });

function evaluasi(sumber, modul) {
  const hasil = ts.transpileModule(sumber, { reportDiagnostics: true, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } });
  assert.equal(hasil.diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0);
  const exports = {};
  const context = vm.createContext({ exports, require: (nama) => {
    if (!(nama in modul)) throw new Error(`Impor tidak diizinkan pada uji PICU: ${nama}`);
    return modul[nama];
  }, URLSearchParams, crypto: { randomUUID }, console });
  vm.runInContext(hasil.outputText, context);
  return exports;
}
function halaman(api) {
  const route = vue.reactive({ path: "/picu/dashboard", fullPath: "/picu/dashboard", params: {} });
  const auth = vue.reactive({ faskesUuid: "faskes-sintetis-001" });
  const pembersih = [];
  const modul = {
    vue: { ...vue, onBeforeUnmount: (fn) => pembersih.push(fn) },
    "vue-router": { useRoute: () => route, useRouter: () => ({ push: async () => {} }) },
    "@/stores/rawatInap/picu": { usePicuStore: () => api },
    "@/stores/auth": { useAuthStore: () => auth },
    "@/utils/permissions": { canAccessPermission: () => true },
    "@/stores/modulFaskes": { modulAktif: () => true, fiturAktif: () => true },
  };
  const komponen = evaluasi(skrip.content, modul).default;
  const scope = vue.effectScope();
  const state = scope.run(() => komponen.setup({}, { expose() {} }));
  return { state, route, auth, selesai() { pembersih.forEach((fn) => fn()); scope.stop(); } };
}
const tunda = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};
const tunggu = async () => { await vue.nextTick(); await Promise.resolve(); await Promise.resolve(); };

test("skrip dan templat PICU dapat dikompilasi tanpa memuat konfigurasi lingkungan", () => {
  assert.deepEqual(templat.errors, []);
});
test("respons klinis tertunda dari faskes lama tidak masuk ke state faskes baru", async () => {
  const lama = tunda();
  let jumlah = 0;
  const h = halaman({ get: async () => ++jumlah === 1 ? lama.promise : { kapasitas: 2 }, post: async () => ({}) });
  h.state.detail.value = { pasien: { namaPasien: "TEST-PICU-001" } };
  h.state.isi.value = { hasil_ukur: "Isi sintetis" };
  h.auth.faskesUuid = "faskes-sintetis-002";
  await tunggu();
  assert.equal(h.state.detail.value, null);
  assert.equal(Object.keys(h.state.isi.value).length, 0);
  lama.resolve({ kapasitas: 999 });
  await tunggu();
  assert.equal(h.state.ringkasan.value.kapasitas, 2);
  h.selesai();
});
test("percobaan ulang mempertahankan kunci dan tidak menampilkan kegagalan sebagai berhasil", async () => {
  const kunci = [];
  let gagal = true;
  const h = halaman({ get: async () => ({ kapasitas: 0 }), post: async (p, d, k) => {
    kunci.push(k);
    if (gagal) throw new Error("Gangguan sintetis");
    return { uuid: "hasil-sintetis" };
  } });
  await tunggu();
  const data = { nama: "Formulir sintetis versi 1" };
  await h.state.simpan("konfigurasi", data);
  assert.equal(h.state.pesan.value, "");
  assert.equal(h.state.gagal.value, "Gangguan sintetis");
  gagal = false;
  await h.state.simpan("konfigurasi", data);
  assert.equal(kunci.length, 2);
  assert.equal(kunci[0], kunci[1]);
  assert.equal(h.state.pesan.value, "Perubahan berhasil tersimpan.");
  h.selesai();
});
test("klik ganda hanya mengirim satu mutasi dan pelepasan halaman mengabaikan responsnya", async () => {
  const pending = tunda();
  let jumlah = 0;
  const h = halaman({ get: async () => ({ kapasitas: 0 }), post: async () => { jumlah++; return pending.promise; } });
  await tunggu();
  const simpan = h.state.simpan("konfigurasi", { nama: "Formulir sintetis" });
  await h.state.simpan("konfigurasi", { nama: "Formulir sintetis" });
  assert.equal(jumlah, 1);
  h.selesai();
  pending.resolve({ uuid: "hasil-sintetis" });
  await simpan;
  assert.equal(h.state.pesan.value, "");
  assert.equal(h.state.ringkasan.value, null);
});
test("API PICU mengirim kunci idempotensi dan menolak respons tanpa hasil", async () => {
  let header;
  const sumber = fs.readFileSync(path.join(akar, "src/stores/rawatInap/picu.ts"), "utf8");
  const { usePicuStore } = evaluasi(sumber, {
    pinia: { defineStore: (nama, fn) => fn },
    "@/utils/apiHandler": {
      apiRawatInapGet: async () => undefined,
      apiRawatInapPost: async (url, data, config) => { header = config.headers; return { payload: { uuid: "sintetis" } }; },
    },
  });
  const api = usePicuStore();
  await assert.rejects(api.get("dashboard"), /belum dapat dimuat/);
  const hasil = await api.post("episode", {}, "kunci-sintetis-001");
  assert.equal(header["Idempotency-Key"], "kunci-sintetis-001");
  assert.equal(hasil.uuid, "sintetis");
});
