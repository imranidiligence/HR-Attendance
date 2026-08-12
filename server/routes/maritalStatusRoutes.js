const express = require('express');
const router = express.Router();
const {
  createMaritalStatus,
  getMaritalStatusById,
  getAllMaritalStatuses,
  getPaginatedMaritalStatuses,
  updateMaritalStatus,
  deleteMaritalStatus,
} = require('../controllers/maritalStatusController');

router.post('/', createMaritalStatus);
router.get('/paginated', getPaginatedMaritalStatuses);
router.get('/:id', getMaritalStatusById);
router.get('/', getAllMaritalStatuses);
router.put('/:id', updateMaritalStatus);
router.delete('/:id', deleteMaritalStatus);

module.exports = router;