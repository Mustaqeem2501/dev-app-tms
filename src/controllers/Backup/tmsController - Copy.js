const db = require("../config/db");
const getMongo = require("../lib/mongo/mongo_api");
const {passenc} = require("../helpers/pass_enc");
const {getAccessTokenDataWeb,lastActivityWeb} = require("../helpers/access_token_web");
const moment = require('moment-timezone');
const currentDateTime = moment().tz('Asia/Kolkata');
const uploadS3 = require("./components/uploadS3Component");
// const AccessGenericAlertMenu =require("./components/accessGenericAlertComponent");
// const AccessSpecificMenu =require("./components/accessSpecificComponent");
// const AccessGenericMenu =require("./components/accessGenericComponent");
// const uploadS3 = require("./components/uploadS3Component");
const { json } = require("body-parser");
const mongu =require("../lib/mongo/mongo_api");
const tokenWeb= require("../helpers/access_token_web");
const { format, subHours, differenceInSeconds } = require('date-fns');
const dayjs = require('dayjs');
const fs =  require('fs');
// const { DateTime } = require('luxon'); // For date/time handling
//page function:
//
// READ: Get all users
exports.loginV2 = async(req, res) => {
   
        try{
            let resData={};
            resData.Status="fail";
            const {GroupId,UserId,Password,LoginVia} =req.body;
            const ip = await getCleanIp(req.ip || 
            req.headers['x-forwarded-for']?.split(',').shift() || 
            req.connection?.remoteAddress);
            //console.log(LoginVia);
            let login_via="web";
            if(UserId && Password)
            {
                if(LoginVia && LoginVia !=undefined)
                {
                    login_via=LoginVia;
                }
                else
                {
                    login_via="web";
                }
                let group_id="";
                let username="";
                let password="";
                let sql_user = "";
                //let result = "";
                username = xssClean(UserId);
                password = await passenc(xssClean(Password));
                
                if(GroupId)
                {
                    group_id = xssClean(GroupId);
                    sql_user=`SELECT id,user_type,name,group_type,group_id FROM user WHERE status = 1 AND group_id='${group_id}' AND username='${username}' AND password='${password}'`;
                    
                }else{
                    sql_user=`SELECT id,user_type,name,group_type FROM user WHERE status = 1 AND group_id IS NULL OR group_id='' AND username='${username}' AND password='${password}'`;
                }
                //console.log(group_id,username,password);
                
                //try{
                const [result] = await db.promise().query(sql_user);    
                //console.log(result);  
                if ( result.length > 0) {
                        const data = {};
                        account_id = result[0].id;
                        data.AccountId = account_id;
                        data.AccountName = result[0].name;
                        data.UserType= result[0].user_type;
                        const suspend = await isAccountSuspend(account_id); 
                    
                        if (Object.values(suspend).length > 0) {
                            err = suspend['Message'];
                            //console.log(suspend);
                            res.Message= err;
                        } else {
                            let group_type = '';
                            group_type = result[0].group_type;
                            //domain = "http://uat.api.secutrak.in/";
                            let domain = "";
                            let accessToken="";
                            if(login_via=="web")
                            {
                               accessToken = await lastActivityWeb(account_id,ip);
                            }
                            else if(login_via=="mobile")
                            {
                               accessToken = await lastActivityWeb(account_id,ip); //to do code
                            }
                            
                            if(accessToken) {
                                data.AccessToken = accessToken;
                                log_data = await maintainLoginLog(account_id,ip,login_via);
                            }
                            if(GroupId) {
                                data.GroupId = group_id;
                            }
        
                            data.GroupTypeId = group_type;
                            //console.log(data);return false;
                            if(GroupId) {
                                sql3 = `SELECT image_path,thumb_image_path FROM user_group WHERE group_id='${group_id}' AND status=1`; 
                            } else {
                                sql3 = `SELECT image_path,thumb_image_path FROM user_profile_picture WHERE user_id=${account_id}`; 
                            }
                            
                            //try{
                           
                            
                                const [imgResult] = await db.promise().query(sql3);
                                //console.log(imgResult);
                                
                                data.FullImage = (imgResult.length>0) ? imgResult[0].image_path : "";
                                data.ThumbImage= (imgResult.length>0) ? imgResult[0].thumb_image_path : "";
                                
                               
                                
                                
                            /*}catch (error) {
                                console.error('Error fetching alert:', error);
                                
                                resData.Message= error;
                                res.status(500).json({ message: 'Image not found' });
                            
                            }*/
                            //Specific Permission start
                            //const user_id =account_id;

                            //deciding folder in web app
                            //Step 1 to decide either specific or generic
                            let classFolder = "";
                            const specificGroups = ["0041", "5691"];
                            const genericAlertGroups = ["5690"];
                            
                            const subGroup = {
                                "0041": "bluedart",
                                "5691": "dtdc",
                                "5690": "bpl"
                            };

                            let  accessMenu={};
                            if (specificGroups.includes(group_id)) {
                                classFolder = `specific/${subGroup[group_id]}`;
                                 // access menu
                                 accessMenu = await AccessSpecificMenu.getAccessMenu(group_id,result[0].user_type);
                            } else if (genericAlertGroups.includes(group_id)) {
                                classFolder = `genericAlert/${subGroup[group_id]}`;
                                // access menu
                                 accessMenu = await AccessGenericAlertMenu.getAccessMenu(group_id,result[0].user_type);
                            } else {
                                classFolder = "generic";
                                accessMenu = await AccessGenericMenu.getAccessMenu(group_id,result[0].user_type,group_type);
                            }

                            data.Class = classFolder;

                            const role ={
                                1 : "Super Admin",
                                2 : "Admin",
                                3 : "Back Office",
                                4 : "Individual Transporter",
                                5 : "Insuarance Customer",
                                6 : "Master",
                                7 : "Executive",
                                8 : "Support",
                                9 : "Corporate Admin",
                               10 : "Corporate Transporter",
                               11 : "Individual Customer",
                               12 : "Corporate Manager",
                               13 : "Corporate Plant",
                               14 : "LMV",
                               15 : "Corporate Customer",
                               16 : "Corporate Back office",
                               17 : "Sales Manager",
                               18 : "Plant Back office",
                               19 : "Regional Manager",
                               20 : "National Manager",
                               21 : "Ware House",
                               22 : "Third Party Tracker",
                               23 : "Alert Tracker",
                               24 : "Corporate Supplier",
                               25 : "Gate keeper",
                               26 : "Corporate Chilling Plant",
                               27 : "Driver",
                               28 : "CRIS",
                               29 : "Device Tracker",
                               30 : "SimConcent",
                               31 : "Distributor",
                               32 : "Retailer",
                               33 : "Farmer",
                               34 : "MCC_E",
                               35 : "Supplier_E",
                               36 : "Person",
                               37 : "Seller",
                               38 : "Corporate Operator",
                               40 : "SuAdmin",
                               41 : "SuMaster",
                               42 : "SuMonitor",
                               43 : "Corporate Siding",
                               44 : "HO",
                               45 : "Shipper",
                               46 : "CMS Back Office",
                               47 : "CMS Field Co-ordinator",
                               49 : "CMS Manager",
                               50 : "Cold Room",
                               51 : "Dealer",
                               52 : "Client Alert Tracker",
                               53 : "Senior Manager",
                               54 : "Ground Team",
                               55 : "QRT Team",
                               56 : "RnD Manager",
                               57 : "High Priority Tracker",
                               58 : "District Manager",
                               59 : "Block User",
                               60 : "Tahsil Manager",
                               61 : "Vertical",
                               62 : "Regulatory Officer",
                               63 : "Regulatory Approval"
                            }
                             
                            if (role[result[0].user_type]) {
                                data.UserRole = role[result[0].user_type];
                            }
                            else
                            {
                                data.UserRole = "Others";
                            }


                            

                            

                            //console.log(accessMenu);
                            //process.exit(0);
                            

                            const spec_permission={};
                            const [resultassign] = await db.promise().query("SELECT * FROM cv_specific_group_assignment WHERE `group_id`=? AND `status`=?",[group_id,1]);
                            if (resultassign.length > 0) {
                                const resultspc=resultassign[0];
            
                                const specific_trip = resultspc['specific_trip'];                    
                                const irun_alert_dashboard =resultspc['irun_alert_dashboard'];
                                const delay_dashboard = resultspc['delay_dashboard'];
                                const trip_text_dashboard = resultspc['trip_text_dashboard'];
                                const vehicle_nearby = resultspc['vehicle_nearby'];
                                const vehicle_utilization = resultspc['vehicle_utilization'];
                                const gps_integration = resultspc['gps_integration'];
                                const fleet_performance =resultspc['fleet_performance'];
                                const schedule_dashboard =resultspc['schedule_dashboard'];
            
                                spec_permission.group_id=group_id;
                                spec_permission.specific_trip = specific_trip;
                                spec_permission.irun_alert_dashboard = irun_alert_dashboard;
                                spec_permission.delay_dashboard = delay_dashboard;
                                spec_permission.trip_text_dashboard = trip_text_dashboard;
                                spec_permission.vehicle_nearby = vehicle_nearby;
                                spec_permission.vehicle_utilization =vehicle_utilization;
                                spec_permission.gps_integration =gps_integration;
                                spec_permission.fleet_performance =fleet_performance;
                                spec_permission.schedule_dashboard =schedule_dashboard;
                            }
                            ///Specific Permission end
                            resData.Data=data;
                            resData.specific_permission =spec_permission;
                            resData.AccessMenu =accessMenu;
                            resData.Status="success";
                            res.status(200).json(resData);
                        }
                    }else{
                        
                        err = "Invalid username or password.";
                        resData.Message= err;
                        res.status(200).json(resData);
                    }
         
            }
            else
            {
                resData.Message="Credential is blank.";
                res.status(200).json(resData);
            }   
               
            
        } 
       catch (error) {
        console.error('Error fetching alert:', error);
        res.status(500).json({ message: 'Internal Server Error' });
      }
    
    };

exports.loginByAccessTokenV2 = async(req, res) => {
   
        try{
            let resData={};
            resData.Status="failed";


            const {AccessToken,LoginVia} =req.body;
            let auth ="";
            let login_via="web";
            if(LoginVia && LoginVia !=undefined)
            {
                login_via=LoginVia;
            }
            else
            {
                login_via="web";
            }
            if(login_via=="web")
            {
                auth = await getAccessTokenDataWeb(AccessToken);
            }
            else if(login_via=="mobile")
            {
                auth = await getAccessTokenDataWeb(AccessToken); //to do code
            }
            const ip = await getCleanIp(req.ip || 
            req.headers['x-forwarded-for']?.split(',').shift() || 
            req.connection?.remoteAddress);
            //console.log(auth);
           
            if((auth && auth.expired_by === '') || (auth && auth.expired_by === null))
            {
                let account_id = auth.AccountId;
                let group_id="";
                let username="";
                let password="";
                let sql_user = "";
                
                if(account_id)
                {
                    sql_user=`SELECT id,user_type,name,group_type,group_id FROM user WHERE status = 1 AND id=${account_id}`;
                    const [result] = await db.promise().query(sql_user);                    
                    
                              
                 
                //console.log(result);  
                if ( result.length > 0) {
                        const data = {};
                        account_id = result[0].id;
                        data.AccountId = account_id;
                        data.AccountName = result[0].name;
                        data.UserType= result[0].user_type;
                        const suspend = await isAccountSuspend(account_id); 
                    
                        if (Object.values(suspend).length > 0) {
                            err = suspend['Message'];
                            //console.log(suspend);
                            res.Message= err;
                        } 
                        else 
                        {
                            let group_type = '';
                            let group_id='';
                            group_type = result[0].group_type;
                            //domain = "http://uat.api.secutrak.in/";
                            
                            
                            data.AccessToken = AccessToken;
                            data.GroupId= result[0].group_id;
                            data.GroupTypeId= result[0].group_type;                        
                            data.GroupType = 'CV';
                            data.BaseUrl = '';
        
                            //console.log(data);return false;
                            if(result[0].group_id) {
                                group_id=result[0].group_id;
                                sql3 = `SELECT image_path,thumb_image_path FROM user_group WHERE group_id='${result[0].group_id}' AND status=1`; 
                            } else {
                                $sql3 = `SELECT image_path,thumb_image_path FROM user_profile_picture WHERE user_id=${account_id}`; 
                            }
                            try{
                                const [imgResult] = await db.promise().query(sql3);
                                if(imgResult){
                                    data.FullImage = (imgResult) ? imgResult[0].image_path : "";
                                    data.ThumbImage= (imgResult) ? imgResult[0].thumb_image_path : "";
                                }
                                
                            }catch (error) {
                                console.error('Error fetching alert:', error);
                                
                                resData.Message= error;
                                res.status(500).json({ message: 'Image not found' });
                            
                            }

                            //deciding folder in mobile app
                            //Step 1 to decide either specific or generic
                            let classFolder = "";
                            const specificGroups = ["0041", "5691"];
                            const genericAlertGroups = ["5690"];
                            
                            const subGroup = {
                                "0041": "bluedart",
                                "5691": "dtdc",
                                "5690": "bpl"
                            };

                            let accessMenu={};
                            if (specificGroups.includes(group_id)) {
                                classFolder = `specific/${subGroup[group_id]}`;
                                 // access menu
                                 accessMenu = await AccessSpecificMenu.getAccessMenu(group_id,result[0].user_type);
                            } else if (genericAlertGroups.includes(group_id)) {
                                classFolder = `genericAlert/${subGroup[group_id]}`;
                                // access menu
                                accessMenu = await AccessGenericAlertMenu.getAccessMenu(group_id,result[0].user_type);
                            } else {
                                classFolder = "generic";
                                accessMenu = await AccessGenericMenu.getAccessMenu(group_id,result[0].user_type,group_type);
                            }

                            data.Class = classFolder;

                            const role ={
                                1 : "Super Admin",
                                2 : "Admin",
                                3 : "Back Office",
                                4 : "Individual Transporter",
                                5 : "Insuarance Customer",
                                6 : "Master",
                                7 : "Executive",
                                8 : "Support",
                                9 : "Corporate Admin",
                               10 : "Corporate Transporter",
                               11 : "Individual Customer",
                               12 : "Corporate Manager",
                               13 : "Corporate Plant",
                               14 : "LMV",
                               15 : "Corporate Customer",
                               16 : "Corporate Back office",
                               17 : "Sales Manager",
                               18 : "Plant Back office",
                               19 : "Regional Manager",
                               20 : "National Manager",
                               21 : "Ware House",
                               22 : "Third Party Tracker",
                               23 : "Alert Tracker",
                               24 : "Corporate Supplier",
                               25 : "Gate keeper",
                               26 : "Corporate Chilling Plant",
                               27 : "Driver",
                               28 : "CRIS",
                               29 : "Device Tracker",
                               30 : "SimConcent",
                               31 : "Distributor",
                               32 : "Retailer",
                               33 : "Farmer",
                               34 : "MCC_E",
                               35 : "Supplier_E",
                               36 : "Person",
                               37 : "Seller",
                               38 : "Corporate Operator",
                               40 : "SuAdmin",
                               41 : "SuMaster",
                               42 : "SuMonitor",
                               43 : "Corporate Siding",
                               44 : "HO",
                               45 : "Shipper",
                               46 : "CMS Back Office",
                               47 : "CMS Field Co-ordinator",
                               49 : "CMS Manager",
                               50 : "Cold Room",
                               51 : "Dealer",
                               52 : "Client Alert Tracker",
                               53 : "Senior Manager",
                               54 : "Ground Team",
                               55 : "QRT Team",
                               56 : "RnD Manager",
                               57 : "High Priority Tracker",
                               58 : "District Manager",
                               59 : "Block User",
                               60 : "Tahsil Manager",
                               61 : "Vertical",
                               62 : "Regulatory Officer",
                               63 : "Regulatory Approval"
                            }
                             
                            if (role[result[0].user_type]) {
                                data.UserRole = role[result[0].user_type];
                            }
                            else
                            {
                                data.UserRole = "Others";
                            }
                            
                            //Specific Permission start
                            //const user_id =account_id;
                            const spec_permission={};
                            const [resultassign] = await db.promise().query("SELECT * FROM cv_specific_group_assignment WHERE `group_id`=? AND `status`=?",[result[0].group_id,1]);
                            if (resultassign.length > 0) {
                                const resultspc=resultassign[0];
            
                                const specific_trip = resultspc['specific_trip'];                    
                                const irun_alert_dashboard =resultspc['irun_alert_dashboard'];
                                const delay_dashboard = resultspc['delay_dashboard'];
                                const trip_text_dashboard = resultspc['trip_text_dashboard'];
                                const vehicle_nearby = resultspc['vehicle_nearby'];
                                const vehicle_utilization = resultspc['vehicle_utilization'];
                                const gps_integration = resultspc['gps_integration'];
                                const fleet_performance =resultspc['fleet_performance'];
                                const schedule_dashboard =resultspc['schedule_dashboard'];
            
                                spec_permission.group_id=result[0].group_id;
                                spec_permission.specific_trip = specific_trip;
                                spec_permission.irun_alert_dashboard = irun_alert_dashboard;
                                spec_permission.delay_dashboard = delay_dashboard;
                                spec_permission.trip_text_dashboard = trip_text_dashboard;
                                spec_permission.vehicle_nearby = vehicle_nearby;
                                spec_permission.vehicle_utilization =vehicle_utilization;
                                spec_permission.gps_integration =gps_integration;
                                spec_permission.fleet_performance =fleet_performance;
                                spec_permission.schedule_dashboard =schedule_dashboard;
                            }
                            ///Specific Permission end
                            resData.Data=data;
                            resData.specific_permission =spec_permission;
                            resData.AccessMenu=accessMenu;
                            resData.Status="success";
                            res.status(200).json(resData);
                        }
                    }
                    else{
                        
                        err = "Invalid username or password.";
                        resData.Message= err;
                        res.status(200).json(resData);
                    }
                }
            }
            else
            {
                err="Session Expired";
                if(auth)
                {
                    err = auth.remark; 
                }   
                
                resData.Message= err;
                res.status(200).json(resData);
              
            }   
               
            
        } 
       catch (error) {
        console.error('Error fetching alert:', error);
        res.status(500).json({ message: 'Internal Server Error' });
      }
    
    };

exports.logout = async(req, res) => {
    try {
        let resData={};
        resData.Status="fail";
        const {AccessToken} =req.body;
        //console.log(AccessToken);process.exit(0);
        const logoutdata = await logoutAuthorizedAccessWeb(AccessToken);
        resData.Data=logoutdata;
        resData.Status="success";
        res.status(200).json(resData);
        //console.log(res);process.exit(0);
    } catch (error) {
        console.error('Error fetching alert:', error);
        res.status(500).json({ message: 'Internal Server Error' });  
    }
}

exports.filterCV = async(req, res) =>{
    
    try{
        // const {AccessToken,RouteType,RouteCategory,Origin,Destination,Route,Region,Delay,TripDetails} = req.body;
        const {AccessToken} = req.body;
        
        if(AccessToken!=null){
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            
            /*if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    res.status(200).json(response);
            }
            else*/{
                // const user_id = 5659;
                // const user_id = 152867;
                const user_id = 185301;
                //const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (result.length > 0) {
                    const resultUsr=result[0];
                    const user_id = resultUsr['id'];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name']; 
                    let resData={};
                    
                    // Vehicle Category
                    const vehicleCategory_bin={};
                    const [vehicleCategory] = await db.promise().query("select id,name from vehicle_category where status=1");
                    
                    if(vehicleCategory.length >0 ){
                        vehicleCategory.forEach(row => {                               
                            vehicleCategory_bin[row.id] = row.name;
                        });
                    }

                    // Vehicle Make
                    const vehicleMake_bin={};
                    const [vehicleMake] = await db.promise().query("select id,name from vehicle_make where status=1");

                    if(vehicleMake.length >0){
                        vehicleMake.forEach(row => {                               
                            vehicleMake_bin[row.id] = row.name;
                        });
                    }

                    // Vehicle Model
                    const vehicleModel_bin={};
                    const [vehicleModel] = await db.promise().query('select id,model_number from vehicle_model where status=1');

                    if(vehicleModel.length >0){
                        vehicleModel.forEach(row => {                               
                            vehicleModel_bin[row.id] = row.model_number;
                        });
                    }
                    
                    // Vehicle Types
                    const vehicleBodyType_bin={};
                    const [vehicleBodyType] = await db.promise().query('select id,name from vehicle_types where status=1');

                    if(vehicleBodyType.length >0){
                        vehicleBodyType.forEach(row => {                               
                            vehicleBodyType_bin[row.id] = row.name;
                        });
                    }

                    // Vehicle Capacity
                    const vehicleCapacity_bin={};
                    const [vehicleCapacity] = await db.promise().query('select id,capacity from vehicle_capacity where status=1');

                    if(vehicleCapacity.length >0){
                        vehicleCapacity.forEach(row => {                               
                            vehicleCapacity_bin[row.id] = row.capacity;
                        });
                    }

                    // Vehicle Fuel Type
                    const vehicleFuelType_bin={};
                    const [vehicleFuelType] = await db.promise().query('select id,name from fuel_type where status=1');

                    if(vehicleFuelType.length >0){
                        vehicleFuelType.forEach(row => {                               
                            vehicleFuelType_bin[row.id] = row.name;
                        });
                    }

                    // Vehicle Documnet Types
                    const vehicleDocumentType_bin={};
                    const [vehicleDocumentType] = await db.promise().query('select id,name from document_types where status=1 and category="vehicle"');

                    if(vehicleDocumentType.length >0){
                        vehicleDocumentType.forEach(row => {                               
                            vehicleDocumentType_bin[row.id] = row.name;
                        });
                    }
                    
                    // Vehicle Cv_Feature_Master
                    const vehicleFeature_bin={};
                    const [vehicleFeature] = await db.promise().query("select id,name from cv_feature_master where status=1");

                    if(vehicleFeature.length >0){
                        vehicleFeature.forEach(row => {                               
                            vehicleFeature_bin[row.id] = row.name;
                        });
                    }
                    
                    // Vehicle Cv_Vehicle_Size
                    const vehicleSize_bin={};
                    const [vehicleSize] = await db.promise().query("select id,size from cv_vehicle_size where status=1");

                    if(vehicleSize.length >0){
                        vehicleSize.forEach(row => {                               
                            vehicleSize_bin[row.id] = row.size;
                        });
                    }
                    
                    let transporter_ids = null;
                    let transporters_bin = [];
                    let transporter = {};
                    
                    if(user_type == 6){

                        if(group_type == 32){                                           
                            let [transporterId_Result] = await db.promise().query(`select type_detail_id from cv_customer_assignment where status=1 and user_id = ${user_id}`);
                            
                            if(transporterId_Result.length >0){                                
                                transporter_ids = transporterId_Result.map(item => item.type_detail_id).join(',');
                            }
                            
                        }else{                            
                            // transporterId_Result = await db.promise().query(`select transporter_id,customer_group_id from transporter_customer_assiginment where status=1 and customer_group_id=${group_id}`);
                            let[transporterId_Result] = await db.promise().query(`select transporter_id from transporter_customer_assiginment where status=1 and customer_group_id=0170`);
                            if(transporterId_Result.length >0){                                
                                transporter_ids = transporterId_Result.map(item => item.transporter_id).join(',');
                            }
                        }
                        
                        if(group_type == 20){
                            [transporters_bin] = await db.promise().query(`select id,name from transporters where status=1 and group_id = ${group_id}`);
                        }else{
                            [transporters_bin] = await db.promise().query(`select id,name from transporters where status=1 and id IN(${transporter_ids})`);
                            }

                        if(transporters_bin.length >0){
                            transporters_bin.forEach(row => {                               
                                transporter[row.id] = row.name;
                            });
                        }
                    }

                    let data={};

                    data.category=vehicleCategory_bin;
                    data.make = vehicleMake_bin;
                    data.model = vehicleModel_bin;
                    data.vehicle_type = vehicleBodyType_bin;
                    data.vehicle_capacity = vehicleCapacity_bin;
                    data.vehicle_fuel_type = vehicleFuelType_bin;
                    data.vehicle_document_type =vehicleDocumentType_bin;
                    data.vehicle_feature =vehicleFeature_bin;
                    data.vehicle_size =vehicleSize_bin;
                    data.transporters =transporter;
                    
                    resData.Status="success";                    
                    resData.Message="Data Fetched Successfully";                    
                    resData.Data=data;
                    res.status(200).json(resData);                    
                }                
                res.status(200).json("Invalid User");
            }
        }else{
            res.status(501).json("payload missing");
        }
    }catch(error){
        res.status(500).json({error: error.message});
    }
}

exports.filterCV = async(req, res) =>{
    
    try{
        // const {AccessToken,RouteType,RouteCategory,Origin,Destination,Route,Region,Delay,TripDetails} = req.body;
        const {AccessToken} = req.body;
        
        if(AccessToken!=null){
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            
            /*if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    res.status(200).json(response);
            }
            else*/{
                // const user_id = 5659;
                // const user_id = 152867;
                const user_id = 185301;
                //const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (result.length > 0) {
                    const resultUsr=result[0];
                    const user_id = resultUsr['id'];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name']; 
                    let resData={};
                    
                    // Vehicle Category
                    const vehicleCategory_bin={};
                    const [vehicleCategory] = await db.promise().query("select id,name from vehicle_category where status=1");
                    
                    if(vehicleCategory.length >0 ){
                        vehicleCategory.forEach(row => {                               
                            vehicleCategory_bin[row.id] = row.name;
                        });
                    }

                    // Vehicle Make
                    const vehicleMake_bin={};
                    const [vehicleMake] = await db.promise().query("select id,name from vehicle_make where status=1");

                    if(vehicleMake.length >0){
                        vehicleMake.forEach(row => {                               
                            vehicleMake_bin[row.id] = row.name;
                        });
                    }

                    // Vehicle Model
                    const vehicleModel_bin={};
                    const [vehicleModel] = await db.promise().query('select id,model_number from vehicle_model where status=1');

                    if(vehicleModel.length >0){
                        vehicleModel.forEach(row => {                               
                            vehicleModel_bin[row.id] = row.model_number;
                        });
                    }
                    
                    // Vehicle Types
                    const vehicleBodyType_bin={};
                    const [vehicleBodyType] = await db.promise().query('select id,name from vehicle_types where status=1');

                    if(vehicleBodyType.length >0){
                        vehicleBodyType.forEach(row => {                               
                            vehicleBodyType_bin[row.id] = row.name;
                        });
                    }

                    // Vehicle Capacity
                    const vehicleCapacity_bin={};
                    const [vehicleCapacity] = await db.promise().query('select id,capacity from vehicle_capacity where status=1');

                    if(vehicleCapacity.length >0){
                        vehicleCapacity.forEach(row => {                               
                            vehicleCapacity_bin[row.id] = row.capacity;
                        });
                    }

                    // Vehicle Fuel Type
                    const vehicleFuelType_bin={};
                    const [vehicleFuelType] = await db.promise().query('select id,name from fuel_type where status=1');

                    if(vehicleFuelType.length >0){
                        vehicleFuelType.forEach(row => {                               
                            vehicleFuelType_bin[row.id] = row.name;
                        });
                    }

                    // Vehicle Documnet Types
                    const vehicleDocumentType_bin={};
                    const [vehicleDocumentType] = await db.promise().query('select id,name from document_types where status=1 and category="vehicle"');

                    if(vehicleDocumentType.length >0){
                        vehicleDocumentType.forEach(row => {                               
                            vehicleDocumentType_bin[row.id] = row.name;
                        });
                    }
                    
                    // Vehicle Cv_Feature_Master
                    const vehicleFeature_bin={};
                    const [vehicleFeature] = await db.promise().query("select id,name from cv_feature_master where status=1");

                    if(vehicleFeature.length >0){
                        vehicleFeature.forEach(row => {                               
                            vehicleFeature_bin[row.id] = row.name;
                        });
                    }
                    
                    // Vehicle Cv_Vehicle_Size
                    const vehicleSize_bin={};
                    const [vehicleSize] = await db.promise().query("select id,size from cv_vehicle_size where status=1");

                    if(vehicleSize.length >0){
                        vehicleSize.forEach(row => {                               
                            vehicleSize_bin[row.id] = row.size;
                        });
                    }
                    
                    let transporter_ids = null;
                    let transporters_bin = [];
                    let transporter = {};
                    
                    if(user_type == 6){

                        if(group_type == 32){                                           
                            let [transporterId_Result] = await db.promise().query(`select type_detail_id from cv_customer_assignment where status=1 and user_id = ${user_id}`);
                            
                            if(transporterId_Result.length >0){                                
                                transporter_ids = transporterId_Result.map(item => item.type_detail_id).join(',');
                            }
                            
                        }else{                            
                            // transporterId_Result = await db.promise().query(`select transporter_id,customer_group_id from transporter_customer_assiginment where status=1 and customer_group_id=${group_id}`);
                            let[transporterId_Result] = await db.promise().query(`select transporter_id from transporter_customer_assiginment where status=1 and customer_group_id=0170`);
                            if(transporterId_Result.length >0){                                
                                transporter_ids = transporterId_Result.map(item => item.transporter_id).join(',');
                            }
                        }
                        
                        if(group_type == 20){
                            [transporters_bin] = await db.promise().query(`select id,name from transporters where status=1 and group_id = ${group_id}`);
                        }else{
                            [transporters_bin] = await db.promise().query(`select id,name from transporters where status=1 and id IN(${transporter_ids})`);
                            }

                        if(transporters_bin.length >0){
                            transporters_bin.forEach(row => {                               
                                transporter[row.id] = row.name;
                            });
                        }
                    }

                    let data={};

                    data.category=vehicleCategory_bin;
                    data.make = vehicleMake_bin;
                    data.model = vehicleModel_bin;
                    data.vehicle_type = vehicleBodyType_bin;
                    data.vehicle_capacity = vehicleCapacity_bin;
                    data.vehicle_fuel_type = vehicleFuelType_bin;
                    data.vehicle_document_type =vehicleDocumentType_bin;
                    data.vehicle_feature =vehicleFeature_bin;
                    data.vehicle_size =vehicleSize_bin;
                    data.transporters =transporter;
                    
                    resData.Status="success";                    
                    resData.Message="Data Fetched Successfully";                    
                    resData.Data=data;
                    res.status(200).json(resData);                    
                }                
                res.status(200).json("Invalid User");
            }
        }else{
            res.status(501).json("payload missing");
        }
    }catch(error){
        res.status(500).json({error: error.message});
    }
}

exports.vehicleDashboard = async(req, res) =>{
    
    try{
        // console.log('AccessToken');process.exit(0);
        const {AccessToken,from_date,to_date,customer_id} = req.body;
        
        if(AccessToken!=null){
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            
            /*if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    res.status(200).json(response);
            }
            else*/{
                // const user_id = 5659; //BluedartMaster
                // const user_id = 152867; //MasterCV
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                const user_id = 153169; //Transporter
                //const user_id = user_info.AccountId;
                const [response] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (response.length > 0) {
                    
                    const resultUsr=response[0];
                    const user_id = resultUsr['id'];
                    const user_type= resultUsr['user_type'];
                    // const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    // const name= resultUsr['name']; 
                    let resData={};

                    const Is_all_data = !from_date || !to_date ? 'no' : 'yes';
                    const fromDate = from_date ? `${from_date} 00:00:00` : null;
                    const toDate = to_date ? `${to_date} 23:59:59` : null;
                    // console.log(Is_all_data);
                    
                    let customer_filter = {};
                    let transporter = null;
                    let input_transporter = null;
                    let customerFilter = {};

                    // console.log(user_type,group_id, group_type);process.exit(0);
                    if (user_type === 10) {
                        const [LRA_TId_qry_data] = await db.promise().query(`SELECT * FROM logistic_role_assignment WHERE status = 1 AND user_id=${user_id}`);        
                        if (!LRA_TId_qry_data.length) return res.status(400).json({ Status: 'Fail', Message: 'Transporter id not available' });                        
                        transporter = LRA_TId_qry_data[0].type_detail_id;
                    } else {
                        if (group_type === 32) {
                            const [CVCA_qrydata] = await db.promise().query(`SELECT * FROM cv_customer_assignment WHERE status=1 AND user_id=${user_id} AND type_detail='Transporter'`);
                            transporter = CVCA_qrydata.map(item => item.type_detail_id).join(',');    
                            // console.log(transporter);                        
                        } else {
                            // console.log(`SELECT * FROM transporter_customer_assiginment WHERE status=1 AND customer_group_id=${group_id}`);
                            // const [TCA_qry_data] = await db.promise().query(`SELECT * FROM transporter_customer_assiginment WHERE status=1 AND customer_group_id=${group_id}`);
                            const [TCA_qry_data] = await db.promise().query(`select tca.transporter_id AS transporter_id, t.name AS transporter_name from transporter_customer_assiginment AS tca LEFT JOIN transporters AS t ON tca.transporter_id = t.id AND tca.status=1 AND tca.customer_group_id=${group_id} AND t.status=1`);
                            transporter = TCA_qry_data.map(item => item.transporter_id).join(',');

                            TCA_qry_data.forEach(value => {
                                customerFilter[value.transporter_id] = value.transporter_name;
                            });
                        }
                        
                    }                    
                    
                    // const [VTA_qry_data] = await db.promise().query(`SELECT * FROM vehicle_transporter_assignment WHERE status=1 AND transporter_id IN(${input_transporter || transporter})${Is_all_data === 'no' ? ` AND create_date BETWEEN '${fromDate}' AND '${toDate}'` : ''}`);
                    vta_qry = '';
                    doc_qry = '';
                    if(Is_all_data === 'yes'){
                        // vta_qry =  `SELECT * FROM vehicle_transporter_assignment WHERE status=1 AND transporter_id IN(${transporter}) AND create_date BETWEEN '${fromDate}' AND '${toDate}'`;
                        vta_qry = `SELECT vta.id AS id, vta.transporter_id AS transporter_id, vta.vehicle_id AS vehicle_id, t.name AS transporter_name FROM vehicle_transporter_assignment AS vta LEFT JOIN transporters AS t ON vta.transporter_id = t.id WHERE vta.status=1 AND vta.transporter_id IN(${transporter}) AND vta.create_date BETWEEN '${fromDate}' AND '${toDate}'`;
                    }else{
                        // vta_qry = `SELECT * FROM vehicle_transporter_assignment WHERE status=1 AND transporter_id IN(${transporter})`;
                        vta_qry = `SELECT vta.id AS id, vta.transporter_id AS transporter_id, vta.vehicle_id AS vehicle_id, t.name AS transporter_name FROM vehicle_transporter_assignment AS vta LEFT JOIN transporters AS t ON vta.transporter_id = t.id WHERE vta.status=1 AND vta.transporter_id IN(${transporter})`;
                    }
                    const [VTA_qry_data] = await db.promise().query(vta_qry);
                    
                    
                    if (!VTA_qry_data.length) return res.status(400).json({ Status: 'Fail', Message: 'Data not available' });
                    // console.log(VTA_qry_data);
                    
                    // const current_date = dateToday().replace(day => 1);
                    // console.log(current_date);process.exit(0);
                    // const FDOPM = current_date - relativedelta(months=1);

                    let formatDate = (date) => {
                        return date.format('YYYY-MM-DD HH:mm:ss');
                    };

                    const currentDate = currentDateTime.clone().startOf('month');
                    const FDOPM = formatDate(currentDate.clone().subtract(1, 'month'));
                    let new_vehicle = 0, existing_vehicle = 0;
                    
                    // VTA_qry_data.forEach(item => item.create_date >= FDOPM ? new_vehicle++ : existing_vehicle++);
                    // vehicle = {"new_vehicle":new_vehicle, "existing_vehicle":existing_vehicle}
                    let veh_to_trans = {};

                    VTA_qry_data.forEach(value => {
                        value.create_date >= FDOPM ? new_vehicle++ : existing_vehicle++;                       

                        veh_to_trans[value.vehicle_id] = { id: value.transporter_id, name: value.transporter_name };
                        vehicle = {"new_vehicle":new_vehicle, "existing_vehicle":existing_vehicle}
                    });
                    
                    const vehicle_ids = VTA_qry_data.map(item => item.vehicle_id);
                    
                    const vehicleChunks = chunkArray(vehicle_ids, 50);
                    let Vehicle_qry_data = [];
                    let Document_qry_data = [];

                    for (const chunk of vehicleChunks) {
                        const v_ids = chunk.join(',');
                        
                        // const [Vehicle_qry] = await db.promise().query(`SELECT * FROM vehicle WHERE id IN (${v_ids}) AND status IN(1,2)`);
                        const [Vehicle_qry] = await db.promise().query(
                            `SELECT 
                                v.id AS id,
                                v.transporter_id AS transporter_id,
                                v.vehicle_category_id AS vehicle_category_id,
                                v.vehicle_make_id AS vehicle_make_id,
                                v.vehicle_model_id AS vehicle_model_id,
                                v.vehicle_number AS vehicle_number,
                                v.tank_capacity AS tank_capacity,
                                v.vehicle_capacity_tons AS vehicle_capacity_tons,
                                v.max_speed AS max_speed,
                                v.registration_no AS registration_no,
                                v.registration_date AS registration_date,
                                v.insured_name AS insured_name,
                                v.insurance_no AS insurance_no,
                                v.insurance_validity AS insurance_validity,
                                v.pollution_no AS pollution_no,
                                v.pollution_date AS pollution_date,
                                v.road_tax_no AS road_tax_no,
                                v.road_tax_date AS road_tax_date,
                                v.permit_type AS permit_type,
                                v.permit_type_date AS permit_type_date,
                                v.fitness_no AS fitness_no,
                                v.fitness_date AS fitness_date,
                                v.others_type AS others_type,
                                v.others_date AS others_date,
                                v.is_refrigrated AS is_refrigrated,
                                v.is_door_close AS is_door_close,
                                v.is_gps AS is_gps,
                                v.is_fixed_door_e_lock AS is_fixed_door_e_lock,
                                v.is_tarpaulin AS is_tarpaulin,
                                v.vehicle_type AS vehicle_type,
                                v.body_type_id AS body_type_id,
                                v.vehicle_size AS vehicle_size,
                                v.status AS status,
                                v.fuel_type AS fuel_type,
                                t.name AS transporter_name,
                                vc.name AS vehicle_category_name,
                                vm.name AS vehicle_make_name,
                                vmodel.model_number AS vehicle_model_number,
                                vt.name AS vehicle_type_name,
                                vs.size AS vehicle_size 
                            FROM vehicle AS v
                            LEFT JOIN transporters AS t 
                                ON v.transporter_id = t.id AND t.status = 1
                            LEFT JOIN vehicle_category AS vc 
                                ON v.vehicle_category_id = vc.id AND vc.status = 1
                            LEFT JOIN vehicle_make AS vm 
                                ON v.vehicle_make_id = vm.id AND vm.status = 1
                            LEFT JOIN vehicle_model AS vmodel 
                                ON v.vehicle_model_id = vmodel.id AND vmodel.status = 1
                            LEFT JOIN vehicle_types AS vt 
                                ON v.vehicle_type = vt.id AND vt.status = 1
                            LEFT JOIN cv_vehicle_size AS vs 
                                ON v.vehicle_size = vs.id AND vs.status = 1
                            LEFT JOIN fuel_type AS ft 
                                ON v.fuel_type = ft.id AND ft.status = 1
                            WHERE 
                            v.id IN (${v_ids}) AND v.status IN(1,2);

                        `);
                        // console.log(Vehicle_qry);
                        // const [Document_qry] = await db.promise().query(`SELECT * FROM documents WHERE vehicle_id IN (${v_ids}) AND status IN(1,2)${Is_all_data === 'no' ? ` AND create_date BETWEEN '${fromDate}' AND '${toDate}'` : ''}`);
                        // const [Document_qry] = await db.promise().query(`SELECT * FROM documents WHERE vehicle_id IN (${v_ids}) AND status IN(1,2)${Is_all_data === 'no' ? ` AND create_date BETWEEN '${fromDate}' AND '${toDate}'` : ''}`);
                        // const veh_data = await selectDBQueryKeyValue(mydb, Vehicle_qry);
                        
                        Vehicle_qry_data = [...Vehicle_qry_data, ...Vehicle_qry];
                        
                        doc_qry = '';
                        if(Is_all_data === 'yes'){
                            doc_qry =  `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, doc.issue_date, doc.expiry_date, doc.file_path, doc.status FROM documents AS doc LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id WHERE doc.status IN(1,2) AND doct.status = 1 AND doc.vehicle_id IN(${v_ids}) AND doc.create_date BETWEEN '${fromDate}' AND '${toDate}'`;
                        }else{
                            doc_qry = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, doc.issue_date, doc.expiry_date, doc.file_path, doc.status FROM documents AS doc LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id WHERE doc.status IN(1,2) AND doct.status = 1 AND doc.vehicle_id IN(${v_ids})`;
                        }
                        
                        const [Document_qry] = await db.promise().query(doc_qry);
                        if(Document_qry){
                            Document_qry_data = [...Document_qry_data, ...Document_qry];
                        }
                        
                    }
                    
                    // const [Document_qry_data] = await db.promise().query(`SELECT * FROM documents WHERE vehicle_id IN (${vehicle_ids.join(',')}) AND status IN(1,2)${Is_all_data === 'no' ? ` AND create_date BETWEEN '${from_date}' AND '${to_date}'` : ''}`);
                    // const Document_qry_data = await selectDBQueryKeyValue(mydb, Document_qry);
                    
                    const data_document = Document_qry_data.reduce((acc, doc) => {
                        acc[doc.vehicle_id] = acc[doc.vehicle_id] || [];
                        acc[doc.vehicle_id].push(doc);
                        return acc;
                    }, {});
                    
                    const data_vehicle = Vehicle_qry_data.map(vehicle => ({                        
                        vehicle,
                        document: data_document[vehicle.id] || [],
                        cust_data: customer_filter[vehicle.transporter_id] || {}
                    }));
                    
                    let closed_body = 0;
                    let open_body = 0;
                    let container_body = 0;

                    

                    data_vehicle.forEach(value => {
                        if (value.body_type_id === 1) {
                            closed_body++;
                        } else if (value.body_type_id === 2) {
                            open_body++;
                        } else if (value.body_type_id === 3 || value.body_type_id === 4) {
                            container_body++;
                        }

                        let cust_data = {};
                        if (user_type !== '10') {
                            if (veh_to_trans[value.id]) {
                                cust_data = veh_to_trans[value.id];
                            }
                        }

                        let features = {
                            '1': value.is_fixed_door_e_lock || 0,
                            '2': value.is_gps || 0,
                            '3': value.is_dual_driver || 0,
                            '4': value.is_fire_extinguisher || 0,
                            '5': value.is_portable_e_lock || 0,
                            '6': value.is_tarpaulin || 0
                        };
                        
                        if (Object.keys(features).length) {
                            value.features = features;
                        }
                        
                        data_vehicle.push({
                            vehicle: value,
                            cust_data: cust_data
                        });
                        // console.log(data_vehicle);process.exit(0);
                    });
                    
                    
                    let vehicle_data = {};
                    const report_data = {
                        vehicles: { new_vehicle, existing_vehicle },
                        body_type :{ closed_body, open_body, container: container_body },
                        vehicle_rating: {"less_than_two":8300,"two_to_four":2500,"more_than_four":250},
                        listing_data: { vehicle_data: data_vehicle}
                    };
                    // console.log(JSON.stringify(report_data, null, 2));process.exit(0);
                    resData.Status="success";                    
                    resData.Message="Data Fetched Successfully";                    
                    resData.Data=report_data;
                    res.status(200).json(resData); 
                }                    
                    
                    
                res.status(200).json("Invalid User");
            }
        }else{
            res.status(501).json("payload missing");
        }
    }catch(error){
        res.status(500).json({error: error.message});
    }
}

exports.uploadMedia = async (req, res) => {
    let resData = {};
    resData.status = "fail";
    const { DeviceID, DateTime, Coord, Alert } = req.body;
    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
   

    try {
        if (DeviceID ) {
            if (!req.files || req.files.length === 0) {
                resData.message = "File not found";
                console.log("File Not Found");
                return res.status(400).json(resData); 
            }

            const filePath = req.files[0].path;
            const bucketName = 'itrackreport';
            // const s3Directory = "cv_tripManagement/DriverVehicleDocument";
            const s3Directory = "upload/files/";
            
            try {
                
                const uploadingResponse = await uploadS3(bucketName, filePath, s3Directory);
                const s3Url = `https://s3.amazonaws.com/${bucketName}/${s3Directory}/${req.files[0].filename}`;

                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error("Error deleting file:", err);
                    } else {
                        console.log("File successfully deleted from server:", filePath);
                    }
                });
                console.log("Uploading Response:", uploadingResponse, "S3 URL:", s3Url);

                if (uploadingResponse === "success") {
                    console.log("File Uploaded to S3 at:", s3Url);
                    const currentDateTime = moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");
                    

                    resData.status = "success";
                    resData.message = "Image uploaded successfully";
                    resData.data = s3Url;
                    return res.status(200).json(resData);
                    
                } else {
                    resData.message = "Image not uploaded";
                    return res.status(500).json(resData); 
                }
            } catch (uploadError) {
                console.error("Error uploading to S3:", uploadError);
                resData.message = "Error uploading file to S3";
                return res.status(500).json(resData); 
            }
        } else {
            resData.message = "Payload Missing";
            return res.status(400).json(resData); 
        }
    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({ error: error.message }); 
    }
};

exports.vehicleAdd = async(req, res) =>{
    
    try{
        // console.log('AccessToken');process.exit(0);
        const {AccessToken,vehicle_data} = req.body;
       
        if(AccessToken !== null){
            
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            
            /*if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    res.status(200).json(response);
            }
            else*/{
                // const user_id = 5659; //BluedartMaster
                // const user_id = 152867; //MasterCV
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter
                const user_id = 156925; //customer grouptype=32
                //const user_id = user_info.AccountId;
                const [response] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                const jsonStr = vehicle_data;
                
                if (response.length > 0) {
                    
                    const resultUsr=response[0];
                    const user_id = resultUsr['id'];
                    const user_type= resultUsr['user_type'];
                    // const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];                    
                    // const name= resultUsr['name']; 

                    let inputData;
                    try {
                        inputData = JSON.parse(jsonStr);
                    } catch (error) {
                        console.error('Error parsing JSON:', error);
                    }

                    const vehicleNumber = inputData.vehicle_no.toUpperCase();
                    const registration_no = inputData.registration_no.toUpperCase();

                    const isVehicle = await validateVehicleNo(vehicleNumber);
                    
                    if (isVehicle) {
                        return res.status(400).json({ Status: "Fail", Message: "Vehicle already exists in the database" });
                    }
                    
                    // Extract vehicle details from inputData
                    const {
                        category: category,
                        make: make,
                        model: model,
                        vehicle_type: vehicle_type,
                        registeration_date: registeration_date,
                        vehicle_capacity: vehicle_capacity,
                        fuel_type: fuel_type,
                        over_speed_limit: over_speed_limit,
                        vehicle_feature: vehicleFeatures,
                        vehicle_size: vehicle_size,
                        transporter_id: transporter_id
                    } = inputData;
                    
                    // Extract vehicle features
                    const {
                        "1": elock,
                        "2": gps,
                        "3": dualDriver,
                        "4": fireExtinguisher,
                        "5": portableElock,
                        "6": tarpaulin
                    } = vehicleFeatures;

                    const status = 1;
                    const createDate = moment().format('YYYY-MM-DD HH:mm:ss');
                    const createId = user_id;

                    // Insert vehicle into the database
                    const sql = `
                        INSERT INTO vehicle (
                            transporter_id,vehicle_category_id, vehicle_make_id, vehicle_model_id, vehicle_number, body_type_id, 
                            registration_no, registration_date, vehicle_capacity_tons, fuel_type, max_speed, 
                            is_fixed_door_e_lock, is_gps, is_dual_driver, is_fire_extinguisher, is_portable_e_lock, 
                            is_tarpaulin, vehicle_size, status, create_id, create_date
                        ) VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    const values = [
                        transporter_id, category, make, model, vehicleNumber, vehicle_type, registration_no, registeration_date,
                        vehicle_capacity, fuel_type, over_speed_limit, elock, gps, dualDriver, fireExtinguisher,
                        portableElock, tarpaulin, vehicle_size, status, createId, createDate
                    ];                    
                    
                    const [insertResult] = await db.promise().query(sql, values);
                    
                    if (insertResult.affectedRows > 0) {
                        const addedVehicleId = insertResult.insertId;
                        
                        // Handle transporter assignment based on account type
                        
                        if (user_type === 10) {
                            
                            // Logic for account type 10
                            const [logisticRole] = await db.promise().query(
                                'SELECT type_detail_id FROM logistic_role_assignment WHERE user_id = ?',
                                [createId]
                            );
                            
                            if (logisticRole.length === 0) {
                                return res.status(400).json({ Status: "Fail", Message: "Transporter ID not available in Logistic Role Assignment Table" });
                            }
        
                            const transporter = logisticRole[0].type_detail_id;
                            
                            const mappingSql = `
                                INSERT INTO vehicle_transporter_assignment (
                                    vehicle_id, transporter_id, group_id, status, create_date, create_id
                                ) VALUES (?, ?, ?, ?, ?, ?)
                            `;
                            const mappingValues = [addedVehicleId, transporter, group_id, status, createDate, createId];
        
                            const [mappingResult] = await db.promise().query(mappingSql, mappingValues);
        
                            if (mappingResult.affectedRows > 0) {
                                return res.status(200).json({
                                    Status: "Data Added Successfully",
                                    Vehicle_id: addedVehicleId,
                                    Mapping_id: mappingResult.insertId
                                });
                            } else {
                                return res.status(500).json({ Status: "Fail", Message: "Failed to map vehicle to transporter" });
                            }
                        } else {
                            // Logic for other account types
                            let userMappingId = null;

                            if (!group_type == '32') {
                                
                                const userMappingSql = `
                                    INSERT INTO vehice_user_mapping (
                                        user_id, vehicle_id, status, create_date, create_id
                                    ) VALUES (?, ?, ?, ?, ?)
                                `;

                                const userMappingValues = [createId, addedVehicleId, status, createDate, createId];
        
                                const [userMappingResult] = await db.promise().query(userMappingSql, userMappingValues);
                                userMappingId = userMappingResult.insertId;
                            }
                            
                            const transporterAssignmentSql = `
                                INSERT INTO vehicle_transporter_assignment (
                                    vehicle_id, transporter_id, status, create_date, create_id
                                ) VALUES (?, ?, ?, ?, ?)
                            `;

                            const transporterAssignmentValues = [addedVehicleId, transporter_id, status, createDate, createId];
        
                            const [transporterAssignmentResult] = await db.promise().query(transporterAssignmentSql, transporterAssignmentValues);
        
                            if (transporterAssignmentResult.affectedRows > 0) {
                                return res.status(200).json({
                                    Status: "Data Added Successfully",
                                    Vehicle_id: addedVehicleId,
                                    User_Mapping_id: userMappingId,
                                    Vehicle_transporter_assignment_id: transporterAssignmentResult.insertId
                                });
                            } else {
                                return res.status(500).json({ Status: "Fail", Message: "Failed to assign vehicle to transporter" });
                            }
                        }
                    } else {
                        return res.status(500).json({ Status: "Fail", Message: "Failed to add vehicle" });
                    }                     
                }   
                res.status(200).json("Invalid User");
            }
        }else{
            res.status(501).json("payload missing");
        }
    }catch(error){
        res.status(500).json({error: error.message});
    }
}

exports.vehicleEdit = async(req, res) =>{
    
    try{
        // console.log('AccessToken');process.exit(0);
        const {AccessToken,vehicle_data} = req.body;
       
        if(AccessToken !== null){
            
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            
            /*if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    res.status(200).json(response);
            }
            else*/{
                // const user_id = 5659; //BluedartMaster
                // const user_id = 152867; //MasterCV
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter
                const user_id = 156925; //customer grouptype=32
                //const user_id = user_info.AccountId;
                const [response] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                const jsonStr = vehicle_data;
                
                if (response.length > 0) {
                    
                    const resultUsr=response[0];
                    const user_id = resultUsr['id'];
                    const user_type= resultUsr['user_type'];
                    // const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];                    
                    // const name= resultUsr['name']; 

                    // Parse the JSON string in vehicle_data
                    let inputData;
                    try {
                        inputData = JSON.parse(jsonStr);
                    } catch (error) {
                        console.error('Error parsing JSON:', error);
                    }

                    const vehicleNumber = inputData.vehicle_no.toUpperCase();
                    const registration_no = inputData.registration_no.toUpperCase();
                    const vehicleId = inputData.id;
                    

                    const isVehicle = await validateVehicleNo(vehicleNumber, vehicleId);
                    
                    if (isVehicle) {
                        return res.status(400).json({ Status: "Fail", Message: "Vehicle already exists in the database" });
                    }
                    
                    // Extract vehicle details from inputData
                    const {
                        category: category,
                        make: make,
                        model: model,
                        vehicle_type: vehicle_type,
                        registeration_date: registeration_date,
                        vehicle_capacity: vehicle_capacity,
                        fuel_type: fuel_type,
                        over_speed_limit: over_speed_limit,
                        vehicle_feature: vehicleFeatures,
                        vehicle_size: vehicle_size,
                        transporter_id: transporter_id
                    } = inputData;
                    
                    // Extract vehicle features
                    const {
                        "1": elock,
                        "2": gps,
                        "3": dualDriver,
                        "4": fireExtinguisher,
                        "5": portableElock,
                        "6": tarpaulin
                    } = vehicleFeatures;

                    const status = 1;
                    const editDate = moment().format('YYYY-MM-DD HH:mm:ss');
                    const editId = user_id;

                    // Update vehicle in the database
                    const sql = `
                        UPDATE vehicle SET 
                            vehicle_category_id = ?, vehicle_make_id = ?, vehicle_model_id = ?, 
                            vehicle_number = ?, body_type_id = ?, registration_no = ?, 
                            registration_date = ?, vehicle_capacity_tons = ?, fuel_type = ?, 
                            max_speed = ?, is_fixed_door_e_lock = ?, is_gps = ?, 
                            is_dual_driver = ?, is_fire_extinguisher = ?, is_portable_e_lock = ?, 
                            is_tarpaulin = ?, vehicle_size = ?, status = ?, edit_id = ?, edit_date = ? 
                        WHERE id = ?
                    `;
                    const values = [
                        category, make, model, vehicleNumber, vehicle_type, registration_no, registeration_date,
                        vehicle_capacity, fuel_type, over_speed_limit, elock, gps, dualDriver, fireExtinguisher,
                        portableElock, tarpaulin, vehicle_size, status, editId, editDate, vehicleId
                    ];                    
                    
                    const [updateResult] = await db.promise().query(sql, values);

                    if (updateResult.affectedRows > 0) {
                        return res.status(200).json({ Status: "Success", Message: "Vehicle updated successfully" });
                    } else {
                        return res.status(500).json({ Status: "Fail", Message: "Failed to update vehicle" });
                    }                   
                }   
                res.status(200).json("Invalid User");
            }
        }else{
            res.status(501).json("payload missing");
        }
    }catch(error){
        res.status(500).json({error: error.message});
    }
}

exports.vehicleAction = async(req, res) =>{
    
    try{
        // console.log('AccessToken');process.exit(0);
        const {AccessToken,vehicle_id,action} = req.body;
       
        if(AccessToken !== null){
            
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            
            /*if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    res.status(200).json(response);
            }
            else*/{
                // const user_id = 5659; //BluedartMaster
                // const user_id = 152867; //MasterCV
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter
                const user_id = 156925; //customer grouptype=32
                //const user_id = user_info.AccountId;
                const [response] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                const jsonStr = vehicle_id;
                
                if (response.length > 0) {
                    
                    const resultUsr=response[0];
                    const user_id = resultUsr['id'];
                    const user_type= resultUsr['user_type'];
                    // const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];                    
                    // const name= resultUsr['name']; 

                    // Parse the JSON string in vehicle_data
                    // let inputIds;
                    // try {
                    //     inputIds = JSON.parse(jsonStr);
                    //     // console.log(inputIds);process.exit(0);
                    // } catch (error) {
                    //     console.error('Error parsing JSON:', error);
                    // }

                    // Transform the input into a valid array
                    let cleanedInput = vehicle_id.replace(/[{}]/g, ''); // Remove { and }
                    let idsArray = cleanedInput.split(',').map(id => parseInt(id.trim())); // Convert to array of numbers

                    let status, message;
                    switch (action) {
                        case 'active':
                            status = 1;
                            message = "Data Activated Successfully.";
                            break;
                        case 'de-active':
                            status = 2;
                            message = "Data De-Activated Successfully.";
                            break;
                        case 'delete':
                            status = 0;
                            message = "Data Deleted Successfully.";
                            break;
                        default:
                            return res.status(400).json({ Status: "Fail", Message: "Invalid action" });
                    }
                    
                    

                    const editDate = moment().format('YYYY-MM-DD HH:mm:ss');
                    const editId = user_id;
                    let updatedRowsCount = 0; // Counter for updated rows

                    // Loop through the input IDs and update the status
                    for (let id of idsArray) {
                        ;
                        // Update vehicle status
                        const sqlVehicle = `
                            UPDATE vehicle SET status = ?, edit_id = ?, edit_date = ? WHERE id = ?
                        `;
                        const valVehicle = [status, editId, editDate, id];
                        const [resVehicle] = await db.promise().query(sqlVehicle, valVehicle);

                        // Update documents status
                        const sqlDoc = `
                            UPDATE documents SET status = ?, edit_id = ?, edit_date = ? WHERE vehicle_id = ?
                        `;
                        const valDoc = [status, editId, editDate, id];
                        const [resDoc] = await db.promise().query(sqlDoc, valDoc);

                        // If action is 'delete', update vehicle_transporter_assignment status
                        // if (action === 'delete') {
                        //     const sqlVTA = `
                        //         UPDATE vehicle_transporter_assignment SET status = ?, edit_id = ?, edit_date = ? WHERE vehicle_id = ?
                        //     `;
                        //     const valVTA = [status, editId, editDate, id];
                        //     const [resVTA] = await db.promise().query(sqlVTA, valVTA);
                        // }

                        updatedRowsCount++; // Increment the updated rows counter
                    }

                    // Return success response
                    return res.status(200).json({
                        Status: "Success",
                        Message: message,
                        updated_rows_count: updatedRowsCount
                    });          
                }   
                res.status(200).json("Invalid User");
            }
        }else{
            res.status(501).json("payload missing");
        }
    }catch(error){
        res.status(500).json({error: error.message});
    }
}


// Function to validate if the vehicle already exists
// async function validateVehicleNo(vehicleNumber) {
//     const [result] = await db.promise().query(
//         'SELECT * FROM vehicle WHERE status IN (1, 2) AND vehicle_number = ?',
//         [vehicleNumber]
//     );
//     return result.length > 0;
// }

// Function to validate if the vehicle already exists
async function validateVehicleNo(vehicleNumber, vehicleId = null) {
    let query = 'SELECT * FROM vehicle WHERE status IN (1, 2) AND vehicle_number = ?';
    const queryParams = [vehicleNumber];

    if (vehicleId !== null) {
        query += ' AND id != ?';
        queryParams.push(vehicleId);
    }

    const [result] = await db.promise().query(query, queryParams);
    return result.length > 0;
}

const chunkArray = (array, size) => {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) chunked.push(array.slice(i, i + size));
    return chunked;
};

////////////upload s3 api/////////////

// exports.uploadMedia = async (req, res) => {
    
//     let resData = {};
//     resData.status = "fail";
//     const { DeviceID, DateTime, Coord, Alert } = req.body;
//     const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
   

//     try {
//         if (DeviceID ) {
//             if (!req.files || req.files.length === 0) {
//                 resData.message = "File not found";
//                 console.log("File Not Found");
//                 return res.status(400).json(resData); 
//             }

//             const filePath = req.files[0].path;
//             const bucketName = 'itrackreport';
//             const s3Directory = "cv_tripManagement/DriverVehicleDocument";
            
//             try {
                
//                 const uploadingResponse = await uploadS3(bucketName, filePath, s3Directory);
//                 const s3Url = `https://s3.amazonaws.com/${bucketName}/${s3Directory}/${req.files[0].filename}`;

//                 fs.unlink(filePath, (err) => {
//                     if (err) {
//                         console.error("Error deleting file:", err);
//                     } else {
//                         console.log("File successfully deleted from server:", filePath);
//                     }
//                 });
//                 console.log("Uploading Response:", uploadingResponse, "S3 URL:", s3Url);

//                 if (uploadingResponse === "success") {
//                     console.log("File Uploaded to S3 at:", s3Url);
//                     const currentDateTime = moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");
                    

//                     resData.status = "success";
//                     resData.message = "Image uploaded successfully";
//                     resData.data = s3Url;
//                     return res.status(200).json(resData);
                    
//                 } else {
//                     resData.message = "Image not uploaded";
//                     return res.status(500).json(resData); 
//                 }
//             } catch (uploadError) {
//                 console.error("Error uploading to S3:", uploadError);
//                 resData.message = "Error uploading file to S3";
//                 return res.status(500).json(resData); 
//             }
//         } else {
//             resData.message = "Payload Missing";
//             return res.status(400).json(resData); 
//         }
//     } catch (error) {
//         console.error("Server error:", error);
//         res.status(500).json({ error: error.message }); 
//     }
// };



/////////////////////------------------function-----------------////////////
function xssClean(data) {
    // Fix &entity\n;
    data = data.replace(/(&amp;|&lt;|&gt;)/g, (match) => {
      switch (match) {
        case '&amp;': return '&amp;amp;';
        case '&lt;': return '&amp;lt;';
        case '&gt;': return '&amp;gt;';
      }
    });
  
    data = data.replace(/(&#*\w+)[\x00-\x20]+;/gu, '$1;');
    data = data.replace(/(&#x*[0-9A-F]+);*/giu, '$1;');
    data = decodeHtmlEntities(data);
  
    // Remove any attribute starting with "on" or xmlns
    data = data.replace(/(<[^>]+?[\x00-\x20"'`])(on|xmlns)[^>]*?>/giu, '$1>');
  
    // Remove javascript: and vbscript: protocols
    data = data.replace(
      /([a-z]*)[\x00-\x20]*=[\x00-\x20]*([`'"]*)[\x00-\x20]*j[\x00-\x20]*a[\x00-\x20]*v[\x00-\x20]*a[\x00-\x20]*s[\x00-\x20]*c[\x00-\x20]*r[\x00-\x20]*i[\x00-\x20]*p[\x00-\x20]*t[\x00-\x20]*:/giu,
      '$1=$2nojavascript...'
    );
  
    data = data.replace(
      /([a-z]*)[\x00-\x20]*=([`'"]*)[\x00-\x20]*v[\x00-\x20]*b[\x00-\x20]*s[\x00-\x20]*c[\x00-\x20]*r[\x00-\x20]*i[\x00-\x20]*p[\x00-\x20]*t[\x00-\x20]*:/giu,
      '$1=$2novbscript...'
    );
  
    data = data.replace(
      /([a-z]*)[\x00-\x20]*=([`'"]*)[\x00-\x20]*-moz-binding[\x00-\x20]*:/gu,
      '$1=$2nomozbinding...'
    );
  
    // Remove CSS expressions
    data = data.replace(/(<[^>]+?)style[\x00-\x20]*=[\x00-\x20]*[`'"]*.*?expression[\x00-\x20]*\([^>]*?>/gi, '$1>');
    data = data.replace(/(<[^>]+?)style[\x00-\x20]*=[\x00-\x20]*[`'"]*.*?behaviour[\x00-\x20]*\([^>]*?>/gi, '$1>');
    data = data.replace(
      /(<[^>]+?)style[\x00-\x20]*=[\x00-\x20]*[`'"]*.*?s[\x00-\x20]*c[\x00-\x20]*r[\x00-\x20]*i[\x00-\x20]*p[\x00-\x20]*t[\x00-\x20]*:*[^>]*?>/giu,
      '$1>'
    );
  
    // Remove namespaced elements
    data = data.replace(/<\/*\w+:\w[^>]*?>/gi, '');
  
    let oldData;
    do {
      oldData = data;
      // Remove unwanted tags
      data = data.replace(
        /<\/*(?:applet|b(?:ase|gsound|link)|embed|frame(?:set)?|i(?:frame|layer)|l(?:ayer|ink)|meta|object|s(?:cript|tyle)|title|xml)[^>]*?>/gi,
        ''
      );
    } while (oldData !== data);
  
    return data;
}


// Helper function to decode HTML entities
function decodeHtmlEntities(text) {
    return text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
}
  
async function isAccountSuspend(account_id) {
    const response = {};
  
    const sql = `SELECT remarks FROM account_suspend WHERE status = 1 AND user_id = ${account_id}`;
  
    try {
        const [rows] = await db.promise().query(sql);
        if (rows.length > 0) {
            response.Remark = rows[0].remarks;
        }
        
    } catch (error) {
        console.error('Error fetching alert:', error);
    }  
    return response;
}

async function maintainLoginLog(account_id, ip,login_via) {
    //const current_time = new Date().toISOString().slice(0, 19).replace('T', ' '); // Format: 'YYYY-MM-DD HH:mm:ss'
    const current_time = moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");
    const selectSQL = `SELECT id, times FROM login_logs WHERE status = 1 AND user_id = ${account_id}`;
    let return_val=0;
    try {
        const [rows] = await db.promise().query(selectSQL);
       
        if (rows.length > 0) {
            const { id, times } = rows[0];
            const newTimes = times + 1;
  
            const updateSQL = `UPDATE login_logs SET ip_address = ?, login_device = ?, date = ?, times = ? WHERE id = ?`;
            const [row2] = await db.promise().query(updateSQL, [ip,login_via ,current_time, newTimes, id]);
            
            if(Object.values(row2).length >0){
                return_val=1;
            }

        } else {
            const insertSQL = `INSERT INTO login_logs (user_id, ip_address, login_device, date, times, status) VALUES (?, ?, ?, ?, 1, 1)`;
            const [row2] = await db.promise().query(insertSQL, [account_id, ip,login_via, current_time]);
            
            if(Object.values(row2).length >0){
                return_val=1;
            }

        }
        //console.log('Login log updated successfully!');
    } catch (error) {
        console.error('Error maintaining login log:', error.message);
    }
    
    return  return_val;
}

function getCleanIp(ip) {
    return ip.startsWith('::ffff:') ? ip.replace('::ffff:', '') : ip;
}
  


    