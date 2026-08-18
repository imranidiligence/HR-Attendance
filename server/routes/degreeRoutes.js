const express = require('express');
const router = express.Router();
const {
 createDegree,
  getDegreeById,
  getAllDegrees,
  getPaginatedDegrees,
  updateDegree,
  deleteDegree,
} = require('../controllers/degreeController');

router.post('/', createDegree);
router.get('/paginated', getPaginatedDegrees);
router.get('/:id', getDegreeById);
router.get('/', getAllDegrees);
router.put('/:id', updateDegree);
router.delete('/:id', deleteDegree);

module.exports = router;