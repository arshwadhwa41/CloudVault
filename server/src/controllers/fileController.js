// File aur User model import kar rahe hain

import File from "../models/File.js";

import User from "../models/User.js";

// Cloudinary services import kar rahe hain

import { uploadBufferToCloudinary } from "../services/cloudinaryService.js";

import { deleteCloudinaryAsset } from "../services/cloudinaryService.js";

// Gemini AI image auto-tagging helper import kar rahe hain

import { generateImageTags } from "../utils/geminiHelper.js";


// =============================================================
// Helper: Search text ko safe regular expression mein convert
// karne ke liye
// =============================================================
//
// User search box mein agar special regex characters enter kare,
// to MongoDB regex error ya unexpected matching na kare.
//
// Example:
// search = "car."
//
// Is helper ke baad:
// car\.
//
// ban jayega.
//
function escapeRegex(value) {

  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

}


// =============================================================
// Helper: Cloudinary URL ko inline view format mein convert
// karne ke liye
// =============================================================
//
// PDF files ko browser mein directly view karne ke liye
// Cloudinary ka fl_inline flag add karte hain.
//
// Isse PDF unnecessary auto-download hone se bachti hai.
//
function formatViewerUrl(url, mimeType) {

  if (!url) return url;

  if (
    mimeType === "application/pdf" ||
    mimeType === "application/x-pdf"
  ) {

    return url.includes("/upload/fl_inline/")
      ? url
      : url.replace("/upload/", "/upload/fl_inline/");

  }

  return url;

}


// =============================================================
// Allowed MIME types ki expanded list
// =============================================================
//
// Images + PDFs + text + videos ko allow kar rahe hain.
//
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


// =============================================================
// Helper: Filename se extension nikalne ke liye
// =============================================================

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


    // Pagination ke liye current page calculate kar rahe hain

    const currentPage = Math.max(Number(page) || 1, 1);


    // Ek request mein maximum 100 files allow kar rahe hain

    const filesPerPage = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );


    // =========================================================
    // Logged-in user ki files hi fetch hongi
    // =========================================================
    //
    // Tumhare schema mein user field nahi hai.
    // Tumhare existing schema ke according owner use ho raha hai.
    //
    const filter = {

      owner: request.userId,

    };


    // =========================================================
    // 3.4 SEARCH UPDATE
    // =========================================================
    //
    // Pehle search sirf original filename par hota tha.
    //
    // Ab search:
    //
    // 1. originalName
    // 2. tags
    //
    // dono mein hoga.
    //
    // Example:
    //
    // File name:
    // "my-car.jpg"
    //
    // Gemini tags:
    // ["red car", "honda", "sedan", "parking lot"]
    //
    // User search kare:
    //
    // "honda"
    //
    // To ye image filename match na hone ke bawajood
    // tags ke through mil jayegi.
    //
    if (typeof search === "string" && search.trim()) {

      // User ke search text ko trim karke safe regex bana rahe hain

      const searchRegex = new RegExp(
        escapeRegex(search.trim()),
        "i"
      );


      // Filename OR AI tags mein search hoga

      filter.$or = [

        {
          originalName: {
            $regex: searchRegex,
          },
        },

        {
          tags: {
            $in: [searchRegex],
          },
        },

      ];

    }


    // =========================================================
    // MIME Type Filter
    // =========================================================

    if (typeof mimeType === "string" && mimeType.trim()) {

      filter.mimeType = mimeType.trim();

    }


    // =========================================================
    // Sorting Options
    // =========================================================

    const sortOptions = {

      newest: {
        createdAt: -1,
      },

      oldest: {
        createdAt: 1,
      },

      largest: {
        size: -1,
      },

      smallest: {
        size: 1,
      },

      name: {
        originalName: 1,
      },

    };


    // Agar invalid sort aaye to newest default rahega

    const selectedSort =
      sortOptions[sort] || sortOptions.newest;


    // =========================================================
    // Pagination Skip Calculate
    // =========================================================

    const skip = (currentPage - 1) * filesPerPage;


    // =========================================================
    // Total matching files count
    // =========================================================

    const totalFiles = await File.countDocuments(filter);


    // =========================================================
    // Files database se fetch karna
    // =========================================================

    const files = await File.find(filter)

      .sort(selectedSort)

      .skip(skip)

      .limit(filesPerPage)

      .select("-__v")

      .lean();


    // =========================================================
    // PDF files ke liye fileUrl modify kar rahe hain
    // taaki browser mein auto-download na ho
    // =========================================================

    const formattedFiles = files.map((file) => ({

      ...file,

      fileUrl: formatViewerUrl(
        file.fileUrl,
        file.mimeType
      ),

    }));


    // =========================================================
    // Response
    // =========================================================

    return response.status(200).json({

      success: true,

      data: {

        files: formattedFiles,

        pagination: {

          page: currentPage,

          limit: filesPerPage,

          total: totalFiles,

          totalPages: Math.ceil(
            totalFiles / filesPerPage
          ),

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

    // =========================================================
    // 1. Authenticated User Check
    // =========================================================
    //
    // Middleware se req.userId ya req.user._id lene ki
    // koshish kar rahe hain.
    //
    const userId = req.userId || req.user?._id;


    if (!userId) {

      return res.status(401).json({

        success: false,

        message: "Unauthorized: User identification missing",

      });

    }


    // =========================================================
    // 2. File and Buffer Check
    // =========================================================

    if (
      !req.file ||
      !req.file.buffer ||
      req.file.size === 0
    ) {

      return res.status(400).json({

        success: false,

        message: "No valid file or non-zero buffer provided",

      });

    }


    // =========================================================
    // 3. AI Auto Tagging
    // =========================================================
    //
    // Sirf images ke liye Gemini Vision call hoga.
    //
    // PDF, video, text etc. ke liye Gemini image tagging
    // call nahi hoga.
    //
    // IMPORTANT:
    // Multer mein property "mimetype" hoti hai,
    // "mimeType" nahi.
    //
    let aiTags = [];


    if (req.file.mimetype?.startsWith("image/")) {

      aiTags = await generateImageTags(

        req.file.buffer,

        req.file.mimetype

      );

    }


    // =========================================================
    // 4. Upload Buffer to Cloudinary
    // =========================================================
    //
    // Tumhara existing Cloudinary upload code same rakha hai.
    //
    const cloudinaryResult =
      await uploadBufferToCloudinary(
        req.file.buffer,
        {

          folder: "cloud_vault",

          resource_type: "auto",

          // Automatically detects:
          // image
          // video
          // raw document

        }
      );


    // =========================================================
    // 5. Create MongoDB Document
    // =========================================================
    //
    // Tumhare existing schema ke field names ko exactly
    // preserve kiya gaya hai.
    //
    // Sirf "tags: aiTags" new AI field hai.
    //
    const newFile = await File.create({

      originalName: req.file.originalname,

      storageProvider: "cloudinary",

      storageKey: cloudinaryResult.public_id,

      fileUrl: cloudinaryResult.secure_url,

      resourceType:
        cloudinaryResult.resource_type || "image",

      size: req.file.size,

      mimeType: req.file.mimetype,

      owner: userId,

      // Gemini Vision se generate hue tags
      // MongoDB mein save honge.
      //
      // Example:
      //
      // [
      //   "red car",
      //   "honda",
      //   "sedan",
      //   "parking lot"
      // ]
      //
      tags: aiTags,

    });


    // =========================================================
    // 6. Successful Upload Response
    // =========================================================

    return res.status(201).json({

      success: true,

      message: "File uploaded successfully",

      file: newFile,

    });

  } catch (error) {

    // =========================================================
    // Error Handling
    // =========================================================

    console.error(
      "Upload Error Details:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        error.message ||
        "File upload failed",

    });

  }

};


// -------------------------------------------------------------
// 3. File Delete Controller (Cloudinary + DB Cleanup)
// -------------------------------------------------------------

export async function deleteFile(req, res, next) {

  try {

    const { id } = req.params;


    // =========================================================
    // Check karo file exist karti hai aur logged-in user
    // ki hi hai
    // =========================================================

    const file = await File.findOne({

      _id: id,

      owner: req.userId,

    });


    if (!file) {

      return res.status(404).json({

        success: false,

        message: "File not found",

        errorCode: "FILE_NOT_FOUND",

      });

    }


    // =========================================================
    // Cloudinary se delete karo
    // =========================================================

    await deleteCloudinaryAsset(

      file.storageKey,

      file.resourceType || "raw"

    );


    // =========================================================
    // Database se delete karo
    // =========================================================

    await File.findByIdAndDelete(
      file._id
    );


    // =========================================================
    // User ka storageUsed kam karo
    // =========================================================

    await User.findByIdAndUpdate(

      req.userId,

      {

        $inc: {
          storageUsed: -file.size,
        },

      }

    );


    // =========================================================
    // Successful Delete Response
    // =========================================================

    return res.status(200).json({

      success: true,

      message: "File deleted successfully",

    });

  } catch (error) {

    next(error);

  }

}