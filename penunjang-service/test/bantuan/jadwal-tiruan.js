import { buatRepositori } from "../../src/hr/jadwal-dinas/repositori.js";
import { galat } from "../../src/hr/jadwal-dinas/bersama.js";

// Hanya data fiktif di memori. Kegagalan dapat disuntikkan pada setiap penulisan.
export const lingkungan = (awal = {}) => {
  let data = structuredClone(awal), nomor = 0;
  const log = [], kendali = { gagal: null };
  const baris = (t) => data[t] ?? [];
  const aktif = (t, f) => baris(t).filter((x) => x.faskes_uuid === f && !x.deleted_at);
  const query = async (sql, p = []) => {
    log.push([sql, p]);
    const [f, id] = p;
    if (sql.startsWith("SET LOCAL") || sql.includes("pg_advisory")) return [];
    if (sql.includes("SELECT COALESCE(MAX(nomor_versi)")) return [{ nomor: Math.max(0, ...baris("hr_jadwal_versi").filter((v) => v.faskes_uuid === f && v.jadwal_uuid === id).map((v) => v.nomor_versi)) + 1 }];
    if (sql.includes("SELECT uuid FROM hr_jadwal_versi")) return aktif("hr_jadwal_versi", f).filter((v) => v.jadwal_uuid === id && ["draf", "diajukan", "disetujui"].includes(v.status));
    if (sql.includes("SELECT uuid FROM hr_kewenangan_jadwal")) return aktif("hr_kewenangan_jadwal", f).filter((x) => x.unit_uuid === id && x.kewenangan === "setujui");
    if (sql.includes("SELECT uuid FROM hr_akun_pegawai")) return aktif("hr_akun_pegawai", f).filter((x) => x.username === id && p[2].includes(x.kepegawaian_uuid));
    if (sql.startsWith("SELECT p.*")) {
      const hasil = [];
      for (const x of aktif("hr_penempatan_shift", f)) {
        const v = aktif("hr_jadwal_versi", f).find((v) => v.uuid === x.versi_uuid), j = aktif("hr_jadwal_dinas", f).find((j) => j.uuid === v?.jadwal_uuid);
        if (!j || id.includes(j.uuid) || !(v.uuid === j.versi_aktif_uuid || ["draf", "diajukan", "disetujui"].includes(v.status))) continue;
        if (x.mulai_epoch < p[3] && x.selesai_epoch > p[2]) hasil.push({ ...x, jadwal_uuid: j.uuid, status: v.status });
      }
      return structuredClone(hasil);
    }
    if (sql.startsWith("UPDATE hr_penempatan_shift SET deleted_at")) {
      for (const x of penempatanAktif(f, id)) x.deleted_at = p[2];
      return [];
    }
    const tabel = sql.match(/FROM (\w+)/)?.[1];
    if (!tabel) throw new Error(`Kueri tiruan belum tersedia: ${sql}`);
    let hasil = aktif(tabel, f);
    if (/WHERE uuid = \$1 AND faskes_uuid = \$2/.test(sql)) hasil = aktif(tabel, id).filter((x) => x.uuid === f);
    else if (sql.includes("versi_uuid = $2")) hasil = hasil.filter((x) => x.versi_uuid === id);
    else if (sql.includes("aturan_uuid = $2")) hasil = hasil.filter((x) => x.aturan_uuid === id);
    else if (sql.includes("unit_uuid = $2")) hasil = hasil.filter((x) => x.unit_uuid === id);
    return structuredClone(hasil);
  };
  const penempatanAktif = (f, id) => aktif("hr_penempatan_shift", f).filter((x) => x.versi_uuid === id);
  const tulis = (t) => { if (kendali.gagal === t) throw new Error("Kegagalan penulisan tiruan"); };
  const db = {
    sekarang: () => 1000,
    query,
    satu: async (...args) => (await query(...args))[0] ?? null,
    sisipkan: async (t, d) => { tulis(t); const x = { uuid: `fiktif-${++nomor}`, created_at: 1000, updated_at: 1000, ...structuredClone(d) }; (data[t] ??= []).push(x); return structuredClone(x); },
    ubah: async (t, id, f, d) => { tulis(t); const x = aktif(t, f).find((x) => x.uuid === id); if (!x) throw galat(404, "Data tiruan tidak ditemukan"); Object.assign(x, structuredClone(d)); return structuredClone(x); },
    transaksi: async (fn) => {
      const lama = structuredClone(data);
      try { return await fn({ query: async (sql, p) => ({ rows: await query(sql, p) }) }); }
      catch (e) { data = lama; throw e; }
    },
  };
  const r = buatRepositori(db, async () => { if (kendali.gagal === "audit") throw new Error("Audit tiruan gagal"); });
  const a = {
    faskes: (req) => req.author.faskesUuid,
    hak: async (req) => { if (req.tanpaIzin) throw galat(403, "Tanpa izin"); },
    unit: async (k, req, unit) => { if (req.unitTerlarang === unit) throw galat(403, "Unit terlarang"); },
    sendiri: async (k, req) => req.pegawai,
    layak: async (k, req, pegawai) => { if (pegawai === "nonaktif") throw galat(422, "Pegawai tidak aktif"); },
  };
  return { r, a, kendali, log, data: () => structuredClone(data) };
};
