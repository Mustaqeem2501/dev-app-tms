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

////////////////////////// TMS:Driver//////////////////////////

exports.driverMaster = async (req, res) => {
    
    try {
        let response = {};
        const { AccessToken } = req.body;

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
                    
                    // Fetch States
                    const state_bin = {};
                    const [state] = await db.promise().query("SELECT id, name FROM state WHERE status=1");
                    
                    state.forEach(row => {
                        state_bin[row.id] = row.name;
                    });
                    
                    // Fetch cities
                    const city_bin = {};
                    const [city] = await db.promise().query("SELECT id, state_id, name FROM city WHERE status=1");
                    
                    city.forEach(row => {
                        const state_id = row.state_id;
                        const city_id = row.id;
                        const city_name = row.name;

                        if (!city_bin[state_id]) {
                            city_bin[state_id] = {}; // Initialize the state_id key if it doesn't exist
                        }

                        city_bin[state_id][city_id] = city_name; // Assign city name to the corresponding state_id and city_id
                    });

                    let data = {};

                    data.state = state_bin;
                    data.city = city_bin;                    

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

exports.driverDashboard = async (req, res) => {
    try {
        let response = {};
        const { AccessToken, from_date, to_date, customer_id } = req.body;

        if (AccessToken == null) {
            return res.status(501).json("payload missing"); // Return early if AccessToken is missing
        }

        const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        
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
            // const user_id = 182500 //usertype24
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
                
                // Date handling
                // const date_format = "YYYY-MM-DD";
                // const from_date = FromDate ? FromDate.trim() : "";
                // const to_date = ToDate ? ToDate.trim() : "";
                // const tomorrow_date = moment().add(1, 'days').format(date_format);
                
                let transporter = null;
                let customerFilter = {};
                
                // if (user_type === 10) {

                //     if (Is_all_data === 'yes') {
                //         dgua_qry = `SELECT dgua.driver_id AS driver_id, d.name AS driver_name 
                //                     FROM driver_group_user_mapping AS dgua 
                //                     LEFT JOIN drivers AS d ON dgua.driver_id = d.id 
                //                     WHERE dgua.status=1 AND dgua.user_id = ${user_id}
                //                     AND dgua.create_date BETWEEN '${fromDate}' AND '${toDate}'`;
                //     } else {
                //         dgua_qry = `SELECT dgua.driver_id AS driver_id, d.name AS driver_name 
                //                     FROM driver_group_user_mapping AS dgua 
                //                     LEFT JOIN drivers AS d ON dgua.driver_id = d.id 
                //                     WHERE dgua.status=1 AND dgua.user_id = ${user_id}`;
                //     }
                //     const [DGUA_qry_data] = await db.promise().query(dgua_qry);

                //     if (!DGUA_qry_data.length) {
                //         return res.status(400).json({ Status: 'Fail', Message: 'Driver id not available' });
                //     }                   
                    
                    // driverId = DGUA_qry_data[0].type_detail_id;
                // } else { 
                                     
                    if(user_type != 10){
                        if (group_type === 32) {
                            const [CVCA_qrydata] = await db.promise().query(
                                `SELECT * FROM cv_customer_assignment WHERE status=1 AND user_id=${user_id} AND type_detail='Transporter'`
                            );
                            transporter = CVCA_qrydata.map(item => item.type_detail_id).join(',');
                        } else {
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
                    }else{
                        transporter = customer_id
                        // console.log(customer_id);process.exit(0);
                    }
                    
                // }
                if(transporter){
                    const [LRA_UId_qry_data] = await db.promise().query(
                        `SELECT user_id FROM logistic_role_assignment WHERE status = 1 AND type_detail_id IN(${transporter})`
                    );
                    
                    if (!LRA_UId_qry_data.length) {
                        return res.status(400).json({ Status: 'Fail', Message: 'User id not available' });
                    }
                    // user = LRA_UId_qry_data[0].user_id;
                    // user = LRA_UId_qry_data.map(item => item.user_id).join(',');
                    user = LRA_UId_qry_data.map(item => item.user_id);                
                }
                
                let dIDs_data = [];
                if (user_type === 10) {
                    if (Is_all_data === 'yes') {
                        [dIDs_data] = await db.promise().query(`SELECT driver_id FROM driver_group_user_mapping WHERE status = 1 AND user_id IN (${user_id}) AND create_date BETWEEN '${fromDate}' AND '${toDate}'`);
                    }else{
                        [dIDs_data] = await db.promise().query(`SELECT driver_id FROM driver_group_user_mapping WHERE status = 1 AND user_id IN (${user_id})`);
                    }
                    
                } else {
                    const userChunks = chunkArray(user, 400);
                    if (Is_all_data === 'yes') {
                        for (const chunk of userChunks) {
                            let u_ids = chunk.join(',');
                            let [dgua_qry] = await db.promise().query(`SELECT driver_id FROM driver_group_user_mapping WHERE status = 1 AND user_id IN (${u_ids}) AND create_date BETWEEN '${fromDate}' AND '${toDate}'`);
                            dIDs_data = [...dIDs_data, ...dgua_qry];
                        }
                        
                    } else {
                        for (const chunk of driverChunks) {
                            let d_ids = chunk.join(',');
                            let [dgua_qry] = await db.promise().query(`SELECT driver_id FROM driver_group_user_mapping WHERE status = 1 AND user_id IN (${d_ids})`);
                            dIDs_data = [...dIDs_data, ...dgua_qry];
                        }
                    }
                    
                }

                let Driver_qry_data = [];
                let Document_qry_data = [];
                if (!dIDs_data.length) {
                    return res.status(200).json({ Status: 'success', Message: 'Data not found.'});
                }
                const driverIds = dIDs_data.map(item => item.driver_id);
                if(driverIds.length<500){

                    [Driver_qry_data] = await db.promise().query(`SELECT d.id AS driver_id, d.name AS name, d.name_hn AS name_hn, d.gender AS gender, DATE_FORMAT(d.birth_date, '%Y-%m-%d') AS birth_date, d.mob_no AS mob_no, d.alternate_mob_no AS alternate_mob_no, d.email AS email, d.state_id AS state_id, s.name AS state_name, d.city_id AS city_id, c.name AS city_name, d.address AS address, d.pincode AS pincode, d.class_of_vehicle AS class_of_vehicle, d.driving_start_date AS driving_start_date, d.is_authenticated AS is_authenticated, d.status AS status FROM drivers AS d LEFT JOIN state AS s ON d.state_id = s.id LEFT JOIN city AS c ON d.city_id = s.id WHERE d.status=1 AND d.id IN(${driverIds})`);

                    if (Is_all_data === 'yes') {
                        [Document_qry_data] = await db.promise().query(`SELECT doct.name AS document_name, doc.id, doc.driver_id, doc.doc_type_id, doc.doc_no, DATE_FORMAT(doc.issue_date, '%Y-%m-%d') AS issue_date, DATE_FORMAT(doc.expiry_date, '%Y-%m-%d') AS expiry_date, doc.file_path, doc.status FROM documents AS doc LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id WHERE doc.status IN(1,2) AND doct.status = 1 AND doc.driver_id IN(${driverIds}) AND doc.create_date BETWEEN '${fromDate}' AND '${toDate}'`);
                    } else {
                        [Document_qry_data] = await db.promise().query(`SELECT doct.name AS document_name, doc.id, doc.driver_id, doc.doc_type_id, doc.doc_no, DATE_FORMAT(doc.issue_date, '%Y-%m-%d') AS issue_date, DATE_FORMAT(doc.expiry_date, '%Y-%m-%d') AS expiry_date, doc.file_path, doc.status FROM documents AS doc LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id WHERE doc.status IN(1,2) AND doct.status = 1 AND doc.driver_id IN(${driverIds})`);
                    }
    
                    // console.log(Document_qry_data);process.exit(0);
                }else{
                    const driverChunks = chunkArray(driverIds, 500);

                    for (const chunk of driverChunks) {
                        let drivr_qry = '';
                        let DriverIdString = chunk.join(',');
    
                        drivr_qry = `
                            SELECT 
                                d.id AS driver_id, 
                                d.name AS name,
                                d.name_hn AS name_hn, 
                                d.gender AS gender,
                                d.birth_date AS birth_date,
                                d.mob_no AS mob_no,
                                d.alternate_mob_no AS alternate_mob_no,
                                d.email AS email,
                                d.state_id AS state_id,
                                s.name AS state_name,
                                d.city_id AS city_id,
                                c.name AS city_name,
                                d.address AS address,
                                d.pincode AS pincode,
                                d.class_of_vehicle AS class_of_vehicle,
                                d.driving_start_date AS driving_start_date,
                                d.is_authenticated AS is_authenticated,
                                d.status AS status
                            FROM 
                                drivers AS d 
                            LEFT JOIN 
                                state AS s ON d.state_id = s.id
                            LEFT JOIN 
                                city AS c ON d.city_id = s.id 
                            WHERE 
                                d.status=1 AND d.id IN(${DriverIdString})`
                        ;
                        let [driver_qry] = await db.promise().query(drivr_qry);
                        Driver_qry_data = [...Driver_qry_data, ...driver_qry];
    
                        let doc_qry = '';
                        if (Is_all_data === 'yes') {
                            doc_qry = `SELECT doct.name AS document_name, doc.id, doc.driver_id, doc.doc_type_id, doc.doc_no, DATE_FORMAT(doc.issue_date, '%Y-%m-%d') AS issue_date, DATE_FORMAT(doc.expiry_date, '%Y-%m-%d') AS expiry_date, doc.file_path, doc.status 
                                    FROM documents AS doc 
                                    LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id 
                                    WHERE doc.status IN(1,2) AND doct.status = 1 AND doc.driver_id IN(${DriverIdString}) 
                                    AND doc.create_date BETWEEN '${fromDate}' AND '${toDate}'`;
                        } else {
                            doc_qry = `SELECT doct.name AS document_name, doc.id, doc.driver_id, doc.doc_type_id, doc.doc_no, DATE_FORMAT(doc.issue_date, '%Y-%m-%d') AS issue_date, DATE_FORMAT(doc.expiry_date, '%Y-%m-%d') AS expiry_date, doc.file_path, doc.status 
                                    FROM documents AS doc 
                                    LEFT JOIN document_types AS doct ON doct.id = doc.doc_type_id 
                                    WHERE doc.status IN(1,2) AND doct.status = 1 AND doc.driver_id IN(${DriverIdString})`;
                        }
    
                        let [Document_qry] = await db.promise().query(doc_qry);
                        if (Document_qry) {
                            Document_qry_data = [...Document_qry_data, ...Document_qry];
                        }
                    }
                    
                }
                
                const data_document = Document_qry_data.reduce((acc, doc) => {
                    acc[doc.driver_id] = acc[doc.driver_id] || [];
                    acc[doc.driver_id].push(doc);
                    return acc;
                }, {});
                
                
                const driverEnrolmentCount = {
                    authenticated_drivers: 0,
                    enrolled_drivers: 0
                };

                const typeOfVehicleCount = {
                    heavy_duty: 0,
                    medium_duty: 0,
                    light_duty: 0
                };
                
                const experienceCounts= {
                    less_than_5_yrs: 0,
                    between_5_to_10_yrs: 0,
                    more_than_10_yrs: 0
                };

                const driver_rating = {
                    Less_than_2: 1,
                    Between_2_to_4: 1,
                    More_than_4: 1
                };
                
                
                const driver_data = Driver_qry_data.map((driver, index) => {
                    let TmpDriverData = {};
                    // Driver basic info
                    TmpDriverData.DriverId = driver.driver_id;
                    TmpDriverData.Name = driver.name;
                    TmpDriverData.HindiName = driver.name_hn;
                    TmpDriverData.Gender = driver.gender;
                    // TmpDriverData.BirthDate = driver.formatDate(birth_date);
                    TmpDriverData.BirthDate = (driver.BirthDate && driver.BirthDate !== "0000-00-00") ? formatDate(driver.birth_date) : "";
                    
                    TmpDriverData.MobileNo = driver.mob_no;
                    TmpDriverData.AlternateMobNo = driver.alternate_mob_no;
                    TmpDriverData.Email = driver.email;
                    TmpDriverData.stateId = driver.state_id;
                    TmpDriverData.stateName = driver.state_name;
                    TmpDriverData.cityId = driver.city_id;
                    TmpDriverData.cityName = driver.city_name;
                    TmpDriverData.Address = driver.address;
                    TmpDriverData.Pincode = driver.pincode;
                    // TmpDriverData.ClassOfVehicle = driver.class_of_vehicle;
                    // TmpDriverData.DSDate = driver.driving_start_date;
                    TmpDriverData.DSDate = (driver.driving_start_date && driver.driving_start_date !== "0000-00-00") ? formatDate(driver.driving_start_date) : "";
                
                    const VehicleDutyType = driver.class_of_vehicle ? driver.class_of_vehicle.trim() : "";
                    TmpDriverData.VehicleDutyType = VehicleDutyType;
                    TmpDriverData.VehicleDutyTypeList = VehicleDutyType.split(",");
                
                    // TmpDriverData.Documents = {};
                    TmpDriverData.Status = driver.status === 1 ? "Active" : "Deactive";


                    // Drivers Enrollment Count For Tile
                    if (driver.is_authenticated === 1) driverEnrolmentCount.authenticated_drivers++;
                    if (driver.is_authenticated === 0) driverEnrolmentCount.enrolled_drivers++;
                
                    // Type Of Vehicle Count For Tile
                    const classes = driver.class_of_vehicle ? driver.class_of_vehicle.split(',') : [];
                    if (classes.includes('HMV')) typeOfVehicleCount.heavy_duty++;
                    if (classes.includes('MGV')) typeOfVehicleCount.medium_duty++;
                    if (classes.includes('LMV')) typeOfVehicleCount.light_duty++;
                
                    // Driver Experience Count For Tile
                    if (driver.driving_start_date && driver.driving_start_date !== "0000-00-00") {
                        const years = moment().diff(moment(driver.driving_start_date), 'years');
                        TmpDriverData.DrivingExpYrs = years;
                        TmpDriverData.DrivingSinceYrs = moment(driver.driving_start_date).year();
                
                        if (years < 5) experienceCounts.less_than_5_yrs++;
                        if (years >= 5 && years <= 10) experienceCounts.between_5_to_10_yrs++;
                        if (years > 10) experienceCounts.more_than_10_yrs++;
                    } else {
                        TmpDriverData.DrivingExpYrs = 0;
                        TmpDriverData.DrivingSinceYrs = 0;
                    }
                
                    
                    TmpDriverData.document = data_document[driver.driver_id] || [];

                    return TmpDriverData;
                });

                // console.log(driverEnrolmentCount);process.exit(0);

                

                const report_data = {
                    driverEnrolmentCount,
                    typeOfVehicleCount,
                    experienceCounts,
                    driver_rating,

                    listing_data: { driver_data: driver_data }
                };

                resData.Status = "success";
                resData.Message = "Data Fetched Successfully";
                resData.Data = report_data;

                return res.status(200).json(resData); // Send response and stop further execution
            }
        }
    } catch (error) {
        console.error("Error in driverDashboard:", error);
        return res.status(500).json({ error: error.message }); // Send response and stop further execution
    }
};

exports.driverAdd = async(req, res) =>{
    
    try{
        let response = {};
        // console.log('AccessToken');process.exit(0);
        const {AccessToken,driver_data} = req.body;
        
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
                const jsonStr = driver_data;
                
                if (response.length > 0) {
                    
                    const resultUsr=response[0];
                    const user_id = resultUsr['id'];
                    const user_type= resultUsr['user_type'];
                    // const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];                    
                    // const name= resultUsr['name']; 

                    if (group_type === 32) {
                        return res.status(400).json({ Status: "Fail", Message: "This GroupTypeId does not have permission to add driver." });
                    }

                    let inputData;
                    try {
                        inputData = JSON.parse(jsonStr);                        
                    } catch (error) {
                        console.error('Error parsing JSON:', error);
                    }
                    
                    // Extract vehicle details from inputData
                    const {
                        name: name,
                        gender: gender,
                        birth_date: birth_date,
                        mob_no: mob_no,
                        alternate_mob_no: alternate_mob_no,
                        email: email,
                        state_id: state_id,
                        city_id: city_id,
                        address: address,
                        pincode: pincode,
                        class_of_vehicle: class_of_vehicle,
                        driving_start_date: driving_start_date
                    } = inputData;
                    
                    const status = 1;
                    const createDate = moment().format('YYYY-MM-DD HH:mm:ss');
                    const createId = user_id; // Assuming this is the user_id
                    
                    // Replace blank email with NULL
                    const sanitizedEmail = email || null;

                    // Default is_authenticated to 0 if not provided
                    const is_authenticated = 0;
                    
                    // Format driving_start_date to include month and day
                    const formattedDrivingStartDate = `${driving_start_date}-01-01`;
                    
                    // Format class_of_vehicle array to a comma-separated string (LMV, HMV, MGV)
                    const formattedClassOfVehicle = class_of_vehicle.join(',');
                    
                    // Insert vehicle into the database
                    const sql = `
                        INSERT INTO drivers (
                            name, gender, birth_date, mob_no, alternate_mob_no, email, state_id, city_id, address, pincode, class_of_vehicle, driving_start_date, is_authenticated, status, create_id, create_date
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    const values = [
                        name, gender, birth_date, mob_no, alternate_mob_no, sanitizedEmail, state_id, city_id, address, pincode, formattedClassOfVehicle, formattedDrivingStartDate, is_authenticated, status, createId, createDate
                    ];
                    
                    const [insertResult] = await db.promise().query(sql, values);
                    // console.log(insertResult);
                    // insertResult= {
                    //     fieldCount: 0,
                    //     affectedRows: 1,
                    //     insertId: 9551,
                    //     info: '',
                    //     serverStatus: 2,
                    //     warningStatus: 0,
                    //     changedRows: 0
                    // };
                    
                    if (insertResult.affectedRows > 0) {
                        const addedDriverId = insertResult.insertId;                        
                        let userId = null;   

                        if(inputData.TransporterId){
                            let transporter_id = inputData.TransporterId;
                            
                            const [transporter_query] = await db.promise().query(`SELECT user_id FROM logistic_role_assignment WHERE type_detail_id=${transporter_id} AND status=1`);
                            userId = transporter_query.map(item=>item.user_id).join(',');
                        }else{
                            userId = user_id;                                
                        }
                            
                        const mappingSql = `
                            INSERT INTO driver_group_user_mapping(group_id, user_id, driver_id, status, create_id, create_date
                            ) VALUES (?, ?, ?, ?, ?, ?)
                        `;
                        const mappingValues = [group_id, user_id, addedDriverId, status, createId, createDate];
                        
                        const [mappingResult] = await db.promise().query(mappingSql, mappingValues);
                        
                        if (mappingResult.affectedRows > 0) {
                            return res.status(200).json({
                                Status: "Data Added Successfully",
                                Driver_id: addedDriverId,
                                Mapping_id: mappingResult.insertId
                            });
                        } else {
                            return res.status(500).json({ Status: "Fail", Message: "Failed to map driver to transporter" });
                        }
                        
                    } else {
                        return res.status(500).json({ Status: "Fail", Message: "Failed to add driver" });
                    }                     
                }   
                res.status(200).json("Invalid User");
            }
        }else{
            res.status(501).json("payload missing");
        }
    }catch(error){
        res.status(500).json({ Status: "Fail", Message: error.message });
    }
};

exports.driverEdit = async(req, res) =>{
    
    try{
        let response = {};
        // console.log('AccessToken');process.exit(0);
        const {AccessToken,driver_data} = req.body;
       
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
                const jsonStr = driver_data;
                // console.log(jsonStr);process.exit(0);
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
                    
                    const driverId = inputData.id;
                    // Extract vehicle details from inputData
                    const {
                        name: name,
                        gender: gender,
                        birth_date: birth_date,
                        mob_no: mob_no,
                        alternate_mob_no: alternate_mob_no,
                        email: email,
                        state_id: state_id,
                        city_id: city_id,
                        address: address,
                        pincode: pincode,
                        class_of_vehicle: class_of_vehicle,
                        driving_start_date: driving_start_date,
                        is_authenticated: is_authenticated
                    } = inputData;
                    
                    const status = 1;
                    const edit_id = user_id; // Assuming this is the user_id
                    const edit_date = moment().format('YYYY-MM-DD HH:mm:ss');
                    
                    
                    // Replace blank email with NULL
                    const sanitizedEmail = email || null;

                    // Default is_authenticated to 0 if not provided
                    // const is_authenticated = 0;
                    
                    // Format driving_start_date to include month and day
                    const formattedDrivingStartDate = `${driving_start_date}-01-01`;
                    
                    // Format class_of_vehicle array to a comma-separated string (LMV, HMV, MGV)
                    const formattedClassOfVehicle = class_of_vehicle.join(',');                    

                    // Update vehicle in the database
                    const sql = `
                        UPDATE drivers SET 
                            name = ?, gender = ?, birth_date = ?, mob_no = ?, alternate_mob_no = ?, email = ?, state_id = ?, city_id = ?, address = ?, pincode = ?, class_of_vehicle = ?, driving_start_date = ?, is_authenticated = ?, edit_id = ?, edit_date = ? WHERE id = ?
                    `;                    
                    
                    const values = [
                        name, gender, birth_date, mob_no, alternate_mob_no, sanitizedEmail, state_id, city_id, address, pincode, formattedClassOfVehicle, formattedDrivingStartDate, is_authenticated, edit_id, edit_date, driverId
                    ];     
                               
                    // console.log(values);process.exit(0);
                    const [updateResult] = await db.promise().query(sql, values);

                    if (updateResult.affectedRows > 0) {
                        return res.status(200).json({ Status: "Success", Message: "Driver updated successfully" });
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

exports.driverAction = async(req, res) =>{
    
    try{
        let response = {};
        const { AccessToken, driver_id, action } = req.body;
        
        // Validate required fields
        if (!AccessToken || !driver_id || !action) {
            return res.status(400).json({ Status: "Fail", Message: "Missing required fields (AccessToken, driver_id, or action)" });
        }

        // Ensure driver_id is a valid string
        if (typeof driver_id !== 'string') {
            return res.status(400).json({ Status: "Fail", Message: "driver_id must be a string" });
        }

        // Parse driver_id into an array of IDs
        let cleanedInput = driver_id.replace(/[{}]/g, ''); // Remove { and }
        let idsArray = cleanedInput.split(',').map(id => parseInt(id.trim())); // Convert to array of numbers
        
        // Validate idsArray
        if (!idsArray || !idsArray.length || idsArray.some(isNaN)) {
            return res.status(400).json({ Status: "Fail", Message: "Invalid driver_id format" });
        }

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
                const jsonStr = driver_id;
                
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
                    // let cleanedInput = driver_id.replace(/[{}]/g, ''); // Remove { and }
                    // let idsArray = cleanedInput.split(',').map(id => parseInt(id.trim())); // Convert to array of numbers
                    // console.log(idsArray);process.exit(0);
                    let status, message, is_authenticated;
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
                        case 'verify':
                            is_authenticated = 1;
                            message = "Data verified Successfully.";
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
                        if(action == 'verify'){
                            let sqlDriver = `
                                UPDATE drivers SET is_authenticated = ?, edit_id = ?, edit_date = ? WHERE id = ?
                            `;
                            let valDriver = [is_authenticated, editId, editDate, id];
                            const [resVehicle] = await db.promise().query(sqlDriver, valDriver);
                        }else{
                            let sqlDriver = `
                                UPDATE drivers SET status = ?, edit_id = ?, edit_date = ? WHERE id = ?
                            `;
                            let valDriver = [status, editId, editDate, id];
                            const [resVehicle] = await db.promise().query(sqlDriver, valDriver);

                            const sqlDoc = `
                                UPDATE documents SET status = ?, edit_id = ?, edit_date = ? WHERE driver_id = ?
                            `;
                            const valDoc = [status, editId, editDate, id];
                            const [resDoc] = await db.promise().query(sqlDoc, valDoc);
                        }

                        // const [resVehicle] = await db.promise().query(sqlDriver, valDriver);

                        // Update documents status
                        

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


////////////////////////////// Functions ////////////////////////////

let formatDate = (date) => {
    return moment(date).format('YYYY-MM-DD');
};

const chunkArray = (array, size) => {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) chunked.push(array.slice(i, i + size));
    return chunked;
};