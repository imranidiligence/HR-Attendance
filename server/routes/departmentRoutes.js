const express = require('express');
const router = express.Router();
const {
  createDepartment,
  getDepartmentById,
  getAllDepartments,
  getPaginatedDepartments,
  updateDepartment,
  deleteDepartment,
} = require('../controllers/departmentController');

router.post('/', createDepartment);
router.get('/paginated', getPaginatedDepartments); // must precede '/:id'
router.get('/:id', getDepartmentById);
router.get('/', getAllDepartments);
router.put('/:id', updateDepartment);
router.delete('/:id', deleteDepartment);

module.exports = router;