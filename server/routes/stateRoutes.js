const express = require('express');
const router = express.Router();
const {
  createState,
  getStateById,
  getAllStates,
  getPaginatedStates,
  updateState,
  deleteState,
} = require('../controllers/stateController');

router.post('/', createState);
router.get('/paginated', getPaginatedStates);
router.get('/:id', getStateById);
router.get('/', getAllStates);
router.put('/:id', updateState);
router.delete('/:id', deleteState);

module.exports = router;