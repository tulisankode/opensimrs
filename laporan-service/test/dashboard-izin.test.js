import { test } from "node:test";
import assert from "node:assert/strict";
import { cocokIzin } from "../src/helpers/cocok-izin.js";
import { buatTembolok } from "../src/helpers/tembolok-izin.js";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";

// Ganti konfigurasi sebelum modul dimuat: pengujian tidak membaca berkas lingkungan atau membuka basis data.
const kait = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "../config/sequelize-db.js") {
      return { url: 'data:text/javascript,export default { query() { throw new Error("Query tanpa pengganti"); } }', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { buatPembacaIzin, GalatIzin } = await import("../src/helpers/izin.js");
kait.deregister();

// Mock respons Express minimal (sama dengan pola di test/virtual-office.test.js).
const respons = () => ({ kode: null, body: null, status(k) { this.kode = k; return this; }, json(d) { this.body = d; return this; } });

test("cocokIzin: tanpa submodul diminta → true setelah modul ditemukan (izin dasar Dashboard, STD-0049)", () => {
  assert.equal(cocokIzin([{ module: "Dashboard", subModules: [] }], "Dashboard", null, "READ"), true);
  assert.equal(cocokIzin([{ module: "Dashboard", subModules: [{ name: "Eksekutif", allows: ["READ"] }] }], "Dashboard", null, "READ"), true);
  assert.equal(cocokIzin([], "Dashboard", null, "READ"), false);
  // Submodul tetap wajib dicocokkan bila diminta (tidak ikut dilonggarkan oleh cabang baru).
  assert.equal(cocokIzin([{ module: "Dashboard", subModules: [] }], "Dashboard", "Command Center", "READ"), false);
});

test("buatTembolok: tersimpan hingga 60 detik, lalu kedaluwarsa (jam dapat diinjeksi)", () => {
  let sekarang = 0;
  const tembolok = buatTembolok(() => sekarang);
  tembolok.simpan("k", { izin: [1] });
  assert.deepEqual(tembolok.ambil("k"), { izin: [1] });
  sekarang = 59_999;
  assert.deepEqual(tembolok.ambil("k"), { izin: [1] });
  sekarang = 60_000;
  assert.equal(tembolok.ambil("k"), null);
});

// Query fiktif: akun biasa wajib cocok uuid + faskes_uuid; super admin dicari dari uuid saja (lihat buatPembacaIzin).
const buatQueryFiktif = (users) => async (sql, opsi) => {
  const { pengguna_uuid, faskes_uuid } = opsi.replacements;
  const baris = users.find((u) => {
    if (u.uuid !== pengguna_uuid || u.deleted_at) return false;
    if (sql.includes("faskes_uuid = :faskes_uuid")) return u.faskes_uuid === faskes_uuid;
    return true;
  });
  return [baris ? { permissions: baris.permissions } : undefined];
};

test("identitas tidak lengkap (tanpa user_uuid/faskesUuid) → GalatIzin 401, bukan ditolak diam-diam", async () => {
  const { izinPengguna } = buatPembacaIzin(buatQueryFiktif([]));
  await assert.rejects(() => izinPengguna({ role: "staf" }), (e) => e instanceof GalatIzin && e.code === 401);
  await assert.rejects(() => izinPengguna({ user_uuid: "u1", role: "staf" }), (e) => e instanceof GalatIzin && e.code === 401);
});

test("akun biasa: cakupan wajib faskes token, bukan masukan lain; faskes lain ditolak", async () => {
  const users = [{ uuid: "u1", faskes_uuid: "f1", permissions: [{ module: "Dashboard", subModules: [] }] }];
  const { punyaIzin } = buatPembacaIzin(buatQueryFiktif(users));
  assert.equal(await punyaIzin({ author: { user_uuid: "u1", faskesUuid: "f1", role: "staf" } }, "Dashboard", null, "READ"), true);
  assert.equal(await punyaIzin({ author: { user_uuid: "u1", faskesUuid: "f2", role: "staf" } }, "Dashboard", null, "READ"), false);
});

test("akun tidak ditemukan/terhapus ditolak, tidak dianggap akun sah berizin kosong meski role super admin", async () => {
  const { punyaIzin } = buatPembacaIzin(buatQueryFiktif([]));
  assert.equal(await punyaIzin({ author: { user_uuid: "tidak-ada", faskesUuid: "f1", role: "super admin" } }, "Dashboard", null, "READ"), false);
});

test("super admin pindah faskes: pencarian akun memakai UUID token, bukan faskes aktif", async () => {
  const users = [{ uuid: "sa1", faskes_uuid: "f1", permissions: [] }];
  const { punyaIzin } = buatPembacaIzin(buatQueryFiktif(users));
  // faskesUuid pada token (f9) berbeda dari faskes_uuid baris akun (f1); akun tetap ditemukan via UUID & izin kosong
  // pada super admin tetap boleh lewat.
  assert.equal(await punyaIzin({ author: { user_uuid: "sa1", faskesUuid: "f9", role: "super admin" } }, "Dashboard", null, "READ"), true);
});

test("dua akun username sama dengan faskes berbeda: cache terpisah per (uuid, faskes)", async () => {
  let panggilan = 0;
  const query = async (sql, opsi) => {
    panggilan++;
    const { pengguna_uuid, faskes_uuid } = opsi.replacements;
    if (pengguna_uuid === "u1" && faskes_uuid === "f1") return [{ permissions: [{ module: "Dashboard", subModules: [] }] }];
    if (pengguna_uuid === "u2" && faskes_uuid === "f2") return [{ permissions: [] }];
    return [undefined];
  };
  const { punyaIzin } = buatPembacaIzin(query);
  assert.equal(await punyaIzin({ author: { user_uuid: "u1", faskesUuid: "f1", role: "staf" } }, "Dashboard", null, "READ"), true);
  assert.equal(await punyaIzin({ author: { user_uuid: "u2", faskesUuid: "f2", role: "staf" } }, "Dashboard", null, "READ"), false);
  assert.equal(panggilan, 2);
  // Dipanggil ulang dengan identitas yang sama: hasil dari tembolok, tanpa query baru.
  await punyaIzin({ author: { user_uuid: "u1", faskesUuid: "f1", role: "staf" } }, "Dashboard", null, "READ");
  assert.equal(panggilan, 2);
});

test("kegagalan query tidak disimpan sebagai izin kosong; galat diteruskan setiap percobaan", async () => {
  let percobaan = 0;
  const query = async () => { percobaan++; throw new Error("DB turun"); };
  const { izinPengguna } = buatPembacaIzin(query);
  await assert.rejects(() => izinPengguna({ user_uuid: "u1", faskesUuid: "f1", role: "staf" }));
  await assert.rejects(() => izinPengguna({ user_uuid: "u1", faskesUuid: "f1", role: "staf" }));
  assert.equal(percobaan, 2);
});

test("wajibIzin: 401 payload null bila identitas tidak lengkap, next() tidak dipanggil", async () => {
  const { wajibIzin } = buatPembacaIzin(buatQueryFiktif([]));
  const mw = wajibIzin("Dashboard", null, "READ");
  const req = { author: { role: "staf" } };
  const res = respons();
  let dipanggil = false;
  await mw(req, res, () => { dipanggil = true; });
  assert.equal(dipanggil, false);
  assert.equal(res.kode, 401);
  assert.deepEqual(res.body, { message: "Konteks autentikasi tidak lengkap", payload: null });
});

test("wajibIzin: 403 'Akses Dashboard ditolak' payload null bila tidak berizin, next() tidak dipanggil", async () => {
  const { wajibIzin } = buatPembacaIzin(buatQueryFiktif([]));
  const mw = wajibIzin("Dashboard", null, "READ");
  const req = { author: { user_uuid: "tidak-ada", faskesUuid: "f1", role: "staf" } };
  const res = respons();
  let dipanggil = false;
  await mw(req, res, () => { dipanggil = true; });
  assert.equal(dipanggil, false);
  assert.equal(res.kode, 403);
  assert.deepEqual(res.body, { message: "Akses Dashboard ditolak", payload: null });
});

test("wajibIzin: next() dipanggil tanpa respons dikirim bila berizin", async () => {
  const users = [{ uuid: "u1", faskes_uuid: "f1", permissions: [{ module: "Dashboard", subModules: [] }] }];
  const { wajibIzin } = buatPembacaIzin(buatQueryFiktif(users));
  const mw = wajibIzin("Dashboard", null, "READ");
  const req = { author: { user_uuid: "u1", faskesUuid: "f1", role: "staf" } };
  const res = respons();
  let dipanggil = false;
  await mw(req, res, () => { dipanggil = true; });
  assert.equal(dipanggil, true);
  assert.equal(res.kode, null);
});

test("tembolok kedaluwarsa tidak dipakai ketika pembacaan ulang gagal, termasuk setelah 60 detik", async () => {
  let sekarang = 0;
  let gagal = false;
  const { punyaIzin } = buatPembacaIzin(async () => {
    if (gagal) throw new Error("Pembacaan gagal");
    return [{ permissions: [{ module: "Dashboard", subModules: [] }] }];
  }, buatTembolok(() => sekarang));
  const req = { author: { user_uuid: "u1", faskesUuid: "f1", role: "staf" } };
  assert.equal(await punyaIzin(req, "Dashboard"), true);
  gagal = true;
  sekarang = 59_999;
  assert.equal(await punyaIzin(req, "Dashboard"), true);
  for (sekarang of [60_000, 60_001]) await assert.rejects(() => punyaIzin(req, "Dashboard"));
});

test("peran berbeda memakai cache berbeda dan akun terhapus selalu ditolak", async () => {
  const users = [{ uuid: "u1", faskes_uuid: "f1", permissions: [], deleted_at: 1 }];
  const { punyaIzin } = buatPembacaIzin(buatQueryFiktif(users));
  assert.equal(await punyaIzin({ author: { user_uuid: "u1", faskesUuid: "f2", role: "super admin" } }, "Dashboard"), false);
  users[0].deleted_at = null;
  assert.equal(await punyaIzin({ author: { user_uuid: "u1", faskesUuid: "f2", role: "staf" } }, "Dashboard"), false);
  const pembaca = buatPembacaIzin(buatQueryFiktif(users));
  assert.equal(await pembaca.punyaIzin({ author: { user_uuid: "u1", faskesUuid: "f2", role: "super admin" } }, "Dashboard"), true);
  assert.equal(await pembaca.punyaIzin({ author: { user_uuid: "u1", faskesUuid: "f2", role: "staf" } }, "Dashboard"), false);
});

test("delapan rute rekap menghentikan permintaan tanpa izin sebelum controller", async () => {
  const daftar = [];
  const router = {
    get(path, ...handlers) { daftar.push({ path, handlers }); },
    post() {}, put() {},
  };
  const pembaca = buatPembacaIzin(buatQueryFiktif([
    { uuid: "u1", faskes_uuid: "f1", permissions: [{ module: "Dashboard", subModules: [] }] },
  ]));
  let panggilan = 0;
  const controller = new Proxy({}, { get: () => () => { panggilan++; } });
  const sumber = readFileSync(new URL("../src/routes/dashboard-routes.js", import.meta.url), "utf8")
    .replace(/^import .*$/gm, "").replace("export default dashboardRoutes", "return dashboardRoutes");
  new Function("express", "wajibIzin", "DashboardController", "EksekutifController", sumber)(
    { Router: () => router }, pembaca.wajibIzin, controller, controller,
  );
  const rekap = daftar.filter(({ path }) => path.startsWith("/dashboard/rekap"));
  assert.equal(rekap.length, 8);
  for (const { handlers } of rekap) {
    for (const [author, kode] of [
      [{ username: "sama" }, 401],
      [{ user_uuid: "u1", faskesUuid: "f2", role: "staf" }, 403],
      [{ user_uuid: "u1", faskesUuid: "f1", role: "staf" }, null],
    ]) {
      const sebelum = panggilan;
      const req = { author, query: { faskes_uuid: "f1" }, body: { faskes_uuid: "f1" } };
      const res = respons();
      await handlers[0](req, res, (error) => { assert.ifError(error); handlers[1](req, res); });
      assert.equal(res.kode, kode);
      assert.equal(panggilan - sebelum, kode ? 0 : 1);
    }
  }
});
