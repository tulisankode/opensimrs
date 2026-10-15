import moment from "moment";

// Perhitungan murni biaya kamar rawat inap (tanpa DB), dipakai BiayaKamarService.
const WIB = 420;

const hariKalender = (detik) => moment.unix(Number(detik)).utcOffset(WIB).startOf("day");

// Pecah lama rawat menjadi segmen per kamar. Hari dihitung per tanggal kalender WIB (tanggal pulang
// tidak dihitung, minimal 1 hari untuk seluruh perawatan); hari perpindahan masuk ke kamar tujuan;
// pindah bed di kamar yang sama tidak memecah segmen.
export const hitungSegmenKamar = ({ mulai, selesai, kamarAwal, perpindahan = [] }) => {
    const segmen = [];
    let kamar = kamarAwal;
    let dari = mulai;
    for (const p of perpindahan) {
        if (!p.kamar_tujuan || p.kamar_tujuan === kamar) continue;
        segmen.push({ kamar, dari, sampai: p.waktu });
        kamar = p.kamar_tujuan;
        dari = p.waktu;
    }
    segmen.push({ kamar, dari, sampai: selesai });

    const hasil = segmen.map((s) => ({ ...s, hari: Math.max(0, hariKalender(s.sampai).diff(hariKalender(s.dari), "days")) }));
    if (hasil.reduce((n, s) => n + s.hari, 0) === 0) hasil[hasil.length - 1].hari = 1;
    return hasil.filter((s) => s.hari > 0);
};

// Harga dari kolom tarif.penjamin (JSON [{penjamin_name, harga}]): tunai (payment_method 1) memakai
// entri TUNAI/UMUM, asuransi memakai entri non-tunai pertama; bila tidak ada, entri pertama.
export const pilihHargaKamar = (penjaminJson, metodeBayar) => {
    let daftar = [];
    try { daftar = typeof penjaminJson === "string" ? JSON.parse(penjaminJson) : (penjaminJson ?? []); } catch { daftar = []; }
    if (!Array.isArray(daftar) || daftar.length === 0) return null;
    const tunai = (p) => /tunai|umum/i.test(p.penjamin_name ?? "");
    const cocok = Number(metodeBayar) === 1 ? daftar.find(tunai) : daftar.find((p) => !tunai(p));
    const pilih = cocok ?? daftar[0];
    const harga = Number(pilih?.harga);
    return Number.isFinite(harga) && harga > 0 ? { harga, penjamin: pilih.penjamin_name } : null;
};
