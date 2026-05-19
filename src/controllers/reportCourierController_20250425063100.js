const db = require("../config/db");
const getMongo = require("../lib/mongo/mongo_api");
const moment = require('moment-timezone');
//const current_time = moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");
const {passenc} = require("../helpers/pass_enc");
//const {getAccessTokenDataWeb,lastActivityWeb,logoutAuthorizedAccessWeb} = require("../helpers/access_token_web");
const tokenWeb= require("../helpers/access_token_web");
//const {getLastData,getParticularDateFullData} = require('../lib/cassandra-lib/libLog');
//Delay Report
exports.networkVehicleDelayReport = async (req, res) => {
    
    const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    const data = [];
    let response ={};
    let user_info ={};
    let resData={};
    resData.Status="fail";

    try {
        const {AccessToken,DeveloperOption,DeveloperOptionId,from,to} = req.body;            
        if(AccessToken!=null){
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //const auth = await getAccessTokenDataWeb(AccessToken);
            }
            
            if (user_info && user_info.Status === 2) {
                response.Result = user_info.Result;
                response.Message = user_info.Message;
                resData.Message=user_info.Message;
                res.status(200).json(resData);
            }else{  
                const user_id = user_info.AccountId;
                const [resultUser] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (resultUser.length > 0) {
                    const resultUsr=resultUser[0];
                    const userType= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    //const group_id ='5691';
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name'];                    
                    
                    if(userType === 6) { // Master                        
                        const conditions = {
                            entry_date: {
                                $gte: new Date(from + 'T00:00:00Z'),
                                $lte: new Date(to + 'T23:59:59Z')
                            },
                            group_id: group_id
                        };
                        const fields = {};
                        const table ="courier_route_delay";
                        
                        const results = await getMongo.getMongoQuery(conditions, fields, table);                        
                        //console.log(results);process.exit();

                        if(results.length>0){                                    
                            results.forEach((result, i) => {
                                const entry = {};
                            
                                // Handle `trip_id` logic
                                entry.trip_id = result.trip_id || result.carnet_no;
                            
                                entry.delay_reason_code = result.delay_reason;
                                entry.checkpost_code = result.checkpost_code;
                                entry.contact_name = result.contact_name;
                                entry.contact_number = result.contact_number;
                                entry.contract_code = result.contract_code;
                                entry.delay_seq = result.delay_seq;
                            
                                // Query MongoDB for delay reason
                                const fieldsD = {};
                                const conditionsD = { c_reason_code: parseInt(result.delay_reason) };
                                const resultD = getMongo.getMongoQuery(conditionsD, fieldsD, 'courier_route_delay_master'); // Adjust with your MongoDB query function
                                //const results = await getMongo.getMongoQuery(conditions, fields, table);
                                entry.delay_reason = resultD && resultD.length > 0 ? resultD[0].creason_desc : '';
                            
                                entry.detail_remarks = result.detail_remarks;
                                entry.enroute_code = result.enroute_code;
                                entry.entry_by = result.entry_by;
                                entry.entry_date = result.entry_date;
                                entry.incident_date = result.incident_date;
                                entry.incident_time = result.incident_time;
                                entry.location_name = result.location_name;
                                entry.loccode_non_route = result.loccode_non_route;
                                entry.modified_by = result.modified_by;
                                entry.modified_date = result.modified_date;
                            
                                // Handle `release_date` logic
                                entry.release_date = result.release_date === '1970-01-01' ? '' : result.release_date;
                    
                                entry.release_time = result.release_time;
                                entry.remarks = result.remarks;
                                entry.total_delay_in_min = result.total_delay_in_min;
                                entry.vehicle_no = result.vehicle_no;
                    
                                // Handle optional fields with fallback values
                                entry.trip_vehicle_no = result.trip_vehicle_no || '';
                                entry.shipment_method = result.shipment_method || '';
                                entry.route_name = result.route_name || '';
                                entry.fleet_no = result.fleet_no || '';
                                entry.source_name = result.source_name || '';
                                entry.destination_name = result.destination_name || '';
                                entry.create_date = result.create_date || '';
                                entry.transporter_name = result.transporter_name || '';
                                entry.driver_name = result.driver_name || '';
                                entry.driver_mobile = result.driver_mobile || '';
                    
                                data.push(entry);
                            });  
                            
                            resData.Data=data;
                            resData.Status="success";
                            res.status(200).json(resData);
                        }else{
                            err = "Data Not Found.";
                            resData.Message= err;
                            res.status(200).json(resData);
                        }                                             
                    }else{                                        
                        err = "Invalid Access.";
                        resData.Message= err;
                        res.status(200).json(resData);
                    }               
                }else{
                    console.error("Error data not found:", error);
                    return res.status(500).json({ error: 'Error data not found' });
                }
            }
        }else{
            //res.status(501).json("payload missing");
            resData.Message="Payload Missing";
            res.status(501).json(resData);
        }
    } catch (error) {
        console.error('Error fetching delay_report:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

//Data Push Resport
exports.courierTripsReportPushcpc = async (req, res) => {
    
    const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    const data = [];
    let response ={};
    let user_info ={};
    let resData={};
    resData.Status="fail";

    try {
        const {AccessToken,DeveloperOption,DeveloperOptionId,from,to,shipmentNo} = req.body;            
        if(AccessToken!=null){
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //const auth = await getAccessTokenDataWeb(AccessToken);
            }
            
            if (user_info && user_info.Status === 2) {
                response.Result = user_info.Result;
                response.Message = user_info.Message;
                resData.Message=user_info.Message;
                res.status(200).json(resData);
            }else{  
                const user_id = user_info.AccountId;
                const [resultUser] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (resultUser.length > 0) {
                    const resultUsr=resultUser[0];
                    const userType= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    //const group_id ='5691';
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name'];                    
                    
                    if(userType === 6) { // Master

                        let conditions = {};
                        
                        if (from && to) {
                            conditions.run_date = {
                                $gte: new Date(from + 'T00:00:00Z'),
                                $lte: new Date(to + 'T23:59:59Z')
                            };
                        }
                        if (shipmentNo && shipmentNo !== "") {
                            conditions.group_id=group_id;
                            conditions.shipment_no = shipmentNo.toString();
                            //conditions.shipment_no = parseInt(shipmentNo, 10);

                            
                        }
                        const fields = {};
                        const table ="courier_trip_detail";
                        
                        const resultsA = await getMongo.getMongoQuery(conditions, fields, table);
                        console.log(resultsA);//process.exit();
                        const results = [];

                        resultsA.forEach((trp) => {
                            const preLoad = { ...trp }; // Clone the object

                            // Set default values for missing keys
                            preLoad.driver_lastgps = trp.driver_lastgps || "";
                            preLoad.driver_sync = trp.driver_sync || "";
                            preLoad.driver_last_auth = trp.driver_last_auth || "";
                            preLoad.total_bag = trp.total_bag || "";
                            preLoad.remarks = trp.remarks || "";
                            preLoad.other_c2pc_push = trp.other_c2pc_push || "";
                            preLoad.other_run_code = trp.other_run_code || "";
                            preLoad.close_remarks = trp.close_remarks || "";
                            preLoad.run_code_push_id = trp.run_code_push_id || "";
                            preLoad.other_source_code = trp.other_source_code || "";
                            preLoad.other_source_id = trp.other_source_id || "";
                            preLoad.transporter_id = trp.transporter_id || "";
                            preLoad.closur_day = trp.closur_day || "";
                            preLoad.distance_km = trp.distance_km || "";
                            preLoad.exception_backend = trp.exception_backend || "";
                            preLoad.close_by = trp.close_by || "";
                            preLoad.transporter_name = trp.transporter_name || "";
                            preLoad.edit_id = trp.edit_id || 0;
                            preLoad.exception_gps_tampered_backend = trp.exception_gps_tampered_backend || "";
                            preLoad.exception_common_backend = trp.exception_common_backend || "";
                            preLoad.create_date = trp.create_date || "";
                            preLoad.close_date = trp.close_date || "";
                            preLoad.edit_date_backend = trp.edit_date_backend || "";
                            preLoad.last_gps_time = trp.last_gps_time || "";
                            preLoad.c2pc_date = trp.c2pc_date || "";
                            preLoad.route_code_type = trp.route_code_type || "";

                            // Add the processed object to results
                            results.push(preLoad);
                        });
                        //console.log(results);process.exit(0);
                        //console.log(results);


                        if(results.length>0){                                    
                            results.forEach((result, i) => {
                                const entry = {};
                            
                                // Handle `trip_id` logic
                                entry.trip_id = result.trip_id || result.carnet_no;
                            
                                entry.delay_reason_code = result.delay_reason;
                                entry.checkpost_code = result.checkpost_code;
                                entry.contact_name = result.contact_name;
                                entry.contact_number = result.contact_number;
                                entry.contract_code = result.contract_code;
                                entry.delay_seq = result.delay_seq;
                            
                                // Query MongoDB for delay reason
                                const fieldsD = {};
                                const conditionsD = { c_reason_code: parseInt(result.delay_reason) };
                                const resultD = getMongo.getMongoQuery(conditionsD, fieldsD, 'courier_route_delay_master'); // Adjust with your MongoDB query function
                                //const results = await getMongo.getMongoQuery(conditions, fields, table);
                                entry.delay_reason = resultD && resultD.length > 0 ? resultD[0].creason_desc : '';
                            
                                entry.detail_remarks = result.detail_remarks;
                                entry.enroute_code = result.enroute_code;
                                entry.entry_by = result.entry_by;
                                entry.entry_date = result.entry_date;
                                entry.incident_date = result.incident_date;
                                entry.incident_time = result.incident_time;
                                entry.location_name = result.location_name;
                                entry.loccode_non_route = result.loccode_non_route;
                                entry.modified_by = result.modified_by;
                                entry.modified_date = result.modified_date;
                            
                                // Handle `release_date` logic
                                entry.release_date = result.release_date === '1970-01-01' ? '' : result.release_date;
                    
                                entry.release_time = result.release_time;
                                entry.remarks = result.remarks;
                                entry.total_delay_in_min = result.total_delay_in_min;
                                entry.vehicle_no = result.vehicle_no;
                    
                                // Handle optional fields with fallback values
                                entry.trip_vehicle_no = result.trip_vehicle_no || '';
                                entry.shipment_method = result.shipment_method || '';
                                entry.route_name = result.route_name || '';
                                entry.fleet_no = result.fleet_no || '';
                                entry.source_name = result.source_name || '';
                                entry.destination_name = result.destination_name || '';
                                entry.create_date = result.create_date || '';
                                entry.transporter_name = result.transporter_name || '';
                                entry.driver_name = result.driver_name || '';
                                entry.driver_mobile = result.driver_mobile || '';
                    
                                data.push(entry);
                            });  
                            
                            resData.Data=data;
                            resData.Status="success";
                            res.status(200).json(resData);
                        }else{
                            err = "Data Not Found.";
                            resData.Message= err;
                            res.status(200).json(resData);
                        }                                             
                    }else{                                        
                        err = "Invalid Access.";
                        resData.Message= err;
                        res.status(200).json(resData);
                    }               
                }else{
                    console.error("Error data not found:", error);
                    return res.status(500).json({ error: 'Error data not found' });
                }
            }
        }else{
            //res.status(501).json("payload missing");
            resData.Message="Payload Missing";
            res.status(501).json(resData);
        }
    } catch (error) {
        console.error('Error fetching delay_report:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
//Vehicle Report : A- Vehicle Transporter Details
exports.vehicleTransporterDetailReport = async (req, res) => {
    
    const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    const data = [];
    let response ={};
    let user_info ={};
    let resData={};
    resData.Status="fail";
    let vehicleIds = {};
    let vids = [];
    try {
        const {AccessToken,DeveloperOption,DeveloperOptionId} = req.body;            
        if(AccessToken!=null){
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //const auth = await getAccessTokenDataWeb(AccessToken);
            }
            
            if (user_info && user_info.Status === 2) {
                response.Result = user_info.Result;
                response.Message = user_info.Message;
                resData.Message=user_info.Message;
                res.status(200).json(resData);
            }else{  
                const user_id = user_info.AccountId;
                const [resultUser] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (resultUser.length > 0) {
                    const resultUsr=resultUser[0];
                    const userType= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name'];                    
                    
                    if(userType === 6) { // Master                        
                        const query = `
                            SELECT 
                                v.vehicle_number, 
                                d.device_imei, 
                                d.mobile_no, 
                                dm.name AS manufacturer_name, 
                                t.name AS transporter_name, 
                                d.status
                            FROM 
                                vehicle AS v
                            LEFT JOIN 
                                vehicle_device_assignment AS vda ON vda.vehicle_id = v.id
                            LEFT JOIN 
                                devices AS d ON d.id = vda.device_id
                            LEFT JOIN 
                                device_manufacturer AS dm ON dm.id = d.device_manufacturer_id
                            LEFT JOIN 
                                vehicle_transporter_assignment AS vta ON vta.vehicle_id = v.id
                            LEFT JOIN 
                                transporters AS t ON t.id = vta.transporter_id
                            WHERE 
                                vta.group_id = ?
                            ORDER BY 
                                d.device_imei ASC
                        `;
                        const [result] = await db.promise().query(query, [group_id]);
                        console.log(result);
                        if(result.length>0){ 
                            resData.Data=result;
                            resData.Status="success";
                            res.status(200).json(resData);
                        }else{
                            err = "Data Not Found.";
                            resData.Message= err;
                            res.status(200).json(resData);
                        }                        
                    }else{                                        
                        err = "Invalid Access.";
                        resData.Message= err;
                        res.status(200).json(resData);
                    }               
                }else{
                    console.error("Error data not found:", error);
                    return res.status(500).json({ error: 'Error data not found' });
                }
            }
        }else{
            //res.status(501).json("payload missing");
            resData.Message="Payload Missing";
            res.status(501).json(resData);
        }
    } catch (error) {
        console.error('Error fetching delay_report:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
//Vehicle Report : C- GPS Integration
exports.gpsIntegrationReport = async (req, res) => {
    
    const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    const data = [];
    let response ={};
    let user_info ={};
    let resData={};
    resData.Status="fail";
    let vehicleIds = {};
    let vids = [];
    try {
        const {AccessToken,DeveloperOption,DeveloperOptionId,report_type} = req.body;            
        if(AccessToken!=null){
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //const auth = await getAccessTokenDataWeb(AccessToken);
            }
            
            if (user_info && user_info.Status === 2) {
                response.Result = user_info.Result;
                response.Message = user_info.Message;
                resData.Message=user_info.Message;
                res.status(200).json(resData);
            }else{  
                const user_id = user_info.AccountId;
                const [resultUser] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (resultUser.length > 0) {
                    const resultUsr=resultUser[0];
                    const userType= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name'];                    
                    
                    if ([6, 12, 44, 19].includes(userType)) {
                        const sql_DM = `SELECT id,name FROM device_manufacturer WHERE status = 1`;
                        const [result_DM] = await db.promise().query(sql_DM);
                        const D_manufacturer = result_DM.reduce((acc, item) => {
                            acc[item.id] = item.name;
                            return acc;
                        }, {});                                
                                
                        const sql_V = `SELECT vehicle_id FROM vehice_user_mapping WHERE status = 1 AND user_id = ${user_id}`;
                        const [result_V] = await db.promise().query(sql_V);                                    
                                
                        if (result_V.length > 0) {
                            const vehicleIds = result_V.map(item => item.vehicle_id);                                    
                           
                            const sql_VDA = `
                                SELECT 
                                    vda.id AS assignment_id, 
                                    vda.status AS assignment_status, 
                                    vda.installation_date, 
                                    vda.uninstallation_date, 
                                    v.vehicle_number, 
                                    d1.device_imei AS device_imei, 
                                    d2.device_imei AS device2_imei, 
                                    d1.mobile_no AS device_mobile_no, 
                                    d1.device_manufacturer_id
                                FROM 
                                    vehicle_device_assignment AS vda
                                LEFT JOIN 
                                    vehicle AS v ON vda.vehicle_id = v.id
                                LEFT JOIN 
                                    devices AS d1 ON vda.device_id = d1.id
                                LEFT JOIN 
                                    devices AS d2 ON vda.device_id2 = d2.id
                                WHERE 
                                    vda.status IN (?) AND 
                                    v.id IN (?) AND 
                                    v.status = ? AND 
                                    d1.status IN (?)
                                ORDER BY 
                                    vda.status ASC, 
                                    vda.id ASC
                            `;

                            const vdaStatus = [1, 2];
                            const vStatus = 1;
                            const d1Status = [1, 2, 3];
                            const [result_VDA] = await db.promise().query(sql_VDA, [vdaStatus, vehicleIds, vStatus, d1Status]);
                                        
                            finalArray = [];
                            if(result_VDA.length>0){
                                result_VDA.forEach(item => {
                                    item.device_manufacturer_name = D_manufacturer[item.device_manufacturer_id];
                                    finalArray.push(item);
                                });
                                console.log(finalArray);
                                resData.Data=finalArray;
                                resData.Status="success";
                                res.status(200).json(resData);
                            }else{
                                err = "Data Not Found.";
                                resData.Message= err;
                                res.status(200).json(resData);
                            }                            
                        }else{
                            err = "Data not found.";
                            resData.Message= err;
                            res.status(200).json(resData);
                        }
                    } else {
                        err = "Invalid Access.";
                        resData.Message= err;
                        res.status(200).json(resData);
                    }      
                }else{
                    console.error("Error data not found:", error);
                    return res.status(500).json({ error: 'Error data not found' });
                }
            }
        }else{
            //res.status(501).json("payload missing");
            resData.Message="Payload Missing";
            res.status(501).json(resData);
        }
    } catch (error) {
        console.error('Error fetching delay_report:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
//Vehicle Report : B- Vendor GPS Integration
exports.vendorGpsIntegrationReport = async (req, res) => {
    
    const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    const data = [];
    let response ={};
    let user_info ={};
    let resData={};
    resData.Status="fail";
    let vehicleIds = {};
    let vids = [];
    try {
        
        //$integration_type = array('0'=>'All','1'=>'Integrated','2'=>'Non Integrated');
        const {AccessToken,DeveloperOption,DeveloperOptionId,transporter_id,type} = req.body;
        
        if(AccessToken!=null){
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //const auth = await getAccessTokenDataWeb(AccessToken);
            }
            
            if (user_info && user_info.Status === 2) {
                response.Result = user_info.Result;
                response.Message = user_info.Message;
                resData.Message=user_info.Message;
                res.status(200).json(resData);
            }else{  
                const user_id = user_info.AccountId;
                const [resultUser] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (resultUser.length > 0) {
                    const resultUsr=resultUser[0];
                    const userType= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name'];   
                    
                    
                    Trnsptr = [];
                    if(userType === 6) {
                        if(transporter_id){
                            let tId = transporter_id
                            .replace(/[{}]/g, '') // Remove curly braces
                            .split(',')           // Split by commas
                            .map(Number);         // Convert string elements to numbers

                            const[resultTransporter] = await db.promise().query("SELECT * FROM transporters WHERE `id` IN(?) AND `group_id`=? AND `status`=?",[tId,group_id,1]);
                            //console.log('notNull');process.exit(0);
                            Trnsptr = resultTransporter;
                        }else{
                            const [resultTransporter] = await db.promise().query("SELECT * FROM transporters WHERE `group_id`=? AND `status`=?",[group_id,1]);
                            //console.log('Null');process.exit(0);
                            Trnsptr = resultTransporter;
                        }
                        
                        let transporters = {};
                        let transporters_ids = [];
                        let transporters_name = [];
                        
                        Trnsptr.forEach(transp_data => {
                            const id = transp_data.id;
                            const name = transp_data.name;

                            transporters[id] = {
                                name: name,
                                state: transp_data.state,
                                city: transp_data.city,
                                contact_no: transp_data.contact_no,
                                email: transp_data.email
                            };

                            transporters_ids.push(id);
                            transporters_name.push(name.trim());
                        });

                        //const tids = transporters_ids.join(',');
                        if(transporters_ids) {                       
                            const query = `
                                SELECT 
                                    v.id,
                                    v.vehicle_number,
                                    vta.transporter_id,
                                    t.name
                                FROM 
                                    vehicle_transporter_assignment AS vta 
                                LEFT JOIN 
                                    vehicle AS v ON vta.vehicle_id = v.id 
                                LEFT JOIN 
                                    transporters AS t ON vta.transporter_id = t.id 
                                WHERE 
                                    vta.status = ? AND 
                                    vta.group_id = ? AND 
                                    vta.transporter_id IN(?) AND
                                    vta.create_id IN(?)
                                `;
                                const [resultVTA] = await db.promise().query(query,[1,'0041',transporters_ids,user_id]);
                                
                                if(resultVTA.length>0){
                                    const vehicleIds = {};
                                    const vehTransporter = {};
                                    const vehNumber = {};

                                    resultVTA.forEach((val_vta) => {
                                        console.log(val_vta);process.exit(0);
                                        const vehicleId = val_vta.id;
                                        vehicleIds[vehicleId] = val_vta.vehicleId;
                                        vehTransporter[vehicleId] = data1[vta.VTAssignment.transporter_id];
                                        vehNumber[vehicleId] = vta.Vehicles.vehicle_number;
                                    });
                                    console.log(result);process.exit(0);
                                }
                        }
                        console.log(result);process.exit(0);
                        
                    }else{
                        err = "Invalid Access.";
                        resData.Message= err;
                        res.status(200).json(resData);
                    }
                    
                }else{
                    console.error("Error data not found:", error);
                    return res.status(500).json({ error: 'Error data not found' });
                }
            }
        }else{
            //res.status(501).json("payload missing");
            resData.Message="Payload Missing";
            res.status(501).json(resData);
        }
    } catch (error) {
        console.error('Error fetching delay_report:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
//Vehicle Report : B- Vendor GPS Integration Filter
exports.vendorGpsIntegrationFilter = async (req, res) => {
    
    const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    const data = [];
    let response ={};
    let user_info ={};
    let resData={};
    resData.Status="fail";
    
    let filter_data = {};
    try {
        const {AccessToken,DeveloperOption,DeveloperOptionId} = req.body;            
        if(AccessToken!=null){
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //const auth = await getAccessTokenDataWeb(AccessToken);
            }
            
            if (user_info && user_info.Status === 2) {
                response.Result = user_info.Result;
                response.Message = user_info.Message;
                resData.Message=user_info.Message;
                res.status(200).json(resData);
            }else{  
                const user_id = user_info.AccountId;
                const [resultUser] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (resultUser.length > 0) {
                    const resultUsr=resultUser[0];
                    const userType= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name'];                    
                    
                    if(userType === 6) { // Master
                        
                        const [resultTransporter] = await db.promise().query("SELECT `id`, `name`, `code` FROM transporters WHERE `group_id`=? AND `status`=?",[group_id,1]);
                        
                        if (resultTransporter.length > 0) {
                            resultTransporter.forEach(value => {
                                const transporterId = value.id;
                                const transporterName = value.name;
                                const transporterCode = value.code;

                                filter_data[transporterId] = `${transporterName} (${transporterCode})`;
                            });

                            resData.Data=filter_data;
                            resData.Status="success";
                            res.status(200).json(resData);
                        }else{
                            err = "Data Not Found.";
                            resData.Message= err;
                            res.status(200).json(resData);
                        }
                    }else{                                        
                        err = "Invalid Access.";
                        resData.Message= err;
                        res.status(200).json(resData);
                    }               
                }else{
                    console.error("Error data not found:", error);
                    return res.status(500).json({ error: 'Error data not found' });
                }
            }
        }else{
            //res.status(501).json("payload missing");
            resData.Message="Payload Missing";
            res.status(501).json(resData);
        }
    } catch (error) {
        console.error('Error fetching delay_report:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

//Vehicle Report : (A- Vehicle Transporter Details/B- Vendor GPS Integration/C- GPS Integration)
exports.VtdVgpsiGpsiReport = async (req, res) => {
    
    const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    const data = [];
    let response ={};
    let user_info ={};
    let resData={};
    resData.Status="fail";
    let vehicleIds = {};
    let vids = [];
    try {
        const {AccessToken,DeveloperOption,DeveloperOptionId,report_type} = req.body;            
        if(AccessToken!=null){
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //const auth = await getAccessTokenDataWeb(AccessToken);
            }
            
            if (user_info && user_info.Status === 2) {
                response.Result = user_info.Result;
                response.Message = user_info.Message;
                resData.Message=user_info.Message;
                res.status(200).json(resData);
            }else{  
                const user_id = user_info.AccountId;
                const [resultUser] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (resultUser.length > 0) {
                    const resultUsr=resultUser[0];
                    const userType= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name'];                    
                    
                    if(userType === 6) { // Master
                        
                        if(report_type === 'vehicle_transporter_detail'){
                            const query = `
                                SELECT 
                                    v.vehicle_number, 
                                    d.device_imei, 
                                    d.mobile_no, 
                                    dm.name AS manufacturer_name, 
                                    t.name AS transporter_name, 
                                    d.status
                                FROM 
                                    vehicle AS v
                                LEFT JOIN 
                                    vehicle_device_assignment AS vda ON vda.vehicle_id = v.id
                                LEFT JOIN 
                                    devices AS d ON d.id = vda.device_id
                                LEFT JOIN 
                                    device_manufacturer AS dm ON dm.id = d.device_manufacturer_id
                                LEFT JOIN 
                                    vehicle_transporter_assignment AS vta ON vta.vehicle_id = v.id
                                LEFT JOIN 
                                    transporters AS t ON t.id = vta.transporter_id
                                WHERE 
                                    vta.group_id = ?
                                ORDER BY 
                                    d.device_imei ASC
                            `;
                            const [result] = await db.promise().query(query, [group_id]);
                        
                            if(result.length>0){ 
                                resData.Data=result;
                                resData.Status="success";
                                res.status(200).json(resData);
                            }else{
                                err = "Data Not Found.";
                                resData.Message= err;
                                res.status(200).json(resData);
                            }
                        }else if(report_type === 'vendor_gps_integration'){

                        }else if(report_type === 'gps_integration'){
                            
                            if ([6, 12, 44, 19].includes(userType)) {
                                const sql_DM = `SELECT id,name FROM device_manufacturer WHERE status = 1`;
                                const [result_DM] = await db.promise().query(sql_DM);
                                const D_manufacturer = result_DM.reduce((acc, item) => {
                                    acc[item.id] = item.name;
                                    return acc;
                                }, {});                                
                                
                                const sql_V = `SELECT vehicle_id FROM vehice_user_mapping WHERE status = 1 AND user_id = ${user_id}`;
                                const [result_V] = await db.promise().query(sql_V);                                    
                                
                                if (result_V.length > 0) {
                                    const vehicleIds = result_V.map(item => item.vehicle_id);                                    
                                    if (vehicleIds.length > 0) {
                                        const sql_VDA = `
                                            SELECT 
                                                vda.id AS assignment_id, 
                                                vda.status AS assignment_status, 
                                                vda.installation_date, 
                                                vda.uninstallation_date, 
                                                v.vehicle_number, 
                                                d1.device_imei AS device_imei, 
                                                d2.device_imei AS device2_imei, 
                                                d1.mobile_no AS device_mobile_no, 
                                                d1.device_manufacturer_id
                                            FROM 
                                                vehicle_device_assignment AS vda
                                            LEFT JOIN 
                                                vehicle AS v ON vda.vehicle_id = v.id
                                            LEFT JOIN 
                                                devices AS d1 ON vda.device_id = d1.id
                                            LEFT JOIN 
                                                devices AS d2 ON vda.device_id2 = d2.id
                                            WHERE 
                                                vda.status IN (?) AND 
                                                v.id IN (?) AND 
                                                v.status = ? AND 
                                                d1.status IN (?)
                                            ORDER BY 
                                                vda.status ASC, 
                                                vda.id ASC
                                        `;

                                        const vdaStatus = [1, 2];
                                        const vStatus = 1;
                                        const d1Status = [1, 2, 3];
                                        const [result_VDA] = await db.promise().query(sql_VDA, [vdaStatus, vehicleIds, vStatus, d1Status]);
                                        
                                        finalArray = [];
                                        if(result_VDA.length>0){
                                            result_VDA.forEach(item => {
                                                item.device_manufacturer_name = D_manufacturer[item.device_manufacturer_id];
                                                finalArray.push(item);
                                            });
                                            
                                            resData.Data=finalArray;
                                            resData.Status="success";
                                            res.status(200).json(resData);
                                        }else{
                                            err = "Data Not Found.";
                                            resData.Message= err;
                                            res.status(200).json(resData);
                                        }//console.log(finalArray);process.exit(0);
                                    }
                                }
                            } else {
                                err = "Invalid Access.";
                                resData.Message= err;
                                res.status(200).json(resData);
                            }
                        }
                    }else{                                        
                        err = "Invalid Access.";
                        resData.Message= err;
                        res.status(200).json(resData);
                    }               
                }else{
                    console.error("Error data not found:", error);
                    return res.status(500).json({ error: 'Error data not found' });
                }
            }
        }else{
            //res.status(501).json("payload missing");
            resData.Message="Payload Missing";
            res.status(501).json(resData);
        }
    } catch (error) {
        console.error('Error fetching delay_report:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};


//Vehicle Report Filter 1
exports.vehicleReportFilter = async (req, res) => {
    
    const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    const data = [];
    let response ={};
    let user_info ={};
    let resData={};
    resData.Status="fail";
    
    let filter_data = {};
    try {
        const {AccessToken,DeveloperOption,DeveloperOptionId} = req.body;            
        if(AccessToken!=null){
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //const auth = await getAccessTokenDataWeb(AccessToken);
            }
            
            if (user_info && user_info.Status === 2) {
                response.Result = user_info.Result;
                response.Message = user_info.Message;
                resData.Message=user_info.Message;
                res.status(200).json(resData);
            }else{  
                const user_id = user_info.AccountId;
                const [resultUser] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (resultUser.length > 0) {
                    const resultUsr=resultUser[0];
                    const userType= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name'];                    
                    //let finalData = {};
                    if(userType === 6) { // Master
                         
                        //1- Get Region
                            const Zone = {};
                            const [resultZone] = await db.promise().query("SELECT `id`, `zone_name`, `zone_code` FROM logistic_zone WHERE `group_id`=? AND `status`=?",[group_id,1]);
                            if (resultZone.length > 0) {
                                resultZone.forEach(value_zone => {                                
                                    Zone[value_zone.id] = `${value_zone.zone_name}`;
                                });
                            }

                        // 2- Get Contractual Hrs.
                            const Working_hrs = { yes: 'Yes', no: 'No' };

                            // const Wroking_hrs = {};
                            // const conditions = {group_id: group_id, status:1};
                            // const fields = {};
                            // const table ="logistic_vehicle_working_hour";

                            // const results = await getMongo.getMongoQuery(conditions, fields, table);                        
                            // if(resultContrctualHrs.length > 0){                                          
                            //     results.forEach((value) => {
                            //     let reportingTime = '';
                            //     let leavingTime = '';
                            //     let diffMin = '';                            
                                
                            //     reportingTime = value.reporting_time;
                            //     leavingTime = value.leaving_time;

                            //     const today = new Date().toISOString().split('T')[0]; // Current date in "YYYY-MM-DD"
                            //     const nextDay = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]; // Next day's date

                            //     const reportingDateTime = new Date(`${today}T${reportingTime}:00`);
                            //     const leavingDateTime = 
                            //         new Date(`${today}T${leavingTime}:00`) >= reportingDateTime
                            //             ? new Date(`${today}T${leavingTime}:00`)
                            //             : new Date(`${nextDay}T${leavingTime}:00`);

                            //     diffMin = Math.round(Math.abs((leavingDateTime - reportingDateTime) / (1000 * 60 * 60)) * 100) / 100;

                            //     if (!isNaN(diffMin) && diffMin !== 0) {
                            //         Wroking_hrs[diffMin]=diffMin;
                            //     }
                            // });
                            //}

                        //3- Get Gps Vendor
                            const GpsVendor = {};
                            const [resultGpsVendor] = await db.promise().query("SELECT `id`, `name`  FROM device_manufacturer WHERE `status`=1");
                            if (resultGpsVendor.length > 0) {
                                resultGpsVendor.forEach(value_gpsv => {                                
                                    GpsVendor[value_gpsv.id] = `${value_gpsv.name}`;
                                });
                            }
                        
                        //4- Get Device Type
                            //const DeviceType = { 1: 'Fixed', 12: 'Fixed Elock' };
                            const DeviceType = {};
                            const [resultDeviceType] = await db.promise().query("SELECT `device_type_id`, `device_type`  FROM device_types WHERE `status`=1 AND `device_type_id` IN(1,12)");
                            if (resultDeviceType.length > 0) {
                                resultDeviceType.forEach(value_deviceType => {                                
                                    DeviceType[value_deviceType.device_type_id] = `${value_deviceType.device_type}`;
                                });
                            }
                            
                        const finalData = {
                            Zone,
                            Working_hrs,
                            GpsVendor,
                            DeviceType
                        };
                        
                        if (Object.keys(finalData.Zone).length > 0 || 
                            Object.keys(finalData.GpsVendor).length > 0 || 
                            Object.keys(finalData.DeviceType).length > 0) {
                            resData.Data = finalData;
                            resData.Status = "success";
                            return res.status(200).json(resData);
                        } else {
                            const err = "Data Not Found.";
                            resData.Message = err;
                            return res.status(200).json(resData);
                        }
                    }else{                                        
                        err = "Invalid Access.";
                        resData.Message= err;
                        res.status(200).json(resData);
                    }               
                }else{
                    console.error("Error data not found:", error);
                    return res.status(500).json({ error: 'Error data not found' });
                }
            }
        }else{
            //res.status(501).json("payload missing");
            resData.Message="Payload Missing";
            res.status(501).json(resData);
        }
    } catch (error) {
        console.error('Error fetching delay_report:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.searchVehicle = async (req, res) => {
    let response ={};
    let user_info ={};    
    let resData={};
    resData.Status="fail";

    try {        
        const {AccessToken,DeveloperOption,DeveloperOptionId,searchQuery} = req.body;        
        if(AccessToken!=null){
            const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //const auth = await getAccessTokenDataWeb(AccessToken);
            }
            
            if (user_info && user_info.Status === 2) {
                response.Result = user_info.Result;
                response.Message = user_info.Message;
                resData.Message=user_info.Message;
                res.status(200).json(resData);
            }else{  
                const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (result.length > 0) {                    
                    const sql_vehicle = `
                        SELECT 
                            v.id,
                            v.vehicle_number 
                        FROM
                            vehicle as v 
                        LEFT JOIN 
                            vehice_user_mapping as vum 
                        ON 
                            vum.vehicle_id=v.id 
                        WHERE
                            vum.status=1 AND 
                            v.status=1 AND 
                            v.vehicle_number LIKE '%${searchQuery}%' AND
                            vum.user_id=${user_id}
                    `;
                    const [result_vehicle] = await db.promise().query(sql_vehicle);                    
                    
                    if (result_vehicle.length > 0) {
                        const vehicleNumbers = result_vehicle.reduce((acc, vehicle) => {
                            acc[vehicle.id] = vehicle.vehicle_number;
                            return acc;
                        }, {});                        
                        
                        resData.Data = vehicleNumbers;
                        resData.Status = "success";
                        res.status(200).json(resData);                        
                    } else {
                        err = "Data Not Found.";
                        resData.Message = err;
                        res.status(200).json(resData);
                    }                            
                }else{
                    console.error("Invalid User:", error);
                    return res.status(500).json({ error: 'Error data not found' });
                }
            }
        }else{
            resData.Message="Payload Missing";
            res.status(501).json(resData);
        }
    } catch (error) {
        console.error('Error fetching vehicles:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.searchTransporter = async (req, res) => {    
    let response ={};
    let user_info ={};    
    let resData={};
    resData.Status="fail";

    try {        
        const {AccessToken,DeveloperOption,DeveloperOptionId,searchQuery} = req.body;        
        if(AccessToken!=null){
            const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //const auth = await getAccessTokenDataWeb(AccessToken);
            }
            
            if (user_info && user_info.Status === 2) {
                response.Result = user_info.Result;
                response.Message = user_info.Message;
                resData.Message=user_info.Message;
                res.status(200).json(resData);
            }else{  
                const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (result.length > 0) {
                    const resultUsr=result[0];                    
                    const group_id =resultUsr['group_id'];                                   
                    
                    const sql_transporters = `SELECT id,name,code FROM transporters WHERE status = 1 AND (name LIKE '%${searchQuery}%' OR code LIKE '%${searchQuery}%')AND group_id = '${group_id}'`;
                    const [result_transporter] = await db.promise().query(sql_transporters);                    
                    
                    if (result_transporter.length > 0) {
                        const transporters = result_transporter.reduce((acc, transporter) => {                            
                            acc[transporter.id] = transporter.name+' ('+transporter.code+')';
                            return acc;
                        }, {});

                        resData.Data = transporters;
                        resData.Status = "success";
                        res.status(200).json(resData);                        
                    } else {
                        err = "Data Not Found";
                        resData.Message = err;
                        res.status(200).json(resData);
                    }                            
                }else{
                    console.error("Invalid User:", error);
                    return res.status(500).json({ error: 'Error data not found' });
                }
            }
        }else{
            //res.status(501).json("payload missing");
            resData.Message="Payload Missing";
            res.status(501).json(resData);
        }
    } catch (error) {
        console.error('Error fetching transporters:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};


/*Sir I need to upload this function.*/
//Vehicle Report
exports.vehicleReport = async (req, res) => {
    
    const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    const data = [];
    let response ={};
    let user_info ={};
    let resData={};
    resData.Status="fail";
    //const user_info = {};
    try {
        const {AccessToken,vehicle_id,transporter_id,contract_status,region,gps_vendor,DeveloperOption,DeveloperOptionId} = req.body;  
        //console.log(typeof(transporter_id));process.exit(0);
        if(AccessToken!=null){
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //user_info = await getAccessTokenDataWeb(AccessToken);
            }
            //console.log(user_info);process.exit(0);
            if (user_info && user_info.Status === 2) {
                response.Result = user_info.Result;
                response.Message = user_info.Message;
                resData.Message=user_info.Message;
                res.status(200).json(resData);
            }else{  
                const user_id = user_info.AccountId;
                const [resultUser] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (resultUser.length > 0) {
                    const resultUsr=resultUser[0];
                    const userType= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    //const group_id ='5691';
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name'];                    
                    let final_array = [];
                    let vIds = '';
                    let Vid_Tid = {};

                    //console.log(userType);process.exit(0);
                    if(region && transporter_id && vehicle_id){
                        
                        vIdsString = [vehicle_id];                        
                        vIds = vIdsString[0].split(',').map(id => parseInt(id.trim(), 10));
                        //console.log(vIds.length);process.exit(0);
                        if (vIds && vIds.length > 0) {
                                    
                            //Step_1:
                                //const [vIds_arr] = vIds;
                                const conditions = {
                                    //vehicle_id: { $in: vIds },
                                    status:1,
                                    group_id: group_id
                                };
                                
                                const fields = {};
                                const table ="logistic_vehicle_working_hour";
                                const resultsVWH = await getMongo.getMongoQuery(conditions, fields, table);                        
                                // console.log(resultsVWH);process.exit(0);
    
                                const calculateHours = (reporting, leaving) => {
                                    const [startHour, startMin] = reporting.split(':').map(Number);
                                    const [endHour, endMin] = leaving.split(':').map(Number);
                                
                                    let totalHours = endHour - startHour;
                                    let totalMinutes = endMin - startMin;
                                
                                    if (totalMinutes < 0) {
                                    totalMinutes += 60;
                                    totalHours -= 1;
                                    }
                                
                                    return `${totalHours.toString().padStart(2, '0')}:${totalMinutes.toString().padStart(2, '0')}`;
                                };
                                
                                let vwh_data = {};
                                let flag = '';

                                if (resultsVWH && resultsVWH.length > 0) {
                                    vwh_data = resultsVWH.reduce((acc, vehicle) => {
                                        const { vehicle_id, reporting_time, leaving_time } = vehicle;
                                        let total_hrs = null;
                                        if(reporting_time && leaving_time){
                                            total_hrs = calculateHours(reporting_time, leaving_time);
                                        }

                                        if(total_hrs !== null){
                                            flag = 'Contractual';
                                        }else{
                                            flag = 'Per Trip';
                                        }

                                        acc[vehicle_id] = {
                                        reporting_time,
                                        leaving_time,
                                        total_hrs,
                                        flag
                                        };
                                    
                                        return acc;
                                    }, {});
                                }
                                
                            //Step_2:
                                //const sql_VZA = `SELECT lz.zone_name, vza.zone_id, vza.vehicle_id FROM vehicle_zone_assignment AS vza LEFT JOIN logistic_zone AS lz ON lz.id = vza.zone_id WHERE vza.status = ? AND vza.group_id = ? AND lz.status = ?`;
                                const sql_VZA = `SELECT lz.zone_name, vza.zone_id, vza.vehicle_id FROM vehicle_zone_assignment AS vza LEFT JOIN logistic_zone AS lz ON lz.id = vza.zone_id WHERE vza.status = ? AND vza.group_id = ? AND lz.status = ? AND vza.vehicle_id IN (?)`;
                                const [resultVZA] = await db.promise().query(sql_VZA, [1, group_id, 1, vIds]);
                                
                                let zone_data = {}; // Declare zone_data outside the if block
                                if (resultVZA && resultVZA.length > 0) {
                                    zone_data = resultVZA.reduce((acc, item) => {
                                        const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }                                
                            
                            //Step_3:
                                const [resultT] = await db.promise().query("SELECT `id`,`name`, `code` FROM transporters WHERE `group_id` IN(?)",[group_id]);
                                
                                let transporter_data = {}; // Declare zone_data outside the if block
                                if (resultT && resultT.length > 0) {
                                    transporter_data = resultT.reduce((acc, item) => {
                                        //acc[item.id] = item.name+' ('+item.code+')'; // Map the `id` as the key and `name` as the value
                                        const { id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }
                                
                            //Step_4:
                                const [resultVBT] = await db.promise().query("SELECT `id`,`name` FROM vehicle_types WHERE `status`=1");
                            
                                let vehicle_body_data = {}; // Declare zone_data outside the if block
                                if (resultVBT && resultVBT.length > 0) {
                                    vehicle_body_data = resultVBT.reduce((acc, item) => {
                                        acc[item.id] = item.name; // Map the `id` as the key and `name` as the value
                                        return acc;
                                    }, {});
                                }
                                
                            //Step_5:
                                const sql_DOC = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, doc.issue_date, doc.expiry_date, doc.file_path FROM documents AS doc LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id WHERE doc.status = ? AND doc.vehicle_id IN (?) AND doc.group_id = ? AND doct.status = ?`;
                                const [resultDOC] = await db.promise().query(sql_DOC, [1, vIds, group_id, 1]);
                                //const sql_DOC = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, doc.issue_date, doc.expiry_date, doc.file_path FROM documents AS doc LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id WHERE doc.status = ? AND doct.status = ?`;
                                //const [resultDOC] = await db.promise().query(sql_DOC, [1, 1]);
                                
                                let document_data = {}; // Declare zone_data outside the if block
                                if (resultDOC && resultDOC.length > 0) {
                                    // document_data = resultDOC.reduce((acc, item) => {
                                    //     const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                    //     acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                    //     return acc;
                                    // }, {}); 
                                    resultDOC.forEach(doc => {
                                        const vehicleId = doc.vehicle_id;
                                        if (!document_data[vehicleId]) {
                                            document_data[vehicleId] = [];
                                        }
                                        document_data[vehicleId].push(doc);
                                    });
                                }
                                //console.log(document_data);process.exit(0);
    
                            //Step_6:
                                const sql_VDA = `SELECT vehicle_id, device_id, device_id2, device_id3, device_id4 FROM vehicle_device_assignment WHERE status = ? AND vehicle_id IN (?)`;
                                const [resultVDA] = await db.promise().query(sql_VDA, [1, vIds, 1, 1, 1]);
                                
                                let device_ids = [];
                                let vda_data = {};
                                if(resultVDA && resultVDA.length > 0){
                                    device_ids = resultVDA.flatMap(vehicle => 
                                        [vehicle.device_id, vehicle.device_id2, vehicle.device_id3, vehicle.device_id4]
                                    ).filter(id => id !== null); // Remove null values

                                    vda_data = resultVDA.reduce((acc, item) => {
                                        const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }
                                
                            //Step_7:
                                // const sql_V = `SELECT v.id AS vehicle_id, v.vehicle_number, v.vehicle_capacity_tons AS vehicle_capicity, v.max_speed AS speed, v.transporter_id, v.body_type_id, vmake.name AS vehicle_make, vmodel.model_number AS vehicle_model FROM vehicle AS v LEFT JOIN vehicle_make AS vmake ON vmake.id = v.vehicle_make_id LEFT JOIN vehicle_model AS vmodel ON vmodel.id = v.vehicle_model_id WHERE v.id IN (?) AND v.status = ? AND vmake.status = ? AND vmodel.status = ? `;
                                // const [resultV] = await db.promise().query(sql_V, [vIds, 1, 1, 1]);

                                const sql_V = `SELECT v.id AS vehicle_id, v.vehicle_number, v.vehicle_capacity_tons AS vehicle_capicity_id, v.max_speed AS speed, v.transporter_id, v.body_type_id, vmake.name AS vehicle_make, vmodel.model_number AS vehicle_model, vc.capacity AS vehicle_capicity FROM vehicle AS v LEFT JOIN vehicle_make AS vmake ON vmake.id = v.vehicle_make_id LEFT JOIN vehicle_model AS vmodel ON vmodel.id = v.vehicle_model_id LEFT JOIN vehicle_capacity AS vc ON vc.id = v.vehicle_capacity_tons WHERE v.id IN (?) AND v.status = ? AND vmake.status = ? AND vmodel.status = ? `;
                                const [resultV] = await db.promise().query(sql_V, [vIds, 1, 1, 1]);
                                //console.log(resultV);process.exit(0);
                              
                            //Step_8:
                                let resultD = [];
                                if(device_ids && device_ids.length > 0){
                                    resultD = await db.promise().query(`SELECT d.id, d.device_imei, dm.name AS device_manufacturer, dt.device_type  AS device_type FROM devices AS d LEFT JOIN device_manufacturer AS dm ON dm.id = d.device_manufacturer_id LEFT JOIN device_types AS dt ON dt.device_type_id = d.device_type WHERE  d.status = ? AND dm.status = ? AND dt.status = ?  AND d.id IN(?)`, [1, 1, 1, device_ids]);
                                    //const [resultD] = await db.promise().query("SELECT `d.id`,`d.device_manufacturer_id`,`d.device_type`,`dm.name`,`dt.device_type` FROM devices AS d LEFT JOIN device_manufacturer AS dm ON dm.id = d.device_manufacturer_id LEFT JOIN device_types AS dt ON dt.device_type_id = d.device_type WHERE  `d.status`=? AND `dm.status`=? AND `dt.status`=?", [1,1,1]);
                                }

                                let device_data = {};
                                if(resultD && resultD.length > 0){
                                    device_data = resultD.reduce((acc, item) => {
                                        const { id, ...rest } = item; // Extract id and the rest of the properties
                                        acc[id] = rest; // Assign the rest of the properties to the id key
                                        return acc;
                                    }, {});
                                }
                                // console.log(vda_data);process.exit(0);
                            
                            //Final Step:
                                final_array = resultV.map(vehicle => {

                                    let deviceInfoTemp1 = {}; let deviceInfo1  = {};
                                    let deviceInfoTemp2 = {}; let deviceInfo2  = {};
                                    let deviceInfoTemp3 = {}; let deviceInfo3  = {};
                                    let deviceInfoTemp4 = {}; let deviceInfo4  = {};

                                    // Extract required properties
                                    const { vehicle_id, vehicle_number, transporter_id, ...rest } = vehicle;
                                
                                    // Add zone data (if exists)
                                    const zoneInfo = zone_data[vehicle_id] || {};
                                
                                    // Add transporter data (if exists)
                                    const transporterInfo = transporter_data[transporter_id] || {};
                                    
                                    //Add doument data (if exists)
                                    const documentInfo = document_data[vehicle_id] || {};
    
                                    //Add vehicle_working hrs data (if exists)
                                    // const vwhInfo = vwh_data[vehicle] || {};
                                    const vwhInfo = vwh_data[vehicle.vehicle_id] || {};
                                    
                                    // Add device data for each device_id (if exists)
                                    deviceInfoTemp1 = vda_data[vehicle_id] || {};
                                    deviceInfo1  = deviceInfoTemp1 ? device_data[deviceInfoTemp1.device_id] : {}
                                    
                                    deviceInfoTemp2 = vda_data[vehicle_id] || {};
                                    deviceInfo2  = deviceInfoTemp2 ? device_data[deviceInfoTemp2.device_id2] : {}
                                    
                                    deviceInfoTemp3 = vda_data[vehicle_id] || {};
                                    deviceInfo3  = deviceInfoTemp3 ? device_data[deviceInfoTemp3.device_id3] : {}
                                    
                                    deviceInfoTemp4 = vda_data[vehicle_id] || {};
                                    deviceInfo4  = deviceInfoTemp4 ? device_data[deviceInfoTemp4.device_id4] : {}
                                    
                                    // Construct the final object
                                    return {
                                        ...rest,
                                        vehicle_id,
                                        vehicle_number,
                                        region_name: zoneInfo.zone_name || null,
                                        region_id: zoneInfo.zone_id || null,
                                        transporter_id,
                                        transporter_name: transporterInfo.name || null,
                                        transporter_code: transporterInfo.code || null,
                                        // contract_type: vwhInfo>0 ? 'Yes' : 'No',
                                        // contract_type : (vwhInfo && Object.values(vwhInfo).some(val => val && val !== '00:00')) ? 'Contractual' : 'Non Contractual',
                                        
                                        // contract_type: Object.keys(vwhInfo).length>0 ? 'Yes' : 'No',
                                        contract_type: Object.keys(vwhInfo).length>0 ? vwhInfo.flag : 'Non-Contractual',
                                        reporting_time: vwhInfo.reporting_time || null,
                                        leaving_time: vwhInfo.leaving_time || null,
                                        total_hours: vwhInfo.total_hrs || null,
                                        device_id : deviceInfoTemp1 ? deviceInfoTemp1.device_id : null,                                     
                                        device_imei: deviceInfo1 ? deviceInfo1.device_imei : null,
                                        device_manufacturer: deviceInfo1 ? deviceInfo1.device_manufacturer : null,
                                        device_type: deviceInfo1 ? deviceInfo1.device_type : null,
                                        device_id2 : deviceInfoTemp2 ? deviceInfoTemp2.device_id2 : null,                                     
                                        device_imei2: deviceInfo2 ? deviceInfo2.device_imei : null,
                                        device_manufacturer2: deviceInfo2 ? deviceInfo2.device_manufacturer : null,
                                        device_type2: deviceInfo2 ? deviceInfo2.device_type : null,
                                        device_id3 : deviceInfoTemp3 ? deviceInfoTemp3.device_id3 : null,                                     
                                        device_imei3: deviceInfo3 ? deviceInfo3.device_imei : null,
                                        device_manufacturer3: deviceInfo3 ? deviceInfo3.device_manufacturer : null,
                                        device_type3: deviceInfo3 ? deviceInfo3.device_type : null,
                                        device_id4 : deviceInfoTemp4 ? deviceInfoTemp4.device_id4 : null,                                     
                                        device_imei4: deviceInfo4 ? deviceInfo4.device_imei : null,
                                        device_manufacturer4: deviceInfo4 ? deviceInfo4.device_manufacturer : null,
                                        device_type4: deviceInfo4 ? deviceInfo4.device_type : null,
                                        // document_id:documentInfo.id || null,
                                        // document_name:documentInfo.document_name || null,
                                        // document_type_id:documentInfo.doc_type_id || null,
                                        // document_no:documentInfo.doc_no || null,
                                        // document_issue_date:documentInfo.issue_date || null,
                                        // document_expiry_date:documentInfo.expiry_date || null,
                                        // document_file_path:documentInfo.file_path || null,
                                        documentInfo
                                    };
                                });                              
                            //console.log(final_array);process.exit(0);
                        }
                    }else if(region && transporter_id){

                        const sql_VzoneA = `SELECT vehicle_id FROM vehicle_zone_assignment WHERE status = ? AND zone_id IN(?)`;
                        const [resultVzoneA] = await db.promise().query(sql_VzoneA, [1, region]);
                        
                        const sql_VTA = `SELECT vehicle_id FROM vehicle_transporter_assignment WHERE status = ? AND transporter_id IN (?) `;
                        const [resultVTA] = await db.promise().query(sql_VTA, [1, transporter_id]);

                        // Extract the vehicle IDs from both arrays
                        const zoneVehicleIds = resultVzoneA.map(item => item.vehicle_id);
                        const vtaVehicleIds = resultVTA.map(item => item.vehicle_id);

                        // Find the intersection of both arrays
                        vIds = zoneVehicleIds.filter(id => vtaVehicleIds.includes(id));
                        
                        if (vIds && vIds.length > 0) {
                                    
                            //Step_1:
                                //const [vIds_arr] = vIds;
                                const conditions = {
                                    //vehicle_id: { $in: vIds },
                                    status:1,
                                    group_id: group_id
                                };
                                
                                const fields = {};
                                const table ="logistic_vehicle_working_hour";
                                const resultsVWH = await getMongo.getMongoQuery(conditions, fields, table);                        
                                // console.log(resultsVWH);process.exit(0);
    
                                const calculateHours = (reporting, leaving) => {
                                    const [startHour, startMin] = reporting.split(':').map(Number);
                                    const [endHour, endMin] = leaving.split(':').map(Number);
                                
                                    let totalHours = endHour - startHour;
                                    let totalMinutes = endMin - startMin;
                                
                                    if (totalMinutes < 0) {
                                    totalMinutes += 60;
                                    totalHours -= 1;
                                    }
                                
                                    return `${totalHours.toString().padStart(2, '0')}:${totalMinutes.toString().padStart(2, '0')}`;
                                };
                                
                                let vwh_data = {};
                                let flag = '';

                                if (resultsVWH && resultsVWH.length > 0) {
                                    vwh_data = resultsVWH.reduce((acc, vehicle) => {
                                        const { vehicle_id, reporting_time, leaving_time } = vehicle;
                                        let total_hrs = null;
                                        if(reporting_time && leaving_time){
                                            total_hrs = calculateHours(reporting_time, leaving_time);
                                        }

                                        if(total_hrs !== null){
                                            flag = 'Contractual';
                                        }else{
                                            flag = 'Per Trip';
                                        }

                                        acc[vehicle_id] = {
                                        reporting_time,
                                        leaving_time,
                                        total_hrs,
                                        flag
                                        };
                                    
                                        return acc;
                                    }, {});
                                }
                                
                            //Step_2:
                                //const sql_VZA = `SELECT lz.zone_name, vza.zone_id, vza.vehicle_id FROM vehicle_zone_assignment AS vza LEFT JOIN logistic_zone AS lz ON lz.id = vza.zone_id WHERE vza.status = ? AND vza.group_id = ? AND lz.status = ?`;
                                const sql_VZA = `SELECT lz.zone_name, vza.zone_id, vza.vehicle_id FROM vehicle_zone_assignment AS vza LEFT JOIN logistic_zone AS lz ON lz.id = vza.zone_id WHERE vza.status = ? AND vza.group_id = ? AND lz.status = ? AND vza.vehicle_id IN (?)`;
                                const [resultVZA] = await db.promise().query(sql_VZA, [1, group_id, 1, vIds]);
                                
                                let zone_data = {}; // Declare zone_data outside the if block
                                if (resultVZA && resultVZA.length > 0) {
                                    zone_data = resultVZA.reduce((acc, item) => {
                                        const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }                                
                            
                            //Step_3:
                                TrnsIds = [transporter_id];
                                t_Ids = TrnsIds[0].split(',').map(id => parseInt(id.trim(), 10));
                                //console.log(t_Ids);process.exit(0);
                                const [resultT] = await db.promise().query("SELECT `id`,`name`, `code` FROM transporters WHERE `id` IN(?)",[t_Ids]);
                                //const [resultT] = await db.promise().query("SELECT `id`,`name`, `code` FROM transporters WHERE `status`= ? AND `group_id` IN(?)",[1,group_id]);
                                
                                let transporter_data = {}; // Declare zone_data outside the if block
                                if (resultT && resultT.length > 0) {
                                    transporter_data = resultT.reduce((acc, item) => {
                                        //acc[item.id] = item.name+' ('+item.code+')'; // Map the `id` as the key and `name` as the value
                                        const { id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }
                                
                            //Step_4:
                                const [resultVBT] = await db.promise().query("SELECT `id`,`name` FROM vehicle_types WHERE `status`=1");
                            
                                let vehicle_body_data = {}; // Declare zone_data outside the if block
                                if (resultVBT && resultVBT.length > 0) {
                                    vehicle_body_data = resultVBT.reduce((acc, item) => {
                                        acc[item.id] = item.name; // Map the `id` as the key and `name` as the value
                                        return acc;
                                    }, {});
                                }
                                
                            //Step_5:
                                const sql_DOC = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, doc.issue_date, doc.expiry_date, doc.file_path FROM documents AS doc LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id WHERE doc.status = ? AND doc.vehicle_id IN (?) AND doc.group_id = ? AND doct.status = ?`;
                                const [resultDOC] = await db.promise().query(sql_DOC, [1, vIds, group_id, 1]);
                                //const sql_DOC = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, doc.issue_date, doc.expiry_date, doc.file_path FROM documents AS doc LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id WHERE doc.status = ? AND doct.status = ?`;
                                //const [resultDOC] = await db.promise().query(sql_DOC, [1, 1]);
                                
                                let document_data = {}; // Declare zone_data outside the if block
                                if (resultDOC && resultDOC.length > 0) {
                                    // document_data = resultDOC.reduce((acc, item) => {
                                    //     const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                    //     acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                    //     return acc;
                                    // }, {}); 
                                    resultDOC.forEach(doc => {
                                        const vehicleId = doc.vehicle_id;
                                        if (!document_data[vehicleId]) {
                                            document_data[vehicleId] = [];
                                        }
                                        document_data[vehicleId].push(doc);
                                    });
                                }
                                //console.log(document_data);process.exit(0);
    
                            //Step_6:
                                const sql_VDA = `SELECT vehicle_id, device_id, device_id2, device_id3, device_id4 FROM vehicle_device_assignment WHERE status = ? AND vehicle_id IN (?)`;
                                const [resultVDA] = await db.promise().query(sql_VDA, [1, vIds, 1, 1, 1]);
                                
                                let device_ids = [];
                                let vda_data = {};
                                if(resultVDA && resultVDA.length > 0){
                                    device_ids = resultVDA.flatMap(vehicle => 
                                        [vehicle.device_id, vehicle.device_id2, vehicle.device_id3, vehicle.device_id4]
                                    ).filter(id => id !== null); // Remove null values

                                    vda_data = resultVDA.reduce((acc, item) => {
                                        const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }
                                //console.log(device_ids);process.exit(0);
                            //Step_7:
                                // const sql_V = `SELECT v.id AS vehicle_id, v.vehicle_number, v.vehicle_capacity_tons AS vehicle_capicity, v.max_speed AS speed, v.transporter_id, v.body_type_id, vmake.name AS vehicle_make, vmodel.model_number AS vehicle_model FROM vehicle AS v LEFT JOIN vehicle_make AS vmake ON vmake.id = v.vehicle_make_id LEFT JOIN vehicle_model AS vmodel ON vmodel.id = v.vehicle_model_id WHERE v.id IN (?) AND v.status = ? AND vmake.status = ? AND vmodel.status = ? `;
                                // const [resultV] = await db.promise().query(sql_V, [vIds, 1, 1, 1]);

                                const sql_V = `SELECT v.id AS vehicle_id, v.vehicle_number, v.vehicle_capacity_tons AS vehicle_capicity_id, v.max_speed AS speed, v.transporter_id, v.body_type_id, vmake.name AS vehicle_make, vmodel.model_number AS vehicle_model, vc.capacity AS vehicle_capicity FROM vehicle AS v LEFT JOIN vehicle_make AS vmake ON vmake.id = v.vehicle_make_id LEFT JOIN vehicle_model AS vmodel ON vmodel.id = v.vehicle_model_id LEFT JOIN vehicle_capacity AS vc ON vc.id = v.vehicle_capacity_tons WHERE v.id IN (?) AND v.status = ? AND vmake.status = ? AND vmodel.status = ? `;
                                const [resultV] = await db.promise().query(sql_V, [vIds, 1, 1, 1]);
                                //console.log(resultV);process.exit(0);
                              
                            //Step_8:
                                const [resultD] = await db.promise().query(`SELECT d.id, d.device_imei, dm.name AS device_manufacturer, dt.device_type  AS device_type FROM devices AS d LEFT JOIN device_manufacturer AS dm ON dm.id = d.device_manufacturer_id LEFT JOIN device_types AS dt ON dt.device_type_id = d.device_type WHERE  d.status = ? AND dm.status = ? AND dt.status = ?  AND d.id IN(?)`, [1, 1, 1, device_ids]);
                                //const [resultD] = await db.promise().query("SELECT `d.id`,`d.device_manufacturer_id`,`d.device_type`,`dm.name`,`dt.device_type` FROM devices AS d LEFT JOIN device_manufacturer AS dm ON dm.id = d.device_manufacturer_id LEFT JOIN device_types AS dt ON dt.device_type_id = d.device_type WHERE  `d.status`=? AND `dm.status`=? AND `dt.status`=?", [1,1,1]);
                            
                                let device_data = {};
                                if(resultD && resultD.length > 0){
                                    device_data = resultD.reduce((acc, item) => {
                                        const { id, ...rest } = item; // Extract id and the rest of the properties
                                        acc[id] = rest; // Assign the rest of the properties to the id key
                                        return acc;
                                    }, {});
                                }
                                // console.log(vda_data);process.exit(0);
                            
                            //Final Step:
                                final_array = resultV.map(vehicle => {

                                    let deviceInfoTemp1 = {}; let deviceInfo1  = {};
                                    let deviceInfoTemp2 = {}; let deviceInfo2  = {};
                                    let deviceInfoTemp3 = {}; let deviceInfo3  = {};
                                    let deviceInfoTemp4 = {}; let deviceInfo4  = {};

                                    // Extract required properties
                                    const { vehicle_id, vehicle_number, transporter_id, ...rest } = vehicle;
                                
                                    // Add zone data (if exists)
                                    const zoneInfo = zone_data[vehicle_id] || {};
                                
                                    // Add transporter data (if exists)
                                    const transporterInfo = transporter_data[transporter_id] || {};
                                    
                                    //Add doument data (if exists)
                                    const documentInfo = document_data[vehicle_id] || {};
    
                                    //Add vehicle_working hrs data (if exists)
                                    const vwhInfo = vwh_data[vehicle] || {};
                                    
                                    // Add device data for each device_id (if exists)
                                    deviceInfoTemp1 = vda_data[vehicle_id] || {};
                                    deviceInfo1  = deviceInfoTemp1 ? device_data[deviceInfoTemp1.device_id] : {}
                                    
                                    deviceInfoTemp2 = vda_data[vehicle_id] || {};
                                    deviceInfo2  = deviceInfoTemp2 ? device_data[deviceInfoTemp2.device_id2] : {}
                                    
                                    deviceInfoTemp3 = vda_data[vehicle_id] || {};
                                    deviceInfo3  = deviceInfoTemp3 ? device_data[deviceInfoTemp3.device_id3] : {}
                                    
                                    deviceInfoTemp4 = vda_data[vehicle_id] || {};
                                    deviceInfo4  = deviceInfoTemp4 ? device_data[deviceInfoTemp4.device_id4] : {}
                                    
                                    // Construct the final object
                                    return {
                                        ...rest,
                                        vehicle_id,
                                        vehicle_number,
                                        region_name: zoneInfo.zone_name || null,
                                        region_id: zoneInfo.zone_id || null,
                                        transporter_id,
                                        transporter_name: transporterInfo.name || null,
                                        transporter_code: transporterInfo.code || null,
                                        // contract_type: vwhInfo>0 ? 'Yes' : 'No',
                                        // contract_type : (vwhInfo && Object.values(vwhInfo).some(val => val && val !== '00:00')) ? 'Contractual' : 'Non Contractual',
                                        contract_type: Object.keys(vwhInfo).length>0 ? vwhInfo.flag : 'Non-Contractual',
                                        reporting_time: vwhInfo.reporting_time || null,
                                        leaving_time: vwhInfo.leaving_time || null,
                                        total_hours: vwhInfo.total_hrs || null,
                                        device_id : deviceInfoTemp1 ? deviceInfoTemp1.device_id : null,                                     
                                        device_imei: deviceInfo1 ? deviceInfo1.device_imei : null,
                                        device_manufacturer: deviceInfo1 ? deviceInfo1.device_manufacturer : null,
                                        device_type: deviceInfo1 ? deviceInfo1.device_type : null,
                                        device_id2 : deviceInfoTemp2 ? deviceInfoTemp2.device_id2 : null,                                     
                                        device_imei2: deviceInfo2 ? deviceInfo2.device_imei : null,
                                        device_manufacturer2: deviceInfo2 ? deviceInfo2.device_manufacturer : null,
                                        device_type2: deviceInfo2 ? deviceInfo2.device_type : null,
                                        device_id3 : deviceInfoTemp3 ? deviceInfoTemp3.device_id3 : null,                                     
                                        device_imei3: deviceInfo3 ? deviceInfo3.device_imei : null,
                                        device_manufacturer3: deviceInfo3 ? deviceInfo3.device_manufacturer : null,
                                        device_type3: deviceInfo3 ? deviceInfo3.device_type : null,
                                        device_id4 : deviceInfoTemp4 ? deviceInfoTemp4.device_id4 : null,                                     
                                        device_imei4: deviceInfo4 ? deviceInfo4.device_imei : null,
                                        device_manufacturer4: deviceInfo4 ? deviceInfo4.device_manufacturer : null,
                                        device_type4: deviceInfo4 ? deviceInfo4.device_type : null,
                                        // document_id:documentInfo.id || null,
                                        // document_name:documentInfo.document_name || null,
                                        // document_type_id:documentInfo.doc_type_id || null,
                                        // document_no:documentInfo.doc_no || null,
                                        // document_issue_date:documentInfo.issue_date || null,
                                        // document_expiry_date:documentInfo.expiry_date || null,
                                        // document_file_path:documentInfo.file_path || null,
                                        documentInfo
                                    };
                                });
                              
                            //console.log(final_array.length);process.exit(0);                                    
                        }
                    }else if(region){

                        const sql_VzoneA = `SELECT vehicle_id FROM vehicle_zone_assignment WHERE status = ? AND zone_id IN(?)`;
                        const [resultVzoneA] = await db.promise().query(sql_VzoneA, [1, region]);
                        vIds = resultVzoneA.map(item => item.vehicle_id);
                        
                        if (vIds && vIds.length > 0) {
                                    
                            //Step_1:
                                //const [vIds_arr] = vIds;
                                const conditions = {
                                    //vehicle_id: { $in: vIds },
                                    status:1,
                                    group_id: group_id
                                };
                                
                                const fields = {};
                                const table ="logistic_vehicle_working_hour";
                                const resultsVWH = await getMongo.getMongoQuery(conditions, fields, table);                        
                                // console.log(resultsVWH);process.exit(0);
    
                                const calculateHours = (reporting, leaving) => {
                                    const [startHour, startMin] = reporting.split(':').map(Number);
                                    const [endHour, endMin] = leaving.split(':').map(Number);
                                
                                    let totalHours = endHour - startHour;
                                    let totalMinutes = endMin - startMin;
                                
                                    if (totalMinutes < 0) {
                                        totalMinutes += 60;
                                        totalHours -= 1;
                                    }
                                
                                    return `${totalHours.toString().padStart(2, '0')}:${totalMinutes.toString().padStart(2, '0')}`;
                                };
                                
                                let vwh_data = {};
                                let flag = '';

                                if (resultsVWH && resultsVWH.length > 0) {
                                    vwh_data = resultsVWH.reduce((acc, vehicle) => {
                                        const { vehicle_id, reporting_time, leaving_time } = vehicle;
                                        let total_hrs = null;
                                        if(reporting_time && leaving_time){
                                            total_hrs = calculateHours(reporting_time, leaving_time);
                                        }

                                        if(total_hrs !== null){
                                            flag = 'Contractual';
                                        }else{
                                            flag = 'Per Trip';
                                        }

                                        acc[vehicle_id] = {
                                        reporting_time,
                                        leaving_time,
                                        total_hrs,
                                        flag
                                        };
                                    
                                        return acc;
                                    }, {});
                                }                                
                            //Step_2:
                                //const sql_VZA = `SELECT lz.zone_name, vza.zone_id, vza.vehicle_id FROM vehicle_zone_assignment AS vza LEFT JOIN logistic_zone AS lz ON lz.id = vza.zone_id WHERE vza.status = ? AND vza.group_id = ? AND lz.status = ?`;
                                const sql_VZA = `SELECT lz.zone_name, vza.zone_id, vza.vehicle_id FROM vehicle_zone_assignment AS vza LEFT JOIN logistic_zone AS lz ON lz.id = vza.zone_id WHERE vza.status = ? AND vza.group_id = ? AND lz.status = ? AND vza.vehicle_id IN (?)`;
                                const [resultVZA] = await db.promise().query(sql_VZA, [1, group_id, 1, vIds]);
                                
                                let zone_data = {}; // Declare zone_data outside the if block
                                if (resultVZA && resultVZA.length > 0) {
                                    zone_data = resultVZA.reduce((acc, item) => {
                                        const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }                                
                                //console.log(zone_data);
                            //Step_3:
                                const [resultT] = await db.promise().query("SELECT `id`,`name`, `code` FROM transporters WHERE `group_id` IN(?)",[group_id]);
                                
                                let transporter_data = {}; // Declare zone_data outside the if block
                                if (resultT && resultT.length > 0) {
                                    transporter_data = resultT.reduce((acc, item) => {
                                        //acc[item.id] = item.name+' ('+item.code+')'; // Map the `id` as the key and `name` as the value
                                        const { id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }
                               // console.log(transporter_data);   
                            //Step_4:
                                const [resultVBT] = await db.promise().query("SELECT `id`,`name` FROM vehicle_types WHERE `status`=1");
                            
                                let vehicle_body_data = {}; // Declare zone_data outside the if block
                                if (resultVBT && resultVBT.length > 0) {
                                    vehicle_body_data = resultVBT.reduce((acc, item) => {
                                        acc[item.id] = item.name; // Map the `id` as the key and `name` as the value
                                        return acc;
                                    }, {});
                                }                                
                            //Step_5:
                                const sql_DOC = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, doc.issue_date, doc.expiry_date, doc.file_path FROM documents AS doc LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id WHERE doc.status = ? AND doc.vehicle_id IN (?) AND doc.group_id = ? AND doct.status = ?`;
                                const [resultDOC] = await db.promise().query(sql_DOC, [1, vIds, group_id, 1]);
                                //const sql_DOC = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, doc.issue_date, doc.expiry_date, doc.file_path FROM documents AS doc LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id WHERE doc.status = ? AND doct.status = ?`;
                                //const [resultDOC] = await db.promise().query(sql_DOC, [1, 1]);
                                
                                let document_data = {}; // Declare zone_data outside the if block
                                if (resultDOC && resultDOC.length > 0) {
                                    // document_data = resultDOC.reduce((acc, item) => {
                                    //     const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                    //     acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                    //     return acc;
                                    // }, {}); 
                                    resultDOC.forEach(doc => {
                                        const vehicleId = doc.vehicle_id;
                                        if (!document_data[vehicleId]) {
                                            document_data[vehicleId] = [];
                                        }
                                        document_data[vehicleId].push(doc);
                                    });
                                }
                                //console.log(document_data);process.exit(0);    
                            //Step_6:
                                const sql_VDA = `SELECT vehicle_id, device_id, device_id2, device_id3, device_id4 FROM vehicle_device_assignment WHERE status = ? AND vehicle_id IN (?)`;
                                const [resultVDA] = await db.promise().query(sql_VDA, [1, vIds, 1, 1, 1]);
                                
                                let device_ids = [];
                                let vda_data = {};
                                if(resultVDA && resultVDA.length > 0){
                                    device_ids = resultVDA.flatMap(vehicle => 
                                        [vehicle.device_id, vehicle.device_id2, vehicle.device_id3, vehicle.device_id4]
                                    ).filter(id => id !== null); // Remove null values

                                    vda_data = resultVDA.reduce((acc, item) => {
                                        const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }
                                //console.log(device_ids);process.exit(0);
                            //Step_7:
                                //const sql_V = `SELECT v.id AS vehicle_id, v.vehicle_number, v.vehicle_capacity_tons AS vehicle_capicity, v.max_speed AS speed, v.transporter_id, v.body_type_id, vmake.name AS vehicle_make, vmodel.model_number AS vehicle_model FROM vehicle AS v LEFT JOIN vehicle_make AS vmake ON vmake.id = v.vehicle_make_id LEFT JOIN vehicle_model AS vmodel ON vmodel.id = v.vehicle_model_id WHERE v.id IN (?) AND v.status = ? AND vmake.status = ? AND vmodel.status = ? `;
                                // const sql_V = `SELECT v.id AS vehicle_id, v.vehicle_number, v.vehicle_capacity_tons AS vehicle_capicity, v.max_speed AS speed,vta.transporter_id, v.body_type_id, vmake.name AS vehicle_make, vmodel.model_number AS vehicle_model FROM vehicle AS v LEFT JOIN vehicle_make AS vmake ON vmake.id = v.vehicle_make_id LEFT JOIN vehicle_model AS vmodel ON vmodel.id = v.vehicle_model_id  LEFT JOIN vehicle_transporter_assignment AS vta ON v.id = vta.vehicle_id WHERE v.id IN (?) AND v.status = ? AND vmake.status = ? AND vmodel.status = ? AND vta.status =? `;
                                // const [resultV] = await db.promise().query(sql_V, [vIds, 1, 1, 1,1]);

                                const sql_V = `SELECT v.id AS vehicle_id, v.vehicle_number, v.vehicle_capacity_tons AS vehicle_capicity_id, v.max_speed AS speed, v.transporter_id, v.body_type_id, vmake.name AS vehicle_make, vmodel.model_number AS vehicle_model, vc.capacity AS vehicle_capicity FROM vehicle AS v LEFT JOIN vehicle_make AS vmake ON vmake.id = v.vehicle_make_id LEFT JOIN vehicle_model AS vmodel ON vmodel.id = v.vehicle_model_id LEFT JOIN vehicle_capacity AS vc ON vc.id = v.vehicle_capacity_tons WHERE v.id IN (?) AND v.status = ? AND vmake.status = ? AND vmodel.status = ? `;
                                const [resultV] = await db.promise().query(sql_V, [vIds, 1, 1, 1]);
                                //console.log(vIds.length);
                                //console.log(resultV.length);process.exit(0);
                            //Step_8:
                                const [resultD] = await db.promise().query(`SELECT d.id, d.device_imei, dm.name AS device_manufacturer, dt.device_type  AS device_type FROM devices AS d LEFT JOIN device_manufacturer AS dm ON dm.id = d.device_manufacturer_id LEFT JOIN device_types AS dt ON dt.device_type_id = d.device_type WHERE  d.status = ? AND dm.status = ? AND dt.status = ?  AND d.id IN(?)`, [1, 1, 1, device_ids]);
                                //const [resultD] = await db.promise().query("SELECT `d.id`,`d.device_manufacturer_id`,`d.device_type`,`dm.name`,`dt.device_type` FROM devices AS d LEFT JOIN device_manufacturer AS dm ON dm.id = d.device_manufacturer_id LEFT JOIN device_types AS dt ON dt.device_type_id = d.device_type WHERE  `d.status`=? AND `dm.status`=? AND `dt.status`=?", [1,1,1]);
                            
                                let device_data = {};
                                if(resultD && resultD.length > 0){
                                    device_data = resultD.reduce((acc, item) => {
                                        const { id, ...rest } = item; // Extract id and the rest of the properties
                                        acc[id] = rest; // Assign the rest of the properties to the id key
                                        return acc;
                                    }, {});
                                }
                                //console.log(resultV);process.exit(0);                            
                            //Final Step:
                                final_array = resultV.map(vehicle => {

                                    let deviceInfoTemp1 = {}; let deviceInfo1  = {};
                                    let deviceInfoTemp2 = {}; let deviceInfo2  = {};
                                    let deviceInfoTemp3 = {}; let deviceInfo3  = {};
                                    let deviceInfoTemp4 = {}; let deviceInfo4  = {};

                                    // Extract required properties
                                    const { vehicle_id, vehicle_number, transporter_id, ...rest } = vehicle;
                                
                                    // Add zone data (if exists)
                                    const zoneInfo = zone_data[vehicle_id] || {};
                                
                                    // Add transporter data (if exists)
                                    const transporterInfo = transporter_data[transporter_id] || {};
                                    
                                    //Add doument data (if exists)
                                    const documentInfo = document_data[vehicle_id] || {};
    
                                    //Add vehicle_working hrs data (if exists)
                                    const vwhInfo = vwh_data[vehicle_id] || {};
                                    //console.log(vwhInfo);process.exit(0);
                                    // Add device data for each device_id (if exists)
                                    deviceInfoTemp1 = vda_data[vehicle_id] || {};
                                    
                                    deviceInfo1  = deviceInfoTemp1 ? device_data[deviceInfoTemp1.device_id] : {}
                                    //console.log(deviceInfo1);//process.exit(0);
                                    deviceInfoTemp2 = vda_data[vehicle_id] || {};
                                    deviceInfo2  = deviceInfoTemp2 ? device_data[deviceInfoTemp2.device_id2] : {}
                                    
                                    deviceInfoTemp3 = vda_data[vehicle_id] || {};
                                    deviceInfo3  = deviceInfoTemp3 ? device_data[deviceInfoTemp3.device_id3] : {}
                                    
                                    deviceInfoTemp4 = vda_data[vehicle_id] || {};
                                    deviceInfo4  = deviceInfoTemp4 ? device_data[deviceInfoTemp4.device_id4] : {}
                                    
                                    // Construct the final object
                                    return {
                                        ...rest,
                                        vehicle_id,
                                        vehicle_number,
                                        region_name: zoneInfo.zone_name || null,
                                        region_id: zoneInfo.zone_id || null,
                                        transporter_id,
                                        transporter_name: transporterInfo.name || null,
                                        transporter_code: transporterInfo.code || null,
                                        //contract_type: vwhInfo>0 ? 'Yes' : 'No',
                                        // contract_type: vwhInfo.total_hrs ? 'Yes' : 'No',
                                        // contract_type : (vwhInfo && Object.values(vwhInfo).some(val => val && val !== '00:00')) ? 'Contractual' : 'Non Contractual',
                                        contract_type: Object.keys(vwhInfo).length>0 ? vwhInfo.flag : 'Non-Contractual',
                                        reporting_time: vwhInfo.reporting_time || null,
                                        leaving_time: vwhInfo.leaving_time || null,
                                        total_hours: vwhInfo.total_hrs || null,
                                        device_id : deviceInfoTemp1 ? deviceInfoTemp1.device_id : null,                                     
                                        device_imei: deviceInfo1 ? deviceInfo1.device_imei : null,
                                        device_manufacturer: deviceInfo1 ? deviceInfo1.device_manufacturer : null,
                                        device_type: deviceInfo1 ? deviceInfo1.device_type : null,
                                        device_id2 : deviceInfoTemp2 ? deviceInfoTemp2.device_id2 : null,                                     
                                        device_imei2: deviceInfo2 ? deviceInfo2.device_imei : null,
                                        device_manufacturer2: deviceInfo2 ? deviceInfo2.device_manufacturer : null,
                                        device_type2: deviceInfo2 ? deviceInfo2.device_type : null,
                                        device_id3 : deviceInfoTemp3 ? deviceInfoTemp3.device_id3 : null,                                     
                                        device_imei3: deviceInfo3 ? deviceInfo3.device_imei : null,
                                        device_manufacturer3: deviceInfo3 ? deviceInfo3.device_manufacturer : null,
                                        device_type3: deviceInfo3 ? deviceInfo3.device_type : null,
                                        device_id4 : deviceInfoTemp4 ? deviceInfoTemp4.device_id4 : null,                                     
                                        device_imei4: deviceInfo4 ? deviceInfo4.device_imei : null,
                                        device_manufacturer4: deviceInfo4 ? deviceInfo4.device_manufacturer : null,
                                        device_type4: deviceInfo4 ? deviceInfo4.device_type : null,
                                        // document_id:documentInfo.id || null,
                                        // document_name:documentInfo.document_name || null,
                                        // document_type_id:documentInfo.doc_type_id || null,
                                        // document_no:documentInfo.doc_no || null,
                                        // document_issue_date:documentInfo.issue_date || null,
                                        // document_expiry_date:documentInfo.expiry_date || null,
                                        // document_file_path:documentInfo.file_path || null,
                                        documentInfo
                                    };
                                });
                              
                            //console.log(final_array);process.exit(0);                                    
                        }
                    }else if(transporter_id){

                        const sql_VTA = `SELECT vehicle_id FROM vehicle_transporter_assignment WHERE status = ? AND transporter_id IN (?) `;
                        const [resultVTA] = await db.promise().query(sql_VTA, [1, transporter_id]);
                        vIds = resultVTA.map(item => item.vehicle_id);
                        
                        if (vIds && vIds.length > 0) {
                                    
                            //Step_1:
                                //const [vIds_arr] = vIds;
                                const conditions = {
                                    //vehicle_id: { $in: vIds },
                                    status:1,
                                    group_id: group_id
                                };
                                
                                const fields = {};
                                const table ="logistic_vehicle_working_hour";
                                const resultsVWH = await getMongo.getMongoQuery(conditions, fields, table);                        
                                // console.log(resultsVWH);process.exit(0);
    
                                const calculateHours = (reporting, leaving) => {
                                    const [startHour, startMin] = reporting.split(':').map(Number);
                                    const [endHour, endMin] = leaving.split(':').map(Number);
                                
                                    let totalHours = endHour - startHour;
                                    let totalMinutes = endMin - startMin;
                                
                                    if (totalMinutes < 0) {
                                    totalMinutes += 60;
                                    totalHours -= 1;
                                    }
                                
                                    return `${totalHours.toString().padStart(2, '0')}:${totalMinutes.toString().padStart(2, '0')}`;
                                };
                                
                                let vwh_data = {};
                                let flag = '';

                                if (resultsVWH && resultsVWH.length > 0) {
                                    vwh_data = resultsVWH.reduce((acc, vehicle) => {
                                        const { vehicle_id, reporting_time, leaving_time } = vehicle;
                                        let total_hrs = null;
                                        if(reporting_time && leaving_time){
                                            total_hrs = calculateHours(reporting_time, leaving_time);
                                        }

                                        if(total_hrs !== null){
                                            flag = 'Contractual';
                                        }else{
                                            flag = 'Per Trip';
                                        }

                                        acc[vehicle_id] = {
                                            reporting_time,
                                            leaving_time,
                                            total_hrs,
                                            flag
                                        };
                                    
                                        return acc;
                                    }, {});
                                }
                            //Step_2:
                                //const sql_VZA = `SELECT lz.zone_name, vza.zone_id, vza.vehicle_id FROM vehicle_zone_assignment AS vza LEFT JOIN logistic_zone AS lz ON lz.id = vza.zone_id WHERE vza.status = ? AND vza.group_id = ? AND lz.status = ?`;
                                const sql_VZA = `SELECT lz.zone_name, vza.zone_id, vza.vehicle_id FROM vehicle_zone_assignment AS vza LEFT JOIN logistic_zone AS lz ON lz.id = vza.zone_id WHERE vza.status = ? AND vza.group_id = ? AND lz.status = ? AND vza.vehicle_id IN (?)`;
                                const [resultVZA] = await db.promise().query(sql_VZA, [1, group_id, 1, vIds]);
                                
                                let zone_data = {}; // Declare zone_data outside the if block
                                if (resultVZA && resultVZA.length > 0) {
                                    zone_data = resultVZA.reduce((acc, item) => {
                                        const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }
                            //Step_3:
                                TrnsIds = [transporter_id];
                                t_Ids = TrnsIds[0].split(',').map(id => parseInt(id.trim(), 10));
                                //console.log(t_Ids);process.exit(0);
                                const [resultT] = await db.promise().query("SELECT `id`,`name`, `code` FROM transporters WHERE AND `id` IN(?)",[t_Ids]);
                                //const [resultT] = await db.promise().query("SELECT `id`,`name`, `code` FROM transporters WHERE `status`= ? AND `group_id` IN(?)",[1,group_id]);
                                
                                let transporter_data = {}; // Declare zone_data outside the if block
                                if (resultT && resultT.length > 0) {
                                    transporter_data = resultT.reduce((acc, item) => {
                                        //acc[item.id] = item.name+' ('+item.code+')'; // Map the `id` as the key and `name` as the value
                                        const { id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }
                            //Step_4:
                                const [resultVBT] = await db.promise().query("SELECT `id`,`name` FROM vehicle_types WHERE `status`=1");
                            
                                let vehicle_body_data = {}; // Declare zone_data outside the if block
                                if (resultVBT && resultVBT.length > 0) {
                                    vehicle_body_data = resultVBT.reduce((acc, item) => {
                                        acc[item.id] = item.name; // Map the `id` as the key and `name` as the value
                                        return acc;
                                    }, {});
                                }
                            //Step_5:
                                const sql_DOC = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, doc.issue_date, doc.expiry_date, doc.file_path FROM documents AS doc LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id WHERE doc.status = ? AND doc.vehicle_id IN (?) AND doc.group_id = ? AND doct.status = ?`;
                                const [resultDOC] = await db.promise().query(sql_DOC, [1, vIds, group_id, 1]);
                                //const sql_DOC = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, doc.issue_date, doc.expiry_date, doc.file_path FROM documents AS doc LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id WHERE doc.status = ? AND doct.status = ?`;
                                //const [resultDOC] = await db.promise().query(sql_DOC, [1, 1]);
                                
                                let document_data = {}; // Declare zone_data outside the if block
                                if (resultDOC && resultDOC.length > 0) {
                                    // document_data = resultDOC.reduce((acc, item) => {
                                    //     const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                    //     acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                    //     return acc;
                                    // }, {}); 
                                    resultDOC.forEach(doc => {
                                        const vehicleId = doc.vehicle_id;
                                        if (!document_data[vehicleId]) {
                                            document_data[vehicleId] = [];
                                        }
                                        document_data[vehicleId].push(doc);
                                    });
                                }
                            //Step_6:
                                const sql_VDA = `SELECT vehicle_id, device_id, device_id2, device_id3, device_id4 FROM vehicle_device_assignment WHERE status = ? AND vehicle_id IN (?)`;
                                const [resultVDA] = await db.promise().query(sql_VDA, [1, vIds, 1, 1, 1]);
                                
                                let device_ids = [];
                                let vda_data = {};
                                if(resultVDA && resultVDA.length > 0){
                                    device_ids = resultVDA.flatMap(vehicle => 
                                        [vehicle.device_id, vehicle.device_id2, vehicle.device_id3, vehicle.device_id4]
                                    ).filter(id => id !== null); // Remove null values

                                    vda_data = resultVDA.reduce((acc, item) => {
                                        const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }
                                //console.log(device_ids);process.exit(0);
                            //Step_7:                            
                                // const sql_V = `SELECT v.id AS vehicle_id, v.vehicle_number, v.vehicle_capacity_tons AS vehicle_capicity, v.max_speed AS speed, v.transporter_id, v.body_type_id, vmake.name AS vehicle_make, vmodel.model_number AS vehicle_model FROM vehicle AS v LEFT JOIN vehicle_make AS vmake ON vmake.id = v.vehicle_make_id LEFT JOIN vehicle_model AS vmodel ON vmodel.id = v.vehicle_model_id WHERE v.id IN (?) AND v.status = ? AND vmake.status = ? AND vmodel.status = ? `;
                                // const [resultV] = await db.promise().query(sql_V, [vIds, 1, 1, 1]);

                                const sql_V = `SELECT v.id AS vehicle_id, v.vehicle_number, v.vehicle_capacity_tons AS vehicle_capicity_id, v.max_speed AS speed, v.transporter_id, v.body_type_id, vmake.name AS vehicle_make, vmodel.model_number AS vehicle_model, vc.capacity AS vehicle_capicity FROM vehicle AS v LEFT JOIN vehicle_make AS vmake ON vmake.id = v.vehicle_make_id LEFT JOIN vehicle_model AS vmodel ON vmodel.id = v.vehicle_model_id LEFT JOIN vehicle_capacity AS vc ON vc.id = v.vehicle_capacity_tons WHERE v.id IN (?) AND v.status = ? AND vmake.status = ? AND vmodel.status = ? `;
                                const [resultV] = await db.promise().query(sql_V, [vIds, 1, 1, 1]);
                                //console.log(resultV);process.exit(0);                              
                            //Step_8:
                                const [resultD] = await db.promise().query(`SELECT d.id, d.device_imei, dm.name AS device_manufacturer, dt.device_type  AS device_type FROM devices AS d LEFT JOIN device_manufacturer AS dm ON dm.id = d.device_manufacturer_id LEFT JOIN device_types AS dt ON dt.device_type_id = d.device_type WHERE  d.status = ? AND dm.status = ? AND dt.status = ?  AND d.id IN(?)`, [1, 1, 1, device_ids]);
                                //const [resultD] = await db.promise().query("SELECT `d.id`,`d.device_manufacturer_id`,`d.device_type`,`dm.name`,`dt.device_type` FROM devices AS d LEFT JOIN device_manufacturer AS dm ON dm.id = d.device_manufacturer_id LEFT JOIN device_types AS dt ON dt.device_type_id = d.device_type WHERE  `d.status`=? AND `dm.status`=? AND `dt.status`=?", [1,1,1]);
                            
                                let device_data = {};
                                if(resultD && resultD.length > 0){
                                    device_data = resultD.reduce((acc, item) => {
                                        const { id, ...rest } = item; // Extract id and the rest of the properties
                                        acc[id] = rest; // Assign the rest of the properties to the id key
                                        return acc;
                                    }, {});
                                }
                                // console.log(vda_data);process.exit(0);                            
                            //Final Step:
                                final_array = resultV.map(vehicle => {

                                    let deviceInfoTemp1 = {}; let deviceInfo1  = {};
                                    let deviceInfoTemp2 = {}; let deviceInfo2  = {};
                                    let deviceInfoTemp3 = {}; let deviceInfo3  = {};
                                    let deviceInfoTemp4 = {}; let deviceInfo4  = {};

                                    // Extract required properties
                                    const { vehicle_id, vehicle_number, transporter_id, ...rest } = vehicle;
                                
                                    // Add zone data (if exists)
                                    const zoneInfo = zone_data[vehicle_id] || {};
                                
                                    // Add transporter data (if exists)
                                    const transporterInfo = transporter_data[transporter_id] || {};
                                    
                                    //Add doument data (if exists)
                                    const documentInfo = document_data[vehicle_id] || {};
                                    //console.log(documentInfo);
                                    //Add vehicle_working hrs data (if exists)
                                    const vwhInfo = vwh_data[vehicle] || {};
                                    
                                    // Add device data for each device_id (if exists)
                                    deviceInfoTemp1 = vda_data[vehicle_id] || {};
                                    deviceInfo1  = deviceInfoTemp1 ? device_data[deviceInfoTemp1.device_id] : {}
                                    
                                    deviceInfoTemp2 = vda_data[vehicle_id] || {};
                                    deviceInfo2  = deviceInfoTemp2 ? device_data[deviceInfoTemp2.device_id2] : {}
                                    
                                    deviceInfoTemp3 = vda_data[vehicle_id] || {};
                                    deviceInfo3  = deviceInfoTemp3 ? device_data[deviceInfoTemp3.device_id3] : {}
                                    
                                    deviceInfoTemp4 = vda_data[vehicle_id] || {};
                                    deviceInfo4  = deviceInfoTemp4 ? device_data[deviceInfoTemp4.device_id4] : {}
                                    
                                    // Construct the final object
                                    return {
                                        ...rest,
                                        vehicle_id,
                                        vehicle_number,
                                        region_name: zoneInfo.zone_name || null,
                                        region_id: zoneInfo.zone_id || null,
                                        transporter_id,
                                        transporter_name: transporterInfo.name || null,
                                        transporter_code: transporterInfo.code || null,
                                        // contract_type: vwhInfo>0 ? 'Yes' : 'No',
                                        // contract_type : (vwhInfo && Object.values(vwhInfo).some(val => val && val !== '00:00')) ? 'Contractual' : 'Non Contractual',
                                        contract_type: Object.keys(vwhInfo).length>0 ? vwhInfo.flag : 'Non-Contractual',
                                        reporting_time: vwhInfo.reporting_time || null,
                                        leaving_time: vwhInfo.leaving_time || null,
                                        total_hours: vwhInfo.total_hrs || null,
                                        device_id : deviceInfoTemp1 ? deviceInfoTemp1.device_id : null,                                     
                                        device_imei: deviceInfo1 ? deviceInfo1.device_imei : null,
                                        device_manufacturer: deviceInfo1 ? deviceInfo1.device_manufacturer : null,
                                        device_type: deviceInfo1 ? deviceInfo1.device_type : null,
                                        device_id2 : deviceInfoTemp2 ? deviceInfoTemp2.device_id2 : null,                                     
                                        device_imei2: deviceInfo2 ? deviceInfo2.device_imei : null,
                                        device_manufacturer2: deviceInfo2 ? deviceInfo2.device_manufacturer : null,
                                        device_type2: deviceInfo2 ? deviceInfo2.device_type : null,
                                        device_id3 : deviceInfoTemp3 ? deviceInfoTemp3.device_id3 : null,                                     
                                        device_imei3: deviceInfo3 ? deviceInfo3.device_imei : null,
                                        device_manufacturer3: deviceInfo3 ? deviceInfo3.device_manufacturer : null,
                                        device_type3: deviceInfo3 ? deviceInfo3.device_type : null,
                                        device_id4 : deviceInfoTemp4 ? deviceInfoTemp4.device_id4 : null,                                     
                                        device_imei4: deviceInfo4 ? deviceInfo4.device_imei : null,
                                        device_manufacturer4: deviceInfo4 ? deviceInfo4.device_manufacturer : null,
                                        device_type4: deviceInfo4 ? deviceInfo4.device_type : null,
                                        // document_id:documentInfo.id || null,
                                        // document_name:documentInfo.document_name || null,
                                        // document_type_id:documentInfo.doc_type_id || null,
                                        // document_no:documentInfo.doc_no || null,
                                        // document_issue_date:documentInfo.issue_date || null,
                                        // document_expiry_date:documentInfo.expiry_date || null,
                                        // document_file_path:documentInfo.file_path || null,
                                        documentInfo
                                    };
                                });                              
                            //console.log(final_array.length);process.exit(0);                                    
                        }
                    }else if(vehicle_id){

                        vIdsString = [vehicle_id];                        
                        vIds = vIdsString[0].split(',').map(id => parseInt(id.trim(), 10));
                        
                        if (vIds && vIds.length > 0) {
                                    
                            //Step_1:
                                //const [vIds_arr] = vIds;
                                const conditions = {
                                    //vehicle_id: { $in: vIds },
                                    status:1,
                                    group_id: group_id
                                };
                                
                                const fields = {};
                                const table ="logistic_vehicle_working_hour";
                                const resultsVWH = await getMongo.getMongoQuery(conditions, fields, table);                        
                                // console.log(resultsVWH);process.exit(0);
    
                                const calculateHours = (reporting, leaving) => {
                                    const [startHour, startMin] = reporting.split(':').map(Number);
                                    const [endHour, endMin] = leaving.split(':').map(Number);
                                
                                    let totalHours = endHour - startHour;
                                    let totalMinutes = endMin - startMin;
                                
                                    if (totalMinutes < 0) {
                                    totalMinutes += 60;
                                    totalHours -= 1;
                                    }
                                
                                    return `${totalHours.toString().padStart(2, '0')}:${totalMinutes.toString().padStart(2, '0')}`;
                                };
                                
                                let vwh_data = {};
                                let flag = '';

                                if (resultsVWH && resultsVWH.length > 0) {
                                    vwh_data = resultsVWH.reduce((acc, vehicle) => {
                                        const { vehicle_id, reporting_time, leaving_time } = vehicle;
                                        let total_hrs = null;
                                        if(reporting_time && leaving_time){
                                            total_hrs = calculateHours(reporting_time, leaving_time);
                                        }

                                        if(total_hrs !== null){
                                            flag = 'Contractual';
                                        }else{
                                            flag = 'Per Trip';
                                        }

                                        acc[vehicle_id] = {
                                            reporting_time,
                                            leaving_time,
                                            total_hrs,
                                            flag
                                        };
                                    
                                        return acc;
                                    }, {});
                                }                                
                            //Step_2:
                                //const sql_VZA = `SELECT lz.zone_name, vza.zone_id, vza.vehicle_id FROM vehicle_zone_assignment AS vza LEFT JOIN logistic_zone AS lz ON lz.id = vza.zone_id WHERE vza.status = ? AND vza.group_id = ? AND lz.status = ?`;
                                const sql_VZA = `SELECT lz.zone_name, vza.zone_id, vza.vehicle_id FROM vehicle_zone_assignment AS vza LEFT JOIN logistic_zone AS lz ON lz.id = vza.zone_id WHERE vza.status = ? AND vza.group_id = ? AND lz.status = ? AND vza.vehicle_id IN (?)`;
                                const [resultVZA] = await db.promise().query(sql_VZA, [1, group_id, 1, vIds]);
                                
                                let zone_data = {}; // Declare zone_data outside the if block
                                if (resultVZA && resultVZA.length > 0) {
                                    zone_data = resultVZA.reduce((acc, item) => {
                                        const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }
                            //Step_3:
                                const [resultT] = await db.promise().query("SELECT `id`,`name`, `code` FROM transporters WHERE ``group_id` IN(?)",[group_id]);
                                
                                let transporter_data = {}; // Declare zone_data outside the if block
                                if (resultT && resultT.length > 0) {
                                    transporter_data = resultT.reduce((acc, item) => {
                                        //acc[item.id] = item.name+' ('+item.code+')'; // Map the `id` as the key and `name` as the value
                                        const { id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }
                            //Step_4:
                                const [resultVBT] = await db.promise().query("SELECT `id`,`name` FROM vehicle_types WHERE `status`=1");
                            
                                let vehicle_body_data = {}; // Declare zone_data outside the if block
                                if (resultVBT && resultVBT.length > 0) {
                                    vehicle_body_data = resultVBT.reduce((acc, item) => {
                                        acc[item.id] = item.name; // Map the `id` as the key and `name` as the value
                                        return acc;
                                    }, {});
                                }
                            //Step_5:
                                const sql_DOC = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, doc.issue_date, doc.expiry_date, doc.file_path FROM documents AS doc LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id WHERE doc.status = ? AND doc.vehicle_id IN (?) AND doc.group_id = ? AND doct.status = ?`;
                                const [resultDOC] = await db.promise().query(sql_DOC, [1, vIds, group_id, 1]);
                                //const sql_DOC = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, doc.issue_date, doc.expiry_date, doc.file_path FROM documents AS doc LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id WHERE doc.status = ? AND doct.status = ?`;
                                //const [resultDOC] = await db.promise().query(sql_DOC, [1, 1]);
                                
                                let document_data = {}; // Declare zone_data outside the if block
                                if (resultDOC && resultDOC.length > 0) {
                                    // document_data = resultDOC.reduce((acc, item) => {
                                    //     const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                    //     acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                    //     return acc;
                                    // }, {}); 
                                    resultDOC.forEach(doc => {
                                        const vehicleId = doc.vehicle_id;
                                        if (!document_data[vehicleId]) {
                                            document_data[vehicleId] = [];
                                        }
                                        document_data[vehicleId].push(doc);
                                    });
                                }
                                //console.log(document_data);process.exit(0);
                            //Step_6:
                                const sql_VDA = `SELECT vehicle_id, device_id, device_id2, device_id3, device_id4 FROM vehicle_device_assignment WHERE status = ? AND vehicle_id IN (?)`;
                                const [resultVDA] = await db.promise().query(sql_VDA, [1, vIds, 1, 1, 1]);
                                
                                let device_ids = [];
                                let vda_data = {};
                                if(resultVDA && resultVDA.length > 0){
                                    device_ids = resultVDA.flatMap(vehicle => 
                                        [vehicle.device_id, vehicle.device_id2, vehicle.device_id3, vehicle.device_id4]
                                    ).filter(id => id !== null); // Remove null values

                                    vda_data = resultVDA.reduce((acc, item) => {
                                        const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }
                            //Step_7:
                                const sql_V = `SELECT v.id AS vehicle_id, v.vehicle_number, v.vehicle_capacity_tons AS vehicle_capicity_id, v.max_speed AS speed, v.transporter_id, v.body_type_id, vmake.name AS vehicle_make, vmodel.model_number AS vehicle_model, vc.capacity AS vehicle_capicity FROM vehicle AS v LEFT JOIN vehicle_make AS vmake ON vmake.id = v.vehicle_make_id LEFT JOIN vehicle_model AS vmodel ON vmodel.id = v.vehicle_model_id LEFT JOIN vehicle_capacity AS vc ON vc.id = v.vehicle_capacity_tons WHERE v.id IN (?) AND v.status = ? AND vmake.status = ? AND vmodel.status = ? `;
                                const [resultV] = await db.promise().query(sql_V, [vIds, 1, 1, 1]);
                                //console.log(resultV);process.exit(0);
                              
                            //Step_8:
                                let resultD = [];
                                if(device_ids && device_ids.length > 0){
                                    resultD = await db.promise().query(`SELECT d.id, d.device_imei, dm.name AS device_manufacturer, dt.device_type  AS device_type FROM devices AS d LEFT JOIN device_manufacturer AS dm ON dm.id = d.device_manufacturer_id LEFT JOIN device_types AS dt ON dt.device_type_id = d.device_type WHERE  d.status = ? AND dm.status = ? AND dt.status = ?  AND d.id IN(?)`, [1, 1, 1, device_ids]);
                                    //const [resultD] = await db.promise().query("SELECT `d.id`,`d.device_manufacturer_id`,`d.device_type`,`dm.name`,`dt.device_type` FROM devices AS d LEFT JOIN device_manufacturer AS dm ON dm.id = d.device_manufacturer_id LEFT JOIN device_types AS dt ON dt.device_type_id = d.device_type WHERE  `d.status`=? AND `dm.status`=? AND `dt.status`=?", [1,1,1]);
                                }

                                let device_data = {};
                                if(resultD && resultD.length > 0){
                                    device_data = resultD.reduce((acc, item) => {
                                        const { id, ...rest } = item; // Extract id and the rest of the properties
                                        acc[id] = rest; // Assign the rest of the properties to the id key
                                        return acc;
                                    }, {});
                                }
                                // console.log(vda_data);process.exit(0);
                            
                            //Final Step:
                                final_array = resultV.map(vehicle => {

                                    let deviceInfoTemp1 = {}; let deviceInfo1  = {};
                                    let deviceInfoTemp2 = {}; let deviceInfo2  = {};
                                    let deviceInfoTemp3 = {}; let deviceInfo3  = {};
                                    let deviceInfoTemp4 = {}; let deviceInfo4  = {};

                                    // Extract required properties
                                    const { vehicle_id, vehicle_number, transporter_id, ...rest } = vehicle;
                                
                                    // Add zone data (if exists)
                                    const zoneInfo = zone_data[vehicle_id] || {};
                                
                                    // Add transporter data (if exists)
                                    const transporterInfo = transporter_data[transporter_id] || {};
                                    
                                    //Add doument data (if exists)
                                    const documentInfo = document_data[vehicle_id] || {};
    
                                    //Add vehicle_working hrs data (if exists)
                                    const vwhInfo = vwh_data[vehicle] || {};
                                    
                                    // Add device data for each device_id (if exists)
                                    deviceInfoTemp1 = vda_data[vehicle_id] || {};
                                    deviceInfo1  = deviceInfoTemp1 ? device_data[deviceInfoTemp1.device_id] : {}
                                    
                                    deviceInfoTemp2 = vda_data[vehicle_id] || {};
                                    deviceInfo2  = deviceInfoTemp2 ? device_data[deviceInfoTemp2.device_id2] : {}
                                    
                                    deviceInfoTemp3 = vda_data[vehicle_id] || {};
                                    deviceInfo3  = deviceInfoTemp3 ? device_data[deviceInfoTemp3.device_id3] : {}
                                    
                                    deviceInfoTemp4 = vda_data[vehicle_id] || {};
                                    deviceInfo4  = deviceInfoTemp4 ? device_data[deviceInfoTemp4.device_id4] : {}
                                    
                                    // Construct the final object
                                    return {
                                        ...rest,
                                        vehicle_id,
                                        vehicle_number,
                                        region_name: zoneInfo.zone_name || null,
                                        region_id: zoneInfo.zone_id || null,
                                        transporter_id,
                                        transporter_name: transporterInfo.name || null,
                                        transporter_code: transporterInfo.code || null,
                                        // contract_type: vwhInfo>0 ? 'Yes' : 'No',
                                        // contract_type : (vwhInfo && Object.values(vwhInfo).some(val => val && val !== '00:00')) ? 'Contractual' : 'Non Contractual',
                                        contract_type: Object.keys(vwhInfo).length>0 ? vwhInfo.flag : 'Non-Contractual',
                                        reporting_time: vwhInfo.reporting_time || null,
                                        leaving_time: vwhInfo.leaving_time || null,
                                        total_hours: vwhInfo.total_hrs || null,
                                        device_id : deviceInfoTemp1 ? deviceInfoTemp1.device_id : null,                                     
                                        device_imei: deviceInfo1 ? deviceInfo1.device_imei : null,
                                        device_manufacturer: deviceInfo1 ? deviceInfo1.device_manufacturer : null,
                                        device_type: deviceInfo1 ? deviceInfo1.device_type : null,
                                        device_id2 : deviceInfoTemp2 ? deviceInfoTemp2.device_id2 : null,                                     
                                        device_imei2: deviceInfo2 ? deviceInfo2.device_imei : null,
                                        device_manufacturer2: deviceInfo2 ? deviceInfo2.device_manufacturer : null,
                                        device_type2: deviceInfo2 ? deviceInfo2.device_type : null,
                                        device_id3 : deviceInfoTemp3 ? deviceInfoTemp3.device_id3 : null,                                     
                                        device_imei3: deviceInfo3 ? deviceInfo3.device_imei : null,
                                        device_manufacturer3: deviceInfo3 ? deviceInfo3.device_manufacturer : null,
                                        device_type3: deviceInfo3 ? deviceInfo3.device_type : null,
                                        device_id4 : deviceInfoTemp4 ? deviceInfoTemp4.device_id4 : null,                                     
                                        device_imei4: deviceInfo4 ? deviceInfo4.device_imei : null,
                                        device_manufacturer4: deviceInfo4 ? deviceInfo4.device_manufacturer : null,
                                        device_type4: deviceInfo4 ? deviceInfo4.device_type : null,
                                        // document_id:documentInfo.id || null,
                                        // document_name:documentInfo.document_name || null,
                                        // document_type_id:documentInfo.doc_type_id || null,
                                        // document_no:documentInfo.doc_no || null,
                                        // document_issue_date:documentInfo.issue_date || null,
                                        // document_expiry_date:documentInfo.expiry_date || null,
                                        // document_file_path:documentInfo.file_path || null,
                                        documentInfo
                                    };
                                });
                              
                            //console.log(final_array);process.exit(0);                                    
                        }
                    }else{
                        
                        if(userType === 6) { // Master                                                       
                            const [resultVUM] = await db.promise().query("SELECT `vehicle_id` FROM vehice_user_mapping WHERE `user_id`=? AND `status`=?", [user_id, 1]);
                                
                            if (resultVUM && resultVUM.length > 0) {
                                // Extract vehicle IDs into an array
                                vIds = resultVUM.map(item => item.vehicle_id);
                            } else {
                                err = "Data Not Found(Master).";
                                resData.Message= err;
                                res.status(200).json(resData);
                            }
                            
                            const sql_VTA = `SELECT vehicle_id ,transporter_id FROM vehicle_transporter_assignment WHERE status = ? AND group_id IN (?) `;
                            const [resultVTA] = await db.promise().query(sql_VTA, [1, group_id]);
                            
                            if(resultVTA){
                                vIds = resultVTA.map(item => item.vehicle_id);
                                resultVTA.forEach(item => {
                                    Vid_Tid[item.vehicle_id] = item.transporter_id;
                                });
                                //res.send(Vid_Tid);
                            }else{
                                err = "Data Not Found(Specific Transporter).";
                                resData.Message= err;
                                res.status(200).json(resData);
                            }
                            // console.log(Vid_Tid);process.exit(0);
                        }else if(userType === 10) { // Transporter
                            
                            if(group_type === 3){
                                const sql_LRA = `SELECT type_detail_id FROM logistic_role_assignment WHERE status = ? AND user_id = ? `;
                                const [resultVZA] = await db.promise().query(sql_LRA, [1, user_id]);
                                
                                const tIds = resultVZA.length > 0 ? resultVZA[0].type_detail_id : null;
                                
                                if(tIds){
                                    const sql_VTA = `SELECT vehicle_id FROM vehicle_transporter_assignment WHERE status = ? AND transporter_id IN (?) `;
                                    const [resultVTA] = await db.promise().query(sql_VTA, [1, tIds]);
                                    if(resultVTA){
                                        vIds = resultVTA.map(item => item.vehicle_id);
                                    }else{
                                        err = "Data Not Found(Generic Transporter).";
                                        resData.Message= err;
                                        res.status(200).json(resData);
                                    }
                                }else{
                                    err = "Data Not Found(1).";
                                    resData.Message= err;
                                    res.status(200).json(resData);
                                }
                            }else if(group_type === 20){
                                const sql_Trans = `SELECT id FROM transporters WHERE status = ? AND group_id = ? `;
                                const [resultTrans] = await db.promise().query(sql_Trans, [1, group_id]);
                                const tIds = resultTrans.map(item => item.id);
                                if(tIds){
                                    const sql_VTA = `SELECT vehicle_id ,transporter_id FROM vehicle_transporter_assignment WHERE status = ? AND transporter_id IN (?) `;
                                    const [resultVTA] = await db.promise().query(sql_VTA, [1, tIds]);
                                    if(resultVTA){
                                        vIds = resultVTA.map(item => item.vehicle_id);
                                        resultVTA.forEach(item => {
                                            Vid_Tid[item.vehicle_id] = item.transporter_id;
                                        });
                                        //res.send(Vid_Tid);
                                    }else{
                                        err = "Data Not Found(Specific Transporter).";
                                        resData.Message= err;
                                        res.status(200).json(resData);
                                    }
                                }else{
                                    err = "Data Not Found(2).";
                                    resData.Message= err;
                                    res.status(200).json(resData);
                                }
                            }else{
                                err = "invalid access for this transporter.";
                                resData.Message= err;
                                res.status(200).json(resData);
                            }
    
                        }else if(userType === 12) { // Manager                        
                            err = "Under Development.";
                            resData.Message= err;
                            res.status(200).json(resData);
                        }else{                                        
                            err = "Invalid Access for this User.";
                            resData.Message= err;
                            res.status(200).json(resData);
                        }
                        
                        if (vIds && vIds.length > 0) {
                                    
                            //Step_1:
                                //const [vIds_arr] = vIds;
                                const conditions = {
                                    //vehicle_id: { $in: vIds },
                                    status:1,
                                    group_id: group_id
                                };
                                
                                const fields = {};
                                const table ="logistic_vehicle_working_hour";
                                const resultsVWH = await getMongo.getMongoQuery(conditions, fields, table);                        
                                // console.log(resultsVWH);process.exit(0);
    
                                const calculateHours = (reporting, leaving) => {
                                    const [startHour, startMin] = reporting.split(':').map(Number);
                                    const [endHour, endMin] = leaving.split(':').map(Number);
                                
                                    let totalHours = endHour - startHour;
                                    let totalMinutes = endMin - startMin;
                                
                                    if (totalMinutes < 0) {
                                        totalMinutes += 60;
                                        totalHours -= 1;
                                    }
                                
                                    return `${totalHours.toString().padStart(2, '0')}:${totalMinutes.toString().padStart(2, '0')}`;
                                };
                                
                                let vwh_data = {};
                                let flag = '';

                                if (resultsVWH && resultsVWH.length > 0) {
                                    vwh_data = resultsVWH.reduce((acc, vehicle) => {
                                        const { vehicle_id, reporting_time, leaving_time } = vehicle;
                                        let total_hrs = null;
                                        if(reporting_time && leaving_time){
                                            total_hrs = calculateHours(reporting_time, leaving_time);
                                        }

                                        if(total_hrs !== null){
                                            flag = 'Contractual';
                                        }else{
                                            flag = 'Per Trip';
                                        }

                                        acc[vehicle_id] = {
                                            reporting_time,
                                            leaving_time,
                                            total_hrs,
                                            flag
                                        };
                                    
                                        return acc;
                                    }, {});
                                }
                                //res.send(vwh_data);
                                // console.log(vwh_data);process.exit(0);    
                            //Step_2:
                                const sql_VZA = `SELECT lz.zone_name, vza.zone_id, vza.vehicle_id FROM vehicle_zone_assignment AS vza LEFT JOIN logistic_zone AS lz ON lz.id = vza.zone_id WHERE vza.status = ? AND vza.group_id = ? AND lz.status = ?`;
                                //const sql_VZA = `SELECT lz.zone_name, vza.zone_id, vza.vehicle_id FROM vehicle_zone_assignment AS vza LEFT JOIN logistic_zone AS lz ON lz.id = vza.zone_id WHERE vza.status = ? AND vza.vehicle_id IN (?) AND lz.status = ?`;
                                const [resultVZA] = await db.promise().query(sql_VZA, [1, group_id, 1]);
                            
                                let zone_data = {}; // Declare zone_data outside the if block
                                if (resultVZA && resultVZA.length > 0) {
                                    zone_data = resultVZA.reduce((acc, item) => {
                                        const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }
                            //Step_3:
                                const [resultT] = await db.promise().query("SELECT `id`,`name`, `code` FROM transporters WHERE `group_id` IN(?)",[group_id]);
                            
                                let transporter_data = {}; // Declare zone_data outside the if block
                                if (resultT && resultT.length > 0) {
                                    transporter_data = resultT.reduce((acc, item) => {
                                        //acc[item.id] = item.name+' ('+item.code+')'; // Map the `id` as the key and `name` as the value
                                        const { id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }
                            //Step_4:
                                const [resultVBT] = await db.promise().query("SELECT `id`,`name` FROM vehicle_types WHERE `status`=1");
                            
                                let vehicle_body_data = {}; // Declare zone_data outside the if block
                                if (resultVBT && resultVBT.length > 0) {
                                    vehicle_body_data = resultVBT.reduce((acc, item) => {
                                        acc[item.id] = item.name; // Map the `id` as the key and `name` as the value
                                        return acc;
                                    }, {});
                                }
                            //Step_5:
                                //const sql_DOC = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, doc.issue_date, doc.expiry_date, doc.file_path FROM documents AS doc LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id WHERE doc.status = ? AND doc.vehicle_id IN (?) AND doc.group_id = ? AND doct.status = ?`;
                                //const [resultDOC] = await db.promise().query(sql_DOC, [1, vIds, group_id, 1]);
                                const sql_DOC = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, doc.issue_date, doc.expiry_date, doc.file_path FROM documents AS doc LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id WHERE doc.status = ? AND doct.status = ? AND doc.group_id = ?`;
                                const [resultDOC] = await db.promise().query(sql_DOC, [1, 1, group_id]);
                                
                                let document_data = {}; // Declare zone_data outside the if block
                                if (resultDOC && resultDOC.length > 0) {
                                    // document_data = resultDOC.reduce((acc, item) => {
                                    //     const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                    //     acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                    //     return acc;
                                    // }, {}); 
                                    resultDOC.forEach(doc => {
                                        const vehicleId = doc.vehicle_id;
                                        if (!document_data[vehicleId]) {
                                            document_data[vehicleId] = [];
                                        }
                                        document_data[vehicleId].push(doc);
                                    });
                                }
                            //Step_6:
                                // const sql_VDA = `SELECT v.vehicle_number, v.vehicle_capacity_tons AS vehicle_capicity, v.max_speed AS speed, v.transporter_id, v.body_type_id, vmake.name AS vehicle_make, vmodel.model_number AS vehicle_model, vda.vehicle_id, vda.device_id, vda.device_id2, vda.device_id3, vda.device_id4 FROM vehicle_device_assignment AS vda LEFT JOIN vehicle AS v ON v.id = vda.vehicle_id LEFT JOIN vehicle_make AS vmake ON vmake.id = v.vehicle_make_id LEFT JOIN vehicle_model AS vmodel ON vmodel.id = v.vehicle_model_id WHERE vda.status = ? AND vda.vehicle_id IN (?) AND v.status = ? AND vmake.status = ? AND vmodel.status = ? `;
                                // const sql_VDA = `SELECT v.vehicle_number, v.vehicle_capacity_tons AS vehicle_capicity, v.max_speed AS speed, v.transporter_id, v.body_type_id, vmake.name AS vehicle_make, vmodel.model_number AS vehicle_model, vda.vehicle_id, vda.device_id, vda.device_id2, vda.device_id3, vda.device_id4 vc.capacity FROM vehicle_device_assignment AS vda LEFT JOIN vehicle AS v ON v.id = vda.vehicle_id LEFT JOIN vehicle_make AS vmake ON vmake.id = v.vehicle_make_id LEFT JOIN vehicle_model AS vmodel ON vmodel.id = v.vehicle_model_id LEFT JOIN vehicle_capacity AS vc ON vc.id = v.vehicle_capacity_tons WHERE vda.status = ? AND vda.vehicle_id IN (?) AND v.status = ? AND vmake.status = ? AND vmodel.status = ? AND vc.status = ? `;
                                // const [resultVDA] = await db.promise().query(sql_VDA, [1, vIds, 1, 1, 1, 1]);
                                
                                const sql_VDA = `SELECT v.vehicle_number, v.vehicle_capacity_tons AS vehicle_capicity_id, v.max_speed AS speed, v.transporter_id, v.body_type_id, vmake.name AS vehicle_make, vmodel.model_number AS vehicle_model, vda.vehicle_id, vda.device_id, vda.device_id2, vda.device_id3, vda.device_id4, vc.capacity AS vehicle_capicity FROM vehicle_device_assignment AS vda LEFT JOIN vehicle AS v ON v.id = vda.vehicle_id LEFT JOIN vehicle_make AS vmake ON vmake.id = v.vehicle_make_id LEFT JOIN vehicle_model AS vmodel ON vmodel.id = v.vehicle_model_id LEFT JOIN vehicle_capacity AS vc ON vc.id = v.vehicle_capacity_tons WHERE vda.status = ? AND vda.vehicle_id IN (?) AND v.status = ? AND vmake.status = ? AND vmodel.status = ?`;
                                const [resultVDA] = await db.promise().query(sql_VDA, [1, vIds, 1, 1, 1]);
                                // console.log(resultVDA);process.exit(0);
                                
                                let device_ids = [];
                                let vda_data = {};
                                if(resultVDA && resultVDA.length > 0){
                                    device_ids = resultVDA.flatMap(vehicle => 
                                        [vehicle.device_id, vehicle.device_id2, vehicle.device_id3, vehicle.device_id4]
                                    ).filter(id => id !== null); // Remove null values

                                    vda_data = resultVDA.reduce((acc, item) => {
                                        const { vehicle_id, ...rest } = item; // Extract vehicle_id and the rest of the properties
                                        acc[vehicle_id] = rest; // Assign the rest of the properties to the vehicle_id key
                                        return acc;
                                    }, {});
                                }
                                // console.log(device_ids.length);process.exit(0); 
                            //Step_7:                                
                                let device_data = {};
                                if(device_ids && device_ids.length > 0){
                                    const [resultD] = await db.promise().query(`SELECT d.id, d.device_imei, dm.name AS device_manufacturer, dt.device_type  AS device_type FROM devices AS d LEFT JOIN device_manufacturer AS dm ON dm.id = d.device_manufacturer_id LEFT JOIN device_types AS dt ON dt.device_type_id = d.device_type WHERE  d.status = ? AND dm.status = ? AND dt.status = ?  AND d.id IN(?)`, [1, 1, 1, device_ids]);
                                    //res.send(resultD);                                
                                    if(resultD && resultD.length > 0){
                                        device_data = resultD.reduce((acc, item) => {
                                            const { id, ...rest } = item; // Extract id and the rest of the properties
                                            acc[id] = rest; // Assign the rest of the properties to the id key
                                            return acc;
                                        }, {});
                                    }
                                }
                                //res.send(device_data);
                                //console.log(device_data.length);process.exit(0);                                
                                // console.log(Vid_Tid);process.exit(0);
                            //Final Step:
                                final_array = resultVDA.map(vehicle => {
                                    // Extract required properties
                                    const { vehicle_id, transporter_id, device_id, device_id2, device_id3, device_id4, ...rest } = vehicle;
                                
                                    // Add zone data (if exists)
                                    const zoneInfo = zone_data[vehicle_id] || {};
                                
                                    // Add transporter data (if exists)
                                    // const transporterInfo = transporter_data[transporter_id] || {};
                                    const id_transporters = Vid_Tid[vehicle_id];
                                    const transporterInfo = transporter_data[Vid_Tid[vehicle_id]] || {};
                                    //Add doument data (if exists)
                                    const documentInfo = document_data[vehicle_id] || {};
    
                                    //Add vehicle_working hrs data (if exists)
                                    const vwhInfo = vwh_data[vehicle_id] || {};
    
                                    // Add device data for each device_id (if exists)
                                    const deviceInfo1 = device_data[device_id] || {};
                                    const deviceInfo2 = device_data[device_id2] || {};
                                    const deviceInfo3 = device_data[device_id3] || {};
                                    const deviceInfo4 = device_data[device_id4] || {};
                                   // res.send(deviceInfo2);
                                    // Construct the final object
                                    return {
                                        ...rest,
                                        vehicle_id,
                                        region_name: zoneInfo.zone_name || null,
                                        region_id: zoneInfo.zone_id || null,
                                        // transporter_id,
                                        id_transporters,
                                        transporter_name: transporterInfo.name || null,
                                        transporter_code: transporterInfo.code || null,
                                        // contract_type: vwhInfo>0 ? 'Yes' : 'No',
                                        // contract_type : (vwhInfo && Object.values(vwhInfo).some(val => val && val !== '00:00')) ? 'Contractual' : 'Non Contractual',
                                        contract_type: Object.keys(vwhInfo).length>0 ? vwhInfo.flag : 'Non-Contractual',
                                        reporting_time: vwhInfo.reporting_time || null,
                                        leaving_time: vwhInfo.leaving_time || null,
                                        total_hours: vwhInfo.total_hrs || null,
                                        device_id,
                                        device_imei: deviceInfo1.device_imei || null,
                                        device_manufacturer: deviceInfo1.device_manufacturer || null,
                                        device_type: deviceInfo1.device_type || null,
                                        device_id2,
                                        device_imei2: deviceInfo2.device_imei || null,
                                        device_manufacturer2: deviceInfo2.device_manufacturer || null,
                                        device_type2: deviceInfo2.device_type || null,
                                        device_id3,
                                        device_imei3: deviceInfo3.device_imei || null,
                                        device_manufacturer3: deviceInfo3.device_manufacturer || null,
                                        device_type3: deviceInfo3.device_type || null,
                                        device_id4,
                                        device_imei4: deviceInfo4.device_imei || null,
                                        device_manufacturer4: deviceInfo4.device_manufacturer || null,
                                        device_type4: deviceInfo4.device_type || null,
                                        // document_id:documentInfo.id || null,
                                        // document_name:documentInfo.document_name || null,
                                        // document_type_id:documentInfo.doc_type_id || null,
                                        // document_no:documentInfo.doc_no || null,
                                        // document_issue_date:documentInfo.issue_date || null,
                                        // document_expiry_date:documentInfo.expiry_date || null,
                                        // document_file_path:documentInfo.file_path || null,
                                        documentInfo
                                    };
                                });                              
                            //console.log(final_array.length);process.exit(0);                                    
                        }
                    }
                    
                    // console.log(final_array);process.exit(0);
                    if(final_array.length > 0){
                        resData.Data=final_array;
                        resData.Status="success";
                        res.status(200).json(resData);
                    }else{
                        err = "Data Not Found.";
                        resData.Message= err;
                        res.status(200).json(resData);
                    }  
                }else{
                    console.error("Error data not found:", error);
                    return res.status(500).json({ error: 'Error data not found' });
                }
            }
        }else{
            //res.status(501).json("payload missing");
            resData.Message="Payload Missing";
            res.status(501).json(resData);
        }
    } catch (error) {
        console.error('Error fetching delay_report:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
