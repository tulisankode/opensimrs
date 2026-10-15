import express from "express";
import RekamMedisController from "../controllers/rekam-medis-controller.js";
import SessionController from "../controllers/session-controller.js";
import AssessmentController from "../controllers/assessment-controller.js";
import FileController from "../controllers/file-controller.js";
import InformConsentController from "../controllers/inform-consent-controller.js";
import PelayananController from "../controllers/pelayanan-controller.js";
import FpoController from "../controllers/fpo-controller.js";

const routes = express.Router();

const baseUrl = "rekam-medis";


// HEALTH CHECK
routes.get(`/setting/health`, (req, res) => res.status(200).json({ message: "OK" }));

// FPO
routes.get(`/${baseUrl}/fpo`, FpoController.get);
routes.post(`/${baseUrl}/fpo`, FpoController.insert);
routes.put(`/${baseUrl}/fpo`, FpoController.update);

// REKAM MEDIS
routes.get(`/${baseUrl}/patient`, RekamMedisController.get);
routes.post(`/${baseUrl}/patient`, RekamMedisController.createNew);
routes.post(`/${baseUrl}/record`, RekamMedisController.addRecord);

// SESSION
routes.post(`/${baseUrl}/session`, SessionController.create);
routes.delete(`/${baseUrl}/session`, SessionController.delete);

// ASSESSMENT
routes.post(`/${baseUrl}/assessment`, AssessmentController.insert);
routes.post(`/${baseUrl}/chat/catatan`, AssessmentController.insertCatatanPerawat);
routes.post(`/${baseUrl}/chat/instruksi`, AssessmentController.insertInstruksiMedis);
routes.put(`/${baseUrl}/chat/instruksi`, AssessmentController.updateInstruksiMedis);
routes.put(`/${baseUrl}/chat/catatan`, AssessmentController.updateCatatanPerawat);
routes.post(`/${baseUrl}/tindakan`, AssessmentController.insertTindakan);
routes.get(`/${baseUrl}/item-before`, AssessmentController.getItemBefore);
routes.post(`/${baseUrl}/order-obat`, AssessmentController.pushOrderObat);
routes.get(`/${baseUrl}/chat/instruksi`, SessionController.getInstruksiMedises);
routes.get(`/${baseUrl}/chat/catatan`, SessionController.getCatatanPerawat);

// INFORM CONSENT
routes.get(`/${baseUrl}/inform-consent`, InformConsentController.getAll);
routes.get(`/${baseUrl}/inform-consent/:uuid`, InformConsentController.getDetail);
routes.post(`/${baseUrl}/inform-consent`, InformConsentController.create);
routes.delete(`/${baseUrl}/inform-consent/:uuid`, InformConsentController.delete)

// PELAYANAN
routes.put(`/${baseUrl}/pelayanan/resume`, PelayananController.updateResume);
routes.get(`/${baseUrl}/pelayanan/resume`, PelayananController.getResume);
routes.put(`/${baseUrl}/pelayanan/discharge`, PelayananController.dischargeService);
routes.get(`/${baseUrl}/pelayanan/files`, FileController.getAll);
routes.post(`/${baseUrl}/pelayanan/files`, FileController.upload);
routes.delete(`/${baseUrl}/pelayanan/files`, FileController.delete);
routes.put(`/${baseUrl}/pelayanan/files`, FileController.update);
routes.get(`/${baseUrl}/pelayanan/files/letters`, FileController.getLetters);
routes.get(`/${baseUrl}/pelayanan/files/letter/download`, FileController.downloadLetter);
routes.get(`/${baseUrl}/pelayanan/files/generate-code`, FileController.generateLetterCode);
routes.get(`/${baseUrl}/pelayanan/history`, RekamMedisController.getHistory);
routes.post(`/${baseUrl}/pelayanan/billing-layanan`, PelayananController.createBillingLayanan);
export default routes;