import sequelizeInstance from "../configurations/sequelize-instance.js";

export const dbSeeder = async () => {
    const transaction = await sequelizeInstance.transaction();
    try {
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};