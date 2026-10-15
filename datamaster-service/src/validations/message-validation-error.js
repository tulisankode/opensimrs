const REQUIRED = "tidak boleh kosong";
const INVALID = "tidak valid";
export const codeRequired = `Code ${REQUIRED}`;
export const faskesUuidRequired = `UUID Faskes ${REQUIRED}`;
export const tindakanUuidRequired = `UUID Tindakan ${REQUIRED}`;
export const codeBpjsInvalid = `Kode BPJS ${INVALID}`;
export const codeAntrianRequired = `Kode Antrian ${REQUIRED}`;
export const nameRequired = `Nama ${REQUIRED}`;
export const komponenTarifRequired = `Komponen Tarif ${REQUIRED}`;
export const titleInvalid = `Gelar ${INVALID}`;
export const sipRequired = `SIP ${REQUIRED}`;
export const kuotaJknRequired = `Kuota JKN ${REQUIRED}`;
export const kuotaNonJknRequired = `Kuota non-JKN ${REQUIRED}`;
export const timePelayananRequired = `Waktu Pelayanan ${REQUIRED}`;
export const durasiPelayananRequired = `Durasi Pelayanan ${REQUIRED}`;
export const lokasiUuidRequired = `UUID Lokasi ${REQUIRED}`;
export const statusRequired = `Status ${REQUIRED}`;
export const isMultipleRequired = `Is Multiple ${REQUIRED}`;
export const jenisTarifRequired = `Jenis Tarif ${REQUIRED}`;

const MAX_LENGTH = (field, length) =>
  `${field} tidak boleh lebih dari ${length} karakter`;

export const faskesUuidInvalid = `UUID Faskes ${INVALID}`;
export const codeSatuSehatRequired = `Kode Satu Sehat ${REQUIRED}`;
export const descriptionRequired = `Deskripsi ${REQUIRED}`;
export const phoneRequired = `Nomor telepon ${REQUIRED}`;

export const emailRequired = `Email ${REQUIRED}`;
export const emailInvalid = `Format email ${INVALID}`;
export const urlInvalid = `Format URL ${INVALID}`;
export const addressRequired = `Alamat ${REQUIRED}`;
export const addressCityRequired = `Kota ${REQUIRED}`;
export const postalCodeRequired = `Kode pos ${REQUIRED}`;

export const codeMaxLength = MAX_LENGTH("Kode", 255);
export const codeBpjsMaxLength = MAX_LENGTH("Kode BPJS", 255);
export const codeSatuSehatMaxLength = MAX_LENGTH("Kode Satu Sehat", 255);
export const nameMaxLength = MAX_LENGTH("Nama", 255);
export const descriptionMaxLength = MAX_LENGTH("Deskripsi", 255);
export const phoneMaxLength = MAX_LENGTH("Nomor telepon", 255);

export const qtyBedRequired = `Jumlah tempat tidur ${REQUIRED}`;
export const qtyBedInvalid = `Jumlah tempat tidur harus berupa bilangan bulat`;
export const noRoomRequired = `Nomor ruangan ${REQUIRED}`;
export const noRoomInvalid = `Nomor ruangan harus berupa bilangan bulat`;
export const kategoriRuanganUuidInvalid = `UUID Kategori Ruangan ${INVALID}`;
export const kelasRuanganRequired = `Kelas ruangan ${REQUIRED}`;

export const kelasRuanganMaxLength = MAX_LENGTH("Kelas ruangan", 255);

export const kuotaJknRequiredIfBpjs = "Kuota JKN harus ada jika Kode BPJS ada";

export const kategoriSuratRequired = `Kategori surat ${REQUIRED}`;
export const isiSuratInvalid = `Isi surat ${INVALID}`;
export const organizationUuidInvalid = `UUID Organisasi ${INVALID}`;
export const penjaminUuidInvalid = `UUID Penjamin ${INVALID}`;

export const kategoriSuratMaxLength = MAX_LENGTH("Kategori surat", 255);
export const isiSuratMaxLength = MAX_LENGTH("Isi surat", 500);

// message
export const messageErrorSave = "Data gagal disimpan";
export const messageErrorEdit = "Data gagal diedit";
export const messageErrorShow = "Data gagal ditampilkan";
export const messageErrorDelete = "Data gagal dihapus";
export const messageErrorIdNotFound = "ID tidak ditemukan";
export const messageErrorUuidNotValid = "UUID tidak valid";
export const messageErrorDataNotFound = "Data tidak ditemukan";
export const messageErrorMethodNotAllowed = "Metode tidak diizinkan";
export const messageErrorConflict = "Data yang diinputkan sudah ada";
export const messageErrorInternalServer = "Internal server error";
export const messageErrorImport = "Data gagal di import";
export const messageErrorExport = "Data gagal di export";

export const messageSuccessSave = "Data berhasil disimpan";
export const messageSuccessEdit = "Data berhasil diedit";
export const messageSuccessShow = "Data berhasil ditampilkan";
export const messageSuccessDelete = "Data berhasil dihapus";
export const messageSuccessImport = "Data berhasil di import";
export const messageSuccessExport = "Data berhasil di export";

export const messageErrorFileNotFound = "File tidak ditemukan dalam request.";
export const messageErrorOnlyExcel =
  "Invalid file format. Only .xls and .xlsx files are allowed.";
