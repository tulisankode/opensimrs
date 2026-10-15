import dotenv from "dotenv"
import { MongoClient } from "mongodb"
dotenv.config()

const { MONGO_DB_NAME, MONGO_DB_HOST, MONGO_DB_PORT, MONGO_DB_AUTH_SOURCE, MONGO_DB_USERNAME, MONGO_DB_PASSWORD } = process.env

const connStr = `mongodb://${MONGO_DB_USERNAME}:${MONGO_DB_PASSWORD}@${MONGO_DB_HOST}:${MONGO_DB_PORT}/${MONGO_DB_NAME}?authSource=${MONGO_DB_AUTH_SOURCE}`

let mongoInstance = null

export async function getMongoClientInstance() {
  if (!mongoInstance) {
    mongoInstance = new MongoClient(connStr)

    await mongoInstance.connect()
    console.log("Connect to MongoDB")
  }

  return mongoInstance
}

export async function getMongoDatabase() {
  const client = await getMongoClientInstance()
  return client.db(MONGO_DB_NAME)
}

process.on("SIGINT", async () => {
  if (mongoInstance) {
    await mongoInstance.close();
    console.log("MongoDB connection closed.");
  }
  process.exit(0);
});


export default { getMongoClientInstance, getMongoDatabase }
