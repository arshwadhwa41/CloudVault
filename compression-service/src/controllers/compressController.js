import sharp from "sharp";

export const compressFileController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const fileBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;
    let outputBuffer;

    // MIME type check karke dynamic same-format compression
    if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
      outputBuffer = await sharp(fileBuffer).jpeg({ quality: 60, mozjpeg: true }).toBuffer();
    } else if (mimeType === "image/png") {
      outputBuffer = await sharp(fileBuffer).png({ quality: 65, compressionLevel: 8 }).toBuffer();
    } else if (mimeType === "image/webp") {
      outputBuffer = await sharp(fileBuffer).webp({ quality: 60 }).toBuffer();
    } else {
      // Fallback for unsupported images or other formats
      outputBuffer = fileBuffer;
    }

    // Direct buffer response for flexible downstream handling (local download or cloud save)
    res.set("Content-Type", mimeType);
    res.set("Content-Disposition", `attachment; filename="compressed-${req.file.originalname}"`);
    return res.status(200).send(outputBuffer);
  } catch (error) {
    console.error("Compression Error:", error);
    return res.status(500).json({ success: false, message: "Compression failed" });
  }
};