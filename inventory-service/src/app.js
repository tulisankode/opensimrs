import express from "express";
import cors from "cors";
import routes from "./routes/routes.js";
import marketplaceWebhookRoutes from "./routes/marketplace-webhook-routes.js";
import errorMiddleware from "./middlewares/error-middleware.js";
import authorizationSdk from "@opensimrs/authorization-sdk";
import defineAssociations from "./configurations/database-associations.js";
import morgan from "morgan";

const APPLICATION_PORT = process.env.APPLICATION_PORT || 8080;
const APPLICATION_HOST = process.env.APPLICATION_HOST || "localhost";

const app = express();
app.use(
    cors({
        origin: "*",
        allowedHeaders: [
            "Origin",
            "Content-Type",
            "Accept",
            "User-Agent",
            "Content-Length",
            "Authorization",
        ],
        methods: ["GET", "POST", "HEAD", "PUT", "DELETE", "PATCH", "OPTIONS"],
    })
);

app.use(express.json());
app.use(morgan("combined"));
app.use(express.urlencoded({extended: true}));
// Webhook marketplace mitra (STD-0019): tanpa JWT, otentikasi memakai kunci masuk per koneksi — harus
// dipasang sebelum authorizationSdk (pola sama dengan lab-service/src/lis/lis-rute.js: ruteMasuk).
app.use(marketplaceWebhookRoutes);
app.use(authorizationSdk([]));
// app.use(efp());
app.use(routes);
app.use(errorMiddleware);
app.listen(APPLICATION_PORT, APPLICATION_HOST, async () => {
    try {
        defineAssociations();
        // for (const model of MODELMERGE) {
        //     await model.sync({alter: true, force: });
        // }
        // await dbSeeder();
    } catch (error) {
        console.error("Failed to synchronize the database:", error);
    }

    console.log(
        `Server running on http://${APPLICATION_HOST}:${APPLICATION_PORT}`
    );
});
