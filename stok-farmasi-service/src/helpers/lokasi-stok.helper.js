import { Op } from "sequelize";
import { JenisStokModel, LokasiStokModel } from "@opensimrs/model-sdk/farmasi";
import ResponseError from "../errors/ResponseError.js";

// Pastikan lokasi stok asal/tujuan (dan jenis stok) milik faskes pengguna serta asal ≠ tujuan,
// sebelum stok dipindahkan. Tanpa cek ini UUID lokasi faskes lain atau lokasi yang sama ikut diproses.
export const pastikanLokasiStok = async (
  faskesUuid,
  { lokasi_stok_awal_uuid, lokasi_stok_tujuan_uuid, jenis_stok_uuid }
) => {
  if (
    lokasi_stok_awal_uuid &&
    lokasi_stok_tujuan_uuid &&
    lokasi_stok_awal_uuid === lokasi_stok_tujuan_uuid
  ) {
    throw new ResponseError(
      "Lokasi stok asal dan tujuan tidak boleh sama.",
      400
    );
  }

  const namaLokasi = new Map();
  const uuids = [lokasi_stok_awal_uuid, lokasi_stok_tujuan_uuid].filter(Boolean);
  if (uuids.length) {
    const lokasi = await LokasiStokModel.findAll({
      where: {
        uuid: { [Op.in]: uuids },
        faskes_uuid: faskesUuid,
        deleted_at: null,
      },
      attributes: ["uuid", "name"],
    });
    lokasi.forEach((l) => namaLokasi.set(l.uuid, l.name));
    if (lokasi.length !== new Set(uuids).size) {
      throw new ResponseError(
        "Lokasi stok tidak ditemukan pada faskes Anda.",
        400
      );
    }
  }

  if (jenis_stok_uuid) {
    const jenisStok = await JenisStokModel.count({
      where: { uuid: jenis_stok_uuid, faskes_uuid: faskesUuid, deleted_at: null },
    });
    if (!jenisStok) {
      throw new ResponseError(
        "Jenis stok tidak ditemukan pada faskes Anda.",
        400
      );
    }
  }

  return namaLokasi;
};
