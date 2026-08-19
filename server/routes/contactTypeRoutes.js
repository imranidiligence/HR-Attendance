const express = require('express');
const router = express.Router();
const {
  createContactType,
  getContactTypeById,
  getAllContactTypes,
  getPaginatedContactTypes,
  updateContactType,
  deleteContactType,
} = require('../controllers/contactTypeController');

router.post('/', createContactType);
router.get('/paginated', getPaginatedContactTypes);
router.get('/:id', getContactTypeById);
router.get('/', getAllContactTypes);
router.put('/:id', updateContactType);
router.delete('/:id', deleteContactType);

module.exports = router;