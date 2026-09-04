const express = require('express');
const router = express.Router();
const {
  createActivityLog,
  getActivityLogById,
  getAllActivityLogs,
  getPaginatedActivityLogs,
  updateActivityLog,
  deleteActivityLog,
} = require('./../controllers/mobile.punch.logs.controller');

// Paginated route MUST be declared before '/:id' to avoid route collision
router.get('/paginated', getPaginatedActivityLogs);

router.post('/', createActivityLog);
router.get('/', getAllActivityLogs);
router.get('/:id', getActivityLogById);
router.put('/:id', updateActivityLog);
router.delete('/:id', deleteActivityLog);

module.exports = router;