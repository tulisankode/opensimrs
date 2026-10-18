import { createSequelizeInstance } from "./sequelize-instance.js";
import "dotenv/config";
import { env } from "node:process";
import { Sequelize } from "sequelize";
import { pasangAuditSequelize } from "../umum/audit-sequelize.js";

const { DB_NAME, DB_USERNAME, DB_PASSWORD, DB_DIALECT, DB_HOST, DB_PORT, DB_POOL_MAX, DB_POOL_MIN, DB_POOL_ACQUIRE, DB_POOL_IDLE } = env;
/**
 * @description sequelize instance with singgleton pattern
 * @author https://github.com/alliano
 * @type {Sequelize}
 */
const sequelizeInstance = createSequelizeInstance({
  db_name: DB_NAME,
  db_username: DB_USERNAME,
  db_password: DB_PASSWORD,
  db_host: DB_HOST,
  db_port: DB_PORT,
  db_dialect: DB_DIALECT,
  pool: {
    max: DB_POOL_MAX ?? 7,
    min: DB_POOL_MIN ?? 1,
    acquire: DB_POOL_ACQUIRE ?? 30000,
    idle: DB_POOL_IDLE ?? 10000,
  },
});

// Audit Trail terpusat (STD-0029): hook global dipasang di sini agar setiap layanan yang memakai model bersama
// lewat `@opensimrs/model-sdk/instance` (mis. admisi-service) otomatis tercatat tanpa konfigurasi tambahan.
pasangAuditSequelize(sequelizeInstance, { layanan: env.APPLICATION_MODULE || env.API_MODULE || "model-sdk" });

export default sequelizeInstance;

