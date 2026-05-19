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





const testurl ="https://test.zoop.one/api/v1/" 
const APP_ID = "68b9928d9e0d1e0028a6ec21";
const API_KEY = "NXFZM42-T4PM25M-KTK25GW-3XE43CC";
const task_id = crypto.randomUUID();

const headers = {
    "app-id": APP_ID,
    "api-key": API_KEY,
    "Content-Type": "application/json",
};

exports.vehicleKYC = async (req, res) => {
    const dateToday = moment().tz("Asia/Calcutta").format("YYYY-MM-DD");
    const dateTimeToday = moment().tz("Asia/Calcutta").format("YYYY-MM-DD HH:mm:ss");

    try {
        const { AccessToken, DeveloperOption, DeveloperOptionId, doc_no, consent, consent_text } = req.body;

        // 🔹 Validation
        if (!AccessToken) return res.status(401).json({ status: "fail", message: "AccessToken required" });

        if (!doc_no || consent === undefined || !consent_text)
            return res.status(400).json({ status: "fail", message: "Missing required fields" });

        if (Number(consent) !== 1)
            return res.status(400).json({ status: "fail", message: "Consent is required" });

        // 🔹 Auth
        let user_info = {};
        if (DeveloperOptionId && DeveloperOption === "dev0.01_" + dateToday) {
            user_info = { Status: 1, AccountId: DeveloperOptionId };
        } else {
            user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        }
        // res.send(user_info);process.exit(0);
        // if (!user_info || user_info.Status !== 1)
        //     return res.status(401).json({ status: "fail", message: "Unauthorized" });
        if (user_info && user_info.Status === 2) {
            // return res.status(400).json({ status: "fail", message: user_info.Message });
            // response.Result = user_info.Result;
            // response.Message = user_info.Message;
            res.status(400).json({"Status": "fail", "Result": user_info.Result, "Message": user_info.Message});
            // res.status(400).json(response);
        }
        const user_id = user_info.AccountId;

        const [users] = await db.promise().query(
            "SELECT id FROM user WHERE id=? AND status=1",
            [user_id]
        );
        
        if (users.length === 0)
            return res.status(404).json({ status: "fail", message: "User not found" });

        // 🔹 Insert request
        const [kycInsert] = await db.promise().query(
            `INSERT INTO kyc_request 
            (consent, request_for, vehicle_number, user_request, vendor_request, vendor_name, consent_text, status, create_id, create_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [consent, "vehicle", doc_no, 1, 0, "zoop", consent_text, 1, user_id, dateTimeToday]
        );

        const request_id = kycInsert.insertId;
        const tableP = "kyc_vehicle_details";

        // 🔹 Mongo existing
        const existing = await mongu.getCVMongoQuery(
            { "result.rc_registration_number": doc_no, status: 1, doc_type: "vehicle" },
            // {},
            { sort: { _id: -1 }, limit: 1 },
            tableP
        );
        // res.send(existing);process.exit(0);
        let finalDoc = null;
        let callZoop = true;
        let mongoId = null;
        let taskId = null;
        let vendor_request = 1;

        if (existing && existing.length > 0) {
            const doc = existing[0];
            const veh = doc.result || doc;

            if (
                !isExpiredSafe(veh.rc_expiry_date) &&
                !isExpiredSafe(veh.rc_fit_upto) &&
                (!veh.insurance?.expiry_date || !isExpiredSafe(veh.insurance.expiry_date))
            ) {
                callZoop = false;
                vendor_request = 0;
                finalDoc = doc;
                mongoId = doc._id;
                taskId = doc.task_id || null;
            }
        }
        
        // 🔹 Zoop (static)
        if (callZoop) {
            // const responseZoopData = await Kyccomponent.getRCAdvanceData(doc_no);
            const responseZoopData = {
                "request_id": "88df3cb3-e9d9-4e3f-86d6-733e5a36185a",
                "task_id": "e5d5196a-1c1c-4496-a2a4-33672bbbd8e2",
                "group_id": "1677640a-9f1f-499f-8ac5-d28619895ea8",
                "success": true,
                "response_code": "100",
                "response_message": "Valid Authentication",
                "metadata": {
                    "billable": "Y"
                },
                "result": {
                    "rc_blacklist_status": "NA",
                    "body_type_description": "SOLO",
                    "rc_chassis_number": "MB123456789012345",
                    "father_name": "RAMESH KUMAR",
                    "financer": "INDUSIND BANK LTD.",
                    "insurance": {
                    "company": "ICICI Lombard",
                    "policy_number": "ICICI123456789",
                    "expiry_date": "15-Dec-2026"
                    },
                    "national_permit_expiry_date": "NA",
                    "national_permit_issued_by": "NA",
                    "national_permit_number": "NA",
                    "norms_description": "BHARAT STAGE III",
                    "vehicle_owner_number": "1",
                    "user_permanent_address": "QR NO-D/185, SECTOR-16 ROURKELA, ODISHA - 769003",
                    "rc_engine_number": "JA0123456789",
                    "rc_expiry_date": "25-Nov-2030",
                    "rc_noc_details": "NA",
                    "rc_permit_expiry_date": "NA",
                    "rc_permit_issued_date": "NA",
                    "rc_permit_number": "NA",
                    "rc_permit_start_date": "NA",
                    "rc_permit_type": "NA",
                    "rc_pucc_expiry_date": "10-Mar-2026",
                    "rc_pucc_no": "GJ0123456789",
                    "rc_registration_date": "20-Nov-2020",
                    "rc_registration_location": "ROURKELA, Odisha",
                    "rc_registration_number": "OD14AB1234",
                    "rc_state_code": "OR",
                    "rc_status": "ACTIVE",
                    "rc_status_as_on": "18-Apr-2026",
                    "rc_tax_upto": "30-Nov-2030",
                    "rc_source": "P",
                    "similarities": [],
                    "user_name": "HURSHIT PRAJAPATI",
                    "user_present_address": "QR NO-D/185, SECTOR-16 ROURKELA, ODISHA - 769003",
                    "vehicle_category": "2WN",
                    "vehicle_class_description": "M-Cycle/Scooter(2WN)",
                    "vehicle_color": "RED",
                    "vehicle_cubic_capacity": "125",
                    "vehicle_fuel_description": "PETROL",
                    "vehicle_gross_weight": "259",
                    "vehicle_make_model": "GLAMOUR CAST DRS",
                    "vehicle_make_id": "NA",
                    "vehicle_model_id": "NA",
                    "vehicle_maker_description": "HERO MOTOCORP LTD",
                    "vehicle_manufactured_date": "10/2020",
                    "vehicle_number_of_cylinders": "1",
                    "vehicle_seating_capacity": "2",
                    "vehicle_sleeper_capacity": "0",
                    "vehicle_stand_capacity": "0",
                    "vehicle_unladen_weight": "129",
                    "vehicle_wheelbase": "1265",
                    "vehicle_type": "2W",
                    "rc_commercial_status": "NO",
                    "extra_data": "NA",
                    "rc_rto_code": "OD-14",
                    "vehicle_financed": "Y",
                    "month_year_remaining_for_insurance_exp": "8",
                    "insurance_expired": "N",
                    "vehicle_fitness_expired": "N",
                    "vehicle_age": "5 years 5 months",
                    "city": "Rourkela",
                    "state": "Odisha",
                    "invoice_info": {
                    "purchase_date": "20-Nov-2020",
                    "purchase_amount": "75000",
                    "dealer_name": "Hero Showroom Rourkela",
                    "dealer_address": "Rourkela, Odisha"
                    }
                },
                "request_timestamp": "2024-04-29T11:51:41.698Z",
                "response_timestamp": "2024-04-29T11:51:42.229Z"
            }

            const insertData = {
                ...responseZoopData,
                create_id: user_id,
                doc_type: "vehicle",
                kyc_request_id: request_id,
                status: 1
            };

            const insertId = await mongu.insertCVMongoQuery(insertData, tableP);

            mongoId = insertId;
            finalDoc = insertData;

            await mongu.updateCVMongoQuery(
                {
                    rc_registration_number: doc_no,
                    status: 1,
                    doc_type: "vehicle",
                    _id: { $ne: insertId } // 🔥 FIXED
                },
                {
                    $set: {
                        status: 0,
                        edit_id: user_id,
                        edit_date: dateToday
                    }
                },
                tableP
            );
        }
        
        // 🔹 Update SQL        
        const mongoIdStr = mongoId?.$oid || mongoId?.toString();
        
        await db.promise().query(
            `UPDATE kyc_request 
            SET vendor_request = ?, 
                request_mid = ?, 
                request_task_id = ? 
            WHERE id = ?`,
            [vendor_request, mongoIdStr, taskId, request_id]
        );

        if (!finalDoc)
            return res.status(500).json({ status: "fail", message: "Vehicle data not found" });
        
        // const vehdata = finalDoc;
        const vehdata = finalDoc?.result || finalDoc || {};
        
        // ===============================
        // MASTER DATA
        // ===============================
        const [
            [vehicleMake],
            [vehicleFuelType],
            [vehicleCategory],
            [vehicleModel]
        ] = await Promise.all([
            db.promise().query("SELECT id,name FROM vehicle_make"),
            db.promise().query("SELECT id,name FROM fuel_type"),
            db.promise().query("SELECT id,name FROM vehicle_category"),
            db.promise().query("SELECT id,model_number FROM vehicle_model")
        ]);
        
        const map = (arr, key, val) => {
            const obj = {};
            arr.forEach(r => obj[r[key]] = r[val]);
            return obj;
        };

        const vehicleMake_bin = map(vehicleMake, "id", "name");
        const vehicleFuelType_bin = map(vehicleFuelType, "id", "name");
        const vehicleCategory_bin = map(vehicleCategory, "id", "name");
        const vehicleModel_bin = map(vehicleModel, "id", "model_number");
        
        let ids = [];

        const vehiclemake = await getOrInsertValue(vehdata.vehicle_maker_description, vehicleMake_bin, "vehicle_make", db, ids);
        
        const fueltype = await getOrInsertValue(vehdata.vehicle_fuel_description, vehicleFuelType_bin, "fuel_type", db, ids);
        const vehiclecatagory = await getOrInsertValue(vehdata.vehicle_class_description, vehicleCategory_bin, "vehicle_category", db, ids);
        
        ids = [vehiclemake?.id, vehiclecatagory?.id];
        let modelYear = vehdata.vehicle_manufactured_date.split('/');
        let yearModel = modelYear[1];
        
        const vehiclemodel = await getOrInsertValue(vehdata.vehicle_make_model, vehicleModel_bin, "vehicle_model", db, ids, yearModel);
        // res.send({vehiclemake,fueltype,vehiclecatagory,vehiclemodel,vehicleModel_bin});process.exit(0);
        
        const documents = [
            {
                documentTypeId: 5,
                documentName: "Registration Certificate",
                doc_key: "RegistrationCertificate",
                documentId: null,
                documentNumber: vehdata.rc_registration_number || null,
                issueDate: vehdata.rc_registration_date || null,
                expiryDate: vehdata.rc_expiry_date || null,
                filePath: null,
                isVerified: null
            },
            {
                documentTypeId: 6,
                documentName: "Pollution Certificate",
                doc_key: "PollutionCertificate",
                documentId: null,
                documentNumber: vehdata.rc_pucc_no || null,
                issueDate: null,
                expiryDate: vehdata.rc_pucc_expiry_date || null,
                filePath: null,
                isVerified: null
            },
            {
                documentTypeId: 7,
                documentName: "Vehicle Insurance",
                doc_key:"VehicleInsurance",
                documentId: null,
                documentNumber: vehdata.insurance?.policy_number || null,
                issueDate: null,
                expiryDate: vehdata.insurance?.expiry_date || null,
                filePath: null,
                isVerified: null
            },
            {
                documentTypeId: 10, // National Goods Permit
                documentName: "National Goods Permit",
                doc_key: "NationalGoodsPermit",
                documentId: null,
                documentNumber: vehdata.national_permit_number || null,
                issueDate: vehdata.rc_permit_issued_date || null,
                expiryDate: vehdata.national_permit_expiry_date || null,
                filePath: null,
                isVerified: null
            },
            {
                documentTypeId: 13,
                documentName: "Fitness Certificate",
                doc_key: "FitnessCertificate",
                documentId: null,
                documentNumber: vehdata.rc_registration_number || null,
                issueDate: null,
                expiryDate: vehdata.rc_fit_upto || null,
                filePath: null,
                isVerified: null
            }
        ];

        // 🔹 FINAL RESPONSE
        const response_data = [{

            vehicleNumber: vehdata.rc_registration_number || null,

            category: {
                id: vehiclecatagory?.id || null,
                name: vehiclecatagory?.name || null
            },

            make: {
                id: vehiclemake?.id || null,
                name: vehiclemake?.name || null
            },

            model: {
                id: vehiclemodel?.id || null,
                name: vehiclemodel?.name || null
            },

            // vehicle_type: {
            //     id: null, // mapping nahi hai
            //     name: vehdata.vehicle_type || null
            // },

            registrationNumber: vehdata.rc_registration_number || null,
            registrationDate: vehdata.rc_registration_date || null,
            owner: vehdata.user_name || null,
            rto: vehdata.rc_rto_code || null,
            vehicle_class: vehdata.vehicle_category || null,
            // vehicle_capacity: {
            //     id: null,
            //     name: vehdata.vehicle_seating_capacity || null
            // },

            vehicle_fuel_type: {
                id: fueltype?.id || null,
                name: fueltype?.name || null
            },

            // overSpeedLimit: null,

            // vehicle_size: {
            //     id: null,
            //     name: vehdata.vehicle_gross_weight || null
            // },

            // // ================= REGISTRATION =================
            // registrationDocumentNumber: vehdata.rc_registration_number || null,
            // registrationIssueDate: vehdata.rc_registration_date || null,
            // registrationExpiryDate: vehdata.rc_expiry_date || null,
            // registrationUploadDocument: {},
            // registrationRemarks: null,

            // // ================= POLLUTION =================
            // pollutionDocumentNumber: vehdata.rc_pucc_no || null,
            // pollutionIssueDate: null,
            // pollutionExpiryDate: vehdata.rc_pucc_expiry_date || null,
            // pollutionUploadDocument: {},
            // pollutionRemarks: null,

            // // ================= NATIONAL PERMIT =================
            // nationalGoodsDocumentNumber: vehdata.national_permit_number || null,
            // nationalGoodsIssueDate: vehdata.rc_permit_issued_date || null,
            // nationalGoodsExpiryDate: vehdata.national_permit_expiry_date || null,
            // nationalGoodsUploadDocument: null,
            // nationalGoodsRemarks: null,

            // // ================= INSURANCE =================
            // insuranceDocumentNumber: vehdata.insurance?.policy_number || null,
            // insuranceIssueDate: null,
            // insuranceExpiryDate: vehdata.insurance?.expiry_date || null,
            // insuranceUploadDocument: null,
            // insuranceRemarks: null,

            // // ================= FITNESS =================
            // fitnessDocumentNumber: vehdata.rc_registration_number || null,
            // fitnessIssueDate: null,
            // fitnessExpiryDate: vehdata.rc_fit_upto || null,
            // fitnessUploadDocument: null,
            // fitnessRemarks: null,
            documents,
            // ================= FEATURES =================
            Elock: vehdata.is_fixed_door_e_lock === 1,
            GPS: vehdata.is_gps === 1,
            "Dual Driver": vehdata.is_door_close === 1,
            "Fire Fighting": null,
            "Portable E-Lock": null,
            "Tarpaulin": vehdata.is_tarpaulin === 1
        }];

        return res.status(200).json({
            status: "success",
            data: response_data
        });

    } catch (error) {
        console.error("Vehicle KYC Error:", error);
        return res.status(500).json({
            status: "fail",
            message: error.message
        });
    }
};

exports.dlKYC = async (req, res) => {
    const dateToday = moment().tz("Asia/Calcutta").format("YYYY-MM-DD");
    const dateTimeToday = moment().tz("Asia/Calcutta").format("YYYY-MM-DD HH:mm:ss");
    try {
        const { AccessToken, DeveloperOption, DeveloperOptionId, doc_no, name, dob, consent, consent_text } = req.body;
        
        // 🔹 1. Basic Validation
        if (!AccessToken) {
            return res.status(401).json({ status: "fail", message: "AccessToken required" });
        }

        if (!doc_no || !name || !dob) {
            return res.status(400).json({ status: "fail", message: "Missing required fields" });
        }

        // 🔹 2. Auth Check
        let user_info = {};
        if (DeveloperOptionId && DeveloperOption === "dev0.01_" + dateToday) {
            user_info = { Status: 1, AccountId: DeveloperOptionId };
        } else {
            user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        }
        
        // if (!user_info || user_info.Status !== 1) {
        //     return res.status(401).json({ status: "fail", message: user_info?.Message || "Unauthorized" });
        // }
        
        if (user_info && user_info.Status === 2) {
            res.status(400).json({"Status": "fail", "Result": user_info.Result, "Message": user_info.Message});
        }
        
        const user_id = user_info.AccountId;
        
        // 🔹 3. User validation
        const [users] = await db.promise().query(
            "SELECT id FROM user WHERE id=? AND status=1",
            [user_id]
        );

        if (users.length === 0) {
            return res.status(404).json({ status: "fail", message: "User not found" });
        }

        if(Number(consent) !== 1){
            return res.status(404).json({ status: "fail", message: "You must agree to the consent before proceeding." });
        }
        
        // 🔹 4. Insert KYC Request
        const [kycInsert] = await db.promise().query(
            `INSERT INTO kyc_request 
            (consent, request_for, vehicle_number, user_request, vendor_request, vendor_name, consent_text, status, create_id, create_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                consent,
                "driving_license",
                doc_no,                              
                1,
                0,
                "zoop",  
                consent_text,
                1,
                user_id,
                dateTimeToday
            ]
        );
       
        if (kycInsert.affectedRows === 0) {
            return res.status(500).json({ status: "fail", message: "Failed to create request" });
        }

        const request_id = kycInsert.insertId;
        const tableP = "kyc_driver_details";        

        // 🔹 5. Check existing active record
        const existing = await mongu.getCVMongoQuery(
            {
                "result.dl_number": doc_no.trim().toUpperCase(),
                "result.user_dob": dob.trim(),
                "result.user_full_name": name.trim(),
                status: 1,
                doc_type: "driving_licence"
            },
            {
                sort: { _id: -1 },
                limit: 1
            },
            tableP
        );
         
        let finalDoc = null;
        let callZoop = true;
        let vendor_request = 1;

        let mongoId = null;
        let taskId = null;

        if (existing.length > 0) {
            const doc = existing[0];

            if (!isExpired(doc.result.expiry_date)) {
                callZoop = false;
                finalDoc = doc;
                vendor_request = 0;

                mongoId = doc._id;                     // Mongo ID
                taskId = doc.task_id || null;          // Task ID
            }
        }
        
        // 🔹 6. Call Zoop API if needed
        if (callZoop) {
            
            // const responseZoopData = await Kyccomponent.getDLVerificationData(doc_no, name, dob);
            const responseZoopData = {
                "request_id": "6882cd59-2043-4e8a-a3c4-7f8874c625c5",
                "task_id": "f26eb21e-4c35-4491-b2d5-41fa0e545a34",
                "group_id": "bdd63f05-93e6-4832-b2b0-c15bb7cb6183",
                "success": true,
                "response_code": "100",
                "response_message": "Valid Authentication",
                "metadata": {
                    "billable": "Y"
                },
                "result": {
                    "user_address": [
                    {
                        "country": "India",
                        "pin": "700001",
                        "district": "Kolkata",
                        "addressLine1": "12 Park Street",
                        "state": "West Bengal",
                        "type": "Permanent",
                        "completeAddress": "12 Park Street, Kolkata, West Bengal, 700001"
                    }
                    ],
                    "user_blood_group": "B+",
                    "dl_number": "WB20XXXXXXXXXX",
                    "user_dob": "15-08-1990",
                    "endorse_date": "01-01-2020",
                    "endorse_number": "END12345",
                    "expiry_date": "14-08-2030",
                    "father_or_husband": "Mohammad Salim Ansari",
                    "issued_date": "15-08-2010",
                    "non_transport_validity": {
                    "from": "15-08-2010",
                    "to": "14-08-2030"
                    },
                    "state": "West Bengal",
                    "status": "Active",
                    "status_details": {
                    "from": "15-08-2010",
                    "remarks": "Valid Driving License",
                    "to": "14-08-2030"
                    },
                    "transport_validity": {
                    "from": "01-01-2022",
                    "to": "31-12-2025"
                    },
                    "user_full_name": "Mohammad Arif Ansari",
                    "user_image": "BASE64_ENCODED_IMAGE_STRING",
                    "vehicle_category_details": [
                    {
                        "expiryDate": "14-08-2030",
                        "issueDate": "15-08-2010",
                        "cov": "MCWG"
                    },
                    {
                        "expiryDate": "14-08-2030",
                        "issueDate": "15-08-2010",
                        "cov": "LMV"
                    }
                    ],
                    "name_match_score": "29.00"
                },
                "request_timestamp": "2024-04-23T10:46:01.897Z",
                "response_timestamp": "2024-04-23T10:46:02.115Z"
            }
            
            if (!responseZoopData || responseZoopData.response_code !== "100") {
                return res.status(400).json({
                    status: "fail",
                    message: responseZoopData?.response_message || "Zoop API failed"
                });
            }

            const task_id = responseZoopData.task_id || null;
            
            const insertData = {
                task_id,
                ...responseZoopData,
                create_id: user_id,
                created_date: dateToday,
                doc_type: "driving_licence",
                kyc_request_id: request_id,
                status: 1
            };
            
            const insertId = await mongu.insertCVMongoQuery(insertData, tableP);
            const newId = insertId?._id?.$oid;
            // res.send(newId);process.exit(0);
            mongoId = insertId;     // New Mongo ID
            taskId = task_id;       // New Task ID

            // 🔹 7. Deactivate old records (VERY IMPORTANT)
            let updateResult = await mongu.updateCVMongoQuery(
                {
                    "result.dl_number": doc_no.trim().toUpperCase(),
                    status: 1,
                    doc_type: "driving_licence",
                    _id: { $ne: new ObjectId(newId) }
                },
                {
                    $set: {
                        status: 0,
                        edit_id: user_id,
                        edit_date: dateToday
                    }
                },
                tableP
            );
            
            finalDoc = insertData;

        }
        const mongoIdStr = mongoId?.$oid || mongoId?.toString();
        await db.promise().query(
            `UPDATE kyc_request 
            SET vendor_request = ?, 
                request_mid = ?, 
                request_task_id = ? 
            WHERE id = ?`,
            [vendor_request, mongoIdStr, taskId, request_id]
        );

        // 🔹 8. Final Response
        const result = finalDoc.result;

        return res.status(200).json({
            status: "success",
            data: {
                name: result.user_full_name,
                dob: result.user_dob,
                doc_no: doc_no,
                expiry_date: result.expiry_date,
                dl_status: result.status,
                status_details: result.status_details
            }
        });

    } catch (error) {
        console.error("DL KYC Error:", error);
        return res.status(500).json({
            status: "fail",
            message: "Internal Server Error"
        });
    }
};

exports.panKYC = async (req, res) => {
    const dateToday = moment().tz("Asia/Calcutta").format("YYYY-MM-DD");
    const dateTimeToday = moment().tz("Asia/Calcutta").format("YYYY-MM-DD HH:mm:ss");
    try {
        const { AccessToken, DeveloperOption, DeveloperOptionId, doc_no, name, consent, consent_text } = req.body;

        // 🔹 1. Basic Validation
        if (!AccessToken) {
            return res.status(401).json({ status: "fail", message: "AccessToken required" });
        }

        if (!doc_no || !name) {
            return res.status(400).json({ status: "fail", message: "Missing required fields" });
        }

        // 🔹 2. Auth Check
        let user_info = {};
        if (DeveloperOptionId && DeveloperOption === "dev0.01_" + dateToday) {
            user_info = { Status: 1, AccountId: DeveloperOptionId };
        } else {
            user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        }

        // if (!user_info || user_info.Status !== 1) {
        //     return res.status(401).json({ status: "fail", message: user_info?.Message || "Unauthorized" });
        // }

        if (user_info && user_info.Status === 2) {
            // response.Result = user_info.Result;
            // response.Message = user_info.Message;
            res.status(400).json({"Status": "fail", "Result": user_info.Result, "Message": user_info.Message});
            // res.status(400).json(response);
        }

        const user_id = user_info.AccountId;

        // 🔹 3. User validation
        const [users] = await db.promise().query(
            "SELECT id FROM user WHERE id=? AND status=1",
            [user_id]
        );

        if (users.length === 0) {
            return res.status(404).json({ status: "fail", message: "User not found" });
        }

        if(Number(consent) !== 1){
            return res.status(404).json({ status: "fail", message: "You must agree to the consent before proceeding." });
        }

        // 🔹 4. Insert KYC Request
        const [kycInsert] = await db.promise().query(
            `INSERT INTO kyc_request 
            (consent, request_for, vehicle_number, user_request, vendor_request, vendor_name, consent_text, status, create_id, create_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                consent,
                "pan_card",
                doc_no,                              
                1,
                0,
                "zoop",  
                consent_text,
                1,
                user_id,
                dateTimeToday
            ]
        );

        if (kycInsert.affectedRows === 0) {
            return res.status(500).json({ status: "fail", message: "Failed to create request" });
        }

        const request_id = kycInsert.insertId;
        const tableP = "kyc_driver_details";        

        // 🔹 5. Check existing active record
        const existing = await mongu.getCVMongoQuery(
            {
                "result.pan_number": doc_no.trim().toUpperCase(),
                "result.name_on_card": name.trim(),
                status: 1,
                doc_type: "pan_card"
            },
            {
                sort: { _id: -1 },
                limit: 1
            },
            tableP
        );
        
        let finalDoc = null;
        let callZoop = true;
        let vendorRequest = 1;
        let mongoId = null;
        let taskId = null;

        if (existing.length > 0) {
            const doc = existing[0];
            
            if (doc.result.pan_status === 'VALID') {
                
                callZoop = false;
                vendorRequest = 0;
                finalDoc = doc;

                mongoId = doc._id;                     // Mongo ID
                taskId = doc.task_id || null;          // Task ID
            }
        }
        
        // 🔹 6. Call Zoop API if needed
        if (callZoop) {

            // const responseZoopData = await Kyccomponent.getPANAdvanceData(doc_no, name);
            const responseZoopData = {
                "request_id": "4ed8dbfa-9be3-48aa-b01f-dddbb2c4e1dc",
                "task_id": "f26eb21e-4c35-4491-b2d5-41fa0e545a34",
                "group_id": "e6fb11a1-5a44-4aff-98b5-8e6566554b4a",
                "success": true,
                "response_code": "100",
                "response_message": "Valid Authentication",
                "metadata": {
                    "billable": "Y"
                },
                "result": {
                    "aadhaar_seeding_status": "OPERATIVE PAN",
                    "pan_last_updated": "01/02/2023",
                    "pan_number": "ABCPD1234F",
                    "pan_status": "VALID",
                    "user_first_name": "Vandana",
                    "user_middle_name": "Mahesh",
                    "user_last_name": "Saxena",
                    "name_on_card": "Vandana Mahesh Saxena",
                    "user_title": "Kumari",
                    "name_match_score": "98.75",
                    "pan_type": "Person"
                },
                "request_timestamp": "2024-04-23T09:44:43.589Z",
                "response_timestamp": "2024-04-23T09:44:44.154Z"
            }

            if (!responseZoopData || responseZoopData.response_code !== "100") {
                return res.status(400).json({
                    status: "fail",
                    message: responseZoopData?.response_message || "Zoop API failed"
                });
            }

            const task_id = responseZoopData.task_id || null;

            const insertData = {
                task_id,
                ...responseZoopData,
                create_id: user_id,
                created_date: dateToday,
                doc_type: "pan_card",
                kyc_request_id: request_id,
                status: 1
            };

            const insertId = await mongu.insertCVMongoQuery(insertData, tableP);

            mongoId = insertId;     // New Mongo ID
            taskId = task_id;       // New Task ID

            // 🔹 7. Deactivate old records (VERY IMPORTANT)
            await mongu.updateCVMongoQuery(
                {
                    "result.pan_number": doc_no.trim().toUpperCase(),
                    status: 1,
                    doc_type: "pan_card",
                    _id: { $ne: new ObjectId(insertId) }
                },
                {
                    $set: {
                        status: 0,
                        edit_id: user_id,
                        edit_date: dateToday
                    }
                },
                tableP
            );

            finalDoc = insertData;
            
        }

        
        const mongoIdStr = mongoId?.$oid || mongoId?.toString();
        await db.promise().query(
            `UPDATE kyc_request 
            SET vendor_request = ?, 
                request_mid = ?, 
                request_task_id = ? 
            WHERE id = ?`,
            [vendorRequest, mongoIdStr, taskId, request_id]
        );

        // 🔹 8. Final Response
        const result = finalDoc.result;

        return res.status(200).json({
            status: "success",
            data: {
                name: result.name_on_card,
                doc_no: doc_no,
                pan_status: result.status
            }
        });

    } catch (error) {
        console.error("DL KYC Error:", error);
        return res.status(500).json({
            status: "fail",
            message: "Internal Server Error"
        });
    }
};

exports.voterIdKYC = async (req, res) => {
    const dateToday = moment().tz("Asia/Calcutta").format("YYYY-MM-DD");
    const dateTimeToday = moment().tz("Asia/Calcutta").format("YYYY-MM-DD HH:mm:ss");
    try {
        const { AccessToken, DeveloperOption, DeveloperOptionId, doc_no, name, consent, consent_text } = req.body;

        // 🔹 1. Basic Validation
        if (!AccessToken) {
            return res.status(401).json({ status: "fail", message: "AccessToken required" });
        }

        if (!doc_no || !name) {
            return res.status(400).json({ status: "fail", message: "Missing required fields" });
        }

        // 🔹 2. Auth Check
        let user_info = {};
        if (DeveloperOptionId && DeveloperOption === "dev0.01_" + dateToday) {
            user_info = { Status: 1, AccountId: DeveloperOptionId };
        } else {
            user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        }

        // if (!user_info || user_info.Status !== 1) {
        //     return res.status(401).json({ status: "fail", message: user_info?.Message || "Unauthorized" });
        // }

        if (user_info && user_info.Status === 2) {
            // response.Result = user_info.Result;
            // response.Message = user_info.Message;
            res.status(400).json({"Status": "fail", "Result": user_info.Result, "Message": user_info.Message});
            // res.status(400).json(response);
        }

        const user_id = user_info.AccountId;

        // 🔹 3. User validation
        const [users] = await db.promise().query(
            "SELECT id FROM user WHERE id=? AND status=1",
            [user_id]
        );

        if (users.length === 0) {
            return res.status(404).json({ status: "fail", message: "User not found" });
        }

        if(Number(consent) !== 1){
            return res.status(404).json({ status: "fail", message: "You must agree to the consent before proceeding." });
        }

        // 🔹 4. Insert KYC Request
        const [kycInsert] = await db.promise().query(
            `INSERT INTO kyc_request 
            (consent, request_for, vehicle_number, user_request, vendor_request, vendor_name, consent_text, status, create_id, create_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                consent,
                "voter_id",
                doc_no,                              
                1,
                0,
                "zoop",  
                consent_text,
                1,
                user_id,
                dateTimeToday
            ]
        );

        if (kycInsert.affectedRows === 0) {
            return res.status(500).json({ status: "fail", message: "Failed to create request" });
        }

        const request_id = kycInsert.insertId;
        const tableP = "kyc_driver_details";        

        // 🔹 5. Check existing active record
        const existing = await mongu.getCVMongoQuery(
            {
                "result.epic_number": doc_no.trim().toUpperCase(),
                "result.user_name_english": name.trim(),
                status: 1,
                doc_type: "voter_id"
            },
            {
                sort: { _id: -1 },
                limit: 1
            },
            tableP
        );
        
        let finalDoc = null;
        let callZoop = true;
        let vendorRequest = 1;

        let mongoId = null;
        let taskId = null;

        if (existing.length > 0) {
            const doc = existing[0];
            
            // if (doc.result.status === 'N') {
                
                callZoop = false;
                vendorRequest = 0;
                finalDoc = doc;

                mongoId = doc._id;                     // Mongo ID
                taskId = doc.task_id || null;          // Task ID
            // }
        }
        
        // 🔹 6. Call Zoop API if needed
        if (callZoop) {

            // const responseZoopData = await Kyccomponent.getVoterIdAdvanceData(doc_no, name);
            const responseZoopData = {
                "request_id": "0732c933-31ff-4fc4-a5e8-d4527f3d223e",
                "task_id": "d15a2a3b-9989-46ef-9b63-e24728292dc0",
                "group_id": "3c6b10d2-c9d5-4593-8028-1546c5278453",
                "success": true,
                "response_code": "100",
                "response_message": "Valid Authentication",
                "metadata": {
                    "billable": "Y"
                },
                "result": {
                    "address": {
                        "district_code": 13,
                        "district_name": "Dehradun",
                        "district_name_vernacular": "देहरादून",
                        "state": "Uttarakhand",
                        "state_code": "S28"
                    },
                    "user_age": 29,
                    "assembly_constituency_name": "Vikasnagar",
                    "assembly_constituency_name_vernacular": "विकासनगर",
                    "assembly_constituency_number": 16,
                    "constituency_part_name": "Vikasnagar West Part No. 3",
                    "constituency_part_name_vernacular": "विकासनगर पश्चिम भाग संख्या 3",
                    "constituency_part_number": 51,
                    "constituency_section_number": 1,
                    "epic_number": "NRB1234567",
                    "user_gender": "M",
                    "parliamentary_constituency_name": "Tehri Garhwal",
                    "parliamentary_constituency_name_vernacular": "",
                    "parliamentary_constituency_number": "1",
                    "polling_booth": {
                        "lat_long": "30.49495,77.79317",
                        "name": "Shri Hoshira Singh Buddhumal Jain Girls Inter College, Vikasnagar, Dehradun - 248198",
                        "name_vernacular": "",
                        "number": 51
                    },
                    "relative_name_english": "Naresh Talwar",
                    "relative_name_vernacular": "नरेश तलवार",
                    "relative_relation": "FTHR",
                    "serial_number_applicable_part": 328,
                    "status": "N",
                    "user_name_english": "Mohak Talwar",
                    "user_name_vernacular": "मोहक तलवार",
                    "voter_last_updated_date": "2024-01-30T12:24:09.509Z",
                    "name_match_score": "92.45"
                },
                "request_timestamp": "2024-04-23T10:59:19.166Z",
                "response_timestamp": "2024-04-23T10:59:19.463Z"
            }

            if (!responseZoopData || responseZoopData.response_code !== "100") {
                return res.status(400).json({
                    status: "fail",
                    message: responseZoopData?.response_message || "Zoop API failed"
                });
            }

            const task_id = responseZoopData.task_id || null;

            const insertData = {
                task_id,
                ...responseZoopData,
                create_id: user_id,
                created_date: dateToday,
                doc_type: "voter_id",
                kyc_request_id: request_id,
                status: 1
            };

            const insertId = await mongu.insertCVMongoQuery(insertData, tableP);

            mongoId = insertId;     // New Mongo ID
            taskId = task_id;       // New Task ID

            // 🔹 7. Deactivate old records (VERY IMPORTANT)
            await mongu.updateCVMongoQuery(
                {
                    "result.epic_number": doc_no.trim().toUpperCase(),
                    status: 1,
                    doc_type: "voter_id",
                    _id: { $ne: new ObjectId(insertId) }
                },
                {
                    $set: {
                        status: 0,
                        edit_id: user_id,
                        edit_date: dateToday
                    }
                },
                tableP
            );

            finalDoc = insertData;
            
        }

        const mongoIdStr = mongoId?.$oid || mongoId?.toString();
        await db.promise().query(
            `UPDATE kyc_request 
            SET vendor_request = ?, 
                request_mid = ?, 
                request_task_id = ? 
            WHERE id = ?`,
            [vendorRequest, mongoIdStr, taskId, request_id]
        );

        // 🔹 8. Final Response
        const result = finalDoc.result;

        return res.status(200).json({
            status: "success",
            data: {
                nameEnglish: result.user_name_english,
                nameHindi: result.user_name_vernacular,
                age: result.user_age,
                epic_number: result.epic_number,
                gender: result.user_gender
            }
        });

    } catch (error) {
        console.error("DL KYC Error:", error);
        return res.status(500).json({
            status: "fail",
            message: "Internal Server Error"
        });
    }
};

exports.panKYCOLD = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    try{
        const {AccessToken, DeveloperOption, DeveloperOptionId, doc_no, name} = req.body;
        let response ={};
        let final_data = {};
        final_data.Status="fail";        
        let user_info ={};
        let docDetails = [];
        if(AccessToken!=null){            
            if(DeveloperOptionId && DeveloperOption && DeveloperOption=="dev0.01_"+dateToday){                
                user_info.Status=1;                
                user_info.AccountId=DeveloperOptionId;
            }else{
                 user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            }

            if (!doc_no || !name) {
                return res.status(400).json({ error: "Missing required fields." });
            }

            //const user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
            if (user_info && user_info.Status === 2) {
                final_data.Message=user_info.Message;
                res.status(400).json(final_data);
            }else{
                const user_id = user_info.AccountId;
                const [result] = await db.promise().query("SELECT `id`, `user_type`, `name`, `group_type`, `group_id` FROM user WHERE `id`=? AND `status`=?",[user_id,1]);
                if (result.length > 0) {
                    const resultUsr=result[0];
                    const user_type= resultUsr['user_type'];
                    const self_group_id= resultUsr['group_id'];
                    const group_id =resultUsr['group_id'];
                    const group_type= resultUsr['group_type'];
                    // const name= resultUsr['name']; 

                    // 🔹 2. Insert into kyc_request
                    const [kycInsert] = await db.promise().query(
                        `INSERT INTO kyc_request 
                        (vehicle_number, vendor_name, request_for, user_request, vendor_request, status, create_id, create_date) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            doc_no,
                            "zoop",
                            "pan_card",
                            1,
                            0,
                            1,
                            user_id,
                            moment().tz("Asia/Calcutta").format("YYYY-MM-DD HH:mm:ss")
                        ]
                    );
                    let callZoop = false;
                    if(kycInsert.affectedRows > 0){
                        const request_id = kycInsert.insertId;

                        // 🔹 3. Mongo check (latest active)
                        const tableP = "kyc_driver_details"
                        const conditionsP = {}
                        const fieldsP = { projection: { _id: 0 } }
                        conditionsP["result.pan_number"] = doc_no;
                        conditionsP["result.name_on_card"] = {
                            $regex: `^${name.trim()}$`,
                            $options: "i"
                        };
                        conditionsP["status"] = 1;
                        conditionsP["doc_type"] = 'pan_card';
                        // console.log(conditionsP);
                        // process.exit(0);
                        // res.send(conditionsP);process.exit(0);
                        let existRecord = await mongu.getCVMongoQuery(conditionsP,fieldsP,tableP);
                        // res.send(existRecord);process.exit(0);
                        if(existRecord.length > 0){
                            // let validity = await isValidDocs(existRecord[0]);
                            const existDoc = existRecord[0];
                            
                            if (isExpired(existDoc.expiry_date)) {
                                callZoop = true;
                            }
                            // res.send(callZoop);process.exit(0);
                            docDetails = [existDoc];
                        }else{
                            callZoop = true;
                            // const dldata = await Kyccomponent.getDLVerificationData(customer_dl_number,name_to_match,customer_dob)
                        }
                        // res.send(docDetails);process.exit(0);
                        // ===============================
                        // ZOOP CALL
                        // ===============================

                        if (callZoop) {

                            // let rcdata = await callZoopAPI(vehicle_registration_number);
                            // const responseZoopData = await Kyccomponent.getDLVerificationData(doc_no, name, dob);
                            const responseZoopData = {
                                "request_id": "4ed8dbfa-9be3-48aa-b01f-dddbb2c4e1dc",
                                "task_id": "f26eb21e-4c35-4491-b2d5-41fa0e545a34",
                                "group_id": "e6fb11a1-5a44-4aff-98b5-8e6566554b4a",
                                "success": true,
                                "response_code": "100",
                                "response_message": "Valid Authentication",
                                "metadata": {
                                    "billable": "Y"
                                },
                                "result": {
                                    "aadhaar_seeding_status": "OPERATIVE PAN",
                                    "pan_last_updated": "01/02/2023",
                                    "pan_number": "IRZPS8890K",
                                    "pan_status": "VALID",
                                    "user_first_name": "Vaishali",
                                    "user_middle_name": "Manoj",
                                    "user_last_name": "Sharma",
                                    "name_on_card": "Vaishali Manoj Sharma",
                                    "user_title": "Kumari",
                                    "name_match_score": "34.50",
                                    "pan_type": "Person"
                                },
                                "request_timestamp": "2024-04-23T09:44:43.589Z",
                                "response_timestamp": "2024-04-23T09:44:44.154Z",
                                "created_date": "2026-04-16",
                                "status": 1,
                                "request_ip": "172.31.33.175"
                            };
                            
                            if (responseZoopData && responseZoopData.response_code == "100") {

                                let finalData = {
                                    task_id,
                                    ...responseZoopData,
                                    doc_type: 'pan_card',
                                    created_date: dateToday,
                                    status: 1
                                };

                                let insertId = await mongu.insertCVMongoQuery(finalData, tableP);
                                // res.send({ insertId});process.exit(0);

                                docDetails = [finalData];

                                // Update vendor_request
                                await db.promise().query(
                                    "UPDATE kyc_request SET vendor_request=1 WHERE id=?",
                                    [request_id]
                                );
                            }
                        }
                        // res.send(docDetails);process.exit(0);
                        if(docDetails.length > 0){
                            let expiryDates = docDetails[0].result;
                            let pan_status = expiryDates.pan_status;
                            // res.send(expiryDate);process.exit(0);
                            let data = {
                                name: name,
                                dob: dob,
                                doc_no: doc_no,
                                pan_status: pan_status
                            }
                            res.status(200).json(data);
                            res.send(docDetails);process.exit(0);
                        }
                        res.send(responseZoopData);process.exit(0);
                    }
                    
                }

                res.send('exit');process.exit(0);

                //     res.status(200).json(response);  
                //     }
                // }

                // const APP_ID = "68b9928d9e0d1e0028a6ec21";
                // const API_KEY = "NXFZM42-T4PM25M-KTK25GW-3XE43CC";

                // const { customer_dl_number, name_to_match, customer_dob } = req.body;

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
        }

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




async function getOrInsertValue(value, bin, tableName, db, ids = [], details = []) {
    
    if (!value || value === "NA") return null;

    const createdate = moment().tz('Asia/Calcutta').format("YYYY-MM-DD HH:mm:ss");

    // Normalize value
    const normalizedValue = value.trim().toLowerCase();

    // Check existing in bin
    for (const [id, name] of Object.entries(bin)) {
        if (name && name.toLowerCase() === normalizedValue) {
            return {
                id: id,
                name: name
            };
        }
    }

    // ===============================
    // INSERT VEHICLE MAKE
    // ===============================
    if (tableName === "vehicle_make") {
        
        const sql = `
            INSERT INTO vehicle_make 
            (name, status, create_id, create_date)
            VALUES (?, ?, ?, ?)
        `;

        const [result] = await db.promise().query(sql, [
            value.trim(),
            1,
            1,
            createdate
        ]);

        return {
            id: result.insertId,
            name: value.trim()
        };
    }

    // ===============================
    // INSERT FUEL TYPE
    // ===============================
    if (tableName === "fuel_type") {

        const sql = `
            INSERT INTO fuel_type
            (name, status, create_date, create_id)
            VALUES (?, ?, ?, ?)
        `;

        const [result] = await db.promise().query(sql, [
            value.trim(),
            1,
            createdate,
            1
        ]);

        return {
            id: result.insertId,
            name: value.trim()
        };
    }

    // ===============================
    // INSERT VEHICLE CATEGORY
    // ===============================
    if (tableName === "vehicle_category") {

        const code = details?.[0]?.vehicle_category || "";

        const sql = `
            INSERT INTO vehicle_category
            (name, code, status, create_id, create_date)
            VALUES (?, ?, ?, ?, ?)
        `;

        const [result] = await db.promise().query(sql, [
            value.trim(),
            code,
            1,
            1,
            createdate
        ]);

        return {
            id: result.insertId,
            name: value.trim()
        };
    }

    // ===============================
    // INSERT VEHICLE MODEL
    // ===============================
    if (tableName === "vehicle_model") {
        
        const categoryId = ids?.[1] || null;
        const makeId = ids?.[0] || null;
        // const modelYear = details?.[0]?.vehicle_manufactured_date || null;
        const modelYear = details || null;
        // return details;
        const sql = `
            INSERT INTO vehicle_model
            (vehicle_category_id, vehicle_make_id, model_number, model_year, status, create_id, create_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const [result] = await db.promise().query(sql, [
            categoryId,
            makeId,
            value.trim(),
            modelYear,
            1,
            1,
            createdate
        ]);

        return {
            id: result.insertId,
            name: value.trim()
        };
    }

    // fallback
    return null;
}

function isExpiredSafe(date) {
    if (!date || date === "NA") return false;

    const parsed = moment(date, ["DD-MMM-YYYY", "YYYY-MM-DD"], true);
    if (!parsed.isValid()) return false;

    return parsed.isBefore(moment());
}

function isExpired(dateStr, timezone = "Asia/Calcutta") {
    
    if (!dateStr || dateStr === "NA") return false;

    const date = moment.tz(
        dateStr,
        [
            "DD-MMM-YYYY",
            "DD-MM-YYYY",
            "YYYY-MM-DD",
            "DD/MM/YYYY",
            "MM/YYYY"
        ],
        true,
        timezone
    );

    if (!date.isValid()) return false;

    const now = moment().tz(timezone).startOf("day");

    return date.isBefore(now);
}

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


async function getOrInsertValue1(value, bin, tableName, db,ids,details) {
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

