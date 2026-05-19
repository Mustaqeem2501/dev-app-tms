const { json } = require("body-parser");
const db = require("../config/db");
const {passenc}= require("../helpers/pass_enc");
const mongu =require("../lib/mongo/mongo_api");
const tokenWeb= require("../helpers/access_token_web");
const Kyccomponent = require("./components/KYCComponent");
const axios = require('axios');
const moment = require('moment-timezone');
const crypto = require("crypto");

// const s3 = require("../lib/aws-lib/s3")
// const cassCon = require("../lib/cassandra-lib/libLog");
// const tokenMobile= require("../helpers/access_token_mobile"); // MOBILE ACCESS_TOKEN
// const uploadS3 = require("./components/uploadS3Component");
// const { format, subHours, differenceInSeconds } = require('date-fns');
// const dayjs = require('dayjs');
// const path = require('path');
// const fs = require('fs');
// const FormData = require("form-data");






const testurl ="https://test.zoop.one/api/v1/" 
const APP_ID = "68b9928d9e0d1e0028a6ec21";
const API_KEY = "NXFZM42-T4PM25M-KTK25GW-3XE43CC";
const task_id = crypto.randomUUID();

const headers = {
    "app-id": APP_ID,
    "api-key": API_KEY,
    "Content-Type": "application/json",
};

exports.vehicleKYCV2 = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    const currentDateTime = moment();
    const dateTimeToday = moment().tz("Asia/Calcutta").format("YYYY-MM-DD HH:mm:ss");
    try {

        const { AccessToken, DeveloperOption, DeveloperOptionId, vehicle_number, consent, consent_text } = req.body;

        let final_data = { status: "fail" };

        // Validation
        if (!vehicle_number) {
            return res.status(400).json({
                status: "fail",
                message: "vehicle_number required"
            });
        }

        let user_info = {};

        // Developer login
        if (DeveloperOptionId && DeveloperOption && DeveloperOption == "dev0.01_" + dateToday) {
            user_info.Status = 1;
            user_info.AccountId = DeveloperOptionId;
        } else {
            user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        }

        if (!user_info || user_info.Status === 2) {
            return res.status(400).json({
                status: "fail",
                message: "Unauthorized"
            });
        }

        const user_id = user_info.AccountId;

        // user check
        const [result] = await db.promise().query(
            "SELECT id FROM user WHERE id=? AND status=1",
            [user_id]
        );

        if (!result.length) {
            return res.status(400).json({
                status: "fail",
                message: "User not found"
            });
        }

        // Insert KYC Request
        const [kycInsert] = await db.promise().query(
            `INSERT INTO kyc_request 
            (consent, request_for, vehicle_number, user_request, vendor_request, vendor_name, consent_text, status, create_id, create_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                consent,
                "vehicle",
                vehicle_number,                              
                1,
                0,
                "zoop",  
                consent_text,
                1,
                user_id,
                dateTimeToday
            ]
        );
        const request_id = kycInsert.insertId;

        const tableP = "kyc_vehicle_details";
        const vehicle_registration_number = vehicle_number.toUpperCase();

        let vehicledetails = await mongu.getCVMongoQuery(
            { rc_registration_number: vehicle_registration_number },
            { projection: { _id: 0 } },
            tableP
        );

        let callZoop = false;

        // ===============================
        // CHECK EXPIRY
        // ===============================

        if (vehicledetails.length > 0) {

            const veh = vehicledetails[0];

            /*console.log("Expiry Check =>", {
                rc: {
                    date: veh.rc_expiry_date,
                    expired: isExpired(veh.rc_expiry_date)
                },
                puc: {
                    date: veh.rc_pucc_expiry_date,
                    expired: isExpired(veh.rc_pucc_expiry_date)
                },
                fitness: {
                    date: veh.rc_fit_upto,
                    expired: isExpired(veh.rc_fit_upto)
                },
                permit: {
                    date: veh.national_permit_expiry_date,
                    expired: isExpired(veh.national_permit_expiry_date)
                },
                insurance: {
                    date: veh.insurance?.expiry_date,
                    expired: isExpired(veh.insurance?.expiry_date)
                }
            });*/

            if (
                isExpired(veh.rc_expiry_date) ||
                isExpired(veh.rc_pucc_expiry_date) ||
                isExpired(veh.rc_fit_upto) ||
                isExpired(veh.national_permit_expiry_date) ||
                isExpired(veh.insurance?.expiry_date)
            ) {
                callZoop = true;
            }
        }
        else {
            callZoop = true;
        }

        // ===============================
        // ZOOP CALL
        // ===============================

        if (callZoop) {

            let rcdata = await callZoopAPI(vehicle_registration_number);

            if (rcdata && rcdata.response_code == "100") {

                let finalData = {
                    task_id,
                    ...rcdata,
                    doc_type: 'vehicle',
                    create_id: user_id,
                    created_date: dateToday,
                    kyc_request_id: request_id,
                    status: 1
                };

                let insertId = await mongu.insertCVMongoQuery(finalData, tableP);
                // console.log("Mongo Inserted ID:", insertId);

                vehicledetails = [finalData];

                // Update vendor_request
                await db.promise().query(
                    "UPDATE kyc_request SET vendor_request=1 WHERE id=?",
                    [request_id]
                );
            }
        }

        // ===============================
        // MASTER DATA FETCH (Parallel)
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

        const vehicleMake_bin = {};
        vehicleMake.forEach(r => vehicleMake_bin[r.id] = r.name);

        const vehicleFuelType_bin = {};
        vehicleFuelType.forEach(r => vehicleFuelType_bin[r.id] = r.name);

        const vehicleCategory_bin = {};
        vehicleCategory.forEach(r => vehicleCategory_bin[r.id] = r.name);

        const vehicleModel_bin = {};
        vehicleModel.forEach(r => vehicleModel_bin[r.id] = r.model_number);

        // ===============================
        // SAFE VEHICLE DATA
        // ===============================

        const vehdata = vehicledetails?.[0] || {};

        let ids = [];

        const vehiclemake = await getOrInsertValue(
            vehdata.vehicle_maker_description,
            vehicleMake_bin,
            "vehicle_make",
            db,
            ids,
            vehicledetails
        );

        const fueltype = await getOrInsertValue(
            vehdata.vehicle_fuel_description,
            vehicleFuelType_bin,
            "fuel_type",
            db,
            ids,
            vehicledetails
        );

        const vehiclecatagory = await getOrInsertValue(
            vehdata.vehicle_class_description,
            vehicleCategory_bin,
            "vehicle_category",
            db,
            ids,
            vehicledetails
        );

        // FIXED BUG
        ids = [vehiclemake?.id, vehiclecatagory?.id];

        const vehiclemodel = await getOrInsertValue(
            vehdata.vehicle_make_model,
            vehicleModel_bin,
            "vehicle_model",
            db,
            ids,
            vehicledetails
        );

        const insurancedata = vehdata.insurance || {};

        // const response_data = {

        //     vehiclemake,
        //     fueltype,
        //     vehiclecatagory,
        //     vehiclemodel,

        //     registration_no: vehdata.rc_registration_number,

        //     rc: {
        //         doc_no: vehdata.rc_registration_number,
        //         IssueDate: vehdata.rc_registration_date,
        //         ExpiryDate: vehdata.rc_expiry_date
        //     },

        //     puc: {
        //         doc_no: vehdata.rc_pucc_no,
        //         IssueDate:"",
        //         ExpiryDate: vehdata.rc_pucc_expiry_date
        //     },

        //     permit: {
        //         doc_no: vehdata.national_permit_number,
        //         IssueDate: vehdata.national_permit_issued_by,
        //         ExpiryDate: vehdata.national_permit_expiry_date
        //     },

        //     insurance: {
        //         doc_no: insurancedata.policy_number,
        //         IssueDate: "",
        //         ExpiryDate: insurancedata.expiry_date
        //     },

        //     fitness: {
        //         doc_no: vehdata.rc_registration_number,
        //         IssueDate: "",
        //         ExpiryDate: vehdata.rc_fit_upto
        //     }
        // };

        const response_data = [
    {
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

        vehicle_type: {
            id: null, // Zoop se nahi aa raha
            name: null // Zoop se nahi aa raha
        },

        registrationNumber: vehdata.rc_registration_number || null,
        registrationDate: vehdata.rc_registration_date || null,

        vehicle_capacity: {
            id: null, // Zoop se nahi aa raha
            name: null // Zoop se nahi aa raha
        },

        vehicle_fuel_type: {
            id: fueltype?.id || null,
            name: fueltype?.name || null
        },

        overSpeedLimit: null,

        vehicle_size: {
            id: null,
            name: null
        },

        registrationDocumentNumber: vehdata.rc_registration_number || null,
        registrationIssueDate: vehdata.rc_registration_date || null,
        registrationExpiryDate: vehdata.rc_expiry_date || null,

        pollutionDocumentNumber: vehdata.rc_pucc_no || null,
        pollutionIssueDate: null,
        pollutionExpiryDate: vehdata.rc_pucc_expiry_date || null,

        insuranceDocumentNumber: vehdata.insurance?.policy_number || null,
        insuranceIssueDate: null,
        insuranceExpiryDate: vehdata.insurance?.expiry_date || null,

        fitnessDocumentNumber: vehdata.rc_registration_number || null,
        fitnessIssueDate: null,
        fitnessExpiryDate: vehdata.rc_fit_upto || null,

        Elock: vehdata.is_fixed_door_e_lock === 1,
        GPS: vehdata.is_gps === 1,
        "Dual Driver": vehdata.is_door_close === 1,
        "Fire Fighting": null,
        "Portable E-Lock": null,
        Tarpaulin: vehdata.is_tarpaulin === 1
    }
];

        return res.status(200).json({
            status: "success",
            data: response_data
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            status: "fail",
            message: error.message
        });
    }
};

exports.vehicleDetails = async (req, res) => {

    const dateToday = moment().tz('Asia/Calcutta').format("YYYY-MM-DD");
    const currentDateTime = moment();

    try {

        const { AccessToken, DeveloperOption, DeveloperOptionId, vehicle_number } = req.body;

        let final_data = { status: "fail" };

        // ===============================
        // Validation
        // ===============================

        if (!vehicle_number) {
            return res.status(400).json({
                status: "fail",
                message: "vehicle_number required"
            });
        }

        let user_info = {};

        // ===============================
        // Developer login
        // ===============================

        if (DeveloperOptionId && DeveloperOption && DeveloperOption == "dev0.01_" + dateToday) {
            user_info.Status = 1;
            user_info.AccountId = DeveloperOptionId;
        } else {
            user_info = await tokenWeb.isAuthorizedAccessWeb(AccessToken);
        }

        if (!user_info || user_info.Status === 2) {
            return res.status(400).json({
                status: "fail",
                message: "Unauthorized"
            });
        }

        const user_id = user_info.AccountId;

        // ===============================
        // user check
        // ===============================

        const [result] = await db.promise().query(
            "SELECT id FROM user WHERE id=? AND status=1",
            [user_id]
        );

        if (!result.length) {
            return res.status(400).json({
                status: "fail",
                message: "User not found"
            });
        }

        // ===============================
        // Vehicle Fetch From MySQL
        // ===============================

        const [vehicleResult] = await db.promise().query(
            `SELECT * FROM vehicle 
             WHERE vehicle_number=? 
             AND status=1`,
            [vehicle_number]
        );

        if (!vehicleResult.length) {
            return res.status(404).json({
                status: "fail",
                message: "Vehicle not found"
            });
        }

        const vehdata = vehicleResult[0];

        // ===============================
        // Master Data Fetch
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

        const vehicleMake_bin = {};
        vehicleMake.forEach(r => vehicleMake_bin[r.id] = r.name);

        const vehicleFuelType_bin = {};
        vehicleFuelType.forEach(r => vehicleFuelType_bin[r.id] = r.name);

        const vehicleCategory_bin = {};
        vehicleCategory.forEach(r => vehicleCategory_bin[r.id] = r.name);

        const vehicleModel_bin = {};
        vehicleModel.forEach(r => vehicleModel_bin[r.id] = r.model_number);

        // ===============================
        // Response Structure (Same as KYC)
        // ===============================

        const response_data = {

            make: {
                id: vehdata.vehicle_make_id,
                name: vehicleMake_bin[vehdata.vehicle_make_id] || ""
            },

            vehicle_fuel_type: {
                id: vehdata.fuel_type,
                name: vehicleFuelType_bin[vehdata.fuel_type] || ""
            },

            category: {
                id: vehdata.vehicle_category_id,
                name: vehicleCategory_bin[vehdata.vehicle_category_id] || ""
            },

            model: {
                id: vehdata.vehicle_model_id,
                name: vehicleModel_bin[vehdata.vehicle_model_id] || ""
            },

            // =========================
            // Basic Vehicle Info
            // =========================

            registrationNumber: vehdata.vehicle_number,
            transporter_id: vehdata.transporter_id,
            vehicle_type: vehdata.vehicle_type,
            vehicle_size: vehdata.vehicle_size,
            mileage: vehdata.mileage,
            fuel_type: vehdata.fuel_type,
            tank_capacity: vehdata.tank_capacity,
            max_speed: vehdata.max_speed,
            vehicle_capacity_tons: vehdata.vehicle_capacity_tons,

            // =========================
            // Driver & Contact
            // =========================

            driver_id: vehdata.driver_id,
            contact_no: vehdata.contact_no,
            emails: vehdata.emails,
            phones: vehdata.phones,

            // =========================
            // RC
            // =========================

            rc: {
                doc_no: vehdata.registration_no || vehdata.vehicle_number,
                IssueDate: vehdata.registration_date,
                ExpiryDate: vehdata.registration_date
            },

            // =========================
            // PUC
            // =========================

            puc: {
                doc_no: vehdata.pollution_no,
                IssueDate: "",
                ExpiryDate: vehdata.pollution_date
            },

            // =========================
            // Permit
            // =========================

            permit: {
                doc_no: vehdata.permit_type,
                IssueDate: "",
                ExpiryDate: vehdata.permit_type_date
            },

            // =========================
            // Insurance
            // =========================

            insurance: {
                doc_no: vehdata.insurance_no,
                IssueDate: "",
                ExpiryDate: vehdata.insurance_validity,
                insured_name: vehdata.insured_name
            },

            // =========================
            // Fitness
            // =========================

            fitness: {
                doc_no: vehdata.fitness_no,
                IssueDate: "",
                ExpiryDate: vehdata.fitness_date
            },

            // =========================
            // Road Tax
            // =========================

            road_tax: {
                doc_no: vehdata.road_tax_no,
                ExpiryDate: vehdata.road_tax_date
            },

            // =========================
            // Other Flags
            // =========================

            is_verified: vehdata.is_verified,
            is_gps: vehdata.is_gps,
            is_dual_driver: vehdata.is_dual_driver,
            is_refrigrated: vehdata.is_refrigrated,
            is_fire_extinguisher: vehdata.is_fire_extinguisher,

            // =========================
            // Images
            // =========================

            vehicle_image: vehdata.vehicle_image,
            vehicle_icon: vehdata.vehicle_icon,

            // =========================
            // System Data
            // =========================

            create_date: vehdata.create_date,
            status: vehdata.status
        };

        return res.status(200).json({
            status: "success",
            data: response_data
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            status: "fail",
            message: error.message
        });
    }
};

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
        const modelYear = details?.[0]?.vehicle_manufactured_date || null;

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


async function callZoopAPI(vehicle_number, debug = true) {

    try {

        // =========================
        // DEBUG MODE (Dummy Data)
        // =========================
        if (debug) {

            return {
                success: true,
                response_code: "100",
                response_message: "Valid Authentication",

                metadata: { billable: "Y" },

                rc_blacklist_status: 'NA',
                body_type_description: 'SOLO',
                rc_chassis_number: 'ME4JF505BGT065686',
                father_name: 'NA',
                financer: 'NA',

                insurance: {
                    company: 'The New India Assurance Company Limited',
                    company_id: 'NA',
                    expiry_date: '24-Feb-2026',
                    policy_number: '42011031240100001908'
                },

                invoice_info: {
                    purchase_date: 'NA',
                    purchase_amount: 'NA',
                    dealer_name: 'NA',
                    dealer_address: 'NA'
                },

                national_permit_expiry_date: 'NA',
                national_permit_issued_by: 'NA',
                national_permit_number: 'NA',

                norms_description: 'BHARAT STAGE II',
                vehicle_owner_number: '1',

                user_first_name: 'NA',
                user_second_name: 'NA',

                pincode: 'NA',

                user_permanent_address:
                'H NO-G-3005 AWAS VIKAS,-1 KALYANPUR KANPUR,KANPUR,999999',

                user_present_address:
                'H NO-G-3005 AWAS VIKAS,-1 KALYANPUR KANPUR,KANPUR,999999',

                rc_engine_number: 'JF50ET3066025',

                rc_expiry_date: '23-Feb-2031',
                rc_fit_upto: '23-Feb-2031',

                rc_noc_details: 'NA',
                rc_permit_expiry_date: 'NA',
                rc_permit_issued_date: 'NA',
                rc_permit_number: 'NA',
                rc_permit_start_date: 'NA',
                rc_permit_type: 'NA',

                rc_pucc_expiry_date: 'NA',
                rc_pucc_no: 'NA',

                rc_registration_date: '24-Feb-2016',

                rc_registration_location: 'KANPUR NAGAR, Uttar Pradesh',

                rc_registration_number: vehicle_number,

                rc_state_code: 'UP',

                rc_status: 'ACTIVE',
                rc_status_as_on: '07-Oct-2025',

                rc_tax_upto: '21-Feb-2031',
                rc_source: 'P',

                user_name: 'DEEPAK DWIVEDI ',

                vehicle_category: '2WN',

                vehicle_class_description: 'M-Cycle/Scooter(2WN)',

                vehicle_color: 'BLACK',
                vehicle_cubic_capacity: '109',

                vehicle_fuel_description: 'PETROL',

                vehicle_gross_weight: '269',

                vehicle_make_model: 'ACTIVA 3G',

                vehicle_maker_description:
                'HONDA MOTORCYCLE AND SCOOTER INDIA (P) LTD',

                vehicle_manufactured_date: '01/2016',

                vehicle_number_of_cylinders: '1',

                vehicle_seating_capacity: '2',
                vehicle_sleeper_capacity: 'NA',
                vehicle_stand_capacity: 'NA',

                vehicle_unladen_weight: '108',
                vehicle_wheelbase: '1238',

                vehicle_type: '2W',

                rc_commercial_status: 'NO',

                rc_rto_code: 'UP-78',

                vehicle_financed: 'NA',

                month_year_remaining_for_insurance_exp: 'NA',

                insurance_expired: 'N',

                vehicle_fitness_expired: 'N',

                vehicle_age: '9 years 7 months',

                city: 'Kanpur',
                state: 'UttarPradesh',

                pdf_profile_file: 'NA',

                vehicle_category_description: 'TW',

                created_date: moment().format("YYYY-MM-DD"),

                status: 1

            };
        }

        // =========================
        // PRODUCTION MODE
        // =========================

        const url = process.env.ZOOP_API_URL;

        const headers = {
            "Content-Type": "application/json",
            "app-id": process.env.ZOOP_APP_ID,
            "api-key": process.env.ZOOP_API_KEY
        };

        const payload = {
            vehicle_number: vehicle_number
        };

        const response = await axios.post(url, payload, { headers });

        return response.data;

    } catch (error) {

        console.error("Zoop API Error:", error.message);

        return {
            success: false,
            response_code: "500",
            response_message: "Zoop API Error"
        };
    }
}

// =============================== NOT USED FUNCTION ===============================

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




















