const express = require('express');
const router =express.Router();
const myController =require('../controllers/myController');
const reportCourierController = require('../controllers/reportCourierController');
//Create a new Simple
router.get("/",myController.pings);
router.get("/sampleAlerts",myController.sample);
//cassandra sample
router.post("/lastStatus",myController.lastStatus);
//passenc
router.post("/passencrypt",myController.passencrypt);
//mongo api
router.post("/exSelect",myController.exSelect);
//getAccessTokenData
router.post("/getAccessTokenData",myController.getAccessTokenData);
//lastActivity
router.post("/lastActivity",myController.lastActivity);

router.post("/s3TestUpload",myController.s3TestUpload);

router.post("/networkVehicleDelayReport", reportCourierController.networkVehicleDelayReport);
router.post("/vehicleReportFilter", reportCourierController.vehicleReportFilter);
router.post("/searchVehicle", reportCourierController.searchVehicle);
router.post("/vehicleReport", reportCourierController.vehicleReport);
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