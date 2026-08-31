const express = require('express');
const router = express.Router();
const {
  createDesignation,
  getDesignationById,
  getAllDesignations,
  getPaginatedDesignations,
  updateDesignation,
  deleteDesignation,
  getHODsByDepartment,
} = require('../controllers/designationController');

router.post('/', createDesignation);
router.get('/paginated', getPaginatedDesignations);
router.get('/:id', getDesignationById);
router.get('/', getAllDesignations);
router.put('/:id', updateDesignation);
router.delete('/:id', deleteDesignation);
router.get('/hods/:department_id', getHODsByDepartment);

module.exports = router;