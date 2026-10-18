import express from "express";
import cors from "cors";
import routes from "./routes/routes.js";
import errorMiddleware from "./middlewares/error-middleware.js";
import authorizationSdk from "@opensimrs/authorization-sdk";
import { auditContextMiddleware } from "@opensimrs/model-sdk/audit-context";
import efp from "express-fileupload";
import morgan from "morgan";

const APPLICATION_PORT = process.env.APPLICATION_PORT;
const APPLICATION_HOST = process.env.APPLICATION_HOST;

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

const authConfig = {
  publicKey: process.env.PUBLIC_KEY,
  privateKey: process.env.PRIVATE_KEY,
};


app.use(
  morgan("dev")
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authorizationSdk([], authConfig));
// Audit Trail terpusat (STD-0029): konteks pengguna/permintaan untuk hook audit model-sdk.
app.use(auditContextMiddleware());
app.use(efp());
app.use(routes);
app.use(errorMiddleware);
app.listen(APPLICATION_PORT, APPLICATION_HOST, async () => {
  try {
    // for (const model of MODELMERGE) {
    //     await model.sync({ alter: false, force: true });
    // }
    
    //await dbSeeder();
  } catch (error) {
    console.error("Failed to synchronize the database:", error);
  }

  console.log(`Mencoba terhubung ke database: ${process.env.DB_NAME} di ${process.env.DB_HOST}`);
  console.log(
    `Server running on http://${APPLICATION_HOST}:${APPLICATION_PORT}`
  );
});
