// Aktivasi setelah penerapan lokal: modul/fitur yang baru tersedia di katalog (database/data/katalog-modul.json)
// dinyalakan untuk faskes, dan izin modul baru diberikan ke peran admin faskes serta super admin — sama seperti bila
// superadmin menyalakannya di Setting › Manajemen Modul. Semua yang diubah dicatat di studio_item.aktivasi agar
// "Batalkan penerapan" bisa membaliknya.
import path from "path";
import { pathToFileURL } from "url";
import { pool, sekarang } from "./db.js";
import { git } from "./git.js";

const KATALOG = "database/data/katalog-modul.json";
const DAFTAR_IZIN = "auth-service/src/helpers/permission-list.js";

const bacaKatalog = async (ref, cwd) => {
  const r = await git(["show", `${ref}:${KATALOG}`], { cwd, izinkanGagal: true });
  if (!r.ok) return null;
  try {
    return JSON.parse(r.keluaran);
  } catch {
    return null;
  }
};

// Modul & fitur yang berubah menjadi tersedia di antara dua versi katalog, beserta judul menu modul baru
// (judul menu = nama modul izin, mis. "Patologi Anatomi").
export const katalogBaru = (sebelum, sesudah) => {
  const tersedia = (k, jenis) => new Set((k?.[jenis] ?? []).filter((x) => x.tersedia).map((x) => x.kode));
  const baru = (jenis) => [...tersedia(sesudah, jenis)].filter((kode) => !tersedia(sebelum, jenis).has(kode));
  const modul = baru("modul");
  const fitur = (sesudah?.fitur ?? []).filter((f) => baru("fitur").includes(f.kode)).map((f) => ({ kode: f.kode, modul: f.modul, nama: f.nama }));
  return {
    modul: (sesudah?.modul ?? []).filter((m) => modul.includes(m.kode)).map((m) => ({ kode: m.kode, nama: m.nama, menu: m.menu ?? [] })),
    fitur,
  };
};

// Katalog yang berubah sejak titik awal item (dari) sampai commit penerapan (sha); tanpa dari = dibanding induk pertama merge.
export const perubahanKatalog = async (sha, cwd, dari = null) => katalogBaru(await bacaKatalog(dari ?? `${sha}^1`, cwd), await bacaKatalog(sha, cwd));

// Tambahkan modul izin yang belum ada (hak modul yang sudah dimiliki tidak diubah).
export const tambahIzin = (teks, tambahan) => {
  let data;
  try {
    data = JSON.parse(teks ?? "[]");
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;
  const ada = new Set(data.map((m) => m?.module));
  const baru = tambahan.filter((m) => !ada.has(m.module));
  return baru.length ? { teks: JSON.stringify([...data, ...baru]), modul: baru.map((m) => m.module) } : null;
};

export const kurangiIzin = (teks, modul) => {
  let data;
  try {
    data = JSON.parse(teks ?? "[]");
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;
  const sisa = data.filter((m) => !modul.includes(m?.module));
  return sisa.length === data.length ? null : JSON.stringify(sisa);
};

// Definisi izin dari working tree hasil penerapan (bukan salinan yang dimuat saat studio-service dijalankan).
const definisiIzin = async (cwd, judulMenu) => {
  if (!judulMenu.length) return [];
  try {
    const url = pathToFileURL(path.join(cwd, DAFTAR_IZIN)).href;
    const { mapPermission } = await import(`${url}?v=${Date.now()}`);
    return mapPermission(judulMenu);
  } catch {
    return [];
  }
};

const ringkasan = async (k, faskes) => {
  const [segmen] = (await k.query(`SELECT segmen_kode FROM faskes_segmen WHERE faskes_uuid = $1`, [faskes])).rows;
  const ov = async (tabel, kolom) => (await k.query(`SELECT ${kolom} AS kode, aktif FROM ${tabel} WHERE faskes_uuid = $1`, [faskes])).rows;
  // Berurutan: satu klien transaksi tidak boleh menjalankan kueri bersamaan.
  const m = await ov("faskes_modul_override", "modul_kode");
  const f = await ov("faskes_fitur_override", "fitur_kode");
  const b = await ov("faskes_bagian_override", "bagian_kode");
  const pisah = (baris, aktif) => baris.filter((r) => r.aktif === aktif).map((r) => r.kode);
  return {
    segmen: segmen?.segmen_kode ?? null,
    modul_tambahan: pisah(m, true), modul_nonaktif: pisah(m, false),
    fitur_tambahan: pisah(f, true), fitur_nonaktif: pisah(f, false),
    bagian_tambahan: pisah(b, true), bagian_nonaktif: pisah(b, false),
  };
};

// Nyalakan satu kode untuk faskes bila belum aktif: override nonaktif → aktif; tidak ada di preset segmen → override aktif.
// Mengembalikan catatan { tabel, kolom, faskes, kode, sebelum } atau null bila sudah aktif.
const nyalakan = async (k, { tabel, kolom, faskes, kode, diPreset }) => {
  const [ov] = (await k.query(`SELECT aktif FROM ${tabel} WHERE faskes_uuid = $1 AND ${kolom} = $2`, [faskes, kode])).rows;
  if (ov?.aktif === true || (!ov && diPreset)) return null;
  await k.query(
    `INSERT INTO ${tabel} (faskes_uuid, ${kolom}, aktif) VALUES ($1, $2, true) ON CONFLICT (faskes_uuid, ${kolom}) DO UPDATE SET aktif = true`,
    [faskes, kode],
  );
  return { tabel, kolom, faskes, kode, sebelum: ov ? ov.aktif : null };
};

/**
 * Aktifkan modul/fitur baru hasil penerapan.
 * @param {{ sha: string, dari?: string, cwd: string, faskes: string[] | "semua", oleh: string, alasan: string, sebelumnya?: object }} opsi
 * @returns catatan aktivasi (disimpan di studio_item.aktivasi) atau null bila tidak ada yang baru di katalog.
 */
export const aktifkan = async ({ sha, dari = null, cwd, faskes, oleh, alasan, sebelumnya = null }) => {
  const baru = await perubahanKatalog(sha, cwd, dari);
  // Terapkan ulang: perbaikan berikutnya tidak mengubah katalog, tetapi aktivasi penerapan pertama tetap berlaku.
  const modul = [...new Map([...(sebelumnya?.modul ?? []), ...baru.modul].map((m) => [m.kode, m])).values()];
  const fitur = [...new Map([...(sebelumnya?.fitur ?? []), ...baru.fitur].map((f) => [f.kode, f])).values()];
  if (!modul.length && !fitur.length) return sebelumnya;

  const izinModul = await definisiIzin(cwd, [...new Set(modul.flatMap((m) => m.menu))]);
  const k = await pool.connect();
  try {
    await k.query("BEGIN");
    const daftarFaskes = faskes === "semua"
      ? (await k.query(`SELECT faskes_uuid FROM faskes_segmen`)).rows.map((r) => r.faskes_uuid)
      : (await k.query(`SELECT faskes_uuid FROM faskes_segmen WHERE faskes_uuid = ANY($1)`, [faskes])).rows.map((r) => r.faskes_uuid);
    const override = [...(sebelumnya?.override ?? [])];
    const izin = [...(sebelumnya?.izin ?? [])];
    const lewati = [];
    // Kode yang belum ada di tabel katalog (migrasi sinkron katalog belum dijalankan) tidak bisa dinyalakan.
    const diKatalog = async (tabel, daftar) => {
      const ada = new Set((await k.query(`SELECT kode FROM ${tabel} WHERE tersedia AND kode = ANY($1)`, [daftar.map((x) => x.kode)])).rows.map((r) => r.kode));
      for (const x of daftar.filter((x) => !ada.has(x.kode))) lewati.push({ faskes: null, kode: x.kode, alasan: "belum ada di katalog database — jalankan npm run db:migrate" });
      return daftar.filter((x) => ada.has(x.kode));
    };
    const modulSiap = await diKatalog("ref_modul", modul);
    const fiturSiap = await diKatalog("ref_fitur", fitur);

    for (const f of daftarFaskes) {
      const awal = await ringkasan(k, f);
      const presetModul = new Set((await k.query(`SELECT modul_kode FROM preset_segmen_modul WHERE segmen_kode = $1`, [awal.segmen])).rows.map((r) => r.modul_kode));
      const fiturMati = new Set((await k.query(`SELECT fitur_kode FROM preset_segmen_fitur_mati WHERE segmen_kode = $1`, [awal.segmen])).rows.map((r) => r.fitur_kode));
      const dicatat = override.length;
      for (const m of modulSiap) {
        const c = await nyalakan(k, { tabel: "faskes_modul_override", kolom: "modul_kode", faskes: f, kode: m.kode, diPreset: presetModul.has(m.kode) });
        if (c) override.push(c);
      }
      // Fitur hanya berlaku bila modulnya aktif di faskes itu; modul induk tidak ikut dinyalakan.
      const akhirModul = await ringkasan(k, f);
      const modulAktif = (kode) => !akhirModul.modul_nonaktif.includes(kode) && (presetModul.has(kode) || akhirModul.modul_tambahan.includes(kode));
      for (const ft of fiturSiap) {
        if (!modulAktif(ft.modul)) {
          lewati.push({ faskes: f, kode: ft.kode, alasan: `modul ${ft.modul} tidak aktif` });
          continue;
        }
        const c = await nyalakan(k, { tabel: "faskes_fitur_override", kolom: "fitur_kode", faskes: f, kode: ft.kode, diPreset: !fiturMati.has(ft.kode) });
        if (c) override.push(c);
      }
      if (override.length > dicatat) {
        await k.query(
          `INSERT INTO faskes_modul_riwayat (faskes_uuid, oleh, sebelum, sesudah, alasan, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
          [f, oleh, JSON.stringify(awal), JSON.stringify(await ringkasan(k, f)), alasan, sekarang()],
        );
      }
    }

    // Izin modul baru: peran admin faskes (punya Setting › Profile Faskes) di faskes tujuan + super admin, beserta penggunanya.
    if (izinModul.length) {
      const peran = (await k.query(
        `SELECT uuid, permissions FROM role WHERE deleted_at IS NULL
           AND ((faskes_uuid = ANY($1) AND permissions LIKE '%"Profile Faskes"%') OR (faskes_uuid IS NULL AND LOWER(name) = 'super admin'))`,
        [daftarFaskes],
      )).rows;
      for (const r of peran) {
        const hasil = tambahIzin(r.permissions, izinModul);
        if (hasil) {
          await k.query(`UPDATE role SET permissions = $1 WHERE uuid = $2`, [hasil.teks, r.uuid]);
          izin.push({ tabel: "role", uuid: r.uuid, modul: hasil.modul });
        }
        for (const u of (await k.query(`SELECT uuid, permissions FROM users WHERE role_uuid = $1 AND deleted_at IS NULL`, [r.uuid])).rows) {
          const hasilU = tambahIzin(u.permissions, izinModul);
          if (hasilU) {
            await k.query(`UPDATE users SET permissions = $1 WHERE uuid = $2`, [hasilU.teks, u.uuid]);
            izin.push({ tabel: "users", uuid: u.uuid, modul: hasilU.modul });
          }
        }
      }
    }
    await k.query("COMMIT");
    return { modul, fitur, faskes: daftarFaskes, override, izin, lewati, waktu: sekarang(), oleh };
  } catch (e) {
    await k.query("ROLLBACK");
    throw e;
  } finally {
    k.release();
  }
};

// Balik aktivasi (dipanggil saat penerapan dibatalkan): override kembali ke nilai semula, modul izin yang ditambahkan dicabut.
export const nonaktifkan = async (aktivasi, { oleh, alasan }) => {
  if (!aktivasi?.override?.length && !aktivasi?.izin?.length) return;
  const k = await pool.connect();
  try {
    await k.query("BEGIN");
    const perFaskes = new Map();
    for (const o of [...(aktivasi.override ?? [])].reverse()) {
      if (!perFaskes.has(o.faskes)) perFaskes.set(o.faskes, await ringkasan(k, o.faskes));
      if (o.sebelum === null) await k.query(`DELETE FROM ${o.tabel} WHERE faskes_uuid = $1 AND ${o.kolom} = $2`, [o.faskes, o.kode]);
      else await k.query(`UPDATE ${o.tabel} SET aktif = $3 WHERE faskes_uuid = $1 AND ${o.kolom} = $2`, [o.faskes, o.kode, o.sebelum]);
    }
    for (const [f, awal] of perFaskes) {
      await k.query(
        `INSERT INTO faskes_modul_riwayat (faskes_uuid, oleh, sebelum, sesudah, alasan, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        [f, oleh, JSON.stringify(awal), JSON.stringify(await ringkasan(k, f)), alasan, sekarang()],
      );
    }
    for (const i of aktivasi.izin ?? []) {
      const tabel = i.tabel === "users" ? "users" : "role";
      const [baris] = (await k.query(`SELECT permissions FROM ${tabel} WHERE uuid = $1`, [i.uuid])).rows;
      const baru = baris ? kurangiIzin(baris.permissions, i.modul) : null;
      if (baru) await k.query(`UPDATE ${tabel} SET permissions = $1 WHERE uuid = $2`, [baru, i.uuid]);
    }
    await k.query("COMMIT");
  } catch (e) {
    await k.query("ROLLBACK");
    throw e;
  } finally {
    k.release();
  }
};
