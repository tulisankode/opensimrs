import { ItemPemeriksaanModel, KelompokPemeriksaanModel, TarifKomponenTindakanLabModel, TarifLabItemModel, TarifLabModel } from "@opensimrs/model-sdk/lab";
import { Op } from "sequelize";

export class LabRepository {


  /**
   * 
   * @param {Array<string>} nameList 
   * @param {string} faskesUuid 
   * @returns {Promise<any>}
   */
  static async findAllByNameIn(nameList, faskesUuid){
    const tarifLabList = await TarifLabModel.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: nameList.map(n => ({name: {[Op.iLike]: `%${n}%`}}))
          },
          {
            faskes_uuid: faskesUuid
          }
        ]
      }
    });
    return tarifLabList.map(t => t.toJSON());
  }

  /**
   *
   * @param {Array<string>} uuidList
   * @param {string} faskes_uuid
   */
  static async findAllByUuidIn(uuidList, faskes_uuid) {
    TarifKomponenTindakanLabModel.hasOne(TarifLabModel, {
      foreignKey: "uuid",
      sourceKey: "tarif_lab_uuid",
      constraints: false,
    });
    TarifLabModel.belongsTo(TarifKomponenTindakanLabModel, {
      constraints: false,
      foreignKey: "uuid",
      targetKey: "tarif_lab_uuid",
    });

    TarifKomponenTindakanLabModel.hasMany(TarifLabItemModel, {
      constraints: false,
      foreignKey: "uuid",
      sourceKey: "tarif_lab_item_uuid",
    });

    TarifLabItemModel.belongsTo(TarifKomponenTindakanLabModel, {
      constraints: false,
      foreignKey: "uuid",
      targetKey: "tarif_lab_item_uuid",
    });
    const result = await TarifKomponenTindakanLabModel.findAll({
      where: {
        [Op.and]: [
          {
            uuid: {
              [Op.in]: uuidList,
            },
          },
          {
            faskes_uuid: faskes_uuid,
          },
          {
            deleted_at: {
              [Op.is]: null,
            },
          },
        ],
      },
      include: [
        {
          model: TarifLabModel,
          required: true,
        },
        {
          model: TarifLabItemModel,
          required: true,
          attributes: ["uuid"],
        },
      ],
    });
    return result.map((r) => r.toJSON());
  }

  /**
   * 
   * @param {{uuid: Array<string>, faskes_uuid: string}} request 
   * @returns 
   */
  static async findItemPemeriksanOrKelompokPemeriksaanByUuid(request) {
    let result;
    result = await ItemPemeriksaanModel.findAll({
      where: {
        [Op.and]: [
          {
            uuid: {
              [Op.in]: request.uuid,
            },
          },
          {
            faskes_uuid: request.faskes_uuid,
          },
          {
            deleted_at: {
              [Op.is]: null,
            },
          },
        ],
      },
    });
    if (!result) {
      result = await KelompokPemeriksaanModel.findAll({
        where: {
          [Op.and]: [
            {
              uuid: {
                [Op.in]: request.uuid,
              },
            },
            {
              faskes_uuid: request.faskes_uuid,
            },
            {
              deleted_at: {
                [Op.is]: null,
              },
            },
          ],
        },
      });
    }
    return result.map(r => r.toJSON());
  }
}
