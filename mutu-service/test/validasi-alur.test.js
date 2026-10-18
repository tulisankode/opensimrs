import test from "node:test";
import assert from "node:assert/strict";
const transisi={ajukan:{draf:"diajukan",perlu_revisi:"diajukan"},validasi:{diajukan:"tervalidasi"},kunci:{tervalidasi:"terkunci"},bukaKembali:{terkunci:"draf",tervalidasi:"draf"},tolak:{diajukan:"perlu_revisi"}};
const ubahStatus=(aksi,status)=>{const hasil=transisi[aksi]?.[status];if(!hasil)throw new Error("Transisi status tidak sah");return hasil;};
test("alur pengumpulan manual dapat diajukan, divalidasi, dan dikunci",()=>{assert.equal(ubahStatus("ajukan","draf"),"diajukan");assert.equal(ubahStatus("validasi","diajukan"),"tervalidasi");assert.equal(ubahStatus("kunci","tervalidasi"),"terkunci");});
test("periode terkunci dapat dibuka kembali dan transisi tidak sah ditolak",()=>{assert.equal(ubahStatus("bukaKembali","terkunci"),"draf");assert.throws(()=>ubahStatus("validasi","draf"),/tidak sah/);});
