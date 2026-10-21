import { test } from "node:test";
import assert from "node:assert/strict";

// Uji isolasi faskes & soft delete STD-0051 (tindak lanjut audit Antrean Online BPJS). Seluruh akses database
// ditiru lewat `pool.query` (lihat src/db.js) — tidak ada koneksi basis data nyata yang dibuat. Data fiktif saja.
process.env.SECRET_KEY = process.env.SECRET_KEY || "kunci-uji";

const { pool } = await import("../src/db.js");
const { simpanKonfigurasi, DataBelumLengkap } = await import("../src/antrean.js");
const { batalAntrean, prosesKirim } = await import("../src/antrean-service.js");
const { GalatBpjs } = await import("../src/klien-pcare.js");

const konfigAktifMock = { id: 7, antrean_bpjs_aktif: true, antrean_bpjs_mode: "mock", antrean_bpjs_base_url: null, antrean_bpjs_cons_id: null, antrean_bpjs_secret_key: null, antrean_bpjs_user_key: null };

const pasangPoolPalsu = (penangan) => {
  const panggilan = [];
  pool.query = async (sql, params = []) => {
    panggilan.push({ sql, params });
    return penangan(sql, params, panggilan);
  };
  return panggilan;
};

test("simpanKonfigurasi: UPDATE integrations membatasi id + faskes_uuid + deleted_at IS NULL", async () => {
  const panggilan = pasangPoolPalsu((sql) => {
    if (/SELECT id, antrean_bpjs_aktif/.test(sql)) return { rows: [{ ...konfigAktifMock }] };
    if (/UPDATE integrations/.test(sql)) return { rows: [{ id: 7 }] };
    throw new Error(`SQL tak terduga dalam uji: ${sql}`);
  });

  await simpanKonfigurasi("FASKES-A", { aktif: true, mode: "mock" });

  const update = panggilan.find((p) => /UPDATE integrations/.test(p.sql));
  assert.match(update.sql, /WHERE id = \$1 AND faskes_uuid = \$9 AND deleted_at IS NULL/);
  assert.equal(update.params[0], 7); // id dari baris konfigurasi faskes yang sama
  assert.equal(update.params[8], "FASKES-A"); // faskes dari konteks tepercaya, bukan dari body
});

test("simpanKonfigurasi: tidak melaporkan sukses bila UPDATE tidak mengenai baris (mis. faskes tidak cocok lagi)", async () => {
  pasangPoolPalsu((sql) => {
    if (/SELECT id, antrean_bpjs_aktif/.test(sql)) return { rows: [{ ...konfigAktifMock }] };
    if (/UPDATE integrations/.test(sql)) return { rows: [] };
    throw new Error(`SQL tak terduga dalam uji: ${sql}`);
  });

  await assert.rejects(() => simpanKonfigurasi("FASKES-A", { aktif: true, mode: "mock" }), DataBelumLengkap);
});

test("batalAntrean: UPDATE bpjs_antrean_booking membatasi uuid + faskes_uuid + deleted_at IS NULL (KF-2/KT-2)", async () => {
  const fetchAsli = global.fetch;
  global.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ message: "OK" }) });
  try {
    const panggilan = pasangPoolPalsu((sql) => {
      if (/SELECT id, antrean_bpjs_aktif/.test(sql)) return { rows: [{ ...konfigAktifMock }] };
      if (/SELECT \* FROM bpjs_antrean_booking WHERE faskes_uuid/.test(sql))
        return { rows: [{ uuid: "booking-1", faskes_uuid: "FASKES-A", kode_booking: "BK1", status_lokal: "aktif", jadwal_dokter_uuid: "j1", tanggal_periksa: 1760000000 }] };
      if (/UPDATE bpjs_antrean_booking SET status_lokal = 'batal'/.test(sql)) return { rows: [{ uuid: "booking-1" }] };
      if (/pencatat_task_id/.test(sql)) return { rows: [] };
      if (/bpjs_antrean_kirim/.test(sql)) return { rows: [] };
      throw new Error(`SQL tak terduga dalam uji: ${sql}`);
    });

    const hasil = await batalAntrean("FASKES-A", { kodebooking: "BK1", keterangan: "uji" });

    const update = panggilan.find((p) => /UPDATE bpjs_antrean_booking SET status_lokal = 'batal'/.test(p.sql));
    assert.match(update.sql, /WHERE uuid = \$1 AND faskes_uuid = \$3 AND deleted_at IS NULL/);
    assert.deepEqual(update.params, ["booking-1", update.params[1], "FASKES-A"]);
    assert.equal(hasil.status, "batal");
  } finally {
    global.fetch = fetchAsli;
  }
});

test("batalAntrean: booking yang sudah berubah/terhapus di antara baca dan tulis tidak dilaporkan berhasil", async () => {
  const fetchAsli = global.fetch;
  global.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ message: "OK" }) });
  try {
    pasangPoolPalsu((sql) => {
      if (/SELECT id, antrean_bpjs_aktif/.test(sql)) return { rows: [{ ...konfigAktifMock }] };
      if (/SELECT \* FROM bpjs_antrean_booking WHERE faskes_uuid/.test(sql))
        return { rows: [{ uuid: "booking-1", faskes_uuid: "FASKES-A", kode_booking: "BK1", status_lokal: "aktif", jadwal_dokter_uuid: "j1", tanggal_periksa: 1760000000 }] };
      if (/UPDATE bpjs_antrean_booking SET status_lokal = 'batal'/.test(sql)) return { rows: [] }; // nol baris terpengaruh
      throw new Error(`SQL tak terduga dalam uji: ${sql}`);
    });

    await assert.rejects(() => batalAntrean("FASKES-A", { kodebooking: "BK1" }), GalatBpjs);
  } finally {
    global.fetch = fetchAsli;
  }
});

test("prosesKirim: pembacaan booking membatasi faskes_uuid + deleted_at IS NULL, dan tidak mengirim bila booking tidak ditemukan (KF-3/KF-4/KT-3/KT-4)", async () => {
  const panggilan = pasangPoolPalsu((sql) => {
    if (/SELECT id, antrean_bpjs_aktif/.test(sql)) return { rows: [{ ...konfigAktifMock }] };
    if (/SELECT \* FROM bpjs_antrean_kirim WHERE uuid/.test(sql)) return { rows: [{ uuid: "kirim-1", faskes_uuid: "FASKES-B", booking_uuid: "booking-milik-faskes-a", jenis: "tambah_antrean", payload: {} }] };
    if (/SELECT \* FROM bpjs_antrean_booking WHERE uuid/.test(sql)) return { rows: [] }; // booking milik faskes lain/terhapus -> tidak terlihat dari faskes B
    if (/UPDATE bpjs_antrean_kirim SET status = 'gagal'/.test(sql)) return { rows: [] };
    throw new Error(`SQL tak terduga dalam uji: ${sql}`);
  });

  const hasil = await prosesKirim("FASKES-B", "kirim-1");

  const bacaBooking = panggilan.find((p) => /SELECT \* FROM bpjs_antrean_booking WHERE uuid/.test(p.sql));
  assert.match(bacaBooking.sql, /WHERE uuid = \$1 AND faskes_uuid = \$2 AND deleted_at IS NULL/);
  assert.deepEqual(bacaBooking.params, ["booking-milik-faskes-a", "FASKES-B"]);
  assert.equal(hasil.status, "gagal");

  const diperbarui = panggilan.find((p) => /UPDATE bpjs_antrean_kirim SET status = 'gagal'/.test(p.sql));
  assert.ok(diperbarui, "baris kirim wajib ditandai gagal, bukan dibiarkan seolah berhasil");
});

test("prosesKirim: booking aktif milik faskes yang sama tetap berhasil dikirim (mode mock, jalur existing tidak rusak)", async () => {
  const panggilan = pasangPoolPalsu((sql) => {
    if (/SELECT id, antrean_bpjs_aktif/.test(sql)) return { rows: [{ ...konfigAktifMock }] };
    if (/SELECT \* FROM bpjs_antrean_kirim WHERE uuid/.test(sql)) return { rows: [{ uuid: "kirim-1", faskes_uuid: "FASKES-A", booking_uuid: "booking-1", jenis: "tambah_antrean", payload: {} }] };
    if (/SELECT \* FROM bpjs_antrean_booking WHERE uuid/.test(sql)) return { rows: [{ uuid: "booking-1", faskes_uuid: "FASKES-A", kode_booking: "BK1", deleted_at: null }] };
    if (/UPDATE bpjs_antrean_kirim SET status = 'terkirim'/.test(sql)) return { rows: [] };
    throw new Error(`SQL tak terduga dalam uji: ${sql}`);
  });

  const hasil = await prosesKirim("FASKES-A", "kirim-1");
  assert.equal(hasil.status, "terkirim");
  assert.ok(panggilan.some((p) => /UPDATE bpjs_antrean_kirim SET status = 'terkirim'/.test(p.sql)));
});
