export default class SupplierMapper {
    static toDetailDTO(supplierData) {
        if (!supplierData) {
            return null;
        }
        const kategoriItems = supplierData.supplier_items?.map(item => item.kategori_item) ?? [];

        return {
            uuid: supplierData.uuid,
            code: supplierData.code,
            name: supplierData.name,
            alamat: supplierData.alamat,
            no_tlp: supplierData.no_tlp,
            status: supplierData.status,
            provinsi: {
                code: supplierData.province?.code ?? null,
                name: supplierData.province?.name ?? null
            },
            kabupaten: {
                code: supplierData.kabupaten?.code ?? null,
                name: supplierData.kabupaten?.name ?? null
            },
            kecamatan: {
                code: supplierData.kecamatan?.code ?? null,
                name: supplierData.kecamatan?.name ?? null
            },
            kelurahan: {
                code: supplierData.kelurahan?.code ?? null, 
                name: supplierData.kelurahan?.name ?? null
            },
            kategori_items: kategoriItems 
        };
    }

    static toListDTO(supplierData) {
        if (!supplierData) {
            return null;
        }
        return {
            uuid: supplierData.uuid,
            code: supplierData.code,
            name: supplierData.name,
            alamat: supplierData.alamat, 
            no_tlp: supplierData.no_tlp,
            status: supplierData.status,
            provinsi: supplierData.province?.name,
            kabupaten: supplierData.kabupaten?.name,
            kecamatan: supplierData.kecamatan?.name,
            kelurahan: supplierData.kelurahan?.name,
            kategori_item: supplierData.supplier_items?.map(item => item.kategori_item) ?? [],
        };
    }

    static prepareSupplierItemsForDb(itemsInput = [], supplierUuid, faskesUuid) {
        if (!itemsInput || itemsInput.length === 0) {
            return [];
        }
        return itemsInput.map(item => ({
            ...item, 
            supllier_uuid: supplierUuid, 
            faskes_uuid: faskesUuid,
        }));
    }
}