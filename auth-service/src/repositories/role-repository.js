import { RoleModel } from "@opensimrs/model-sdk/datamaster";
import { Op } from "sequelize";

export class RoleRepository {
    /**
     * 
     * @param {string} faskesUuid 
     * @param {Array<string>} nameList 
     * @returns 
     */
    static async findAllRoleByName(faskesUuid, nameList) {
        const roleList =  await RoleModel.findAll({
            where: {
                [Op.and]: [
                    { 
                        name: {
                            [Op.in]: nameList
                        }
                    },
                    { 
                        faskes_uuid: faskesUuid 
                    }
                ]
            }
        });
        if(!roleList) return [];
        else return roleList.map(r => r.toJSON());
    }
}