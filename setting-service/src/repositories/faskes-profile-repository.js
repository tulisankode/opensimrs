import sequelizeInstance from "../configurations/sequelize-instance.js";
import {Op} from "sequelize";
import NotfoundException from "../errors/notfound-exception.js";
import InternalServerException from "../errors/internal-server-exception.js";
import {AddressModel, FaskesProfilesModel} from "@opensimrs/model-sdk/setting";

export default class FaskesProfileRepository {
    static async getByFaskesUuid(uuid){
        return await sequelizeInstance.transaction(async tr => {
            return await FaskesProfilesModel.findOne({
                where: {
                    faskesUuid: uuid
                },
                transaction: tr
            });
        });
    }

    static async create(req){
        return await sequelizeInstance.transaction(async tr => {
            return await FaskesProfilesModel.create(req, {
                transaction: tr
            });
        });
    }

    static async update(req){
        return await sequelizeInstance.transaction(async tr => {
            let affectedRow = await FaskesProfilesModel.update(req, {
                where: {
                    [Op.and]: [
                        {faskesUuid: req.uuid},
                        {
                            deletedAt: {
                                [Op.is]: null
                            }
                        }
                        ],
                },
                transaction: tr
            });

            if (affectedRow[0] === 0) throw new NotfoundException('gagal mengupdate faskes profile, data tidak ditemukan');

            if (req.address !== null && req.address !== undefined){
                {
                    affectedRow = await AddressModel.update(req.address, {
                        where: {
                            uuid: req.address.uuid
                        },
                        transaction: tr,
                    });
                }
            }

            if (affectedRow[0] === 0) throw new InternalServerException('gagal mengupdate faskes profile, data address tidak ditemukan');

            return affectedRow[0];
        });
    }

    static async findPPN(uuid) {
        return await sequelizeInstance.transaction(async (tr) => {
            return await FaskesProfilesModel.findOne({
                where: {
                    [Op.and]: [
                        {faskesUuid: uuid},
                        {
                            deletedAt: {
                                [Op.is]: null
                            }
                        }
                    ]
                },
                attributes: ['status_ppn', 'value_ppn'],
                transaction: tr
            });
        });
    }

    static async findBiayaAdministrasi(uuid) {
        return await sequelizeInstance.transaction(async (tr) => {
            return await FaskesProfilesModel.findOne({
                where: {
                    [Op.and]: [
                        {faskesUuid: uuid},
                        {
                            deletedAt: {
                                [Op.is]: null
                            }
                        }
                    ]
                },
                attributes: ['status_biaya_lain', 'value_biaya_lain'],
                transaction: tr
            });
        });
    }


    static async findProfileByUuid(uuid) {
        FaskesProfilesModel.hasOne(AddressModel, {
            constraints: false,
            foreignKey: "faskesUuid",
            sourceKey: "uuid"
        });

        AddressModel.belongsTo(FaskesProfilesModel, {
            constraints: false,
            foreignKey: "uuid",
            targetKey: "faskesUuid"
        });
        return await sequelizeInstance.transaction(async tr => {
            
            const profile = await FaskesProfilesModel.findOne({
                where: {
                    faskesUuid: uuid
                },
                transaction: tr,
                include: [
                    {
                        model: AddressModel,
                        required: false
                    }
                ]
            });
            if(!profile) {
                return null
            }
            else {
                const p = profile.toJSON();
                delete p.AddressModel;
                p.address = profile.toJSON().AddressModel;
                return p;
            }
        })
    }

    /**
     * 
     * @param {number} page 
     * @param {number} pageSize 
     * @param {string} orderBy 
     * @param {string} search 
     */
    static async findAllProfileFaskesIncludeAddress(page, pageSize, orderBy, search){
        FaskesProfilesModel.hasOne(AddressModel, {
            constraints: false,
            foreignKey: "faskesUuid",
            sourceKey: "uuid"
        });

        AddressModel.belongsTo(FaskesProfilesModel, {
            constraints: false,
            foreignKey: "uuid",
            targetKey: "faskesUuid"
        });
        let whereClause;
        if(search){
            whereClause = {
               name: {
                [Op.like]: `%${search}%`
               } 
            }
        }
        const {count, rows} = await FaskesProfilesModel.findAndCountAll({
            where: whereClause,
            limit: pageSize,
            offset: page-1,
            order: [["id", orderBy]],
            include: [
                {
                    model: AddressModel,
                    required: true
                }
            ]
        });;
        return {
            data: rows.map(profile => {
                let p = profile.toJSON();
                delete p.AddressModel;
                p.address = profile.toJSON().AddressModel;
                return p;
            }),
            properties: {
                currentPage: page,
                perPage: pageSize,
                totalPage: Math.ceil(count / pageSize),
                totalData: count
            }
        }
    }
}