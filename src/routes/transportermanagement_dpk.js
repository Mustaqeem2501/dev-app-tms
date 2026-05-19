const express = require('express');
const router = express.Router();
const tmscontroller = require('../controllers/tmsbillingcontroller');
const tmssggrementfiltecontroller = require('../controllers/agreementfilter');
const tmsindentingsystem = require('../controllers/indentingsystem');
const tmsorder = require('../controllers/indentorder');
const tmsTripReportController = require('../controllers/tmsTripReportController');
const tmsScheduleDashboard = require('../controllers/tmsScheduleDashboard');
const fleetperformancereport = require('../controllers/fleetperformancereport');
const newtranporterlist = require('../controllers/newtranporterlist');
// const userController = require('../controllers/userController');
// console.log(tmscontroller)
// process.exit(0)
// Driver management MOBILE API 
// router.get("/tmsbilling",tmscontroller.pings); 
router.post("/tmsbillingdetails",tmscontroller.tmsbilling); 
router.post("/tmsbillingfilter",tmscontroller.tmsbillingfilter);
router.post("/tmsbranchlocation",tmscontroller.branchstatelist);
router.post("/tmsaggrementfilter",tmssggrementfiltecontroller.agreementfilter);
router.post("/transportervehiclelist",tmscontroller.tmsvehiclelist);
router.post("/tmsbillingstatus",tmscontroller.tmsbillingstatus);
router.post("/tmsbillinggeneration",tmscontroller.tmsgeneratebill);
router.post("/tmsagreementupload",tmssggrementfiltecontroller.agreementupload);
router.post("/tmsagreementdetails",tmssggrementfiltecontroller.agreementdetails);
router.post("/transporterlist",tmssggrementfiltecontroller.transporterslist);
router.post("/agreementvehicleinformation",tmssggrementfiltecontroller.agreementvehicleinformation);
router.post("/acceptrejectbill",tmscontroller.tmsbillacceptreject);
router.post("/billverificationinfo",tmssggrementfiltecontroller.billingverificationdetails);
router.post("/indentfilter",tmsindentingsystem.indentfilter);
router.post("/indentrequestdata",tmsindentingsystem.indentsearchdata);
router.post("/submitindentrequest",tmsindentingsystem.submitindent);
router.post("/getindentdata",tmsindentingsystem.getorderdata);
router.post("/indentassignment",tmsindentingsystem.indentassignment);
router.post("/indentassigneddata",tmsindentingsystem.getassigneddata);
router.post("/getquotecustomerdata",tmsindentingsystem.getquotedatacustomer);
router.post("/getvehicledriverdata",tmsorder.ordervehicledriverdata);
router.post("/getdriverdetails",tmsorder.getdriverlist);
router.post("/statusupdate",tmsorder.statusupdate);
router.post("/acceptquote",tmsorder.acceptquote);
router.post("/statuscount",tmssggrementfiltecontroller.statuscount);
router.post("/uidtotransporterid",tmsorder.useridtotranporterid);
router.post("/newtransporterlist",newtranporterlist.transporterlistnew);


//test verification
const kyccontroller = require('../controllers/kyccontroller');
//////
router.post("/rcadvanceverification",kyccontroller.rcadvance);


///
router.post("/fleetperformancereport",fleetperformancereport.fleetreport);

// MAYANK 
router.post("/tmsTripReportFilter",tmsTripReportController.tmsTripReportFilter);
router.post("/tmsTripReport",tmsTripReportController.tmsTripReport);
router.post("/getTmsVehicle",tmsTripReportController.getTmsVehicle);
router.post("/tmsScheduleDashboardFilter",tmsScheduleDashboard.tmsScheduleDashboardFilter);
router.post("/tmsScheduleDashboard",tmsScheduleDashboard.tmsScheduleDashboard);
//

//Created By Mustaqeem on 2026-01-21.
router.post("/billingGUIFields",tmssggrementfiltecontroller.billingGUIFields);


module.exports = router;