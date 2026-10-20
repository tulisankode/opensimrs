import IcuTemplateService from "./icu-template-service.js";

export default class IcuKelengkapanService {
    static evaluasi(perawatan, template, catatan, sekarang = Math.floor(Date.now() / 1000), rentang = {}) {
        const masuk = Number(perawatan.waktu_masuk);
        const akhirEpisode = Number(perawatan.waktu_keluar ?? sekarang);
        const dari = Math.max(masuk, Number(rentang.dari ?? masuk));
        const sampai = Math.min(akhirEpisode, Number(rentang.sampai ?? akhirEpisode));
        const hasil = { status: "belum_dikonfigurasi", template_versi_uuid: template?.uuid ?? null,
            dievaluasi_pada: sekarang, periode: { dari, sampai }, kekurangan: [] };
        if (!template?.aturan_kelengkapan?.length) return hasil;
        for (const r of template.aturan_kelengkapan) {
            if (r.cakupan === "selesai" && !perawatan.waktu_keluar) continue;
            const periode = [];
            if (r.cakupan === "interval") {
                const awal = masuk + Math.floor((dari - masuk) / r.interval_detik) * r.interval_detik;
                for (let t = awal; t < sampai; t += r.interval_detik) periode.push([t, Math.min(t + r.interval_detik, akhirEpisode)]);
            } else periode.push([masuk, akhirEpisode]);
            for (const [awal, akhir] of periode) {
                const data = catatan.filter((c) => c.sumber === r.sumber && (r.sumber !== "dokumentasi" || c.kode_dokumen === r.kode_dokumen) &&
                    c.waktu >= awal && (c.waktu < akhir || (c.waktu === akhirEpisode && c.waktu === akhir)));
                const kurang = r.parameter.filter((kode) => !data.some((c) => c.nilai.some((n) => n.kode_parameter === kode && IcuTemplateService.terisi(n.nilai))));
                if (kurang.length) hasil.kekurangan.push({ sumber: r.sumber, kode_dokumen: r.kode_dokumen ?? null,
                    dari: awal, sampai: akhir, periode_berjalan: !perawatan.waktu_keluar && akhir >= sekarang, parameter: kurang });
            }
        }
        hasil.status = hasil.kekurangan.length ? "belum_lengkap" : "lengkap";
        return hasil;
    }
}
