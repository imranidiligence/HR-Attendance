const express = require("express");

const {
  createHoliday,
  getHolidayById,
  getAllHolidays,
  getPaginatedHolidays,
  updateHoliday,
  deleteHoliday,
} = require("../controllers/holiday.controller");

const router = express.Router();


router.post("/", createHoliday);


router.get("/", getAllHolidays);


router.get("/paginated", getPaginatedHolidays);


router.get("/:id", getHolidayById);


router.put("/:id", updateHoliday);


router.delete("/:id", deleteHoliday);

module.exports = router;