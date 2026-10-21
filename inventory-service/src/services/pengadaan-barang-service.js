import { NotfoundException } from "@opensimrs/model-sdk/exceptions";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import BadRequestException from "../errors/bad-request-exception.js";
import Utils from "../helpers/utils.js";
import PurchaseOrderMapper from "../mappers/purchase-order-mapper.js";
import InventoryBarangRepository from "../repositories/inventory-barang-repository.js";
import ItemMedisJenisStokRepository from "../repositories/item-medis-jenis-stok-repository.js";
import SettingRepository from "../repositories/setting-repository.js";
import PengadaanValidation from "../validations/pengadaan-validation.js";
import DatamasterSupplierRepository from "../repositories/datamaster-supplier-repository.js";
import FarmasiExternalRepository from "../repositories/farmasi-external-repository.js";

export default class PengadaanBarangService {
  // Fungsi untuk mendapatkan semua data pembelian barang supplier
  static async getAll(options) {
    const validatedData = await PengadaanValidation.GET_ALL_PEMBELIAN_BARANG.parseAsync(options);
    const result = await InventoryBarangRepository.getAll(validatedData);
    result.data = result.data.map(PurchaseOrderMapper.toListDTO);
    return result;
  }

  // Fungsi untuk mendapatkan detail data pembelian barang supplier
  static async getDetail(payload) {
    const validatedPayload = await PengadaanValidation.GET_PEMBELIAN_BARANG_BY_UUID.parseAsync(payload);
    const purchaseOrderData = await InventoryBarangRepository.getDetail(validatedPayload);
    return PurchaseOrderMapper.toDetailDTO(purchaseOrderData);
  }

  // Mengambil daftar item untuk dropdown PO
  static async getAvailableItemsForPO(req) {
        const validatedReq = await PengadaanValidation.GET_ITEMS_FOR_PO.parseAsync(req);
        const items = await ItemMedisJenisStokRepository.getAvailableItemsForPO(validatedReq);
        return items.map(item => ({
            uuid: item.item_medis_uuid, 
            nama: item.nama_item,
            item_medis_jenis_stok_uuid: item.uuid
        }));
    }
    
  // Mengambil daftar supplier untuk dropdown berdasarkan kategori
  static async getSuppliersByItemMedis(req) {
    const validatedReq = await PengadaanValidation.GET_SUPPLIER_BY_ITEM.parseAsync(req);
    const suppliers = await DatamasterSupplierRepository.getAvailableSupplierByItemMedis(validatedReq);
    return suppliers.map(supplier => ({
      uuid: supplier.uuid,
      nama: supplier.name,
      code: supplier.code
    }));
  }

  // Fungsi untuk membuat data pembelian barang supplier
  static async create(payload, headers) {
    const validatedData = await PengadaanValidation.CREATE_PEMBELIAN_BARANG.parseAsync(payload);

    const itemUuidsFromPayload = [...new Set(validatedData.items.map(item => item.item_uuid))];

    const validItemsCount = await ItemMedisJenisStokRepository.countValidItemsForJenisStok(
        itemUuidsFromPayload,
        validatedData.jenis_stok_uuid,
        validatedData.faskes_uuid
    );

    if (validItemsCount !== itemUuidsFromPayload.length) {
        throw new BadRequestException([
            {
                field: "items",
                message: "Terdapat satu atau lebih item yang tidak sesuai dengan Jenis Stok yang dipilih. Harap periksa kembali."
            }
        ]);
    }

    for (const itemRequest of validatedData.items) {
      const conversionList = await FarmasiExternalRepository.getConversionByItem(
        {
          item_medis_uuid: itemRequest.item_uuid,
          faskes_uuid: validatedData.faskes_uuid
        },
        headers,
      );

      // Endpoint konversi farmasi mengembalikan konversi SEMUA item faskes (parameter item_medis_uuid
      // diabaikan), jadi cocokkan juga item-nya; tanpa ini "Box" item lain (isi berbeda) bisa terpakai.
      const selectedConversion = (conversionList || []).find(c => 
        c.satuan_pembelian_uuid === itemRequest.satuan_uuid &&
        (!c.item_medis_uuid || c.item_medis_uuid === itemRequest.item_uuid)
      );

      if (!selectedConversion) {
        throw new BadRequestException([{
          field: "items",
          message: `Satuan pembelian tidak valid atau tidak ditemukan relasi konversinya untuk item ${itemRequest.item_uuid}`
        }]);
      }

      if (!selectedConversion.konversi || selectedConversion.konversi <= 0) {
        throw new BadRequestException([{
          field: "items",
          message: `Data master konversi tidak valid (Nilai konversi 0) untuk item ${itemRequest.item_uuid}. Hubungi admin farmasi.`
        }]);
      }

      itemRequest.konversi_uuid = selectedConversion.uuid;
      itemRequest.konversi = selectedConversion.konversi;
      itemRequest.satuan_terkecil = selectedConversion.satuan_penggunaan;
    }

    const transaction = await sequelizeInstance.transaction();
    try {
      const ppnRate = await this._getPpnRate(validatedData.ppn, validatedData.faskes_uuid);
      const { grandTotal } = this._calculatePurchaseOrderTotals( 
        validatedData.items, 
        validatedData.diskon, 
        validatedData.materai, 
        ppnRate
      );

      const dataPembelianBarang = {
        ...validatedData,
        no_po: Utils.generate4Code("PO"),
        total_item: validatedData.items.length,
        grand_total: grandTotal,
        ppn: ppnRate,
        status: "pending",
        isCito: validatedData.is_cito,
      };
      delete dataPembelianBarang.is_cito;
      const po = await InventoryBarangRepository.createPembelianBarang(dataPembelianBarang, transaction,);

      if (validatedData.items && validatedData.items.length > 0) {
        const itemsToCreate = validatedData.items.map(item => ({
          ...item,
          pembelian_barang_supplier_uuid: po.uuid,
          faskes_uuid: validatedData.faskes_uuid,
          total_harga: item.qty_order * item.harga_satuan,
        }));
        const createdItems = await InventoryBarangRepository.bulkCreate(itemsToCreate, transaction);
        po.dataValues.items = createdItems;
      } else {
        po.dataValues.items = [];
      }

      await transaction.commit();
      return po;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  // Fungsi untuk membatalkan data pembelian barang supplier
  static async cancelPembelianBarang(payload) {
    const validatedPayload = await PengadaanValidation.CANCEL_PEMBELIAN_BARANG.parseAsync(payload);
    const purchaseOrder = await InventoryBarangRepository.getDetail({
        uuid: validatedPayload.uuid,
        faskes_uuid: validatedPayload.faskes_uuid,
    });
    
    if (!purchaseOrder) {
        throw new NotfoundException(`Pembelian barang dengan UUID ${validatedPayload.uuid} tidak ditemukan.`);
    }

    if (purchaseOrder.status !== "pending") {
      throw new BadRequestException([
        {
          field: "status",
          message: `Hanya PO dengan status pending yang dapat diubah. Status saat ini: ${purchaseOrder.status}`
        }
      ]);
    }
    return await InventoryBarangRepository.update(validatedPayload);
  }

  // Fungsi untuk mengupdate data pembelian barang supplier
  static async update(payload, headers) {
    const validatedData = await PengadaanValidation.UPDATE_PEMBELIAN_BARANG.parseAsync(payload);

    const purchaseOrder = await InventoryBarangRepository.getDetail({
      uuid: validatedData.uuid,
      faskes_uuid: validatedData.faskes_uuid,
    });

    if (!purchaseOrder) {
        throw new NotfoundException(`Pembelian barang dengan UUID ${validatedData.uuid} tidak ditemukan.`);
    }

    if (purchaseOrder.status !== "pending") {
      throw new BadRequestException([
        {
          field: "status",
          message: `Hanya PO dengan status pending yang dapat diubah. Status saat ini: ${purchaseOrder.status}`
        }
      ]);
    }

    const itemUuidsFromPayload = [...new Set(validatedData.items.map(item => item.item_uuid))];

    const validItemsCount = await ItemMedisJenisStokRepository.countValidItemsForJenisStok(
      itemUuidsFromPayload,
      validatedData.jenis_stok_uuid,
      validatedData.faskes_uuid
    );

    if (validItemsCount !== itemUuidsFromPayload.length) {
      throw new BadRequestException([
        {
          field: "items",
          message: "Terdapat satu atau lebih item yang tidak sesuai dengan Jenis Stok yang dipilih. Harap periksa kembali."
        }
      ]);
    }

    for (const itemRequest of validatedData.items) {
      const conversionList = await FarmasiExternalRepository.getConversionByItem(
        {
          item_medis_uuid: itemRequest.item_uuid,
          faskes_uuid: validatedData.faskes_uuid
        },
        headers, // Headers diteruskan kesini
      );

      // Saring per item juga (lihat catatan pada create): daftar konversi berisi semua item faskes.
      const selectedConversion = (conversionList || []).find(c => 
        c.satuan_pembelian_uuid === itemRequest.satuan_uuid &&
        (!c.item_medis_uuid || c.item_medis_uuid === itemRequest.item_uuid)
      );

      if (!selectedConversion) {
        throw new BadRequestException([{
          field: "items",
          message: `Satuan pembelian tidak valid atau tidak ditemukan relasi konversinya untuk item ${itemRequest.item_uuid}`
        }]);
      }

      if (!selectedConversion.konversi || selectedConversion.konversi <= 0) {
        throw new BadRequestException([{
          field: "items",
          message: `Data master konversi tidak valid (Nilai konversi 0) untuk item ${itemRequest.item_uuid}. Hubungi admin farmasi.`
        }]);
      }

      itemRequest.konversi_uuid = selectedConversion.uuid;
      itemRequest.konversi = selectedConversion.konversi;
      itemRequest.satuan_terkecil = selectedConversion.satuan_penggunaan;
    }

    const transaction = await sequelizeInstance.transaction();
    try {
      const ppnRate = await this._getPpnRate(validatedData.ppn, validatedData.faskes_uuid);
      const { grandTotal } = this._calculatePurchaseOrderTotals(
        validatedData.items,
        validatedData.diskon,
        validatedData.materai,
        ppnRate
      );

      const dataToUpdate = {
        uuid: validatedData.uuid,
        faskes_uuid: validatedData.faskes_uuid,
        jenis_stok_uuid: validatedData.jenis_stok_uuid,
        supplier_uuid: validatedData.supplier_uuid,
        tanggal_pembelian: validatedData.tanggal_pembelian,
        metode_pembelian: validatedData.metode_pembelian,
        catatan_po: validatedData.catatan_po,
        isCito: validatedData.is_cito,
        total_item: validatedData.items.length,
        diskon: validatedData.diskon,
        materai: validatedData.materai,
        ppn: ppnRate,
        grand_total: grandTotal,
      };

      await InventoryBarangRepository.updatePurchaseOrder(dataToUpdate, transaction);

      if (validatedData.items) {
        await InventoryBarangRepository.deletePurchaseOrder(validatedData.uuid, transaction);
        if (validatedData.items.length > 0) {
          const newItems = validatedData.items.map((item) => ({
            ...item,
            pembelian_barang_supplier_uuid: validatedData.uuid,
            faskes_uuid: validatedData.faskes_uuid,
            total_harga: item.qty_order * item.harga_satuan,
          }));
          await InventoryBarangRepository.bulkCreate(newItems, transaction);
        }
      }
      await transaction.commit();
      
      return await InventoryBarangRepository.getDetail({
        uuid: validatedData.uuid,
        faskes_uuid: validatedData.faskes_uuid,
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async _getPpnRate(usePpn, faskesUuid) {
    return usePpn ? await SettingRepository.getCurrentPpnRate(faskesUuid) : 0;
  }

  static _calculatePurchaseOrderTotals(items, diskon = 0, materai = 0, ppnRate = 0) {
    const subTotal = items.reduce(
      (acc, item) => acc + (item.qty_order * item.harga_satuan), 0
    );
    const dasarPengenaanPajak = subTotal - diskon;
    const totalPpn = dasarPengenaanPajak * (ppnRate / 100);
    const grandTotal = dasarPengenaanPajak + totalPpn + materai;
    return { subTotal, totalPpn, grandTotal };
  }
}
