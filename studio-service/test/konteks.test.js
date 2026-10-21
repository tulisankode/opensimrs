import { test } from "node:test";
import assert from "node:assert/strict";
import { bersihkanKonteks, normalkanPath, teksKonteksAsal, teksModulKatalog } from "../src/konteks.js";

test("normalkanPath: query, hash, UUID, dan angka panjang tidak ikut", () => {
  assert.equal(normalkanPath("/rawat-inap/hdu/01a13e12-9884-75d6-b632-e1b62d63c975?tab=2#x"), "/rawat-inap/hdu/:uuid");
  assert.equal(normalkanPath("/admisi/pasien/123456/edit"), "/admisi/pasien/:id/edit");
  assert.equal(normalkanPath(""), null);
});

test("bersihkanKonteks: hanya kunci dikenal, teks dipotong, galat & cek dibatasi", () => {
  const k = bersihkanKonteks({
    path: "/sdm/jadwal-dinas", nama_rute: "sdm-jadwal-dinas", lain: "dibuang",
    modul: { kode: "sdm", nama: "HR / SDM", rahasia: "x" }, izin: { modul: "HR / SDM", submodul: "Jadwal Dinas", aksi: "READ" },
    komponen: ["JadwalDinasPage", 123, null],
    galat: Array.from({ length: 15 }, (_, i) => ({ jenis: "api", metode: "GET", path: `/api/v3/penunjang/hr/jadwal-dinas/jadwal?unit_uuid=${i}`, status: 500, pesan: "Permintaan gagal diproses" })),
    cek_tampilan: [{ cek: "Card + PageToolbar", lulus: false, rincian: "tidak ada PageToolbar" }],
  });
  assert.equal(k.lain, undefined);
  assert.deepEqual(k.modul, { kode: "sdm", nama: "HR / SDM" });
  assert.deepEqual(k.komponen, ["JadwalDinasPage", "123"]);
  assert.equal(k.galat.length, 10);
  assert.equal(k.galat[0].path, "/api/v3/penunjang/hr/jadwal-dinas/jadwal");
  assert.equal(bersihkanKonteks(null), null);
  assert.equal(bersihkanKonteks({ komponen: ["X"] }), null);
});

test("bersihkanKonteks: data pribadi pada pesan galat ditolak", () => {
  assert.throws(() => bersihkanKonteks({ path: "/admisi", galat: [{ pesan: "NIK 3201234567890001 sudah terdaftar" }] }), /data pribadi/);
  assert.ok(bersihkanKonteks({ path: "/admisi", galat: [{ pesan: "NIK 9999000000000001 sudah terdaftar" }] }));
});

test("teksKonteksAsal & teksModulKatalog: ringkasan halaman, galat, cek gagal, dan entri katalog", () => {
  const t = teksKonteksAsal({ path: "/rawat-inap/hdu", modul: { kode: "hdu", nama: "HDU" }, galat: [{ jenis: "api", metode: "GET", path: "/api/v3/ranap/hdu", status: 500, pesan: "Gagal" }],
    cek_tampilan: [{ cek: "Card + PageToolbar", lulus: false }, { cek: "Tanpa UUID", lulus: true }] });
  assert.match(t, /Modul katalog: HDU \(`hdu`\)/);
  assert.match(t, /GET \/api\/v3\/ranap\/hdu → 500: Gagal/);
  assert.match(t, /Card \+ PageToolbar/);
  assert.doesNotMatch(t, /Tanpa UUID/);
  assert.equal(teksKonteksAsal(null), "");
  const katalog = { modul: [{ kode: "hdu", nama: "HDU", bidang: "Pelayanan", instalasi: "Intensif", menu: ["HDU"], rute: ["/rawat-inap/hdu"] }], fitur: [{ kode: "hdu_serah_terima", modul: "hdu", nama: "Serah Terima HDU", rute: [] }] };
  const m = teksModulKatalog(["hdu"], katalog);
  assert.match(m, /### HDU \(`hdu`\)/);
  assert.match(m, /Fitur `hdu_serah_terima`: Serah Terima HDU/);
  assert.equal(teksModulKatalog(["tidak-ada"], katalog), "");
});
