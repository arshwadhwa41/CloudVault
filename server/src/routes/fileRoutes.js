import express from "express";
import { uploadFile, listFiles, deleteFile } from "../controllers/fileController.js";
import { requireAuthentication } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/uploadMiddleware.js";

const fileRouter = express.Router();

// 1. Upload Route with Multer Error Handling Wrapper
fileRouter.post(
  "/upload",
  requireAuthentication,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("Multer Upload Error:", err.message);
        return res.status(400).json({
          success: false,
          message: `File upload error: ${err.message}`,
        });
      }
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file was attached under field name 'file'.",
        });
      }
      next();
    });
  },
  uploadFile
);

// 2. List Files Route
fileRouter.get("/", requireAuthentication, listFiles);

// 3. Delete File Route
fileRouter.delete("/:id", requireAuthentication, deleteFile);

export default fileRouter;