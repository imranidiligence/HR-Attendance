
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
router.post("/organization/:employee_id", auth, addOrganizationInfo);

// Specific employee by admin edit
router.get("/organization/:employee_id", auth, getOrganizationInfo)

//  Only Admin Can Update Organization

router.put("/organization/:employee_id", auth, isAdmin, updateOrganizationInfo)





router.get("/personal/:employee_id", auth, getPersonalInfo);

//router.post("/personal/:employee_id", auth, addPersonInfo);
router.post("/personal", auth, addPersonInfo);
router.put("/personal/:employee_id", auth, updatePersonalInfo);





// Education -
// POST Request

// GET Request
router.get("/education/:employee_id", auth, getEducationInfo);
router.post("/education/:employee_id", auth,  upload.any(),addEducationInfo);
router.put(
  "/education/:employee_id", 
  auth, 
  upload.any(),
  updateEducationInfo
);

router.delete("/education/:employee_id/:id", auth, deleteEducationInfo);



// Experience

router.get("/experience/:employee_id", auth, getExperienceInfo);
router.post("/experience/:employee_id", auth, addExperienceInfo);
router.put("/experience/:employee_id/:id", auth, updateExperienceInfo);
router.delete("/experience/:employee_id/:id", auth, deleteExperienceInfo);




// Contact API 


// GET Request
router.get("/contact/:employee_id", auth, getContactInfo);


router.post("/contact/:employee_id",auth,addContactInfo)

// PUT Request
router.put("/contact/:employee_id", auth, updateContactInfo);

router.delete("/contact/:employee_id/:id",auth,deleteContactInfo)

// Nominee API

router.get("/nominee/:employee_id",auth,getNomineeInfo)
router.post("/nominee/:employee_id",auth,addNomineeInfo);
router.put("/nominee/:employee_id/:id",auth,updateNomineeInfo);
router.delete("/nominee/:employee_id/:id",auth,deleteNomineeInfo);


// BANK API


router.get("/bank/:employee_id", auth, getBankInfo);
router.post("/bank/:employee_id", auth, addBankInfo);
router.put("/bank/:employee_id", auth, updateBankInfo);

router.post("/profile/address", auth, addAddressInfo);
router.get("/profile/address/:employee_id", auth, getAddressInfo);
router.put("/profile/address", auth, updateAddressInfo);


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
  "/bank/doc/:employee_id",
  auth,

  (req, res, next) => {

    uploadBankDoc(req, res, (err) => {

      if (err) {

        console.error(
          "Bank Document Upload Error:",
          err
        );

        if (err instanceof multer.MulterError) {

          return res.status(400).json({
            success: false,
            message: err.message,
            code: err.code
          });

        }

        return res.status(400).json({
          success: false,
          message: err.message
        });

      }

      console.log(
        "Uploaded File:",
        req.file
      );

      console.log(
        "Form Body:",
        req.body
      );

      next();

    });

  },

  addBankDocInfo
);

router.delete("/bank/doc/:employee_id/:id", auth,deleteDocument);


// GET all bank documents for an employee
router.get("/bank/doc/:employee_id", auth, getAllBankDoc);



// Profile Image


router.post(
  "/image/:emp_id",
  auth,
  uploadProfileImage.single("profile"),
  addProfileImage
);


// GET /api/employee/profile/image
router.get("/image/:emp_id", auth, getProfileImage);


module.exports = router;
