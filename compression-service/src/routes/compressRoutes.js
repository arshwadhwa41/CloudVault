import express from "express";
import multer from "multer";
import { compressFileController } from "../controllers/compressController.js";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/compress", upload.single("file"), compressFileController);

export default router;