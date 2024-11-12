const express = require('express');
const { getFacebookApi, getIndiamartApi, updateFacebookApi, updateIndiamartApi } = require('../../controllers/website configuration/controller');
const { checkAccess } = require('../../helpers/checkAccess');
const router = express.Router();

router.get('/facebook-api', checkAccess, getFacebookApi);
router.get('/indiamart-api', checkAccess, getIndiamartApi);
router.post('/facebook-api', checkAccess, updateFacebookApi);
router.post('/indiamart-api', checkAccess, updateIndiamartApi);

module.exports = router;