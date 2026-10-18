import express, { response } from "express";
import "dotenv/config";
import router from "./routers/router.js";
import { errorMiddleware } from "./middlewares/error-middleware.js";
import cors from "cors";
import snakeCaseKeys from "./middlewares/snake_case-middleware.js";
import bodyParser from "body-parser";
import authorizationSdk from "@opensimrs/authorization-sdk";
import { auditContextMiddleware } from "@opensimrs/model-sdk/audit-context";
import morgan from "morgan";
import { mobileRouts } from "./routers/mobile-router.js";
const APPLICATION_PORT = process.env.APPLICATION_PORT || 5000;
const APPLICATION_HOST = process.env.APPLICATION_HOST || "127.0.0.1";
const API_BASE = process.env.API_BASE || "api";
const API_VERSION = process.env.API_VERSION || "v3";
const API_MODULE = process.env.API_MODULE || "datamaster";

const app = express();
app.use(morgan("dev"));
app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));
app.use(bodyParser.urlencoded({ limit: "2mb", extended: true }));
app.use("/health", (request, response) =>
  response.status(200).json({ health: "The server is Helth", status: "OK" })
);
app.use(`/${API_BASE}/${API_VERSION}/${API_MODULE}`, mobileRouts);
app.use(
  authorizationSdk([
    "/api/v3/datamaster/mobile/faskes/:uuid",
    "/api/v3/datamaster/mobile/faskes",
    "/api/v3/datamaster/mobile/lokasi/poli/aktif",
    "/api/v3/datamaster/mobile/practitioner/:uuid",
    "/api/v3/datamaster/mobile/practitioner/poli/aktif",
    "/api/v3/datamaster/mobile/provinsi",
    "/api/v3/datamaster/mobile/kabupaten",
    "/api/v3/datamaster/mobile/kecamatan",
    "/api/v3/datamaster/mobile/kelurahan",
    "/api/v3/datamaster/mobile/practitioner/code-antrian/:code",
  ])
);
// Audit Trail terpusat (STD-0029): konteks pengguna/permintaan untuk hook audit model-sdk.
app.use(auditContextMiddleware());
app.use(snakeCaseKeys);
app.use(`/${API_BASE}/${API_VERSION}/${API_MODULE}`, router);
app.use(errorMiddleware);

app.listen(APPLICATION_PORT, APPLICATION_HOST, async () => {
  console.log(
    `The server running on http://${APPLICATION_HOST}:${APPLICATION_PORT}`
  );
});

export default app;
