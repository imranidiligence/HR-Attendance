const express = require('express');
const router = express.Router();
const {
  createPunchType,
  getPunchTypeById,
  getAllPunchTypes,
  getPaginatedPunchTypes,
  updatePunchType,
  setPunchTypeActiveStatus,
  deletePunchType,
} = require('./../controllers/punchTypeController');

// Paginated route MUST be declared before '/:id' to avoid route collision
router.get('/paginated', getPaginatedPunchTypes);

router.post('/', createPunchType);
router.get('/', getAllPunchTypes);
router.get('/:id', getPunchTypeById);
router.put('/:id', updatePunchType);
router.patch('/:id/status', setPunchTypeActiveStatus); // activate/deactivate
router.delete('/:id', deletePunchType);

module.exports = router;