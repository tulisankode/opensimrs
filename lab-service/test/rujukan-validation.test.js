import { test } from "node:test";
import assert from "node:assert/strict";
import LabRujukanValidation from "../src/validations/lab-rujukan-validation.js";
import RujukanValidation from "../src/validations/rujukan-validation.js";

test("LabRujukanValidation.CREATE: code & name wajib, code diubah ke huruf besar", () => {
  const data = LabRujukanValidation.CREATE.parse({
    code: "lab-01",
    name: "Prodia",
    status: true,
    faskes_uuid: "faskes-1",
  });
  assert.equal(data.code, "LAB-01");
  assert.equal(data.alamat, undefined);

  assert.throws(() =>
    LabRujukanValidation.CREATE.parse({
      name: "Prodia",
      status: true,
      faskes_uuid: "faskes-1",
    })
  );
});

test("LabRujukanValidation.CREATE: alamat/telepon/kontak_person opsional boleh kosong", () => {
  const data = LabRujukanValidation.CREATE.parse({
    code: "LAB-02",
    name: "Kimia Farma",
    alamat: "Jl. Contoh No. 1",
    telepon: "080000000000",
    kontak_person: "Budi",
    status: true,
    faskes_uuid: "faskes-1",
  });
  assert.equal(data.alamat, "Jl. Contoh No. 1");
  assert.equal(data.telepon, "080000000000");
});

test("RujukanValidation.TANDAI: lab_rujukan_uuid wajib diisi (KT-4)", () => {
  assert.throws(() =>
    RujukanValidation.TANDAI.parse({ faskes_uuid: "faskes-1" })
  );

  const data = RujukanValidation.TANDAI.parse({
    lab_rujukan_uuid: "lab-rujukan-1",
    catatan_rujukan: "No. sampel luar 123",
    faskes_uuid: "faskes-1",
  });
  assert.equal(data.lab_rujukan_uuid, "lab-rujukan-1");
  assert.equal(data.catatan_rujukan, "No. sampel luar 123");
});

test("RujukanValidation.TANDAI: catatan_rujukan opsional", () => {
  const data = RujukanValidation.TANDAI.parse({
    lab_rujukan_uuid: "lab-rujukan-1",
    faskes_uuid: "faskes-1",
  });
  assert.equal(data.catatan_rujukan, undefined);
});
