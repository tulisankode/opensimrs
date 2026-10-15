import { UserModel } from "@opensimrs/model-sdk/datamaster";
import NotfoundException from "../errors/notfound-exception.js";

export default class UserRepository {
    static async findByUuid(uuid) {
        const user = await UserModel.findOne({
            where: {
                uuid: uuid
            },
            attributes: ["uuid", "username"] 
        });

        if (!user) {
            throw new NotfoundException(`Data user dengan UUID ${uuid} tidak ditemukan.`);
        }
        
        return user;
    }
}