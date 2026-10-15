// Koneksi DB untuk sequelize-cli, dibaca dari .env di root repo (DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD).
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const base = {
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5432),
  dialect: "postgres",
  logging: false,
  migrationStorageTableName: "SequelizeMeta",
};

module.exports = { development: base, staging: base, production: base };
