const express = require('express');
const router = express.Router();
const {
  createDesignation,
  getDesignationById,
  getAllDesignations,
  getPaginatedDesignations,
  updateDesignation,
  deleteDesignation,
} = require('../controllers/designationController');

router.post('/', createDesignation);
router.get('/paginated', getPaginatedDesignations);
router.get('/:id', getDesignationById);
router.get('/', getAllDesignations);
router.put('/:id', updateDesignation);
router.delete('/:id', deleteDesignation);

module.exports = router;