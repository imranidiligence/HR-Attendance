const express = require('express');
const router = express.Router();
const {
  createGender,
  getGenderById,
  getAllGenders,
  getPaginatedGenders,
  updateGender,
  deleteGender,
} = require('../controllers/genderController');

router.post('/', createGender);
router.get('/paginated', getPaginatedGenders);
router.get('/:id', getGenderById);
router.get('/', getAllGenders);
router.put('/:id', updateGender);
router.delete('/:id', deleteGender);

module.exports = router;