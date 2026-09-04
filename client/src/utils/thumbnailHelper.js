// PDF aur Video ke thumbnails generate karne ke liye helper functions
export function getFileThumbnail(file) {
  if (!file || !file.fileUrl) return "";

  const url = file.fileUrl;

  // 1. Image Thumbnail
  if (file.mimeType?.startsWith("image/")) {
    return url;
  }

  // 2. Video Animated GIF Preview
  if (file.mimeType?.startsWith("video/")) {
    // Cloudinary URL structure ko .mp4 se .gif transformation mein map karte hain
    return url
      .replace("/upload/", "/upload/so_0,du_3,w_300,h_200,c_fill,fl_animated/")
      .replace(/\.[^/.]+$/, ".gif");
  }

  // 3. PDF First Page Image Preview
  if (file.mimeType === "application/pdf") {
    // PDF page 1 ko JPG image preview mein transform karte hain
    return url
      .replace("/upload/", "/upload/pg_1,w_300,h_200,c_fill/")
      .replace(/\.[^/.]+$/, ".jpg");
  }

  return "";
}