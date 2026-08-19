const express = require("express");
const router = express.Router();

const {
  createBranchLocation,
  getBranchLocationById,
  getAllBranchLocations,
  getPaginatedBranchLocations,
  updateBranchLocation,
  deleteBranchLocation,
} = require("../controllers/branchLocationController");

router.post("/", createBranchLocation);

router.get("/", getAllBranchLocations);

router.get("/paginated", getPaginatedBranchLocations);

router.get("/:id", getBranchLocationById);

router.put("/:id", updateBranchLocation);

router.delete("/:id", deleteBranchLocation);

module.exports = router;