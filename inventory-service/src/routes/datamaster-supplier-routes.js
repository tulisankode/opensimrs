import express from "express";
import multer from "multer";
import DatamasterSupplierController from "../controllers/datamaster-supplier-controller.js";

const supplierRoutes = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } 
});

// Route untuk mendapatkan semua supplier aktif
supplierRoutes.get(
    "/aktif",
    DatamasterSupplierController.getAllWithoutPagination
);

// Route untuk mendapatkan detail supplier berdasarkan UUID
supplierRoutes.get(
    "/:uuid",
    DatamasterSupplierController.getByUuid
);

// Route untuk mendapatkan semua supplier (dengan pagination)
supplierRoutes.get(
    "/",
    DatamasterSupplierController.getAll
);

// Route untuk menambahkan supplier baru
supplierRoutes.post(
    "/",
    DatamasterSupplierController.create
);

// Route untuk memperbarui data supplier berdasarkan UUID
supplierRoutes.put(
    "/:uuid",
    DatamasterSupplierController.update
);

// Route untuk menghapus supplier berdasarkan UUID
supplierRoutes.delete(
    "/:uuid",
    DatamasterSupplierController.delete
);

supplierRoutes.post(
    "/import",
    upload.single("supplierFile"),
    (req, res, next) => {
        console.log("--- In Route - After Multer Middleware ---");
        console.log("req.file:", req.file); // Apakah file ada di sini?
        console.log("req.body:", req.body); // Apakah field teks ada di sini?
        next(); 
    },
    DatamasterSupplierController.importSuppliers
);

export default supplierRoutes;