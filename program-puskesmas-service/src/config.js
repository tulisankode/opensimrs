import "dotenv/config";

const angka = (nilai, bawaan) => (nilai !== undefined && nilai !== "" && Number.isFinite(Number(nilai)) ? Number(nilai) : bawaan);

export default {
  port: angka(process.env.APPLICATION_PORT ?? process.env.APP_PORT ?? process.env.PORT ?? process.env.SERVER_PORT, 8100),
  host: process.env.APPLICATION_HOST || "0.0.0.0",
  basePath: "/api/v3/program-puskesmas",
  secretKey: process.env.SECRET_KEY,
  pg: {
    host: process.env.DB_HOST || "localhost",
    port: angka(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  },
  mongo: {
    uri: `mongodb://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@${process.env.MONGO_DB_HOST}:${process.env.MONGO_DB_PORT}/${process.env.MONGO_DB_NAME}?authSource=${process.env.MONGO_DB_AUTH_SOURCE}`,
    database: process.env.MONGO_DB_NAME,
  },
};
