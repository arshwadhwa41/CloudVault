import { v2 as cloudinary } from "cloudinary";
import env from "../config/env.js"; // Direct env config import

// Cloudinary initialization check
cloudinary.config({
  cloud_name: env.cloudinary.cloudName || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: env.cloudinary.apiKey || process.env.CLOUDINARY_API_KEY,
  api_secret: env.cloudinary.apiSecret || process.env.CLOUDINARY_API_SECRET,
});

// 1. Upload Stream Function
export const uploadBufferToCloudinary = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      return reject(new Error("File buffer is empty or missing (0 bytes)"));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    uploadStream.end(fileBuffer);
  });
};

// 2. Delete Asset Function (Syntax Error Fix)
export const deleteCloudinaryAsset = async (publicId, resourceType = "image") => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return result;
  } catch (error) {
    throw error;
  }
};