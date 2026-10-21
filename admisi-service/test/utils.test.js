import { test } from "node:test";
import assert from "node:assert/strict";
import moment from "moment";
import { convertCamelToSnake, convertSnakeToCamel, getInfoAge } from "../src/helper/utility.js";

// Hanya fungsi murni; pembuat nomor (No. RM, No. Reg, antrean) membaca database sehingga tidak diuji di sini.

test("getInfoAge: umur tahun/bulan/hari relatif terhadap hari ini", () => {
  const lahir = moment().subtract(25, "years").subtract(8, "months").subtract(3, "days").format("YYYY-MM-DD");
  assert.deepEqual(getInfoAge(lahir), { ageYear: 25, ageMonth: 8, ageDay: 3 });
  assert.deepEqual(getInfoAge(moment().format("YYYY-MM-DD")), { ageYear: 0, ageMonth: 0, ageDay: 0 });
});

test("convertSnakeToCamel & convertCamelToSnake: bolak-balik, nilai tidak berubah", () => {
  const snake = { patient_uuid: null, no_identity: "9999000000000001", birth_date: "1990-01-01", gender: "Laki-laki", mother_name: "Pasien Contoh" };
  const camel = convertSnakeToCamel(snake);
  assert.deepEqual(camel, { patientUuid: null, noIdentity: "9999000000000001", birthDate: "1990-01-01", gender: "Laki-laki", motherName: "Pasien Contoh" });
  assert.deepEqual(convertCamelToSnake(camel), snake);
});

test("convert…: mode deep mengubah kunci objek bersarang", () => {
  const hasil = convertSnakeToCamel({ birth_detail: { birth_place: "Surabaya" } }, true);
  assert.deepEqual(hasil, { birthDetail: { birthPlace: "Surabaya" } });
  assert.deepEqual(convertCamelToSnake(hasil, true), { birth_detail: { birth_place: "Surabaya" } });
});
