const express = require('express');
const router = express.Router();
const {
  createVendorType,
  getVendorTypeById,
  getAllVendorTypes,
  getPaginatedVendorTypes,
  updateVendorType,
  deleteVendorType,
} = require('../controllers/vendorMasterController');

router.post('/', createVendorType);
router.get('/paginated', getPaginatedVendorTypes); // must precede '/:id'
router.get('/:id', getVendorTypeById);
router.get('/', getAllVendorTypes);
router.put('/:id', updateVendorType);
router.delete('/:id', deleteVendorType);

module.exports = router;