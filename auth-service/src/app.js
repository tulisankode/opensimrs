import express from "express";
import "dotenv/config";
import errorMiddleware from "./middlewares/error-middleware.js";
import publicRoutes from "./routes/public-route.js";
import privateRoute from "./routes/private-route.js";
import redisClient from "./configurations/redis-client-config.js";
import requestResponseFormatterMidddleware from "./middlewares/request-response-formatter-middleware.js";
import morgan from "morgan";
import cors from "cors";
import {
  FaskesModel,
  PegawaiModel,
  PractitionerModel,
  RoleModel,
  UserModel,
} from "@opensimrs/model-sdk/datamaster";
import { initAdmin, initSueprAdmin } from "./seeders/db-seed.js";

const APPLICATION_PORT = process.env.APPLICATION_PORT;
const APPLICATION_HOST = process.env.APPLICATION_HOST;
const BASE_URL = `/${process.env.API_BASE ?? "api"}/${
  process.env.API_VERSION ?? "v3"
}/${process.env.APPLICATION_MODULE ?? "auth"}`;

const app = express();
app.use(express.json());
app.use(morgan("dev"));
app.use(
  cors({
    origin: "*",
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(requestResponseFormatterMidddleware);
app.use(BASE_URL, publicRoutes);
app.use(BASE_URL, privateRoute);
app.use(errorMiddleware);

redisClient.on("connect", () => console.log("Redis alredy accept request"));

app.listen(APPLICATION_PORT, APPLICATION_HOST, async () => {
  await redisClient.connect();
  // await FaskesModel.sync({ force: true });
  // await RoleModel.sync({ force: true });
  // await UserModel.sync({ force: true });
  // await PegawaiModel.sync({ force: true });
  // await PractitionerModel.sync({ force: true });
  // await initSueprAdmin();
  // await initAdmin();
  console.log(
    `The server running on http://${APPLICATION_HOST}:${APPLICATION_PORT}`
  );
});

export default app;
