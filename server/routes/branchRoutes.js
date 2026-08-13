const express = require('express');
const router = express.Router();
const {
  createBranch,
  getBranchById,
  getAllBranches,
  getPaginatedBranches,
  updateBranch,
  deleteBranch,
} = require('../controllers/branchController');

router.post('/', createBranch);
router.get('/paginated', getPaginatedBranches);
router.get('/:id', getBranchById);
router.get('/', getAllBranches);
router.put('/:id', updateBranch);
router.delete('/:id', deleteBranch);

module.exports = router;