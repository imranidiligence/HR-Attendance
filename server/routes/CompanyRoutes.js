const express = require('express');
const router = express.Router();
const {
  createCompany,
  getCompanyById,
  getAllCompanies,
  getPaginatedCompanies,
  updateCompany,
  deleteCompany
} = require('../controllers/companiesController');

// Company routes
router.post('/companies', createCompany);
router.get('/companies', getAllCompanies);
router.get('/companies/paginated', getPaginatedCompanies);
router.get('/companies/:id', getCompanyById);
router.put('/companies/:id', updateCompany);
router.delete('/companies/:id', deleteCompany);

module.exports = router;