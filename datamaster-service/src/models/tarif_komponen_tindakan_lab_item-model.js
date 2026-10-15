// import { DataTypes } from "sequelize";
// import sequelizeInstance from "@opensimrs/model-sdk/instance";
// import { uuidv7 } from "uuidv7";

// const TarifKomponenTindakanLabItem = sequelizeInstance.define(
//   "TarifKomponenTindakanLabItem",
//   {
//     id: {
//       type: DataTypes.INTEGER,
//       autoIncrement: true,
//       unique: true,
//       allowNull: false,
//     },
//     uuid: {
//       type: DataTypes.UUID,
//       defaultValue: () => uuidv7(),
//       unique: true,
//       primaryKey: true,
//       allowNull: false,
//     },
//     faskes_uuid: {
//       type: DataTypes.UUID,
//       allowNull: false,
//     },
//     tarif_uuid: {
//       type: DataTypes.UUID,
//     },
//     item_pemeriksaan_uuid: {
//       type: DataTypes.UUID,
//       allowNull: false,
//     },
//     tarif_komponen_uuid: {
//       type: DataTypes.UUID,
//       allowNull: false,
//     },
//     tarif_per_komponen: {
//       type: DataTypes.DOUBLE,
//       allowNull: false,
//     }
//   },
//   {
//     tableName: "tarif_komponen_tindakan_lab_item",
//     underscored: true,
//     timestamps: false,
//   }
// );

// export default TarifKomponenTindakanLabItem;
