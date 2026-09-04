import multer from "multer";

// Disk storage ki jagah Memory Storage use hoga taaki req.file.buffer Cloudinary ko mil sake
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB Limit
  },
});