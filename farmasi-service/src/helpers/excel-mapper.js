import BadRequestException from "../errors/bad-request-exception.js";

export default class ExcelMapper {
  static mapDatamasterSatuan(data, faskesUuid) {
    data.forEach((item) => {
      if (
        !item["Kode Satuan*"] ||
        !item["Nama Satuan*"] ||
        !item["Satuan Dosis*"]
        // !item["Editable*"]
      ) {
        throw new BadRequestException("data tidak lengkap atau kunci salah");
      }

      item.faskes_uuid = faskesUuid;
      item.code = item["Kode Satuan*"] || "";
      item.name = item["Nama Satuan*"] || "";
      item.status = true;
      item.satuan_dosis = item["Satuan Dosis*"] === "Aktif" ? true : false;
      item.editable = true;

      item.code = item.code.toUpperCase();

      delete item["Kode Satuan*"];
      delete item["Nama Satuan*"];
      delete item["Satuan Dosis*"];
      // delete item["Editable*"];
      delete item["No"];
    });

    return data;
  }

  static mapDatamasterBentukSediaan(data, faskesUuid) {
    data.forEach((item) => {
      if (!item["Kode Bentuk Sediaan*"] || !item["Nama Bentuk Sediaan*"]) {
        throw new BadRequestException("data tidak lengkap atau kunci salah");
      }

      item.faskes_uuid = faskesUuid;
      item.code = item["Kode Bentuk Sediaan*"] || "";
      item.name = item["Nama Bentuk Sediaan*"] || "";
      item.status = true;

      item.code = item.code.toUpperCase();

      delete item["Kode Bentuk Sediaan*"];
      delete item["Nama Bentuk Sediaan*"];
      delete item["No"];
    });

    return data;
  }

  static mapDatamasterKategoriObat(data, faskesUuid) {
    data.forEach((item) => {
      if (!item["Kode Kategori*"] || !item["Nama Kategori Obat*"]) {
        throw new BadRequestException("data tidak lengkap atau kunci salah");
      }

      item.faskes_uuid = faskesUuid;
      item.code = item["Kode Kategori*"] || "";
      item.name = item["Nama Kategori Obat*"] || "";
      item.status = true;

      item.code = item.code.toUpperCase();

      delete item["Kode Kategori*"];
      delete item["Nama Kategori Obat*"];
      delete item["No"];
    });

    return data;
  }

  static mapDatamasterJenisStok(data, faskesUuid) {
    data.forEach((item) => {
      if (!item["Kode Jenis Stok*"] || !item["Nama Jenis Stok*"]) {
        throw new BadRequestException("data tidak lengkap atau kunci salah");
      }

      item.faskes_uuid = faskesUuid;
      item.code = item["Kode Jenis Stok*"] || "";
      item.name = item["Nama Jenis Stok*"] || "";
      item.status = true;

      item.code = item.code.toUpperCase();

      delete item["Kode Jenis Stok*"];
      delete item["Nama Jenis Stok*"];
      delete item["No"];
    });

    return data;
  }

  static mapDatamasterCaraPakai(data, faskesUuid) {
    data.forEach((item) => {
      if (!item["Kode Cara Pakai*"] || !item["Nama Cara Pakai*"]) {
        throw new BadRequestException("data tidak lengkap atau kunci salah");
      }

      item.faskes_uuid = faskesUuid;
      item.code = item["Kode Cara Pakai*"] || "";
      item.cara_pakai = item["Nama Cara Pakai*"] || "";
      item.status = true;

      item.code = item.code.toUpperCase();

      delete item["Kode Cara Pakai*"];
      delete item["Nama Cara Pakai*"];
      delete item["No"];
    });

    return data;
  }

  static mapDatamasterIngredient(data) {
    data.forEach((item) => {
      if (!item["Kode Komposisi*"] || !item["Nama Komposisi*"]) {
        throw new BadRequestException("data tidak lengkap atau kunci salah");
      }

      item.code = item["Kode Komposisi*"] || "";
      item.name = item["Nama Komposisi*"] || "";
      item.status = true;

      item.code = item.code.toUpperCase();

      delete item["Kode Komposisi*"];
      delete item["Nama Komposisi*"];
      delete item["No"];
    });

    return data;
  }

  static mapDatamasterManufacture(data, faskesUuid) {
    data.forEach((item) => {
      if (
        !item["Kode Manufaktur*"] ||
        !item["Nama Manufaktur*"] ||
        !item["Provinsi*"] ||
        !item["Kabupaten*"] ||
        !item["Kecamatan*"] ||
        !item["Kelurahan*"] ||
        !item["Kode Pos*"] ||
        !item["Alamat*"]
      ) {
        throw new BadRequestException("data tidak lengkap atau kunci salah");
      }

      item.faskes_uuid = faskesUuid;
      item.code = item["Kode Manufaktur*"] || "";
      item.name = item["Nama Manufaktur*"] || "";
      item.provinsi_code = item["Provinsi*"] || "";
      item.kabupaten_code = item["Kabupaten*"] || "";
      item.kecamatan_code = item["Kecamatan*"] || "";
      item.kelurahan_code = item["Kelurahan*"] || "";
      item.kode_pos = item["Kode Pos*"] || "";
      item.alamat = item["Alamat*"] || "";
      item.status = true;

      item.code = item.code.toUpperCase();

      delete item["Kode Manufaktur*"];
      delete item["Nama Manufaktur*"];
      delete item["Provinsi Kode*"];
      delete item["Kabupaten Kode*"];
      delete item["Kecamatan Kode*"];
      delete item["Kelurahan Kode*"];
      delete item["Kode Pos*"];
      delete item["Alamat*"];
      delete item["No"];
    });

    return data;
  }

  static mapDatamasterLokasiStok(data, faskesUuid) {
    const map = {
      ri: 0,
      rj: 1,
      igd: 2,
      fisio: 3,
    };

    data.forEach((item) => {
      if (
        !item["Kode Lokasi Stok*"] ||
        !item["Nama Lokasi Stok*"] ||
        !item["Jenis Lokasi*"]
      ) {
        throw new BadRequestException("data tidak lengkap atau kunci salah");
      }

      item.faskes_uuid = faskesUuid;
      item.code = item["Kode Lokasi Stok*"] || "";
      item.name = item["Nama Lokasi Stok*"] || "";
      item.status = true;

      item.code = item.code.toUpperCase();

      let tujuanOrder = item["Default Tujuan Order & Permintaan"] || "";
      tujuanOrder = tujuanOrder.replace(/\s+/g, "").toLowerCase().split(",");
      tujuanOrder = tujuanOrder.map((item) => map[item]);
      item.default_tujuan_order_permintaan = tujuanOrder.join("");

      item.jenis_lokasi = item["Jenis Lokasi*"] || "";
      item.jenis_lokasi = item.jenis_lokasi.toLowerCase();

      delete item["Kode Lokasi Stok*"];
      delete item["Nama Lokasi Stok*"];
      delete item["Jenis Lokasi*"];
      delete item["Default Tujuan Order & Permintaan"];
      delete item["No"];
    });

    return data;
  }

  static mapDatamasterAturanPakai(data, faksesUuid) {
    data.forEach((item) => {
      if (
        !item["Kode Aturan Pakai*"] ||
        !item["Nama Aturan Pakai*"] ||
        !item["Periode Unit*"] ||
        !item["Frekuensi*"] ||
        !item["Periode*"]
      ) {
        throw new BadRequestException("data tidak lengkap atau kunci salah");
      }

      item.faskes_uuid = faksesUuid;
      item.code = item["Kode Aturan Pakai*"] || "";
      item.name = item["Nama Aturan Pakai*"] || "";
      item.periode_unit = item["Periode Unit*"] || "";
      item.frekuensi = item["Frekuensi*"] || "";
      item.periode = item["Periode*"] || "";
      item.status = true;

      item.code = item.code.toUpperCase();

      delete item["Kode Aturan Pakai*"];
      delete item["Nama Aturan Pakai*"];
      delete item["Periode Unit*"];
      delete item["Frekuensi*"];
      delete item["Periode*"];
      delete item["No"];
    });

    return data;
  }

  static mapDatamasterItemMedis(data, faskesUuid) {
    data.forEach((item) => {
      if (
        !item["Kode Item Medis*"] ||
        !item["Nama Item Medis*"] ||
        !item["Jenis Item*"] ||
        !item["Satuan Penggunaan*"] ||
        !item["Bentuk Sediaan*"] ||
        !item["Dosis Kemasan*"] ||
        !item["Satuan Dosis*"] ||
        !item["Kategori Item*"]
      ) {
        throw new BadRequestException("data tidak lengkap atau kunci salah");
      }

      item.faskes_uuid = faskesUuid;
      item.code = item["Kode Item Medis*"] || "";
      item.name = item["Nama Item Medis*"] || "";
      item.satuan_penggunaan_code = (
        item["Satuan Penggunaan*"] || ""
      ).toUpperCase();
      item.manufacure_code = (item["Pabrik"] || "").toUpperCase();
      item.bentuk_sediaan_code = (item["Bentuk Sediaan*"] || "").toUpperCase();
      item.satuan_dosis_code = (item["Satuan Dosis*"] || "").toUpperCase();
      item.satuan_kemasan_code = (item["Satuan Kemasan"] || "").toUpperCase();
      item.isi_kemasan = item["Isi Kemasan"] || "";
      item.dosis = item["Dosis Kemasan*"] || "";
      item.kategori_obat_code = (item["Kategori Item*"] || "").toUpperCase();
      item.status = true;

      item.code = item.code.toUpperCase();

      item.jenis_item = item["Jenis Item*"] || "";
      item.jenis_item = item.jenis_item.toUpperCase();

      item.ingridients = (item["Komposisi"] || "")
        .replace(/\s+/g, "")
        .toUpperCase()
        .split(",")
        .map((item) => ({ name: item }));

      item.jenis_stok_codes = (item["Jenis Stok"] || "")
        .replace(/\s+/g, "")
        .toUpperCase()
        .split(",");

      delete item["Kode Item Medis*"];
      delete item["Nama Item Medis*"];
      delete item["Jenis Item*"];
      delete item["Satuan Penggunaan*"];
      delete item["Jenis Stok"];
      delete item["Pabrik"];
      delete item["Bentuk Sediaan*"];
      delete item["Dosis Kemasan*"];
      delete item["Satuan Dosis*"];
      delete item["Isi Kemasan"];
      delete item["Satuan Kemasan"];
      delete item["Kategori Item*"];
      delete item["Komposisi"];
      delete item["Satuan Pembelian*"];
      delete item["No"];
    });

    return data;
  }

  static mapDatamasterConversion(data, faskesUuid) {
    data.forEach((item) => {
      if (
        !item["Kode Item Medis*"] ||
        !item["Satuan Pembelian*"] ||
        !item["Satuan Penggunaan*"] ||
        !item["Konversi*"]
      ) {
        throw new BadRequestException("data tidak lengkap atau kunci salah");
      }

      item.faskes_uuid = faskesUuid;
      item.item_medis_code = (item["Kode Item Medis*"] || "").toUpperCase();
      item.satuan_pembelian_code = (
        item["Satuan Pembelian*"] || ""
      ).toUpperCase();
      item.satuan_penggunaan_code = (
        item["Satuan Penggunaan*"] || ""
      ).toUpperCase();
      item.konversi = item["Konversi*"] || "";
      item.status = true;

      delete item["Kode Item Medis*"];
      delete item["Satuan Pembelian*"];
      delete item["Satuan Penggunaan*"];
      delete item["Konversi*"];
      delete item["No"];
    });

    return data;
  }
}
