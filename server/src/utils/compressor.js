import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import zlib from 'zlib';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';

// FFmpeg Path Configuration
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Video Compression Helper (Temp file based processing)
 */
const compressVideo = (fileBuffer, targetCRF = 28) => {
  return new Promise((resolve, reject) => {
    // Temporary files created for FFmpeg processing
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `input_${Date.now()}.mp4`);
    const outputPath = path.join(tempDir, `output_${Date.now()}.mp4`);

    // Write input buffer to temporary file
    fs.writeFileSync(inputPath, fileBuffer);

    ffmpeg(inputPath)
      .outputOptions([
        '-vcodec libx264',   // Standard H.264 video codec
        `-crf ${targetCRF}`,  // Constant Rate Factor (28 = good compression, smaller size)
        '-preset fast',      // Compression speed vs efficiency balance
        '-acodec aac',       // Audio codec AAC
      ])
      .toFormat('mp4')
      .on('end', () => {
        try {
          const compressedBuffer = fs.readFileSync(outputPath);
          // Cleanup temporary files
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          resolve(compressedBuffer);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', (err) => {
        // Cleanup temporary files on error
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        reject(err);
      })
      .save(outputPath);
  });
};

/**
 * Main Compression Function supporting All Configured MimeTypes
 */
export const compressFileByMime = async (fileBuffer, mimeType, quality = 60) => {
  try {
    // 1. IMAGES (JPEG, PNG, GIF, WEBP)
    if (mimeType.startsWith('image/')) {
      let sharpInstance = sharp(fileBuffer);

      if (mimeType === 'image/jpeg') {
        return await sharpInstance.jpeg({ quality, mozjpeg: true }).toBuffer();
      } else if (mimeType === 'image/png') {
        return await sharpInstance.png({ quality, compressionLevel: 8 }).toBuffer();
      } else if (mimeType === 'image/webp') {
        return await sharpInstance.webp({ quality }).toBuffer();
      } else if (mimeType === 'image/gif') {
        return await sharpInstance.gif().toBuffer();
      }
    }

    // 2. PDF DOCUMENTS
    if (mimeType === 'application/pdf' || mimeType === 'application/x-pdf') {
      const pdfDoc = await PDFDocument.load(fileBuffer);
      const compressedPdfBytes = await pdfDoc.save({ useObjectStreams: true });
      return Buffer.from(compressedPdfBytes);
    }

    // 3. PLAIN TEXT
    if (mimeType === 'text/plain') {
      return zlib.gzipSync(fileBuffer);
    }

    // 4. VIDEOS (MP4, QuickTime/MOV, AVI)
    if (mimeType.startsWith('video/')) {
      console.log(`Compressing video (${mimeType})...`);
      // Quality scale (60 -> CRF 28, lower quality slider means higher CRF compression)
      const crfValue = Math.round(18 + ((100 - quality) / 100) * 15); // Scale between CRF 18 to 33
      return await compressVideo(fileBuffer, crfValue);
    }

    return fileBuffer;
  } catch (error) {
    console.error(`Compression failed for ${mimeType}:`, error.message);
    return fileBuffer; // Fallback to original buffer if error occurs
  }
};