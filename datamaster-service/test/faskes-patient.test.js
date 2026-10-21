import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Op } from "sequelize";
import { HttpException, HttpStatus } from "../src/errors/http-exception.js";

// Jalankan kode layanan dengan dependensi pengganti sebelum impor konfigurasi maupun model basis data.
const muat = (path, dependensi, hasil) => {
  const sumber = readFileSync(new URL(path, import.meta.url), "utf8")
    .replace(/^import[\s\S]*?from ["'][^"']+["'];?\r?$/gm, "")
    .replace(/export default /g, "").replace(/export const /g, "const ");
  return new Function(...Object.keys(dependensi), `${sumber}\nreturn ${hasil};`)(...Object.values(dependensi));
};
const model = { belongsTo() {}, hasOne() {} };
const FaskesModel = { ...model, async findOne() { throw new Error("Query tanpa pengganti"); } };
const FaskesRepository = muat("../src/repositories/faskes-repository.js", {
  Op, BaseRePosiotry: class {}, FaskesModel, AddressModel: model, FaskesProfilesModel: model,
  ProvinceModel: model, KabupatenModel: model, KecamatanModel: model, KelurahanModel: model,
}, "FaskesRepository");
const { FaskesService, petakanFaskesUntukPasien } = muat("../src/services/faskes-service.js", {
  FaskesRepository, HttpException, HttpStatus,
  generateSuccessResponse: (message, payload) => ({ message, payload }),
}, "({ FaskesService, petakanFaskesUntukPasien })");
const FaskesController = muat("../src/controllers/faskes-controller.js", {
  FaskesService, HttpException, HttpStatus,
}, "FaskesController");

// Mock respons Express minimal, tanpa basis data.
const respons = () => ({ kode: null, body: null, status(k) { this.kode = k; return this; }, json(d) { this.body = d; return this; } });

test("petakanFaskesUntukPasien: faskes tanpa profil → alamat/telepon/logo null, distance selalu null", () => {
  assert.deepEqual(petakanFaskesUntukPasien(null), []);
  assert.deepEqual(petakanFaskesUntukPasien({ uuid: "f1", name: "Klinik Contoh" }), [
    { uuid: "f1", name: "Klinik Contoh", distance: null, address: null, phone: null, image: null },
  ]);
});

test("petakanFaskesUntukPasien: memetakan alamat/telepon/logo dari faskes_profile bila ada", () => {
  const faskes = {
    uuid: "f1",
    name: "Klinik Contoh",
    faskes_profile: { phone: "080000000000", logo: null, address: { fullAddress: "Jalan Contoh No. 1" } },
  };
  assert.deepEqual(petakanFaskesUntukPasien(faskes), [
    { uuid: "f1", name: "Klinik Contoh", distance: null, address: "Jalan Contoh No. 1", phone: "080000000000", image: null },
  ]);
});

test("getAllForPatient: 401 payload null bila konteks faskes token tidak tersedia, repository tidak dipanggil", async () => {
  const asliFindActive = FaskesRepository.findActiveProfileForPatient;
  let dipanggil = false;
  FaskesRepository.findActiveProfileForPatient = async () => { dipanggil = true; return null; };
  try {
    const req = { author: {} };
    const res = respons();
    const next = () => {};
    await FaskesController.getAllForPatient(req, res, (error) => { res.status(error.code).json(error.message); });
    assert.equal(dipanggil, false);
    assert.equal(res.kode, 401);
    assert.deepEqual(res.body, { message: "Konteks faskes tidak tersedia", payload: null });
  } finally {
    FaskesRepository.findActiveProfileForPatient = asliFindActive;
  }
});

test("getAllForPatient: hanya faskes pada token yang diminta ke repository, daftar kosong bila faskes tidak aktif", async () => {
  const asliFindActive = FaskesRepository.findActiveProfileForPatient;
  let faskesUuidDiminta = null;
  FaskesRepository.findActiveProfileForPatient = async (faskesUuid) => { faskesUuidDiminta = faskesUuid; return null; };
  try {
    const req = { author: { faskesUuid: "f-aktif-token" } };
    const res = respons();
    await FaskesController.getAllForPatient(req, res, (error) => { throw error; });
    assert.equal(faskesUuidDiminta, "f-aktif-token");
    assert.equal(res.kode, 200);
    assert.equal(res.body.message, "Berhasil menampilkan faskes aktif");
    assert.deepEqual(res.body.payload, []);
  } finally {
    FaskesRepository.findActiveProfileForPatient = asliFindActive;
  }
});

test("getActiveForPatient: meneruskan hasil repository ke pemetaan respons", async () => {
  const asliFindActive = FaskesRepository.findActiveProfileForPatient;
  FaskesRepository.findActiveProfileForPatient = async () => ({
    uuid: "f1",
    name: "Klinik Contoh",
    faskes_profile: { phone: "080000000000", logo: null, address: { fullAddress: "Jalan Contoh No. 1" } },
  });
  try {
    const result = await FaskesService.getActiveForPatient("f1");
    assert.equal(result.message, "Berhasil menampilkan faskes aktif");
    assert.equal(result.payload.length, 1);
    assert.equal(result.payload[0].uuid, "f1");
    assert.equal(result.payload[0].distance, null);
  } finally {
    FaskesRepository.findActiveProfileForPatient = asliFindActive;
  }
});

test("repository membatasi faskes aktif, profil dan alamat ke faskes token serta soft delete", async () => {
  const asli = FaskesModel.findOne;
  let panggilan = 0;
  FaskesModel.findOne = async (opsi) => {
    panggilan++;
    assert.deepEqual(opsi.where[Op.and], [
      { uuid: "f-token" }, { status: true }, { deletedAt: { [Op.is]: null } },
    ]);
    const profil = opsi.include[0];
    const alamat = profil.include[0];
    for (const relasi of [profil, alamat]) {
      assert.deepEqual(relasi.where, { faskesUuid: "f-token", deletedAt: { [Op.is]: null } });
      assert.equal(relasi.required, false);
    }
    assert.deepEqual(opsi.attributes, ["uuid", "name"]);
    assert.deepEqual(profil.attributes, ["phone", "logo"]);
    assert.deepEqual(alamat.attributes, ["fullAddress"]);
    return { toJSON: () => ({ uuid: "f-token", name: "Klinik Contoh" }) };
  };
  try {
    assert.equal(await FaskesRepository.findActiveProfileForPatient(null), null);
    assert.equal(panggilan, 0);
    assert.equal((await FaskesRepository.findActiveProfileForPatient("f-token")).uuid, "f-token");
  } finally {
    FaskesModel.findOne = asli;
  }
});

test("service menolak konteks kosong dan respons hanya memuat properti daftar", async () => {
  await assert.rejects(() => FaskesService.getActiveForPatient(null), (e) => e.code === 401);
  const hasil = petakanFaskesUntukPasien({
    uuid: "f1", name: "Klinik Contoh", atributInternal: "tidak untuk respons",
    faskes_profile: { phone: "080000000000", email: "faskes@contoh.id", address: { fullAddress: "Jalan Contoh" } },
  });
  assert.deepEqual(Object.keys(hasil[0]), ["uuid", "name", "distance", "address", "phone", "image"]);
});
