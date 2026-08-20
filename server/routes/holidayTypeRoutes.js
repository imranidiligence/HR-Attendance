const express = require("express");

const {
  createHolidayType,
  getHolidayTypeById,
  getAllHolidayTypes,
  getPaginatedHolidayTypes,
  updateHolidayType,
  deleteHolidayType,
} = require("../controllers/holidayType.controller");

const router = express.Router();

router.post("/", createHolidayType);


router.get("/", getAllHolidayTypes);


router.get("/paginated", getPaginatedHolidayTypes);

router.get("/:id", getHolidayTypeById);

router.put("/:id", updateHolidayType);

router.delete("/:id", deleteHolidayType);

module.exports = router;