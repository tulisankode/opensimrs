import { UserModel } from "@opensimrs/model-sdk/datamaster";
import { Op } from "sequelize";

export default class AuthenticationRepository {
  static async isTokenExist(username){
    return await UserModel.findOne({
      where: {
        [Op.and]: [
          { username },
          {
            token: {
              [Op.not]: null
            }
          }
        ]
      }
    })
  }
}
