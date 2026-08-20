const multer = require("multer");
const path = require("path");
const fs = require("fs");

// =====================================================
// Upload directory
// =====================================================

const uploadDir = path.join(
  __dirname,
  "..",
  "uploads",
  "bank-docs"
);

// Create directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true
  });
}

// =====================================================
// Storage
// =====================================================

const storage = multer.diskStorage({

  destination: (req, file, cb) => {

    cb(null, uploadDir);

  },

  filename: (req, file, cb) => {

    const employeeId = req.params.employee_id;

    const ext = path
      .extname(file.originalname)
      .toLowerCase();

    const uniqueName =
      `bank_${employeeId}_${Date.now()}${ext}`;

    cb(null, uniqueName);

  }

});

// =====================================================
// File filter
// =====================================================

const fileFilter = (req, file, cb) => {

  const allowed = [
    "application/pdf",
    "image/png",
    "image/jpeg"
  ];

  if (!allowed.includes(file.mimetype)) {

    return cb(
      new Error(
        "Only PDF, PNG, JPG allowed"
      )
    );

  }

  cb(null, true);

};

// =====================================================
// Multer
// IMPORTANT:
// cURL field = document
// Therefore use .single("document")
// =====================================================

const uploadBankDoc = multer({

  storage,

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter

}).single("document");


// =====================================================

module.exports = uploadBankDoc;