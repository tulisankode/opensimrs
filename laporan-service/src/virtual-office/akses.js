import { QueryTypes } from "sequelize"
import sequelize from "../config/sequelize-db.js"

// Hanya konfigurasi katalog; tidak membaca tabel pasien atau transaksi klinis.
export const bacaModul = async (faskes) => {
  const pilih = (sql) => sequelize.query(sql, { replacements: { f: faskes }, type: QueryTypes.SELECT })
  const modul = await pilih(`SELECT m.kode FROM ref_modul m
    LEFT JOIN faskes_segmen s ON s.faskes_uuid = :f
    LEFT JOIN faskes_modul_override o ON o.faskes_uuid = :f AND o.modul_kode = m.kode
    WHERE m.tersedia = true AND (m.inti = true OR COALESCE(o.aktif,
      s.segmen_kode IS NULL OR EXISTS (SELECT 1 FROM preset_segmen_modul p
      WHERE p.segmen_kode = s.segmen_kode AND p.modul_kode = m.kode)))`)
  const fitur = await pilih(`SELECT f.kode FROM ref_fitur f
    LEFT JOIN faskes_segmen s ON s.faskes_uuid = :f
    LEFT JOIN faskes_fitur_override o ON o.faskes_uuid = :f AND o.fitur_kode = f.kode
    WHERE f.kode = 'dashboard_virtual_office' AND f.tersedia = true
    AND (f.wajib = true OR COALESCE(o.aktif, NOT EXISTS (
      SELECT 1 FROM preset_segmen_fitur_mati p WHERE p.segmen_kode = s.segmen_kode AND p.fitur_kode = f.kode)))`)
  return { modul: modul.map((m) => m.kode), fitur: fitur.length > 0 }
}
