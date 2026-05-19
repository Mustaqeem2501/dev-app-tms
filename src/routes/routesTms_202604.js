const express = require('express');
const router =express.Router();
//const tmsController =require('../controllers/tmsController');
const tmsVehicleController =require('../controllers/tmsVehicleController');
const tmsDriverController =require('../controllers/tmsDriverController');
const tmsDocumentWalletController =require('../controllers/tmsDocumentWalletController');
const consolidatedDashboardController =require('../controllers/consolidatedDashboardController');
const reportCourierController =require('../controllers/reportCourierController');
const userController = require('../controllers/userController');
// const kyccontroller = require('../controllers/kyccontroller');

//const newConsolidatedDashboardController =require('../controllers/newConsolidatedDashboardController');

////////////////////////// TMS:Vehicle//////////////////////////
router.post("/vehicleMaster",tmsVehicleController.vehicleMaster);
router.post("/vehicleDashboard",tmsVehicleController.vehicleDashboard);
router.post("/vehicleAdd",tmsVehicleController.vehicleAdd);
router.post("/vehicleEdit",tmsVehicleController.vehicleEdit); 
router.post("/vehicleAction",tmsVehicleController.vehicleAction);
router.post("/uploadMedia",tmsVehicleController.uploadMedia); 


////////////////////////// TMS:Driver//////////////////////////
router.post("/driverMaster",tmsDriverController.driverMaster); 
router.post("/driverDashboard",tmsDriverController.driverDashboard);
router.post("/driverAdd",tmsDriverController.driverAdd);
router.post("/driverEdit",tmsDriverController.driverEdit);
router.post("/driverAction",tmsDriverController.driverAction);

////////////////////////// TMS:Document Wallet //////////////////////////
router.post("/documentWalletMaster",tmsDocumentWalletController.documentWalletMaster);
router.post("/documentWallet",tmsDocumentWalletController.documentWallet);
router.post("/documentAdd",tmsDocumentWalletController.documentAdd);
router.post("/documentEdit",tmsDocumentWalletController.documentEdit);
router.post("/documentAction",tmsDocumentWalletController.documentAction);
router.post("/documentRenew",tmsDocumentWalletController.documentRenew);
router.post("/documentBulkUpload",tmsDocumentWalletController.documentBulkUpload);

////////////////////////// TMS:Consolidated Dashboard //////////////////////////
router.post("/consolidatedDashboard",consolidatedDashboardController.consolidatedDashboard);
router.post("/consolidatedSummarydDashboard",consolidatedDashboardController.consolidatedSummarydDashboard);

////////////////////////// TMS:New Consolidated Dashboard //////////////////////////
/*router.post("/dashboardAllFilters",newConsolidatedDashboardController.getDashboardFiltersData);
router.post("/dashboardCustomerFilter",newConsolidatedDashboardController.getTransportersByCustomerFilter);
router.post("/dashboardInsurerFilter",newConsolidatedDashboardController.getTransportersByInsurerFilter);
router.post("/dashboardAgentFilter",newConsolidatedDashboardController.getTransportersByAgentFilter);

router.post("/Dashboard",newConsolidatedDashboardController.Dashboard);*/

router.post("/changePassword",userController.changePassword);
router.post("/profilePicture",userController.profilePicture);


//////
// router.post("/vehicleKyc",kyccontroller.vehicleKyc);

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