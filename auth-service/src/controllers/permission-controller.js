import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { QueryTypes } from "sequelize";
import { mapPermission } from "../helpers/permission-list.js";
import { isSuperadmin } from "@opensimrs/authorization-sdk/peran";
import generateRedisKeyByJwtToken from "@opensimrs/authorization-sdk/generateKeyRedis";
import redisClient from "../configurations/redis-client-config.js";

// Semua modul izin yang dikenal (kunci mapPermission). Sumber tunggal untuk editor Role di frontend.
const SEMUA_MODUL = [
  "Dashboard", "Antrian", "Admisi", "Rawat Jalan", "Rawat Inap", "ICU", "IGD", "Farmasi", "STOK", "Inventory",
  "Laboratorium", "Patologi Anatomi", "Mikrobiologi", "Radiologi", "Fisioterapi", "MCU", "CSSD", "Training",
  "Pembayaran", "Datamaster", "Laporan", "Setting", "Profile", "SIMRS Studio",
];

// Modul yang tidak pernah ditambahkan otomatis oleh sinkron Manajemen Modul (diberikan manual per peran oleh superadmin).
const TIDAK_DISINKRON = ["simrs studio"];

const baca = (teks) => {
  try {
    const data = JSON.parse(teks ?? "[]");
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
};

// Tambahkan definisi modul yang belum ada (tidak mengubah hak modul yang sudah dimiliki).
const gabung = (teks, tambahan) => {
  const data = baca(teks);
  if (!data) return null;
  const ada = new Set(data.map((m) => m?.module));
  const baru = tambahan.filter((m) => !ada.has(m.module));
  return baru.length ? JSON.stringify([...data, ...baru]) : null;
};

export default class PermissionController {
  // GET /permission/katalog → [{ module, subModules }]
  static async katalog(req, res, next) {
    try {
      // profilePermission juga bermodul "Setting" → sub-modul modul yang sama digabung (Profile Faskes … Profile Saya)
      const unik = [];
      for (const m of mapPermission(SEMUA_MODUL)) {
        const ada = unik.find((x) => x.module === m.module);
        if (!ada) unik.push({ module: m.module, subModules: [...(m.subModules ?? [])] });
        else for (const sm of m.subModules ?? []) if (!ada.subModules.some((x) => x.name === sm.name)) ada.subModules.push(sm);
      }
      res.status(200).json({ message: "Data berhasil ditampilkan", payload: unik });
    } catch (error) {
      next(error);
    }
  }

  // POST /permission/sinkron-modul { modul: ["Patologi Anatomi", ...] }
  // Dipanggil Manajemen Modul (superadmin) setelah modul faskes diaktifkan: izin modul ditambahkan ke peran admin
  // faskes itu (peran dengan sub-modul Setting › "Profile Faskes"; modul "Setting" saja juga dimiliki semua peran lewat
  // Profile Saya) beserta penggunanya, serta ke peran super admin. Hanya menambah.
  static async sinkronModul(req, res, next) {
    try {
      const author = req.author ?? {};
      if (!isSuperadmin(author)) {
        return res.status(403).json({ message: "Hanya superadmin yang dapat menyinkronkan izin modul." });
      }
      const diminta = (Array.isArray(req.body?.modul) ? req.body.modul : []).map(String);
      const tambahan = mapPermission(
        diminta.filter((m) => SEMUA_MODUL.some((x) => x.toLowerCase() === m.toLowerCase()) && !TIDAK_DISINKRON.includes(m.toLowerCase()))
      );
      if (!tambahan.length) return res.status(200).json({ message: "Tidak ada modul untuk disinkronkan", payload: { peran: 0, pengguna: 0 } });

      const hasil = await sequelizeInstance.transaction(async (transaction) => {
        const q = (sql, replacements, type = QueryTypes.SELECT) => sequelizeInstance.query(sql, { replacements, type, transaction });
        const peran = await q(
          `SELECT uuid, permissions FROM role
           WHERE deleted_at IS NULL AND ((faskes_uuid = :f AND permissions LIKE '%"Profile Faskes"%') OR (faskes_uuid IS NULL AND LOWER(name) = 'super admin'))`,
          { f: author.faskesUuid }
        );
        let jumlahPeran = 0;
        let jumlahPengguna = 0;
        for (const r of peran) {
          const baru = gabung(r.permissions, tambahan);
          if (baru) {
            await q(`UPDATE role SET permissions = :p WHERE uuid = :u`, { p: baru, u: r.uuid }, QueryTypes.UPDATE);
            jumlahPeran++;
          }
          const pengguna = await q(`SELECT uuid, permissions FROM users WHERE role_uuid = :r AND deleted_at IS NULL`, { r: r.uuid });
          for (const u of pengguna) {
            const baruU = gabung(u.permissions, tambahan);
            if (baruU) {
              await q(`UPDATE users SET permissions = :p WHERE uuid = :u`, { p: baruU, u: u.uuid }, QueryTypes.UPDATE);
              jumlahPengguna++;
            }
          }
        }
        const [saya] = await q(`SELECT permissions FROM users WHERE username = :n AND deleted_at IS NULL LIMIT 1`, { n: author.username });
        return { peran: jumlahPeran, pengguna: jumlahPengguna, permissions: baca(saya?.permissions) ?? [] };
      });
      res.status(200).json({ message: `Izin modul disinkronkan ke ${hasil.peran} peran admin`, payload: hasil });
    } catch (error) {
      next(error);
    }
  }

  // POST /permission/muat-ulang
  // Izin sesi ini dibaca ulang dari database (mis. setelah modul baru diaktifkan Manajemen Modul / SIMRS Studio): cache
  // izin token di Redis ditimpa tanpa mengubah masa berlakunya, sehingga menu & hak akses baru berlaku tanpa login ulang.
  static async muatUlang(req, res, next) {
    try {
      const [saya] = await sequelizeInstance.query(
        `SELECT permissions FROM users WHERE username = :n AND deleted_at IS NULL LIMIT 1`,
        { replacements: { n: req.author?.username }, type: QueryTypes.SELECT }
      );
      const permissions = baca(saya?.permissions) ?? [];
      const token = (req.get("Authorization") ?? "").substring(7);
      await redisClient.set(`token-${generateRedisKeyByJwtToken(token)}`, JSON.stringify({ permissions }), { XX: true, KEEPTTL: true });
      res.status(200).json({ message: "Izin sesi dimuat ulang", payload: { permissions } });
    } catch (error) {
      next(error);
    }
  }
}
