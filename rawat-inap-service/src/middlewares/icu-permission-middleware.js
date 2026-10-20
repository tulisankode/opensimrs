import { Context } from "./context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import { isSuperadmin } from "@opensimrs/authorization-sdk/peran";
import sequelizeInstance from "../configs/sequelize-instance.js";
import { QueryTypes } from "sequelize";

// Pemeriksaan izin fitur ruang perawatan intensif (modul "ICU"/"CCU"/"HDU" di auth-service/src/helpers/permission-list.js).
// Izin pengguna dibaca langsung dari kolom users.permissions (materialisasi izin saat ini) — bukan dari cache sesi di
// Redis, karena rawat-inap-service belum memakai Redis untuk sesi/izin.
const bacaIzin = (teks) => {
    try {
        const data = JSON.parse(teks ?? "[]");
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
};

export const punyaIzin = (permissions, moduleName, submoduleName, action) => {
    if (action === undefined) { action = submoduleName; submoduleName = moduleName; moduleName = "ICU"; }
    const modul = permissions.find((m) => m?.module === moduleName);
    if (!modul) return false;
    const sub = (modul.subModules ?? modul.submodules ?? []).find((s) => s?.name === submoduleName);
    if (!sub) return false;
    return (sub.allows ?? []).some((a) => (typeof a === "string" ? a : a?.name) === action);
};

// submoduleName & action harus sama persis dengan definisi modul di permission-list.js.
export const izinIntensif = (moduleName) => (submoduleName, action = "READ") => async (request, response, nextFunction) => {
    try {
        const author = Context.get(CTX_AUTHOR) ?? response.locals.jwtData;
        if (!author) return response.status(401).json({ message: "Silakan masuk terlebih dahulu", payload: null });
        if (isSuperadmin(author)) { Context.set("icu_superadmin", true); return nextFunction(); }

        const [baris] = await sequelizeInstance.query(
            `SELECT permissions FROM users WHERE uuid = :uuid AND deleted_at IS NULL`,
            { replacements: { uuid: author.user_uuid }, type: QueryTypes.SELECT },
        );
        const permissions = bacaIzin(baris?.permissions);
        Context.set("icu_izin", permissions);
        if (punyaIzin(permissions, moduleName, submoduleName, action)) return nextFunction();

        return response.status(403).json({ message: `Akses ditolak: izin ${moduleName} / ${submoduleName} / ${action} tidak tersedia`, payload: null });
    } catch (error) {
        nextFunction(error);
    }
};

const icuPermission = izinIntensif("ICU");

export default icuPermission;
