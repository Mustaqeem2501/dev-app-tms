const express = require('express');
const router =express.Router();
const tmsController =require('../controllers/tmsController');


router.post("/filterCV",tmsController.filterCV);
router.post("/vehicleDashboard",tmsController.vehicleDashboard);
router.post("/uploadMedia",tmsController.uploadMedia); 
router.post("/vehicleAdd",tmsController.vehicleAdd); 
router.post("/vehicleEdit",tmsController.vehicleEdit); 
router.post("/vehicleAction",tmsController.vehicleAction); 

router.post("/driverMaster",tmsController.driverMaster); 

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