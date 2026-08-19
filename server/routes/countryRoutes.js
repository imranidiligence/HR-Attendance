const express = require('express');
const router = express.Router();
const {
  createCountry,
  getCountryById,
  getAllCountries,
  getPaginatedCountries,
  updateCountry,
  deleteCountry,
} = require('../controllers/countryController');

router.post('/', createCountry);
router.get('/paginated', getPaginatedCountries);
router.get('/:id', getCountryById);
router.get('/', getAllCountries);
router.put('/:id', updateCountry);
router.delete('/:id', deleteCountry);

module.exports = router;