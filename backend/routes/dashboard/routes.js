const express = require('express');
const { isAuthenticated } = require('../../controllers/auth/controller');
const { invoiceSummary, offerSummary, proformaInvoiceSummary, customerSummary, amountSummary, productSummary, totalFollowUps, leadsSummary, getSupportSummary } = require('../../controllers/dashboard/controller');
const { checkAccess } = require('../../helpers/checkAccess');
const router = express.Router();

router.post('/invoice-summary', checkAccess, isAuthenticated, invoiceSummary);
router.post('/offer-summary', checkAccess, isAuthenticated, offerSummary);
router.post('/proforma-invoice-summary', checkAccess, isAuthenticated, proformaInvoiceSummary);
router.post('/customer-summary', checkAccess, isAuthenticated, customerSummary);
router.post('/amount-summary', checkAccess, isAuthenticated, amountSummary);
router.post('/product-summary', checkAccess, isAuthenticated, productSummary);
router.post('/leads-summary', checkAccess, isAuthenticated, leadsSummary);
router.post('/support-summary', checkAccess, isAuthenticated, getSupportSummary);

module.exports = router;