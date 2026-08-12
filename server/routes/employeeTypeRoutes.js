const express = require('express');
const router = express.Router();
const {
  createEmployeeType,
  getEmployeeTypeById,
  getAllEmployeeTypes,
  getPaginatedEmployeeTypes,
  updateEmployeeType,
  deleteEmployeeType,
} = require('../controllers/employeeTypeController');

router.post('/', createEmployeeType);
router.get('/paginated', getPaginatedEmployeeTypes);
router.get('/:id', getEmployeeTypeById);
router.get('/', getAllEmployeeTypes);
router.put('/:id', updateEmployeeType);
router.delete('/:id', deleteEmployeeType);

module.exports = router;