import { punyaIzinNicu } from "./nicu-aturan.js";
import { statusModulIntensif } from "./modul-intensif.js";

// Pengujian dapat menyuntikkan pembaca izin tanpa memuat konfigurasi layanan.
export async function periksaAksesNicu(author, submodul, aksi, { query, isSuperadmin }) {
    if (!author?.faskesUuid || !author?.user_uuid) return { status: 401, message: "Silakan masuk terlebih dahulu." };
    const fitur = { Dasbor: "dashboard", Penerimaan: "penerimaan", Tempat: "penempatan", Penempatan: "penempatan", Penyelesaian: "penyelesaian", Dokumentasi: "dokumentasi", Konfigurasi: "konfigurasi", Laporan: "laporan" }[submodul];
    const status = await statusModulIntensif(query, author.faskesUuid, "nicu", fitur ? `nicu_${fitur}` : null);
    if (!status.modul) return { status: 403, message: "Modul NICU belum diaktifkan untuk faskes ini." };
    if (!status.fitur) return { status: 403, message: "Fitur NICU tidak diaktifkan untuk faskes ini." };
    if (isSuperadmin(author)) return null;
    const [user] = await query("SELECT permissions FROM users WHERE uuid = :uuid AND faskes_uuid = :faskes AND deleted_at IS NULL",
        { uuid: author.user_uuid, faskes: author.faskesUuid });
    let permissions = [];
    try {
        permissions = typeof user?.permissions === "string" ? JSON.parse(user.permissions) : user?.permissions;
    } catch { /* Izin tidak valid ditolak. */ }
    if (Array.isArray(permissions) && punyaIzinNicu(permissions, submodul, aksi)) return null;
    return { status: 403, message: `Akses ditolak: izin NICU / ${submodul} / ${aksi} tidak tersedia.` };
}
