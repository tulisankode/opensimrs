export const punyaIzinModul = (permissions, namaModul, submodul, aksi) => {
    const daftar = typeof permissions === "string" ? JSON.parse(permissions) : permissions;
    if (!Array.isArray(daftar)) return false;
    const modul = daftar.find((m) => m.module === namaModul && m.checked !== false);
    return (modul?.subModules ?? modul?.submodules ?? modul?.sub_modules ?? []).some((s) => s.name === submodul && s.checked !== false &&
        (s.allows ?? []).some((a) => (typeof a === "string" ? a : a?.checked !== false ? a?.name : null) === aksi));
};
export const punyaIzinPicu = (permissions, submodul, aksi) => punyaIzinModul(permissions, "PICU", submodul, aksi);

export const submodulDokumentasi = (jenis) => ({
    antropometri: "Antropometri", observasi: "Observasi", asesmen: "Asesmen",
    perkembangan: "Perkembangan", keperawatan: "Keperawatan", tindakan: "Tindakan", terapi: "Terapi", rencana: "Rencana",
})[jenis];
