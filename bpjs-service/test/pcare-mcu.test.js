import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SECRET_KEY = process.env.SECRET_KEY || "kunci-uji";
const config = (await import("../src/config.js")).default;
const { pcare } = await import("../src/klien-pcare.js");
const { buatMcu, KESAN_MCU_PCARE } = await import("../src/pcare-peta.js");
const rute = (await import("../src/rute.js")).default;

const kred = { consId: "12345", secretKey: "rahasia", userKey: "uk", username: "admin", password: "sandi", kdAplikasi: "095" };

// STD-0020 — MCU PCare (BPJS). buatMcu() adalah DRAF (lihat pcare-peta.js#buatMcu): field yang tidak tersedia di
// SIMRS lokal harus tetap null (KF-3/KF-4), bukan diisi perkiraan.
test("buatMcu: hanya meneruskan nilai yang tersedia, sisanya null", () => {
  const b = buatMcu({
    noKunjungan: "0114U000000001Y000001",
    kdProviderPeserta: "0114A026",
    tglPeriksa: Date.UTC(2026, 9, 13, 2) / 1000,
    tandaVital: { sistole: 120, diastole: 80, berat_badan: 60.5, tinggi_badan: 165 },
    kesimpulan: "fit",
  });
  assert.equal(b.noKunjungan, "0114U000000001Y000001");
  assert.equal(b.tglPeriksa, "13-10-2026");
  assert.equal(b.sistole, 120);
  assert.equal(b.diastole, 80);
  assert.equal(b.beratBadan, 60.5);
  assert.equal(b.lingkarPerut, null);
  assert.equal(b.gulaDarah, null);
  assert.equal(b.kolesterolTotal, null);
  assert.equal(b.kesimpulan, KESAN_MCU_PCARE.fit);
});

test("buatMcu: tanpa data tanda vital/kesimpulan -> seluruh field klinis null", () => {
  const b = buatMcu({ noKunjungan: "X", kdProviderPeserta: "0114A026", tglPeriksa: null });
  assert.equal(b.sistole, null);
  assert.equal(b.beratBadan, null);
  assert.equal(b.kesimpulan, null);
});

// Mode mock (config.mode diset langsung di sini, sama dengan pola pengujian lain yang memutasi config impor).
test("klien PCare (mock): mcu/insert sukses bila noKunjungan terisi, ditolak bila berakhiran 0", async () => {
  const modeAwal = config.mode;
  config.mode = "mock";
  try {
    const sukses = await pcare(kred, "POST", "/mcu/insert", { noKunjungan: "0114U000000001Y000001", sistole: 120 });
    assert.equal(sukses.kode, 201);
    assert.ok(sukses.response.message);

    await assert.rejects(
      () => pcare(kred, "POST", "/mcu/insert", { noKunjungan: "0114U000000001Y000000" }),
      /ditolak/,
    );
    await assert.rejects(() => pcare(kred, "POST", "/mcu/insert", {}), /wajib diisi/);
  } finally {
    config.mode = modeAwal;
  }
});

test("klien PCare (mock): mcu/delete sukses bila noKunjungan terisi", async () => {
  const modeAwal = config.mode;
  config.mode = "mock";
  try {
    const hasil = await pcare(kred, "DELETE", "/mcu/delete", { noKunjungan: "0114U000000001Y000001" });
    assert.equal(hasil.kode, 200);
  } finally {
    config.mode = modeAwal;
  }
});

// Smoke test rute (tanpa koneksi database): endpoint MCU PCare terdaftar di bawah /pcare/mcu.
test("rute.js bpjs-service mendaftarkan /pcare/mcu", () => {
  const ada = rute.stack.some((l) => l.route?.path?.startsWith("/pcare/mcu"));
  assert.ok(ada, "/pcare/mcu belum terdaftar di bpjs-service/src/rute.js");
});
