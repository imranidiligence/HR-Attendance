const express = require('express');
const router = express.Router();
const {
  createCity,
  getCityById,
  getAllCities,
  getPaginatedCities,
  updateCity,
  deleteCity,
} = require('../controllers/cityController');

router.post('/', createCity);
router.get('/paginated', getPaginatedCities);
router.get('/:id', getCityById);
router.get('/', getAllCities);
router.put('/:id', updateCity);
router.delete('/:id', deleteCity);

module.exports = router;