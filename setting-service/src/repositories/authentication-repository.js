import { Op } from "sequelize";
import {UserModel} from "@opensimrs/model-sdk/datamaster";

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
