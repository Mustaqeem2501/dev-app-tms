// const multer = require('multer');
// const path = require('path');

// // Setup storage engine
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, './upload'); // Set the destination for file uploads
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + path.extname(file.originalname)); // Set a custom filename with timestamp
//   }
// });

// // File filter to only allow certain types of files
// const fileFilter = (req, file, cb) => {
//   const allowedFileTypes = /doc|docx|pdf|xls|xlsx|csv|png|jpeg|jpg|zip|txt|mp4|avi|mov/; 
//   // const allowedFileTypes = /^(image\/|video\/)(jpeg|jpg|png|mp4|avi|mov)$/;
//   const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
//   const mimetype = allowedFileTypes.test(file.mimetype);

//   if (extname && mimetype) {
//     cb(null, true); // Accept the file
//   } else {
//     cb(new Error('Error: Only specific file types are allowed!')); // Reject the file if it's not an allowed type
//   }
// };

// // Initialize multer with storage, limits, and file filter
// const upload = multer({
//   storage: storage,
//   limits: { 
//     fileSize: 2 * 1024 * 1024 // Limit file size to 2MB
//   },
//   fileFilter: fileFilter
// })
// module.exports = upload;


//File created by Pritanshu on 2024-10-09

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadDocumentFunction = require('../../helpers/uploadDocumentFunction');

// Multer setup for file upload
const storage = multer.diskStorage
    ({
        destination: function(req, file, cb)
        {
            const uploadDir = `documentUploads/${uploadDocumentFunction.generateFinalRandomNumber()}`;
            // Check if upload directory exists, if not, create it
            try
            {
                fs.mkdirSync(uploadDir, { recursive: true, mode: 0o777 });
                cb(null, uploadDir);
            }
            catch(err)
            {
                cb(err); // Handle potential errors during directory creation
            }
        },
        filename: function(req, file, cb) 
        {
            // Generate a unique filename
            const fileName = path.basename(file.originalname).trim();
            const uniqueFileName = `${uploadDocumentFunction.generateFinalRandomNumber()}_${fileName}`;
            cb(null, uniqueFileName);
        },
    });

// Create the Multer instance with the storage configuration
const upload = multer({ storage: storage,
                        limits: { fileSize: 5 * 1024 * 1024 }, // Set a maximum file size to 5MB
                        fileFilter: (req, file, cb) => 
                        {
                            const allowedExtensions = /\.(jpeg|jpg|png|gif|pdf|xls|xlsx)$/i; // Regex for file extensions
                            const allowedMimeTypes = [
                                "image/jpeg",
                                "image/png",
                                "image/gif",
                                "application/pdf",
                                "application/vnd.ms-excel",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            ];
                        
                            const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
                            const mimetype = allowedMimeTypes.includes(file.mimetype);
                        
                            if (file.size === 0) {
                                return cb(null, false); // Skip empty files
                            }
                        
                            if (mimetype && extname) {
                                return cb(null, true);
                            } else {
                                return cb(new Error(`Error: File upload only supports the following filetypes - ${allowedExtensions}, receiving extension: ${path.extname(file.originalname).toLowerCase()} and mimetype: ${file.mimetype}`));
                            }
                        }
                           
                    });

module.exports = upload;