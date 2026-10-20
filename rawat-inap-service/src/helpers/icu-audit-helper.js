import { catatPeristiwaAudit } from "@opensimrs/model-sdk/audit-sequelize";
import sequelizeInstance from "../configs/sequelize-instance.js";
import { Context } from "../middlewares/context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";

export const auditIcu = (transaction, aksi, entitas, uuid) => {
    const author = Context.get(CTX_AUTHOR);
    const catat = () => catatPeristiwaAudit(sequelizeInstance, { layanan: "rawat-inap-service", aksi, entitas, entitas_uuid: uuid,
        faskes_uuid: author.faskesUuid, pengguna_uuid: author.user_uuid, identitas_akun: author.username });
    // Audit terpusat mengikuti perilaku existing; riwayat lokal tetap atomik dalam transaksi utama.
    if (transaction) transaction.afterCommit(catat);
    else return catat();
};
