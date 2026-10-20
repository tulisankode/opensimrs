export function hitungLaporanIcu(episode, observasi, kapasitas, dari, sampai, sekarang, filter = {}) {
    const selesai = episode.filter((e) => e.waktu_keluar != null && Number(e.waktu_keluar) >= dari && Number(e.waktu_keluar) < sampai);
    const masuk = episode.filter((e) => Number(e.waktu_masuk) >= dari && Number(e.waktu_masuk) < sampai);
    const overlap = (awal, akhir) => Math.max(0, Math.min(Number(akhir ?? sekarang), sampai) - Math.max(Number(awal), dari));
    const terisi = episode.reduce((n, e) => n + overlap(e.waktu_masuk, e.waktu_keluar), 0);
    const detikKapasitas = kapasitas.reduce((n, b) => n + overlap(b.berlaku_mulai, b.berlaku_sampai ?? sampai), 0);
    const cakupan = kapasitas.length > 0 && Math.min(...kapasitas.map((b) => Number(b.berlaku_mulai))) <= dari;
    const tercakup = episode.every((e) => kapasitas.some((b) => b.room_monitoring_uuid === e.room_monitoring_uuid &&
        b.layanan_kode === e.layanan_kode && Number(b.berlaku_mulai) <= Math.max(Number(e.waktu_masuk), dari) &&
        Number(b.berlaku_sampai ?? sampai) >= Math.min(Number(e.waktu_keluar ?? sekarang), sampai)));
    const uuids = new Set(episode.map((e) => e.uuid));
    const hari = new Set(observasi.filter((o) => uuids.has(o.perawatan_uuid) && o.ventilator_terpasang && Number(o.waktu_pengukuran) >= dari && Number(o.waktu_pengukuran) < sampai)
        .map((o) => `${o.rawat_inap_uuid}:${Math.floor(Number(o.waktu_pengukuran) / 86400)}`));
    const bulat = (n) => n === null ? null : Math.round(n * 100) / 100;
    return {
        periode: { dari, sampai }, filter, jumlah_episode_masuk: masuk.length, jumlah_episode_selesai: selesai.length,
        jumlah_bed_icu: new Set(kapasitas.map((b) => b.room_monitoring_uuid)).size,
        bor: cakupan && tercakup && detikKapasitas > 0 ? bulat(terisi / detikKapasitas * 100) : null,
        dasar_kapasitas: { detik: detikKapasitas, memadai: cakupan && tercakup, alasan: cakupan && tercakup ? null : "Riwayat kapasitas belum memadai untuk periode dan populasi ini" },
        alos: selesai.length ? bulat(selesai.reduce((n, e) => n + Number(e.waktu_keluar) - Number(e.waktu_masuk), 0) / selesai.length / 86400) : null,
        angka_kematian: selesai.length ? bulat(selesai.filter((e) => e.kondisi_keluar === "meninggal").length / selesai.length * 100) : null,
        hari_ventilator: hari.size,
        definisi: "Periode [dari, sampai). BOR memakai durasi keterisian dan riwayat kapasitas bed termasuk bed kosong; kapasitas historis tidak ditaksir. ALOS dan kematian memakai episode selesai. Hari ventilator dihitung per pasien admisi per hari UTC; zona waktu operasional perlu ditetapkan rumah sakit. Episode tanpa klasifikasi tetap terpisah.",
    };
}
