import { registerHooks } from "node:module";

// Pemuat menutup akses konfigurasi database dan model asli sebelum impor repository.
const sumber = {
    koneksi: "export default globalThis.__icuTiruan.db;",
    pelayanan: "export const RawatInapModel=globalThis.__icuTiruan.rawat; export const PerpindahanModel=globalThis.__icuTiruan.pindah;",
    admisi: "export const RoomMonitoringModel=globalThis.__icuTiruan.bed; export const PatientModel={};",
    datamaster: "export const LokasiModel={};",
    audit: "export async function catatPeristiwaAudit(s,p) { globalThis.__icuTiruan.audit.push(p); }",
    peran: "export const isSuperadmin=(a)=>a?.superadmin===true;",
};
registerHooks({
    resolve(specifier, context, next) {
        const nama = specifier.endsWith("/configs/sequelize-instance.js") ? "koneksi" : {
            "@opensimrs/model-sdk/pelayanan": "pelayanan", "@opensimrs/model-sdk/admisi": "admisi",
            "@opensimrs/model-sdk/datamaster": "datamaster", "@opensimrs/model-sdk/audit-sequelize": "audit",
            "@opensimrs/authorization-sdk/peran": "peran",
        }[specifier];
        if (nama) return { url: `icu-tiruan:${nama}`, shortCircuit: true };
        if (/dotenv|config-db|rahasia|\.env/.test(specifier)) throw new Error("Akses konfigurasi asli dilarang dalam uji ICU");
        return next(specifier, context);
    },
    load(url, context, next) {
        if (url.startsWith("icu-tiruan:")) return { format: "module", source: sumber[url.slice(11)], shortCircuit: true };
        return next(url, context);
    },
});
export const tiruan = globalThis.__icuTiruan = {
    audit: [], kueri: [], sesudah: [], handler: () => [],
    rawat: { findOne: async () => tiruan.admisi }, pindah: { findOne: async () => tiruan.perpindahan }, bed: { findOne: async () => tiruan.tempatTidur },
    db: {
        async query(sql, opsi) { tiruan.kueri.push({ sql, opsi }); return tiruan.handler(sql, opsi); },
        async transaction(fn) {
            const hooks = [];
            const t = { LOCK: { UPDATE: "UPDATE" }, afterCommit: (fn) => hooks.push(fn) };
            const hasil = await fn(t);
            for (const h of hooks) await h();
            tiruan.sesudah.push(t);
            return hasil;
        },
    },
};
export function bersihkan() {
    tiruan.audit = []; tiruan.kueri = []; tiruan.sesudah = []; tiruan.handler = () => [];
    tiruan.admisi = { uuid: "admisi-fiktif", monitoringRoomUuid: "bed-fiktif", patientUuid: "pasien-fiktif" };
    tiruan.perpindahan = { uuid: "pindah-fiktif", statusPindah: "approve", admissionRiUuid: "admisi-fiktif", destinationMonitoringRoomUuid: "bed-fiktif", originMonitoringRoomUuid: "bed-asal" };
    tiruan.tempatTidur = { uuid: "bed-fiktif", room_uuid: "unit-fiktif", patientUuid: "pasien-fiktif" };
}
