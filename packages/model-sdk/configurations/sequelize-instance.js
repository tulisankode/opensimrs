import { Sequelize } from "sequelize";

/**
 * @typedef {Object} DBPoolConfig
 * @property {number} [max] - Jumlah maksimum koneksi di pool
 * @property {number} [min] - Jumlah minimum koneksi di pool
 * @property {number} [acquire] - Waktu maksimum (ms) untuk mendapatkan koneksi
 * @property {number} [idle] - Waktu maksimum (ms) koneksi boleh idle sebelum dilepas
 */

/**
 * @typedef {Object} DBConfig
 * @property {string} db_name - Nama database
 * @property {string} db_username - Username database
 * @property {string} db_password - Password database
 * @property {string} db_host - Host database
 * @property {number} [db_port] - Port database
 * @property {"postgres" | "mysql" | "sqlite" | "mariadb" | "mssql"} [db_dialect] - Dialek database
 * @property {DBPoolConfig} [pool] - Konfigurasi pool
 */

/** @type {Sequelize} */
let sequelizeInstance = null;

/**
 * Membuat instance Sequelize dengan pola Singleton.
 * Hanya membuat satu instance selama runtime aplikasi.
 *
 * @param {DBConfig} config - Konfigurasi koneksi database
 * @returns {Sequelize} Instance Sequelize tunggal
 * @example
 * const sequelize = createSequelizeInstance({
 *   db_name: "mydb",
 *   db_username: "user",
 *   db_password: "pass",
 *   db_host: "localhost",
 *   db_port: 5432,
 *   db_dialect: "postgres"
 * });
 */
export function createSequelizeInstance(config) {
  if (!config) {
    throw new Error("Missing database configuration");
  }

  sequelizeInstance ??= new Sequelize(
    config.db_name ?? "postgres",
    config.db_username ?? "postgres",
    config.db_password ?? "postgres",
    {
      host: config.db_host ?? "127.0.0.1",
      port: config.db_port ?? 5432,
      dialect: config.db_dialect ?? "postgres",
      pool: {
        max: config.pool?.max ?? 7,
        min: config.pool?.min ?? 1,
        acquire: config.pool?.acquire ?? 30000,
        idle: config.pool?.idle ?? 10000,
      },
      logging: false, // nonaktifkan log query default
    }
  );
  return sequelizeInstance;
}


/**
 * Mengambil instance Sequelize yang sudah dibuat.
 * Lempar error jika belum diinisialisasi.
 *
 * @returns {Sequelize} Instance Sequelize yang sudah ada
 */
export function getSequelizeInstance() {
  if (!sequelizeInstance) {
    throw new Error(
      "Sequelize instance not initialized. Call createSequelizeInstance() first."
    );
  }
  return sequelizeInstance;
}

/**
 * Menutup koneksi dan mereset instance singleton (opsional).
 * Berguna untuk testing atau restart koneksi.
 *
 * @returns {Promise<void>}
 */
export async function closeSequelizeInstance() {
  if (sequelizeInstance) {
    await sequelizeInstance.close();
    sequelizeInstance = null;
  }
}
