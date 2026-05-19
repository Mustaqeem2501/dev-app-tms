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
const xlsx = require('xlsx');
const { exit } = require("process");

////////////////////////// TMS:Document-Wallet//////////////////////////

exports.documentWalletMaster = async (req, res) => {
    try {
        const { AccessToken } = req.body;

        if (AccessToken != null) {
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);

            if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    res.status(200).json(response);
            }
            else{
                
                // const user_id = 5659; //BluedartMaster
                // const user_id = 152867; //MasterCV
                // const user_id = 152868; // group_type=32 and user_type=24
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter
                const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if (result.length > 0) {
                    const resultUsr=result[0];
                    // const user_id = resultUsr['id'];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name']; 
                    let resData={};
                    let data = {};

                    //Fetch data types
                        date_types = {1: 'Create', 2: 'Expiry'};
                        data.DateType = date_types;
                    

                    //Fetch status types
                        status_types = {1: 'Active', 2: 'DeActivated', 3: 'About to expire', 4: 'Expired'};
                        data.StatusType = status_types;
                    
                    // Fetch document types
                        const document_types = {};
                        const [documentType_qry] = await db.promise().query("SELECT id, category, name FROM document_types WHERE status=1");
                        
                        documentType_qry.forEach(value => {                        
                            if (value.id && value.category && value.name) {
                                const id = value.id;
                                const category = String(value.category).trim();
                                const name = String(value.name).trim();
                        
                                if (!document_types[category]) {
                                    document_types[category] = [];
                                }                    
                                document_types[category].push({ id, name });
                            }
                        });
                        
                        data.DocumentType = document_types;
                        // console.log(data);process.exit(0);
                    // Fetch My Vehicles
                        let vehicle_no = []; 

                        if (user_type === 10) {
                            // Fetch transporter details for user_type = 10
                            const [LRA_qry] = await db.promise().query(
                                `SELECT user_type, type_detail, type_detail_id 
                                FROM logistic_role_assignment 
                                WHERE status = 1 AND user_id = ?`, 
                                [user_id]
                            );

                            if (LRA_qry.length > 0) {
                                const transporterId = LRA_qry[0].type_detail_id || 0;

                                if (transporterId !== 0) {
                                    const sql = `
                                        SELECT v.id AS vehicle_id, v.vehicle_number AS vehicle_no
                                        FROM vehicle_transporter_assignment AS vta
                                        LEFT JOIN vehicle AS v ON v.id = vta.vehicle_id
                                        WHERE vta.status = 1 AND v.status = 1 AND vta.transporter_id = ?
                                    `;

                                    // Execute the query
                                    const [rows] = await db.promise().query(sql, [transporterId]);
                                    vehicle_no = rows; // Assign the result to vehicle_no
                                }
                            }
                        } else if (user_type === 6 && group_type === 32) {
                            // Fetch transporter details for user_type = 6 and group_type = 32
                            const [CVCS_qry] = await db.promise().query(
                                `SELECT user_type, type_detail, type_detail_id 
                                FROM cv_customer_assignment 
                                WHERE status = 1 AND user_id = ?`, 
                                [user_id]
                            );

                            if (CVCS_qry.length > 0) {
                                const transporterIds = CVCS_qry.map(transporter => transporter.type_detail_id).join(',');

                                if (transporterIds.length > 0) {
                                    const sql = `
                                        SELECT v.id AS vehicle_id, v.vehicle_number AS vehicle_no
                                        FROM vehicle_transporter_assignment AS vta
                                        LEFT JOIN vehicle AS v ON v.id = vta.vehicle_id
                                        WHERE vta.status = 1 AND v.status = 1 AND vta.transporter_id IN (?)
                                    `;

                                    // Execute the query
                                    const [rows] = await db.promise().query(sql, [transporterIds]);
                                    vehicle_no = rows; // Assign the result to vehicle_no
                                }
                            }
                        } else {
                            // Fetch vehicle details for other user types
                            const sql = `
                                SELECT v.id AS vehicle_id, v.vehicle_number AS vehicle_no
                                FROM vehice_user_mapping AS vum
                                LEFT JOIN vehicle AS v ON v.id = vum.vehicle_id
                                WHERE vum.status = 1 AND v.status = 1 AND vum.user_id = ?
                            `;

                            // Execute the query
                            const [rows] = await db.promise().query(sql, [user_id]);
                            vehicle_no = rows; // Assign the result to vehicle_no
                        }
                        data.Vehicle = vehicle_no;
                    
                    // Fetch My Drivers
                        let drivers = [];
                        let userIds = ''; // Initialize userIds as an empty string
                        let userid = '';

                        if (user_type === 6 && group_type === 32) {
                            // Fetch transporter details for user_type = 6 and group_type = 32
                            const [CVCS_qry] = await db.promise().query(
                                `SELECT user_type, type_detail, type_detail_id 
                                FROM cv_customer_assignment 
                                WHERE status = 1 AND user_id = ?`, 
                                [user_id]
                            );

                            if (CVCS_qry.length > 0) {
                                // Extract transporter IDs and join them into a comma-separated string
                                const transporterIds = CVCS_qry.map(transporter => transporter.type_detail_id).join(',');

                                // Fetch user IDs associated with the transporter IDs
                                const [LRA_qry] = await db.promise().query(
                                    `SELECT user_id 
                                    FROM logistic_role_assignment 
                                    WHERE status = 1 AND type_detail_id IN (?)`, 
                                    [transporterIds]
                                );

                                if (LRA_qry.length > 0) {
                                    // Extract user IDs and join them into a comma-separated string
                                    userIds = LRA_qry.map(user => user.user_id).join(',');
                                }
                            }
                        }               
                        
                    
                        if (userIds) { // Only execute the query if userIds is not empty
                            userid = userIds;
                        }else{
                            userid = user_id;
                        }
                    
                        // Fetch drivers associated with the user IDs
                        [drivers] = await db.promise().query(
                            `SELECT d.id, d.name 
                            FROM driver_group_user_mapping AS dgum 
                            LEFT JOIN drivers AS d ON d.id = dgum.driver_id
                            WHERE dgum.status = 1 AND dgum.user_id IN (?) AND d.status = 1`, 
                            [userid]
                        );
                        data.Driver = drivers;
                    // Fetch vertical/agent/transporter
                        let verical = [];  let agent = []; let transporter = [];
                        if (user_type === 6 && group_type === 32) {
                            [verical] = await db.promise().query(`SELECT id,vertical AS name FROM cv_vertical WHERE status=1 AND group_id=${group_id}`);
                            data.Vertical = verical;
                            [agent] = await db.promise().query(`SELECT id,name FROM cv_agent WHERE status=1 AND group_id=${group_id}`);
                            data.Agent = agent;
                            [transporter] = await db.promise().query(`SELECT t.id,t.code,t.name FROM cv_customer_assignment AS cvca LEFT JOIN transporters AS t ON t.id=cvca.type_detail_id WHERE cvca.status=1 AND cvca.user_id=${user_id}`);
                            data.Transporter = transporter;
                        }else if(user_type === 24 && group_type === 32){
                            [transporter] = await db.promise().query(`SELECT t.id,t.code,t.name FROM logistic_role_assignment AS lra LEFT JOIN transporters AS t ON t.id=lra.type_detail_id WHERE lra.status=1 AND lra.user_id=${user_id}`);
                            data.Transporter = transporter;
                            
                        }

                    // console.log(data);process.exit(0);
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

exports.documentWallet = async (req, res) => {
    // const response = { Status: 'success' };
    let response = {};
    const data = [];
    const graph_driver = {};
    const graph_vehicle = {};
    let resData={};

    try {
        // const { AccessToken } = req.body;
        let { AccessToken, date_type, from_date, to_date, status_type_id, doc_type_id, vehicle_id, vertical_id, agent_id, transporter_id} = req.body;
        if (AccessToken != null) {
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);

            if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;
                    res.status(200).json(response);
            }
            else{
                
                // const user_id = 5659; //BluedartMaster
                // let user_id = 152867; //MasterCV
                // const user_id = 152868; // group_type=32 and user_type=24
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter
                const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if(result.length>0) {                    
                    const resultUsr=result[0];
                    // let user_id = resultUsr['id'];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name']; 
                    
                    if (user_type === 6 && group_type === 32) {
                        const transporters = await getTransportersFromCustomerAssignment(user_id);                        
                        if (transporters.length > 0) {
                            const transporter_ids = transporters.map(t => t.type_detail_id).join(',');                            
                            const users = await getUsersFromRoleAssignment(transporter_ids);                           
                            if (users.length > 0) {                                
                                user_id = users.map(u => u.user_id).join(',');
                            }                            
                        }
                    }

                    let conditions = "d.status IN (1, 2)";
                    conditions += ` AND d.user_id IN (${user_id})`;
                    
                    if (date_type && from_date && to_date && new Date(from_date) <= new Date(to_date)) {
                        if (date_type == 1) {
                            conditions += ` AND d.create_date BETWEEN '${from_date}' AND '${to_date}'`;
                        } else if (date_type == 2) {
                            conditions += ` AND d.expiry_date BETWEEN '${from_date}' AND '${to_date}'`;
                        }
                    }
                    
                    if (doc_type_id) {
                        conditions += ` AND d.doc_type_id = ${doc_type_id}`;
                    } else {
                        conditions += " AND d.doc_type_id != 0";
                    }
                    
                    if (vertical_id && !vehicle_id) {                        
                        const vehicle_ids = await getVehicleIdsByType(vertical_id, 'vertical');                        
                        vehicle_id = vehicle_ids.join(',');
                    }
                    
                    if (agent_id && !vehicle_id) {
                        const vehicle_ids = await getVehicleIdsByType(agent_id, 'agent');
                        vehicle_id = vehicle_ids.join(',');
                    }
                    
                    if (transporter_id && !vehicle_id) {                        
                        const vehicle_ids = await getTransporterVehicleIds(transporter_id);                        
                        vehicle_id = vehicle_ids.join(',');                        
                    }
                    
                    // if (vehicle_id) {
                    //     conditions += ` AND d.vehicle_id IN (${vehicle_id})`;
                    // }
                    
                    // Fetch documents
                    const sql = `SELECT 
                            d.id AS DocumentId, 
                            dr.name AS Driver, 
                            v.vehicle_number AS VehicleNo, 
                            d.doc_type_id AS DocumentTypeId, 
                            dt.category AS Category, 
                            dt.name AS DocumentTypeName, 
                            d.doc_no AS DocumentNo, 
                            DATE_FORMAT(d.issue_date, '%Y-%m-%d') AS IssueDate, 
                            DATE_FORMAT(d.expiry_date, '%Y-%m-%d') AS ExpiryDate, 
                            d.remark AS Remark, 
                            d.file_path AS FilePath, 
                            d.status AS Status 
                        FROM documents d 
                        LEFT JOIN drivers dr ON d.driver_id = dr.id 
                        LEFT JOIN vehicle v ON d.vehicle_id = v.id 
                        LEFT JOIN document_types dt ON d.doc_type_id = dt.id 
                        WHERE ${conditions}
                    `;                    
                    const [Documentresult] = await db.promise().query(sql);

                    if (Documentresult.length > 0) {
                        const today = new Date().toISOString().split('T')[0];
                        
                        for (const value of Documentresult) {                            
                            let dtype = value.DocumentTypeId;                            
                            const dname = value.DocumentTypeName;
                            const expiry = value.ExpiryDate;
                            let status = value.Status;
                            const category = value.Category;
                            
                            let label = "Active";
                            let color = "green";

                            if (status == 1 && expiry && expiry !== "0000-00-00" && ![1, 2, 4, 12].includes(dtype)) {
                                const date1 = new Date(today);
                                const date2 = new Date(expiry);
                                const diff = date2 - date1;
                                const days = Math.floor(diff / (1000 * 60 * 60 * 24));

                                if (days < 0) {
                                    status = 4;
                                    label = 'Expired';
                                    color = "red";
                                } else if (days === 0) {
                                    status = 3;
                                    label = "Expiring today";
                                    color = "orange";
                                } else if (days > 0 && days <= 30) {
                                    status = 3;
                                    label = `Expiring in ${days} days`;
                                    color = "orange";
                                }
                            } else if (status != 1) {
                                label = "DeActivated";
                                color = "yellow";
                            }

                            value.Status = parseInt(status);
                            value.StatusText = label;
                            value.Color = color;

                            let count_status_1 = 0;
                            let count_status_2 = 0;
                            let count_status_3 = 0;
                            let count_status_4 = 0;

                            if (status_type_id) {
                                if (status_type_id == status) {
                                    data.push(value);

                                    if (status == 1) count_status_1 = 1;
                                    else if (status == 2) count_status_2 = 1;
                                    else if (status == 3) count_status_3 = 1;
                                    else if (status == 4) count_status_4 = 1;
                                }
                            } else {
                                data.push(value);

                                if (status == 1) count_status_1 = 1;
                                else if (status == 2) count_status_2 = 1;
                                else if (status == 3) count_status_3 = 1;
                                else if (status == 4) count_status_4 = 1;
                            }

                            if (category === "driver") {
                                if (!graph_driver[dtype]) {
                                    graph_driver[dtype] = { Name: dname, Active: 0, DeActivated: 0, 'About to expire': 0, Expired: 0 };
                                }
                                graph_driver[dtype].Active += count_status_1;
                                graph_driver[dtype].DeActivated += count_status_2;
                                graph_driver[dtype]['About to expire'] += count_status_3;
                                graph_driver[dtype].Expired += count_status_4;
                            } else if (category === "vehicle") {
                                if (!graph_vehicle[dtype]) {
                                    graph_vehicle[dtype] = { Name: dname, Active: 0, DeActivated: 0, 'About to expire': 0, Expired: 0 };
                                }
                                graph_vehicle[dtype].Active += count_status_1;
                                graph_vehicle[dtype].DeActivated += count_status_2;
                                graph_vehicle[dtype]['About to expire'] += count_status_3;
                                graph_vehicle[dtype].Expired += count_status_4;
                            }
                        }
                    }else{
                        return res.status(200).json({"Status":"success","Message":"Data not found"});
                    }                    
                }else{
                    return res.status(501).json({"Status":"fail","Message":"Invalid Access."});
                }                 
            }
        } else {
            return res.status(501).json({"Status":"fail","Message":"payload missing"}); // Send response and stop further execution
        } 
        
        resData.Status = "success";
        resData.Message = "Data Fetched Successfully";
        resData.Data = data;
        resData.DriverGraph = Object.values(graph_driver);
        resData.VehicleGraph = Object.values(graph_vehicle);     
        return res.status(200).json(resData); // Send response and stop further execution      
    } catch (error) {
        //console.log(result.length);
        response.Status = 'failed';
        response.Message = error.message;
    }
};

exports.documentAdd = async (req, res) => {
    let response = {};
    try {
        const { body, files } = req; 
        let { AccessToken, GroupId, Category, DriverId, VehicleId, DocumentTypeId, DocumentTypeName, DocumentNo, IssueDate, ExpiryDate, Remark} = body;
        
        if (AccessToken != null) {
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            
            if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;
                    res.status(200).json(response);
            }
            else{
                
                // const user_id = 5659; //BluedartMaster
                // let user_id = 152867; //MasterCV
                // const user_id = 152868; // group_type=32 and user_type=24
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter
                const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if(result.length>0) {                    
                    const resultUsr=result[0];
                    
                    // let user_id = resultUsr['id'];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name'];
                    
                    if (!Category) {
                        response.Message = "Field 'Category' is missing.";
                        return res.status(400).json(response);
                    }
            
                    if (Category === "") {
                        response.Message = "Field 'Category' cannot be empty.";
                        return res.status(400).json(response);
                    }
            
                    if (Category === "Driver" && (!DriverId || DriverId === "")) {
                        response.Message = "Field 'DriverId' is missing or empty.";
                        return res.status(400).json(response);
                    }
            
                    if (Category === "Vehicle" && (!VehicleId || VehicleId === "")) {
                        response.Message = "Field 'VehicleId' is missing or empty.";
                        return res.status(400).json(response);
                    }
            
                    if (!DocumentTypeId || DocumentTypeId === "") {
                        response.Message = "Field 'DocumentTypeId' is missing or empty.";
                        return res.status(400).json(response);
                    }
            
                    if (!DocumentTypeName || DocumentTypeName === "") {
                        response.Message = "Field 'DocumentTypeName' is missing or empty.";
                        return res.status(400).json(response);
                    }
            
                    if (![4, 12].includes(DocumentTypeId) && (!DocumentNo || DocumentNo === "")) {
                        response.Message = "Field 'DocumentNo' is missing or empty.";
                        return res.status(400).json(response);
                    }
            
                    if (![1, 2, 4, 12].includes(DocumentTypeId) && (!IssueDate || IssueDate === "")) {
                        response.Message = "Field 'IssueDate' is missing or empty.";
                        return res.status(400).json(response);
                    }
            
                    if (![1, 2, 4, 12].includes(DocumentTypeId) && (!ExpiryDate || ExpiryDate === "")) {
                        response.Message = "Field 'ExpiryDate' is missing or empty.";
                        return res.status(400).json(response);
                    }
                    
                    if (!req.files || !req.files[0] || req.files[0].fieldname === "") {
                        response.Message = "Field 'DocumentFile' is missing or empty.";
                        return res.status(400).json(response);
                    }

                    const uploaded = await uploadAttachment(req.files);
                    
                    if (uploaded.status !== "success") {
                        response.Message = uploaded.Error || "File upload failed.";
                        return res.status(500).json(response);
                    }

                    // Prepare data for insertion
                    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    const accountId = Number(user_id);
                    const groupId = String(GroupId) || "";
                    const driverId = Category === "driver" ? Number(DriverId) : null;
                    const vehicleId = Category === "vehicle" ? Number(VehicleId) : null;
                    const documentTypeId = Number(DocumentTypeId);
                    const documentNo = String(DocumentNo) || "null";
                    const issueDate = String(IssueDate) || "null";
                    const expiryDate = String(ExpiryDate) || "null";
                    const filePath = uploaded.url;
                    // const thumbfilePath = null;
                    const thumbfilePath = uploaded.thumbnailUrl || ''; // Provide a default value if thumbnailUrl is not available
                    const remark = String(Remark) || "null";
                    const status = 1;

                    // Insert into documents table
                    const sql = `
                        INSERT INTO documents (group_id, user_id, driver_id, vehicle_id, doc_type_id, doc_no, issue_date, expiry_date, file_path, thumb_path, remark, status, create_id, create_date)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    const values = [groupId, accountId, driverId, vehicleId, documentTypeId, documentNo, issueDate, expiryDate, filePath, thumbfilePath, remark, status, accountId, now];
                    
                    try {

                        const [insertResult] = await db.promise().query(sql, values);

                        if (insertResult.affectedRows > 0) {
                            const addedDocumentId = insertResult.insertId;
                            
                            // Insert into reminders table if expiry date is provided
                            if (expiryDate && addedDocumentId) {
                                
                                const categoryId = Category === "vehicle" ? 1 : 2; // 1 for vehicle, 2 for driver
                                const reminderTypeId = 2;
                                const reminderTypeName = DocumentTypeName;

                                const sql2 = `
                                    INSERT INTO v2_reminders 
                                    (group_id, user_id, rem_category_id, vehicle_id, driver_id, document_id, rem_type_id, rem_type_name, due_date, status, create_id, create_date)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                `;
                                
                                const values2 = [groupId, accountId, categoryId, vehicleId, driverId, addedDocumentId, reminderTypeId, reminderTypeName, expiryDate, status, accountId, now];
                                
                                try {
                                    const [insertResult2] = await db.promise().query(sql2, values2);
                                    // res.send({ "insertId": insertResult2 });
                                    // Send a success response with both insert results
                                    res.status(200).json({
                                        Status:"success",
                                        message: "Document and reminder inserted successfully",
                                        documentInsertId: addedDocumentId,
                                        reminderInsertId: insertResult2.insertId,
                                    });
                                } catch (error) {
                                    console.error("Error inserting reminder:", error);

                                    // Send an error response if the reminder insertion fails
                                    res.status(500).json({
                                        message: "Failed to insert reminder",
                                        error: error.message,
                                    });
                                }
                            } else {
                                // Send a success response if only the document was inserted
                                res.status(200).json({
                                    message: "Document inserted successfully but reminder not inserted.",
                                    documentInsertId: addedDocumentId,
                                });
                            }
                        } else {
                            // Send an error response if the document insertion failed
                            res.status(500).json({
                                message: "Failed to insert document",
                            });
                        }
                    } catch (error) {
                        console.error("Error inserting document:", error);

                        // Send an error response if the document insertion fails
                        res.status(500).json({
                            message: "Failed to insert document",
                            error: error.message,
                        });
                    }
                }else{
                    return res.status(501).json("Invalid Access.");
                }                 
            }
        } else {
            return res.status(501).json("payload missing"); // Send response and stop further execution
        } 
        
    } catch (error) {
        console.error("Error:", error);

        res.status(500).json({
            message: "Failed",
            error: error.message,
        });
    }
};

exports.documentEdit = async (req, res) => {

    try {
         
        let { AccessToken, DocumentId, DocumentNo, IssueDate, ExpiryDate, Remark} = req.body;
        
        if (AccessToken != null) {
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            
            if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;
                    res.status(200).json(response);
            }
            else{
                
                // const user_id = 5659; //BluedartMaster
                // let user_id = 152867; //MasterCV
                // const user_id = 152868; // group_type=32 and user_type=24
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter
                const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if(result.length>0) {                    
                    const resultUsr=result[0];
                    
                    // let user_id = resultUsr['id'];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name'];
                    let new_file_path = '';
                    
                    if (!DocumentId || DocumentId === "") {
                        response.Message = "Field 'DocumentId' is missing or empty.";
                        return res.status(400).json(response);
                    }

                    if (!DocumentNo || DocumentNo === "") {
                        response.Message = "Field 'DocumentNo' is missing or empty.";
                        return res.status(400).json(response);
                    }
            
                    if (!IssueDate || IssueDate === "") {
                        response.Message = "Field 'IssueDate' is missing or empty.";
                        return res.status(400).json(response);
                    }
            
                    if (!ExpiryDate || ExpiryDate === "") {
                        response.Message = "Field 'ExpiryDate' is missing or empty.";
                        return res.status(400).json(response);
                    }

                    // Prepare data for updation
                    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    const accountId = Number(user_id);
                    const document_id = DocumentId;                    
                    const documentNo = String(DocumentNo) || "null";                    
                    const issueDate = String(IssueDate) || "null";
                    const expiryDate = String(ExpiryDate) || "null";                    
                    // const filePath = new_file_path || "null";                    
                    const remark = String(Remark) || "null";
                    
                    let sql = '';
                    let values = [];
                    if (!req.files || Object.keys(req.files).length === 0) {
                        sql = `UPDATE documents SET doc_no=?, issue_date=?, expiry_date=?, remark=?, edit_id=?, edit_date=? WHERE id=?`;
                        values = [documentNo, issueDate, expiryDate, remark, accountId, now, document_id];
                    }else{

                        const uploaded = await uploadAttachment(req.files);
                        
                        if (uploaded.status !== "success") {
                            response.Message = uploaded.Error || "File upload failed.";
                            return res.status(500).json(response);
                        }else{
                            if (!uploaded || uploaded.url !== "") {
                                new_file_path = uploaded.url;
                            }
                            
                        }

                        sql = `UPDATE documents SET doc_no=?, issue_date=?, expiry_date=?, file_path=?, remark=?, edit_id=?, edit_date=? WHERE id=?`;
                        values = [documentNo, issueDate, expiryDate, new_file_path, remark, accountId, now, document_id];
                    }

                    try {

                        const [updateResult] = await db.promise().query(sql, values);

                        if (updateResult.affectedRows > 0) {
                            
                            // update reminders table if expiry date is provided
                            if (expiryDate) {

                                const sql2 = `
                                    UPDATE v2_reminders SET due_date=?, edit_id=?, edit_date=? WHERE document_id=? `;
                                
                                const values2 = [expiryDate, accountId, now, document_id];
                                
                                try {
                                    const [insertResult2] = await db.promise().query(sql2, values2);

                                    // Send a success response with both insert results
                                    res.status(200).json({
                                        Status:"success",
                                        message: "Document and reminder updated successfully",
                                    });
                                } catch (error) {
                                    console.error("Error updating reminder:", error);

                                    // Send an error response if the reminder insertion fails
                                    res.status(500).json({
                                        message: "Failed to update reminder",
                                        error: error.message,
                                    });
                                }
                            } else {
                                // Send a success response if only the document was inserted
                                res.status(200).json({
                                    message: "Document updated successfully but reminder not updated.",
                                    documentInsertId: addedDocumentId,
                                });
                            }
                        } else {
                            // Send an error response if the document insertion failed
                            res.status(500).json({
                                message: "Failed to update document",
                            });
                        }
                        // const [insertResult] = await db.promise().query(sql, values);
                    } catch (error) {
                        console.error("Error inserting document:", error);

                        // Send an error response if the document insertion fails
                        res.status(500).json({
                            message: "Failed to insert document",
                            error: error.message,
                        });
                    }
                }else{
                    return res.status(501).json("Invalid Access.");
                }                 
            }
        } else {
            return res.status(501).json("payload missing"); // Send response and stop further execution
        } 
        
    } catch (error) {
        console.error("Error:", error);

        res.status(500).json({
            message: "Failed",
            error: error.message,
        });
    }
};

exports.documentAction = async(req, res) =>{
    
    try{
        // console.log('AccessToken');process.exit(0);
        const {AccessToken,document_id,action} = req.body;
       
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
                // const jsonStr = vehicle_id;
                
                if (response.length > 0) {
                    
                    const resultUsr=response[0];
                    // const user_id = resultUsr['id'];
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
                    let cleanedInput = document_id.replace(/[{}]/g, ''); // Remove { and }
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
                        // // Update vehicle status
                        // const sqlDocument = `
                        //     UPDATE documents SET status = ?, edit_id = ?, edit_date = ? WHERE id = ?
                        // `;
                        // const valDocument = [status, editId, editDate, id];
                        // const [resDocument] = await db.promise().query(sqlVehicle, valVehicle);

                        // Update documents status
                        const sqlDoc = `
                            UPDATE documents SET status = ?, edit_id = ?, edit_date = ? WHERE id = ?
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

exports.documentRenew = async (req, res) => {
    try {
        let { AccessToken, DocumentId, DocumentTypeId, VehicleId, DriverId, DocumentNo, IssueDate, ExpiryDate, Remark } = req.body;

        if (!AccessToken) {
            return res.status(400).json({ message: "AccessToken is required." });
        }

        const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        if (!user_info) {
            return res.status(401).json({ message: "Unauthorized access." });
        }

        if(user_info.Status === 2){
            return res.status(200).json({
                status: user_info.Result,
                message: user_info.Message
            });
        }

        // const user_id = 5659; //BluedartMaster
        // let user_id = 152867; //MasterCV
        // const user_id = 152868; // group_type=32 and user_type=24
        // const user_id = 185301; // Master Not groupId=32
        // const user_id = 256; // Master Not groupId=32
        // const user_id = 151086 // Master Not groupId=32
        // const user_id = 153169; //Transporter
        const user_id = user_info.AccountId;
        const [result] = await db.promise().query(
            "SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",
            [user_id, 1]
        );

        if (result.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        const resultUsr = result[0];
        const group_id = resultUsr.group_id;

        if (!DocumentId || !DocumentNo || !IssueDate || !ExpiryDate) {
            return res.status(400).json({ message: "Required fields are missing or empty." });
        }

        const [id_checking] = await db.promise().query(
            `SELECT d.group_id, d.driver_id, d.vehicle_id, d.doc_type_id, r.rem_category_id, r.rem_type_name 
             FROM documents AS d 
             INNER JOIN v2_reminders AS r ON d.id = r.document_id 
             WHERE d.status = 1 AND d.id = ?`,
            [DocumentId]
        );

        // Check if id_checking has results
        if (id_checking.length === 0) {
            return res.status(404).json({ message: "Document not found." });
        }

        const groupId = id_checking[0].group_id;
        const vehicleId = id_checking[0].vehicle_id;
        const driverId = id_checking[0].driver_id;
        const documentTypeId = id_checking[0].doc_type_id;
        const categoryId = id_checking[0].rem_category_id;
        const DocumentTypeName = id_checking[0].rem_type_name;

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const accountId = Number(user_id);
        const document_id = Number(DocumentId);
        const documentNo = String(DocumentNo);
        const issueDate = String(IssueDate);
        const expiryDate = String(ExpiryDate);
        const remark = String(Remark) || "null";
        const status = 1;

        const uploaded = await uploadAttachment(req.files);
        if (uploaded.status !== "success") {
            return res.status(500).json({ message: uploaded.Error || "File upload failed." });
        }

        const new_file_path = uploaded.url;
        const thumbfilePath = uploaded.thumbnailUrl || '';

        const sql_document = `UPDATE documents SET status=?, edit_id=?, edit_date=? WHERE id=?`;
        const values_document = [0, accountId, now, document_id];
        await db.promise().query(sql_document, values_document);

        const sql_remider = `UPDATE v2_reminders SET status=?, edit_id=?, edit_date=? WHERE document_id=?`;
        const values_reminder = [0, accountId, now, document_id];
        await db.promise().query(sql_remider, values_reminder);

        const sql = `
            INSERT INTO documents (group_id, user_id, driver_id, vehicle_id, doc_type_id, doc_no, issue_date, expiry_date, file_path, thumb_path, remark, status, create_id, create_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [groupId, accountId, driverId, vehicleId, documentTypeId, documentNo, issueDate, expiryDate, new_file_path, thumbfilePath, remark, status, accountId, now];
        const [insertResult] = await db.promise().query(sql, values);

        if (insertResult.affectedRows > 0) {
            const addedDocumentId = insertResult.insertId;

            if (expiryDate && addedDocumentId) {
                const reminderTypeId = 2;
                const reminderTypeName = DocumentTypeName;

                const sql2 = `
                    INSERT INTO v2_reminders 
                    (group_id, user_id, rem_category_id, vehicle_id, driver_id, document_id, rem_type_id, rem_type_name, due_date, status, create_id, create_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const values2 = [groupId, accountId, categoryId, vehicleId, driverId, addedDocumentId, reminderTypeId, reminderTypeName, expiryDate, status, accountId, now];

                try {
                    const [insertResult2] = await db.promise().query(sql2, values2);
                    return res.status(200).json({
                        status: "success",
                        message: "Document and reminder renewed successfully",
                        documentInsertId: addedDocumentId,
                        reminderInsertId: insertResult2.insertId,
                    });
                } catch (error) {
                    console.error("Error inserting reminder:", error);
                    return res.status(500).json({
                        message: "Failed to insert reminder",
                        error: error.message,
                    });
                }
            } else {
                return res.status(200).json({
                    message: "Document inserted successfully but reminder not inserted.",
                    documentInsertId: addedDocumentId,
                });
            }
        } else {
            return res.status(500).json({
                message: "Failed to insert document",
            });
        }
    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({
            message: "Failed",
            error: error.message,
        });
    }
};

exports.documentBulkUpload = async (req, res) => {
    
    try {
        // let { AccessToken } = req.body;
        const { body, files } = req;
        
        if (!files) {
            return res.status(400).json({ "Status":"fail", message: "File is missing." });
        }

        if (!body.AccessToken) {
            return res.status(400).json({ "Status":"fail", message: "AccessToken is required." });
        }
        
        // const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        
        // if (!user_info) {
        //     return res.status(401).json({ "Status":"fail", message: "Unauthorized access." });
        // }
        
        // if(user_info.Status === 2){
        //     return res.status(200).json({
        //         status: user_info.Result,
        //         message: user_info.Message
        //     });
        // }
        
        // const user_id = 5659; //BluedartMaster
        let user_id = 152867; //MasterCV
        // const user_id = 152868; // group_type=32 and user_type=24
        // const user_id = 185301; // Master Not groupId=32
        // const user_id = 256; // Master Not groupId=32
        // const user_id = 151086 // Master Not groupId=32
        // const user_id = 153169; //Transporter
        // const user_id = user_info.AccountId;
        const [result] = await db.promise().query(
            "SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",
            [user_id, 1]
        );

        if (result.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        const resultUsr = result[0];
        const group_id = resultUsr.group_id;
        
        const filename = files[0].originalname;
        const tempname = files[0].path;
        
        const directory = "/mnt/nodeAPI/dev-app-tms/src/upload";
        const localpath = `${directory}/${filename}`;        
        
        if (fs.existsSync(localpath)) {
            fs.unlinkSync(localpath);
        }

        fs.renameSync(tempname, localpath);
        
        const data = await readExcel(localpath);
        if (!data || data.length === 0) {
            response.Message = "No data found in excel";
            return res.json(response);
        }       
        
        let document_type_bin = {};
        let document_nos_bin = {};
        // const document_type_key = document_type.replace(/ /g, '_').toLowerCase();
        
        document_type_bin = await getDocumentTypeId();
        document_nos_bin = await getDocumentNoList();
        const userWiseDocument = await getUserWiseDocuments(user_id, group_id);
        const vehiclesList = await getVehiclesList('vehicle_no');
        const driversList = await getDriversList('driver_mb');
        // res.send(document_type_id);
        const errors = [];
        // data.shift(); // Remove headers
        data.forEach((row, i) => {
            const category = (row.Document_Category || '').trim().toLowerCase();
            const vehicle_driver = (row.Vehicle_No_Driver_Name || '').trim();           
            const driver_mobile = (row.DriverMobileNo || null);
            const document_type = (row.Document_Type || '').trim();
            const document_no = (row.Document_Number || '').trim();
            const issue_date = (row.Issue_Date || '').trim();
            const expiry_date = (row.Expiry_Date || '').trim();
            const remark = (row.Remarks || '').trim();  

            if (!category) {
                errors.push(`Row: ${i + 1}, Message: DocumentCategory is missing.`);
                return;
            }

            if (!['driver', 'vehicle'].includes(category)) {
                errors.push(`Row: ${i + 1}, Message: DocumentCategory is invalid.`);
                return;
            }

            if (category === 'vehicle' && !vehicle_driver) {
                errors.push(`Row: ${i + 1}, Message: VehicleNo is missing.`);
                return;
            }

            if (category === 'driver' && !vehicle_driver) {
                errors.push(`Row: ${i + 1}, Message: DriverName is missing.`);
                return;
            }

            if (category === 'driver' && !driver_mobile) {
                errors.push(`Row: ${i + 1}, Message: DriverMobileNo is missing.`);
                return;
            }

            if (!document_type) {
                errors.push(`Row: ${i + 1}, Message: DocumentType is missing.`);
                return;
            }
            
            let category_id = (category==="vehicle") ? 1 : 2;

            let document_type_key = document_type.replace(/ /g, '_').toLowerCase();
            let document_type_id = document_type_bin[category][document_type_key];
            
            if (!document_type_id) {
                errors.push(`Row: ${i + 1}, Message: DocumentType: ${document_type} is invalid.`);
                return;
            }

            if (['bank_passbook', 'photograph'].includes(document_type_key)) {
                errors.push(`Row: ${i + 1}, Message: DocumentType: ${document_type} is not allowed for bulk upload.`);
                return;
            }

            if (!document_no) {
                errors.push(`Row: ${i + 1}, Message: DocumentNo is missing.`);
                return;
            }
            
            let isDocumentExists = document_nos_bin[document_no]; 
            
            // if (isDocumentExists) {
            //     errors.push(`Row: ${i + 1}, Message: DocumentNo already exists.`);
            //     return;
            // }
            
            if (!['aadhaar_card', 'pan_card', 'bank_passbook', 'photograph'].includes(document_type_key) && !issue_date) {
                errors.push(`Row: ${i + 1}, Message: IssueDate is missing.`);
                return;
            }

            if (!['aadhaar_card', 'pan_card', 'bank_passbook', 'photograph'].includes(document_type_key) && !expiry_date) {
                errors.push(`Row: ${i + 1}, Message: ExpiryDate is missing.`);
                return;
            }

            if (issue_date && expiry_date && new Date(issue_date) > new Date(expiry_date)) {
                errors.push(`Row: ${i + 1}, Message: Issue/Expiry date is invalid.`);
                return;
            }
            
            if (expiry_date) {
                const days = calculateDays(issue_date, expiry_date);
                if (days < 30) {
                    errors.push(`Row: ${i + 1}, Message: Invalid document validity.`);
                    return;
                }
            }

            let driver_name = "";
            let vehicle_no = "";

            if (category === "driver") {
                driver_name = vehicle_driver;
            } else if (category === "vehicle") {
                vehicle_no = vehicle_driver;
                vehicle_no = cleanVehicleNo(vehicle_no); // Assuming cleanVehicleNo is a defined function
            }
            
            let vehicle_id = 0;
            if (category === "vehicle" && vehicle_no) {
                
                if (vehiclesList.hasOwnProperty(vehicle_no)) {
                    vehicle_id = vehiclesList[vehicle_no];
                } else {
                    errors.push(`Row: ${i + 1}, Message: Vehicle Number does not exist in database.`);
                }
            }
            // res.send(driver_mobile);
            let driver_id = 0;
            if (category === "driver" && driver_mobile) {
                
                if (driversList.hasOwnProperty(driver_mobile)) {
                    vehicle_id = driversList[driver_mobile];
                } else {
                    errors.push(`Row: ${i + 1}, Message: DriverId does not exist in database.`);
                }
            }

            const document = {
                group_id: group_id,
                user_id: user_id,
                // category_id: category === 'vehicle' ? 1 : 2,
                category_id:category_id,
                driver_id: driver_id,
                vehicle_id: vehicle_id,
                doc_type_id: document_type_id,
                doc_type_name: document_type,
                doc_no: document_no,
                issue_date: issue_date,
                expiry_date: expiry_date,
                remark: remark
            };
            
            const insertResult = addDocumentEntry(document);
            res.send(document);
            if (!insertResult.status) {
                errors.push(`Row: ${i + 1}, Message: Document data could not be saved.`);
            }
            res.send({"category_id":category_id,"document_type_id": document_type_id});




        });

        data.forEach((row, i) => {
            res.send({"row":row,"document_type_id":document_type_id});
            const category = (row.Document_Category || '').trim().toLowerCase();
            const vehicle_driver = (row.Vehicle_No_Driver_Name || '').trim();           
            const driver_mobile = (row.DriverMobileNo || '').trim();
            const document_type = (row.Document_Type || '').trim();
            const document_no = (row.Document_Number || '').trim();
            const issue_date = (row.Issue_Date || '').trim();
            const expiry_date = (row.Expiry_Date || '').trim();
            const remark = (row.Remarks || '').trim();            
            
            if (!category) {
                errors.push(`Row: ${i + 1}, Message: DocumentCategory is missing.`);
                return;
            }

            if (!['driver', 'vehicle'].includes(category)) {
                errors.push(`Row: ${i + 1}, Message: DocumentCategory is invalid.`);
                return;
            }

            if (category === 'vehicle' && !vehicle_driver) {
                errors.push(`Row: ${i + 1}, Message: VehicleNo is missing.`);
                return;
            }

            if (category === 'driver' && !vehicle_driver) {
                errors.push(`Row: ${i + 1}, Message: DriverName is missing.`);
                return;
            }

            if (category === 'driver' && !driver_mobile) {
                errors.push(`Row: ${i + 1}, Message: DriverMobileNo is missing.`);
                return;
            }

            if (!document_type) {
                errors.push(`Row: ${i + 1}, Message: DocumentType is missing.`);
                return;
            }
            let category_id = null;
            category_id = (category==="vehicle") ? 1 : 2;
            // $document_type_key = str_replace(' ','_',$document_type);
            // $document_type_key = strtolower($document_type_key);
            // $document_type_id = $document_types[$document_type_key];

            
            const document_type_key = document_type.replace(/ /g, '_').toLowerCase();
            res.send({"document_type_key":document_type_key,"document_type_id":document_type_id});
            const document_type_id = getDocumentTypeId(document_type_key);
            

            if (!document_type_id) {
                errors.push(`Row: ${i + 1}, Message: DocumentType: ${document_type} is invalid.`);
                return;
            }

            if (['bank_passbook', 'photograph'].includes(document_type_key)) {
                errors.push(`Row: ${i + 1}, Message: DocumentType: ${document_type} is not allowed for bulk upload.`);
                return;
            }

            if (!document_no) {
                errors.push(`Row: ${i + 1}, Message: DocumentNo is missing.`);
                return;
            }

            if (documentNoExists(document_no)) {
                errors.push(`Row: ${i + 1}, Message: DocumentNo already exists.`);
                return;
            }

            if (!['aadhaar_card', 'pan_card', 'bank_passbook', 'photograph'].includes(document_type_key) && !issue_date) {
                errors.push(`Row: ${i + 1}, Message: IssueDate is missing.`);
                return;
            }

            if (!['aadhaar_card', 'pan_card', 'bank_passbook', 'photograph'].includes(document_type_key) && !expiry_date) {
                errors.push(`Row: ${i + 1}, Message: ExpiryDate is missing.`);
                return;
            }

            if (issue_date && expiry_date && new Date(issue_date) > new Date(expiry_date)) {
                errors.push(`Row: ${i + 1}, Message: Issue/Expiry date is invalid.`);
                return;
            }

            if (expiry_date) {
                const days = calculateDays(issue_date, expiry_date);
                if (days < 30) {
                    errors.push(`Row: ${i + 1}, Message: Invalid document validity.`);
                    return;
                }
            }

            let driver_id = 0;
            let vehicle_id = 0;

            if (category === 'driver') {
                driver_id = addDriver(vehicle_driver, driver_mobile, account_id, user_info.group_id);
            } else if (category === 'vehicle') {
                vehicle_id = addVehicle(vehicle_driver, account_id);
            }

            const document = {
                group_id: user_info.group_id,
                user_id: account_id,
                category_id: category === 'vehicle' ? 1 : 2,
                driver_id: driver_id,
                vehicle_id: vehicle_id,
                doc_type_id: document_type_id,
                doc_type_name: document_type,
                doc_no: document_no,
                issue_date: issue_date,
                expiry_date: expiry_date,
                remark: remark
            };

            const insertResult = addDocumentEntry(document);
            if (!insertResult.status) {
                errors.push(`Row: ${i + 1}, Message: Document data could not be saved.`);
            }
        });

    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({
            message: "Failed",
            error: error.message,
        });
    }
};

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

                // fs.unlink(filePath, (err) => {
                //     if (err) {
                //         console.error("Error deleting file:", err);
                //     } else {
                //         console.log("File successfully deleted from server:", filePath);
                //     }
                // });
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

async function uploadAttachment(files){
    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    
    try {
        if (!files || files.length === 0) {
            return {"status":500, "message":"File not found"};
        }
            
        const filePath = files[0].path;
        const bucketName = 'itrackreport';
        // const bucketName = 'itrackreport-india';
        // const s3Directory = "cv_tripManagement/DriverVehicleDocument";
        const s3Directory = "upload/files/";
            
        try {
                
            const uploadingResponse = await uploadS3(bucketName, filePath, s3Directory);                
            const s3Url = `https://s3.amazonaws.com/${bucketName}/${s3Directory}/${files[0].filename}`;                
            fs.unlink(filePath, (err) => {
                if (err) {
                    return {"Error deleting file": err}
                } else {
                    return {"File successfully deleted from server": filePath}
                }
            });
            console.log("Uploading Response:", uploadingResponse, "S3 URL:", s3Url);
                
            if (uploadingResponse === "success") {                    
                console.log("File Uploaded to S3 at:", s3Url);
                const currentDateTime = moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");
                status = "success";
                return {"status":status, "message":"Image uploaded successfully", "url":s3Url};                    
            } else {
                return {"status":500, "status":"fail", "message":"Image not uploaded"};
            }
        } catch (uploadError) {
            return {"status":500, "Error uploading to S3":uploadError, "message":"Error uploading file to S3"};
        }
    } catch (error) {
        return {"status":500, "Server error":error};
    }
}

async function getTransportersFromCustomerAssignment(account_id) {
    const [rows] = await db.promise().query(`SELECT type_detail_id FROM cv_customer_assignment WHERE status = 1 AND user_id = ?`, [account_id]);
    return rows;
}

async function getUsersFromRoleAssignment(transporter_ids) {
    const [rows] = await db.promise().query(`SELECT user_id FROM logistic_role_assignment WHERE status = 1 AND type_detail_id IN (?)`, [transporter_ids]);
    return rows;
}

async function getVehicleIdsByType(id, type) {
    // const [rows] = await db.promise().query(`SELECT vehicle_id FROM vehicle_mapping WHERE ${type}_id = ?`, [id]);
    const [rows] = await db.promise().query(`SELECT vta.vehicle_id FROM cv_transporter_assignment AS cvta LEFT JOIN vehicle_transporter_assignment AS vta ON cvta.transporter_id=vta.transporter_id WHERE cvta.status=1 AND cvta.type_id=${id} AND cvta.type='${type}'`);
    return rows.map(row => row.vehicle_id);
}

async function getTransporterVehicleIds(transporter_id) {
    const [rows] = await db.promise().query(`SELECT vehicle_id FROM vehicle_transporter_assignment WHERE transporter_id = ?`, [transporter_id]);
    return rows.map(row => row.vehicle_id);
}

async function readExcel(filePath) {    
    const workbook = xlsx.readFile(filePath);    
    const sheetName = workbook.SheetNames[0];
    return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
}

async function getDocumentTypeId() {
    const sql = "SELECT id,category,name FROM document_types WHERE status = 1";
    const [result] = await db.promise().query(sql);
    const types = {};
    
    if (result.length > 0) {    
        // return result;    
        result.forEach(value => {
            const id = value.id;
            const category = value.category;
            const name = (value.name).replace(/ /g, '_').toLowerCase();

            if (!types[category]) {
                // types[category] = [];
                types[category] = {}; // Initialize as an object
            }
            
            // types[category].push({ id, name });  
            types[category][name] = id; 
                    
        });
    }

    return types;
}

async function getDocumentNoList() {
    const sql = "SELECT id,doc_no FROM documents WHERE status IN(1,2) AND doc_no!='' AND doc_no IS NOT NULL";
    const [result] = await db.promise().query(sql);
    const documentNo_list = {};
    
    
    if (result.length > 0) { 
        result.forEach(value => {
            let id = value.id;
            let documentNo = value.doc_no;
            let documentNumer = cleanDocumentNo(documentNo);
    
            if (documentNumer) {
                documentNo_list[documentNumer] = id;
            }
        });
    }
    return documentNo_list;
}

async function getUserWiseDocuments(user_id, group_id) {
    const sql = "SELECT user_id,doc_type_id,expiry_date FROM documents WHERE status IN(1,2) AND user_id=user_id AND group_id=group_id";
    
    const [result] = await db.promise().query(sql);
    
    const UserWiseDocuments = {};
    
    if (result.length > 0) { 
        result.forEach(value => {
            const uid = value.user_id;
            const tid = value.doc_type_id;
            const edt = value.expiry_date;
    
            if (tid && !isNullDate(edt)) {
                if (!UserWiseDocuments[uid]) {
                    UserWiseDocuments[uid] = {};
                }
                UserWiseDocuments[uid][tid] = formatDate(edt);
            }
        });
    }

    return UserWiseDocuments;
}

async function getVehiclesList(key = 'vehicle_id') {
    const sql = "SELECT id AS vehicle_id, vehicle_number AS vehicle_no FROM vehicle WHERE `status`=1";
    const [result] = await db.promise().query(sql);

    const vehiclesList = {};
    if (result.length > 0) {
        result.forEach(value => {
            let vehicleId = value.vehicle_id;
            let vehicleNo = value.vehicle_no;
            vehicleNo = cleanDocumentNo(vehicleNo);

            if (key === 'vehicle_no') {
                vehiclesList[vehicleNo] = vehicleId;
            } else {
                vehiclesList[vehicleId] = vehicleNo;
            }
        });
    }

    return vehiclesList;
}

async function getDriversList(key = 'driver_id') {
    const sql = "SELECT id, name, mob_no FROM drivers WHERE `status`=1";
    const [result] = await db.promise().query(sql);

    const driverlist = {};
    if (result.length > 0) {
        result.forEach(value => {
            const driverId = value.id;
            let driverMb = value.mob_no;
            driverMb = cleanNumber(driverMb);

            if (key === 'driver_mb') {
                driverlist[driverMb] = driverId;
            } else {
                driverlist[driverId] = driverMb;
            }
        });
    }

    return driverlist;
}

function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function cleanDocumentNo(documentNo) {
    // Removing all extra characters except alphabets(A-Z), numbers(0-9), whitespace( ), hyphen(-), and slash(/)
    documentNo = documentNo.toUpperCase();
    return documentNo.replace(/[^0-9A-Z\/\-\s]/g, '');
}

function isNullDate(date) {
    return !date || date === '0000-00-00' || date === 'null';
}

function cleanNumber(num) {
    return num.replace(/[^0-9]/g, '');
}

function calculateDays(date1, date2) {
    const diff = new Date(date2) - new Date(date1);
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function cleanVehicleNo(vno) {
    vno = vno.toUpperCase();
    vno = vno.replace(/[^0-9A-Z]/g, '');
    return vno;
}

function addDocumentEntry(document) {
    const sql = "INSERT INTO documents (group_id, user_id, driver_id, vehicle_id, doc_type_id, doc_no, issue_date, expiry_date, remark, status, create_id, create_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW())";
    const result = db.query(sql, [document.group_id, document.user_id, document.driver_id, document.vehicle_id, document.doc_type_id, document.doc_no, document.issue_date, document.expiry_date, document.remark, document.user_id]);
    return { status: result.affectedRows > 0, id: result.insertId };
}