const { isAuthenticated } = require('../../controllers/auth/controller');
const { createSupport, deleteSupport, editSupport, getAllSupport, getSupportDetails, getAllAssignedSupport, supportSummary } = require('../../controllers/support/controller');

const express = require('express');
const { checkAccess } = require('../../helpers/checkAccess');
const { createSupportValidator, validateHandler, deleteSupportValidator, editSupportValidator, supportDetailsValidator } = require('../../validators/support/validator');
const router = express.Router();

router.post('/create-support', createSupportValidator(), validateHandler, createSupport);
router.post('/delete-support', isAuthenticated, checkAccess, deleteSupportValidator(), validateHandler, isAuthenticated, checkAccess, deleteSupport);
router.post('/edit-support', isAuthenticated, checkAccess, editSupportValidator(), validateHandler, isAuthenticated, checkAccess, editSupport);
router.post('/get-support', supportDetailsValidator(), validateHandler, getSupportDetails);
router.get('/get-all-support', getAllSupport);
router.get('/get-all-assigned-support', isAuthenticated, getAllAssignedSupport);
router.get('/support-summary', supportSummary)

module.exports = router;