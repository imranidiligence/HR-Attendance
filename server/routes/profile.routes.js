
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const auth = require("../middlewares/authMiddleware");
const { db } = require("../db/connectDB");
const { getOrganizationInfo, addOrganizationInfo, updateOrganizationInfo, addPersonInfo, addEducationInfo, getEducationInfo, getPersonalInfo, updatePersonalInfo, updateEducationInfo, deleteEducationInfo, addExperienceInfo, updateExperienceInfo, deleteExperienceInfo, getExperienceInfo, getContactInfo, updateContactInfo, addBankInfo, getBankInfo, updateBankInfo, addBankDocInfo, getAllBankDoc, addProfileImage, getProfileImage,deleteContactInfo,addContactInfo, getNomineeInfo, addNomineeInfo, updateNomineeInfo, deleteDocument, deleteNomineeInfo, addAddressInfo, getAddressInfo, updateAddressInfo } = require("../controllers/profile.controller");
const { isAdmin } = require("../middlewares/roleMiddleware");
const uploadBankDoc = require("../middlewares/uploadBankDoc");
const uploadProfileImage = require("../middlewares/uploadProfileImage");
const selfOrAdminMiddleware = require("../middlewares/selfOrAdminMiddleware");
const upload = require("../middlewares/uploadEducationDoc");

const router = express.Router();

// Organization

router.get("/organization/employee", auth, async (req, res) => {

  try {
    // console.log("Reporting Route Called");

    const query = `
      SELECT name, emp_id 
      FROM users
    `;

    const { rows } = await db.query(query);

    res.status(200).json({
      success: true,
      employees: rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
});
router.post("/organization/:emp_id", auth, addOrganizationInfo);

// Specific employee by admin edit
router.get("/organization/:emp_id", auth, getOrganizationInfo)

//  Only Admin Can Update Organization

router.put("/organization/:empId", auth, isAdmin, updateOrganizationInfo)





router.get("/personal/:emp_id", auth, getPersonalInfo);

router.post("/personal/:emp_id", auth, selfOrAdminMiddleware, addPersonInfo);
router.put("/personal/:emp_id", auth, selfOrAdminMiddleware, updatePersonalInfo);





// Education -
// POST Request

// GET Request
router.get("/education/:emp_id", auth, getEducationInfo);
router.post("/education/:emp_id", auth, selfOrAdminMiddleware,  upload.any(),addEducationInfo);
router.put(
  "/education/:emp_id/:id", 
  auth, 
  selfOrAdminMiddleware, 
  upload.any(),
  updateEducationInfo
);

router.delete("/education/:emp_id/:id", auth, selfOrAdminMiddleware, deleteEducationInfo);



// Experience

router.get("/experience/:emp_id", auth, getExperienceInfo);
router.post("/experience/:emp_id", auth, selfOrAdminMiddleware, addExperienceInfo);
router.put("/experience/:emp_id/:id", auth, selfOrAdminMiddleware, updateExperienceInfo);
router.delete("/experience/:emp_id/:id", auth, selfOrAdminMiddleware, deleteExperienceInfo);




// Contact API 


// GET Request
router.get("/contact/:emp_id", auth, getContactInfo);


router.post("/contact/:emp_id",auth,addContactInfo)

// PUT Request
router.put("/contact/:emp_id", auth, selfOrAdminMiddleware, updateContactInfo);

router.delete("/contact/:emp_id/:id",auth,deleteContactInfo)

// Nominee API

router.get("/nominee/:emp_id",auth,getNomineeInfo)
router.post("/nominee/:emp_id",auth,addNomineeInfo);
router.put("/nominee/:emp_id/:id",auth,updateNomineeInfo);
router.delete("/nominee/:emp_id/:id",auth,deleteNomineeInfo);


// BANK API


router.get("/bank/:emp_id", auth, getBankInfo);
router.post("/bank/:emp_id", auth, selfOrAdminMiddleware, addBankInfo);
router.put("/bank/:emp_id", auth, selfOrAdminMiddleware, updateBankInfo);

router.post("/profile/address", auth, selfOrAdminMiddleware, addAddressInfo);
router.get("/profile/address/:emp_id", auth, getAddressInfo);
router.put("/profile/address/:emp_id", auth, selfOrAdminMiddleware, updateAddressInfo);


// Document Upload Api 

// router.post(
//   "/bank/doc/:emp_id",
//   auth,
//   selfOrAdminMiddleware,
//   (req, res, next) => {
//     uploadBankDoc(req, res, (err) => {
//       if (err) {
//         if (err instanceof multer.MulterError) {
//           return res.status(400).json({ message: err.message });
//         }
//         return res.status(500).json({ message: err.message });
//       }
//       next();
//     });
//   },
//   addBankDocInfo
// );

router.post(
  "/bank/doc/:emp_id",
  auth,
  selfOrAdminMiddleware,
  (req, res, next) => {
    uploadBankDoc(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ message: err.message });
        }
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  addBankDocInfo
);

router.delete("/bank/doc/:emp_id/:id", auth,deleteDocument);


// GET all bank documents for an employee
router.get("/bank/doc/:emp_id", auth, getAllBankDoc);



// Profile Image


router.post(
  "/image/:emp_id",
  auth,
  selfOrAdminMiddleware,
  uploadProfileImage.single("profile"),
  addProfileImage
);


// GET /api/employee/profile/image
router.get("/image/:emp_id", auth, getProfileImage);


module.exports = router;
