import { Context } from "./context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import { isSuperadmin } from "@opensimrs/authorization-sdk/peran";
import sequelizeInstance from "../configs/sequelize-instance.js";
import { QueryTypes } from "sequelize";
import { periksaAksesNicu } from "../helpers/nicu-izin.js";

export default function nicuPermission(submodul, aksi = "READ") {
    return async (req, res, next) => {
        try {
            const author = Context.get(CTX_AUTHOR);
            const penolakan = await periksaAksesNicu(author, submodul, aksi, {
                query: (sql, replacements) => sequelizeInstance.query(sql, { replacements, type: QueryTypes.SELECT }), isSuperadmin,
            });
            if (!penolakan) return next();
            return res.status(penolakan.status).json({ message: penolakan.message });
        } catch (error) { next(error); }
    };
}
