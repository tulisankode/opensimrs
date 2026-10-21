import { test } from "node:test";
import assert from "node:assert/strict";
import { definisiKelas, imporKelas, periksaPanggilan, pisahTingkatAtas } from "../src/audit-lintas.js";

// Pola bug nyata 2026-10-21 (Farmasi Ruangan): editAlkes(req, transaction) padahal definisinya (dataToUpdate, uuid, transaction).
const repo = `
export default class AlkesRepository {
  static async editAlkes(dataToUpdate, uuid, transaction) {
    delete dataToUpdate.uuid;
    return OrderAlkesModel.update(dataToUpdate, { where: { uuid }, transaction });
  }
  static async removeJenisStok(req, transaction) { return Model.update({}, { where: { uuid: req.uuid }, transaction }); }
  static async getByUuid(uuid) { return Model.findOne({ where: { uuid } }); }
  static async konfigurasi(faskesUuid) { return axios.get("/setting/ppn"); }
}`;

test("pisahTingkatAtas: koma di dalam objek, array, string, dan template tidak memisah", () => {
  assert.deepEqual(pisahTingkatAtas(`a, { b: 1, c: [2, 3] }, "x,y", \`t,\${u}\``), ["a", "{ b: 1, c: [2, 3] }", '"x,y"', "`t,${u}`"]);
  assert.deepEqual(pisahTingkatAtas(""), []);
});

test("periksaPanggilan: transaksi di posisi uuid, argumen kurang, dan berlebih", () => {
  const def = definisiKelas(repo);
  const impor = new Map([["AlkesRepository", def]]);
  const servis = [
    "await AlkesRepository.editAlkes(req, transaction);",       // transaksi sebagai uuid
    "await AlkesRepository.editAlkes(req);",                    // uuid hilang
    "await AlkesRepository.editAlkes(data, data.uuid, trx);",   // benar
    "await AlkesRepository.removeJenisStok({ uuid });",         // hanya transaksi yang hilang → aman
    "await AlkesRepository.getByUuid(uuid, transaction);",      // berlebih (rendah)
    "await AlkesRepository.konfigurasi();",                     // parameter tidak dipakai → aman
  ].join("\n");
  const hasil = periksaPanggilan(servis, impor).map((t) => [t.baris, t.tingkat, t.judul]);
  assert.deepEqual(hasil, [
    [1, "tinggi", "Transaksi dikirim ke parameter yang salah"],
    [2, "tinggi", "Argumen pemanggilan kurang"],
    [5, "rendah", "Argumen pemanggilan berlebih"],
  ]);
});

test("imporKelas: default, bernama, dan alias", () => {
  const isi = `import AlkesRepository from "../repositories/alkes-repository.js";\nimport { LayarAntrianRepository as Layar, Lain } from "./layar.js";`;
  assert.deepEqual(imporKelas(isi), [
    { nama: "AlkesRepository", spesifik: "../repositories/alkes-repository.js" },
    { nama: "Layar", spesifik: "./layar.js", ekspor: "LayarAntrianRepository" },
    { nama: "Lain", spesifik: "./layar.js", ekspor: "Lain" },
  ]);
});
