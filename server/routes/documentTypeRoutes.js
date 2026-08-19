const express = require('express');
const router = express.Router();
const {
  createDocumentType,
  getDocumentTypeById,
  getAllDocumentTypes,
  getPaginatedDocumentTypes,
  updateDocumentType,
  deleteDocumentType,
} = require('../controllers/documentTypeController');

router.post('/', createDocumentType);
router.get('/paginated', getPaginatedDocumentTypes);
router.get('/:id', getDocumentTypeById);
router.get('/', getAllDocumentTypes);
router.put('/:id', updateDocumentType);
router.delete('/:id', deleteDocumentType);

module.exports = router;