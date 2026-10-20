// Perhitungan kardiologi CCU (fungsi murni, diuji di tests/ccu.test.js). Bobot & ambang mengikuti publikasi asal yang
// umum dipakai; tetap perlu ditinjau & disahkan komite medik/KSM Jantung faskes sebelum dipakai untuk keputusan klinis
// resmi. Sistem hanya menghitung dan menampilkan — keputusan tetap pada dokter penanggung jawab.

export const IRAMA_BERBAHAYA = ["vt", "vf", "asistol", "pea", "blok_av_3", "torsades"];
export const PENANDA_TROPONIN = ["troponin_i", "troponin_t", "hs_troponin_i", "hs_troponin_t"];

// QTc Bazett: QT (ms) / akar(RR detik); RR = 60 / laju jantung.
export const hitungQtc = (qtMs, lajuJantung) => {
    if (!qtMs || !lajuJantung) return null;
    const rr = 60 / lajuJantung;
    return Math.round(qtMs / Math.sqrt(rr));
};

// Killip (Killip & Kimball 1967): kelas I–IV dari temuan klinis gagal jantung.
export const KILLIP = {
    1: "Kelas I — tanpa tanda gagal jantung",
    2: "Kelas II — ronki/S3, bendungan vena jugularis",
    3: "Kelas III — edema paru akut",
    4: "Kelas IV — syok kardiogenik",
};

// TIMI UA/NSTEMI (Antman 2000): 7 butir bernilai 1 — usia ≥ 65 th, ≥ 3 faktor risiko PJK, stenosis koroner ≥ 50%
// diketahui, aspirin dalam 7 hari terakhir, angina berat (≥ 2 episode/24 jam), deviasi ST ≥ 0,5 mm, penanda jantung positif.
export const TIMI_NSTE_BUTIR = [
    "usia_lanjut", "tiga_faktor_risiko", "pjk_diketahui", "aspirin_seminggu", "angina_berat", "deviasi_st", "penanda_positif",
];
export const hitungTimiNste = (p) => {
    const lengkap = TIMI_NSTE_BUTIR.every((k) => typeof p[k] === "boolean");
    const total = TIMI_NSTE_BUTIR.reduce((a, k) => a + (p[k] ? 1 : 0), 0);
    const kategori = total <= 2 ? "rendah" : total <= 4 ? "sedang" : "tinggi";
    return { total_skor: total, kategori, lengkap };
};

// TIMI STEMI (Morrow 2000): skor 0–14.
export const hitungTimiStemi = (p) => {
    const wajib = ["umur", "dm_ht_angina", "sistolik", "laju_jantung", "killip", "berat_badan", "ste_anterior_lbbb", "waktu_terapi_jam"];
    const lengkap = wajib.every((k) => p[k] !== undefined && p[k] !== null);
    let total = 0;
    if (p.umur >= 75) total += 3;
    else if (p.umur >= 65) total += 2;
    if (p.dm_ht_angina) total += 1;
    if (p.sistolik != null && p.sistolik < 100) total += 3;
    if (p.laju_jantung != null && p.laju_jantung > 100) total += 2;
    if (p.killip != null && p.killip >= 2) total += 2;
    if (p.berat_badan != null && p.berat_badan < 67) total += 1;
    if (p.ste_anterior_lbbb) total += 1;
    if (p.waktu_terapi_jam != null && p.waktu_terapi_jam > 4) total += 1;
    const kategori = total <= 2 ? "rendah" : total <= 4 ? "sedang" : "tinggi";
    return { total_skor: total, kategori, lengkap };
};

export const hitungSkorRisiko = (jenis, parameter) => {
    if (jenis === "killip") {
        const kelas = Number(parameter.kelas);
        return { total_skor: kelas, kategori: KILLIP[kelas] ?? null, lengkap: !!KILLIP[kelas] };
    }
    if (jenis === "timi_nste") return hitungTimiNste(parameter);
    if (jenis === "timi_stemi") return hitungTimiStemi(parameter);
    throw new Error(`Jenis skor tidak dikenal: ${jenis}`);
};

// Tren penanda jantung: bandingkan dengan sampel sebelumnya berjenis sama (delta absolut & persen).
export const trenPenanda = (daftarUrutWaktu) => {
    const sebelumnya = new Map();
    return daftarUrutWaktu.map((d) => {
        const lalu = sebelumnya.get(d.jenis);
        sebelumnya.set(d.jenis, d);
        const nilai = Number(d.nilai);
        const batas = d.batas_atas == null ? null : Number(d.batas_atas);
        const delta = lalu ? Math.round((nilai - Number(lalu.nilai)) * 1000) / 1000 : null;
        const deltaPersen = lalu && Number(lalu.nilai) > 0 ? Math.round(((nilai - Number(lalu.nilai)) / Number(lalu.nilai)) * 1000) / 10 : null;
        return { ...d, di_atas_batas: batas == null ? null : nilai > batas, delta, delta_persen: deltaPersen };
    });
};

const median = (angka) => {
    if (!angka.length) return null;
    const urut = [...angka].sort((a, b) => a - b);
    const t = Math.floor(urut.length / 2);
    return urut.length % 2 ? urut[t] : (urut[t - 1] + urut[t]) / 2;
};

// Waktu reperfusi (menit) dari waktu tiba RS ke tindakan pertama berjenis tertentu; ambang mutu: door-to-balloon
// ≤ 90 menit (PCI primer) dan door-to-needle ≤ 30 menit (trombolisis).
export const ringkasWaktuReperfusi = (baris, ambangMenit) => {
    const menit = baris
        .filter((b) => b.waktu_tiba_rs && b.waktu_mulai && Number(b.waktu_mulai) >= Number(b.waktu_tiba_rs))
        .map((b) => Math.round((Number(b.waktu_mulai) - Number(b.waktu_tiba_rs)) / 60));
    return {
        jumlah: menit.length,
        median_menit: median(menit),
        persen_sesuai_target: menit.length ? Math.round((menit.filter((m) => m <= ambangMenit).length / menit.length) * 1000) / 10 : null,
        target_menit: ambangMenit,
    };
};
