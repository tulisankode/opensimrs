import { Router } from "express";
import OrganizationController from "../controllers/organization-controller.js";
import multer from "multer";

const organizationRouter = Router();
const upload = multer({ dest: "src/uploads/" });

organizationRouter.get("/organization/part-of", OrganizationController.findAllPartOf);
// Organization
organizationRouter.post("/organization", OrganizationController.createOrganization);
organizationRouter.put("/organization/:uuid", OrganizationController.updateOrganization);
organizationRouter.get("/organization", OrganizationController.findAllIncludePartOf);
organizationRouter.get("/organization-include-partof", OrganizationController.findAllIncludePartOf);
organizationRouter.get("/organization/export", OrganizationController.exportOrganization);
organizationRouter.post("/organization/import", upload.single("file"), OrganizationController.importOrganization);
organizationRouter.get("/organization/aktif", OrganizationController.getAllOrganizationAktif);
organizationRouter.get("/organization/:uuid", OrganizationController.getOrganizationById);
organizationRouter.delete("/organization/:uuid", OrganizationController.deleteOrganization);

export default organizationRouter;
