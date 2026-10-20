import { QueryTypes } from "sequelize";
import { isSuperadmin } from "@opensimrs/authorization-sdk/peran";
import sequelizeInstance from "../configs/sequelize-instance.js";
import { Context } from "./context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import { galatIcu } from "../helpers/icu-modul-helper.js";

export const CTX_ICU_UNIT = "icu_unit";
// Pembatasan unit ICU bersifat opt-in per unit: unit (ruangan) yang SUDAH dipetakan di icu_akses_units hanya dapat
// diakses peran yang dipetakan; unit tanpa pemetaan tetap terbuka bagi pengguna yang berizin ICU (perilaku ICU
// sebelum STD-0048, sehingga faskes yang belum mengatur akses unit tidak kehilangan akses). Super admin semua unit.
//   cakupan = { semua, units: unit milik peran pengguna, terbatas: semua unit yang dipetakan di faskes }
export const unitDiizinkan = (cakupan, unit) =>
    !!cakupan && (cakupan.semua || !(cakupan.terbatas ?? []).includes(unit) || cakupan.units.includes(unit));
export const pastikanUnitIcu = (unit) => {
    if (!unitDiizinkan(Context.get(CTX_ICU_UNIT), unit)) throw galatIcu(403, "Akses unit ICU tidak tersedia");
};
export const filterUnitIcu = (alias = "") => {
    const cakupan = Context.get(CTX_ICU_UNIT);
    if (!cakupan) throw galatIcu(403, "Cakupan unit ICU belum tersedia");
    const kolom = alias ? `${alias}.ruangan_uuid` : "ruangan_uuid";
    if (cakupan.semua || !(cakupan.terbatas ?? []).length) return { sql: "TRUE", replacements: {} };
    return {
        sql: `(${kolom} IS NULL OR ${kolom} NOT IN (:unitTerbatas) OR ${kolom} IN (:unitIcu))`,
        replacements: { unitTerbatas: cakupan.terbatas, unitIcu: cakupan.units.length ? cakupan.units : [""] },
    };
};
export async function perbaruiCakupanUnitIcu(transaction) {
    const author = Context.get(CTX_AUTHOR);
    if (isSuperadmin(author)) return Context.set(CTX_ICU_UNIT, { semua: true, units: [], terbatas: [] });
    const baris = await sequelizeInstance.query(`SELECT a.ruangan_uuid, bool_or(u.uuid IS NOT NULL) AS milik
        FROM icu_akses_units a LEFT JOIN users u ON u.role_uuid = a.role_uuid AND u.uuid = :user AND u.deleted_at IS NULL
        WHERE a.faskes_uuid = :f AND a.deleted_at IS NULL GROUP BY a.ruangan_uuid`,
    { replacements: { user: author.user_uuid, f: author.faskesUuid }, type: QueryTypes.SELECT, transaction });
    Context.set(CTX_ICU_UNIT, { semua: false, units: baris.filter((b) => b.milik).map((b) => b.ruangan_uuid), terbatas: baris.map((b) => b.ruangan_uuid) });
}
export default async function icuUnit(request, response, next) {
    try {
        const author = Context.get(CTX_AUTHOR);
        if (!author?.faskesUuid) return response.status(401).json({ message: "Fasilitas dari token wajib tersedia", payload: null });
        await perbaruiCakupanUnitIcu();
        next();
    } catch (error) { next(error); }
}
