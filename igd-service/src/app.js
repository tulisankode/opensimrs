import express from "express";
import { Context } from "./middlewares/context.js";
import cors from "cors";
import routes from "./routes/routes.js";
import errorMiddleware from "./middlewares/error-middleware.js";
import {dbSeeder} from "./seeders/db-seeder.js";
import authorizationSdk from "@opensimrs/authorization-sdk";
import { auditContextMiddleware } from "@opensimrs/model-sdk/audit-context";

const APPLICATION_PORT = process.env.APPLICATION_PORT;
const APPLICATION_HOST = process.env.APPLICATION_HOST;
const API_BASE = process.env.API_BASE || "api";
const API_VERSION = process.env.API_VERSION || "v3";
const API_MODULE = process.env.API_MODULE || "pelayanan";
const BASE_URL = `/${API_BASE}/${API_VERSION}/${API_MODULE}`;

const app = express();
app.use(cors({
    origin: '*',
    allowedHeaders: ['Origin', 'Content-Type', 'Accept', 'User-Agent', 'Content-Length', 'Authorization'],
    methods: ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Konteks per permintaan (author/token) — harus sebelum rute.
app.use(Context.middleware);
// Audit Trail terpusat (STD-0029): konteks pengguna/permintaan untuk hook audit model-sdk.
app.use(auditContextMiddleware());
app.use(BASE_URL, routes);
app.use(errorMiddleware);
app.listen(APPLICATION_PORT, APPLICATION_HOST, async () => {
    console.log(`Server running on http://${APPLICATION_HOST}:${APPLICATION_PORT}`);
});