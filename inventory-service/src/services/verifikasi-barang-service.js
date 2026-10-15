import InventoryBarangRepository from "../repositories/inventory-barang-repository.js";
import UserRepository from "../repositories/user-repository.js";
import PengadaanValidation from "../validations/pengadaan-validation.js";
import NotfoundException from "../errors/notfound-exception.js";
import BadRequestException from "../errors/bad-request-exception.js";

export default class VerifikasiBarangService {
  static async verifikasiPembelianBarang(payload) {
    const validatedPayload = await PengadaanValidation.VERIFY_PEMBELIAN_BARANG.parseAsync(payload);
    const purchaseOrder = await InventoryBarangRepository.getDetail(validatedPayload);
    
    if (!purchaseOrder) {
      throw new NotfoundException("Data Pengadaan Barang yang akan diverifikasi tidak ditemukan");
    }

    if (purchaseOrder.status !== "pending") {
      throw new BadRequestException(`Tidak dapat memverifikasi PO dengan status ${purchaseOrder.status}`);
    }

    const petugas = await UserRepository.findByUuid(validatedPayload.petugas_verifikasi_uuid);

    const payloadForRepository = {
      uuid: validatedPayload.uuid,
        faskes_uuid: validatedPayload.faskes_uuid,
        petugas_verifikasi_uuid: validatedPayload.petugas_verifikasi_uuid,
        petugas_verifikasi: petugas.username
    };

    await InventoryBarangRepository.updateVerifikasi(payloadForRepository);

    return await InventoryBarangRepository.getDetail(payloadForRepository);
  }
}
