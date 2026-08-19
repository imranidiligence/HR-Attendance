const express = require('express');
const router = express.Router();
const {
  createNationality,
  getNationalityById,
  getAllNationalities,
  getPaginatedNationalities,
  updateNationality,
  deleteNationality,
} = require('../controllers/nationalityController');

router.post('/', createNationality);
router.get('/paginated', getPaginatedNationalities);
router.get('/:id', getNationalityById);
router.get('/', getAllNationalities);
router.put('/:id', updateNationality);
router.delete('/:id', deleteNationality);

module.exports = router;