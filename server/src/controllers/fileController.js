// File aur User model import kar rahe hain
import File from "../models/File.js";
import User from "../models/User.js";

// Cloudinary services import kar rahe hain
import { uploadBufferToCloudinary } from "../services/cloudinaryService.js";
import { deleteCloudinaryAsset } from "../services/cloudinaryService.js";

// Helper: Search text ko safe regular expression mein convert karne ke liye
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Helper: Cloudinary URL ko inline view format mein convert karne ke liye (Auto-download rokne ke liye)
function formatViewerUrl(url, mimeType) {
  if (!url) return url;
  if (mimeType === "application/pdf" || mimeType === "application/x-pdf") {
    return url.includes("/upload/fl_inline/")
      ? url
      : url.replace("/upload/", "/upload/fl_inline/");
  }
  return url;
}

// Allowed MIME types ki expanded list (Safe for PDFs & Videos)
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/x-pdf",
  "text/plain",
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
]);

// Helper: Filename se extension nikalne ke liye
function getFileExtension(filename = "") {
  const extension = filename.split(".").pop();
  return extension ? extension.toLowerCase() : "";
}

// -------------------------------------------------------------
// 1. Logged-in user ki files list karne ka controller
// -------------------------------------------------------------
export async function listFiles(request, response, next) {
  try {
    const {
      search = "",
      mimeType = "",
      sort = "newest",
      page = "1",
      limit = "20",
    } = request.query;

    const currentPage = Math.max(Number(page) || 1, 1);
    const filesPerPage = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const filter = {
      owner: request.userId,
    };

    if (typeof search === "string" && search.trim()) {
      filter.originalName = {
        $regex: escapeRegex(search.trim()),
        $options: "i",
      };
    }

    if (typeof mimeType === "string" && mimeType.trim()) {
      filter.mimeType = mimeType.trim();
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      largest: { size: -1 },
      smallest: { size: 1 },
      name: { originalName: 1 },
    };

    const selectedSort = sortOptions[sort] || sortOptions.newest;
    const skip = (currentPage - 1) * filesPerPage;

    const totalFiles = await File.countDocuments(filter);
    const files = await File.find(filter)
      .sort(selectedSort)
      .skip(skip)
      .limit(filesPerPage)
      .select("-__v")
      .lean();

    // PDF files ke liye fileUrl modify kar rahe hain taaki auto-download na ho
    const formattedFiles = files.map((file) => ({
      ...file,
      fileUrl: formatViewerUrl(file.fileUrl, file.mimeType),
    }));

    return response.status(200).json({
      success: true,
      data: {
        files: formattedFiles,
        pagination: {
          page: currentPage,
          limit: filesPerPage,
          total: totalFiles,
          totalPages: Math.ceil(totalFiles / filesPerPage),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------------
// 2. File Upload Controller (Cloudinary Integration)
// -------------------------------------------------------------
export const uploadFile = async (req, res) => {
  try {
    // 1. Authenticated User Check (middleware se req.userId ya req.user._id)
    const userId = req.userId || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User identification missing",
      });
    }

    // 2. File and Buffer Check
    if (!req.file || !req.file.buffer || req.file.size === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid file or non-zero buffer provided",
      });
    }

    // 3. Upload Buffer to Cloudinary
    const cloudinaryResult = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "cloud_vault",
      resource_type: "auto", // Automatically detects image, video, raw document
    });

    // 4. Create MongoDB Document exact Schema schema key mapping ke sath
    const newFile = await File.create({
      originalName: req.file.originalname,
      storageProvider: "cloudinary",
      storageKey: cloudinaryResult.public_id, // Schema Required Field
      fileUrl: cloudinaryResult.secure_url,
      resourceType: cloudinaryResult.resource_type || "image", // Schema Required (default image)
      size: req.file.size,
      mimeType: req.file.mimetype,
      owner: userId, // Schema Required Field
    });

    return res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      file: newFile,
    });
  } catch (error) {
    console.error("Upload Error Details:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "File upload failed",
    });
  }
};
// -------------------------------------------------------------
// 3. File Delete Controller (Cloudinary + DB Cleanup)
// -------------------------------------------------------------
export async function deleteFile(req, res, next) {
  try {
    const { id } = req.params;

    // Check karo file exist karti hai aur logged-in user ki hi hai
    const file = await File.findOne({ _id: id, owner: req.userId });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
        errorCode: "FILE_NOT_FOUND",
      });
    }

    // Cloudinary se delete karo
    await deleteCloudinaryAsset(file.storageKey, file.resourceType || "raw");

    // Database se delete karo
    await File.findByIdAndDelete(file._id);

    // User ka storageUsed kam karo
    await User.findByIdAndUpdate(req.userId, {
      $inc: { storageUsed: -file.size },
    });

    return res.status(200).json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}
