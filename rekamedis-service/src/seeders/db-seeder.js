import PractitionerSeeder from "./practitioner-seeder.js";
import PegawaiSeeder from "./pegawai-seeder.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import LokasiSeeder from "./lokasi-seeder.js";
import OrderFisioSeeder from "./order-fisio-seeder.js";
import FaskesSeeder from "./faskes-seeder.js";
import FaskesProfileSeeder from "./faskes-profile-seeder.js";

export const dbSeeder = async () => {
    const transaction = await sequelizeInstance.transaction();
    try {
        await PegawaiSeeder.seed(transaction);
        await PractitionerSeeder.seed(transaction);
        await LokasiSeeder.seed(transaction);
        await OrderFisioSeeder.seed(transaction);
        await FaskesSeeder.seed(transaction);
        await FaskesProfileSeeder.seed(transaction);
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};