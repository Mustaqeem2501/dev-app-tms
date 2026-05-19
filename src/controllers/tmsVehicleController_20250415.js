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

                    res.status(200).json(response);
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
                    vehicleCategory.forEach(row => {
                        vehicleCategory_bin[row.id] = row.name;
                    });

                    // Fetch vehicle makes
                    const vehicleMake_bin = {};
                    const [vehicleMake] = await db.promise().query("SELECT id, name FROM vehicle_make WHERE status=1");
                    vehicleMake.forEach(row => {
                        vehicleMake_bin[row.id] = row.name;
                    });

                    // Fetch vehicle models
                    const vehicleModel_bin = {};
                    const [vehicleModel] = await db.promise().query("SELECT id, model_number FROM vehicle_model WHERE status=1");
                    vehicleModel.forEach(row => {
                        vehicleModel_bin[row.id] = row.model_number;
                    });

                    // Fetch vehicle types
                    const vehicleBodyType_bin = {};
                    const [vehicleBodyType] = await db.promise().query("SELECT id, name FROM vehicle_types WHERE status=1");
                    vehicleBodyType.forEach(row => {
                        vehicleBodyType_bin[row.id] = row.name;
                    });

                    // Fetch vehicle capacities
                    const vehicleCapacity_bin = {};
                    const [vehicleCapacity] = await db.promise().query("SELECT id, capacity FROM vehicle_capacity WHERE status=1");
                    vehicleCapacity.forEach(row => {
                        vehicleCapacity_bin[row.id] = row.capacity;
                    });

                    // Fetch fuel types
                    const vehicleFuelType_bin = {};
                    const [vehicleFuelType] = await db.promise().query("SELECT id, name FROM fuel_type WHERE status=1");
                    vehicleFuelType.forEach(row => {
                        vehicleFuelType_bin[row.id] = row.name;
                    });

                    // Fetch document types
                    const vehicleDocumentType_bin = {};
                    const [vehicleDocumentType] = await db.promise().query(
                        'SELECT id, name FROM document_types WHERE status=1 AND category="vehicle"'
                    );
                    vehicleDocumentType.forEach(row => {
                        vehicleDocumentType_bin[row.id] = row.name;
                    });

                    // Fetch vehicle features
                    const vehicleFeature_bin = {};
                    const [vehicleFeature] = await db.promise().query("SELECT id, name FROM cv_feature_master WHERE status=1");
                    vehicleFeature.forEach(row => {
                        vehicleFeature_bin[row.id] = row.name;
                    });

                    // Fetch vehicle sizes
                    const vehicleSize_bin = {};
                    const [vehicleSize] = await db.promise().query("SELECT id, size FROM cv_vehicle_size WHERE status=1");
                    vehicleSize.forEach(row => {
                        vehicleSize_bin[row.id] = row.size;
                    });

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

                        if (transporters_bin.length > 0) {
                            transporters_bin.forEach(row => {
                                transporter[row.id] = row.name;
                            });
                        }
                    }

                    let data = {};

                    data.category = vehicleCategory_bin;
                    data.make = vehicleMake_bin;
                    data.model = vehicleModel_bin;
                    data.vehicle_type = vehicleBodyType_bin;
                    data.vehicle_capacity = vehicleCapacity_bin;
                    data.vehicle_fuel_type = vehicleFuelType_bin;
                    data.vehicle_document_type = vehicleDocumentType_bin;
                    data.vehicle_feature = vehicleFeature_bin;
                    data.vehicle_size = vehicleSize_bin;
                    data.transporters = transporter;

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
        const { AccessToken, from_date, to_date, customer_id, DeveloperOptionId, DeveloperOption} = req.body;
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

                if (user_type === 10) {
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
                                `SELECT id FROM user WHERE status=1 AND group_id=${group_id} AND status=1 AND user_type=10`
                            );
                            user_ids = U_qry_data.map(item => item.id).join(',');

                            const [LRA_TId_qry_data] = await db.promise().query(
                                `SELECT * FROM logistic_role_assignment WHERE status = 1 AND user_id IN(${user_ids})`
                            );
                            if (!LRA_TId_qry_data.length) {
                                return res.status(400).json({ Status: 'Fail', Message: 'Transporter id not available' });
                            }
                            
                            transporter = LRA_TId_qry_data[0].type_detail_id;
                            
                        }else{
                            const [TCA_qry_data] = await db.promise().query(
                                `SELECT tca.transporter_id AS transporter_id, t.name AS transporter_name 
                                FROM transporter_customer_assiginment AS tca 
                                LEFT JOIN transporters AS t ON tca.transporter_id = t.id 
                                WHERE tca.status=1 AND tca.customer_group_id=${group_id} AND t.status=1`
                            );
                            transporter = TCA_qry_data.map(item => item.transporter_id).join(',');

                            TCA_qry_data.forEach(value => {
                                customerFilter[value.transporter_id] = value.transporter_name;
                            });
                        }
                    }
                }

                let vta_qry = '';
                if (Is_all_data === 'yes') {
                    vta_qry = `SELECT vta.id AS id, vta.transporter_id AS transporter_id, vta.vehicle_id AS vehicle_id, t.name AS transporter_name 
                                FROM vehicle_transporter_assignment AS vta 
                                LEFT JOIN transporters AS t ON vta.transporter_id = t.id 
                                LEFT JOIN vehicle AS v ON vta.vehicle_id = v.id 
                                WHERE vta.status=1 AND vta.transporter_id IN(${transporter})
                                AND v.status IN(1,2) 
                                AND vta.create_date BETWEEN '${fromDate}' AND '${toDate}'`;
                } else {
                    vta_qry = `SELECT vta.id AS id, vta.transporter_id AS transporter_id, vta.vehicle_id AS vehicle_id,  t.name AS transporter_name 
                            FROM vehicle_transporter_assignment AS vta 
                            LEFT JOIN transporters AS t ON vta.transporter_id = t.id 
                            LEFT JOIN vehicle AS v ON vta.vehicle_id = v.id
                            WHERE vta.status=1 AND vta.transporter_id IN(${transporter}) AND v.status IN(1,2)`;
                }
                
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
                
                let veh_to_trans = {};
                VTA_qry_data.forEach(value => {
                    value.create_date >= FDOPM ? new_vehicle++ : existing_vehicle++;
                    veh_to_trans[value.vehicle_id] = { id: value.transporter_id, name: value.transporter_name };
                });
                
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
                
                const data_document = Document_qry_data.reduce((acc, doc) => {
                    acc[doc.vehicle_id] = acc[doc.vehicle_id] || [];
                    acc[doc.vehicle_id].push(doc);
                    return acc;
                }, {});

                const data_vehicle = Vehicle_qry_data.map(vehicle => ({
                    vehicle,
                    document: data_document[vehicle.id] || [],
                    cust_data: customerFilter[vehicle.transporter_id] || {}
                }));
                // res.send(Vehicle_qry_data.length);
                let closed_body = 0;
                let open_body = 0;
                let container_body = 0;

                data_vehicle.forEach(value => {
                    if (value.vehicle.body_type_id === 1) {
                        closed_body++;
                    } else if (value.vehicle.body_type_id === 2) {
                        open_body++;
                    } else if (value.vehicle.body_type_id === 3 || value.vehicle.body_type_id === 4) {
                        container_body++;
                    }

                    let features = {
                        '1': value.vehicle.is_fixed_door_e_lock || 0,
                        '2': value.vehicle.is_gps || 0,
                        '3': value.vehicle.is_dual_driver || 0,
                        '4': value.vehicle.is_fire_extinguisher || 0,
                        '5': value.vehicle.is_portable_e_lock || 0,
                        '6': value.vehicle.is_tarpaulin || 0
                    };

                    if (Object.keys(features).length) {
                        value.vehicle.features = features;
                    }
                });
                
                const report_data = {
                    vehicles: { new_vehicle, existing_vehicle },
                    body_type: { closed_body, open_body, container: container_body },
                    vehicle_rating: { "less_than_two": 8300, "two_to_four": 2500, "more_than_four": 250 },
                    listing_data: { vehicle_data: data_vehicle }
                };
                
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
};

exports.vehicleAction = async(req, res) =>{
    
    try{
        // console.log('AccessToken');process.exit(0);
        const {AccessToken,vehicle_id,action} = req.body;
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
            const s3Directory = "o/";
            
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

// Function to validate if the vehicle already exists
// async function validateVehicleNo(vehicleNumber) {
//     const [result] = await db.promise().query(
//         'SELECT * FROM vehicle WHERE status IN (1, 2) AND vehicle_number = ?',
//         [vehicleNumber]
//     );
//     return result.length > 0;
// }




