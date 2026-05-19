const multer = require('multer');
const path = require('path');

// Setup storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './upload'); // Set the destination for file uploads
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Set a custom filename with timestamp
  }
  // filename: (req, file, cb) => {
  //   cb(null, file.originalname); // Keep the original file name
  // }
});

// File filter to only allow certain types of files
const fileFilterOLD = (req, file, cb) => {
  const allowedFileTypes = /doc|docx|pdf|xls|xlsx|csv|png|jpeg|jpg|zip|txt|mp4|avi|mov/; 
  // const allowedFileTypes = /^(image\/|video\/)(jpeg|jpg|png|mp4|avi|mov)$/;
  const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true); // Accept the file
  } else {
    cb(new Error('Error: Only specific file types are allowed!')); // Reject the file if it's not an allowed type
  }
};

// const path = require("path");

const fileFilter = (req, file, cb) => {
  // Allowed file extensions
  const allowedExtensions = [".doc", ".docx", ".pdf", ".xls", ".xlsx", ".csv", ".png", ".jpeg", ".jpg", ".zip", ".txt", ".mp4", ".avi", ".mov"];

  // Allowed MIME types
  const allowedMimeTypes = [
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/pdf", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", "image/png", "image/jpeg", "image/jpg", "application/zip", "text/plain", "video/mp4", "video/x-msvideo", "video/quicktime", "application/octet-stream" // <- Allow if extension is correct
  ];

  // Extract file extension and MIME type
  const fileExt = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;

  // Debugging Logs
  // console.log("📂 File Name:", file.originalname);
  // console.log("🔍 File Extension:", fileExt);
  // console.log("📑 MIME Type:", mimeType);

  // ✅ Allow application/octet-stream only if extension is correct
  if (allowedExtensions.includes(fileExt) && (allowedMimeTypes.includes(mimeType) || mimeType === "application/octet-stream")) {
      console.log("✅ File Accepted!");
      cb(null, true); // Accept the file
  } else {
      console.error("❌ Rejected File - Invalid Type!");
      cb(new Error("❌ Error: Only specific file types are allowed!"), false);
  }
};

// Initialize multer with storage, limits, and file filter
const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 2 * 1024 * 1024 // Limit file size to 2MB
  },
  fileFilter: fileFilter
})
module.exports = upload;

