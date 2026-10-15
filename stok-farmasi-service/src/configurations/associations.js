import { LokasiStokModel } from "@opensimrs/model-sdk/farmasi";
import { PengeluaranUnitModel, PermintaanUnitModel } from "@opensimrs/model-sdk/inventory";

// model-sdk 1.0.93 hanya mendefinisikan relasi lokasi tujuan untuk permintaan & pengeluaran unit,
// sedangkan repository ikut meng-include lokasi awal (alias lokasi_stok_awal) → SequelizeEagerLoadingError.
// Lengkapi di sini sampai relasinya tersedia di model-sdk.
for (const model of [PermintaanUnitModel, PengeluaranUnitModel]) {
  if (!model.associations.lokasi_stok_awal) {
    model.belongsTo(LokasiStokModel, {
      foreignKey: "lokasi_stok_awal_uuid",
      as: "lokasi_stok_awal",
      constraints: false,
    });
  }
}
