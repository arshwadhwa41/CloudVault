// Mongoose import kar rahe hain.
import mongoose from "mongoose";
import { uploadBufferToCloudinary } from "../services/cloudinaryService.js";
// Digital asset ka database structure define kar rahe hain.
const fileSchema = new mongoose.Schema(
  {
    // User ne jo original filename select kiya tha.
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },

    // File kis storage provider par save hui hai.
    storageProvider: {
      type: String,
      required: true,
      enum: ["cloudinary"],
      default: "cloudinary",
    },

    // Cloudinary ka unique public ID.
    storageKey: {
      type: String,
      required: true,
      unique: true,
    },

    // Cloudinary se mila secure delivery URL.
    fileUrl: {
      type: String,
      required: true,
    },

    // Cloudinary resource type image, video ya raw ho sakta hai.
    resourceType: {
      type: String,
      required: true,
      default: "image",
    },

    // File ka size bytes mein.
    size: {
      type: Number,
      required: true,
      min: 1,
    },

    // File ka MIME type, jaise image/png ya application/pdf.
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },

    // File ka owner User model se connect kar rahe hain.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Upload complete hone ka time.
    uploadDate: {
      type: Date,
      default: Date.now,
    },
    
    //Tags for vision key
    tags:{
      type:[String],
      default:[]
    },
  },
  {
    // createdAt aur updatedAt automatically add honge.
    timestamps: true,
  }
);


// File model create kar rahe hain.
const File = mongoose.model("File", fileSchema);

// MongoDB mein purana leftover index 's3Key_1' automatically drop karne ke liye:
File.on("index", () => {
  File.collection.dropIndex("s3Key_1").catch(() => {
    // Agar index pehle se hi dropped hai ya nahi mila, toh silent ignore karega
  });
});

export default File;