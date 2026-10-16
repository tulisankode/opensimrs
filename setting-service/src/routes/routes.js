import express from "express";
import FaskesProfileController from "../controllers/faskes-profile-controller.js";
import IntegrationController from "../controllers/integration-controller.js";
import ProfileController from "../controllers/profile-controller.js";
import PrinterController from "../controllers/printer-controller.js";
import ModulController from "../controllers/modul-controller.js";
import BantuanController from "../controllers/bantuan-controller.js";
import authorizationMiddleware from "../middlewares/authorization-middleware.js";

const apiBase = process.env.API_BASE || "api";
const apiVersion = process.env.API_VERSION || "v1";

const routes = express.Router();

// HEALTH CHECK
routes.get(`/${apiBase}/${apiVersion}/setting/health`, (req, res) => res.status(200).json({ message: "OK" }));

// FASKES PROFILE
routes.get(`/${apiBase}/${apiVersion}/setting/profil-faskes`, FaskesProfileController.findByFaskesUuid);
routes.put(`/${apiBase}/${apiVersion}/setting/profil-faskes`, FaskesProfileController.update);
routes.put(`/${apiBase}/${apiVersion}/setting/ppn`, FaskesProfileController.updatePPN);
routes.get(`/${apiBase}/${apiVersion}/setting/ppn`, FaskesProfileController.findPPN);
routes.put(`/${apiBase}/${apiVersion}/setting/biaya-administrasi`, FaskesProfileController.updateBiayaAdministrasi);
routes.get(`/${apiBase}/${apiVersion}/setting/biaya-administrasi`, FaskesProfileController.findBiayaAdministrasi);
routes.get(`/${apiBase}/${apiVersion}/setting/-/profile-faskes/:faskesUuid`, FaskesProfileController.findFaskesProfileByFaskesUuid);
routes.get(`/${apiBase}/${apiVersion}/setting/-/profile-faskes`, FaskesProfileController.findAllIncludeAddress);


// INTERGRATION
routes.get(`/${apiBase}/${apiVersion}/setting/integrasi`, IntegrationController.findByUuid);
routes.put(`/${apiBase}/${apiVersion}/setting/integrasi-vclaim`, IntegrationController.updateVclaim);
routes.put(`/${apiBase}/${apiVersion}/setting/integrasi-other`, IntegrationController.updateOther);
routes.put(`/${apiBase}/${apiVersion}/setting/integrasi-satu-sehat`, IntegrationController.updateSatuSehat);

// PROFILE
routes.get(`/${apiBase}/${apiVersion}/setting/profile`, ProfileController.getProfile);
routes.put(`/${apiBase}/${apiVersion}/setting/profile`, ProfileController.updateProfile);

// MANAJEMEN MODUL (segmen faskes; ubah hanya superadmin)
routes.get(`/${apiBase}/${apiVersion}/setting/modul`, ModulController.ambil);
routes.put(`/${apiBase}/${apiVersion}/setting/modul`, ModulController.simpan);
routes.get(`/${apiBase}/${apiVersion}/setting/modul/riwayat`, ModulController.riwayat);
routes.put(`/${apiBase}/${apiVersion}/setting/modul/jenis-poli`, ModulController.simpanJenisPoli);

// BANTUAN (Helpdesk asisten pengguna → OpenClaw Gateway; docs/rancangan/HELPDESK-OPENCLAW.md)
routes.get(`/${apiBase}/${apiVersion}/setting/bantuan/status`, BantuanController.status);
routes.post(`/${apiBase}/${apiVersion}/setting/bantuan/chat`, BantuanController.chat);
routes.get(`/${apiBase}/${apiVersion}/setting/bantuan/ringkasan`, BantuanController.ringkasan);

// PRINTER
routes.get(`/${apiBase}/${apiVersion}/setting/printer`, PrinterController.findByUuid);
routes.put(`/${apiBase}/${apiVersion}/setting/printer`, PrinterController.update);

export default routes;