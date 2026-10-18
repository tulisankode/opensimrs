import { createClient } from "redis";
import "dotenv/config";

// Dipakai PermissionBuilder (@opensimrs/permission-sdk) untuk membaca izin pengguna dari sesi login Redis yang sama
// dipakai auth-service, agar pemeriksaan izin lihat/ekspor Audit Trail konsisten dengan izin yang diberikan saat login.
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_USERNAME = process.env.REDIS_USERNAME?.trim() || undefined;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD?.trim() || undefined;
const REDIS_PORT = Number.parseInt(process.env.REDIS_PORT, 10) || 6379;
const REDIS_DATABASE = Number.parseInt(process.env.REDIS_DATABASE, 10) || 0;

const redisOptions = {
  database: REDIS_DATABASE,
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  },
};

if (REDIS_USERNAME) redisOptions.username = REDIS_USERNAME;
if (REDIS_PASSWORD) redisOptions.password = REDIS_PASSWORD;

const redisClient = createClient(redisOptions);

redisClient.on("error", (error) => {
  console.error("[Redis]", error.message);
});

export default redisClient;
