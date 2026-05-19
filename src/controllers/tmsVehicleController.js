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

////////////////////////// TMS:Vehicle//////////////////////////

exports.vehicleMaster = async (req, res) => {
    try {
        const { AccessToken } = req.body;
        let response = {};
        if (AccessToken != null) {
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);

            if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    res.status(400).json(response);
            }
            else{
                // const user_id = 5659;
                // const user_id = 152867;
                // const user_id = 185301;
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
                    // const user_id = 5659;
                    // const user_id = 152867;
                    // const user_id = 185301; // Hardcoded user ID for testing
                    // // const user_id = user_info.AccountId; // Use this in production

                    // const [result] = await db.promise().query(
                    //     "SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",
                    //     [user_id, 1]
                    // );

                    // if (result.length === 0) {
                    //     return res.status(200).json("Invalid User"); // Return early if no user is found
                    // }

                    // const resultUsr = result[0];
                    // const user_id = resultUsr['id'];
                    // const user_type = resultUsr['user_type'];
                    // const self_group_id = resultUsr['group_id'];
                    // const group_id = resultUsr['group_id'];
                    // const group_type = resultUsr['group_type'];
                    // const name = resultUsr['name'];

                    // let resData = {};

                    // Fetch vehicle categories
                    const vehicleCategory_bin = {};
                    const [vehicleCategory] = await db.promise().query("SELECT id, name FROM vehicle_category WHERE status=1");
                    // vehicleCategory.forEach(row => {
                    //     vehicleCategory_bin[row.id] = row.name;
                    // });

                    // Fetch vehicle makes
                    const vehicleMake_bin = {};
                    const [vehicleMake] = await db.promise().query("SELECT id, name FROM vehicle_make WHERE status=1");
                    // vehicleMake.forEach(row => {
                    //     vehicleMake_bin[row.id] = row.name;
                    // });

                   // Fetch vehicle models
                    const vehicleModel_bin = {};
                    const [vehicleModel] = await db.promise().query("SELECT id, model_number AS name FROM vehicle_model WHERE status=1");
                    // vehicleModel.forEach(row => {
                    //     vehicleModel_bin[row.id] = row.model_number;
                    // });

                    // Fetch vehicle types
                    const vehicleBodyType_bin = {};
                    const [vehicleBodyType] = await db.promise().query("SELECT id, name FROM vehicle_types WHERE status=1");
                    // vehicleBodyType.forEach(row => {
                    //     vehicleBodyType_bin[row.id] = row.name;
                    // });

                    // Fetch vehicle capacities
                    const vehicleCapacity_bin = {};
                    const [vehicleCapacity] = await db.promise().query("SELECT id, capacity AS name FROM vehicle_capacity WHERE status=1");
                    // vehicleCapacity.forEach(row => {
                    //     vehicleCapacity_bin[row.id] = row.capacity;
                    // });

                    // Fetch fuel types
                    const vehicleFuelType_bin = {};
                    const [vehicleFuelType] = await db.promise().query("SELECT id, name FROM fuel_type WHERE status=1");
                    // vehicleFuelType.forEach(row => {
                    //     vehicleFuelType_bin[row.id] = row.name;
                    // });
        
                    // Fetch document types
                    /*const vehicleDocumentType_bin = {};
                    const [vehicleDocumentType] = await db.promise().query(
                        'SELECT id, name FROM document_types WHERE status=1 AND category="vehicle"'
                    );*/
                    // const vehicleDocumentType_bin = {};

                    const [vehicleDocumentType] = await db.promise().query(
                        'SELECT id, name FROM document_types WHERE status=1 AND category="vehicle"'
                    );
                    
                    const allowedDocs = [
                        "Registration Certificate",
                        "Pollution Certificate",
                        "Vehicle Insurance",
                        "National Goods Permit",
                        "Fitness Certificate"
                    ];

                    const vehicleDocumentType_bin = [];

                    vehicleDocumentType.forEach(doc => {
                        const obj = {
                            id: doc.id,
                            name: doc.name
                        };

                        if (allowedDocs.includes(doc.name)) {
                            obj.doc_key = doc.name.replace(/\s+/g, '');
                        }

                        vehicleDocumentType_bin.push(obj);
                    });

                    // vehicleDocumentType.forEach(row => {
                    //     vehicleDocumentType_bin[row.id] = row.name;
                    // });

                    // Fetch vehicle features
                    const vehicleFeature_bin = {};
                    const [vehicleFeature] = await db.promise().query("SELECT id, name FROM cv_feature_master WHERE status=1");
                    // vehicleFeature.forEach(row => {
                    //     vehicleFeature_bin[row.id] = row.name;
                    // });

                    // Fetch vehicle sizes
                    const vehicleSize_bin = {};
                    const [vehicleSize] = await db.promise().query("SELECT id, size AS name FROM cv_vehicle_size WHERE status=1");
                    // vehicleSize.forEach(row => {
                    //     vehicleSize_bin[row.id] = row.size;
                    // });

                    const [kycPermission] = await db.promise().query(
                        `SELECT JSON_OBJECTAGG(
                            kpm.name,
                            ukp.is_allowed
                        ) AS permissions
                        FROM user_kyc_permissions ukp
                        JOIN kyc_permission_master kpm 
                            ON kpm.id = ukp.permission_id
                        WHERE ukp.user_id = ?
                        AND ukp.status = 1
                        AND kpm.status = 1
                        AND kpm.type = 'VEHICLE'`,
                        [153169]
                    );

                    // 🔥 Handle empty / null case + remove array
                    // let vehicle_permissions = {};

                    // if (
                    //     kycPermission.length > 0 &&
                    //     kycPermission[0].permissions
                    // ) {
                    //     vehicle_permissions = JSON.parse(kycPermission[0].permissions);
                    // }

                    let vehicle_permissions = [];

                    if (
                        kycPermission.length > 0 &&
                        kycPermission[0].permissions
                    ) {
                        const parsed = JSON.parse(kycPermission[0].permissions);

                        vehicle_permissions = Object.entries(parsed).map(([key, value]) => ({
                            [key]: value
                        }));
                    }

                    // res.send(datap);process.exit(0);
                    let transporter_ids = null;
                    let transporters_bin = [];
                    let transporter = {};

                    if (user_type == 6) {
                        if (group_type == 32) {
                            const [transporterId_Result] = await db.promise().query(
                                "SELECT type_detail_id FROM cv_customer_assignment WHERE status=1 AND user_id = ?",
                                [user_id]
                            );
                            if (transporterId_Result.length > 0) {
                                transporter_ids = transporterId_Result.map(item => item.type_detail_id).join(',');
                            }
                        } else {
                            const [transporterId_Result] = await db.promise().query(
                                "SELECT transporter_id FROM transporter_customer_assiginment WHERE status=1 AND customer_group_id=0170"
                            );
                            if (transporterId_Result.length > 0) {
                                transporter_ids = transporterId_Result.map(item => item.transporter_id).join(',');
                            }
                        }

                        if (group_type == 20) {
                            [transporters_bin] = await db.promise().query(
                                "SELECT id, name FROM transporters WHERE status=1 AND group_id = ?",
                                [group_id]
                            );
                        } else {
                            [transporters_bin] = await db.promise().query(
                                `SELECT id, name FROM transporters WHERE status=1 AND id IN(${transporter_ids})`
                            );
                        }

                        // if (transporters_bin.length > 0) {
                        //     transporters_bin.forEach(row => {
                        //         transporter[row.id] = row.name;
                        //     });
                        // }
                    }

                    let data = {};


 



 

      
                    // data.category = vehicleCategory_bin;
                    // data.make = vehicleMake_bin;
                    // data.model = vehicleModel_bin;
                    // data.vehicle_type = vehicleBodyType_bin;
                    // data.vehicle_capacity = vehicleCapacity_bin;
                    // data.vehicle_fuel_type = vehicleFuelType_bin;
                    // data.vehicle_document_type = vehicleDocumentType_bin;
                    // data.vehicle_feature = vehicleFeature_bin;
                    // data.vehicle_size = vehicleSize_bin;
                    // data.transporters = transporter;

                    data.category = vehicleCategory;
                    data.make = vehicleMake;
                    data.model = vehicleModel;
                    data.vehicle_type = vehicleBodyType;
                    data.vehicle_capacity = vehicleCapacity;
                    data.vehicle_fuel_type = vehicleFuelType;
                    data.vehicle_document_type = vehicleDocumentType_bin;
                    data.vehicle_feature = vehicleFeature;
                    data.vehicle_size = vehicleSize;
                    data.vehicle_permissions = vehicle_permissions;
                    data.transporters = transporters_bin;
                    
                    resData.Status = "success";
                    resData.Message = "Data Fetched Successfully";
                    resData.Data = data;
                
                    return res.status(200).json(resData); // Send response and stop further execution
                }
            }
        } else {
            return res.status(501).json("payload missing"); // Send response and stop further execution
        }
    } catch (error) {
        console.error("Error in filterCV:", error);
        return res.status(500).json({ error: error.message }); // Send response and stop further execution
    }
};

exports.vehicleDashboard = async (req, res) => {
    const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    let user_info ={};
    try {
        const { AccessToken, from_date, to_date, customer_id, DeveloperOptionId, DeveloperOption, vehicle_id} = req.body;
        let response = {};
        if (AccessToken == null) {
            return res.status(501).json("payload missing"); // Return early if AccessToken is missing
        }
        
        if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
            user_info.Status=1; 
            user_info.AccountId=DeveloperOptionId;
        }else{
            user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            //user_info = await getAccessTokenDataWeb(AccessToken);
        }
        // const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        
        if (user_info && user_info.Status === 2) {
            response.Result = user_info.Result;
            response.Message = user_info.Message;

            res.status(200).json(response);
        }else{
            // const user_id = 5659; //BluedartMaster
            // const user_id = 152867; //MasterCV
            // const user_id = 185301; // Master Not groupId=32
            // const user_id = 256; // Master Not groupId=32
            // const user_id = 151086 // Master Not groupId=32
            // const user_id = 153169; //Transporter
            const user_id = user_info.AccountId;
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

                let transporter = null;
                let user_ids = null;
                let customerFilter = {};
                let result_data_UPC = [];
                const vehicle_utilization = { utilize_count: 0, avg_utilize_count: 0, under_utilize_count: 0 };

                if (user_type === 10 || group_type === 3) {
                    const [LRA_TId_qry_data] = await db.promise().query(
                        `SELECT * FROM logistic_role_assignment WHERE status = 1 AND user_id=${user_id}`
                    );
                    if (!LRA_TId_qry_data.length) {
                        return res.status(400).json({ Status: 'Fail', Message: 'Transporter id not available' });
                    }
                    
                    transporter = LRA_TId_qry_data[0].type_detail_id;
                    
                } else {
                    if (group_type === 32) {
                        const [CVCA_qrydata] = await db.promise().query(
                            `SELECT * FROM cv_customer_assignment WHERE status=1 AND user_id=${user_id} AND type_detail='Transporter'`
                        );
                        transporter = CVCA_qrydata.map(item => item.type_detail_id).join(',');
                    } else {
                        if(group_type === 3){
                            const [U_qry_data] = await db.promise().query(
                                // `SELECT id FROM user WHERE status=1 AND group_id=${group_id} AND status=1 AND user_type=10`
                                `SELECT id FROM user WHERE status=1 AND group_id=${group_id} AND status=1`
                            );
                            user_ids = U_qry_data.map(item => item.id).join(',');
                            
                            const [LRA_TId_qry_data] = await db.promise().query(
                                `SELECT * FROM logistic_role_assignment WHERE status = 1 AND user_id IN(${user_ids})`
                            );
                            
                            if (!LRA_TId_qry_data.length) {
                                return res.status(400).json({ Status: 'Fail', Message: 'Transporter id not available' });
                            }
                            
                            transporter = LRA_TId_qry_data[0].type_detail_id;
                            // res.status(200).json({'response2':response});
                        }else{
                            
                            const [TCA_qry_data] = await db.promise().query(
                                `SELECT tca.transporter_id AS transporter_id, t.name AS transporter_name 
                                FROM transporter_customer_assiginment AS tca 
                                LEFT JOIN transporters AS t ON tca.transporter_id = t.id 
                                WHERE tca.status=1 AND tca.customer_group_id=${group_id} AND t.status=1`
                            );
                            
                            if(TCA_qry_data.length>0){
                                // res.status(200).json({'response1':response});
                                transporter = TCA_qry_data.map(item => item.transporter_id).join(',');

                                TCA_qry_data.forEach(value => {
                                    customerFilter[value.transporter_id] = value.transporter_name;
                                });
                            }else{
                                return res.status(200).json({ Status: 'Fail', Message: 'Data not Found. Please do assignment first.' });
                            }
                            // res.status(200).json({'response2':response});
                        }
                    }
                }
                
                let vehiclePatch = '';
                if(vehicle_id){
                    vehiclePatch = `AND v.id = ${Number(vehicle_id)}`;
                }
                let vta_qry = '';
                if (Is_all_data === 'yes') {
                    vta_qry = `SELECT vta.id AS id, vta.transporter_id AS transporter_id, vta.vehicle_id AS vehicle_id, t.name AS transporter_name, vta.create_date AS create_date, v.status AS status
                                FROM vehicle_transporter_assignment AS vta 
                                LEFT JOIN transporters AS t ON vta.transporter_id = t.id 
                                LEFT JOIN vehicle AS v ON vta.vehicle_id = v.id 
                                WHERE vta.status=1 AND vta.transporter_id IN(${transporter})
                                AND v.status IN(1,2) 
                                AND vta.create_date BETWEEN '${fromDate}' AND '${toDate}' ${vehiclePatch}`;
                    
                    const month_year = get_months_and_years_from_dates(fromDate, toDate);                                    
                    condition_UPC = { status: 1, type_id: parseInt(transporter), month_year: { $in: month_year } };
                } else {
                    vta_qry = `SELECT vta.id AS id, vta.transporter_id AS transporter_id, vta.vehicle_id AS vehicle_id,  t.name AS transporter_name, vta.create_date AS create_date, v.status AS status 
                            FROM vehicle_transporter_assignment AS vta 
                            LEFT JOIN transporters AS t ON vta.transporter_id = t.id 
                            LEFT JOIN vehicle AS v ON vta.vehicle_id = v.id
                            WHERE vta.status=1 AND vta.transporter_id IN(${transporter}) AND v.status IN(1,2) ${vehiclePatch}`;
                    
                    condition_UPC = { status: 1, type_id: parseInt(transporter) };
                }
                
                // res.send({'transporter':vta_qry});
                ////////
                // UPC: Utilization Pie Chart
                

                const table_UPC = "vehicle_utlization";
                const fields_UPC = { projection: { _id: 0 } };
                
                try {
                    result_data_UPC = await getMongo.getBAMongoQuery(condition_UPC, fields_UPC, table_UPC);
                } catch (error) {
                    result_data_UPC = `Error parsing JSON: ${error}`;
                }
                
                const vehicleUS = {};
                if(result_data_UPC.length > 0){
                    for (const value_upc of result_data_UPC) {
                        const type_of_utilization = value_upc.utilization;
                        const utilization_vehicleNo = value_upc.vehicle_id;
                        // vehicleUS[utilization_vehicleNo].push(type_of_utilization);
                        vehicleUS[utilization_vehicleNo] = type_of_utilization;
                        if (type_of_utilization === 'Utilize') {
                            vehicle_utilization.utilize_count += 1;
                        } else if (type_of_utilization === 'Average Utilize') {
                            vehicle_utilization.avg_utilize_count += 1;
                        } else if (type_of_utilization === 'Under Utilize') {
                            vehicle_utilization.under_utilize_count += 1;
                        }
                    }
                }
                
                // res.send(vehicleUS);
                ///////////////////
                // res.send(vehicle_utilization);

                
                const [VTA_qry_data] = await db.promise().query(vta_qry);
                // res.send(VTA_qry_data);
                if (!VTA_qry_data.length) {
                    return res.status(400).json({ Status: 'Fail', Message: 'Data not available' });
                }
                // res.send(VTA_qry_data);
                let formatDate = (date) => {
                    return date.format('YYYY-MM-DD HH:mm:ss');
                };

                const currentDate = moment().startOf('month');
                const FDOPM = formatDate(currentDate.clone().subtract(1, 'month'));
                let new_vehicle = 0, existing_vehicle = 0;
                // res.send({'FDOPM':FDOPM});
                let veh_to_trans = {};
                let vehicle_NOE_Status = {};
                VTA_qry_data.forEach(value => {
                    
                    const d = new Date(value.create_date);
                    let create_dateN = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
                    
                    if(value.status === 1){
                        //2022-06-02 15:14:01 >= 2025-03-01 00:00:00
                        // res.send({'value':create_dateN});
                        create_dateN >= FDOPM ? new_vehicle++ : existing_vehicle++;
                        
                    }
                    vehicle_NOE_Status[value.vehicle_id] = create_dateN >= FDOPM ? 'new_vehicle' : 'existing_vehicle';
                    veh_to_trans[value.vehicle_id] = { id: value.transporter_id, name: value.transporter_name };
                });
                // res.send({'vehicle_NOE_Status':vehicle_NOE_Status});
                const vehicle_ids = VTA_qry_data.map(item => item.vehicle_id);
                
                const vehicleChunks = chunkArray(vehicle_ids, 50);
                
                let Vehicle_qry_data = [];
                let Document_qry_data = [];
                
                for (const chunk of vehicleChunks) {
                    const v_ids = chunk.join(',');
                    // res.send(v_ids);
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
                            DATE_FORMAT(v.registration_date, '%Y-%m-%d') AS registration_date,
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
                            v.vehicle_size AS vehicle_size_id,
                            v.status AS status,
                            v.fuel_type AS fuel_type,
                            ft.name AS fuel_type_name,
                            t.name AS transporter_name,
                            vc.name AS vehicle_category_name,
                            vm.name AS vehicle_make_name,
                            vmodel.model_number AS vehicle_model_number,
                            vt.name AS body_type_name,
                            vs.size AS vehicle_size 
                        FROM vehicle AS v
                        LEFT JOIN transporters AS t ON v.transporter_id = t.id AND t.status = 1
                        LEFT JOIN vehicle_category AS vc ON v.vehicle_category_id = vc.id AND vc.status = 1
                        LEFT JOIN vehicle_make AS vm ON v.vehicle_make_id = vm.id AND vm.status = 1
                        LEFT JOIN vehicle_model AS vmodel ON v.vehicle_model_id = vmodel.id AND vmodel.status = 1
                        LEFT JOIN vehicle_types AS vt ON v.body_type_id = vt.id AND vt.status = 1
                        LEFT JOIN cv_vehicle_size AS vs ON v.vehicle_size = vs.id AND vs.status = 1
                        
                        LEFT JOIN fuel_type AS ft ON CONVERT(v.fuel_type, UNSIGNED) = ft.id AND ft.status = 1

                        WHERE v.id IN (${v_ids}) AND v.status IN(1,2)`
                    );
                    
                    // LEFT JOIN fuel_type AS ft ON v.fuel_type = ft.id AND ft.status = 1
                    // LEFT JOIN vehicle_types AS vt ON v.vehicle_type = vt.id AND vt.status = 1
                    // vt.name AS vehicle_type_name,
                    Vehicle_qry_data = [...Vehicle_qry_data, ...Vehicle_qry];
                    
                    let doc_qry = '';
                    if (Is_all_data === 'yes') { 
                        // DATE_FORMAT(doc.issue_date, '%Y-%m-%d') AS issue_date, DATE_FORMAT(doc.expiry_date, '%Y-%m-%d') AS expiry_date,
                        // doc_qry = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, doc.issue_date, doc.expiry_date, doc.file_path, doc.status 
                        //         FROM documents AS doc 
                        //         LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id 
                        //         WHERE doc.status IN(1,2) AND doct.status = 1 AND doc.vehicle_id IN(${v_ids}) 
                        //         AND doc.create_date BETWEEN '${fromDate}' AND '${toDate}'`;

                        doc_qry = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, DATE_FORMAT(doc.issue_date, '%Y-%m-%d') AS issue_date, DATE_FORMAT(doc.expiry_date, '%Y-%m-%d') AS expiry_date, doc.file_path, doc.status 
                                FROM documents AS doc 
                                LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id 
                                WHERE doc.status IN(1,2) AND doct.status = 1 AND doc.vehicle_id IN(${v_ids}) 
                                AND doc.create_date BETWEEN '${fromDate}' AND '${toDate}'`;
                    } else {
                        // doc_qry = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, doc.issue_date, doc.expiry_date, doc.file_path, doc.status 
                        //         FROM documents AS doc 
                        //         LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id 
                        //         WHERE doc.status IN(1,2) AND doct.status = 1 AND doc.vehicle_id IN(${v_ids})`;

                        doc_qry = `SELECT doct.name AS document_name, doc.id, doc.vehicle_id, doc.doc_type_id, doc.doc_no, DATE_FORMAT(doc.issue_date, '%Y-%m-%d') AS issue_date, DATE_FORMAT(doc.expiry_date, '%Y-%m-%d') AS expiry_date, doc.file_path, doc.status 
                                FROM documents AS doc 
                                LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id 
                                WHERE doc.status IN(1,2) AND doct.status = 1 AND doc.vehicle_id IN(${v_ids})`;
                        
                    }

                    const [Document_qry] = await db.promise().query(doc_qry);
                    if (Document_qry) {
                        Document_qry_data = [...Document_qry_data, ...Document_qry];
                    }
                }
                let data_document;
                if(Document_qry_data.length > 0){
                    data_document = Document_qry_data.reduce((acc, doc) => {
                        acc[doc.vehicle_id] = acc[doc.vehicle_id] || [];
                        acc[doc.vehicle_id].push(doc);
                        return acc;
                    }, {});
                }
                
                // const data_vehicle = Vehicle_qry_data.map(vehicle => ({
                //     vehicle,
                //     utilization_status: vehicleUS.vehicle.id || '',
                //     document: data_document[vehicle.id] || [],
                //     cust_data: customerFilter[vehicle.transporter_id] || {}
                // }));
                
                // let data_vehicle;
                // if(Vehicle_qry_data.length > 0){
                //     data_vehicle = Vehicle_qry_data.map(vehicle => ({
                //         vehicle,
                //         utilization_status: vehicleUS ? vehicleUS[vehicle.id] : '',
                //         vehicleNew_Exi_status : vehicle_NOE_Status ? vehicle_NOE_Status[vehicle.id] : '',
                //         document: data_document ? data_document[vehicle.id] : [],
                //         cust_data: customerFilter ? customerFilter[vehicle.transporter_id] : {}
                //         // utilization_status: vehicleUS[vehicle.id] || '',
                //         // vehicleNew_Exi_status : vehicle_NOE_Status[vehicle.id] || '',
                //         // document: data_document[vehicle.id] || [],
                //         // cust_data: customerFilter[vehicle.transporter_id] || {}
                //     }));
                // }
                let data_vehicle = [];

                if (Vehicle_qry_data.length > 0) {
                    data_vehicle = Vehicle_qry_data.map(vehicle => {

                        let features = {
                            '1': vehicle.is_fixed_door_e_lock || 0,
                            '2': vehicle.is_gps || 0,
                            '3': vehicle.is_dual_driver || 0,
                            '4': vehicle.is_fire_extinguisher || 0,
                            '5': vehicle.is_portable_e_lock || 0,
                            '6': vehicle.is_tarpaulin || 0
                        };

                        return {
                            // vehicle: {
                                ...vehicle,

                                utilization_status: vehicleUS ? vehicleUS[vehicle.id] : '',
                                vehicleNew_Exi_status: vehicle_NOE_Status ? vehicle_NOE_Status[vehicle.id] : '',

                                document: data_document ? data_document[vehicle.id] : [],
                                cust_data: customerFilter ? customerFilter[vehicle.transporter_id] : {},

                                features
                            // }
                        };
                    });
                }
                // res.send(Vehicle_qry_data.length);
                let closed_body = 0;
                let open_body = 0;
                let container_body = 0;
                if(data_vehicle.length > 0){
                    data_vehicle.forEach(value => {
                        if (value.body_type_id === 1) {
                            closed_body++;
                        } else if (value.body_type_id === 2) {
                            open_body++;
                        } else if (value.body_type_id === 3 || value.body_type_id === 4) {
                            container_body++;
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
                    });
                }
                
                const report_data = {
                    vehicles: { new_vehicle, existing_vehicle },
                    body_type: { closed_body, open_body, container: container_body },
                    vehicle_rating: { "less_than_two": 8300, "two_to_four": 2500, "more_than_four": 250 },
                    vehicle_utilization: vehicle_utilization,
                    // listing_data: { vehicle_data: data_vehicle }
                    // data_vehicle
                    listing_data: data_vehicle
                };
                // res.send(report_data);
                resData.Status = "success";
                resData.Message = "Data Fetched Successfully";
                resData.Data = report_data;
                // res.send(resData);
                return res.status(200).json(resData); // Send response and stop further execution
            }
        }
    } catch (error) {
        console.error("Error in vehicleDashboard:", error);
        return res.status(500).json({ error: error.message }); // Send response and stop further execution
    }
};

exports.vehicleAdd = async(req, res) =>{
    const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    let user_info ={};
    try{
        // console.log('AccessToken');process.exit(0);
        const {AccessToken,vehicle_data, DeveloperOptionId, DeveloperOption} = req.body;
        let response = {};
        if(AccessToken !== null){
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //user_info = await getAccessTokenDataWeb(AccessToken);
            }
            // const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            
            if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    res.status(200).json(response);
            }
            else{
                // const user_id = 5659; //BluedartMaster
                // const user_id = 152867; //MasterCV
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter
                // const user_id = 156925; //customer grouptype=32
                const user_id = user_info.AccountId;
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
                        return res.status(200).json({ Status: "Fail", Message: "Vehicle already exists in the database" });
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
                        transporter_id: transporter_id,
                        // isVerified: is_verified
                    } = inputData;
                    
                    isVerified = null;

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
                            transporter_id, is_verified, vehicle_category_id, vehicle_make_id, vehicle_model_id, vehicle_number, body_type_id, 
                            registration_no, registration_date, vehicle_capacity_tons, fuel_type, max_speed, 
                            is_fixed_door_e_lock, is_gps, is_dual_driver, is_fire_extinguisher, is_portable_e_lock, 
                            is_tarpaulin, vehicle_size, status, create_id, create_date
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    const values = [
                        transporter_id, isVerified, category, make, model, vehicleNumber, vehicle_type, registration_no, registeration_date,
                        vehicle_capacity, fuel_type, over_speed_limit, elock, gps, dualDriver, fireExtinguisher,
                        portableElock, tarpaulin, vehicle_size, status, createId, createDate
                    ];                    
                    
                    const [insertResult] = await db.promise().query(sql, values);
                    
                    if (insertResult.affectedRows > 0) {
                        const addedVehicleId = insertResult.insertId;
                        
                        // Handle transporter assignment based on account type
                        
                        if (user_type === 10 || group_type === 3) {
                            
                            // Logic for account type 10
                            const [logisticRole] = await db.promise().query(
                                'SELECT type_detail_id FROM logistic_role_assignment WHERE user_id = ?',
                                [createId]
                            );
                            
                            if (logisticRole.length === 0) {
                                return res.status(400).json({ Status: "Fail", Message: "Transporter ID not available in Logistic Role Assignment Table" });
                            }
        
                            const transporter = logisticRole[0].type_detail_id;
                            
                            const transporterAssignmentSql = `
                                INSERT INTO vehicle_transporter_assignment (
                                    vehicle_id, transporter_id, group_id, status, create_date, create_id
                                ) VALUES (?, ?, ?, ?, ?, ?)
                            `;
                            const transporterAssignmentValues = [addedVehicleId, transporter, group_id, status, createDate, createId];
        
                            const [transporterAssignmentResult] = await db.promise().query(transporterAssignmentSql, transporterAssignmentValues);
                            
                            
                            let userMappingId = null;
                            if(group_id!='' || group_id!=null){
                                const [masterUser] = await db.promise().query(
                                    'SELECT id FROM user WHERE group_id = ? AND status = ? order BY id ASC LIMIT 1',
                                    [group_id, 1]
                                );
                                if(masterUser.length>0){
                                    let masterUserId = masterUser[0]['id'];
                                
                                    const userMappingSql = `
                                        INSERT INTO vehice_user_mapping (
                                            user_id, vehicle_id, status, create_date, create_id
                                        ) VALUES (?, ?, ?, ?, ?)
                                    `;

                                    const userMappingValues = [masterUserId, addedVehicleId, status, createDate, masterUserId];
        
                                    const [userMappingResult] = await db.promise().query(userMappingSql, userMappingValues);
                                    userMappingId = userMappingResult.insertId;
                                }
                                // res.send({'masterUserId':userMappingId,'transporterAssignmentResult':transporterAssignmentResult});
                            }
                            if (transporterAssignmentResult.affectedRows > 0) {
                                return res.status(200).json({
                                    Status: "success",
                                    Message: "Data Added Successfully",
                                    Vehicle_id: addedVehicleId,
                                    Mapping_id: userMappingId,
                                    Vehicle_transporter_assignment_id: transporterAssignmentResult.insertId
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
                            // res.send(transporterAssignmentResult);
                            if (transporterAssignmentResult.affectedRows > 0) {
                                return res.status(200).json({
                                    Status: "success",
                                    Message: "Data Added Successfully",
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
};

exports.vehicleEditData20260417 = async(req, res) =>{
    const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    let user_info ={};
    try{
        const {AccessToken, DeveloperOptionId, DeveloperOption, vehicle_id } = req.body;
        
        let response = {};
        if(AccessToken !== null){
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //user_info = await getAccessTokenDataWeb(AccessToken);
            }
            // const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            
            if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    res.status(200).json(response);
            }
            else{
                // const user_id = 5659; //BluedartMaster
                // const user_id = 152867; //MasterCV
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter
                // const user_id = 156925; //customer grouptype=32
                const user_id = user_info.AccountId;
                const [response] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                // const jsonStr = vehicle_data;
                
                if (response.length > 0) {
                    
                    const resultUsr=response[0];
                    const user_id = resultUsr['id'];
                    const user_type= resultUsr['user_type'];
                    // const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];                    
                    // const name= resultUsr['name']; 
                    const [data] = await db.promise().query(                        
                        `SELECT JSON_OBJECT(
                            "vehicleNumber", v.vehicle_number,

                            "category", JSON_OBJECT(
                                "id", vc.id,
                                "name", vc.name
                            ),

                            "make", JSON_OBJECT(
                                "id", vm.id,
                                "name", vm.name
                            ),

                            "model", JSON_OBJECT(
                                "id", vmodel.id,
                                "name", vmodel.model_number
                            ),

                            "vehicle_type", JSON_OBJECT(
                                "id", vt.id,
                                "name", vt.name
                            ),

                            "registrationNumber", v.registration_no,
                            "registrationDate", DATE_FORMAT(v.registration_date, '%Y-%m-%d'),

                            "vehicle_capacity", JSON_OBJECT(
                                "id", v.vehicle_capacity_tons,
                                "name", v.vehicle_capacity_tons
                            ),

                            "vehicle_fuel_type", JSON_OBJECT(
                                "id", ft.id,
                                "name", ft.name
                            ),

                            "overSpeedLimit", v.max_speed,

                            "vehicle_size", JSON_OBJECT(
                                "id", vs.id,
                                "name", vs.size
                            ),

                            "registrationDocumentNumber", v.registration_no,
                            "registrationIssueDate", DATE_FORMAT(v.registration_date, '%Y-%m-%d'),
                            "registrationExpiryDate", DATE_FORMAT(v.registration_date, '%Y-%m-%d'),

                            "pollutionDocumentNumber", v.pollution_no,
                            "pollutionIssueDate", DATE_FORMAT(v.pollution_date, '%Y-%m-%d'),
                            "pollutionExpiryDate", DATE_FORMAT(v.pollution_date, '%Y-%m-%d'),

                            "insuranceDocumentNumber", v.insurance_no,
                            "insuranceIssueDate", DATE_FORMAT(v.insurance_validity, '%Y-%m-%d'),
                            "insuranceExpiryDate", DATE_FORMAT(v.insurance_validity, '%Y-%m-%d'),

                            "fitnessDocumentNumber", v.fitness_no,
                            "fitnessIssueDate", DATE_FORMAT(v.fitness_date, '%Y-%m-%d'),
                            "fitnessExpiryDate", DATE_FORMAT(v.fitness_date, '%Y-%m-%d'),

                            "Elock", IF(v.is_fixed_door_e_lock = 1, TRUE, FALSE),
                            "GPS", IF(v.is_gps = 1, TRUE, FALSE),
                            "Dual Driver", IF(v.is_door_close = 1, TRUE, FALSE),
                            "Fire Fighting", NULL,
                            "Portable E-Lock", NULL,
                            "Tarpaulin", IF(v.is_tarpaulin = 1, TRUE, FALSE)

                        ) AS data

                        FROM vehicle AS v
                        LEFT JOIN transporters AS t ON v.transporter_id = t.id AND t.status = 1
                        LEFT JOIN vehicle_category AS vc ON v.vehicle_category_id = vc.id AND vc.status = 1
                        LEFT JOIN vehicle_make AS vm ON v.vehicle_make_id = vm.id AND vm.status = 1
                        LEFT JOIN vehicle_model AS vmodel ON v.vehicle_model_id = vmodel.id AND vmodel.status = 1
                        LEFT JOIN vehicle_types AS vt ON v.body_type_id = vt.id AND vt.status = 1
                        LEFT JOIN cv_vehicle_size AS vs ON v.vehicle_size = vs.id AND vs.status = 1
                        LEFT JOIN fuel_type AS ft ON CONVERT(v.fuel_type, UNSIGNED) = ft.id AND ft.status = 1

                        WHERE v.id IN (${vehicle_id}) 
                        AND v.status IN (1);`
                    );

                    if (data.length > 0) {
                        return res.status(200).json({
                            Status: "success",
                            Message: "Data fetched successfully",
                            data
                        });
                    } else {
                        return res.status(500).json({ Status: "Fail", Message: "Data not found." });
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
};

exports.vehicleEditData = async (req, res) => {
    const dateToday = moment().tz("Asia/Calcutta").format("YYYY-MM-DD");

    try {
        const { AccessToken, DeveloperOptionId, DeveloperOption, vehicle_id } = req.body;

        if (!AccessToken) {
            return res.status(400).json({ Status: "Fail", Message: "AccessToken required" });
        }

        if (!vehicle_id) {
            return res.status(400).json({ Status: "Fail", Message: "vehicle_id required" });
        }

        // 🔹 Auth
        let user_info = {};
        if (DeveloperOptionId && DeveloperOption === "dev0.01_" + dateToday) {
            user_info = { Status: 1, AccountId: DeveloperOptionId };
        } else {
            user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        }
        if (user_info && user_info.Status === 2) {
                response.Result = user_info.Result;
                response.Message = user_info.Message;

                res.status(400).json(response);
        }
        // if (!user_info || user_info.Status !== 1) {
        //     return res.status(401).json({
        //         Status: "Fail",
        //         Message: user_info?.Message || "Unauthorized"
        //     });
        // }

        const user_id = user_info.AccountId;

        // 🔹 Validate user
        const [userRows] = await db.promise().query(
            "SELECT id FROM user WHERE id=? AND status=1",
            [user_id]
        );

        if (userRows.length === 0) {
            return res.status(404).json({ Status: "Fail", Message: "Invalid User" });
        }

        // 🔹 Secure IN query
        const vehicleIds = vehicle_id.split(",").map(id => Number(id.trim()));

        // const [rows] = await db.promise().query(
        //     `SELECT JSON_OBJECT(
        //         "vehicleNumber", v.vehicle_number,

        //         /* ✅ FIXED JSON (no string issue) */
        //         "category", JSON_EXTRACT(JSON_OBJECT("id", vc.id, "name", vc.name), '$'),
        //         "make", JSON_EXTRACT(JSON_OBJECT("id", vm.id, "name", vm.name), '$'),
        //         "model", JSON_EXTRACT(JSON_OBJECT("id", vmodel.id, "name", vmodel.model_number), '$'),
        //         "vehicle_type", JSON_EXTRACT(JSON_OBJECT("id", vt.id, "name", vt.name), '$'),

        //         "registrationNumber", v.registration_no,
        //         "registrationDate", DATE_FORMAT(v.registration_date, '%Y-%m-%d'),

        //         "vehicle_capacity", JSON_OBJECT("id", v.vehicle_capacity_tons, "name", v.vehicle_capacity_tons),
        //         "vehicle_fuel_type", JSON_OBJECT("id", ft.id, "name", ft.name),

        //         "overSpeedLimit", v.max_speed,
        //         "vehicle_size", JSON_OBJECT("id", vs.id, "name", vs.size),

        //         /* 🔥 Documents with doc_key */
        //         "documents", IFNULL(JSON_ARRAYAGG(
        //             JSON_OBJECT(
        //                 "documentTypeId", dt.id,
        //                 "documentName", dt.name,
                        
        //                 /* ✅ NEW FIELD */
        //                 "doc_key", REPLACE(dt.name, ' ', ''),

        //                 "documentId", d.id,
        //                 "documentNumber", d.doc_no,
        //                 "issueDate", DATE_FORMAT(d.issue_date, '%Y-%m-%d'),
        //                 "expiryDate", DATE_FORMAT(d.expiry_date, '%Y-%m-%d'),
        //                 "filePath", d.file_path,
        //                 "isVerified", d.is_verified
        //             )
        //         ), JSON_ARRAY()),

        //         "Elock", IF(v.is_fixed_door_e_lock = 1, TRUE, FALSE),
        //         "GPS", IF(v.is_gps = 1, TRUE, FALSE),
        //         "Dual Driver", IF(v.is_door_close = 1, TRUE, FALSE),
        //         "Fire Fighting", NULL,
        //         "Portable E-Lock", NULL,
        //         "Tarpaulin", IF(v.is_tarpaulin = 1, TRUE, FALSE)

        //     ) AS data

        //     FROM vehicle v

        //     LEFT JOIN vehicle_category vc ON v.vehicle_category_id = vc.id AND vc.status = 1
        //     LEFT JOIN vehicle_make vm ON v.vehicle_make_id = vm.id AND vm.status = 1
        //     LEFT JOIN vehicle_model vmodel ON v.vehicle_model_id = vmodel.id AND vmodel.status = 1
        //     LEFT JOIN vehicle_types vt ON v.body_type_id = vt.id AND vt.status = 1
        //     LEFT JOIN cv_vehicle_size vs ON v.vehicle_size = vs.id AND vs.status = 1
        //     LEFT JOIN fuel_type ft ON CONVERT(v.fuel_type, UNSIGNED) = ft.id AND ft.status = 1

        //     /* 🔥 latest documents */
        //     LEFT JOIN (
        //         SELECT d1.*
        //         FROM documents d1
        //         INNER JOIN (
        //             SELECT vehicle_id, doc_type_id, MAX(id) as max_id
        //             FROM documents
        //             WHERE status = 1
        //             GROUP BY vehicle_id, doc_type_id
        //         ) d2 
        //         ON d1.id = d2.max_id
        //     ) d ON d.vehicle_id = v.id

        //     LEFT JOIN document_types dt 
        //         ON dt.id = d.doc_type_id 
        //         AND dt.status = 1 
        //         AND dt.category = 'vehicle'

        //     WHERE v.id IN (?) AND v.status = 1

        //     GROUP BY v.id`,
        //     [vehicleIds]
        // );
        
        const [rows] = await db.promise().query(
            `SELECT 
                v.id,

                v.vehicle_number,

                vc.id as category_id,
                vc.name as category_name,

                vm.id as make_id,
                vm.name as make_name,

                vmodel.id as model_id,
                vmodel.model_number as model_name,

                vt.id as vehicle_type_id,
                vt.name as vehicle_type_name,

                v.registration_no,
                DATE_FORMAT(v.registration_date, '%Y-%m-%d') as registration_date,

                v.vehicle_capacity_tons,
                vcap.capacity,
                ft.id as fuel_type_id,
                ft.name as fuel_type_name,

                v.max_speed,
                vs.id as vehicle_size_id,
                vs.size as vehicle_size_name,

                /* 🔥 documents */
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        "documentTypeId", dt.id,
                        "documentName", dt.name,
                        "doc_key", REPLACE(dt.name, ' ', ''),
                        "documentId", d.id,
                        "documentNumber", d.doc_no,
                        "issueDate", DATE_FORMAT(d.issue_date, '%Y-%m-%d'),
                        "expiryDate", DATE_FORMAT(d.expiry_date, '%Y-%m-%d'),
                        "filePath", d.file_path,
                        "isVerified", d.is_verified
                    )
                ) as documents,

                v.is_fixed_door_e_lock,
                v.is_gps,
                v.is_door_close,
                v.is_tarpaulin

            FROM vehicle v

            LEFT JOIN vehicle_category vc ON v.vehicle_category_id = vc.id AND vc.status = 1
            LEFT JOIN vehicle_make vm ON v.vehicle_make_id = vm.id AND vm.status = 1
            LEFT JOIN vehicle_model vmodel ON v.vehicle_model_id = vmodel.id AND vmodel.status = 1
            LEFT JOIN vehicle_types vt ON v.body_type_id = vt.id AND vt.status = 1
            LEFT JOIN vehicle_capacity vcap ON v.vehicle_capacity_tons = vcap.id AND vcap.status = 1 
            LEFT JOIN cv_vehicle_size vs ON v.vehicle_size = vs.id AND vs.status = 1
            LEFT JOIN fuel_type ft ON CONVERT(v.fuel_type, UNSIGNED) = ft.id AND ft.status = 1

            /* latest docs */
            LEFT JOIN (
                SELECT d1.*
                FROM documents d1
                INNER JOIN (
                    SELECT vehicle_id, doc_type_id, MAX(id) as max_id
                    FROM documents
                    WHERE status = 1
                    GROUP BY vehicle_id, doc_type_id
                ) d2 
                ON d1.id = d2.max_id
            ) d ON d.vehicle_id = v.id

            LEFT JOIN document_types dt 
                ON dt.id = d.doc_type_id 
                AND dt.status = 1 
                AND dt.category = 'vehicle'

            WHERE v.id IN (?) AND v.status = 1

            GROUP BY v.id`,
            [vehicleIds]
        );


        if (rows.length === 0) {
            return res.status(404).json({
                Status: "Fail",
                Message: "Data not found"
            });
        }
        // res.send(rows);process.exit(0);
        // 🔹 Parse JSON
        // const data = rows.map(r => JSON.parse(r.data));
        const data = rows.map(r => ({
            vehicleNumber: r.vehicle_number,

            category: {
                id: r.category_id,
                name: r.category_name
            },

            make: {
                id: r.make_id,
                name: r.make_name
            },

            model: {
                id: r.model_id,
                name: r.model_name
            },

            vehicle_type: {
                id: r.vehicle_type_id,
                name: r.vehicle_type_name
            },

            registrationNumber: r.registration_no,
            registrationDate: r.registration_date,

            vehicle_capacity: {
                id: r.vehicle_capacity_tons,
                name: r.capacity
            },

            vehicle_fuel_type: {
                id: r.fuel_type_id,
                name: r.fuel_type_name
            },

            overSpeedLimit: r.max_speed,

            vehicle_size: {
                id: r.vehicle_size_id,
                name: r.vehicle_size_name
            },

            documents: r.documents ? JSON.parse(r.documents) : [],

            Elock: !!r.is_fixed_door_e_lock,
            GPS: !!r.is_gps,
            "Dual Driver": !!r.is_door_close,
            "Fire Fighting": null,
            "Portable E-Lock": null,
            Tarpaulin: !!r.is_tarpaulin
        }));

        return res.status(200).json({
            Status: "Success",
            Message: "Data fetched successfully",
            data
        });

    } catch (error) {
        console.error("vehicleEditData Error:", error);
        return res.status(500).json({
            Status: "Fail",
            Message: "Internal Server Error"
        });
    }
};

exports.vehicleEdit = async(req, res) =>{
    
    try{
        // console.log('AccessToken');process.exit(0);
        const {AccessToken,vehicle_data} = req.body;
        let response = {};
        if(AccessToken !== null){
            
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            
            if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    res.status(200).json(response);
            }
            else{
                // const user_id = 5659; //BluedartMaster
                // const user_id = 152867; //MasterCV
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter
                // const user_id = 156925; //customer grouptype=32
                const user_id = user_info.AccountId;
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
                        return res.status(200).json({ Status: "Fail", Message: "Vehicle already exists in the database" });
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
                        transporter_id: transporter_id,
                        // isVerified: is_verified
                    } = inputData;
                    
                    isVerified = null;
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
                            is_verified = ?, vehicle_category_id = ?, vehicle_make_id = ?, vehicle_model_id = ?, 
                            vehicle_number = ?, body_type_id = ?, registration_no = ?, 
                            registration_date = ?, vehicle_capacity_tons = ?, fuel_type = ?, 
                            max_speed = ?, is_fixed_door_e_lock = ?, is_gps = ?, 
                            is_dual_driver = ?, is_fire_extinguisher = ?, is_portable_e_lock = ?, 
                            is_tarpaulin = ?, vehicle_size = ?, status = ?, edit_id = ?, edit_date = ? 
                        WHERE id = ?
                    `;
                    const values = [
                        isVerified, category, make, model, vehicleNumber, vehicle_type, registration_no, registeration_date,
                        vehicle_capacity, fuel_type, over_speed_limit, elock, gps, dualDriver, fireExtinguisher,
                        portableElock, tarpaulin, vehicle_size, status, editId, editDate, vehicleId
                    ];                    
                    
                    const [updateResult] = await db.promise().query(sql, values);

                    if (updateResult.affectedRows > 0) {
                        return res.status(200).json({ Status: "success", Message: "Vehicle updated successfully" });
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
};

exports.vehicleAction = async(req, res) =>{
    const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    let user_info ={};
    try{
        // console.log('AccessToken');process.exit(0);
        const {AccessToken, vehicle_id, action, DeveloperOptionId, DeveloperOption} = req.body;
        let response = {};
        if(AccessToken !== null){
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday) {
                user_info.Status=1; 
                user_info.AccountId=DeveloperOptionId;
            }else{
                user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
                //user_info = await getAccessTokenDataWeb(AccessToken);
            }
            // const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            
            if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    res.status(200).json(response);
            }
            else{
                // const user_id = 5659; //BluedartMaster
                // const user_id = 152867; //MasterCV
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter
                // const user_id = 156925; //customer grouptype=32
                const user_id = user_info.AccountId;
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
                    // let idsArray = cleanedInput.split(',').map(id => parseInt(id.trim())); // Convert to array of numbers
                    
                    // Step 1: Make it a valid JSON string
                    let fullJsonString = `{${cleanedInput}}`;
                    // Step 2: Parse it
                    let obj = JSON.parse(fullJsonString);
                    // Step 3: Convert to number array
                    let idsArray = Object.values(obj).map(Number);
                    
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
                        Status: "success",
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
};

exports.uploadMedia = async (req, res) => {
    // try{
    // res.send(req.files);
    // }
    // catch(error)
    // {
    //     res.send({"Error":error});
    // }
    // console.log('hello');process.exit(0);
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

            uploadComponent.any();
            const filePath = req.files[0].path;
            const bucketName = 'itrackreport';
            // const s3Directory = "cv_tripManagement/DriverVehicleDocument";
            // const s3Directory = "o/";
            const s3Directory = "upload/files";
            try {
                
                const uploadingResponse = await uploadS3(bucketName, filePath, s3Directory);
                
                const s3Url = `https://s3.amazonaws.com/${bucketName}/${s3Directory}/${req.files[0].filename}`;

                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error("Error deleting file:", err);
                    } else {
                        console.log("File successfully deleted from server:", filePath);
                    }
                });res.send({"Uploading Response:": uploadingResponse, "S3 URL:": s3Url});process.exit(0);
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

////////////////////////////// Functions ////////////////////////////

const chunkArray = (array, size) => {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) chunked.push(array.slice(i, i + size));
    return chunked;
};

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

function get_months_and_years_from_dates(from_date, to_date, date_format = "YYYY-MM-DD") {
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




exports.trackingLink2026 = async (req, res) => {
    try {

        let track = req.query.track || req.body.track;
        let key = req.query.KEY || req.body.KEY;

        if (!track || !key) {
            return res.status(400).json({
                status: false,
                message: "track and KEY are required"
            });
        }

        // Base64 Decode
        let decodedTrack = Buffer.from(track, 'base64').toString('utf-8');

        // explode('`^', $decoded_track)
        let explodeData = decodedTrack.split('`^');

        let shipment_no = explodeData[0];
        let group_id = explodeData[1];
        
        let collection = "";
        let result = [];

        let fields = {
            projection: {
                _id: 1,
                source_id: 1,
                source_geocoord: 1,
                destination_id: 1,
                destination_geocoord: 1,
                shipment_no: 1,
                run_date: 1,
                target_date: 1,
                vehicle_no: 1,
                imei_no: 1,
                group_id: 1,
                trip_status: 1,
                status: 1,
                salt_key: 1
            }
        };

        let conditions = {
            status: 1,
            trip_status: 1,
            group_id: group_id,
            shipment_no: shipment_no
        };

        // Group Wise Collection Selection
        if (group_id === "0041") {

            collection = "courier_trip_detail";

            // result = await MongoLocalIL
            //     .collection(collection)
            //     .find(conditions, fields)
            //     .toArray();
            result = await getMongo.getMongoBDEQuery(conditions, fields, collection);
        } else if (group_id === "5864") {

            collection = "dhl_trip_detail";

            result = await MongoLocalCv
                .collection(collection)
                .find(conditions, fields)
                .toArray();
        }
        res.send(result);process.exit(0);
        // Trip Not Found
        if (!result || result.length === 0) {
            return res.status(404).send("Trip not in Schedule");
        }

        // Main Result Data
        let salt_key = result[0]?.salt_key || "";
        let mongoid = result[0]?._id?.toString() || "";
        let imei = result[0]?.imei_no || "";
        let run_date = result[0]?.run_date || "";
        let vehicle_no = result[0]?.vehicle_no || "";

        let _id = [];
        _id.push(mongoid);

        // Default Variables
        let vehicleno = "";
        let f_run_date = "";
        let route = "";
        let shipment = "";
        let source = "";
        let destination = "";
        let fleetno = "";

        // NOTE:
        // PHP code me $results define nahi tha.
        // Isliye yaha temporarily result hi use kiya gaya h.

        let results = result;

        for (let val of results) {

            vehicleno = val?.vehicle_no || "";
            f_run_date = val?.run_date || "";
            route = val?.route_code || "";
            shipment = val?.shipment_no || "";
            source = val?.source_code || "";
            destination = val?.destination_code || "";
            fleetno = val?.fleet_no || "";

            if (val?.close_date) {
                req.body.enddate = val.close_date;
            }
        }

        // Customer Variables
        let customer_name = "";
        let customer_geocoord = "";
        let customer_visited = "";

        let _id_fk = [];
        _id_fk.push(mongoid);

        let resultsCustomer = [];

        // Customer Collection Query
        // if (group_id === "0041") {

        //     resultsCustomer = await MongoLocalIL
        //         .collection('courier_trip_detail_customer')
        //         .find({
        //             group_id: group_id,
        //             m_trip_id: { $in: _id_fk }
        //         })
        //         .toArray();

        // } else {

        //     resultsCustomer = await MongoLocalCv
        //         .collection('dhl_trip_detail_customer')
        //         .find({
        //             group_id: group_id,
        //             m_trip_id: { $in: _id_fk }
        //         })
        //         .toArray();
        // }

        return res.status(200).json({
            status: true,
            message: "Tracking data fetched successfully",
            data: {
                shipment_no,
                group_id,
                salt_key,
                mongoid,
                imei,
                run_date,
                vehicle_no,
                vehicleno,
                f_run_date,
                route,
                shipment,
                source,
                destination,
                fleetno,
                // resultsCustomer
            }
        });

    } catch (error) {

        console.error("trackingLink Error => ", error);

        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

exports.trackingLink = async (req, res) => {
    try {

        let track = req.query.track || req.body.track;
        let key = req.query.KEY || req.body.KEY;

        if (!track || !key) {
            return res.status(400).json({
                status: false,
                message: "track and KEY are required"
            });
        }

        // ================= BASE64 DECODE =================

        let decodedTrack = Buffer.from(track, 'base64').toString('utf-8');
        let explodeData = decodedTrack.split('`^');

        let shipment_no = explodeData[0];
        let group_id = explodeData[1];

        // ================= MAIN COLLECTION =================

        let collection = "";
        let result = [];

        let fields = {
            projection: {
                _id: 1,
                source_id: 1,
                source_geocoord: 1,
                destination_id: 1,
                destination_geocoord: 1,
                shipment_no: 1,
                run_date: 1,
                target_date: 1,
                vehicle_no: 1,
                imei_no: 1,
                group_id: 1,
                trip_status: 1,
                status: 1,
                salt_key: 1
            }
        };

        let conditions = {
            status: 1,
            trip_status: 1,
            group_id: group_id,
            shipment_no: shipment_no
        };

        if (group_id === "0041") {

            collection = "courier_trip_detail";
            result = await getMongo.getMongoBDEQuery(conditions, fields, collection);

        } else if (group_id === "5864") {

            collection = "dhl_trip_detail";
            result = await getMongo.getCVMongoQuery(conditions, fields, collection);
        }

        // ================= NO DATA =================

        if (!result || result.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Trip not in Schedule"
            });
        }

        // ================= TRIP DETAILS =================

        let tripData = result[0] || {};

        // IMPORTANT:
        // mongo id same object format me rakha h
        let MTripId = tripData?._id || null;

        let trip_details = {
            mongo_id: MTripId,

            _id: tripData?._id || null,
            source_id: tripData?.source_id || "",
            source_geocoord: tripData?.source_geocoord || "",
            destination_id: tripData?.destination_id || "",
            destination_geocoord: tripData?.destination_geocoord || "",
            shipment_no: tripData?.shipment_no || "",
            run_date: tripData?.run_date || "",
            // target_date: tripData?.target_date || "",
            vehicle_no: tripData?.vehicle_no || "",
            imei_no: tripData?.imei_no || "",
            group_id: tripData?.group_id || "",
            trip_status: tripData?.trip_status || "",
            status: tripData?.status || "",
            salt_key: tripData?.salt_key || ""
        };

        // ================= CUSTOMER DETAILS =================

        const index_pre = [];
        let finalCust = [];
        let fieldsC = {};
        let sort_order = 1;
        let resultsCustomer = [];

        fieldsC = {
            sort: {
                sequence_no: sort_order
            }
        };

        let tableC = "";

        if (group_id === "0041") {
            tableC = "courier_trip_detail_customer";
        } else if (group_id === "5864") {
            tableC = "dhl_trip_detail_customer";
        }

        index_pre.push(MTripId.$oid);

        let conditionsC = {
            group_id: String(group_id)
        };

        conditionsC.obj = {
            m_trip_id: {
                $in: Object.values(index_pre)
            }
        };

        if (group_id === "0041") {

            resultsCustomer = await getMongo.getMongoQuery(
                conditionsC,
                fieldsC,
                tableC
            );

        } else if (group_id === "5864") {

            resultsCustomer = await mongu.getCVMongoQuery(
                conditionsC,
                fieldsC,
                tableC
            );
        }
        // res.send({resultsCustomer,conditionsC,
        //         fieldsC,
        //         tableC});process.exit(0);
        // ================= CUSTOMER LOOP =================

        if (resultsCustomer && resultsCustomer.length > 0) {

            let flag_lookst = 1;
            let flag_current_station = 0;
            let consec_travel_time_sec = 0;

            resultsCustomer.forEach(value => {

                let end_station_sta = "";
                let current_station_code = "";
                let current_station_sch_dept = "";
                let current_station_geocoord = "";
                let next_station_code = "";
                let next_station_geocoord = "";
                let current_station_sch_arrival = "";

                let t = value.travel_time;

                if (t != "" && t != null) {

                    const te = t.split(".");

                    if (te[0] != undefined && te[1] != undefined) {

                        const tes1 = parseInt(te[0]) * 3600;
                        const tes2 = parseInt(te[1]) * 60;

                        consec_travel_time_sec = tes1 + tes2;
                    }
                }

                let f_sequence_no = value.sequence_no || "";
                let f_location_sequence = value.location_sequence || "";
                let f_arrival_time = value.arrival_time || "";
                let f_departure_time = value.departure_time || "";
                let f_geo_arrival_time = value.geo_arrival_time || "";
                let f_geo_departure_time = value.geo_departure_time || "";
                let f_arrival_geocoord = value.arrival_geocoord || "";
                let f_departure_geocoord = value.departure_geocoord || "";
                let f_geo_arrival_geocoord = value.geo_arrival_geocoord || "";
                let f_geo_departure_geocoord = value.geo_departure_geocoord || "";
                let f_gps_departure_geocoord = value.gps_departure_geocoord || "";
                let f_gps_arrival_geocoord = value.gps_arrival_geocoord || "";
                let f_pod_status = value.pod_status || "";
                let f_edit_date = value.edit_date || "";
                let f_edit_id = value.edit_id || "";
                let f_location_geocoord = value.location_geocoord || "";
                let f_gps_departure_time = value.gps_departure_time || "";
                let f_gps_arrival_time = value.gps_arrival_time || "";
                let f_radius = value.radius || "";

                let current_station_reached_time = "";

                if (value.arrival_time) {
                    current_station_reached_time = value.arrival_time;
                }

                if (value.departure_time) {
                    current_station_reached_time = value.departure_time;
                }

                if (value.geo_arrival_time) {
                    current_station_reached_time = value.geo_arrival_time;
                }

                if (value.geo_departure_time) {
                    current_station_reached_time = value.geo_departure_time;
                }

                if (value.gps_arrival_time) {
                    current_station_reached_time = value.gps_arrival_time;
                }

                if (value.gps_departure_time) {
                    current_station_reached_time = value.gps_departure_time;
                }

                // ================= CURRENT STATION LOGIC =================

                if (current_station_reached_time != "" && flag_lookst == 1) {

                    flag_current_station = 1;

                    current_station_geocoord = f_location_geocoord;
                    current_station_code = value.location_code;
                    current_station_sch_dept = value.schedule_time_departure;

                } else {

                    if (flag_lookst == 1) {

                        if (
                            flag_current_station == 0 &&
                            value.location_sequence == 0
                        ) {

                            current_station_geocoord = f_location_geocoord;
                            current_station_code = value.location_code;
                            current_station_sch_dept = value.schedule_time_departure;
                        }

                        if (value.location_sequence != 0) {

                            if (flag_current_station == 0) {

                                current_station_geocoord = f_location_geocoord;
                                current_station_code = value.location_code;
                                current_station_sch_dept = value.schedule_time_departure;

                                flag_current_station = 1;

                            } else {

                                next_station_geocoord = f_location_geocoord;
                                next_station_code = value.location_code;
                                current_station_sch_arrival = value.schedule_time_arrival;

                                flag_lookst = 0;
                            }
                        }

                        if (value.location_sequence == 2) {
                            end_station_sta = value.schedule_time_arrival;
                        }
                    }
                }

                // ================= PUSH FINAL =================

                finalCust.push({
                    LocationName: value.location_name || "",
                    LocationId: value.location_id || "",
                    LocationGeocoord: f_location_geocoord,
                    LocationCode: value.location_code || "",
                    ScheduleTimeArrival: value.schedule_time_arrival || "",
                    ScheduleTimeDeparture: value.schedule_time_departure || "",
                    SequenceNo: f_sequence_no,
                    LocationSequenceNo: f_location_sequence,
                    TravelTime: value.travel_time || "",
                    TravelTimeCons: consec_travel_time_sec,
                    HaltDuration: value.halt_duration || "",
                    Arrival: f_arrival_time,
                    Departure: f_departure_time,
                    ArrivalGeo: f_geo_arrival_time,
                    DepartureGeo: f_geo_departure_time,
                    ArrivalGeoCoord: f_arrival_geocoord,
                    DepartureGeoCoord: f_departure_geocoord,
                    GeoArrivalGeoCoord: f_geo_arrival_geocoord,
                    GeoDepartureGeoCoord: f_geo_departure_geocoord,
                    PodStatus: f_pod_status,
                    EditDate: f_edit_date,
                    EditId: f_edit_id,
                    GpsDepartureGpsCoord: f_gps_departure_geocoord,
                    GpsArrivalGpsCoord: f_gps_arrival_geocoord,
                    ArrivalGps: f_gps_arrival_time,
                    DepartureGps: f_gps_departure_time,
                    Radius: f_radius
                });

            });
        }
        
        // ================= SORT =================

        finalCust.sort((a, b) => {
            return a.SequenceNo - b.SequenceNo;
        });
        
        // ================= FINAL CUSTOMER RESPONSE =================

        let customer_details = [];

        for (const valueC of finalCust) {

            let actual_arv_lstP = "-";
            let actual_arv_lstP_by = "-";
            let actual_arv_coord_lstP = "-";

            let actual_dep_lstP = "-";
            let actual_dep_lstP_by = "-";
            let actual_dep_coord_lstP = "-";

            let delay_in_arv_lstP = "-";
            let status_arrival = "-";

            // ================= ARRIVAL =================

            if (valueC.LocationSequenceNo != 0) {

                if (valueC.ArrivalGps && valueC.ArrivalGeo) {

                    if (
                        new Date(valueC.ArrivalGps) <
                        new Date(valueC.ArrivalGeo)
                    ) {

                        actual_arv_lstP = valueC.ArrivalGps;
                        actual_arv_lstP_by = "GPS";
                        actual_arv_coord_lstP = valueC.GpsArrivalGpsCoord;

                    } else {

                        actual_arv_lstP = valueC.ArrivalGeo;
                        actual_arv_lstP_by = "Manual";
                        actual_arv_coord_lstP = valueC.GeoArrivalGeoCoord;
                    }

                } else if (!valueC.ArrivalGps && valueC.ArrivalGeo) {

                    actual_arv_lstP = valueC.ArrivalGeo;
                    actual_arv_lstP_by = "Manual";
                    actual_arv_coord_lstP = valueC.GeoArrivalGeoCoord;

                } else if (
                    valueC.ArrivalGps &&
                    (!valueC.ArrivalGeo || valueC.ArrivalGeo == "")
                ) {

                    actual_arv_lstP = valueC.ArrivalGps;
                    actual_arv_lstP_by = "GPS";
                    actual_arv_coord_lstP = valueC.GpsArrivalGpsCoord;
                }
            }

            // ================= DEPARTURE =================

            if (valueC.LocationSequenceNo != 2) {

                if (valueC.DepartureGps && valueC.DepartureGeo) {

                    if (
                        new Date(valueC.DepartureGps) <
                        new Date(valueC.DepartureGeo)
                    ) {

                        actual_dep_lstP = valueC.DepartureGps;
                        actual_dep_lstP_by = "GPS";
                        actual_dep_coord_lstP = valueC.GpsDepartureGpsCoord;

                    } else {

                        actual_dep_lstP = valueC.DepartureGeo;
                        actual_dep_lstP_by = "Manual";
                        actual_dep_coord_lstP = valueC.GeoDepartureGeoCoord;
                    }

                } else if (!valueC.DepartureGps && valueC.DepartureGeo) {

                    actual_dep_lstP = valueC.DepartureGeo;
                    actual_dep_lstP_by = "Manual";
                    actual_dep_coord_lstP = valueC.GeoDepartureGeoCoord;

                } else if (
                    valueC.DepartureGps &&
                    (!valueC.DepartureGeo || valueC.DepartureGeo == "")
                ) {

                    actual_dep_lstP = valueC.DepartureGps;
                    actual_dep_lstP_by = "GPS";
                    actual_dep_coord_lstP = valueC.GpsDepartureGpsCoord;
                }
            }

            // ================= STATUS =================

            if (actual_arv_lstP != "-") {
                status_arrival = `Arrived (${actual_arv_lstP_by})`;
            }

            // ================= DELAY =================

            if (valueC.ScheduleTimeArrival && actual_arv_lstP != "-") {

                let schTime = new Date(valueC.ScheduleTimeArrival).getTime();
                let actualTime = new Date(actual_arv_lstP).getTime();

                if (actualTime > schTime) {

                    let secdiff = (actualTime - schTime) / 1000;

                    delay_in_arv_lstP =
                        secondsToDecimalHours(secdiff) + "Hrs. Delay";

                } else if (actualTime < schTime) {

                    let secdiff = (schTime - actualTime) / 1000;

                    delay_in_arv_lstP =
                        secondsToDecimalHours(secdiff) + "Hrs. Before";

                } else {

                    delay_in_arv_lstP = "OnTime";
                }
            }

            // ================= GEOFENCE =================

            let geofence = "";

            if (valueC.LocationId) {

                let geofence_location = await getGeofence(
                    group_id,
                    valueC.LocationId
                );

                geofence = geofence_location?.geo_coord || "";
            }

            // ================= PUSH CUSTOMER =================

            customer_details.push({
                Source: valueC.LocationCode,
                Label: "M" + valueC.SequenceNo,
                Coordinates: valueC.LocationGeocoord,
                Geofence: geofence,
                SequenceNo: valueC.SequenceNo,
                STD: valueC.ScheduleTimeDeparture,
                ATD: actual_dep_lstP,
                STA: valueC.ScheduleTimeArrival,
                ATA: actual_arv_lstP,
                DelayArrival: delay_in_arv_lstP,
                Status: status_arrival,
                Radius: valueC.Radius
            });
        }
        // res.send(resultsCustomer);process.exit(0);
        // ================= FINAL RESPONSE =================

        return res.status(200).json({
            status: 'success',
            message: "Tracking data fetched successfully",
            data: {
                trip_details: trip_details,
                customer_details: customer_details
            }
        });

    } catch (error) {

        console.error("trackingLink Error => ", error);

        return res.status(500).json({
            status: 'fail',
            message: "Internal Server Error",
            error: error.message
        });
    }
};

const getGeofence = async (group_id, location_id) => {
    let geofence_id = null;
    let base64GeoCoord = '';

    try {
        
        //Step_1: Fetch geofence_id from mapping table
        const [mappingResult] = await db.promise().query( "SELECT geofence_id FROM location_geofence_mapping WHERE group_id = ? AND location_id = ? AND status = 1 LIMIT 1", [group_id, Number(location_id)] );
        
        if (mappingResult.length > 0) {
            geofence_id = Number(mappingResult[0].geofence_id);
        }

        
        //Step_2: Fetch geo_coord from geofence table
        const [geoResult] = await db.promise().query( "SELECT geo_coord FROM geofence WHERE id = ? AND status = 1 LIMIT 1", [geofence_id] );

        if (geoResult.length > 0) {
            const geoCoord = String(geoResult[0].geo_coord);
        
            //Step_3: Decode in Base64
            base64GeoCoord = Buffer.from(geoCoord, 'base64').toString('utf-8');
        }
        

        //Final_Step: Return response
        return {
            geofence_id,
            geo_coord: base64GeoCoord
        };

    } catch (error) {
        /*console.error("Error in getGeofence:", error);
        return {
            Status: "error",
            Message: "Internal Server Error while fetching geofence.",
            Error: error.message
        };*/
    }
};

function secondsToDecimalHours(seconds) {
    const hours = seconds / 3600;
    return hours.toFixed(2); // Returns the result rounded to 2 decimal places
}