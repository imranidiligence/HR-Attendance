const express = require('express');
const router = express.Router();
const {
  createVendorDetails,
  getVendorDetailsById,
  getAllVendorDetails,
  getPaginatedVendorDetails,
  updateVendorDetails,
  deleteVendorDetails,
} = require('../controllers/vendorDetailsController');

router.post('/', createVendorDetails);
router.get('/paginated', getPaginatedVendorDetails); // must precede '/:id'
router.get('/:id', getVendorDetailsById);
router.get('/', getAllVendorDetails);
router.put('/:id', updateVendorDetails);
router.delete('/:id', deleteVendorDetails);

module.exports = router;