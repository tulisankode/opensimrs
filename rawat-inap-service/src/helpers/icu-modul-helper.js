import { QueryTypes } from "sequelize";
import sequelizeInstance from "../configs/sequelize-instance.js";

export const galatIcu = (code, message) => Object.assign(new Error(message), { code });
export async function pastikanModulIcu(faskesUuid, fitur, transaction) {
    const pilih = (sql, replacements = {}) => sequelizeInstance.query(sql, { replacements: { f: faskesUuid, ...replacements }, type: QueryTypes.SELECT, transaction });
    const [modul] = await pilih(`SELECT m.tersedia, m.inti, o.aktif AS override,
        s.segmen_kode, EXISTS(SELECT 1 FROM preset_segmen_modul p WHERE p.segmen_kode = s.segmen_kode AND p.modul_kode = m.kode) AS bawaan
        FROM ref_modul m LEFT JOIN faskes_segmen s ON s.faskes_uuid = :f
        LEFT JOIN faskes_modul_override o ON o.faskes_uuid = :f AND o.modul_kode = m.kode WHERE m.kode = 'icu'`);
    if (!modul?.tersedia || (!modul.inti && !(modul.override ?? (!modul.segmen_kode || modul.bawaan)))) throw galatIcu(403, "Modul ICU tidak aktif");
    if (fitur) {
        const [baris] = await pilih(`SELECT r.tersedia, r.wajib, o.aktif AS override,
            EXISTS(SELECT 1 FROM preset_segmen_fitur_mati p WHERE p.segmen_kode = :segmen AND p.fitur_kode = r.kode) AS mati
            FROM ref_fitur r LEFT JOIN faskes_fitur_override o ON o.faskes_uuid = :f AND o.fitur_kode = r.kode
            WHERE r.kode = :fitur AND r.modul_kode = 'icu'`, { segmen: modul.segmen_kode ?? null, fitur });
        if (!baris?.tersedia || (!baris.wajib && !(baris.override ?? !baris.mati))) throw galatIcu(403, "Fitur ICU tidak aktif");
    }
}
