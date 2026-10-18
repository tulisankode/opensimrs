import {Sequelize} from "sequelize";
import "dotenv/config";
import { pasangAuditSequelize } from "@opensimrs/model-sdk/audit-sequelize";

const DB_NAME = process.env.DB_NAME;
const DB_USERNAME = process.env.DB_USERNAME;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_HOST = process.env.DB_HOST;
const DB_PORT = process.env.DB_PORT;
const sequelizeInstace = new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
    host: DB_HOST,
    port: DB_PORT,
    dialect: "postgres",
    pool: {
        min: 5,
        max: 10,
    },
    define: {
        underscored: true,
        underscoredAll: true,
    }
});

// Audit Trail terpusat (STD-0029): hook global untuk model lokal rawat-inap-service.
pasangAuditSequelize(sequelizeInstace, { layanan: "rawat-inap" });

export default sequelizeInstace;
