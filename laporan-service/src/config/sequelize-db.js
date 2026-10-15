import { createSequelizeInstance } from "@opensimrs/model-sdk/builder";
import dotenv from "dotenv";
dotenv.config()

const { DB_NAME, DB_USERNAME, DB_PASSWORD, DB_DIALECT, DB_HOST, DB_PORT, DB_POOL_MAX, DB_POOL_MIN, DB_POOL_ACQUIRE, DB_POOL_IDLE } = process.env;
const sequelizeInstance = createSequelizeInstance({
  db_name: DB_NAME,
  db_username: DB_USERNAME,
  db_password: DB_PASSWORD,
  db_host: DB_HOST,
  db_port: DB_PORT,
  db_dialect: DB_DIALECT,
  pool: {
    max: DB_POOL_MAX ?? 50,
    min: DB_POOL_MIN ?? 13,
    acquire: DB_POOL_ACQUIRE ?? 30000,
    idle: DB_POOL_IDLE ?? 10000,
  },
});

export default sequelizeInstance;

