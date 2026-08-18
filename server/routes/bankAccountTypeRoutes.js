const express = require('express');
const router = express.Router();
const {
  createBankAccountType,
  getBankAccountTypeById,
  getAllBankAccountTypes,
  getPaginatedBankAccountTypes,
  updateBankAccountType,
  deleteBankAccountType,
} = require('../controllers/bankAccountTypeController');

router.post('/', createBankAccountType);
router.get('/paginated', getPaginatedBankAccountTypes);
router.get('/:id', getBankAccountTypeById);
router.get('/', getAllBankAccountTypes);
router.put('/:id', updateBankAccountType);
router.delete('/:id', deleteBankAccountType);

module.exports = router;