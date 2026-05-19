const { json } = require("body-parser");
const db = require("../config/db");
const {passenc}= require("../helpers/pass_enc");
const mongu =require("../lib/mongo/mongo_api");
// const cassCon = require("../lib/cassandra-lib/libLog");
// const tokenMobile= require("../helpers/access_token_mobile"); // MOBILE ACCESS_TOKEN
const tokenWeb= require("../helpers/access_token_web");
const uploadS3 = require("./components/uploadS3Component");
const Kyccomponent = require("./components/KYCComponent");
// const s3 = require("../lib/aws-lib/s3")
const { format, subHours, differenceInSeconds } = require('date-fns');
const moment = require('moment-timezone');
const dayjs = require('dayjs');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const FormData = require("form-data");
const crypto = require("crypto");
const { parseCookie } = require("undici-types");





const testurl ="https://test.zoop.one/api/v1/" 
const APP_ID = "68b9928d9e0d1e0028a6ec21";
const API_KEY = "NXFZM42-T4PM25M-KTK25GW-3XE43CC";
const task_id = crypto.randomUUID();

const headers = {
    "app-id": APP_ID,
    "api-key": API_KEY,
    "Content-Type": "application/json",
};




exports. vehicleKyc = async (req, res) => {
    const {AccessToken,DeveloperOption,DeveloperOptionId,vehicle_number} = req.body;
    let resData = { Status: "fail" };
    res.send(vehicle_number);process.exit(0);
    try {
        if(AccessToken!=null){
            let user_info ={};
            const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday)
            {
                
                user_info.Status=1;                
                user_info.AccountId=DeveloperOptionId;
            }
            else
            {
                 user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            }
            //const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    final_data.Message=user_info.Message;
                    res.status(200).json(final_data);
            }
            else{
                const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                if (result.length > 0) {
                    const resultUsr=result[0];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name']; 
                }

                res.send(result);process.exit(0);
            
        // const { vehicle_number, user_id } = req.body;

        // 🔹 1. Check User (SQL)
        const [user] = await db.promise().query(
            "SELECT id FROM user WHERE id=? AND status=?",
            [user_id, 1]
        );

        if (user.length === 0) {
            resData.Message = "Invalid user";
            return res.json(resData);
        }

        // 🔹 2. Insert into kyc_request
        const [kycInsert] = await db.promise().query(
            `INSERT INTO kyc_request 
            (vehicle_number, vendor_name, request_for, user_request, vendor_request, status, create_id, create_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                vehicle_number,
                "zoop",
                "vehicle",
                1,
                0,
                1,
                user_id,
                moment().tz("Asia/Calcutta").format("YYYY-MM-DD HH:mm:ss")
            ]
        );

        const today = moment();

        // 🔹 3. Mongo check (latest active)
        let condition = { vehicle_number, status: 1 };

        const existingData = await mongu.getMongoQuery(
            condition,
            {
                projection: {
                    vehicle_number: 1,
                    owner_name: 1,
                    documents: 1,
                    created_at: 1,
                    _id: 1
                },
                sort: { created_at: -1 },
                limit: 1
            },
            "raw_vehicle_data"
        );

        let record = existingData?.[0] || null;

        // 🔍 expiry check function
        const isValidDocs = (docs = []) => {
            return docs.every(d => moment(d.expiry_date).isAfter(today));
        };

        // ============================
        // 🔹 CASE 1: DATA EXISTS
        // ============================
        if (record) {

            const valid = isValidDocs(record.documents);

            // ✅ सब valid → return
            if (valid) {
                resData.Status = "success";
                resData.source = "cache";
                resData.data = formatResponse(record);
                return res.json(resData);
            }

            // ❌ expired → status 0 update
            await mongu.updateMongoQuery(
                { _id: record._id },
                { status: 0 },
                "raw_vehicle_data"
            );

            // 🔹 Zoop Call
            const freshData = await callZoop(vehicle_number, user_id);

            const insertData = await mongu.insertLocalMongoQuery(
                freshData,
                "raw_vehicle_data"
            );

            // update vendor_request = 1
            await db.promise().query(
                "UPDATE kyc_request SET vendor_request=? WHERE id=?",
                [1, kycInsert.insertId]
            );

            resData.Status = "success";
            resData.source = "zoop";
            resData.data = formatResponse(freshData);
            return res.json(resData);
        }

        // ============================
        // 🔹 CASE 2: NO DATA
        // ============================

        const freshData = await callZoop(vehicle_number, user_id);

        const insertData = await mongu.insertLocalMongoQuery(
            freshData,
            "raw_vehicle_data"
        );

        await db.promise().query(
            "UPDATE kyc_request SET vendor_request=? WHERE id=?",
            [1, kycInsert.insertId]
        );

        resData.Status = "success";
        resData.source = "zoop";
        resData.data = formatResponse(freshData);
        return res.json(resData);
        }
        }
    } catch (error) {
        console.error(error);
        resData.Message = "Internal Server Error";
        return res.status(500).json(resData);
    }
};


exports.dlverification = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        // const {AccessToken,DeveloperOption,DeveloperOptionId,customer_id} = req.body;
        let response ={};
        let final_data = {};
        final_data.Status="fail";
        // if(AccessToken!=null){
        //     let user_info ={};
        //     const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
        //     if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday)
        //     {
                
        //         user_info.Status=1;                
        //         user_info.AccountId=DeveloperOptionId;
        //     }
        //     else
        //     {
        //          user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        //     }
        //     //const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        //     if (user_info && user_info.Status === 2) {
        //             response.Result = user_info.Result;
        //             response.Message = user_info.Message;

        //             final_data.Message=user_info.Message;
        //             res.status(200).json(final_data);
        //     }
        //     else{
        //         const user_id = user_info.AccountId;
        //         const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
        //         if (result.length > 0) {
        //             const resultUsr=result[0];
        //             const user_type= resultUsr['user_type'];
        //             const self_group_id= resultUsr['group_id'];
        //             const group_id =resultUsr['group_id'];
        //             const group_type= resultUsr['group_type'];
        //             const name= resultUsr['name']; 
        //         }
        //     res.status(200).json(response);  
        //     }
        // }

        // const APP_ID = "68b9928d9e0d1e0028a6ec21";
        // const API_KEY = "NXFZM42-T4PM25M-KTK25GW-3XE43CC";

        const { customer_dl_number, name_to_match, customer_dob } = req.body;

        // Basic input validation
        if (!customer_dl_number || !name_to_match || !customer_dob) {
            return res.status(400).json({ error: "Missing required fields." });
        }
        const dldata = await Kyccomponent.getDLVerificationData(customer_dl_number,name_to_match,customer_dob)
        
        // Build request body
        // const body = {
        //     mode: "sync",
        //     data: {
        //         customer_dl_number,
        //         name_to_match,
        //         customer_dob,
        //         consent: "Y",
        //         consent_text:
        //         "I hereby declare my consent agreement for fetching my information via ZOOP API",
        //     },
        //     task_id: task_id,
        // };

        // // Make POST request using axios
        // const apiresponse = await axios.post(
        //     testurl+"in/identity/dl/advance",
        //     body,
        //     { headers }
        // );
        // console.log(apiresponse)
        // Forward Zoop API response
        res.status(200).json(dldata.data);

    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};


exports.panadvance = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        // const {AccessToken,DeveloperOption,DeveloperOptionId,customer_id} = req.body;
        let response ={};
        let final_data = {};
        final_data.Status="fail";
        // if(AccessToken!=null){
        //     let user_info ={};
        //     const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
        //     if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday)
        //     {
                
        //         user_info.Status=1;                
        //         user_info.AccountId=DeveloperOptionId;
        //     }
        //     else
        //     {
        //          user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        //     }
        //     //const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        //     if (user_info && user_info.Status === 2) {
        //             response.Result = user_info.Result;
        //             response.Message = user_info.Message;

        //             final_data.Message=user_info.Message;
        //             res.status(200).json(final_data);
        //     }
        //     else{
        //         const user_id = user_info.AccountId;
        //         const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
        //         if (result.length > 0) {
        //             const resultUsr=result[0];
        //             const user_type= resultUsr['user_type'];
        //             const self_group_id= resultUsr['group_id'];
        //             const group_id =resultUsr['group_id'];
        //             const group_type= resultUsr['group_type'];
        //             const name= resultUsr['name']; 
        //         }
        //     res.status(200).json(response);  
        //     }
        // }
        

        const { customer_pan_number, pan_holder_name } = req.body;

        // Basic input validation
        if (!customer_pan_number || !pan_holder_name) {
          return res.status(400).json({ error: "Missing required fields." });
        }
        const pandata = await Kyccomponent.getPANAdvanceData(customer_pan_number, pan_holder_name)
       

        // const body = {
        //     mode: "sync",
        //     data: {
        //       customer_pan_number,
        //       pan_holder_name,
        //       consent: "Y",
        //       consent_text:
        //         "I hereby declare my consent agreement for fetching my information via ZOOP API",
        //     },
        //     task_id: task_id,
        // };

        // // Make POST request using axios
        // const apiresponse = await axios.post(
        //     testurl+"in/identity/pan/advance",
        //     body,
        //     { headers }
        // );
        // console.log(apiresponse)
        // Forward Zoop API response
        res.status(200).json(pandata.data);

    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};





exports.passportadvance = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        // const {AccessToken,DeveloperOption,DeveloperOptionId,customer_id} = req.body;
        let response ={};
        let final_data = {};
        final_data.Status="fail";
        // if(AccessToken!=null){
        //     let user_info ={};
        //     const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
        //     if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday)
        //     {
                
        //         user_info.Status=1;                
        //         user_info.AccountId=DeveloperOptionId;
        //     }
        //     else
        //     {
        //          user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        //     }
        //     //const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        //     if (user_info && user_info.Status === 2) {
        //             response.Result = user_info.Result;
        //             response.Message = user_info.Message;

        //             final_data.Message=user_info.Message;
        //             res.status(200).json(final_data);
        //     }
        //     else{
        //         const user_id = user_info.AccountId;
        //         const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
        //         if (result.length > 0) {
        //             const resultUsr=result[0];
        //             const user_type= resultUsr['user_type'];
        //             const self_group_id= resultUsr['group_id'];
        //             const group_id =resultUsr['group_id'];
        //             const group_type= resultUsr['group_type'];
        //             const name= resultUsr['name']; 
        //         }
        //     res.status(200).json(response);  
        //     }
        // }
        

        const { customer_file_number, name_to_match, customer_dob } = req.body;

        // Basic input validation
        if (!customer_file_number || !name_to_match || !customer_dob) {
          return res.status(400).json({ error: "Missing required fields." });
        }
        const passportdata = await Kyccomponent.getPassportAdvanceData(customer_file_number, name_to_match, customer_dob)
        console.log(passportdata)
        // process.exit(0)

        // const body = {
        //     mode: "sync",
        //     data: {
        //       customer_file_number,
        //       name_to_match,
        //       customer_dob,
        //       consent: "Y",
        //       consent_text:
        //         "I hereby declare my consent agreement for fetching my information via ZOOP API",
        //     },
        //     task_id: "f26eb21e-4c35-4491-b2d5-41fa0e545a34",
        // };

        // // Make POST request using axios
        // const apiresponse = await axios.post(
        //     testurl+"in/identity/passport/advance",
        //     body,
        //     { headers }
        // );
        // console.log(apiresponse)
        // Forward Zoop API response
        // res.status(200).json(passportdata);
        res.status(200).json(passportdata.data);

    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};


exports.voteridadvance = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        // const {AccessToken,DeveloperOption,DeveloperOptionId,customer_id} = req.body;
        let response ={};
        let final_data = {};
        final_data.Status="fail";
        // if(AccessToken!=null){
        //     let user_info ={};
        //     const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
        //     if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday)
        //     {
                
        //         user_info.Status=1;                
        //         user_info.AccountId=DeveloperOptionId;
        //     }
        //     else
        //     {
        //          user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        //     }
        //     //const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        //     if (user_info && user_info.Status === 2) {
        //             response.Result = user_info.Result;
        //             response.Message = user_info.Message;

        //             final_data.Message=user_info.Message;
        //             res.status(200).json(final_data);
        //     }
        //     else{
        //         const user_id = user_info.AccountId;
        //         const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
        //         if (result.length > 0) {
        //             const resultUsr=result[0];
        //             const user_type= resultUsr['user_type'];
        //             const self_group_id= resultUsr['group_id'];
        //             const group_id =resultUsr['group_id'];
        //             const group_type= resultUsr['group_type'];
        //             const name= resultUsr['name']; 
        //         }
        //     res.status(200).json(response);  
        //     }
        // }
        

        const { customer_epic_number, name_to_match } = req.body;

        // Basic validation
        if (!customer_epic_number || !name_to_match) {
        return res.status(400).json({ error: "Missing required fields." });
        }
        const voteriddata = await Kyccomponent.getVoterIdAdvanceData(customer_file_number,customer_epic_number, name_to_match)
        process.exit(0)

        // const body = {
        //     data: {
        //       customer_epic_number,
        //       name_to_match,
        //       consent: "Y",
        //       consent_text:
        //         "I hereby declare my consent agreement for fetching my information via ZOOP API.",
        //     },
        //     task_id: "d15a2a3b-9989-46ef-9b63-e24728292dc0",
        // };

        // // Make POST request using axios
        // const apiresponse = await axios.post(
        //     testurl+"in/identity/voter/advance",
        //     body,
        //     { headers }
        // );
        // console.log(apiresponse)
        // Forward Zoop API response
        res.status(200).json(apiresponse.data);

    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};



exports.rcadvance = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        const {AccessToken,DeveloperOption,DeveloperOptionId} = req.body;
        let response ={};
        let final_data = {};
        final_data.status="fail";
        if(AccessToken!=null){
            let user_info ={};
            const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday)
            {
                
                user_info.Status=1;                
                user_info.AccountId=DeveloperOptionId;
            }
            else
            {
                 user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            }
            //const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            if (user_info && user_info.Status === 2) {
                    response.Result = user_info.Result;
                    response.Message = user_info.Message;

                    final_data.Message=user_info.Message;
                    res.status(200).json(final_data);
            }
            else{
                const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                if (result.length > 0) {
                    const resultUsr=result[0];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    const name= resultUsr['name']; 
                
                    // console.log(resultUsr)

                    let { vehicle_registration_number } = req.body;

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

                    // console.log(vehicleCategory_bin)
                    // console.log(vehicleMake_bin)
                    // console.log(vehicleModel_bin)
                    // console.log(vehicleBodyType_bin)
                    // console.log(vehicleCapacity_bin)
                    // console.log(vehicleFuelType_bin)

                    vehicle_registration_number = vehicle_registration_number.toUpperCase()

                    const tableP = "kyc_vehicle_details"
                    const conditionsP = {}
                    const fieldsP = { projection: { _id: 0 } }
                    conditionsP.rc_registration_number = vehicle_registration_number
                    // console.log(conditionsP);
                    // process.exit(0);

                    let vehicledetails = await mongu.getCVMongoQuery(conditionsP,fieldsP,tableP)
                    // console.log(vehicledetails);

                    if (vehicledetails.length > 0){
                        console.log("exists");
                        
                        [expirycheck] = await checkexpiry(vehicledetails)

                        console.log(expirycheck.expireddoc.length)
                        // if (expirycheck.expireddoc.length > 0){}

                        let ids = []

                        const vehiclemake = await getOrInsertValue(vehicledetails[0].vehicle_maker_description, vehicleMake_bin, "vehicle_make", db,ids,vehicledetails)
                        const fueltype = await getOrInsertValue(vehicledetails[0].vehicle_fuel_description, vehicleFuelType_bin, "fuel_type", db,ids,vehicledetails)
                        const vehiclecatagory = await getOrInsertValue(vehicledetails[0].vehicle_class_description, vehicleCategory_bin, "vehicle_category", db,ids,vehicledetails)
                        ids = [Object.keys(vehiclemake)[0],Object.keys(vehiclecatagory)[0]]
                        const vehiclemodel = await getOrInsertValue(vehicledetails[0].vehicle_make_model, vehicleModel_bin, "vehicle_model", db,ids,vehicledetails)
                        // console.log(fueltype)
                        // console.log(vehiclemake)
                        // console.log(vehiclecatagory)
                        // console.log(vehiclemodel)
                        // process.exit(0)
                        vehdata = vehicledetails[0]
                        insurancedata = vehicledetails[0].insurance
                        response_data = {
                            vehiclemake,
                            fueltype,
                            vehiclecatagory,
                            vehiclemodel,
                            registration_no:vehdata.rc_registration_number,
                            rc:{doc_no:vehdata.rc_registration_number,IssueDate:vehdata.rc_registration_date,ExpiryDate:vehdata.rc_expiry_date},
                            puc:{doc_no:vehdata.rc_pucc_no,IssueDate:"",ExpiryDate:vehdata.rc_pucc_expiry_date},
                            permit:{doc_no:vehdata.national_permit_number,IssueDate:vehdata.national_permit_issued_by,ExpiryDate:vehdata.national_permit_expiry_date},
                            insurance:{doc_no:insurancedata.policy_number,IssueDate:"",ExpiryDate:insurancedata.expiry_date},
                            fitness:{doc_no:"",IssueDate:"",ExpiryDate:vehdata.rc_fit_upto},

                        }
                        
                        final_data.status = "success"
                        final_data.data = response_data
                        return res.status(200).json(final_data); 

                    }
                    else{
                        console.log("NOT");
                        return res.status(200).json("final_data"); 
                        process.exit(0)
                        // let rcdataa ={
                        //     "request_id": "86103be8-5b7f-4bc3-86f1-1d61e6bfceb3",
                        //     "task_id": "e5d5196a-1c1c-4496-a2a4-33672bbbd8e2",
                        //     "group_id": "40c695a8-1d54-4ceb-a112-0aba12eab4d2",
                        //     "success": true,
                        //     "response_code": "100",
                        //     "response_message": "Valid Authentication",
                        //     "metadata": {
                        //         "billable": "Y"
                        //     },
                        //     "result": {
                        //         "rc_blacklist_status": "NA",
                        //         "body_type_description": "SOLO",
                        //         "rc_chassis_number": "ME4JF505BGT065686",
                        //         "father_name": "NA",
                        //         "financer": "NA",
                        //         "insurance": {
                        //             "company": "The New India Assurance Company Limited",
                        //             "company_id": "NA",
                        //             "expiry_date": "24-Feb-2026",
                        //             "policy_number": "42011031240100001908"
                        //         },
                        //         "national_permit_expiry_date": "NA",
                        //         "national_permit_issued_by": "NA",
                        //         "national_permit_number": "NA",
                        //         "norms_description": "BHARAT STAGE II",
                        //         "vehicle_owner_number": "1",
                        //         "user_first_name": "NA",
                        //         "user_second_name": "NA",
                        //         "pincode": "NA",
                        //         "user_permanent_address": "H NO-G-3005 AWAS VIKAS,-1 KALYANPUR KANPUR,KANPUR,999999",
                        //         "rc_engine_number": "JF50ET3066025",
                        //         "rc_expiry_date": "23-Feb-2031",
                        //         "rc_fit_upto": "23-Feb-2031",
                        //         "rc_noc_details": "NA",
                        //         "rc_permit_expiry_date": "NA",
                        //         "rc_permit_issued_date": "NA",
                        //         "rc_permit_number": "NA",
                        //         "rc_permit_start_date": "NA",
                        //         "rc_permit_type": "NA",
                        //         "rc_pucc_expiry_date": "NA",
                        //         "rc_pucc_no": "NA",
                        //         "rc_registration_date": "24-Feb-2016",
                        //         "rc_registration_location": "KANPUR NAGAR, Uttar Pradesh",
                        //         "rc_registration_number": "UP78EE8329",
                        //         "rc_state_code": "UP",
                        //         "rc_status": "ACTIVE",
                        //         "rc_status_as_on": "07-Oct-2025",
                        //         "rc_tax_upto": "21-Feb-2031",
                        //         "rc_source": "P",
                        //         "user_name": "DEEPAK DWIVEDI ",
                        //         "user_present_address": "H NO-G-3005 AWAS VIKAS,-1 KALYANPUR KANPUR,KANPUR,999999",
                        //         "vehicle_category": "2WN",
                        //         "vehicle_class_description": "M-Cycle/Scooter(2WN)",
                        //         "vehicle_color": "BLACK",
                        //         "vehicle_cubic_capacity": "109",
                        //         "vehicle_fuel_description": "PETROL",
                        //         "vehicle_gross_weight": "269",
                        //         "vehicle_make_model": "ACTIVA 3G",
                        //         "vehicle_maker_description": "HONDA MOTORCYCLE AND SCOOTER INDIA (P) LTD",
                        //         "vehicle_manufactured_date": "01/2016",
                        //         "vehicle_number_of_cylinders": "1",
                        //         "vehicle_seating_capacity": "2",
                        //         "vehicle_sleeper_capacity": "NA",
                        //         "vehicle_stand_capacity": "NA",
                        //         "vehicle_unladen_weight": "108",
                        //         "vehicle_wheelbase": "1238",
                        //         "vehicle_type": "2W",
                        //         "rc_commercial_status": "NO",
                        //         "rc_rto_code": "UP-78",
                        //         "vehicle_financed": "NA",
                        //         "month_year_remaining_for_insurance_exp": "NA",
                        //         "insurance_expired": "N",
                        //         "vehicle_fitness_expired": "N",
                        //         "vehicle_age": "9 years 7 months",
                        //         "city": "Kanpur",
                        //         "state": "UttarPradesh",
                        //         "invoice_info": {
                        //             "purchase_date": "NA",
                        //             "purchase_amount": "NA",
                        //             "dealer_name": "NA",
                        //             "dealer_address": "NA"
                        //         },
                        //         "pdf_profile_file": "NA",
                        //         "vehicle_category_description": "TW"
                        //     },
                        //     "request_timestamp": "2025-10-07T10:18:08.243Z",
                        //     "response_timestamp": "2025-10-07T10:18:10.729Z"
                        // }
                        if (!vehicle_registration_number) {
                             return res.status(400).json({ error: "Missing required field: vehicle_registration_number" });
                        }
                        const rcdata = await Kyccomponent.getRCAdvanceData(vehicle_registration_number)
                        console.log(rcdata)
                        console.log("raw data -",rcdata.data)
                        let chkdata = rcdata.data
                        if(chkdata.response_code == "100"){

                            let finalData = rcdata.data;
                            if (finalData.result && typeof finalData.result === "object") {
                                finalData = { ...finalData, ...finalData.result };
                                delete finalData.result; // remove the nested key
                            }
                            finalData.created_date = dateToday;
                            finalData.status = 1;
                            console.log("final-",finalData)
                                        
                            const insertrc = await  mongu.insertCVMongoQuery(finalData, tableP)
                            vehicledetails = [finalData]
                            let ids = []

                            const vehiclemake = await getOrInsertValue(vehicledetails[0].vehicle_maker_description, vehicleMake_bin, "vehicle_make", db,ids,vehicledetails)
                            const fueltype = await getOrInsertValue(vehicledetails[0].vehicle_fuel_description, vehicleFuelType_bin, "fuel_type", db,ids,vehicledetails)
                            const vehiclecatagory = await getOrInsertValue(vehicledetails[0].vehicle_class_description, vehicleCategory_bin, "vehicle_category", db,ids,vehicledetails)
                            ids = [Object.keys(vehiclemake)[0],Object.keys(vehiclecatagory)[0]]
                            const vehiclemodel = await getOrInsertValue(vehicledetails[0].vehicle_make_model, vehicleModel_bin, "vehicle_model", db,ids,vehicledetails)
                            // console.log(fueltype)
                            // console.log(vehiclemake)
                            // console.log(vehiclecatagory)
                            // console.log(vehiclemodel)
                            // process.exit(0)
                            vehdata = vehicledetails[0]
                            insurancedata = vehicledetails[0].insurance
                            response_data = {
                                vehiclemake,
                                fueltype,
                                vehiclecatagory,
                                vehiclemodel,
                                registration_no:vehdata.rc_registration_number,
                                rc:{doc_no:vehdata.rc_registration_number,IssueDate:vehdata.rc_registration_date,ExpiryDate:vehdata.rc_expiry_date},
                                puc:{doc_no:vehdata.rc_pucc_no,IssueDate:"",ExpiryDate:vehdata.rc_pucc_expiry_date},
                                permit:{doc_no:vehdata.national_permit_number,IssueDate:vehdata.national_permit_issued_by,ExpiryDate:vehdata.national_permit_expiry_date},
                                insurance:{doc_no:insurancedata.policy_number,IssueDate:"",ExpiryDate:insurancedata.expiry_date},
                                fitness:{doc_no:"",IssueDate:"",ExpiryDate:vehdata.rc_fit_upto},

                            }
                            final_data.status = "success"
                            final_data.data = response_data
                            return res.status(200).json(final_data);
                        }
                        else{
                            final_data.message=chkdata.response_message
                            return res.status(200).json(final_data);

                        }
                    }
                    // process.exit(0)
                    // res.status(200).json(rcdata.data);
                }
                return res.status(200).json(final_data);  
            }
        }

    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};



async function checkexpiry(vehicledetails) {

    const today = moment().tz("Asia/Calcutta").startOf("day");
    const expirycheck = vehicledetails.map((v) => {
        const checkDate = (dateStr) => {
            if (!dateStr || dateStr === "NA") return { expired: true, valid: false };
            const expiry = moment(dateStr, ["DD-MMM-YYYY", "DD-MM-YYYY", "YYYY-MM-DD"]);
            if (!expiry.isValid()) return { expired: false, valid: false };
    
            const expired = expiry.isBefore(today);
            const daysLeft = expiry.diff(today, "days");
    
            return { expired, valid: true, expiry: expiry.format("YYYY-MM-DD"), daysLeft };
        };
    
        const insuranceCheck = checkDate(v.insurance?.expiry_date);
        const rcCheck = checkDate(v.rc_expiry_date);
        const fitCheck = checkDate(v.rc_fit_upto);
        const puccheck = checkDate(v.rc_pucc_expiry_date);
        
        const allChecks = [insuranceCheck, rcCheck, fitCheck, puccheck];
        const expiredList = allChecks.filter((x) => x.expired === true);
        const notAvailableList = allChecks.filter((x) => x.valid === false);
        

        return {
            insurance_expired: insuranceCheck,
            rc_expired: rcCheck,
            fit_expired: fitCheck,
            puc_expired: puccheck,
            expireddoc:expiredList,
            invalid:notAvailableList
        };
        });
        

    return expirycheck
}


async function getOrInsertValue(value, bin, tableName, db,ids,details) {
    if (!value || value === "NA") return null;

    const createdate = moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");
  
    // Trim and normalize
    const normalizedValue = value.trim();
  
    // Check if it exists in local bin
    for (const [id, name] of Object.entries(bin)) {
      if (name.toLowerCase() === normalizedValue.toLowerCase()) {
        // return { [id]: name };
        return { id: id,name:name };
      }
    }

    // console.log(value)
    // process.exit(0)
  
    //  If not found, insert new record
    if (tableName =="vehicle_make"){
        const sql_make = `INSERT INTO vehicle_make (name, status,  create_id, create_date
            ) VALUES (?, ?, ?, ?)`;

        const values_make = [normalizedValue,1,1,createdate];

        const [makeInsert] = await db.promise().query(sql_make, values_make);
        const newId = makeInsert.insertId;
        // return { [newId]: normalizedValue };
        return { id: newId,name:normalizedValue };
    }

    if (tableName =="fuel_type"){
            // console.log("enter")
            // process.exit(0)
            const sql = `
                INSERT INTO fuel_type(name, status, create_date, create_id)
                VALUES (?, ?, ?, ?)
                `;

                const values = [normalizedValue, 1, createdate, 1];

                const [fueltypeinsert] = await db.promise().query(sql, values);
                const fueltypeid = fueltypeinsert.insertId;
        // return { [fueltypeid]: normalizedValue };
        return { id: fueltypeid,name:normalizedValue };
    }

    if(tableName =="vehicle_category"){
        const sql_category = `
                INSERT INTO vehicle_category (name, code,status, create_id, create_date
                ) VALUES (?, ?, ?, ?, ?)`;

                const values_category = [normalizedValue,details[0].vehicle_category,1,1,createdate];

                const [catInsert] = await db.promise().query(sql_category, values_category);
                const categoryId = catInsert.insertId;
                // return { [categoryId]: normalizedValue };
                return { id: categoryId,name:normalizedValue };

    }

     if(tableName =="vehicle_model"){
        
        const sql_model = `
        INSERT INTO vehicle_model (vehicle_category_id, vehicle_make_id, model_number, model_year, status, create_id, create_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const values_model = [ids[1],ids[0], normalizedValue,details[0].vehicle_manufactured_date,1,1,createdate];

        const [modelInsert] = await db.promise().query(sql_model, values_model);
        const modelId = modelInsert.insertId;
        // return { [modelId]: normalizedValue };
        return { id: modelId,name:normalizedValue };
     }
  
  }
  






































// //////////////////////////////////////////////not used products /////////////////////////////////////




exports.rclite = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        // const {AccessToken,DeveloperOption,DeveloperOptionId,customer_id} = req.body;
        let response ={};
        let final_data = {};
        final_data.Status="fail";
        // if(AccessToken!=null){
        //     let user_info ={};
        //     const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
        //     if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday)
        //     {
                
        //         user_info.Status=1;                
        //         user_info.AccountId=DeveloperOptionId;
        //     }
        //     else
        //     {
        //          user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        //     }
        //     //const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        //     if (user_info && user_info.Status === 2) {
        //             response.Result = user_info.Result;
        //             response.Message = user_info.Message;

        //             final_data.Message=user_info.Message;
        //             res.status(200).json(final_data);
        //     }
        //     else{
        //         const user_id = user_info.AccountId;
        //         const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
        //         if (result.length > 0) {
        //             const resultUsr=result[0];
        //             const user_type= resultUsr['user_type'];
        //             const self_group_id= resultUsr['group_id'];
        //             const group_id =resultUsr['group_id'];
        //             const group_type= resultUsr['group_type'];
        //             const name= resultUsr['name']; 
        //         }
        //     res.status(200).json(response);  
        //     }
        // }
        

        const { vehicle_registration_number } = req.body;

        // Basic input validation
        if (!vehicle_registration_number) {
          return res.status(400).json({ error: "Missing required field: vehicle_registration_number" });
        }
        console.log(headers)
        console.log(task_id);
        res.status(200).json(testurl+"in/vehicle/rc/lite");
        process.exit(0)
        // Build request headers
        // let data = new FormData();

        const body = {
            mode: "sync",
            data: {
              vehicle_registration_number,
              consent: "Y",
              consent_text:
                "I hereby declare my consent agreement for fetching my information via ZOOP API.",
            },
            task_id: task_id,
        };

        // Make POST request using axios
        const apiresponse = await axios.post(
            testurl+"in/vehicle/rc/lite",
            body,
            { headers }
        );
        console.log(apiresponse)
        // Forward Zoop API response
        res.status(apiresponse.status).json(apiresponse.data);

    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};



exports.gstadvance = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        // const {AccessToken,DeveloperOption,DeveloperOptionId,customer_id} = req.body;
        let response ={};
        let final_data = {};
        final_data.Status="fail";
        // if(AccessToken!=null){
        //     let user_info ={};
        //     const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
        //     if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday)
        //     {
                
        //         user_info.Status=1;                
        //         user_info.AccountId=DeveloperOptionId;
        //     }
        //     else
        //     {
        //          user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        //     }
        //     //const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        //     if (user_info && user_info.Status === 2) {
        //             response.Result = user_info.Result;
        //             response.Message = user_info.Message;

        //             final_data.Message=user_info.Message;
        //             res.status(200).json(final_data);
        //     }
        //     else{
        //         const user_id = user_info.AccountId;
        //         const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
        //         if (result.length > 0) {
        //             const resultUsr=result[0];
        //             const user_type= resultUsr['user_type'];
        //             const self_group_id= resultUsr['group_id'];
        //             const group_id =resultUsr['group_id'];
        //             const group_type= resultUsr['group_type'];
        //             const name= resultUsr['name']; 
        //         }
        //     res.status(200).json(response);  
        //     }
        // }
        

        const { business_gstin_number, financial_year } = req.body;

        // Basic input validation
        if (!business_gstin_number) {
          return res.status(400).json({ error: "Missing required GSTIN number." });
        }
        console.log(headers)
        console.log(task_id);
        res.status(200).json(testurl+"in/merchant/gstin/advance");
        process.exit(0)
        // Build request headers
        // let data = new FormData();

        const body = {
            mode: "sync",
            data: {
                business_gstin_number,
                contact_info: true,
                financial_year: financial_year || "2023-24",
                consent: "Y",
                consent_text:
                  "I hereby declare my consent agreement for fetching my information via ZOOP API.",
              },
            task_id: task_id,
        };

        // Make POST request using axios
        const apiresponse = await axios.post(
            testurl+"in/merchant/gstin/advance",
            body,
            { headers }
        );
        console.log(apiresponse)
        // Forward Zoop API response
        res.status(apiresponse.status).json(apiresponse.data);

    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};


exports.gstlite = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        // const {AccessToken,DeveloperOption,DeveloperOptionId,customer_id} = req.body;
        let response ={};
        let final_data = {};
        final_data.Status="fail";
        // if(AccessToken!=null){
        //     let user_info ={};
        //     const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
        //     if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday)
        //     {
                
        //         user_info.Status=1;                
        //         user_info.AccountId=DeveloperOptionId;
        //     }
        //     else
        //     {
        //          user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        //     }
        //     //const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        //     if (user_info && user_info.Status === 2) {
        //             response.Result = user_info.Result;
        //             response.Message = user_info.Message;

        //             final_data.Message=user_info.Message;
        //             res.status(200).json(final_data);
        //     }
        //     else{
        //         const user_id = user_info.AccountId;
        //         const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
        //         if (result.length > 0) {
        //             const resultUsr=result[0];
        //             const user_type= resultUsr['user_type'];
        //             const self_group_id= resultUsr['group_id'];
        //             const group_id =resultUsr['group_id'];
        //             const group_type= resultUsr['group_type'];
        //             const name= resultUsr['name']; 
        //         }
        //     res.status(200).json(response);  
        //     }
        // }
        

        const { business_gstin_number } = req.body;

        // Basic input validation
        if (!business_gstin_number) {
          return res.status(400).json({ error: "Missing required GSTIN number." });
        }
        console.log(headers)
        console.log(task_id);
        res.status(200).json(testurl+"in/merchant/gstin/lite");
        process.exit(0)
        // Build request headers
        // let data = new FormData();

        const body = {
            mode: "sync",
            data: {
                business_gstin_number,
                consent: "Y",
                consent_text:
                  "I hereby declare my consent agreement for fetching my information via ZOOP API.",
              },
            task_id: task_id,
        };

        // Make POST request using axios
        const apiresponse = await axios.post(
            testurl+"in/merchant/gstin/lite",
            body,
            { headers }
        );
        console.log(apiresponse)
        // Forward Zoop API response
        res.status(apiresponse.status).json(apiresponse.data);

    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};


exports.pandemographic = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        // const {AccessToken,DeveloperOption,DeveloperOptionId,customer_id} = req.body;
        let response ={};
        let final_data = {};
        final_data.Status="fail";
        // if(AccessToken!=null){
        //     let user_info ={};
        //     const dateToday= moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
        //     if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday)
        //     {
                
        //         user_info.Status=1;                
        //         user_info.AccountId=DeveloperOptionId;
        //     }
        //     else
        //     {
        //          user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        //     }
        //     //const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        //     if (user_info && user_info.Status === 2) {
        //             response.Result = user_info.Result;
        //             response.Message = user_info.Message;

        //             final_data.Message=user_info.Message;
        //             res.status(200).json(final_data);
        //     }
        //     else{
        //         const user_id = user_info.AccountId;
        //         const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
        //         if (result.length > 0) {
        //             const resultUsr=result[0];
        //             const user_type= resultUsr['user_type'];
        //             const self_group_id= resultUsr['group_id'];
        //             const group_id =resultUsr['group_id'];
        //             const group_type= resultUsr['group_type'];
        //             const name= resultUsr['name']; 
        //         }
        //     res.status(200).json(response);  
        //     }
        // }
        

        const { customer_pan_number, customer_dob,pan_holder_name } = req.body;

        // Basic input validation
        if (!customer_pan_number || !pan_holder_name) {
          return res.status(400).json({ error: "Missing required fields." });
        }
        console.log(testurl+"in/identity/pan/demographic",headers)
        res.status(200).json(testurl+"in/identity/pan/demographic");
        process.exit(0)
        // Build request headers
        // let data = new FormData();

        const body = {
            mode: "sync",
            data: {
              customer_pan_number,
              user_name:pan_holder_name,
              customer_dob,
              consent: "Y",
              consent_text:
                "I hereby declare my consent agreement for fetching my information via ZOOP API",
            },
            task_id: task_id,
        };

        // Make POST request using axios
        const apiresponse = await axios.post(
            testurl+"in/identity/pan/demographic",
            body,
            { headers }
        );
        console.log(apiresponse)
        // Forward Zoop API response
        res.status(apiresponse.status).json(apiresponse.data);

    }
    catch(error){
        res.status(500).json({error: error.message});
    }
};

