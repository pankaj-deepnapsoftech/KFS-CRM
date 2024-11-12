const express = require('express');
const { createLead, editLead, deleteLead, leadDetails, allLeads, assignedLeads, leadSummary } = require('../../controllers/Lead/controller');
const { createLeadValidator, validateHandler, editLeadValidator, deleteLeadValidator, leadDetailsValidator } = require('../../validators/lead/validator');
const { checkAccess } = require('../../helpers/checkAccess');
const router = express.Router();

router.post('/create-lead', checkAccess, createLeadValidator(), validateHandler, createLead);
router.post('/edit-lead', checkAccess, editLeadValidator(), validateHandler, editLead);
router.post('/delete-lead',  checkAccess,deleteLeadValidator(), validateHandler, deleteLead);
router.post('/lead-details', checkAccess, leadDetailsValidator(), validateHandler, leadDetails);
router.post('/all-leads', allLeads);
router.get('/assigned-lead', checkAccess, assignedLeads);
router.get('/lead-summary', checkAccess, leadSummary);

module.exports = router;