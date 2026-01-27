const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ALWAYS use absolute path
const uploadDir = path.join(__dirname, "..", "uploads", "bank-docs");

// ensure folder exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `bank_${req.params.emp_id}_${Date.now()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["application/pdf", "image/png", "image/jpeg"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only PDF, PNG, JPG allowed"));
  }
  cb(null, true);
};

const uploadBankDoc = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
}).fields([
  { name: "aadhaar", maxCount: 1 },
  { name: "pan", maxCount: 1 },
  { name: "passbook", maxCount: 1 },
  { name: "address_proof", maxCount: 1 },
]);


module.exports = uploadBankDoc;
