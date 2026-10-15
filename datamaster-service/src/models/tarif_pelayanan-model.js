// import { DataTypes } from "sequelize";
// import sequelizeInstance from "@opensimrs/model-sdk/instance";
// import { uuidv7 } from "uuidv7";

// const TarifPelayanan = sequelizeInstance.define(
//   "TarifPelayanan",
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
//       allowNull: false,
//       validate: {
//         notEmpty: true,
//       },
//     },
//     unit_pelayanan: {
//       type: DataTypes.INTEGER,
//       allowNull: false,
//       validate: {
//         notEmpty: true,
//       },
//     },
//   },
//   {
//     tableName: "tarif_pelayanan",
//     underscored: true,
//     timestamps: false,
//   }
// );

// export default TarifPelayanan;
