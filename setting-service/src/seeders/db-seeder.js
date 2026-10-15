import sequelizeInstance from "../configurations/sequelize-instance.js";
import FaskesSeeder from "./faskes-seeder.js";
import PractitionerSeeder from "./practitioner-seeder.js";
import PegawaiSeeder from "./pegawai-seeder.js";
import UserSeeder from "./user-seeder.js";

export const dbSeeder = async () => {
    const transaction = await sequelizeInstance.transaction();
    try {
        // await FaskesSeeder.seed(transaction);
        // await PegawaiSeeder.seed(transaction);
        // await PractitionerSeeder.seed(transaction);
        await UserSeeder.seed(transaction);
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};