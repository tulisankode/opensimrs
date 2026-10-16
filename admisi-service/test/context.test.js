import { Context } from "../src/middlewares/context.js";

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

// Permintaan bersamaan tidak boleh saling membaca konteks (faskes/pengguna/token) — dulu Context berupa field statis.
describe("Context per permintaan", () => {
  test("tiga permintaan bersamaan membaca konteksnya sendiri setelah await", async () => {
    const permintaan = (faskes, jeda) =>
      Context.jalankan(async () => {
        Context.set("author", { faskesUuid: faskes });
        await tidur(jeda);
        await Promise.resolve();
        return Context.get("author").faskesUuid;
      });
    const hasil = await Promise.all([permintaan("A", 60), permintaan("B", 5), permintaan("C", 30)]);
    expect(hasil).toEqual(["A", "B", "C"]);
  });

  test("middleware membuka konteks kosong per permintaan", (done) => {
    Context.middleware({}, {}, () => {
      expect(Context.get("author")).toBeNull();
      done();
    });
  });
});
