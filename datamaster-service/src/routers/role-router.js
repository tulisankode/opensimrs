import { Router } from "express";
import multer from "multer";
import RoleController from "../controllers/role-controller.js";

const roleRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Role
roleRouter.post("/role", RoleController.createRole);
roleRouter.put("/role/:uuid", RoleController.updateRole);
roleRouter.get("/role", RoleController.getAllRole);
roleRouter.get("/role/export", RoleController.exportRole);
roleRouter.post(
  "/role/import",
  upload.single("file"),
  RoleController.importRole
);
roleRouter.get("/role/aktif", RoleController.getAllRoleAktif);
roleRouter.get("/role/:uuid", RoleController.getRoleById);
roleRouter.delete("/role/:uuid", RoleController.deleteRole);

export default roleRouter;
