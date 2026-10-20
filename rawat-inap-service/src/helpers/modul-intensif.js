// Status modul & fitur faskes untuk ruang perawatan intensif (NICU, PICU, …), mengikuti aturan Manajemen Modul
// (setting-service/src/modul/katalog-modul.js): modul aktif = tersedia ∧ (inti ∨ (override ?? (tanpa segmen ∨ preset
// segmen))); fitur aktif = modul aktif ∧ fitur tersedia ∧ (wajib ∨ (override ?? (tanpa segmen ∨ tidak dimatikan preset))).
// `query(sql, replacements)` mengembalikan baris; faskes selalu dari token.
export async function statusModulIntensif(query, faskes, modul, fitur = null) {
    const [baris] = await query(`SELECT
        (m.tersedia AND (m.inti OR COALESCE(mo.aktif, s.segmen_kode IS NULL OR EXISTS (SELECT 1 FROM preset_segmen_modul pm
            WHERE pm.segmen_kode = s.segmen_kode AND pm.modul_kode = m.kode)))) AS modul,
        (SELECT f.tersedia AND (f.wajib OR COALESCE(fo.aktif, s.segmen_kode IS NULL OR NOT EXISTS (SELECT 1 FROM preset_segmen_fitur_mati pf
            WHERE pf.segmen_kode = s.segmen_kode AND pf.fitur_kode = f.kode)))
         FROM ref_fitur f LEFT JOIN faskes_fitur_override fo ON fo.faskes_uuid = :faskes AND fo.fitur_kode = f.kode
         WHERE f.kode = :fitur AND f.modul_kode = m.kode) AS fitur
        FROM ref_modul m
        LEFT JOIN faskes_segmen s ON s.faskes_uuid = :faskes
        LEFT JOIN faskes_modul_override mo ON mo.faskes_uuid = :faskes AND mo.modul_kode = m.kode
        WHERE m.kode = :modul`, { faskes, modul, fitur: fitur ?? "" });
    const modulAktif = baris?.modul === true;
    return { modul: modulAktif, fitur: fitur ? modulAktif && baris?.fitur === true : modulAktif };
}
