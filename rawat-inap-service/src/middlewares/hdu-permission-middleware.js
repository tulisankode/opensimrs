import { QueryTypes } from "sequelize";
import { isSuperadmin } from "@opensimrs/authorization-sdk/peran";
import { Context } from "./context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import sequelizeInstance from "../configs/sequelize-instance.js";
import { punyaIzinHdu } from "../services/hdu-izin.js";

export const fiturHduAktif = async (f, kode = "rawat_inap_hdu", modul = "rawat_inap") => {
    const [hasil] = await sequelizeInstance.query(`
        SELECT m.tersedia AND ft.tersedia
          AND COALESCE(mo.aktif, m.inti OR s.segmen_kode IS NULL OR EXISTS (
            SELECT 1 FROM preset_segmen_modul pm WHERE pm.segmen_kode = s.segmen_kode AND pm.modul_kode = m.kode))
          AND (ft.wajib OR COALESCE(fo.aktif, NOT EXISTS (
            SELECT 1 FROM preset_segmen_fitur_mati pf WHERE pf.segmen_kode = s.segmen_kode AND pf.fitur_kode = ft.kode))) AS aktif
        FROM ref_modul m JOIN ref_fitur ft ON ft.modul_kode = m.kode
        LEFT JOIN faskes_segmen s ON s.faskes_uuid = :f
        LEFT JOIN faskes_modul_override mo ON mo.faskes_uuid = :f AND mo.modul_kode = m.kode
        LEFT JOIN faskes_fitur_override fo ON fo.faskes_uuid = :f AND fo.fitur_kode = ft.kode
        WHERE m.kode = :modul AND ft.kode = :kode`, { replacements: { f, kode, modul }, type: QueryTypes.SELECT });
    return hasil?.aktif === true;
};

export const modulIcuAktif = async (f) => {
    const [hasil] = await sequelizeInstance.query(`SELECT m.tersedia AND COALESCE(o.aktif, s.segmen_kode IS NULL OR EXISTS (
        SELECT 1 FROM preset_segmen_modul p WHERE p.segmen_kode = s.segmen_kode AND p.modul_kode = m.kode)) AS aktif
        FROM ref_modul m LEFT JOIN faskes_segmen s ON s.faskes_uuid = :f
        LEFT JOIN faskes_modul_override o ON o.faskes_uuid = :f AND o.modul_kode = m.kode WHERE m.kode = 'icu'`, {
        replacements: { f }, type: QueryTypes.SELECT,
    });
    return hasil?.aktif === true;
};

const hduPermission = (submodule, action = "READ") => async (req, res, next) => {
    try {
        const author = Context.get(CTX_AUTHOR);
        if (!author?.faskesUuid || !author?.user_uuid) return res.status(401).json({ message: "Identitas dan fasilitas kesehatan diperlukan.", payload: null });
        if (!await fiturHduAktif(author.faskesUuid)) return res.status(403).json({ message: "Fitur HDU tidak aktif.", payload: null });
        const [user] = await sequelizeInstance.query(`SELECT permissions FROM users WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL`, {
            replacements: { uuid: author.user_uuid, f: author.faskesUuid }, type: QueryTypes.SELECT,
        });
        let permissions = [];
        try { permissions = typeof user?.permissions === "string" ? JSON.parse(user.permissions) : user?.permissions ?? []; } catch { /* Izin tidak valid ditolak. */ }
        const boleh = (module, sub, aksi, feature) => !!user && (isSuperadmin(author) || (Array.isArray(permissions) && punyaIzinHdu(permissions, module, sub, aksi, feature)));
        if (!boleh("Rawat Inap", submodule, action)) return res.status(403).json({ message: "Izin tindakan HDU tidak tersedia.", payload: null });
        res.locals.hduBoleh = boleh;
        next();
    } catch (error) { next(error); }
};
export default hduPermission;
