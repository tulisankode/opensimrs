import multer from "multer";
import BadRequestException from "../exception/bad-request-exception.js";

const MAX_UPLOAD_BERKAS_RUJUKAN_MB = process.env.MAX_UPLOAD_BERKAS_RUJUKAN_MB || 5;

const uploadBerkasRujukan = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BERKAS_RUJUKAN_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          "Type file tidak valid, hanya PDF/JPG/PNG yang diperbolehkan"
        ),
        false
      );
    }
  },
});

export default uploadBerkasRujukan;
