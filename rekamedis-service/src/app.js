import express from "express";
import cors from "cors";
import routes from "./routes/routes.js";
import errorMiddleware from "./middlewares/error-middleware.js";
import authorizationSdk from "@opensimrs/authorization-sdk";
import mongooseInstance from "./configurations/mongoose-instance.js";
import morgan from "morgan";
import EventListener from "./listeners/event-listener.js";
import MODELMERGE from "./models/postgres/modelMerge.js";
import authorizationMiddleware from "./middlewares/authorization-middleware.js";

const APPLICATION_PORT = process.env.APPLICATION_PORT || 3000;
const APPLICATION_HOST = process.env.APPLICATION_HOST || "localhost";
const apiBase = process.env.API_BASE || "api";
const apiVersion = process.env.API_VERSION || "v3";

const app = express();
app.use(cors({
    origin: '*',
    allowedHeaders: ['Origin', 'Content-Type', 'Accept', 'User-Agent', 'Content-Length', 'Authorization'],
    methods: ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(morgan("dev"));
// app.use(authorizationSdk([]));
app.use(authorizationMiddleware);
await mongooseInstance();
app.use(`/${apiBase}/${apiVersion}`, routes);
app.use(errorMiddleware);
EventListener.init();

if (process.env.SYNC_DB === "true") {
    try {
        // for (const model of MODELMERGE) {
        //     await model.sync({ alter: true });
        // }
    } catch (error) {
        console.error("Failed to synchronize the database:", error);
    }
}

app.listen(APPLICATION_PORT, APPLICATION_HOST, async () => {

    console.log(`Server running on http://${APPLICATION_HOST}:${APPLICATION_PORT}`);
});