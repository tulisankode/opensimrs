import express from "express";
import cors from "cors";
import routes from "./routes/routes.js";
import errorMiddleware from "./middlewares/error-middleware.js";
import authorizationMiddleware from "./middlewares/authorization-middleware.js";
import sequelizeInstance from "./configurations/sequelize-instance.js";
import {UserModel} from "@opensimrs/model-sdk/datamaster";
import bcrypt from "bcrypt";
import MODELMERGE from "./models/model-synchronize.js";
import authorizationSdk from "@opensimrs/authorization-sdk";
import {dbSeeder} from "./seeders/db-seeder.js";

const APPLICATION_PORT = process.env.APPLICATION_PORT;
const APPLICATION_HOST = process.env.APPLICATION_HOST;

const app = express();
app.use(cors({
    origin: '*',
    allowedHeaders: ['Origin', 'Content-Type', 'Accept', 'User-Agent', 'Content-Length', 'Authorization'],
    methods: ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));
app.use(express.json({limit: "25 mb"}));
app.use(express.urlencoded({extended: false, limit: "25 mb"}));
app.use(authorizationSdk([]));
app.use(routes);
app.use(errorMiddleware);
app.listen(APPLICATION_PORT, APPLICATION_HOST, async () => {
    try {
        // for (const model of MODELMERGE) {
        //     await model.sync({ alter: false, force: true });
        // }

        // await dbSeeder();
    } catch (error) {
        console.error("Failed to synchronize the database:", error);
    }


    await sequelizeInstance.transaction(async (tr) => {
    })


    console.log(`Server running on http://${APPLICATION_HOST}:${APPLICATION_PORT}`);
});