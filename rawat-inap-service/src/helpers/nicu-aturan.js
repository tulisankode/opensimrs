export class NicuError extends Error {
    constructor(message, status = 422) {
        super(message);
        this.status = status;
    }
}

export function pastikanVersi(rekaman, versi) {
    if (rekaman.versi !== versi) throw new NicuError("Data telah berubah. Muat ulang sebelum mencoba kembali.", 409);
}

export function pastikanAktif(episode) {
    if (episode.status !== "aktif") throw new NicuError("Episode telah selesai; perubahan ditolak.", 409);
}

export function validasiIdentitas(ri, pasien, registrasi) {
    if (!pasien || pasien.uuid !== ri.patient_uuid || pasien.is_new_born !== true) {
        throw new NicuError("Gunakan identitas pasien bayi dari pendaftaran.");
    }
    if (registrasi.length > 1 || registrasi.some((r) => r.birth_detail_uuid !== pasien.birth_detail_uuid ||
        (pasien.no_identity && r.identifier_mom === pasien.no_identity))) {
        throw new NicuError("Relasi ibu-bayi tidak konsisten. Verifikasi melalui pendaftaran.");
    }
}

export function validasiPerpindahan(ri, pindah, tujuan, asal) {
    if (!pindah || pindah.admission_ri_uuid !== ri.uuid || pindah.status_pindah !== "approve" ||
        pindah.destination_monitoring_room_uuid !== tujuan || ri.monitoring_room_uuid !== tujuan ||
        (asal && pindah.origin_monitoring_room_uuid !== asal) || !Number.isSafeInteger(Number(pindah.waktu_pindah)) || Number(pindah.waktu_pindah) <= 0 || ri.status_ri !== 3 || ri.discharge_date) {
        throw new NicuError("Transaksi perpindahan tidak sesuai kondisi rawat inap saat ini.", 409);
    }
}

// Susunan kunci distabilkan agar pengiriman ulang tidak bergantung urutan properti JSON.
export function jsonStabil(nilai) {
    if (Array.isArray(nilai)) return `[${nilai.map(jsonStabil).join(",")}]`;
    if (nilai && typeof nilai === "object") return `{${Object.keys(nilai).sort().map((k) => `${JSON.stringify(k)}:${jsonStabil(nilai[k])}`).join(",")}}`;
    return JSON.stringify(nilai);
}

export function punyaIzinNicu(permissions, submodul, aksi) {
    const modul = permissions.find((m) => m?.module === "NICU");
    const sub = (modul?.subModules ?? modul?.submodules ?? []).find((s) => s?.name === submodul);
    return (sub?.allows ?? []).some((a) => (typeof a === "string" ? a : a?.name) === aksi);
}
