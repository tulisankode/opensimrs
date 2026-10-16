import express from "express";
import UserController from "../controllers/user-controller.js";
import AuthenticationController from "../controllers/authentication-controller.js";
import PermissionController from "../controllers/permission-controller.js";
import "dotenv/config";
import { env } from "process";
import authorizationSdk from "@opensimrs/authorization-sdk";
import fileUpload from "express-fileupload";
import { permissionSdk } from "../configurations/permission.config.js";


const privateRoute = express.Router();
privateRoute.use(authorizationSdk([]));
// user
privateRoute.delete(`/logout`, AuthenticationController.logout);
privateRoute.put(`/token/:faskes`, AuthenticationController.updateToken);

// user
privateRoute.post(`/user`, UserController.create);
privateRoute.put(`/user/:uuid`, UserController.update);
privateRoute.get(`/user`, UserController.findAll);
privateRoute.get(`/user/deleted`, UserController.findAllDeleted);
privateRoute.delete(`/user/:uuid`, UserController.delete);
privateRoute.get(`/user/:uuid/user-role`, UserController.findByUuidIncludeRole);
privateRoute.patch(`/user/:uuid`, UserController.updatePassword);
privateRoute.post(`/user/import`, fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
    limits: { fileSize: 50 * 1024 * 1024 },
    abortOnLimit: true
}), UserController.import);
privateRoute.get(`/user/export`, UserController.export);

// izin: katalog modul (editor Role) & sinkron izin modul aktif ke peran admin (Manajemen Modul)
privateRoute.get(`/permission/katalog`, PermissionController.katalog);
privateRoute.post(`/permission/sinkron-modul`, PermissionController.sinkronModul);
privateRoute.post(`/permission/muat-ulang`, PermissionController.muatUlang);


privateRoute.get(`/health`, permissionSdk("Admisi", "Laporan Admisi", "Kunjungan", "READ"), (req, resp) => resp.status(200).json({status: "HEALTH"}))

export default privateRoute;