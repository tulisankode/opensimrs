import { TRANSISI, periksaVersi, teks, wajib, samaPotret } from "./bersama.js";

export const buatPersetujuan = (r, a, jadwal) => async (req, aksi) => {
  const sub = ["setujui", "tolak"].includes(aksi) ? "Persetujuan Jadwal" : "Jadwal Dinas";
  const izin = { ajukan: "AJUKAN", setujui: "SETUJUI", tolak: "TOLAK", terbitkan: "TERBITKAN", revisi: "REVISI" };
  await a.hak(req, sub, izin[aksi]);
  const f = a.faskes(req), b = req.body;
  return r.transaksi(f, async (k) => {
    const v = await r.versi(k, f, req.params.uuid, true);
    await a.unit(k, req, v.unit_uuid, { setujui: "setujui", tolak: "setujui", terbitkan: "terbit" }[aksi] ?? "susun");
    periksaVersi(v, b.versi_kunci, aksi === "revisi" ? "terbit" : aksi === "tolak" ? ["diajukan", "disetujui"] : TRANSISI[aksi][0]);
    const alasan = ["tolak", "revisi"].includes(aksi) ? teks(b.alasan, "Alasan") : b.catatan ? teks(b.catatan, "Catatan") : null;
    if (["setujui", "tolak"].includes(aksi)) wajib(v.diajukan_oleh !== req.author.username, "Pengaju tidak boleh memutuskan jadwalnya sendiri", 403);
    if (aksi === "revisi") {
      wajib(v.versi_aktif_uuid === v.uuid, "Hanya versi terbit efektif yang dapat direvisi", 409);
      const keluarga = await r.ambil(k, f, "hr_jadwal_dinas", v.jadwal_uuid, true);
      const baru = await r.versiBaru(k, req, keluarga, v, alasan);
      await r.catatPeristiwa(k, req, "revisi_jadwal", { jadwal_uuid: keluarga.uuid, versi_uuid: baru.uuid, alasan, status_sesudah: "draf" });
      return baru;
    }
    let hasil;
    if (aksi !== "tolak") {
      hasil = await jadwal.nilai(k, req, v, await r.penempatan(k, f, v.uuid));
      jadwal.harusLolos(hasil);
      if (["setujui", "terbitkan"].includes(aksi)) wajib(samaPotret(v.potret_aturan, hasil.potret), "Aturan berubah; tolak jadwal untuk ditinjau dan diajukan ulang", 409);
    }
    const status = TRANSISI[aksi][1], perubahan = { status };
    if (aksi === "ajukan") Object.assign(perubahan, { diajukan_oleh: req.author.username, diajukan_pada: r.sekarang(), potret_aturan: hasil.potret, disetujui_oleh: null, disetujui_pada: null });
    if (aksi === "setujui") Object.assign(perubahan, { disetujui_oleh: req.author.username, disetujui_pada: r.sekarang() });
    if (aksi === "tolak") Object.assign(perubahan, { ditolak_oleh: req.author.username, ditolak_pada: r.sekarang() });
    if (aksi === "terbitkan") {
      wajib((v.versi_asal_uuid ?? null) === (v.versi_aktif_uuid ?? null), "Versi aktif berubah; tinjau kembali revisi", 409);
      perubahan.diterbitkan_pada = r.sekarang();
      await r.ubah("hr_jadwal_dinas", v.jadwal_uuid, f, { versi_aktif_uuid: v.uuid }, k);
    }
    const terbaru = await r.naikkan(k, f, v, perubahan);
    if (hasil) await jadwal.simpanValidasi(k, req, terbaru, hasil);
    await r.catatPeristiwa(k, req, `${aksi}_jadwal`, { jadwal_uuid: v.jadwal_uuid, versi_uuid: v.uuid, status_sebelum: v.status, status_sesudah: status, alasan });
    return { ...terbaru, temuan: hasil?.temuan ?? [] };
  });
};
