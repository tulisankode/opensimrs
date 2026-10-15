// TODO
// Belum terhubung dengan modul Setting untuk pengaturan PPN

export default class SettingRepository {
    static async getCurrentPpnRate() {
        console.log("MENGAMBIL PPN DARI SETTING (HARDCODED)...");
        return 11;
    }
} 