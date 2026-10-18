import express from "express";
import routes from "./routes/routes.js";
import { ruteLis, ruteMasuk } from "./lis/lis-rute.js";
import { mulaiPemantauBatch } from "./lis/lis-batch.js";
import errorMiddleware from "./middlewares/error-middleware.js";
import cors from "cors";
import authorizationSdk from "@opensimrs/authorization-sdk";
import { auditContextMiddleware } from "@opensimrs/model-sdk/audit-context";

const APPLICATION_PORT = process.env.APPLICATION_PORT || 8080;
const APPLICATION_HOST = process.env.APPLICATION_HOST || 'localhost';

const app = express();
app.use(cors({
    origin: '*',
    allowedHeaders: ['Origin', 'Content-Type', 'Accept', 'User-Agent', 'Content-Length', 'Authorization', 'x-api-key'],
    methods: ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// hasil dari LIS memakai kunci masuk per koneksi, bukan token login
app.use(express.json({ limit: "5mb" }), ruteMasuk);
app.use(authorizationSdk([]))
// Audit Trail terpusat (STD-0029): konteks pengguna/permintaan untuk hook audit model-sdk.
app.use(auditContextMiddleware());
app.use(ruteLis);
app.use(routes);
app.use(errorMiddleware);
app.listen(APPLICATION_PORT, APPLICATION_HOST, async () => {
    // await UserModel.sync({ alter: false, force: true})
    console.log(`Server running on http://localhost:${APPLICATION_PORT}`);
    // lanjutkan batch kirim/ambil hasil LIS yang terputus (restart) & tandai klaim kirim yang macet
    mulaiPemantauBatch();
});