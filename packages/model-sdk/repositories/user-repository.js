import { Op } from "sequelize";
import sequelizeInstance from "../../configurations/config-db.js";
import { UserModel } from "../script.js";
import NotfoundException from "../exceptions/notfound-exceptions.js";

export default class UserRepositories {
  /**
   * 
   * @param { string } username 
   * @param { string } faskesUuid 
   * this functuin require username and faskes uuid (mandatory)
   * @returns 
   */
  static async findByUsername(username, faskesUuid) {
    return await sequelizeInstance.transaction(async (tr) => {
      const user = await UserModel.findOne({
        transaction: tr,
        where: {
          [Op.and]: [
            {
              deletedAt: {
                [Op.is]: null,
              },
            },
            { 
              [Op.or]: [
                { username },
                { email: username }
              ]
            },
            { faskesUuid }
          ],
        },
      });
      if(!user) throw new NotfoundException({message: "Tidak ditemukan", errors: [{message: `user ${username} tidak ditemukan`}]})
      else return user.toJSON();
    });
  }
}
