const express = require('express');
const { allLeads, leadDetails, editLead, deleteLead } = require('../../controllers/indiamart lead/controller');
const { isAuthenticated } = require('../../controllers/auth/controller');
const { checkAccess } = require('../../helpers/checkAccess');
const router = express.Router();

router.get('/all', isAuthenticated, allLeads);
router.post('/details', isAuthenticated, leadDetails);
router.post('/edit', isAuthenticated, editLead);
router.post('/delete', isAuthenticated, checkAccess, deleteLead);

module.exports = router;