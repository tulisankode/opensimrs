import sequelizeInstance from "@opensimrs/model-sdk/instance";
export class TransactionService {
  static async run(callback) {
    const transaction = await sequelizeInstance.transaction();
    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}