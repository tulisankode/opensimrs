import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ambilBuktiPacu, simpanBuktiPacu, izinBiayaPacu } from "../../payment-service/src/services/pacu-idempotensi.js";

test("izin biaya PACU tidak diwariskan dari izin operasi; izin pengiriman dan penyelesaian diperiksa", () => {
  assert.equal(izinBiayaPacu([{ module: "Kamar Operasi", subModules: [{ name: "Jadwal OK", allows: ["VALIDASI"] }] }], "perawat"), false);
  for (const [name, aksi] of [["Biaya PACU", "KIRIM"], ["Episode PACU", "SELESAIKAN"]]) {
    assert.equal(izinBiayaPacu(JSON.stringify([{ module: "Kamar Operasi", subModules: [{ name, allows: [aksi] }] }]), "petugas"), true);
  }
  assert.equal(izinBiayaPacu("rusak", "super admin"), false);
  assert.equal(izinBiayaPacu([], "super admin"), true);
});

test("referensi biaya mengunci transaksi dan mempertahankan bukti untuk pengulangan setelah tagihan ditutup", async () => {
  const bukti = new Map();
  let operasiTagihan = 0;
  const kunci = [];
  const trx = (tabel) => {
    assert.equal(tabel, "pacu_tagihan_referensi");
    return {
      where: (p) => ({ first: async () => bukti.get(`${p.faskes_uuid}:${p.kunci_idempoten}`) }),
      insert: async (p) => {
        const kode = `${p.faskes_uuid}:${p.kunci_idempoten}`;
        assert.equal(bukti.has(kode), false);
        bukti.set(kode, { ...p, hasil: JSON.parse(p.hasil) });
      },
    };
  };
  trx.raw = async (sql, p) => { assert.match(sql, /pg_advisory_xact_lock/); kunci.push(p[0]); };
  const kirim = async (f) => {
    const lama = await ambilBuktiPacu(trx, f, "pacu:episode-fiktif:layanan-fiktif");
    if (lama) return lama.hasil;
    operasiTagihan++;
    const hasil = { data: { bill_uuid: "tagihan-fiktif" } };
    await simpanBuktiPacu(trx, f, "pacu:episode-fiktif:layanan-fiktif", hasil, 100, "019a0000-0000-7000-8000-000000000001", "petugas-fiktif");
    return hasil;
  };
  assert.deepEqual(await kirim("faskes-a"), await kirim("faskes-a"));
  assert.equal(operasiTagihan, 1);
  assert.equal(kunci[0], kunci[1]);
  await kirim("faskes-b");
  assert.equal(operasiTagihan, 2);
  assert.notEqual(kunci[0], kunci[2]);
});

const urlData = (s) => `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
let keadaan;
let buktiPenerima;
let gagalJaringan;
let panggilan;
const dependensi = {
  satu: async (sql) => sql.includes("FROM pacu_biaya") ? structuredClone(keadaan.biaya)
    : sql.includes("FROM pacu_tagihan_referensi") ? buktiPenerima
    : { patient_uuid: "pasien-fiktif", no_reg: "REG-FIKTIF", payment_method: 1 },
  ubah: async (t, id, f, perubahan) => (keadaan.biaya = { ...keadaan.biaya, ...perubahan }),
  sisipkan: async (t, isi) => { keadaan.riwayat.push(isi); },
  transaksi: async (fn) => fn({}),
  kirimTagihan: async (paket) => {
    panggilan.push(paket);
    if (gagalJaringan) throw new Error("Jaringan uji terputus");
    buktiPenerima ??= { hasil: { data: { bill_uuid: "tagihan-fiktif" } } };
  },
};
globalThis.__pacuBillingUji = dependensi;
let sumberPengirim = readFileSync(new URL("../src/kamar-operasi/pacu-billing.js", import.meta.url), "utf8");
for (const [nama, tujuan] of [
  ["../db.js", urlData(`export const {satu,transaksi,ubah,sisipkan}=globalThis.__pacuBillingUji;`)],
  ["../umum/tagihan.js", urlData(`export const {kirimTagihan}=globalThis.__pacuBillingUji;`)],
  ["./pacu-validasi.js", new URL("../src/kamar-operasi/pacu-validasi.js", import.meta.url).href],
]) sumberPengirim = sumberPengirim.replaceAll(`"${nama}"`, JSON.stringify(tujuan));
const { kirimBiayaPacu } = await import(urlData(sumberPengirim));
delete globalThis.__pacuBillingUji;

test("kegagalan pengirim tersimpan untuk rekonsiliasi; kirim ulang memakai referensi sama dan berhenti setelah berhasil", async () => {
  keadaan = { biaya: { uuid: "biaya-fiktif", episode_uuid: "episode-fiktif", versi: 1, jumlah_percobaan: 0,
    status_kirim: "tertunda", kunci_idempoten: "pacu:episode-fiktif:layanan-fiktif",
    konfigurasi_snapshot: { nama: "Layanan fiktif", tarif: 100, layanan_uuid: "layanan-fiktif" } }, riwayat: [] };
  panggilan = []; buktiPenerima = null; gagalJaringan = true;
  const req = { params: { uuid: "episode-fiktif" }, author: { faskesUuid: "faskes-a", username: "petugas-fiktif" }, body: {} };
  assert.equal((await kirimBiayaPacu(req)).status_kirim, "perlu_rekonsiliasi");
  assert.equal(keadaan.biaya.jumlah_percobaan, 1);
  gagalJaringan = false;
  assert.equal((await kirimBiayaPacu(req)).referensi_tagihan, "tagihan-fiktif");
  assert.equal(keadaan.biaya.jumlah_percobaan, 2);
  assert.equal(panggilan[0].ref, panggilan[1].ref);
  assert.equal(panggilan[1].batasWaktuMs, 10000);
  assert.equal(keadaan.riwayat.length, 2);
  await kirimBiayaPacu(req);
  assert.equal(panggilan.length, 2);
});
