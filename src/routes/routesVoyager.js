const express = require('express');
const router =express.Router();

const voyagerUploadDocumentsController =require('../controllers/voyagerUploadDocumentsController');

////////////////////////// VOYAGER:Upload Documents//////////////////////////
router.post("/uploadVoyagerDocumentsUpdated",voyagerUploadDocumentsController.uploadVoyagerDocumentsUpdated);
router.post("/downloadVoyagerDocuments",voyagerUploadDocumentsController.downloadVoyagerDocuments);

module.exports = router;


/////Status code//
/*
200 : Success
201 : Created
304 : Not Modified
500:  Internal Server Error
501:  Not Implemented or recognize payload
404: Not Found
*/