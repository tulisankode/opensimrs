import express from 'express';
import UserController from "../controllers/user-controller.js"
import multer from 'multer';

const userRouter = express.Router();
const upload = multer({ dest: "src/uploads/" });
userRouter.post(`/user`, UserController.create);
userRouter.put(`/user/:uuid`, UserController.update);
userRouter.get(`/user`, UserController.findAll);
userRouter.get(`/user/deleted`, UserController.findAllDeleted);
userRouter.delete(`/user/:uuid`, UserController.delete);
userRouter.patch(`/user/:uuid`, UserController.updatePassword);
userRouter.post(`/user/import`,upload.single("file"), UserController.import);
userRouter.get(`/user/:uuid`, UserController.findByUuidIncludeRole);
userRouter.get(`/user/-/export`, UserController.export);

export default userRouter;