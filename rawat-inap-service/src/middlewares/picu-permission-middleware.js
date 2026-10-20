import { Context } from "./context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import { isSuperadmin } from "@opensimrs/authorization-sdk/peran";
import { punyaIzinPicu, punyaIzinModul, submodulDokumentasi } from "../picu/picu-policy.js";
import { statusModulIntensif } from "../helpers/modul-intensif.js";

export const buatPicuAkses = (db, ambilAuthor = () => Context.get(CTX_AUTHOR)) => async (req, res, next) => {
    try {
        const author = ambilAuthor();
        if (!author?.faskesUuid || !author?.user_uuid) return res.status(401).json({ message: "Konteks pengguna dan faskes diperlukan." });
        const q = (sql, data = {}) => db.query(sql, { replacements: { ...data, f: author.faskesUuid, pengguna: author.user_uuid }, type: "SELECT" });
        const fitur = req.path.startsWith("/dashboard") ? "dasbor" : req.path.startsWith("/laporan") ? "laporan"
            : req.path.startsWith("/konfigurasi") ? "konfigurasi" : req.path.startsWith("/tempat-tidur") || /\/(perpindahan|penutupan)$/.test(req.path)
                ? "tempat_tidur" : req.path.endsWith("/transaksi") ? "transaksi" : "episode";
        const status = await statusModulIntensif(q, author.faskesUuid, "picu", `picu_${fitur}`);
        if (!status.modul) return res.status(403).json({ message: "Modul PICU tidak aktif pada faskes ini." });
        if (!status.fitur) return res.status(403).json({ message: "Fitur PICU tidak aktif pada faskes ini." });
        // Super admin tidak dibatasi daftar izin (pola ICU/NICU); modul & fitur faskes tetap berlaku.
        if (isSuperadmin(author)) {
            res.locals.picuBoleh = () => true;
            res.locals.picuDokumentasi = () => true;
            res.locals.picuSumber = () => true;
            return next();
        }
        const [user] = await q(`SELECT permissions FROM users WHERE uuid = :pengguna AND faskes_uuid = :f AND deleted_at IS NULL`);
        let permissions = [];
        try { permissions = typeof user?.permissions === "string" ? JSON.parse(user.permissions) : user?.permissions ?? []; } catch { /* Izin tidak sah ditolak. */ }
        res.locals.picuBoleh = (submodul, aksi) => punyaIzinPicu(permissions, submodul, aksi);
        res.locals.picuDokumentasi = (jenis, aksi) => res.locals.picuBoleh(submodulDokumentasi(jenis), aksi);
        res.locals.picuSumber = (modul, submodul) => punyaIzinModul(permissions, modul, submodul, "READ");
        next();
    } catch { res.status(503).json({ message: "Konfigurasi akses PICU belum dapat diverifikasi." }); }
};

export const picuPermission = (submodul, aksi = "READ") => (req, res, next) => {
    if (!res.locals.picuBoleh?.(submodul, aksi)) return res.status(403).json({ message: `Akses PICU / ${submodul} / ${aksi} ditolak.` });
    next();
};
