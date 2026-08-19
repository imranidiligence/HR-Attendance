const express = require('express');
const router = express.Router();
const {
  createBloodGroup,
  getBloodGroupById,
  getAllBloodGroups,
  getPaginatedBloodGroups,
  updateBloodGroup,
  deleteBloodGroup,
} = require('../controllers/bloodGroupController');

router.post('/', createBloodGroup);
router.get('/paginated', getPaginatedBloodGroups);
router.get('/:id', getBloodGroupById);
router.get('/', getAllBloodGroups);
router.put('/:id', updateBloodGroup);
router.delete('/:id', deleteBloodGroup);

module.exports = router;