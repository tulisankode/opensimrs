import pg from "pg";
import { MongoClient, ObjectId } from "mongodb";
import config from "./config.js";

export const pool = new pg.Pool({ ...config.pg, max: 5 });

export const query = async (sql, params = []) => (await pool.query(sql, params)).rows;
export const satu = async (sql, params = []) => (await query(sql, params))[0] ?? null;

let mongoDb = null;
export const mongo = async () => {
  if (mongoDb) return mongoDb;
  const { host, port, database, user, password, authSource } = config.mongo;
  const kredensial = user ? `${encodeURIComponent(user)}:${encodeURIComponent(password ?? "")}@` : "";
  const klien = new MongoClient(`mongodb://${kredensial}${host}:${port}/${database}?authSource=${authSource}`);
  await klien.connect();
  mongoDb = klien.db(database);
  return mongoDb;
};

export const keObjectId = (id) => (ObjectId.isValid(String(id)) && String(id).length === 24 ? new ObjectId(String(id)) : null);

export const sekarang = () => Math.floor(Date.now() / 1000);
