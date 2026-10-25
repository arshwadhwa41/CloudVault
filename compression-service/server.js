import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import sharp from "sharp"; // Images ke liye (JPG, PNG, GIF, WebP)
import { PDFDocument } from "pdf-lib"; // PDF ke liye
import zlib from "zlib"; // Plain text ke liye (built-in module)
import ffmpeg from "fluent-ffmpeg"; // Videos ke liye (MP4, MOV, AVI)
import ffmpegStatic from "ffmpeg-static"; // Pre-built FFmpeg binary
import fs from "fs";
import os from "os";
import { buffer } from "stream/consumers";

// FFmpeg binary path set karo
ffmpeg.setFfmpegPath(ffmpegStatic);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(express.json());

// Memory storage setup for image compression
const upload = multer({ storage: multer.memoryStorage() });

// 1. Serve Static Assets (React client/dist)
app.use(express.static(path.join(__dirname, "client", "dist")));

// 2. Health Check API Route
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Compression Service Active" });
});

// 3. Main Image Compression API Route 

// -------------------------------------------------------------
// LOGIC BEHIND COMPRESSION OF FILES
// -------------------------------------------------------------
app.post("/api/micro/compress", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Mimetype ya extension ke basis par detect karo
    let mimeType = req.file.mimetype;
    const fileName = req.file.originalname || "";

    if (fileName.endsWith(".pdf")) mimeType = "application/pdf";

    const buffer = req.file.buffer;

    // -------------------------------------------------------------
    // 1. IMAGES (JPEG, PNG, GIF, WEBP)
    // -------------------------------------------------------------
    if (mimeType.startsWith("image/")) {
      let compressedBuffer;

      if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
        compressedBuffer = await sharp(buffer).jpeg({ quality: 50 }).toBuffer();
      } else if (mimeType === "image/png") {
        compressedBuffer = await sharp(buffer).png({ quality: 50, compressionLevel: 9 }).toBuffer();
      } else if (mimeType === "image/webp") {
        compressedBuffer = await sharp(buffer).webp({ quality: 50 }).toBuffer();
      } else if (mimeType === "image/gif") {
        compressedBuffer = await sharp(buffer, { animated: true }).gif({ colours: 96 }).toBuffer();
      } else {
        compressedBuffer = await sharp(buffer).jpeg({ quality: 50 }).toBuffer();
      }

      res.set("Content-Type", mimeType);
      return res.send(compressedBuffer);
    }

    // -------------------------------------------------------------
    // 2. PDF DOCUMENTS (application/pdf)
    // -------------------------------------------------------------
    else if (mimeType === "application/pdf" || mimeType === "application/x-pdf" || fileName.endsWith(".pdf")) {
      try {
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        
        // Remove unneeded metadata streams and compress PDF objects
        const compressedPdfBytes = await pdfDoc.save({
          useObjectStreams: true,
          addDefaultPage: false,
        });

        res.set("Content-Type", "application/pdf");
        return res.send(Buffer.from(compressedPdfBytes));
      } catch (pdfErr) {
        console.error("PDF Parse Error:", pdfErr);
        // Fallback: Return original buffer if PDF structure is strict
        res.set("Content-Type", "application/pdf");
        return res.send(buffer);
      }
    }

    // -------------------------------------------------------------
    // 3. PLAIN TEXT (text/plain)
    // -------------------------------------------------------------
    else if (mimeType === "text/plain" || fileName.endsWith(".txt")) {
      const compressedText = zlib.gzipSync(buffer);

      res.set("Content-Type", "text/plain");
      res.set("Content-Encoding", "gzip");
      return res.send(compressedText);
    }

    // -------------------------------------------------------------
    // 4. HEAVY VIDEO COMPRESSION (MP4, MOV, AVI)
    // -------------------------------------------------------------
    else if (
      mimeType.startsWith("video/") ||
      fileName.match(/\.(mp4|mov|avi|mkv)$/i)
    ) {
      const tempInputPath = path.join(os.tmpdir(), `input_${Date.now()}.mp4`);
      const tempOutputPath = path.join(os.tmpdir(), `output_${Date.now()}.mp4`);

      fs.writeFileSync(tempInputPath, buffer);

      ffmpeg(tempInputPath)
        .outputOptions([
          "-vcodec libx264",
          "-crf 32", // Higher CRF = significant file size reduction (28 -> 32)
          "-preset faster",
          "-vf scale=-2:720", // Automatically scale video height to 720p HD (major size saver)
          "-acodec aac",
          "-b:a 96k" // Lower audio bitrate to save extra MBs
        ])
        .save(tempOutputPath)
        .on("end", () => {
          const compressedVideoBuffer = fs.readFileSync(tempOutputPath);

          if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
          if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);

          res.set("Content-Type", "video/mp4");
          return res.send(compressedVideoBuffer);
        })
        .on("error", (err) => {
          console.error("FFmpeg Video Compression Error:", err);
          if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
          if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
          return res.status(500).json({ error: "Video compression failed" });
        });
    }

    else {
      return res.status(400).json({ error: `Unsupported file format: ${mimeType}` });
    }

  } catch (error) {
    console.error("Server Compression Error:", error);
    return res.status(500).json({ error: "File compression failed on server." });
  }
});

// 4. Express 5 Safe Catch-All Fallback Route
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(__dirname, "client", "dist", "index.html"));
});

// Start Microservice
app.listen(PORT, () => {
  console.log(`Compression Microservice running on port ${PORT}`);
});