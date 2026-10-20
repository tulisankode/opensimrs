import { gagal } from "./hdu-aturan.js";

// Semua penempatan tetap menggunakan perpindahans, rawat_inaps, dan room_monitorings.
export default class HduPerpindahanAdapter {
    constructor(query) { this.query = query; }

    async kunci(perpindahanUuid) {
        const [p] = await this.query(`SELECT * FROM perpindahans WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL FOR UPDATE`, { uuid: perpindahanUuid });
        if (!p) gagal("Perpindahan tidak ditemukan.", 404);
        const [ri] = await this.query(`SELECT * FROM rawat_inaps WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL FOR UPDATE`, { uuid: p.admission_ri_uuid });
        if (!ri || ![2, 3].includes(ri.status_ri) || ri.discharge_date) gagal("Admisi rawat inap tidak aktif.");
        const [pasien] = await this.query(`SELECT uuid FROM patients WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL`, { uuid: ri.patient_uuid });
        if (!pasien) gagal("Pasien tidak ditemukan pada fasilitas kesehatan ini.", 404);
        const beds = await this.query(`SELECT * FROM room_monitorings WHERE uuid IN (:asal, :tujuan) AND faskes_uuid = :f AND deleted_at IS NULL ORDER BY uuid FOR UPDATE`, {
            asal: p.origin_monitoring_room_uuid, tujuan: p.destination_monitoring_room_uuid,
        });
        const asal = beds.find((b) => b.uuid === p.origin_monitoring_room_uuid);
        const tujuan = beds.find((b) => b.uuid === p.destination_monitoring_room_uuid);
        if (!asal || !tujuan || asal.uuid === tujuan.uuid) gagal("Tempat tidur asal atau tujuan tidak valid.");
        const lokasi = await this.query(`SELECT uuid FROM lokasi WHERE uuid IN (:asal, :tujuan) AND faskes_uuid = :f AND deleted_at IS NULL`, { asal: asal.room_uuid, tujuan: tujuan.room_uuid });
        if (!lokasi.some((r) => r.uuid === asal.room_uuid) || !lokasi.some((r) => r.uuid === tujuan.room_uuid)) gagal("Ruangan perpindahan tidak tersedia.");
        return { p, ri, asal, tujuan };
    }

    async pindahkan({ p, ri, asal, tujuan }, waktu) {
        if (p.status_pindah !== "pending") gagal("Perpindahan harus berstatus menunggu.");
        if (ri.monitoring_room_uuid !== asal.uuid || asal.patient_uuid !== ri.patient_uuid) gagal("Penempatan asal tidak cocok dengan admisi.");
        if (tujuan.patient_uuid || tujuan.status_operasional !== "Tersedia") gagal("Tempat tidur tujuan tidak tersedia.");
        const benturan = await this.query(`SELECT uuid FROM rawat_inaps WHERE monitoring_room_uuid = :bed AND uuid <> :ri AND faskes_uuid = :f AND deleted_at IS NULL AND status_ri IN (1, 2, 3) AND discharge_date IS NULL`, { bed: tujuan.uuid, ri: ri.uuid });
        if (benturan.length) gagal("Tempat tidur tujuan masih memiliki penempatan aktif.");
        await this.query(`UPDATE perpindahans SET status_pindah = 'approve', waktu_pindah = :waktu, updated_at = :sekarang WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL`, { uuid: p.uuid, waktu });
        await this.query(`UPDATE rawat_inaps SET status_ri = 3, monitoring_room_uuid = :bed, updated_at = :sekarang WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL`, { uuid: ri.uuid, bed: tujuan.uuid });
        await this.query(`UPDATE room_monitorings SET patient_uuid = :pasien, status_operasional = 'Penuh', updated_at = :sekarang WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL`, { uuid: tujuan.uuid, pasien: ri.patient_uuid });
        await this.query(`UPDATE room_monitorings SET patient_uuid = NULL, status_operasional = 'Tersedia', updated_at = :sekarang WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL`, { uuid: asal.uuid });
        return { ...p, status_pindah: "approve", waktu_pindah: waktu };
    }
}
