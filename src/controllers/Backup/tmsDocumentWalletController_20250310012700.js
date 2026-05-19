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

////////////////////////// TMS:Document-Wallet//////////////////////////

exports.documentWalletMaster = async (req, res) => {
    try {
        const { AccessToken } = req.body;

        if (AccessToken != null) {
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);

            /*if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    res.status(200).json(response);
            }
            else*/{
                
                // const user_id = 5659; //BluedartMaster
                // const user_id = 152867; //MasterCV
                // const user_id = 152868; // group_type=32 and user_type=24
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                const user_id = 153169; //Transporter
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

            /*if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;
                    res.status(200).json(response);
            }
            else*/{
                
                // const user_id = 5659; //BluedartMaster
                let user_id = 152867; //MasterCV
                // const user_id = 152868; // group_type=32 and user_type=24
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter

                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if(result.length>0) {                    
                    const resultUsr=result[0];
                    let user_id = resultUsr['id'];
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
                            d.issue_date AS IssueDate, 
                            d.expiry_date AS ExpiryDate, 
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
                        return res.status(501).json("Data not found");
                    }                    
                }else{
                    return res.status(501).json("Invalid Access.");
                }                 
            }
        } else {
            return res.status(501).json("payload missing"); // Send response and stop further execution
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

    try {
        const { body, files } = req; 
        let { AccessToken, GroupId, Category, DriverId, VehicleId, DocumentTypeId, DocumentTypeName, DocumentNo, IssueDate, ExpiryDate, Remark} = body;
        
        if (AccessToken != null) {
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            
            /*if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;
                    res.status(200).json(response);
            }
            else*/{
                
                // const user_id = 5659; //BluedartMaster
                let user_id = 152867; //MasterCV
                // const user_id = 152868; // group_type=32 and user_type=24
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter

                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if(result.length>0) {                    
                    const resultUsr=result[0];
                    
                    let user_id = resultUsr['id'];
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
                    
                    if (!files || !files[0] || files[0].fieldname === "") {
                        response.Message = "Field 'DocumentFile' is missing or empty.";
                        return res.status(400).json(response);
                    }

                    const uploaded = await uploadAttachment(files);
                    
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
            
            /*if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;
                    res.status(200).json(response);
            }
            else*/{
                
                // const user_id = 5659; //BluedartMaster
                let user_id = 152867; //MasterCV
                // const user_id = 152868; // group_type=32 and user_type=24
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter

                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if(result.length>0) {                    
                    const resultUsr=result[0];
                    
                    let user_id = resultUsr['id'];
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
                // const jsonStr = vehicle_id;
                
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

exports.documentRenew1255 = async (req, res) => {

    try {
         
        // let { AccessToken, DocumentId, DocumentNo, IssueDate, ExpiryDate, Remark} = req.body;
        let { AccessToken, DocumentId, DocumentTypeId, VehicleId, DriverId, DocumentNo, IssueDate, ExpiryDate, Remark} = req.body;
        
        if (AccessToken != null) {
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            
            /*if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;
                    res.status(200).json(response);
            }
            else*/{
                
                // const user_id = 5659; //BluedartMaster
                let user_id = 152867; //MasterCV
                // const user_id = 152868; // group_type=32 and user_type=24
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter

                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if(result.length>0) {                    
                    const resultUsr=result[0];
                    
                    let user_id = resultUsr['id'];
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
                    // const groupId = String(group_id);
                    const accountId = Number(user_id);

                    const document_id = Number(DocumentId);
                    // const documentTypeId = Number(DocumentTypeId);
                    // const vehicleId = Number(VehicleId) || null;
                    // const driverId = Number(DriverId) || null;
                    const documentNo = String(DocumentNo) || "null";                    
                    const issueDate = String(IssueDate) || "null";
                    const expiryDate = String(ExpiryDate) || "null";                    
                    // const filePath = new_file_path || "null";                    
                    const remark = String(Remark) || "null";
                    const status = 1;
                    // const categoryId = vehicleId ? 1 : 2;
                    
                    const [id_checking] = await db.promise().query(`SELECT d.group_id,d.driver_id,d.vehicle_id,d.doc_type_id,r.rem_category_id,r.rem_type_name FROM documents AS d INNER JOIN v2_reminders AS r ON d.id = r.document_id WHERE d.status = 1 AND d.id = ${document_id}`);
                    
                    const groupId = id_checking[0].group_id;
                    const vehicleId = id_checking[0].vehicle_id;
                    const driverId = id_checking[0].driver_id;
                    const documentTypeId = id_checking[0].doc_type_id;
                    const categoryId = id_checking[0].rem_category_id;
                    const DocumentTypeName = id_checking[0].rem_type_name;
                    res.send(groupId);
                    // $driver_id = $result['driver_id'];
                    // $vehicle_id = $result['vehicle_id'];
                    // $type_id = $result['doc_type_id'];
                    // $category_id = $result['rem_category_id'];
                    // $type_name = $result['rem_type_name'];
                    // const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                    // res.send(id_checking); 
                    // if(id_checking.length>0){
                    //     res.send('yes');
                    // }else{
                    //     res.send('invalid')
                    // }
                    if(id_checking.length>0){                        
                    
                        let sql = '';
                        let values = [];

                        const uploaded = await uploadAttachment(req.files);
                           
                        if (uploaded.status !== "success") {
                            response.Message = uploaded.Error || "File upload failed.";
                            return res.status(500).json(response);
                        }else{
                            if (!uploaded || uploaded.url !== "") {
                                new_file_path = uploaded.url;
                                const thumbfilePath = uploaded.thumbnailUrl || ''; // Provide a default value if thumbnailUrl is not available
                                    
                                let update_status = 0;

                                const sql_document = `UPDATE documents SET status=?, edit_id=?, edit_date=? WHERE id=?`;
                                const values_document = [update_status, accountId, now, document_id];
                                const [updateDocumentResult] = await db.promise().query(sql_document, values_document);

                                const sql_remider = `UPDATE v2_reminders SET status=?, edit_id=?, edit_date=? WHERE document_id=?`;
                                const values_reminder = [update_status, accountId, now, document_id];
                                const [updateRemiderResult] = await db.promise().query(sql_remider, values_reminder);
                                

                                const sql = `
                                    INSERT INTO documents (group_id, user_id, driver_id, vehicle_id, doc_type_id, doc_no, issue_date, expiry_date, file_path, thumb_path, remark, status, create_id, create_date)
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                `;
                                const values = [groupId, accountId, driverId, vehicleId, documentTypeId, documentNo, issueDate, expiryDate, new_file_path, thumbfilePath, remark, status, accountId, now];
                                
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
                                            res.send({ "insertId": insertResult2 });
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
                                res.send({"updateDocumentResult":updateDocumentResult,"updateRemiderResult":updateRemiderResult,"insert_documents":insertResult});
                            }
                        }

                    }

                    
                    if(id_checking.length>0){
                        res.send('yes');
                    }else{
                        res.send('invalid')
                    }
                    res.send(id_checking);
                    
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

exports.documentRenew123 = async (req, res) => {

    try {
         
        let { AccessToken, DocumentId, DocumentTypeId, VehicleId, DriverId, DocumentNo, IssueDate, ExpiryDate, Remark} = req.body;
        
        if (AccessToken != null) {
            const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            
            /*if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;
                    res.status(200).json(response);
            }
            else*/{
                
                // const user_id = 5659; //BluedartMaster
                let user_id = 152867; //MasterCV
                // const user_id = 152868; // group_type=32 and user_type=24
                // const user_id = 185301; // Master Not groupId=32
                // const user_id = 256; // Master Not groupId=32
                // const user_id = 151086 // Master Not groupId=32
                // const user_id = 153169; //Transporter
                res.send(user_id);
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                
                if(result.length>0) {                    
                    const resultUsr=result[0];
                    
                    const user_id = resultUsr['id'];
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

                    // let { AccessToken, DocumentId, DocumentTypeId, VehicleId, DriverId, DocumentNo, IssueDate, ExpiryDate, Remark} = req.body;
                    // Prepare data for updation
                    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    const groupId = String(group_id);
                    const accountId = Number(user_id);
                    res.send(accountId);
                    const document_id = DocumentId; 
                    const documentTypeId = Number(DocumentTypeId);
                    const vehicleId = Number(VehicleId) || null; 
                    const driverId = Number(DriverId) || null;
                    const documentNo = String(DocumentNo) || "null";                    
                    const issueDate = String(IssueDate) || "null";
                    const expiryDate = String(ExpiryDate) || "null";               
                    const remark = String(Remark) || "null";
                    // const categoryId = 
                    const status = 1;
                    
                    // const categoryId = driverId != null ? 1 : 2; // 1 for vehicle, 2 for driver
                    
                    const [id_checking] = await db.promise().query(`SELECT d.group_id,d.driver_id,d.vehicle_id,d.doc_type_id,r.rem_category_id,r.rem_type_name FROM documents AS d INNER JOIN v2_reminders AS r ON d.id = r.document_id WHERE d.status = 1 AND d.id = ${document_id}`);
                    
                    if(id_checking.length>0){                        
                    
                        let sql = '';
                        let values = [];

                        const uploaded = await uploadAttachment(req.files);
                            
                        if (uploaded.status !== "success") {
                            response.Message = uploaded.Error || "File upload failed.";
                            return res.status(500).json(response);
                        }else{
                            if (!uploaded || uploaded.url !== "") {
                                new_file_path = uploaded.url;
                                const thumbfilePath = uploaded.thumbnailUrl || ''; // Provide a default value if thumbnailUrl is not available
                                    
                                let update_status = 0;

                                const sql_document = `UPDATE documents SET status=?, edit_id=?, edit_date=? WHERE id=?`;
                                const values_document = [update_status, accountId, now, document_id];
                                const [updateDocumentResult] = await db.promise().query(sql_document, values_document);

                                const sql_remider = `UPDATE v2_reminders SET status=?, edit_id=?, edit_date=? WHERE document_id=?`;
                                const values_reminder = [update_status, accountId, now, document_id];
                                const [updateRemiderResult] = await db.promise().query(sql_remider, values_reminder);

                                const sql = `
                                    INSERT INTO documents (group_id, user_id, driver_id, vehicle_id, doc_type_id, doc_no, issue_date, expiry_date, file_path, thumb_path, remark, status, create_id, create_date)
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                `;
                                const values = [groupId, accountId, driverId, vehicleId, documentTypeId, documentNo, issueDate, expiryDate, filePath, thumbfilePath, remark, status, accountId, now];
                
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
                            }
                                
                        }

                        sql = `UPDATE documents SET doc_no=?, issue_date=?, expiry_date=?, file_path=?, remark=?, edit_id=?, edit_date=? WHERE id=?`;
                        values = [documentNo, issueDate, expiryDate, new_file_path, remark, accountId, now, document_id];
                        

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
                        return res.status(501).json("Invalid document id.");
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