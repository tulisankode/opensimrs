import test from "node:test";
import assert from "node:assert/strict";
import { statusLengkap, registryOtomatis } from "../src/pengumpulan/otomatis.js";
test("registry menghitung indikator waktu tunggu dan kelengkapan periode tervalidasi",()=>{assert.equal(typeof registryOtomatis.waktu_tunggu_rawat_jalan,"function");assert.equal(statusLengkap([{status:"tervalidasi"},{status:"terkunci"}],2),true);assert.equal(statusLengkap([{status:"draf"}],1),false);});
