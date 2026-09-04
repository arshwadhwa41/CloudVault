import express from "express";
import { uploadFile, listFiles, deleteFile } from "../controllers/fileController.js";
import { requireAuthentication } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/uploadMiddleware.js";

const fileRouter = express.Router();

fileRouter.post("/upload", requireAuthentication, upload.single("file"), uploadFile);
fileRouter.get("/", requireAuthentication, listFiles);
fileRouter.delete("/:id", requireAuthentication, deleteFile);

export default fileRouter;