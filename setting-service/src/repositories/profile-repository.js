import sequelizeInstance from "../configurations/sequelize-instance.js";

import {Op} from "sequelize";
import RoleRepository from "./role-repository.js";
import NotfoundException from "../errors/notfound-exception.js";
import {PegawaiModel, PractitionerModel, UserModel} from "@opensimrs/model-sdk/datamaster";

export default class ProfileRepository {
    static async getByUsername(username) {
        return await sequelizeInstance.transaction(async (tr) => {
            const user = await UserModel.findOne({
                where: {
                    [Op.and]: [
                        {username: `${username}`},
                        {
                            deletedAt: {
                                [Op.is]: null
                            }
                        }
                    ]
                },
                include: [
                    {
                        model: PractitionerModel,
                        as: "practitioner_user",
                        attributes: ["uuid"],
                        include: [
                            {
                                model: PegawaiModel,
                                as: "pegawai_user",
                                attributes: ["uuid", "name"],
                            }
                        ]
                    }
                ],
                attributes: ["uuid", "username", "email", 'password' , "photo", "role_uuid", 'phone'],
                transaction: tr
            });

            if (!user) {
                throw new NotfoundException("User not found");
            }

            const role = await RoleRepository.findByUuid(user.dataValues.role_uuid);

            return {
                ...user.dataValues,
                name : user?.practitioner_user?.pegawai_user?.name,
                practitioner_user : undefined,
                role_name: role?.dataValues?.name
            }
        });

    }

    static async update(user){
        return await sequelizeInstance.transaction(async (tr) => {
                const affectedRow = await UserModel.update(user, {
                    where: {username: user.username},
                    transaction: tr
                });

                const userPegawai = await UserModel.findOne({
                    where: {
                        [Op.and]: [
                            {username: `${user.username}`},
                            {
                                deletedAt: {
                                    [Op.is]: null
                                }
                            }
                        ]
                    },
                    include: [
                        {
                            model: PractitionerModel,
                            as: "practitioner_user",
                            attributes: ["uuid"],
                            include: [
                                {
                                    model: PegawaiModel,
                                    as: "pegawai_user",
                                    attributes: ["uuid"],
                                }
                            ]
                        }
                    ],
                    attributes: ["uuid"],
                    transaction: tr
                });

                await PegawaiModel.update({
                    name : user.name,
                    first_title : user.awalan_gelar,
                    last_title : user.akhiran_gelar,
                }, {
                    where: {uuid: userPegawai.practitioner_user.pegawai_user.uuid},
                    transaction: tr
                })

                return affectedRow[0];
        });
    }

}

UserModel.belongsTo(PractitionerModel, {
    foreignKey: "practitioner_uuid",
    as: "practitioner_user",
    constraints: false
})

PractitionerModel.belongsTo(PegawaiModel, {
    foreignKey: "pegawai_uuid",
    as: "pegawai_user",
    constraints: false
})