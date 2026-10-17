import { Context } from "./context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import { isSuperadmin } from "@opensimrs/authorization-sdk/peran";
import sequelizeInstance from "../configs/sequelize-instance.js";
import { QueryTypes } from "sequelize";

// Pemeriksaan izin fitur ICU (modul "ICU" di auth-service/src/helpers/permission-list.js). Izin pengguna dibaca
// langsung dari kolom users.permissions (materialisasi izin saat ini) — bukan dari cache sesi di Redis, karena
// rawat-inap-service belum memakai Redis untuk sesi/izin.
const bacaIzin = (teks) => {
    try {
        const data = JSON.parse(teks ?? "[]");
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
};

const punyaIzin = (permissions, submoduleName, action) => {
    const modul = permissions.find((m) => m?.module === "ICU");
    if (!modul) return false;
    const sub = (modul.subModules ?? modul.submodules ?? []).find((s) => s?.name === submoduleName);
    if (!sub) return false;
    return (sub.allows ?? []).some((a) => (typeof a === "string" ? a : a?.name) === action);
};

// submoduleName & action harus sama persis dengan icuPermission di permission-list.js.
const icuPermission = (submoduleName, action = "READ") => async (request, response, nextFunction) => {
    try {
        const author = Context.get(CTX_AUTHOR) ?? response.locals.jwtData;
        if (!author) return response.status(401).json({ message: "silakan login terlebih dahulu!" });
        if (isSuperadmin(author)) return nextFunction();

        const [baris] = await sequelizeInstance.query(
            `SELECT permissions FROM users WHERE uuid = :uuid AND deleted_at IS NULL`,
            { replacements: { uuid: author.user_uuid }, type: QueryTypes.SELECT },
        );
        const permissions = bacaIzin(baris?.permissions);
        if (punyaIzin(permissions, submoduleName, action)) return nextFunction();

        return response.status(403).json({ message: `Akses ditolak: izin ICU / ${submoduleName} / ${action} tidak tersedia` });
    } catch (error) {
        nextFunction(error);
    }
};

export default icuPermission;
