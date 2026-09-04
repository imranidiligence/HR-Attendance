const express = require('express');

const router = express.Router();

const {
    createLeaveType,
    getLeaveTypeById,
    getAllLeaveTypes,
    getPaginatedLeaveTypes,
    updateLeaveType,
    deleteLeaveType
} = require('../controllers/leaveTypeController');



router.post('/', createLeaveType);

router.get('/paginated', getPaginatedLeaveTypes);

router.get('/', getAllLeaveTypes);

router.get('/:id', getLeaveTypeById);

router.put('/:id', updateLeaveType);

router.delete('/:id', deleteLeaveType);


module.exports = router;