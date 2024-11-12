const express = require('express');
const { getPaymentReport, getExpenseReport } = require('../../controllers/report/controller');
const { checkAccess } = require('../../helpers/checkAccess');
const router = express.Router();

router.post('/get-payment-report', checkAccess, getPaymentReport);
router.post('/get-expense-report', checkAccess, getExpenseReport);

module.exports = router;
