import express from "express";
import multer from "multer";
import StokOpnameController from "../controllers/stok-opname-controller.js";

const stokOpnameRoutes = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } 
});

// Route untuk mendapatkan semua data stok opname
stokOpnameRoutes.get(
    "/", 
    StokOpnameController.getAll
);

// Route untuk membuat stok opname baru
stokOpnameRoutes.post(
    "/", 
    StokOpnameController.create
);

// Route untuk mendapatkan kartu stok (stock card)
stokOpnameRoutes.get(
    "/kartu-stok", 
    StokOpnameController.getStockCard
);

// Route untuk import data kartu stok
stokOpnameRoutes.post(
    "/import",
    (req, res, next) => { next(); },
    upload.single("file"), 
    (req, res, next) => {
        next();
    },
    StokOpnameController.importStockCard 
);

// Route untuk menghapus item-item pada stok opname
stokOpnameRoutes.post(
    "/import",
    (req, res, next) => { 
        console.log(">>> [DEBUG] Tepat sebelum multer.single('file')"); 
        next(); 
    },
    upload.single("file"),
    (req, res, next) => {
        console.log(req.file); // Log seluruh objek file
        console.log(req.body); // Log seluruh body
        next();
    },
    StokOpnameController.importStockCard 
);

// Route untuk mendapatkan detail stok opname berdasarkan UUID
stokOpnameRoutes.get(
    "/:stok_opname_uuid", 
    StokOpnameController.getDetail
);

export default stokOpnameRoutes;