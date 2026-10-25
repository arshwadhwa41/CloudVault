import { v2 as cloudinary } from "cloudinary";
import env from "../config/env.js";

// ============================================================
// CLOUDINARY CONFIG
// ============================================================

cloudinary.config({
  cloud_name:
    env.cloudinary?.cloudName ||
    process.env.CLOUDINARY_CLOUD_NAME,

  api_key:
    env.cloudinary?.apiKey ||
    process.env.CLOUDINARY_API_KEY,

  api_secret:
    env.cloudinary?.apiSecret ||
    process.env.CLOUDINARY_API_SECRET,
});

// ============================================================
// BUILD SAFE CLOUDINARY UPLOAD OPTIONS
// ============================================================

const buildUploadOptions = (options = {}) => {
  const uploadOptions = { ...options };

  const resourceType = uploadOptions.resource_type || "auto";

  /*
   * RAW files:
   * PDF, TXT, DOC, DOCX, ZIP, etc.
   *
   * In RAW uploads, image transformations such as:
   * width, height, crop, quality, format, etc.
   * must not be sent.
   */

  if (resourceType === "raw") {
    delete uploadOptions.transformation;
    delete uploadOptions.width;
    delete uploadOptions.height;
    delete uploadOptions.crop;
    delete uploadOptions.gravity;
    delete uploadOptions.quality;
    delete uploadOptions.fetch_format;
    delete uploadOptions.format;
    delete uploadOptions.effect;
    delete uploadOptions.radius;
    delete uploadOptions.background;
    delete uploadOptions.border;
    delete uploadOptions.dpr;
    delete uploadOptions.angle;
    delete uploadOptions.zoom;

    // Force RAW resource type.
    uploadOptions.resource_type = "raw";
  }

  return uploadOptions;
};

// ============================================================
// 1. UPLOAD BUFFER TO CLOUDINARY
// ============================================================

export const uploadBufferToCloudinary = (
  fileBuffer,
  options = {}
) => {
  return new Promise((resolve, reject) => {
    // Validate buffer
    if (
      !fileBuffer ||
      !Buffer.isBuffer(fileBuffer) ||
      fileBuffer.length === 0
    ) {
      return reject(
        new Error("File buffer is empty or missing (0 bytes)")
      );
    }

    // Prepare safe Cloudinary options
    const uploadOptions = buildUploadOptions(options);

    console.log(
      "Cloudinary Upload:",
      {
        resource_type: uploadOptions.resource_type,
        public_id: uploadOptions.public_id,
        folder: uploadOptions.folder,
      }
    );

    // Create upload stream
    const uploadStream =
      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error(
              "Cloudinary Upload Error:",
              error
            );

            return reject(error);
          }

          resolve(result);
        }
      );

    // Stream-level error handling
    uploadStream.on("error", (error) => {
      console.error(
        "Cloudinary Upload Stream Error:",
        error
      );

      reject(error);
    });

    // Send buffer
    uploadStream.end(fileBuffer);
  });
};

// ============================================================
// 2. DELETE CLOUDINARY ASSET
// ============================================================

export const deleteCloudinaryAsset = async (
  publicId,
  resourceType = "image"
) => {
  try {
    if (!publicId) {
      throw new Error(
        "Cloudinary publicId is required"
      );
    }

    const result =
      await cloudinary.uploader.destroy(
        publicId,
        {
          resource_type: resourceType,
        }
      );

    return result;
  } catch (error) {
    console.error(
      "Cloudinary Delete Error:",
      error
    );

    throw error;
  }
};