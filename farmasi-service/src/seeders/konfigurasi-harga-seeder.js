import { v7 as uuidv7 } from "uuid"; // Pastikan Anda menggunakan uuid generator
import { KonfigurasiHargaModel } from "@opensimrs/model-sdk/farmasi"; // Sesuaikan path

export default class KonfigurasiHargaSeeder {
  static async seed(transaction) {
    // 1. KOSONGKAN TABEL terlebih dahulu
    await KonfigurasiHargaModel.destroy({
      where: {}, // where kosong berarti hapus semua
      truncate: true, // Gunakan truncate agar lebih cepat & mereset sequence
      transaction,
    });

    // 2. Siapkan data baru dengan UUID yang unik
    const itemsToSeed = [
      {
        uuid: "0192b31f-365d-731c-8b16-3a4565c9475r", // atau lebih baik: uuidv7()
        faskes_uuid: "0192b31f-365d-731c-8b16-3a4565c9475e",
        ppn: 0,
        margin: 0,
        biaya_embalase_racik: false,
        metode_biaya_racikan: "item",
      },
      // Tambahkan data lain jika ada
    ];

    // 3. Masukkan data yang sudah disiapkan
    await KonfigurasiHargaModel.bulkCreate(itemsToSeed, { transaction });
  }
}
