const db = require("../config/db");
const getMongo = require("../lib/mongo/mongo_api");
const {passenc} = require("../helpers/pass_enc");
const {getAccessTokenDataWeb,lastActivityWeb} = require("../helpers/access_token_web");
const moment = require('moment-timezone');
const currentDateTime = moment().tz('Asia/Kolkata');
const uploadS3 = require("./components/uploadS3Component");
const { json } = require("body-parser");
const mongu =require("../lib/mongo/mongo_api");
const tokenWeb= require("../helpers/access_token_web");
const { format, subHours, differenceInSeconds } = require('date-fns');
const dayjs = require('dayjs');
const fs =  require('fs');
const uploadComponent = require("./components/uploadComponent")

////////////////////////// TMS: Transporter & Consolidated Dashboard //////////////////////////

exports.consolidatedDashboard = async (req, res) => {
    const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    let user_info ={};
    try {
        const { AccessToken, filter_data, DeveloperOptionId, DeveloperOption } = req.body;
        let report_data = {};
        if (AccessToken != null) {
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //user_info = await getAccessTokenDataWeb(AccessToken);
            }
            // const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);

            if (user_info && user_info.Status === 2) {
                report_data.Result = user_info.Result;
                report_data.Message = user_info.Message;
                report_data.Status = 'Fail';
                res.status(200).json(report_data);
            }
            else{
                // const user_id = 5659; //BluedartMaster
                // const user_id = 152867; //MasterCV
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 182550; // user_type 24
                // const user_id = 152868; // user_type 24p
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter
                const user_id = user_info.AccountId;
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
                    // let report_data = {};
                    
                    if (filter_data) {
                        const input_data = JSON.parse(filter_data);
                        
                        let flag_of_date = 0;
                        let flag_of_customer = 0;
                        let flag_of_gpsvendor = 0;
                        let flag_of_agent = 0;
                        let flag_of_insurer = 0;
                        let flag_of_cv_customer = 0;
        
                        let from_date = null;
                        let to_date = null;
                        let customer_id = null;
                        let gps_vendor = null;
                        let agent_id = null;
                        let insurer_id = null;
                        let cv_customer_id = null;
        
                        if (input_data.from_date && input_data.to_date) {
                            from_date = input_data.from_date;
                            to_date = input_data.to_date;
                            flag_of_date = 1;
                        }
        
                        if (input_data.customer_id) {
                            customer_id = input_data.customer_id;
                            flag_of_customer = 1;
                        }
        
                        if (input_data.gps_vendor) {
                            gps_vendor = input_data.gps_vendor;
                            flag_of_gpsvendor = 1;
                        }
        
                        if (input_data.agent_id) {
                            agent_id = input_data.agent_id;
                            flag_of_agent = 1;
                        }

                        if (input_data.insurer_id) {
                            insurer_id = parseInt(input_data.insurer_id);
                            flag_of_insurer = 1;
                        }

                        if (input_data.cv_customer_id) {
                            cv_customer_id = input_data.cv_customer_id;
                            flag_of_cv_customer = 1;
                        }
                        
                        let final_data = [];
                        let result_data = [];
                        let result_data_UPC = [];
                        let transporter = '';
                        
                        if (user_type === 6) {
                            let CVCA_qry = '';
                            if (flag_of_date === 1) {
                                if (flag_of_agent === 0) {
                                    CVCA_qry = `SELECT type_detail, type_detail_id FROM cv_customer_assignment WHERE status=1 AND user_id=${user_id} AND DATE(create_date) BETWEEN '${from_date}' AND '${to_date}'`;
                                } else {
                                    CVCA_qry = `SELECT id, transporter_id FROM cv_transporter_assignment WHERE status=1 AND type_id=${agent_id} AND DATE(create_date) BETWEEN '${from_date}' AND '${to_date}'`;
                                }
                            } else if (flag_of_agent === 0) {
                                CVCA_qry = `SELECT type_detail, type_detail_id FROM cv_customer_assignment WHERE status=1 AND user_id=${user_id}`;
                            } else if (flag_of_date === 0 && flag_of_agent === 1) {
                                CVCA_qry = `SELECT id, transporter_id FROM cv_transporter_assignment WHERE status=1 AND type_id=${agent_id}`;
                            }
                            let transporter_ids;
                            let transporter;
                            const [CVCA_qry_data] = await db.promise().query(CVCA_qry);
                            let TCA_qry_data;
                            if (flag_of_cv_customer === 1) {
                                transporter_ids = flag_of_agent === 1 ? CVCA_qry_data.map(value => value.transporter_id) : CVCA_qry_data.map(value => value.type_detail_id);
                                transporter = transporter_ids.map(Number);
                                if(transporter.length > 0){
                                    TCA_qry = `SELECT id, transporter_id FROM transporter_customer_assiginment WHERE status=1 AND customer_group_id=${cv_customer_id} AND transporter_id IN(${transporter})`;
                                    [TCA_qry_data] = await db.promise().query(TCA_qry);
                                    // res.send(TCA_qry_data);
                                }
                                // res.send(transporter);
                            }
                            // res.send(TCA_qry_data);
                            if ((CVCA_qry_data.length > 0) || (TCA_qry_data.length > 0)){
                                // res.send(TCA_qry_data);
                                if(flag_of_cv_customer === 1){
                                    
                                    transporter_ids = (TCA_qry_data.length > 0) ? TCA_qry_data.map(value => value.transporter_id): null;
                                    // res.send(TCA_qry_data);
                                }else{
                                    transporter_ids = (flag_of_agent === 1) ? CVCA_qry_data.map(value => value.transporter_id) : CVCA_qry_data.map(value => value.type_detail_id);
                                }
                                // res.send(transporter_ids);
                                transporter = transporter_ids.map(String);
                                
                                if (transporter.length > 0) {
                                    const table = "cv_dashboard_raw_vehicle_data";                                    
                                    let condition = { status: 1, transporter_id: { $in: transporter } };
                                    if (flag_of_insurer === 1) {
                                        condition.insured_id = insurer_id;
                                    }
                                    // res.send(condition);
                                    const get_fields = { projection: { _id: 0 } };
                                    
                                    try {
                                        // result_data = await getLocalMongoQuery(table, condition, get_fields);
                                        result_data = await getMongo.getCVMongoQuery(condition,get_fields,table);
                                        
                                    } catch (error) {
                                        result_data = `Error parsing JSON: ${error}`;
                                    }
                                    // res.send(result_data);
                                    if (result_data) {
                                        for (let val of result_data) {
                                            
                                            if (flag_of_customer === 1 && flag_of_gpsvendor === 1) {
                                                if (val.transporter_id === customer_id) {
                                                    let vender_arr = val.vendor;
                                                    if (vender_arr) {
                                                        for (let value of Object.values(vender_arr)) {
                                                            if (value === gps_vendor) {
                                                                final_data.push(val);
                                                            }
                                                        }
                                                    }
                                                }
                                            } else if (flag_of_customer === 1 && flag_of_gpsvendor === 0) {
                                                
                                                if (val.transporter_id === customer_id) {                                                    
                                                    final_data.push(val);
                                                }
                                            } else if (flag_of_customer === 0 && flag_of_gpsvendor === 1) {
                                                let vender_arr = val.vendor;
                                                if (vender_arr) {
                                                    for (let value of Object.values(vender_arr)) {
                                                        if (value === gps_vendor) {
                                                            final_data.push(val);
                                                        }
                                                    }
                                                }
                                            } else if (flag_of_customer === 0 && flag_of_gpsvendor === 0) {
                                                final_data = result_data;
                                            }
                                        }
                                    }
                                } else {
                                    return res.status(200).json({ Status: 'Fail', Message: 'Transporter id not available in CV Customer Assignment Table' });
                                }
                            }
                        } else if (user_type === 10) {
                            
                            // Query the logistic_role_assignment table
                            const LRA_qry = `SELECT * FROM logistic_role_assignment WHERE status=1 AND user_id = ${user_id}`;
                            const [LRA_qry_data] = await db.promise().query(LRA_qry);
                            
                            if (!LRA_qry_data || LRA_qry_data.length === 0) {
                                return res.status(200).json({ status: "fail", Message: "Transporter id not available in Logistic Role Assignment Table" });
                            }
                            
                            // Extract transporter IDs
                            const transporter_ids = LRA_qry_data.map(value => value.type_detail_id);
                            transporter = transporter_ids.map(String);
                            
                            if (transporter.length > 0) {
                                const table = "cv_dashboard_raw_vehicle_data";
                                let condition = { status: 1, transporter_id: { $in: transporter } };
                        
                                // Add date filter if flag_of_date is 1
                                if (flag_of_date === 1) {
                                    condition.vehicle_mapping_date = { $gte: from_date, $lte: to_date };
                                }
                                
                                const get_fields = { projection: { _id: 0 } };                                
                                
                                try {
                                    result_data = await getMongo.getCVMongoQuery(condition,get_fields,table);                                    
                                } catch (error) {
                                    result_data = `Error parsing JSON: ${error}`;
                                }
                                
                                // let result_data_UPC;
                                if (flag_of_date === 1) {
                                    const month_year = get_months_and_years_from_dates(from_date, to_date);                                    
                                    const condition_UPC = { status: 1, type_id: parseInt(transporter[0]), month_year: { $in: month_year } };
                                    const table_UPC = "vehicle_utlization";
                                    const fields_UPC = { projection: { _id: 0 } };
                                    
                                    try {
                                        result_data_UPC = await getMongo.getBAMongoQuery(condition_UPC, fields_UPC, table_UPC);
                                    } catch (error) {
                                        result_data_UPC = `Error parsing JSON: ${error}`;
                                    }
                                    
                                } else {
                                    const condition_UPC = { status: 1, type_id: parseInt(transporter[0]) };
                                    const table_UPC = "vehicle_utlization";
                                    const fields_UPC = { projection: { _id: 0 } };
                        
                                    try {
                                        result_data_UPC = await getMongo.getBAMongoQuery(condition_UPC, fields_UPC, table_UPC);
                                    } catch (error) {
                                        result_data_UPC = `Error parsing JSON: ${error}`;
                                    }
                                }
                                
                                // Filter final_data based on customer_id and gps_vendor
                                if (result_data) {
                                    for (const val of result_data) {
                                        if (flag_of_customer === 1 && flag_of_gpsvendor === 1) {
                                            if (val.transporter_id === customer_id) {
                                                const vender_arr = val.vendor;
                                                if (vender_arr) {
                                                    for (const value of Object.values(vender_arr)) {
                                                        if (value === gps_vendor) {
                                                            final_data.push(val);
                                                        }
                                                    }
                                                }
                                            }
                                        } else if (flag_of_customer === 1 && flag_of_gpsvendor === 0) {
                                            if (val.transporter_id === customer_id) {
                                                final_data.push(val);
                                            }
                                        } else if (flag_of_customer === 0 && flag_of_gpsvendor === 1) {
                                            const vender_arr = val.vendor;
                                            if (vender_arr) {
                                                for (const value of Object.values(vender_arr)) {
                                                    if (value === gps_vendor) {
                                                        final_data.push(val);
                                                    }
                                                }
                                            }
                                        } else if (flag_of_customer === 0 && flag_of_gpsvendor === 0) {
                                            final_data = result_data;
                                        }
                                    }
                                }
                            } else {
                                return res.status(200).json({ status: "fail", Message: "No transporter IDs found" });
                            }
                        } else if (user_type === 24) {
                            let CVCA_qry_data = {};
                            
                            // Query the logistic_role_assignment table
                            const LRA_qry = `SELECT type_detail_id FROM logistic_role_assignment WHERE user_type = 24 AND user_id = ${user_id}`;
                            const [LRA_qry_data] = await db.promise().query(LRA_qry);
                            
                            if (!LRA_qry_data || LRA_qry_data.length === 0) {
                                return res.status(400).json({ Status: "Fail", Message: "Transporter id not available in Logistic Role Assignment Table" });
                            }
                        
                            let transporter_ids = [];
                            let transporter = [];
                        
                            for (const value of LRA_qry_data) {
                                const LRA_Agent_ids = value.type_detail_id;
                                
                                let CVTA_qry;
                                if (flag_of_date === 1) {
                                    CVTA_qry = `SELECT * FROM cv_transporter_assignment WHERE type_id = ${LRA_Agent_ids} AND status = 1 AND DATE(create_date) BETWEEN '${from_date}' AND '${to_date}'`;
                                } else {
                                    CVTA_qry = `SELECT * FROM cv_transporter_assignment WHERE type_id = ${LRA_Agent_ids} AND status = 1`;
                                }
                                
                                const [CVTA_qry_data] = await db.promise().query(CVTA_qry);
                        
                                if (!CVTA_qry_data || CVTA_qry_data.length === 0) {
                                    return res.status(400).json({ Status: "Fail", Message: "Transporter id not available in cv_transporter_assignment Table" });
                                }
                                
                                transporter_ids = CVTA_qry_data.map(value => value.transporter_id);
                                transporter = transporter_ids.map(String);
                            }
                            
                            if (transporter.length > 0) {
                                const table = "cv_dashboard_raw_vehicle_data";
                                const condition = { status: 1, transporter_id: { $in: transporter } };
                                const get_fields = { projection: { _id: 0 } };
                                
                                try {
                                    result_data = await getMongo.getCVMongoQuery(condition,get_fields,table);                                    
                                } catch (error) {
                                    result_data = `Error parsing JSON: ${error}`;
                                }
                                
                                if (result_data) {
                                    for (const val of result_data) {
                                        if (flag_of_customer === 1 && flag_of_gpsvendor === 1) {
                                            if (val.transporter_id === customer_id) {
                                                const vender_arr = val.vendor;
                                                if (vender_arr) {
                                                    for (const value of Object.values(vender_arr)) {
                                                        if (value === gps_vendor) {
                                                            final_data.push(val);
                                                        }
                                                    }
                                                }
                                            }
                                        } else if (flag_of_customer === 1 && flag_of_gpsvendor === 0) {
                                            if (val.transporter_id === customer_id) {
                                                final_data.push(val);
                                            }
                                        } else if (flag_of_customer === 0 && flag_of_gpsvendor === 1) {
                                            const vender_arr = val.vendor;
                                            if (vender_arr) {
                                                for (const value of Object.values(vender_arr)) {
                                                    if (value === gps_vendor) {
                                                        final_data.push(val);
                                                    }
                                                }
                                            }
                                        } else if (flag_of_customer === 0 && flag_of_gpsvendor === 0) {
                                            final_data = result_data;
                                        }
                                    }
                                }
                            } else {
                                return res.status(400).json({ Status: "Fail", Message: "No transporter IDs found" });
                            }
                        }
                        
                        
                        // if (final_data.length > 0 || result_data_UPC.length > 0) {
                        // let report_data = {};
                        if (user_type === 6 && final_data.length > 0) {
                            // Initialize variables
                            const vehicle_status = { running: 0, stoppage: 0, inactive: 0, nongps: 0 };
                            const Trnsp_ids = {};
                            const customer_status = { existing_client: 0, new_client: 0 };
                            const iot_status = { gps: 0, elock: 0, fuelsensor: 0 };
                            const travel_states = {};
                            const risk_vehicle_status = { low: 0, avg: 0, high: 0 };
                            const gps_vendor_status = {};
                            const mom_vehicle = {};
                            const char_data = { vas_penetration: {}, strategic_fleet_universe: {} };
                            const filter_transporter = {};
                            const filter_gps_vendor = {};
                            const filter_agent = {};
                            const agent_vehicle_status = {};
                            const arr_agent_ids = {};
                            const bin_agent_transporter = {};
                            const Trns_id_to_Ver_id = {};
                            const vas_data = {};
                            const vas_name = {};
                            const vmdate_array = [];
                        
                            const header = "ILGC Consolidated Dashboard";
                            
                            // Query cv_agent table
                            const CVA_qry = `SELECT id, name FROM cv_agent WHERE group_id = ${group_id} AND status = 1`;
                            const [CVA_qry_data] = await db.promise().query(CVA_qry);
                            
                            for (const agent_val of CVA_qry_data) {
                                filter_agent[agent_val.id] = agent_val.name;
                                arr_agent_ids[agent_val.id] = agent_val.id;
                            }
                            
                            const agent_ids = Object.values(arr_agent_ids).join(',');
                            
                            if (agent_ids) {
                                const CVTA_for_agent_qry = `SELECT * FROM cv_transporter_assignment WHERE status = 1 AND type_id IN (${agent_ids})`;
                                const [CVTA_for_agent_data] = await db.promise().query(CVTA_for_agent_qry);
                                
                                for (const cvta_val of CVTA_for_agent_data) {                                    
                                    if (cvta_val.type === 'agent') {
                                        bin_agent_transporter[cvta_val.transporter_id] = {
                                            agent_id: cvta_val.type_id,
                                            agent_name: filter_agent[cvta_val.type_id],
                                        };
                                    }
                                    
                                    if (cvta_val.type === 'vertical') {
                                        Trns_id_to_Ver_id[cvta_val.transporter_id] = cvta_val.type_id;
                                    }
                                }//console.log(bin_agent_transporter);process.exit(0);
                            }
                            
                            // Process final_data
                            for (const value of final_data) {
                                // Vehicle Status Card
                                if (value.v_status === 'Running') vehicle_status.running += 1;
                                if (value.v_status === 'Stopped') vehicle_status.stoppage += 1;
                                if (value.v_status === 'InActive') vehicle_status.inactive += 1;
                                if (value.v_status === 'NoGps') vehicle_status.nongps += 1;
                                
                                // Customer Status Card
                                Trnsp_ids[value.transporter_id] = value.transporter_id;
                                
                                // IOT Status Card
                                const iot_arr = value.iot_status;
                                if (iot_arr) {
                                    for (const [iot_key, iot_val] of Object.entries(iot_arr)) {
                                        if (iot_val === 'FuelSensor') iot_status.fuelsensor += 1;
                                        if (iot_val === 'Elock') iot_status.elock += 1;
                                        if (iot_val === 'Gps') iot_status.gps += 1;
                                    }
                                }
                                
                                // GPS Vendor Pie Chart
                                const arr_gps_vend = value.vendor;
                                if (arr_gps_vend) {
                                    for (const [key_gps_vend, gps_vend_value] of Object.entries(arr_gps_vend)) {
                                        if (gps_vend_value in gps_vendor_status) {
                                            gps_vendor_status[gps_vend_value] += 1;
                                        } else {
                                            gps_vendor_status[gps_vend_value] = 1;
                                        }
                                    }
                                }
                                
                                // Agent Vehicle Status Pie Chart
                                if (parseInt(value.transporter_id) in bin_agent_transporter) {
                                    const agent_name = bin_agent_transporter[parseInt(value.transporter_id)].agent_name;
                                    if (agent_name in agent_vehicle_status) {
                                        agent_vehicle_status[agent_name] += 1;
                                    } else {
                                        agent_vehicle_status[agent_name] = 1;
                                    }
                                }
                                
                                // MOM Vehicle Line Chart
                                if (flag_of_date === 0) {
                                    const vmdate = value.vehicle_mapping_date;
                                    if (vmdate) {
                                        vmdate_array.push(vmdate);
                                    }
                                }
                            }
                            
                            // Get unique dates
                            const unique_dates = [...new Set(vmdate_array)];                            
                            const unique_dates_list = unique_dates.sort();
                            const dates_string = unique_dates_list.map(date => `"${date}"`).join(',');
                            
                            if (Object.keys(Trnsp_ids).length > 0) {
                                const dict_trnsp = Object.values(Trnsp_ids);
                                const strng_transporter = dict_trnsp.map(String);
                                const t_ids = strng_transporter.map(id => `"${id}"`).join(',');
                                
                                let VTA_qry;
                                if (flag_of_date === 0) {
                                    VTA_qry = `SELECT * FROM vehicle_transporter_assignment WHERE transporter_id IN (${t_ids}) AND create_date IN (${dates_string})`;
                                } else {
                                    const fdate = `${from_date} 00:00:00`;
                                    const tdate = `${to_date} 23:59:59`;
                                    VTA_qry = `SELECT * FROM vehicle_transporter_assignment WHERE transporter_id IN (${t_ids}) AND create_date BETWEEN '${fdate}' AND '${tdate}'`;
                                }
                                
                                const [VTA_qry_data] = await db.promise().query(VTA_qry);
                                
                                if (VTA_qry_data.length > 0) {
                                    for (const mom_val of VTA_qry_data) {
                                        const monthyear = get_month_year_from_date(mom_val.create_date);
                                        if (monthyear in mom_vehicle) {
                                            mom_vehicle[monthyear] += 1;
                                        } else {
                                            mom_vehicle[monthyear] = 1;
                                        }
                                    }
                                }
                                
                                // Query cv_dashboard_raw_transporter_data
                                const table = "cv_dashboard_raw_transporter_data";
                                const condition = { status: 1, transporter_id: { $in: strng_transporter } };
                                const get_fields = { projection: { _id: 0, client_type: 1, transporter_id: 1, vehicle_status: 1 } };
                                
                                let customer_data;
                                try {
                                    customer_data = await getMongo.getCVMongoQuery(condition,get_fields,table);
                                } catch (error) {
                                    customer_data = `Error parsing JSON: ${error}`;
                                }
                                // try {
                                //     customer_data = await getMongo.getCVMongoQuery(condition,get_fields,table);
                                    
                                // } catch (error) {
                                //     customer_data = `Error parsing JSON: ${error}`;
                                // }
                                
                                if (customer_data) {
                                    for (const value of customer_data) {
                                        if (value.client_type === 'new') {
                                            customer_status.new_client += 1;
                                        } else if (value.client_type === 'existing') {
                                            customer_status.existing_client += 1;
                                        }
                                        
                                        // Query cv_vas_penetration
                                        const SVP_qry = `SELECT * FROM cv_vas_penetration WHERE status = 1 AND group_id = ${group_id}`;
                                        const [SVP_qry_data] = await db.promise().query(SVP_qry);
                                        
                                        for (const svp_val of SVP_qry_data) {
                                            vas_name[svp_val.type_id] = svp_val.type;
                                            char_data.strategic_fleet_universe[svp_val.type] = svp_val.fleet_count;
                                        }
                                        
                                        if (parseInt(value.transporter_id) in Trns_id_to_Ver_id) {
                                            const T_id = parseInt(value.transporter_id);
                                            
                                            if (Trns_id_to_Ver_id[T_id] in vas_name) {
                                                const vert_name = vas_name[Trns_id_to_Ver_id[T_id]];
                                                if (vert_name in vas_data) {
                                                    vas_data[vert_name] +=
                                                        value.vehicle_status.running +
                                                        value.vehicle_status.stopped +
                                                        value.vehicle_status.inactive;
                                                } else {
                                                    vas_data[vert_name] =
                                                        value.vehicle_status.running +
                                                        value.vehicle_status.stopped +
                                                        value.vehicle_status.inactive;
                                                }
                                            }
                                        }
                                    }
                                    
                                    for (const [vert_key, vert_val] of Object.entries(vas_name)) {
                                        
                                        if (vert_val in vas_data) {
                                            char_data.vas_penetration[vert_val] = vas_data[vert_val];
                                        } else {
                                            char_data.vas_penetration[vert_val] = 0;
                                        }
                                    }
                                }
                                
                                // Travel States Card
                                const [state_name_result] = await db.promise().query('SELECT id, code FROM state WHERE status=1');
                                const state_name = {};
                                for (const item of state_name_result) {
                                    state_name[item.id] = item.code;
                                }

                                // Query travel_state_district
                                const table_travel = "travel_state_district";
                                let condition_travel = {};
                                if (flag_of_date === 1 && flag_of_customer === 0) {
                                    condition_travel = { date: { $gte: from_date, $lte: to_date } };
                                } else if (flag_of_customer === 1 && flag_of_date === 0) {
                                    condition_travel = { subgroup_id: parseInt(strng_transporter.join(',')) };
                                } else if (flag_of_customer === 1 && flag_of_date === 1) {
                                    condition_travel = {
                                        subgroup_id: parseInt(strng_transporter.join(',')),
                                        date: { $gte: from_date, $lte: to_date },
                                    };
                                }
                                
                                const get_fields_travel = { projection: { _id: 0 } };
                        
                                let state_data;
                                try {
                                    // state_data = await getBALocalMongoQuery(table_travel, condition_travel, get_fields_travel);
                                    state_data = await getMongo.getBAMongoQuery(condition_travel, get_fields_travel, table_travel);
                                } catch (error) {
                                    state_data = `Error parsing JSON: ${error}`;
                                }
                                
                                if (state_data) {
                                    for (const value of state_data) {
                                        const S_Id = value.state_id;
                                        if (S_Id) {
                                            const state_code = state_name[value.state_id];
                                            if (state_code in travel_states) {
                                                travel_states[state_code] += value.no_of_vehicle;
                                            } else {
                                                travel_states[state_code] = value.no_of_vehicle;
                                            }
                                        }
                                    }
                                }
                                
                                // Query cv_risk_vehicles
                                const table_risk = "cv_risk_vehicles";
                                const condition_risk = { status: 1, user_id: user_id };
                                const get_fields_risk = { projection: { _id: 0 } };
                        
                                let risk_vehicle_data;
                                try {
                                    // risk_vehicle_data = await getLocalMongoQuery(table_risk, condition_risk, get_fields_risk);
                                    risk_vehicle_data = await getMongo.getCVMongoQuery(condition_risk,get_fields_risk,table_risk);
                                } catch (error) {
                                    risk_vehicle_data = `Error parsing JSON: ${error}`;
                                }
                                
                                if (risk_vehicle_data) {
                                    for (const value of risk_vehicle_data) {
                                        risk_vehicle_status.low = value.risk_vehicle_status.low;
                                        risk_vehicle_status.avg = value.risk_vehicle_status.avg;
                                        risk_vehicle_status.high = value.risk_vehicle_status.high;
                                    }
                                }
                            }
                            
                            // Construct report_data
                            report_data = {
                                header,
                                vehicleStatus: vehicle_status,
                                customer: customer_status,
                                Iot: iot_status,
                                travel_states,
                                risk_vehicle_status,
                                gps_vendor_status,
                                mom_vehicle,
                                chart_data: char_data,
                                agent_vehicle_status,
                            };
                            // console.log(Object.keys(report_data).length);process.exit(0);
                            // return res.status(200).json({ Status: "Success", Message: "Data Fetched Successfully", Data: report_data });
                        } else if (user_type === 10 && final_data.length > 0) {
                            // Initialize data structures
                            let vehicleStatus = { running: 0, stoppage: 0, inactive: 0, nongps: 0 };
                            let iotStatus = { gps: 0, elock: 0, fuelsensor: 0 };
                            let vehicleUtilization = { utilize_count: 0, avg_utilize_count: 0, under_utilize_count: 0 };
                            let charData = { no_of_vehicle: {}, no_of_stoppage: {} };
                            let monthlyCharData = { utilized_vehicles: {}, avg_utilized_vehicle: {}, under_utilized_vehicle: {} };
                            let filterGpsVendor = {};
                            let header = "Transporter Consolidated Dashboard";
                            let stoppageData = [];
                            
                            if (transporter) {
                                const table = "cv_dashboard_raw_transporter_data";
                                const condition = { status: 1, transporter_id: { $in: transporter } };
                                // const getFields = { projection: { _id: 0, vehicle_stoppage: 1 } };
                                const getFields = { projection: { _id: 0} };
                                
                                
                                try {
                                    stoppageData = await getMongo.getCVMongoQuery(condition,getFields,table);
                                    // stoppageData = await db.collection(table).find(condition, getFields).toArray();
                                } catch (error) {
                                    stoppageData = `Error parsing JSON: ${error.message}`;
                                }
                            }
                            // res.send(stoppageData);
                            // Process stoppage data
                            // if (stoppageData && !stoppageData.startsWith("Error")) {
                            if (stoppageData && Array.isArray(stoppageData)) {                                
                                // res.send('stoppageData');
                                for (const value of stoppageData) {
                                    const vehLocationStoppageArray = value.vehicle_stoppage;
                                    let noOfVehicle = {};
                                    let noOfStoppage = {};
                                    if(vehLocationStoppageArray){
                                        for (const val of vehLocationStoppageArray) {
                                            noOfVehicle[val.location] = val.v_count;
                                            noOfStoppage[val.location] = val.s_count;
                                        }
                                    }
                                    charData.no_of_vehicle = noOfVehicle;
                                    charData.no_of_stoppage = noOfStoppage;
                                }
                            }
                            // res.send('stoppageData2');
                            // Process vehicle utilization data
                            // if (result_data_UPC && !resultDataUPC.startsWith("Error")) {
                            if (result_data_UPC && Array.isArray(result_data_UPC)) { 
                                for (const valueUpc of result_data_UPC) {
                                    const typeOfUtilization = valueUpc.utilization;
                                    const mYear = valueUpc.month_year;

                                    if (typeOfUtilization === 'Utilize') {
                                        vehicleUtilization.utilize_count += 1;
                                        monthlyCharData.utilized_vehicles[mYear] = (monthlyCharData.utilized_vehicles[mYear] || 0) + 1;
                                    } else if (typeOfUtilization === 'Average Utilize') {
                                        vehicleUtilization.avg_utilize_count += 1;
                                        monthlyCharData.avg_utilized_vehicle[mYear] = (monthlyCharData.avg_utilized_vehicle[mYear] || 0) + 1;
                                    } else if (typeOfUtilization === 'Under Utilize') {
                                        vehicleUtilization.under_utilize_count += 1;
                                        monthlyCharData.under_utilized_vehicle[mYear] = (monthlyCharData.under_utilized_vehicle[mYear] || 0) + 1;
                                    }
                                }
                            }

                            // Process final data (assuming finalData is fetched elsewhere)
                            if (final_data) {
                                for (const value of final_data) {
                                    // Vehicle Status Card
                                    if (value.v_status === 'Running') vehicleStatus.running += 1;
                                    if (value.v_status === 'Stopped') vehicleStatus.stoppage += 1;
                                    if (value.v_status === 'InActive') vehicleStatus.inactive += 1;
                                    if (value.v_status === 'NoGps') vehicleStatus.nongps += 1;

                                    // IOT Status Card
                                    const iotArr = value.iot_status;
                                    if (iotArr) {
                                        for (const [iotKey, iotVal] of Object.entries(iotArr)) {
                                            if (iotVal === 'FuelSensor') iotStatus.fuelsensor += 1;
                                            if (iotVal === 'Elock') iotStatus.elock += 1;
                                            if (iotVal === 'Gps') iotStatus.gps += 1;
                                        }
                                    }
                                }
                            }
                            // Prepare report data
                            report_data = {
                                header: header,
                                vehicleStatus: vehicleStatus,
                                Iot: iotStatus,
                                vehicle_utilization: vehicleUtilization,
                                chart_data: charData,
                                monthly_char_data: monthlyCharData,
                            };
                            // console.log(report_data);process.exit(0);
                        } else if (user_type === 24 && final_data.length > 0) {
                            // Initialize data structures
                            let vehicleStatus = { running: 0, stoppage: 0, inactive: 0, nongps: 0 };
                            let customerStatus = { existing_client: 0, new_client: 0 };
                            let iotStatus = { gps: 0, elock: 0, fuelsensor: 0 };
                            let momVehicle = {};
                            let billingStatistics = {};
                            let commissions = {};
                            let charData = { billing_statistics: {}, commissions: {} };
                            let vmdateArray = [];
                            let TrnspIds = new Set(); // Use a Set to store unique transporter IDs
                            let header = "Agent Consolidated Dashboard";

                            // Process final_data
                            for (const value of final_data) {
                                // Vehicle Status Card
                                if (value.v_status === 'Running') vehicleStatus.running += 1;
                                if (value.v_status === 'Stopped') vehicleStatus.stoppage += 1;
                                if (value.v_status === 'InActive') vehicleStatus.inactive += 1;
                                if (value.v_status === 'NoGps') vehicleStatus.nongps += 1;

                                // Store transporter IDs
                                TrnspIds.add(value.transporter_id);

                                // IOT Status Card
                                const iotArr = value.iot_status;
                                if (iotArr) {
                                    for (const [iotKey, iotVal] of Object.entries(iotArr)) {
                                        if (iotVal === 'FuelSensor') iotStatus.fuelsensor += 1;
                                        if (iotVal === 'Elock') iotStatus.elock += 1;
                                        if (iotVal === 'Gps') iotStatus.gps += 1;
                                    }
                                }

                                // MOM Vehicle Line Chart
                                if (flag_of_date === 0) {
                                    const vmdate = value.vehicle_mapping_date;
                                    if (vmdate) vmdateArray.push(vmdate);
                                }
                            }

                            // Get unique dates and sort them
                            //if(vmdateArray){
                                const uniqueDates = [...new Set(vmdateArray)].sort();
                                const datesString = uniqueDates.map(date => `"${date}"`).join(', ');
                            //}                            
                            const tIds = [...TrnspIds].map(id => `"${id}"`).join(',');

                            // Fetch MOM Vehicle data from MySQL
                            let VTAQuery;
                            if (flag_of_date === 0) {
                                VTAQuery = `SELECT * FROM vehicle_transporter_assignment WHERE transporter_id IN (${tIds}) AND create_date IN (${datesString})`;
                            } else {
                                const fdate = `${from_date} 00:00:00`;
                                const tdate = `${to_date} 23:59:59`;
                                VTAQuery = `SELECT * FROM vehicle_transporter_assignment WHERE transporter_id IN (${tIds}) AND create_date BETWEEN '${fdate}' AND '${tdate}'`;
                            }
                            
                            const [VTAQueryData] = await db.promise().query(VTAQuery);;
                            if (VTAQueryData) {
                                for (const momVal of VTAQueryData) {
                                    const monthYear = get_month_year_from_date(momVal.create_date);
                                    momVehicle[monthYear] = (momVehicle[monthYear] || 0) + 1;
                                }
                            }

                            // Fetch billing statistics from MongoDB
                            const table = "cv_billing_statistics";
                            const condition = { status: 1 };
                            const getFields = { projection: { _id: 0 } };

                            let billingData;
                            try {
                                billingData = await getMongo.getCVMongoQuery(condition,getFields,table);
                                // billingData = await db.collection(table).find(condition, getFields).toArray();
                            } catch (error) {
                                console.error("Error fetching billing data:", error);
                                billingData = [];
                            }
                            
                            for (const value of billingData) {
                                
                                billingStatistics = value.billing_statistics;
                                commissions = value.commisions;
                                charData = { billing_statistics: billingStatistics, commissions: commissions };
                            }
                            
                            // Fetch customer data from MongoDB
                            if (TrnspIds.size > 0) {
                                const table = "cv_dashboard_raw_transporter_data";
                                // const condition = { status: 1, transporter_id: { $in: [...TrnspIds].map(id => parseInt(id)) } };
                                const condition = { status: 1, transporter_id: { $in: [...TrnspIds].map(id => String(id)) } };
                                const getFields = { projection: { _id: 0, client_type: 1, transporter_id: 1 } };
                                
                                let customerData;
                                try {
                                    // customerData = await db.collection(table).find(condition, getFields).toArray();
                                    customerData = await getMongo.getCVMongoQuery(condition,getFields,table);
                                    
                                } catch (error) {
                                    console.error("Error fetching customer data:", error);
                                    customerData = [];
                                }
                                
                                // Process customer data
                                if (customerData) {
                                    for (const value of customerData) {
                                        if (value.client_type === 'new') customerStatus.new_client += 1;
                                        else if (value.client_type === 'existing') customerStatus.existing_client += 1;
                                    }
                                }

                                // Prepare report data
                                report_data = {
                                    header: header,
                                    vehicleStatus: vehicleStatus,
                                    customer: customerStatus,
                                    Iot: iotStatus,
                                    mom_vehicle: momVehicle,
                                    chart_data: charData,
                                };
                                // console.log(report_data);process.exit(0);
                            }
                            // Construct report_data for UserType 24
                        }
                        
                        if(Object.keys(report_data).length > 0){
                            return res.status(200).json({ Status: 'Success', Message: 'Data Fetched Successfully', Data: report_data });
                        } else {
                            return res.status(200).json({ Status: 'Fail', Message: 'Data not available with these filters' });
                        }
                    } else {
                        
                        if (user_type === 6) {
                            const CVCA_qry = `SELECT type_detail, type_detail_id FROM cv_customer_assignment WHERE status=1 AND user_id=${user_id}`;
                            const [CVCA_qry_data] = await db.promise().query(CVCA_qry);
                            // res.send(CVCA_qry_data);
                            if (CVCA_qry_data.length > 0) {
                                transporterIds = CVCA_qry_data.map(value => value.type_detail_id);
                                transporter = transporterIds.map(String);
                            } else {
                                return { Status: "Fail", Message: "Transporter id not available in CV Customer Assignment Table" };
                            }
                            
                        } else if (user_type === 10) {
                            const LRA_qry = `SELECT * FROM logistic_role_assignment WHERE status=1 AND user_id=${user_id}`;
                            const [LRA_qry_data] = await db.promise().query(LRA_qry);
                            
                            if (LRA_qry_data.length > 0) {
                                transporterIds = LRA_qry_data.map(value => value.type_detail_id);
                                transporter = transporterIds.map(String);
                            } else {
                                return res.status(200).json({ Status: "Fail", Message: "Transporter id not available in Logistic Role Assignment Table" });
                            }
                            
                        } else if (user_type === 24) {
                            const LRA_qry = `SELECT type_detail_id FROM logistic_role_assignment WHERE user_type = 24 AND user_id=${user_id}`;
                            const [LRA_qry_data] = await db.promise().query(LRA_qry);

                            if (LRA_qry_data.length > 0) {
                                const LRA_Agent_ids = LRA_qry_data[0].type_detail_id;
                                
                                
                                const CVTA_qry = `SELECT * FROM cv_transporter_assignment WHERE type_id=${LRA_Agent_ids} AND status=1`;
                                const [CVTA_qry_data] = await db.promise().query(CVTA_qry);
                                
                                if (CVTA_qry_data.length > 0) {
                                    transporterIds = CVTA_qry_data.map(value => value.transporter_id);
                                    transporter = transporterIds.map(String);
                                } else {
                                    return { Status: "Fail", Message: "Transporter id not available in cv_transporter_assignment Table" };
                                }                                
                                
                            } else {
                                return { Status: "Fail", Message: "Transporter id not available in Logistic Role Assignment Table" };
                            }
                        }
                        
                        if (transporter.length > 0) {
                            const table = "cv_dashboard_raw_transporter_data";
                            const condition = { status: 1, transporter_id: { $in: transporter } };
                            // const condition = { status: 1, transporter_id: 0 };
                            const getFields = { projection: { _id: 0 } };
                            
                            try {
                                final_data = await getMongo.getCVMongoQuery(condition,getFields,table);                                
                            } catch (error) {
                                console.error("Error fetching data:", error);
                                final_data = [];
                            }                            
                        }
                        // res.send(final_data);
                        if (user_type === 6 && final_data.length > 0) {
                            // Initialize variables
                            let vehicle_status = { running: 0, stoppage: 0, inactive: 0, nongps: 0 };
                            let customer_status = { existing_client: 0, new_client: 0 };
                            let iot_status = { gps: 0, elock: 0, fuelsensor: 0 };
                            let travel_states = {};
                            const travel_states_map = {};
                            let risk_vehicle_status = { low: 0, avg: 0, high: 0 };
                            let gps_vendor_status = {};
                            let temp_mom_vehicle = {};
                            let mom_vehicle = {};
                            let mom_vehicle_cumulative_sum = 0;
                            let char_data = { vas_penetration: {}, strategic_fleet_universe: {} };
                            let filter_transporter = {};
                            let filter_gps_vendor = {};
                            let filter_agent = {};
                            let agent_vehicle_status = {};
                            let arr_agent_ids = {};
                            let bin_agent_transporter = {};
                            let Trns_id_to_Ver_id = {};
                            let vas_data = {};
                            let vas_name = {};
                            let filter_insurer = {};
                            let filter_customer = {};

                            let header = "ILGC Consolidated Dashboard";                            
                            
                            // const mydb = getMasterDb();
                            const CVA_qry = `SELECT id, name FROM cv_agent WHERE group_id=${group_id} AND status=1`;
                            const [CVA_qry_data] = await db.promise().query(CVA_qry);
                            
                            for (const agent_val of CVA_qry_data) {
                                filter_agent[agent_val.id] = agent_val.name;
                                arr_agent_ids[agent_val.id] = agent_val.id;
                            }
                            
                            const agent_ids = Object.values(arr_agent_ids).join(',');
                            
                            if (agent_ids) {
                                const CVTA_for_agent_qry = `SELECT * FROM cv_transporter_assignment WHERE status=1 AND type_id IN(${agent_ids})`;
                                const [CVTA_for_agent_data] = await db.promise().query(CVTA_for_agent_qry);
                                
                                for (const cvta_val of CVTA_for_agent_data) {
                                    if (cvta_val.type === 'agent') {
                                        bin_agent_transporter[cvta_val.transporter_id] = {
                                            agent_id: cvta_val.type_id,
                                            agent_name: filter_agent[cvta_val.type_id]
                                        };
                                    }
                    
                                    if (cvta_val.type === 'vertical') {
                                        Trns_id_to_Ver_id[cvta_val.transporter_id] = cvta_val.type_id;
                                    }
                                }
                            }
                            
                            
                            // Simulating foreach loop using a list of dictionaries 'result_data'
                            for (const value of final_data) {
                                // Vehicle Status Card
                                vehicle_status.running += value.vehicle_status.running;
                                vehicle_status.stoppage += value.vehicle_status.stopped;
                                vehicle_status.inactive += value.vehicle_status.inactive;
                                vehicle_status.nongps += value.vehicle_status.nogps;
                                
                                // Customer Status Card
                                const client_type = value.client_type;
                                if (client_type === 'new') {
                                    customer_status.new_client += 1;
                                } else if (client_type === 'existing') {
                                    customer_status.existing_client += 1;
                                }
                                
                                // IOT Status Card
                                iot_status.fuelsensor += value.iot_status.FuelSensor;
                                iot_status.elock += value.iot_status.Elock;
                                iot_status.gps += value.iot_status.Gps;
                                
                                // GPS Vendor Pie Chart
                                const arr_gps_vend = value.gps_vendor_status;
                                if (arr_gps_vend) {
                                    for (const [key_gps_vend, gps_vend_value] of Object.entries(arr_gps_vend)) {
                                        if (key_gps_vend in gps_vendor_status) {
                                            gps_vendor_status[key_gps_vend] += gps_vend_value;
                                        } else {
                                            gps_vendor_status[key_gps_vend] = gps_vend_value;
                                        }
                    
                                        // Filter GPS Vendor
                                        filter_gps_vendor[key_gps_vend] = key_gps_vend;
                                    }
                                }
                                
                                // Agent Vehicle Status Pie Chart
                                if (bin_agent_transporter[value.transporter_id]) {
                                    const agent_name = bin_agent_transporter[value.transporter_id].agent_name;
                                    agent_vehicle_status[agent_name] = (value.vehicle_status.running + value.vehicle_status.stopped + value.vehicle_status.inactive + value.vehicle_status.nogps);
                                }
                                
                                // MOM Vehicle Line Chart Step-1
                                const arr_month_veh = value.month_vehicle;
                                for (const [key_month, month_value] of Object.entries(arr_month_veh)) {
                                    if (key_month in temp_mom_vehicle) {
                                        temp_mom_vehicle[key_month] += month_value;
                                    } else {
                                        temp_mom_vehicle[key_month] = month_value;
                                    }
                                }
                                
                                // Strategic and VAS Penetration Bar Chart
                                const SVP_qry = `SELECT * FROM cv_vas_penetration WHERE status=1 AND group_id=${group_id}`;
                                const [SVP_qry_data] = await db.promise().query(SVP_qry);
                                
                                for (const svp_val of SVP_qry_data) {
                                    vas_name[svp_val.type_id] = svp_val.type;
                                    char_data.strategic_fleet_universe[svp_val.type] = svp_val.fleet_count;
                                }
                                
                                if (Trns_id_to_Ver_id[value.transporter_id]) {
                                    const T_id = value.transporter_id;
                                    if (vas_name[Trns_id_to_Ver_id[T_id]]) {
                                        const vert_name = vas_name[Trns_id_to_Ver_id[T_id]];
                                        if (vas_data[vert_name]) {
                                            vas_data[vert_name] += (value.vehicle_status.running + value.vehicle_status.stopped + value.vehicle_status.inactive);
                                        } else {
                                            vas_data[vert_name] = (value.vehicle_status.running + value.vehicle_status.stopped + value.vehicle_status.inactive);
                                        }
                                    }
                                }
                                
                                // Filter Transporter/Customer
                                filter_transporter[value.transporter_id] = value.name;
                            }
                            
                            
                            // MOM Vehicle Line Chart Step-2
                            for (const [month, value] of Object.entries(temp_mom_vehicle)) {
                                mom_vehicle_cumulative_sum += value;
                                mom_vehicle[month] = mom_vehicle_cumulative_sum;
                            }
                            
                            // VAS Penetration Data
                            for (const [vert_key, vert_val] of Object.entries(vas_name)) {
                                if (vas_data[vert_val]) {
                                    char_data.vas_penetration[vert_val] = vas_data[vert_val];
                                } else {
                                    char_data.vas_penetration[vert_val] = 0;
                                }
                            }
                            
                            // Travel States Card
                            const [state_name_result] = await db.promise().query('SELECT id, code FROM state WHERE status=1');
                            const state_name = {};
                            for (const item of state_name_result) {
                                state_name[item.id] = item.code;
                            }

                            
                            const table = "travel_state_district";
                            // const condition = { group_id: "5674", subgroup_id: 86194 };
                            const condition = { group_id: group_id };
                            const getFields = { projection: { _id: 0 } };
                            
                            try {
                                const state_data = await getMongo.getBAMongoQuery(condition,getFields,table);
                                // res.send(condition);
                                if (state_data) {
                                    for (const value of state_data) {
                                        if (state_name[value.state_id]) {
                                            if (travel_states[state_name[value.state_id]]) {
                                                travel_states[state_name[value.state_id]] += value.no_of_vehicle;
                                            } else {
                                                
                                                travel_states[state_name[value.state_id]] = value.no_of_vehicle;
                                                
                                            }
                                        }
                                    }
                                }
                                
                                // if (Array.isArray(state_data)) {
                                //     for (const value of state_data) {
                                //         const stateId = value.state_id;
                                //         const stateName = state_name[stateId];

                                //         if (stateName) {
                                //             travel_states_map[stateName] = (travel_states_map[stateName] || 0) + (value.no_of_vehicle || 0);
                                //         }
                                //     }
                                // }

                                // const travel_states_array = Object.entries(travel_states_map).map(([state_name, no_of_vehicle]) => ({
                                //     state_name,
                                //     no_of_vehicle
                                // }));
                            } catch (error) {
                                console.error("Error fetching travel states:", error);
                            }
                            // res.send(travel_states);
                            // Risk Pie Chart
                            const risk_table = "cv_risk_vehicles";
                            const risk_condition = { status: 1, user_id: user_id };
                            const risk_getFields = { projection: { _id: 0 } };
                    
                            try {
                                const risk_vehicle_data = await getMongo.getCVMongoQuery(risk_condition,risk_getFields,risk_table);
                                if (risk_vehicle_data) {
                                    for (const value of risk_vehicle_data) {
                                        risk_vehicle_status = value.risk_vehicle_status;
                                    }
                                }
                            } catch (error) {
                                console.error("Error fetching risk vehicle data:", error);
                            }
                            
                            //Insurer Filter data
                            const insurer_qry = `SELECT id, name FROM insurer WHERE status = 1`;
                            const [insurer_qry_data] = await db.promise().query(insurer_qry);

                            insurer_qry_data.forEach(item => {
                                filter_insurer[item.id] = item.name;
                            });

                            //Customer Filter data
                            const customer_qry = `SELECT user_group.group_id,user_group.name from user_group,cv_group_assignment where user_group.status=1 and cv_group_assignment.status=1 and cv_group_assignment.group_id=user_group.group_id and cv_group_assignment.user_id=${user_id}`;
                            const [customer_qry_data] = await db.promise().query(customer_qry);

                            customer_qry_data.forEach(item => {
                                filter_customer[item.group_id] = item.name+'('+item.group_id+')';
                            });
                            // res.send(filter_customer);

                            // Constructing report_data dictionary
                            report_data = {
                                header: header,
                                vehicleStatus: vehicle_status,
                                customer: customer_status,
                                Iot: iot_status,
                                travel_states: travel_states,
                                risk_vehicle_status: risk_vehicle_status,
                                gps_vendor_status: gps_vendor_status,
                                mom_vehicle: mom_vehicle,
                                chart_data: char_data,
                                agent_vehicle_status: agent_vehicle_status,
                                filter_transporter: filter_transporter,
                                filter_gps_vendor: filter_gps_vendor,
                                filter_agent: filter_agent,
                                filter_insurer:filter_insurer,
                                filter_customer:filter_customer
                            };
                            
                        } else if(user_type === 10 && final_data.length > 0){
                            const get_report_data = [];
                            const vehicle_status = { running: 0, stoppage: 0, inactive: 0, nongps: 0 };
                            const iot_status = { gps: 0, elock: 0, fuelsensor: 0 };
                            const vehicle_utilization = { utilize_count: 0, avg_utilize_count: 0, under_utilize_count: 0 };
                            const char_data = { no_of_vehicle: {}, no_of_stoppage: {} };
                            const monthly_char_data = {
                                utilized_vehicles: {},
                                avg_utilized_vehicle: {},
                                under_utilized_vehicle: {}
                            };
                            const filter_gps_vendor = {};
                            let trns_id = null;
                            let result_data_UPC = [];

                            const header = "Transporter Consolidated Dashboard";
                            // res.send(final_data);
                            for (const value of final_data) {
                                // Vehicle Status Card
                                vehicle_status.running += value.vehicle_status.running;
                                vehicle_status.stoppage += value.vehicle_status.stopped;
                                vehicle_status.inactive += value.vehicle_status.inactive;
                                vehicle_status.nongps += value.vehicle_status.nogps;
                                
                                // IOT Status Card
                                iot_status.fuelsensor += value.iot_status.FuelSensor;
                                iot_status.elock += value.iot_status.Elock;
                                iot_status.gps += value.iot_status.Gps;
                                
                                // No of Vehicle and No of Stoppage Bar chart
                                if (value.vehicle_stoppage) {
                                    const veh_location_stoppage_array = value.vehicle_stoppage;
                                    for (const val of veh_location_stoppage_array) {
                                        char_data.no_of_vehicle[val.location] = val.v_count;
                                        char_data.no_of_stoppage[val.location] = val.s_count;
                                    }
                                }
                                
                                // Filter GPS Vendor
                                const arr_gps_vend = value.gps_vendor_status;
                                for (const [key_gps_vend, gps_vend_value] of Object.entries(arr_gps_vend)) {
                                    filter_gps_vendor[key_gps_vend] = key_gps_vend;
                                }
                                
                                trns_id = value.transporter_id;                                
                            }
                            
                            // UPC: Utilization Pie Chart
                            const table_UPC = "vehicle_utlization";

                            const lastMonth = dayjs().subtract(1, 'month');
                            const formatted_UPC = lastMonth.format('MMM-YYYY');
                            
                            const condition_UPC = { status: 1, type_id: parseInt(trns_id), month_year:formatted_UPC};
                            const fields_UPC = { projection: { _id: 0 } };
                            
                            try {
                                result_data_UPC = await getMongo.getBAMongoQuery(condition_UPC, fields_UPC, table_UPC);
                            } catch (error) {
                                result_data_UPC = `Error parsing JSON: ${error}`;
                            }
                            
                            
                            
                            for (const value_upc of result_data_UPC) {
                                const type_of_utilization = value_upc.utilization;

                                if (type_of_utilization === 'Utilize') {
                                    vehicle_utilization.utilize_count += 1;
                                } else if (type_of_utilization === 'Average Utilize') {
                                    vehicle_utilization.avg_utilize_count += 1;
                                } else if (type_of_utilization === 'Under Utilize') {
                                    vehicle_utilization.under_utilize_count += 1;
                                }
                            }
                            
                            // UBG: Utilization Bar Graph
                            const month_year = getLastFourMonthsYears();
                            const table_UBG = "vehicle_utlization";
                            const condition_UBG = { status: 1, type_id: parseInt(trns_id), month_year: { $in: month_year } };
                            const fields_UBG = { projection: { _id: 0 } };
                            
                            const result_data_UBG = await getMongo.getBAMongoQuery(condition_UBG, fields_UBG, table_UBG);
                            
                            for (const value_ubg of result_data_UBG) {
                                const type_of_utilization = value_ubg.utilization;
                                const M_Year = value_ubg.month_year;

                                if (type_of_utilization === 'Utilize') {
                                    monthly_char_data.utilized_vehicles[M_Year] = (monthly_char_data.utilized_vehicles[M_Year] || 0) + 1;
                                } else if (type_of_utilization === 'Average Utilize') {
                                    monthly_char_data.avg_utilized_vehicle[M_Year] = (monthly_char_data.avg_utilized_vehicle[M_Year] || 0) + 1;
                                } else if (type_of_utilization === 'Under Utilize') {
                                    monthly_char_data.under_utilized_vehicle[M_Year] = (monthly_char_data.under_utilized_vehicle[M_Year] || 0) + 1;
                                }
                            }
                            
                            get_report_data.push({
                                header: header,
                                vehicleStatus: vehicle_status,
                                Iot: iot_status,
                                chart_data: char_data,
                                filter_gps_vendor: filter_gps_vendor,
                                vehicle_utilization: vehicle_utilization,
                                monthly_char_data: monthly_char_data
                            });   
                            report_data = get_report_data;                  
                        } else if(user_type === 24 && final_data.length > 0){
                            // Initialize variables
                            const vehicle_status = { running: 0, stoppage: 0, inactive: 0, nongps: 0 };
                            const customer_status = { existing_client: 0, new_client: 0 };
                            const iot_status = { gps: 0, elock: 0, fuelsensor: 0 };
                            const month_veh_arr = {};
                            const filter_gps_vendor = {};
                            const filter_transporter = {};
                            const billing_statistics = {};
                            const commisions = {};
                            const char_data = { billing_statistics: {}, commisions: {} };

                            const header = "Agent Consolidated Dashboard";
                            
                            // Process result_data
                            for (const value of final_data) {
                                // Vehicle Status Card
                                vehicle_status.running += value.vehicle_status.running;
                                vehicle_status.stoppage += value.vehicle_status.stopped;
                                vehicle_status.inactive += value.vehicle_status.inactive;
                                vehicle_status.nongps += value.vehicle_status.nogps;
                                
                                // Customer Status Card
                                const client_type = value.client_type;
                                if (client_type === "new") {
                                    customer_status.new_client += 1;
                                } else if (client_type === "existing") {
                                    customer_status.existing_client += 1;
                                }
                                
                                // IOT Status Card
                                iot_status.fuelsensor += value.iot_status.FuelSensor;
                                iot_status.elock += value.iot_status.Elock;
                                iot_status.gps += value.iot_status.Gps;
                                
                                // MOM Vehicle Line Chart
                                const arr_month_veh = value.month_vehicle;
                                for (const [key_month, month_value] of Object.entries(arr_month_veh)) {
                                    if (month_veh_arr[key_month]) {
                                        month_veh_arr[key_month] += month_value;
                                    } else {
                                        month_veh_arr[key_month] = month_value;
                                    }
                                }
                                
                                // Filter GPS Vendor
                                const arr_gps_vend = value.gps_vendor_status;
                                for (const [key_gps_vend, gps_vend_value] of Object.entries(arr_gps_vend)) {
                                    filter_gps_vendor[key_gps_vend] = key_gps_vend;
                                }
                                
                                // Filter Transporter/Customer
                                filter_transporter[value.transporter_id] = value.name;
                            }
                            
                            
                            // Monthly Billing Statistics and Commission Bar Chart
                            const table = "cv_billing_statistics";
                            const condition = { status: 1 };
                            const getFields = { projection: { _id: 0 } };
                            
                            
                            try {
                                const billing_data = await getMongo.getCVMongoQuery(condition,getFields,table);
                                
                                for (const value of billing_data) {
                                    Object.assign(billing_statistics, value.billing_statistics);
                                    Object.assign(commisions, value.commisions);
                                }
                                char_data.billing_statistics = billing_statistics;
                                char_data.commisions = commisions;
                            } catch (error) {
                                console.error("Error fetching billing data:", error);
                            }                            
                            
                            // Construct report_data
                            report_data = {
                                header: header,
                                vehicleStatus: vehicle_status,
                                customer: customer_status,
                                Iot: iot_status,
                                mom_vehicle: month_veh_arr,
                                chart_data: char_data,
                                filter_gps_vendor: filter_gps_vendor,
                                filter_transporter: filter_transporter,
                            };                            
                        }
                        
                        if(Object.keys(report_data).length > 0){
                            return res.status(200).json({ Status: 'Success', Message: 'Data Fetched Successfully', Data: report_data });
                        } else {
                            return res.status(200).json({ Status: 'Fail', Message: 'Data not available with these filters' });
                        }
                        
                    } 
                }else{
                    return res.status(501).json("Invalid Access"); // Send response and stop further execution
                }   
            }              
            
        } else {
            return res.status(501).json("payload missing"); // Send response and stop further execution
        }

    } catch (error) {
        console.error("Error in consolidatedDashboard:", error);
        return res.status(500).json({ error: error.message }); // Send response and stop further execution
    }
};

exports.consolidatedSummarydDashboard = async (req, res) => {
    const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    let user_info ={};
    try {
        const { AccessToken, filter_data, sub_type, DeveloperOptionId, DeveloperOption } = req.body;
        let report_data = {};
        if (AccessToken != null) {
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //user_info = await getAccessTokenDataWeb(AccessToken);
            }
            // const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);

            if (user_info && user_info.Status === 2) {
                report_data.Result = user_info.Result;
                report_data.Message = user_info.Message;

                    res.status(200).json(report_data);
            }
            else{
                // const user_id = 5659; //BluedartMaster
                // const user_id = 152867; //MasterCV
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 182550; // user_type 24
                // const user_id = 152868; // user_type 24p
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter
                const user_id = user_info.AccountId;
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
                    // let report_data = {};
                    const input_data = JSON.parse(filter_data);
                    
                    // let allNull = Object.values(filter_data).every(value => value === null);
                    const allNull = Object.values(input_data).some(value => value !== null);
                    
                    // if (!allNull) {
                    //     res.send('all values are null');
                    // } else {
                    //     res.send('data is not empty');                        
                    // }

                    // res.send(allNull);
                    // if (filter_data) {
                    if (!allNull) {
                        
                        if (user_type === 6) {
                            const CVCA_qry = `SELECT type_detail, type_detail_id FROM cv_customer_assignment WHERE status=1 AND user_id=${user_id}`;
                            const [CVCA_qry_data] = await db.promise().query(CVCA_qry);
                            
                            if (CVCA_qry_data.length > 0) {
                                transporterIds = CVCA_qry_data.map(value => value.type_detail_id);
                                transporter = transporterIds.map(String);
                            } else {
                                return { Status: "Fail", Message: "Transporter id not available in CV Customer Assignment Table" };
                            }
                            
                        } else if (user_type === 10) {
                            
                            const LRA_qry = `SELECT * FROM logistic_role_assignment WHERE status=1 AND user_id=${user_id}`;                            
                            const [LRA_qry_data] = await db.promise().query(LRA_qry);
                            
                            if (LRA_qry_data.length > 0) {
                                transporterIds = LRA_qry_data.map(value => value.type_detail_id);
                                transporter = transporterIds.map(String);
                            } else {
                                return { Status: "Fail", Message: "Transporter id not available in Logistic Role Assignment Table" };
                            }
                            
                        } else if (user_type === 24) {
                            const LRA_qry = `SELECT type_detail_id FROM logistic_role_assignment WHERE status=1 AND user_type = 24 AND user_id=${user_id}`;
                            const [LRA_qry_data] = await db.promise().query(LRA_qry);
                    
                            if (LRA_qry_data.length > 0) {
                                const LRA_Agent_ids = LRA_qry_data[0].type_detail_id;
                                
                                
                                const CVTA_qry = `SELECT * FROM cv_transporter_assignment WHERE type_id=${LRA_Agent_ids} AND status=1`;
                                const [CVTA_qry_data] = await db.promise().query(CVTA_qry);
                                
                                if (CVTA_qry_data.length > 0) {
                                    transporterIds = CVTA_qry_data.map(value => value.transporter_id);
                                    transporter = transporterIds.map(String);
                                } else {
                                    return { Status: "Fail", Message: "Transporter id not available in cv_transporter_assignment Table" };
                                }                                
                                
                            } else {
                                return { Status: "Fail", Message: "Transporter id not available in Logistic Role Assignment Table" };
                            }
                        }
                        
                        if (transporter.length > 0) {
                            const table = "cv_dashboard_raw_vehicle_data";
                            const condition = { status: 1, transporter_id: { $in: transporter } };
                            const getFields = { projection: { _id: 0 } };
                            
                            try {
                                final_data = await getMongo.getCVMongoQuery(condition,getFields,table);                                
                            } catch (error) {
                                console.error("Error fetching data:", error);
                                final_data = [];
                            }                            
                        }
                        
                        if(final_data){
                            
                            if (sub_type === 'vehicle_status') {
                                const running_vehicles = [];
                                const stopped_vehicles = [];
                                const inactive_vehicles = [];
                                const no_gps_vehicles = [];
                                // res.send(final_data);
                                for (const value of final_data) {
                                    if ('vehicle_status' in value) {
                                        const vehicle_status = {};
                                        const iotstatus = value.iot_status;
                                        const gpsserviceprovider = value.vendor;
                                        
                                        const iot = iotstatus ? makeStringFromArray(iotstatus) : null;
                                        const gps_service_provider = gpsserviceprovider ? makeStringFromArray(gpsserviceprovider) : null;
                                        
                                        const vehicle_array = value.vehicle_status;
                                        let vehicle_no = null;
                                        let status = null;
                                        let speed = null;
                                        let battery = null;
                                        let current_date = null;
                                        let last_halt = null;
                                        let ignition = null;
                                        let current_location = null;
                                        // res.send(vehicle_array);
                                        if (vehicle_array) {
                                            for (const [key_vehicle, value_vehicle] of Object.entries(vehicle_array)) {
                                                vehicle_no = value_vehicle.vehicle_number;
                                                status = key_vehicle;
                        
                                                const lastdata = value_vehicle.last_data_current;
                                                if (lastdata) {
                                                    speed = lastdata.speed;
                                                    current_date = lastdata.device_time;
                                                    last_halt = lastdata.last_halt;
                                                }
                        
                                                battery = `${value.battery_percent}`;
                                                ignition = value.ignition;
                                                current_location = value.location;
                                            }
                                        }
                        
                                        vehicle_status.vehicle_no = vehicle_no;
                                        vehicle_status.vehicle_status = status;
                                        vehicle_status.speed = speed;
                                        vehicle_status.battery = battery;
                                        vehicle_status.current_date = current_date;
                                        vehicle_status.last_halt = last_halt;
                                        vehicle_status.ignition = ignition;
                                        vehicle_status.iot = iot;
                                        vehicle_status.current_location = current_location;
                                        vehicle_status.gps_service_provider = gps_service_provider;
                        
                                        if (status === 'Running') {
                                            running_vehicles.push(vehicle_status);
                                        } else if (status === 'Stopped') {
                                            stopped_vehicles.push(vehicle_status);
                                        } else if (status === 'InActive') {
                                            inactive_vehicles.push(vehicle_status);
                                        } else if (status === 'NoGps') {
                                            no_gps_vehicles.push(vehicle_status);
                                        }
                                    }
                                }
                                // console.log(stopped_vehicles);process.exit(0);

                                // Create sets to track vehicle numbers already added
                                // const addedRunning = new Set();
                                // const addedStopped = new Set();
                                // const addedInactive = new Set();
                                // const addedNoGps = new Set();

                                // for (const value of final_data) {
                                //     if ('vehicle_status' in value) {
                                //         const vehicle_status = {};
                                //         const iotstatus = value.iot_status;
                                //         const gpsserviceprovider = value.vendor;

                                //         const iot = iotstatus ? makeStringFromArray(iotstatus) : null;
                                //         const gps_service_provider = gpsserviceprovider ? makeStringFromArray(gpsserviceprovider) : null;

                                //         const vehicle_array = value.vehicle_status;
                                //         let vehicle_no = null;
                                //         let status = null;
                                //         let speed = null;
                                //         let battery = null;
                                //         let current_date = null;
                                //         let last_halt = null;
                                //         let ignition = null;
                                //         let current_location = null;

                                //         if (vehicle_array) {
                                //             for (const [key_vehicle, value_vehicle] of Object.entries(vehicle_array)) {
                                //                 vehicle_no = value_vehicle.vehicle_number;
                                //                 status = key_vehicle;

                                //                 const lastdata = value_vehicle.last_data_current;
                                //                 if (lastdata) {
                                //                     speed = lastdata.speed;
                                //                     current_date = lastdata.device_time;
                                //                     last_halt = lastdata.last_halt;
                                //                 }

                                //                 battery = `${value.battery_percent}`;
                                //                 ignition = value.ignition;
                                //                 current_location = value.location;
                                //             }
                                //         }

                                //         vehicle_status.vehicle_no = vehicle_no;
                                //         vehicle_status.vehicle_status = status;
                                //         vehicle_status.speed = speed;
                                //         vehicle_status.battery = battery;
                                //         vehicle_status.current_date = current_date;
                                //         vehicle_status.last_halt = last_halt;
                                //         vehicle_status.ignition = ignition;
                                //         vehicle_status.iot = iot;
                                //         vehicle_status.current_location = current_location;
                                //         vehicle_status.gps_service_provider = gps_service_provider;

                                //         if (status === 'Running' && !addedRunning.has(vehicle_no)) {
                                //             running_vehicles.push(vehicle_status);
                                //             addedRunning.add(vehicle_no);
                                //         } 
                                //         else if (status === 'Stopped' && !addedStopped.has(vehicle_no)) {
                                //             stopped_vehicles.push(vehicle_status);
                                //             addedStopped.add(vehicle_no);
                                //         } 
                                //         else if (status === 'InActive' && !addedInactive.has(vehicle_no)) {
                                //             inactive_vehicles.push(vehicle_status);
                                //             addedInactive.add(vehicle_no);
                                //         } 
                                //         else if (status === 'NoGps' && !addedNoGps.has(vehicle_no)) {
                                //             no_gps_vehicles.push(vehicle_status);
                                //             addedNoGps.add(vehicle_no);
                                //         }
                                //     }
                                // }

                                report_data = {
                                    Running: running_vehicles,
                                    Stopped: stopped_vehicles,
                                    InActive: inactive_vehicles,
                                    NoGps: no_gps_vehicles,
                                };
                            } else if (sub_type === 'customer') {
                                const new_customer = [];
                                const existing_customer = [];
                        
                                if (transporter) {
                                    const table = 'cv_dashboard_raw_transporter_data';
                                    const condition = { status: 1, transporter_id: { $in: transporter } };
                                    const getFields = { projection: { _id: 0 } };
                        
                                    let result_data;
                                    // try {
                                    //     result_data = await executeMongoQuery(table, condition, getFields);
                                    // } catch (error) {
                                    //     console.error('Error fetching customer data:', error);
                                    //     result_data = [];
                                    // }
                                    try {
                                        result_data = await getMongo.getCVMongoQuery(condition,getFields,table);                                
                                    } catch (error) {
                                        console.error("Error fetching data:", error);
                                        result_data = [];
                                    } 
                        
                                    if (result_data) {
                                        for (const value of result_data) {
                                            const customer_temp = {
                                                customer_name: value.name || '',
                                                customer_code: value.code || '',
                                                no_of_vehicle: value.no_of_vehicles || '',
                                                incrprtn_date: value.tp_create_date || '',
                                                rating: '4.3', // Static rating value
                                            };
                        
                                            if (value.client_type === 'new') {
                                                new_customer.push(customer_temp);
                                            } else if (value.client_type === 'existing') {
                                                existing_customer.push(customer_temp);
                                            }
                                        }
                                    }
                                }
                        
                                report_data = {
                                    New: new_customer,
                                    Existing: existing_customer,
                                };
                            } else if (sub_type === 'iot') {
                                const gps = [];
                                const elock = [];
                                const fuel_sensor = [];
                                
                                for (const value of final_data) {
                                    if ('vehicle_status' in value) {
                                        const vehicle_array = value.vehicle_status;
                                        const iot_array = value.iot_status;
                                        const gps_service_provider_array = value.vendor;
                        
                                        let vehicle_no = null;
                                        let status = null;
                                        let speed = null;
                                        let battery = null;
                                        let current_date = null;
                                        let last_halt = null;
                                        let ignition = null;
                                        let current_location = null;
                        
                                        if (vehicle_array) {
                                            for (const [key_vehicle, value_vehicle] of Object.entries(vehicle_array)) {
                                                vehicle_no = value_vehicle.vehicle_number;
                                                const lastdata = value_vehicle.last_data_current;
                                                if (lastdata) {
                                                    speed = lastdata.speed;
                                                    current_date = lastdata.device_time;
                                                    last_halt = lastdata.last_halt;
                                                }
                                            }
                                        }
                                        
                                        if (iot_array) {
                                            for (const [iot_key, iot_value] of Object.entries(iot_array)) {
                                                const iot = {
                                                    vehicle_no,
                                                    vehicle_status: value.v_status,
                                                    speed,
                                                    battery: `${value.battery_percent}`,
                                                    current_date,
                                                    last_halt,
                                                    ignition: value.ignition,
                                                    iot: iot_value,
                                                    current_location: value.location,
                                                    gps_service_provider: gps_service_provider_array[iot_key],
                                                    imei: iot_key,
                                                };
                                                // res.send(iot);
                                                if (iot_value === 'Gps') {
                                                    gps.push(iot);
                                                } else if (iot_value === 'Elock') {
                                                    elock.push(iot);
                                                } else if (iot_value === 'FuelSensor') {
                                                    fuel_sensor.push(iot);
                                                }
                                            }
                                        }
                                    }
                                }
                        
                                report_data = {
                                    Gps: gps,
                                    'E-Lock': elock,
                                    FuelSensor: fuel_sensor,
                                };
                            } else if (sub_type === 'vehicle_utilization') {
                                const utilized_vehicle = [];
                                const average_utilized_vehicle = [];
                                const under_utilized_vehicle = [];
                        
                                const table_UData = 'vehicle_utlization';

                                const lastMonth = dayjs().subtract(1, 'month');
                                const formatted_UPC = lastMonth.format('MMM-YYYY');
                                
                                // const condition_UPC = { status: 1, type_id: parseInt(trns_id), month_year:formatted_UPC};

                                const condition_UData = { status: 1, type_id: parseInt(transporter[0]), month_year:formatted_UPC };
                                const fields_UData = { projection: { _id: 0 } };
                                
                                let result_UData;
                                // try {
                                //     result_UData = await executeMongoQuery(table_UData, condition_UData, fields_UData);
                                // } catch (error) {
                                //     console.error('Error fetching vehicle utilization data:', error);
                                //     result_UData = [];
                                // }
                                try {
                                    result_UData = await getMongo.getBAMongoQuery(condition_UData, fields_UData, table_UData);
                                } catch (error) {
                                    console.error('Error fetching vehicle utilization data:', error);
                                    result_UData = [];
                                }
                                const GPS_S_P = {};
                                let transporter_name = null;
                        
                                for (const value of final_data) {
                                    transporter_name = value.code;
                                    const vehicle_id = value.vehicle_id;
                                    const gpsserviceprovider = value.vendor;
                                    let gps_service_provider = null;
                        
                                    if (gpsserviceprovider) {
                                        gps_service_provider = makeStringFromArray(gpsserviceprovider);
                                    }
                        
                                    GPS_S_P[vehicle_id] = gps_service_provider;
                                }
                        
                                if (result_UData) {
                                    for (const value_data of result_UData) {
                                        const vehicle_utilization = {};
                                        const vehicle_id = value_data.vehicle_id;
                                        const gps_ser_pro = GPS_S_P[vehicle_id] || '';
                        
                                        if (vehicle_id) {
                                            const table_trip = 'cv_transporter_trip_detail';
                                            const condition_trip = { status: 1, vehicle_id };
                                            let trips = null;
                        
                                            // try {
                                            //     trips = (await executeMongoQuery(table_trip, condition_trip, { projection: { _id: 0 } })).length;
                                            // } catch (error) {
                                            //     console.error('Error fetching trip data:', error);
                                            //     trips = 0;
                                            // }
                                            try {
                                                // trips = await getMongo.getCVMongoQueryCount(condition_trip, table_trip);
                                                trips = await getMongo.getCVMongoQuery(condition_trip, { projection: { _id: 0 } }, table_trip).length;
                                                
                                            } catch (error) {
                                                console.error('Error fetching trip data:', error);
                                                trips = 0;
                                            }
                        
                                            vehicle_utilization.vehicle_no = value_data.vehicle_number;
                                            vehicle_utilization.vehicle_status = value_data.utilization;
                                            vehicle_utilization.distance_travel = value_data.total_distance;
                                            vehicle_utilization.travel_duration = value_data.total_hrs;
                                            vehicle_utilization.trips = trips;
                                            vehicle_utilization.transporter = transporter_name;
                                            vehicle_utilization.gps_service_provider = gps_ser_pro;
                        
                                            if (value_data.utilization === 'Utilize') {
                                                utilized_vehicle.push(vehicle_utilization);
                                            } else if (value_data.utilization === 'Average Utilize') {
                                                average_utilized_vehicle.push(vehicle_utilization);
                                            } else if (value_data.utilization === 'Under Utilize') {
                                                under_utilized_vehicle.push(vehicle_utilization);
                                            }
                                        }
                                    }
                                }
                                
                                report_data = {
                                    Utilize: utilized_vehicle,
                                    'Average-Utilize': average_utilized_vehicle,
                                    'Under Utilize': under_utilized_vehicle,
                                };
                            }
                        }
                        // console.log(report_data);process.exit(0);
                        if(Object.keys(report_data).length > 0){
                            return res.status(200).json({ Status: 'Success', Message: 'Data Fetched Successfully', Data: report_data });
                        } else {
                            return res.status(400).json({ Status: 'Fail', Message: 'Data not available with these filters' });
                        } 
                    
                    } else {
                        // res.send(report_data);
                        // const input_data = JSON.parse(filter_data);
                        
                        let flag_of_date = 0;
                        let flag_of_customer = 0;
                        let flag_of_gpsvendor = 0;
                        let flag_of_agent = 0;
                    
                        let from_date = null;
                        let to_date = null;
                        let customer_id = null;
                        let gps_vendor = null;
                        let agent_id = null;
                    
                        if (input_data.from_date && input_data.to_date) {
                            from_date = input_data.from_date;
                            to_date = input_data.to_date;
                            flag_of_date = 1;
                        }
                    
                        if (input_data.customer_id) {
                            customer_id = input_data.customer_id;
                            flag_of_customer = 1;
                        }
                    
                        if (input_data.gps_vendor) {
                            gps_vendor = input_data.gps_vendor;
                            flag_of_gpsvendor = 1;
                        }
                    
                        if (input_data.agent_id) {
                            agent_id = input_data.agent_id;
                            flag_of_agent = 1;
                        }
                    
                        let final_data = [];
                        let result_data = [];
                        let result_data_UPC = [];
                        let transporter = '';
                        
                        if (user_type === 6) {
                            let CVCA_qry = '';
                            if (flag_of_date === 1) {
                                if (flag_of_agent === 0) {
                                    CVCA_qry = `SELECT type_detail, type_detail_id FROM cv_customer_assignment WHERE status=1 AND user_id=${user_id} AND DATE(create_date) BETWEEN '${from_date}' AND '${to_date}'`;
                                } else {
                                    CVCA_qry = `SELECT id, transporter_id FROM cv_transporter_assignment WHERE status=1 AND type_id=${agent_id} AND DATE(create_date) BETWEEN '${from_date}' AND '${to_date}'`;
                                }
                            } else if (flag_of_agent === 0) {
                                CVCA_qry = `SELECT type_detail, type_detail_id FROM cv_customer_assignment WHERE status=1 AND user_id=${user_id}`;
                            } else if (flag_of_date === 0 && flag_of_agent === 1) {
                                CVCA_qry = `SELECT id, transporter_id FROM cv_transporter_assignment WHERE status=1 AND type_id=${agent_id}`;
                            }
                            
                            const [CVCA_qry_data] = await db.promise().query(CVCA_qry);
                            
                            if (CVCA_qry_data.length > 0) {
                                let transporter_ids = flag_of_agent === 1 ? CVCA_qry_data.map(value => value.transporter_id) : CVCA_qry_data.map(value => value.type_detail_id);
                                transporter = transporter_ids.map(String);
                                
                                if (transporter.length > 0) {
                                    const table = "cv_dashboard_raw_vehicle_data";
                                    const condition = { status: 1, transporter_id: { $in: transporter } };
                                    const get_fields = { projection: { _id: 0 } };
                    
                                    try {
                                        // result_data = await getLocalMongoQuery(table, condition, get_fields);
                                        result_data = await getMongo.getCVMongoQuery(condition,get_fields,table);
                                        
                                    } catch (error) {
                                        result_data = `Error parsing JSON: ${error}`;
                                    }
                    
                                    if (result_data) {
                                        for (let val of result_data) {
                                            
                                            if (flag_of_customer === 1 && flag_of_gpsvendor === 1) {
                                                if (val.transporter_id === customer_id) {
                                                    let vender_arr = val.vendor;
                                                    if (vender_arr) {
                                                        for (let value of Object.values(vender_arr)) {
                                                            if (value === gps_vendor) {
                                                                final_data.push(val);
                                                            }
                                                        }
                                                    }
                                                }
                                            } else if (flag_of_customer === 1 && flag_of_gpsvendor === 0) {
                                                
                                                if (val.transporter_id === customer_id) {                                                    
                                                    final_data.push(val);
                                                }
                                            } else if (flag_of_customer === 0 && flag_of_gpsvendor === 1) {
                                                let vender_arr = val.vendor;
                                                if (vender_arr) {
                                                    for (let value of Object.values(vender_arr)) {
                                                        if (value === gps_vendor) {
                                                            final_data.push(val);
                                                        }
                                                    }
                                                }
                                            } else if (flag_of_customer === 0 && flag_of_gpsvendor === 0) {
                                                final_data = result_data;
                                            }
                                        }
                                    }
                                } else {
                                    return res.status(400).json({ Status: 'Fail', Message: 'Transporter id not available in CV Customer Assignment Table' });
                                }
                            }
                        } else if (user_type === 10) {
                            
                            // Query the logistic_role_assignment table
                            const LRA_qry = `SELECT * FROM logistic_role_assignment WHERE status=1 AND user_id = ${user_id}`;
                            const [LRA_qry_data] = await db.promise().query(LRA_qry);
                            
                            if (!LRA_qry_data || LRA_qry_data.length === 0) {
                                return res.status(400).json({ status: "fail", Message: "Transporter id not available in Logistic Role Assignment Table" });
                            }
                            
                            // Extract transporter IDs
                            const transporter_ids = LRA_qry_data.map(value => value.type_detail_id);
                            transporter = transporter_ids.map(String);
                            
                            if (transporter.length > 0) {
                                const table = "cv_dashboard_raw_vehicle_data";
                                let condition = { status: 1, transporter_id: { $in: transporter } };
                        
                                // Add date filter if flag_of_date is 1
                                if (flag_of_date === 1) {
                                    condition.vehicle_mapping_date = { $gte: from_date, $lte: to_date };
                                }
                                
                                const get_fields = { projection: { _id: 0 } };                                
                                
                                try {
                                    result_data = await getMongo.getCVMongoQuery(condition,get_fields,table);                                    
                                } catch (error) {
                                    result_data = `Error parsing JSON: ${error}`;
                                }
                                
                                // let result_data_UPC;
                                if (flag_of_date === 1) {
                                    const month_year = get_months_and_years_from_dates(from_date, to_date);                                    
                                    const condition_UPC = { status: 1, type_id: parseInt(transporter[0]), month_year: { $in: month_year } };
                                    const table_UPC = "vehicle_utlization";
                                    const fields_UPC = { projection: { _id: 0 } };
                                    
                                    try {
                                        result_data_UPC = await getMongo.getBAMongoQuery(condition_UPC, fields_UPC, table_UPC);
                                    } catch (error) {
                                        result_data_UPC = `Error parsing JSON: ${error}`;
                                    }
                                    // res.send(result_data_UPC);
                                } else {
                                    
                                    const lastMonth = dayjs().subtract(1, 'month');
                                    const formatted_UPC = lastMonth.format('MMM-YYYY');

                                    const condition_UPC = { status: 1, type_id: parseInt(transporter[0]), month_year:formatted_UPC };
                                    const table_UPC = "vehicle_utlization";
                                    const fields_UPC = { projection: { _id: 0 } };
                                    
                                    try {
                                        result_data_UPC = await getMongo.getBAMongoQuery(condition_UPC, fields_UPC, table_UPC);
                                    } catch (error) {
                                        result_data_UPC = `Error parsing JSON: ${error}`;
                                    }
                                }
                                // res.send(result_data_UPC);
                                // Filter final_data based on customer_id and gps_vendor
                                if (result_data) {
                                    for (const val of result_data) {
                                        if (flag_of_customer === 1 && flag_of_gpsvendor === 1) {
                                            if (val.transporter_id === customer_id) {
                                                const vender_arr = val.vendor;
                                                if (vender_arr) {
                                                    for (const value of Object.values(vender_arr)) {
                                                        if (value === gps_vendor) {
                                                            final_data.push(val);
                                                        }
                                                    }
                                                }
                                            }
                                        } else if (flag_of_customer === 1 && flag_of_gpsvendor === 0) {
                                            if (val.transporter_id === customer_id) {
                                                final_data.push(val);
                                            }
                                        } else if (flag_of_customer === 0 && flag_of_gpsvendor === 1) {
                                            const vender_arr = val.vendor;
                                            if (vender_arr) {
                                                for (const value of Object.values(vender_arr)) {
                                                    if (value === gps_vendor) {
                                                        final_data.push(val);
                                                    }
                                                }
                                            }
                                        } else if (flag_of_customer === 0 && flag_of_gpsvendor === 0) {
                                            final_data = result_data;
                                        }
                                    }
                                }
                            } else {
                                return res.status(400).json({ status: "fail", Message: "No transporter IDs found" });
                            }
                        } else if (user_type === 24) {
                            let CVCA_qry_data = {};
                            
                            // Query the logistic_role_assignment table
                            const LRA_qry = `SELECT type_detail_id FROM logistic_role_assignment WHERE status=1 AND user_type = 24 AND user_id = ${user_id}`;
                            const [LRA_qry_data] = await db.promise().query(LRA_qry);
                            
                            if (!LRA_qry_data || LRA_qry_data.length === 0) {
                                return res.status(400).json({ Status: "Fail", Message: "Transporter id not available in Logistic Role Assignment Table" });
                            }
                        
                            let transporter_ids = [];
                            // let transporter = [];
                        
                            for (const value of LRA_qry_data) {
                                const LRA_Agent_ids = value.type_detail_id;
                                
                                let CVTA_qry;
                                if (flag_of_date === 1) {
                                    CVTA_qry = `SELECT * FROM cv_transporter_assignment WHERE type_id = ${LRA_Agent_ids} AND status = 1 AND DATE(create_date) BETWEEN '${from_date}' AND '${to_date}'`;
                                } else {
                                    CVTA_qry = `SELECT * FROM cv_transporter_assignment WHERE type_id = ${LRA_Agent_ids} AND status = 1`;
                                }
                                
                                const [CVTA_qry_data] = await db.promise().query(CVTA_qry);
                        
                                if (!CVTA_qry_data || CVTA_qry_data.length === 0) {
                                    return res.status(400).json({ Status: "Fail", Message: "Transporter id not available in cv_transporter_assignment Table" });
                                }
                                
                                transporter_ids = CVTA_qry_data.map(value => value.transporter_id);
                                transporter = transporter_ids.map(String);
                            }
                            
                            if (transporter.length > 0) {
                                const table = "cv_dashboard_raw_vehicle_data";
                                const condition = { status: 1, transporter_id: { $in: transporter } };
                                const get_fields = { projection: { _id: 0 } };
                                
                                try {
                                    result_data = await getMongo.getCVMongoQuery(condition,get_fields,table);                                    
                                } catch (error) {
                                    result_data = `Error parsing JSON: ${error}`;
                                }
                                
                                if (result_data) {
                                    for (const val of result_data) {
                                        if (flag_of_customer === 1 && flag_of_gpsvendor === 1) {
                                            if (val.transporter_id === customer_id) {
                                                const vender_arr = val.vendor;
                                                if (vender_arr) {
                                                    for (const value of Object.values(vender_arr)) {
                                                        if (value === gps_vendor) {
                                                            final_data.push(val);
                                                        }
                                                    }
                                                }
                                            }
                                        } else if (flag_of_customer === 1 && flag_of_gpsvendor === 0) {
                                            if (val.transporter_id === customer_id) {
                                                final_data.push(val);
                                            }
                                        } else if (flag_of_customer === 0 && flag_of_gpsvendor === 1) {
                                            const vender_arr = val.vendor;
                                            if (vender_arr) {
                                                for (const value of Object.values(vender_arr)) {
                                                    if (value === gps_vendor) {
                                                        final_data.push(val);
                                                    }
                                                }
                                            }
                                        } else if (flag_of_customer === 0 && flag_of_gpsvendor === 0) {
                                            final_data = result_data;
                                        }
                                    }
                                }
                            } else {
                                return res.status(400).json({ Status: "Fail", Message: "No transporter IDs found" });
                            }
                        }
                        
                        if (sub_type === 'vehicle_status') {
                            const running_vehicles = [];
                            const stopped_vehicles = [];
                            const inactive_vehicles = [];
                            const no_gps_vehicles = [];
                            
                            for (const value of final_data) {
                                const vehicle_status = {};
                                let iot = null;
                                let gps_service_provider = null;
                    
                                if ('vehicle_status' in value) {
                                    const iotstatus = value.iot_status;
                                    if (iotstatus) {
                                        iot = makeStringFromArray(iotstatus);
                                    }
                                    
                                    const gpsserviceprovider = value.vendor;
                                    if (gpsserviceprovider) {
                                        gps_service_provider = makeStringFromArray(gpsserviceprovider);
                                    }
                    
                                    const vehicle_array = value.vehicle_status;
                                    let vehicle_no = null;
                                    let status = null;
                                    let speed = null;
                                    let battery = null;
                                    let current_date = null;
                                    let last_halt = null;
                                    let ignition = null;
                                    let current_location = null;
                    
                                    if (vehicle_array) {
                                        for (const [key_vehicle, value_vehicle] of Object.entries(vehicle_array)) {
                                            vehicle_no = value_vehicle.vehicle_number;
                                            status = key_vehicle;
                    
                                            const lastdata = value_vehicle.last_data_current;
                                            if (lastdata) {
                                                speed = lastdata.speed;
                                                current_date = lastdata.device_time;
                                                last_halt = lastdata.last_halt;
                                            }
                    
                                            battery = `${value.battery_percent}`;
                                            ignition = value.ignition;
                                            current_location = value.location;
                                        }
                                    }
                    
                                    vehicle_status.vehicle_no = vehicle_no;
                                    vehicle_status.vehicle_status = status;
                                    vehicle_status.speed = speed;
                                    vehicle_status.battery = battery;
                                    vehicle_status.current_date = current_date;
                                    vehicle_status.last_halt = last_halt;
                                    vehicle_status.ignition = ignition;
                                    vehicle_status.iot = iot;
                                    vehicle_status.current_location = current_location;
                                    vehicle_status.gps_service_provider = gps_service_provider;
                    
                                    if (status === 'Running') {
                                        running_vehicles.push(vehicle_status);
                                    } else if (status === 'Stopped') {
                                        stopped_vehicles.push(vehicle_status);
                                    } else if (status === 'InActive') {
                                        inactive_vehicles.push(vehicle_status);
                                    } else if (status === 'NoGps') {
                                        no_gps_vehicles.push(vehicle_status);
                                    }
                                }
                            }
                    
                            report_data = {
                                Running: running_vehicles,
                                Stopped: stopped_vehicles,
                                InActive: inactive_vehicles,
                                NoGps: no_gps_vehicles,
                            };
                        } else if (sub_type === 'customer') {
                            const new_customer = [];
                            const existing_customer = [];
                    
                            if (transporter) {
                                const table = 'cv_dashboard_raw_transporter_data';
                                const condition = { status: 1, transporter_id: { $in: transporter } };
                                const getFields = { projection: { _id: 0 } };                    
                                
                                try {
                                    result_data = await getMongo.getCVMongoQuery(condition,getFields,table);                                    
                                } catch (error) {
                                    result_data = `Error parsing JSON: ${error}`;
                                }
                    
                                if (result_data) {
                                    for (const value of result_data) {
                                        const customer_temp = {
                                            customer_name: value.name || '',
                                            customer_code: value.code || '',
                                            no_of_vehicle: value.no_of_vehicles || '',
                                            incrprtn_date: value.tp_create_date || '',
                                            rating: '4.3', // Static rating value
                                        };
                    
                                        if (value.client_type === 'new') {
                                            new_customer.push(customer_temp);
                                        } else if (value.client_type === 'existing') {
                                            existing_customer.push(customer_temp);
                                        }
                                    }
                                }
                            }
                    
                            report_data = {
                                New: new_customer,
                                Existing: existing_customer,
                            };
                        } else if (sub_type === 'iot') {
                            const gps = [];
                            const elock = [];
                            const fuel_sensor = [];
                    
                            for (const value of final_data) {
                                if ('vehicle_status' in value) {
                                    const vehicle_array = value.vehicle_status;
                                    const iot_array = value.iot_status;
                                    const gps_service_provider_array = value.vendor;
                    
                                    let vehicle_no = null;
                                    let status = null;
                                    let speed = null;
                                    let battery = null;
                                    let current_date = null;
                                    let last_halt = null;
                                    let ignition = null;
                                    let current_location = null;
                    
                                    if (vehicle_array) {
                                        for (const [key_vehicle, value_vehicle] of Object.entries(vehicle_array)) {
                                            vehicle_no = value_vehicle.vehicle_number;
                                            const lastdata = value_vehicle.last_data_current;
                                            if (lastdata) {
                                                speed = lastdata.speed;
                                                current_date = lastdata.device_time;
                                                last_halt = lastdata.last_halt;
                                            }
                                        }
                                    }
                    
                                    if (iot_array) {
                                        for (const [iot_key, iot_value] of Object.entries(iot_array)) {
                                            const iot = {
                                                vehicle_no,
                                                vehicle_status: value.v_status,
                                                speed,
                                                battery: `${value.battery_percent}`,
                                                current_date,
                                                last_halt,
                                                ignition: value.ignition,
                                                iot: iot_value,
                                                current_location: value.location,
                                                gps_service_provider: gps_service_provider_array[iot_key],
                                                imei: iot_key,
                                            };
                    
                                            if (iot_value === 'Gps') {
                                                gps.push(iot);
                                            } else if (iot_value === 'Elock') {
                                                elock.push(iot);
                                            } else if (iot_value === 'FuelSensor') {
                                                fuel_sensor.push(iot);
                                            }
                                        }
                                    }
                                }
                            }
                    
                            report_data = {
                                Gps: gps,
                                'E-Lock': elock,
                                FuelSensor: fuel_sensor,
                            };
                        } else if (sub_type === 'vehicle_utilization') {
                            const utilized_vehicle = [];
                            const average_utilized_vehicle = [];
                            const under_utilized_vehicle = [];
                            const vehicle_utilization = {};
                            
                            // const month_year = getLastFourMonthsYears();
                            const month_year = get_months_and_years_from_dates(from_date, to_date);
                            const table_UData = 'vehicle_utlization';
                            const condition_UData = { status: 1, type_id: parseInt(transporter[0]), month_year: { $in: month_year } };
                            const fields_UData = { projection: { _id: 0 } };
                            // res.send(condition_UData);
                            let result_UData;
                            // try {
                            //     result_UData = await executeMongoQuery(table_UData, condition_UData, fields_UData);
                            // } catch (error) {
                            //     console.error('Error fetching vehicle utilization data:', error);
                            //     result_UData = [];
                            // }
                            try {
                                result_UData = await getMongo.getBAMongoQuery(condition_UData, fields_UData, table_UData);
                            } catch (error) {
                                console.error('Error fetching vehicle utilization data:', error);
                                result_UData = [];
                            }
                            const GPS_S_P = {};
                            let transporter_name = null;
                            
                            for (const value of final_data) {
                                transporter_name = value.code;
                                const vehicle_id = value.vehicle_id;
                                const gpsserviceprovider = value.vendor;
                                let gps_service_provider = null;
                    
                                if (gpsserviceprovider) {
                                    gps_service_provider = makeStringFromArray(gpsserviceprovider);
                                }
                    
                                GPS_S_P[vehicle_id] = gps_service_provider;
                            }
                            
                            if (result_UData) {
                                for (const value_data of result_UData) {
                                    const vehicle_utilization = {};
                                    const vehicle_id = value_data.vehicle_id;
                                    const gps_ser_pro = GPS_S_P[vehicle_id] || '';
                    
                                    if (vehicle_id) {
                                        const table_trip = 'cv_transporter_trip_detail';
                                        const condition_trip = { status: 1, vehicle_id };
                                        
                                        let trips = null;                                        
                                        let totalTrips = 0;
                                        
                                        try {
                                            // trips = await getMongo.getCVMongoQueryCount(condition_trip, table_trip);
                                            trips = await getMongo.getCVMongoQuery(condition_trip, { projection: { _id: 0 } }, table_trip).length;
                                            
                                        } catch (error) {
                                            console.error('Error fetching trip data:', error);
                                            trips = 0;
                                        }
                                        
                                        if(trips){
                                            totalTrips = trips;
                                        }else{
                                            totalTrips = 0;
                                        }
                                        
                                        vehicle_utilization.vehicle_no = value_data.vehicle_number;
                                        vehicle_utilization.vehicle_status = value_data.utilization;
                                        vehicle_utilization.distance_travel = value_data.total_distance;
                                        vehicle_utilization.travel_duration = value_data.total_hrs;
                                        vehicle_utilization.trips = totalTrips;
                                        vehicle_utilization.transporter = transporter_name;
                                        vehicle_utilization.gps_service_provider = gps_ser_pro;
                                        
                                        if (value_data.utilization === 'Utilize') {
                                            utilized_vehicle.push(vehicle_utilization);
                                        } else if (value_data.utilization === 'Average Utilize') {
                                            average_utilized_vehicle.push(vehicle_utilization);
                                        } else if (value_data.utilization === 'Under Utilize') {                                            
                                            under_utilized_vehicle.push(vehicle_utilization);
                                            // res.send(under_utilized_vehicle);
                                        }
                                    }
                                }
                            }
                            
                            report_data = {
                                'Utilize': utilized_vehicle,
                                'Average-Utilize': average_utilized_vehicle,
                                'Under Utilize': under_utilized_vehicle,
                            };
                            // res.send(report_data);
                        }
                        
                        // console.log(report_data);process.exit(0);
                        // console.log('sub_type');process.exit(0);
                        
                        
                        if(Object.keys(report_data).length > 0){
                            return res.status(200).json({ Status: 'Success', Message: 'Data Fetched Successfully', Data: report_data });
                        } else {
                            return res.status(400).json({ Status: 'Fail', Message: 'Data not available with these filters' });
                        }
                        
                    } 
                        
                }else{
                    return res.status(501).json("Invalid Access"); // Send response and stop further execution
                }   
            }              
            
        } else {
            return res.status(501).json("payload missing"); // Send response and stop further execution
        }

    } catch (error) {
        console.error("Error in consolidatedDashboard:", error);
        return res.status(500).json({ error: error.message }); // Send response and stop further execution
    }
};
////////////////////////////// Functions ////////////////////////////

function get_month_year_from_date(date) {
    // Parse the date string using moment.js
    const parsed_date = moment(date);

    // Format the month and year as "MMM-YYYY" (e.g., "Jan-2023")
    const formatted_date = parsed_date.format('MMM-YYYY');

    return formatted_date;
}

function get_months_and_years_from_dates1(from_date, to_date, date_format = "YYYY-MM-DD") {
    // Parse the start and end dates using moment.js
    const start_date = moment(from_date, date_format);
    const end_date = moment(to_date, date_format);

    // List to hold formatted month-year strings
    const months_years = [];

    // Iterate over each month from start_date to end_date
    let current_date = start_date.clone();
    while (current_date.isSameOrBefore(end_date, 'month')) {
        // Format as "Month-YYYY" (e.g., "Jan-2023")
        const month_name = current_date.format('MMM'); // Abbreviated month name (e.g., "Jan")
        const year = current_date.format('YYYY'); // Full year (e.g., "2023")
        months_years.push(`${month_name}-${year}`);

        // Move to the next month
        current_date.add(1, 'month');
    }

    return months_years;
}

function get_months_and_years_from_dates(from_date, to_date, date_format = "YYYY-MM-DD") {
    const start_date = moment(from_date, date_format);
    const end_date = moment(to_date, date_format);
    
    // If invalid dates, return empty array
    if (!start_date.isValid() || !end_date.isValid()) return [];

    // List to hold formatted month-year strings
    const months_years = [];

    let current_date = start_date.clone();

    while (current_date.isSameOrBefore(end_date, 'month')) {
        const month_name = current_date.format('MMM');
        const year = current_date.format('YYYY');
        months_years.push(`${month_name}-${year}`);
        current_date.add(1, 'month');
    }

    return months_years;
}

function getLastFourMonthsYears() {
    const today = new Date(); // Get the current date
    const lastFourMonthsYears = [];

    // Iterate to get the last four months
    for (let i = 0; i < 4; i++) {
        const monthDate = new Date(today); // Create a copy of the current date
        monthDate.setMonth(today.getMonth() - (i + 1)); // Subtract (i + 1) months

        // Format the month and year
        const month = monthDate.toLocaleString('default', { month: 'short' }); // Get short month name (e.g., Oct)
        const year = monthDate.getFullYear(); // Get the full year (e.g., 2023)
        const formattedDate = `${month}-${year}`; // Combine into the desired format

        lastFourMonthsYears.push(formattedDate); // Add to the list
    }

    return lastFourMonthsYears.reverse(); // Reverse the list to have the most recent month first
}

function makeStringFromArray(arr_data) {
    let string_data = '';
    for (const [iot_key, iot_value] of Object.entries(arr_data)) {
        string_data += iot_value + ',';
    }
    if (string_data) {
        string_data = string_data.slice(0, -1); // Remove the last comma
    }
    return string_data;
}


